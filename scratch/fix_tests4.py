import os
import glob

test_dir = "backend/tests"

for test_file in glob.glob(os.path.join(test_dir, "*.py")):
    with open(test_file, "r") as f:
        content = f.read()
    
    content = content.replace('assert "invalid JSON" in caplog.text', 'assert any("Invalid JSON" in r.message for r in caplog.records)')
    content = content.replace('assert "invalid log level" in caplog.text', 'assert any("Invalid log level" in r.message for r in caplog.records)')
    content = content.replace('assert "req-123" in caplog.text', 'assert any(getattr(r, "request_id", "") == "req-123" for r in caplog.records)')
    content = content.replace('assert \'"error_reason"\' in caplog.text', 'assert any(hasattr(r, "error_reason") for r in caplog.records)')
    
    with open(test_file, "w") as f:
        f.write(content)
