"""
Main Agent implementation with ReAct loop.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional, Union

from simi.types import (
    Message,
    Role,
    ToolCall,
    ToolResult,
    GenerationConfig,
    AgentState,
    UsageStats,
    StreamCallback,
    ToolCallback,
)
from simi.engines import BaseEngine, HybridEngine, VLMEngine, ClaudeEngine
from simi.tools import ToolRegistry

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Configuration for the Agent."""

    # Engine settings
    vlm_model_path: Optional[str] = None
    vlm_device: str = "CPU"
    vlm_threads: int = 0  # 0 = auto
    vlm_performance: str = "latency"  # "latency" or "throughput"
    claude_api_key: Optional[str] = None
    claude_model: str = "claude-sonnet-4-20250514"

    # Behavior
    max_iterations: int = 50
    max_consecutive_errors: int = 3
    prefer_local: bool = True

    # Generation
    max_tokens: int = 4096
    temperature: float = 0.7
    stream: bool = True

    # System prompt
    system_prompt: str = """You are Simi, an AI coding assistant.

You help users with software engineering tasks by:
- Reading, writing, and editing files
- Executing shell commands
- Searching code
- Analyzing images and screenshots

When given a task:
1. Think step by step about what needs to be done
2. Use tools to gather information and make changes
3. Verify your work
4. Ask for clarification if needed

Be helpful, accurate, and thorough. Output code directly without markdown fences when writing files."""

    # Custom tools
    tools: list[Any] = field(default_factory=list)


class Agent:
    """
    AI Agent with ReAct-style reasoning loop.

    Supports:
    - Hybrid local/cloud inference
    - Tool use for code editing, shell, web, etc.
    - Vision-language understanding
    - Streaming output

    Example:
        >>> from simi import Agent, AgentConfig
        >>> agent = Agent(AgentConfig(
        ...     vlm_model_path="models/qwen2.5-vl-3b",
        ...     claude_api_key="sk-..."
        ... ))
        >>> response = agent.run("Hello!")
        >>> print(response)

        >>> # With image
        >>> response = agent.run("What's in this?", images=["screenshot.png"])

        >>> # Streaming
        >>> for chunk in agent.stream("Write a function"):
        ...     print(chunk, end="")
    """

    def __init__(self, config: Optional[AgentConfig] = None):
        """
        Initialize agent.

        Args:
            config: Agent configuration. If None, uses defaults.
        """
        self.config = config or AgentConfig()
        self._state = AgentState.IDLE
        self._history: list[Message] = []
        self._stats = UsageStats()

        # Initialize engine
        self._engine = self._create_engine()

        # Initialize tools
        self._tools = ToolRegistry()
        self._tools.register_defaults()

        # Register custom tools
        for tool in self.config.tools:
            self._tools.register(tool)

        # Callbacks
        self._stream_callback: Optional[StreamCallback] = None
        self._tool_callback: Optional[ToolCallback] = None

    def _create_engine(self) -> BaseEngine:
        """Create the inference engine based on config."""
        has_vlm = self.config.vlm_model_path and Path(self.config.vlm_model_path).exists()
        has_claude = bool(self.config.claude_api_key)

        if has_vlm and has_claude:
            return HybridEngine(
                vlm_path=self.config.vlm_model_path,
                vlm_device=self.config.vlm_device,
                vlm_threads=self.config.vlm_threads,
                vlm_performance=self.config.vlm_performance,
                claude_api_key=self.config.claude_api_key,
                claude_model=self.config.claude_model,
                prefer_local=self.config.prefer_local,
            )
        elif has_vlm:
            return VLMEngine(
                self.config.vlm_model_path,
                self.config.vlm_device,
                num_threads=self.config.vlm_threads,
                performance_hint=self.config.vlm_performance,
            )
        elif has_claude:
            return ClaudeEngine(
                self.config.claude_api_key,
                self.config.claude_model,
            )
        else:
            raise ValueError(
                "At least one of vlm_model_path or claude_api_key must be provided"
            )

    @property
    def state(self) -> AgentState:
        """Current agent state."""
        return self._state

    @property
    def history(self) -> list[Message]:
        """Conversation history."""
        return self._history.copy()

    @property
    def stats(self) -> UsageStats:
        """Usage statistics."""
        return self._stats

    def run(
        self,
        message: str,
        *,
        images: Optional[list[Union[str, Path, bytes]]] = None,
        stream_callback: Optional[StreamCallback] = None,
        tool_callback: Optional[ToolCallback] = None,
    ) -> str:
        """
        Process a message and return response.

        Args:
            message: User's message
            images: Optional images to include
            stream_callback: Called with each token
            tool_callback: Called when tool is used

        Returns:
            Agent's response
        """
        self._stream_callback = stream_callback
        self._tool_callback = tool_callback
        self._state = AgentState.THINKING

        # Add user message
        self._history.append(Message.user(message, images or []))

        # Run ReAct loop
        response = self._react_loop()

        # Add assistant response
        self._history.append(Message.assistant(response))

        self._state = AgentState.DONE
        return response

    def stream(
        self,
        message: str,
        *,
        images: Optional[list[Union[str, Path, bytes]]] = None,
        tool_callback: Optional[ToolCallback] = None,
    ):
        """
        Process a message with streaming output.

        Yields:
            Tokens as they are generated
        """
        buffer: list[str] = []

        def collect(token: str) -> None:
            buffer.append(token)

        # Run with callback
        self.run(
            message,
            images=images,
            stream_callback=collect,
            tool_callback=tool_callback,
        )

        # Yield collected tokens
        yield from buffer

    def reset(self) -> None:
        """Reset conversation history."""
        self._history.clear()
        self._state = AgentState.IDLE
        self._stats = UsageStats()

    def add_message(self, message: Message) -> None:
        """Manually add a message to history."""
        self._history.append(message)

    def _react_loop(self) -> str:
        """Run the ReAct reasoning loop."""
        iterations = 0
        consecutive_errors = 0
        final_response = ""

        while iterations < self.config.max_iterations:
            iterations += 1
            self._state = AgentState.THINKING

            # Build messages with system prompt and tools
            messages = self._build_messages()

            # Generate response
            gen_config = GenerationConfig(
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                stream=self.config.stream,
            )

            try:
                if self._stream_callback and self.config.stream:
                    response = self._generate_streaming(messages, gen_config)
                else:
                    response = self._engine.generate(
                        messages,
                        tools=self._tools.get_schemas(),
                        config=gen_config,
                    )
            except Exception as e:
                logger.error(f"Generation error: {e}")
                consecutive_errors += 1
                if consecutive_errors >= self.config.max_consecutive_errors:
                    return f"Error after {consecutive_errors} attempts: {e}"
                continue

            # Parse tool calls
            tool_calls = self._parse_tool_calls(response)

            if not tool_calls:
                # No tool calls - return response
                final_response = self._clean_response(response)
                break

            # Execute tools
            self._state = AgentState.CALLING_TOOL
            self._stats.tool_call_count += len(tool_calls)

            tool_results = []
            for call in tool_calls:
                result = self._tools.execute(call)
                tool_results.append((call, result))

                if self._tool_callback:
                    self._tool_callback(call, result)

                if not result.success:
                    consecutive_errors += 1
                else:
                    consecutive_errors = 0

            if consecutive_errors >= self.config.max_consecutive_errors:
                final_response = "Too many consecutive errors. Please try again."
                break

            # Add tool results to history
            tool_output = self._format_tool_results(tool_results)
            self._history.append(Message.tool_result("tools", "", tool_output))

        if iterations >= self.config.max_iterations:
            final_response += "\n[Reached maximum iterations]"

        return final_response

    def _generate_streaming(
        self,
        messages: list[Message],
        config: GenerationConfig
    ) -> str:
        """Generate with streaming and callback."""
        import asyncio

        async def _stream():
            chunks = []
            async for token in self._engine.generate_stream(
                messages,
                tools=self._tools.get_schemas(),
                config=config,
            ):
                chunks.append(token)
                if self._stream_callback:
                    self._stream_callback(token)
            return "".join(chunks)

        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_stream())
        finally:
            loop.close()

    def _build_messages(self) -> list[Message]:
        """Build message list with system prompt."""
        messages = [Message.system(self.config.system_prompt)]
        messages.extend(self._history)
        return messages

    def _parse_tool_calls(self, response: str) -> list[ToolCall]:
        """Parse tool calls from model output."""
        calls: list[ToolCall] = []

        # Pattern: <tool_call>{"name": "...", "arguments": {...}}</tool_call>
        pattern = r'<tool_call>\s*(\{.*?\})\s*</tool_call>'
        matches = re.findall(pattern, response, re.DOTALL)

        for i, match in enumerate(matches):
            try:
                data = json.loads(match)
                calls.append(ToolCall(
                    id=f"call_{i}",
                    name=data.get("name", ""),
                    arguments=data.get("arguments", {})
                ))
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse tool call: {match}")

        return calls

    def _format_tool_results(
        self,
        results: list[tuple[ToolCall, ToolResult]]
    ) -> str:
        """Format tool results for model."""
        parts = ["Tool Results:"]

        for call, result in results:
            parts.append(f"\n### {call.name}")
            if result.success:
                parts.append(f"Status: Success")
                parts.append(f"Output:\n{result.output}")
            else:
                parts.append(f"Status: Failed")
                parts.append(f"Error: {result.error}")

        return "\n".join(parts)

    def _clean_response(self, response: str) -> str:
        """Clean up response by removing tool call artifacts."""
        # Remove tool call blocks
        response = re.sub(
            r'<tool_call>.*?</tool_call>',
            '',
            response,
            flags=re.DOTALL
        )
        return response.strip()


def create_agent(
    vlm_path: Optional[str] = None,
    claude_key: Optional[str] = None,
    **kwargs: Any
) -> Agent:
    """
    Create an agent with simple parameters.

    Args:
        vlm_path: Path to local VLM model
        claude_key: Anthropic API key
        **kwargs: Additional AgentConfig parameters

    Returns:
        Configured Agent instance
    """
    config = AgentConfig(
        vlm_model_path=vlm_path,
        claude_api_key=claude_key,
        **kwargs
    )
    return Agent(config)
