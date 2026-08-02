import os
from typing import Any, Dict

import jwt
from aws_lambda_powertools import Logger, Metrics, Tracer

logger = Logger(service="authorizer")
tracer = Tracer(service="authorizer")
metrics = Metrics(namespace="CloudPulse", service="authorizer")

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    logger.error("JWT_SECRET environment variable is missing!")
    raise ValueError("Missing JWT_SECRET")


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    # Support both Token and Request authorizers format
    token = event.get("authorizationToken")

    if not token and "headers" in event:
        auth_header = event["headers"].get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        logger.warning("No token provided")
        raise Exception("Unauthorized")  # API Gateway interprets this as 401

    if token.startswith("Bearer "):
        token = token[7:]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub")

        logger.info(f"Successfully authorized user: {username}")
        return generate_policy(username, "Allow", event["methodArn"])

    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise Exception("Unauthorized")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        raise Exception("Unauthorized")
    except Exception as e:
        logger.error(f"Authorizer error: {str(e)}")
        # For unexpected errors, return Deny (403)
        return generate_policy("user", "Deny", event["methodArn"])


def generate_policy(principal_id: str, effect: str, resource: str) -> Dict[str, Any]:
    tmp = resource.split(":")
    api_gateway_arn_tmp = tmp[5].split("/")
    aws_account_id = tmp[4]

    # Allow caching by returning wildcard resource for this API stage
    policy_resource = f"arn:aws:execute-api:{tmp[3]}:{aws_account_id}:{api_gateway_arn_tmp[0]}/{api_gateway_arn_tmp[1]}/*/*"

    auth_response = {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": policy_resource,
                }
            ],
        },
        "context": {"username": principal_id},
    }

    return auth_response
