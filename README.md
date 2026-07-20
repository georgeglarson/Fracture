# Fracture

**A multiplayer RPG built by modernizing a legacy HTML5 codebase. The same kind of work I've done for 25 years, applied to a game instead of enterprise software.**

[Play it live](https://fracture.georgelarson.me) | [Architecture](./docs/ARCHITECTURE_SRP.md) | [Systems analysis](./docs/SYSTEMS_ANALYSIS.md) | [Roadmap](./docs/ROADMAP.md)

---

## Why this project exists

Most of my career has been taking old systems and making them maintainable. Fracture is that process, condensed into a project you can read, run, and play.

The starting point was [BrowserQuest](https://github.com/mozilla/BrowserQuest), Mozilla's 2012 HTML5 demo. A vertical slice that proved HTML5 could do real-time multiplayer, but was never meant to run in production. No types, no tests, no persistence beyond localStorage, no security, no observability, no separation of concerns. I picked it because it's a good stand-in for what legacy modernization actually looks like: a prototype that worked once and now needs real supporting systems to scale.

What you're looking at now is **~217 TypeScript source files** (283 including tests), **3,198 passing tests**, a real-time multiplayer game with zone-based combat, persistent player progression, and a production deployment behind nginx with SSL. Two more production systems ran on top of it and have since been retired: an AI integration layer (Venice-powered NPC dialogue, TTS narration, mob thought bubbles) and a self-hosted observability stack (SigNoz, Grafana, ClickHouse). Both stories are below. The original codebase is still in there (every entity, every sprite, every tile) but the architecture around it is unrecognizable.

## The legacy modernization story

This is the same approach that works on enterprise software. It works on games too:

**1. Understand before changing.** Read every file. Map the dependency graph. Identify the blast radius. The original had circular dependencies, `var self = this` patterns, `as any` casts holding things together, and zero separation of concerns. You can't fix what you don't understand.

**2. Add a safety net first.** Before refactoring anything, write tests. 3,198 of them. That's what makes the rest possible. When I extracted the combat system, every interaction was verified. When I built the aggro policy engine, tests caught edge cases I'd have shipped as bugs.

**3. Refactor incrementally.** No big rewrites. Extract a module, test it, ship it. The MessageRouter was one change. Each handler module (auth, combat, loot, inventory, equipment, skills, party, shop) was one change. The CombatTracker was one change. At every step the game kept running.

**4. Make the architecture earn its keep.** Every abstraction exists because it solved a real problem. The SpatialManager exists because the aggro tick was O(n\*m) and needed spatial partitioning. The AggroPolicy exists because safe zones, density caps, and level scaling were scattered across three files. The EventBus exists because mob death needed to notify five decoupled systems.

**5. Add observability.** You can't maintain what you can't see. Structured logging (Pino) and distributed tracing (OpenTelemetry) shipped to a self-hosted SigNoz/Grafana stack backed by ClickHouse, so every request, every save, every AI call was traceable end-to-end. The same stack you'd wire up for a production microservice, applied to a game server. It ran in production until May 2026, when the ops cost stopped making sense for a demo site's traffic. The instrumentation is still in the code and reactivates with one env var.

**6. Ship it.** The game is live, behind nginx with SSL. It handles concurrent players. It's been through a full security audit. It's deployed and maintained.

## What I built on top of the legacy code

### Systems architecture

Built the supporting systems the original prototype never had. Introduced a MessageRouter as a pure dispatcher with 13 dedicated handler modules (auth, combat, loot, inventory, equipment, skills, party, shop, achievements, venice, progression, persistence, zones), each with its own tests. A CombatTracker singleton replaced scattered aggro state. The server has clear boundaries now: combat, inventory, party, progression, zones, AI, persistence, each in its own module with its own tests.

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
│  │ AI Integration: Venice SDK + Fish TTS (dormant)   │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Observability (stack retired May 2026, code intact)    │
│  Pino → OTel Collector → ClickHouse ← SigNoz / Grafana │
│  Structured logs, distributed traces, dashboards        │
├─────────────────────────────────────────────────────────┤
│  Shared (4k LOC TypeScript)                             │
│  Game types, zone data, skills, items, events           │
└─────────────────────────────────────────────────────────┘
```

### AI integration

NPCs generated contextual dialogue through Venice AI (llama-3.3-70b). A narrator system provided voice-synthesized commentary via Fish Audio TTS. Mobs had ambient "thought bubbles" generated per-tick for nearby players. The AI layer was built fully decoupled, with a circuit breaker and static fallbacks, and that decision paid off: when the Venice account was cancelled in June 2026, the game kept running on its fallback content (template quests, mad-libs thought bubbles, stat-based newspaper headlines) without a code change. It runs on those fallbacks today and is fully playable. Re-enabling AI takes one env var and any OpenAI-compatible provider. There is no plan to re-enable it.

### Zone-aware combat

Seven progression zones from village (safe) to boss arena. An AggroPolicy engine evaluates mob aggro decisions based on zone boundaries, transition gradients, level scaling, and density caps, all as pure functions with unit tests. Six roaming zone bosses with dynamic difficulty scaling. A nemesis system where mobs that kill players power up and track grudges.

### Progression depth

50-level XP curve with four difficulty tiers. Ascension system (prestige resets). Equipment sets with bonuses. Legendary boss drops with unique effects (lifesteal, damage reflection, gold multiplier). Four combat skills with cooldowns. Fracture Rifts: procedurally modified endgame dungeon runs with 13 stacking modifiers and leaderboards. Daily rewards, achievements, and titles.

### Multiplayer infrastructure

Socket.IO WebSocket transport with 105 message types. Spatial partitioning for zone-based broadcasting so mobs only scan players in adjacent groups, not all players globally. Party system with proximity-based XP sharing. Per-message-type rate limiting. Spawn protection. Anti-exploit validation. SQLite persistence for all player state.

### Observability

Production-grade monitoring built with the same tools and patterns as commercial microservices, run in production, then retired when the economics stopped making sense:

**Structured logging.** Every `console.*` call (316 across 48 files) replaced with Pino structured logging. 50 modules emit JSON logs with typed context: player IDs, item kinds, damage values, zone names. Player-scoped child loggers automatically attach identity to every log line. Hot-path logging (aggro ticks, movement) uses `trace` level that Pino skips entirely unless explicitly enabled.

**Distributed tracing.** OpenTelemetry SDK with manual span instrumentation on the paths that matter: message routing (`player.message.{type}`), persistence operations (`storage.saveCharacter`, `storage.loadPlayerState`), aggro ticks (`game.aggro_tick` with mob count attributes), and external AI calls (`ai.venice`, `ai.tts` with latency tracking). HTTP auto-instrumentation covers Socket.IO transport. Production sampling is configurable via `OTEL_TRACES_SAMPLER_ARG`; the default keeps every trace (1.0).

**Log-trace correlation.** `pino-opentelemetry-transport` injects `trace_id` and `span_id` into every log line and ships logs via OTLP to the same collector that receives traces. With the stack running, clicking a trace in SigNoz showed every log line from that request.

**Self-hosted dashboards (retired May 2026).** Two dashboard layers ran on the same VPS via Docker Compose, both reading from one ClickHouse backend capped at 2GB:

- **SigNoz** (`localhost:3301`) handled internal observability: distributed trace explorer, log search with trace correlation, span-level latency analysis. This was the tool for debugging production issues.
- **Grafana** (`localhost:3302`) served public portfolio dashboards: server operations metrics (player count, mob count, tick rate), AI call latency and success rates, with anonymous read-only access for embedding in portfolio pages.

The stack did its job. It also cost more in ops attention than a demo site's traffic justified, so it was retired and the deploy configs no longer ship with the repo. The instrumentation above is untouched: run the server with `NODE_ENV=production` and `OTEL_EXPORTER_OTLP_ENDPOINT` pointed at any OTel collector, and the traces and correlated logs come back.

**Venice AI resilience.** Circuit breaker (opens after 5 failures, 10s recovery), retry with backoff for transient errors, error classification (timeout, auth, rate_limit, server_error, network), latency histogram, and per-call metrics. Survives API outages without impacting gameplay. That claim stopped being theoretical in June 2026, when the Venice account was cancelled and the game simply kept running on its static fallbacks.

**Debug tools.** The game server runs a localhost-only debug WebSocket on port 8001 (`NO_DEBUG=1` to disable). Two tools connect to it:

- **Debug CLI** (`tools/debug-cli.js`) — Non-interactive diagnostic probe for AI-assisted troubleshooting. Reports player/mob state, aggro links, server stats, structured logs, automated health checks (10 anomaly detectors), and Venice AI metrics with live connectivity tests.
- **TUI** (`tools/tui.js`) — Live terminal dashboard built with blessed. Renders a spatial map with entity indicators, an entity inspector, aggro link visualization, performance stats, and a real-time log stream. Navigate with arrow keys/hjkl, Tab to cycle panels.

```
Observability flow, as it ran until May 2026:

Game Server ──OTLP HTTP──→ OTel Collector ──→ ClickHouse
  │ Pino (JSON logs)            │                  ↑     ↑
  │ OTel SDK (traces)           │            SigNoz UI   Grafana
  │                             │           (internal)  (public)
  ├──WebSocket :8001──→ TUI / Debug CLI
  └─────────────────────────────┘

The collector, ClickHouse, SigNoz, and Grafana are retired; their deploy
configs no longer ship. The WebSocket debug feed on :8001 is still live.
```

## Test suite

```
67 test files | 3,198 tests | 0 failures
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
| **AI** | Venice AI SDK (llama-3.3-70b), Fish Audio TTS (dormant; static fallbacks active) |
| **Observability** | OpenTelemetry + Pino in code; SigNoz/Grafana/ClickHouse stack retired May 2026 |
| **Testing** | Vitest 4, v8 coverage |
| **Production** | nginx, Let's Encrypt SSL, systemd |
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
pnpm start                   # or: node dist/server/ts/main.js

# Or use dev mode (auto-rebuild)
pnpm run dev

# Tests
pnpm test
pnpm test:coverage
pnpm test:ui                 # Vitest browser UI

# Live terminal dashboard (requires running server)
pnpm run tui

# Debug CLI (requires running server)
pnpm run debug health        # Anomaly detection
pnpm run debug players       # Connected players
pnpm run debug venice health # Venice AI connectivity test
pnpm run debug watch 10      # Stream state for 10s

# Server management
pnpm run restart             # Kill + restart server
pnpm run stop                # Clean shutdown
```

Client connects to `localhost:8000` by default. Debug WebSocket runs on `localhost:8001` (disable with `NO_DEBUG=1`). For production, configure `client/config/config.prod.json`.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `production` enables JSON logs and production sampling (OTel export only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set) |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Pino log level: `trace`, `debug`, `info`, `warn`, `error` |
| `VENICE_API_KEY` | — | Venice AI SDK key for NPC dialogue and narration (unset in production; static fallbacks serve all AI content) |
| `VENICE_MODEL` | `llama-3.3-70b` | Venice model ID |
| `VENICE_TIMEOUT` | `5000` | Venice API timeout in ms |
| `FISH_AUDIO_API_KEY` | — | Fish Audio key for TTS voice synthesis |
| `CORS_ORIGINS` | — | Comma-separated allowed origins |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OTel Collector HTTP endpoint; trace/log export is disabled unless set |
| `NO_DEBUG` | — | Set to `1` to disable debug WebSocket server |

### Observability stack (retired)

A self-hosted stack (ClickHouse, Zookeeper, OTel Collector, SigNoz, Grafana) ran alongside the game until May 2026. It was retired because the ops cost didn't justify a demo site's traffic, and the `deploy/` configs for it no longer ship with the repo. The instrumentation is still in the codebase: run the server with `NODE_ENV=production` and `OTEL_EXPORTER_OTLP_ENDPOINT` pointed at any OTel collector, and the traces and correlated logs come back.

In dev mode (`NODE_ENV !== 'production'`), traces print to the console and logs use pino-pretty. No collector needed for local development.

## Project structure

```
Fracture/
├── client/ts/           # Game client (97 files)
│   ├── entity/          # Sprites, animation, characters
│   ├── handlers/        # Server event handlers
│   ├── network/         # Socket.IO client, message dispatch
│   ├── renderer/        # Canvas rendering, camera, particles
│   └── ui/              # HUD, inventory, shop, achievement panels
├── server/ts/           # Game server (156 files)
│   ├── tracing.ts       # OTel SDK bootstrap (imported first)
│   ├── ai/              # Venice AI, narration, TTS
│   ├── combat/          # Aggro policy, combat tracker, kill streaks, nemesis
│   ├── player/          # MessageRouter + 13 handler modules (auth, combat, loot, ...)
│   ├── storage/         # SQLite persistence (instrumented with spans)
│   ├── utils/logger.ts  # Pino structured logging + OTel transport
│   ├── world/           # Spatial manager, spawn manager, game loop
│   └── __tests__/       # Test suite (61 files)
├── shared/ts/           # Shared types (27 files)
│   ├── zones/           # Zone boundaries and bonuses
│   ├── skills/          # Skill definitions
│   ├── items/           # Item types, legendaries, rarity
│   └── events/          # Typed event bus
├── tools/               # Development utilities
│   ├── debug-cli.js     # Non-interactive debug probe (AI-assisted diagnostics)
│   └── tui.js           # Nethack-style live terminal dashboard
├── deploy/              # Deployment configs (systemd unit; observability stack configs no longer ship)
├── docs/                # Project documentation
│   ├── ARCHITECTURE_SRP.md
│   ├── ROADMAP.md
│   └── ...
└── specs/               # Feature specifications
```

## What this demonstrates

- **Legacy modernization.** Taking a real codebase from 2012 and systematically improving it without rewriting from scratch.
- **Systems design.** Combat, inventory, progression, zones, AI, persistence, real-time networking, all integrated and tested.
- **Observability engineering.** Structured logging, distributed tracing, and self-hosted monitoring wired end-to-end and run in production, then retired when the ops cost stopped making sense for a demo site. The OTel + Pino instrumentation remains and reactivates with one env var.
- **AI-augmented development.** Built with Claude as a development partner, showing what one engineer can ship with AI tooling.
- **Testing discipline.** 3,198 tests across 67 test files, coverage thresholds enforced, tests written before refactors.
- **Production operations.** SSL, reverse proxy, rate limiting, anti-exploit guards, systemd-managed, deployed and running.

## Credits

Originally based on [BrowserQuest](https://github.com/mozilla/BrowserQuest) by [Little Workshop](http://www.littleworkshop.fr) (Franck & Guillaume Lecollinet). The original was a 2012 HTML5 technology demo by Mozilla. Fracture is a ground-up modernization with new architecture, new game systems, and an AI integration layer on top of the original sprite work and tile map.

## License

Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.

---

**George Larson** | 25+ years in software engineering, infrastructure, and manufacturing systems.

[georgelarson.me](https://georgelarson.me) | [GitHub](https://github.com/georgeglarson) | [LinkedIn](https://www.linkedin.com/in/georgelarson/) | [Resume](https://georgelarson.me/resume.html)
