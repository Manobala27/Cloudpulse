# Module 11: CI/CD & DevOps Automation

## Overview
Module 11 introduces comprehensive DevOps practices to CloudPulse. We have configured automated testing, code quality checks, static analysis linting, and continuous deployment workflows using GitHub Actions.

## DevOps Architecture & Pipeline Flow
The CI/CD architecture is designed to enforce code quality on all contributions and automatically deploy changes once verified.

```mermaid
graph TD
    A[Code Commit / Pull Request] --> B{Branch?}
    B -- Pull Request to main/dev --> C[PR Validation Workflow]
    B -- Push to main/dev --> D[CI/CD Workflow]
    
    subgraph CI Phase (Continuous Integration)
        C & D --> E[Python lint & test: Ruff, Black, pytest]
        C & D --> F[SAM validation: sam validate, sam build]
        C & D --> G[Frontend validation: HTMLHint, Stylelint, ESLint]
    end
    
    E & F & G --> H{All Checks Pass?}
    H -- No --> I[Build Fails: Blocks PR / Deployment]
    H -- Yes (for PR) --> J[PR Merged Successfully]
    H -- Yes (for push on main/dev) --> K[CD Phase (Continuous Deployment)]
    
    subgraph CD Phase
        K --> L[Authenticate with AWS Credentials]
        L --> M[SAM Deploy Stack to AWS]
    end
    
    M --> N[Deployment Complete & Healthy]
```

## Workflow Explanation

### 1. Pull Request Validation Workflow (`pr-validation.yml`)
Runs on all pull requests targeting `main` or `dev`.
- **Python CI**: Installs project dependencies, validates styling with `black --check`, checks formatting/import order/style using `ruff`, and executes backend tests with `pytest`.
- **AWS SAM Validation**: Validates the SAM template syntax using `sam validate` and runs `sam build` to verify compiling.
- **Frontend Validation**: Sets up Node.js, installs dev dependencies, and validates HTML ([htmlhint](https://github.com/htmlhint/HTMLHint)), CSS ([stylelint](https://github.com/stylelint/stylelint)), and JavaScript ([eslint](https://github.com/eslint/eslint)).

### 2. CI/CD Pipeline Workflow (`ci-cd.yml`)
Runs on direct pushes to `main` or `dev`.
- Executes all validation jobs from the PR workflow.
- If all checks succeed, the **deploy** job initiates:
  - configures credentials via `aws-actions/configure-aws-credentials`.
  - builds the template.
  - executes `sam deploy` automatically using parameter overrides and configurations.

### 3. CodeQL Security Scanning (`codeql-analysis.yml`)
Configures GitHub's CodeQL analysis to automatically scan the codebase for security vulnerabilities, bugs, and maintainability concerns in Python and JavaScript.

### 4. Dependabot Config (`dependabot.yml`)
Keeps third-party packages up to date by performing weekly checks on:
- GitHub Actions versions.
- Pip packages in `requirements-dev.txt` and `backend/src/requirements.txt`.
- NPM packages in `package.json`.

---

## Required GitHub Secrets

To enable automated deployment in the CD pipeline, configure the following secrets under **Settings > Secrets and variables > Actions** in your GitHub repository:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | Access Key ID for IAM user with deployment permissions | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key for IAM user | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | Target deployment AWS region | `ap-south-1` |
| `JWT_SECRET` | Secret key used to sign and verify JSON Web Tokens | *Generate a secure random string* |

---

## Deployment Steps

1. Configure the [Required GitHub Secrets](#required-github-secrets) in your repository.
2. Push or merge your changes to the `main` or `dev` branches.
3. Track the workflow execution in the **Actions** tab of your repository.
4. Once completed, the stack is automatically built, packaged, and deployed.

---

## Troubleshooting

### 1. SAM Template Validation Fails (in CI)
- **Problem**: `sam validate` fails during the AWS SAM job.
- **Resolution**: Run `sam validate --template infrastructure/template.yaml` locally to debug template errors. Ensure indentation is exactly correct.

### 2. Pre-commit Hook Blocks Commit
- **Problem**: Commit fails due to hook failures (e.g. `trailing-whitespace` or `black` formatting).
- **Resolution**: Pre-commit hooks will automatically fix most whitespace and formatting violations. Stage the fixed changes (`git add .`) and re-run `git commit`.

### 3. Frontend Lint Fails (in CI)
- **Problem**: HTML, CSS, or JS rules fail in GitHub Actions.
- **Resolution**: Install linters locally and fix style violations:
  ```bash
  npm install
  npm run lint:frontend
  ```
