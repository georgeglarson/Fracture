/**
 * InventoryHandler - Handles client-side inventory operations
 *
 * Single Responsibility: Inventory init, updates, slots, pickups
 * Extracted from Game.ts to reduce its size.
 */

import { InventoryManager } from '../inventory/inventory-manager';
import { InventoryUI } from '../ui/inventory-ui';
import { SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types';

/**
 * Game context for inventory operations
 */
export interface InventoryGameContext {
  client: any; // GameClient
  inventoryManager: InventoryManager | null;
  inventoryUI: InventoryUI | null;
  shopUI: any; // ShopUI
  storage: any; // Storage

  // Methods
  showNotification: (message: string) => void;
}

/**
 * Initialize inventory system with callbacks
 */
export function initInventory(ctx: InventoryGameContext): { manager: InventoryManager; ui: InventoryUI } {
  const manager = new InventoryManager();
  const ui = new InventoryUI();

  // Set up inventory UI callbacks
  ui.setCallbacks({
    onUse: (slotIndex: number) => {
      console.log('[Inventory] Use slot', slotIndex);
      ctx.client?.sendInventoryUse(slotIndex);
    },
    onEquip: (slotIndex: number) => {
      console.log('[Inventory] Equip slot', slotIndex);
      ctx.client?.sendInventoryEquip(slotIndex);
    },
    onDrop: (slotIndex: number) => {
      console.log('[Inventory] Drop slot', slotIndex);
      ctx.client?.sendInventoryDrop(slotIndex);
    },
    onSell: (slotIndex: number) => {
      console.log('[Inventory] Sell slot', slotIndex);
      ctx.client?.sendShopSell(slotIndex);
    },
    isShopOpen: () => {
      return ctx.shopUI?.isOpen() ?? false;
    }
  });

  // Sync inventory manager changes to UI
  manager.onChange((slots) => {
    ui.updateSlots(slots);
    // Also save to storage
    ctx.storage?.saveInventory(slots);
  });

  console.info('[Inventory] Initialized');
  return { manager, ui };
}

/**
 * Toggle inventory visibility
 */
export function toggleInventory(ctx: InventoryGameContext): void {
  console.log('[Inventory] Toggle called, inventoryUI exists:', !!ctx.inventoryUI);
  if (!ctx.inventoryUI) {
    console.error('[Inventory] inventoryUI is null - initialization needed');
    return;
  }
  ctx.inventoryUI.toggle();
}

/**
 * Use an inventory slot by index (for hotkeys 1-5)
 */
export function useInventorySlot(ctx: InventoryGameContext, slotIndex: number): void {
  if (!ctx.inventoryManager) return;

  const slot = ctx.inventoryManager.getSlot(slotIndex);
  if (!slot) return;

  // Only use consumables via hotkey
  if (ctx.inventoryManager.isSlotConsumable(slotIndex)) {
    ctx.client?.sendInventoryUse(slotIndex);
  }
}

/**
 * Use the first consumable item in inventory (for Q hotkey)
 */
export function useFirstConsumable(ctx: InventoryGameContext): void {
  if (!ctx.inventoryManager) return;

  const slotIndex = ctx.inventoryManager.findFirstConsumable();
  if (slotIndex >= 0) {
    ctx.client?.sendInventoryUse(slotIndex);
  }
}

/**
 * Handle inventory init from server
 */
export function handleInventoryInit(ctx: InventoryGameContext, serializedSlots: (SerializedInventorySlot | null)[]): void {
  if (ctx.inventoryManager) {
    ctx.inventoryManager.loadFromServer(serializedSlots);
    console.info('[Inventory] Loaded', ctx.inventoryManager.getFilledSlotCount(), 'items');
  }
}

/**
 * Handle inventory add from server
 */
export function handleInventoryAdd(
  ctx: InventoryGameContext,
  slotIndex: number,
  kind: number,
  properties: Record<string, unknown> | null,
  count: number
): void {
  if (ctx.inventoryManager) {
    ctx.inventoryManager.updateSlot(slotIndex, kind, properties, count);
    // Show notification
    const itemName = ctx.inventoryManager.getItemName(slotIndex);
    ctx.showNotification(`Picked up ${itemName}${count > 1 ? ' x' + count : ''}`);
  }
}

/**
 * Handle inventory remove from server
 */
export function handleInventoryRemove(ctx: InventoryGameContext, slotIndex: number): void {
  if (ctx.inventoryManager) {
    ctx.inventoryManager.removeSlot(slotIndex);
  }
}

/**
 * Handle inventory count update from server
 */
export function handleInventoryUpdate(ctx: InventoryGameContext, slotIndex: number, count: number): void {
  if (ctx.inventoryManager) {
    ctx.inventoryManager.updateCount(slotIndex, count);
  }
}

/**
 * Send pickup request to server for inventory-based pickup
 */
export function pickupItemToInventory(ctx: InventoryGameContext, itemId: number): void {
  if (ctx.client && itemId) {
    console.log('[Inventory] Requesting pickup of item', itemId);
    ctx.client.sendInventoryPickup(itemId);
  }
}
