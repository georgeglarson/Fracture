/**
 * Client-side Inventory State Manager
 */

import {
  InventorySlot,
  SerializedInventorySlot,
  INVENTORY_SIZE,
  deserializeSlot,
  deserializeInventory,
  createEmptyInventory,
  isStackable,
  isEquipment
} from '../../../shared/ts/inventory/inventory-types';
import { deserializeProperties } from '../../../shared/ts/items/item-types';
import { Types } from '../../../shared/ts/gametypes';

export class InventoryManager {
  private slots: (InventorySlot | null)[];
  private onChangeCallbacks: ((slots: (InventorySlot | null)[]) => void)[] = [];

  constructor() {
    this.slots = createEmptyInventory();
  }

  /**
   * Load inventory from server data
   */
  loadFromServer(data: (SerializedInventorySlot | null)[]): void {
    this.slots = deserializeInventory(data);
    this.notifyChange();
  }

  /**
   * Update a specific slot
   */
  updateSlot(index: number, kind: number, properties: Record<string, unknown> | null, count: number): void {
    if (index < 0 || index >= INVENTORY_SIZE) return;

    this.slots[index] = {
      kind,
      properties: properties ? deserializeProperties(properties) : null,
      count
    };
    this.notifyChange();
  }

  /**
   * Remove a slot (set to null)
   */
  removeSlot(index: number): void {
    if (index < 0 || index >= INVENTORY_SIZE) return;
    this.slots[index] = null;
    this.notifyChange();
  }

  /**
   * Update just the count of a slot
   */
  updateCount(index: number, count: number): void {
    if (index < 0 || index >= INVENTORY_SIZE) return;
    if (this.slots[index]) {
      this.slots[index]!.count = count;
      this.notifyChange();
    }
  }

  /**
   * Get a specific slot
   */
  getSlot(index: number): InventorySlot | null {
    if (index < 0 || index >= INVENTORY_SIZE) return null;
    return this.slots[index];
  }

  /**
   * Get all slots
   */
  getSlots(): (InventorySlot | null)[] {
    return this.slots;
  }

  /**
   * Check if slot contains equipment
   */
  isSlotEquipment(index: number): boolean {
    const slot = this.getSlot(index);
    return slot !== null && isEquipment(slot.kind);
  }

  /**
   * Check if slot contains consumable
   */
  isSlotConsumable(index: number): boolean {
    const slot = this.getSlot(index);
    return slot !== null && isStackable(slot.kind);
  }

  /**
   * Get item name for display
   */
  getItemName(index: number): string {
    const slot = this.getSlot(index);
    if (!slot) return '';

    const kindName = Types.getKindAsString(slot.kind);
    if (!kindName) return 'Unknown';

    // Capitalize and format
    return kindName.charAt(0).toUpperCase() + kindName.slice(1).replace(/([A-Z])/g, ' $1');
  }

  /**
   * Get item kind for a slot
   */
  getItemKind(index: number): number | null {
    const slot = this.getSlot(index);
    return slot?.kind || null;
  }

  /**
   * Register a callback for inventory changes
   */
  onChange(callback: (slots: (InventorySlot | null)[]) => void): void {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Notify all change callbacks
   */
  private notifyChange(): void {
    for (const callback of this.onChangeCallbacks) {
      callback(this.slots);
    }
  }

  /**
   * Get count of filled slots
   */
  getFilledSlotCount(): number {
    return this.slots.filter(slot => slot !== null).length;
  }

  /**
   * Check if inventory is full
   */
  isFull(): boolean {
    return this.slots.every(slot => slot !== null);
  }

  /**
   * Find the first consumable slot index
   * Returns -1 if no consumable found
   */
  findFirstConsumable(): number {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      if (this.isSlotConsumable(i)) {
        return i;
      }
    }
    return -1;
  }
}
