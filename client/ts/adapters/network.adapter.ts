/**
 * NetworkAdapter - Abstracts network communication from game logic
 *
 * Single Responsibility: Wrap GameClient for clean dependency injection
 * This enables testing and decouples controllers from network details.
 */

import { InventoryNetworkAdapter } from '../controllers/inventory.controller';

/**
 * Full network adapter interface combining all domain adapters
 */
export interface NetworkAdapter extends InventoryNetworkAdapter, ShopNetworkAdapter {
  // Connection state
  isConnected(): boolean;
}

/**
 * Shop network operations
 */
export interface ShopNetworkAdapter {
  sendShopBuy(npcKind: number, itemKind: number): void;
  sendShopSell(slotIndex: number): void;
}

/**
 * Create network adapter from GameClient accessor
 * Uses lazy evaluation to support late binding (client is created after inventory init)
 */
export function createNetworkAdapter(getClient: () => any): NetworkAdapter {
  return {
    // Connection
    isConnected: () => getClient()?.isConnected?.() ?? false,

    // Inventory operations
    sendInventoryUse: (slotIndex: number) => {
      getClient()?.sendInventoryUse?.(slotIndex);
    },
    sendInventoryEquip: (slotIndex: number) => {
      getClient()?.sendInventoryEquip?.(slotIndex);
    },
    sendInventoryDrop: (slotIndex: number) => {
      getClient()?.sendInventoryDrop?.(slotIndex);
    },
    sendShopSell: (slotIndex: number) => {
      getClient()?.sendShopSell?.(slotIndex);
    },
    sendDropItem: (slot: 'weapon' | 'armor') => {
      getClient()?.sendDropItem?.(slot);
    },
    sendUnequipToInventory: (slot: 'weapon' | 'armor') => {
      getClient()?.sendUnequipToInventory?.(slot);
    },
    sendInventoryPickup: (itemId: number) => {
      getClient()?.sendInventoryPickup?.(itemId);
    },

    // Shop operations
    sendShopBuy: (npcKind: number, itemKind: number) => {
      getClient()?.sendShopBuy?.(npcKind, itemKind);
    },
  };
}
