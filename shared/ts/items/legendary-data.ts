/**
 * Legendary Items - Boss-exclusive drops with unique effects
 * Shared between server and client
 */

import { Types } from '../gametypes';

/**
 * Legendary effect identifiers
 */
export enum LegendaryEffect {
  SECOND_CHANCE = 'second_chance',    // Crown of the Undying: Revive once per 5 min
  GOLD_GREED = 'gold_greed',          // Greed's Edge: +50% gold from kills
  DOUBLE_STRIKE = 'double_strike',    // Dragonbone Cleaver: 10% chance double damage
  FIRE_REFLECT = 'fire_reflect',      // Hellfire Mantle: Reflect fire damage
  VOID_TOUCH = 'void_touch',          // Voidheart Blade: 15% lifesteal
  SOUL_HARVEST = 'soul_harvest'       // Soul Harvester: +2% max HP per kill (caps at 50%)
}

/**
 * Legendary item definition
 */
export interface LegendaryDefinition {
  id: string;
  name: string;
  kind: number;           // Entity ID
  slot: 'weapon' | 'armor';
  effect: LegendaryEffect;
  effectDescription: string;
  dropSource: string[];   // Boss IDs that can drop this
  dropChance: number;     // Base drop chance (0.0 - 1.0)
  color: string;          // Display color (legendary gold)
}

/**
 * All legendary items
 */
export const LEGENDARY_ITEMS: Record<string, LegendaryDefinition> = {
  crown_of_undying: {
    id: 'crown_of_undying',
    name: 'Crown of the Undying',
    kind: Types.Entities.CROWN_UNDYING,
    slot: 'armor',
    effect: LegendaryEffect.SECOND_CHANCE,
    effectDescription: 'Revive with 50% HP once every 5 minutes',
    dropSource: ['the_architect'],
    dropChance: 0.15,
    color: '#ffaa00'
  },
  greeds_edge: {
    id: 'greeds_edge',
    name: "Greed's Edge",
    kind: Types.Entities.GREEDS_EDGE,
    slot: 'weapon',
    effect: LegendaryEffect.GOLD_GREED,
    effectDescription: '+50% gold from kills',
    dropSource: ['null_devourer', 'the_architect'],
    dropChance: 0.12,
    color: '#ffaa00'
  },
  dragonbone_cleaver: {
    id: 'dragonbone_cleaver',
    name: 'Dragonbone Cleaver',
    kind: Types.Entities.DRAGONBONE_CLEAVER,
    slot: 'weapon',
    effect: LegendaryEffect.DOUBLE_STRIKE,
    effectDescription: '10% chance to deal double damage',
    dropSource: ['core_guardian', 'the_architect'],
    dropChance: 0.10,
    color: '#ffaa00'
  },
  hellfire_mantle: {
    id: 'hellfire_mantle',
    name: 'Hellfire Mantle',
    kind: Types.Entities.HELLFIRE_MANTLE,
    slot: 'armor',
    effect: LegendaryEffect.FIRE_REFLECT,
    effectDescription: 'Reflect 25% damage back to attackers',
    dropSource: ['core_guardian', 'the_architect'],
    dropChance: 0.10,
    color: '#ffaa00'
  },
  voidheart_blade: {
    id: 'voidheart_blade',
    name: 'Voidheart Blade',
    kind: Types.Entities.VOIDHEART_BLADE,
    slot: 'weapon',
    effect: LegendaryEffect.VOID_TOUCH,
    effectDescription: '15% of damage dealt heals you',
    dropSource: ['the_forgotten', 'null_devourer'],
    dropChance: 0.08,
    color: '#ffaa00'
  },
  soul_harvester: {
    id: 'soul_harvester',
    name: 'Soul Harvester',
    kind: Types.Entities.SOUL_HARVESTER,
    slot: 'weapon',
    effect: LegendaryEffect.SOUL_HARVEST,
    effectDescription: '+2% max HP per kill (caps at +50%)',
    dropSource: ['the_architect'],
    dropChance: 0.05,
    color: '#ffaa00'
  }
};

/**
 * Get legendary by item kind
 */
export function getLegendaryByKind(kind: number): LegendaryDefinition | null {
  for (const legendary of Object.values(LEGENDARY_ITEMS)) {
    if (legendary.kind === kind) {
      return legendary;
    }
  }
  return null;
}

/**
 * Get legendaries that can drop from a specific boss
 */
export function getLegendariesForBoss(bossId: string): LegendaryDefinition[] {
  return Object.values(LEGENDARY_ITEMS).filter(l => l.dropSource.includes(bossId));
}

/**
 * Check if an item kind is legendary
 */
export function isLegendary(kind: number): boolean {
  return getLegendaryByKind(kind) !== null;
}

/**
 * Get all legendary item kinds
 */
export function getAllLegendaryKinds(): number[] {
  return Object.values(LEGENDARY_ITEMS).map(l => l.kind);
}
