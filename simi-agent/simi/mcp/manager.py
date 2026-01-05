"""
MCP Server Manager.

Manages multiple MCP servers and provides unified access to tools.
"""

from __future__ import annotations

import json
import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from simi.mcp.server import (
    MCPServer,
    MCPServerConfig,
    MCPTool,
    LocalMCPServer,
    RemoteMCPServer,
)

logger = logging.getLogger(__name__)


class MCPManager:
    """
    Manages multiple MCP servers.

    Example:
        >>> manager = MCPManager()
        >>> manager.add_server(MCPServerConfig(
        ...     name="filesystem",
        ...     type="local",
        ...     command=["npx", "-y", "@modelcontextprotocol/server-filesystem"],
        ... ))
        >>> await manager.connect_all()
        >>>
        >>> tools = manager.get_all_tools()
        >>> result = await manager.call_tool("filesystem", "read_file", {"path": "test.txt"})
    """

    def __init__(self, config_path: Optional[Path] = None):
        self.servers: dict[str, MCPServer] = {}
        self.config_path = config_path

        if config_path and config_path.exists():
            self.load_config(config_path)

    def add_server(self, config: MCPServerConfig) -> None:
        """Add an MCP server configuration."""
        if config.type == "local":
            server = LocalMCPServer(config)
        elif config.type == "remote":
            server = RemoteMCPServer(config)
        else:
            raise ValueError(f"Unknown MCP server type: {config.type}")

        self.servers[config.name] = server
        logger.info(f"Added MCP server: {config.name}")

    def remove_server(self, name: str) -> None:
        """Remove an MCP server."""
        if name in self.servers:
            del self.servers[name]

    async def connect(self, name: str) -> None:
        """Connect to a specific server."""
        if name not in self.servers:
            raise ValueError(f"Unknown MCP server: {name}")

        server = self.servers[name]
        if server.config.enabled:
            await server.connect()

    async def disconnect(self, name: str) -> None:
        """Disconnect from a specific server."""
        if name in self.servers:
            await self.servers[name].disconnect()

    async def connect_all(self) -> None:
        """Connect to all enabled servers."""
        tasks = []
        for name, server in self.servers.items():
            if server.config.enabled:
                tasks.append(self.connect(name))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def disconnect_all(self) -> None:
        """Disconnect from all servers."""
        tasks = [
            server.disconnect()
            for server in self.servers.values()
            if server.connected
        ]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def get_server(self, name: str) -> Optional[MCPServer]:
        """Get a server by name."""
        return self.servers.get(name)

    def get_all_tools(self) -> list[MCPTool]:
        """Get all tools from all connected servers."""
        tools = []
        for server in self.servers.values():
            if server.connected:
                tools.extend(server.tools)
        return tools

    def get_tool(self, name: str) -> Optional[tuple[MCPServer, MCPTool]]:
        """Find a tool by name across all servers."""
        for server in self.servers.values():
            if server.connected:
                for tool in server.tools:
                    if tool.name == name:
                        return (server, tool)
        return None

    async def call_tool(
        self,
        server_name: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> Any:
        """Call a tool on a specific server."""
        server = self.servers.get(server_name)
        if not server:
            raise ValueError(f"Unknown MCP server: {server_name}")
        if not server.connected:
            raise RuntimeError(f"MCP server not connected: {server_name}")

        return await server.call_tool(tool_name, arguments)

    async def call_tool_by_name(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """Call a tool by name (searches all servers)."""
        result = self.get_tool(tool_name)
        if not result:
            raise ValueError(f"Unknown tool: {tool_name}")

        server, tool = result
        return await server.call_tool(tool_name, arguments)

    def load_config(self, path: Path) -> None:
        """Load MCP server configurations from file."""
        data = json.loads(path.read_text())
        mcp_config = data.get("mcp", {})

        for name, config in mcp_config.items():
            self.add_server(MCPServerConfig(
                name=name,
                type=config.get("type", "local"),
                enabled=config.get("enabled", True),
                command=config.get("command", []),
                environment=config.get("environment", {}),
                url=config.get("url"),
                headers=config.get("headers", {}),
                oauth=config.get("oauth"),
                timeout_ms=config.get("timeout", 5000),
            ))

    def save_config(self, path: Path) -> None:
        """Save MCP server configurations to file."""
        mcp_config = {}

        for name, server in self.servers.items():
            config = {
                "type": server.config.type,
                "enabled": server.config.enabled,
            }

            if server.config.type == "local":
                config["command"] = server.config.command
                if server.config.environment:
                    config["environment"] = server.config.environment
            else:
                config["url"] = server.config.url
                if server.config.headers:
                    config["headers"] = server.config.headers

            mcp_config[name] = config

        # Read existing config and update
        existing = {}
        if path.exists():
            existing = json.loads(path.read_text())

        existing["mcp"] = mcp_config
        path.write_text(json.dumps(existing, indent=2))

    def get_status(self) -> dict[str, Any]:
        """Get status of all MCP servers."""
        return {
            name: {
                "type": server.config.type,
                "enabled": server.config.enabled,
                "connected": server.connected,
                "tools": len(server.tools),
            }
            for name, server in self.servers.items()
        }
