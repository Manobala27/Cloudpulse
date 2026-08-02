import json
import os
from unittest.mock import MagicMock, patch

# Set required env vars for powertools before importing
os.environ["POWERTOOLS_SERVICE_NAME"] = "test-service"
os.environ["POWERTOOLS_METRICS_NAMESPACE"] = "CloudPulse"
os.environ["POWERTOOLS_TRACE_DISABLED"] = "1"

import log_processor
import log_query
import login


def test_health_endpoint():
    event = {"path": "/health", "httpMethod": "GET"}

    # log_query's table is initialized on load, let's mock it
    with patch("log_query.table", MagicMock()):
        response = log_query.lambda_handler(event, None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])

    assert "api_status" in body
    assert body["api_status"] == "healthy"
    assert "database_status" in body
    assert "sqs_status" in body
    assert "sns_status" in body
    assert "authentication_status" in body
    assert "timestamp" in body
    assert "version" in body


def test_structured_logging_and_correlation_id(caplog):
    event = {
        "Records": [
            {
                "messageId": "test-msg",
                "body": json.dumps(
                    {
                        "timestamp": "2024-01-01T00:00:00Z",
                        "service": "test-svc",
                        "level": "INFO",
                        "message": "test",
                        "request_id": "test-req-id",
                    }
                ),
            }
        ]
    }

    with (
        patch("log_processor.table", MagicMock()),
        patch("log_processor.sns_client", MagicMock()),
    ):
        log_processor.lambda_handler(event, None)

    record = next(
        (r for r in caplog.records if getattr(r, "event", None) == "log_processed"),
        None,
    )
    assert record is not None
    assert record.request_id == "test-req-id"
    assert record.levelno == 20  # INFO
    assert record.status == "success"


def test_metrics_emission(capsys):
    event = {
        "path": "/login",
        "httpMethod": "POST",
        "body": json.dumps({"username": "admin", "password": "password123"}),
    }

    with (
        patch("bcrypt.checkpw", return_value=True),
        patch("jwt.encode", return_value="token"),
    ):
        login.lambda_handler(event, None)

    captured = capsys.readouterr()
    assert "LoginSuccess" in captured.out
