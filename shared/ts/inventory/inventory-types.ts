/**
 * Inventory Type Definitions
 * Shared between server and client for type safety.
 */

import { ItemProperties, serializeProperties, deserializeProperties } from '../items/item-types.js';
import { Types } from '../gametypes.js';

// Constants
export const INVENTORY_SIZE = 20;
export const INVENTORY_COLS = 4;
export const INVENTORY_ROWS = 5;
export const MAX_STACK_SIZE = 10;

/**
 * Inventory slot data structure
 */
export interface InventorySlot {
  kind: number;                       // Item entity kind
  properties: ItemProperties | null;  // Item stats (null for consumables)
  count: number;                      // Stack count (1 for equipment)
}

/**
 * Serialized inventory slot for network/storage
 */
export interface SerializedInventorySlot {
  k: number;                          // kind
  p: Record<string, unknown> | null;  // serialized properties
  c: number;                          // count
}

/**
 * Check if an item kind is stackable (consumables)
 */
export function isStackable(kind: number): boolean {
  return Types.isExpendableItem(kind);
}

/**
 * Check if an item kind is equipment (weapon or armor)
 */
export function isEquipment(kind: number): boolean {
  return Types.isWeapon(kind) || Types.isArmor(kind);
}

/**
 * Serialize an inventory slot for network transmission
 */
export function serializeSlot(slot: InventorySlot | null): SerializedInventorySlot | null {
  if (!slot) return null;

  return {
    k: slot.kind,
    p: slot.properties ? serializeProperties(slot.properties) : null,
    c: slot.count
  };
}

/**
 * Deserialize an inventory slot from network transmission
 */
export function deserializeSlot(data: SerializedInventorySlot | null): InventorySlot | null {
  if (!data) return null;

  return {
    kind: data.k,
    properties: data.p ? deserializeProperties(data.p) : null,
    count: data.c
  };
}

/**
 * Serialize entire inventory for network/storage
 */
export function serializeInventory(slots: (InventorySlot | null)[]): (SerializedInventorySlot | null)[] {
  return slots.map(slot => serializeSlot(slot));
}

/**
 * Deserialize entire inventory from network/storage
 */
export function deserializeInventory(data: (SerializedInventorySlot | null)[]): (InventorySlot | null)[] {
  return data.map(slot => deserializeSlot(slot));
}

/**
 * Create an empty inventory
 */
export function createEmptyInventory(): (InventorySlot | null)[] {
  return new Array(INVENTORY_SIZE).fill(null);
}
