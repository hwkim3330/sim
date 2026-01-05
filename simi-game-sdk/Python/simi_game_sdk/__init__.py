"""
Simi Game SDK - Python Implementation

WebSocket-based SDK for integrating games with Simi AI.

Example:
    >>> from simi_game_sdk import SimiClient, Action
    >>>
    >>> client = SimiClient("my-game")
    >>> await client.connect()
    >>>
    >>> # Register actions
    >>> await client.register_actions([
    ...     Action("attack", "Attack the enemy", {"damage": {"type": "integer"}})
    ... ])
    >>>
    >>> # Handle incoming actions
    >>> @client.on_action
    ... async def handle_action(action_id, name, params):
    ...     if name == "attack":
    ...         result = do_attack(params["damage"])
    ...         await client.action_result(action_id, True, result)
"""

from simi_game_sdk.client import SimiClient
from simi_game_sdk.action import Action, ActionSchema
from simi_game_sdk.types import Priority, Capability

__version__ = "1.0.0"
__all__ = ["SimiClient", "Action", "ActionSchema", "Priority", "Capability"]
