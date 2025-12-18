/**
 * ShopHandler - Handles client-side shop operations
 *
 * Single Responsibility: Shop init, buy/sell results
 * Extracted from Game.ts to reduce its size.
 *
 * Now uses EventBus-based ShopController for decoupled architecture.
 */

import { ShopUI } from '../ui/shop-ui';
import { ShopController, createShopController } from '../controllers/shop.controller';
import { createNetworkAdapter } from '../adapters/network.adapter';
import { getClientEventBus } from '../../../shared/ts/events/event-bus';
import { AudioManager } from '../audio';
import { GameClient } from '../network/gameclient';

/**
 * Game context for shop operations
 */
export interface ShopGameContext {
  client: GameClient | null;
  shopUI: ShopUI | null;
  shopController: ShopController | null;
  audioManager: AudioManager | null;
  playerGold: number;
  storage: any; // Storage class with saveGold method
  playergold_callback: ((gold: number) => void) | null;
}

/**
 * Initialize shop with EventBus controller
 */
export function initShop(ctx: ShopGameContext): { ui: ShopUI; controller: ShopController } {
  const eventBus = getClientEventBus();
  const shopUI = new ShopUI(eventBus);

  // Create network adapter
  const networkAdapter = createNetworkAdapter(ctx.client);

  // Set up gold getter for EventBus mode
  shopUI.setGoldGetter(() => ctx.playerGold);

  // Create controller - handles all event wiring
  const controller = createShopController({
    networkAdapter,
    shopUI,
    getGold: () => ctx.playerGold,
    setGold: (gold: number) => {
      ctx.playerGold = gold;
      if (ctx.playergold_callback) {
        ctx.playergold_callback(gold);
      }
    },
    saveGold: (gold: number) => {
      ctx.storage?.saveGold(gold);
    },
    playSound: (sound: string) => {
      if (ctx.audioManager) {
        ctx.audioManager.playSound(sound);
      }
    }
  });

  console.info('[Shop] Initialized with EventBus controller');
  return { ui: shopUI, controller };
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
  if (ctx.shopController) {
    ctx.shopController.openShop(npcKind, shopName, items);
  } else {
    ctx.shopUI?.show(npcKind, shopName, items);
  }
}

/**
 * Hide shop UI
 */
export function hideShop(ctx: ShopGameContext): void {
  if (ctx.shopController) {
    ctx.shopController.close();
  } else {
    ctx.shopUI?.hide();
  }
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
  if (ctx.shopController) {
    ctx.shopController.handleBuyResult(success, itemKind, newGold, message);
  } else {
    ctx.shopUI?.handleBuyResult(success, itemKind, newGold, message);
  }
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
  if (ctx.shopController) {
    ctx.shopController.handleSellResult(success, goldGained, newGold, message);
  } else {
    ctx.shopUI?.handleSellResult(success, goldGained, newGold, message);
  }
}
