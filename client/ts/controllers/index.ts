/**
 * Controllers Module
 *
 * Controllers orchestrate the flow between UI, network, and state.
 * They listen for UI events and call appropriate services/adapters.
 */

export {
  InventoryController,
  InventoryControllerDeps,
  InventoryNetworkAdapter,
  createInventoryController
} from './inventory.controller';

export {
  ShopController,
  ShopControllerDeps,
  ShopNetworkAdapter,
  createShopController
} from './shop.controller';
