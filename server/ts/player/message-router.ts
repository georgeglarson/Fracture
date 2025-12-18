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

const log = createModuleLogger('MessageRouter');

/**
 * Interface for a message handler context
 * Provides access to player state and dependencies
 */
export interface MessageHandlerContext {
  // Player identity
  id: number;
  name: string;
  kind: number;
  clientIp: string; // For rate limiting

  // Player state
  hasEnteredGame: boolean;
  isDead: boolean;
  hitPoints: number;
  maxHitPoints: number;
  x: number;
  y: number;
  orientation: number;

  // Progression
  level: number;
  xp: number;
  gold: number;

  // Equipment (kind numbers)
  weapon: number;
  armor: number;
  weaponLevel: number;
  armorLevel: number;

  // Checkpoints
  lastCheckpoint: { id: number; x: number; y: number } | null;

  // World reference
  world: any; // World type - using any to avoid circular deps

  // Communication
  send(message: any): void;
  broadcast(message: any, ignoreSelf?: boolean): void;
  broadcastToZone(message: any, ignoreSelf?: boolean): void;

  // State modification
  setPosition(x: number, y: number): void;
  clearTarget(): void;
  setTarget(target: any): void;
  resetHitPoints(hp: number): void;
  regenHealthBy(amount: number): void;
  hasFullHealth(): boolean;
  health(): any;
  updateHitPoints(): void;

  // Equipment
  equipArmor(kind: number): void;
  equipWeapon(kind: number): void;
  equipItem(item: any): void;
  equip(kind: number): any;

  // Progression
  grantXP(amount: number): void;
  grantGold(amount: number): void;
  setGold(gold: number): void;

  // Zone
  checkZoneChange(x: number, y: number): void;

  // Position update (broadcasts to zone)
  updatePosition(): void;

  // Inventory initialization (sends to client)
  sendInventoryInit(): void;

  // Callbacks
  zone_callback?: () => void;
  move_callback?: (x: number, y: number) => void;
  lootmove_callback?: (x: number, y: number) => void;
  message_callback?: (message: any[]) => void;

  // AI Handlers
  handleNpcTalk(npcKind: number): Promise<void>;
  handleRequestQuest(npcKind: number): Promise<void>;
  handleNewsRequest(): Promise<void>;
  triggerNarration(event: string, details?: Record<string, any>): Promise<void>;

  // Daily reward
  handleDailyCheck(lastLoginDate: string | null, currentStreak: number): void;

  // Shop handlers
  handleShopBuy(npcKind: number, itemKind: number): void;
  handleShopSell(slotIndex: number): void;

  // Equipment drop
  handleDropItem(itemType: string): void;

  // Achievement
  handleSelectTitle(achievementId: string | null): void;
  initAchievements(savedData?: any): void;

  // Party handlers
  handlePartyInvite(targetId: number): void;
  handlePartyAccept(inviterId: number): void;
  handlePartyDecline(inviterId: number): void;
  handlePartyLeave(): void;
  handlePartyKick(targetId: number): void;
  handlePartyChat(message: string): void;

  // Player inspect
  handlePlayerInspect(targetId: number): void;

  // Inventory handlers
  handleInventoryUse(slotIndex: number): void;
  handleInventoryEquip(slotIndex: number): void;
  handleInventoryDrop(slotIndex: number): void;
  handleInventorySwap(fromSlot: number, toSlot: number): void;
  handleInventoryPickup(itemId: number): void;
  handleUnequipToInventory(slot: string): void;

  // Boss leaderboard
  handleLeaderboardRequest(): void;

  // Storage persistence
  characterId: string | null;
  loadFromStorage(storage: any): boolean;
  saveToStorage(storage: any): void;

  // Timeouts
  firepotionTimeout: NodeJS.Timeout | null;
}

/**
 * Message handler function type
 */
export type MessageHandler = (ctx: MessageHandlerContext, message: any[]) => void | Promise<void>;

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
    rateLimit: 'auth', // 5 attempts per minute per IP
    handler: async (ctx, msg) => {
      const name = Utils.sanitize(msg[1]);
      const password = msg[5] || ''; // Password is now at index 5
      ctx.name = (name === '') ? 'lorem ipsum' : name.substr(0, 15);
      ctx.kind = Types.Entities.WARRIOR;

      const storage = ctx.world.getStorageService();
      const characterExists = storage.characterExists(ctx.name);

      if (characterExists) {
        // Existing character - verify password
        if (!storage.verifyPassword(ctx.name, password)) {
          console.log(`[Auth] Wrong password for: ${ctx.name}`);
          ctx.send([Types.Messages.AUTH_FAIL, 'wrong_password']);
          return; // Don't proceed - client should disconnect
        }

        // Password correct - load character
        const loaded = ctx.loadFromStorage(storage);
        if (loaded) {
          console.log(`[Storage] Loaded returning player: ${ctx.name}`);
        }
      } else {
        // New character - password is required
        if (!password || password.length < 3) {
          console.log(`[Auth] Password too short for new character: ${ctx.name}`);
          ctx.send([Types.Messages.AUTH_FAIL, 'password_required']);
          return;
        }

        // Create new character with password
        const newChar = storage.createCharacter(ctx.name, password);
        ctx.characterId = newChar.id;

        // Apply client-provided starting equipment
        ctx.equipArmor(msg[2]);
        ctx.equipWeapon(msg[3]);
        ctx.setGold(msg[4] || 0);
        console.log(`[Storage] Created new character: ${ctx.name} (${ctx.characterId})`);
      }

      ctx.orientation = Utils.randomOrientation();
      ctx.updateHitPoints();
      ctx.updatePosition();

      ctx.world.addPlayer(ctx);
      ctx.world.enter_callback(ctx);

      // Get player's XP to next level (using Formulas)
      const xpToNext = Formulas.xpToNextLevel(ctx.level || 1);

      // Send expanded WELCOME with full player state
      // [WELCOME, id, name, x, y, hp, level, xp, xpToNext, gold]
      ctx.send([
        Types.Messages.WELCOME,
        ctx.id,
        ctx.name,
        ctx.x,
        ctx.y,
        ctx.hitPoints,
        ctx.level || 1,
        ctx.xp || 0,
        xpToNext,
        ctx.gold || 0
      ]);
      ctx.hasEnteredGame = true;
      ctx.isDead = false;

      ctx.initAchievements();
      await ctx.triggerNarration('join');

      // Send inventory state to client
      ctx.sendInventoryInit();

      // Send current equipment to client (so UI can display it)
      if (ctx.weapon) {
        ctx.send([Types.Messages.EQUIP, ctx.id, ctx.weapon]);
      }
      if (ctx.armor) {
        ctx.send([Types.Messages.EQUIP, ctx.id, ctx.armor]);
      }
    },
    requiresGame: false
  });

  // WHO - Entity info request
  handlers.set(Types.Messages.WHO, {
    handler: (ctx, msg) => {
      msg.shift();
      ctx.world.pushSpawnsToPlayer(ctx, msg);
    }
  });

  // ZONE - Zone transition
  handlers.set(Types.Messages.ZONE, {
    handler: (ctx) => {
      if (ctx.zone_callback) {
        ctx.zone_callback();
      }
    }
  });

  // CHAT - Chat message
  handlers.set(Types.Messages.CHAT, {
    rateLimit: 'chat', // 5 messages per 10 seconds
    handler: (ctx, msg) => {
      let chatMsg = Utils.sanitize(msg[1]);
      if (chatMsg && chatMsg !== '') {
        chatMsg = chatMsg.substr(0, 60);
        ctx.broadcastToZone(new Messages.Chat(ctx, chatMsg), false);
      }
    }
  });

  // MOVE - Player movement
  handlers.set(Types.Messages.MOVE, {
    handler: (ctx, msg) => {
      if (ctx.move_callback) {
        const x = msg[1];
        const y = msg[2];

        if (ctx.world.isValidPosition(x, y)) {
          ctx.setPosition(x, y);
          ctx.clearTarget();
          ctx.broadcast(new Messages.Move(ctx));
          ctx.move_callback(ctx.x, ctx.y);
          ctx.checkZoneChange(x, y);
        }
      }
    }
  });

  // LOOTMOVE - Move to loot
  handlers.set(Types.Messages.LOOTMOVE, {
    handler: (ctx, msg) => {
      if (ctx.lootmove_callback) {
        ctx.setPosition(msg[1], msg[2]);

        const item = ctx.world.getEntityById(msg[3]);
        if (item) {
          ctx.clearTarget();
          ctx.broadcast(new Messages.LootMove(ctx, item));
          ctx.lootmove_callback(ctx.x, ctx.y);
        }
      }
    }
  });

  // AGGRO - Mob aggro
  handlers.set(Types.Messages.AGGRO, {
    handler: (ctx, msg) => {
      if (ctx.move_callback) {
        ctx.world.handleMobHate(msg[1], ctx.id, 5);
      }
    }
  });

  // ATTACK - Target attack
  handlers.set(Types.Messages.ATTACK, {
    handler: (ctx, msg) => {
      const mob = ctx.world.getEntityById(msg[1]);
      if (mob) {
        ctx.setTarget(mob);
        ctx.world.broadcastAttacker(ctx);
      }
    }
  });

  // HIT - Deal damage to mob
  handlers.set(Types.Messages.HIT, {
    rateLimit: 'combat', // 20 hits per second
    handler: (ctx, msg) => {
      const mob = ctx.world.getEntityById(msg[1]);
      // Check mob exists and is not already dead (prevents hitting during death animation)
      if (mob && !mob.isDead) {
        const dmg = Formulas.dmg(ctx.weaponLevel, mob.armorLevel);
        if (dmg > 0) {
          mob.receiveDamage(dmg, ctx.id);
          ctx.world.handleMobHate(mob.id, ctx.id, dmg);
          ctx.world.handleHurtEntity(mob, ctx, dmg);
        }
      }
    }
  });

  // HURT - Receive damage from mob
  handlers.set(Types.Messages.HURT, {
    handler: (ctx, msg) => {
      const mob = ctx.world.getEntityById(msg[1]);
      // Check mob exists, is alive (isDead flag + hitPoints > 0), and player is alive
      // Double-check (hitPoints > 0) prevents damage from mobs in death animation
      if (mob && !mob.isDead && mob.hitPoints > 0 && ctx.hitPoints > 0) {
        ctx.hitPoints -= Formulas.dmg(mob.weaponLevel, ctx.armorLevel);
        ctx.world.handleHurtEntity(ctx);

        if (ctx.hitPoints <= 0) {
          ctx.isDead = true;
          if (ctx.firepotionTimeout) {
            clearTimeout(ctx.firepotionTimeout);
          }
        }
      }
    }
  });

  // LOOT - Pick up item
  handlers.set(Types.Messages.LOOT, {
    handler: (ctx, msg) => {
      const item = ctx.world.getEntityById(msg[1]);

      if (item) {
        const kind = item.kind;

        if (Types.isItem(kind)) {
          // Equipment goes to inventory instead of auto-equipping
          if (Types.isArmor(kind) || Types.isWeapon(kind)) {
            ctx.handleInventoryPickup(item.id);
            return;
          }

          // Consumables are used immediately (original behavior)
          ctx.broadcast(item.despawn());
          ctx.world.removeEntity(item);

          if (kind === Types.Entities.FIREPOTION) {
            ctx.updateHitPoints();
            ctx.broadcast(ctx.equip(Types.Entities.FIREFOX));
            ctx.firepotionTimeout = setTimeout(() => {
              ctx.broadcast(ctx.equip(ctx.armor));
              ctx.firepotionTimeout = null;
            }, 15000);
            ctx.send(new Messages.HitPoints(ctx.maxHitPoints).serialize());
          } else if (Types.isHealingItem(kind)) {
            let amount = 0;
            switch (kind) {
              case Types.Entities.FLASK:
                amount = 40;
                break;
              case Types.Entities.BURGER:
                amount = 100;
                break;
            }

            if (!ctx.hasFullHealth()) {
              ctx.regenHealthBy(amount);
              ctx.world.pushToPlayer(ctx, ctx.health());
            }
          }
        }
      }
    }
  });

  // TELEPORT - Teleport player
  handlers.set(Types.Messages.TELEPORT, {
    handler: (ctx, msg) => {
      const x = msg[1];
      const y = msg[2];

      if (ctx.world.isValidPosition(x, y)) {
        ctx.setPosition(x, y);
        ctx.clearTarget();
        ctx.broadcast(new Messages.Teleport(ctx));
        ctx.world.handlePlayerVanish(ctx);
        ctx.world.pushRelevantEntityListTo(ctx);
      }
    }
  });

  // OPEN - Open chest
  handlers.set(Types.Messages.OPEN, {
    handler: (ctx, msg) => {
      const chest = ctx.world.getEntityById(msg[1]);
      if (chest && chest instanceof Chest) {
        ctx.world.handleOpenedChest(chest, ctx);
      }
    }
  });

  // CHECK - Checkpoint
  handlers.set(Types.Messages.CHECK, {
    handler: (ctx, msg) => {
      const checkpoint = ctx.world.map.getCheckpoint(msg[1]);
      if (checkpoint) {
        ctx.lastCheckpoint = checkpoint;
      }
    }
  });

  // NPCTALK - NPC dialogue
  handlers.set(Types.Messages.NPCTALK, {
    handler: async (ctx, msg) => {
      await ctx.handleNpcTalk(msg[1]);
    }
  });

  // REQUEST_QUEST - Quest request
  handlers.set(Types.Messages.REQUEST_QUEST, {
    handler: async (ctx, msg) => {
      await ctx.handleRequestQuest(msg[1]);
    }
  });

  // NEWS_REQUEST - Newspaper request
  handlers.set(Types.Messages.NEWS_REQUEST, {
    handler: async (ctx) => {
      await ctx.handleNewsRequest();
    }
  });

  // DROP_ITEM - Drop equipped item
  handlers.set(Types.Messages.DROP_ITEM, {
    handler: (ctx, msg) => {
      ctx.handleDropItem(msg[1]);
    }
  });

  // DAILY_CHECK - Daily reward check
  handlers.set(Types.Messages.DAILY_CHECK, {
    handler: (ctx, msg) => {
      const lastLoginDate = msg[1] || null;
      const currentStreak = msg[2] || 0;
      ctx.handleDailyCheck(lastLoginDate === '' ? null : lastLoginDate, currentStreak);
    }
  });

  // SHOP_BUY - Shop purchase
  handlers.set(Types.Messages.SHOP_BUY, {
    rateLimit: 'shop', // 10 transactions per minute
    handler: (ctx, msg) => {
      ctx.handleShopBuy(msg[1], msg[2]);
    }
  });

  // SHOP_SELL - Shop sell
  handlers.set(Types.Messages.SHOP_SELL, {
    handler: (ctx, msg) => {
      ctx.handleShopSell(msg[1]);
    }
  });

  // ACHIEVEMENT_SELECT_TITLE - Select title
  handlers.set(Types.Messages.ACHIEVEMENT_SELECT_TITLE, {
    handler: (ctx, msg) => {
      ctx.handleSelectTitle(msg[1] === '' ? null : msg[1]);
    }
  });

  // Party system messages
  handlers.set(Types.Messages.PARTY_INVITE, {
    handler: (ctx, msg) => {
      ctx.handlePartyInvite(msg[1]);
    }
  });

  handlers.set(Types.Messages.PARTY_ACCEPT, {
    handler: (ctx, msg) => {
      ctx.handlePartyAccept(msg[1]);
    }
  });

  handlers.set(Types.Messages.PARTY_DECLINE, {
    handler: (ctx, msg) => {
      ctx.handlePartyDecline(msg[1]);
    }
  });

  handlers.set(Types.Messages.PARTY_LEAVE, {
    handler: (ctx) => {
      ctx.handlePartyLeave();
    }
  });

  handlers.set(Types.Messages.PARTY_KICK, {
    handler: (ctx, msg) => {
      ctx.handlePartyKick(msg[1]);
    }
  });

  handlers.set(Types.Messages.PARTY_CHAT, {
    handler: (ctx, msg) => {
      let chatMsg = Utils.sanitize(msg[1]);
      if (chatMsg && chatMsg !== '') {
        chatMsg = chatMsg.substr(0, 100);
        ctx.handlePartyChat(chatMsg);
      }
    }
  });

  // Player inspect
  handlers.set(Types.Messages.PLAYER_INSPECT, {
    handler: (ctx, msg) => {
      ctx.handlePlayerInspect(msg[1]);
    }
  });

  // Inventory system messages
  handlers.set(Types.Messages.INVENTORY_USE, {
    handler: (ctx, msg) => {
      ctx.handleInventoryUse(msg[1]);
    }
  });

  handlers.set(Types.Messages.INVENTORY_EQUIP, {
    handler: (ctx, msg) => {
      ctx.handleInventoryEquip(msg[1]);
    }
  });

  handlers.set(Types.Messages.INVENTORY_DROP, {
    handler: (ctx, msg) => {
      ctx.handleInventoryDrop(msg[1]);
    }
  });

  handlers.set(Types.Messages.INVENTORY_SWAP, {
    handler: (ctx, msg) => {
      ctx.handleInventorySwap(msg[1], msg[2]);
    }
  });

  handlers.set(Types.Messages.INVENTORY_PICKUP, {
    handler: (ctx, msg) => {
      ctx.handleInventoryPickup(msg[1]);
    }
  });

  handlers.set(Types.Messages.UNEQUIP_TO_INVENTORY, {
    handler: (ctx, msg) => {
      ctx.handleUnequipToInventory(msg[1]);
    }
  });

  // Boss Leaderboard
  handlers.set(Types.Messages.LEADERBOARD_REQUEST, {
    handler: (ctx, msg) => {
      ctx.handleLeaderboardRequest();
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
    ctx: MessageHandlerContext,
    rateLimit: RateLimitType | undefined
  ): Promise<RateLimitResult> {
    if (!rateLimit || rateLimit === 'none') {
      return { allowed: true };
    }

    // Use IP for auth (pre-login), player ID for everything else
    const key = rateLimit === 'auth' ? ctx.clientIp : String(ctx.id);

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
  async route(ctx: MessageHandlerContext, message: any[]): Promise<boolean> {
    const action = parseInt(message[0]);
    const config = this.handlers.get(action);

    if (!config) {
      return false;
    }

    // Check game entry requirement (default true)
    const requiresGame = config.requiresGame !== false;
    if (requiresGame && !ctx.hasEnteredGame) {
      return false;
    }

    // Check rate limit
    if (config.rateLimit) {
      const rateLimitResult = await this.checkRateLimit(ctx, config.rateLimit);
      if (!rateLimitResult.allowed) {
        log.warn(
          { playerId: ctx.id, action, rateLimit: config.rateLimit, retryAfter: rateLimitResult.retryAfter },
          'Rate limit exceeded'
        );
        // Silently drop rate-limited messages
        return true; // Return true to indicate message was "handled" (rejected)
      }
    }

    // Execute handler
    const result = config.handler(ctx, message);
    if (result instanceof Promise) {
      await result;
    }

    return true;
  }

  /**
   * Check if a message type has a registered handler
   */
  hasHandler(messageType: number): boolean {
    return this.handlers.has(messageType);
  }
}
