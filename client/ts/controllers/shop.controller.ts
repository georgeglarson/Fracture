/**
 * ShopController - Orchestrates shop operations
 *
 * Responsibility: Bridge between ShopUI events and network/storage
 * - Listens for UI events (user buy/sell actions)
 * - Calls network adapter methods
 * - Handles server responses
 * - Emits state change events
 */

import { EventBus, getClientEventBus, Subscription } from '../../../shared/ts/events/event-bus';
import { ShopUI, ShopItem } from '../ui/shop-ui';

/**
 * Network adapter interface for shop operations
 */
export interface ShopNetworkAdapter {
  sendShopBuy(npcKind: number, itemKind: number): void;
  sendShopSell(slotIndex: number): void;
}

/**
 * Gold state interface
 */
export interface GoldState {
  gold: number;
}

/**
 * Dependencies for the controller
 */
export interface ShopControllerDeps {
  eventBus: EventBus;
  networkAdapter: ShopNetworkAdapter;
  shopUI: ShopUI;
  getGold: () => number;
  setGold: (gold: number) => void;
  saveGold: (gold: number) => void;
  playSound: (sound: string) => void;
}

/**
 * ShopController - handles the flow between ShopUI and network
 */
export class ShopController {
  private eventBus: EventBus;
  private network: ShopNetworkAdapter;
  private ui: ShopUI;
  private getGold: () => number;
  private setGold: (gold: number) => void;
  private saveGold: (gold: number) => void;
  private playSound: (sound: string) => void;
  private subscriptions: Subscription[] = [];

  constructor(deps: ShopControllerDeps) {
    this.eventBus = deps.eventBus;
    this.network = deps.networkAdapter;
    this.ui = deps.shopUI;
    this.getGold = deps.getGold;
    this.setGold = deps.setGold;
    this.saveGold = deps.saveGold;
    this.playSound = deps.playSound;

    this.bindUIEvents();
    this.bindStateEvents();
  }

  /**
   * Bind UI action events -> network calls
   */
  private bindUIEvents(): void {
    // Buy item
    this.subscriptions.push(
      this.eventBus.on('ui:shop:buy', ({ npcKind, itemKind }) => {
        console.log('[ShopController] Buy item', itemKind, 'from NPC', npcKind);
        this.network.sendShopBuy(npcKind, itemKind);
      })
    );

    // Sell item (via inventory context menu)
    this.subscriptions.push(
      this.eventBus.on('ui:shop:sell', ({ slotIndex }) => {
        console.log('[ShopController] Sell slot', slotIndex);
        this.network.sendShopSell(slotIndex);
      })
    );

    // Shop close
    this.subscriptions.push(
      this.eventBus.on('ui:shop:close', () => {
        this.ui.hide();
      })
    );
  }

  /**
   * Bind state events
   */
  private bindStateEvents(): void {
    // Gold changed -> update display
    this.subscriptions.push(
      this.eventBus.on('state:gold', ({ gold }) => {
        this.setGold(gold);
        this.saveGold(gold);
      })
    );

    // Shop opened -> show UI
    this.subscriptions.push(
      this.eventBus.on('ui:shop:open', ({ npcKind, shopName, items }) => {
        this.ui.show(npcKind, shopName, items);
      })
    );
  }

  /**
   * Open shop (called from network handler)
   */
  openShop(npcKind: number, shopName: string, items: ShopItem[]): void {
    this.eventBus.emit('ui:shop:open', { npcKind, shopName, items });
  }

  /**
   * Handle buy result from server
   */
  handleBuyResult(success: boolean, itemKind: number, newGold: number, message: string): void {
    if (success) {
      this.eventBus.emit('state:gold', { gold: newGold });
      this.playSound('loot');
    }
    this.ui.handleBuyResult(success, itemKind, newGold, message);
    this.eventBus.emit('ui:notification', { message });
  }

  /**
   * Handle sell result from server
   */
  handleSellResult(success: boolean, goldGained: number, newGold: number, message: string): void {
    if (success) {
      this.eventBus.emit('state:gold', { gold: newGold });
      this.playSound('loot');
      console.info('[ShopController] Sold item for', goldGained, 'gold. New total:', newGold);
    }
    this.ui.handleSellResult(success, goldGained, newGold, message);
    this.eventBus.emit('ui:notification', { message });
  }

  /**
   * Check if shop is open
   */
  isOpen(): boolean {
    return this.ui.isOpen();
  }

  /**
   * Close shop
   */
  close(): void {
    this.eventBus.emit('ui:shop:close', {});
  }

  /**
   * Get UI instance (for backward compatibility)
   */
  getUI(): ShopUI {
    return this.ui;
  }

  /**
   * Cleanup subscriptions
   */
  destroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }
}

/**
 * Factory function to create controller with event bus
 */
export function createShopController(deps: Omit<ShopControllerDeps, 'eventBus'>): ShopController {
  return new ShopController({
    ...deps,
    eventBus: getClientEventBus()
  });
}
