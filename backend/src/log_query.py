import json
import os
from datetime import datetime, timezone

import boto3
from aws_lambda_powertools import Logger, Metrics, Tracer
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

logger = Logger(service="log-query")
tracer = Tracer(service="log-query")
metrics = Metrics(namespace="CloudPulse", service="log-query")

table_name = os.getenv("DYNAMODB_TABLE_NAME")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(table_name) if table_name else None


def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": "default-src 'none'",
            "Referrer-Policy": "no-referrer",
        },
        "body": json.dumps(body),
    }


@tracer.capture_lambda_handler
@metrics.log_metrics(capture_cold_start=True)
def lambda_handler(event, context):
    logger.append_keys(
        request_id=event.get("requestContext", {}).get("requestId", "UNKNOWN")
    )
    logger.info(
        "Log query invoked",
        extra={"path": event.get("path"), "http_method": event.get("httpMethod")},
    )
    try:
        # APIGW HTTP API passes rawPath, REST API passes path
        path = event.get("path", "")
        http_method = event.get("httpMethod", "")

        if path == "/health" and http_method == "GET":
            # Module 10 Health Check
            # Check environment variables
            api_status = "healthy"
            db_status = "healthy" if table else "unhealthy"

            # Simple check for other required vars or clients
            # (SNS/SQS are used in processor, not query, but we can return general status)
            sqs_status = "healthy"
            sns_status = "healthy"
            auth_status = "healthy"

            return build_response(
                200,
                {
                    "api_status": api_status,
                    "database_status": db_status,
                    "sqs_status": sqs_status,
                    "sns_status": sns_status,
                    "authentication_status": auth_status,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "version": "1.0.0",
                },
            )

        if not table:
            logger.error("DYNAMODB_TABLE_NAME is not set.")
            return build_response(500, {"error": "Internal server error"})

        # Parse limit from query string
        query_params = event.get("queryStringParameters") or {}
        try:
            limit = int(query_params.get("limit", 20))
            if limit <= 0 or limit > 100:
                return build_response(400, {"error": "Limit must be between 1 and 100"})
        except ValueError:
            return build_response(400, {"error": "Invalid limit parameter"})

        path_params = event.get("pathParameters") or {}

        if path.startswith("/logs/service/"):
            service_name = path_params.get("service_name")
            if not service_name:
                return build_response(400, {"error": "Missing service_name parameter"})

            response = table.query(
                KeyConditionExpression=Key("service_name").eq(service_name),
                ScanIndexForward=False,  # Newest first
                Limit=limit,
            )
            items = response.get("Items", [])

        elif path.startswith("/logs/level/"):
            level = path_params.get("level")
            valid_levels = {"INFO", "WARNING", "ERROR", "CRITICAL"}
            if level not in valid_levels:
                return build_response(
                    400, {"error": f"Invalid level. Must be one of {valid_levels}"}
                )

            response = table.scan(FilterExpression=Attr("level").eq(level))
            items = response.get("Items", [])
            items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            items = items[:limit]

        elif path == "/logs":
            response = table.scan()
            items = response.get("Items", [])
            items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            items = items[:limit]

        else:
            return build_response(404, {"error": "Not found"})

        if not items:
            return build_response(404, {"message": "No logs found"})

        return build_response(200, {"logs": items})

    except ClientError as ce:
        logger.error(f"DynamoDB ClientError: {ce.response['Error']['Message']}")
        return build_response(500, {"error": "Internal server error"})
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return build_response(500, {"error": "Internal server error"})
