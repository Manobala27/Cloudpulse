import datetime
import json
import os
import time

import bcrypt
import jwt
from aws_lambda_powertools import Logger, Metrics, Tracer

logger = Logger(service="login-service")
tracer = Tracer(service="login-service")
metrics = Metrics(namespace="CloudPulse", service="login-service")

# Read from environment
DEMO_USERNAME = os.environ.get("DEMO_USERNAME", "admin")
DEMO_PASSWORD_HASH = os.environ.get("DEMO_PASSWORD_HASH", "")
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    logger.error("JWT_SECRET environment variable is missing!")
    raise ValueError("Missing JWT_SECRET")


@tracer.capture_lambda_handler
@metrics.log_metrics(capture_cold_start=True)
def lambda_handler(event, context):
    logger.append_keys(
        request_id=event.get("requestContext", {}).get("requestId", "UNKNOWN")
    )
    start_time = time.time()

    try:
        logger.info("Starting request parsing")
        body = json.loads(event.get("body", "{}"))
        username = body.get("username")
        password = body.get("password")
        logger.info("Finished request parsing")

        if not username or not password:
            return {
                "statusCode": 400,
                "headers": _get_cors_headers(),
                "body": json.dumps({"message": "Username and password required."}),
            }

        logger.info(f"Starting username verification for {username}")
        # Verify user
        if username != DEMO_USERNAME:
            logger.warning(f"Failed login attempt for user: {username}")
            return _unauthorized_response()
        logger.info("Finished username verification")

        logger.info("Starting password verification")
        # Verify password
        if not DEMO_PASSWORD_HASH:
            logger.error("DEMO_PASSWORD_HASH is not set.")
            return _server_error_response()

        password_bytes = password.encode("utf-8")
        hash_bytes = DEMO_PASSWORD_HASH.encode("utf-8")

        logger.info("Executing bcrypt.checkpw()")
        if not bcrypt.checkpw(password_bytes, hash_bytes):
            logger.warning(
                f"Failed login attempt for user: {username} (invalid password)"
            )
            return _unauthorized_response()
        logger.info("Finished password verification")

        logger.info("Starting JWT generation")
        # Generate JWT
        exp_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            minutes=30
        )

        payload = {
            "sub": username,
            "exp": int(exp_time.timestamp()),
            "iat": int(datetime.datetime.now(datetime.timezone.utc).timestamp()),
            "iss": "cloudpulse-auth",
        }

        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        logger.info("Finished JWT generation")

        execution_time = time.time() - start_time
        logger.info(
            "Login successful",
            extra={
                "event": "login",
                "username": username,
                "status": "success",
                "execution_time": execution_time,
            },
        )
        metrics.add_metric(name="LoginSuccess", unit="Count", value=1)

        return {
            "statusCode": 200,
            "headers": _get_cors_headers(),
            "body": json.dumps(
                {"token": token, "expires_in": 1800, "username": username}
            ),
        }

    except json.JSONDecodeError:
        return {
            "statusCode": 400,
            "headers": _get_cors_headers(),
            "body": json.dumps({"message": "Invalid JSON body."}),
        }
    except Exception as e:
        logger.exception(f"Unexpected error in login: {str(e)}")
        return _server_error_response()


def _unauthorized_response():
    return {
        "statusCode": 401,
        "headers": _get_cors_headers(),
        "body": json.dumps({"message": "Invalid credentials."}),
    }


def _server_error_response():
    return {
        "statusCode": 500,
        "headers": _get_cors_headers(),
        "body": json.dumps({"message": "Internal server error."}),
    }


def _get_cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'none'",
        "Referrer-Policy": "no-referrer",
    }
