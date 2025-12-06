# 001: Item System - Implementation Plan

> Vertical Slice: Random Item Properties + Rarity

## Summary

Add random properties and rarity tiers to weapon/armor drops. When a mob drops an item, it generates with randomized stats within defined ranges, and a rarity tier that affects those ranges.

## Constitution Check

- [x] Player experience first - Variable rewards create excitement
- [x] AI enhances, never blocks - No AI dependency
- [x] SRP architecture - New ItemGenerator service
- [x] TypeScript strict - All new code typed
- [x] Server authoritative - Properties generated server-side

## Technical Approach

### New Files

```
shared/ts/items/
├── item-types.ts       # Item, Rarity, ItemProperties interfaces
└── index.ts

server/ts/items/
├── item-generator.ts   # Generates items with random properties
├── item-tables.ts      # Base stats, rarity modifiers, drop weights
└── index.ts
```

### Modified Files

| File | Changes |
|------|---------|
| `server/ts/item.ts` | Add properties field to Item class |
| `server/ts/message.ts` | Extend Drop message with properties |
| `server/ts/world.ts` | Use ItemGenerator instead of raw kind |
| `client/ts/entity/objects/item.ts` | Add properties, rarity |
| `client/ts/network/gameclient.ts` | Parse extended Drop message |
| `shared/ts/gametypes.ts` | Add Rarity enum |

### Data Flow

```
Mob Dies
  ↓
World.getDroppedItem(mob)
  ↓ (NEW)
ItemGenerator.generate(itemKind, mobLevel)
  ├─ Roll rarity (weighted random)
  ├─ Calculate base stats for item kind
  ├─ Apply rarity multipliers
  ├─ Roll bonus properties (count based on rarity)
  └─ Return Item with full properties
  ↓
Messages.Drop now includes properties
  ↓
Client creates Item with properties
  ↓
Display: Name color by rarity, tooltip with stats
```

### Rarity System

| Rarity | Color | Drop Rate | Stat Multiplier | Bonus Props |
|--------|-------|-----------|-----------------|-------------|
| Common | White | 70% | 1.0x | 0 |
| Uncommon | Green | 20% | 1.15x | 0-1 |
| Rare | Blue | 7% | 1.3x | 1-2 |
| Epic | Purple | 2.5% | 1.5x | 2-3 |
| Legendary | Orange | 0.5% | 2.0x | 3 |

### Item Properties Schema

```typescript
interface ItemProperties {
  // Base (all items)
  rarity: Rarity;
  level: number;

  // Weapons
  damageMin?: number;
  damageMax?: number;

  // Armor
  defense?: number;

  // Bonus stats (random rolls)
  bonusHealth?: number;      // +5 to +50 HP
  bonusStrength?: number;    // +1 to +10 damage
  bonusCritChance?: number;  // +1% to +10%
}
```

### Message Format Change

**Current DROP:**
```typescript
[DROP, mobId, itemId, itemKind, hatelistIds]
```

**New DROP:**
```typescript
[DROP, mobId, itemId, itemKind, itemProperties, hatelistIds]
// itemProperties = { rarity, level, damageMin, damageMax, ... }
```

### Client Display

1. **Item Name Color** - Based on rarity
2. **Loot Message** - Shows stats: "You pick up a Rare Steel Sword (+12-18 dmg, +5 HP)"
3. **Future: Tooltip** - Hover shows full comparison (deferred)

## Project Structure

### Source Files
```
server/ts/items/item-generator.ts    # New
server/ts/items/item-tables.ts       # New
server/ts/items/index.ts             # New
shared/ts/items/item-types.ts        # New
shared/ts/items/index.ts             # New
```

## Complexity Notes

| Decision | Rationale |
|----------|-----------|
| Properties as plain object | Simple, serializable, no class overhead |
| Rarity affects drop rate | Single roll determines rarity + stats |
| No inventory yet | Vertical slice - equip immediately |
| No persistence yet | Deferred to progression spec |

## Success Criteria

- [ ] Weapons drop with random damage ranges
- [ ] Armor drops with random defense values
- [ ] Rarity tier affects stat ranges
- [ ] Rarity shows in item name color
- [ ] Loot message shows item stats
- [ ] Build passes, no regressions

## Dependencies

- None (self-contained)

## Risks

- Message format change could break older clients
  - Mitigation: Graceful fallback if properties undefined
