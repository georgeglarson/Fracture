/**
 * InventoryHandler - Handles client-side inventory operations
 *
 * Single Responsibility: Inventory init, updates, slots, pickups
 * Extracted from Game.ts to reduce its size.
 *
 * Now uses EventBus-based InventoryController for decoupled architecture.
 */

import { InventoryManager } from '../inventory/inventory-manager';
import { InventoryUI } from '../ui/inventory-ui';
import { InventoryController, createInventoryController } from '../controllers/inventory.controller';
import { createNetworkAdapter } from '../adapters/network.adapter';
import { getClientEventBus } from '../../../shared/ts/events/event-bus';
import { SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types';

/**
 * Game context for inventory operations
 */
export interface InventoryGameContext {
  client: any; // GameClient
  inventoryManager: InventoryManager | null;
  inventoryUI: InventoryUI | null;
  inventoryController: InventoryController | null;
  shopUI: any; // ShopUI
  storage: any; // Storage

  // Methods
  showNotification: (message: string) => void;
}

/**
 * Initialize inventory system with EventBus controller
 */
export function initInventory(ctx: InventoryGameContext): {
  manager: InventoryManager;
  ui: InventoryUI;
  controller: InventoryController;
} {
  const eventBus = getClientEventBus();
  const manager = new InventoryManager();
  const ui = new InventoryUI(eventBus);

  // Create network adapter with lazy client lookup (client is created after inventory init)
  const networkAdapter = createNetworkAdapter(() => ctx.client);

  // Set up isShopOpen callback for UI context menu
  ui.setIsShopOpen(() => ctx.shopUI?.isOpen() ?? false);

  // Create controller - handles all event wiring
  const controller = createInventoryController({
    networkAdapter,
    inventoryManager: manager,
    inventoryUI: ui,
    storage: ctx.storage,
    isShopOpen: () => ctx.shopUI?.isOpen() ?? false
  });

  // Listen for notification events
  eventBus.on('ui:notification', ({ message }) => {
    ctx.showNotification(message);
  });

  console.info('[Inventory] Initialized with EventBus controller');
  return { manager, ui, controller };
}

/**
 * Toggle inventory visibility
 */
export function toggleInventory(ctx: InventoryGameContext): void {
  if (ctx.inventoryController) {
    ctx.inventoryController.toggle();
  } else if (ctx.inventoryUI) {
    // Fallback for backward compatibility
    ctx.inventoryUI.toggle();
  } else {
    console.error('[Inventory] No controller or UI initialized');
  }
}

/**
 * Use an inventory slot by index (for hotkeys 1-5)
 */
export function useInventorySlot(ctx: InventoryGameContext, slotIndex: number): void {
  if (ctx.inventoryController) {
    ctx.inventoryController.useSlot(slotIndex);
  }
}

/**
 * Use the first consumable item in inventory (for Q hotkey)
 */
export function useFirstConsumable(ctx: InventoryGameContext): void {
  if (ctx.inventoryController) {
    ctx.inventoryController.useFirstConsumable();
  }
}

/**
 * Handle inventory init from server
 */
export function handleInventoryInit(ctx: InventoryGameContext, serializedSlots: (SerializedInventorySlot | null)[]): void {
  if (ctx.inventoryController) {
    ctx.inventoryController.handleInventoryInit(serializedSlots);
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
  if (ctx.inventoryController) {
    ctx.inventoryController.handleInventoryAdd(slotIndex, kind, properties, count);
  }
}

/**
 * Handle inventory remove from server
 */
export function handleInventoryRemove(ctx: InventoryGameContext, slotIndex: number): void {
  if (ctx.inventoryController) {
    ctx.inventoryController.handleInventoryRemove(slotIndex);
  }
}

/**
 * Handle inventory count update from server
 */
export function handleInventoryUpdate(ctx: InventoryGameContext, slotIndex: number, count: number): void {
  if (ctx.inventoryController) {
    ctx.inventoryController.handleInventoryUpdate(slotIndex, count);
  }
}

/**
 * Send pickup request to server for inventory-based pickup
 */
export function pickupItemToInventory(ctx: InventoryGameContext, itemId: number): void {
  if (ctx.inventoryController) {
    ctx.inventoryController.pickupItem(itemId);
  }
}

/**
 * Update the equipped items display in the inventory UI
 */
export function updateEquippedDisplay(ctx: InventoryGameContext, weaponKind: number | null, armorKind: number | null): void {
  if (ctx.inventoryController) {
    ctx.inventoryController.updateEquippedDisplay(weaponKind, armorKind);
  }
}
