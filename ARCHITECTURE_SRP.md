# BrowserQuest Ultra - Architecture & SRP Analysis

**Purpose:** Identify and isolate all systems, pipelines, and responsibilities for Single Responsibility Principle refactoring.

**Analysis Date:** 2025-12-06

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Identified Domains](#identified-domains)
3. [Server-Side Systems](#server-side-systems)
4. [Client-Side Systems](#client-side-systems)
5. [Shared Systems](#shared-systems)
6. [Data Flow Pipelines](#data-flow-pipelines)
7. [SRP Violations](#srp-violations)
8. [Proposed Refactoring](#proposed-refactoring)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSERQUEST ULTRA                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    WebSocket    ┌──────────────────────────────────┐  │
│  │     CLIENT       │◄──────────────►│           SERVER                  │  │
│  │                  │                 │                                   │  │
│  │  ┌────────────┐  │                 │  ┌─────────────────────────────┐  │  │
│  │  │ Rendering  │  │                 │  │      World Simulation       │  │  │
│  │  ├────────────┤  │                 │  ├─────────────────────────────┤  │  │
│  │  │ Input      │  │                 │  │      Entity Management      │  │  │
│  │  ├────────────┤  │                 │  ├─────────────────────────────┤  │  │
│  │  │ Audio      │  │                 │  │      Combat System          │  │  │
│  │  ├────────────┤  │                 │  ├─────────────────────────────┤  │  │
│  │  │ Entities   │  │                 │  │      Venice AI              │  │  │
│  │  ├────────────┤  │                 │  ├─────────────────────────────┤  │  │
│  │  │ UI/HUD     │  │                 │  │      Networking             │  │  │
│  │  └────────────┘  │                 │  └─────────────────────────────┘  │  │
│  └──────────────────┘                 └──────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         SHARED (gametypes.ts)                         │   │
│  │  Entity Types • Message Protocol • Item Classification • Orientations │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Identified Domains

### Domain 1: Entity System
**Responsibility:** Define and manage all game objects (players, mobs, NPCs, items, chests)

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| Entity (base) | server/entity.ts, client/entity/entity.ts | ID, position, type, spawn/despawn |
| Character | server/character.ts, client/character/character.ts | Health, combat state, movement |
| Player | server/player.ts, client/player/player.ts | Equipment, input, progression |
| Mob | server/mob.ts, client/mob/mob.ts | AI behavior, drops, respawn |
| NPC | server/npc.ts, client/npc/npc.ts | Dialogue, static position |
| Item | server/item.ts, client/objects/item.ts | Loot, despawn timers |
| Chest | server/chest.ts, client/objects/chest.ts | Container, random drops |

### Domain 2: World Simulation
**Responsibility:** Manage game state, spatial partitioning, entity lifecycle

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| World | server/world.ts | Entity registry, groups, game loop, combat, messaging |
| Map | server/map.ts, client/map/map.ts | Collision grid, zones, checkpoints |
| Area | server/area.ts | Spatial bounds, entity tracking |
| MobArea | server/mobarea.ts | Mob spawning zones |
| ChestArea | server/chestarea.ts | Chest respawn zones |
| Checkpoint | server/checkpoint.ts | Respawn points |

### Domain 3: Combat System
**Responsibility:** Handle damage, death, aggro, drops

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| Formulas | server/formulas.ts | Damage/HP calculations |
| Properties | server/properties.ts | Entity stats, drop tables |
| (Mixed in World) | server/world.ts | Aggro, hate lists, combat resolution |
| (Mixed in Character) | */character.ts | Attack state, attackers list |

### Domain 4: Networking
**Responsibility:** Client-server communication, message serialization

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| Server (WebSocket) | server/ws.ts | Socket.IO setup, connections |
| Connection | server/ws.ts | Individual client wrapper |
| GameClient | client/network/gameclient.ts | Message sending/receiving |
| Messages | server/message.ts | Message serialization |
| FormatChecker | server/format.ts | Message validation |
| Types.Messages | shared/gametypes.ts | Protocol constants |

### Domain 5: Rendering (Client)
**Responsibility:** Visual display, canvas management, animations

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| Renderer | client/renderer/renderer.ts | Canvas, drawing, FPS |
| Camera | client/renderer/camera.ts | Viewport, follow logic |
| Sprite | client/renderer/sprite.ts | Image loading, animations |
| Updater | client/renderer/updater.ts | Frame updates, transitions |
| Animation | client/animation.ts | Frame timing, loops |
| AnimatedTile | client/map/animatedtile.ts | Tile animations |

### Domain 6: Audio (Client)
**Responsibility:** Sound effects, music, audio zones

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| AudioManager | client/audio.ts | Sounds, music, areas, fade |

### Domain 7: User Interface (Client)
**Responsibility:** HUD, menus, popups, achievements display

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| App | client/app.ts | UI state, parchment, health bar |
| BubbleManager | client/interface/bubble.manager.ts | Chat bubbles |
| Bubble | client/interface/bubble.ts | Single bubble lifecycle |
| InfoManager | client/interface/info.manager.ts | Damage numbers |
| DamageInfo | client/interface/damage.info.ts | Floating damage |
| (Mixed in main.ts) | client/main.ts | DOM event handlers |
| (Mixed in game.ts) | client/game.ts | Achievement UI, narrator |

### Domain 8: Input (Client)
**Responsibility:** Mouse, keyboard, touch input handling

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| (Mixed in main.ts) | client/main.ts | Key bindings, click handlers |
| (Mixed in game.ts) | client/game.ts | Mouse position, cursor state |
| (Mixed in App) | client/app.ts | Mouse coordinate tracking |

### Domain 9: Pathfinding (Client)
**Responsibility:** A* navigation, collision avoidance

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| Pathfinder | client/utils/pathfinder.ts | A* algorithm, ignore lists |
| (Mixed in Character) | client/character/character.ts | Path following |

### Domain 10: Persistence (Client)
**Responsibility:** Local storage, player progress

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| Storage | client/utils/storage.ts | LocalStorage, achievements, kills |

### Domain 11: Venice AI System
**Responsibility:** AI-powered dialogue, quests, narration, companions

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| VeniceService | server/ai/venice.service.ts | API calls, profiles, dialogue, quests, narration, news |
| NPC Personalities | server/ai/npc-personalities.ts | Personality data, templates |
| AI Types | server/ai/types.ts | Interface definitions |
| AIPlayer | server/ai/aiplayer.ts | Autonomous NPCs (Westworld) |
| AIPlayerManager | server/ai/aiplayer.ts | AI player lifecycle |

### Domain 12: Metrics/Monitoring
**Responsibility:** Server metrics, population tracking

| Component | Location | Current Responsibilities |
|-----------|----------|-------------------------|
| Metrics | server/metrics.ts | Memcached, player counts |

---

## Server-Side Systems

### System: Bootstrap (main.ts)
```
Responsibilities:
├── Load configuration
├── Initialize Venice AI
├── Create World instances
├── Setup WebSocket server
├── Handle player distribution
└── Start metrics collection
```

### System: World Simulation (world.ts) - GOD OBJECT
```
Current Responsibilities (NEEDS SPLITTING):
├── Entity Registry
│   ├── entities Map<id, Entity>
│   ├── players Map<id, Player>
│   ├── mobs Map<id, Mob>
│   ├── items Map<id, Item>
│   └── npcs Map<id, Npc>
│
├── Spatial Partitioning
│   ├── groups Map<groupId, Group>
│   ├── Group membership tracking
│   └── Adjacent group calculations
│
├── Message Broadcasting
│   ├── outgoingQueues Map<playerId, Message[]>
│   ├── pushToPlayer()
│   ├── pushToAdjacentGroups()
│   ├── pushToGroup()
│   └── pushBroadcast()
│
├── Combat System
│   ├── handleMobHate()
│   ├── chooseMobTarget()
│   ├── handleHurtEntity()
│   └── handleMobDeath()
│
├── Item/Drop System
│   ├── handleOpenedChest()
│   ├── handleItemDespawn()
│   ├── addItemFromChest()
│   └── createItem()
│
├── Spawn System
│   ├── MobArea management
│   ├── ChestArea management
│   ├── Static entity spawning
│   └── Respawn logic
│
├── Game Loop
│   ├── run() - 50 UPS tick
│   ├── processQueues()
│   └── regenCallback()
│
├── AI System Integration
│   ├── AIPlayerManager
│   └── World event recording
│
└── Player Lifecycle
    ├── connect_callback
    ├── enter_callback
    └── Callback setup
```

### System: Player Handler (player.ts) - GOD OBJECT
```
Current Responsibilities (NEEDS SPLITTING):
├── Connection Management
│   ├── Message listening
│   ├── Format validation
│   ├── Timeout detection
│   └── Disconnect handling
│
├── Equipment System
│   ├── equip armor/weapon
│   ├── HP calculation
│   └── Damage calculation
│
├── Movement System
│   ├── MOVE message handling
│   ├── Position validation
│   └── Zone transitions
│
├── Combat System
│   ├── ATTACK/HIT/HURT handling
│   ├── Attacker tracking
│   └── Death handling
│
├── Loot System
│   ├── LOOT message handling
│   ├── Item effects
│   └── Equipment pickup
│
├── Venice AI Integration
│   ├── NPC dialogue requests
│   ├── Quest requests
│   ├── Kill milestone tracking
│   ├── Area exploration
│   └── Narration triggers
│
└── Checkpoints/Teleport
    ├── Checkpoint recording
    └── Teleport functionality
```

### System: Venice AI (venice.service.ts) - GOD OBJECT
```
Current Responsibilities (NEEDS SPLITTING):
├── Dialogue System
│   ├── generateNpcResponse()
│   ├── Conversation memory
│   └── Personality prompts
│
├── Quest System
│   ├── generateQuest()
│   ├── checkQuestProgress()
│   ├── completeQuest()
│   └── Quest templates
│
├── Companion System
│   ├── generateCompanionHint()
│   └── Hint triggers
│
├── Item Lore System
│   ├── generateItemLore()
│   └── Lore caching
│
├── Narrator System
│   ├── generateNarration()
│   ├── Event descriptions
│   └── Cooldown management
│
├── Thought Bubbles
│   ├── generateEntityThought()
│   ├── State-aware thoughts
│   └── Template pools
│
├── Town Crier (News)
│   ├── recordWorldEvent()
│   ├── generateNewspaper()
│   └── News caching
│
└── Player Profiles
    ├── Profile creation
    ├── Progress tracking
    └── Stats aggregation
```

---

## Client-Side Systems

### System: Game Controller (game.ts) - GOD OBJECT
```
Current Responsibilities (NEEDS SPLITTING):
├── Game State
│   ├── entities Map
│   ├── Player reference
│   └── Game loop control
│
├── Grid Systems
│   ├── entityGrid[y][x]
│   ├── itemGrid[y][x]
│   ├── pathingGrid[y][x]
│   └── renderingGrid[y][x]
│
├── Entity Management
│   ├── addEntity/removeEntity
│   ├── Grid registration
│   └── Entity lookup
│
├── Player Actions
│   ├── Movement requests
│   ├── Attack initiation
│   ├── Loot collection
│   └── NPC interaction
│
├── Network Callbacks
│   ├── Spawn handlers
│   ├── Combat handlers
│   ├── Chat handlers
│   └── Venice AI handlers
│
├── Cursor/Input
│   ├── Hover detection
│   ├── Cursor sprites
│   └── Click handling
│
├── Audio Coordination
│   ├── Music area detection
│   └── Sound triggers
│
├── Achievement System
│   ├── Achievement checks
│   ├── Unlock logic
│   └── Storage sync
│
├── UI Overlays
│   ├── Narrator display
│   ├── Newspaper display
│   └── Dialogue display
│
└── Animation Management
    ├── Animated tiles
    ├── Sprite animations
    └── Target cursor
```

### System: Rendering Pipeline
```
Renderer
├── Canvas Management
│   ├── Entity canvas
│   ├── Background canvas
│   └── Foreground canvas
│
├── Frame Rendering
│   ├── Clear screen
│   ├── Draw tiles
│   ├── Draw entities
│   └── Draw UI elements
│
├── Scaling
│   ├── Device detection
│   ├── Scale factor
│   └── Font sizing
│
└── Optimization
    ├── Dirty rectangles
    ├── Visibility culling
    └── FPS tracking

Camera
├── Position Tracking
├── Viewport Management
├── Entity Following
└── Visibility Testing

Updater
├── Entity Updates
│   ├── Movement
│   ├── Animation
│   └── Fading
│
├── System Updates
│   ├── Bubbles
│   ├── Damage info
│   └── Animated tiles
│
└── Transition Updates
    ├── Zoning
    └── Camera pan
```

### System: Entity Factory
```
EntityFactory
├── Type-to-Constructor Mapping
├── Mob Creation (14 types)
├── NPC Creation (15 types)
├── Item Creation (17 types)
├── Chest Creation
└── Player Creation
```

---

## Shared Systems

### System: Game Types (gametypes.ts)
```
Types
├── Messages (39 message types)
│   ├── Core gameplay (SPAWN, MOVE, ATTACK, etc.)
│   └── Venice AI (NPCTALK, QUEST, NARRATOR, etc.)
│
├── Entities (66 entity types)
│   ├── Players (1)
│   ├── Mobs (13)
│   ├── NPCs (16)
│   ├── Armors (7)
│   ├── Weapons (7)
│   └── Objects (5)
│
├── Orientations (4)
│
├── Classification Functions
│   ├── isPlayer/isMob/isNpc
│   ├── isArmor/isWeapon
│   ├── isItem/isChest
│   ├── isHealingItem/isExpendableItem
│   └── isCharacter
│
├── Ranking Functions
│   ├── getWeaponRank
│   └── getArmorRank
│
└── Conversion Functions
    ├── getKindFromString
    ├── getKindAsString
    ├── getOrientationAsString
    └── getMessageTypeAsString
```

---

## Data Flow Pipelines

### Pipeline 1: Player Connection
```
Client                          Server
  │                               │
  ├─── HELLO ──────────────────►  │
  │                               ├── Validate
  │                               ├── Create Player
  │                               ├── Register in World
  │                               ├── Setup Callbacks
  │  ◄─────────────── WELCOME ────┤
  │                               ├── Send nearby entities (SPAWN)
  │  ◄─────────────── SPAWN[] ────┤
  │                               │
```

### Pipeline 2: Movement
```
Client                          Server
  │                               │
  ├─── MOVE(x,y) ──────────────►  │
  │                               ├── Validate position
  │                               ├── Update player.x/y
  │                               ├── Check zone change
  │                               ├── Update group membership
  │                               ├── Broadcast to adjacent groups
  │  ◄───────────── MOVE(id,x,y) ─┤ (to other players)
  │                               │
```

### Pipeline 3: Combat
```
Client                          Server
  │                               │
  ├─── ATTACK(mobId) ───────────► │
  │                               ├── Register attack
  │  ◄──────────────── ATTACK ────┤ (broadcast)
  │                               │
  ├─── HIT(mobId) ──────────────► │
  │                               ├── Calculate damage
  │                               ├── Apply damage to mob
  │                               ├── Check death
  │  ◄──────────────── DAMAGE ────┤ (broadcast)
  │                               │
  │  (if mob dies)                │
  │  ◄────────────────── DROP ────┤
  │  ◄───────────────── KILL ─────┤
  │                               │
```

### Pipeline 4: Loot Collection
```
Client                          Server
  │                               │
  ├─── LOOT(itemId) ────────────► │
  │                               ├── Validate position
  │                               ├── Apply item effect
  │                               ├── Remove from world
  │  ◄──────────────── EQUIP ─────┤ (if equipment)
  │  ◄─────────────── HEALTH ─────┤ (if healing)
  │  ◄─────────────── DESTROY ────┤ (to all players)
  │                               │
```

### Pipeline 5: Chest Opening
```
Client                          Server
  │                               │
  ├─── OPEN(chestId) ───────────► │
  │                               ├── Get random item
  │                               ├── Create Item entity
  │                               ├── Remove chest
  │  ◄─────────────── DESPAWN ────┤ (chest)
  │  ◄──────────────── SPAWN ─────┤ (item)
  │                               │
```

### Pipeline 6: NPC Dialogue (Venice AI)
```
Client                          Server
  │                               │
  ├─── NPCTALK(npcId) ──────────► │
  │                               ├── Get player profile
  │                               ├── Get NPC personality
  │                               ├── Build context
  │                               ├── Call Venice API
  │  ◄───────── NPCTALK_RESPONSE ─┤
  │                               │
  │  (if quest offered)           │
  │  ◄──────────── QUEST_OFFER ───┤
  │                               │
```

### Pipeline 7: Entity Rendering
```
Game Loop (Client)
  │
  ├── Updater.update()
  │   ├── Update entity positions
  │   ├── Update animations
  │   ├── Update transitions
  │   └── Update bubbles/damage
  │
  ├── Renderer.renderFrame()
  │   ├── Clear canvases
  │   ├── Camera.forEachVisiblePosition()
  │   │   ├── Draw background tiles
  │   │   └── Draw animated tiles
  │   ├── forEachEntity()
  │   │   ├── Draw sprite at position
  │   │   ├── Draw equipment overlay
  │   │   └── Draw name/health
  │   └── Draw foreground
  │
  └── requestAnimationFrame()
```

---

## SRP Violations

### Critical Violations (Immediate Refactor Candidates)

#### 1. world.ts (50+ methods, 1000+ lines)
**Current:** Does everything - entity management, combat, messaging, spawning, AI
**Violations:**
- Entity registry + Combat system + Message broadcasting + Game loop
- Should be 5-6 separate classes

#### 2. game.ts (2700+ lines)
**Current:** Client god object
**Violations:**
- Entity management + Grid systems + Input handling + UI + Audio + Achievements
- Should be 8-10 separate classes

#### 3. player.ts (Server, 40+ methods)
**Current:** Handles all player concerns
**Violations:**
- Connection handling + Equipment + Movement + Combat + Venice AI
- Should be 5-6 separate classes

#### 4. venice.service.ts (30+ methods)
**Current:** All AI features in one service
**Violations:**
- Dialogue + Quests + Narrator + News + Thoughts + Profiles
- Should be 6 separate services

#### 5. App.ts (500+ lines)
**Current:** UI + Bootstrap + State
**Violations:**
- Game initialization + UI state + Parchment animations + Health display
- Should be 3-4 separate classes

### Moderate Violations

| File | Issue | Recommended Split |
|------|-------|------------------|
| renderer.ts | Rendering + Scaling + FPS | RenderEngine, ScaleManager |
| updater.ts | Entity + UI + Transition updates | EntityUpdater, UIUpdater |
| main.ts | Bootstrap + Event binding | Bootstrap, InputManager |
| map.ts | Loading + Collision + Doors | MapLoader, CollisionGrid |

---

## Proposed Refactoring

### Phase 1: Server Core (world.ts)

```
world.ts →
├── WorldState.ts
│   └── Entity registry, getters/setters
│
├── EntityManager.ts
│   └── add/remove/query entities
│
├── SpatialManager.ts
│   └── Groups, adjacent calculations
│
├── MessageBroadcaster.ts
│   └── Queue management, push methods
│
├── CombatSystem.ts
│   └── Damage, aggro, death handling
│
├── SpawnManager.ts
│   └── MobArea, ChestArea, respawning
│
└── GameLoop.ts
    └── Tick, regen, queue processing
```

### Phase 2: Server Player (player.ts)

```
player.ts →
├── PlayerState.ts
│   └── Equipment, HP, position
│
├── PlayerConnection.ts
│   └── Message handling, validation
│
├── PlayerMovement.ts
│   └── Movement validation, zones
│
├── PlayerCombat.ts
│   └── Attack, damage, death
│
├── PlayerInventory.ts
│   └── Loot, equipment changes
│
└── PlayerAIIntegration.ts
    └── Venice callbacks, profiles
```

### Phase 3: Venice AI (venice.service.ts)

```
venice.service.ts →
├── VeniceClient.ts
│   └── API wrapper, error handling
│
├── DialogueService.ts
│   └── NPC responses, conversation memory
│
├── QuestService.ts
│   └── Generation, progress, completion
│
├── NarratorService.ts
│   └── Event narration, cooldowns
│
├── ThoughtService.ts
│   └── Entity thoughts, templates
│
├── NewsService.ts
│   └── Town Crier, event aggregation
│
└── PlayerProfileService.ts
    └── Profile CRUD, progress tracking
```

### Phase 4: Client Game (game.ts)

```
game.ts →
├── GameState.ts
│   └── Core state, entities map
│
├── EntityManager.ts
│   └── Add/remove, factory integration
│
├── GridManager.ts
│   └── All 4 grids, registration
│
├── PlayerController.ts
│   └── Movement, actions, loot
│
├── NetworkHandler.ts
│   └── All spawn/combat/chat callbacks
│
├── CursorManager.ts
│   └── Hover, cursor sprites
│
├── AchievementManager.ts
│   └── Unlock logic, storage sync
│
├── UIController.ts
│   └── Narrator, newspaper, dialogue
│
└── GameLoop.ts
    └── Start/stop, tick coordination
```

### Phase 5: Client App (app.ts)

```
app.ts →
├── Bootstrap.ts
│   └── Initialization, config loading
│
├── UIStateManager.ts
│   └── Intro/game states, transitions
│
├── HealthDisplay.ts
│   └── Health bar rendering
│
├── EquipmentDisplay.ts
│   └── Weapon/armor icons
│
└── NotificationManager.ts
    └── Messages, achievements
```

---

## Dependency Graph (Current)

```
                    ┌─────────────┐
                    │   main.ts   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ World   │  │ Server  │  │ Metrics │
        └────┬────┘  └─────────┘  └─────────┘
             │
    ┌────────┼────────┬────────┬────────┐
    ▼        ▼        ▼        ▼        ▼
┌───────┐┌───────┐┌───────┐┌───────┐┌───────┐
│Player ││ Mob   ││ NPC   ││ Item  ││ Chest │
└───┬───┘└───────┘└───────┘└───────┘└───────┘
    │
    ▼
┌───────────────┐
│ VeniceService │
└───────────────┘
```

---

## File-to-Responsibility Matrix

| File | Entity | Combat | Network | Render | UI | Audio | AI | Storage |
|------|:------:|:------:|:-------:|:------:|:--:|:-----:|:--:|:-------:|
| world.ts | ● | ● | ● | | | | ● | |
| player.ts | ● | ● | ● | | | | ● | |
| game.ts | ● | ● | ● | ● | ● | ● | ● | ● |
| app.ts | | | | | ● | | | ● |
| venice.service.ts | | | | | | | ● | |
| renderer.ts | | | | ● | | | | |
| gameclient.ts | | | ● | | | | | |

**Legend:** ● = Has responsibility in this domain

---

## Implementation Priority

1. **HIGH:** Extract MessageBroadcaster from world.ts (isolated, low risk)
2. **HIGH:** Extract CombatSystem from world.ts (clear boundaries)
3. **HIGH:** Split venice.service.ts into 6 services (isolated)
4. **MEDIUM:** Extract GridManager from game.ts (many touchpoints)
5. **MEDIUM:** Extract PlayerController from game.ts
6. **MEDIUM:** Split player.ts into state/connection/combat
7. **LOW:** Refactor App.ts (works fine, cosmetic)
8. **LOW:** Refactor renderer/updater (performance-sensitive)

---

*Document generated for SRP refactoring planning. Last updated: 2025-12-06*
