/**
 * EquipmentManager - Server-side equipment handling
 * Single Responsibility: Manage equipped items across all slots uniformly
 */

import {
  EquipmentSlot,
  EQUIPMENT_SLOTS,
  SLOT_CONFIG,
  getSlotForKind,
  getLevel,
  getRank,
  isDefaultItem,
  getDefaultItem,
  slotAffectsHP
} from '../../../shared/ts/equipment/equipment-types';
import { Types } from '../../../shared/ts/gametypes';
import { ItemProperties } from '../../../shared/ts/items/item-types';

export interface EquipmentCallbacks {
  onHPUpdate?: () => void;
}

export class EquipmentManager {
  private equipped: Map<EquipmentSlot, number> = new Map();
  private properties: Map<EquipmentSlot, ItemProperties | null> = new Map();
  private levels: Map<EquipmentSlot, number> = new Map();
  private callbacks: EquipmentCallbacks = {};

  constructor() {
    // Initialize with default items (no properties for defaults)
    for (const slot of EQUIPMENT_SLOTS) {
      const defaultItem = getDefaultItem(slot);
      if (defaultItem) {
        this.equipped.set(slot, defaultItem);
        this.properties.set(slot, null);
        this.levels.set(slot, getLevel(slot, defaultItem));
      }
    }
  }

  /**
   * Set callbacks for equipment changes
   */
  setCallbacks(callbacks: EquipmentCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Equip an item to the appropriate slot
   * @returns The slot the item was equipped to, or null if invalid
   */
  equip(kind: number, properties?: ItemProperties | null): EquipmentSlot | null {
    const slot = getSlotForKind(kind);
    if (!slot) return null;

    this.equipped.set(slot, kind);
    this.properties.set(slot, properties || null);
    this.levels.set(slot, getLevel(slot, kind));

    if (slotAffectsHP(slot) && this.callbacks.onHPUpdate) {
      this.callbacks.onHPUpdate();
    }

    return slot;
  }

  /**
   * Equip an item to a specific slot
   */
  equipToSlot(slot: EquipmentSlot, kind: number, properties?: ItemProperties | null): void {
    this.equipped.set(slot, kind);
    this.properties.set(slot, properties || null);
    this.levels.set(slot, getLevel(slot, kind));

    if (slotAffectsHP(slot) && this.callbacks.onHPUpdate) {
      this.callbacks.onHPUpdate();
    }
  }

  /**
   * Drop the item in a slot, reverting to default
   * @returns Object with dropped item kind and properties, or null if can't drop
   */
  drop(slot: EquipmentSlot): { kind: number; properties: ItemProperties | null } | null {
    const current = this.equipped.get(slot);
    if (!current) return null;

    // Can't drop default items
    if (isDefaultItem(slot, current)) {
      return null;
    }

    const droppedKind = current;
    const droppedProperties = this.properties.get(slot) || null;
    const defaultItem = getDefaultItem(slot);

    // Revert to default
    this.equipped.set(slot, defaultItem);
    this.properties.set(slot, null);
    this.levels.set(slot, getLevel(slot, defaultItem));

    if (slotAffectsHP(slot) && this.callbacks.onHPUpdate) {
      this.callbacks.onHPUpdate();
    }

    return { kind: droppedKind, properties: droppedProperties };
  }

  /**
   * Get the currently equipped item in a slot
   */
  getEquipped(slot: EquipmentSlot): number {
    return this.equipped.get(slot) || getDefaultItem(slot);
  }

  /**
   * Get the properties of the equipped item in a slot
   */
  getProperties(slot: EquipmentSlot): ItemProperties | null {
    return this.properties.get(slot) || null;
  }

  /**
   * Get the combat level for a slot
   */
  getLevel(slot: EquipmentSlot): number {
    return this.levels.get(slot) || 1;
  }

  /**
   * Get the rank for a slot (0-based index in tier list)
   */
  getRank(slot: EquipmentSlot): number {
    const kind = this.equipped.get(slot);
    return kind ? getRank(slot, kind) : 0;
  }

  /**
   * Check if equipped item is the default for its slot
   */
  hasDefault(slot: EquipmentSlot): boolean {
    const kind = this.equipped.get(slot);
    return !kind || isDefaultItem(slot, kind);
  }

  /**
   * Check if a new item would be an upgrade
   */
  isUpgrade(kind: number): boolean {
    const slot = getSlotForKind(kind);
    if (!slot) return false;

    const currentKind = this.equipped.get(slot);
    if (!currentKind) return true;

    return getRank(slot, kind) > getRank(slot, currentKind);
  }

  // ============================================================================
  // Legacy compatibility getters (for existing code that accesses directly)
  // ============================================================================

  get weapon(): number {
    return this.getEquipped('weapon');
  }

  get armor(): number {
    return this.getEquipped('armor');
  }

  get weaponLevel(): number {
    return this.getLevel('weapon');
  }

  get armorLevel(): number {
    return this.getLevel('armor');
  }

  /**
   * Get equipment state for network serialization
   */
  getState(): { weapon: number; armor: number } {
    return {
      weapon: this.getEquipped('weapon'),
      armor: this.getEquipped('armor')
    };
  }
}
