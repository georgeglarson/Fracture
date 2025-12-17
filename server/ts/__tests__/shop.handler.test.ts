/**
 * Tests for ShopHandler
 * Covers: buying equipment goes to inventory, buying consumables goes to inventory
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';

// Mock economy service
vi.mock('../player/economy.service.js', () => ({
  getEconomyService: () => ({
    processPurchase: vi.fn((npcKind, itemKind, gold) => {
      // Simple mock - assume 100g items
      if (gold >= 100) {
        return {
          success: true,
          newGold: gold - 100,
          cost: 100,
          message: 'Purchase successful',
          isWeapon: Types.isWeapon(itemKind),
          isArmor: Types.isArmor(itemKind),
          isConsumable: Types.isObject(itemKind) && !Types.isChest(itemKind),
          healAmount: Types.isHealingItem(itemKind) ? 50 : 0,
        };
      }
      return {
        success: false,
        newGold: gold,
        cost: 0,
        message: 'Not enough gold',
        isWeapon: false,
        isArmor: false,
        isConsumable: false,
        healAmount: 0,
      };
    }),
    processSell: vi.fn(() => ({
      success: true,
      newGold: 150,
      sellPrice: 50,
      message: 'Sold',
    })),
  }),
}));

import { handleShopBuy, handleShopSell, ShopPlayerContext } from '../player/shop.handler';

describe('ShopHandler', () => {
  let mockCtx: ShopPlayerContext;
  let mockInventory: any;

  beforeEach(() => {
    mockInventory = {
      hasRoom: vi.fn(() => true),
      addItem: vi.fn(() => 0), // Returns slot index
      removeItem: vi.fn(),
      getSlot: vi.fn(() => ({ kind: Types.Entities.FLASK, count: 1, properties: null })),
    };

    mockCtx = {
      id: 1,
      name: 'TestPlayer',
      gold: 500,
      hitPoints: 80,
      maxHitPoints: 100,
      send: vi.fn(),
      broadcast: vi.fn(),
      equipWeapon: vi.fn(),
      equipArmor: vi.fn(),
      regenHealthBy: vi.fn(),
      checkPurchaseAchievements: vi.fn(),
      setGold: vi.fn((gold) => { mockCtx.gold = gold; }),
      getInventory: () => mockInventory,
    };
  });

  describe('handleShopBuy - Equipment', () => {
    it('should add weapon to inventory instead of auto-equipping', () => {
      handleShopBuy(mockCtx, Types.Entities.ARMORSELLER, Types.Entities.SWORD2);

      expect(mockInventory.addItem).toHaveBeenCalledWith(Types.Entities.SWORD2, null, 1);
      expect(mockCtx.equipWeapon).not.toHaveBeenCalled();
      expect(mockCtx.send).toHaveBeenCalled();
    });

    it('should add armor to inventory instead of auto-equipping', () => {
      handleShopBuy(mockCtx, Types.Entities.ARMORSELLER, Types.Entities.LEATHERARMOR);

      expect(mockInventory.addItem).toHaveBeenCalledWith(Types.Entities.LEATHERARMOR, null, 1);
      expect(mockCtx.equipArmor).not.toHaveBeenCalled();
    });

    it('should reject purchase when inventory is full', () => {
      mockInventory.hasRoom.mockReturnValue(false);

      handleShopBuy(mockCtx, Types.Entities.ARMORSELLER, Types.Entities.SWORD2);

      expect(mockInventory.addItem).not.toHaveBeenCalled();
      expect(mockCtx.setGold).not.toHaveBeenCalled();
    });
  });

  describe('handleShopBuy - Consumables', () => {
    it('should add consumables to inventory instead of using immediately', () => {
      handleShopBuy(mockCtx, Types.Entities.ARMORSELLER, Types.Entities.FLASK);

      expect(mockInventory.addItem).toHaveBeenCalledWith(Types.Entities.FLASK, null, 1);
      expect(mockCtx.regenHealthBy).not.toHaveBeenCalled(); // Should NOT heal immediately
    });

    it('should reject consumable purchase when inventory is full', () => {
      mockInventory.hasRoom.mockReturnValue(false);

      handleShopBuy(mockCtx, Types.Entities.ARMORSELLER, Types.Entities.FLASK);

      expect(mockInventory.addItem).not.toHaveBeenCalled();
    });

    it('should deduct gold on successful purchase', () => {
      const originalGold = mockCtx.gold;
      handleShopBuy(mockCtx, Types.Entities.ARMORSELLER, Types.Entities.FLASK);

      expect(mockCtx.setGold).toHaveBeenCalledWith(originalGold - 100);
    });
  });

  describe('handleShopBuy - Insufficient Gold', () => {
    it('should not purchase when gold is insufficient', () => {
      mockCtx.gold = 50; // Less than 100

      handleShopBuy(mockCtx, Types.Entities.ARMORSELLER, Types.Entities.SWORD2);

      expect(mockInventory.addItem).not.toHaveBeenCalled();
    });
  });

  describe('handleShopSell', () => {
    it('should remove item from inventory on sell', () => {
      handleShopSell(mockCtx, 0);

      expect(mockInventory.removeItem).toHaveBeenCalledWith(0, 1);
    });

    it('should grant gold on successful sell', () => {
      handleShopSell(mockCtx, 0);

      expect(mockCtx.setGold).toHaveBeenCalled();
    });

    it('should not sell from empty slot', () => {
      mockInventory.getSlot.mockReturnValue(null);

      handleShopSell(mockCtx, 0);

      expect(mockInventory.removeItem).not.toHaveBeenCalled();
    });

    it('should send inventory update after selling', () => {
      handleShopSell(mockCtx, 0);

      expect(mockCtx.send).toHaveBeenCalled();
    });
  });
});
