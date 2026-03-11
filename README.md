# Fracture

**A multiplayer RPG built by modernizing a legacy HTML5 codebase — the same work I've done for 25 years, applied to a game instead of enterprise software.**

[Play it live](https://fracture.georgelarson.me) | [Architecture](./ARCHITECTURE_SRP.md) | [Systems analysis](./SYSTEMS_ANALYSIS.md) | [Roadmap](./ROADMAP.md)

---

## Why this project exists

I spent seven years as Director of Technology at a manufacturing company, where my job was taking aging systems — tangled codebases, zero tests, no documentation, tribal knowledge everywhere — and turning them into something maintainable, observable, and reliable.

Fracture is that same process, condensed into a project you can read, run, and play.

The starting point was [BrowserQuest](https://github.com/mozilla/BrowserQuest), Mozilla's 2012 HTML5 demo. A JavaScript prototype: no types, no tests, God-object classes, everything coupled to everything. I chose it because it mirrors what I walk into at every job — legacy code that works but can't scale, can't be safely changed, and has no safety net.

What you're looking at now is **250 TypeScript files**, **2,229 passing tests**, a real-time multiplayer game with AI-driven NPCs, zone-based combat, persistent player progression, and a production deployment behind nginx with SSL. The original codebase is still in there — every entity, every sprite, every tile — but the architecture around it is unrecognizable.

## The legacy modernization story

This is the same arc I've followed at Sony, at a national medical billing startup, and at a manufacturing company. It works on games and it works on enterprise software:

**1. Understand before changing.** Read every file. Map the dependency graph. Identify the blast radius. The original had circular dependencies, `var self = this` patterns, `as any` casts holding things together, and zero separation of concerns. You can't fix what you don't understand.

**2. Add a safety net first.** Before refactoring anything, write tests. 2,229 of them. That's what makes the rest possible. When I decomposed the Player God-object from 1,100 lines to 720, every extracted method was verified. When I rewrote the aggro system, policy tests caught edge cases I'd have shipped as bugs.

**3. Refactor incrementally.** No big rewrites. Extract a module, test it, ship it. The MessageRouter was one change. Each handler module was one change. The CombatTracker was one change. At every step the game kept running.

**4. Make the architecture earn its keep.** Every abstraction exists because it solved a real problem. The SpatialManager exists because the aggro tick was O(n\*m) and needed spatial partitioning. The AggroPolicy exists because safe zones, density caps, and level scaling were scattered across three files. The EventBus exists because mob death needed to notify five decoupled systems.

**5. Ship it.** The game is live. It's behind nginx with SSL. It handles concurrent players. It has been through a full security audit. It's not a prototype — it's a deployed, maintained product.

## What I built on top of the legacy code

### Systems architecture

Decomposed an 1,100-line God-object Player class into focused modules using SRP. Introduced a MessageRouter for declarative message dispatch, handler modules for each game system, and a CombatTracker singleton that replaced scattered aggro state. The server now has clear boundaries: combat, inventory, party, progression, zones, AI, persistence — each in its own module with its own tests.

```
┌─────────────────────────────────────────────────────────┐
│  Client (25k LOC TypeScript)                            │
│  HTML5 Canvas renderer, input handling, UI panels       │
├─────────────────────────────────────────────────────────┤
│  Socket.IO (WebSocket transport, 105 message types)     │
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
│  Game types, zone data, skills, items, events           │
└─────────────────────────────────────────────────────────┘
```

### AI integration

NPCs generate contextual dialogue through Venice AI (llama-3.3-70b). A narrator system provides voice-synthesized commentary via Fish Audio TTS. Mobs have ambient "thought bubbles" generated per-tick for nearby players. The AI layer is fully decoupled — the game runs fine without API keys, the AI just adds flavor.

### Zone-aware combat

Seven progression zones from village (safe) to boss arena. An AggroPolicy engine evaluates mob aggro decisions based on zone boundaries, transition gradients, level scaling, and density caps — all pure functions, all unit-tested. Six roaming zone bosses with dynamic difficulty scaling. A nemesis system where mobs that kill players power up and track grudges.

### Progression depth

50-level XP curve with four difficulty tiers. Ascension system (prestige resets). Equipment sets with bonuses. Legendary boss drops with unique effects (lifesteal, damage reflection, gold multiplier). Four combat skills with cooldowns. Fracture Rifts — procedurally modified endgame dungeon runs with 13 stacking modifiers and leaderboards. Daily rewards, achievements, and titles.

### Multiplayer infrastructure

Socket.IO WebSocket transport with 105 message types. Spatial partitioning for zone-based broadcasting — mobs only scan players in adjacent groups, not all players globally. Party system with proximity-based XP sharing. Per-message-type rate limiting. Spawn protection. Anti-exploit validation. SQLite persistence for all player state.

## Test suite

```
42 test files | 2,229 tests | 0 failures
```

| Module | Coverage |
|--------|----------|
| Party, Shop, Zones, Events | 100% |
| Rifts | 98% |
| Combat | 91% |
| Utils | 88% |
| Storage | 82% |
| Player handlers | 71% |
| Items | 64% |

Vitest with v8 coverage. Storage tests use in-memory SQLite. Coverage thresholds enforced in CI.

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Client** | HTML5 Canvas, TypeScript 5.8, Webpack 5 |
| **Server** | Node.js, TypeScript 5.8, Socket.IO 4 |
| **Database** | SQLite (better-sqlite3) |
| **AI** | Venice AI SDK (llama-3.3-70b), Fish Audio TTS |
| **Testing** | Vitest 4, v8 coverage |
| **Production** | nginx, Let's Encrypt SSL |
| **Package manager** | pnpm |

## Running locally

```bash
git clone https://github.com/georgeglarson/Fracture.git
cd Fracture
pnpm install

# Optional: AI features (game works without these)
cp .env.example .env
# Add VENICE_API_KEY and FISH_AUDIO_API_KEY

# Build and run
pnpm run build:server && pnpm run build:client
node dist/server/ts/main.js

# Or use dev mode (auto-rebuild)
pnpm run dev

# Tests
pnpm test
pnpm test:coverage
```

Client connects to `localhost:8000` by default. For production, configure `client/config/config.prod.json`.

## Project structure

```
Fracture/
├── client/ts/           # Game client (95 files)
│   ├── entity/          # Sprites, animation, characters
│   ├── handlers/        # Server event handlers
│   ├── network/         # Socket.IO client, message dispatch
│   ├── renderer/        # Canvas rendering, camera, particles
│   └── ui/              # HUD, inventory, shop, achievement panels
├── server/ts/           # Game server (128 files)
│   ├── ai/              # Venice AI, narration, TTS
│   ├── combat/          # Aggro policy, combat tracker, kill streaks, nemesis
│   ├── player/          # MessageRouter + handler modules
│   ├── storage/         # SQLite persistence
│   ├── world/           # Spatial manager, spawn manager, game loop
│   └── __tests__/       # Test suite (42 files)
├── shared/ts/           # Shared types (27 files)
│   ├── zones/           # Zone boundaries and bonuses
│   ├── skills/          # Skill definitions
│   ├── items/           # Item types, legendaries, rarity
│   └── events/          # Typed event bus
└── specs/               # Feature specifications
```

## What this demonstrates

- **Legacy modernization** — Taking a real codebase from 2012 and systematically improving it without rewriting from scratch
- **Systems design** — Combat, inventory, progression, zones, AI, persistence, real-time networking — integrated and tested
- **AI-augmented development** — Built with Claude as a development partner, demonstrating what one engineer can ship with AI-augmented workflow
- **Testing discipline** — 2,229 tests, coverage thresholds enforced, tests written before refactors
- **Production operations** — SSL, reverse proxy, rate limiting, anti-exploit guards, persistence, deployed and running

## Credits

Originally based on [BrowserQuest](https://github.com/mozilla/BrowserQuest) by [Little Workshop](http://www.littleworkshop.fr) (Franck & Guillaume Lecollinet). The original was a 2012 HTML5 technology demo by Mozilla. Fracture is a ground-up modernization — new architecture, new game systems, new AI integration — on top of the original sprite work and tile map.

## License

Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.

---

**George Larson** — Director of Technology, 25+ years in software engineering, infrastructure, and manufacturing systems.

[georgelarson.me](https://georgelarson.me) | [GitHub](https://github.com/georgeglarson) | [LinkedIn](https://www.linkedin.com/in/georgelarson/) | [Resume](https://georgelarson.me/resume.html)
