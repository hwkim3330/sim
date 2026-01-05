"""
MCP (Model Context Protocol) Support for Simi Agent.

Enables integration with external tools and services through
the MCP standard protocol.

Based on: https://modelcontextprotocol.io/

Features:
- Local MCP server support (subprocess-based)
- Remote MCP server support (HTTP/WebSocket)
- OAuth authentication for remote servers
- Tool discovery and registration
"""

from simi.mcp.client import MCPClient
from simi.mcp.server import MCPServerConfig, LocalMCPServer, RemoteMCPServer
from simi.mcp.manager import MCPManager

__all__ = [
    "MCPClient",
    "MCPServerConfig",
    "LocalMCPServer",
    "RemoteMCPServer",
    "MCPManager",
]
