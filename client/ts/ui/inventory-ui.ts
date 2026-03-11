/**
 * InventoryUI - 4x5 grid inventory panel
 * Single Responsibility: Display and interact with inventory items
 *
 * Supports two modes:
 * 1. EventBus mode (preferred) - emits events for actions
 * 2. Callback mode (legacy) - calls callback functions directly
 */

import { InventorySlot, INVENTORY_SIZE, INVENTORY_COLS, INVENTORY_ROWS, isStackable, isEquipment } from '../../../shared/ts/inventory/inventory-types';
import { Rarity, RarityColors, RarityNames, ItemProperties, deserializeProperties, formatItemStats } from '../../../shared/ts/items/index';
import { Types } from '../../../shared/ts/gametypes';
import { EventBus } from '../../../shared/ts/events/event-bus';
import { getWeaponStats, getArmorStats, compareWeapons, compareArmors } from '../../../shared/ts/equipment/equipment-stats';

export interface InventoryCallbacks {
  onUse: (slotIndex: number) => void;
  onEquip: (slotIndex: number) => void;
  onDrop: (slotIndex: number) => void;
  onSell: (slotIndex: number) => void;
  onUnequip: (slot: 'weapon' | 'armor') => void;
  onUnequipToInventory: (slot: 'weapon' | 'armor') => void;
  isShopOpen: () => boolean;
}

export interface EquippedItems {
  weapon: number | null;  // Entity kind
  armor: number | null;   // Entity kind
  weaponProps: ItemProperties | null;  // Weapon properties (for accurate comparison)
  armorProps: ItemProperties | null;   // Armor properties (for accurate comparison)
}

export class InventoryUI {
  private visible = false;
  private slots: (InventorySlot | null)[] = [];
  private callbacks: InventoryCallbacks | null = null;
  private eventBus: EventBus | null = null;
  private panel: HTMLDivElement | null = null;
  private contextMenu: HTMLDivElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private equipped: EquippedItems = { weapon: null, armor: null, weaponProps: null, armorProps: null };
  private isShopOpenFn: (() => boolean) | null = null;
  private boundClickHandler: () => void;
  private eventBusSubs: { unsubscribe: () => void }[] = [];

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus || null;

    // Close context menu on click outside
    this.boundClickHandler = () => this.hideContextMenu();
    document.addEventListener('click', this.boundClickHandler);

    // If using EventBus, subscribe to state changes
    if (this.eventBus) {
      this.eventBusSubs.push(
        this.eventBus.on('state:inventory', ({ slots }: any) => this.updateSlots(slots)),
        this.eventBus.on('state:equipment', ({ weapon, armor, weaponProps, armorProps }: any) =>
          this.updateEquipped(weapon, armor, weaponProps, armorProps))
      );
    }
  }

  /**
   * Set EventBus for event-driven mode
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Set isShopOpen callback for EventBus mode
   */
  setIsShopOpen(fn: () => boolean): void {
    this.isShopOpenFn = fn;
  }

  /**
   * Check if shop is open (supports both modes)
   */
  private isShopOpen(): boolean {
    if (this.isShopOpenFn) {
      return this.isShopOpenFn();
    }
    return this.callbacks?.isShopOpen?.() ?? false;
  }

  /**
   * Emit action via EventBus or call callback (backward compat)
   */
  private emitAction(action: string, data: any): void {
    if (this.eventBus) {
      // EventBus mode - emit typed event
      switch (action) {
        case 'use':
          this.eventBus.emit('ui:inventory:use', { slotIndex: data.slotIndex });
          break;
        case 'equip':
          this.eventBus.emit('ui:inventory:equip', { slotIndex: data.slotIndex });
          break;
        case 'drop':
          this.eventBus.emit('ui:inventory:drop', { slotIndex: data.slotIndex });
          break;
        case 'sell':
          this.eventBus.emit('ui:inventory:sell', { slotIndex: data.slotIndex });
          break;
        case 'unequip':
          this.eventBus.emit('ui:inventory:unequip', { slot: data.slot, toInventory: data.toInventory });
          break;
      }
    } else if (this.callbacks) {
      // Legacy callback mode
      switch (action) {
        case 'use':
          this.callbacks.onUse(data.slotIndex);
          break;
        case 'equip':
          this.callbacks.onEquip(data.slotIndex);
          break;
        case 'drop':
          this.callbacks.onDrop(data.slotIndex);
          break;
        case 'sell':
          this.callbacks.onSell(data.slotIndex);
          break;
        case 'unequip':
          if (data.toInventory) {
            this.callbacks.onUnequipToInventory(data.slot);
          } else {
            this.callbacks.onUnequip(data.slot);
          }
          break;
      }
    }
  }


  /**
   * Update equipped items display
   */
  updateEquipped(
    weapon: number | null,
    armor: number | null,
    weaponProps?: ItemProperties | null,
    armorProps?: ItemProperties | null
  ): void {
    this.equipped = {
      weapon,
      armor,
      weaponProps: weaponProps ?? this.equipped.weaponProps,
      armorProps: armorProps ?? this.equipped.armorProps
    };
    if (this.visible) {
      this.render();
    }
  }

  /**
   * Get equipped weapon properties for comparison
   */
  getEquippedWeaponProps(): ItemProperties | null {
    return this.equipped.weaponProps;
  }

  /**
   * Get equipped armor properties for comparison
   */
  getEquippedArmorProps(): ItemProperties | null {
    return this.equipped.armorProps;
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
    this.hideTooltip();
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
        <span style="font-weight: bold; font-size: 14px;">Equipment & Inventory</span>
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

    // Equipment slots section
    html += this.renderEquipmentSection();

    // Inventory label
    html += `
      <div style="
        padding: 6px 10px;
        background: rgba(0,0,0,0.2);
        border-bottom: 1px solid #333;
        font-size: 11px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 1px;
      ">Backpack</div>
    `;

    // Grid
    html += `<div style="padding: 10px; display: grid; grid-template-columns: repeat(${INVENTORY_COLS}, 60px); gap: 4px;">`;

    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const slot = this.slots[i];
      const borderColor = slot ? this.getRarityBorderColor(slot) : '#444';
      const bgColor = slot ? this.getRarityBackground(slot) : 'rgba(40, 40, 50, 0.5)';
      const glowEffect = slot ? this.getRarityGlow(slot) : 'none';

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
          box-shadow: ${glowEffect};
          transition: transform 0.1s, box-shadow 0.2s;
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
        Left-click: Use/Equip | Right-click: Options | Q: Quick heal | Press 'I' to close
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

    // Stop all clicks on the panel from propagating to the game canvas
    this.panel.addEventListener('click', (e) => e.stopPropagation());
    this.panel.addEventListener('mousedown', (e) => e.stopPropagation());
    this.panel.addEventListener('mouseup', (e) => e.stopPropagation());

    // Close button
    const closeBtn = this.panel.querySelector('#inventory-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
      });
    }

    // Equipment slot handlers
    const equipSlots = this.panel.querySelectorAll('.equipment-slot');
    equipSlots.forEach((el) => {
      const slotType = (el as HTMLElement).dataset.equipSlot as 'weapon' | 'armor';

      // Right-click to unequip
      (el as HTMLElement).addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.hideTooltip();

        const hasItem = slotType === 'weapon'
          ? (this.equipped.weapon && this.equipped.weapon !== Types.Entities.SWORD1)
          : (this.equipped.armor && this.equipped.armor !== Types.Entities.CLOTHARMOR);

        if (hasItem) {
          this.showEquipmentContextMenu(slotType, e.clientX, e.clientY);
        }
      });

      // Hover effects and tooltip
      el.addEventListener('mouseenter', (e: Event) => {
        const hasItem = slotType === 'weapon'
          ? (this.equipped.weapon && this.equipped.weapon !== Types.Entities.SWORD1)
          : (this.equipped.armor && this.equipped.armor !== Types.Entities.CLOTHARMOR);
        if (hasItem) {
          (el as HTMLElement).style.transform = 'scale(1.05)';
          const mouseEvent = e as MouseEvent;
          const itemKind = slotType === 'weapon' ? this.equipped.weapon : this.equipped.armor;
          if (itemKind) {
            this.showEquipmentTooltip(itemKind, slotType, mouseEvent.clientX, mouseEvent.clientY);
          }
        }
      });
      el.addEventListener('mousemove', (e: Event) => {
        if (this.tooltip) {
          const mouseEvent = e as MouseEvent;
          this.tooltip.style.left = (mouseEvent.clientX + 15) + 'px';
          this.tooltip.style.top = mouseEvent.clientY + 'px';
        }
      });
      el.addEventListener('mouseleave', () => {
        (el as HTMLElement).style.transform = 'scale(1)';
        this.hideTooltip();
      });
    });

    // Slot handlers - attach to ALL slots, check slot existence at click time
    const slotElements = this.panel.querySelectorAll('.inventory-slot');
    slotElements.forEach((el) => {
      const slotIndex = parseInt((el as HTMLElement).dataset.slot || '0');

      // Left-click: use or equip
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideContextMenu();

        // Look up slot at click time, not render time
        const slot = this.slots[slotIndex];
        if (!slot) return;
        // Need callbacks or eventBus to handle actions
        if (!this.callbacks && !this.eventBus) return;

        if (isStackable(slot.kind)) {
          // Consumable: use it
          this.emitAction('use', { slotIndex });
        } else if (isEquipment(slot.kind)) {
          // Equipment: equip it
          this.emitAction('equip', { slotIndex });
        }
      });

      // Right-click: context menu
      (el as HTMLElement).addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.hideTooltip();  // Hide tooltip so context menu is visible
        const slot = this.slots[slotIndex];
        if (slot) {
          this.showContextMenu(slotIndex, e.clientX, e.clientY);
        }
      });

      // Hover effects and tooltip
      el.addEventListener('mouseenter', (e: Event) => {
        const slot = this.slots[slotIndex];
        if (slot) {
          (el as HTMLElement).style.transform = 'scale(1.05)';
          (el as HTMLElement).style.zIndex = '1';
          // Show tooltip
          const mouseEvent = e as MouseEvent;
          this.showTooltip(slot, mouseEvent.clientX, mouseEvent.clientY);
        }
      });
      el.addEventListener('mousemove', (e: Event) => {
        const slot = this.slots[slotIndex];
        if (slot && this.tooltip) {
          const mouseEvent = e as MouseEvent;
          this.tooltip.style.left = (mouseEvent.clientX + 15) + 'px';
          this.tooltip.style.top = mouseEvent.clientY + 'px';
        }
      });
      el.addEventListener('mouseleave', () => {
        (el as HTMLElement).style.transform = 'scale(1)';
        (el as HTMLElement).style.zIndex = '0';
        this.hideTooltip();
      });
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
      z-index: 9000;
      font-family: Arial, sans-serif;
      font-size: 13px;
      overflow: hidden;
    `;

    const itemName = this.formatItemName(Types.getKindAsString(slot.kind), slot);
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
    if (this.isShopOpen()) {
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

        // Use emitAction for both EventBus and callback modes
        switch (action) {
          case 'use':
            this.emitAction('use', { slotIndex });
            break;
          case 'equip':
            this.emitAction('equip', { slotIndex });
            break;
          case 'sell':
            this.emitAction('sell', { slotIndex });
            break;
          case 'drop':
            this.emitAction('drop', { slotIndex });
            break;
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
   * Show item tooltip with stats and comparison
   */
  private showTooltip(slot: InventorySlot, x: number, y: number): void {
    this.hideTooltip();

    const itemName = this.formatItemName(Types.getKindAsString(slot.kind), slot);
    const isWeapon = Types.isWeapon(slot.kind);
    const isArmor = Types.isArmor(slot.kind);
    const isConsumable = isStackable(slot.kind);

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'inventory-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      left: ${x + 15}px;
      top: ${y}px;
      min-width: 160px;
      max-width: 220px;
      background: rgba(20, 20, 30, 0.95);
      border: 2px solid ${this.getRarityBorderColor(slot)};
      border-radius: 6px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.7);
      z-index: 8500;
      font-family: Arial, sans-serif;
      font-size: 12px;
      pointer-events: none;
    `;

    let html = `
      <div style="
        padding: 8px 10px;
        border-bottom: 1px solid #333;
      ">
        <div style="color: ${this.getRarityColor(slot)}; font-weight: bold; font-size: 13px;">
          ${itemName}
        </div>
    `;

    // Show rarity if properties exist
    if (slot.properties) {
      const props = slot.properties as ItemProperties;
      const rarityName = RarityNames[props.rarity] || 'Common';
      html += `<div style="color: ${this.getRarityColor(slot)}; font-size: 10px; opacity: 0.8;">${rarityName}</div>`;
    }

    html += `</div>`;

    // Stats section
    html += `<div style="padding: 8px 10px;">`;

    if (slot.properties) {
      const statsText = formatItemStats(slot.properties as ItemProperties);
      if (statsText) {
        html += `<div style="color: #aaffaa; margin-bottom: 6px;">${statsText}</div>`;
      }
    } else {
      // Show base stats for items without properties
      const weaponStats = isWeapon ? getWeaponStats(slot.kind) : null;
      const armorStats = isArmor ? getArmorStats(slot.kind) : null;

      if (weaponStats) {
        html += `<div style="color: #aaffaa; margin-bottom: 6px;">${weaponStats.min}-${weaponStats.max} damage</div>`;
      } else if (armorStats) {
        html += `<div style="color: #aaffaa; margin-bottom: 6px;">+${armorStats.defense} defense</div>`;
      }
    }

    // Comparison with equipped item
    if (isWeapon && this.equipped.weapon) {
      html += this.getComparisonHtml(slot, this.equipped.weapon, 'weapon');
    } else if (isArmor && this.equipped.armor) {
      html += this.getComparisonHtml(slot, this.equipped.armor, 'armor');
    }

    // Usage hint
    if (isConsumable) {
      html += `<div style="color: #888; font-size: 10px; margin-top: 4px;">Click to use</div>`;
    } else if (isWeapon || isArmor) {
      html += `<div style="color: #888; font-size: 10px; margin-top: 4px;">Click to equip</div>`;
    }

    html += `</div>`;

    this.tooltip.innerHTML = html;
    document.body.appendChild(this.tooltip);

    // Adjust position if off-screen
    const rect = this.tooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.tooltip.style.left = (x - rect.width - 5) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      this.tooltip.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }
  }

  /**
   * Get comparison HTML between inventory item and equipped item
   * Uses shared equipment-stats module and actual equipped properties
   */
  private getComparisonHtml(slot: InventorySlot, equippedKind: number, type: 'weapon' | 'armor'): string {
    let diff: number;

    if (type === 'weapon') {
      // Use compareWeapons with actual properties
      diff = compareWeapons(
        slot.kind,
        equippedKind,
        slot.properties as { damageMin?: number; damageMax?: number } | null,
        this.equipped.weaponProps as { damageMin?: number; damageMax?: number } | null
      );
    } else {
      // Use compareArmors with actual properties
      diff = compareArmors(
        slot.kind,
        equippedKind,
        slot.properties as { defense?: number } | null,
        this.equipped.armorProps as { defense?: number } | null
      );
    }

    if (diff === 0) {
      return `<div style="color: #888; font-size: 11px; border-top: 1px solid #333; padding-top: 6px;">Same as equipped</div>`;
    }

    const color = diff > 0 ? '#55ff55' : '#ff5555';
    const arrow = diff > 0 ? '▲' : '▼';
    const statName = type === 'weapon' ? 'damage' : 'defense';

    return `
      <div style="color: ${color}; font-size: 11px; border-top: 1px solid #333; padding-top: 6px;">
        ${arrow} ${diff > 0 ? '+' : ''}${diff.toFixed(0)} ${statName} vs equipped
      </div>
    `;
  }

  /**
   * Hide item tooltip
   */
  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  /**
   * Show tooltip for equipped item
   */
  private showEquipmentTooltip(itemKind: number, slotType: 'weapon' | 'armor', x: number, y: number): void {
    this.hideTooltip();

    const itemName = this.formatItemName(Types.getKindAsString(itemKind));
    const isWeapon = slotType === 'weapon';

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'inventory-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      left: ${x + 15}px;
      top: ${y}px;
      min-width: 160px;
      max-width: 220px;
      background: rgba(20, 20, 30, 0.95);
      border: 2px solid ${isWeapon ? '#8a6d3b' : '#5a7a5a'};
      border-radius: 6px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.7);
      z-index: 8500;
      font-family: Arial, sans-serif;
      font-size: 12px;
      pointer-events: none;
    `;

    let html = `
      <div style="
        padding: 8px 10px;
        border-bottom: 1px solid #333;
      ">
        <div style="color: #fff; font-weight: bold; font-size: 13px;">
          ${itemName}
        </div>
        <div style="color: ${isWeapon ? '#8a6d3b' : '#5a7a5a'}; font-size: 10px; opacity: 0.8;">
          Equipped ${isWeapon ? 'Weapon' : 'Armor'}
        </div>
      </div>
    `;

    // Stats section
    html += `<div style="padding: 8px 10px;">`;

    // Show base stats for equipped items
    const weaponStats = isWeapon ? getWeaponStats(itemKind) : null;
    const armorStats = !isWeapon ? getArmorStats(itemKind) : null;

    if (weaponStats) {
      html += `<div style="color: #aaffaa; margin-bottom: 6px;">${weaponStats.min}-${weaponStats.max} damage</div>`;
    } else if (armorStats) {
      html += `<div style="color: #aaffaa; margin-bottom: 6px;">+${armorStats.defense} defense</div>`;
    }

    html += `<div style="color: #888; font-size: 10px; margin-top: 4px;">Right-click to unequip</div>`;
    html += `</div>`;

    this.tooltip.innerHTML = html;
    document.body.appendChild(this.tooltip);

    // Adjust position if off-screen
    const rect = this.tooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.tooltip.style.left = (x - rect.width - 5) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      this.tooltip.style.top = (window.innerHeight - rect.height - 10) + 'px';
    }
  }

  /**
   * Show context menu for equipped items
   */
  private showEquipmentContextMenu(slotType: 'weapon' | 'armor', x: number, y: number): void {
    this.hideContextMenu();

    const itemKind = slotType === 'weapon' ? this.equipped.weapon : this.equipped.armor;
    if (!itemKind) return;

    const itemName = this.formatItemName(Types.getKindAsString(itemKind));

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
      z-index: 9000;
      font-family: Arial, sans-serif;
      font-size: 13px;
      overflow: hidden;
    `;

    this.contextMenu.innerHTML = `
      <div style="
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid #444;
        color: #ddd;
        font-weight: bold;
        font-size: 12px;
      ">${itemName} (Equipped)</div>
      <div class="ctx-option" data-action="unequip" style="
        padding: 8px 12px;
        color: #ff9966;
        cursor: pointer;
      ">Unequip to Backpack</div>
      <div class="ctx-option" data-action="drop" style="
        padding: 8px 12px;
        color: #ff6666;
        cursor: pointer;
      ">Drop</div>
    `;

    document.body.appendChild(this.contextMenu);

    // Add handlers
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

        // Use emitAction for both EventBus and callback modes
        if (action === 'unequip') {
          this.emitAction('unequip', { slot: slotType, toInventory: true });
        } else if (action === 'drop') {
          this.emitAction('unequip', { slot: slotType, toInventory: false });
        }
      });
    });
  }

  /**
   * Check if inventory has a better item than equipped
   * Uses shared equipment-stats comparison functions
   */
  private hasBetterInInventory(type: 'weapon' | 'armor'): boolean {
    const equippedKind = type === 'weapon' ? this.equipped.weapon : this.equipped.armor;
    const equippedProps = type === 'weapon' ? this.equipped.weaponProps : this.equipped.armorProps;

    for (const slot of this.slots) {
      if (!slot) continue;
      const isMatchingType = type === 'weapon' ? Types.isWeapon(slot.kind) : Types.isArmor(slot.kind);
      if (!isMatchingType) continue;

      // Compare using shared functions with actual properties
      const diff = type === 'weapon'
        ? compareWeapons(slot.kind, equippedKind || 0, slot.properties as any, equippedProps as any)
        : compareArmors(slot.kind, equippedKind || 0, slot.properties as any, equippedProps as any);

      if (diff > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Render the equipment section (weapon + armor slots)
   */
  private renderEquipmentSection(): string {
    const weaponKind = this.equipped.weapon;
    const armorKind = this.equipped.armor;

    // Get sprite names
    const weaponName = weaponKind ? Types.getKindAsString(weaponKind) : null;
    const armorName = armorKind ? Types.getKindAsString(armorKind) : null;

    // Check for default items (which shouldn't be shown as "equipped")
    const hasRealWeapon = weaponKind && weaponKind !== Types.Entities.SWORD1;
    const hasRealArmor = armorKind && armorKind !== Types.Entities.CLOTHARMOR;

    // Check for upgrades available in inventory
    const hasWeaponUpgrade = this.hasBetterInInventory('weapon');
    const hasArmorUpgrade = this.hasBetterInInventory('armor');

    return `
      <div style="
        padding: 10px;
        display: flex;
        gap: 10px;
        justify-content: center;
        border-bottom: 1px solid #444;
        background: rgba(0,0,0,0.15);
      ">
        <!-- Weapon Slot -->
        <div class="equipment-slot" data-equip-slot="weapon" style="
          width: 64px;
          height: 64px;
          background: ${hasRealWeapon ? 'rgba(70, 70, 90, 0.8)' : 'rgba(40, 40, 50, 0.5)'};
          border: 2px solid ${hasRealWeapon ? '#8a6d3b' : '#444'};
          border-radius: 6px;
          cursor: ${hasRealWeapon ? 'pointer' : 'default'};
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          ${hasWeaponUpgrade ? 'box-shadow: 0 0 8px rgba(0, 255, 0, 0.6);' : ''}
        ">
          ${hasWeaponUpgrade ? `
            <div style="
              position: absolute;
              top: -4px;
              right: -4px;
              width: 16px;
              height: 16px;
              background: #22aa22;
              border: 1px solid #00ff00;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              color: #fff;
              text-shadow: 0 0 2px #000;
              z-index: 1;
            ">▲</div>
          ` : ''}
          ${hasRealWeapon ? `
            <div style="
              width: 48px;
              height: 48px;
              background-image: url('/img/1/item-${weaponName}.png');
              background-size: 288px 48px;
              background-repeat: no-repeat;
              background-position: 0 0;
            "></div>
          ` : `
            <div style="color: #555; font-size: 20px;">⚔</div>
          `}
          <span style="
            position: absolute;
            bottom: 2px;
            font-size: 8px;
            color: #888;
            text-transform: uppercase;
          ">Weapon</span>
        </div>

        <!-- Armor Slot -->
        <div class="equipment-slot" data-equip-slot="armor" style="
          width: 64px;
          height: 64px;
          background: ${hasRealArmor ? 'rgba(70, 70, 90, 0.8)' : 'rgba(40, 40, 50, 0.5)'};
          border: 2px solid ${hasRealArmor ? '#5a7a5a' : '#444'};
          border-radius: 6px;
          cursor: ${hasRealArmor ? 'pointer' : 'default'};
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          ${hasArmorUpgrade ? 'box-shadow: 0 0 8px rgba(0, 255, 0, 0.6);' : ''}
        ">
          ${hasArmorUpgrade ? `
            <div style="
              position: absolute;
              top: -4px;
              right: -4px;
              width: 16px;
              height: 16px;
              background: #22aa22;
              border: 1px solid #00ff00;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              color: #fff;
              text-shadow: 0 0 2px #000;
              z-index: 1;
            ">▲</div>
          ` : ''}
          ${hasRealArmor ? `
            <div style="
              width: 48px;
              height: 48px;
              background-image: url('/img/1/item-${armorName}.png');
              background-size: 288px 48px;
              background-repeat: no-repeat;
              background-position: 0 0;
            "></div>
          ` : `
            <div style="color: #555; font-size: 20px;">🛡</div>
          `}
          <span style="
            position: absolute;
            bottom: 2px;
            font-size: 8px;
            color: #888;
            text-transform: uppercase;
          ">Armor</span>
        </div>
      </div>
    `;
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
   * Get rarity glow effect (box-shadow)
   */
  private getRarityGlow(slot: InventorySlot): string {
    if (!slot.properties) return 'none';

    const rarity = (slot.properties as ItemProperties).rarity;
    switch (rarity) {
      case Rarity.UNCOMMON: return '0 0 8px rgba(30, 255, 0, 0.5)';
      case Rarity.RARE: return '0 0 10px rgba(0, 112, 221, 0.6)';
      case Rarity.EPIC: return '0 0 12px rgba(163, 53, 238, 0.7)';
      case Rarity.LEGENDARY: return '0 0 15px rgba(255, 128, 0, 0.8), 0 0 25px rgba(255, 128, 0, 0.4)';
      default: return 'none';
    }
  }

  /**
   * Get rarity background tint
   */
  private getRarityBackground(slot: InventorySlot): string {
    if (!slot.properties) return 'rgba(60, 60, 70, 0.8)';

    const rarity = (slot.properties as ItemProperties).rarity;
    switch (rarity) {
      case Rarity.UNCOMMON: return 'rgba(30, 70, 30, 0.7)';
      case Rarity.RARE: return 'rgba(20, 50, 90, 0.7)';
      case Rarity.EPIC: return 'rgba(70, 30, 70, 0.7)';
      case Rarity.LEGENDARY: return 'rgba(90, 50, 10, 0.7)';
      default: return 'rgba(60, 60, 70, 0.8)';
    }
  }

  /**
   * Format item name for display (with optional rarity prefix)
   */
  private formatItemName(name: string, slot?: InventorySlot): string {
    if (!name) return 'Unknown';
    const baseName = name
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

    // Add rarity prefix for non-common items
    if (slot?.properties) {
      const rarity = (slot.properties as ItemProperties).rarity;
      if (rarity && rarity !== Rarity.COMMON) {
        const rarityName = RarityNames[rarity];
        return `${rarityName} ${baseName}`;
      }
    }
    return baseName;
  }

  /**
   * Cleanup - remove document listeners and EventBus subscriptions
   */
  cleanup(): void {
    this.hide();
    document.removeEventListener('click', this.boundClickHandler);
    for (const sub of this.eventBusSubs) {
      sub.unsubscribe();
    }
    this.eventBusSubs = [];
  }
}
