/**
 * Tests for AuthHandler
 * Covers: handleHello (authentication, character creation/loading, game entry)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

// Mock handler dependencies
vi.mock('../player/achievement.handler', () => ({
  initAchievements: vi.fn(),
}));

vi.mock('../player/venice.handler', () => ({
  triggerNarration: vi.fn(async () => {}),
}));

vi.mock('../player/inventory.handler', () => ({
  sendInventoryInit: vi.fn(),
  persistInventory: vi.fn(),
}));

vi.mock('../player/skill.handler', () => ({
  sendSkillInit: vi.fn(),
}));

import { handleHello } from '../player/auth.handler';
import { initAchievements } from '../player/achievement.handler';
import type { Player } from '../player';

// ---------------------------------------------------------------------------
// Message type IDs
// ---------------------------------------------------------------------------

const Msg = {
  HELLO: 0,
  WELCOME: 1,
  EQUIP: 13,
  AUTH_FAIL: 86,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStorage(overrides: Record<string, any> = {}) {
  return {
    characterExists: vi.fn(() => false),
    createCharacter: vi.fn(() => ({ id: 'char-new' })),
    verifyPassword: vi.fn(() => true),
    ...overrides,
  };
}

function createMockWorld(storage?: any) {
  return {
    addPlayer: vi.fn(),
    enterCallback: vi.fn(),
    pushRelevantEntityListTo: vi.fn(),
    getStorageService: vi.fn(() => storage || createMockStorage()),
  };
}

function createMockUtils() {
  return {
    sanitize: vi.fn((s: string) => s),
    randomOrientation: vi.fn(() => 1),
  };
}

function createMockFormulas() {
  return {
    xpToNextLevel: vi.fn(() => 100),
  };
}

function createMockPlayer(overrides: Record<string, any> = {}): Player {
  const world = createMockWorld();
  return {
    id: 1,
    name: '',
    kind: 0,
    x: 50,
    y: 50,
    hitPoints: 100,
    maxHitPoints: 100,
    level: 1,
    xp: 0,
    gold: 0,
    weapon: Types.Entities.SWORD1,
    armor: Types.Entities.CLOTHARMOR,
    characterId: null,
    hasEnteredGame: false,
    isDead: false,
    spawnProtectionUntil: 0,
    orientation: 0,

    getWorld: vi.fn(() => world),

    send: vi.fn(),
    broadcast: vi.fn(),

    equipArmor: vi.fn(),
    equipWeapon: vi.fn(),
    setGold: vi.fn(),
    updateHitPoints: vi.fn(),
    updatePosition: vi.fn(),
    loadFromStorage: vi.fn(() => true),
    initProgressionSystem: vi.fn(),
    getAuditLog: vi.fn(() => ({ playerName: '', record: vi.fn(), flush: vi.fn() })),

    ...overrides,
  } as unknown as Player;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthHandler', () => {
  let mockUtils: ReturnType<typeof createMockUtils>;
  let mockFormulas: ReturnType<typeof createMockFormulas>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUtils = createMockUtils();
    mockFormulas = createMockFormulas();
  });

  describe('handleHello', () => {
    it('should create a new character for new player', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      await handleHello(player, [Msg.HELLO, 'NewPlayer', 0, 0, 0, 'password123'], mockUtils, mockFormulas);

      expect(storage.createCharacter).toHaveBeenCalledWith('NewPlayer', 'password123');
      expect(player.hasEnteredGame).toBe(true);
      expect(player.isDead).toBe(false);
      expect(world.addPlayer).toHaveBeenCalledWith(player);
    });

    it('should send WELCOME message after successful hello', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      await handleHello(player, [Msg.HELLO, 'NewPlayer', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(player.send).toHaveBeenCalledWith(
        expect.arrayContaining([Msg.WELCOME]),
      );
    });

    it('should truncate name to 15 characters', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });
      mockUtils.sanitize.mockReturnValue('A'.repeat(30));

      await handleHello(player, [Msg.HELLO, 'A'.repeat(30), 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(player.name.length).toBe(15);
    });

    it('should default empty name to lorem ipsum', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });
      mockUtils.sanitize.mockReturnValue('');

      await handleHello(player, [Msg.HELLO, '', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(player.name).toBe('lorem ipsum');
    });

    it('should reject existing character with wrong password', async () => {
      const storage = createMockStorage({
        characterExists: vi.fn(() => true),
        verifyPassword: vi.fn(() => false),
      });
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      await handleHello(player, [Msg.HELLO, 'Existing', 0, 0, 0, 'wrong'], mockUtils, mockFormulas);

      expect(player.send).toHaveBeenCalled();
      expect(player.hasEnteredGame).toBe(false);
    });

    it('should reject new character with too-short password', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      await handleHello(player, [Msg.HELLO, 'NewGuy', 0, 0, 0, 'ab'], mockUtils, mockFormulas);

      expect(player.send).toHaveBeenCalled();
      expect(player.hasEnteredGame).toBe(false);
    });

    it('should reject new character with empty password', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      await handleHello(player, [Msg.HELLO, 'NewGuy', 0, 0, 0, ''], mockUtils, mockFormulas);

      expect(player.send).toHaveBeenCalled();
      expect(player.hasEnteredGame).toBe(false);
    });

    it('should load existing character with correct password', async () => {
      const storage = createMockStorage({
        characterExists: vi.fn(() => true),
        verifyPassword: vi.fn(() => true),
      });
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      await handleHello(player, [Msg.HELLO, 'Existing', 0, 0, 0, 'correct'], mockUtils, mockFormulas);

      expect(player.loadFromStorage).toHaveBeenCalledWith(storage);
      expect(player.hasEnteredGame).toBe(true);
    });

    it('should set spawn protection BEFORE adding player to world', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      let protectionWasSetBeforeAdd = false;
      world.addPlayer = vi.fn(() => {
        protectionWasSetBeforeAdd = player.spawnProtectionUntil > Date.now();
      });

      await handleHello(player, [Msg.HELLO, 'New', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(protectionWasSetBeforeAdd).toBe(true);
    });

    it('should set spawn protection for 10 seconds', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      const before = Date.now();
      await handleHello(player, [Msg.HELLO, 'New', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);
      const after = Date.now();

      expect(player.spawnProtectionUntil).toBeGreaterThanOrEqual(before + 10000);
      expect(player.spawnProtectionUntil).toBeLessThanOrEqual(after + 10000);
    });

    it('should set player kind to WARRIOR', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      await handleHello(player, [Msg.HELLO, 'New', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(player.kind).toBe(Types.Entities.WARRIOR);
    });

    it('should call updateHitPoints and updatePosition', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      await handleHello(player, [Msg.HELLO, 'New', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(player.updateHitPoints).toHaveBeenCalled();
      expect(player.updatePosition).toHaveBeenCalled();
    });

    it('should equip default starting gear for new character', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createMockPlayer({ getWorld: vi.fn(() => world) });

      await handleHello(player, [Msg.HELLO, 'New', Types.Entities.LEATHERARMOR, Types.Entities.SWORD2, 50, 'pw123'], mockUtils, mockFormulas);

      expect(player.equipArmor).toHaveBeenCalledWith(Types.Entities.CLOTHARMOR);
      expect(player.equipWeapon).toHaveBeenCalledWith(Types.Entities.SWORD1);
      expect(player.setGold).toHaveBeenCalledWith(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Respawn: a second HELLO on the same connection for a dead, already-
  // authenticated player must NOT reload from storage (it would clobber up
  // to 60s of in-memory progress with the last autosave).
  // ---------------------------------------------------------------------------

  describe('handleHello — respawn after death', () => {
    function createDeadPlayer(world: ReturnType<typeof createMockWorld>, overrides: Record<string, unknown> = {}): Player {
      return createMockPlayer({
        hasEnteredGame: true,
        isDead: true,
        hitPoints: 0,
        maxHitPoints: 200,
        level: 5,
        xp: 250,
        gold: 123,
        weapon: Types.Entities.SWORD2,
        armor: Types.Entities.LEATHERARMOR,
        name: 'Existing',
        characterId: 'char-1',
        getWorld: vi.fn(() => world),
        ...overrides,
      });
    }

    it('skips the storage reload entirely', async () => {
      const storage = createMockStorage();
      const world = createMockWorld(storage);
      const player = createDeadPlayer(world);

      await handleHello(player, [Msg.HELLO, 'Existing', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(storage.characterExists).not.toHaveBeenCalled();
      expect(storage.createCharacter).not.toHaveBeenCalled();
      expect(player.loadFromStorage).not.toHaveBeenCalled();
    });

    it('restores HP, repositions at checkpoint, and clears the dead flag', async () => {
      const world = createMockWorld();
      const player = createDeadPlayer(world);

      await handleHello(player, [Msg.HELLO, 'Existing', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(player.updateHitPoints).toHaveBeenCalled(); // full HP
      expect(player.updatePosition).toHaveBeenCalled();  // last checkpoint
      expect(player.isDead).toBe(false);
      expect(player.spawnProtectionUntil).toBeGreaterThan(Date.now());
    });

    it('re-registers with the world and pushes the entity list', async () => {
      const world = createMockWorld();
      const player = createDeadPlayer(world);

      await handleHello(player, [Msg.HELLO, 'Existing', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(world.addPlayer).toHaveBeenCalledWith(player);
      expect(world.pushRelevantEntityListTo).toHaveBeenCalledWith(player);
      // Not a fresh join: no enterCallback, no achievement re-init
      expect(world.enterCallback).not.toHaveBeenCalled();
      expect(initAchievements).not.toHaveBeenCalled();
    });

    it('sends WELCOME with live in-memory state, not stale storage state', async () => {
      const world = createMockWorld();
      const player = createDeadPlayer(world);

      await handleHello(player, [Msg.HELLO, 'Existing', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(player.send).toHaveBeenCalledWith([
        Msg.WELCOME,
        player.id,
        'Existing',
        player.x,
        player.y,
        player.hitPoints,
        player.maxHitPoints,
        5,   // level
        250, // xp
        100, // xpToNext (mock Formulas)
        123, // gold
      ]);
    });

    it('resends EQUIP messages for the rebuilt client entity', async () => {
      const world = createMockWorld();
      const player = createDeadPlayer(world);

      await handleHello(player, [Msg.HELLO, 'Existing', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(player.send).toHaveBeenCalledWith([Msg.EQUIP, player.id, Types.Entities.SWORD2]);
      expect(player.send).toHaveBeenCalledWith([Msg.EQUIP, player.id, Types.Entities.LEATHERARMOR]);
    });

    it('keeps hasEnteredGame true', async () => {
      const world = createMockWorld();
      const player = createDeadPlayer(world);

      await handleHello(player, [Msg.HELLO, 'Existing', 0, 0, 0, 'pw123'], mockUtils, mockFormulas);

      expect(player.hasEnteredGame).toBe(true);
    });
  });
});
