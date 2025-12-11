/**
 * Inventory Module - Re-exports all inventory-related types
 */

export {
  INVENTORY_SIZE,
  INVENTORY_COLS,
  INVENTORY_ROWS,
  MAX_STACK_SIZE,
  InventorySlot,
  SerializedInventorySlot,
  isStackable,
  isEquipment,
  serializeSlot,
  deserializeSlot,
  serializeInventory,
  deserializeInventory,
  createEmptyInventory
} from './inventory-types.js';
