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
def test_valid_event(mock_table, caplog):
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
    assert any(getattr(r, "status", "") == "success" for r in caplog.records)
    assert any(getattr(r, "request_id", "") == "req-123" for r in caplog.records)


@patch("log_processor.table")
def test_invalid_json(mock_table, caplog):
    event = generate_sqs_event(raw_body="INVALID_JSON{")

    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert any("Invalid JSON" in r.message for r in caplog.records)


@patch("log_processor.table")
def test_missing_fields(mock_table, caplog):
    invalid_payload = {
        "service": "payment-service",
        "level": "ERROR",
        # missing timestamp, message, request_id
    }
    event = generate_sqs_event(invalid_payload)

    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert any("Missing required fields" in r.message for r in caplog.records)


@patch("log_processor.table")
def test_invalid_log_level(mock_table, caplog):
    invalid_payload = {
        "timestamp": "2026-07-21T10:30:00Z",
        "service": "payment-service",
        "level": "DEBUG",  # Invalid level
        "message": "Debug info",
        "request_id": "req-123",
    }
    event = generate_sqs_event(invalid_payload)

    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert any("Invalid log level" in r.message for r in caplog.records)


@patch("log_processor.table")
def test_multiple_records(mock_table, caplog):
    valid_payload = {
        "timestamp": "2026-07-21T10:30:00Z",
        "service": "payment-service",
        "level": "INFO",
        "message": "OK",
        "request_id": "req-1",
    }
    invalid_payload = {"service": "payment-service"}  # Missing fields
    event = {
        "Records": [
            {"messageId": "msg-1", "body": json.dumps(valid_payload)},
            {"messageId": "msg-2", "body": json.dumps(invalid_payload)},
        ]
    }

    response = log_processor.lambda_handler(event, None)

    assert response["statusCode"] == 200
    assert any(getattr(r, "status", "") == "success" for r in caplog.records)
    assert any("Missing required fields" in r.message for r in caplog.records)


@patch("log_processor.table")
def test_empty_batch(mock_table, caplog):
    event = {"Records": []}
    response = log_processor.lambda_handler(event, None)
    assert response["statusCode"] == 200
    assert "Received batch of 0 records" in caplog.text
