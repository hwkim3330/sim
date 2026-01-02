"""
Claude API Engine for cloud inference.
"""

from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import TYPE_CHECKING, Any, AsyncIterator, Optional, Union

if TYPE_CHECKING:
    from simi.types import Message, GenerationConfig, ToolSchema

from simi.engines.base import BaseEngine


class ClaudeEngine(BaseEngine):
    """
    Anthropic Claude API engine.

    Supports all Claude models with vision and tool use.

    Example:
        >>> engine = ClaudeEngine(api_key="sk-...")
        >>> response = engine.generate([Message.user("Hello!")])
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-sonnet-4-20250514",
        *,
        base_url: Optional[str] = None,
        max_retries: int = 3,
        timeout: float = 120.0,
    ):
        """
        Initialize Claude engine.

        Args:
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
            model: Model to use (e.g., "claude-sonnet-4-20250514", "claude-opus-4-20250514")
            base_url: Optional custom API base URL
            max_retries: Number of retries for failed requests
            timeout: Request timeout in seconds
        """
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.model = model
        self.base_url = base_url
        self.max_retries = max_retries
        self.timeout = timeout

        self._client: Any = None
        self._async_client: Any = None

        if not self.api_key:
            raise ValueError(
                "API key required. Set ANTHROPIC_API_KEY environment variable "
                "or pass api_key parameter."
            )

        self._init_client()

    def _init_client(self) -> None:
        """Initialize Anthropic client."""
        try:
            import anthropic

            kwargs: dict[str, Any] = {
                "api_key": self.api_key,
                "max_retries": self.max_retries,
                "timeout": self.timeout,
            }
            if self.base_url:
                kwargs["base_url"] = self.base_url

            self._client = anthropic.Anthropic(**kwargs)
            self._async_client = anthropic.AsyncAnthropic(**kwargs)

        except ImportError:
            raise ImportError(
                "Anthropic SDK not installed. "
                "Install with: pip install anthropic"
            )

    @property
    def name(self) -> str:
        return f"Claude({self.model})"

    @property
    def supports_vision(self) -> bool:
        return True

    @property
    def supports_tools(self) -> bool:
        return True

    @property
    def is_local(self) -> bool:
        return False

    def generate(
        self,
        messages: list[Message],
        *,
        tools: Optional[list[ToolSchema]] = None,
        config: Optional[GenerationConfig] = None,
    ) -> str:
        """Generate response synchronously."""
        from simi.types import GenerationConfig as GenConfig
        config = config or GenConfig()

        # Convert messages
        api_messages = self._convert_messages(messages)

        # Extract system message
        system = None
        for msg in messages:
            if msg.role.value == "system":
                system = msg.content
                break

        # Build request
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": api_messages,
            "max_tokens": config.max_tokens,
        }

        if system:
            kwargs["system"] = system

        if tools:
            kwargs["tools"] = [t.to_anthropic_format() for t in tools]

        if config.temperature != 0.7:  # Non-default
            kwargs["temperature"] = config.temperature

        if config.stop_sequences:
            kwargs["stop_sequences"] = config.stop_sequences

        # Make request
        response = self._client.messages.create(**kwargs)

        # Extract text content
        text_parts = []
        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                # Format tool call
                import json
                tool_call = {
                    "name": block.name,
                    "arguments": block.input
                }
                text_parts.append(f"<tool_call>\n{json.dumps(tool_call)}\n</tool_call>")

        return "\n".join(text_parts)

    async def generate_stream(
        self,
        messages: list[Message],
        *,
        tools: Optional[list[ToolSchema]] = None,
        config: Optional[GenerationConfig] = None,
    ) -> AsyncIterator[str]:
        """Generate response with streaming."""
        from simi.types import GenerationConfig as GenConfig
        config = config or GenConfig()

        api_messages = self._convert_messages(messages)

        system = None
        for msg in messages:
            if msg.role.value == "system":
                system = msg.content
                break

        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": api_messages,
            "max_tokens": config.max_tokens,
        }

        if system:
            kwargs["system"] = system

        if tools:
            kwargs["tools"] = [t.to_anthropic_format() for t in tools]

        # Stream response
        async with self._async_client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text

    def _convert_messages(self, messages: list[Message]) -> list[dict[str, Any]]:
        """Convert messages to Anthropic format."""
        api_messages: list[dict[str, Any]] = []

        for msg in messages:
            if msg.role.value == "system":
                continue  # System is separate

            content: list[dict[str, Any]] = []

            # Add images first
            for img in msg.images:
                img_data = self._encode_image(img)
                if img_data:
                    content.append({
                        "type": "image",
                        "source": img_data
                    })

            # Add text
            if msg.content:
                content.append({
                    "type": "text",
                    "text": msg.content
                })

            if content:
                api_messages.append({
                    "role": msg.role.value,
                    "content": content if len(content) > 1 else content[0]
                })

        return api_messages

    def _encode_image(self, image: Union[str, Path, bytes]) -> Optional[dict[str, Any]]:
        """Encode image for API."""
        if isinstance(image, bytes):
            # Raw bytes - assume PNG
            return {
                "type": "base64",
                "media_type": "image/png",
                "data": base64.b64encode(image).decode()
            }
        elif isinstance(image, (str, Path)):
            path = Path(image)
            if path.exists():
                # Determine media type
                suffix = path.suffix.lower()
                media_type = {
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".gif": "image/gif",
                    ".webp": "image/webp"
                }.get(suffix, "image/png")

                data = base64.b64encode(path.read_bytes()).decode()
                return {
                    "type": "base64",
                    "media_type": media_type,
                    "data": data
                }
            elif isinstance(image, str) and image.startswith("http"):
                # URL
                return {
                    "type": "url",
                    "url": image
                }

        return None

    def count_tokens(self, text: str) -> int:
        """Count tokens using tiktoken."""
        try:
            import tiktoken
            enc = tiktoken.encoding_for_model("gpt-4")
            return len(enc.encode(text))
        except ImportError:
            return super().count_tokens(text)

    def shutdown(self) -> None:
        """Close client connections."""
        self._client = None
        self._async_client = None
