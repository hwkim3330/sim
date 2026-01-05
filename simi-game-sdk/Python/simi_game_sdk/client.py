"""
WebSocket client for Simi Game SDK.
"""

import asyncio
import json
import logging
from typing import Any, Optional, Callable, Coroutine
from dataclasses import dataclass

try:
    import websockets
    from websockets.client import WebSocketClientProtocol
except ImportError:
    websockets = None

from simi_game_sdk.action import Action
from simi_game_sdk.types import (
    Priority,
    Capability,
    ActionRequest,
    QueryRequest,
    SpeakEvent,
    ActionHandler,
    QueryHandler,
    SpeakHandler,
)

logger = logging.getLogger(__name__)


@dataclass
class GameInfo:
    """Game metadata."""
    name: str
    version: str = "1.0.0"
    capabilities: list[Capability] = None

    def __post_init__(self):
        if self.capabilities is None:
            self.capabilities = [Capability.ACTIONS, Capability.CONTEXT]


class SimiClient:
    """
    WebSocket client for communicating with Simi server.

    Example:
        >>> client = SimiClient("my-game", server_url="ws://localhost:8080/game")
        >>> await client.connect()
        >>>
        >>> # Send context
        >>> await client.send_context("Game started!")
        >>>
        >>> # Register actions
        >>> await client.register_actions([
        ...     Action.simple("end_turn", "End your turn"),
        ...     Action.with_params("attack", "Attack target", {
        ...         "target": {"type": "string"}
        ...     })
        ... ])
        >>>
        >>> # Force action
        >>> await client.force_actions(["attack", "end_turn"], "Your turn!")
        >>>
        >>> # Handle actions
        >>> @client.on_action
        ... async def handle(req: ActionRequest):
        ...     # Process action...
        ...     await client.action_result(req.id, True, "Done!")
    """

    def __init__(
        self,
        game_id: str,
        *,
        server_url: str = "ws://localhost:8080/game",
        name: Optional[str] = None,
        version: str = "1.0.0",
        capabilities: Optional[list[Capability]] = None,
    ):
        if websockets is None:
            raise ImportError("websockets package required: pip install websockets")

        self.game_id = game_id
        self.server_url = server_url
        self.info = GameInfo(
            name=name or game_id,
            version=version,
            capabilities=capabilities,
        )

        self._ws: Optional[WebSocketClientProtocol] = None
        self._connected = False
        self._running = False

        # Registered actions
        self._actions: dict[str, Action] = {}

        # Handlers
        self._action_handler: Optional[ActionHandler] = None
        self._query_handler: Optional[QueryHandler] = None
        self._speak_handler: Optional[SpeakHandler] = None

        # Message queue for responses
        self._response_queue: asyncio.Queue = asyncio.Queue()

    @property
    def connected(self) -> bool:
        return self._connected and self._ws is not None

    async def connect(self) -> None:
        """Connect to Simi server."""
        logger.info(f"Connecting to {self.server_url}")

        self._ws = await websockets.connect(self.server_url)
        self._connected = True

        # Send startup message
        await self._send({
            "command": "startup",
            "game": self.game_id,
            "data": {
                "name": self.info.name,
                "version": self.info.version,
                "capabilities": [c.value for c in self.info.capabilities],
            }
        })

        logger.info(f"Connected as '{self.game_id}'")

    async def disconnect(self) -> None:
        """Disconnect from server."""
        self._running = False
        if self._ws:
            await self._ws.close()
            self._ws = None
        self._connected = False
        logger.info("Disconnected")

    async def run(self) -> None:
        """Run the message loop. Call after connect()."""
        if not self.connected:
            raise RuntimeError("Not connected. Call connect() first.")

        self._running = True
        logger.info("Starting message loop")

        try:
            async for message in self._ws:
                await self._handle_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("Connection closed")
        finally:
            self._running = False

    async def _send(self, data: dict[str, Any]) -> None:
        """Send a message to server."""
        if not self.connected:
            raise RuntimeError("Not connected")

        message = json.dumps(data)
        await self._ws.send(message)
        logger.debug(f"Sent: {data['command']}")

    async def _handle_message(self, raw: str) -> None:
        """Handle incoming message."""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON: {raw[:100]}")
            return

        command = data.get("command")
        payload = data.get("data", {})

        logger.debug(f"Received: {command}")

        if command == "action":
            await self._handle_action(payload)
        elif command == "query":
            await self._handle_query(payload)
        elif command == "speak":
            await self._handle_speak(payload)
        else:
            logger.warning(f"Unknown command: {command}")

    async def _handle_action(self, data: dict[str, Any]) -> None:
        """Handle action request from Simi."""
        request = ActionRequest(
            id=data.get("id", ""),
            name=data.get("name", ""),
            params=data.get("params", {}),
        )

        if self._action_handler:
            try:
                await self._action_handler(request)
            except Exception as e:
                logger.error(f"Action handler error: {e}")
                await self.action_result(request.id, False, str(e))
        else:
            logger.warning(f"No action handler for: {request.name}")
            await self.action_result(request.id, False, "No handler")

    async def _handle_query(self, data: dict[str, Any]) -> None:
        """Handle query from Simi."""
        request = QueryRequest(
            id=data.get("id", ""),
            question=data.get("question", ""),
        )

        if self._query_handler:
            try:
                answer = await self._query_handler(request)
                await self._send({
                    "command": "query/response",
                    "game": self.game_id,
                    "data": {
                        "id": request.id,
                        "answer": answer,
                    }
                })
            except Exception as e:
                logger.error(f"Query handler error: {e}")

    async def _handle_speak(self, data: dict[str, Any]) -> None:
        """Handle speak event from Simi."""
        event = SpeakEvent(
            message=data.get("message", ""),
            emotion=data.get("emotion"),
        )

        if self._speak_handler:
            try:
                await self._speak_handler(event)
            except Exception as e:
                logger.error(f"Speak handler error: {e}")

    # Public API

    async def send_context(
        self,
        message: str,
        *,
        silent: bool = False,
        state: Optional[dict[str, Any]] = None,
    ) -> None:
        """Send game context to Simi."""
        data = {"message": message, "silent": silent}
        if state:
            data["state"] = state

        await self._send({
            "command": "context",
            "game": self.game_id,
            "data": data,
        })

    async def register_actions(self, actions: list[Action]) -> None:
        """Register available actions."""
        for action in actions:
            self._actions[action.name] = action

        await self._send({
            "command": "actions/register",
            "game": self.game_id,
            "data": {
                "actions": [a.to_dict() for a in actions],
            }
        })

    async def unregister_actions(self, action_names: list[str]) -> None:
        """Unregister actions."""
        for name in action_names:
            self._actions.pop(name, None)

        await self._send({
            "command": "actions/unregister",
            "game": self.game_id,
            "data": {
                "actions": action_names,
            }
        })

    async def force_actions(
        self,
        action_names: list[str],
        message: str,
        *,
        timeout_ms: Optional[int] = None,
        priority: Priority = Priority.NORMAL,
    ) -> None:
        """Force Simi to choose from specific actions."""
        data = {
            "actions": action_names,
            "message": message,
            "priority": priority.value,
        }
        if timeout_ms:
            data["timeout_ms"] = timeout_ms

        await self._send({
            "command": "actions/force",
            "game": self.game_id,
            "data": data,
        })

    async def action_result(
        self,
        action_id: str,
        success: bool,
        message: str = "",
    ) -> None:
        """Report action result."""
        await self._send({
            "command": "actions/result",
            "game": self.game_id,
            "data": {
                "id": action_id,
                "success": success,
                "message": message,
            }
        })

    # Decorators for handlers

    def on_action(self, handler: ActionHandler) -> ActionHandler:
        """Decorator to set action handler."""
        self._action_handler = handler
        return handler

    def on_query(self, handler: QueryHandler) -> QueryHandler:
        """Decorator to set query handler."""
        self._query_handler = handler
        return handler

    def on_speak(self, handler: SpeakHandler) -> SpeakHandler:
        """Decorator to set speak handler."""
        self._speak_handler = handler
        return handler
