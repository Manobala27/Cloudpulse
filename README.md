# CloudPulse

> Serverless Real-Time Log Analytics & Intelligent Alerting Platform.

CloudPulse is an enterprise-grade, high-performance, cost-optimized serverless log ingestion, storage, search, and alerting platform built on AWS. It handles spikes in log data traffic using SQS buffers, stores them in partitioned DynamoDB tables, processes logs in real-time, sends alerts on critical issues via SNS, and presents analysis metrics on a modern dashboard.

---

## Key Features

- **Ingestion Buffer**: Uses API Gateway integrated directly with Amazon SQS to buffer spikes in incoming traffic without degrading backend performance.
- **Real-Time Processing**: SQS-triggered Python Lambda functions ingest, clean, and write log entries to DynamoDB.
- **Intelligent Alerting**: Evaluates log contents on the fly to emit metrics and send critical email alerts via Amazon SNS.
- **Lightweight JWT Auth**: Uses standard JSON Web Tokens and a custom API Gateway Lambda Authorizer to secure search and health queries.
- **Enterprise Observability**: Leverages `aws-lambda-powertools` for structured logging, customized EMF metrics, and distributed tracing with AWS X-Ray.
- **CI/CD Quality Gates**: Enforces formatting (`black`), linting (`ruff`), and testing (`pytest`) automatically before deploying stacks via GitHub Actions.

---

## Directory Structure

```
├── .github/
│   └── workflows/          # PR validation, CD deployment, and CodeQL security scanning
├── backend/
│   ├── src/                # Lambda functions (login, authorizer, query, processor)
│   └── tests/              # Comprehensive unit and integration test suite
├── dashboard/              # Single-page HTML/CSS/JS frontend dashboard
├── docs/
│   └── modules/            # Incremental development docs (Modules 1-12)
├── infrastructure/
│   ├── template.yaml       # Hardened AWS SAM template
│   └── samconfig.toml      # Deployment config settings
├── local_backend.py        # Local Python API server (no Docker required)
└── pyproject.toml          # Configurations for Python dev tools
```

---

## Local Setup & Run

### 1. Prerequisite Dependencies
Make sure you have python 3.12 installed. Install the dev dependencies:
```bash
pip install -r requirements-dev.txt
pip install -r backend/src/requirements.txt
```

### 2. Run the Backend locally
Start the local python API gateway mock server:
```bash
python local_backend.py
```
This starts the backend on `http://localhost:3000` and uses your terminal's AWS credentials to query your live AWS tables.

### 3. Run the Dashboard
Serve the dashboard directory using Python's built-in server:
```bash
cd dashboard
python -m http.server 8000
```
Open `http://localhost:8000/login.html` in your browser.

- **Demo Username**: `admin`
- **Demo Password**: `password123`

---

## Manual Deployment

To manually deploy the stack from your local terminal:
```bash
cd infrastructure
sam build
sam deploy
```

---

## License

This project is licensed under the [MIT License](LICENSE).
Last updated: 2026-08-02