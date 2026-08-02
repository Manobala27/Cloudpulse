import os

test_proc_path = "backend/tests/test_log_processor.py"
with open(test_proc_path, "r") as f:
    content = f.read()

content = content.replace('assert "invalid JSON" in caplog.text', 'assert any("Invalid JSON" in r.message for r in caplog.records)')
content = content.replace('assert "invalid log level" in caplog.text', 'assert any("Invalid log level" in r.message for r in caplog.records)')
content = content.replace('assert "req-123" in caplog.text', 'assert any(getattr(r, "request_id", "") == "req-123" for r in caplog.records)')
content = content.replace('assert any(hasattr(r, "storage_status") for r in caplog.records) or any("STORED" in r.message for r in caplog.records)', 'assert any(getattr(r, "status", "") == "success" for r in caplog.records)')

with open(test_proc_path, "w") as f:
    f.write(content)

test_dyn_path = "backend/tests/test_dynamodb_storage.py"
with open(test_dyn_path, "r") as f:
    content = f.read()

content = content.replace('assert any(hasattr(r, "storage_status") for r in caplog.records) or any("STORED" in r.message for r in caplog.records)', 'assert any(getattr(r, "status", "") == "success" for r in caplog.records)')
content = content.replace('assert any(hasattr(r, "error_reason") for r in caplog.records)', 'assert any(getattr(r, "status", "") == "failure" for r in caplog.records)')

with open(test_dyn_path, "w") as f:
    f.write(content)

test_sns_path = "backend/tests/test_sns_alerts.py"
with open(test_sns_path, "r") as f:
    content = f.read()

content = content.replace('assert any("Mock SNS Failure" in str(getattr(r, "reason", "")) for r in caplog.records)', 'assert any("Mock SNS Failure" in r.message for r in caplog.records)')

with open(test_sns_path, "w") as f:
    f.write(content)

test_mon_path = "backend/tests/test_monitoring.py"
with open(test_mon_path, "r") as f:
    content = f.read()

content = content.replace('patch("login.generate_jwt", return_value="token")', 'patch("jwt.encode", return_value="token")')

with open(test_mon_path, "w") as f:
    f.write(content)
