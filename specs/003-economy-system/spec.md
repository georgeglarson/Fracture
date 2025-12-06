# 003: Economy System

> Status: DRAFT
> Priority: P2 (Engagement Multiplier)

## Problem Statement

There's no currency, no trading, no market. Players have no economic goals and no way to exchange value with each other or NPCs.

## User Stories

### US-001 [P1]: Gold Currency
**As a** player
**I want** to earn gold from kills and quests
**So that** I have resources to spend

**Acceptance Criteria:**
- Given: I kill a mob
- When: It drops loot
- Then: I also receive gold proportional to mob difficulty

### US-002 [P1]: NPC Shops
**As a** player
**I want** to buy items from merchant NPCs
**So that** I can acquire items I haven't found

**Acceptance Criteria:**
- Given: I talk to a merchant
- When: The shop interface opens
- Then: I see items for sale with prices AND can purchase if I have enough gold

### US-003 [P2]: Player Trading
**As a** player
**I want** to trade items and gold with other players
**So that** I can specialize and exchange

**Acceptance Criteria:**
- Given: I initiate trade with another player
- When: We both confirm the trade
- Then: Items and gold are exchanged atomically

### US-004 [P3]: Auction House
**As a** player
**I want** to list items for sale to all players
**So that** I can sell rare items for market value

**Acceptance Criteria:**
- Given: I list an item
- When: Another player buys it
- Then: I receive the gold (minus listing fee) AND they receive the item

### US-005 [P3]: Daily Rewards
**As a** player
**I want** to receive rewards for logging in daily
**So that** I'm incentivized to return regularly

**Acceptance Criteria:**
- Given: I log in
- When: 24 hours have passed since last reward
- Then: I receive gold/items AND streak bonus if consecutive days

## Key Entities

### Currency
```typescript
interface PlayerWallet {
  playerId: string;
  gold: number;
  premiumCurrency?: number;  // Future: cosmetics only
}
```

### Shop
```typescript
interface Shop {
  npcId: number;
  inventory: ShopItem[];
  buybackMultiplier: number;  // e.g., 0.3 = 30% of item value
}

interface ShopItem {
  itemTemplate: ItemTemplate;
  price: number;
  stock?: number;           // unlimited if undefined
  restockTime?: number;     // seconds
}
```

### Trade
```typescript
interface Trade {
  id: string;
  player1: { id: string; offer: TradeOffer };
  player2: { id: string; offer: TradeOffer };
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

interface TradeOffer {
  items: Item[];
  gold: number;
  confirmed: boolean;
}
```

## Functional Requirements

- FR-001: All currency transactions must be server-authoritative
- FR-002: Gold cannot go negative (validation required)
- FR-003: Trade must be atomic (all-or-nothing)
- FR-004: Shop prices must consider item rarity and level
- FR-005: Gold sinks must balance gold sources (prevent inflation)

## Gold Economy Balance

### Sources (Gold In)
- Mob drops: 1-10g per kill (scales with level)
- Quest rewards: 50-500g (scales with difficulty)
- Selling items: 30% of item value
- Daily login: 100g + 20g per streak day

### Sinks (Gold Out)
- Shop purchases: Full item value
- Repair costs: 10% of equipped item value
- Auction listing fee: 5% of listing price
- Fast travel: Distance-based cost

## Success Criteria

- SC-001: Gold neither inflates nor deflates over time
- SC-002: Players engage with shops (>50% make purchases)
- SC-003: Trading becomes social activity

## Dependencies

- Requires: 001-item-system (items need values)
- Requires: 002-progression-system (scaling with level)
- Enables: Future cosmetics shop

## Open Questions

- [NEEDS CLARIFICATION] Premium currency for cosmetics?
- [NEEDS CLARIFICATION] Guild banks?
- [NEEDS CLARIFICATION] Gold cap to prevent hoarding/RMT?
