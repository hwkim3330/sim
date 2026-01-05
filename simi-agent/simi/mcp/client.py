"""
MCP Client for Simi Agent.

Integrates MCP tools with the agent's tool system.
"""

from __future__ import annotations

from typing import Any, Optional
from pathlib import Path

from simi.mcp.manager import MCPManager
from simi.mcp.server import MCPServerConfig, MCPTool


class MCPClient:
    """
    High-level MCP client for agent integration.

    Provides a simplified interface for using MCP servers
    with the Simi agent.

    Example:
        >>> client = MCPClient()
        >>>
        >>> # Add a filesystem server
        >>> client.add_local_server(
        ...     "filesystem",
        ...     ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path"],
        ... )
        >>>
        >>> # Connect
        >>> await client.connect()
        >>>
        >>> # Get tool schemas for LLM
        >>> schemas = client.get_tool_schemas()
        >>>
        >>> # Execute a tool
        >>> result = await client.execute("read_file", {"path": "test.txt"})
    """

    def __init__(self, config_path: Optional[Path] = None):
        self.manager = MCPManager(config_path)
        self._connected = False

    @property
    def connected(self) -> bool:
        return self._connected

    def add_local_server(
        self,
        name: str,
        command: list[str],
        environment: Optional[dict[str, str]] = None,
        enabled: bool = True,
    ) -> None:
        """Add a local MCP server."""
        self.manager.add_server(MCPServerConfig(
            name=name,
            type="local",
            command=command,
            environment=environment or {},
            enabled=enabled,
        ))

    def add_remote_server(
        self,
        name: str,
        url: str,
        headers: Optional[dict[str, str]] = None,
        enabled: bool = True,
    ) -> None:
        """Add a remote MCP server."""
        self.manager.add_server(MCPServerConfig(
            name=name,
            type="remote",
            url=url,
            headers=headers or {},
            enabled=enabled,
        ))

    async def connect(self) -> None:
        """Connect to all MCP servers."""
        await self.manager.connect_all()
        self._connected = True

    async def disconnect(self) -> None:
        """Disconnect from all MCP servers."""
        await self.manager.disconnect_all()
        self._connected = False

    def get_tools(self) -> list[MCPTool]:
        """Get all available MCP tools."""
        return self.manager.get_all_tools()

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        """
        Get tool schemas in a format suitable for LLM tool calling.

        Returns a list of tool definitions compatible with
        Claude/OpenAI function calling format.
        """
        schemas = []

        for tool in self.manager.get_all_tools():
            # Convert to function calling format
            schema = {
                "name": f"mcp_{tool.server_name}_{tool.name}",
                "description": f"[MCP:{tool.server_name}] {tool.description}",
                "parameters": tool.input_schema,
            }
            schemas.append(schema)

        return schemas

    async def execute(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """
        Execute an MCP tool by name.

        The tool name can be:
        - Just the tool name (searches all servers)
        - "server_name/tool_name" format
        """
        if "/" in tool_name:
            server_name, tool = tool_name.split("/", 1)
            return await self.manager.call_tool(server_name, tool, arguments)
        else:
            return await self.manager.call_tool_by_name(tool_name, arguments)

    def get_status(self) -> dict[str, Any]:
        """Get MCP system status."""
        return {
            "connected": self._connected,
            "servers": self.manager.get_status(),
            "total_tools": len(self.get_tools()),
        }

    # Context manager support

    async def __aenter__(self) -> "MCPClient":
        await self.connect()
        return self

    async def __aexit__(self, *args) -> None:
        await self.disconnect()
