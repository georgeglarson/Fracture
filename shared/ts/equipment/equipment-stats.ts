/**
 * Equipment Stats - Centralized base stats for all equipment
 *
 * Single source of truth for weapon damage and armor defense values.
 * Used by both client (tooltips, comparisons) and server (combat).
 */

import { Types } from '../gametypes';

/**
 * Weapon base stats (min/max damage for display)
 * These are simplified "display" values derived from weapon level.
 * Actual combat damage uses Formulas.dmg() with weapon level.
 */
export interface WeaponStats {
  min: number;
  max: number;
  level: number;
}

/**
 * Armor base stats (defense value for display)
 * Defense is essentially the armor level.
 */
export interface ArmorStats {
  defense: number;
  level: number;
}

/**
 * Get weapon stats by kind
 * Display damage is roughly: level * 3 to level * 6
 */
export function getWeaponStats(kind: number): WeaponStats | null {
  if (!Types.isWeapon(kind)) return null;

  const level = Types.getWeaponRank(kind) + 1;

  // Display damage formula: scales with level
  // Level 1: 3-6, Level 2: 6-12, Level 3: 9-18, etc.
  const min = Math.floor(level * 3);
  const max = Math.floor(level * 6);

  return { min, max, level };
}

/**
 * Get armor stats by kind
 * Defense is the armor level (rank + 1)
 */
export function getArmorStats(kind: number): ArmorStats | null {
  if (!Types.isArmor(kind)) return null;

  const level = Types.getArmorRank(kind) + 1;

  return { defense: level, level };
}

/**
 * Get weapon level directly
 */
export function getWeaponLevel(kind: number): number {
  if (!Types.isWeapon(kind)) return 1;
  return Types.getWeaponRank(kind) + 1;
}

/**
 * Get armor level directly
 */
export function getArmorLevel(kind: number): number {
  if (!Types.isArmor(kind)) return 1;
  return Types.getArmorRank(kind) + 1;
}

/**
 * Compare two weapons by their average damage
 * Returns positive if kindA is better, negative if kindB is better
 */
export function compareWeapons(
  kindA: number,
  kindB: number,
  propsA?: { damageMin?: number; damageMax?: number } | null,
  propsB?: { damageMin?: number; damageMax?: number } | null
): number {
  let avgA: number;
  let avgB: number;

  // Use properties if available (for items with rarity bonuses)
  if (propsA?.damageMin !== undefined && propsA?.damageMax !== undefined) {
    avgA = (propsA.damageMin + propsA.damageMax) / 2;
  } else {
    const statsA = getWeaponStats(kindA);
    avgA = statsA ? (statsA.min + statsA.max) / 2 : 0;
  }

  if (propsB?.damageMin !== undefined && propsB?.damageMax !== undefined) {
    avgB = (propsB.damageMin + propsB.damageMax) / 2;
  } else {
    const statsB = getWeaponStats(kindB);
    avgB = statsB ? (statsB.min + statsB.max) / 2 : 0;
  }

  return avgA - avgB;
}

/**
 * Compare two armors by their defense
 * Returns positive if kindA is better, negative if kindB is better
 */
export function compareArmors(
  kindA: number,
  kindB: number,
  propsA?: { defense?: number } | null,
  propsB?: { defense?: number } | null
): number {
  let defA: number;
  let defB: number;

  if (propsA?.defense !== undefined) {
    defA = propsA.defense;
  } else {
    const statsA = getArmorStats(kindA);
    defA = statsA ? statsA.defense : 0;
  }

  if (propsB?.defense !== undefined) {
    defB = propsB.defense;
  } else {
    const statsB = getArmorStats(kindB);
    defB = statsB ? statsB.defense : 0;
  }

  return defA - defB;
}
