/**
 * MessageDispatcher - Routes network messages to game systems
 *
 * This is the ECS-style message router that dispatches incoming network
 * messages to the appropriate game systems. It decouples message handling
 * from any specific entity implementation.
 *
 * Unlike the player-level MessageRouter which handles all messages in one place,
 * this dispatcher allows systems to register for specific message types and
 * handle them independently.
 */

import { EntityId } from './entity-manager';
import { createModuleLogger } from '../utils/logger';
import {
  checkAuthLimit,
  checkChatLimit,
  checkCombatLimit,
  checkShopLimit,
  RateLimitResult
} from '../middleware/rate-limiter';

const log = createModuleLogger('MessageDispatcher');

/**
 * Context provided to message handlers
 */
export interface MessageContext {
  /** Entity ID of the sender (usually player) */
  entityId: EntityId;
  /** Client IP for rate limiting */
  clientIp: string;
  /** Whether player has completed initial handshake */
  hasEnteredGame: boolean;
  /** World instance reference */
  world: unknown;
  /** Send message back to client */
  send: (message: unknown) => void;
  /** Broadcast to all players in area */
  broadcast: (message: unknown, ignoreSelf?: boolean) => void;
  /** Raw player reference (for legacy compatibility) */
  player?: unknown;
}

/**
 * Message handler function type
 */
export type MessageHandler = (
  ctx: MessageContext,
  message: unknown[]
) => void | Promise<void>;

/**
 * Rate limit type
 */
type RateLimitType = 'auth' | 'chat' | 'combat' | 'shop' | 'none';

/**
 * Handler registration options
 */
export interface HandlerOptions {
  /** Require player to have entered game (default: true) */
  requiresGame?: boolean;
  /** Rate limit type to apply */
  rateLimit?: RateLimitType;
  /** Priority for ordering (higher = first) */
  priority?: number;
}

/**
 * Internal handler registration
 */
interface RegisteredHandler {
  handler: MessageHandler;
  options: HandlerOptions;
  systemName: string;
}

/**
 * MessageDispatcher - Central message routing for ECS architecture
 */
export class MessageDispatcher {
  private handlers: Map<number, RegisteredHandler[]> = new Map();
  private debug: boolean;

  constructor(options?: { debug?: boolean }) {
    this.debug = options?.debug ?? false;
  }

  /**
   * Register a message handler for a specific message type
   * Multiple systems can register for the same message type
   */
  register(
    messageType: number,
    systemName: string,
    handler: MessageHandler,
    options: HandlerOptions = {}
  ): void {
    let handlers = this.handlers.get(messageType);
    if (!handlers) {
      handlers = [];
      this.handlers.set(messageType, handlers);
    }

    handlers.push({ handler, options, systemName });

    // Sort by priority (higher first)
    handlers.sort((a, b) => (b.options.priority ?? 0) - (a.options.priority ?? 0));

    if (this.debug) {
      log.debug({ messageType, systemName }, 'Registered message handler');
    }
  }

  /**
   * Unregister all handlers for a system
   */
  unregisterSystem(systemName: string): void {
    for (const [messageType, handlers] of this.handlers) {
      const filtered = handlers.filter(h => h.systemName !== systemName);
      if (filtered.length > 0) {
        this.handlers.set(messageType, filtered);
      } else {
        this.handlers.delete(messageType);
      }
    }
  }

  /**
   * Check rate limit for a request
   */
  private async checkRateLimit(
    ctx: MessageContext,
    rateLimit: RateLimitType | undefined
  ): Promise<RateLimitResult> {
    if (!rateLimit || rateLimit === 'none') {
      return { allowed: true };
    }

    const key = rateLimit === 'auth' ? ctx.clientIp : String(ctx.entityId);

    switch (rateLimit) {
      case 'auth':
        return checkAuthLimit(key);
      case 'chat':
        return checkChatLimit(key);
      case 'combat':
        return checkCombatLimit(key);
      case 'shop':
        return checkShopLimit(key);
      default:
        return { allowed: true };
    }
  }

  /**
   * Dispatch a message to all registered handlers
   * Returns true if any handler processed the message
   */
  async dispatch(ctx: MessageContext, message: unknown[]): Promise<boolean> {
    const messageType = parseInt(String(message[0]));
    const handlers = this.handlers.get(messageType);

    if (!handlers || handlers.length === 0) {
      return false;
    }

    let handled = false;

    for (const { handler, options, systemName } of handlers) {
      // Check game entry requirement
      const requiresGame = options.requiresGame !== false;
      if (requiresGame && !ctx.hasEnteredGame) {
        continue;
      }

      // Check rate limit
      if (options.rateLimit) {
        const result = await this.checkRateLimit(ctx, options.rateLimit);
        if (!result.allowed) {
          log.warn(
            {
              entityId: ctx.entityId,
              messageType,
              systemName,
              rateLimit: options.rateLimit,
              retryAfter: result.retryAfter
            },
            'Rate limit exceeded'
          );
          continue;
        }
      }

      try {
        if (this.debug) {
          log.debug({ messageType, systemName }, 'Dispatching message');
        }

        const result = handler(ctx, message);
        if (result instanceof Promise) {
          await result;
        }
        handled = true;
      } catch (error) {
        log.error({ error, messageType, systemName }, 'Handler error');
      }
    }

    return handled;
  }

  /**
   * Check if any handler is registered for a message type
   */
  hasHandler(messageType: number): boolean {
    const handlers = this.handlers.get(messageType);
    return handlers !== undefined && handlers.length > 0;
  }

  /**
   * Get all registered message types
   */
  getRegisteredTypes(): number[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler count for a message type
   */
  getHandlerCount(messageType: number): number {
    const handlers = this.handlers.get(messageType);
    return handlers?.length ?? 0;
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Enable/disable debug mode
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }
}

// Singleton instance
let dispatcher: MessageDispatcher | null = null;

export function getMessageDispatcher(): MessageDispatcher {
  if (!dispatcher) {
    dispatcher = new MessageDispatcher({
      debug: process.env.DEBUG_MESSAGES === 'true'
    });
  }
  return dispatcher;
}

export function resetMessageDispatcher(): void {
  if (dispatcher) {
    dispatcher.clear();
  }
  dispatcher = null;
}
