/**
 * Equipment Type Definitions
 * Shared between server and client for unified equipment handling.
 *
 * This abstraction treats equipment slots uniformly, eliminating the need
 * for separate weapon/armor logic throughout the codebase.
 */

import { Types } from '../gametypes';

/**
 * Equipment slot types
 */
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

/**
 * All available equipment slots
 */
export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

/**
 * Configuration for each equipment slot
 */
export interface SlotConfig {
  rankedItems: number[];   // Items in rank order (weakest to strongest)
  defaultItem: number;     // What to revert to on drop (0 = nothing)
  affectsHP: boolean;      // Whether changes affect max HP
  spriteBased: boolean;    // Whether item changes player sprite (armor)
}

/**
 * Slot configurations - single source of truth for all equipment logic
 */
export const SLOT_CONFIG: Record<EquipmentSlot, SlotConfig> = {
  weapon: {
    rankedItems: [
      Types.Entities.SWORD1,
      Types.Entities.SWORD2,
      Types.Entities.AXE,
      Types.Entities.MORNINGSTAR,
      Types.Entities.BLUESWORD,
      Types.Entities.REDSWORD,
      Types.Entities.GOLDENSWORD
    ],
    defaultItem: Types.Entities.SWORD1,
    affectsHP: false,
    spriteBased: false
  },
  armor: {
    rankedItems: [
      Types.Entities.CLOTHARMOR,
      Types.Entities.LEATHERARMOR,
      Types.Entities.MAILARMOR,
      Types.Entities.PLATEARMOR,
      Types.Entities.REDARMOR,
      Types.Entities.GOLDENARMOR
    ],
    defaultItem: Types.Entities.CLOTHARMOR,
    affectsHP: true,
    spriteBased: true
  },
  accessory: {
    rankedItems: [],  // Future: rings, amulets, etc.
    defaultItem: 0,   // No default accessory
    affectsHP: false,
    spriteBased: false
  }
};

/**
 * Get the slot type for a given item kind
 */
export function getSlotForKind(kind: number): EquipmentSlot | null {
  for (const slot of EQUIPMENT_SLOTS) {
    if (SLOT_CONFIG[slot].rankedItems.includes(kind)) {
      return slot;
    }
  }
  return null;
}

/**
 * Get the rank (0-based index) for an item within its slot
 */
export function getRank(slot: EquipmentSlot, kind: number): number {
  return SLOT_CONFIG[slot].rankedItems.indexOf(kind);
}

/**
 * Get the combat level for an item (rank + 1)
 */
export function getLevel(slot: EquipmentSlot, kind: number): number {
  const rank = getRank(slot, kind);
  return rank >= 0 ? rank + 1 : 1;
}

/**
 * Check if an item is the default for its slot
 */
export function isDefaultItem(slot: EquipmentSlot, kind: number): boolean {
  return kind === SLOT_CONFIG[slot].defaultItem;
}

/**
 * Check if an item is better than another in the same slot
 */
export function isBetterItem(slot: EquipmentSlot, newKind: number, currentKind: number): boolean {
  return getRank(slot, newKind) > getRank(slot, currentKind);
}

/**
 * Get the default item for a slot
 */
export function getDefaultItem(slot: EquipmentSlot): number {
  return SLOT_CONFIG[slot].defaultItem;
}

/**
 * Check if equipping an item in this slot affects HP
 */
export function slotAffectsHP(slot: EquipmentSlot): boolean {
  return SLOT_CONFIG[slot].affectsHP;
}

/**
 * Check if this slot changes the player's sprite
 */
export function slotIsSpriteBased(slot: EquipmentSlot): boolean {
  return SLOT_CONFIG[slot].spriteBased;
}
