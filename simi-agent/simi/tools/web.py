"""
Web fetch tool.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from simi.tools.base import Tool
from simi.types import ToolParameter, ToolResult


class WebFetch(Tool):
    """Fetch content from URLs."""

    name = "web_fetch"
    description = "Fetch content from a URL. Returns the response body."
    parameters = [
        ToolParameter("url", "string", "The URL to fetch", required=True),
        ToolParameter("method", "string", "HTTP method (GET, POST)", required=False),
        ToolParameter("timeout", "integer", "Timeout in seconds (default: 30)", required=False),
    ]

    max_response_size = 5 * 1024 * 1024  # 5MB
    user_agent = "Simi-Agent/1.0"

    def execute(self, **kwargs: Any) -> ToolResult:
        url = kwargs["url"]
        method = kwargs.get("method", "GET").upper()
        timeout = int(kwargs.get("timeout", 30))

        # Validate URL
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return ToolResult("", False, "", "Invalid URL")

        try:
            import httpx

            with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                headers = {"User-Agent": self.user_agent}

                if method == "GET":
                    response = client.get(url, headers=headers)
                elif method == "POST":
                    response = client.post(url, headers=headers)
                else:
                    return ToolResult("", False, "", f"Unsupported method: {method}")

                # Check size
                content = response.text
                if len(content) > self.max_response_size:
                    content = content[:self.max_response_size] + "\n... (response truncated)"

                success = response.status_code < 400
                return ToolResult(
                    "",
                    success,
                    content,
                    None if success else f"HTTP {response.status_code}"
                )

        except ImportError:
            # Fallback to urllib
            import urllib.request
            import urllib.error

            try:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": self.user_agent},
                    method=method
                )

                with urllib.request.urlopen(req, timeout=timeout) as response:
                    content = response.read().decode("utf-8", errors="replace")

                    if len(content) > self.max_response_size:
                        content = content[:self.max_response_size] + "\n... (truncated)"

                    return ToolResult("", True, content)

            except urllib.error.HTTPError as e:
                return ToolResult("", False, "", f"HTTP {e.code}: {e.reason}")
            except urllib.error.URLError as e:
                return ToolResult("", False, "", f"URL error: {e.reason}")

        except Exception as e:
            return ToolResult("", False, "", f"Fetch error: {e}")

    def is_available(self) -> bool:
        return True
