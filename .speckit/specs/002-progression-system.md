# 002: Progression System

**Status:** Implemented
**Priority:** High
**Dependencies:** None

## Overview

XP/Level progression system that rewards combat with experience points, level ups, and stat bonuses.

## What Was Built

### XP System

Players earn XP from killing mobs, with XP scaling based on mob difficulty:

```typescript
// Base XP formula (server/ts/formulas.ts)
xpForMob(mobKind: number): number {
  const baseDamage = Formulas.dmg(mobKind);
  return Math.floor(baseDamage * 2.5);
}
```

### Level System

- Max level: 10
- XP to next level scales with current level
- Level bonuses to damage and health

```typescript
// XP requirement per level
xpToLevel(level: number): number {
  return level * 100;  // Level 1→2 = 100 XP, Level 9→10 = 900 XP
}

// Combat bonuses per level
levelBonus(level: number): { damage: number; health: number } {
  return {
    damage: Math.floor(level * 1.5),
    health: level * 10
  };
}
```

### Network Messages

Two dedicated message types for progression:

```typescript
enum Messages {
  XP_GAIN = 41,   // [XP_GAIN, amount, currentXp, xpToNext]
  LEVEL_UP = 42   // [LEVEL_UP, newLevel, xpToNext, newMaxHp]
}
```

### XP Bar UI

Visual XP progress bar below the health bar:

- Green gradient fill (`#4a0` to `#6c0`)
- Level display (e.g., "Lv.3")
- Smooth width transition on XP gain
- Scales with screen resolution (3 media query breakpoints)

### Client Feedback

- **Floating text**: "+X XP" appears above player on kill
- **Level up notification**: "You are now level X!" message
- **Sound effect**: Level up audio cue
- **Visual bar**: XP bar fills and updates in real-time

### Persistence

Progress saved to localStorage:

```typescript
interface SavedProgression {
  level: number;
  xp: number;
  xpToNext: number;
}
```

Restored on reconnect via `storage.loadProgression()`.

## Files Modified

### Server
- `server/ts/player.ts` - level, xp, xpToNext fields; grantXP() method
- `server/ts/formulas.ts` - xpForMob, xpToLevel, levelBonus functions
- `server/ts/world.ts` - grantXP call on mob death

### Client
- `client/index.html` - XP bar HTML elements (#xpbar, #xpfill, #level-display)
- `client/css/main.css` - XP bar styling (3 scale breakpoints)
- `client/ts/app.ts` - initXpBar() method
- `client/ts/main.ts` - initXpBar() call on game start
- `client/ts/game.ts` - onPlayerXpChange callback, playerxp_callback
- `client/ts/network/message-handlers.ts` - XP_GAIN, LEVEL_UP handlers
- `client/ts/storage/storage.ts` - saveProgression(), loadProgression()

### Shared
- `shared/ts/gametypes.ts` - Messages.XP_GAIN, Messages.LEVEL_UP

## What Works

- [x] Kill mob → earn XP
- [x] XP bar fills based on progress
- [x] Level display updates (Lv.1, Lv.2, etc.)
- [x] Level up → notification + sound
- [x] Level affects damage output
- [x] Level affects max HP
- [x] Progress persists in localStorage
- [x] Progress restored on reconnect

## What's Missing (Future)

- [ ] Skill points on level up
- [ ] Ability unlocks at certain levels
- [ ] Prestige/rebirth system
- [ ] Experience multipliers
- [ ] Party XP sharing
- [ ] Show other players' levels above their heads

## Testing Checklist

- [x] Kill rat → small XP gain
- [x] Kill skeleton → medium XP gain
- [x] Kill boss → large XP gain
- [x] XP bar visually updates
- [x] Reach 100% XP → level up triggers
- [x] Level display changes after level up
- [x] Stats improve with level
- [x] Refresh browser → progress retained
