# 032: Boss Loot System

> Status: DRAFT
> Priority: P1 (Endgame Purpose)

## Problem Statement

Bosses currently drop the same loot as regular mobs - just more of it. There's no reason to specifically hunt bosses beyond slightly better odds. This wastes the most exciting content in the game. Players should feel anticipation when facing a boss, knowing unique rewards are on the line.

## User Stories

### US-001 [P1]: Unique Legendary Drops
**As a** player
**I want** bosses to drop legendary items that can't be found elsewhere
**So that** I have a reason to seek out and defeat challenging bosses

**Acceptance Criteria:**
- Given: I defeat a boss
- When: Loot drops
- Then: There's a chance for boss-exclusive legendary items with unique effects

### US-002 [P1]: Boss Loot Table Visibility
**As a** player
**I want** to know what each boss can drop
**So that** I can choose which boss to farm based on my goals

**Acceptance Criteria:**
- Given: I encounter a boss
- When: I inspect it (or hover/right-click)
- Then: I see a preview of its possible unique drops

### US-003 [P2]: First Kill Bonus
**As a** player
**I want** extra rewards for defeating a boss for the first time
**So that** progression through content feels rewarding

**Acceptance Criteria:**
- Given: I defeat a boss I've never killed
- When: Loot drops
- Then: I receive guaranteed bonus loot AND an achievement

### US-004 [P2]: Drop Announcement
**As a** player
**I want** legendary drops to be announced server-wide
**So that** rare drops feel special and create social moments

**Acceptance Criteria:**
- Given: A legendary item drops from a boss
- When: A player loots it
- Then: All players see an announcement in chat

## Key Entities

### BossLootTable
```typescript
interface BossLootTable {
  bossKind: number;
  guaranteedDrops: LootEntry[];     // Always drops
  uniqueDrops: UniqueLootEntry[];   // Boss-exclusive legendaries
  firstKillBonus: LootEntry[];      // Extra drops on first kill
}

interface LootEntry {
  kind: number;
  rarity: Rarity;
  dropChance: number;               // 0-1
  properties?: ItemProperties;       // Override for guaranteed stats
}

interface UniqueLootEntry extends LootEntry {
  name: string;                     // Unique item name
  description: string;              // Flavor text
  specialEffect?: SpecialEffect;    // Unique ability
  isAnnounced: boolean;            // Show server-wide message
}

interface SpecialEffect {
  type: 'onHit' | 'onKill' | 'passive' | 'active';
  effect: string;                   // e.g., "lifesteal", "explode"
  value: number;
  description: string;
}
```

## Boss-Exclusive Legendaries (MVP)

### Skeleton King - "Crown of the Undying"
- **Slot**: Armor (special variant)
- **Base Stats**: Defense 8, +30 Health
- **Special Effect**: On death, revive with 25% HP once per 5 minutes
- **Drop Chance**: 5%
- **Flavor**: *"Even death could not hold its previous owner."*

### Goblin Warlord - "Greed's Edge"
- **Slot**: Weapon
- **Base Stats**: 15-25 damage
- **Special Effect**: +50% gold from kills while equipped
- **Drop Chance**: 8%
- **Flavor**: *"The Warlord's obsession, forged in molten gold."*

### Bone Dragon - "Dragonbone Cleaver"
- **Slot**: Weapon
- **Base Stats**: 20-35 damage
- **Special Effect**: 10% chance to deal double damage (proc shown visually)
- **Drop Chance**: 4%
- **Flavor**: *"Carved from the spine of an ancient wyrm."*

### Demon Lord - "Hellfire Mantle"
- **Slot**: Armor
- **Base Stats**: Defense 10, +20 Health
- **Special Effect**: Enemies that hit you take 5 fire damage
- **Drop Chance**: 3%
- **Flavor**: *"Burns with the rage of a thousand damned souls."*

### Sand Wurm - "Sandstorm Fang"
- **Slot**: Weapon
- **Base Stats**: 12-22 damage, +15% attack speed
- **Special Effect**: 15% chance to blind enemy for 1 second (miss their attack)
- **Drop Chance**: 6%
- **Flavor**: *"Strike like the desert wind - unseen and unstoppable."*

### Giant Crab - "Tidal Bulwark" (Shell Armor)
- **Slot**: Armor
- **Base Stats**: Defense 12
- **Special Effect**: Block first hit of every combat (3s cooldown)
- **Drop Chance**: 7%
- **Flavor**: *"Impenetrable as the depths from whence it came."*

## Functional Requirements

- FR-001: Unique items must be truly unique (not random properties)
- FR-002: Special effects must be server-authoritative
- FR-003: First-kill tracking must persist across sessions
- FR-004: Drop announcements must include player name and item
- FR-005: Items must be visually distinct (unique sprites or effects)

## UI Requirements

### Boss Inspect Panel
- Shows boss name, level, and HP
- Lists possible unique drops with icons
- Indicates if you've killed this boss before

### Legendary Drop Notification
```
[LEGENDARY] PlayerName obtained Dragonbone Cleaver from Bone Dragon!
```
- Golden text with particle effect
- Audible chime for all players

### Item Tooltip Enhancement
- Special effects shown in gold text
- Flavor text in italics
- "Boss Drop" tag

## Technical Implementation

### Boss Loot Tables
```typescript
// In boss-loot.ts
export const BOSS_LOOT_TABLES: Record<number, BossLootTable> = {
  [Types.Entities.SKELETONKING]: {
    bossKind: Types.Entities.SKELETONKING,
    guaranteedDrops: [
      { kind: Types.Entities.FLASK, rarity: Rarity.RARE, dropChance: 1 }
    ],
    uniqueDrops: [
      {
        kind: Types.Entities.CROWN_OF_UNDYING, // New entity type
        name: "Crown of the Undying",
        rarity: Rarity.LEGENDARY,
        dropChance: 0.05,
        specialEffect: { type: 'passive', effect: 'revive', value: 0.25 },
        isAnnounced: true
      }
    ],
    firstKillBonus: [
      { kind: Types.Entities.GOLDENSWORD, rarity: Rarity.EPIC, dropChance: 1 }
    ]
  }
};
```

### Special Effect System
- Effects stored in item properties
- Evaluated by combat system on relevant triggers
- Client displays effect procs with particles/sounds

## Success Criteria

- SC-001: Boss farming becomes primary endgame activity
- SC-002: Legendary drops create memorable moments (shared in chat/Discord)
- SC-003: Players set goals around specific legendary items
- SC-004: First-kill bonus encourages exploring all bosses

## Dependencies

- Requires: Zone bosses (already implemented)
- Requires: 001-item-system (item properties)
- Enhances: 031-equipment-sets (sets drop from bosses)
- Enables: 033-challenge-mode (harder content for better loot)

## Open Questions

- [DECIDED] 6 legendaries for 6 bosses (MVP)
- [NEEDS CLARIFICATION] Should legendaries be tradeable?
- [NEEDS CLARIFICATION] Duplicate protection or pure RNG?
- [FUTURE] Upgrade system for legendaries

## Implementation Order

1. Define new legendary item entity types
2. Create unique sprites for legendary items
3. Implement boss loot table system
4. Add first-kill tracking
5. Implement special effects in combat
6. Add legendary drop announcements
7. Boss inspect UI for loot preview
