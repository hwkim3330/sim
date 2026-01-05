"""
Custom Tools Configuration System.

Allows loading tool definitions from JSON/YAML configuration files
and creating tools dynamically.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from simi.types import ToolParameter, ToolResult
from simi.tools.base import Tool

logger = logging.getLogger(__name__)


@dataclass
class CustomToolConfig:
    """Configuration for a custom tool."""
    name: str
    description: str
    type: str  # "shell", "http", "python", "mcp"
    parameters: list[dict[str, Any]] = field(default_factory=list)

    # Shell tool config
    command: Optional[str] = None
    working_dir: Optional[str] = None

    # HTTP tool config
    url: Optional[str] = None
    method: str = "POST"
    headers: dict[str, str] = field(default_factory=dict)

    # Python tool config
    module: Optional[str] = None
    function: Optional[str] = None

    # MCP tool config
    mcp_server: Optional[str] = None
    mcp_tool: Optional[str] = None

    # Common
    timeout_ms: int = 30000
    enabled: bool = True

    def to_tool_parameters(self) -> list[ToolParameter]:
        """Convert config parameters to ToolParameter list."""
        result = []
        for p in self.parameters:
            result.append(ToolParameter(
                name=p.get("name", ""),
                type=p.get("type", "string"),
                description=p.get("description", ""),
                required=p.get("required", True),
                default=p.get("default"),
                enum=p.get("enum"),
            ))
        return result


class ShellTool(Tool):
    """Tool that executes a shell command."""

    def __init__(self, config: CustomToolConfig):
        self.config = config
        self.name = config.name
        self.description = config.description
        self.parameters = config.to_tool_parameters()

    def execute(self, **kwargs: Any) -> ToolResult:
        """Execute the shell command with arguments."""
        import subprocess

        # Build command with argument substitution
        command = self.config.command or ""
        for key, value in kwargs.items():
            if key.startswith("_"):
                continue
            command = command.replace(f"${{{key}}}", str(value))
            command = command.replace(f"${key}", str(value))

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=self.config.timeout_ms / 1000,
                cwd=self.config.working_dir,
            )

            if result.returncode == 0:
                return ToolResult(
                    call_id=kwargs.get("_call_id", ""),
                    success=True,
                    output=result.stdout or "(no output)",
                )
            else:
                return ToolResult(
                    call_id=kwargs.get("_call_id", ""),
                    success=False,
                    output=result.stdout,
                    error=result.stderr or f"Exit code: {result.returncode}",
                )

        except subprocess.TimeoutExpired:
            return ToolResult(
                call_id=kwargs.get("_call_id", ""),
                success=False,
                output="",
                error=f"Command timed out after {self.config.timeout_ms}ms",
            )
        except Exception as e:
            return ToolResult(
                call_id=kwargs.get("_call_id", ""),
                success=False,
                output="",
                error=str(e),
            )


class HTTPTool(Tool):
    """Tool that makes an HTTP request."""

    def __init__(self, config: CustomToolConfig):
        self.config = config
        self.name = config.name
        self.description = config.description
        self.parameters = config.to_tool_parameters()

    def execute(self, **kwargs: Any) -> ToolResult:
        """Execute the HTTP request."""
        import urllib.request
        import urllib.parse

        url = self.config.url or ""

        # URL parameter substitution
        for key, value in kwargs.items():
            if key.startswith("_"):
                continue
            url = url.replace(f"${{{key}}}", urllib.parse.quote(str(value)))

        try:
            # Build request
            headers = dict(self.config.headers)
            headers.setdefault("Content-Type", "application/json")

            if self.config.method.upper() in ("POST", "PUT", "PATCH"):
                # Filter internal kwargs and send as JSON body
                body_data = {
                    k: v for k, v in kwargs.items()
                    if not k.startswith("_")
                }
                data = json.dumps(body_data).encode("utf-8")
            else:
                data = None

            request = urllib.request.Request(
                url,
                data=data,
                headers=headers,
                method=self.config.method.upper(),
            )

            with urllib.request.urlopen(
                request,
                timeout=self.config.timeout_ms / 1000
            ) as response:
                result = response.read().decode("utf-8")
                return ToolResult(
                    call_id=kwargs.get("_call_id", ""),
                    success=True,
                    output=result,
                )

        except Exception as e:
            return ToolResult(
                call_id=kwargs.get("_call_id", ""),
                success=False,
                output="",
                error=str(e),
            )


class PythonTool(Tool):
    """Tool that calls a Python function."""

    def __init__(self, config: CustomToolConfig):
        self.config = config
        self.name = config.name
        self.description = config.description
        self.parameters = config.to_tool_parameters()
        self._func = None

    def _load_function(self):
        """Lazy load the Python function."""
        if self._func is None and self.config.module and self.config.function:
            import importlib
            module = importlib.import_module(self.config.module)
            self._func = getattr(module, self.config.function)
        return self._func

    def execute(self, **kwargs: Any) -> ToolResult:
        """Execute the Python function."""
        try:
            func = self._load_function()
            if not func:
                return ToolResult(
                    call_id=kwargs.get("_call_id", ""),
                    success=False,
                    output="",
                    error="Function not configured",
                )

            # Filter internal kwargs
            args = {k: v for k, v in kwargs.items() if not k.startswith("_")}
            result = func(**args)

            return ToolResult(
                call_id=kwargs.get("_call_id", ""),
                success=True,
                output=str(result) if result is not None else "(no output)",
            )

        except Exception as e:
            return ToolResult(
                call_id=kwargs.get("_call_id", ""),
                success=False,
                output="",
                error=str(e),
            )


class CustomToolLoader:
    """
    Loads custom tools from configuration files.

    Supports JSON configuration format:
    {
        "tools": [
            {
                "name": "my_tool",
                "description": "Does something",
                "type": "shell",
                "command": "echo ${message}",
                "parameters": [
                    {"name": "message", "type": "string", "description": "Message to echo"}
                ]
            }
        ]
    }
    """

    TOOL_TYPES = {
        "shell": ShellTool,
        "http": HTTPTool,
        "python": PythonTool,
    }

    def __init__(self):
        self._loaded_tools: list[Tool] = []

    def load_from_file(self, path: Path) -> list[Tool]:
        """Load tools from a JSON configuration file."""
        if not path.exists():
            logger.warning(f"Config file not found: {path}")
            return []

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return self.load_from_dict(data)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse config {path}: {e}")
            return []

    def load_from_dict(self, data: dict[str, Any]) -> list[Tool]:
        """Load tools from a dictionary configuration."""
        tools = []

        for tool_data in data.get("tools", []):
            try:
                config = CustomToolConfig(
                    name=tool_data.get("name", ""),
                    description=tool_data.get("description", ""),
                    type=tool_data.get("type", "shell"),
                    parameters=tool_data.get("parameters", []),
                    command=tool_data.get("command"),
                    working_dir=tool_data.get("working_dir"),
                    url=tool_data.get("url"),
                    method=tool_data.get("method", "POST"),
                    headers=tool_data.get("headers", {}),
                    module=tool_data.get("module"),
                    function=tool_data.get("function"),
                    mcp_server=tool_data.get("mcp_server"),
                    mcp_tool=tool_data.get("mcp_tool"),
                    timeout_ms=tool_data.get("timeout_ms", 30000),
                    enabled=tool_data.get("enabled", True),
                )

                if not config.enabled:
                    logger.debug(f"Skipping disabled tool: {config.name}")
                    continue

                tool_class = self.TOOL_TYPES.get(config.type)
                if not tool_class:
                    logger.warning(f"Unknown tool type: {config.type}")
                    continue

                tool = tool_class(config)
                tools.append(tool)
                logger.info(f"Loaded custom tool: {config.name}")

            except Exception as e:
                logger.error(f"Failed to load tool: {e}")

        self._loaded_tools.extend(tools)
        return tools

    def get_all_tools(self) -> list[Tool]:
        """Get all loaded tools."""
        return self._loaded_tools.copy()

    def clear(self) -> None:
        """Clear all loaded tools."""
        self._loaded_tools.clear()
