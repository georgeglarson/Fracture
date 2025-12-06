# 002: Progression System

> Status: DRAFT
> Priority: P1 (Core Loop)

## Problem Statement

Players currently have no persistent progression beyond their current session's equipment. There's no sense of growth, no goals to work toward, and no reason to return.

## User Stories

### US-001 [P1]: Experience & Levels
**As a** player
**I want** to earn experience from kills and quests
**So that** I can level up and become stronger

**Acceptance Criteria:**
- Given: I kill a mob
- When: It dies
- Then: I receive XP based on mob difficulty AND see XP gain notification

- Given: I complete a quest
- When: The reward is given
- Then: I receive bonus XP AND the XP is larger than regular kills

### US-002 [P1]: Level-Based Stats
**As a** player
**I want** my stats to increase when I level up
**So that** I can fight stronger enemies and access new areas

**Acceptance Criteria:**
- Given: I have enough XP to level up
- When: The level up triggers
- Then: My max HP increases AND my base damage increases AND I see a celebration effect

### US-003 [P2]: Skill Points
**As a** player
**I want** to spend skill points on abilities
**So that** I can customize my playstyle

**Acceptance Criteria:**
- Given: I level up
- When: I receive skill points
- Then: I can allocate them to different ability trees

### US-004 [P2]: Character Persistence
**As a** player
**I want** my progress to save when I leave
**So that** I can continue my adventure later

**Acceptance Criteria:**
- Given: I have played and leveled up
- When: I return to the game later
- Then: My level, XP, equipment, and position are restored

### US-005 [P3]: Leaderboards
**As a** player
**I want** to see how I rank against other players
**So that** I have competitive goals

**Acceptance Criteria:**
- Given: The leaderboard exists
- When: I view it
- Then: I see rankings by level, kills, quests completed

## Key Entities

### PlayerProgression
```typescript
interface PlayerProgression {
  id: string;           // unique player ID
  level: number;
  currentXp: number;
  totalXp: number;

  // Derived stats (level-based)
  maxHp: number;
  baseDamage: number;
  baseDefense: number;

  // Skill points
  skillPoints: number;
  allocatedSkills: Record<SkillId, number>;

  // Tracking
  totalKills: number;
  questsCompleted: number;
  deaths: number;
  playTime: number;     // seconds
}
```

### Level Curve
```typescript
// XP required for each level
function xpForLevel(level: number): number {
  // Exponential curve: each level requires ~15% more XP
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

// Level 1:  100 XP
// Level 5:  175 XP
// Level 10: 350 XP
// Level 20: 1,400 XP
// Level 50: 25,000 XP
```

### XP Sources
```typescript
interface XpReward {
  mobKill: (mobLevel: number, playerLevel: number) => number;
  questComplete: (questDifficulty: string) => number;
  bossKill: (bossType: string) => number;
  achievementUnlock: (achievementTier: string) => number;
}
```

## Functional Requirements

- FR-001: XP must be calculated server-side (anti-cheat)
- FR-002: Level-up must broadcast to nearby players (social)
- FR-003: Stats must recalculate immediately on level-up
- FR-004: Progress must persist via player save system
- FR-005: XP penalty for killing mobs far below player level

## Success Criteria

- SC-001: Player retention (day 7) increases by 40%
- SC-002: Average session length increases
- SC-003: Players report "feeling progression" in feedback

## Dependencies

- Requires: 000-foundation (EventBus for level events)
- Enables: 001-item-system (level requirements for items)
- Enables: AI scaling (mobs react to player level)

## Open Questions

- [NEEDS CLARIFICATION] Level cap? (Suggest: 100)
- [NEEDS CLARIFICATION] Prestige/rebirth system at max level?
- [NEEDS CLARIFICATION] Skill tree depth vs breadth?
