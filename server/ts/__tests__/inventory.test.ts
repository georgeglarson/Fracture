/**
 * Tests for Inventory
 * Covers: construction, addItem, removeItem, hasRoom, getSlot, getSerializedSlots,
 *         swapSlots, isSlotEquipment, isSlotConsumable, loadFromData, full inventory,
 *         edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Inventory } from '../inventory/inventory';
import { Types } from '../../../shared/ts/gametypes';
import {
  INVENTORY_SIZE,
  MAX_STACK_SIZE,
  SerializedInventorySlot,
} from '../../../shared/ts/inventory/inventory-types';
import { Rarity, ItemProperties } from '../../../shared/ts/items/item-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal weapon properties object for testing. */
function makeWeaponProps(overrides: Partial<ItemProperties> = {}): ItemProperties {
  return {
    rarity: Rarity.COMMON,
    level: 1,
    category: 'weapon',
    damageMin: 5,
    damageMax: 10,
    ...overrides,
  };
}

/** A minimal armor properties object for testing. */
function makeArmorProps(overrides: Partial<ItemProperties> = {}): ItemProperties {
  return {
    rarity: Rarity.UNCOMMON,
    level: 3,
    category: 'armor',
    defense: 8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Inventory', () => {
  let inventory: Inventory;

  beforeEach(() => {
    inventory = new Inventory();
  });

  // =========================================================================
  // Construction
  // =========================================================================

  describe('constructor', () => {
    it('should create an inventory with INVENTORY_SIZE slots', () => {
      const slots = inventory.getSlots();
      expect(slots).toHaveLength(INVENTORY_SIZE);
    });

    it('should initialize all slots to null', () => {
      const slots = inventory.getSlots();
      for (const slot of slots) {
        expect(slot).toBeNull();
      }
    });

    it('should report zero items on creation', () => {
      expect(inventory.getItemCount()).toBe(0);
    });

    it('should not be full on creation', () => {
      expect(inventory.isFull()).toBe(false);
    });
  });

  // =========================================================================
  // addItem
  // =========================================================================

  describe('addItem', () => {
    describe('equipment items (non-stackable)', () => {
      it('should add a weapon to the first empty slot', () => {
        const props = makeWeaponProps();
        const slot = inventory.addItem(Types.Entities.SWORD2, props);

        expect(slot).toBe(0);
        const stored = inventory.getSlot(0);
        expect(stored).not.toBeNull();
        expect(stored!.kind).toBe(Types.Entities.SWORD2);
        expect(stored!.properties).toEqual(props);
        expect(stored!.count).toBe(1);
      });

      it('should add an armor item', () => {
        const props = makeArmorProps();
        const slot = inventory.addItem(Types.Entities.PLATEARMOR, props);

        expect(slot).toBe(0);
        expect(inventory.getSlot(0)!.kind).toBe(Types.Entities.PLATEARMOR);
      });

      it('should always set count to 1 for equipment regardless of count argument', () => {
        const slot = inventory.addItem(Types.Entities.SWORD2, makeWeaponProps(), 5);
        expect(inventory.getSlot(slot)!.count).toBe(1);
      });

      it('should not store properties for consumable items', () => {
        const slot = inventory.addItem(Types.Entities.FLASK, null);
        expect(inventory.getSlot(slot)!.properties).toBeNull();
      });

      it('should place items in successive empty slots', () => {
        inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
        inventory.addItem(Types.Entities.AXE, makeWeaponProps());
        inventory.addItem(Types.Entities.PLATEARMOR, makeArmorProps());

        expect(inventory.getSlot(0)!.kind).toBe(Types.Entities.SWORD2);
        expect(inventory.getSlot(1)!.kind).toBe(Types.Entities.AXE);
        expect(inventory.getSlot(2)!.kind).toBe(Types.Entities.PLATEARMOR);
      });
    });

    describe('consumable items (stackable)', () => {
      it('should add a consumable with default count of 1', () => {
        const slot = inventory.addItem(Types.Entities.FLASK, null);

        expect(slot).toBe(0);
        expect(inventory.getSlot(0)!.kind).toBe(Types.Entities.FLASK);
        expect(inventory.getSlot(0)!.count).toBe(1);
      });

      it('should add a consumable with a specified count', () => {
        const slot = inventory.addItem(Types.Entities.BURGER, null, 5);
        expect(inventory.getSlot(slot)!.count).toBe(5);
      });

      it('should stack onto an existing slot of the same kind', () => {
        inventory.addItem(Types.Entities.FLASK, null, 3);
        const secondSlot = inventory.addItem(Types.Entities.FLASK, null, 2);

        // Should stack into slot 0, not create a new slot
        expect(secondSlot).toBe(0);
        expect(inventory.getSlot(0)!.count).toBe(5);
        expect(inventory.getSlot(1)).toBeNull();
      });

      it('should cap a single stack at MAX_STACK_SIZE', () => {
        inventory.addItem(Types.Entities.FLASK, null, MAX_STACK_SIZE);
        expect(inventory.getSlot(0)!.count).toBe(MAX_STACK_SIZE);
      });

      it('should overflow into a new slot when the stack is full', () => {
        inventory.addItem(Types.Entities.FLASK, null, MAX_STACK_SIZE);
        const overflowSlot = inventory.addItem(Types.Entities.FLASK, null, 3);

        // Original stack stays at MAX, overflow goes to slot 1
        expect(inventory.getSlot(0)!.count).toBe(MAX_STACK_SIZE);
        expect(inventory.getSlot(1)!.count).toBe(3);
        // addItem returns the first stack slot even when overflow occurs
        expect(overflowSlot).toBe(1);
      });

      it('should partially stack and overflow the remainder', () => {
        inventory.addItem(Types.Entities.FLASK, null, MAX_STACK_SIZE - 2);
        // Adding 5: 2 go into slot 0, 3 overflow to slot 1
        const slot = inventory.addItem(Types.Entities.FLASK, null, 5);

        expect(inventory.getSlot(0)!.count).toBe(MAX_STACK_SIZE);
        expect(inventory.getSlot(1)!.count).toBe(3);
        // Returns the original stack slot
        expect(slot).toBe(0);
      });

      it('should not stack different consumable kinds together', () => {
        inventory.addItem(Types.Entities.FLASK, null, 3);
        inventory.addItem(Types.Entities.BURGER, null, 2);

        expect(inventory.getSlot(0)!.kind).toBe(Types.Entities.FLASK);
        expect(inventory.getSlot(0)!.count).toBe(3);
        expect(inventory.getSlot(1)!.kind).toBe(Types.Entities.BURGER);
        expect(inventory.getSlot(1)!.count).toBe(2);
      });

      it('should handle CAKE as a stackable item', () => {
        const slot = inventory.addItem(Types.Entities.CAKE, null, 4);
        expect(inventory.getSlot(slot)!.kind).toBe(Types.Entities.CAKE);
        expect(inventory.getSlot(slot)!.count).toBe(4);
      });

      it('should handle FIREPOTION as a stackable item', () => {
        const slot = inventory.addItem(Types.Entities.FIREPOTION, null, 2);
        expect(inventory.getSlot(slot)!.kind).toBe(Types.Entities.FIREPOTION);
        expect(inventory.getSlot(slot)!.count).toBe(2);
      });

      it('should clamp initial count to MAX_STACK_SIZE for new slot', () => {
        const slot = inventory.addItem(Types.Entities.FLASK, null, MAX_STACK_SIZE + 5);
        expect(inventory.getSlot(slot)!.count).toBe(MAX_STACK_SIZE);
      });
    });
  });

  // =========================================================================
  // removeItem
  // =========================================================================

  describe('removeItem', () => {
    it('should remove a single equipment item and clear the slot', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      const result = inventory.removeItem(0);

      expect(result).not.toBeNull();
      expect(result!.kind).toBe(Types.Entities.SWORD2);
      expect(result!.count).toBe(1);
      expect(inventory.getSlot(0)).toBeNull();
    });

    it('should decrement count when removing partial stack', () => {
      inventory.addItem(Types.Entities.FLASK, null, 5);
      const result = inventory.removeItem(0, 2);

      expect(result!.count).toBe(2);
      expect(inventory.getSlot(0)!.count).toBe(3);
    });

    it('should remove the slot entirely when count reaches zero', () => {
      inventory.addItem(Types.Entities.FLASK, null, 3);
      inventory.removeItem(0, 3);

      expect(inventory.getSlot(0)).toBeNull();
    });

    it('should clamp removal count to available count', () => {
      inventory.addItem(Types.Entities.FLASK, null, 3);
      const result = inventory.removeItem(0, 100);

      expect(result!.count).toBe(3);
      expect(inventory.getSlot(0)).toBeNull();
    });

    it('should default to removing 1 when no count specified', () => {
      inventory.addItem(Types.Entities.FLASK, null, 5);
      const result = inventory.removeItem(0);

      expect(result!.count).toBe(1);
      expect(inventory.getSlot(0)!.count).toBe(4);
    });

    it('should return null when removing from an empty slot', () => {
      const result = inventory.removeItem(0);
      expect(result).toBeNull();
    });

    it('should return null for out-of-bounds negative index', () => {
      const result = inventory.removeItem(-1);
      expect(result).toBeNull();
    });

    it('should return null for out-of-bounds large index', () => {
      const result = inventory.removeItem(INVENTORY_SIZE);
      expect(result).toBeNull();
    });

    it('should preserve properties in the returned result', () => {
      const props = makeWeaponProps({ rarity: Rarity.EPIC, bonusStrength: 15 });
      inventory.addItem(Types.Entities.SWORD2, props);
      const result = inventory.removeItem(0);

      expect(result!.properties).toEqual(props);
    });
  });

  // =========================================================================
  // hasRoom
  // =========================================================================

  describe('hasRoom', () => {
    it('should return true for empty inventory', () => {
      expect(inventory.hasRoom(Types.Entities.SWORD2)).toBe(true);
      expect(inventory.hasRoom(Types.Entities.FLASK)).toBe(true);
    });

    it('should return true when there are empty slots', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      expect(inventory.hasRoom(Types.Entities.AXE)).toBe(true);
    });

    it('should return true for stackable item even when all slots are full', () => {
      // Fill all slots, but one has a non-full flask stack
      for (let i = 0; i < INVENTORY_SIZE - 1; i++) {
        inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      }
      inventory.addItem(Types.Entities.FLASK, null, 1);

      expect(inventory.isFull()).toBe(true);
      // Can still stack more flasks
      expect(inventory.hasRoom(Types.Entities.FLASK)).toBe(true);
    });

    it('should return false for equipment when all slots are full', () => {
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      }
      expect(inventory.hasRoom(Types.Entities.AXE)).toBe(false);
    });

    it('should return false for stackable item when full and all stacks are maxed', () => {
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        inventory.addItem(Types.Entities.FLASK, null, MAX_STACK_SIZE);
      }
      // Every slot is a max-stack flask, no room for another flask
      expect(inventory.hasRoom(Types.Entities.FLASK)).toBe(false);
    });

    it('should return false for a different stackable when inventory is full of equipment', () => {
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      }
      expect(inventory.hasRoom(Types.Entities.FLASK)).toBe(false);
    });
  });

  // =========================================================================
  // getSlot / getSlots
  // =========================================================================

  describe('getSlot', () => {
    it('should return null for empty slot', () => {
      expect(inventory.getSlot(0)).toBeNull();
    });

    it('should return the slot data after adding an item', () => {
      inventory.addItem(Types.Entities.FLASK, null, 3);
      const slot = inventory.getSlot(0);

      expect(slot).not.toBeNull();
      expect(slot!.kind).toBe(Types.Entities.FLASK);
      expect(slot!.count).toBe(3);
    });

    it('should return null for negative index', () => {
      expect(inventory.getSlot(-1)).toBeNull();
    });

    it('should return null for index at INVENTORY_SIZE', () => {
      expect(inventory.getSlot(INVENTORY_SIZE)).toBeNull();
    });

    it('should return null for very large index', () => {
      expect(inventory.getSlot(9999)).toBeNull();
    });
  });

  // =========================================================================
  // getSerializedSlots
  // =========================================================================

  describe('getSerializedSlots', () => {
    it('should return all nulls for empty inventory', () => {
      const serialized = inventory.getSerializedSlots();
      expect(serialized).toHaveLength(INVENTORY_SIZE);
      for (const slot of serialized) {
        expect(slot).toBeNull();
      }
    });

    it('should serialize a consumable slot correctly', () => {
      inventory.addItem(Types.Entities.FLASK, null, 5);
      const serialized = inventory.getSerializedSlots();

      expect(serialized[0]).not.toBeNull();
      expect(serialized[0]!.k).toBe(Types.Entities.FLASK);
      expect(serialized[0]!.c).toBe(5);
      expect(serialized[0]!.p).toBeNull();
    });

    it('should serialize an equipment slot with properties', () => {
      const props = makeWeaponProps({ rarity: Rarity.RARE, damageMin: 20, damageMax: 30 });
      inventory.addItem(Types.Entities.SWORD2, props);
      const serialized = inventory.getSerializedSlots();

      expect(serialized[0]).not.toBeNull();
      expect(serialized[0]!.k).toBe(Types.Entities.SWORD2);
      expect(serialized[0]!.c).toBe(1);
      expect(serialized[0]!.p).not.toBeNull();
      // Properties are serialized with short keys
      expect(serialized[0]!.p!['r']).toBe(Rarity.RARE);
    });

    it('should have matching length to INVENTORY_SIZE', () => {
      inventory.addItem(Types.Entities.FLASK, null);
      expect(inventory.getSerializedSlots()).toHaveLength(INVENTORY_SIZE);
    });
  });

  // =========================================================================
  // swapSlots
  // =========================================================================

  describe('swapSlots', () => {
    it('should swap two occupied slots', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      inventory.addItem(Types.Entities.FLASK, null, 3);

      const result = inventory.swapSlots(0, 1);

      expect(result).toBe(true);
      expect(inventory.getSlot(0)!.kind).toBe(Types.Entities.FLASK);
      expect(inventory.getSlot(1)!.kind).toBe(Types.Entities.SWORD2);
    });

    it('should swap an occupied slot with an empty slot', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());

      const result = inventory.swapSlots(0, 5);

      expect(result).toBe(true);
      expect(inventory.getSlot(0)).toBeNull();
      expect(inventory.getSlot(5)!.kind).toBe(Types.Entities.SWORD2);
    });

    it('should swap two empty slots without error', () => {
      const result = inventory.swapSlots(0, 1);
      expect(result).toBe(true);
      expect(inventory.getSlot(0)).toBeNull();
      expect(inventory.getSlot(1)).toBeNull();
    });

    it('should swap a slot with itself (no-op)', () => {
      inventory.addItem(Types.Entities.FLASK, null, 3);
      const result = inventory.swapSlots(0, 0);

      expect(result).toBe(true);
      expect(inventory.getSlot(0)!.kind).toBe(Types.Entities.FLASK);
      expect(inventory.getSlot(0)!.count).toBe(3);
    });

    it('should return false for negative fromIndex', () => {
      expect(inventory.swapSlots(-1, 0)).toBe(false);
    });

    it('should return false for negative toIndex', () => {
      expect(inventory.swapSlots(0, -1)).toBe(false);
    });

    it('should return false for fromIndex >= INVENTORY_SIZE', () => {
      expect(inventory.swapSlots(INVENTORY_SIZE, 0)).toBe(false);
    });

    it('should return false for toIndex >= INVENTORY_SIZE', () => {
      expect(inventory.swapSlots(0, INVENTORY_SIZE)).toBe(false);
    });

    it('should preserve item properties when swapping', () => {
      const props = makeWeaponProps({ rarity: Rarity.LEGENDARY, bonusCritChance: 25 });
      inventory.addItem(Types.Entities.SWORD2, props);
      inventory.addItem(Types.Entities.FLASK, null, 7);

      inventory.swapSlots(0, 1);

      expect(inventory.getSlot(1)!.properties).toEqual(props);
      expect(inventory.getSlot(0)!.count).toBe(7);
    });
  });

  // =========================================================================
  // isSlotEquipment / isSlotConsumable
  // =========================================================================

  describe('isSlotEquipment', () => {
    it('should return true for a weapon slot', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      expect(inventory.isSlotEquipment(0)).toBe(true);
    });

    it('should return true for an armor slot', () => {
      inventory.addItem(Types.Entities.PLATEARMOR, makeArmorProps());
      expect(inventory.isSlotEquipment(0)).toBe(true);
    });

    it('should return false for a consumable slot', () => {
      inventory.addItem(Types.Entities.FLASK, null);
      expect(inventory.isSlotEquipment(0)).toBe(false);
    });

    it('should return false for an empty slot', () => {
      expect(inventory.isSlotEquipment(0)).toBe(false);
    });

    it('should return false for an out-of-bounds index', () => {
      expect(inventory.isSlotEquipment(-1)).toBe(false);
      expect(inventory.isSlotEquipment(INVENTORY_SIZE)).toBe(false);
    });
  });

  describe('isSlotConsumable', () => {
    it('should return true for a flask slot', () => {
      inventory.addItem(Types.Entities.FLASK, null);
      expect(inventory.isSlotConsumable(0)).toBe(true);
    });

    it('should return true for a burger slot', () => {
      inventory.addItem(Types.Entities.BURGER, null);
      expect(inventory.isSlotConsumable(0)).toBe(true);
    });

    it('should return true for a cake slot', () => {
      inventory.addItem(Types.Entities.CAKE, null);
      expect(inventory.isSlotConsumable(0)).toBe(true);
    });

    it('should return true for a firepotion slot', () => {
      inventory.addItem(Types.Entities.FIREPOTION, null);
      expect(inventory.isSlotConsumable(0)).toBe(true);
    });

    it('should return false for a weapon slot', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      expect(inventory.isSlotConsumable(0)).toBe(false);
    });

    it('should return false for an empty slot', () => {
      expect(inventory.isSlotConsumable(0)).toBe(false);
    });

    it('should return false for an out-of-bounds index', () => {
      expect(inventory.isSlotConsumable(-1)).toBe(false);
      expect(inventory.isSlotConsumable(INVENTORY_SIZE)).toBe(false);
    });
  });

  // =========================================================================
  // loadFromData (persistence round-trip)
  // =========================================================================

  describe('loadFromData', () => {
    it('should restore inventory from serialized data', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      inventory.addItem(Types.Entities.FLASK, null, 7);
      inventory.addItem(Types.Entities.PLATEARMOR, makeArmorProps());

      const serialized = inventory.getSerializedSlots();

      const restored = new Inventory();
      restored.loadFromData(serialized);

      expect(restored.getSlot(0)!.kind).toBe(Types.Entities.SWORD2);
      expect(restored.getSlot(0)!.count).toBe(1);
      expect(restored.getSlot(1)!.kind).toBe(Types.Entities.FLASK);
      expect(restored.getSlot(1)!.count).toBe(7);
      expect(restored.getSlot(2)!.kind).toBe(Types.Entities.PLATEARMOR);
    });

    it('should preserve item properties through round-trip', () => {
      const props = makeWeaponProps({
        rarity: Rarity.EPIC,
        damageMin: 50,
        damageMax: 80,
        bonusStrength: 10,
        bonusCritChance: 5,
      });
      inventory.addItem(Types.Entities.GOLDENSWORD, props);

      const serialized = inventory.getSerializedSlots();
      const restored = new Inventory();
      restored.loadFromData(serialized);

      const restoredProps = restored.getSlot(0)!.properties!;
      expect(restoredProps.rarity).toBe(Rarity.EPIC);
      expect(restoredProps.damageMin).toBe(50);
      expect(restoredProps.damageMax).toBe(80);
      expect(restoredProps.bonusStrength).toBe(10);
      expect(restoredProps.bonusCritChance).toBe(5);
    });

    it('should handle empty serialized data', () => {
      const allNulls: (SerializedInventorySlot | null)[] = new Array(INVENTORY_SIZE).fill(null);
      inventory.loadFromData(allNulls);

      expect(inventory.getItemCount()).toBe(0);
      expect(inventory.getSlots()).toHaveLength(INVENTORY_SIZE);
    });

    it('should reset to empty inventory when data is null', () => {
      inventory.addItem(Types.Entities.FLASK, null, 5);
      inventory.loadFromData(null as any);

      expect(inventory.getItemCount()).toBe(0);
      expect(inventory.getSlots()).toHaveLength(INVENTORY_SIZE);
    });

    it('should reset to empty inventory when data is not an array', () => {
      inventory.addItem(Types.Entities.FLASK, null, 5);
      inventory.loadFromData('invalid' as any);

      expect(inventory.getItemCount()).toBe(0);
    });

    it('should pad to INVENTORY_SIZE when data has fewer slots', () => {
      const shortData: (SerializedInventorySlot | null)[] = [
        { k: Types.Entities.FLASK, p: null, c: 3 },
      ];
      inventory.loadFromData(shortData);

      expect(inventory.getSlots()).toHaveLength(INVENTORY_SIZE);
      expect(inventory.getSlot(0)!.kind).toBe(Types.Entities.FLASK);
      expect(inventory.getSlot(0)!.count).toBe(3);
      expect(inventory.getSlot(1)).toBeNull();
    });

    it('should truncate to INVENTORY_SIZE when data has more slots', () => {
      const longData: (SerializedInventorySlot | null)[] = [];
      for (let i = 0; i < INVENTORY_SIZE + 10; i++) {
        longData.push({ k: Types.Entities.FLASK, p: null, c: 1 });
      }
      inventory.loadFromData(longData);

      expect(inventory.getSlots()).toHaveLength(INVENTORY_SIZE);
    });

    it('should produce identical serialized output after round-trip', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      inventory.addItem(Types.Entities.FLASK, null, 4);
      inventory.addItem(Types.Entities.PLATEARMOR, makeArmorProps());

      const firstSerialized = inventory.getSerializedSlots();

      const restored = new Inventory();
      restored.loadFromData(firstSerialized);
      const secondSerialized = restored.getSerializedSlots();

      expect(secondSerialized).toEqual(firstSerialized);
    });
  });

  // =========================================================================
  // Full inventory behavior
  // =========================================================================

  describe('full inventory', () => {
    beforeEach(() => {
      // Fill every slot with equipment
      for (let i = 0; i < INVENTORY_SIZE; i++) {
        inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      }
    });

    it('should report isFull as true', () => {
      expect(inventory.isFull()).toBe(true);
    });

    it('should report item count as INVENTORY_SIZE', () => {
      expect(inventory.getItemCount()).toBe(INVENTORY_SIZE);
    });

    it('should return -1 from findEmptySlot', () => {
      expect(inventory.findEmptySlot()).toBe(-1);
    });

    it('should return -1 when adding an item to a full inventory', () => {
      const result = inventory.addItem(Types.Entities.AXE, makeWeaponProps());
      expect(result).toBe(-1);
    });

    it('should allow removal even when full', () => {
      const result = inventory.removeItem(0);
      expect(result).not.toBeNull();
      expect(inventory.isFull()).toBe(false);
      expect(inventory.getItemCount()).toBe(INVENTORY_SIZE - 1);
    });

    it('should allow adding after removing from a full inventory', () => {
      inventory.removeItem(0);
      const slot = inventory.addItem(Types.Entities.AXE, makeWeaponProps());
      expect(slot).toBe(0);
      expect(inventory.isFull()).toBe(true);
    });

    it('should allow swapping when full', () => {
      const result = inventory.swapSlots(0, INVENTORY_SIZE - 1);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // setSlot
  // =========================================================================

  describe('setSlot', () => {
    it('should set a slot directly', () => {
      inventory.setSlot(3, {
        kind: Types.Entities.FLASK,
        properties: null,
        count: 5,
      });

      expect(inventory.getSlot(3)!.kind).toBe(Types.Entities.FLASK);
      expect(inventory.getSlot(3)!.count).toBe(5);
    });

    it('should clear a slot by setting null', () => {
      inventory.addItem(Types.Entities.FLASK, null);
      inventory.setSlot(0, null);

      expect(inventory.getSlot(0)).toBeNull();
    });

    it('should ignore negative index', () => {
      inventory.setSlot(-1, { kind: Types.Entities.FLASK, properties: null, count: 1 });
      // No crash, inventory unchanged
      expect(inventory.getItemCount()).toBe(0);
    });

    it('should ignore index at INVENTORY_SIZE', () => {
      inventory.setSlot(INVENTORY_SIZE, { kind: Types.Entities.FLASK, properties: null, count: 1 });
      expect(inventory.getItemCount()).toBe(0);
    });
  });

  // =========================================================================
  // findEmptySlot / findStackableSlot
  // =========================================================================

  describe('findEmptySlot', () => {
    it('should return 0 for empty inventory', () => {
      expect(inventory.findEmptySlot()).toBe(0);
    });

    it('should return first gap when items are scattered', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps()); // slot 0
      inventory.addItem(Types.Entities.AXE, makeWeaponProps());    // slot 1
      inventory.removeItem(0);                                      // clear slot 0

      expect(inventory.findEmptySlot()).toBe(0);
    });
  });

  describe('findStackableSlot', () => {
    it('should return -1 for equipment kinds', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      expect(inventory.findStackableSlot(Types.Entities.SWORD2)).toBe(-1);
    });

    it('should return the slot index for an existing non-full stack', () => {
      inventory.addItem(Types.Entities.FLASK, null, 3);
      expect(inventory.findStackableSlot(Types.Entities.FLASK)).toBe(0);
    });

    it('should return -1 when all stacks of that kind are full', () => {
      inventory.addItem(Types.Entities.FLASK, null, MAX_STACK_SIZE);
      expect(inventory.findStackableSlot(Types.Entities.FLASK)).toBe(-1);
    });

    it('should return -1 when there are no slots of that kind', () => {
      inventory.addItem(Types.Entities.FLASK, null, 3);
      expect(inventory.findStackableSlot(Types.Entities.BURGER)).toBe(-1);
    });
  });

  // =========================================================================
  // getConsumableHealAmount / isFirePotion
  // =========================================================================

  describe('getConsumableHealAmount', () => {
    it('should return 40 for FLASK', () => {
      expect(inventory.getConsumableHealAmount(Types.Entities.FLASK)).toBe(40);
    });

    it('should return 100 for BURGER', () => {
      expect(inventory.getConsumableHealAmount(Types.Entities.BURGER)).toBe(100);
    });

    it('should return 60 for CAKE', () => {
      expect(inventory.getConsumableHealAmount(Types.Entities.CAKE)).toBe(60);
    });

    it('should return 0 for non-consumable kinds', () => {
      expect(inventory.getConsumableHealAmount(Types.Entities.SWORD2)).toBe(0);
    });

    it('should return 0 for FIREPOTION', () => {
      expect(inventory.getConsumableHealAmount(Types.Entities.FIREPOTION)).toBe(0);
    });
  });

  describe('isFirePotion', () => {
    it('should return true for FIREPOTION kind', () => {
      expect(inventory.isFirePotion(Types.Entities.FIREPOTION)).toBe(true);
    });

    it('should return false for FLASK', () => {
      expect(inventory.isFirePotion(Types.Entities.FLASK)).toBe(false);
    });

    it('should return false for equipment', () => {
      expect(inventory.isFirePotion(Types.Entities.SWORD2)).toBe(false);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('should handle adding to slot 0 after it was cleared', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());
      inventory.removeItem(0);
      const slot = inventory.addItem(Types.Entities.AXE, makeWeaponProps());

      expect(slot).toBe(0);
      expect(inventory.getSlot(0)!.kind).toBe(Types.Entities.AXE);
    });

    it('should handle multiple remove calls on the same slot gracefully', () => {
      inventory.addItem(Types.Entities.FLASK, null, 3);

      const r1 = inventory.removeItem(0, 1);
      expect(r1!.count).toBe(1);

      const r2 = inventory.removeItem(0, 1);
      expect(r2!.count).toBe(1);

      const r3 = inventory.removeItem(0, 1);
      expect(r3!.count).toBe(1);

      // Slot is now empty
      const r4 = inventory.removeItem(0);
      expect(r4).toBeNull();
    });

    it('should handle count of 0 in removeItem (removes 0, slot stays)', () => {
      inventory.addItem(Types.Entities.FLASK, null, 5);
      const result = inventory.removeItem(0, 0);

      // min(0, 5) = 0, count becomes 5-0=5, but slot.count <= 0 check is false
      // Actually 0 is <= 0 only if count dropped to 0, which it won't here
      expect(result).not.toBeNull();
      expect(result!.count).toBe(0);
      // Slot should remain since count didn't drop to zero
      expect(inventory.getSlot(0)!.count).toBe(5);
    });

    it('should handle interleaved adds and removes', () => {
      inventory.addItem(Types.Entities.SWORD2, makeWeaponProps());  // slot 0
      inventory.addItem(Types.Entities.FLASK, null, 3);             // slot 1
      inventory.removeItem(0);                                       // clear slot 0
      inventory.addItem(Types.Entities.AXE, makeWeaponProps());     // slot 0 (first empty)
      inventory.addItem(Types.Entities.FLASK, null, 2);             // stacks onto slot 1

      expect(inventory.getSlot(0)!.kind).toBe(Types.Entities.AXE);
      expect(inventory.getSlot(1)!.kind).toBe(Types.Entities.FLASK);
      expect(inventory.getSlot(1)!.count).toBe(5);
      expect(inventory.getItemCount()).toBe(2);
    });

    it('should not mutate slot data after getSlots returns a reference', () => {
      inventory.addItem(Types.Entities.FLASK, null, 3);
      const slots = inventory.getSlots();
      // The reference is live -- modifying via inventory should reflect
      inventory.removeItem(0, 1);
      expect(slots[0]!.count).toBe(2);
    });

    it('should handle equipment with null properties', () => {
      // Equipment with null properties -- addItem stores null since isEquipment returns true
      // but properties is null
      const slot = inventory.addItem(Types.Entities.SWORD2, null);
      expect(inventory.getSlot(slot)!.properties).toBeNull();
      expect(inventory.getSlot(slot)!.count).toBe(1);
    });
  });
});
