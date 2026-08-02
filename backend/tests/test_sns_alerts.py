import importlib
import json
import os
import sys
from unittest.mock import patch

# Mock environment variables
os.environ["DYNAMODB_TABLE_NAME"] = "test-table"
os.environ["SNS_TOPIC_ARN"] = "arn:aws:sns:REGION:ACCOUNT:test-topic"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
import log_processor

importlib.reload(log_processor)


def generate_sqs_event(level="ERROR"):
    body = {
        "timestamp": "2026-07-22T10:30:00Z",
        "service": "test-service",
        "level": level,
        "message": f"Message with {level}",
        "request_id": f"req-{level.lower()}",
    }
    return {"Records": [{"messageId": "msg-1", "body": json.dumps(body)}]}


@patch("log_processor.sns_client")
@patch("log_processor.table")
def test_info_no_publish(mock_table, mock_sns, caplog):
    event = generate_sqs_event("INFO")
    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    mock_table.put_item.assert_called_once()
    mock_sns.publish.assert_not_called()
    assert any(getattr(r, "alert_status", None) == "SKIPPED" for r in caplog.records)


@patch("log_processor.sns_client")
@patch("log_processor.table")
def test_warning_no_publish(mock_table, mock_sns, caplog):
    event = generate_sqs_event("WARNING")
    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    mock_sns.publish.assert_not_called()
    assert any(getattr(r, "alert_status", None) == "SKIPPED" for r in caplog.records)


@patch("log_processor.sns_client")
@patch("log_processor.table")
def test_error_publish(mock_table, mock_sns, caplog):
    event = generate_sqs_event("ERROR")
    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    mock_sns.publish.assert_called_once()

    # Verify SNS payload
    call_args = mock_sns.publish.call_args[1]
    payload = json.loads(call_args["Message"])
    assert payload["status"] == "ALERT_TRIGGERED"
    assert payload["level"] == "ERROR"

    assert any(getattr(r, "alert_status", None) == "PUBLISHED" for r in caplog.records)


@patch("log_processor.sns_client")
@patch("log_processor.table")
def test_critical_publish(mock_table, mock_sns, caplog):
    event = generate_sqs_event("CRITICAL")
    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    mock_sns.publish.assert_called_once()
    assert any(getattr(r, "alert_status", None) == "PUBLISHED" for r in caplog.records)


@patch("log_processor.sns_client")
@patch("log_processor.table")
def test_sns_publish_failure(mock_table, mock_sns, caplog):
    mock_sns.publish.side_effect = Exception("Mock SNS Failure")

    event = generate_sqs_event("ERROR")
    response = log_processor.lambda_handler(event, None)

    # Should handle error gracefully without throwing exception
    assert response["statusCode"] == 200
    assert any(getattr(r, "alert_status", None) == "FAILED" for r in caplog.records)
    assert any("Mock SNS Failure" in r.message for r in caplog.records)


@patch("log_processor.sns_client")
@patch("log_processor.table")
def test_mixed_batch_processing(mock_table, mock_sns, caplog):
    # Batch with INFO, ERROR, WARNING, CRITICAL, and INVALID
    event = {
        "Records": [
            {
                "messageId": "m1",
                "body": json.dumps(
                    {
                        "timestamp": "2026-07-22T10:30:00Z",
                        "service": "s",
                        "level": "INFO",
                        "message": "m",
                        "request_id": "r1",
                    }
                ),
            },
            {
                "messageId": "m2",
                "body": json.dumps(
                    {
                        "timestamp": "2026-07-22T10:30:00Z",
                        "service": "s",
                        "level": "ERROR",
                        "message": "m",
                        "request_id": "r2",
                    }
                ),
            },
            {"messageId": "m3", "body": "INVALID_JSON"},
            {
                "messageId": "m4",
                "body": json.dumps(
                    {
                        "timestamp": "2026-07-22T10:30:00Z",
                        "service": "s",
                        "level": "CRITICAL",
                        "message": "m",
                        "request_id": "r4",
                    }
                ),
            },
        ]
    }

    response = log_processor.lambda_handler(event, None)
    assert response["statusCode"] == 200

    assert mock_table.put_item.call_count == 3
    assert mock_sns.publish.call_count == 2  # Only ERROR and CRITICAL
