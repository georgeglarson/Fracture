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
 * Create network adapter from GameClient
 */
export function createNetworkAdapter(client: any): NetworkAdapter {
  return {
    // Connection
    isConnected: () => client?.isConnected?.() ?? false,

    // Inventory operations
    sendInventoryUse: (slotIndex: number) => {
      client?.sendInventoryUse?.(slotIndex);
    },
    sendInventoryEquip: (slotIndex: number) => {
      client?.sendInventoryEquip?.(slotIndex);
    },
    sendInventoryDrop: (slotIndex: number) => {
      client?.sendInventoryDrop?.(slotIndex);
    },
    sendShopSell: (slotIndex: number) => {
      client?.sendShopSell?.(slotIndex);
    },
    sendDropItem: (slot: 'weapon' | 'armor') => {
      client?.sendDropItem?.(slot);
    },
    sendUnequipToInventory: (slot: 'weapon' | 'armor') => {
      client?.sendUnequipToInventory?.(slot);
    },
    sendInventoryPickup: (itemId: number) => {
      client?.sendInventoryPickup?.(itemId);
    },

    // Shop operations
    sendShopBuy: (npcKind: number, itemKind: number) => {
      client?.sendShopBuy?.(npcKind, itemKind);
    },
  };
}
