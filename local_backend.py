import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

# Add backend/src to path
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "backend", "src"))
)

# Set environment variables for local testing
os.environ["JWT_SECRET"] = "supersecretjwtkey"
os.environ["DEMO_USERNAME"] = "admin"
os.environ["DEMO_PASSWORD_HASH"] = (
    "$2b$12$T7WZHszkkKKwlAWasIn5rewrc0eWCPiL73Dw5P67Ozo4CbAa7HChS"
)
os.environ["DYNAMODB_TABLE_NAME"] = "cloudpulse-logs-dev"
os.environ["AWS_DEFAULT_REGION"] = "ap-south-1"
os.environ["POWERTOOLS_SERVICE_NAME"] = "local-backend"

import authorizer
import log_processor
import log_query
import login


class LocalAPIGatewayHandler(BaseHTTPRequestHandler):
    def send_response_clean(self, status_code, headers, body_str):
        self.send_response(status_code)

        # Normalize and merge headers to prevent duplicates
        final_headers = {}
        for k, v in headers.items():
            final_headers[k.lower()] = (k, v)

        cors_defaults = {
            "access-control-allow-origin": ("Access-Control-Allow-Origin", "*"),
            "access-control-allow-methods": (
                "Access-Control-Allow-Methods",
                "GET, POST, OPTIONS",
            ),
            "access-control-allow-headers": (
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization",
            ),
        }

        for k, (orig_k, v) in cors_defaults.items():
            if k not in final_headers:
                final_headers[k] = (orig_k, v)

        for orig_k, v in final_headers.values():
            self.send_header(orig_k, v)

        self.end_headers()
        self.wfile.write(body_str.encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/login":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")

            event = {
                "body": body,
                "httpMethod": "POST",
                "path": "/login",
                "headers": dict(self.headers),
                "requestContext": {"requestId": "local-request-id"},
            }

            try:
                response = login.lambda_handler(event, None)
                self.send_response_clean(
                    response["statusCode"],
                    response.get("headers", {}),
                    response["body"],
                )
            except Exception as e:
                self.send_response_clean(500, {}, json.dumps({"message": str(e)}))

        elif path == "/logs":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")

            # Emulate SQS trigger to log_processor
            try:
                sqs_event = {
                    "Records": [
                        {
                            "messageId": "local-mock-msg",
                            "body": body,
                        }
                    ]
                }
                log_processor.lambda_handler(sqs_event, None)
            except Exception as e:
                print(f"[Local Mock API Gateway] Processor simulation note: {e}")

            # API Gateway returns 202 Accepted
            self.send_response_clean(
                202,
                {"Content-Type": "application/json"},
                json.dumps({"message": "Log accepted for asynchronous processing"}),
            )
        else:
            self.send_response_clean(404, {}, json.dumps({"message": "Not Found"}))

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        # Flatten query params
        query_string_parameters = {k: v[0] for k, v in query_params.items()}

        # 1. Run custom authorizer for authenticated endpoints
        if path != "/health" and path != "/login":
            auth_header = self.headers.get("Authorization", "")
            authorizer_event = {
                "authorizationToken": auth_header,
                "methodArn": "arn:aws:execute-api:ap-south-1:123456789012:api/dev/GET/",
                "headers": dict(self.headers),
            }
            try:
                auth_response = authorizer.lambda_handler(authorizer_event, None)
                policy_statement = auth_response.get("policyDocument", {}).get(
                    "Statement", []
                )
                if not policy_statement or policy_statement[0].get("Effect") != "Allow":
                    self.send_response_clean(
                        403, {}, json.dumps({"message": "Forbidden"})
                    )
                    return
            except Exception:
                self.send_response_clean(
                    401, {}, json.dumps({"message": "Unauthorized"})
                )
                return

        # 2. Map path parameters
        path_parameters = {}
        if path.startswith("/logs/service/"):
            parts = path.split("/")
            if len(parts) >= 4:
                path_parameters["service_name"] = parts[3]
        elif path.startswith("/logs/level/"):
            parts = path.split("/")
            if len(parts) >= 4:
                path_parameters["level"] = parts[3]

        event = {
            "path": path,
            "httpMethod": "GET",
            "queryStringParameters": query_string_parameters,
            "pathParameters": path_parameters,
            "headers": dict(self.headers),
            "requestContext": {"requestId": "local-request-id"},
        }

        try:
            response = log_query.lambda_handler(event, None)
            self.send_response_clean(
                response["statusCode"], response.get("headers", {}), response["body"]
            )
        except Exception as e:
            self.send_response_clean(500, {}, json.dumps({"message": str(e)}))


def run(server_class=HTTPServer, handler_class=LocalAPIGatewayHandler, port=3000):
    server_address = ("", port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting local mock API Gateway on port {port}...")
    httpd.serve_forever()


if __name__ == "__main__":
    run()
