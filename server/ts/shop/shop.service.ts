/**
 * Shop Service - Handles NPC merchant shops
 */

import { Types } from '../../../shared/ts/gametypes.js';
import { getDisplayName } from '../items/item-tables.js';

export interface ShopItem {
  itemKind: number;
  price: number;
  stock: number; // -1 for unlimited
}

export interface ShopDefinition {
  name: string;
  items: ShopItem[];
}

/**
 * Shop inventories by NPC kind
 * Only NPCs listed here are merchants
 */
export const SHOP_INVENTORIES: Record<number, ShopDefinition> = {
  // Village Girl - Potions and consumables
  [Types.Entities.VILLAGEGIRL]: {
    name: "Elara's Potions",
    items: [
      { itemKind: Types.Entities.FLASK, price: 25, stock: -1 },
      { itemKind: Types.Entities.BURGER, price: 60, stock: -1 },
      { itemKind: Types.Entities.CAKE, price: 40, stock: -1 },
      { itemKind: Types.Entities.FIREPOTION, price: 150, stock: 3 }
    ]
  },

  // Guard - Weapons
  [Types.Entities.GUARD]: {
    name: "Guard Armory",
    items: [
      { itemKind: Types.Entities.SWORD1, price: 30, stock: -1 },
      { itemKind: Types.Entities.SWORD2, price: 80, stock: -1 },
      { itemKind: Types.Entities.AXE, price: 150, stock: -1 },
      { itemKind: Types.Entities.MORNINGSTAR, price: 300, stock: 2 }
    ]
  },

  // Villager - Armor
  [Types.Entities.VILLAGER]: {
    name: "Town Outfitters",
    items: [
      { itemKind: Types.Entities.CLOTHARMOR, price: 20, stock: -1 },
      { itemKind: Types.Entities.LEATHERARMOR, price: 60, stock: -1 },
      { itemKind: Types.Entities.MAILARMOR, price: 120, stock: -1 },
      { itemKind: Types.Entities.PLATEARMOR, price: 250, stock: 2 }
    ]
  },

  // Scientist - High-tier items
  [Types.Entities.SCIENTIST]: {
    name: "Alchemist's Wares",
    items: [
      { itemKind: Types.Entities.FIREPOTION, price: 120, stock: 5 },
      { itemKind: Types.Entities.BLUESWORD, price: 500, stock: 1 },
      { itemKind: Types.Entities.REDARMOR, price: 400, stock: 1 }
    ]
  }
};

/**
 * Check if an NPC is a merchant
 */
export function isMerchant(npcKind: number): boolean {
  return SHOP_INVENTORIES[npcKind] !== undefined;
}

/**
 * Get shop inventory for an NPC
 */
export function getShopInventory(npcKind: number): ShopDefinition | null {
  return SHOP_INVENTORIES[npcKind] || null;
}

/**
 * Get price for an item in a shop
 */
export function getItemPrice(npcKind: number, itemKind: number): number | null {
  const shop = SHOP_INVENTORIES[npcKind];
  if (!shop) return null;

  const item = shop.items.find(i => i.itemKind === itemKind);
  return item ? item.price : null;
}

/**
 * Calculate sell price (typically 25% of buy price, based on item tier)
 */
export function getSellPrice(itemKind: number): number {
  // Base sell prices by item tier
  if (Types.isWeapon(itemKind)) {
    const rank = Types.getWeaponRank(itemKind);
    return Math.floor(10 + rank * 15);
  }
  if (Types.isArmor(itemKind)) {
    const rank = Types.getArmorRank(itemKind);
    return Math.floor(8 + rank * 12);
  }
  // Consumables can't be sold
  return 0;
}

export class ShopService {
  // Track limited stock per world instance
  private stockTracking: Map<string, number> = new Map();

  /**
   * Get stock key for tracking
   */
  private getStockKey(npcKind: number, itemKind: number): string {
    return `${npcKind}:${itemKind}`;
  }

  /**
   * Get current stock for an item
   */
  getStock(npcKind: number, itemKind: number): number {
    const shop = SHOP_INVENTORIES[npcKind];
    if (!shop) return 0;

    const item = shop.items.find(i => i.itemKind === itemKind);
    if (!item) return 0;

    if (item.stock === -1) return -1; // Unlimited

    const key = this.getStockKey(npcKind, itemKind);
    if (this.stockTracking.has(key)) {
      return this.stockTracking.get(key)!;
    }
    return item.stock;
  }

  /**
   * Decrease stock after purchase
   */
  decreaseStock(npcKind: number, itemKind: number): void {
    const currentStock = this.getStock(npcKind, itemKind);
    if (currentStock === -1) return; // Unlimited
    if (currentStock <= 0) return;

    const key = this.getStockKey(npcKind, itemKind);
    this.stockTracking.set(key, currentStock - 1);
  }

  /**
   * Get shop inventory with current stock levels
   */
  getInventoryWithStock(npcKind: number): Array<{ itemKind: number; price: number; stock: number }> | null {
    const shop = SHOP_INVENTORIES[npcKind];
    if (!shop) return null;

    return shop.items.map(item => ({
      itemKind: item.itemKind,
      price: item.price,
      stock: this.getStock(npcKind, item.itemKind)
    }));
  }

  /**
   * Process a purchase attempt
   */
  processPurchase(
    npcKind: number,
    itemKind: number,
    playerGold: number
  ): { success: boolean; message: string; cost: number } {
    const shop = SHOP_INVENTORIES[npcKind];
    if (!shop) {
      return { success: false, message: "This NPC doesn't sell anything.", cost: 0 };
    }

    const item = shop.items.find(i => i.itemKind === itemKind);
    if (!item) {
      return { success: false, message: "Item not available in this shop.", cost: 0 };
    }

    const stock = this.getStock(npcKind, itemKind);
    if (stock === 0) {
      return { success: false, message: "Out of stock!", cost: 0 };
    }

    if (playerGold < item.price) {
      return { success: false, message: `Not enough gold! Need ${item.price}g.`, cost: 0 };
    }

    // Success!
    this.decreaseStock(npcKind, itemKind);
    const itemName = getDisplayName(itemKind);
    return {
      success: true,
      message: `Purchased ${itemName}!`,
      cost: item.price
    };
  }
}

// Singleton instance
export const shopService = new ShopService();
