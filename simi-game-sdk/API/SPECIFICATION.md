# Simi Game SDK - API Specification

## Protocol Overview

Communication uses **plaintext WebSocket** with JSON messages.

### Connection

Default WebSocket URL: `ws://localhost:8080/game`

Games should allow configurable server URL.

## Message Format

### Client → Server (Game → Simi)

```json
{
  "command": "string",
  "game": "string",
  "data": { }
}
```

### Server → Client (Simi → Game)

```json
{
  "command": "string",
  "data": { }
}
```

---

## Commands: Game → Simi

### 1. startup

Initialize connection and register the game.

```json
{
  "command": "startup",
  "game": "my-game",
  "data": {
    "name": "My Game",
    "version": "1.0.0",
    "capabilities": ["actions", "context", "vision"]
  }
}
```

### 2. context

Send game state or events to Simi.

```json
{
  "command": "context",
  "game": "my-game",
  "data": {
    "message": "Player drew a card. Current hand: Ace of Spades, King of Hearts.",
    "silent": false,
    "state": {
      "turn": 5,
      "player_health": 100,
      "enemy_health": 75
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| message | string | Text description of game state |
| silent | bool | If true, Simi won't speak about this |
| state | object | Optional structured state data |

### 3. actions/register

Register available actions Simi can take.

```json
{
  "command": "actions/register",
  "game": "my-game",
  "data": {
    "actions": [
      {
        "name": "play_card",
        "description": "Play a card from your hand",
        "schema": {
          "type": "object",
          "properties": {
            "card_index": {
              "type": "integer",
              "description": "Index of card in hand (0-based)"
            },
            "target": {
              "type": "string",
              "enum": ["player", "enemy"],
              "description": "Target of the card"
            }
          },
          "required": ["card_index"]
        }
      },
      {
        "name": "end_turn",
        "description": "End your turn and let the opponent play"
      }
    ]
  }
}
```

### 4. actions/unregister

Remove previously registered actions.

```json
{
  "command": "actions/unregister",
  "game": "my-game",
  "data": {
    "actions": ["play_card"]
  }
}
```

### 5. actions/force

Force Simi to choose from specific actions.

```json
{
  "command": "actions/force",
  "game": "my-game",
  "data": {
    "actions": ["play_card", "end_turn"],
    "message": "It's your turn! Play a card or end your turn.",
    "timeout_ms": 30000,
    "priority": "high"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| actions | string[] | Action names to choose from |
| message | string | Context for the decision |
| timeout_ms | int | Timeout in milliseconds (optional) |
| priority | string | "low", "normal", "high" |

### 6. actions/result

Report the result of an action execution.

```json
{
  "command": "actions/result",
  "game": "my-game",
  "data": {
    "id": "action-uuid",
    "success": true,
    "message": "Card played successfully! Dealt 5 damage."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| id | string | Action ID from the action command |
| success | bool | Whether the action succeeded |
| message | string | Result description |

---

## Commands: Simi → Game

### 1. action

Simi wants to execute an action.

```json
{
  "command": "action",
  "data": {
    "id": "action-uuid",
    "name": "play_card",
    "params": {
      "card_index": 0,
      "target": "enemy"
    }
  }
}
```

The game should:
1. Validate parameters against schema
2. Send `actions/result` with `success: false` if invalid
3. Execute the action
4. Send `actions/result` with outcome

### 2. query

Simi asks for information.

```json
{
  "command": "query",
  "data": {
    "id": "query-uuid",
    "question": "What cards are in my hand?"
  }
}
```

Respond with:

```json
{
  "command": "query/response",
  "game": "my-game",
  "data": {
    "id": "query-uuid",
    "answer": "You have: Ace of Spades, King of Hearts, 7 of Diamonds"
  }
}
```

### 3. speak

Simi wants to say something (for TTS/chat display).

```json
{
  "command": "speak",
  "data": {
    "message": "Hmm, I'll play this card!",
    "emotion": "thinking"
  }
}
```

---

## Action Schemas

Use JSON Schema subset for action parameters.

### Supported Keywords

- `type`: "string", "integer", "number", "boolean", "object", "array"
- `properties`: Object properties
- `required`: Required property names
- `enum`: Allowed values
- `description`: Human-readable description
- `minimum`, `maximum`: Number bounds
- `minLength`, `maxLength`: String length bounds
- `items`: Array item schema

### Not Supported

- `$ref`, `$defs`
- `anyOf`, `oneOf`, `allOf`
- `if/then/else`
- `patternProperties`
- Most format validations

---

## Best Practices

1. **Clear Descriptions**: Write action descriptions as if explaining to a person
2. **Atomic Actions**: Each action should do one thing
3. **Immediate Results**: Send action results quickly
4. **Context Updates**: Keep Simi informed of game state changes
5. **Error Handling**: Always respond to actions, even on failure

---

## Example Flow: Card Game

```
Game: startup (register game)
Game: context ("Game started. You go first.")
Game: actions/register (play_card, end_turn, draw_card)
Game: actions/force (play_card, end_turn, draw_card)

Simi: action (draw_card)
Game: actions/result (success, "Drew: Queen of Hearts")
Game: context ("Your hand: Ace, King, Queen of Hearts")
Game: actions/force (play_card, end_turn)

Simi: action (play_card, {card_index: 2, target: "enemy"})
Game: actions/result (success, "Dealt 12 damage!")
Game: context ("Enemy health: 88. Your turn continues.")
Game: actions/force (play_card, end_turn)

Simi: action (end_turn)
Game: actions/result (success)
Game: actions/unregister (play_card, draw_card, end_turn)
Game: context ("Enemy's turn...")
```
