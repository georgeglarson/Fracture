/**
 * Item Type Definitions
 * Shared between server and client for type safety.
 */

/**
 * Item rarity tiers
 */
export enum Rarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

/**
 * Rarity display colors (CSS color names)
 */
export const RarityColors: Record<Rarity, string> = {
  [Rarity.COMMON]: '#ffffff',     // White
  [Rarity.UNCOMMON]: '#1eff00',   // Green
  [Rarity.RARE]: '#0070dd',       // Blue
  [Rarity.EPIC]: '#a335ee',       // Purple
  [Rarity.LEGENDARY]: '#ff8000'   // Orange
};

/**
 * Rarity display names
 */
export const RarityNames: Record<Rarity, string> = {
  [Rarity.COMMON]: 'Common',
  [Rarity.UNCOMMON]: 'Uncommon',
  [Rarity.RARE]: 'Rare',
  [Rarity.EPIC]: 'Epic',
  [Rarity.LEGENDARY]: 'Legendary'
};

/**
 * Item category
 */
export type ItemCategory = 'weapon' | 'armor' | 'consumable';

/**
 * Properties that can appear on items
 */
export interface ItemProperties {
  // Core
  rarity: Rarity;
  level: number;
  category: ItemCategory;

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

  // Equipment set (if part of a set)
  setId?: string;

  // Legendary item properties
  isLegendary?: boolean;
  legendaryId?: string;
}

/**
 * A generated item with full properties
 */
export interface GeneratedItem {
  kind: number;           // Entity kind from gametypes
  kindName: string;       // String name (e.g., "sword2")
  displayName: string;    // Human readable (e.g., "Steel Sword")
  properties: ItemProperties;
}

/**
 * Serialize properties for network transmission
 * Only includes non-null values to minimize payload
 */
export function serializeProperties(props: ItemProperties): Record<string, unknown> {
  const result: Record<string, unknown> = {
    r: props.rarity,
    l: props.level,
    c: props.category
  };

  if (props.damageMin !== undefined) result.dMin = props.damageMin;
  if (props.damageMax !== undefined) result.dMax = props.damageMax;
  if (props.defense !== undefined) result.def = props.defense;
  if (props.healAmount !== undefined) result.heal = props.healAmount;
  if (props.bonusHealth !== undefined) result.bHp = props.bonusHealth;
  if (props.bonusStrength !== undefined) result.bStr = props.bonusStrength;
  if (props.bonusCritChance !== undefined) result.bCrit = props.bonusCritChance;
  if (props.setId !== undefined) result.set = props.setId;

  return result;
}

/**
 * Deserialize properties from network transmission
 */
export function deserializeProperties(data: Record<string, unknown>): ItemProperties {
  const props: ItemProperties = {
    rarity: (data.r as Rarity) || Rarity.COMMON,
    level: (data.l as number) || 1,
    category: (data.c as ItemCategory) || 'consumable'
  };

  if (data.dMin !== undefined) props.damageMin = data.dMin as number;
  if (data.dMax !== undefined) props.damageMax = data.dMax as number;
  if (data.def !== undefined) props.defense = data.def as number;
  if (data.heal !== undefined) props.healAmount = data.heal as number;
  if (data.bHp !== undefined) props.bonusHealth = data.bHp as number;
  if (data.bStr !== undefined) props.bonusStrength = data.bStr as number;
  if (data.bCrit !== undefined) props.bonusCritChance = data.bCrit as number;
  if (data.set !== undefined) props.setId = data.set as string;

  return props;
}

/**
 * Format item properties for display
 */
export function formatItemStats(props: ItemProperties): string {
  const parts: string[] = [];

  if (props.damageMin !== undefined && props.damageMax !== undefined) {
    parts.push(`${props.damageMin}-${props.damageMax} dmg`);
  }

  if (props.defense !== undefined) {
    parts.push(`+${props.defense} def`);
  }

  if (props.healAmount !== undefined) {
    parts.push(`+${props.healAmount} HP`);
  }

  if (props.bonusHealth) {
    parts.push(`+${props.bonusHealth} HP`);
  }

  if (props.bonusStrength) {
    parts.push(`+${props.bonusStrength} str`);
  }

  if (props.bonusCritChance) {
    parts.push(`+${props.bonusCritChance}% crit`);
  }

  return parts.join(', ');
}
