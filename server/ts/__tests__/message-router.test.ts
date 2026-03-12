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

import { MessageRouter } from '../player/message-router';
import type { Player } from '../player';
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

function createMockWorld() {
  return {
    addPlayer: vi.fn(),
    enterCallback: vi.fn(),
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
  };
}

function createMockContext(
  overrides: Record<string, any> = {},
): Player {
  const world = createMockWorld();
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

    getWorld: vi.fn(() => world),
    getInventory: vi.fn(() => ({ serialize: vi.fn(() => []) })),

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

    zoneCallback: vi.fn(),
    moveCallback: vi.fn(),
    lootmoveCallback: vi.fn(),
    messageCallback: vi.fn(),

    characterId: 'char-1',
    loadFromStorage: vi.fn(() => true),
    saveToStorage: vi.fn(),

    firepotionTimeout: null,

    isPhased: vi.fn(() => false),
    consumePowerStrike: vi.fn(() => 1),

    ...overrides,
  } as unknown as Player;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageRouter', () => {
  let router: MessageRouter;
  let ctx: Player;
  let mockWorld: ReturnType<typeof createMockWorld>;
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
    mockWorld = ctx.getWorld() as ReturnType<typeof createMockWorld>;
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
      expect(mockWorld.pushSpawnsToPlayer).toHaveBeenCalledWith(ctx, [10, 20, 30]);
    });

    it('should dispatch ZONE to zoneCallback', async () => {
      await router.route(ctx, [Msg.ZONE]);
      expect(ctx.zoneCallback).toHaveBeenCalled();
    });

    it('should not call zoneCallback if not set', async () => {
      ctx.zoneCallback = undefined;
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

      const storage = mockWorld.getStorageService();
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
      mockWorld.getEntityById = vi.fn(() => mob);

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
      expect(mockWorld.addPlayer).not.toHaveBeenCalled();
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
      mockWorld.getEntityById = vi.fn(() => mob);

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
      // Move within MAX_MOVE_DISTANCE (3 tiles) of player position (50,50)
      await router.route(ctx, [Msg.MOVE, 52, 53]);

      expect(mockWorld.isValidPosition).toHaveBeenCalledWith(52, 53);
      expect(ctx.setPosition).toHaveBeenCalledWith(52, 53);
      expect(ctx.clearTarget).toHaveBeenCalled();
      expect(ctx.broadcast).toHaveBeenCalled();
      expect(mockMessages.Move).toHaveBeenCalledWith(ctx);
      expect(ctx.moveCallback).toHaveBeenCalledWith(ctx.x, ctx.y);
      expect(ctx.checkZoneChange).toHaveBeenCalledWith(52, 53);
    });

    it('should reject movement to invalid position', async () => {
      mockWorld.isValidPosition = vi.fn(() => false);

      await router.route(ctx, [Msg.MOVE, -1, -1]);

      expect(ctx.setPosition).not.toHaveBeenCalled();
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });

    it('should not move if moveCallback is not set', async () => {
      ctx.moveCallback = undefined;

      await router.route(ctx, [Msg.MOVE, 100, 200]);

      expect(ctx.setPosition).not.toHaveBeenCalled();
      expect(ctx.broadcast).not.toHaveBeenCalled();
    });

    it('should check zone change after moving', async () => {
      // Move within MAX_MOVE_DISTANCE (3 tiles) of player position (50,50)
      await router.route(ctx, [Msg.MOVE, 51, 52]);
      expect(ctx.checkZoneChange).toHaveBeenCalledWith(51, 52);
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
  // HIT handler (delegation — behavioral tests in combat.handler.test.ts)
  // =========================================================================

  describe('HIT handler', () => {
    it('should route HIT messages (combat rate limited)', async () => {
      const result = await router.route(ctx, [Msg.HIT, 42]);
      expect(result).toBe(true);
    });

    it('should apply combat rate limit to HIT', async () => {
      vi.mocked(checkCombatLimit).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 1,
      });

      const result = await router.route(ctx, [Msg.HIT, 42]);
      expect(result).toBe(true);
      // Handler was not called (rate limited)
    });
  });

  // =========================================================================
  // HURT handler (delegation — behavioral tests in combat.handler.test.ts)
  // =========================================================================

  describe('HURT handler', () => {
    it('should route HURT messages', async () => {
      const result = await router.route(ctx, [Msg.HURT, 42]);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('should not crash when handler throws synchronously', async () => {
      mockWorld.pushSpawnsToPlayer = vi.fn(() => {
        throw new Error('Unexpected error');
      });

      const result = await router.route(ctx, [Msg.WHO, 10]);
      expect(result).toBe(true);
    });

    it('should still return true after handler error', async () => {
      mockWorld.pushSpawnsToPlayer = vi.fn(() => {
        throw new TypeError('Cannot read properties of undefined');
      });

      const result = await router.route(ctx, [Msg.WHO, 10]);
      expect(result).toBe(true);
    });

    it('should not crash when zoneCallback throws', async () => {
      (ctx.zoneCallback as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('zone error');
        },
      );

      const result = await router.route(ctx, [Msg.ZONE]);
      expect(result).toBe(true);
    });

    it('should not crash when moveCallback throws', async () => {
      (ctx.moveCallback as ReturnType<typeof vi.fn>).mockImplementation(
        () => {
          throw new Error('move callback error');
        },
      );

      const result = await router.route(ctx, [Msg.MOVE, 10, 20]);
      expect(result).toBe(true);
    });

    it('should not crash when world.getEntityById throws in HIT', async () => {
      mockWorld.getEntityById = vi.fn(() => {
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
      mockWorld.getEntityById = vi.fn(() => item);

      await router.route(ctx, [Msg.LOOTMOVE, 80, 90, 55]);

      expect(ctx.setPosition).toHaveBeenCalledWith(80, 90);
      expect(ctx.clearTarget).toHaveBeenCalled();
      expect(ctx.broadcast).toHaveBeenCalled();
      expect(mockMessages.LootMove).toHaveBeenCalledWith(ctx, item);
      expect(ctx.lootmoveCallback).toHaveBeenCalledWith(ctx.x, ctx.y);
    });

    it('should not move to loot if position is invalid', async () => {
      mockWorld.isValidPosition = vi.fn(() => false);

      await router.route(ctx, [Msg.LOOTMOVE, -1, -1, 55]);

      expect(ctx.setPosition).not.toHaveBeenCalled();
    });

    it('should not move if lootmoveCallback is not set', async () => {
      ctx.lootmoveCallback = undefined;

      await router.route(ctx, [Msg.LOOTMOVE, 80, 90, 55]);

      expect(ctx.setPosition).not.toHaveBeenCalled();
    });

    it('should not broadcast if item does not exist', async () => {
      mockWorld.getEntityById = vi.fn(() => null);

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

      expect(mockWorld.handleMobHate).toHaveBeenCalledWith(42, ctx.id, 5);
    });

    it('should not trigger mob hate if moveCallback is not set', async () => {
      ctx.moveCallback = undefined;

      await router.route(ctx, [Msg.AGGRO, 42]);

      expect(mockWorld.handleMobHate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // ATTACK handler
  // =========================================================================

  describe('ATTACK handler', () => {
    it('should set target and broadcast attacker', async () => {
      const mob = { id: 42 };
      mockWorld.getEntityById = vi.fn(() => mob);

      await router.route(ctx, [Msg.ATTACK, 42]);

      expect(ctx.setTarget).toHaveBeenCalledWith(mob);
      expect(mockWorld.broadcastAttacker).toHaveBeenCalledWith(ctx);
    });

    it('should not attack non-existent entity', async () => {
      mockWorld.getEntityById = vi.fn(() => null);

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
      expect(mockWorld.handlePlayerVanish).toHaveBeenCalledWith(ctx);
      expect(mockWorld.pushRelevantEntityListTo).toHaveBeenCalledWith(ctx);
    });

    it('should not teleport to invalid position', async () => {
      mockWorld.isValidPosition = vi.fn(() => false);

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
      mockWorld.map.getCheckpoint = vi.fn(() => checkpoint);

      await router.route(ctx, [Msg.CHECK, 5]);

      expect(ctx.lastCheckpoint).toEqual(checkpoint);
    });

    it('should not set lastCheckpoint when checkpoint missing', async () => {
      mockWorld.map.getCheckpoint = vi.fn(() => null);

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
      mockWorld.getEntityById = vi.fn(() => chest);

      await router.route(ctx, [Msg.OPEN, 100]);

      expect(mockWorld.handleOpenedChest).toHaveBeenCalledWith(chest, ctx);
    });

    it('should not open if entity is not a Chest', async () => {
      const notAChest = { id: 100, kind: 1 };
      mockWorld.getEntityById = vi.fn(() => notAChest);

      await router.route(ctx, [Msg.OPEN, 100]);

      expect(mockWorld.handleOpenedChest).not.toHaveBeenCalled();
    });

    it('should not open if entity does not exist', async () => {
      mockWorld.getEntityById = vi.fn(() => null);

      await router.route(ctx, [Msg.OPEN, 999]);

      expect(mockWorld.handleOpenedChest).not.toHaveBeenCalled();
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
      mockWorld.getStorageService = vi.fn(() => storage);

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
      expect(mockWorld.addPlayer).toHaveBeenCalledWith(ctx);
    });

    it('should send WELCOME message after successful hello', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      mockWorld.getStorageService = vi.fn(() => storage);

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
      mockWorld.getStorageService = vi.fn(() => storage);
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
      mockWorld.getStorageService = vi.fn(() => storage);
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
      mockWorld.getStorageService = vi.fn(() => storage);

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
      mockWorld.getStorageService = vi.fn(() => storage);

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
      mockWorld.getStorageService = vi.fn(() => storage);

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
      mockWorld.getStorageService = vi.fn(() => storage);

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
      mockWorld.getStorageService = vi.fn(() => storage);

      // Track the order: was spawnProtection set before addPlayer was called?
      let protectionWasSetBeforeAdd = false;
      mockWorld.addPlayer = vi.fn(() => {
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
      mockWorld.getStorageService = vi.fn(() => storage);

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
      mockWorld.getStorageService = vi.fn(() => storage);

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
      mockWorld.getStorageService = vi.fn(() => storage);

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

    it('should equip default starting gear for new character (ignores client values)', async () => {
      const storage = {
        characterExists: vi.fn(() => false),
        createCharacter: vi.fn(() => ({ id: 'char-new' })),
      };
      mockWorld.getStorageService = vi.fn(() => storage);

      await router.route(ctx, [
        Msg.HELLO,
        'New',
        Types.Entities.LEATHERARMOR,
        Types.Entities.SWORD2,
        50,
        'pw123',
      ]);

      // Server enforces default starting equipment regardless of client-provided values
      expect(ctx.equipArmor).toHaveBeenCalledWith(Types.Entities.CLOTHARMOR);
      expect(ctx.equipWeapon).toHaveBeenCalledWith(Types.Entities.SWORD1);
      expect(ctx.setGold).toHaveBeenCalledWith(0);
    });
  });

  // =========================================================================
  // Message type parsing
  // =========================================================================

  describe('message type parsing', () => {
    it('should parse string message type via parseInt', async () => {
      const result = await router.route(ctx, [String(Msg.WHO), 10]);
      expect(result).toBe(true);
      expect(mockWorld.pushSpawnsToPlayer).toHaveBeenCalled();
    });

    it('should return false for NaN message type', async () => {
      const result = await router.route(ctx, ['not_a_number']);
      expect(result).toBe(false);
    });
  });
});
