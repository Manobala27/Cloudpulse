import os
import sys
from unittest.mock import MagicMock, patch

# Add scripts directory to path to import log_generator
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scripts"))
)
import log_generator


def test_generate_log():
    log = log_generator.generate_log()
    assert "timestamp" in log
    assert "service" in log
    assert "level" in log
    assert "message" in log
    assert "request_id" in log
    assert log["service"] in log_generator.SERVICES
    assert log["level"] in log_generator.LEVELS

    # Verify request_id is a valid UUID string
    assert len(log["request_id"]) == 36


@patch("urllib.request.urlopen")
def test_send_log_success(mock_urlopen):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.status = 202
    mock_urlopen.return_value.__enter__.return_value = mock_response

    log = log_generator.generate_log()
    result = log_generator.send_log("http://test.url", log)

    assert result is True
    mock_urlopen.assert_called_once()


@patch("urllib.request.urlopen")
def test_send_log_http_error(mock_urlopen):
    # Setup mock error
    import urllib.error

    mock_urlopen.side_effect = urllib.error.HTTPError(
        "http://test.url", 500, "Internal Server Error", {}, None
    )

    log = log_generator.generate_log()
    result = log_generator.send_log("http://test.url", log)

    assert result is False
    mock_urlopen.assert_called_once()
