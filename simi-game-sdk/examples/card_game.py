#!/usr/bin/env python3
"""
Example: Simple Card Game with Simi AI

A turn-based card game where Simi plays against a simple opponent.
Demonstrates the full Simi Game SDK usage.

Run with: python card_game.py
"""

import asyncio
import random
import sys
sys.path.insert(0, '../Python')

from simi_game_sdk import SimiClient, Action, ActionSchema, Priority
from simi_game_sdk.types import ActionRequest


class CardGame:
    """Simple card game logic."""

    def __init__(self):
        self.player_health = 100
        self.enemy_health = 100
        self.player_hand = []
        self.deck = []
        self.turn = 0
        self.game_over = False

    def setup(self):
        """Setup a new game."""
        # Create deck
        self.deck = [
            {"name": "Fireball", "damage": 15, "type": "attack"},
            {"name": "Lightning", "damage": 20, "type": "attack"},
            {"name": "Heal", "heal": 10, "type": "heal"},
            {"name": "Shield", "block": 15, "type": "defend"},
            {"name": "Poison", "damage": 8, "type": "attack"},
        ] * 4

        random.shuffle(self.deck)

        # Draw initial hand
        self.player_hand = [self.deck.pop() for _ in range(5)]
        self.turn = 1

    def draw_card(self) -> str:
        """Draw a card from deck."""
        if not self.deck:
            return "Deck is empty!"

        card = self.deck.pop()
        self.player_hand.append(card)
        return f"Drew: {card['name']}"

    def play_card(self, index: int) -> str:
        """Play a card from hand."""
        if index < 0 or index >= len(self.player_hand):
            return f"Invalid card index: {index}"

        card = self.player_hand.pop(index)

        if card["type"] == "attack":
            self.enemy_health -= card["damage"]
            result = f"Played {card['name']}! Dealt {card['damage']} damage!"
        elif card["type"] == "heal":
            self.player_health = min(100, self.player_health + card["heal"])
            result = f"Played {card['name']}! Healed {card['heal']} HP!"
        elif card["type"] == "defend":
            result = f"Played {card['name']}! Blocked {card['block']} damage!"
        else:
            result = f"Played {card['name']}!"

        self.check_game_over()
        return result

    def enemy_turn(self) -> str:
        """Enemy takes a turn."""
        damage = random.randint(5, 15)
        self.player_health -= damage
        self.check_game_over()
        return f"Enemy attacks for {damage} damage!"

    def check_game_over(self):
        """Check if game is over."""
        if self.enemy_health <= 0:
            self.game_over = True
        elif self.player_health <= 0:
            self.game_over = True

    def get_state(self) -> dict:
        """Get current game state."""
        return {
            "turn": self.turn,
            "player_health": self.player_health,
            "enemy_health": self.enemy_health,
            "cards_in_hand": len(self.player_hand),
            "cards_in_deck": len(self.deck),
        }

    def describe_hand(self) -> str:
        """Describe current hand."""
        cards = [f"{i}: {c['name']}" for i, c in enumerate(self.player_hand)]
        return "Your hand: " + ", ".join(cards)


async def main():
    """Run the card game with Simi."""
    game = CardGame()
    client = SimiClient(
        "card-game",
        server_url="ws://localhost:8080/game",
        name="Card Battle",
        version="1.0.0",
    )

    @client.on_action
    async def handle_action(request: ActionRequest):
        if request.name == "play_card":
            index = request.params.get("card_index", 0)
            result = game.play_card(int(index))
            await client.action_result(request.id, True, result)

            if not game.game_over:
                # Update context after playing
                await client.send_context(
                    f"{result}\n{game.describe_hand()}",
                    state=game.get_state(),
                )

        elif request.name == "draw_card":
            result = game.draw_card()
            await client.action_result(request.id, True, result)
            await client.send_context(
                f"{result}\n{game.describe_hand()}",
                state=game.get_state(),
            )

        elif request.name == "end_turn":
            game.turn += 1
            enemy_result = game.enemy_turn()
            await client.action_result(request.id, True, "Turn ended.")
            await client.send_context(
                f"{enemy_result}\nYour health: {game.player_health}",
                state=game.get_state(),
            )

    print("Connecting to Simi server...")
    try:
        await client.connect()
    except Exception as e:
        print(f"Connection failed: {e}")
        print("Make sure the server (or random_bot.py) is running!")
        return

    print("Connected! Starting game...")

    # Setup game
    game.setup()

    # Register actions
    await client.register_actions([
        Action.with_params(
            "play_card",
            "Play a card from your hand to attack, heal, or defend",
            params={
                "card_index": {
                    "type": "integer",
                    "description": "Index of the card in your hand (0-based)",
                    "minimum": 0,
                    "maximum": 10,
                }
            },
            required=["card_index"],
        ),
        Action.simple("draw_card", "Draw a card from the deck"),
        Action.simple("end_turn", "End your turn and let the enemy attack"),
    ])

    # Send initial context
    await client.send_context(
        f"Card Battle started! Turn 1.\n"
        f"Your health: {game.player_health}, Enemy health: {game.enemy_health}\n"
        f"{game.describe_hand()}",
        state=game.get_state(),
    )

    # Force first action
    await client.force_actions(
        ["play_card", "draw_card", "end_turn"],
        "It's your turn! Play a card, draw a card, or end your turn.",
        priority=Priority.HIGH,
    )

    print("Game started! Waiting for Simi's moves...")
    print("Press Ctrl+C to stop.\n")

    # Run message loop
    try:
        while not game.game_over:
            await client.run()
    except KeyboardInterrupt:
        print("\nGame interrupted.")

    # Game over
    if game.enemy_health <= 0:
        result = "Victory! You defeated the enemy!"
    elif game.player_health <= 0:
        result = "Defeat! The enemy won."
    else:
        result = "Game ended."

    await client.send_context(result, state=game.get_state())
    print(result)

    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
