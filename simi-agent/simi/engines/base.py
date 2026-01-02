"""
Base engine interface for inference backends.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, AsyncIterator, Optional

if TYPE_CHECKING:
    from simi.types import Message, GenerationConfig, ToolSchema


class BaseEngine(ABC):
    """
    Abstract base class for inference engines.

    All engines must implement:
    - generate(): Synchronous generation
    - generate_stream(): Async streaming generation
    - supports_vision: Whether engine can process images
    - supports_tools: Whether engine supports tool/function calling
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Engine name for logging."""
        ...

    @property
    @abstractmethod
    def supports_vision(self) -> bool:
        """Whether this engine supports image inputs."""
        ...

    @property
    @abstractmethod
    def supports_tools(self) -> bool:
        """Whether this engine supports tool/function calling."""
        ...

    @property
    def is_local(self) -> bool:
        """Whether this engine runs locally (no API calls)."""
        return False

    @abstractmethod
    def generate(
        self,
        messages: list[Message],
        *,
        tools: Optional[list[ToolSchema]] = None,
        config: Optional[GenerationConfig] = None,
    ) -> str:
        """
        Generate a response synchronously.

        Args:
            messages: Conversation history
            tools: Available tools for function calling
            config: Generation parameters

        Returns:
            Generated text response
        """
        ...

    @abstractmethod
    async def generate_stream(
        self,
        messages: list[Message],
        *,
        tools: Optional[list[ToolSchema]] = None,
        config: Optional[GenerationConfig] = None,
    ) -> AsyncIterator[str]:
        """
        Generate a response with streaming.

        Args:
            messages: Conversation history
            tools: Available tools for function calling
            config: Generation parameters

        Yields:
            Generated tokens one at a time
        """
        ...
        # Make this a generator
        yield ""

    def count_tokens(self, text: str) -> int:
        """
        Estimate token count for text.

        Default implementation uses rough character-based estimate.
        Subclasses should override with accurate tokenizer.
        """
        # Rough estimate: ~4 chars per token
        return len(text) // 4

    def is_available(self) -> bool:
        """Check if engine is ready for inference."""
        return True

    def shutdown(self) -> None:
        """Clean up resources."""
        pass
