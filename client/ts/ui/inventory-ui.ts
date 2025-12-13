/**
 * InventoryUI - 4x5 grid inventory panel
 * Single Responsibility: Display and interact with inventory items
 */

import { InventorySlot, INVENTORY_SIZE, INVENTORY_COLS, INVENTORY_ROWS, isStackable, isEquipment } from '../../../shared/ts/inventory/inventory-types';
import { Rarity, RarityColors, RarityNames, ItemProperties, deserializeProperties } from '../../../shared/ts/items/index';
import { Types } from '../../../shared/ts/gametypes';

export interface InventoryCallbacks {
  onUse: (slotIndex: number) => void;
  onEquip: (slotIndex: number) => void;
  onDrop: (slotIndex: number) => void;
  onSell: (slotIndex: number) => void;
  isShopOpen: () => boolean;
}

export class InventoryUI {
  private visible = false;
  private slots: (InventorySlot | null)[] = [];
  private callbacks: InventoryCallbacks | null = null;
  private panel: HTMLDivElement | null = null;
  private contextMenu: HTMLDivElement | null = null;

  constructor() {
    // Close context menu on click outside
    document.addEventListener('click', () => this.hideContextMenu());
  }

  /**
   * Set callback handlers
   */
  setCallbacks(callbacks: InventoryCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Update slots data
   */
  updateSlots(slots: (InventorySlot | null)[]): void {
    this.slots = slots;
    if (this.visible) {
      this.render();
    }
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    console.log('[InventoryUI] Toggle called, current visible state:', this.visible);
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show the inventory panel
   */
  show(): void {
    this.visible = true;
    this.render();
  }

  /**
   * Hide the inventory panel
   */
  hide(): void {
    this.visible = false;
    this.hideContextMenu();
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  /**
   * Check if visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Render the inventory panel
   */
  private render(): void {
    // Remove existing panel
    if (this.panel) {
      this.panel.remove();
    }

    this.panel = document.createElement('div');
    this.panel.id = 'inventory-panel';
    this.panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: ${INVENTORY_COLS * 64 + 20}px;
      background: linear-gradient(to bottom, rgba(40, 40, 50, 0.95), rgba(30, 30, 40, 0.95));
      border: 2px solid #555;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
      z-index: 8000;
      font-family: Arial, sans-serif;
      color: #fff;
      user-select: none;
    `;

    // Header
    let html = `
      <div style="
        padding: 10px;
        background: rgba(0,0,0,0.3);
        border-bottom: 1px solid #444;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span style="font-weight: bold; font-size: 14px;">Inventory</span>
        <button id="inventory-close" style="
          width: 24px;
          height: 24px;
          background: #7c4a4a;
          color: #fff;
          border: 1px solid #9c6a6a;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
        ">X</button>
      </div>
    `;

    // Grid
    html += `<div style="padding: 10px; display: grid; grid-template-columns: repeat(${INVENTORY_COLS}, 60px); gap: 4px;">`;

    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const slot = this.slots[i];
      const borderColor = slot ? this.getRarityBorderColor(slot) : '#444';
      const bgColor = slot ? 'rgba(60, 60, 70, 0.8)' : 'rgba(40, 40, 50, 0.5)';

      html += `
        <div class="inventory-slot" data-slot="${i}" style="
          width: 60px;
          height: 60px;
          background: ${bgColor};
          border: 2px solid ${borderColor};
          border-radius: 4px;
          cursor: ${slot ? 'pointer' : 'default'};
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
      `;

      if (slot) {
        const spriteName = Types.getKindAsString(slot.kind);
        html += `
          <div style="
            width: 48px;
            height: 48px;
            background-image: url('/img/1/item-${spriteName}.png');
            background-size: 288px 48px;
            background-repeat: no-repeat;
            background-position: 0 0;
          "></div>
        `;

        // Stack count for consumables
        if (isStackable(slot.kind) && slot.count > 1) {
          html += `
            <span style="
              position: absolute;
              bottom: 2px;
              right: 4px;
              font-size: 11px;
              font-weight: bold;
              color: #fff;
              text-shadow: 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000;
            ">${slot.count}</span>
          `;
        }
      }

      html += `</div>`;
    }

    html += `</div>`;

    // Help text
    html += `
      <div style="
        padding: 8px 10px;
        border-top: 1px solid #444;
        font-size: 10px;
        color: #888;
        text-align: center;
      ">
        Left-click: Use/Equip | Right-click: Options | Press 'I' to close
      </div>
    `;

    this.panel.innerHTML = html;
    document.body.appendChild(this.panel);

    // Add event handlers
    this.attachEventHandlers();
  }

  /**
   * Attach event handlers to slots
   */
  private attachEventHandlers(): void {
    if (!this.panel) return;

    // Close button
    const closeBtn = this.panel.querySelector('#inventory-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Slot handlers
    const slotElements = this.panel.querySelectorAll('.inventory-slot');
    slotElements.forEach((el) => {
      const slotIndex = parseInt((el as HTMLElement).dataset.slot || '0');
      const slot = this.slots[slotIndex];

      if (slot) {
        // Left-click: use or equip
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.hideContextMenu();

          if (this.callbacks) {
            if (isStackable(slot.kind)) {
              // Consumable: use it
              this.callbacks.onUse(slotIndex);
            } else if (isEquipment(slot.kind)) {
              // Equipment: equip it
              this.callbacks.onEquip(slotIndex);
            }
          }
        });

        // Right-click: context menu
        (el as HTMLElement).addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu(slotIndex, e.clientX, e.clientY);
        });

        // Hover effects
        el.addEventListener('mouseenter', () => {
          (el as HTMLElement).style.transform = 'scale(1.05)';
          (el as HTMLElement).style.zIndex = '1';
        });
        el.addEventListener('mouseleave', () => {
          (el as HTMLElement).style.transform = 'scale(1)';
          (el as HTMLElement).style.zIndex = '0';
        });
      }
    });
  }

  /**
   * Show context menu for a slot
   */
  private showContextMenu(slotIndex: number, x: number, y: number): void {
    this.hideContextMenu();

    const slot = this.slots[slotIndex];
    if (!slot) return;

    this.contextMenu = document.createElement('div');
    this.contextMenu.id = 'inventory-context-menu';
    this.contextMenu.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      min-width: 120px;
      background: rgba(40, 40, 50, 0.95);
      border: 1px solid #555;
      border-radius: 6px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
      z-index: 10001;
      font-family: Arial, sans-serif;
      font-size: 13px;
      overflow: hidden;
    `;

    const itemName = this.formatItemName(Types.getKindAsString(slot.kind));
    const isConsumable = isStackable(slot.kind);
    const isEquip = isEquipment(slot.kind);

    let html = `
      <div style="
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid #444;
        color: ${this.getRarityColor(slot)};
        font-weight: bold;
        font-size: 12px;
      ">${itemName}</div>
    `;

    if (isConsumable) {
      html += `
        <div class="ctx-option" data-action="use" style="
          padding: 8px 12px;
          color: #fff;
          cursor: pointer;
        ">Use</div>
      `;
    }

    if (isEquip) {
      html += `
        <div class="ctx-option" data-action="equip" style="
          padding: 8px 12px;
          color: #fff;
          cursor: pointer;
        ">Equip</div>
      `;
    }

    // Show Sell option when shop is open
    if (this.callbacks?.isShopOpen()) {
      html += `
        <div class="ctx-option" data-action="sell" style="
          padding: 8px 12px;
          color: #ffd700;
          cursor: pointer;
        ">Sell</div>
      `;
    }

    html += `
      <div class="ctx-option" data-action="drop" style="
        padding: 8px 12px;
        color: #ff6666;
        cursor: pointer;
      ">Drop</div>
    `;

    this.contextMenu.innerHTML = html;
    document.body.appendChild(this.contextMenu);

    // Adjust position if off-screen
    const rect = this.contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.contextMenu.style.left = (window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      this.contextMenu.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }

    // Add option handlers
    const options = this.contextMenu.querySelectorAll('.ctx-option');
    options.forEach((opt) => {
      const action = (opt as HTMLElement).dataset.action;

      opt.addEventListener('mouseenter', () => {
        (opt as HTMLElement).style.background = 'rgba(74, 124, 74, 0.5)';
      });
      opt.addEventListener('mouseleave', () => {
        (opt as HTMLElement).style.background = 'transparent';
      });

      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideContextMenu();

        if (this.callbacks) {
          switch (action) {
            case 'use':
              this.callbacks.onUse(slotIndex);
              break;
            case 'equip':
              this.callbacks.onEquip(slotIndex);
              break;
            case 'sell':
              this.callbacks.onSell(slotIndex);
              break;
            case 'drop':
              this.callbacks.onDrop(slotIndex);
              break;
          }
        }
      });
    });
  }

  /**
   * Hide context menu
   */
  private hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  /**
   * Get rarity border color for a slot
   */
  private getRarityBorderColor(slot: InventorySlot): string {
    if (!slot.properties) return '#555';

    const rarity = (slot.properties as ItemProperties).rarity || Rarity.COMMON;
    return RarityColors[rarity] || '#555';
  }

  /**
   * Get rarity color for display
   */
  private getRarityColor(slot: InventorySlot): string {
    if (!slot.properties) return '#fff';

    const rarity = (slot.properties as ItemProperties).rarity || Rarity.COMMON;
    return RarityColors[rarity] || '#fff';
  }

  /**
   * Format item name for display
   */
  private formatItemName(name: string): string {
    if (!name) return 'Unknown';
    return name
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
      .replace(/sword/i, ' Sword')
      .replace(/armor/i, ' Armor')
      .replace(/axe/i, 'Axe')
      .replace(/morningstar/i, 'Morning Star')
      .replace(/flask/i, 'Flask')
      .replace(/burger/i, 'Burger')
      .replace(/cake/i, 'Cake')
      .replace(/firepotion/i, 'Fire Potion')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.hide();
  }
}
