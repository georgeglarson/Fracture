# 031: Equipment Sets

> Status: DRAFT
> Priority: P2 (Build Diversity)

## Problem Statement

All equipment of the same tier is functionally identical. A level 5 warrior with Golden Armor plays exactly like every other level 5 warrior with Golden Armor. There's no build identity, no playstyle customization, and no reason to hunt for specific items beyond raw stat upgrades.

## User Stories

### US-001 [P1]: Set Bonuses
**As a** player
**I want** matching equipment pieces to grant bonus effects
**So that** I have goals beyond "get highest tier" and can build toward a playstyle

**Acceptance Criteria:**
- Given: I'm wearing 2+ pieces of the same set
- When: I check my stats
- Then: I see set bonus effects applied AND a visual indicator of the active set

### US-002 [P1]: Set Discovery
**As a** player
**I want** to know what sets exist and what bonuses they provide
**So that** I can plan my gear goals

**Acceptance Criteria:**
- Given: I open my equipment panel
- When: I hover over a set item
- Then: I see the full set bonus breakdown (2pc, 3pc bonuses)

### US-003 [P2]: Set Item Drops
**As a** player
**I want** set items to drop from specific content
**So that** I have a reason to farm particular areas or bosses

**Acceptance Criteria:**
- Given: I defeat a zone boss
- When: Loot drops
- Then: There's a chance for that boss's associated set piece

### US-004 [P2]: Set Visual Identity
**As a** player
**I want** complete sets to have a unique visual appearance
**So that** other players can see my build at a glance

**Acceptance Criteria:**
- Given: I'm wearing a complete set
- When: Other players see me
- Then: I have a special glow/aura indicating my set

## Key Entities

### EquipmentSet
```typescript
interface EquipmentSet {
  id: string;
  name: string;
  description: string;
  theme: string;              // "berserker", "guardian", etc.
  pieces: {
    weapon: number;           // Entity kind
    armor: number;            // Entity kind
  };
  bonuses: SetBonus[];
  dropSources: string[];      // Boss names or zone names
  visualEffect?: string;      // Aura effect for complete set
}

interface SetBonus {
  piecesRequired: number;     // 2 or 3 (weapon + armor = 2)
  effects: BonusEffect[];
}

interface BonusEffect {
  type: 'damage' | 'defense' | 'health' | 'critChance' | 'speed' | 'special';
  value: number;              // Flat bonus or percentage
  isPercent: boolean;
  description: string;        // For UI display
}
```

## Initial Set Designs (MVP)

### Berserker's Fury (Offense)
- **Theme**: Glass cannon, high risk/high reward
- **Pieces**: Crimson Blade (weapon) + Blood Mail (armor)
- **Drop Source**: Skeleton King
- **2-Piece Bonus**: +15% damage, -10% max health
- **Visual**: Red aura pulsing with attacks

### Guardian's Resolve (Defense)
- **Theme**: Unkillable tank, slower kills
- **Pieces**: Fortress Shield (weapon) + Ironclad Plate (armor)
- **Drop Source**: Goblin Warlord
- **2-Piece Bonus**: +25% defense, +10% max health, -10% damage
- **Visual**: Golden shield shimmer

### Shadow Walker (Utility)
- **Theme**: Hit and run, mobility
- **Pieces**: Night's Edge (weapon) + Phantom Cloak (armor)
- **Drop Source**: Demon Lord
- **2-Piece Bonus**: +20% movement speed, +15% crit chance
- **Visual**: Dark smoke trail

### Dragon's Wrath (Balanced)
- **Theme**: All-rounder with fire effects
- **Pieces**: Dragonfire Blade (weapon) + Dragonscale Armor (armor)
- **Drop Source**: Bone Dragon
- **2-Piece Bonus**: +10% damage, +10% defense, attacks have 10% chance to burn
- **Visual**: Subtle flame particles

## Functional Requirements

- FR-001: Set bonuses must be calculated server-side
- FR-002: Bonuses must update immediately on equip/unequip
- FR-003: Set items must be distinguishable in inventory (border color?)
- FR-004: Set effects must stack with item properties (not replace)
- FR-005: Burn/special effects must have visible indicators

## UI Requirements

### Set Item Display
- Set items have a unique border color in inventory (purple?)
- Tooltip shows set name, current pieces owned, and bonus tiers
- Equipped set pieces show which bonus tier is active

### Equipment Panel Enhancement
- "Sets" tab showing discovered sets
- Progress indicator per set (0/2, 1/2, 2/2)
- Grayed out for undiscovered sets (mystery effect)

## Technical Implementation

### New Entity Types
- Add new weapon/armor kinds for each set piece
- Configure in gametypes.ts following existing pattern

### Set Tracking
```typescript
// In player state
interface PlayerSetState {
  activeSets: Map<string, number>;  // setId -> pieces worn
  discoveredSets: string[];         // for UI
}
```

### Bonus Application
- Calculate on equipment change
- Store effective stats separate from base stats
- Broadcast set state to client for visual effects

## Success Criteria

- SC-001: Players actively farm specific bosses for set pieces
- SC-002: Multiple viable "builds" emerge in player discussions
- SC-003: "All gear feels the same" feedback eliminated
- SC-004: Players show off complete sets (social proof of engagement)

## Dependencies

- Requires: 001-item-system (item properties infrastructure)
- Requires: Zone bosses (drop sources)
- Enhances: 032-boss-loot (gives bosses purpose)

## Open Questions

- [DECIDED] 2-piece sets only for MVP (weapon + armor)
- [NEEDS CLARIFICATION] Should sets be tradeable?
- [FUTURE] 3+ piece sets with ring/amulet slots
- [FUTURE] Set collection achievements

## Implementation Order

1. Define set items in gametypes.ts
2. Implement set bonus calculation
3. Add set items to boss drop tables
4. Update item tooltip for set info
5. Add visual effects for complete sets
6. Sets discovery UI
