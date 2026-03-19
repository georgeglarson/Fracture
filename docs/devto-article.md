---
title: I Took a 2012 Mozilla Demo and Turned It Into a Production MMO With AI
published: false
description: How a legacy modernization veteran used Claude as a development partner to transform BrowserQuest into Fracture — a real-time multiplayer RPG with AI-powered NPCs, distributed tracing, and 3,161 tests.
tags: ai, gamedev, typescript, legacy
cover_image:
---

In 2012, Mozilla and Little Workshop released [BrowserQuest](https://github.com/mozilla/BrowserQuest) — an HTML5 multiplayer demo that proved browsers could handle real-time games. It was a tech demo. No types. No tests. No persistence beyond `localStorage`. No separation of concerns. One massive `Player` class doing everything from combat to inventory to chat.

It served its purpose and was abandoned.

I picked it up and asked a simple question: **what would it take to turn this into something you'd actually ship?**

The answer is [Fracture](https://github.com/georgeglarson/Fracture). You can [play it live](https://fracture.georgelarson.me).

<!-- SCREENSHOT: gameplay
     Capture: A player in one of the populated zones (forest or desert work well)
     with at least one mob thought bubble visible and an NPC nearby.
     Ideal if the HUD shows level, HP, inventory — proof this is a real game, not a demo.
     Upload to dev.to and replace this comment with:
     ![Fracture gameplay — AI-powered thought bubbles and real-time combat](IMAGE_URL)
-->

## Why this project

I've spent 25 years modernizing legacy systems — manufacturing execution platforms, enterprise infrastructure, database tuning, security hardening. Python, Go, Rust, C#, TypeScript, Bash, Perl — whatever the system was written in, the work was the same: understand what exists, establish contracts, decompose responsibilities, add observability, write tests, and ship without breaking what already works.

At a certain point in your career, you stop proving you can write code and start proving you can *transform systems*. I wanted to demonstrate that the methodology I've applied to manufacturing automation and enterprise platforms translates directly to any domain — and that AI as a development partner changes the economics of what one engineer can ship.

Not "AI wrote my code." More like "AI let one engineer do what used to take a team."

A game is the perfect vehicle. It has real-time networking, state management, persistence, external API integrations, and enough complexity that architecture actually matters. And unlike yet another CRUD app, people can play it and immediately understand what it does.

## What I started with

BrowserQuest's server was a single JavaScript file ecosystem with:

- **No type safety** — everything was `any`, passed through string-keyed message arrays
- **No tests** — zero
- **No persistence** — die, refresh, start over
- **No observability** — `console.log` or nothing
- **God classes** — `Player` handled auth, combat, movement, inventory, chat, and serialization
- **No security** — client-trusted positions, no rate limiting, no input validation

It worked as a demo. It was not software you'd run in production.

## The methodology

This is the same playbook I've run on enterprise systems for two decades, just applied to a game server:

### 1. Type safety first

Before touching behavior, I migrated everything to TypeScript strict mode. Every `any` replaced. Every message format typed. This is the unsexy work that makes everything else possible — you can't refactor what you can't reason about.

```
Phase 1: Type Safety - Replace any types in message.ts
Phase 1: Type Safety - Replace any types in player.ts
Phase 1: Type Safety - Fix ws.ts, character.ts, map.ts
Phase 1: Type Safety - Add typed imports to world.ts
```

These were the first commits. No features. Just contracts.

### 2. Decompose by responsibility

The original `Player` class was 1,552 lines handling 13 different concerns. I extracted each into its own module:

| Module | Responsibility |
|--------|---------------|
| `combat/` | Aggro policy, combat tracker, kill streaks, nemesis system |
| `player/` | MessageRouter + 13 handler modules |
| `world/` | Spatial manager, spawn manager, game loop |
| `storage/` | SQLite persistence layer |
| `inventory/` | Item management and serialization |
| `zones/` | Zone boundaries, bonuses, level scaling |
| `party/` | Invite, XP sharing, proximity tracking |
| `rifts/` | Endgame dungeons with stacking modifiers |

Post-refactor, `Player` dropped to 630 lines. `Game` went from 2,627 to 1,966. Every module has one job.

### 3. Event-driven architecture

Systems communicate through a typed `EventBus`, not direct method calls. Combat doesn't know about achievements. The narrator doesn't know about inventory. They publish events; interested systems subscribe.

This is the same pattern you'd use in a microservice architecture, applied at the module level. It makes testing trivial — you can verify each system in isolation.

### 4. Test everything

The codebase has **3,161 tests across 65 test files** with zero failures. Coverage by module:

- Party, Shop, Zones, Events: **100%**
- Rifts: **98%**
- Combat: **91%**
- Storage: **82%**
- Player handlers: **71%**

Storage tests use in-memory SQLite — no mocks pretending to be a database. Coverage thresholds are enforced in CI. Tests run on Node 20 and 22.

I wrote tests *before* refactors, not after. When you're decomposing a class that handles 13 responsibilities, you need to know immediately when you break something.

### 5. Production-grade observability

This is where my enterprise background shows up most clearly. I replaced all 316 `console.log` calls across 48 files with Pino structured logging, then wired in OpenTelemetry distributed tracing:

```typescript
// Every message handler is traced
const span = tracer.startSpan(`player.message.${type}`);

// Every database call
const span = tracer.startSpan('storage.saveCharacter');

// Every AI call with latency tracking
const span = tracer.startSpan('ai.venice');
```

Logs and traces are correlated — every log line carries a `trace_id` and `span_id`. The whole stack ships to a self-hosted SigNoz instance backed by ClickHouse, with public Grafana dashboards for portfolio visitors.

This is the same OTel + Pino + SigNoz stack used in production microservices. I just applied it to a game server.

<!-- SCREENSHOT: grafana
     Capture: The Grafana dashboard at localhost:3302 (or fracture-grafana.georgelarson.me)
     showing server operation metrics — traces collected, request latency, etc.
     This is the "enterprise credibility" shot. Shows this isn't a toy.
     Upload to dev.to and replace this comment with:
     ![Fracture Grafana dashboard — production observability on a game server](IMAGE_URL)
-->

## Where AI changed the game

Claude was my development partner throughout this project. Here's what that actually means in practice:

**AI as force multiplier, not replacement.** I made every architectural decision. I chose SRP decomposition. I chose event-driven communication. I chose OpenTelemetry over custom metrics. AI didn't make those calls — 25 years of legacy modernization did. But AI let me *execute* those decisions at a pace that would've required a team.

**AI for the tedious but important work.** Migrating 316 console.log calls to structured logging with proper context? Writing 3,161 tests? Extracting 13 handler modules from a monolithic class? This is work that matters but takes forever when you're doing it alone. AI compressed weeks into days.

**AI-powered game features.** The AI integration isn't just in the development process — it's in the game itself:

- **NPC dialogue** — Every NPC generates contextual responses via Venice AI (llama-3.3-70b). The village priest talks about "the time before the sky broke." The guard asks where you came from. Conversations have memory.
- **Entity thoughts** — Mobs display visible AI-generated thought bubbles. Rats think about cheese. Skeletons scheme about revenge. 25% AI-generated, 75% template-based, refreshed on a 5-minute cycle.
- **Narrator system** — Zone-specific narrative voices describe events with unique vocabularies. Deaths are mourned. Achievements are celebrated. Voice synthesis via Fish Audio TTS.
- **Graceful degradation** — If Venice goes down, the game keeps running with static fallbacks. AI enhances the experience; it never blocks it. Circuit breaker opens after 5 failures, recovers automatically.

<!-- SCREENSHOT: npc-dialogue
     Capture: A conversation with an NPC — the village priest or the guard work well.
     Show the dialogue box with AI-generated text. Bonus if you can get a thought
     bubble from a nearby mob in the same frame.
     Upload to dev.to and replace this comment with:
     ![NPC dialogue generated by Venice AI — every conversation is unique](IMAGE_URL)
-->

## The stack

| Layer | Technology |
|-------|-----------|
| Client | HTML5 Canvas, TypeScript 5.8, Webpack 5 |
| Server | Node.js, TypeScript 5.8, Socket.IO 4 |
| Database | SQLite (better-sqlite3) |
| AI | Venice AI (llama-3.3-70b), Fish Audio TTS |
| Observability | OpenTelemetry, Pino, SigNoz, Grafana, ClickHouse |
| Testing | Vitest 4, v8 coverage, CI on Node 20 + 22 |
| Production | nginx, Let's Encrypt SSL, Docker Compose |

~215 TypeScript source files. 280 including tests. 105 WebSocket message types. 50 levels, 7 zones, 6 roaming bosses, a nemesis system where mobs track grudges and power up against players who've killed them before.

## What I'd tell someone doing this at work

Legacy modernization with AI follows the same rules as legacy modernization without it:

1. **Type safety is not optional.** You cannot safely refactor code you cannot reason about. This is always step one.
2. **Test before you refactor.** Decomposing a 1,500-line class is not the time to discover you broke chat because it was coupled to combat through a shared mutable array.
3. **AI amplifies your judgment, not replaces it.** If you don't know that SRP matters, AI won't tell you. If you do know, AI will help you implement it 10x faster.
4. **Observability is not a luxury.** If your legacy system has `console.log("here")` scattered through it, you're flying blind. Structured logging and tracing aren't just for microservices — they're for anything you plan to operate.
5. **Ship continuously.** The repo has 50 commits of steady, incremental progress. No big-bang rewrites. Every commit leaves the system working.

<!-- SCREENSHOT: tui (optional but impressive)
     Capture: The TUI debugger (pnpm run tui) showing the spatial map,
     entity inspector, or aggro visualization. This is the "ops tooling" shot
     that shows you built more than just the game.
     Upload to dev.to and replace this comment with:
     ![Nethack-style TUI debugger for live server introspection](IMAGE_URL)
-->

## Try it

**Play:** [fracture.georgelarson.me](https://fracture.georgelarson.me)
**Code:** [github.com/georgeglarson/Fracture](https://github.com/georgeglarson/Fracture)

The game runs 24/7 on a real server with real observability. Walk around, fight mobs, read their thoughts, talk to NPCs. Everything you see — the combat, the AI dialogue, the persistence, the spatial partitioning — is the result of applying boring enterprise modernization patterns to a fun problem.

That's the whole point. The skills transfer. The methodology scales. AI just makes it possible to do it alone.

---

*I'm George Larson — 25 years in software engineering, infrastructure, manufacturing systems, and cybersecurity. Currently looking for Director/VP or senior engineering roles where legacy modernization, AI integration, and production operations matter. More at [georgelarson.me](https://georgelarson.me).*
