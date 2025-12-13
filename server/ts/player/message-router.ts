/**
 * Player Message Router - Single Responsibility: Route network messages to handlers
 *
 * This module decouples message routing from the Player class,
 * making message handling declarative and testable.
 */

import {Types} from '../../../shared/ts/gametypes';

/**
 * Interface for a message handler context
 * Provides access to player state and dependencies
 */
export interface MessageHandlerContext {
  // Player identity
  id: number;
  name: string;

  // Player state
  hasEnteredGame: boolean;
  isDead: boolean;
  hitPoints: number;
  maxHitPoints: number;
  x: number;
  y: number;

  // Equipment levels
  weaponLevel: number;
  armorLevel: number;
  armor: number;

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

  // Timeouts
  firepotionTimeout: NodeJS.Timeout | null;
}

/**
 * Message handler function type
 */
export type MessageHandler = (ctx: MessageHandlerContext, message: any[]) => void | Promise<void>;

/**
 * Message handler configuration
 */
interface HandlerConfig {
  handler: MessageHandler;
  requiresGame?: boolean; // Must have entered game (default: true)
  requiresAlive?: boolean; // Must not be dead (default: false)
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
    handler: (ctx, msg) => {
      const name = Utils.sanitize(msg[1]);
      (ctx as any).name = (name === '') ? 'lorem ipsum' : name.substr(0, 15);
      (ctx as any).kind = Types.Entities.WARRIOR;
      ctx.equipArmor(msg[2]);
      ctx.equipWeapon(msg[3]);
      ctx.setGold(msg[4] || 0);
      (ctx as any).orientation = Utils.randomOrientation();
      ctx.updateHitPoints();
      (ctx as any).updatePosition();

      ctx.world.addPlayer(ctx);
      ctx.world.enter_callback(ctx);

      ctx.send([Types.Messages.WELCOME, ctx.id, (ctx as any).name, ctx.x, ctx.y, ctx.hitPoints]);
      (ctx as any).hasEnteredGame = true;
      (ctx as any).isDead = false;

      ctx.initAchievements();
      ctx.triggerNarration('join');
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

  // HIT - Deal damage
  handlers.set(Types.Messages.HIT, {
    handler: (ctx, msg) => {
      const mob = ctx.world.getEntityById(msg[1]);
      if (mob) {
        const dmg = Formulas.dmg(ctx.weaponLevel, mob.armorLevel);
        if (dmg > 0) {
          mob.receiveDamage(dmg, ctx.id);
          ctx.world.handleMobHate(mob.id, ctx.id, dmg);
          ctx.world.handleHurtEntity(mob, ctx, dmg);
        }
      }
    }
  });

  // HURT - Receive damage
  handlers.set(Types.Messages.HURT, {
    handler: (ctx, msg) => {
      const mob = ctx.world.getEntityById(msg[1]);
      if (mob && ctx.hitPoints > 0) {
        (ctx as any).hitPoints -= Formulas.dmg(mob.weaponLevel, ctx.armorLevel);
        ctx.world.handleHurtEntity(ctx);

        if (ctx.hitPoints <= 0) {
          (ctx as any).isDead = true;
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
          ctx.broadcast(item.despawn());
          ctx.world.removeEntity(item);

          if (kind === Types.Entities.FIREPOTION) {
            ctx.updateHitPoints();
            ctx.broadcast(ctx.equip(Types.Entities.FIREFOX));
            (ctx as any).firepotionTimeout = setTimeout(() => {
              ctx.broadcast(ctx.equip(ctx.armor));
              (ctx as any).firepotionTimeout = null;
            }, 15000);
            ctx.send(new Messages.HitPoints((ctx as any).maxHitPoints).serialize());
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
          } else if (Types.isArmor(kind) || Types.isWeapon(kind)) {
            ctx.equipItem(item);
            ctx.broadcast(ctx.equip(kind));
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
        (ctx as any).lastCheckpoint = checkpoint;
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
   * Route a message to its handler
   * Returns true if handled, false if no handler found
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
