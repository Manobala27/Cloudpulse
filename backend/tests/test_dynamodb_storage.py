import json
import os
import sys
from unittest.mock import patch

# Mock environment variable before importing log_processor
os.environ["DYNAMODB_TABLE_NAME"] = "test-table"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
import log_processor


def generate_sqs_event(body_dict=None, raw_body=None):
    if raw_body is not None:
        body = raw_body
    else:
        body = json.dumps(body_dict or {})
    return {"Records": [{"messageId": "msg-123", "body": body}]}


@patch("log_processor.table")
def test_valid_insert(mock_table, caplog):
    valid_payload = {
        "timestamp": "2026-07-21T10:30:00Z",
        "service": "payment-service",
        "level": "ERROR",
        "message": "Payment failed",
        "request_id": "req-123",
    }
    event = generate_sqs_event(valid_payload)

    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    mock_table.put_item.assert_called_once()
    call_kwargs = mock_table.put_item.call_args[1]
    assert "Item" in call_kwargs
    assert call_kwargs["Item"]["request_id"] == "req-123"
    assert "attribute_not_exists(request_id)" in call_kwargs["ConditionExpression"]

    assert any(getattr(r, "status", "") == "success" for r in caplog.records)


@patch("log_processor.table")
def test_duplicate_insert(mock_table, caplog):
    from botocore.exceptions import ClientError

    error_response = {
        "Error": {
            "Code": "ConditionalCheckFailedException",
            "Message": "Condition failed",
        }
    }
    mock_table.put_item.side_effect = ClientError(error_response, "PutItem")

    valid_payload = {
        "timestamp": "2026-07-21T10:30:00Z",
        "service": "payment-service",
        "level": "INFO",
        "message": "Duplicate",
        "request_id": "req-123",
    }
    event = generate_sqs_event(valid_payload)

    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert any(
        getattr(r, "storage_status", None) == "DUPLICATE" for r in caplog.records
    )
    assert any(
        getattr(r, "error_reason", "") == "Duplicate request ignored."
        for r in caplog.records
    )


@patch("log_processor.table")
def test_dynamodb_exception(mock_table, caplog):
    from botocore.exceptions import ClientError

    error_response = {
        "Error": {
            "Code": "ProvisionedThroughputExceededException",
            "Message": "Throttled",
        }
    }
    mock_table.put_item.side_effect = ClientError(error_response, "PutItem")

    valid_payload = {
        "timestamp": "2026-07-21T10:30:00Z",
        "service": "payment-service",
        "level": "INFO",
        "message": "Throttled",
        "request_id": "req-123",
    }
    event = generate_sqs_event(valid_payload)

    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert "DynamoDB error" in caplog.text


@patch("log_processor.table")
def test_validation_failure(mock_table, caplog):
    # Validation failure shouldn't even call DynamoDB
    invalid_payload = {"service": "payment-service"}  # Missing required fields
    event = generate_sqs_event(invalid_payload)

    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert mock_table.put_item.call_count == 0
    assert any("Missing required fields" in r.message for r in caplog.records)


@patch("log_processor.table")
def test_mixed_batch(mock_table, caplog):
    from botocore.exceptions import ClientError

    valid_payload = {
        "timestamp": "2026-07-21T10:30:00Z",
        "service": "payment-service",
        "level": "INFO",
        "message": "OK",
        "request_id": "req-1",
    }
    dup_payload = {
        "timestamp": "2026-07-21T10:30:00Z",
        "service": "payment-service",
        "level": "INFO",
        "message": "DUP",
        "request_id": "req-2",
    }

    event = {
        "Records": [
            {"messageId": "msg-1", "body": json.dumps(valid_payload)},
            {"messageId": "msg-2", "body": json.dumps(dup_payload)},
            {"messageId": "msg-3", "body": "BAD_JSON{"},
        ]
    }

    def side_effect(*args, **kwargs):
        item = kwargs.get("Item", {})
        if item.get("request_id") == "req-2":
            raise ClientError(
                {
                    "Error": {
                        "Code": "ConditionalCheckFailedException",
                        "Message": "Duplicate",
                    }
                },
                "PutItem",
            )
        return {}

    mock_table.put_item.side_effect = side_effect

    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert mock_table.put_item.call_count == 2
    assert any(getattr(r, "status", "") == "success" for r in caplog.records)
    assert any(
        getattr(r, "storage_status", None) == "DUPLICATE" for r in caplog.records
    )
    assert any("Invalid JSON" in r.message for r in caplog.records)
