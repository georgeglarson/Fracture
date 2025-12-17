/**
 * Tests for InventoryHandler
 * Covers: unequip to inventory, pickup to inventory, use consumables
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';
import {
  handleUnequipToInventory,
  handleInventoryPickup,
  handleInventoryUse,
  handleInventoryEquip,
  InventoryPlayerContext
} from '../player/inventory.handler';

describe('InventoryHandler', () => {
  let mockCtx: InventoryPlayerContext;
  let mockInventory: any;
  let mockWorld: any;

  beforeEach(() => {
    mockInventory = {
      hasRoom: vi.fn(() => true),
      addItem: vi.fn(() => 0), // Returns slot index
      removeItem: vi.fn(),
      getSlot: vi.fn(() => null),
      setSlot: vi.fn(),
      swapSlots: vi.fn(() => true),
      isSlotConsumable: vi.fn(() => false),
      isSlotEquipment: vi.fn(() => false),
      isFirePotion: vi.fn(() => false),
      getConsumableHealAmount: vi.fn(() => 0),
      getSerializedSlots: vi.fn(() => []),
    };

    mockWorld = {
      getEntityById: vi.fn(() => null),
      removeEntity: vi.fn(),
      createItemWithProperties: vi.fn(() => ({ id: 999 })),
      addItem: vi.fn(),
      pushToPlayer: vi.fn(),
    };

    mockCtx = {
      id: 1,
      name: 'TestPlayer',
      x: 100,
      y: 100,
      weapon: Types.Entities.SWORD2, // Non-default weapon
      armor: Types.Entities.LEATHERARMOR, // Non-default armor
      maxHitPoints: 100,
      send: vi.fn(),
      broadcast: vi.fn(),
      equip: vi.fn(() => ({ serialize: () => [] })),
      equipWeapon: vi.fn(),
      equipArmor: vi.fn(),
      updateHitPoints: vi.fn(),
      hasFullHealth: vi.fn(() => false),
      regenHealthBy: vi.fn(),
      health: vi.fn(() => ({ serialize: () => [] })),
      getInventory: () => mockInventory,
      getEquipment: () => ({
        getEquipped: vi.fn(() => 0),
      }),
      getWorld: () => mockWorld,
      firepotionTimeout: null,
      setFirepotionTimeout: vi.fn(),
    };
  });

  describe('handleUnequipToInventory', () => {
    it('should unequip weapon to inventory when inventory has room', () => {
      handleUnequipToInventory(mockCtx, 'weapon');

      expect(mockInventory.hasRoom).toHaveBeenCalledWith(Types.Entities.SWORD2);
      expect(mockInventory.addItem).toHaveBeenCalledWith(Types.Entities.SWORD2, null, 1);
      expect(mockCtx.equipWeapon).toHaveBeenCalledWith(Types.Entities.SWORD1); // Default weapon
      expect(mockCtx.broadcast).toHaveBeenCalled();
      expect(mockCtx.send).toHaveBeenCalled();
    });

    it('should unequip armor to inventory when inventory has room', () => {
      handleUnequipToInventory(mockCtx, 'armor');

      expect(mockInventory.hasRoom).toHaveBeenCalledWith(Types.Entities.LEATHERARMOR);
      expect(mockInventory.addItem).toHaveBeenCalledWith(Types.Entities.LEATHERARMOR, null, 1);
      expect(mockCtx.equipArmor).toHaveBeenCalledWith(Types.Entities.CLOTHARMOR); // Default armor
      expect(mockCtx.updateHitPoints).toHaveBeenCalled();
    });

    it('should not unequip default weapon', () => {
      mockCtx.weapon = Types.Entities.SWORD1;
      handleUnequipToInventory(mockCtx, 'weapon');

      expect(mockInventory.addItem).not.toHaveBeenCalled();
    });

    it('should not unequip default armor', () => {
      mockCtx.armor = Types.Entities.CLOTHARMOR;
      handleUnequipToInventory(mockCtx, 'armor');

      expect(mockInventory.addItem).not.toHaveBeenCalled();
    });

    it('should not unequip when inventory is full', () => {
      mockInventory.hasRoom.mockReturnValue(false);
      handleUnequipToInventory(mockCtx, 'weapon');

      expect(mockInventory.addItem).not.toHaveBeenCalled();
      expect(mockCtx.equipWeapon).not.toHaveBeenCalled();
    });

    it('should reject invalid slot types', () => {
      handleUnequipToInventory(mockCtx, 'invalid');

      expect(mockInventory.hasRoom).not.toHaveBeenCalled();
    });
  });

  describe('handleInventoryPickup', () => {
    it('should add item to inventory when picking up', () => {
      const mockItem = {
        id: 500,
        kind: Types.Entities.FLASK,
        properties: null,
        despawn: vi.fn(() => ({ serialize: () => [] })),
      };
      mockWorld.getEntityById.mockReturnValue(mockItem);

      handleInventoryPickup(mockCtx, 500);

      expect(mockInventory.addItem).toHaveBeenCalledWith(Types.Entities.FLASK, null, 1);
      expect(mockWorld.removeEntity).toHaveBeenCalledWith(mockItem);
      expect(mockCtx.send).toHaveBeenCalled();
    });

    it('should not pickup when inventory is full', () => {
      const mockItem = {
        id: 500,
        kind: Types.Entities.FLASK,
        properties: null,
      };
      mockWorld.getEntityById.mockReturnValue(mockItem);
      mockInventory.hasRoom.mockReturnValue(false);

      handleInventoryPickup(mockCtx, 500);

      expect(mockInventory.addItem).not.toHaveBeenCalled();
    });

    it('should not pickup invalid items', () => {
      mockWorld.getEntityById.mockReturnValue(null);

      handleInventoryPickup(mockCtx, 999);

      expect(mockInventory.addItem).not.toHaveBeenCalled();
    });
  });

  describe('handleInventoryUse', () => {
    it('should use consumable and reduce count', () => {
      mockInventory.getSlot.mockReturnValue({
        kind: Types.Entities.FLASK,
        properties: null,
        count: 3,
      });
      mockInventory.isSlotConsumable.mockReturnValue(true);
      mockInventory.getConsumableHealAmount.mockReturnValue(50);

      handleInventoryUse(mockCtx, 0);

      expect(mockInventory.removeItem).toHaveBeenCalledWith(0, 1);
      expect(mockCtx.regenHealthBy).toHaveBeenCalledWith(50);
    });

    it('should not use non-consumable items', () => {
      mockInventory.getSlot.mockReturnValue({
        kind: Types.Entities.SWORD2,
        properties: null,
        count: 1,
      });
      mockInventory.isSlotConsumable.mockReturnValue(false);

      handleInventoryUse(mockCtx, 0);

      expect(mockInventory.removeItem).not.toHaveBeenCalled();
    });

    it('should not use from empty slot', () => {
      mockInventory.getSlot.mockReturnValue(null);

      handleInventoryUse(mockCtx, 0);

      expect(mockInventory.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('handleInventoryEquip', () => {
    it('should equip weapon from inventory', () => {
      mockInventory.getSlot.mockReturnValue({
        kind: Types.Entities.SWORD2,
        properties: null,
        count: 1,
      });
      mockInventory.isSlotEquipment.mockReturnValue(true);
      mockCtx.weapon = Types.Entities.SWORD1; // Has default weapon

      handleInventoryEquip(mockCtx, 0);

      expect(mockInventory.removeItem).toHaveBeenCalledWith(0, 1);
      expect(mockCtx.equipWeapon).toHaveBeenCalledWith(Types.Entities.SWORD2);
      expect(mockCtx.broadcast).toHaveBeenCalled();
    });

    it('should swap equipped item to inventory when equipping', () => {
      mockInventory.getSlot.mockReturnValue({
        kind: Types.Entities.GOLDARMOR,
        properties: null,
        count: 1,
      });
      mockInventory.isSlotEquipment.mockReturnValue(true);
      mockCtx.armor = Types.Entities.LEATHERARMOR; // Has non-default armor

      handleInventoryEquip(mockCtx, 0);

      // Old armor should go to inventory
      expect(mockInventory.setSlot).toHaveBeenCalled();
    });
  });
});
