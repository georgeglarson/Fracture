# 030: Combat Skills

> Status: DRAFT
> Priority: P1 (Core Loop Enhancement)

## Problem Statement

Combat is currently one-dimensional: click mob, auto-attack until dead. There's no skill expression, no strategic depth, and no "cool moments." Players have zero agency in *how* they fight - only *what* they fight.

## User Stories

### US-001 [P1]: Active Abilities
**As a** player
**I want** to activate special combat abilities on cooldown
**So that** I have meaningful decisions to make during fights

**Acceptance Criteria:**
- Given: I'm in combat
- When: I press a skill hotkey (1-4)
- Then: The ability activates with visual feedback AND goes on cooldown

### US-002 [P1]: Ability Hotbar
**As a** player
**I want** a visible hotbar showing my abilities and cooldowns
**So that** I know what's available and when abilities will be ready

**Acceptance Criteria:**
- Given: I'm playing the game
- When: I look at the UI
- Then: I see 4 ability slots with icons, keybinds, and cooldown overlays

### US-003 [P2]: Skill Unlocking
**As a** player
**I want** to unlock new abilities as I level up
**So that** leveling feels impactful beyond stat increases

**Acceptance Criteria:**
- Given: I reach level 5/10/15/20
- When: I level up
- Then: A new ability unlocks AND I receive a notification

### US-004 [P2]: Skill Effects
**As a** player
**I want** abilities to have satisfying visual and audio feedback
**So that** using them feels powerful and impactful

**Acceptance Criteria:**
- Given: I use an ability
- When: It activates
- Then: I see particle effects AND hear a sound effect

## Key Entities

### Skill
```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  cooldown: number;          // seconds
  manaCost: number;          // future-proofing for mana system
  unlockLevel: number;
  type: SkillType;
  execute: (player: Player, target?: Entity) => void;
}

enum SkillType {
  OFFENSIVE = 'offensive',   // Deals damage
  DEFENSIVE = 'defensive',   // Blocks/heals
  MOBILITY = 'mobility',     // Movement abilities
  UTILITY = 'utility'        // Buffs/debuffs
}
```

### PlayerSkills
```typescript
interface PlayerSkills {
  equipped: [string, string, string, string];  // 4 hotbar slots
  cooldowns: Map<string, number>;              // skill -> ready timestamp
  unlocked: string[];                          // all unlocked skill IDs
}
```

## Initial Skill Set (MVP)

### Level 5: Dash (Mobility)
- **Effect**: Instantly move 3 tiles in facing direction
- **Cooldown**: 8 seconds
- **Use case**: Escape dangerous situations, close gaps to ranged enemies

### Level 10: Power Strike (Offensive)
- **Effect**: Next attack deals 200% damage
- **Cooldown**: 12 seconds
- **Use case**: Burst damage for tough enemies, finishing blows

### Level 15: War Cry (Utility)
- **Effect**: Stun all enemies within 2-tile radius for 1.5 seconds
- **Cooldown**: 20 seconds
- **Use case**: Crowd control when surrounded, interrupt boss attacks

### Level 20: Whirlwind (Offensive)
- **Effect**: Deal 75% weapon damage to all enemies within 1-tile radius
- **Cooldown**: 15 seconds
- **Use case**: AOE damage for mob clearing

## Functional Requirements

- FR-001: Skills must be server-authoritative (no client-side damage calculation)
- FR-002: Cooldowns must persist across area transitions
- FR-003: Skill usage must broadcast to nearby players (see others' abilities)
- FR-004: Skills must work in both solo and party play
- FR-005: Hotbar must be draggable for custom arrangements (future)

## UI Requirements

### Hotbar Design
```
+---+---+---+---+
| 1 | 2 | 3 | 4 |
+---+---+---+---+
```
- Position: Bottom-center of screen, above status bar
- Size: 48x48 pixels per slot
- Cooldown: Dark overlay sweeping clockwise with remaining seconds
- Keybind: Small number in bottom-right corner

### Visual Feedback
- Ability ready: Subtle glow pulse
- On cooldown: Darkened with timer
- Activated: Brief flash/scale animation

## Technical Implementation

### Client
1. `SkillBarUI` component for hotbar rendering
2. Keyboard input handlers (1-4 keys)
3. Cooldown tracking and display
4. Skill effect particle systems

### Server
1. `SkillHandler` for ability execution
2. Cooldown validation (prevent double-casts)
3. Effect application (damage, stuns, movement)
4. Broadcast skill usage to nearby players

### Shared
1. Skill definitions (stats, descriptions)
2. Message types for skill usage/effects

## Success Criteria

- SC-001: Players use abilities at least 5x per combat encounter
- SC-002: "Combat is boring" feedback drops to near-zero
- SC-003: Average combat duration increases slightly (more tactical)
- SC-004: Players experiment with different skill loadouts

## Dependencies

- Requires: 000-foundation (EventBus for skill events)
- Requires: 002-progression-system (level-based unlocks)
- Enables: Future mana system, more advanced skills

## Open Questions

- [DECIDED] Start with 4 skills, expand later
- [NEEDS CLARIFICATION] Should skills have upgrade paths?
- [NEEDS CLARIFICATION] Should there be class-specific skills?
- [FUTURE] Mana resource system for skill costs

## Implementation Order

1. Core skill system + Dash ability (proof of concept)
2. Hotbar UI with cooldown display
3. Remaining 3 skills
4. Visual/audio polish
5. Skill unlock notifications
