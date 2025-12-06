# 000: Engine Foundation

> Status: COMPLETE
> Version: 1.0.0

## Overview

The foundational architecture enabling a modular, testable, scalable game engine. This spec documents what has been built and establishes patterns for future development.

## Completed Components

### Server-Side AI Module (9 Services)

| Service | Responsibility | Location |
|---------|---------------|----------|
| VeniceClient | Core API wrapper, rate limiting | `server/ts/ai/venice-client.ts` |
| ProfileService | Player profiles, kill/area/item tracking | `server/ts/ai/profile.service.ts` |
| DialogueService | NPC conversation generation, memory | `server/ts/ai/dialogue.service.ts` |
| QuestService | Quest generation, progress, completion | `server/ts/ai/quest.service.ts` |
| CompanionService | AI companion hints | `server/ts/ai/companion.service.ts` |
| NarratorService | Event narration with styles | `server/ts/ai/narrator.service.ts` |
| NewsService | Town Crier, world event aggregation | `server/ts/ai/news.service.ts` |
| ThoughtService | Entity thought bubbles | `server/ts/ai/thought.service.ts` |
| VeniceService | Facade pattern, backward compatibility | `server/ts/ai/venice.service.ts` |

### Client-Side Engine Modules (5 Managers)

| Manager | Responsibility | Location |
|---------|---------------|----------|
| EntityManager | Entity CRUD, factory dispatch | `client/ts/entities/entity-manager.ts` |
| GridManager | 4 grid types, spatial queries | `client/ts/world/grid-manager.ts` |
| MapQueryService | Entity lookup at positions | `client/ts/world/map-query.service.ts` |
| InputManager | Mouse, cursor, hover detection | `client/ts/input/input-manager.ts` |
| UIManager | Narrator, newspaper, notifications | `client/ts/ui/ui-manager.ts` |

### Event System

| Component | Purpose | Location |
|-----------|---------|----------|
| EventBus | Typed pub/sub implementation | `shared/ts/events/event-bus.ts` |
| Event Types | 25+ strongly-typed events | `shared/ts/events/event-types.ts` |

### Combat System

| Component | Purpose | Location |
|-----------|---------|----------|
| CombatSystem | Damage, death, aggro management | `server/ts/combat/combat-system.ts` |

## Architecture Patterns

### Dependency Injection
All services use constructor injection for dependencies:
```typescript
constructor(client: VeniceClient, profileService: ProfileService)
```

### Provider Functions
Global singletons accessed via provider functions:
```typescript
export function getServerEventBus(): EventBus
export function getVeniceService(): VeniceService | null
```

### Interface-First Design
EventBus implements IEventBus interface, enabling future swap to Redis pub/sub.

### Facade Pattern
VeniceService delegates to specialized services while maintaining backward compatibility.

## Acceptance Criteria

- [x] Build succeeds: `npm run build:server && npm run build:client`
- [x] Server starts without errors
- [x] NPC dialogue generates via AI
- [x] Narrator announces events (kills, achievements)
- [x] Quests can be requested and completed
- [x] Town Crier newspaper displays headlines
- [x] Entity thought bubbles appear
- [x] EventBus emits typed events
- [x] Client grids correctly track entities

## Migration Notes

The foundation tag `v1.0.0-engine-foundation` marks this milestone.

All existing functionality preserved via facade pattern - no breaking changes to external API.
