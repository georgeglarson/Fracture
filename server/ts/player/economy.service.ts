/**
 * Economy Service - Single Responsibility: Shop transactions and consumable handling
 *
 * Handles all shop-related logic including:
 * - Purchase validation and processing
 * - Sell transactions
 * - Consumable heal amounts
 */

import {Types} from '../../../shared/ts/gametypes';
import {shopService, getSellPrice} from '../shop/shop.service';

/**
 * Result of a shop purchase attempt
 */
export interface PurchaseResult {
  success: boolean;
  cost: number;
  newGold: number;
  message: string;
  itemKind: number;
  isWeapon: boolean;
  isArmor: boolean;
  isConsumable: boolean;
  healAmount: number;
}

/**
 * Result of a shop sell attempt
 */
export interface SellResult {
  success: boolean;
  sellPrice: number;
  newGold: number;
  message: string;
}

/**
 * EconomyService - Handles shop transactions and consumable effects
 */
export class EconomyService {
  // Heal amounts for consumable items (based on ConsumableStats in item-tables.ts)
  private static readonly CONSUMABLE_HEAL: Record<number, number> = {
    [Types.Entities.FLASK]: 40,
    [Types.Entities.BURGER]: 100,
    [Types.Entities.CAKE]: 60,
    [Types.Entities.FIREPOTION]: 0 // Fire potion is special effect, not heal
  };

  /**
   * Process a shop purchase
   *
   * @param npcKind - The NPC shop kind
   * @param itemKind - The item to purchase
   * @param currentGold - Player's current gold
   * @returns Purchase result with all transaction details
   */
  processPurchase(npcKind: number, itemKind: number, currentGold: number): PurchaseResult {
    const shopResult = shopService.processPurchase(npcKind, itemKind, currentGold);

    const isWeapon = Types.isWeapon(itemKind);
    const isArmor = Types.isArmor(itemKind);
    const isConsumable = Types.isHealingItem(itemKind);
    const healAmount = isConsumable ? this.getConsumableHealAmount(itemKind) : 0;

    if (shopResult.success) {
      return {
        success: true,
        cost: shopResult.cost,
        newGold: currentGold - shopResult.cost,
        message: shopResult.message,
        itemKind,
        isWeapon,
        isArmor,
        isConsumable,
        healAmount
      };
    }

    return {
      success: false,
      cost: 0,
      newGold: currentGold,
      message: shopResult.message,
      itemKind,
      isWeapon,
      isArmor,
      isConsumable,
      healAmount: 0
    };
  }

  /**
   * Calculate sell price for an item
   *
   * @param itemKind - The item kind to sell
   * @returns Sell result with price info
   */
  getSellInfo(itemKind: number): { canSell: boolean; price: number } {
    const sellPrice = getSellPrice(itemKind);
    return {
      canSell: sellPrice > 0,
      price: sellPrice
    };
  }

  /**
   * Process selling an item
   *
   * @param itemKind - The item kind to sell
   * @param currentGold - Player's current gold
   * @returns Sell result
   */
  processSell(itemKind: number, currentGold: number): SellResult {
    const sellPrice = getSellPrice(itemKind);

    if (sellPrice <= 0) {
      return {
        success: false,
        sellPrice: 0,
        newGold: currentGold,
        message: 'This item cannot be sold'
      };
    }

    return {
      success: true,
      sellPrice,
      newGold: currentGold + sellPrice,
      message: `Sold for ${sellPrice} gold`
    };
  }

  /**
   * Get heal amount for consumable items
   *
   * @param itemKind - The consumable item kind
   * @returns Heal amount (0 for non-healing items)
   */
  getConsumableHealAmount(itemKind: number): number {
    return EconomyService.CONSUMABLE_HEAL[itemKind] || 0;
  }

  /**
   * Check if an item is a fire potion (special effect)
   */
  isFirePotion(itemKind: number): boolean {
    return itemKind === Types.Entities.FIREPOTION;
  }
}

// Singleton instance
let economyService: EconomyService | null = null;

/**
 * Get the singleton EconomyService instance
 */
export function getEconomyService(): EconomyService {
  if (!economyService) {
    economyService = new EconomyService();
  }
  return economyService;
}
