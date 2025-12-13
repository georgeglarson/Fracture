/**
 * Item Generator Service
 * Generates items with random properties based on kind and rarity.
 */

import { Types } from '../../../shared/ts/gametypes.js';
import {
  Rarity,
  ItemProperties,
  GeneratedItem,
  ItemCategory
} from '../../../shared/ts/items/index.js';
import {
  WeaponStats,
  ArmorStats,
  ConsumableStats,
  RarityWeights,
  RarityMultipliers,
  RarityBonusCount,
  BonusPropertyRanges,
  getItemCategory,
  getItemLevel,
  getDisplayName
} from './item-tables.js';

/**
 * Random number in range (inclusive)
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random float in range
 */
function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Roll a rarity tier based on weights
 * @param rarityBonus - Optional bonus that increases chance of higher rarities (0-1, e.g., 0.3 = +30%)
 */
export function rollRarity(rarityBonus: number = 0): Rarity {
  const roll = Math.random() * 100;
  let cumulative = 0;

  // Apply rarity bonus by shifting weights toward rarer items
  // A bonus of 0.3 means +30% chance at each tier upgrade
  const adjustedWeights = { ...RarityWeights };

  if (rarityBonus > 0) {
    // Reduce COMMON weight, increase others proportionally
    const commonReduction = adjustedWeights.common * rarityBonus;
    adjustedWeights.common -= commonReduction;

    // Distribute to higher rarities
    adjustedWeights.uncommon += commonReduction * 0.5;
    adjustedWeights.rare += commonReduction * 0.25;
    adjustedWeights.epic += commonReduction * 0.15;
    adjustedWeights.legendary += commonReduction * 0.1;
  }

  for (const [rarity, weight] of Object.entries(adjustedWeights)) {
    cumulative += weight;
    if (roll < cumulative) {
      return rarity as Rarity;
    }
  }

  return Rarity.COMMON;
}

/**
 * Generate bonus properties based on rarity
 */
function generateBonusProperties(rarity: Rarity, category: ItemCategory): Partial<ItemProperties> {
  const bonuses: Partial<ItemProperties> = {};
  const bonusRange = RarityBonusCount[rarity];
  const bonusCount = randomInRange(bonusRange.min, bonusRange.max);

  if (bonusCount === 0) return bonuses;

  // Available bonus types (different items might favor different bonuses)
  const availableBonuses = ['bonusHealth', 'bonusStrength', 'bonusCritChance'];

  // Shuffle and pick
  const shuffled = availableBonuses.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, bonusCount);

  for (const bonusType of selected) {
    const range = BonusPropertyRanges[bonusType];
    if (range) {
      // Scale by rarity multiplier for higher rarity = better bonuses
      const multiplier = RarityMultipliers[rarity];
      const value = Math.round(randomInRange(range.min, range.max) * multiplier);
      (bonuses as any)[bonusType] = value;
    }
  }

  return bonuses;
}

/**
 * Generate weapon properties
 */
function generateWeaponProperties(kind: number, rarity: Rarity): ItemProperties {
  const base = WeaponStats[kind];
  if (!base) {
    throw new Error(`Unknown weapon kind: ${kind}`);
  }

  const multiplier = RarityMultipliers[rarity];

  // Apply rarity multiplier and add some variance (+/- 15%)
  const variance = () => randomFloat(0.85, 1.15);
  const damageMin = Math.round(base.damageMin * multiplier * variance());
  const damageMax = Math.round(base.damageMax * multiplier * variance());

  const props: ItemProperties = {
    rarity,
    level: getItemLevel(kind),
    category: 'weapon',
    damageMin: Math.min(damageMin, damageMax), // Ensure min <= max
    damageMax: Math.max(damageMin, damageMax),
    ...generateBonusProperties(rarity, 'weapon')
  };

  return props;
}

/**
 * Generate armor properties
 */
function generateArmorProperties(kind: number, rarity: Rarity): ItemProperties {
  const base = ArmorStats[kind];
  if (!base) {
    throw new Error(`Unknown armor kind: ${kind}`);
  }

  const multiplier = RarityMultipliers[rarity];
  const variance = () => randomFloat(0.9, 1.1);
  const defense = Math.round(base.defense * multiplier * variance());

  const props: ItemProperties = {
    rarity,
    level: getItemLevel(kind),
    category: 'armor',
    defense: Math.max(1, defense),
    ...generateBonusProperties(rarity, 'armor')
  };

  return props;
}

/**
 * Generate consumable properties (simpler, no random stats)
 */
function generateConsumableProperties(kind: number): ItemProperties {
  const base = ConsumableStats[kind];

  const props: ItemProperties = {
    rarity: Rarity.COMMON, // Consumables are always common
    level: 1,
    category: 'consumable',
    healAmount: base?.healAmount
  };

  return props;
}

/**
 * Main entry point: Generate an item with full properties
 * @param kind - Item type
 * @param rarityBonus - Optional bonus that increases chance of higher rarities (0-1)
 */
export function generateItem(kind: number, rarityBonus: number = 0): GeneratedItem {
  const category = getItemCategory(kind);
  const kindName = Types.getKindAsString(kind);

  if (!category) {
    throw new Error(`Cannot generate item for kind: ${kind}`);
  }

  let properties: ItemProperties;
  let rarity: Rarity;

  switch (category) {
    case 'weapon':
      rarity = rollRarity(rarityBonus);
      properties = generateWeaponProperties(kind, rarity);
      break;

    case 'armor':
      rarity = rollRarity(rarityBonus);
      properties = generateArmorProperties(kind, rarity);
      break;

    case 'consumable':
      properties = generateConsumableProperties(kind);
      rarity = Rarity.COMMON;
      break;

    default:
      throw new Error(`Unknown category: ${category}`);
  }

  // Build display name with rarity prefix (except common)
  let displayName = getDisplayName(kind);
  if (rarity !== Rarity.COMMON) {
    const rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    displayName = `${rarityName} ${displayName}`;
  }

  return {
    kind,
    kindName,
    displayName,
    properties
  };
}

/**
 * Generate a simple item without rarity (for backwards compatibility)
 */
export function generateSimpleItem(kind: number): GeneratedItem {
  const category = getItemCategory(kind);
  const kindName = Types.getKindAsString(kind);

  const props: ItemProperties = {
    rarity: Rarity.COMMON,
    level: getItemLevel(kind),
    category: category || 'consumable'
  };

  // Add base stats without randomization
  if (category === 'weapon' && WeaponStats[kind]) {
    props.damageMin = WeaponStats[kind].damageMin;
    props.damageMax = WeaponStats[kind].damageMax;
  } else if (category === 'armor' && ArmorStats[kind]) {
    props.defense = ArmorStats[kind].defense;
  } else if (category === 'consumable' && ConsumableStats[kind]) {
    props.healAmount = ConsumableStats[kind].healAmount;
  }

  return {
    kind,
    kindName,
    displayName: getDisplayName(kind),
    properties: props
  };
}
