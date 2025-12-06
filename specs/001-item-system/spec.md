# 001: Item System

> Status: DRAFT
> Priority: P1 (Highest Impact)

## Problem Statement

Items currently exist as simple type IDs with no properties beyond base stats. This creates a flat, unengaging loot experience where items are functionally identical within their tier.

## User Stories

### US-001 [P1]: Item Properties
**As a** player
**I want** items to have random properties (damage rolls, bonus stats)
**So that** finding loot feels exciting and rewards are variable

**Acceptance Criteria:**
- Given: A weapon drops from a mob
- When: I pick it up
- Then: It has randomized damage within a range AND may have bonus properties

### US-002 [P1]: Item Comparison
**As a** player
**I want** to see how a dropped item compares to my equipped item
**So that** I can make informed upgrade decisions

**Acceptance Criteria:**
- Given: I hover over a dropped weapon
- When: The tooltip appears
- Then: I see both items' stats with +/- comparison indicators

### US-003 [P2]: Item Rarity
**As a** player
**I want** items to have rarity tiers (Common, Uncommon, Rare, Epic, Legendary)
**So that** finding rare items feels special and aspirational

**Acceptance Criteria:**
- Given: A rare item drops
- When: I see it on the ground
- Then: It has a colored glow indicating rarity AND the name shows the rarity color

### US-004 [P2]: Inventory System
**As a** player
**I want** to carry multiple items I've found
**So that** I can compare and choose what to equip

**Acceptance Criteria:**
- Given: I have an inventory
- When: I pick up an item without equipping
- Then: It goes into my inventory AND I can equip it later

### US-005 [P3]: Item Selling
**As a** player
**I want** to sell unwanted items to NPCs
**So that** I can convert loot into currency for other purchases

**Acceptance Criteria:**
- Given: I talk to a merchant NPC
- When: I select an item to sell
- Then: I receive gold AND the item is removed

## Key Entities

### Item
```typescript
interface Item {
  id: number;
  type: ItemType;       // weapon, armor, consumable
  kind: number;         // sprite/base type
  rarity: Rarity;       // common, uncommon, rare, epic, legendary
  name: string;         // generated or override
  properties: ItemProperties;
  level: number;        // required level
  value: number;        // sell price
}

interface ItemProperties {
  // Weapons
  damageMin?: number;
  damageMax?: number;
  attackSpeed?: number;

  // Armor
  defense?: number;

  // Bonus stats (random rolls)
  bonusHealth?: number;
  bonusStrength?: number;
  bonusCritChance?: number;

  // Special effects
  effects?: ItemEffect[];
}
```

### Rarity
```typescript
enum Rarity {
  COMMON = 'common',      // White, 70% drop rate
  UNCOMMON = 'uncommon',  // Green, 20% drop rate
  RARE = 'rare',          // Blue, 7% drop rate
  EPIC = 'epic',          // Purple, 2.5% drop rate
  LEGENDARY = 'legendary' // Orange, 0.5% drop rate
}
```

## Functional Requirements

- FR-001: Items must generate with random stats within defined ranges
- FR-002: Rarity must affect stat ranges and bonus property count
- FR-003: Item tooltips must show all properties clearly
- FR-004: Server must be authoritative for all item generation
- FR-005: Existing items must migrate to new system gracefully

## Success Criteria

- SC-001: Players report "loot feels exciting" in feedback
- SC-002: Average session length increases by 20%
- SC-003: Item comparison reduces "accidental downgrades" to near-zero

## Dependencies

- Requires: 000-foundation (EventBus for item events)
- Enables: 003-economy-system (item values for trading)

## Open Questions

- [NEEDS CLARIFICATION] Should items be destroyable/droppable by players?
- [NEEDS CLARIFICATION] Inventory size limit?
- [NEEDS CLARIFICATION] Item set bonuses for matching rarity/type?
