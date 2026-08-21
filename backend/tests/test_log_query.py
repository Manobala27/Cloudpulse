import json
import os
import sys
from unittest.mock import patch

from botocore.exceptions import ClientError

os.environ["DYNAMODB_TABLE_NAME"] = "test-table"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
import importlib

import log_query

importlib.reload(log_query)


@patch("log_query.table")
def test_health_endpoint(mock_table):
    event = {"path": "/health", "httpMethod": "GET"}
    response = log_query.lambda_handler(event, None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["api_status"] == "healthy"


@patch("log_query.table")
def test_get_logs(mock_table):
    mock_table.scan.return_value = {
        "Items": [
            {
                "service_name": "s1",
                "timestamp": "2026-07-22T10:00:00Z",
                "level": "INFO",
            },
            {
                "service_name": "s2",
                "timestamp": "2026-07-22T11:00:00Z",
                "level": "ERROR",
            },
        ]
    }
    event = {"path": "/logs", "httpMethod": "GET"}
    response = log_query.lambda_handler(event, None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body["logs"]) == 2
    # Ensure newest first
    assert body["logs"][0]["level"] == "ERROR"


@patch("log_query.table")
def test_empty_table(mock_table):
    mock_table.scan.return_value = {"Items": []}
    event = {"path": "/logs", "httpMethod": "GET"}
    response = log_query.lambda_handler(event, None)

    assert response["statusCode"] == 404
    body = json.loads(response["body"])
    assert "No logs found" in body["message"]


@patch("log_query.table")
def test_invalid_limit(mock_table):
    event = {
        "path": "/logs",
        "httpMethod": "GET",
        "queryStringParameters": {"limit": "150"},
    }
    response = log_query.lambda_handler(event, None)

    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert "Limit must be between 1 and 100" in body["error"]

    event["queryStringParameters"]["limit"] = "invalid"
    response = log_query.lambda_handler(event, None)

    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert "Invalid limit parameter" in body["error"]


@patch("log_query.table")
def test_invalid_level(mock_table):
    event = {
        "path": "/logs/level/DEBUG",
        "httpMethod": "GET",
        "pathParameters": {"level": "DEBUG"},
    }
    response = log_query.lambda_handler(event, None)

    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert "Invalid level" in body["error"]


@patch("log_query.table")
def test_dynamodb_exception(mock_table):
    error_response = {"Error": {"Code": "InternalServerError", "Message": "DB down"}}
    mock_table.scan.side_effect = ClientError(error_response, "Scan")

    event = {"path": "/logs", "httpMethod": "GET"}
    response = log_query.lambda_handler(event, None)

    assert response["statusCode"] == 500
    body = json.loads(response["body"])
    assert "Internal server error" in body["error"]


@patch("log_query.table")
def test_service_filter(mock_table):
    mock_table.query.return_value = {
        "Items": [
            {
                "service_name": "payment",
                "timestamp": "2026-07-22T10:00:00Z",
                "level": "INFO",
            }
        ]
    }
    event = {
        "path": "/logs/service/payment",
        "httpMethod": "GET",
        "pathParameters": {"service_name": "payment"},
    }
    response = log_query.lambda_handler(event, None)

    assert response["statusCode"] == 200
    mock_table.query.assert_called_once()
    body = json.loads(response["body"])
    assert len(body["logs"]) == 1
    assert body["logs"][0]["service_name"] == "payment"
