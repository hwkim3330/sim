"""
File operation tools.
"""

from __future__ import annotations

import fnmatch
import os
import re
from pathlib import Path
from typing import Any

from simi.tools.base import Tool
from simi.types import ToolParameter, ToolResult


class ReadFile(Tool):
    """Read file contents."""

    name = "read_file"
    description = "Read the contents of a file. Returns file content with line numbers."
    parameters = [
        ToolParameter("path", "string", "Absolute path to the file", required=True),
        ToolParameter("offset", "integer", "Starting line number (1-based)", required=False),
        ToolParameter("limit", "integer", "Maximum lines to read (default: 2000)", required=False),
    ]

    max_file_size = 10 * 1024 * 1024  # 10MB

    def execute(self, **kwargs: Any) -> ToolResult:
        path = Path(kwargs["path"])
        offset = int(kwargs.get("offset", 1))
        limit = int(kwargs.get("limit", 2000))

        if not path.exists():
            return ToolResult("", False, "", f"File not found: {path}")

        if not path.is_file():
            return ToolResult("", False, "", f"Not a file: {path}")

        if path.stat().st_size > self.max_file_size:
            return ToolResult("", False, "", f"File too large: {path.stat().st_size} bytes")

        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception as e:
            return ToolResult("", False, "", f"Read error: {e}")

        # Apply offset and limit
        selected = lines[offset - 1:offset - 1 + limit]

        # Format with line numbers
        output_lines = []
        for i, line in enumerate(selected, start=offset):
            output_lines.append(f"{i:6d}\t{line}")

        return ToolResult("", True, "\n".join(output_lines))


class WriteFile(Tool):
    """Write content to a file."""

    name = "write_file"
    description = "Write content to a file. Creates parent directories if needed."
    parameters = [
        ToolParameter("path", "string", "Absolute path to the file", required=True),
        ToolParameter("content", "string", "Content to write", required=True),
    ]

    def execute(self, **kwargs: Any) -> ToolResult:
        path = Path(kwargs["path"])
        content = kwargs["content"]

        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            return ToolResult("", True, f"File written: {path}")
        except Exception as e:
            return ToolResult("", False, "", f"Write error: {e}")


class EditFile(Tool):
    """Edit a file with search and replace."""

    name = "edit_file"
    description = "Edit a file by replacing exact string matches."
    parameters = [
        ToolParameter("path", "string", "Absolute path to the file", required=True),
        ToolParameter("old_string", "string", "Text to find", required=True),
        ToolParameter("new_string", "string", "Text to replace with", required=True),
        ToolParameter("replace_all", "boolean", "Replace all occurrences", required=False),
    ]

    def execute(self, **kwargs: Any) -> ToolResult:
        path = Path(kwargs["path"])
        old_string = kwargs["old_string"]
        new_string = kwargs["new_string"]
        replace_all = str(kwargs.get("replace_all", "false")).lower() == "true"

        if not path.exists():
            return ToolResult("", False, "", f"File not found: {path}")

        try:
            content = path.read_text(encoding="utf-8")
        except Exception as e:
            return ToolResult("", False, "", f"Read error: {e}")

        if old_string not in content:
            return ToolResult("", False, "", "old_string not found in file")

        # Replace
        if replace_all:
            new_content = content.replace(old_string, new_string)
            count = content.count(old_string)
        else:
            new_content = content.replace(old_string, new_string, 1)
            count = 1

        try:
            path.write_text(new_content, encoding="utf-8")
            return ToolResult("", True, f"Replaced {count} occurrence(s)")
        except Exception as e:
            return ToolResult("", False, "", f"Write error: {e}")


class Glob(Tool):
    """Search for files by pattern."""

    name = "glob"
    description = "Find files matching a glob pattern (e.g., '**/*.py')."
    parameters = [
        ToolParameter("pattern", "string", "Glob pattern", required=True),
        ToolParameter("path", "string", "Directory to search in", required=False),
    ]

    max_results = 200

    def execute(self, **kwargs: Any) -> ToolResult:
        pattern = kwargs["pattern"]
        base_path = Path(kwargs.get("path", "."))

        if not base_path.exists():
            return ToolResult("", False, "", f"Directory not found: {base_path}")

        try:
            matches = list(base_path.glob(pattern))[:self.max_results]
            output = "\n".join(str(m) for m in sorted(matches))

            summary = f"\nFound {len(matches)} files"
            if len(matches) >= self.max_results:
                summary += f" (limited to {self.max_results})"

            return ToolResult("", True, output + summary)
        except Exception as e:
            return ToolResult("", False, "", f"Glob error: {e}")


class Grep(Tool):
    """Search file contents."""

    name = "grep"
    description = "Search for a pattern in file contents using regex."
    parameters = [
        ToolParameter("pattern", "string", "Regex pattern to search", required=True),
        ToolParameter("path", "string", "File or directory to search", required=False),
        ToolParameter("glob", "string", "File pattern filter (e.g., '*.py')", required=False),
    ]

    max_results = 100
    context_lines = 0

    def execute(self, **kwargs: Any) -> ToolResult:
        pattern = kwargs["pattern"]
        search_path = Path(kwargs.get("path", "."))
        file_glob = kwargs.get("glob", "*")

        try:
            regex = re.compile(pattern, re.IGNORECASE)
        except re.error as e:
            return ToolResult("", False, "", f"Invalid regex: {e}")

        matches: list[str] = []

        def search_file(file_path: Path) -> None:
            if len(matches) >= self.max_results:
                return

            try:
                content = file_path.read_text(encoding="utf-8", errors="replace")
                for i, line in enumerate(content.splitlines(), 1):
                    if len(matches) >= self.max_results:
                        break
                    if regex.search(line):
                        matches.append(f"{file_path}:{i}: {line.strip()}")
            except Exception:
                pass

        if search_path.is_file():
            search_file(search_path)
        else:
            for file_path in search_path.rglob(file_glob):
                if file_path.is_file():
                    search_file(file_path)

        output = "\n".join(matches)
        summary = f"\n\nMatches: {len(matches)}"
        if len(matches) >= self.max_results:
            summary += f" (limited to {self.max_results})"

        return ToolResult("", True, output + summary)
