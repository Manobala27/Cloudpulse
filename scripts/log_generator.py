import argparse
import json
import logging
import random
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

# Configure basic logging for the generator output
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

SERVICES = [
    "auth-service",
    "payment-service",
    "order-service",
    "user-service",
    "inventory-service",
]
LEVELS = ["INFO", "WARNING", "ERROR", "CRITICAL"]


def generate_log():
    """Generates a single log payload according to the CloudPulse schema."""
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": random.choice(SERVICES),
        "level": random.choice(LEVELS),
        "message": "Sample application log for CloudPulse testing.",
        "request_id": str(uuid.uuid4()),
    }


def send_log(url, log_payload, timeout=5):
    """Sends the log payload to the specified API Gateway endpoint."""
    req = urllib.request.Request(
        url,
        data=json.dumps(log_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status in (200, 202):
                logger.info(
                    f"✅ Success: Sent {log_payload['level']} log for {log_payload['service']} ({response.status})"
                )
                return True
            else:
                logger.error(f"❌ Error: Unexpected status {response.status}")
                return False
    except urllib.error.HTTPError as e:
        logger.error(f"❌ HTTP Error: {e.code} - {e.reason}")
        return False
    except urllib.error.URLError as e:
        logger.error(f"❌ Connection Error: {e.reason}")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected Error: {str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description="CloudPulse Log Generator")
    parser.add_argument(
        "--url", type=str, required=True, help="API Gateway Endpoint URL"
    )
    parser.add_argument("--count", type=int, default=1, help="Number of logs to send")

    args = parser.parse_args()

    logger.info(f"Starting log generation. Target: {args.url}")
    logger.info(f"Logs to send: {args.count}\n" + "-" * 40)

    success_count = 0
    for _ in range(args.count):
        log = generate_log()
        if send_log(args.url, log):
            success_count += 1
        time.sleep(0.1)  # brief pause to prevent local network flooding

    logger.info("-" * 40)
    logger.info(f"Finished. Successfully sent {success_count}/{args.count} logs.")


if __name__ == "__main__":
    main()
