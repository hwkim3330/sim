"""
Hybrid Engine - Smart routing between local and cloud inference.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, AsyncIterator, Optional

if TYPE_CHECKING:
    from simi.types import Message, GenerationConfig, ToolSchema

from simi.engines.base import BaseEngine
from simi.engines.vlm import VLMEngine
from simi.engines.claude import ClaudeEngine

logger = logging.getLogger(__name__)


class HybridEngine(BaseEngine):
    """
    Hybrid inference engine that routes between local VLM and Claude API.

    Strategy:
    - Use local VLM for most tasks (fast, free)
    - Fall back to Claude API for:
      - Complex reasoning tasks
      - When local model fails
      - Explicit API request
      - Quality-critical tasks

    Example:
        >>> engine = HybridEngine(
        ...     vlm_path="models/qwen2.5-vl-3b",
        ...     claude_api_key="sk-..."
        ... )
        >>> response = engine.generate([Message.user("Write a function")])
    """

    def __init__(
        self,
        vlm_path: Optional[str] = None,
        vlm_device: str = "CPU",
        vlm_threads: int = 0,
        vlm_performance: str = "latency",
        claude_api_key: Optional[str] = None,
        claude_model: str = "claude-sonnet-4-20250514",
        *,
        prefer_local: bool = True,
        local_token_limit: int = 2000,
        fallback_on_error: bool = True,
        complex_task_keywords: Optional[list[str]] = None,
    ):
        """
        Initialize hybrid engine.

        Args:
            vlm_path: Path to local VLM model
            vlm_device: Device for local inference ("CPU", "GPU", "NPU", "AUTO")
            vlm_threads: Number of CPU threads (0 = auto)
            vlm_performance: Performance hint ("latency" or "throughput")
            claude_api_key: Anthropic API key
            claude_model: Claude model to use
            prefer_local: Prefer local model when possible
            local_token_limit: Max tokens for local inference
            fallback_on_error: Use API if local fails
            complex_task_keywords: Keywords that trigger API usage
        """
        self.prefer_local = prefer_local
        self.local_token_limit = local_token_limit
        self.fallback_on_error = fallback_on_error
        self.complex_task_keywords = complex_task_keywords or [
            "analyze", "explain in detail", "compare and contrast",
            "write comprehensive", "debug this complex",
            "architect", "design system", "review thoroughly"
        ]

        # Initialize engines
        self._vlm: Optional[VLMEngine] = None
        self._claude: Optional[ClaudeEngine] = None

        if vlm_path:
            try:
                self._vlm = VLMEngine(
                    vlm_path,
                    vlm_device,
                    num_threads=vlm_threads,
                    performance_hint=vlm_performance,
                )
                logger.info(f"Local VLM loaded: {self._vlm.name}")
            except Exception as e:
                logger.warning(f"Failed to load local VLM: {e}")

        if claude_api_key:
            try:
                self._claude = ClaudeEngine(claude_api_key, claude_model)
                logger.info(f"Claude API initialized: {claude_model}")
            except Exception as e:
                logger.warning(f"Failed to initialize Claude: {e}")

        if not self._vlm and not self._claude:
            raise RuntimeError("At least one engine must be available")

    @property
    def name(self) -> str:
        parts = []
        if self._vlm:
            parts.append(self._vlm.name)
        if self._claude:
            parts.append(self._claude.name)
        return f"Hybrid({'+'.join(parts)})"

    @property
    def supports_vision(self) -> bool:
        return (self._vlm and self._vlm.supports_vision) or \
               (self._claude and self._claude.supports_vision)

    @property
    def supports_tools(self) -> bool:
        return True

    @property
    def is_local(self) -> bool:
        # Hybrid can be both
        return self._vlm is not None

    def is_available(self) -> bool:
        return (self._vlm and self._vlm.is_available()) or \
               (self._claude is not None)

    def _should_use_api(self, messages: list[Message]) -> bool:
        """Determine if we should use Claude API for this request."""
        # No local model available
        if not self._vlm or not self._vlm.is_available():
            return True

        # Prefer API explicitly disabled
        if self.prefer_local:
            # Check for complex task keywords
            for msg in messages:
                content_lower = msg.content.lower()
                for keyword in self.complex_task_keywords:
                    if keyword in content_lower:
                        logger.debug(f"Using API due to keyword: {keyword}")
                        return True

            # Check context length
            total_text = " ".join(m.content for m in messages)
            if len(total_text) > self.local_token_limit * 4:  # Rough char estimate
                logger.debug("Using API due to long context")
                return True

        return False

    def _select_engine(self, messages: list[Message]) -> BaseEngine:
        """Select the appropriate engine for the request."""
        use_api = self._should_use_api(messages)

        if use_api and self._claude:
            return self._claude
        elif self._vlm and self._vlm.is_available():
            return self._vlm
        elif self._claude:
            return self._claude
        else:
            raise RuntimeError("No engine available")

    def generate(
        self,
        messages: list[Message],
        *,
        tools: Optional[list[ToolSchema]] = None,
        config: Optional[GenerationConfig] = None,
    ) -> str:
        """Generate response with smart routing."""
        engine = self._select_engine(messages)
        logger.debug(f"Selected engine: {engine.name}")

        try:
            return engine.generate(messages, tools=tools, config=config)

        except Exception as e:
            # Fallback to other engine
            if self.fallback_on_error:
                other = self._claude if engine == self._vlm else self._vlm
                if other and other.is_available():
                    logger.warning(f"Falling back from {engine.name} to {other.name}: {e}")
                    return other.generate(messages, tools=tools, config=config)
            raise

    async def generate_stream(
        self,
        messages: list[Message],
        *,
        tools: Optional[list[ToolSchema]] = None,
        config: Optional[GenerationConfig] = None,
    ) -> AsyncIterator[str]:
        """Generate response with streaming."""
        engine = self._select_engine(messages)
        logger.debug(f"Selected engine for stream: {engine.name}")

        try:
            async for token in engine.generate_stream(messages, tools=tools, config=config):
                yield token

        except Exception as e:
            if self.fallback_on_error:
                other = self._claude if engine == self._vlm else self._vlm
                if other and other.is_available():
                    logger.warning(f"Falling back from {engine.name}: {e}")
                    async for token in other.generate_stream(messages, tools=tools, config=config):
                        yield token
                    return
            raise

    def force_local(self, messages: list[Message], **kwargs) -> str:
        """Force local inference."""
        if not self._vlm:
            raise RuntimeError("Local VLM not available")
        return self._vlm.generate(messages, **kwargs)

    def force_api(self, messages: list[Message], **kwargs) -> str:
        """Force API inference."""
        if not self._claude:
            raise RuntimeError("Claude API not available")
        return self._claude.generate(messages, **kwargs)

    def shutdown(self) -> None:
        """Shutdown all engines."""
        if self._vlm:
            self._vlm.shutdown()
        if self._claude:
            self._claude.shutdown()
