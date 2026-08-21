import json
import os
from datetime import datetime, timezone

import boto3

# Configure structured logging
from aws_lambda_powertools import Logger, Metrics, Tracer
from botocore.exceptions import ClientError

logger = Logger(service="log-processor")
tracer = Tracer(service="log-processor")
metrics = Metrics(namespace="CloudPulse", service="log-processor")

REQUIRED_FIELDS = {"timestamp", "service", "level", "message", "request_id"}
VALID_LEVELS = {"INFO", "WARNING", "ERROR", "CRITICAL"}
ALERT_LEVELS = {"ERROR", "CRITICAL"}

table_name = os.getenv("DYNAMODB_TABLE_NAME")
sns_topic_arn = os.getenv("SNS_TOPIC_ARN")

dynamodb = None
table = None
sns_client = None


@tracer.capture_lambda_handler
@metrics.log_metrics(capture_cold_start=True)
def lambda_handler(event, context):
    """
    AWS Lambda entry point for processing SQS batches and storing in DynamoDB.
    """
    records = event.get("Records", [])
    logger.info(f"Received batch of {len(records)} records.")

    for record in records:
        message_id = record.get("messageId", "UNKNOWN")
        body = record.get("body", "")

        try:
            # 1. Parse JSON
            payload = json.loads(body)

            # 2. Validate required fields
            missing_fields = REQUIRED_FIELDS - payload.keys()
            if missing_fields:
                logger.error(
                    "Missing required fields",
                    extra={
                        "message_id": message_id,
                        "missing_fields": list(missing_fields),
                        "status": "failure",
                    },
                )
                metrics.add_metric(name="FailedProcessing", unit="Count", value=1)
                continue

            # 3. Validate log level
            level = payload["level"]
            if level not in VALID_LEVELS:
                logger.error(
                    "Invalid log level",
                    extra={
                        "message_id": message_id,
                        "invalid_level": level,
                        "status": "failure",
                    },
                )
                metrics.add_metric(name="FailedProcessing", unit="Count", value=1)
                continue

            # 4. Store in DynamoDB
            global table, dynamodb
            if table is None and table_name:
                try:
                    if dynamodb is None:
                        dynamodb = boto3.resource("dynamodb")
                    table = dynamodb.Table(table_name)
                except Exception as e:
                    logger.error(f"Failed to initialize DynamoDB table: {e}")

            if not table:
                logger.error("DYNAMODB_TABLE_NAME is not set, cannot store log.")
                continue

            request_id = payload["request_id"]
            service = payload["service"]
            timestamp = payload["timestamp"]

            # Using existing table schema: Partition Key = service_name, Sort Key = timestamp
            item = {
                "service_name": service,
                "timestamp": timestamp,
                "request_id": request_id,  # Stored as an attribute
                "level": level,
                "message": payload["message"],
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "status": "STORED",
            }

            try:
                table.put_item(
                    Item=item, ConditionExpression="attribute_not_exists(request_id)"
                )
                storage_status = "STORED"
                error_reason = None
            except ClientError as ce:
                if ce.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    storage_status = "DUPLICATE"
                    error_reason = "Duplicate request ignored."
                else:
                    storage_status = "FAILED"
                    error_reason = f"DynamoDB error: {ce.response['Error']['Message']}"
                    logger.error(
                        "DynamoDB error",
                        extra={"error_reason": error_reason, "status": "failure"},
                    )
                    metrics.add_metric(name="FailedProcessing", unit="Count", value=1)
                    continue  # Skip to next record if DynamoDB fails generically

            # 5. SNS Alerting
            alert_status = "SKIPPED"
            alert_error = None

            if storage_status == "STORED" and level in ALERT_LEVELS:
                if sns_topic_arn:
                    alert_payload = {
                        "request_id": request_id,
                        "service_name": service,
                        "level": level,
                        "message": payload["message"],
                        "timestamp": timestamp,
                        "status": "ALERT_TRIGGERED",
                    }
                    try:
                        global sns_client
                        if sns_client is None:
                            sns_client = boto3.client("sns")
                        sns_client.publish(
                            TopicArn=sns_topic_arn,
                            Message=json.dumps(alert_payload),
                            Subject=f"CloudPulse Alert: {level} in {service}",
                        )
                        alert_status = "PUBLISHED"
                    except Exception as e:
                        alert_status = "FAILED"
                        alert_error = f"SNS publish error: {str(e)}"
                        logger.error(alert_error)
                else:
                    alert_status = "FAILED"
                    alert_error = "SNS_TOPIC_ARN is not set"
                    logger.error(alert_error)

            # 6. Structured logging
            log_data = {
                "message_id": message_id,
                "request_id": request_id,
                "service": service,
                "level": level,
                "timestamp": timestamp,
                "processing_status": "PROCESSED",
                "storage_status": storage_status,
                "alert_status": alert_status,
            }

            if error_reason:
                log_data["error_reason"] = error_reason
            if alert_error:
                log_data["reason"] = alert_error

            logger.info(
                "Log processed",
                extra={
                    "event": "log_processed",
                    "status": "success",
                    "execution_time": 0,  # Placeholder or measure it
                    **log_data,
                },
            )
            metrics.add_metric(name="TotalLogsProcessed", unit="Count", value=1)
            metrics.add_metric(name=f"{level}Logs", unit="Count", value=1)
            metrics.add_metric(name="SuccessfulProcessing", unit="Count", value=1)

        except json.JSONDecodeError:
            logger.error(
                "Invalid JSON", extra={"message_id": message_id, "status": "failure"}
            )
            metrics.add_metric(name="FailedProcessing", unit="Count", value=1)
            continue
        except Exception:
            logger.exception(
                "Unexpected error",
                extra={"message_id": message_id, "status": "failure"},
            )
            metrics.add_metric(name="FailedProcessing", unit="Count", value=1)
            continue

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Batch processing complete."}),
    }
