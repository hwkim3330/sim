"""
MCP Server implementations.
"""

from __future__ import annotations

import asyncio
import json
import subprocess
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class MCPServerConfig:
    """Configuration for an MCP server."""
    name: str
    type: str  # "local" or "remote"
    enabled: bool = True

    # Local server config
    command: list[str] = field(default_factory=list)
    environment: dict[str, str] = field(default_factory=dict)

    # Remote server config
    url: Optional[str] = None
    headers: dict[str, str] = field(default_factory=dict)
    oauth: Optional[dict[str, Any]] = None

    # Common
    timeout_ms: int = 5000


@dataclass
class MCPTool:
    """Tool provided by an MCP server."""
    name: str
    description: str
    input_schema: dict[str, Any]
    server_name: str


@dataclass
class MCPResource:
    """Resource provided by an MCP server."""
    uri: str
    name: str
    description: str
    mime_type: Optional[str] = None


class MCPServer(ABC):
    """Abstract base class for MCP servers."""

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self.connected = False
        self.tools: list[MCPTool] = []
        self.resources: list[MCPResource] = []

    @property
    def name(self) -> str:
        return self.config.name

    @abstractmethod
    async def connect(self) -> None:
        """Connect to the MCP server."""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the MCP server."""
        pass

    @abstractmethod
    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """Call a tool on the server."""
        pass

    @abstractmethod
    async def get_resource(self, uri: str) -> Any:
        """Get a resource from the server."""
        pass

    async def list_tools(self) -> list[MCPTool]:
        """List available tools."""
        return self.tools

    async def list_resources(self) -> list[MCPResource]:
        """List available resources."""
        return self.resources


class LocalMCPServer(MCPServer):
    """
    Local MCP server running as a subprocess.

    Uses JSON-RPC over stdin/stdout.
    """

    def __init__(self, config: MCPServerConfig):
        super().__init__(config)
        self._process: Optional[asyncio.subprocess.Process] = None
        self._request_id = 0

    async def connect(self) -> None:
        """Start the MCP server process."""
        if not self.config.command:
            raise ValueError("No command specified for local MCP server")

        logger.info(f"Starting MCP server: {self.config.name}")

        # Merge environment
        env = dict(**self.config.environment)

        try:
            self._process = await asyncio.create_subprocess_exec(
                *self.config.command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env if env else None,
            )
            self.connected = True

            # Initialize and get capabilities
            await self._initialize()
            await self._discover_tools()

            logger.info(f"MCP server {self.name} connected with {len(self.tools)} tools")

        except Exception as e:
            logger.error(f"Failed to start MCP server {self.name}: {e}")
            raise

    async def disconnect(self) -> None:
        """Stop the MCP server process."""
        if self._process:
            self._process.terminate()
            await self._process.wait()
            self._process = None
            self.connected = False
            logger.info(f"MCP server {self.name} disconnected")

    async def _send_request(self, method: str, params: Optional[dict] = None) -> Any:
        """Send JSON-RPC request and get response."""
        if not self._process or not self._process.stdin or not self._process.stdout:
            raise RuntimeError("MCP server not connected")

        self._request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params or {},
        }

        # Send request
        request_json = json.dumps(request) + "\n"
        self._process.stdin.write(request_json.encode())
        await self._process.stdin.drain()

        # Read response
        try:
            response_line = await asyncio.wait_for(
                self._process.stdout.readline(),
                timeout=self.config.timeout_ms / 1000,
            )
            response = json.loads(response_line.decode())

            if "error" in response:
                raise RuntimeError(f"MCP error: {response['error']}")

            return response.get("result")

        except asyncio.TimeoutError:
            raise TimeoutError(f"MCP server {self.name} timeout")

    async def _initialize(self) -> None:
        """Initialize the MCP connection."""
        await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {},
                "resources": {},
            },
            "clientInfo": {
                "name": "simi-agent",
                "version": "1.0.0",
            },
        })

        await self._send_request("notifications/initialized")

    async def _discover_tools(self) -> None:
        """Discover available tools from the server."""
        result = await self._send_request("tools/list")

        self.tools = []
        for tool in result.get("tools", []):
            self.tools.append(MCPTool(
                name=tool["name"],
                description=tool.get("description", ""),
                input_schema=tool.get("inputSchema", {}),
                server_name=self.name,
            ))

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """Call a tool on the MCP server."""
        result = await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments,
        })
        return result

    async def get_resource(self, uri: str) -> Any:
        """Get a resource from the MCP server."""
        result = await self._send_request("resources/read", {
            "uri": uri,
        })
        return result


class RemoteMCPServer(MCPServer):
    """
    Remote MCP server via HTTP/WebSocket.
    """

    def __init__(self, config: MCPServerConfig):
        super().__init__(config)
        self._session = None

    async def connect(self) -> None:
        """Connect to remote MCP server."""
        try:
            import aiohttp
        except ImportError:
            raise ImportError("aiohttp required for remote MCP: pip install aiohttp")

        if not self.config.url:
            raise ValueError("No URL specified for remote MCP server")

        logger.info(f"Connecting to remote MCP server: {self.config.url}")

        self._session = aiohttp.ClientSession(
            headers=self.config.headers,
            timeout=aiohttp.ClientTimeout(total=self.config.timeout_ms / 1000),
        )

        # Test connection and get capabilities
        async with self._session.get(f"{self.config.url}/health") as resp:
            if resp.status != 200:
                raise RuntimeError(f"MCP server health check failed: {resp.status}")

        # Get tools
        await self._discover_tools()
        self.connected = True

        logger.info(f"Remote MCP server {self.name} connected")

    async def disconnect(self) -> None:
        """Disconnect from remote server."""
        if self._session:
            await self._session.close()
            self._session = None
        self.connected = False

    async def _discover_tools(self) -> None:
        """Discover tools from remote server."""
        async with self._session.post(
            f"{self.config.url}/tools/list",
            json={},
        ) as resp:
            data = await resp.json()
            self.tools = []
            for tool in data.get("tools", []):
                self.tools.append(MCPTool(
                    name=tool["name"],
                    description=tool.get("description", ""),
                    input_schema=tool.get("inputSchema", {}),
                    server_name=self.name,
                ))

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """Call a tool on the remote server."""
        async with self._session.post(
            f"{self.config.url}/tools/call",
            json={"name": name, "arguments": arguments},
        ) as resp:
            return await resp.json()

    async def get_resource(self, uri: str) -> Any:
        """Get a resource from the remote server."""
        async with self._session.post(
            f"{self.config.url}/resources/read",
            json={"uri": uri},
        ) as resp:
            return await resp.json()
