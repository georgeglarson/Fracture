# Fracture

A multiplayer action RPG built with TypeScript, HTML5 Canvas, and AI-powered NPCs. Play it live at **[fracture.georgelarson.me](https://fracture.georgelarson.me)**.

Originally forked from BrowserQuest (Little Workshop, 2012) and its TypeScript port, Fracture has been rebuilt from the ground up into a modern, fully-tested multiplayer RPG with AI integration, endgame systems, and production-grade architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client (25k LOC TypeScript)                            │
│  HTML5 Canvas renderer, input handling, UI controllers  │
│  Webpack build, sprite animation system                 │
├─────────────────────────────────────────────────────────┤
│  Socket.IO (WebSocket transport)                        │
├─────────────────────────────────────────────────────────┤
│  Server (21k LOC TypeScript)                            │
│  ┌──────────┬──────────┬──────────┬──────────────────┐  │
│  │ Combat   │ Rifts    │ Party    │ Progression      │  │
│  │ System   │ Manager  │ Service  │ Service          │  │
│  ├──────────┼──────────┼──────────┼──────────────────┤  │
│  │ Entity   │ Zone     │ Shop     │ Achievement      │  │
│  │ Manager  │ Manager  │ Service  │ Service          │  │
│  ├──────────┴──────────┴──────────┴──────────────────┤  │
│  │ Storage Layer (better-sqlite3)                    │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ Venice AI SDK (llama-3.3-70b) + Fish Audio TTS   │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Shared (4k LOC TypeScript)                             │
│  Game types, equipment stats, zone definitions,         │
│  event bus, achievement definitions, skill data         │
└─────────────────────────────────────────────────────────┘
```

## Game Systems

**Combat** -- Real-time melee combat with Chebyshev distance calculations, mob aggro/hate tracking, critical hits, and equipment set bonuses. Mobs use a hate-ranked targeting system with stun and phase immunity mechanics.

**Fracture Rifts** -- Endgame challenge mode with procedurally modified dungeon floors. Modifiers stack multiplicatively on mob stats and player abilities. Floor progression, reward scaling, and persistent leaderboards.

**Nemesis System** -- Mobs that kill players power up and become named nemeses. Revenge kills grant multiplied rewards. Nemesis data persists across sessions.

**Progression** -- Tiered exponential XP curve across 50 levels with 4 difficulty tiers. Ascension system resets level for permanent stat bonuses. Session efficiency tracking with diminishing returns and rested XP accumulation.

**AI NPCs** -- Venice AI SDK integration for dynamic NPC dialogue, quest generation, and world narration. Fish Audio TTS for voice synthesis. Companion system with personality-driven responses.

**Party System** -- Real-time party formation with invite/accept/decline/kick/leave. Shared XP with proximity-based distribution and party size bonuses. Position and HP tracking across party members.

**Economy** -- Per-NPC shop inventories with limited stock tracking. Tiered item generation with rarity rolls, bonus properties, and zone-specific drop modifiers. Equipment comparison and set collection.

## Test Suite

```
40 test files | 2,140 tests | 0 failures
```

Coverage by server module:

| Module | Statements | Branches | Functions |
|--------|-----------|----------|-----------|
| Combat | 91% | 78% | 94% |
| Rifts | 98% | 93% | 100% |
| Party | 100% | 96% | 100% |
| Shop | 100% | 100% | 100% |
| Storage | 82% | 88% | 92% |
| Zones | 100% | 100% | 100% |
| Events | 100% | 100% | 100% |
| Player Handlers | 71% | 68% | 61% |
| Items | 64% | 63% | 54% |
| Utils | 88% | 75% | 50% |

Tests are written in Vitest with v8 coverage. Storage tests use in-memory SQLite for real SQL execution without filesystem access.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.8 |
| Client | HTML5 Canvas, Webpack 5, jQuery |
| Server | Node.js, Express, Socket.IO 4 |
| Database | better-sqlite3 |
| AI | Venice AI SDK, Fish Audio TTS |
| Testing | Vitest 4, v8 coverage |
| CI | GitHub Actions (Node 20.x, 22.x) |

## Development

```bash
pnpm install
pnpm run dev          # concurrent client + server watch mode
pnpm test             # run test suite
pnpm test:coverage    # run with coverage report
pnpm test:watch       # watch mode
```

### Build & Deploy

```bash
pnpm run build:client   # webpack production build
pnpm run build:server   # tsc compilation
pnpm start              # start server on port 8000
```

### Project Structure

```
server/ts/
  combat/         # CombatSystem, CombatTracker, KillStreak, Nemesis
  entities/       # EntityManager (lifecycle, spatial groups)
  equipment/      # EquipmentManager (slots, set bonuses, stats)
  inventory/      # Inventory (20-slot, stacking, serialization)
  items/          # ItemGenerator (rarity, bonuses, loot tables)
  party/          # PartyService (invite/accept/leave/kick, XP sharing)
  player/         # Handler modules (achievement, equipment, inventory,
                  #   party, persistence, progression, rift, shop, skill,
                  #   venice, zone) + MessageRouter
  rifts/          # RiftManager (floors, modifiers, leaderboards)
  shop/           # ShopService (NPC inventories, pricing, stock)
  storage/        # SQLite persistence (characters, inventory, achievements)
  zones/          # ZoneManager (boundaries, level warnings, bonuses)
  ai/             # Venice AI integration (NPC dialogue, quests, narration)

client/ts/
  controllers/    # AchievementController, ProgressionController
  entity/         # Entity hierarchy (Character > Player/Mob/NPC)
  handlers/       # Server message handlers (combat, inventory, party, etc.)
  network/        # GameClient (Socket.IO), message dispatch
  player/         # MovementController, CombatController
  quest/          # QuestController
  ui/             # Achievement UI, context menus, player inspect

shared/ts/
  events/         # EventBus (typed pub/sub, singleton factories)
  equipment/      # Equipment stat definitions
  zones/          # Zone boundary and bonus data
  skills/         # Skill definitions and cooldowns
  achievements.ts # Achievement definitions and progress tracking
  gametypes.ts    # Entity types, message types, constants
```

## Credits

Original game by [Little Workshop](http://www.littleworkshop.fr) (Franck & Guillaume Lecollinet).
TypeScript port by [Matthew Javelet](https://github.com/0xMatt).
Modernized and expanded by [George Larson](https://georgelarson.me).

## License

Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0. See [LICENSE](LICENSE) for details.
