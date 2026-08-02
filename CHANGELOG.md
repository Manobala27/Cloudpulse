# Changelog

All notable changes to the CloudPulse project will be documented in this file.

## [1.0.0] - 2026-07-23

### Added
- **Module 12: Production Readiness & Enterprise Hardening**
  - Configured custom least-privilege IAM roles for `LoginFunction` and `ApiGatewayAuthorizer`.
  - Configured explicit `AWS::Logs::LogGroup` resources with cost-optimized log retention policies (14 days for development, 90 days for production).
  - Optimized Lambda memory allocations (128MB–256MB) and execution timeouts to reduce cold starts and billing overhead.
  - Implemented dynamic environment detection in the frontend dashboard to seamlessly target either localhost or the production API Gateway without code modifications.
  - Upgraded repository standards with a professional `README.md`, an MIT `LICENSE`, and this comprehensive `CHANGELOG.md`.

- **Module 11: CI/CD & DevOps Automation**
  - Created automated linting, formatting, and unit testing GitHub Actions workflows (`pr-validation.yml`).
  - Added continuous deployment (`ci-cd.yml`) using AWS SAM CLI.
  - Configured weekly Dependabot update alerts for Pip, NPM, and GitHub Actions.
  - Set up CodeQL security analysis scanning for vulnerability detection.
  - Added pre-commit hooks configuration to enforce code quality locally.

- **Module 10: Monitoring & Observability**
  - Integrated `aws-lambda-powertools` for structured logging, custom metrics (EMF), and distributed tracing (X-Ray).
  - Created a comprehensive CloudWatch Dashboard and alarms (Lambda errors, queue backlogs, auth failures, DLQs).
  - Added frontend KPI monitoring cards and error status visualizations.

- **Module 9: Authentication & Security**
  - Implemented custom JWT-based authentication with a secure API Gateway Custom Authorizer.
  - Built a `/login` endpoint using `bcrypt` password hashing to secure rest endpoints.

- **Module 8: Dashboard UI**
  - Created a single-page responsive web dashboard for real-time visualization of logs, status alerts, and performance metrics.

- **Module 7: Log Query Lambda**
  - Implemented the Log Query Lambda using Boto3 to read and filter logs from DynamoDB.

- **Module 6: Log Processor Lambda**
  - Created the SQS consumer Log Processor Lambda to parse incoming logs, write them to DynamoDB, and trigger alerts on critical errors.

- **Module 5: Alerting Infrastructure**
  - Added Amazon SNS topic and email alerting infrastructure for system failures.

- **Module 4: SQS Ingestion**
  - Integrated Amazon SQS queue buffer to handle surge log traffic reliably.

- **Module 3: REST API Gateway Ingestion**
  - Created API Gateway rest routes with direct SQS integration and mock test scripts.

- **Module 2: Core Infrastructure**
  - Set up base CloudFormation template and DynamoDB tables.

- **Module 1: Project Setup**
  - Initialized project scaffolding, environments, and dependencies.
