/**
 * Equipment Sets - Set definitions and bonus calculations
 * Shared between server and client
 */

import { Types } from '../gametypes';

/**
 * Set identifiers
 */
export enum SetId {
  BERSERKER = 'berserker',
  GUARDIAN = 'guardian',
  SHADOW = 'shadow',
  DRAGON = 'dragon'
}

/**
 * Set bonus effect types
 */
export interface SetBonus {
  damageMult?: number;      // Multiplier (1.15 = +15%)
  defenseMult?: number;     // Multiplier (1.25 = +25%)
  hpMult?: number;          // Multiplier (0.9 = -10%, 1.1 = +10%)
  critBonus?: number;       // Flat crit chance addition (15 = +15%)
  moveSpeedMult?: number;   // Multiplier (1.2 = +20%)
  burnChance?: number;      // Chance to burn on hit (0.1 = 10%)
  burnDamage?: number;      // Burn damage per tick
}

/**
 * Set definition
 */
export interface SetDefinition {
  id: SetId;
  name: string;
  description: string;
  pieces: number[];         // Item kinds that belong to this set
  requiredPieces: number;   // How many needed for bonus (usually 2)
  bonus: SetBonus;
  color: string;            // Display color for set name
}

/**
 * All equipment sets
 */
export const EQUIPMENT_SETS: Record<SetId, SetDefinition> = {
  [SetId.BERSERKER]: {
    id: SetId.BERSERKER,
    name: "Berserker's Fury",
    description: 'Sacrifice defense for overwhelming offense',
    pieces: [Types.Entities.BERSERKER_BLADE, Types.Entities.BERSERKER_MAIL],
    requiredPieces: 2,
    bonus: {
      damageMult: 1.25,     // +25% damage
      hpMult: 0.85          // -15% max HP
    },
    color: '#ff4444'        // Red
  },
  [SetId.GUARDIAN]: {
    id: SetId.GUARDIAN,
    name: "Guardian's Resolve",
    description: 'Stalwart defense at the cost of offense',
    pieces: [Types.Entities.GUARDIAN_HAMMER, Types.Entities.GUARDIAN_PLATE],
    requiredPieces: 2,
    bonus: {
      defenseMult: 1.30,    // +30% defense
      hpMult: 1.15,         // +15% max HP
      damageMult: 0.90      // -10% damage
    },
    color: '#4488ff'        // Blue
  },
  [SetId.SHADOW]: {
    id: SetId.SHADOW,
    name: 'Shadow Walker',
    description: 'Strike from the shadows with deadly precision',
    pieces: [Types.Entities.SHADOW_DAGGER, Types.Entities.SHADOW_CLOAK],
    requiredPieces: 2,
    bonus: {
      critBonus: 20,        // +20% crit chance
      moveSpeedMult: 1.15,  // +15% move speed
      damageMult: 1.10      // +10% damage
    },
    color: '#aa44ff'        // Purple
  },
  [SetId.DRAGON]: {
    id: SetId.DRAGON,
    name: "Dragon's Wrath",
    description: 'Balanced power with burning fury',
    pieces: [Types.Entities.DRAGON_SWORD, Types.Entities.DRAGON_SCALE],
    requiredPieces: 2,
    bonus: {
      damageMult: 1.15,     // +15% damage
      defenseMult: 1.10,    // +10% defense
      burnChance: 0.20,     // 20% chance to burn
      burnDamage: 5         // 5 damage per tick
    },
    color: '#ff8800'        // Orange
  }
};

/**
 * Map item kind to its set (if any)
 */
const itemToSet: Map<number, SetId> = new Map();

/**
 * Initialize item-to-set mapping
 * Called after EQUIPMENT_SETS is populated with pieces
 */
export function initSetMappings(): void {
  itemToSet.clear();
  for (const set of Object.values(EQUIPMENT_SETS)) {
    for (const itemKind of set.pieces) {
      itemToSet.set(itemKind, set.id);
    }
  }
}

/**
 * Get the set an item belongs to
 */
export function getItemSet(itemKind: number): SetId | null {
  return itemToSet.get(itemKind) || null;
}

/**
 * Get set definition by ID
 */
export function getSetDefinition(setId: SetId): SetDefinition {
  return EQUIPMENT_SETS[setId];
}

/**
 * Calculate active set bonuses based on equipped items
 * @param equippedItems Array of item kinds currently equipped
 * @returns Map of set ID to how many pieces are equipped, plus combined bonuses
 */
export function calculateSetBonuses(equippedItems: number[]): {
  activeSets: Map<SetId, number>;  // SetId -> piece count
  combinedBonus: SetBonus;
} {
  // Count pieces per set
  const setCounts = new Map<SetId, number>();

  for (const itemKind of equippedItems) {
    const setId = getItemSet(itemKind);
    if (setId) {
      setCounts.set(setId, (setCounts.get(setId) || 0) + 1);
    }
  }

  // Calculate combined bonus from all active sets
  const combinedBonus: SetBonus = {};

  // Use Array.from for ES5 compatibility
  const entries = Array.from(setCounts.entries());
  for (let i = 0; i < entries.length; i++) {
    const [setId, count] = entries[i];
    const set = EQUIPMENT_SETS[setId];
    if (count >= set.requiredPieces) {
      // Apply this set's bonus
      const bonus = set.bonus;

      // Multiplicative bonuses stack multiplicatively
      if (bonus.damageMult !== undefined) {
        combinedBonus.damageMult = (combinedBonus.damageMult || 1) * bonus.damageMult;
      }
      if (bonus.defenseMult !== undefined) {
        combinedBonus.defenseMult = (combinedBonus.defenseMult || 1) * bonus.defenseMult;
      }
      if (bonus.hpMult !== undefined) {
        combinedBonus.hpMult = (combinedBonus.hpMult || 1) * bonus.hpMult;
      }
      if (bonus.moveSpeedMult !== undefined) {
        combinedBonus.moveSpeedMult = (combinedBonus.moveSpeedMult || 1) * bonus.moveSpeedMult;
      }

      // Additive bonuses stack additively
      if (bonus.critBonus !== undefined) {
        combinedBonus.critBonus = (combinedBonus.critBonus || 0) + bonus.critBonus;
      }
      if (bonus.burnChance !== undefined) {
        combinedBonus.burnChance = (combinedBonus.burnChance || 0) + bonus.burnChance;
      }
      if (bonus.burnDamage !== undefined) {
        combinedBonus.burnDamage = Math.max(combinedBonus.burnDamage || 0, bonus.burnDamage);
      }
    }
  }

  return { activeSets: setCounts, combinedBonus };
}

/**
 * Format set bonus for display
 */
export function formatSetBonus(bonus: SetBonus): string[] {
  const lines: string[] = [];

  if (bonus.damageMult !== undefined) {
    const pct = Math.round((bonus.damageMult - 1) * 100);
    lines.push(pct >= 0 ? `+${pct}% Damage` : `${pct}% Damage`);
  }
  if (bonus.defenseMult !== undefined) {
    const pct = Math.round((bonus.defenseMult - 1) * 100);
    lines.push(pct >= 0 ? `+${pct}% Defense` : `${pct}% Defense`);
  }
  if (bonus.hpMult !== undefined) {
    const pct = Math.round((bonus.hpMult - 1) * 100);
    lines.push(pct >= 0 ? `+${pct}% Max HP` : `${pct}% Max HP`);
  }
  if (bonus.critBonus !== undefined) {
    lines.push(`+${bonus.critBonus}% Critical Chance`);
  }
  if (bonus.moveSpeedMult !== undefined) {
    const pct = Math.round((bonus.moveSpeedMult - 1) * 100);
    lines.push(`+${pct}% Move Speed`);
  }
  if (bonus.burnChance !== undefined) {
    const pct = Math.round(bonus.burnChance * 100);
    lines.push(`${pct}% chance to Burn (${bonus.burnDamage} dmg/tick)`);
  }

  return lines;
}

// Initialize mappings on module load
initSetMappings();
