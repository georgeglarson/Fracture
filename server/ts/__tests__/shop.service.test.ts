/**
 * Tests for ShopService
 * Covers: shop initialization, item listings, buy/sell logic,
 *         price calculations, inventory/stock integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';

// Mock the item-tables dependency used by processPurchase
vi.mock('../items/item-tables.js', () => ({
  getDisplayName: vi.fn((kind: number) => {
    const names: Record<number, string> = {
      [Types.Entities.FLASK]: 'Health Potion',
      [Types.Entities.BURGER]: 'Burger',
      [Types.Entities.CAKE]: 'Cake',
      [Types.Entities.FIREPOTION]: 'Fire Potion',
      [Types.Entities.SWORD1]: 'Wooden Sword',
      [Types.Entities.SWORD2]: 'Steel Sword',
      [Types.Entities.AXE]: 'Battle Axe',
      [Types.Entities.MORNINGSTAR]: 'Morning Star',
      [Types.Entities.BLUESWORD]: 'Sapphire Sword',
      [Types.Entities.CLOTHARMOR]: 'Cloth Armor',
      [Types.Entities.LEATHERARMOR]: 'Leather Armor',
      [Types.Entities.MAILARMOR]: 'Mail Armor',
      [Types.Entities.PLATEARMOR]: 'Plate Armor',
      [Types.Entities.REDARMOR]: 'Ruby Armor',
    };
    return names[kind] || 'Unknown Item';
  }),
}));

import {
  ShopService,
  SHOP_INVENTORIES,
  isMerchant,
  getShopInventory,
  getItemPrice,
  getSellPrice,
  shopService,
} from '../shop/shop.service';

// ============================================================================
// SHOP_INVENTORIES constant
// ============================================================================

describe('SHOP_INVENTORIES', () => {
  it('should define exactly four merchant NPCs', () => {
    const npcKinds = Object.keys(SHOP_INVENTORIES).map(Number);
    expect(npcKinds).toHaveLength(4);
    expect(npcKinds).toContain(Types.Entities.VILLAGEGIRL);
    expect(npcKinds).toContain(Types.Entities.GUARD);
    expect(npcKinds).toContain(Types.Entities.VILLAGER);
    expect(npcKinds).toContain(Types.Entities.SCIENTIST);
  });

  it('should give each shop a name', () => {
    for (const npcKind of Object.keys(SHOP_INVENTORIES)) {
      const shop = SHOP_INVENTORIES[Number(npcKind)];
      expect(shop.name).toBeTruthy();
      expect(typeof shop.name).toBe('string');
    }
  });

  it('should have at least one item per shop', () => {
    for (const npcKind of Object.keys(SHOP_INVENTORIES)) {
      const shop = SHOP_INVENTORIES[Number(npcKind)];
      expect(shop.items.length).toBeGreaterThan(0);
    }
  });

  it('should have valid price and stock for every item', () => {
    for (const npcKind of Object.keys(SHOP_INVENTORIES)) {
      const shop = SHOP_INVENTORIES[Number(npcKind)];
      for (const item of shop.items) {
        expect(item.price).toBeGreaterThan(0);
        expect(item.stock === -1 || item.stock > 0).toBe(true);
      }
    }
  });

  describe('VillageGirl shop', () => {
    const shop = SHOP_INVENTORIES[Types.Entities.VILLAGEGIRL];

    it('should be named "Elara\'s Potions"', () => {
      expect(shop.name).toBe("Elara's Potions");
    });

    it('should stock consumable items', () => {
      const kinds = shop.items.map(i => i.itemKind);
      expect(kinds).toContain(Types.Entities.FLASK);
      expect(kinds).toContain(Types.Entities.BURGER);
      expect(kinds).toContain(Types.Entities.CAKE);
      expect(kinds).toContain(Types.Entities.FIREPOTION);
    });

    it('should have unlimited stock for basic consumables', () => {
      const flask = shop.items.find(i => i.itemKind === Types.Entities.FLASK)!;
      expect(flask.stock).toBe(-1);
    });

    it('should have limited stock for fire potion', () => {
      const fp = shop.items.find(i => i.itemKind === Types.Entities.FIREPOTION)!;
      expect(fp.stock).toBe(3);
    });
  });

  describe('Guard shop', () => {
    const shop = SHOP_INVENTORIES[Types.Entities.GUARD];

    it('should be named "Guard Armory"', () => {
      expect(shop.name).toBe('Guard Armory');
    });

    it('should stock weapon items', () => {
      const kinds = shop.items.map(i => i.itemKind);
      expect(kinds).toContain(Types.Entities.SWORD1);
      expect(kinds).toContain(Types.Entities.SWORD2);
      expect(kinds).toContain(Types.Entities.AXE);
      expect(kinds).toContain(Types.Entities.MORNINGSTAR);
    });

    it('should have limited stock for morningstar', () => {
      const ms = shop.items.find(i => i.itemKind === Types.Entities.MORNINGSTAR)!;
      expect(ms.stock).toBe(2);
    });
  });

  describe('Villager shop', () => {
    const shop = SHOP_INVENTORIES[Types.Entities.VILLAGER];

    it('should be named "Town Outfitters"', () => {
      expect(shop.name).toBe('Town Outfitters');
    });

    it('should stock armor items', () => {
      const kinds = shop.items.map(i => i.itemKind);
      expect(kinds).toContain(Types.Entities.CLOTHARMOR);
      expect(kinds).toContain(Types.Entities.LEATHERARMOR);
      expect(kinds).toContain(Types.Entities.MAILARMOR);
      expect(kinds).toContain(Types.Entities.PLATEARMOR);
    });

    it('should have limited stock for plate armor', () => {
      const plate = shop.items.find(i => i.itemKind === Types.Entities.PLATEARMOR)!;
      expect(plate.stock).toBe(2);
    });
  });

  describe('Scientist shop', () => {
    const shop = SHOP_INVENTORIES[Types.Entities.SCIENTIST];

    it('should be named "Alchemist\'s Wares"', () => {
      expect(shop.name).toBe("Alchemist's Wares");
    });

    it('should stock high-tier items', () => {
      const kinds = shop.items.map(i => i.itemKind);
      expect(kinds).toContain(Types.Entities.FIREPOTION);
      expect(kinds).toContain(Types.Entities.BLUESWORD);
      expect(kinds).toContain(Types.Entities.REDARMOR);
    });

    it('should have limited stock for all items', () => {
      for (const item of shop.items) {
        expect(item.stock).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// isMerchant()
// ============================================================================

describe('isMerchant', () => {
  it('should return true for each merchant NPC', () => {
    expect(isMerchant(Types.Entities.VILLAGEGIRL)).toBe(true);
    expect(isMerchant(Types.Entities.GUARD)).toBe(true);
    expect(isMerchant(Types.Entities.VILLAGER)).toBe(true);
    expect(isMerchant(Types.Entities.SCIENTIST)).toBe(true);
  });

  it('should return false for non-merchant NPCs', () => {
    expect(isMerchant(Types.Entities.KING)).toBe(false);
    expect(isMerchant(Types.Entities.PRIEST)).toBe(false);
    expect(isMerchant(Types.Entities.RICK)).toBe(false);
    expect(isMerchant(Types.Entities.CODER)).toBe(false);
  });

  it('should return false for mobs', () => {
    expect(isMerchant(Types.Entities.RAT)).toBe(false);
    expect(isMerchant(Types.Entities.BOSS)).toBe(false);
  });

  it('should return false for items', () => {
    expect(isMerchant(Types.Entities.SWORD1)).toBe(false);
    expect(isMerchant(Types.Entities.FLASK)).toBe(false);
  });

  it('should return false for an arbitrary invalid kind', () => {
    expect(isMerchant(99999)).toBe(false);
  });
});

// ============================================================================
// getShopInventory()
// ============================================================================

describe('getShopInventory', () => {
  it('should return the ShopDefinition for a merchant NPC', () => {
    const inv = getShopInventory(Types.Entities.GUARD);
    expect(inv).not.toBeNull();
    expect(inv!.name).toBe('Guard Armory');
    expect(inv!.items.length).toBeGreaterThan(0);
  });

  it('should return null for a non-merchant NPC', () => {
    expect(getShopInventory(Types.Entities.KING)).toBeNull();
  });

  it('should return null for an invalid kind', () => {
    expect(getShopInventory(0)).toBeNull();
    expect(getShopInventory(-1)).toBeNull();
  });

  it('should return the full item list for each shop', () => {
    const villagegirl = getShopInventory(Types.Entities.VILLAGEGIRL)!;
    expect(villagegirl.items).toHaveLength(4);

    const guard = getShopInventory(Types.Entities.GUARD)!;
    expect(guard.items).toHaveLength(4);

    const villager = getShopInventory(Types.Entities.VILLAGER)!;
    expect(villager.items).toHaveLength(4);

    const scientist = getShopInventory(Types.Entities.SCIENTIST)!;
    expect(scientist.items).toHaveLength(3);
  });
});

// ============================================================================
// getItemPrice()
// ============================================================================

describe('getItemPrice', () => {
  it('should return the correct price for an item in a shop', () => {
    expect(getItemPrice(Types.Entities.VILLAGEGIRL, Types.Entities.FLASK)).toBe(25);
    expect(getItemPrice(Types.Entities.VILLAGEGIRL, Types.Entities.BURGER)).toBe(60);
    expect(getItemPrice(Types.Entities.GUARD, Types.Entities.SWORD1)).toBe(30);
    expect(getItemPrice(Types.Entities.GUARD, Types.Entities.AXE)).toBe(150);
    expect(getItemPrice(Types.Entities.VILLAGER, Types.Entities.PLATEARMOR)).toBe(250);
    expect(getItemPrice(Types.Entities.SCIENTIST, Types.Entities.BLUESWORD)).toBe(500);
  });

  it('should return null when item is not in the shop', () => {
    // Guard sells weapons, not flasks
    expect(getItemPrice(Types.Entities.GUARD, Types.Entities.FLASK)).toBeNull();
  });

  it('should return null when NPC is not a merchant', () => {
    expect(getItemPrice(Types.Entities.KING, Types.Entities.SWORD1)).toBeNull();
  });

  it('should return null for completely invalid kinds', () => {
    expect(getItemPrice(99999, Types.Entities.SWORD1)).toBeNull();
    expect(getItemPrice(Types.Entities.GUARD, 99999)).toBeNull();
  });
});

// ============================================================================
// getSellPrice()
// ============================================================================

describe('getSellPrice', () => {
  it('should return a positive sell price for weapons', () => {
    const price = getSellPrice(Types.Entities.SWORD1);
    expect(price).toBeGreaterThan(0);
  });

  it('should calculate weapon sell price as floor(10 + rank * 15)', () => {
    const sword1Rank = Types.getWeaponRank(Types.Entities.SWORD1);
    expect(getSellPrice(Types.Entities.SWORD1)).toBe(Math.floor(10 + sword1Rank * 15));

    const axeRank = Types.getWeaponRank(Types.Entities.AXE);
    expect(getSellPrice(Types.Entities.AXE)).toBe(Math.floor(10 + axeRank * 15));

    const blueswordRank = Types.getWeaponRank(Types.Entities.BLUESWORD);
    expect(getSellPrice(Types.Entities.BLUESWORD)).toBe(Math.floor(10 + blueswordRank * 15));
  });

  it('should return higher sell price for higher-rank weapons', () => {
    const sword1Price = getSellPrice(Types.Entities.SWORD1);
    const sword2Price = getSellPrice(Types.Entities.SWORD2);
    const axePrice = getSellPrice(Types.Entities.AXE);
    expect(sword2Price).toBeGreaterThan(sword1Price);
    expect(axePrice).toBeGreaterThan(sword2Price);
  });

  it('should return a positive sell price for armor', () => {
    const price = getSellPrice(Types.Entities.CLOTHARMOR);
    expect(price).toBeGreaterThan(0);
  });

  it('should calculate armor sell price as floor(8 + rank * 12)', () => {
    const clothRank = Types.getArmorRank(Types.Entities.CLOTHARMOR);
    expect(getSellPrice(Types.Entities.CLOTHARMOR)).toBe(Math.floor(8 + clothRank * 12));

    const mailRank = Types.getArmorRank(Types.Entities.MAILARMOR);
    expect(getSellPrice(Types.Entities.MAILARMOR)).toBe(Math.floor(8 + mailRank * 12));

    const plateRank = Types.getArmorRank(Types.Entities.PLATEARMOR);
    expect(getSellPrice(Types.Entities.PLATEARMOR)).toBe(Math.floor(8 + plateRank * 12));
  });

  it('should return higher sell price for higher-rank armor', () => {
    const clothPrice = getSellPrice(Types.Entities.CLOTHARMOR);
    const leatherPrice = getSellPrice(Types.Entities.LEATHERARMOR);
    const mailPrice = getSellPrice(Types.Entities.MAILARMOR);
    expect(leatherPrice).toBeGreaterThan(clothPrice);
    expect(mailPrice).toBeGreaterThan(leatherPrice);
  });

  it('should return 0 for consumables (cannot be sold)', () => {
    expect(getSellPrice(Types.Entities.FLASK)).toBe(0);
    expect(getSellPrice(Types.Entities.BURGER)).toBe(0);
    expect(getSellPrice(Types.Entities.CAKE)).toBe(0);
    expect(getSellPrice(Types.Entities.FIREPOTION)).toBe(0);
  });

  it('should return 0 for unknown/invalid kinds', () => {
    // An NPC kind is neither weapon nor armor
    expect(getSellPrice(Types.Entities.KING)).toBe(0);
    expect(getSellPrice(99999)).toBe(0);
  });
});

// ============================================================================
// ShopService class
// ============================================================================

describe('ShopService', () => {
  let service: ShopService;

  beforeEach(() => {
    service = new ShopService();
  });

  // --------------------------------------------------------------------------
  // getStock()
  // --------------------------------------------------------------------------

  describe('getStock', () => {
    it('should return -1 for unlimited-stock items', () => {
      expect(service.getStock(Types.Entities.VILLAGEGIRL, Types.Entities.FLASK)).toBe(-1);
      expect(service.getStock(Types.Entities.GUARD, Types.Entities.SWORD1)).toBe(-1);
      expect(service.getStock(Types.Entities.VILLAGER, Types.Entities.CLOTHARMOR)).toBe(-1);
    });

    it('should return the initial stock for limited items', () => {
      expect(service.getStock(Types.Entities.VILLAGEGIRL, Types.Entities.FIREPOTION)).toBe(3);
      expect(service.getStock(Types.Entities.GUARD, Types.Entities.MORNINGSTAR)).toBe(2);
      expect(service.getStock(Types.Entities.VILLAGER, Types.Entities.PLATEARMOR)).toBe(2);
      expect(service.getStock(Types.Entities.SCIENTIST, Types.Entities.BLUESWORD)).toBe(1);
      expect(service.getStock(Types.Entities.SCIENTIST, Types.Entities.REDARMOR)).toBe(1);
    });

    it('should return 0 for a non-merchant NPC', () => {
      expect(service.getStock(Types.Entities.KING, Types.Entities.SWORD1)).toBe(0);
    });

    it('should return 0 for an item not in the shop', () => {
      expect(service.getStock(Types.Entities.GUARD, Types.Entities.FLASK)).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // decreaseStock()
  // --------------------------------------------------------------------------

  describe('decreaseStock', () => {
    it('should reduce stock by one for limited items', () => {
      const npc = Types.Entities.GUARD;
      const item = Types.Entities.MORNINGSTAR;

      expect(service.getStock(npc, item)).toBe(2);
      service.decreaseStock(npc, item);
      expect(service.getStock(npc, item)).toBe(1);
      service.decreaseStock(npc, item);
      expect(service.getStock(npc, item)).toBe(0);
    });

    it('should not go below zero', () => {
      const npc = Types.Entities.SCIENTIST;
      const item = Types.Entities.BLUESWORD; // stock=1

      service.decreaseStock(npc, item);
      expect(service.getStock(npc, item)).toBe(0);
      service.decreaseStock(npc, item); // try again at 0
      expect(service.getStock(npc, item)).toBe(0);
    });

    it('should not affect unlimited stock items', () => {
      const npc = Types.Entities.GUARD;
      const item = Types.Entities.SWORD1; // stock=-1

      service.decreaseStock(npc, item);
      expect(service.getStock(npc, item)).toBe(-1);
    });

    it('should not affect stock of other items in the same shop', () => {
      const npc = Types.Entities.VILLAGEGIRL;
      service.decreaseStock(npc, Types.Entities.FIREPOTION);
      // firepotion goes from 3 to 2, but flask stays unlimited
      expect(service.getStock(npc, Types.Entities.FIREPOTION)).toBe(2);
      expect(service.getStock(npc, Types.Entities.FLASK)).toBe(-1);
    });

    it('should track stock independently per NPC', () => {
      // Both VillageGirl and Scientist sell FIREPOTION
      service.decreaseStock(Types.Entities.VILLAGEGIRL, Types.Entities.FIREPOTION);
      expect(service.getStock(Types.Entities.VILLAGEGIRL, Types.Entities.FIREPOTION)).toBe(2);
      expect(service.getStock(Types.Entities.SCIENTIST, Types.Entities.FIREPOTION)).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // getInventoryWithStock()
  // --------------------------------------------------------------------------

  describe('getInventoryWithStock', () => {
    it('should return null for a non-merchant NPC', () => {
      expect(service.getInventoryWithStock(Types.Entities.KING)).toBeNull();
    });

    it('should return all items with current stock for a merchant', () => {
      const inv = service.getInventoryWithStock(Types.Entities.GUARD)!;
      expect(inv).not.toBeNull();
      expect(inv).toHaveLength(4);

      const sword1 = inv.find(i => i.itemKind === Types.Entities.SWORD1)!;
      expect(sword1.price).toBe(30);
      expect(sword1.stock).toBe(-1);

      const ms = inv.find(i => i.itemKind === Types.Entities.MORNINGSTAR)!;
      expect(ms.price).toBe(300);
      expect(ms.stock).toBe(2);
    });

    it('should reflect decreased stock in the listing', () => {
      service.decreaseStock(Types.Entities.GUARD, Types.Entities.MORNINGSTAR);

      const inv = service.getInventoryWithStock(Types.Entities.GUARD)!;
      const ms = inv.find(i => i.itemKind === Types.Entities.MORNINGSTAR)!;
      expect(ms.stock).toBe(1);
    });

    it('should include all items for VillageGirl shop', () => {
      const inv = service.getInventoryWithStock(Types.Entities.VILLAGEGIRL)!;
      expect(inv).toHaveLength(4);
      const kinds = inv.map(i => i.itemKind);
      expect(kinds).toContain(Types.Entities.FLASK);
      expect(kinds).toContain(Types.Entities.BURGER);
      expect(kinds).toContain(Types.Entities.CAKE);
      expect(kinds).toContain(Types.Entities.FIREPOTION);
    });

    it('should include price for every item in the inventory', () => {
      const inv = service.getInventoryWithStock(Types.Entities.VILLAGER)!;
      for (const entry of inv) {
        expect(entry.price).toBeGreaterThan(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // processPurchase()
  // --------------------------------------------------------------------------

  describe('processPurchase', () => {
    it('should succeed when player has enough gold and item is in stock', () => {
      const result = service.processPurchase(
        Types.Entities.GUARD,
        Types.Entities.SWORD1,
        1000
      );
      expect(result.success).toBe(true);
      expect(result.cost).toBe(30);
      expect(result.message).toContain('Purchased');
    });

    it('should return the item display name in the success message', () => {
      const result = service.processPurchase(
        Types.Entities.GUARD,
        Types.Entities.SWORD1,
        1000
      );
      expect(result.message).toContain('Wooden Sword');
    });

    it('should fail when NPC is not a merchant', () => {
      const result = service.processPurchase(
        Types.Entities.KING,
        Types.Entities.SWORD1,
        1000
      );
      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.message).toMatch(/doesn't sell/i);
    });

    it('should fail when item is not in the shop', () => {
      const result = service.processPurchase(
        Types.Entities.GUARD,
        Types.Entities.FLASK, // Guard doesn't sell flasks
        1000
      );
      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.message).toMatch(/not available/i);
    });

    it('should fail when player has insufficient gold', () => {
      const result = service.processPurchase(
        Types.Entities.GUARD,
        Types.Entities.AXE, // costs 150
        100
      );
      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.message).toMatch(/not enough gold/i);
    });

    it('should include required gold amount in insufficient-gold message', () => {
      const result = service.processPurchase(
        Types.Entities.GUARD,
        Types.Entities.AXE, // costs 150
        50
      );
      expect(result.message).toContain('150');
    });

    it('should fail when item is out of stock', () => {
      const npc = Types.Entities.SCIENTIST;
      const item = Types.Entities.BLUESWORD; // stock=1

      // Buy the only one
      service.processPurchase(npc, item, 10000);
      // Try again
      const result = service.processPurchase(npc, item, 10000);
      expect(result.success).toBe(false);
      expect(result.cost).toBe(0);
      expect(result.message).toMatch(/out of stock/i);
    });

    it('should decrease stock on successful purchase of limited item', () => {
      const npc = Types.Entities.GUARD;
      const item = Types.Entities.MORNINGSTAR; // stock=2

      expect(service.getStock(npc, item)).toBe(2);
      service.processPurchase(npc, item, 10000);
      expect(service.getStock(npc, item)).toBe(1);
    });

    it('should not decrease stock for unlimited items', () => {
      const npc = Types.Entities.GUARD;
      const item = Types.Entities.SWORD1; // stock=-1

      service.processPurchase(npc, item, 10000);
      expect(service.getStock(npc, item)).toBe(-1);
    });

    it('should succeed with exact gold match', () => {
      const result = service.processPurchase(
        Types.Entities.VILLAGEGIRL,
        Types.Entities.FLASK, // costs 25
        25
      );
      expect(result.success).toBe(true);
      expect(result.cost).toBe(25);
    });

    it('should fail when gold is one less than price', () => {
      const result = service.processPurchase(
        Types.Entities.VILLAGEGIRL,
        Types.Entities.FLASK, // costs 25
        24
      );
      expect(result.success).toBe(false);
    });

    it('should allow multiple purchases of unlimited items', () => {
      const npc = Types.Entities.VILLAGEGIRL;
      const item = Types.Entities.FLASK;

      for (let i = 0; i < 10; i++) {
        const result = service.processPurchase(npc, item, 1000);
        expect(result.success).toBe(true);
      }
    });

    it('should deplete limited stock across multiple purchases', () => {
      const npc = Types.Entities.VILLAGER;
      const item = Types.Entities.PLATEARMOR; // stock=2, price=250

      const r1 = service.processPurchase(npc, item, 10000);
      expect(r1.success).toBe(true);
      expect(service.getStock(npc, item)).toBe(1);

      const r2 = service.processPurchase(npc, item, 10000);
      expect(r2.success).toBe(true);
      expect(service.getStock(npc, item)).toBe(0);

      const r3 = service.processPurchase(npc, item, 10000);
      expect(r3.success).toBe(false);
      expect(r3.message).toMatch(/out of stock/i);
    });
  });

  // --------------------------------------------------------------------------
  // Stock isolation between ShopService instances
  // --------------------------------------------------------------------------

  describe('instance isolation', () => {
    it('should track stock independently per instance', () => {
      const service2 = new ShopService();

      service.decreaseStock(Types.Entities.SCIENTIST, Types.Entities.BLUESWORD);
      expect(service.getStock(Types.Entities.SCIENTIST, Types.Entities.BLUESWORD)).toBe(0);
      expect(service2.getStock(Types.Entities.SCIENTIST, Types.Entities.BLUESWORD)).toBe(1);
    });
  });
});

// ============================================================================
// shopService singleton
// ============================================================================

describe('shopService singleton', () => {
  it('should be an instance of ShopService', () => {
    expect(shopService).toBeInstanceOf(ShopService);
  });

  it('should have working getStock method', () => {
    expect(typeof shopService.getStock).toBe('function');
    // Unlimited item should be -1
    const stock = shopService.getStock(Types.Entities.GUARD, Types.Entities.SWORD1);
    expect(stock).toBe(-1);
  });

  it('should have working getInventoryWithStock method', () => {
    const inv = shopService.getInventoryWithStock(Types.Entities.GUARD);
    expect(inv).not.toBeNull();
  });
});
