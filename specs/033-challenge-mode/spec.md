# 033: Challenge Mode - Fracture Rifts

> Status: DRAFT
> Priority: P1 (Endgame Content)

## Problem Statement

Once players defeat all bosses and collect good gear, there's nothing left to do. The endgame is empty. Players need infinitely scaling content that tests their builds and provides aspirational goals. Without this, max-level players churn.

## User Stories

### US-001 [P1]: Endless Dungeon
**As a** player
**I want** an infinitely scaling challenge mode
**So that** there's always harder content to attempt

**Acceptance Criteria:**
- Given: I enter a Fracture Rift
- When: I clear waves of enemies
- Then: Each wave is harder than the last AND my progress is tracked

### US-002 [P1]: Leaderboard
**As a** player
**I want** my Rift progress to be ranked
**So that** I can compete with other players

**Acceptance Criteria:**
- Given: I complete a Rift run
- When: I check the leaderboard
- Then: I see my personal best and where I rank globally

### US-003 [P2]: Rift Modifiers
**As a** player
**I want** random modifiers that change each run
**So that** every Rift feels different and tests different strategies

**Acceptance Criteria:**
- Given: I start a new Rift
- When: I check the active modifiers
- Then: I see 1-3 random effects that change gameplay

### US-004 [P2]: Rift Rewards
**As a** player
**I want** rewards that scale with my Rift depth
**So that** pushing deeper is worthwhile beyond bragging rights

**Acceptance Criteria:**
- Given: I complete Rift depth 10
- When: I receive rewards
- Then: They're significantly better than depth 5 rewards

## Key Entities

### FractureRift
```typescript
interface FractureRift {
  id: string;
  playerId: number;
  currentDepth: number;
  maxDepthReached: number;
  startTime: number;
  modifiers: RiftModifier[];
  enemiesRemaining: number;
  isActive: boolean;
}

interface RiftModifier {
  id: string;
  name: string;
  description: string;
  effect: 'player_debuff' | 'enemy_buff' | 'environment';
  value: number;
}

interface RiftLeaderboardEntry {
  playerId: number;
  playerName: string;
  maxDepth: number;
  timestamp: number;
  buildSnapshot?: {           // Optional build showcase
    weapon: string;
    armor: string;
    set?: string;
  };
}
```

## Rift Mechanics

### Depth Scaling
- **Depth 1-5**: +10% enemy HP/damage per depth
- **Depth 6-10**: +15% per depth, enemies gain 1 modifier
- **Depth 11-20**: +20% per depth, enemies gain 2 modifiers
- **Depth 21+**: +25% per depth, boss every 5 depths

### Wave Structure
- Each depth = 1 wave of enemies
- Wave size: 3 + (depth / 3) enemies, capped at 15
- Enemy types pulled from player's level-appropriate zones
- Every 5th depth: Mini-boss with 3x HP

### Rift Modifiers (Pool)
| Modifier | Type | Effect |
|----------|------|--------|
| Frailty | Player Debuff | -20% max health |
| Sluggish | Player Debuff | -15% movement speed |
| Dulled Blade | Player Debuff | -15% damage |
| Enraged | Enemy Buff | +25% enemy damage |
| Fortified | Enemy Buff | +25% enemy HP |
| Swift | Enemy Buff | +20% enemy attack speed |
| Darkness | Environment | Reduced vision radius |
| Burning Floor | Environment | Take 1 damage/second |
| No Healing | Environment | Consumables disabled |

### Rewards
```typescript
const RIFT_REWARDS = {
  baseGold: (depth: number) => depth * 50,
  baseXP: (depth: number) => depth * 100,
  bonusLootChance: (depth: number) => Math.min(depth * 2, 50), // % for rare+
  legendaryThreshold: 15,  // Depth 15+ can drop legendaries
};
```

## Entry Point

### Rift Portal
- Location: End of lavaland zone (hardest area)
- Visual: Swirling purple portal with fracture effects
- Interaction: Click to open Rift menu

### Rift Menu
```
+---------------------------+
|    FRACTURE RIFT          |
|                           |
| Your Best: Depth 12       |
| Server Best: Depth 27     |
|                           |
| [ENTER RIFT]              |
|                           |
| Current Modifiers:        |
| - Frailty (-20% HP)       |
| - Fortified (+25% Mob HP) |
+---------------------------+
```

## Functional Requirements

- FR-001: Rift progress must not persist on death (roguelike run)
- FR-002: Modifiers must be consistent within a run
- FR-003: Leaderboard must update in real-time
- FR-004: Rifts must be soloable (no party requirement)
- FR-005: Rift area must be instanced (separate from main world)

## UI Requirements

### In-Rift HUD
- Current depth counter (large, centered top)
- Enemies remaining in wave
- Active modifiers (icons with tooltips)
- Timer (for speedrun leaderboard variant)

### Death Screen
```
RIFT COLLAPSED

Depth Reached: 14
Personal Best: 14 (NEW!)

Rewards:
- 700 Gold
- 1,400 XP
- 1x Rare Armor

[RETURN TO WORLD] [TRY AGAIN]
```

### Leaderboard Panel
- Accessible from main menu or Rift portal
- Shows top 20 + your position
- Filters: All-time, This Week, Today
- Optional: Link to view player's build

## Technical Implementation

### Rift Instance
- Separate map area (rift-arena.json)
- Server tracks active rifts per player
- No persistence between runs
- On death: Transfer back to main world

### Scaling System
```typescript
function getEnemyStats(baseKind: number, depth: number): EnemyStats {
  const base = MOB_STATS[baseKind];
  const multiplier = getRiftMultiplier(depth);
  return {
    hp: Math.floor(base.hp * multiplier.hp),
    damage: Math.floor(base.damage * multiplier.damage),
    // ... etc
  };
}

function getRiftMultiplier(depth: number): { hp: number; damage: number } {
  if (depth <= 5) return { hp: 1 + depth * 0.1, damage: 1 + depth * 0.1 };
  if (depth <= 10) return { hp: 1.5 + (depth - 5) * 0.15, damage: 1.5 + (depth - 5) * 0.15 };
  // ... progressive scaling
}
```

### Leaderboard Storage
- SQLite table: `rift_leaderboard`
- Fields: player_id, max_depth, timestamp, build_json
- Indexed on max_depth for fast top-N queries

## Success Criteria

- SC-001: Max-level players have reason to keep playing
- SC-002: Leaderboard creates competitive engagement
- SC-003: Players discuss "builds for pushing rifts"
- SC-004: "Nothing to do at endgame" feedback eliminated

## Dependencies

- Requires: 030-combat-skills (skills needed for high depths)
- Requires: 031-equipment-sets (builds for optimization)
- Requires: 032-boss-loot (legendary gear for pushing)
- Enables: Future seasonal resets, tournaments

## Open Questions

- [DECIDED] Solo-only for MVP (party rifts future)
- [NEEDS CLARIFICATION] Should modifiers be choosable or random?
- [NEEDS CLARIFICATION] Weekly reset for fresh competition?
- [FUTURE] Timed mode for speedrun leaderboard

## Implementation Order

1. Create rift arena map
2. Implement wave spawning system
3. Add depth scaling calculations
4. Implement death/exit handling
5. Rift portal entry point
6. Leaderboard storage and UI
7. Modifier system
8. Reward calculations
9. Polish (effects, sounds, announcements)
