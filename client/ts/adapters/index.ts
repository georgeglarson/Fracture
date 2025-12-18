/**
 * Adapters Module
 *
 * Adapters wrap external interfaces (network, storage, audio)
 * for clean dependency injection and testability.
 */

export {
  NetworkAdapter,
  ShopNetworkAdapter,
  createNetworkAdapter
} from './network.adapter';
