# Fracture Server

Node.js game server for Fracture. Handles all authoritative game state: combat, movement, inventory, persistence, and AI.

## Requirements

- Node.js 18+
- pnpm

## Dependencies

- **Socket.IO 4** — WebSocket transport (105 message types)
- **better-sqlite3** — Player persistence (characters, inventory, achievements, progression)
- **Venice AI SDK** — NPC dialogue generation (llama-3.3-70b)
- **Fish Audio** — TTS voice synthesis for narration
- **pino** — Structured logging

## Configuration

Server settings are in `config.json` (player capacity, world count, port). AI keys are loaded from environment variables — see `../.env.example`.

## Build & Run

```bash
pnpm run build:server     # TypeScript compilation
node dist/server/ts/main.js   # Start on port 8000
pnpm run watch:server     # Dev mode with auto-rebuild
```

## Architecture

The server is organized into focused modules following SRP:

| Module | Responsibility |
|--------|---------------|
| `combat/` | AggroPolicy, CombatTracker, CombatSystem, kill streaks, nemesis |
| `player/` | MessageRouter, handler modules (one per game system) |
| `world/` | SpatialManager, SpawnManager, GameLoop |
| `storage/` | SQLite persistence layer |
| `ai/` | Venice AI integration, narration, TTS |
| `party/` | PartyService (invite, XP sharing, proximity) |
| `inventory/` | Inventory management and serialization |
| `zones/` | ZoneManager (boundaries, bonuses, level warnings) |

See [ARCHITECTURE_SRP.md](../ARCHITECTURE_SRP.md) for the full decomposition story.

## Tests

```bash
pnpm test                 # 42 test files, 2,229 tests
pnpm test:coverage        # v8 coverage report
```

## Monitoring

`GET /status` returns player population as JSON.
