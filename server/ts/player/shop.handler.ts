/**
 * ShopHandler - Handles all shop transactions for players
 *
 * Single Responsibility: Shop buy/sell operations
 * Extracted from Player.ts to reduce its size.
 */

import { Types } from '../../../shared/ts/gametypes';
import { Messages } from '../message';
import { getEconomyService } from './economy.service';
import { Inventory } from '../inventory/inventory';
import { serializeProperties } from '../../../shared/ts/items/item-types';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Shop');

/**
 * Player context for shop operations
 */
export interface ShopPlayerContext {
  id: number;
  name: string;
  gold: number;
  hitPoints: number;
  maxHitPoints: number;

  // Methods
  send: (message: any) => void;
  broadcast: (message: any, ignoreSelf?: boolean) => void;
  equipWeapon: (kind: number) => void;
  equipArmor: (kind: number) => void;
  regenHealthBy: (amount: number) => void;
  checkPurchaseAchievements: (amount: number) => void;

  // Gold setter
  setGold: (gold: number) => void;

  // Inventory access
  getInventory: () => Inventory;
}

/**
 * Handle a shop purchase request
 */
export function handleShopBuy(ctx: ShopPlayerContext, npcKind: number, itemKind: number): void {
  log.info({ player: ctx.name, itemKind, npcKind }, 'Attempting to buy item');

  const economyService = getEconomyService();
  const result = economyService.processPurchase(npcKind, itemKind, ctx.gold);

  if (result.success) {
    // Equipment goes to inventory instead of auto-equipping
    if (result.isWeapon || result.isArmor) {
      const inventory = ctx.getInventory();

      // Check if inventory has room
      if (!inventory.hasRoom(itemKind)) {
        log.info({ player: ctx.name, itemKind }, 'Inventory is full');
        ctx.send(new Messages.ShopBuyResult(false, itemKind, ctx.gold, 'Inventory is full').serialize());
        return;
      }

      // Add to inventory BEFORE deducting gold to prevent losing gold on failure
      const slotIndex = inventory.addItem(itemKind, null, 1);
      if (slotIndex < 0) {
        log.info({ player: ctx.name, itemKind }, 'Inventory failed to add item (race condition?)');
        ctx.send(new Messages.ShopBuyResult(false, itemKind, ctx.gold, 'Inventory is full').serialize());
        return;
      }

      // Deduct gold only after item is successfully added
      ctx.setGold(result.newGold);
      log.info({ player: ctx.name, itemKind, cost: result.cost, newBalance: ctx.gold }, 'Purchased item');

      // Send inventory add message
      ctx.send([Types.Messages.INVENTORY_ADD, slotIndex, itemKind, null, 1]);
      log.info({ player: ctx.name, itemKind: Types.getKindAsString(itemKind), slotIndex }, 'Added item to inventory');
    } else if (result.isConsumable) {
      // Consumables go to inventory (player can use them when needed)
      const inventory = ctx.getInventory();

      // Check if inventory has room
      if (!inventory.hasRoom(itemKind)) {
        log.info({ player: ctx.name, itemKind }, 'Inventory is full for consumable');
        ctx.send(new Messages.ShopBuyResult(false, itemKind, ctx.gold, 'Inventory is full').serialize());
        return;
      }

      // Add to inventory BEFORE deducting gold to prevent losing gold on failure
      const slotIndex = inventory.addItem(itemKind, null, 1);
      if (slotIndex < 0) {
        log.info({ player: ctx.name, itemKind }, 'Inventory failed to add consumable (race condition?)');
        ctx.send(new Messages.ShopBuyResult(false, itemKind, ctx.gold, 'Inventory is full').serialize());
        return;
      }

      // Deduct gold only after item is successfully added
      ctx.setGold(result.newGold);
      log.info({ player: ctx.name, itemKind, cost: result.cost, newBalance: ctx.gold }, 'Purchased consumable');

      const slot = inventory.getSlot(slotIndex);
      ctx.send([Types.Messages.INVENTORY_ADD, slotIndex, itemKind, null, slot?.count || 1]);
      log.info({ player: ctx.name, itemKind: Types.getKindAsString(itemKind), slotIndex }, 'Added consumable to inventory');
    }

    // Send success response with new gold total
    ctx.send(new Messages.ShopBuyResult(true, itemKind, ctx.gold, result.message).serialize());

    // Also send gold update
    ctx.send(new Messages.GoldGain(0, ctx.gold).serialize());

    // Check purchase achievements
    ctx.checkPurchaseAchievements(result.cost);
  } else {
    // Send failure response
    log.info({ player: ctx.name, itemKind, reason: result.message }, 'Failed to buy item');
    ctx.send(new Messages.ShopBuyResult(false, itemKind, ctx.gold, result.message).serialize());
  }
}

/**
 * Handle selling an item from inventory
 */
export function handleShopSell(ctx: ShopPlayerContext, slotIndex: number): void {
  const inventory = ctx.getInventory();
  const slot = inventory.getSlot(slotIndex);

  if (!slot) {
    log.info({ player: ctx.name, slotIndex }, 'Tried to sell empty slot');
    ctx.send(new Messages.ShopSellResult(false, 0, ctx.gold, 'Nothing to sell').serialize());
    return;
  }

  const itemKind = slot.kind;
  const economyService = getEconomyService();
  const result = economyService.processSell(itemKind, ctx.gold);

  if (!result.success) {
    log.info({ player: ctx.name, itemKind }, 'Tried to sell unsellable item');
    ctx.send(new Messages.ShopSellResult(false, 0, ctx.gold, result.message).serialize());
    return;
  }

  // Remove one item from the slot (for stackables) or the whole slot
  inventory.removeItem(slotIndex, 1);

  // Grant gold
  ctx.setGold(result.newGold);
  log.info({ player: ctx.name, itemKind, sellPrice: result.sellPrice, newBalance: ctx.gold }, 'Sold item');

  // Send updated inventory
  const updatedSlot = inventory.getSlot(slotIndex);
  if (updatedSlot) {
    // Still has items (was stackable)
    ctx.send([Types.Messages.INVENTORY_UPDATE, slotIndex, updatedSlot.count]);
  } else {
    // Slot is now empty
    ctx.send([Types.Messages.INVENTORY_REMOVE, slotIndex]);
  }

  // Send sell result
  ctx.send(new Messages.ShopSellResult(true, result.sellPrice, ctx.gold, result.message).serialize());

  // Also send gold update
  ctx.send(new Messages.GoldGain(result.sellPrice, ctx.gold).serialize());
}
