/**
 * ShopHandler - Handles client-side shop operations
 *
 * Single Responsibility: Shop init, buy/sell results
 * Extracted from Game.ts to reduce its size.
 */

import { ShopUI } from '../ui/shop-ui';
import { AudioManager } from '../audio';
import { GameClient } from '../network/gameclient';

/**
 * Game context for shop operations
 */
export interface ShopGameContext {
  client: GameClient | null;
  shopUI: ShopUI | null;
  audioManager: AudioManager | null;
  playerGold: number;
  storage: any; // Storage class with saveGold method
  playergold_callback: ((gold: number) => void) | null;
}

/**
 * Initialize shop UI with callbacks
 */
export function initShop(ctx: ShopGameContext): ShopUI {
  const shopUI = new ShopUI();
  shopUI.setCallbacks({
    onBuy: (npcKind: number, itemKind: number) => {
      ctx.client?.sendShopBuy(npcKind, itemKind);
    },
    getPlayerGold: () => ctx.playerGold,
    onGoldChange: (newGold: number) => {
      ctx.playerGold = newGold;
      if (ctx.playergold_callback) {
        ctx.playergold_callback(newGold);
      }
    },
    saveGold: (gold: number) => {
      ctx.storage.saveGold(gold);
    },
    playSound: (sound: string) => {
      if (ctx.audioManager) {
        ctx.audioManager.playSound(sound);
      }
    },
    onSell: (slotIndex: number) => {
      ctx.client?.sendShopSell(slotIndex);
    }
  });
  return shopUI;
}

/**
 * Show shop UI
 */
export function showShop(
  ctx: ShopGameContext,
  npcKind: number,
  shopName: string,
  items: Array<{ itemKind: number; price: number; stock: number }>
): void {
  ctx.shopUI?.show(npcKind, shopName, items);
}

/**
 * Hide shop UI
 */
export function hideShop(ctx: ShopGameContext): void {
  ctx.shopUI?.hide();
}

/**
 * Handle buy result from server
 */
export function handleShopBuyResult(
  ctx: ShopGameContext,
  success: boolean,
  itemKind: number,
  newGold: number,
  message: string
): void {
  ctx.shopUI?.handleBuyResult(success, itemKind, newGold, message);
}

/**
 * Handle sell result from server
 */
export function handleShopSellResult(
  ctx: ShopGameContext,
  success: boolean,
  goldGained: number,
  newGold: number,
  message: string
): void {
  ctx.shopUI?.handleSellResult(success, goldGained, newGold, message);
}
