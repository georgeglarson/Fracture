/**
 * ShopUI - Handles shop popup display and interaction
 * Single Responsibility: Manage shop-related UI elements
 */

import { Types } from '../../../shared/ts/gametypes';

export interface ShopItem {
  itemKind: number;
  price: number;
  stock: number;
}

export interface ShopCallbacks {
  onBuy: (npcKind: number, itemKind: number) => void;
  getPlayerGold: () => number;
  onGoldChange: (newGold: number) => void;
  saveGold: (gold: number) => void;
  playSound: (sound: string) => void;
}

export class ShopUI {
  private currentNpcKind: number | null = null;
  private items: ShopItem[] = [];
  private callbacks: ShopCallbacks | null = null;

  constructor() {}

  /**
   * Set callback handlers
   */
  setCallbacks(callbacks: ShopCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Show shop popup with items
   */
  show(npcKind: number, shopName: string, items: ShopItem[]): void {
    const popup = document.getElementById('shop-popup');
    if (!popup) return;

    this.currentNpcKind = npcKind;
    this.items = items;

    // Update shop name
    const nameEl = document.getElementById('shop-name');
    if (nameEl) nameEl.textContent = shopName;

    // Update player gold
    this.updateGoldDisplay();

    // Populate items
    const itemsList = document.getElementById('shop-items-list');
    if (itemsList) {
      itemsList.innerHTML = '';
      const playerGold = this.callbacks?.getPlayerGold() ?? 0;

      items.forEach(item => {
        const itemName = Types.getKindAsString(item.itemKind);
        const displayName = this.getItemDisplayName(item.itemKind);
        const canAfford = playerGold >= item.price;
        const inStock = item.stock !== 0;

        const itemEl = document.createElement('div');
        itemEl.className = 'shop-item';
        itemEl.innerHTML = `
          <div class="shop-item-icon" style="
            background-image: url('img/1/item-${itemName}.png');
            background-size: 288px 48px;
            background-repeat: no-repeat;
            background-position: 0 0;
          "></div>
          <div class="shop-item-info">
            <div class="shop-item-name">${displayName}</div>
            <div class="shop-item-stock ${item.stock !== -1 && item.stock <= 2 ? 'limited' : ''}">
              ${item.stock === -1 ? 'In Stock' : item.stock === 0 ? 'Out of Stock' : `${item.stock} left`}
            </div>
          </div>
          <div class="shop-item-price">${item.price}g</div>
          <button class="shop-buy-btn" data-item="${item.itemKind}" ${!canAfford || !inStock ? 'disabled' : ''}>
            ${!inStock ? 'Sold' : !canAfford ? 'Need Gold' : 'Buy'}
          </button>
        `;
        itemsList.appendChild(itemEl);
      });

      // Add click handlers for buy buttons
      itemsList.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const target = e.target as HTMLButtonElement;
          const itemKind = parseInt(target.dataset.item || '0', 10);
          if (itemKind && this.currentNpcKind !== null && this.callbacks) {
            this.callbacks.onBuy(this.currentNpcKind, itemKind);
          }
        });
      });
    }

    // Clear message
    const msgEl = document.getElementById('shop-message');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.className = '';
    }

    // Show popup
    popup.classList.add('active');

    // Add close button handler
    const closeBtn = popup.querySelector('.shop-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide(), { once: true });
    }

    // Close on clicking outside
    popup.addEventListener('click', (e) => {
      if (e.target === popup) this.hide();
    }, { once: true });

    console.info('[Shop] Opened:', shopName, 'with', items.length, 'items');
  }

  /**
   * Hide shop popup
   */
  hide(): void {
    const popup = document.getElementById('shop-popup');
    if (popup) {
      popup.classList.remove('active');
    }
    this.currentNpcKind = null;
    this.items = [];
  }

  /**
   * Handle buy result from server
   */
  handleBuyResult(success: boolean, itemKind: number, newGold: number, message: string): void {
    try {
      const msgEl = document.getElementById('shop-message');
      if (msgEl) {
        msgEl.textContent = message;
        msgEl.className = success ? '' : 'error';
      }

      if (success && this.callbacks) {
        // Update gold
        this.callbacks.onGoldChange(newGold);
        this.callbacks.saveGold(newGold);

        // Update gold display in shop
        this.updateGoldDisplay();

        // Refresh shop to update button states and stock
        if (this.currentNpcKind !== null) {
          // Update local stock
          const item = this.items.find(i => i.itemKind === itemKind);
          if (item && item.stock > 0) {
            item.stock--;
          }

          // Re-render buttons
          this.updateButtons();
        }

        // Play sound
        this.callbacks.playSound('loot');
      }
    } catch (e) {
      console.error('[Shop] Error handling buy result:', e);
    }
  }

  /**
   * Update gold display
   */
  private updateGoldDisplay(): void {
    const goldEl = document.getElementById('shop-player-gold');
    if (goldEl && this.callbacks) {
      goldEl.textContent = this.callbacks.getPlayerGold().toString();
    }
  }

  /**
   * Update buy buttons state
   */
  private updateButtons(): void {
    const itemsList = document.getElementById('shop-items-list');
    if (!itemsList || !this.callbacks) return;

    const playerGold = this.callbacks.getPlayerGold();

    itemsList.querySelectorAll('.shop-item').forEach((itemEl, index) => {
      const item = this.items[index];
      if (!item) return;

      const btn = itemEl.querySelector('.shop-buy-btn') as HTMLButtonElement;
      const stockEl = itemEl.querySelector('.shop-item-stock');

      if (btn) {
        const canAfford = playerGold >= item.price;
        const inStock = item.stock !== 0;
        btn.disabled = !canAfford || !inStock;
        btn.textContent = !inStock ? 'Sold' : !canAfford ? 'Need Gold' : 'Buy';
      }

      if (stockEl) {
        stockEl.textContent = item.stock === -1 ? 'In Stock' : item.stock === 0 ? 'Out of Stock' : `${item.stock} left`;
        stockEl.className = 'shop-item-stock' + (item.stock !== -1 && item.stock <= 2 ? ' limited' : '');
      }
    });
  }

  /**
   * Get display name for item kind
   */
  private getItemDisplayName(itemKind: number): string {
    const kindString = Types.getKindAsString(itemKind);
    // Convert camelCase/lowercase to Title Case
    const words = kindString.replace(/([A-Z])/g, ' $1').toLowerCase().split(/[\s_-]+/);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * Check if shop is currently open
   */
  isOpen(): boolean {
    return this.currentNpcKind !== null;
  }

  /**
   * Get current NPC kind
   */
  getCurrentNpcKind(): number | null {
    return this.currentNpcKind;
  }
}
