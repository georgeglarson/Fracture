/**
 * Player Message Router - Single Responsibility: Route network messages to handlers
 *
 * This module decouples message routing from the Player class,
 * making message handling declarative and testable.
 */

import {Types} from '../../../shared/ts/gametypes';
import {
  checkAuthLimit,
  checkChatLimit,
  checkCombatLimit,
  checkShopLimit,
  RateLimitResult
} from '../middleware/rate-limiter.js';
import { createModuleLogger } from '../utils/logger.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import * as VeniceHandler from './venice.handler';
import * as PartyHandler from './party.handler';
import * as InventoryHandler from './inventory.handler';
import { persistInventory } from './inventory.handler';
import * as AchievementHandler from './achievement.handler';
import * as ShopHandler from './shop.handler';
import * as EquipmentHandler from './equipment.handler';
import * as SkillHandler from './skill.handler';
import * as AuthHandler from './auth.handler';
import * as CombatHandler from './combat.handler';
import * as LootHandler from './loot.handler';
import type { Player } from '../player'; // Type-only import — no circular runtime dependency

const log = createModuleLogger('MessageRouter');

/** Maximum tiles a player can move in one MOVE message (prevents speed hacks) */
const MAX_MOVE_DISTANCE = 3;

/**
 * Message handler function type
 */
export type MessageHandler = (player: Player, message: any[]) => void | Promise<void>;

/**
 * Rate limit type for a handler
 */
type RateLimitType = 'auth' | 'chat' | 'combat' | 'shop' | 'none';

/**
 * Message handler configuration
 */
interface HandlerConfig {
  handler: MessageHandler;
  requiresGame?: boolean; // Must have entered game (default: true)
  requiresAlive?: boolean; // Must not be dead (default: false)
  rateLimit?: RateLimitType; // Rate limit to apply (default: 'none')
}

/**
 * Creates the message handler registry
 * Maps message types to their handlers
 */
export function createMessageHandlers(
  Messages: any,
  Formulas: any,
  Utils: any,
  Chest: any
): Map<number, HandlerConfig> {
  const handlers = new Map<number, HandlerConfig>();

  // HELLO - Initial handshake (special case, allowed before game entry)
  handlers.set(Types.Messages.HELLO, {
    rateLimit: 'auth',
    handler: async (player, msg) => AuthHandler.handleHello(player, msg, Utils, Formulas),
    requiresGame: false
  });

  // WHO - Entity info request
  handlers.set(Types.Messages.WHO, {
    handler: (player, msg) => {
      const entityIds = msg.slice(1);
      player.getWorld().pushSpawnsToPlayer(player, entityIds);
    }
  });

  // ZONE - Zone transition
  handlers.set(Types.Messages.ZONE, {
    handler: (player) => {
      if (player.zoneCallback) {
        player.zoneCallback();
      }
    }
  });

  // CHAT - Chat message
  handlers.set(Types.Messages.CHAT, {
    rateLimit: 'chat',
    handler: (player, msg) => {
      let chatMsg = Utils.sanitize(msg[1]);
      if (chatMsg && chatMsg !== '') {
        chatMsg = chatMsg.substr(0, 60);
        player.broadcastToZone(new Messages.Chat(player, chatMsg), false);
      }
    }
  });

  // MOVE - Player movement
  handlers.set(Types.Messages.MOVE, {
    handler: (player, msg) => {
      if (player.moveCallback) {
        const x = msg[1];
        const y = msg[2];

        if (player.getWorld().isValidPosition(x, y)) {
          const moveDx = Math.abs(x - player.x);
          const moveDy = Math.abs(y - player.y);
          const moveDistance = Math.max(moveDx, moveDy);
          if (moveDistance > MAX_MOVE_DISTANCE) {
            log.warn({ playerName: player.name, from: { x: player.x, y: player.y }, to: { x, y }, distance: moveDistance }, 'MOVE rejected: distance exceeds max');
            return;
          }
          player.setPosition(x, y);
          player.clearTarget();
          player.broadcast(new Messages.Move(player));
          player.moveCallback(player.x, player.y);
          player.checkZoneChange(x, y);
        }
      }
    }
  });

  // LOOTMOVE - Move to loot
  handlers.set(Types.Messages.LOOTMOVE, {
    requiresAlive: true,
    handler: (player, msg) => {
      if (player.lootmoveCallback) {
        const x = msg[1], y = msg[2];
        if (!player.getWorld().isValidPosition(x, y)) return;
        player.setPosition(x, y);

        const item = player.getWorld().getEntityById(msg[3]);
        if (item) {
          player.clearTarget();
          player.broadcast(new Messages.LootMove(player, item));
          player.lootmoveCallback(player.x, player.y);
        }
      }
    }
  });

  // AGGRO - Mob aggro
  handlers.set(Types.Messages.AGGRO, {
    handler: (player, msg) => {
      if (player.moveCallback) {
        const mobId = parseInt(msg[1]);
        if (!isNaN(mobId)) {
          player.getWorld().handleMobHate(mobId, player.id, 5);
        }
      }
    }
  });

  // ATTACK - Target attack
  handlers.set(Types.Messages.ATTACK, {
    handler: (player, msg) => CombatHandler.handleAttack(player, msg)
  });

  // HIT - Deal damage to mob
  handlers.set(Types.Messages.HIT, {
    rateLimit: 'combat',
    handler: (player, msg) => CombatHandler.handleHit(player, msg)
  });

  // HURT - Receive damage from mob
  handlers.set(Types.Messages.HURT, {
    handler: (player, msg) => CombatHandler.handleHurt(player, msg)
  });

  // LOOT - Pick up item
  handlers.set(Types.Messages.LOOT, {
    requiresAlive: true,
    handler: (player, msg) => LootHandler.handleLoot(player, msg)
  });

  // TELEPORT - Teleport player
  handlers.set(Types.Messages.TELEPORT, {
    requiresAlive: true,
    handler: (player, msg) => {
      const x = msg[1];
      const y = msg[2];
      const world = player.getWorld();

      if (world.isValidPosition(x, y)) {
        player.spawnProtectionUntil = 0;
        player.setPosition(x, y);
        player.clearTarget();
        player.broadcast(new Messages.Teleport(player));
        world.handlePlayerVanish(player);
        world.pushRelevantEntityListTo(player);
      }
    }
  });

  // OPEN - Open chest
  handlers.set(Types.Messages.OPEN, {
    handler: (player, msg) => {
      const world = player.getWorld();
      const chest = world.getEntityById(msg[1]);
      if (chest && chest instanceof Chest) {
        world.handleOpenedChest(chest, player);
      }
    }
  });

  // CHECK - Checkpoint
  handlers.set(Types.Messages.CHECK, {
    handler: (player, msg) => {
      const checkpoint = player.getWorld().map?.getCheckpoint(msg[1]);
      if (checkpoint) {
        player.lastCheckpoint = checkpoint;
      }
    }
  });

  // NPCTALK - NPC dialogue
  handlers.set(Types.Messages.NPCTALK, {
    requiresAlive: true,
    handler: async (player, msg) => {
      await VeniceHandler.handleNpcTalk(player, msg[1]);
    }
  });

  // REQUEST_QUEST - Quest request
  handlers.set(Types.Messages.REQUEST_QUEST, {
    requiresAlive: true,
    handler: async (player, msg) => {
      await VeniceHandler.handleRequestQuest(player, msg[1]);
    }
  });

  // NEWS_REQUEST - Newspaper request
  handlers.set(Types.Messages.NEWS_REQUEST, {
    handler: async (player) => {
      await VeniceHandler.handleNewsRequest(player);
    }
  });

  // DROP_ITEM - Drop equipped item
  handlers.set(Types.Messages.DROP_ITEM, {
    handler: (player, msg) => {
      EquipmentHandler.handleDropItem(player, msg[1]);
    }
  });

  // DAILY_CHECK - Daily reward check
  handlers.set(Types.Messages.DAILY_CHECK, {
    handler: (player, msg) => {
      const lastLoginDate = typeof msg[1] === 'string' && msg[1] !== '' ? msg[1] : null;
      const currentStreak = typeof msg[2] === 'number' ? Math.max(0, Math.floor(msg[2])) : 0;
      player.handleDailyCheck(lastLoginDate, currentStreak);
    }
  });

  // SHOP_BUY - Shop purchase
  handlers.set(Types.Messages.SHOP_BUY, {
    rateLimit: 'shop',
    handler: (player, msg) => {
      ShopHandler.handleShopBuy(player, msg[1], msg[2]);
    }
  });

  // SHOP_SELL - Shop sell
  handlers.set(Types.Messages.SHOP_SELL, {
    handler: (player, msg) => {
      ShopHandler.handleShopSell(player, msg[1]);
    }
  });

  // ACHIEVEMENT_SELECT_TITLE - Select title
  handlers.set(Types.Messages.ACHIEVEMENT_SELECT_TITLE, {
    handler: (player, msg) => {
      AchievementHandler.handleSelectTitle(player, msg[1] === '' ? null : msg[1]);
    }
  });

  // Party system messages
  handlers.set(Types.Messages.PARTY_INVITE, {
    handler: (player, msg) => {
      PartyHandler.handlePartyInvite(player, msg[1]);
    }
  });

  handlers.set(Types.Messages.PARTY_ACCEPT, {
    handler: (player, msg) => {
      PartyHandler.handlePartyAccept(player, msg[1]);
    }
  });

  handlers.set(Types.Messages.PARTY_DECLINE, {
    handler: (player, msg) => {
      PartyHandler.handlePartyDecline(player, msg[1]);
    }
  });

  handlers.set(Types.Messages.PARTY_LEAVE, {
    handler: (player) => {
      PartyHandler.handlePartyLeave(player);
    }
  });

  handlers.set(Types.Messages.PARTY_KICK, {
    handler: (player, msg) => {
      PartyHandler.handlePartyKick(player, msg[1]);
    }
  });

  handlers.set(Types.Messages.PARTY_CHAT, {
    handler: (player, msg) => {
      let chatMsg = Utils.sanitize(msg[1]);
      if (chatMsg && chatMsg !== '') {
        chatMsg = chatMsg.substr(0, 100);
        PartyHandler.handlePartyChat(player, chatMsg);
      }
    }
  });

  // Player inspect
  handlers.set(Types.Messages.PLAYER_INSPECT, {
    handler: (player, msg) => {
      PartyHandler.handlePlayerInspect(player, msg[1]);
    }
  });

  // Inventory system messages
  handlers.set(Types.Messages.INVENTORY_USE, {
    requiresAlive: true,
    handler: (player, msg) => {
      InventoryHandler.handleInventoryUse(player, msg[1]);
      persistInventory(player);
    }
  });

  handlers.set(Types.Messages.INVENTORY_EQUIP, {
    requiresAlive: true,
    handler: (player, msg) => {
      InventoryHandler.handleInventoryEquip(player, msg[1]);
      persistInventory(player);
    }
  });

  handlers.set(Types.Messages.INVENTORY_DROP, {
    handler: (player, msg) => {
      InventoryHandler.handleInventoryDrop(player, msg[1]);
      persistInventory(player);
    }
  });

  handlers.set(Types.Messages.INVENTORY_SWAP, {
    handler: (player, msg) => {
      InventoryHandler.handleInventorySwap(player, msg[1], msg[2]);
      persistInventory(player);
    }
  });

  handlers.set(Types.Messages.INVENTORY_PICKUP, {
    requiresAlive: true,
    handler: (player, msg) => {
      InventoryHandler.handleInventoryPickup(player, msg[1]);
      persistInventory(player);
    }
  });

  handlers.set(Types.Messages.UNEQUIP_TO_INVENTORY, {
    handler: (player, msg) => {
      InventoryHandler.handleUnequipToInventory(player, msg[1]);
      persistInventory(player);
    }
  });

  // Boss Leaderboard
  handlers.set(Types.Messages.LEADERBOARD_REQUEST, {
    handler: (player) => {
      const leaderboard = player.getWorld().roamingBossManager?.getLeaderboard() || [];
      player.send(new Messages.LeaderboardResponse(leaderboard).serialize());
    }
  });

  // Skill Use
  handlers.set(Types.Messages.SKILL_USE, {
    rateLimit: 'combat',
    requiresAlive: true,
    handler: (player, msg) => {
      SkillHandler.handleSkillUse(player, msg[1]);
    }
  });

  // Ascension Request
  handlers.set(Types.Messages.ASCEND_REQUEST, {
    rateLimit: 'shop',
    requiresAlive: true,
    handler: (player) => {
      player.handleAscendRequest();
    }
  });

  // Fracture Rift: Enter
  handlers.set(Types.Messages.RIFT_ENTER, {
    rateLimit: 'shop',
    requiresAlive: true,
    handler: (player) => {
      player.handleRiftEnter();
    }
  });

  // Fracture Rift: Exit
  handlers.set(Types.Messages.RIFT_EXIT, {
    rateLimit: 'none',
    requiresAlive: false,
    handler: (player) => {
      player.handleRiftExit();
    }
  });

  // Fracture Rift: Leaderboard Request
  handlers.set(Types.Messages.RIFT_LEADERBOARD_REQ, {
    rateLimit: 'shop',
    requiresAlive: false,
    handler: (player) => {
      player.handleRiftLeaderboardRequest();
    }
  });

  return handlers;
}

/**
 * MessageRouter class - Routes messages to appropriate handlers
 */
export class MessageRouter {
  private handlers: Map<number, HandlerConfig>;

  constructor(
    Messages: any,
    Formulas: any,
    Utils: any,
    Chest: any
  ) {
    this.handlers = createMessageHandlers(Messages, Formulas, Utils, Chest);
  }

  /**
   * Check rate limit for a handler
   * @returns true if allowed, false if rate limited
   */
  private async checkRateLimit(
    player: Player,
    rateLimit: RateLimitType | undefined
  ): Promise<RateLimitResult> {
    if (!rateLimit || rateLimit === 'none') {
      return { allowed: true };
    }

    // Use IP for auth (pre-login), player ID for everything else
    const key = rateLimit === 'auth' ? player.clientIp : String(player.id);

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
   * Route a message to its handler
   * Returns true if handled, false if no handler found or rate limited
   */
  async route(player: Player, message: any[]): Promise<boolean> {
    const action = parseInt(message[0]);
    const config = this.handlers.get(action);

    if (!config) {
      return false;
    }

    // Check game entry requirement (default true)
    const requiresGame = config.requiresGame !== false;
    if (requiresGame && !player.hasEnteredGame) {
      return false;
    }

    // Check alive requirement
    if (config.requiresAlive && player.isDead) {
      return false;
    }

    // Check rate limit
    if (config.rateLimit) {
      const rateLimitResult = await this.checkRateLimit(player, config.rateLimit);
      if (!rateLimitResult.allowed) {
        log.warn(
          { playerId: player.id, action, rateLimit: config.rateLimit, retryAfter: rateLimitResult.retryAfter },
          'Rate limit exceeded'
        );
        // Silently drop rate-limited messages
        return true; // Return true to indicate message was "handled" (rejected)
      }
    }

    // Skip tracing for high-frequency messages (50/sec movement, aggro ticks)
    const SKIP_TRACE: Set<number> = new Set([Types.Messages.MOVE, Types.Messages.LOOTMOVE, Types.Messages.AGGRO]);
    const messageType = Types.getMessageTypeAsString(action) || String(action);

    if (SKIP_TRACE.has(action)) {
      // Execute without span for hot-path messages
      try {
        const result = config.handler(player, message);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        log.error(
          { playerId: player.id, action, messageType, error },
          'Handler error - message dropped'
        );
      }
      return true;
    }

    // Execute handler with OTel span
    const tracer = trace.getTracer('fracture-server');
    return tracer.startActiveSpan(`player.message.${messageType}`, async (span) => {
      span.setAttributes({
        'message.type': messageType,
        'player.name': player.name,
        'player.id': player.id,
      });

      try {
        const result = config.handler(player, message);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        log.error(
          { playerId: player.id, action, messageType, error },
          'Handler error - message dropped'
        );
      } finally {
        span.end();
      }

      return true;
    });
  }

  /**
   * Check if a message type has a registered handler
   */
  hasHandler(messageType: number): boolean {
    return this.handlers.has(messageType);
  }
}
