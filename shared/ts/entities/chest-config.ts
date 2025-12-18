/**
 * Shared Chest Configuration
 * Single source of truth for chest types and sprite mappings
 */

import { Types } from '../gametypes';

/**
 * Map chest entity kinds to sprite names
 */
export const CHEST_SPRITES: Record<number, string> = {
  [Types.Entities.CHEST]: 'chest',
  [Types.Entities.CHEST_CRATE]: 'chestcrate',
  [Types.Entities.CHEST_LOG]: 'chestlog',
  [Types.Entities.CHEST_STONE]: 'cheststone',
  [Types.Entities.CHEST_URN]: 'chesturn',
  [Types.Entities.CHEST_OBSIDIAN]: 'chestobsidian',
  [Types.Entities.CHEST_GLITCH]: 'chestglitch',
};

/**
 * All chest entity types for iteration
 */
export const CHEST_KINDS: number[] = [
  Types.Entities.CHEST,
  Types.Entities.CHEST_CRATE,
  Types.Entities.CHEST_LOG,
  Types.Entities.CHEST_STONE,
  Types.Entities.CHEST_URN,
  Types.Entities.CHEST_OBSIDIAN,
  Types.Entities.CHEST_GLITCH,
];

/**
 * Get sprite name for a chest kind
 */
export function getChestSpriteName(kind: number): string {
  return CHEST_SPRITES[kind] || 'chest';
}

/**
 * Check if an entity kind is a chest type
 */
export function isChestKind(kind: number): boolean {
  return kind in CHEST_SPRITES;
}
