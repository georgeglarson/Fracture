# 001: Item System - Tasks

## Phase 1: Setup (Blocking)

- [1.1] Create shared item types (`shared/ts/items/item-types.ts`)
  - Rarity enum
  - ItemProperties interface
  - GeneratedItem interface

- [1.2] Create server item tables (`server/ts/items/item-tables.ts`)
  - Base weapon stats (sword1 through goldensword)
  - Base armor stats (clotharmor through goldenarmor)
  - Rarity drop weights
  - Rarity stat multipliers
  - Bonus property ranges

## Phase 2: Core Implementation

- [2.1] Create ItemGenerator service (`server/ts/items/item-generator.ts`)
  - `generate(kind, mobLevel)` - Main entry point
  - `rollRarity()` - Weighted random rarity
  - `calculateStats(kind, rarity)` - Apply multipliers
  - `rollBonusProperties(rarity)` - Random bonus stats

- [2.2] Update server Item class (`server/ts/item.ts`)
  - Add `properties: ItemProperties` field
  - Update constructor to accept properties

- [2.3] Update Drop message (`server/ts/message.ts`)
  - Add properties to Drop serialization
  - Format: `[DROP, mobId, itemId, kind, properties, hatelist]`

- [2.4] Update World drop logic (`server/ts/world.ts`)
  - Import ItemGenerator
  - In `getDroppedItem()`: generate properties when creating item

## Phase 3: Client Integration

- [3.1] Update client Item class (`client/ts/entity/objects/item.ts`)
  - Add `properties: ItemProperties` field
  - Add `rarity` getter for convenience

- [3.2] Update GameClient (`client/ts/network/gameclient.ts`)
  - Parse properties from Drop message
  - Pass to Item constructor

- [3.3] Update loot messages (`client/ts/entity/objects/items.ts`)
  - Dynamic loot message based on properties
  - Format: "You pick up a [Rarity] [Item] (+X-Y dmg)"

## Phase 4: Visual Polish

- [4.1] Rarity name colors
  - Update item name display to use rarity color
  - Colors: white/green/blue/purple/orange

## Phase 5: Testing & Verification

- [5.1] Build verification
  - `npm run build:server`
  - `npm run build:client`

- [5.2] Manual testing
  - Kill mobs, verify items drop with properties
  - Check loot messages show stats
  - Verify rarity distribution feels correct

- [5.3] Commit and push

## Task Dependencies

```
[1.1] ─┬─→ [2.1] ─→ [2.4]
       │      ↓
[1.2] ─┘   [2.2] ─→ [2.3] ─→ [3.2] ─→ [3.3]
                              ↓
                           [3.1]
                              ↓
                           [4.1]
                              ↓
                           [5.1] ─→ [5.2] ─→ [5.3]
```

## Estimated Order of Execution

1. [1.1] Shared types (foundation)
2. [1.2] Item tables (data)
3. [2.1] ItemGenerator (core logic)
4. [2.2] Server Item update
5. [2.3] Drop message update
6. [2.4] World integration
7. [3.1] Client Item update
8. [3.2] GameClient parsing
9. [3.3] Loot messages
10. [4.1] Rarity colors
11. [5.1-5.3] Test and ship
