"""
Core types for Simi Agent.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional, Union
from pathlib import Path


class Role(str, Enum):
    """Message role in conversation."""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class Message:
    """A message in the conversation."""
    role: Role
    content: str
    images: list[Union[str, Path, bytes]] = field(default_factory=list)
    tool_call_id: Optional[str] = None
    tool_name: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def system(cls, content: str) -> Message:
        """Create a system message."""
        return cls(role=Role.SYSTEM, content=content)

    @classmethod
    def user(
        cls,
        content: str,
        images: Optional[list[Union[str, Path, bytes]]] = None
    ) -> Message:
        """Create a user message with optional images."""
        return cls(role=Role.USER, content=content, images=images or [])

    @classmethod
    def assistant(cls, content: str) -> Message:
        """Create an assistant message."""
        return cls(role=Role.ASSISTANT, content=content)

    @classmethod
    def tool_result(
        cls,
        tool_name: str,
        tool_call_id: str,
        content: str
    ) -> Message:
        """Create a tool result message."""
        return cls(
            role=Role.TOOL,
            content=content,
            tool_name=tool_name,
            tool_call_id=tool_call_id
        )


@dataclass
class ToolParameter:
    """A parameter for a tool."""
    name: str
    type: str  # "string", "integer", "boolean", "array", "object"
    description: str
    required: bool = True
    default: Optional[Any] = None
    enum: Optional[list[str]] = None


@dataclass
class ToolSchema:
    """Schema for a tool, used for LLM function calling."""
    name: str
    description: str
    parameters: list[ToolParameter] = field(default_factory=list)

    def to_openai_format(self) -> dict[str, Any]:
        """Convert to OpenAI function calling format."""
        properties = {}
        required = []

        for param in self.parameters:
            prop: dict[str, Any] = {
                "type": param.type,
                "description": param.description,
            }
            if param.enum:
                prop["enum"] = param.enum
            properties[param.name] = prop

            if param.required:
                required.append(param.name)

        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                }
            }
        }

    def to_anthropic_format(self) -> dict[str, Any]:
        """Convert to Anthropic tool format."""
        properties = {}
        required = []

        for param in self.parameters:
            prop: dict[str, Any] = {
                "type": param.type,
                "description": param.description,
            }
            if param.enum:
                prop["enum"] = param.enum
            properties[param.name] = prop

            if param.required:
                required.append(param.name)

        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required,
            }
        }


@dataclass
class ToolCall:
    """A tool call from the model."""
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class ToolResult:
    """Result of executing a tool."""
    call_id: str
    success: bool
    output: str
    error: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class GenerationConfig:
    """Configuration for text generation."""
    max_tokens: int = 4096
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 50
    stop_sequences: list[str] = field(default_factory=lambda: ["</tool_call>"])
    stream: bool = True


# Callback types
StreamCallback = Callable[[str], None]
ToolCallback = Callable[[ToolCall, ToolResult], None]


class AgentState(str, Enum):
    """Current state of the agent."""
    IDLE = "idle"
    THINKING = "thinking"
    CALLING_TOOL = "calling_tool"
    WAITING_USER = "waiting_user"
    ERROR = "error"
    DONE = "done"


@dataclass
class UsageStats:
    """Token usage statistics."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    local_inference_count: int = 0
    api_call_count: int = 0
    tool_call_count: int = 0

    def add(self, other: UsageStats) -> None:
        """Add stats from another UsageStats object."""
        self.prompt_tokens += other.prompt_tokens
        self.completion_tokens += other.completion_tokens
        self.total_tokens += other.total_tokens
        self.local_inference_count += other.local_inference_count
        self.api_call_count += other.api_call_count
        self.tool_call_count += other.tool_call_count
