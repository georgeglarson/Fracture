/**
 * InventoryController - Orchestrates inventory operations
 *
 * Responsibility: Bridge between UI events and network/storage
 * - Listens for UI events (user actions)
 * - Calls network adapter methods
 * - Emits state change events for UI to consume
 */

import { EventBus, getClientEventBus, Subscription } from '../../../shared/ts/events/event-bus';
import { InventoryManager } from '../inventory/inventory-manager';
import { InventoryUI } from '../ui/inventory-ui';
import { SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types';

/**
 * Network adapter interface - abstracts GameClient
 */
export interface InventoryNetworkAdapter {
  sendInventoryUse(slotIndex: number): void;
  sendInventoryEquip(slotIndex: number): void;
  sendInventoryDrop(slotIndex: number): void;
  sendShopSell(slotIndex: number): void;
  sendDropItem(slot: 'weapon' | 'armor'): void;
  sendUnequipToInventory(slot: 'weapon' | 'armor'): void;
  sendInventoryPickup(itemId: number): void;
}

/**
 * Dependencies for the controller
 */
export interface InventoryControllerDeps {
  eventBus: EventBus;
  networkAdapter: InventoryNetworkAdapter;
  inventoryManager: InventoryManager;
  inventoryUI: InventoryUI;
  storage: { saveInventory: (slots: any[]) => void } | null;
  isShopOpen: () => boolean;
}

/**
 * InventoryController - handles the flow between UI and network
 */
export class InventoryController {
  private eventBus: EventBus;
  private network: InventoryNetworkAdapter;
  private manager: InventoryManager;
  private ui: InventoryUI;
  private storage: { saveInventory: (slots: any[]) => void } | null;
  private isShopOpen: () => boolean;
  private subscriptions: Subscription[] = [];
  // Pending equip properties - captured before sending to server
  private pendingWeaponProps: any = null;
  private pendingArmorProps: any = null;

  constructor(deps: InventoryControllerDeps) {
    this.eventBus = deps.eventBus;
    this.network = deps.networkAdapter;
    this.manager = deps.inventoryManager;
    this.ui = deps.inventoryUI;
    this.storage = deps.storage;
    this.isShopOpen = deps.isShopOpen;

    this.bindUIEvents();
    this.bindStateEvents();
    this.bindManagerEvents();
  }

  /**
   * Bind UI action events -> network calls
   */
  private bindUIEvents(): void {
    // Use item
    this.subscriptions.push(
      this.eventBus.on('ui:inventory:use', ({ slotIndex }) => {
        console.log('[InventoryController] Use slot', slotIndex);
        const itemName = this.manager.getItemName(slotIndex);
        this.network.sendInventoryUse(slotIndex);
        this.eventBus.emit('ui:notification', { message: `Used ${itemName}` });
      })
    );

    // Equip item - capture properties BEFORE sending to server
    this.subscriptions.push(
      this.eventBus.on('ui:inventory:equip', ({ slotIndex }) => {
        console.log('[InventoryController] Equip slot', slotIndex);
        const slot = this.manager.getSlot(slotIndex);
        const itemName = this.manager.getItemName(slotIndex);

        // Capture properties before they're removed from inventory
        if (slot) {
          if (this.manager.isSlotWeapon(slotIndex)) {
            this.pendingWeaponProps = slot.properties;
          } else if (this.manager.isSlotArmor(slotIndex)) {
            this.pendingArmorProps = slot.properties;
          }
        }

        this.network.sendInventoryEquip(slotIndex);
        this.eventBus.emit('ui:notification', { message: `Equipped ${itemName}` });
      })
    );

    // Drop item
    this.subscriptions.push(
      this.eventBus.on('ui:inventory:drop', ({ slotIndex }) => {
        console.log('[InventoryController] Drop slot', slotIndex);
        const itemName = this.manager.getItemName(slotIndex);
        this.network.sendInventoryDrop(slotIndex);
        this.eventBus.emit('ui:notification', { message: `Dropped ${itemName}` });
      })
    );

    // Sell item (shop)
    this.subscriptions.push(
      this.eventBus.on('ui:inventory:sell', ({ slotIndex }) => {
        console.log('[InventoryController] Sell slot', slotIndex);
        const itemName = this.manager.getItemName(slotIndex);
        this.network.sendShopSell(slotIndex);
        this.eventBus.emit('ui:notification', { message: `Sold ${itemName}` });
      })
    );

    // Unequip item
    this.subscriptions.push(
      this.eventBus.on('ui:inventory:unequip', ({ slot, toInventory }) => {
        console.log('[InventoryController] Unequip', slot, 'toInventory:', toInventory);
        if (toInventory) {
          this.network.sendUnequipToInventory(slot);
          this.eventBus.emit('ui:notification', { message: `Unequipped ${slot}` });
        } else {
          this.network.sendDropItem(slot);
          this.eventBus.emit('ui:notification', { message: `Dropped ${slot}` });
        }
      })
    );

    // Toggle visibility
    this.subscriptions.push(
      this.eventBus.on('ui:inventory:toggle', ({ visible }) => {
        if (visible) {
          this.ui.show();
        } else {
          this.ui.hide();
        }
      })
    );
  }

  /**
   * Bind state events -> UI updates
   */
  private bindStateEvents(): void {
    // Inventory state changed -> update UI
    this.subscriptions.push(
      this.eventBus.on('state:inventory', ({ slots }) => {
        this.ui.updateSlots(slots);
      })
    );

    // Equipment state changed -> update UI
    this.subscriptions.push(
      this.eventBus.on('state:equipment', ({ weapon, armor }) => {
        this.ui.updateEquipped(weapon, armor);
      })
    );
  }

  /**
   * Bind inventory manager changes -> state events + storage
   */
  private bindManagerEvents(): void {
    this.manager.onChange((slots) => {
      // Emit state change for any listeners (including UI)
      this.eventBus.emit('state:inventory', { slots });

      // Persist to storage
      if (this.storage) {
        this.storage.saveInventory(slots);
      }
    });
  }

  /**
   * Handle inventory init from server
   */
  handleInventoryInit(serializedSlots: (SerializedInventorySlot | null)[]): void {
    this.manager.loadFromServer(serializedSlots);
    console.info('[InventoryController] Loaded', this.manager.getFilledSlotCount(), 'items');
  }

  /**
   * Handle inventory add from server
   */
  handleInventoryAdd(
    slotIndex: number,
    kind: number,
    properties: Record<string, unknown> | null,
    count: number
  ): void {
    this.manager.updateSlot(slotIndex, kind, properties, count);
    const itemName = this.manager.getItemName(slotIndex);
    this.eventBus.emit('ui:notification', {
      message: `${itemName} → Backpack${count > 1 ? ' x' + count : ''}`
    });
  }

  /**
   * Handle inventory remove from server
   */
  handleInventoryRemove(slotIndex: number): void {
    this.manager.removeSlot(slotIndex);
  }

  /**
   * Handle inventory count update from server
   */
  handleInventoryUpdate(slotIndex: number, count: number): void {
    this.manager.updateCount(slotIndex, count);
  }

  /**
   * Update equipped display with properties for accurate comparison
   */
  updateEquippedDisplay(weaponKind: number | null, armorKind: number | null): void {
    // Include pending properties captured during equip
    this.eventBus.emit('state:equipment', {
      weapon: weaponKind,
      armor: armorKind,
      weaponProps: this.pendingWeaponProps,
      armorProps: this.pendingArmorProps
    });

    // Clear pending props after applying
    this.pendingWeaponProps = null;
    this.pendingArmorProps = null;
  }

  /**
   * Use inventory slot (for hotkeys)
   */
  useSlot(slotIndex: number): void {
    const slot = this.manager.getSlot(slotIndex);
    if (!slot) {
      this.eventBus.emit('ui:notification', { message: `Slot ${slotIndex + 1} is empty` });
      return;
    }

    if (this.manager.isSlotConsumable(slotIndex)) {
      this.eventBus.emit('ui:inventory:use', { slotIndex });
    } else {
      this.eventBus.emit('ui:notification', { message: 'Not a consumable item' });
    }
  }

  /**
   * Use first consumable (Q hotkey)
   */
  useFirstConsumable(): void {
    const slotIndex = this.manager.findFirstConsumable();
    if (slotIndex >= 0) {
      this.eventBus.emit('ui:inventory:use', { slotIndex });
    } else {
      this.eventBus.emit('ui:notification', { message: 'No consumables in inventory' });
    }
  }

  /**
   * Toggle inventory visibility
   */
  toggle(): void {
    const newVisible = !this.ui.isVisible();
    this.eventBus.emit('ui:inventory:toggle', { visible: newVisible });
  }

  /**
   * Pickup item to inventory
   */
  pickupItem(itemId: number): void {
    console.log('[InventoryController] Requesting pickup of item', itemId);
    this.network.sendInventoryPickup(itemId);
  }

  /**
   * Check if shop is open (for context menu)
   */
  getIsShopOpen(): boolean {
    return this.isShopOpen();
  }

  /**
   * Get inventory manager (for backward compatibility)
   */
  getManager(): InventoryManager {
    return this.manager;
  }

  /**
   * Get inventory UI (for backward compatibility)
   */
  getUI(): InventoryUI {
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
export function createInventoryController(deps: Omit<InventoryControllerDeps, 'eventBus'>): InventoryController {
  return new InventoryController({
    ...deps,
    eventBus: getClientEventBus()
  });
}
