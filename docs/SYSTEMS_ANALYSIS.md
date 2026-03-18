# Fracture - Systems Analysis

## Deep Dive: Entity, Item, Drop, and Spawn Systems

**Analysis Date:** 2025-12-06
**Analyst:** Claude Code

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Entity System](#entity-system)
4. [Item System](#item-system)
5. [Spawn/Drop Pipeline](#spawndrop-pipeline)
6. [Message Protocol](#message-protocol)
7. [Grid Systems](#grid-systems)
8. [Bug Analysis](#bug-analysis)
9. [Recommendations](#recommendations)

---

## Executive Summary

### Critical Bug Found
**DUPLICATE SPAWN MESSAGES** - The chest item spawn sends the same message 2-3 times to the client, causing:
1. First spawn succeeds
2. Subsequent spawns fail with "This entity already exists"
3. Item IS added but may have rendering/state issues

**Root Cause:** In `handleOpenedChest()`, we call both:
- `pushToAdjacentGroups(chestGroup, new Messages.Spawn(item))` - sends to all nearby players
- `pushToPlayer(player, new Messages.Spawn(item))` - redundantly sends AGAIN to same player

The player receives the message twice (or more if in multiple adjacent group overlaps).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (Node.js)                         │
├─────────────────────────────────────────────────────────────────┤
│  World                                                          │
│  ├── entities: Map<id, Entity>      // All entities             │
│  ├── players: Map<id, Player>       // Connected players        │
│  ├── mobs: Map<id, Mob>             // Active mobs              │
│  ├── items: Map<id, Item>           // Dropped/spawned items    │
│  ├── groups: Map<groupId, Group>    // Spatial partitioning     │
│  ├── mobAreas: MobArea[]            // Mob spawn zones          │
│  ├── chestAreas: ChestArea[]        // Chest spawn zones        │
│  └── outgoingQueues: Map<playerId, Message[]>  // Message queue │
└─────────────────────────────────────────────────────────────────┘
                              ▼
                     Socket.IO WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT (Browser)                          │
├─────────────────────────────────────────────────────────────────┤
│  Game                                                           │
│  ├── entities: Map<id, Entity>      // Known entities           │
│  ├── entityGrid[y][x]: Entity{}     // Spatial lookup           │
│  ├── itemGrid[y][x]: Item{}         // Item spatial lookup      │
│  ├── pathingGrid[y][x]: 0|1         // Collision grid           │
│  ├── renderingGrid[y][x]: Entity[]  // Render optimization      │
│  └── deathpositions: Map<mobId, {x,y}>  // For drop placement   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Entity System

### Entity Hierarchy (Server)

```
Entity (base class)
├── id: number              // Unique identifier
├── type: string            // 'mob', 'player', 'item', 'npc', 'chest'
├── kind: number            // Entity subtype (Types.Entities.*)
├── x, y: number            // World position (grid coords)
├── group: string           // Current spatial group ID
│
├── Item extends Entity
│   ├── isStatic: boolean       // True = respawns (static world items)
│   ├── isFromChest: boolean    // True = dropped from chest
│   ├── blinkTimeout            // Timer before despawn blink
│   └── despawnTimeout          // Timer for actual despawn
│
├── Chest extends Item
│   ├── items: number[]         // Possible drop kinds
│   └── getRandomItem()         // Select random drop
│
├── Character extends Entity
│   ├── hitPoints, maxHitPoints
│   ├── target: Entity
│   ├── attackers: Set<Entity>
│   └── hatelist: Entity[]      // Aggro list
│
├── Mob extends Character
│   ├── spawningX, spawningY    // Respawn location
│   ├── area: MobArea           // Parent spawn area
│   └── drops: {kind, probability}[]
│
├── Player extends Character
│   ├── name: string
│   ├── armor, weapon: number
│   ├── hasEnteredGame: boolean
│   └── connection: Socket
│
└── Npc extends Character
    └── (static NPCs for quests/dialogue)
```

### Entity Lifecycle

```
SPAWN LIFECYCLE:
1. Server creates Entity via factory
2. Entity assigned unique ID from world.createItem()/createMob()
3. Entity registered in world.entities and world.groups
4. SPAWN message serialized and queued to relevant players
5. Client receives SPAWN, creates local Entity via EntityFactory
6. Client registers in entities, entityGrid, itemGrid (if Item), renderingGrid

DESPAWN LIFECYCLE:
1. Server triggers despawn (timeout, collected, killed)
2. Entity removed from world.entities, groups
3. DESPAWN message sent to nearby players
4. Client receives DESPAWN, calls entity.clean()
5. Client removes from all grids, deletes from entities map
```

---

## Item System

### Item Types (from gametypes.ts)

```typescript
// Healing Items (expendable)
FLASK: 35       // Health potion
BURGER: 36      // Food heal
FIREPOTION: 65  // Fire invincibility

// Armor Items (equippable)
CLOTHARMOR: 21
LEATHERARMOR: 22
MAILARMOR: 23
PLATEARMOR: 24
REDARMOR: 25
GOLDENARMOR: 26

// Weapons (equippable)
SWORD1: 60
SWORD2: 61
AXE: 62
REDSWORD: 63
BLUESWORD: 64
GOLDENSWORD: 66
MORNINGSTAR: 67

// Special
CAKE: 38        // Achievement item
CHEST: 37       // Container (treated as Item subclass)
```

### Item Drop System

```
MOB DROPS (server/ts/mobarea.ts, world.ts):
1. Mob dies → world.handleMobDeath(mob)
2. Check mob.drops[] array for possible items
3. Roll probability for each drop
4. If drop succeeds:
   a. item = world.createItem(dropKind, mob.x, mob.y)
   b. Send DROP message (includes mobId for client positioning)
   c. Start despawn timer via handleItemDespawn()

CHEST DROPS (server/ts/world.ts):
1. Player opens chest → handleOpenedChest(chest, player)
2. chest.getRandomItem() selects from chest.items[]
3. world.addItemFromChest(kind, x, y)
4. Send SPAWN message (direct position, no mobId)
5. Start despawn timer

STATIC ITEMS (world_server.json):
1. Defined in map.staticEntities
2. Spawned at world initialization
3. isStatic = true → respawn after collected
```

### Item Collection Flow

```
CLIENT SIDE:
1. Player clicks on item tile
2. game.makePlayerGoToItem(item) called
3. player.isLootMoving = true
4. Player pathfinds to item.gridX, item.gridY
5. On arrival (player.onStopPathing):
   a. game.isItemAt(x, y) checks itemGrid
   b. If item found: player.loot(item)
   c. client.sendLoot(item) notifies server
   d. game.removeItem(item) cleans up locally

SERVER SIDE:
1. Receive LOOT message
2. Validate player position is adjacent/on item
3. Apply item effects (heal, equip armor/weapon)
4. world.removeEntity(item)
5. Send equipment/health updates to player
6. Broadcast DESTROY message to nearby players
```

---

## Spawn/Drop Pipeline

### Message Types

| Type | ID | Direction | Purpose |
|------|----|-----------|---------|
| SPAWN | 2 | S→C | New entity appeared (includes full state) |
| DESPAWN | 3 | S→C | Entity removed from world |
| DROP | 14 | S→C | Item dropped by mob (uses mobId for position) |
| LOOT | 12 | C→S | Player picking up item |
| LOOTMOVE | 5 | C→S | Player moving toward item |
| DESTROY | 22 | S→C | Entity should be destroyed |

### SPAWN Message Format

```javascript
// Server serialization (entity.ts, message.ts):
Messages.Spawn.serialize() = [
  Types.Messages.SPAWN,  // = 2
  entity.id,             // Unique ID
  entity.kind,           // Entity type (e.g., 22 for LEATHERARMOR)
  entity.x,              // Grid X position
  entity.y               // Grid Y position
]

// For Players, additional fields:
[SPAWN, id, kind, x, y, name, orientation, armor, weapon, target?]

// For Mobs:
[SPAWN, id, kind, x, y, orientation, target?]
```

### DROP Message Format

```javascript
Messages.Drop.serialize() = [
  Types.Messages.DROP,   // = 14
  mob.id,                // Dead mob's ID (for position lookup)
  item.id,               // New item's ID
  item.kind,             // Item type
  mob.hatelist.map(e => e.id)  // Players involved (for achievement)
]
```

### Client Message Handling

```javascript
// gameclient.ts - receiveSpawn()
receiveSpawn(data) {
  var id = data[1], kind = data[2], x = data[3], y = data[4];

  if (Types.isItem(kind)) {
    var item = EntityFactory.createEntity(kind, id);
    spawn_item_callback(item, x, y);  // → game.addItem()
  }
  else if (Types.isChest(kind)) {
    spawn_chest_callback(item, x, y);
  }
  else {
    // Character spawn (player/mob/npc)
    spawn_character_callback(character, x, y, orientation, target);
  }
}

// gameclient.ts - receiveDrop()
receiveDrop(data) {
  var mobId = data[1], id = data[2], kind = data[3], players = data[4];
  var item = EntityFactory.createEntity(kind, id);
  item.wasDropped = true;
  item.playersInvolved = players;
  drop_callback(item, mobId);  // → game uses getDeadMobPosition(mobId)
}
```

---

## Grid Systems

### Server-Side Groups

The server partitions the world into groups for efficient message broadcasting:

```javascript
// world.ts
groups: {
  "0-0": { entities: {id: entity}, players: [playerId] },
  "0-1": { entities: {...}, players: [...] },
  // Grid of groups covering the map
}

// Group calculation (map.ts):
getGroupIdFromPosition(x, y) {
  var gx = Math.floor(x / groupWidth);
  var gy = Math.floor(y / groupWidth);
  return gx + "-" + gy;
}

// Adjacent groups for broadcasting:
forEachAdjacentGroup(groupId, callback) {
  // Iterates 3x3 grid centered on groupId
  // Used for visibility range
}
```

### Client-Side Grids

```javascript
// game.ts - Four grid systems:

// 1. entityGrid[y][x] - Character/NPC/Chest lookup for clicking
entityGrid[y][x][entityId] = entity;

// 2. itemGrid[y][x] - Item lookup for looting
itemGrid[y][x][itemId] = item;

// 3. pathingGrid[y][x] - Collision detection (A* pathfinding)
pathingGrid[y][x] = 0;  // Walkable
pathingGrid[y][x] = 1;  // Blocked

// 4. renderingGrid[y][x] - Render optimization
renderingGrid[y][x] = [entities...];  // All entities to draw at tile
```

### Grid Registration Flow

```javascript
// When entity added (game.ts):
registerEntityPosition(entity) {
  if (Character || Chest) {
    entityGrid[y][x][id] = entity;
    if (!Player) pathingGrid[y][x] = 1;  // Block tile
  }
  if (Item) {
    itemGrid[y][x][id] = entity;  // Items don't block pathing
  }
  renderingGrid[y][x].push(entity);
}

// When entity removed:
unregisterEntityPosition(entity) {
  delete entityGrid[y][x][id];
  pathingGrid[y][x] = 0;  // Unblock
  // Remove from renderingGrid
}
```

---

## Bug Analysis

### Bug #1: Duplicate Spawn Messages (CRITICAL)

**Evidence from console.md:**
```
game.ts:1021 Spawned sword2 (989) at 154, 141
game.ts:1021 Spawned sword2 (989) at 154, 141  ← DUPLICATE
This entity already exists : 989 (61)           ← ERROR
```

**Root Cause:** `server/ts/world.ts` handleOpenedChest():
```javascript
// BUG: This sends to player TWICE
this.pushToAdjacentGroups(chestGroup, new Messages.Spawn(item));
this.pushToPlayer(player, new Messages.Spawn(item));  // REMOVE THIS LINE
```

The player is already in the adjacent groups, so they receive the message twice.

**Impact:**
- Item entity created successfully on first message
- Duplicate messages cause console errors
- May cause race conditions in entity state

**Fix:** Remove the redundant `pushToPlayer` call.

### Bug #2: Chest Path Not Unblocked (SUSPECTED)

**Evidence:** Player may not be able to walk to chest item position.

**Analysis:**
- When chest despawns, `removeFromPathingGrid` should be called
- Current code in `chest.onOpen` callback calls `removeFromPathingGrid`
- BUT: the chest entity might be removed from entityGrid before callback fires

**Check:** Verify the order of operations in despawn flow.

### Bug #3: HurtSprite Errors (Minor)

**Evidence from console.md:**
```
Error getting image data for sprite : leatherarmor
Error getting image data for sprite : mailarmor
... (repeated for all armor types)
```

**Root Cause:** `sprite.ts:100` createHurtSprite() fails to get image data.

**Impact:** Visual only - hurt effect may not display correctly for armors.

---

## Recommendations

### Immediate Fixes

1. **Remove duplicate pushToPlayer in handleOpenedChest()**
   ```javascript
   // server/ts/world.ts - handleOpenedChest()
   // DELETE: this.pushToPlayer(player, new Messages.Spawn(item));
   ```

2. **Add idempotent check in client addItem()**
   ```javascript
   addItem(item, x, y) {
     if (this.entities[item.id]) {
       console.warn('Item already exists, skipping:', item.id);
       return;
     }
     // ... rest of method
   }
   ```

### Architecture Improvements

1. **Message Deduplication Layer**
   - Add sequence numbers to messages
   - Client tracks received sequence, ignores duplicates

2. **Entity State Machine**
   - Formalize entity states: SPAWNING → ACTIVE → DESPAWNING → REMOVED
   - Prevent operations on wrong state

3. **Grid Synchronization**
   - Atomic grid updates (register/unregister in transaction)
   - Event system for grid changes

### Expansion Opportunities

1. **Item Enhancement System**
   - Add Item.enchantments[] property
   - Add Item.durability for equipment
   - Add Item.soulbound flag

2. **Loot Tables**
   - Move drops from hardcoded to data-driven
   - Support weighted random with tiers
   - Add boss-specific loot tables

3. **Inventory System**
   - Player.inventory[] for carrying items
   - Client-side inventory UI
   - Item stacking for consumables

---

## File Reference

| File | Purpose |
|------|---------|
| `server/ts/entity.ts` | Base entity class, getState() |
| `server/ts/item.ts` | Item entity, despawn handling |
| `server/ts/chest.ts` | Chest entity, random item selection |
| `server/ts/chestarea.ts` | Chest spawn zones |
| `server/ts/world.ts` | Core game logic, message routing |
| `server/ts/message.ts` | Message serialization classes |
| `client/ts/game.ts` | Client game loop, entity management |
| `client/ts/network/gameclient.ts` | Network message handling |
| `client/ts/entity/item.ts` | Client-side item entity |
| `shared/ts/gametypes.ts` | Entity/message type constants |

---

*Document generated during debugging session. Last updated: 2025-12-06*
