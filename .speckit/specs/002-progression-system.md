# 002: Progression System

**Status:** Draft
**Priority:** High
**Dependencies:** None (builds on existing combat system)

## Overview

Add XP-based leveling to give players a sense of progression beyond just equipment. Killing mobs grants XP, and leveling up increases base stats.

## Current System

Currently player power is 100% equipment-based:
- `damage = weaponLevel * (5-10) - armorLevel * (1-3)`
- `maxHP = 80 + (armorLevel-1) * 30`

No persistent progression - all players start equal.

## Proposed System

### XP and Levels

```typescript
interface PlayerProgression {
  level: number;      // 1-20
  xp: number;         // Current XP
  xpToNext: number;   // XP needed for next level
}
```

**XP Formula:**
```typescript
// XP to reach next level (exponential curve)
xpToNext(level) = Math.floor(100 * Math.pow(1.5, level - 1))

// Level 1->2: 100 XP
// Level 2->3: 150 XP
// Level 3->4: 225 XP
// Level 5->6: 506 XP
// Level 10->11: 3844 XP
// Level 19->20: 153,746 XP
```

**XP from Mobs:**
```typescript
// Based on mob's armorLevel (toughness indicator)
xpFromMob(mob) = mob.armorLevel * 10 + randomInt(0, 5)

// rat (level 1): ~10-15 XP
// skeleton (level 2): ~20-25 XP
// ogre (level 3): ~30-35 XP
// boss (level 5): ~50-55 XP
```

### Level Bonuses

Each level provides flat bonuses to base stats:

```typescript
// Bonus HP per level (on top of armor HP)
bonusHP(level) = (level - 1) * 10

// Bonus damage per level (added to weapon damage)
bonusDamage(level) = (level - 1) * 2

// Updated formulas:
maxHP = 80 + (armorLevel-1)*30 + bonusHP(level)
damage = (weaponLevel * rand(5,10) + bonusDamage(level)) - (armorLevel * rand(1,3))
```

**Example at Level 10:**
- +90 HP (on top of armor)
- +18 damage per hit

### UI Elements

1. **XP Bar** - Below health bar, shows progress to next level
2. **Level Display** - Show "Lv.X" next to player name
3. **Level Up Effect** - Flash/particles when leveling up
4. **XP Gain Popup** - "+15 XP" floating text on kills

### Messages

New message types:
```typescript
XP_GAIN = 41      // [41, amount, currentXP, xpToNext]
LEVEL_UP = 42     // [42, newLevel, bonusHP, bonusDamage]
```

### Persistence

Player XP/level saved to localStorage (client-side, like current name/equipment).

```typescript
// In app.storage.data.player
{
  name: "gerg",
  level: 5,
  xp: 340,
  // ... existing fields
}
```

On reconnect, send level with HELLO message. Server validates and applies bonuses.

## Implementation Phases

### Phase 1: Core XP System (Server)
- [ ] Add `level`, `xp`, `xpToNext` to Player class
- [ ] Add `grantXP(amount)` method
- [ ] Update mob death handler to call `grantXP`
- [ ] Add XP_GAIN and LEVEL_UP message types
- [ ] Update Formulas to include level bonuses

### Phase 2: Client Display
- [ ] Add XP bar UI element
- [ ] Show level next to player name
- [ ] Handle XP_GAIN message (update bar, show popup)
- [ ] Handle LEVEL_UP message (play effect, update stats)

### Phase 3: Persistence
- [ ] Save level/xp to localStorage on XP gain
- [ ] Load level/xp on game start
- [ ] Send level in HELLO message
- [ ] Server validates and restores level

## Testing Checklist

- [ ] Kill rat -> gain ~10-15 XP
- [ ] XP bar fills up visually
- [ ] Level up at 100 XP -> show effect
- [ ] HP increases after level up
- [ ] Damage increases after level up
- [ ] Refresh page -> level persists
- [ ] New character starts at level 1

## Non-Goals (Future Specs)

- Skill trees / abilities
- Class system
- Stat point allocation
- Prestige / rebirth system

## Open Questions

1. Should death cause XP loss? (Suggest: No, keep it casual)
2. Max level 20 or higher? (Suggest: 20, with boss scaling later)
3. Show other players' levels? (Suggest: Yes, above their heads)
