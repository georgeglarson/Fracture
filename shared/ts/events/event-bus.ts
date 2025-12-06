/**
 * EventBus - Typed pub/sub event system
 *
 * This is the abstraction layer that enables swapping backends.
 * Currently uses eventemitter3 (in-process).
 * Could be swapped to Redis pub/sub for distributed scaling.
 */

import EventEmitter from 'eventemitter3';
import {
  GameEventMap,
  GameEventName,
  GameEventPayload
} from './event-types.js';

/** Callback type for event handlers */
export type EventHandler<T extends GameEventName> = (payload: GameEventPayload<T>) => void;

/** Subscription handle for unsubscribing */
export interface Subscription {
  unsubscribe(): void;
}

/**
 * EventBus interface - the contract that any backend must implement.
 * This enables swapping from in-process to distributed without changing consumers.
 */
export interface IEventBus {
  /** Emit an event with payload */
  emit<T extends GameEventName>(event: T, payload: GameEventPayload<T>): void;

  /** Subscribe to an event */
  on<T extends GameEventName>(event: T, handler: EventHandler<T>): Subscription;

  /** Subscribe to an event (one-time) */
  once<T extends GameEventName>(event: T, handler: EventHandler<T>): Subscription;

  /** Remove all listeners for an event (or all events) */
  off<T extends GameEventName>(event?: T): void;

  /** Get listener count for an event */
  listenerCount<T extends GameEventName>(event: T): number;
}

/**
 * In-process EventBus implementation using eventemitter3.
 * Production-ready, battle-tested, and fast.
 */
export class EventBus implements IEventBus {
  private emitter: EventEmitter;
  private debug: boolean;

  constructor(options?: { debug?: boolean }) {
    this.emitter = new EventEmitter();
    this.debug = options?.debug ?? false;
  }

  /**
   * Emit an event with a typed payload.
   * All subscribers will be notified synchronously.
   */
  emit<T extends GameEventName>(event: T, payload: GameEventPayload<T>): void {
    if (this.debug) {
      console.log(`[EventBus] ${event}`, payload);
    }
    this.emitter.emit(event, payload);
  }

  /**
   * Subscribe to an event.
   * Returns a Subscription handle for cleanup.
   */
  on<T extends GameEventName>(event: T, handler: EventHandler<T>): Subscription {
    this.emitter.on(event, handler as any);

    return {
      unsubscribe: () => {
        this.emitter.off(event, handler as any);
      }
    };
  }

  /**
   * Subscribe to an event (one-time).
   * Handler is automatically removed after first invocation.
   */
  once<T extends GameEventName>(event: T, handler: EventHandler<T>): Subscription {
    const wrappedHandler = (payload: GameEventPayload<T>) => {
      handler(payload);
    };

    this.emitter.once(event, wrappedHandler as any);

    return {
      unsubscribe: () => {
        this.emitter.off(event, wrappedHandler as any);
      }
    };
  }

  /**
   * Remove all listeners for a specific event, or all events if none specified.
   */
  off<T extends GameEventName>(event?: T): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get the number of listeners for an event.
   * Useful for debugging and testing.
   */
  listenerCount<T extends GameEventName>(event: T): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Enable/disable debug logging.
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }
}

/**
 * Global EventBus instances.
 * Separate buses for server and client allow independent testing.
 */
let serverBus: EventBus | null = null;
let clientBus: EventBus | null = null;

/**
 * Get or create the server-side EventBus.
 */
export function getServerEventBus(): EventBus {
  if (!serverBus) {
    serverBus = new EventBus({ debug: process.env.DEBUG_EVENTS === 'true' });
  }
  return serverBus;
}

/**
 * Get or create the client-side EventBus.
 */
export function getClientEventBus(): EventBus {
  if (!clientBus) {
    clientBus = new EventBus({ debug: false });
  }
  return clientBus;
}

/**
 * Reset buses (for testing).
 */
export function resetEventBuses(): void {
  serverBus?.off();
  clientBus?.off();
  serverBus = null;
  clientBus = null;
}
