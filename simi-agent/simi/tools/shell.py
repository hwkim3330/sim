"""
Shell execution tool.
"""

from __future__ import annotations

import os
import subprocess
import sys
from typing import Any

from simi.tools.base import Tool
from simi.types import ToolParameter, ToolResult


class Shell(Tool):
    """Execute shell commands."""

    name = "shell"
    description = "Execute a shell command. Use for git, npm, build tools, etc."
    parameters = [
        ToolParameter("command", "string", "The command to execute", required=True),
        ToolParameter("working_dir", "string", "Working directory", required=False),
        ToolParameter("timeout", "integer", "Timeout in seconds (default: 60)", required=False),
    ]

    # Security: blocked commands
    blocked_patterns = [
        "rm -rf /",
        "rm -rf /*",
        "> /dev/sda",
        "mkfs",
        "dd if=",
        ":(){",
        "fork bomb",
    ]

    max_output = 1024 * 1024  # 1MB

    def execute(self, **kwargs: Any) -> ToolResult:
        command = kwargs["command"]
        working_dir = kwargs.get("working_dir")
        timeout = int(kwargs.get("timeout", 60))

        # Security check
        command_lower = command.lower()
        for pattern in self.blocked_patterns:
            if pattern in command_lower:
                return ToolResult("", False, "", f"Command blocked for security: {pattern}")

        try:
            # Use shell=True on Windows, array on Unix
            if sys.platform == "win32":
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd=working_dir,
                )
            else:
                result = subprocess.run(
                    ["bash", "-c", command],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd=working_dir,
                )

            output = result.stdout + result.stderr

            # Truncate if too long
            if len(output) > self.max_output:
                output = output[:self.max_output] + "\n... (output truncated)"

            success = result.returncode == 0

            return ToolResult(
                "",
                success,
                output,
                None if success else f"Exit code: {result.returncode}"
            )

        except subprocess.TimeoutExpired:
            return ToolResult("", False, "", f"Command timed out after {timeout}s")
        except FileNotFoundError:
            return ToolResult("", False, "", "Command not found")
        except Exception as e:
            return ToolResult("", False, "", f"Execution error: {e}")

    def is_available(self) -> bool:
        return True
