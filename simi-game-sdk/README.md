# Simi Game SDK

WebSocket-based API for integrating games with Simi AI.

> Inspired by [Neuro SDK](https://github.com/VedalAI/neuro-sdk)

## Overview

The Simi Game SDK enables AI-controlled gameplay by allowing games to:
- Send game state as text context
- Register available actions with schemas
- Receive AI decisions and execute them
- Support turn-based and hybrid gameplay

## Quick Start

```
Game                    Simi Server
  │                          │
  │───── startup ──────────>│
  │───── context ──────────>│
  │───── actions/register ─>│
  │                          │
  │<──── action ────────────│
  │───── actions/result ───>│
  │                          │
```

## SDKs

| Language | Directory | Status |
|----------|-----------|--------|
| Python | [Python/](./Python/) | Official |
| JavaScript | [JavaScript/](./JavaScript/) | Official |
| Unity (C#) | [Unity/](./Unity/) | Official |

## Best For

- Turn-based games (card games, puzzle, visual novels)
- Strategy games
- Text adventures
- Games with discrete actions

## Not Ideal For

- Real-time shooters (high APM requirements)
- Platformers (precise timing)
- RTS games (continuous micro-management)

## API Documentation

See [API/SPECIFICATION.md](./API/SPECIFICATION.md) for full protocol details.

## Testing

Use the [TestBot](./TestBot/) for local development without connecting to actual AI.

## License

MIT
