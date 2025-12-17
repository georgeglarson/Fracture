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
  console.log(`[Shop] ${ctx.name} attempting to buy item ${itemKind} from NPC ${npcKind}`);

  const economyService = getEconomyService();
  const result = economyService.processPurchase(npcKind, itemKind, ctx.gold);

  if (result.success) {
    // Deduct gold
    ctx.setGold(result.newGold);
    console.log(`[Shop] ${ctx.name} purchased item ${itemKind} for ${result.cost}g (new balance: ${ctx.gold}g)`);

    // Give item to player (equip it)
    if (result.isWeapon) {
      ctx.equipWeapon(itemKind);
      ctx.broadcast(new Messages.EquipItem(ctx as any, itemKind).serialize());
    } else if (result.isArmor) {
      ctx.equipArmor(itemKind);
      ctx.broadcast(new Messages.EquipItem(ctx as any, itemKind).serialize());
    } else if (result.isConsumable && result.healAmount > 0) {
      // Consumables heal immediately
      if (ctx.hitPoints < ctx.maxHitPoints) {
        ctx.regenHealthBy(result.healAmount);
        ctx.broadcast(new Messages.Health(ctx.hitPoints).serialize(), false);
      }
    }

    // Send success response with new gold total
    ctx.send(new Messages.ShopBuyResult(true, itemKind, ctx.gold, result.message).serialize());

    // Also send gold update
    ctx.send(new Messages.GoldGain(0, ctx.gold).serialize());

    // Check purchase achievements
    ctx.checkPurchaseAchievements(result.cost);
  } else {
    // Send failure response
    console.log(`[Shop] ${ctx.name} failed to buy: ${result.message}`);
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
    console.log(`[Shop] ${ctx.name} tried to sell empty slot ${slotIndex}`);
    ctx.send(new Messages.ShopSellResult(false, 0, ctx.gold, 'Nothing to sell').serialize());
    return;
  }

  const itemKind = slot.kind;
  const economyService = getEconomyService();
  const result = economyService.processSell(itemKind, ctx.gold);

  if (!result.success) {
    console.log(`[Shop] ${ctx.name} tried to sell unsellable item ${itemKind}`);
    ctx.send(new Messages.ShopSellResult(false, 0, ctx.gold, result.message).serialize());
    return;
  }

  // Remove one item from the slot (for stackables) or the whole slot
  inventory.removeItem(slotIndex, 1);

  // Grant gold
  ctx.setGold(result.newGold);
  console.log(`[Shop] ${ctx.name} sold item ${itemKind} for ${result.sellPrice}g (new balance: ${ctx.gold}g)`);

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
