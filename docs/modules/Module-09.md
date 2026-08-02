# Module 9: Authentication & Security

## Overview
Module 9 implements authentication and API security for CloudPulse, without introducing complex identity providers like Cognito. It uses a lightweight, secure JWT-based custom authorizer for API Gateway and a dedicated login endpoint to protect the frontend and REST APIs.

## Architecture & Security Decisions
- **Login Lambda (`POST /login`)**: Validates credentials against environment variables and issues a JSON Web Token (JWT) signed with HMAC-SHA256. 
- **API Gateway Lambda Authorizer**: Intercepts all `GET` API requests, decodes and verifies the JWT signature and expiration. It generates an IAM policy (`Allow` or `Deny`) for API access.
- **Frontend Security**: The dashboard utilizes `localStorage` to retain the JWT and appends it as a `Bearer` token to the `Authorization` header. On 401/403 responses, the client forcefully purges the token and redirects to the new `/login` portal.
- **Security Headers**: API Gateway responses are augmented with strict security headers (e.g. `X-Content-Type-Options: nosniff`, `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`) directly from the backend lambda logic.
- **Password Hashing**: Uses `bcrypt` for secure password validation against pre-computed hashes injected via SAM templates/environment variables.

## Authentication Flow
1. User enters credentials on `login.html`.
2. Frontend sends `POST /login` with `{ username, password }`.
3. `LoginFunction` verifies the bcrypt hash and issues a signed JWT (expires in 30 minutes).
4. Frontend stores the token and redirects to `index.html`.
5. Frontend fetches APIs (e.g., `GET /logs`) with `Authorization: Bearer <token>`.
6. API Gateway triggers `ApiGatewayAuthorizer`.
7. `ApiGatewayAuthorizer` validates the token and returns an `Allow` IAM policy.
8. API Gateway proxies the request to `LogQueryFunction`.

## Testing & Validation
All security features are backed by `pytest`:
- Invalid credentials yield `401 Unauthorized`.
- Missing JSON bodies yield `400 Bad Request`.
- Expired/tampered tokens correctly trigger a `403/401 Deny` in the authorizer.
- Valid tokens generate appropriate `Allow` policies for API integration.

## Deployment Steps
1. Navigate to the `infrastructure` directory.
2. Run `sam build --use-container`.
3. Run `sam deploy --guided` (ensure `JWT_SECRET` and `DEMO_PASSWORD_HASH` are securely passed as parameter overrides or remain as secure env defaults for the demo).

## Troubleshooting
- **API Gateway returns 500 on Authorizer**: Check the Authorizer Lambda's CloudWatch Logs. It must return a valid IAM policy.
- **Login fails (Invalid Credentials)**: Ensure the frontend passes the correct raw password matching the bcrypt hash inside `template.yaml`. By default: username = `admin`, password = `password123`.
