/**
 * InventoryHandler - Handles client-side inventory operations
 *
 * Single Responsibility: Inventory init, updates, slots, pickups
 * Extracted from Game.ts to reduce its size.
 */

import { InventoryManager } from '../inventory/inventory-manager';
import { InventoryUI, EquippedItems } from '../ui/inventory-ui';
import { SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types';
import { Types } from '../../../shared/ts/gametypes';

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
      const itemName = manager.getItemName(slotIndex);
      ctx.client?.sendInventoryUse(slotIndex);
      ctx.showNotification(`Used ${itemName}`);
    },
    onEquip: (slotIndex: number) => {
      console.log('[Inventory] Equip slot', slotIndex);
      const itemName = manager.getItemName(slotIndex);
      ctx.client?.sendInventoryEquip(slotIndex);
      ctx.showNotification(`Equipped ${itemName}`);
    },
    onDrop: (slotIndex: number) => {
      console.log('[Inventory] Drop slot', slotIndex);
      const itemName = manager.getItemName(slotIndex);
      ctx.client?.sendInventoryDrop(slotIndex);
      ctx.showNotification(`Dropped ${itemName}`);
    },
    onSell: (slotIndex: number) => {
      console.log('[Inventory] Sell slot', slotIndex);
      const itemName = manager.getItemName(slotIndex);
      ctx.client?.sendShopSell(slotIndex);
      ctx.showNotification(`Sold ${itemName}`);
    },
    onUnequip: (slot: 'weapon' | 'armor') => {
      console.log('[Inventory] Drop equipped', slot);
      ctx.client?.sendDropItem(slot);
      ctx.showNotification(`Dropped ${slot}`);
    },
    onUnequipToInventory: (slot: 'weapon' | 'armor') => {
      console.log('[Inventory] Unequip to inventory', slot);
      ctx.client?.sendUnequipToInventory(slot);
      ctx.showNotification(`Unequipped ${slot}`);
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
  if (!slot) {
    ctx.showNotification(`Slot ${slotIndex + 1} is empty`);
    return;
  }

  // Only use consumables via hotkey
  if (ctx.inventoryManager.isSlotConsumable(slotIndex)) {
    const itemName = ctx.inventoryManager.getItemName(slotIndex);
    ctx.client?.sendInventoryUse(slotIndex);
    ctx.showNotification(`Used ${itemName}`);
  } else {
    ctx.showNotification('Not a consumable item');
  }
}

/**
 * Use the first consumable item in inventory (for Q hotkey)
 */
export function useFirstConsumable(ctx: InventoryGameContext): void {
  if (!ctx.inventoryManager) return;

  const slotIndex = ctx.inventoryManager.findFirstConsumable();
  if (slotIndex >= 0) {
    const itemName = ctx.inventoryManager.getItemName(slotIndex);
    ctx.client?.sendInventoryUse(slotIndex);
    ctx.showNotification(`Used ${itemName}`);
  } else {
    ctx.showNotification('No consumables in inventory');
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
    const itemName = ctx.inventoryManager.getItemName(slotIndex);
    // Note: For equipment swaps, the equip callback already showed "Equipped [new item]"
    // so this will show for the old item going back to inventory - that's fine, it's useful feedback
    ctx.showNotification(`${itemName} → Backpack${count > 1 ? ' x' + count : ''}`);
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

/**
 * Update the equipped items display in the inventory UI
 */
export function updateEquippedDisplay(ctx: InventoryGameContext, weaponKind: number | null, armorKind: number | null): void {
  if (ctx.inventoryUI) {
    ctx.inventoryUI.updateEquipped(weaponKind, armorKind);
  }
}
