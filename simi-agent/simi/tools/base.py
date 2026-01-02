"""
Base tool classes and registry.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional
import uuid

from simi.types import ToolSchema, ToolParameter, ToolCall, ToolResult


class Tool(ABC):
    """
    Base class for all tools.

    To create a custom tool:

        class MyTool(Tool):
            name = "my_tool"
            description = "Does something useful"
            parameters = [
                ToolParameter("input", "string", "The input value", required=True)
            ]

            def execute(self, **kwargs) -> ToolResult:
                result = do_something(kwargs["input"])
                return ToolResult(
                    call_id=kwargs.get("_call_id", ""),
                    success=True,
                    output=result
                )
    """

    name: str = ""
    description: str = ""
    parameters: list[ToolParameter] = []

    def get_schema(self) -> ToolSchema:
        """Get tool schema for LLM."""
        return ToolSchema(
            name=self.name,
            description=self.description,
            parameters=self.parameters
        )

    @abstractmethod
    def execute(self, **kwargs: Any) -> ToolResult:
        """
        Execute the tool.

        Args:
            **kwargs: Tool arguments

        Returns:
            ToolResult with success status and output
        """
        ...

    def is_available(self) -> bool:
        """Check if tool is available on this system."""
        return True

    def validate_args(self, args: dict[str, Any]) -> Optional[str]:
        """
        Validate arguments before execution.

        Returns:
            Error message if validation fails, None if valid
        """
        for param in self.parameters:
            if param.required and param.name not in args:
                return f"Missing required parameter: {param.name}"
        return None


class ToolRegistry:
    """
    Registry for managing tools.

    Example:
        >>> registry = ToolRegistry()
        >>> registry.register(ReadFile())
        >>> registry.register(WriteFile())
        >>> result = registry.execute(ToolCall("1", "read_file", {"path": "test.txt"}))
    """

    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        """Register a tool."""
        self._tools[tool.name] = tool

    def unregister(self, name: str) -> None:
        """Unregister a tool by name."""
        self._tools.pop(name, None)

    def get(self, name: str) -> Optional[Tool]:
        """Get tool by name."""
        return self._tools.get(name)

    def list(self) -> list[Tool]:
        """List all registered tools."""
        return list(self._tools.values())

    def list_available(self) -> list[Tool]:
        """List tools that are available on this system."""
        return [t for t in self._tools.values() if t.is_available()]

    def get_schemas(self) -> list[ToolSchema]:
        """Get schemas for all available tools."""
        return [t.get_schema() for t in self.list_available()]

    def execute(self, call: ToolCall) -> ToolResult:
        """
        Execute a tool call.

        Args:
            call: ToolCall with name and arguments

        Returns:
            ToolResult with execution result
        """
        tool = self._tools.get(call.name)

        if not tool:
            return ToolResult(
                call_id=call.id,
                success=False,
                output="",
                error=f"Unknown tool: {call.name}"
            )

        if not tool.is_available():
            return ToolResult(
                call_id=call.id,
                success=False,
                output="",
                error=f"Tool not available: {call.name}"
            )

        # Validate arguments
        error = tool.validate_args(call.arguments)
        if error:
            return ToolResult(
                call_id=call.id,
                success=False,
                output="",
                error=error
            )

        # Execute
        try:
            result = tool.execute(_call_id=call.id, **call.arguments)
            result.call_id = call.id
            return result
        except Exception as e:
            return ToolResult(
                call_id=call.id,
                success=False,
                output="",
                error=f"Execution error: {str(e)}"
            )

    def register_defaults(self) -> None:
        """Register all default tools."""
        from simi.tools.file import ReadFile, WriteFile, EditFile, Glob, Grep
        from simi.tools.shell import Shell
        from simi.tools.screen import Screenshot
        from simi.tools.web import WebFetch

        defaults = [
            ReadFile(),
            WriteFile(),
            EditFile(),
            Glob(),
            Grep(),
            Shell(),
            Screenshot(),
            WebFetch(),
        ]

        for tool in defaults:
            self.register(tool)

    @staticmethod
    def generate_call_id() -> str:
        """Generate a unique call ID."""
        return f"call_{uuid.uuid4().hex[:8]}"
