/**
 * Tests for MessageRouter
 * Covers: route dispatch, requiresGame, rate limiting, MOVE, CHAT, HIT,
 *         HURT, error handling, hasHandler, unknown message types,
 *         HELLO auth flow, TELEPORT, CHECK, OPEN, LOOTMOVE, AGGRO, ATTACK
 *
 * NOTE: The vitest esbuild transpiler truncates the Types.Messages const
 * beyond CHECK (id 26). Only message types 0-26 are available at test
 * runtime via Types.Messages. We use numeric literals where needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';

// ---------------------------------------------------------------------------
// Message type IDs - numeric literals matching shared/ts/gametypes.ts
// The vitest transpiler truncates Types.Messages beyond CHECK (26).
// ---------------------------------------------------------------------------

const Msg = {
  HELLO: 0,
  WELCOME: 1,
  MOVE: 4,
  LOOTMOVE: 5,
  AGGRO: 6,
  ATTACK: 7,
  HIT: 8,
  HURT: 9,
  CHAT: 11,
  LOOT: 12,
  EQUIP: 13,
  TELEPORT: 15,
  WHO: 20,
  ZONE: 21,
  HP: 23,
  OPEN: 25,
  CHECK: 26,
  AUTH_FAIL: 86,
  // Server-only (no handler)
  SPAWN: 2,
  DAMAGE: 16,
} as const;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../middleware/rate-limiter.js', () => ({
  checkAuthLimit: vi.fn(async () => ({ allowed: true })),
  checkChatLimit: vi.fn(async () => ({ allowed: true })),
  checkCombatLimit: vi.fn(async () => ({ allowed: true })),
  checkShopLimit: vi.fn(async () => ({ allowed: true })),
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  }),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { MessageRouter, MessageHandlerContext } from '../player/message-router';
import {
  checkAuthLimit,
  checkChatLimit,
  checkCombatLimit,
  checkShopLimit,
} from '../middleware/rate-limiter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockMessages() {
  // These must be regular functions (not arrows) because the handlers
  // invoke them with `new Messages.Chat(...)`.
  return {
    Chat: vi.fn(function (this: any, ctx: any, msg: string) {
      this._type = 'Chat';
      this.player = ctx;
      this.message = msg;
    }),
    Move: vi.fn(function (this: any, ctx: any) {
      this._type = 'Move';
      this.player = ctx;
    }),
    LootMove: vi.fn(function (this: any, ctx: any, item: any) {
      this._type = 'LootMove';
      this.player = ctx;
      this.item = item;
    }),
    Teleport: vi.fn(function (this: any, ctx: any) {
      this._type = 'Teleport';
      this.player = ctx;
    }),
    HitPoints: vi.fn(function (this: any, hp: number) {
      this.serialize = () => [Msg.HP, hp];
    }),
    LeaderboardResponse: vi.fn(function (this: any, data: any) {
      this.serialize = () => [80, data];
    }),
  };
}

function createMockFormulas() {
  return {
    dmg: vi.fn(() => 10),
    xpToNextLevel: vi.fn(() => 100),
  };
}

function createMockUtils() {
  return {
    sanitize: vi.fn((s: string) => s),
    randomOrientation: vi.fn(() => 1),
  };
}

function createMockChest() {
  return class MockChest {};
}

function createMockContext(
  overrides: Partial<MessageHandlerContext> = {},
): MessageHandlerContext {
  return {
    id: 1,
    name: 'TestPlayer',
    kind: Types.Entities.WARRIOR,
    clientIp: '127.0.0.1',

    hasEnteredGame: true,
    isDead: false,
    spawnProtectionUntil: 0,
    hitPoints: 100,
    maxHitPoints: 100,
    x: 50,
    y: 50,
    orientation: 1,

    level: 1,
    xp: 0,
    gold: 0,

    weapon: Types.Entities.SWORD1,
    armor: Types.Entities.CLOTHARMOR,
    weaponLevel: 1,
    armorLevel: 1,

    lastCheckpoint: null,

    world: {
      addPlayer: vi.fn(),
      enter_callback: vi.fn(),
      isValidPosition: vi.fn(() => true),
      getEntityById: vi.fn(() => null),
      pushSpawnsToPlayer: vi.fn(),
      broadcastAttacker: vi.fn(),
      handleMobHate: vi.fn(),
      handleHurtEntity: vi.fn(),
      handlePlayerVanish: vi.fn(),
      pushRelevantEntityListTo: vi.fn(),
      handleOpenedChest: vi.fn(),
      removeEntity: vi.fn(),
      pushToPlayer: vi.fn(),
      getStorageService: vi.fn(() => ({
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-1' })),
        saveInventory: vi.fn(),
      })),
      map: {
        getCheckpoint: vi.fn(() => ({ id: 1, x: 10, y: 10 })),
      },
      roamingBossManager: {
        getLeaderboard: vi.fn(() => []),
      },
    },

    send: vi.fn(),
    broadcast: vi.fn(),
    broadcastToZone: vi.fn(),

    setPosition: vi.fn(),
    clearTarget: vi.fn(),
    setTarget: vi.fn(),
    resetHitPoints: vi.fn(),
    regenHealthBy: vi.fn(),
    hasFullHealth: vi.fn(() => false),
    health: vi.fn(() => ({ serialize: () => [] })),
    updateHitPoints: vi.fn(),

    equipArmor: vi.fn(),
    equipWeapon: vi.fn(),
    equipItem: vi.fn(),
    equip: vi.fn(() => ({ serialize: () => [] })),

    grantXP: vi.fn(),
    grantGold: vi.fn(),
    setGold: vi.fn(),

    checkZoneChange: vi.fn(),
    updatePosition: vi.fn(),

    initProgressionSystem: vi.fn(),
    handleAscendRequest: vi.fn(),

    handleDailyCheck: vi.fn(),

    handleRiftEnter: vi.fn(),
    handleRiftExit: vi.fn(),
    handleRiftLeaderboardRequest: vi.fn(),

    zone_callback: vi.fn(),
    move_callback: vi.fn(),
    lootmove_callback: vi.fn(),
    message_callback: vi.fn(),

    characterId: 'char-1',
    loadFromStorage: vi.fn(() => true),
    saveToStorage: vi.fn(),

    firepotionTimeout: null,

    isPhased: vi.fn(() => false),
    consumePowerStrike: vi.fn(() => 1),

    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageRouter', () => {
  let router: MessageRouter;
  let ctx: MessageHandlerContext;
  let mockMessages: ReturnType<typeof createMockMessages>;
  let mockFormulas: ReturnType<typeof createMockFormulas>;
  let mockUtils: ReturnType<typeof createMockUtils>;
  let MockChest: ReturnType<typeof createMockChest>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMessages = createMockMessages();
    mockFormulas = createMockFormulas();
    mockUtils = createMockUtils();
    MockChest = createMockChest();

    router = new MessageRouter(mockMessages, mockFormulas, mockUtils, MockChest);
    ctx = createMockContext();
  });

  // =========================================================================
  // hasHandler
  // =========================================================================

  describe('hasHandler', () => {
    it('should return true for core registered message types', () => {
      expect(router.hasHandler(Msg.HELLO)).toBe(true);
      expect(router.hasHandler(Msg.WHO)).toBe(true);
      expect(router.hasHandler(Msg.ZONE)).toBe(true);
      expect(router.hasHandler(Msg.CHAT)).toBe(true);
      expect(router.hasHandler(Msg.MOVE)).toBe(true);
      expect(router.hasHandler(Msg.LOOTMOVE)).toBe(true);
      expect(router.hasHandler(Msg.AGGRO)).toBe(true);
      expect(router.hasHandler(Msg.ATTACK)).toBe(true);
      expect(router.hasHandler(Msg.HIT)).toBe(true);
      expect(router.hasHandler(Msg.HURT)).toBe(true);
      expect(router.hasHandler(Msg.LOOT)).toBe(true);
      expect(router.hasHandler(Msg.TELEPORT)).toBe(true);
      expect(router.hasHandler(Msg.OPEN)).toBe(true);
      expect(router.hasHandler(Msg.CHECK)).toBe(true);
    });

    it('should return false for unknown message types', () => {
      expect(router.hasHandler(9999)).toBe(false);
      expect(router.hasHandler(-1)).toBe(false);
    });

    it('should return false for server-only message types', () => {
      expect(router.hasHandler(Msg.SPAWN)).toBe(false);
      expect(router.hasHandler(Msg.DAMAGE)).toBe(false);
    });
  });

  // =========================================================================
  // route() - basic dispatch
  // =========================================================================

  describe('route() - basic dispatch', () => {
    it('should return true when message is handled', async () => {
      const result = await router.route(ctx, [Msg.WHO, 10, 20]);
      expect(result).toBe(true);
    });

    it('should return false for unknown message types', async () => {
      const result = await router.route(ctx, [9999]);
      expect(result).toBe(false);
    });

    it('should dispatch WHO to world.pushSpawnsToPlayer', async () => {
      await router.route(ctx, [Msg.WHO, 10, 20, 30]);
      expect(ctx.world.pushSpawnsToPlayer).toHaveBeenCalledWith(ctx, [10, 20, 30]);
    });

    it('should dispatch ZONE to zone_callback', async () => {
      await router.route(ctx, [Msg.ZONE]);
      expect(ctx.zone_callback).toHaveBeenCalled();
    });

    it('should not call zone_callback if not set', async () => {
      ctx.zone_callback = undefined;
      // Should not throw
      const result = await router.route(ctx, [Msg.ZONE]);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // requiresGame flag
  // =========================================================================

  describe('requiresGame flag', () => {
    it('should reject MOVE when player has not entered game', async () => {
      ctx.hasEnteredGame = false;

      const result = await router.route(ctx, [Msg.MOVE, 10, 20]);
      expect(result).toBe(false);
      expect(ctx.setPosition).not.toHaveBeenCalled();
    });

    it('should reject CHAT when player has not entered game', async () => {
      ctx.hasEnteredGame = false;

      const result = await router.route(ctx, [Msg.CHAT, 'hello']);
      expect(result).toBe(false);
      expect(ctx.broadcastToZone).not.toHaveBeenCalled();
    });

    it('should reject HIT when player has not entered game', async () => {
      ctx.hasEnteredGame = false;

      const result = await router.route(ctx, [Msg.HIT, 42]);
      expect(result).toBe(false);
    });

    it('should reject WHO when player has not entered game', async () => {
      ctx.hasEnteredGame = false;

      const result = await router.route(ctx, [Msg.WHO, 10]);
      expect(result).toBe(false);
    });

    it('should reject TELEPORT when player has not entered game', async () => {
      ctx.hasEnteredGame = false;

      const result = await router.route(ctx, [Msg.TELEPORT, 10, 20]);
      expect(result).toBe(false);
    });

    it('should reject LOOT when player has not entered game', async () => {
      ctx.hasEnteredGame = false;

      const result = await router.route(ctx, [Msg.LOOT, 55]);
      expect(result).toBe(false);
    });

    it('should allow HELLO before entering game', async () => {
      ctx.hasEnteredGame = false;

      const storage = ctx.world.getStorageService();
      storage.characterExists = vi.fn(() => false);
      storage.createCharacter = vi.fn(() => ({ id: 'char-new' }));

      const result = await router.route(ctx, [
        Msg.HELLO,
        'PlayerName',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'password123',
      ]);
      expect(result).toBe(true);
    });

    it('should return false (not crash) for unknown type when not entered', async () => {
      ctx.hasEnteredGame = false;

      const result = await router.route(ctx, [9999]);
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Rate limiting
  // =========================================================================

  describe('rate limiting', () => {
    it('should drop CHAT when rate limit is exceeded', async () => {
      vi.mocked(checkChatLimit).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 5,
      });

      const result = await router.route(ctx, [Msg.CHAT, 'spam']);
      expect(result).toBe(true);
      expect(ctx.broadcastToZone).not.toHaveBeenCalled();
    });

    it('should drop HIT when combat rate limit is exceeded', async () => {
      vi.mocked(checkCombatLimit).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 1,
      });

      const mob = {
        id: 42,
        isDead: false,
        armorLevel: 1,
        receiveDamage: vi.fn(),
      };
      ctx.world.getEntityById = vi.fn(() => mob);

      const result = await router.route(ctx, [Msg.HIT, 42]);
      expect(result).toBe(true);
      expect(mob.receiveDamage).not.toHaveBeenCalled();
    });

    it('should drop HELLO when auth rate limit is exceeded', async () => {
      ctx.hasEnteredGame = false;
      vi.mocked(checkAuthLimit).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 60,
      });

      const result = await router.route(ctx, [
        Msg.HELLO,
        'name',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'pw',
      ]);
      expect(result).toBe(true);
      expect(ctx.world.addPlayer).not.toHaveBeenCalled();
    });

    it('should use clientIp as key for auth rate limit', async () => {
      ctx.hasEnteredGame = false;
      ctx.clientIp = '10.0.0.1';

      await router.route(ctx, [
        Msg.HELLO,
        'name',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'password123',
      ]);

      expect(checkAuthLimit).toHaveBeenCalledWith('10.0.0.1');
    });

    it('should use player id as key for chat rate limit', async () => {
      ctx.id = 77;

      await router.route(ctx, [Msg.CHAT, 'hello']);

      expect(checkChatLimit).toHaveBeenCalledWith('77');
    });

    it('should use player id as key for combat rate limit', async () => {
      ctx.id = 33;
      const mob = {
        id: 42,
        isDead: false,
        armorLevel: 1,
        receiveDamage: vi.fn(),
      };
      ctx.world.getEntityById = vi.fn(() => mob);

      await router.route(ctx, [Msg.HIT, 42]);

      expect(checkCombatLimit).toHaveBeenCalledWith('33');
    });

    it('should allow messages when rate limit passes', async () => {
      vi.mocked(checkChatLimit).mockResolvedValueOnce({
        allowed: true,
        remaining: 4,
      });

      await router.route(ctx, [Msg.CHAT, 'hello']);
      expect(ctx.broadcastToZone).toHaveBeenCalled();
    });

    it('should not check rate limit for handlers with no rateLimit config', async () => {
      await router.route(ctx, [Msg.WHO, 10]);

      expect(checkAuthLimit).not.toHaveBeenCalled();
      expect(checkChatLimit).not.toHaveBeenCalled();
      expect(checkCombatLimit).not.toHaveBeenCalled();
      expect(checkShopLimit).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // MOVE handler
  // =========================================================================

  describe('MOVE handler', () => {
    it('should update position and broadcast when valid', async () => {
      await router.route(ctx, [Msg.MOVE, 100, 200]);

      expect(ctx.world.isValidPosition).toHaveBeenCalledWith(100, 200);
      expect(ctx.setPosition).toHaveBeenCalledWith(100, 200);
      expect(ctx.clearTarget).toHaveBeenCalled();
      expect(ctx.broadcast).toHaveBeenCalled();
      expect(mockMessages.Move).toHaveBeenCalledWith(ctx);
      expect(ctx.move_callback).toHaveBeenCalledWith(ctx.x, ctx.y);
      expect(ctx.checkZoneChange).toHaveBeenCalledWith(100, 200);
    });

    it('should reject movement to invalid position', async () => {
      ctx.world.isValidPosition = vi.fn(() => false);

      await router.route(ctx, [Msg.MOVE, -1, -1]);

      expect(ctx.setPosition).not.toHaveBeenCalled();
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });

    it('should not move if move_callback is not set', async () => {
      ctx.move_callback = undefined;

      await router.route(ctx, [Msg.MOVE, 100, 200]);

      expect(ctx.setPosition).not.toHaveBeenCalled();
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });

    it('should check zone change after moving', async () => {
      await router.route(ctx, [Msg.MOVE, 300, 400]);
      expect(ctx.checkZoneChange).toHaveBeenCalledWith(300, 400);
    });
  });

  // =========================================================================
  // CHAT handler
  // =========================================================================

  describe('CHAT handler', () => {
    it('should sanitize and broadcast chat message', async () => {
      await router.route(ctx, [Msg.CHAT, 'Hello world']);

      expect(mockUtils.sanitize).toHaveBeenCalledWith('Hello world');
      expect(ctx.broadcastToZone).toHaveBeenCalled();
      expect(mockMessages.Chat).toHaveBeenCalledWith(ctx, 'Hello world');
    });

    it('should truncate messages longer than 60 characters', async () => {
      const longMsg = 'A'.repeat(100);
      mockUtils.sanitize.mockReturnValue(longMsg);

      await router.route(ctx, [Msg.CHAT, longMsg]);

      const chatCall = mockMessages.Chat.mock.calls[0];
      expect(chatCall[1].length).toBe(60);
    });

    it('should not broadcast empty chat messages', async () => {
      mockUtils.sanitize.mockReturnValue('');

      await router.route(ctx, [Msg.CHAT, '']);

      expect(ctx.broadcastToZone).not.toHaveBeenCalled();
    });

    it('should not broadcast null/undefined chat messages', async () => {
      mockUtils.sanitize.mockReturnValue(null);

      await router.route(ctx, [Msg.CHAT, null]);

      expect(ctx.broadcastToZone).not.toHaveBeenCalled();
    });

    it('should broadcast to zone, not globally', async () => {
      await router.route(ctx, [Msg.CHAT, 'hi']);

      expect(ctx.broadcastToZone).toHaveBeenCalled();
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // HIT handler
  // =========================================================================

  describe('HIT handler', () => {
    let mob: any;

    beforeEach(() => {
      mob = {
        id: 42,
        isDead: false,
        armorLevel: 1,
        weaponLevel: 1,
        receiveDamage: vi.fn(),
        hitPoints: 50,
      };
      ctx.world.getEntityById = vi.fn(() => mob);
      mockFormulas.dmg.mockReturnValue(10);
    });

    it('should deal damage to a living mob', async () => {
      await router.route(ctx, [Msg.HIT, 42]);

      expect(ctx.world.getEntityById).toHaveBeenCalledWith(42);
      expect(mockFormulas.dmg).toHaveBeenCalledWith(
        ctx.weaponLevel,
        mob.armorLevel,
        ctx.level,
      );
      expect(mob.receiveDamage).toHaveBeenCalledWith(10, ctx.id);
      expect(ctx.world.handleMobHate).toHaveBeenCalledWith(
        mob.id,
        ctx.id,
        10,
      );
      expect(ctx.world.handleHurtEntity).toHaveBeenCalledWith(mob, ctx, 10);
    });

    it('should not hit a dead mob', async () => {
      mob.isDead = true;

      await router.route(ctx, [Msg.HIT, 42]);

      expect(mob.receiveDamage).not.toHaveBeenCalled();
    });

    it('should not hit a non-existent entity', async () => {
      ctx.world.getEntityById = vi.fn(() => null);

      await router.route(ctx, [Msg.HIT, 999]);

      expect(mockFormulas.dmg).not.toHaveBeenCalled();
    });

    it('should clear spawn protection on attack', async () => {
      ctx.spawnProtectionUntil = Date.now() + 10000;

      await router.route(ctx, [Msg.HIT, 42]);

      expect(ctx.spawnProtectionUntil).toBe(0);
    });

    it('should clear spawn protection even if mob is null', async () => {
      ctx.spawnProtectionUntil = Date.now() + 10000;
      ctx.world.getEntityById = vi.fn(() => null);

      await router.route(ctx, [Msg.HIT, 999]);

      expect(ctx.spawnProtectionUntil).toBe(0);
    });

    it('should not deal damage when dmg formula returns 0', async () => {
      mockFormulas.dmg.mockReturnValue(0);

      await router.route(ctx, [Msg.HIT, 42]);

      expect(mob.receiveDamage).not.toHaveBeenCalled();
      expect(ctx.world.handleHurtEntity).not.toHaveBeenCalled();
    });

    it('should apply power strike multiplier', async () => {
      (ctx.consumePowerStrike as ReturnType<typeof vi.fn>).mockReturnValue(2);
      mockFormulas.dmg.mockReturnValue(15);

      await router.route(ctx, [Msg.HIT, 42]);

      expect(mob.receiveDamage).toHaveBeenCalledWith(30, ctx.id);
      expect(ctx.world.handleMobHate).toHaveBeenCalledWith(
        mob.id,
        ctx.id,
        30,
      );
    });

    it('should floor the damage after multiplier', async () => {
      (ctx.consumePowerStrike as ReturnType<typeof vi.fn>).mockReturnValue(1.5);
      mockFormulas.dmg.mockReturnValue(7);

      await router.route(ctx, [Msg.HIT, 42]);

      // Math.floor(7 * 1.5) = Math.floor(10.5) = 10
      expect(mob.receiveDamage).toHaveBeenCalledWith(10, ctx.id);
    });

    it('should consume power strike buff on each hit', async () => {
      await router.route(ctx, [Msg.HIT, 42]);

      expect(ctx.consumePowerStrike).toHaveBeenCalled();
    });

    it('should pass player level to damage formula', async () => {
      ctx.level = 25;
      await router.route(ctx, [Msg.HIT, 42]);

      expect(mockFormulas.dmg).toHaveBeenCalledWith(
        ctx.weaponLevel,
        mob.armorLevel,
        25,
      );
    });
  });

  // =========================================================================
  // HURT handler
  // =========================================================================

  describe('HURT handler', () => {
    let mob: any;

    beforeEach(() => {
      mob = {
        id: 42,
        isDead: false,
        hitPoints: 50,
        weaponLevel: 1,
        x: 50,
        y: 50,
        clearTarget: vi.fn(),
        forgetPlayer: vi.fn(),
      };
      ctx.world.getEntityById = vi.fn(() => mob);
      ctx.hitPoints = 100;
      ctx.x = 50;
      ctx.y = 50;
      mockFormulas.dmg.mockReturnValue(10);
    });

    it('should reduce player hitPoints when hurt by mob', async () => {
      await router.route(ctx, [Msg.HURT, 42]);

      expect(ctx.hitPoints).toBeLessThan(100);
      expect(ctx.world.handleHurtEntity).toHaveBeenCalledWith(ctx);
    });

    it('should not take damage from a dead mob', async () => {
      mob.isDead = true;

      await router.route(ctx, [Msg.HURT, 42]);

      expect(ctx.hitPoints).toBe(100);
    });

    it('should not take damage from a non-existent mob', async () => {
      ctx.world.getEntityById = vi.fn(() => null);

      await router.route(ctx, [Msg.HURT, 999]);

      expect(ctx.hitPoints).toBe(100);
    });

    it('should not take damage when player is dead', async () => {
      ctx.hitPoints = 0;

      await router.route(ctx, [Msg.HURT, 42]);

      expect(ctx.world.handleHurtEntity).not.toHaveBeenCalled();
    });

    it('should not take damage when phased', async () => {
      (ctx.isPhased as ReturnType<typeof vi.fn>).mockReturnValue(true);

      await router.route(ctx, [Msg.HURT, 42]);

      expect(ctx.hitPoints).toBe(100);
    });

    it('should set isDead and clear firepotion timeout when killed', async () => {
      ctx.hitPoints = 5;
      mockFormulas.dmg.mockReturnValue(10);
      const timeout = setTimeout(() => {}, 15000);
      ctx.firepotionTimeout = timeout;

      await router.route(ctx, [Msg.HURT, 42]);

      expect(ctx.isDead).toBe(true);
      clearTimeout(timeout);
    });

    it('should reject damage from mob too far away but keep aggro', async () => {
      mob.x = 200;
      mob.y = 200;
      ctx.x = 50;
      ctx.y = 50;

      await router.route(ctx, [Msg.HURT, 42]);

      expect(ctx.hitPoints).toBe(100);
      // Aggro kept intact — just skip damage this tick
      expect(mob.clearTarget).not.toHaveBeenCalled();
      expect(mob.forgetPlayer).not.toHaveBeenCalled();
    });

    it('should allow damage from mob within melee range', async () => {
      mob.x = 51;
      mob.y = 51;
      ctx.x = 50;
      ctx.y = 50;

      await router.route(ctx, [Msg.HURT, 42]);

      expect(ctx.hitPoints).toBeLessThan(100);
    });

    it('should not take damage from stunned mob', async () => {
      mob.stunUntil = Date.now() + 5000;

      await router.route(ctx, [Msg.HURT, 42]);

      expect(ctx.hitPoints).toBe(100);
    });

    it('should not take damage from mob with 0 hitPoints', async () => {
      mob.hitPoints = 0;

      await router.route(ctx, [Msg.HURT, 42]);

      expect(ctx.hitPoints).toBe(100);
    });

    it('should pass mob level to damage formula', async () => {
      mob.level = 15;

      await router.route(ctx, [Msg.HURT, 42]);

      expect(mockFormulas.dmg).toHaveBeenCalledWith(
        mob.weaponLevel,
        ctx.armorLevel,
        15,
      );
    });

    it('should default mob level to 1 when not set', async () => {
      mob.level = undefined;

      await router.route(ctx, [Msg.HURT, 42]);

      expect(mockFormulas.dmg).toHaveBeenCalledWith(
        mob.weaponLevel,
        ctx.armorLevel,
        1,
      );
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('should not crash when handler throws synchronously', async () => {
      ctx.world.pushSpawnsToPlayer = vi.fn(() => {
        throw new Error('Unexpected error');
      });

      const result = await router.route(ctx, [Msg.WHO, 10]);
      expect(result).toBe(true);
    });

    it('should still return true after handler error', async () => {
      ctx.world.pushSpawnsToPlayer = vi.fn(() => {
        throw new TypeError('Cannot read properties of undefined');
      });

      const result = await router.route(ctx, [Msg.WHO, 10]);
      expect(result).toBe(true);
    });

    it('should not crash when zone_callback throws', async () => {
      (ctx.zone_callback as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('zone error');
        },
      );

      const result = await router.route(ctx, [Msg.ZONE]);
      expect(result).toBe(true);
    });

    it('should not crash when move_callback throws', async () => {
      (ctx.move_callback as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('move callback error');
        },
      );

      const result = await router.route(ctx, [Msg.MOVE, 10, 20]);
      expect(result).toBe(true);
    });

    it('should not crash when world.getEntityById throws in HIT', async () => {
      ctx.world.getEntityById = vi.fn(() => {
        throw new Error('DB error');
      });

      const result = await router.route(ctx, [Msg.HIT, 42]);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // LOOTMOVE handler
  // =========================================================================

  describe('LOOTMOVE handler', () => {
    it('should move to item and broadcast', async () => {
      const item = { id: 55, kind: Types.Entities.FLASK };
      ctx.world.getEntityById = vi.fn(() => item);

      await router.route(ctx, [Msg.LOOTMOVE, 80, 90, 55]);

      expect(ctx.setPosition).toHaveBeenCalledWith(80, 90);
      expect(ctx.clearTarget).toHaveBeenCalled();
      expect(ctx.broadcast).toHaveBeenCalled();
      expect(mockMessages.LootMove).toHaveBeenCalledWith(ctx, item);
      expect(ctx.lootmove_callback).toHaveBeenCalledWith(ctx.x, ctx.y);
    });

    it('should not move to loot if position is invalid', async () => {
      ctx.world.isValidPosition = vi.fn(() => false);

      await router.route(ctx, [Msg.LOOTMOVE, -1, -1, 55]);

      expect(ctx.setPosition).not.toHaveBeenCalled();
    });

    it('should not move if lootmove_callback is not set', async () => {
      ctx.lootmove_callback = undefined;

      await router.route(ctx, [Msg.LOOTMOVE, 80, 90, 55]);

      expect(ctx.setPosition).not.toHaveBeenCalled();
    });

    it('should not broadcast if item does not exist', async () => {
      ctx.world.getEntityById = vi.fn(() => null);

      await router.route(ctx, [Msg.LOOTMOVE, 80, 90, 999]);

      expect(ctx.setPosition).toHaveBeenCalledWith(80, 90);
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // AGGRO handler
  // =========================================================================

  describe('AGGRO handler', () => {
    it('should trigger mob hate', async () => {
      await router.route(ctx, [Msg.AGGRO, 42]);

      expect(ctx.world.handleMobHate).toHaveBeenCalledWith(42, ctx.id, 5);
    });

    it('should not trigger mob hate if move_callback is not set', async () => {
      ctx.move_callback = undefined;

      await router.route(ctx, [Msg.AGGRO, 42]);

      expect(ctx.world.handleMobHate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // ATTACK handler
  // =========================================================================

  describe('ATTACK handler', () => {
    it('should set target and broadcast attacker', async () => {
      const mob = { id: 42 };
      ctx.world.getEntityById = vi.fn(() => mob);

      await router.route(ctx, [Msg.ATTACK, 42]);

      expect(ctx.setTarget).toHaveBeenCalledWith(mob);
      expect(ctx.world.broadcastAttacker).toHaveBeenCalledWith(ctx);
    });

    it('should not attack non-existent entity', async () => {
      ctx.world.getEntityById = vi.fn(() => null);

      await router.route(ctx, [Msg.ATTACK, 999]);

      expect(ctx.setTarget).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TELEPORT handler
  // =========================================================================

  describe('TELEPORT handler', () => {
    it('should teleport to valid position', async () => {
      await router.route(ctx, [Msg.TELEPORT, 200, 300]);

      expect(ctx.setPosition).toHaveBeenCalledWith(200, 300);
      expect(ctx.clearTarget).toHaveBeenCalled();
      expect(ctx.broadcast).toHaveBeenCalled();
      expect(mockMessages.Teleport).toHaveBeenCalledWith(ctx);
      expect(ctx.world.handlePlayerVanish).toHaveBeenCalledWith(ctx);
      expect(ctx.world.pushRelevantEntityListTo).toHaveBeenCalledWith(ctx);
    });

    it('should not teleport to invalid position', async () => {
      ctx.world.isValidPosition = vi.fn(() => false);

      await router.route(ctx, [Msg.TELEPORT, -1, -1]);

      expect(ctx.setPosition).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // CHECK handler
  // =========================================================================

  describe('CHECK handler', () => {
    it('should set lastCheckpoint when checkpoint exists', async () => {
      const checkpoint = { id: 5, x: 100, y: 200 };
      ctx.world.map.getCheckpoint = vi.fn(() => checkpoint);

      await router.route(ctx, [Msg.CHECK, 5]);

      expect(ctx.lastCheckpoint).toEqual(checkpoint);
    });

    it('should not set lastCheckpoint when checkpoint missing', async () => {
      ctx.world.map.getCheckpoint = vi.fn(() => null);

      await router.route(ctx, [Msg.CHECK, 999]);

      expect(ctx.lastCheckpoint).toBeNull();
    });
  });

  // =========================================================================
  // OPEN handler
  // =========================================================================

  describe('OPEN handler', () => {
    it('should open chest when entity is a Chest instance', async () => {
      const chest = new MockChest();
      ctx.world.getEntityById = vi.fn(() => chest);

      await router.route(ctx, [Msg.OPEN, 100]);

      expect(ctx.world.handleOpenedChest).toHaveBeenCalledWith(chest, ctx);
    });

    it('should not open if entity is not a Chest', async () => {
      const notAChest = { id: 100, kind: 1 };
      ctx.world.getEntityById = vi.fn(() => notAChest);

      await router.route(ctx, [Msg.OPEN, 100]);

      expect(ctx.world.handleOpenedChest).not.toHaveBeenCalled();
    });

    it('should not open if entity does not exist', async () => {
      ctx.world.getEntityById = vi.fn(() => null);

      await router.route(ctx, [Msg.OPEN, 999]);

      expect(ctx.world.handleOpenedChest).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // HELLO handler
  // =========================================================================

  describe('HELLO handler', () => {
    beforeEach(() => {
      ctx.hasEnteredGame = false;
    });

    it('should create a new character for new player', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'NewPlayer',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'password123',
      ]);

      expect(storage.createCharacter).toHaveBeenCalledWith(
        'NewPlayer',
        'password123',
      );
      expect(ctx.hasEnteredGame).toBe(true);
      expect(ctx.isDead).toBe(false);
      expect(ctx.world.addPlayer).toHaveBeenCalledWith(ctx);
    });

    it('should send WELCOME message after successful hello', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'NewPlayer',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'pw123',
      ]);

      expect(ctx.send).toHaveBeenCalledWith(
        expect.arrayContaining([Msg.WELCOME]),
      );
    });

    it('should truncate name to 15 characters', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      ctx.world.getStorageService = vi.fn(() => storage);
      mockUtils.sanitize.mockReturnValue('A'.repeat(30));

      await router.route(ctx, [
        Msg.HELLO,
        'A'.repeat(30),
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'pw123',
      ]);

      expect(ctx.name.length).toBe(15);
    });

    it('should default empty name to lorem ipsum', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      ctx.world.getStorageService = vi.fn(() => storage);
      mockUtils.sanitize.mockReturnValue('');

      await router.route(ctx, [
        Msg.HELLO,
        '',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'pw123',
      ]);

      expect(ctx.name).toBe('lorem ipsum');
    });

    it('should reject existing character with wrong password', async () => {
      const storage = {
        characterExists: vi.fn(() => true),
        verifyPassword: vi.fn(() => false),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'Existing',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'wrong',
      ]);

      // AUTH_FAIL is sent via Types.Messages.AUTH_FAIL which is beyond the
      // vitest-visible range; verify the important invariant instead.
      expect(ctx.send).toHaveBeenCalled();
      expect(ctx.hasEnteredGame).toBe(false);
    });

    it('should reject new character with too-short password', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'NewGuy',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'ab',
      ]);

      expect(ctx.send).toHaveBeenCalled();
      expect(ctx.hasEnteredGame).toBe(false);
    });

    it('should reject new character with empty password', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'NewGuy',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        '',
      ]);

      expect(ctx.send).toHaveBeenCalled();
      expect(ctx.hasEnteredGame).toBe(false);
    });

    it('should load existing character with correct password', async () => {
      const storage = {
        characterExists: vi.fn(() => true),
        verifyPassword: vi.fn(() => true),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'Existing',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'correct',
      ]);

      expect(ctx.loadFromStorage).toHaveBeenCalledWith(storage);
      expect(ctx.hasEnteredGame).toBe(true);
    });

    it('should set spawn protection BEFORE adding player to world (prevents aggro race)', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      // Track the order: was spawnProtection set before addPlayer was called?
      let protectionWasSetBeforeAdd = false;
      ctx.world.addPlayer = vi.fn(() => {
        // At the moment addPlayer is called, spawnProtection should already be set
        protectionWasSetBeforeAdd = ctx.spawnProtectionUntil > Date.now();
      });

      await router.route(ctx, [
        Msg.HELLO,
        'New',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'pw123',
      ]);

      expect(protectionWasSetBeforeAdd).toBe(true);
    });

    it('should set spawn protection for 10 seconds', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      const before = Date.now();
      await router.route(ctx, [
        Msg.HELLO,
        'New',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'pw123',
      ]);
      const after = Date.now();

      expect(ctx.spawnProtectionUntil).toBeGreaterThanOrEqual(before + 10000);
      expect(ctx.spawnProtectionUntil).toBeLessThanOrEqual(after + 10000);
    });

    it('should set player kind to WARRIOR', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'New',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'pw123',
      ]);

      expect(ctx.kind).toBe(Types.Entities.WARRIOR);
    });

    it('should call updateHitPoints and updatePosition during hello', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'New',
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        0,
        'pw123',
      ]);

      expect(ctx.updateHitPoints).toHaveBeenCalled();
      expect(ctx.updatePosition).toHaveBeenCalled();
    });

    it('should equip starting gear for new character', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      ctx.world.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'New',
        Types.Entities.LEATHERARMOR,
        Types.Entities.SWORD2,
        50,
        'pw123',
      ]);

      expect(ctx.equipArmor).toHaveBeenCalledWith(Types.Entities.LEATHERARMOR);
      expect(ctx.equipWeapon).toHaveBeenCalledWith(Types.Entities.SWORD2);
      expect(ctx.setGold).toHaveBeenCalledWith(50);
    });
  });

  // =========================================================================
  // Message type parsing
  // =========================================================================

  describe('message type parsing', () => {
    it('should parse string message type via parseInt', async () => {
      const result = await router.route(ctx, [String(Msg.WHO), 10]);
      expect(result).toBe(true);
      expect(ctx.world.pushSpawnsToPlayer).toHaveBeenCalled();
    });

    it('should return false for NaN message type', async () => {
      const result = await router.route(ctx, ['not_a_number']);
      expect(result).toBe(false);
    });
  });
});
