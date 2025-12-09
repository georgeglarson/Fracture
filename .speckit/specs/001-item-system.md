# 001: Item System

**Status:** Implemented
**Priority:** High
**Dependencies:** None

## Overview

Enhanced items with properties, rarity tiers, and comparison tooltips to make loot feel meaningful.

## What Was Built

### Rarity System

5 tiers with distinct colors (WoW-style):

```typescript
enum Rarity {
  COMMON = 'common',      // #ffffff (White)
  UNCOMMON = 'uncommon',  // #1eff00 (Green)
  RARE = 'rare',          // #0070dd (Blue)
  EPIC = 'epic',          // #a335ee (Purple)
  LEGENDARY = 'legendary' // #ff8000 (Orange)
}
```

### Item Properties

Items now have generated properties:

```typescript
interface ItemProperties {
  rarity: Rarity;
  level: number;
  category: 'weapon' | 'armor' | 'consumable';

  // Weapons
  damageMin?: number;
  damageMax?: number;

  // Armor
  defense?: number;

  // Consumables
  healAmount?: number;

  // Bonus stats (random rolls)
  bonusHealth?: number;
  bonusStrength?: number;
  bonusCritChance?: number;
}
```

### Network Serialization

Compact serialization for bandwidth efficiency:

```typescript
// Server sends
{ r: 'rare', l: 3, c: 'weapon', dMin: 8, dMax: 15, bStr: 2 }

// Instead of full property names
{ rarity: 'rare', level: 3, category: 'weapon', damageMin: 8, damageMax: 15, bonusStrength: 2 }
```

### Item Tooltips

Hover over items on ground to see:
- Item name with rarity color
- Damage/defense stats
- Bonus properties (green/red/yellow colored)
- Comparison vs equipped weapon (↑/↓ damage diff)
- "Click to pick up" hint

### Drop System

Press `D` to drop equipped weapon (reverts to default sword1).

## Files Created

- `shared/ts/items/item-types.ts` - Core types, serialization
- `shared/ts/items/index.ts` - Re-exports
- `client/ts/ui/item-tooltip.ts` - Tooltip component
- `shared/ts/equipment/equipment-types.ts` - Slot abstraction

## Files Modified

- `server/ts/player.ts` - Drop handling via EquipmentManager
- `client/ts/game.ts` - ItemTooltip integration, drop key binding
- `client/ts/input/input-manager.ts` - Mouse hover tracking
- `shared/ts/gametypes.ts` - getWeaponRank helper

## What Works

- [x] Items have rarity (visually colored on ground)
- [x] Items have properties (damage, defense, bonuses)
- [x] Hover shows tooltip with full stats
- [x] Comparison shows upgrade/downgrade vs equipped
- [x] Drop key (D) drops current weapon
- [x] Properties serialize/deserialize over network

## What's Missing (Future)

- [ ] Inventory system (carry multiple items)
- [ ] Mob-specific drop tables
- [ ] Area-specific loot scaling
- [ ] Item durability/repair
- [ ] Set bonuses

## Testing Checklist

- [x] Kill mob -> item drops with rarity color
- [x] Hover over item -> tooltip appears
- [x] Tooltip shows damage range for weapons
- [x] Tooltip shows comparison vs equipped
- [x] Pick up item -> equip if better
- [x] Press D -> weapon dropped, sword1 equipped
