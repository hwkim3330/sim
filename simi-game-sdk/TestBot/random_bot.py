#!/usr/bin/env python3
"""
Random Test Bot for Simi Game SDK.

Mimics the Simi server with random action selection for testing.
Similar to Neuro SDK's "Randy" bot.

Usage:
    python random_bot.py --port 8080

The bot will:
1. Accept game connections
2. Log all context messages
3. Randomly select from available actions when forced
4. Respond to queries with placeholder text
"""

import asyncio
import json
import random
import argparse
import logging
from typing import Any, Optional
from datetime import datetime

try:
    import websockets
    from websockets.server import WebSocketServerProtocol, serve
except ImportError:
    print("Install websockets: pip install websockets")
    exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("RandomBot")


class RandomBot:
    """Test bot that randomly selects actions."""

    def __init__(self, port: int = 8080, delay_ms: int = 500):
        self.port = port
        self.delay_ms = delay_ms

        # Connected games
        self.games: dict[str, dict[str, Any]] = {}

        # Pending action forces
        self.pending_forces: dict[str, list[str]] = {}

    async def start(self):
        """Start the test server."""
        logger.info(f"Starting RandomBot on ws://localhost:{self.port}/game")
        logger.info("Waiting for game connections...")

        async with serve(self._handle_connection, "localhost", self.port):
            await asyncio.Future()  # Run forever

    async def _handle_connection(self, ws: WebSocketServerProtocol, path: str):
        """Handle game connection."""
        game_id: Optional[str] = None

        try:
            async for message in ws:
                data = json.loads(message)
                command = data.get("command")
                gid = data.get("game")
                payload = data.get("data", {})

                if command == "startup":
                    game_id = gid
                    self.games[game_id] = {
                        "ws": ws,
                        "name": payload.get("name", game_id),
                        "actions": {},
                    }
                    logger.info(f"Game connected: {payload.get('name')} ({game_id})")

                elif game_id:
                    await self._handle_message(game_id, ws, command, payload)

        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"Error: {e}")
        finally:
            if game_id:
                del self.games[game_id]
                self.pending_forces.pop(game_id, None)
                logger.info(f"Game disconnected: {game_id}")

    async def _handle_message(
        self,
        game_id: str,
        ws: WebSocketServerProtocol,
        command: str,
        data: dict[str, Any],
    ):
        """Handle incoming message."""
        game = self.games[game_id]

        if command == "context":
            message = data.get("message", "")
            silent = data.get("silent", False)
            state = data.get("state", {})

            if not silent:
                logger.info(f"[{game_id}] Context: {message[:100]}")
                if state:
                    logger.debug(f"[{game_id}] State: {state}")

        elif command == "actions/register":
            for action in data.get("actions", []):
                game["actions"][action["name"]] = action
                logger.info(f"[{game_id}] Registered: {action['name']}")

        elif command == "actions/unregister":
            for name in data.get("actions", []):
                game["actions"].pop(name, None)
                logger.info(f"[{game_id}] Unregistered: {name}")

        elif command == "actions/force":
            actions = data.get("actions", [])
            message = data.get("message", "")
            timeout = data.get("timeout_ms", 30000)

            logger.info(f"[{game_id}] Force: {actions}")
            logger.info(f"[{game_id}] Message: {message}")

            # Random delay
            await asyncio.sleep(self.delay_ms / 1000)

            # Random selection
            if actions:
                selected = random.choice(actions)
                action_def = game["actions"].get(selected, {})

                # Generate random params if schema exists
                params = self._generate_random_params(action_def.get("schema"))

                logger.info(f"[{game_id}] Selecting: {selected} {params}")

                await ws.send(json.dumps({
                    "command": "action",
                    "data": {
                        "id": f"rnd-{random.randint(1000, 9999)}",
                        "name": selected,
                        "params": params,
                    }
                }))

        elif command == "actions/result":
            success = data.get("success", False)
            message = data.get("message", "")
            status = "" if success else ""
            logger.info(f"[{game_id}] Result {status}: {message[:80]}")

    def _generate_random_params(self, schema: Optional[dict]) -> dict:
        """Generate random parameters based on schema."""
        if not schema:
            return {}

        params = {}
        properties = schema.get("properties", {})

        for name, prop in properties.items():
            prop_type = prop.get("type", "string")

            if "enum" in prop:
                params[name] = random.choice(prop["enum"])
            elif prop_type == "integer":
                min_val = prop.get("minimum", 0)
                max_val = prop.get("maximum", 10)
                params[name] = random.randint(min_val, max_val)
            elif prop_type == "number":
                min_val = prop.get("minimum", 0.0)
                max_val = prop.get("maximum", 1.0)
                params[name] = random.uniform(min_val, max_val)
            elif prop_type == "boolean":
                params[name] = random.choice([True, False])
            elif prop_type == "string":
                params[name] = f"random_{random.randint(1, 100)}"

        return params


def main():
    parser = argparse.ArgumentParser(description="Random Test Bot for Simi Game SDK")
    parser.add_argument("--port", "-p", type=int, default=8080, help="Server port")
    parser.add_argument("--delay", "-d", type=int, default=500, help="Response delay (ms)")
    args = parser.parse_args()

    bot = RandomBot(port=args.port, delay_ms=args.delay)

    try:
        asyncio.run(bot.start())
    except KeyboardInterrupt:
        logger.info("Shutting down...")


if __name__ == "__main__":
    main()
