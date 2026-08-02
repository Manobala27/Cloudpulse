import json
import os
import sys

# Mock environment variables before importing
os.environ["DEMO_USERNAME"] = "admin"
# bcrypt hash for "password123"
import bcrypt

mock_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode("utf-8")
os.environ["DEMO_PASSWORD_HASH"] = mock_hash
os.environ["JWT_SECRET"] = "test-secret"

import datetime

import jwt
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
import authorizer
import login


def test_login_success():
    event = {"body": json.dumps({"username": "admin", "password": "password123"})}
    response = login.lambda_handler(event, None)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "token" in body
    assert body["username"] == "admin"

    # Verify token
    token = body["token"]
    payload = jwt.decode(token, "test-secret", algorithms=["HS256"])
    assert payload["sub"] == "admin"


def test_login_invalid_password():
    event = {"body": json.dumps({"username": "admin", "password": "wrong"})}
    response = login.lambda_handler(event, None)

    assert response["statusCode"] == 401
    body = json.loads(response["body"])
    assert "Invalid credentials" in body["message"]


def test_login_invalid_user():
    event = {"body": json.dumps({"username": "hacker", "password": "password123"})}
    response = login.lambda_handler(event, None)

    assert response["statusCode"] == 401


def test_login_missing_fields():
    event = {"body": json.dumps({"username": "admin"})}
    response = login.lambda_handler(event, None)

    assert response["statusCode"] == 400


def test_authorizer_success():
    # Generate valid token
    token = jwt.encode(
        {
            "sub": "admin",
            "exp": datetime.datetime.now(datetime.timezone.utc)
            + datetime.timedelta(minutes=30),
        },
        "test-secret",
        algorithm="HS256",
    )

    event = {
        "authorizationToken": f"Bearer {token}",
        "methodArn": "arn:aws:execute-api:us-east-1:123456789012:api-id/dev/GET/logs",
    }

    response = authorizer.lambda_handler(event, None)

    assert response["principalId"] == "admin"
    assert response["policyDocument"]["Statement"][0]["Effect"] == "Allow"


def test_authorizer_expired_token():
    # Generate expired token
    token = jwt.encode(
        {
            "sub": "admin",
            "exp": datetime.datetime.now(datetime.timezone.utc)
            - datetime.timedelta(minutes=30),
        },
        "test-secret",
        algorithm="HS256",
    )

    event = {
        "authorizationToken": f"Bearer {token}",
        "methodArn": "arn:aws:execute-api:us-east-1:123456789012:api-id/dev/GET/logs",
    }

    with pytest.raises(Exception) as exc_info:
        authorizer.lambda_handler(event, None)

    assert str(exc_info.value) == "Unauthorized"


def test_authorizer_invalid_token():
    event = {
        "authorizationToken": "Bearer invalid.token.here",
        "methodArn": "arn:aws:execute-api:us-east-1:123456789012:api-id/dev/GET/logs",
    }

    with pytest.raises(Exception) as exc_info:
        authorizer.lambda_handler(event, None)

    assert str(exc_info.value) == "Unauthorized"


def test_authorizer_missing_token():
    event = {
        "methodArn": "arn:aws:execute-api:us-east-1:123456789012:api-id/dev/GET/logs"
    }

    with pytest.raises(Exception) as exc_info:
        authorizer.lambda_handler(event, None)

    assert str(exc_info.value) == "Unauthorized"
