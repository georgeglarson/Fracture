/**
 * Server-side Inventory Management
 */

import {
  InventorySlot,
  SerializedInventorySlot,
  INVENTORY_SIZE,
  MAX_STACK_SIZE,
  isStackable,
  isEquipment,
  serializeSlot,
  deserializeSlot,
  createEmptyInventory
} from '../../../shared/ts/inventory/inventory-types.js';
import { ItemProperties } from '../../../shared/ts/items/item-types.js';
import { Types } from '../../../shared/ts/gametypes.js';

export class Inventory {
  private slots: (InventorySlot | null)[];

  constructor() {
    this.slots = createEmptyInventory();
  }

  /**
   * Load inventory from saved data
   */
  loadFromData(data: (SerializedInventorySlot | null)[]): void {
    if (!data || !Array.isArray(data)) {
      this.slots = createEmptyInventory();
      return;
    }

    this.slots = data.map(slot => deserializeSlot(slot));
    // Ensure correct size
    while (this.slots.length < INVENTORY_SIZE) {
      this.slots.push(null);
    }
    if (this.slots.length > INVENTORY_SIZE) {
      this.slots = this.slots.slice(0, INVENTORY_SIZE);
    }
  }

  /**
   * Get serialized slots for network/storage
   */
  getSerializedSlots(): (SerializedInventorySlot | null)[] {
    return this.slots.map(slot => serializeSlot(slot));
  }

  /**
   * Get all slots (internal use)
   */
  getSlots(): (InventorySlot | null)[] {
    return this.slots;
  }

  /**
   * Get a specific slot
   */
  getSlot(index: number): InventorySlot | null {
    if (index < 0 || index >= INVENTORY_SIZE) return null;
    return this.slots[index];
  }

  /**
   * Find first empty slot
   */
  findEmptySlot(): number {
    return this.slots.findIndex(slot => slot === null);
  }

  /**
   * Find a slot that can stack this item kind
   */
  findStackableSlot(kind: number): number {
    if (!isStackable(kind)) return -1;

    return this.slots.findIndex(slot =>
      slot !== null &&
      slot.kind === kind &&
      slot.count < MAX_STACK_SIZE
    );
  }

  /**
   * Check if inventory has room for an item
   */
  hasRoom(kind: number): boolean {
    // Check if we can stack
    if (isStackable(kind) && this.findStackableSlot(kind) !== -1) {
      return true;
    }
    // Check for empty slot
    return this.findEmptySlot() !== -1;
  }

  /**
   * Check if inventory is full
   */
  isFull(): boolean {
    return this.slots.every(slot => slot !== null);
  }

  /**
   * Get count of occupied slots
   */
  getItemCount(): number {
    return this.slots.filter(slot => slot !== null).length;
  }

  /**
   * Add an item to inventory
   * Returns the slot index where item was added, or -1 if failed
   */
  addItem(kind: number, properties: ItemProperties | null, count: number = 1): number {
    // Try to stack if stackable
    if (isStackable(kind)) {
      const stackSlot = this.findStackableSlot(kind);
      if (stackSlot !== -1) {
        const slot = this.slots[stackSlot]!;
        const spaceInStack = MAX_STACK_SIZE - slot.count;
        const toAdd = Math.min(count, spaceInStack);
        slot.count += toAdd;

        // If we couldn't add all, try to add remaining to new slot
        if (toAdd < count) {
          const remainingAdded = this.addItem(kind, properties, count - toAdd);
          // Return original stack slot even if overflow went elsewhere
          return remainingAdded !== -1 ? stackSlot : stackSlot;
        }
        return stackSlot;
      }
    }

    // Find empty slot
    const emptySlot = this.findEmptySlot();
    if (emptySlot === -1) return -1;

    // Create new slot
    this.slots[emptySlot] = {
      kind,
      properties: isEquipment(kind) ? properties : null,
      count: isStackable(kind) ? Math.min(count, MAX_STACK_SIZE) : 1
    };

    return emptySlot;
  }

  /**
   * Remove item(s) from a slot
   * Returns the removed item info, or null if failed
   */
  removeItem(slotIndex: number, count: number = 1): { kind: number; properties: ItemProperties | null; count: number } | null {
    if (slotIndex < 0 || slotIndex >= INVENTORY_SIZE) return null;

    const slot = this.slots[slotIndex];
    if (!slot) return null;

    const removeCount = Math.min(count, slot.count);
    const result = {
      kind: slot.kind,
      properties: slot.properties,
      count: removeCount
    };

    slot.count -= removeCount;
    if (slot.count <= 0) {
      this.slots[slotIndex] = null;
    }

    return result;
  }

  /**
   * Set a slot directly (used for equip swaps)
   */
  setSlot(index: number, slot: InventorySlot | null): void {
    if (index < 0 || index >= INVENTORY_SIZE) return;
    this.slots[index] = slot;
  }

  /**
   * Swap two slots
   */
  swapSlots(fromIndex: number, toIndex: number): boolean {
    if (fromIndex < 0 || fromIndex >= INVENTORY_SIZE) return false;
    if (toIndex < 0 || toIndex >= INVENTORY_SIZE) return false;

    const temp = this.slots[fromIndex];
    this.slots[fromIndex] = this.slots[toIndex];
    this.slots[toIndex] = temp;
    return true;
  }

  /**
   * Check if slot contains equipment
   */
  isSlotEquipment(slotIndex: number): boolean {
    const slot = this.getSlot(slotIndex);
    return slot !== null && isEquipment(slot.kind);
  }

  /**
   * Check if slot contains consumable
   */
  isSlotConsumable(slotIndex: number): boolean {
    const slot = this.getSlot(slotIndex);
    return slot !== null && isStackable(slot.kind);
  }

  /**
   * Get the heal amount for a consumable
   */
  getConsumableHealAmount(kind: number): number {
    switch (kind) {
      case Types.Entities.FLASK:
        return 40;
      case Types.Entities.BURGER:
        return 100;
      case Types.Entities.CAKE:
        return 60;
      default:
        return 0;
    }
  }

  /**
   * Check if item is firepotion
   */
  isFirePotion(kind: number): boolean {
    return kind === Types.Entities.FIREPOTION;
  }
}
