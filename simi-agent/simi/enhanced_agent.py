"""
Enhanced Agent with Mode Support, MCP, and Custom Tools.

This module provides an enhanced agent that builds on the base Agent
with additional features:
- Build/Plan modes with different tool access levels
- MCP (Model Context Protocol) integration
- Custom tools configuration
- Improved conversation management
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, Union

from simi.agent import Agent, AgentConfig
from simi.mode import AgentMode
from simi.types import (
    Message,
    ToolCall,
    ToolResult,
    GenerationConfig,
    StreamCallback,
    ToolCallback,
)
from simi.tools import ToolRegistry
from simi.tools.config import CustomToolLoader

logger = logging.getLogger(__name__)


@dataclass
class EnhancedAgentConfig(AgentConfig):
    """Extended configuration for the enhanced agent."""

    # Mode settings
    initial_mode: AgentMode = AgentMode.BUILD

    # MCP settings
    mcp_config_path: Optional[Path] = None
    mcp_servers: list[dict[str, Any]] = field(default_factory=list)

    # Custom tools
    custom_tools_path: Optional[Path] = None
    custom_tools: list[dict[str, Any]] = field(default_factory=list)

    # Plan mode
    plan_file: Optional[Path] = None  # Where to save plans

    # Session
    session_file: Optional[Path] = None  # Persist conversation


class EnhancedAgent(Agent):
    """
    Enhanced Agent with extended capabilities.

    Features:
    - Build/Plan modes for different workflows
    - MCP server integration for external tools
    - Custom tools from configuration
    - Conversation persistence

    Example:
        >>> from simi import EnhancedAgent, EnhancedAgentConfig
        >>> agent = EnhancedAgent(EnhancedAgentConfig(
        ...     claude_api_key="sk-...",
        ...     initial_mode=AgentMode.PLAN,
        ... ))
        >>>
        >>> # Research in plan mode
        >>> agent.run("Analyze the codebase structure")
        >>>
        >>> # Switch to build mode
        >>> agent.set_mode(AgentMode.BUILD)
        >>> agent.run("Implement the plan")
    """

    def __init__(self, config: Optional[EnhancedAgentConfig] = None):
        """Initialize enhanced agent."""
        self.enhanced_config = config or EnhancedAgentConfig()
        super().__init__(self.enhanced_config)

        # Mode
        self._mode = self.enhanced_config.initial_mode

        # MCP client (lazy loaded)
        self._mcp_client = None

        # Custom tools
        self._custom_loader = CustomToolLoader()
        self._load_custom_tools()

        # Plan storage
        self._current_plan: Optional[str] = None

    def _load_custom_tools(self) -> None:
        """Load custom tools from configuration."""
        # Load from file
        if self.enhanced_config.custom_tools_path:
            tools = self._custom_loader.load_from_file(
                self.enhanced_config.custom_tools_path
            )
            for tool in tools:
                self._tools.register(tool)

        # Load from inline config
        if self.enhanced_config.custom_tools:
            tools = self._custom_loader.load_from_dict({
                "tools": self.enhanced_config.custom_tools
            })
            for tool in tools:
                self._tools.register(tool)

    async def _init_mcp(self) -> None:
        """Initialize MCP client."""
        if self._mcp_client is not None:
            return

        try:
            from simi.mcp import MCPClient

            self._mcp_client = MCPClient(
                self.enhanced_config.mcp_config_path
            )

            # Add servers from config
            for server in self.enhanced_config.mcp_servers:
                if server.get("type") == "local":
                    self._mcp_client.add_local_server(
                        name=server["name"],
                        command=server["command"],
                        environment=server.get("environment", {}),
                    )
                elif server.get("type") == "remote":
                    self._mcp_client.add_remote_server(
                        name=server["name"],
                        url=server["url"],
                        headers=server.get("headers", {}),
                    )

            await self._mcp_client.connect()
            logger.info("MCP client initialized")

        except ImportError:
            logger.warning("MCP module not available")
        except Exception as e:
            logger.error(f"Failed to initialize MCP: {e}")

    @property
    def mode(self) -> AgentMode:
        """Current agent mode."""
        return self._mode

    def set_mode(self, mode: AgentMode) -> None:
        """
        Switch agent mode.

        Args:
            mode: New agent mode (BUILD or PLAN)
        """
        old_mode = self._mode
        self._mode = mode

        # Add mode change to context
        if old_mode != mode:
            self._history.append(Message.system(
                f"[Mode changed: {old_mode.value} -> {mode.value}]\n"
                f"{mode.system_prompt_addon}"
            ))
            logger.info(f"Agent mode changed: {old_mode.value} -> {mode.value}")

    def toggle_mode(self) -> AgentMode:
        """Toggle between BUILD and PLAN modes."""
        new_mode = (
            AgentMode.PLAN if self._mode == AgentMode.BUILD
            else AgentMode.BUILD
        )
        self.set_mode(new_mode)
        return new_mode

    def _is_tool_allowed(self, tool_name: str) -> bool:
        """Check if a tool is allowed in current mode."""
        allowed = self._mode.allowed_tools
        if "*" in allowed:
            return True
        return tool_name in allowed

    def _filter_tools_for_mode(self) -> list:
        """Get tools available in current mode."""
        all_schemas = self._tools.get_schemas()

        if "*" in self._mode.allowed_tools:
            return all_schemas

        return [
            schema for schema in all_schemas
            if schema.name in self._mode.allowed_tools
        ]

    def _build_messages(self) -> list[Message]:
        """Build message list with mode-specific system prompt."""
        # Enhanced system prompt with mode info
        system_content = (
            f"{self.config.system_prompt}\n\n"
            f"Current Mode: {self._mode.value.upper()}\n"
            f"{self._mode.system_prompt_addon}"
        )

        messages = [Message.system(system_content)]
        messages.extend(self._history)
        return messages

    def run(
        self,
        message: str,
        *,
        images: Optional[list[Union[str, Path, bytes]]] = None,
        stream_callback: Optional[StreamCallback] = None,
        tool_callback: Optional[ToolCallback] = None,
    ) -> str:
        """
        Process a message with mode awareness.

        In PLAN mode, write operations are blocked.
        In BUILD mode, full access is available.
        """
        # Check for mode switch commands
        if message.strip().lower() in ("/plan", "/plan mode"):
            self.set_mode(AgentMode.PLAN)
            return f"Switched to PLAN mode. {AgentMode.PLAN.description}"

        if message.strip().lower() in ("/build", "/build mode"):
            self.set_mode(AgentMode.BUILD)
            return f"Switched to BUILD mode. {AgentMode.BUILD.description}"

        # Wrap tool callback to enforce mode restrictions
        original_callback = tool_callback

        def mode_aware_callback(call: ToolCall, result: ToolResult) -> None:
            if not self._is_tool_allowed(call.name):
                result.success = False
                result.error = (
                    f"Tool '{call.name}' is not available in {self._mode.value} mode. "
                    f"Switch to BUILD mode to use this tool."
                )
            if original_callback:
                original_callback(call, result)

        return super().run(
            message,
            images=images,
            stream_callback=stream_callback,
            tool_callback=mode_aware_callback,
        )

    def save_plan(self, plan: str, path: Optional[Path] = None) -> Path:
        """
        Save a plan to file.

        Args:
            plan: Plan content to save
            path: Optional path (uses config default if not provided)

        Returns:
            Path where plan was saved
        """
        save_path = path or self.enhanced_config.plan_file
        if not save_path:
            save_path = Path.cwd() / ".simi_plan.md"

        save_path.write_text(plan, encoding="utf-8")
        self._current_plan = plan
        logger.info(f"Plan saved to: {save_path}")
        return save_path

    def load_plan(self, path: Optional[Path] = None) -> Optional[str]:
        """
        Load a plan from file.

        Args:
            path: Optional path (uses config default if not provided)

        Returns:
            Plan content or None if not found
        """
        load_path = path or self.enhanced_config.plan_file
        if not load_path:
            load_path = Path.cwd() / ".simi_plan.md"

        if load_path.exists():
            self._current_plan = load_path.read_text(encoding="utf-8")
            return self._current_plan

        return None

    async def execute_with_mcp(
        self,
        tool_name: str,
        arguments: dict[str, Any]
    ) -> Any:
        """
        Execute a tool via MCP.

        Args:
            tool_name: Name of the MCP tool
            arguments: Tool arguments

        Returns:
            Tool execution result
        """
        await self._init_mcp()

        if not self._mcp_client:
            raise RuntimeError("MCP client not available")

        return await self._mcp_client.execute(tool_name, arguments)

    def get_mcp_tools(self) -> list[dict[str, Any]]:
        """Get available MCP tools."""
        if not self._mcp_client:
            return []
        return self._mcp_client.get_tool_schemas()

    def save_session(self, path: Optional[Path] = None) -> Path:
        """
        Save conversation session to file.

        Args:
            path: Optional path (uses config default if not provided)

        Returns:
            Path where session was saved
        """
        save_path = path or self.enhanced_config.session_file
        if not save_path:
            save_path = Path.cwd() / ".simi_session.json"

        session_data = {
            "mode": self._mode.value,
            "history": [
                {
                    "role": msg.role.value,
                    "content": msg.content,
                    "metadata": msg.metadata,
                }
                for msg in self._history
            ],
            "stats": {
                "prompt_tokens": self._stats.prompt_tokens,
                "completion_tokens": self._stats.completion_tokens,
                "tool_call_count": self._stats.tool_call_count,
            },
            "plan": self._current_plan,
        }

        save_path.write_text(
            json.dumps(session_data, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
        logger.info(f"Session saved to: {save_path}")
        return save_path

    def load_session(self, path: Optional[Path] = None) -> bool:
        """
        Load conversation session from file.

        Args:
            path: Optional path (uses config default if not provided)

        Returns:
            True if session was loaded successfully
        """
        from simi.types import Role

        load_path = path or self.enhanced_config.session_file
        if not load_path:
            load_path = Path.cwd() / ".simi_session.json"

        if not load_path.exists():
            return False

        try:
            data = json.loads(load_path.read_text(encoding="utf-8"))

            # Restore mode
            self._mode = AgentMode(data.get("mode", "build"))

            # Restore history
            self._history.clear()
            for msg_data in data.get("history", []):
                self._history.append(Message(
                    role=Role(msg_data["role"]),
                    content=msg_data["content"],
                    metadata=msg_data.get("metadata", {}),
                ))

            # Restore plan
            self._current_plan = data.get("plan")

            logger.info(f"Session loaded from: {load_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to load session: {e}")
            return False

    def get_status(self) -> dict[str, Any]:
        """Get comprehensive agent status."""
        status = {
            "mode": self._mode.value,
            "mode_description": self._mode.description,
            "history_length": len(self._history),
            "stats": {
                "prompt_tokens": self._stats.prompt_tokens,
                "completion_tokens": self._stats.completion_tokens,
                "tool_call_count": self._stats.tool_call_count,
                "local_inference_count": self._stats.local_inference_count,
                "api_call_count": self._stats.api_call_count,
            },
            "tools": {
                "registered": len(self._tools.list()),
                "available_in_mode": len(self._filter_tools_for_mode()),
            },
            "has_plan": self._current_plan is not None,
            "mcp_connected": self._mcp_client is not None and self._mcp_client.connected,
        }
        return status
