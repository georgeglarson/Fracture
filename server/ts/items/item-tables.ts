/**
 * Item Tables - Base stats, rarity weights, and modifiers
 */

import { Types } from '../../../shared/ts/gametypes.js';
import { Rarity, ItemCategory } from '../../../shared/ts/items/index.js';

/**
 * Base weapon stats (at rank, before rarity multiplier)
 * Rank determines progression: higher rank = stronger base stats
 */
export interface WeaponBaseStats {
  damageMin: number;
  damageMax: number;
  displayName: string;
}

export const WeaponStats: Record<number, WeaponBaseStats> = {
  [Types.Entities.SWORD1]: {
    damageMin: 3,
    damageMax: 6,
    displayName: 'Wooden Sword'
  },
  [Types.Entities.SWORD2]: {
    damageMin: 5,
    damageMax: 10,
    displayName: 'Steel Sword'
  },
  [Types.Entities.AXE]: {
    damageMin: 7,
    damageMax: 14,
    displayName: 'Battle Axe'
  },
  [Types.Entities.MORNINGSTAR]: {
    damageMin: 10,
    damageMax: 18,
    displayName: 'Morning Star'
  },
  [Types.Entities.BLUESWORD]: {
    damageMin: 14,
    damageMax: 24,
    displayName: 'Sapphire Sword'
  },
  [Types.Entities.REDSWORD]: {
    damageMin: 18,
    damageMax: 30,
    displayName: 'Ruby Sword'
  },
  [Types.Entities.GOLDENSWORD]: {
    damageMin: 24,
    damageMax: 40,
    displayName: 'Golden Sword'
  },
  // Dimension Weapons - from fractured realities
  [Types.Entities.MP5]: {
    damageMin: 12,
    damageMax: 20,
    displayName: 'MP5'
  },
  [Types.Entities.RAYGUN]: {
    damageMin: 14,
    damageMax: 24,
    displayName: 'Ray Gun'
  },
  [Types.Entities.TENTACLE]: {
    damageMin: 16,
    damageMax: 26,
    displayName: 'Void Tentacle'
  },
  [Types.Entities.CRYSTALSTAFF]: {
    damageMin: 20,
    damageMax: 34,
    displayName: 'Crystal Staff'
  },
  [Types.Entities.VOIDBLADE]: {
    damageMin: 22,
    damageMax: 36,
    displayName: 'Void Blade'
  },
  [Types.Entities.PLASMAHELIX]: {
    damageMin: 26,
    damageMax: 42,
    displayName: 'Plasma Helix'
  }
};

/**
 * Base armor stats
 */
export interface ArmorBaseStats {
  defense: number;
  displayName: string;
}

export const ArmorStats: Record<number, ArmorBaseStats> = {
  [Types.Entities.CLOTHARMOR]: {
    defense: 1,
    displayName: 'Cloth Armor'
  },
  [Types.Entities.LEATHERARMOR]: {
    defense: 2,
    displayName: 'Leather Armor'
  },
  [Types.Entities.MAILARMOR]: {
    defense: 4,
    displayName: 'Mail Armor'
  },
  [Types.Entities.PLATEARMOR]: {
    defense: 6,
    displayName: 'Plate Armor'
  },
  [Types.Entities.REDARMOR]: {
    defense: 8,
    displayName: 'Ruby Armor'
  },
  [Types.Entities.GOLDENARMOR]: {
    defense: 10,
    displayName: 'Golden Armor'
  },
  // Dimension Armor - from fractured realities
  [Types.Entities.VOIDCLOAK]: {
    defense: 5,
    displayName: 'Void Cloak'
  },
  [Types.Entities.SHIELDBUBBLE]: {
    defense: 7,
    displayName: 'Shield Bubble'
  },
  [Types.Entities.CRYSTALSHELL]: {
    defense: 9,
    displayName: 'Crystal Shell'
  },
  [Types.Entities.MECHARMOR]: {
    defense: 11,
    displayName: 'Mech Armor'
  }
};

/**
 * Consumable stats
 */
export interface ConsumableBaseStats {
  healAmount?: number;
  displayName: string;
  // Special effects handled separately
}

export const ConsumableStats: Record<number, ConsumableBaseStats> = {
  [Types.Entities.FLASK]: {
    healAmount: 40,
    displayName: 'Health Potion'
  },
  [Types.Entities.BURGER]: {
    healAmount: 100,
    displayName: 'Burger'
  },
  [Types.Entities.CAKE]: {
    healAmount: 60,
    displayName: 'Cake'
  },
  [Types.Entities.FIREPOTION]: {
    displayName: 'Fire Potion'
    // Special effect: invincibility
  }
};

/**
 * Rarity weights (must sum to 100)
 */
export const RarityWeights: Record<Rarity, number> = {
  [Rarity.COMMON]: 70,
  [Rarity.UNCOMMON]: 20,
  [Rarity.RARE]: 7,
  [Rarity.EPIC]: 2.5,
  [Rarity.LEGENDARY]: 0.5
};

/**
 * Rarity stat multipliers
 */
export const RarityMultipliers: Record<Rarity, number> = {
  [Rarity.COMMON]: 1.0,
  [Rarity.UNCOMMON]: 1.15,
  [Rarity.RARE]: 1.3,
  [Rarity.EPIC]: 1.5,
  [Rarity.LEGENDARY]: 2.0
};

/**
 * Number of bonus properties by rarity
 */
export const RarityBonusCount: Record<Rarity, { min: number; max: number }> = {
  [Rarity.COMMON]: { min: 0, max: 0 },
  [Rarity.UNCOMMON]: { min: 0, max: 1 },
  [Rarity.RARE]: { min: 1, max: 2 },
  [Rarity.EPIC]: { min: 2, max: 3 },
  [Rarity.LEGENDARY]: { min: 3, max: 3 }
};

/**
 * Bonus property ranges (scaled by item level)
 */
export interface BonusPropertyRange {
  min: number;
  max: number;
}

export const BonusPropertyRanges: Record<string, BonusPropertyRange> = {
  bonusHealth: { min: 5, max: 50 },
  bonusStrength: { min: 1, max: 10 },
  bonusCritChance: { min: 1, max: 10 }
};

/**
 * Get item category from kind
 */
export function getItemCategory(kind: number): ItemCategory | null {
  if (Types.isWeapon(kind)) return 'weapon';
  if (Types.isArmor(kind)) return 'armor';
  if (Types.isObject(kind) && !Types.isChest(kind)) return 'consumable';
  return null;
}

/**
 * Get item level based on kind (approximation based on progression)
 */
export function getItemLevel(kind: number): number {
  if (Types.isWeapon(kind)) {
    return Types.getWeaponRank(kind) + 1;
  }
  if (Types.isArmor(kind)) {
    return Types.getArmorRank(kind) + 1;
  }
  return 1;
}

/**
 * Get display name for an item kind
 */
export function getDisplayName(kind: number): string {
  if (WeaponStats[kind]) return WeaponStats[kind].displayName;
  if (ArmorStats[kind]) return ArmorStats[kind].displayName;
  if (ConsumableStats[kind]) return ConsumableStats[kind].displayName;
  return Types.getKindAsString(kind) || 'Unknown Item';
}
