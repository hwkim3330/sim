"""
WebSocket server for Simi Game SDK.

Bridges game connections to the Simi AI agent.
"""

import asyncio
import json
import logging
import uuid
from typing import Any, Optional, Callable, Coroutine
from dataclasses import dataclass, field

try:
    import websockets
    from websockets.server import WebSocketServerProtocol, serve
except ImportError:
    websockets = None

logger = logging.getLogger(__name__)


@dataclass
class GameSession:
    """Represents a connected game."""
    game_id: str
    ws: WebSocketServerProtocol
    name: str = ""
    version: str = ""
    capabilities: list[str] = field(default_factory=list)
    actions: dict[str, dict[str, Any]] = field(default_factory=dict)


class SimiServer:
    """
    WebSocket server that manages game connections.

    The server receives game state from connected games and routes
    actions from the AI agent to the appropriate game.

    Example:
        >>> server = SimiServer(host="localhost", port=8080)
        >>>
        >>> @server.on_context
        ... async def handle_context(game_id: str, message: str, state: dict):
        ...     # Process game context with AI
        ...     response = await ai.process(message)
        ...     if response.action:
        ...         await server.send_action(game_id, response.action)
        >>>
        >>> await server.start()
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8080,
    ):
        if websockets is None:
            raise ImportError("websockets package required")

        self.host = host
        self.port = port

        self._sessions: dict[str, GameSession] = {}
        self._server = None

        # Handlers
        self._on_connect: Optional[Callable] = None
        self._on_disconnect: Optional[Callable] = None
        self._on_context: Optional[Callable] = None
        self._on_action_result: Optional[Callable] = None
        self._on_query_response: Optional[Callable] = None

    @property
    def games(self) -> list[str]:
        """List of connected game IDs."""
        return list(self._sessions.keys())

    def get_game(self, game_id: str) -> Optional[GameSession]:
        """Get game session by ID."""
        return self._sessions.get(game_id)

    async def start(self) -> None:
        """Start the server."""
        logger.info(f"Starting server on ws://{self.host}:{self.port}/game")

        self._server = await serve(
            self._handle_connection,
            self.host,
            self.port,
            ping_interval=30,
            ping_timeout=10,
        )

        logger.info("Server started")
        await self._server.wait_closed()

    async def stop(self) -> None:
        """Stop the server."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            logger.info("Server stopped")

    async def _handle_connection(self, ws: WebSocketServerProtocol, path: str) -> None:
        """Handle a new WebSocket connection."""
        session: Optional[GameSession] = None

        try:
            async for message in ws:
                data = json.loads(message)
                command = data.get("command")
                game_id = data.get("game")
                payload = data.get("data", {})

                if command == "startup":
                    session = GameSession(
                        game_id=game_id,
                        ws=ws,
                        name=payload.get("name", game_id),
                        version=payload.get("version", ""),
                        capabilities=payload.get("capabilities", []),
                    )
                    self._sessions[game_id] = session
                    logger.info(f"Game connected: {session.name} ({game_id})")

                    if self._on_connect:
                        await self._on_connect(game_id, session)

                elif session:
                    await self._handle_message(session, command, payload)

        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"Connection error: {e}")
        finally:
            if session:
                del self._sessions[session.game_id]
                logger.info(f"Game disconnected: {session.game_id}")

                if self._on_disconnect:
                    await self._on_disconnect(session.game_id)

    async def _handle_message(
        self,
        session: GameSession,
        command: str,
        data: dict[str, Any],
    ) -> None:
        """Handle incoming message from game."""

        if command == "context":
            if self._on_context:
                await self._on_context(
                    session.game_id,
                    data.get("message", ""),
                    data.get("state", {}),
                    data.get("silent", False),
                )

        elif command == "actions/register":
            for action in data.get("actions", []):
                session.actions[action["name"]] = action
            logger.debug(f"Registered actions: {list(session.actions.keys())}")

        elif command == "actions/unregister":
            for name in data.get("actions", []):
                session.actions.pop(name, None)

        elif command == "actions/force":
            # Forward to AI for decision
            if self._on_context:
                actions = data.get("actions", [])
                message = data.get("message", "")
                await self._on_context(
                    session.game_id,
                    f"[ACTION REQUIRED] {message} Options: {', '.join(actions)}",
                    {"available_actions": actions},
                    False,
                )

        elif command == "actions/result":
            if self._on_action_result:
                await self._on_action_result(
                    session.game_id,
                    data.get("id", ""),
                    data.get("success", False),
                    data.get("message", ""),
                )

        elif command == "query/response":
            if self._on_query_response:
                await self._on_query_response(
                    session.game_id,
                    data.get("id", ""),
                    data.get("answer", ""),
                )

    # Server -> Game commands

    async def send_action(
        self,
        game_id: str,
        action_name: str,
        params: Optional[dict[str, Any]] = None,
    ) -> str:
        """Send action to game. Returns action ID."""
        session = self._sessions.get(game_id)
        if not session:
            raise ValueError(f"Game not found: {game_id}")

        action_id = str(uuid.uuid4())[:8]

        await session.ws.send(json.dumps({
            "command": "action",
            "data": {
                "id": action_id,
                "name": action_name,
                "params": params or {},
            }
        }))

        return action_id

    async def send_query(self, game_id: str, question: str) -> str:
        """Send query to game. Returns query ID."""
        session = self._sessions.get(game_id)
        if not session:
            raise ValueError(f"Game not found: {game_id}")

        query_id = str(uuid.uuid4())[:8]

        await session.ws.send(json.dumps({
            "command": "query",
            "data": {
                "id": query_id,
                "question": question,
            }
        }))

        return query_id

    async def send_speak(
        self,
        game_id: str,
        message: str,
        emotion: Optional[str] = None,
    ) -> None:
        """Send speak event to game."""
        session = self._sessions.get(game_id)
        if not session:
            raise ValueError(f"Game not found: {game_id}")

        data = {"message": message}
        if emotion:
            data["emotion"] = emotion

        await session.ws.send(json.dumps({
            "command": "speak",
            "data": data,
        }))

    async def broadcast_speak(self, message: str, emotion: Optional[str] = None) -> None:
        """Send speak to all connected games."""
        for game_id in self._sessions:
            await self.send_speak(game_id, message, emotion)

    # Decorators

    def on_connect(self, handler):
        """Decorator for connection handler."""
        self._on_connect = handler
        return handler

    def on_disconnect(self, handler):
        """Decorator for disconnection handler."""
        self._on_disconnect = handler
        return handler

    def on_context(self, handler):
        """Decorator for context handler."""
        self._on_context = handler
        return handler

    def on_action_result(self, handler):
        """Decorator for action result handler."""
        self._on_action_result = handler
        return handler

    def on_query_response(self, handler):
        """Decorator for query response handler."""
        self._on_query_response = handler
        return handler
