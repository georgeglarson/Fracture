/**
 * Tests for SQLiteStorageService
 *
 * Uses better-sqlite3 in-memory databases via mocking the Database constructor
 * so that initialize() creates a real SQLite DB in memory rather than on disk.
 * This tests actual SQL logic end-to-end without touching the filesystem.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SQLiteStorageService } from '../storage/sqlite.service';
import type { CharacterData, DailyData, PlayerSaveState } from '../storage/storage.interface';
import type { PlayerAchievements } from '../../../shared/ts/achievements/achievement-data';
import type { SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types';

// ---------------------------------------------------------------------------
// Mock better-sqlite3 so that any `new Database(path)` returns an in-memory DB.
// We use a real constructor function so that `new Database(...)` works.
// ---------------------------------------------------------------------------
let memDb: Database.Database;

vi.mock('better-sqlite3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('better-sqlite3')>();
  const RealDatabase = actual.default;

  // A constructor function that creates an in-memory database
  function MockDatabase() {
    memDb = new RealDatabase(':memory:');
    return memDb;
  }

  return {
    default: MockDatabase,
    __esModule: true,
  };
});

// Mock fs.existsSync / fs.mkdirSync so initialize() doesn't touch disk
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCharacterData(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    id: 'char-test-001',
    name: 'TestHero',
    level: 10,
    xp: 500,
    gold: 1200,
    armorKind: 21,
    weaponKind: 61,
    x: 150,
    y: 250,
    ascensionCount: 2,
    restedXp: 35,
    lastLogoutTime: 1700000000000,
    ...overrides,
  };
}

function makeDailyData(overrides: Partial<DailyData> = {}): DailyData {
  return {
    lastLogin: '2025-08-15',
    currentStreak: 5,
    longestStreak: 12,
    totalLogins: 40,
    ...overrides,
  };
}

function makeAchievements(overrides: Partial<PlayerAchievements> = {}): PlayerAchievements {
  return {
    unlocked: ['first_blood', 'adventurer'],
    progress: { total_kills: 50, gold_earned: 1200 },
    selectedTitle: 'first_blood',
    ...overrides,
  };
}

function makeInventorySlots(): (SerializedInventorySlot | null)[] {
  const slots: (SerializedInventorySlot | null)[] = new Array(20).fill(null);
  slots[0] = { k: 60, p: { attack: 10, durability: 50 }, c: 1 };
  slots[2] = { k: 35, p: null, c: 5 };
  slots[5] = { k: 62, p: { attack: 20 }, c: 1 };
  return slots;
}

function makePlayerSaveState(overrides: Partial<PlayerSaveState> = {}): PlayerSaveState {
  return {
    character: makeCharacterData(),
    inventory: makeInventorySlots(),
    achievements: makeAchievements(),
    daily: makeDailyData(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SQLiteStorageService', () => {
  let service: SQLiteStorageService;

  beforeEach(() => {
    service = new SQLiteStorageService();
    service.initialize();
  });

  afterEach(() => {
    service.close();
  });

  // =========================================================================
  // Initialization & Lifecycle
  // =========================================================================

  describe('initialize and close', () => {
    it('should initialize without throwing', () => {
      const s = new SQLiteStorageService();
      expect(() => s.initialize()).not.toThrow();
      s.close();
    });

    it('should close gracefully even if called twice', () => {
      const s = new SQLiteStorageService();
      s.initialize();
      s.close();
      expect(() => s.close()).not.toThrow();
    });
  });

  // =========================================================================
  // Character Creation
  // =========================================================================

  describe('createCharacter', () => {
    it('should create a character with default values', () => {
      const char = service.createCharacter('NewPlayer', 'password123');

      expect(char.name).toBe('NewPlayer');
      expect(char.level).toBe(1);
      expect(char.xp).toBe(0);
      expect(char.gold).toBe(0);
      expect(char.armorKind).toBeNull();
      expect(char.weaponKind).toBeNull();
      expect(char.x).toBe(0);
      expect(char.y).toBe(0);
      expect(char.ascensionCount).toBe(0);
      expect(char.restedXp).toBe(0);
      expect(char.lastLogoutTime).toBe(0);
    });

    it('should generate a unique id for the character', () => {
      const char = service.createCharacter('Player1', 'pass1');
      expect(char.id).toBeDefined();
      expect(typeof char.id).toBe('string');
      expect(char.id.length).toBeGreaterThan(0);
    });

    it('should assign unique ids to different characters', () => {
      const char1 = service.createCharacter('Player1', 'pass1');
      const char2 = service.createCharacter('Player2', 'pass2');
      expect(char1.id).not.toBe(char2.id);
    });

    it('should throw when creating a duplicate character name', () => {
      service.createCharacter('DuplicateTest', 'pass');
      expect(() => service.createCharacter('DuplicateTest', 'pass2')).toThrow();
    });
  });

  // =========================================================================
  // Character Existence & Lookup
  // =========================================================================

  describe('characterExists', () => {
    it('should return true for an existing character', () => {
      service.createCharacter('ExistingPlayer', 'pass');
      expect(service.characterExists('ExistingPlayer')).toBe(true);
    });

    it('should return false for a non-existing character', () => {
      expect(service.characterExists('GhostPlayer')).toBe(false);
    });
  });

  describe('getCharacter', () => {
    it('should retrieve a character by name', () => {
      const created = service.createCharacter('LookupPlayer', 'pass');
      const found = service.getCharacter('LookupPlayer');

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('LookupPlayer');
      expect(found!.level).toBe(1);
    });

    it('should return null for a non-existing character', () => {
      expect(service.getCharacter('Nobody')).toBeNull();
    });
  });

  describe('getCharacterById', () => {
    it('should retrieve a character by id', () => {
      const created = service.createCharacter('IdLookup', 'pass');
      const found = service.getCharacterById(created.id);

      expect(found).not.toBeNull();
      expect(found!.name).toBe('IdLookup');
    });

    it('should return null for a non-existing id', () => {
      expect(service.getCharacterById('nonexistent-id')).toBeNull();
    });
  });

  // =========================================================================
  // Password Verification
  // =========================================================================

  describe('verifyPassword', () => {
    it('should return true for the correct password', () => {
      service.createCharacter('AuthPlayer', 'secret123');
      expect(service.verifyPassword('AuthPlayer', 'secret123')).toBe(true);
    });

    it('should return false for an incorrect password', () => {
      service.createCharacter('AuthPlayer2', 'correctpass');
      expect(service.verifyPassword('AuthPlayer2', 'wrongpass')).toBe(false);
    });

    it('should return false for a non-existing character', () => {
      expect(service.verifyPassword('NoSuchPlayer', 'anypass')).toBe(false);
    });
  });

  // =========================================================================
  // Save & Load Character State
  // =========================================================================

  describe('saveCharacter', () => {
    it('should update character fields in the database', () => {
      const created = service.createCharacter('SaveTest', 'pass');

      const updated = makeCharacterData({
        id: created.id,
        name: 'SaveTest',
        level: 25,
        xp: 9999,
        gold: 5000,
        armorKind: 22,
        weaponKind: 63,
        x: 300,
        y: 400,
        ascensionCount: 5,
        restedXp: 80,
        lastLogoutTime: 1700001000000,
      });

      const result = service.saveCharacter(updated);
      expect(result).toBe(true);

      const loaded = service.getCharacter('SaveTest');
      expect(loaded).not.toBeNull();
      expect(loaded!.level).toBe(25);
      expect(loaded!.xp).toBe(9999);
      expect(loaded!.gold).toBe(5000);
      expect(loaded!.armorKind).toBe(22);
      expect(loaded!.weaponKind).toBe(63);
      expect(loaded!.x).toBe(300);
      expect(loaded!.y).toBe(400);
      expect(loaded!.ascensionCount).toBe(5);
      expect(loaded!.restedXp).toBe(80);
      expect(loaded!.lastLogoutTime).toBe(1700001000000);
    });

    it('should handle null armor and weapon kinds', () => {
      const created = service.createCharacter('NullEquip', 'pass');

      const updated = makeCharacterData({
        id: created.id,
        name: 'NullEquip',
        armorKind: null,
        weaponKind: null,
      });

      service.saveCharacter(updated);
      const loaded = service.getCharacter('NullEquip');

      expect(loaded!.armorKind).toBeNull();
      expect(loaded!.weaponKind).toBeNull();
    });

    it('should set the last_saved timestamp on save', () => {
      const created = service.createCharacter('TimestampTest', 'pass');
      service.saveCharacter(makeCharacterData({ id: created.id, name: 'TimestampTest' }));

      const loaded = service.getCharacter('TimestampTest');
      expect(loaded!.lastSaved).toBeDefined();
      expect(loaded!.lastSaved).not.toBeNull();
    });

    it('should preserve progression fields across multiple saves', () => {
      const created = service.createCharacter('MultiSave', 'pass');

      // First save
      service.saveCharacter(makeCharacterData({
        id: created.id,
        name: 'MultiSave',
        level: 5,
        ascensionCount: 1,
        restedXp: 20,
      }));

      // Second save with updated values
      service.saveCharacter(makeCharacterData({
        id: created.id,
        name: 'MultiSave',
        level: 10,
        ascensionCount: 2,
        restedXp: 50,
      }));

      const loaded = service.getCharacter('MultiSave');
      expect(loaded!.level).toBe(10);
      expect(loaded!.ascensionCount).toBe(2);
      expect(loaded!.restedXp).toBe(50);
    });
  });

  // =========================================================================
  // Inventory Persistence
  // =========================================================================

  describe('inventory persistence', () => {
    it('should save and load inventory slots', () => {
      const created = service.createCharacter('InvPlayer', 'pass');
      const slots = makeInventorySlots();

      const saved = service.saveInventory(created.id, slots);
      expect(saved).toBe(true);

      const loaded = service.getInventory(created.id);
      expect(loaded).toHaveLength(20);
      expect(loaded[0]).toEqual({ k: 60, p: { attack: 10, durability: 50 }, c: 1 });
      expect(loaded[1]).toBeNull();
      expect(loaded[2]).toEqual({ k: 35, p: null, c: 5 });
      expect(loaded[5]).toEqual({ k: 62, p: { attack: 20 }, c: 1 });
    });

    it('should return a 20-slot null array for a character with no inventory', () => {
      const created = service.createCharacter('EmptyInv', 'pass');
      const loaded = service.getInventory(created.id);

      expect(loaded).toHaveLength(20);
      expect(loaded.every(slot => slot === null)).toBe(true);
    });

    it('should overwrite existing inventory on subsequent saves', () => {
      const created = service.createCharacter('InvOverwrite', 'pass');

      // First save
      const slots1: (SerializedInventorySlot | null)[] = new Array(20).fill(null);
      slots1[0] = { k: 60, p: null, c: 1 };
      service.saveInventory(created.id, slots1);

      // Second save with different data
      const slots2: (SerializedInventorySlot | null)[] = new Array(20).fill(null);
      slots2[3] = { k: 35, p: null, c: 10 };
      service.saveInventory(created.id, slots2);

      const loaded = service.getInventory(created.id);
      expect(loaded[0]).toBeNull();
      expect(loaded[3]).toEqual({ k: 35, p: null, c: 10 });
    });

    it('should persist item properties as JSON', () => {
      const created = service.createCharacter('PropTest', 'pass');

      const slots: (SerializedInventorySlot | null)[] = new Array(20).fill(null);
      slots[0] = {
        k: 60,
        p: { attack: 15, defense: 5, durability: 100, level: 3 },
        c: 1,
      };
      service.saveInventory(created.id, slots);

      const loaded = service.getInventory(created.id);
      expect(loaded[0]!.p).toEqual({ attack: 15, defense: 5, durability: 100, level: 3 });
    });

    it('should handle a full 20-slot inventory', () => {
      const created = service.createCharacter('FullInv', 'pass');
      const slots: (SerializedInventorySlot | null)[] = Array.from({ length: 20 }, (_, i) => ({
        k: 60 + i,
        p: { attack: i * 2 },
        c: 1,
      }));

      service.saveInventory(created.id, slots);
      const loaded = service.getInventory(created.id);

      expect(loaded).toHaveLength(20);
      for (let i = 0; i < 20; i++) {
        expect(loaded[i]).not.toBeNull();
        expect(loaded[i]!.k).toBe(60 + i);
        expect(loaded[i]!.p).toEqual({ attack: i * 2 });
      }
    });

    it('should save empty inventory (all nulls)', () => {
      const created = service.createCharacter('AllNull', 'pass');
      const slots: (SerializedInventorySlot | null)[] = new Array(20).fill(null);

      const result = service.saveInventory(created.id, slots);
      expect(result).toBe(true);

      const loaded = service.getInventory(created.id);
      expect(loaded.every(s => s === null)).toBe(true);
    });

    it('should handle items with count greater than 1', () => {
      const created = service.createCharacter('StackTest', 'pass');
      const slots: (SerializedInventorySlot | null)[] = new Array(20).fill(null);
      slots[0] = { k: 35, p: null, c: 8 };

      service.saveInventory(created.id, slots);
      const loaded = service.getInventory(created.id);

      expect(loaded[0]!.c).toBe(8);
    });
  });

  // =========================================================================
  // Achievement Persistence
  // =========================================================================

  describe('achievement persistence', () => {
    it('should save and load achievements', () => {
      const created = service.createCharacter('AchPlayer', 'pass');
      const achievements = makeAchievements();

      const saved = service.saveAchievements(created.id, achievements);
      expect(saved).toBe(true);

      const loaded = service.getAchievements(created.id);
      expect(loaded.unlocked).toContain('first_blood');
      expect(loaded.unlocked).toContain('adventurer');
      expect(loaded.selectedTitle).toBe('first_blood');
    });

    it('should return empty achievements for a character with none saved', () => {
      const created = service.createCharacter('NoAch', 'pass');
      const loaded = service.getAchievements(created.id);

      expect(loaded.unlocked).toEqual([]);
      expect(loaded.progress).toEqual({});
      expect(loaded.selectedTitle).toBeNull();
    });

    it('should preserve progress for partially completed achievements', () => {
      const created = service.createCharacter('PartialAch', 'pass');
      const achievements: PlayerAchievements = {
        unlocked: [],
        progress: { centurion: 75, rat_slayer: 3 },
        selectedTitle: null,
      };

      service.saveAchievements(created.id, achievements);
      const loaded = service.getAchievements(created.id);

      expect(loaded.unlocked).toEqual([]);
      expect(loaded.progress).toEqual({ centurion: 75, rat_slayer: 3 });
    });

    it('should persist selected title', () => {
      const created = service.createCharacter('TitlePlayer', 'pass');
      const achievements: PlayerAchievements = {
        unlocked: ['centurion'],
        progress: { centurion: 100 },
        selectedTitle: 'centurion',
      };

      service.saveAchievements(created.id, achievements);
      const loaded = service.getAchievements(created.id);

      expect(loaded.selectedTitle).toBe('centurion');
    });

    it('should update selected title on subsequent saves', () => {
      const created = service.createCharacter('TitleUpdate', 'pass');

      // First save
      service.saveAchievements(created.id, {
        unlocked: ['first_blood'],
        progress: {},
        selectedTitle: 'first_blood',
      });

      // Second save with different title
      service.saveAchievements(created.id, {
        unlocked: ['first_blood', 'adventurer'],
        progress: {},
        selectedTitle: 'adventurer',
      });

      const loaded = service.getAchievements(created.id);
      expect(loaded.selectedTitle).toBe('adventurer');
    });

    it('should handle achievements with both unlocked and in-progress items', () => {
      const created = service.createCharacter('MixedAch', 'pass');
      const achievements: PlayerAchievements = {
        unlocked: ['first_blood'],
        progress: { first_blood: 1, centurion: 42 },
        selectedTitle: null,
      };

      service.saveAchievements(created.id, achievements);
      const loaded = service.getAchievements(created.id);

      expect(loaded.unlocked).toContain('first_blood');
      expect(loaded.progress.centurion).toBe(42);
    });

    it('should handle saving empty achievements (reset)', () => {
      const created = service.createCharacter('ResetAch', 'pass');

      // Save some achievements
      service.saveAchievements(created.id, makeAchievements());

      // Save empty achievements
      service.saveAchievements(created.id, {
        unlocked: [],
        progress: {},
        selectedTitle: null,
      });

      const loaded = service.getAchievements(created.id);
      // The upsert keeps previously unlocked achievements, but empty input produces no new rows
      expect(loaded.selectedTitle).toBeNull();
    });
  });

  // =========================================================================
  // Daily Login Persistence
  // =========================================================================

  describe('daily login persistence', () => {
    it('should save and load daily login data', () => {
      const created = service.createCharacter('DailyPlayer', 'pass');
      const daily = makeDailyData();

      const saved = service.saveDailyData(created.id, daily);
      expect(saved).toBe(true);

      const loaded = service.getDailyData(created.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.lastLogin).toBe('2025-08-15');
      expect(loaded!.currentStreak).toBe(5);
      expect(loaded!.longestStreak).toBe(12);
      expect(loaded!.totalLogins).toBe(40);
    });

    it('should return null for a character with no daily data', () => {
      const created = service.createCharacter('NoDailyPlayer', 'pass');
      expect(service.getDailyData(created.id)).toBeNull();
    });

    it('should upsert daily data on subsequent saves', () => {
      const created = service.createCharacter('UpsertDaily', 'pass');

      service.saveDailyData(created.id, makeDailyData({ currentStreak: 1, totalLogins: 1 }));
      service.saveDailyData(created.id, makeDailyData({ currentStreak: 2, totalLogins: 2 }));

      const loaded = service.getDailyData(created.id);
      expect(loaded!.currentStreak).toBe(2);
      expect(loaded!.totalLogins).toBe(2);
    });

    it('should handle zero streaks', () => {
      const created = service.createCharacter('ZeroStreak', 'pass');
      const daily = makeDailyData({
        currentStreak: 0,
        longestStreak: 0,
        totalLogins: 1,
      });

      service.saveDailyData(created.id, daily);
      const loaded = service.getDailyData(created.id);

      expect(loaded!.currentStreak).toBe(0);
      expect(loaded!.longestStreak).toBe(0);
      expect(loaded!.totalLogins).toBe(1);
    });

    it('should update longest streak when current exceeds it', () => {
      const created = service.createCharacter('StreakPlayer', 'pass');

      service.saveDailyData(created.id, makeDailyData({ currentStreak: 5, longestStreak: 10 }));
      service.saveDailyData(created.id, makeDailyData({ currentStreak: 15, longestStreak: 15 }));

      const loaded = service.getDailyData(created.id);
      expect(loaded!.longestStreak).toBe(15);
    });
  });

  // =========================================================================
  // savePlayerState / loadPlayerState (Full Round-Trip)
  // =========================================================================

  describe('savePlayerState and loadPlayerState', () => {
    it('should save and load a complete player state', () => {
      const created = service.createCharacter('FullStatePlayer', 'pass');
      const state = makePlayerSaveState({
        character: makeCharacterData({ id: created.id, name: 'FullStatePlayer' }),
      });

      const saved = service.savePlayerState(state);
      expect(saved).toBe(true);

      const loaded = service.loadPlayerState('FullStatePlayer');
      expect(loaded).not.toBeNull();

      // Verify character data
      expect(loaded!.character.name).toBe('FullStatePlayer');
      expect(loaded!.character.level).toBe(10);
      expect(loaded!.character.xp).toBe(500);
      expect(loaded!.character.gold).toBe(1200);
      expect(loaded!.character.armorKind).toBe(21);
      expect(loaded!.character.weaponKind).toBe(61);
      expect(loaded!.character.x).toBe(150);
      expect(loaded!.character.y).toBe(250);
      expect(loaded!.character.ascensionCount).toBe(2);
      expect(loaded!.character.restedXp).toBe(35);
      expect(loaded!.character.lastLogoutTime).toBe(1700000000000);

      // Verify inventory
      expect(loaded!.inventory).toHaveLength(20);
      expect(loaded!.inventory[0]).toEqual({ k: 60, p: { attack: 10, durability: 50 }, c: 1 });
      expect(loaded!.inventory[1]).toBeNull();
      expect(loaded!.inventory[2]).toEqual({ k: 35, p: null, c: 5 });

      // Verify achievements
      expect(loaded!.achievements.unlocked).toContain('first_blood');
      expect(loaded!.achievements.unlocked).toContain('adventurer');
      expect(loaded!.achievements.selectedTitle).toBe('first_blood');

      // Verify daily data
      expect(loaded!.daily.lastLogin).toBe('2025-08-15');
      expect(loaded!.daily.currentStreak).toBe(5);
      expect(loaded!.daily.longestStreak).toBe(12);
      expect(loaded!.daily.totalLogins).toBe(40);
    });

    it('should return null for a non-existing player', () => {
      const loaded = service.loadPlayerState('NonExistentPlayer');
      expect(loaded).toBeNull();
    });

    it('should provide default daily data when none is stored', () => {
      const created = service.createCharacter('NoDailyState', 'pass');
      const state = makePlayerSaveState({
        character: makeCharacterData({ id: created.id, name: 'NoDailyState' }),
      });

      // Save character, inventory, and achievements, but skip daily
      service.saveCharacter(state.character);
      service.saveInventory(created.id, state.inventory);
      service.saveAchievements(created.id, state.achievements);

      const loaded = service.loadPlayerState('NoDailyState');
      expect(loaded).not.toBeNull();
      expect(loaded!.daily).toEqual({
        lastLogin: '',
        currentStreak: 0,
        longestStreak: 0,
        totalLogins: 0,
      });
    });

    it('should handle round-trip with minimal character data', () => {
      const created = service.createCharacter('MinimalChar', 'pass');
      const state: PlayerSaveState = {
        character: makeCharacterData({
          id: created.id,
          name: 'MinimalChar',
          level: 1,
          xp: 0,
          gold: 0,
          armorKind: null,
          weaponKind: null,
          x: 0,
          y: 0,
          ascensionCount: 0,
          restedXp: 0,
          lastLogoutTime: 0,
        }),
        inventory: new Array(20).fill(null),
        achievements: { unlocked: [], progress: {}, selectedTitle: null },
        daily: { lastLogin: '', currentStreak: 0, longestStreak: 0, totalLogins: 0 },
      };

      service.savePlayerState(state);
      const loaded = service.loadPlayerState('MinimalChar');

      expect(loaded).not.toBeNull();
      expect(loaded!.character.level).toBe(1);
      expect(loaded!.character.xp).toBe(0);
      expect(loaded!.character.gold).toBe(0);
      expect(loaded!.character.armorKind).toBeNull();
      expect(loaded!.character.weaponKind).toBeNull();
      expect(loaded!.inventory.every(s => s === null)).toBe(true);
      expect(loaded!.achievements.unlocked).toEqual([]);
    });

    it('should persist multiple players independently', () => {
      const char1 = service.createCharacter('Player1', 'pass1');
      const char2 = service.createCharacter('Player2', 'pass2');

      const state1 = makePlayerSaveState({
        character: makeCharacterData({
          id: char1.id,
          name: 'Player1',
          level: 20,
          gold: 5000,
        }),
      });

      const state2 = makePlayerSaveState({
        character: makeCharacterData({
          id: char2.id,
          name: 'Player2',
          level: 5,
          gold: 100,
        }),
      });

      service.savePlayerState(state1);
      service.savePlayerState(state2);

      const loaded1 = service.loadPlayerState('Player1');
      const loaded2 = service.loadPlayerState('Player2');

      expect(loaded1!.character.level).toBe(20);
      expect(loaded1!.character.gold).toBe(5000);
      expect(loaded2!.character.level).toBe(5);
      expect(loaded2!.character.gold).toBe(100);
    });
  });

  // =========================================================================
  // Leaderboard Queries (via direct DB queries)
  // =========================================================================

  describe('leaderboard queries', () => {
    it('should allow querying characters ordered by level', () => {
      // Create several characters at different levels
      const names = ['LB_Alpha', 'LB_Beta', 'LB_Gamma', 'LB_Delta'];
      const levels = [15, 30, 5, 25];

      for (let i = 0; i < names.length; i++) {
        const char = service.createCharacter(names[i], 'pass');
        service.saveCharacter(makeCharacterData({
          id: char.id,
          name: names[i],
          level: levels[i],
        }));
      }

      // Query leaderboard by level using the in-memory DB directly
      const rows = memDb.prepare(
        'SELECT name, level FROM characters ORDER BY level DESC LIMIT 10'
      ).all() as { name: string; level: number }[];

      expect(rows).toHaveLength(4);
      expect(rows[0].name).toBe('LB_Beta');
      expect(rows[0].level).toBe(30);
      expect(rows[1].name).toBe('LB_Delta');
      expect(rows[1].level).toBe(25);
      expect(rows[2].name).toBe('LB_Alpha');
      expect(rows[2].level).toBe(15);
      expect(rows[3].name).toBe('LB_Gamma');
      expect(rows[3].level).toBe(5);
    });

    it('should allow querying characters ordered by gold', () => {
      const chars = [
        { name: 'Gold_A', gold: 500 },
        { name: 'Gold_B', gold: 10000 },
        { name: 'Gold_C', gold: 2500 },
      ];

      for (const c of chars) {
        const created = service.createCharacter(c.name, 'pass');
        service.saveCharacter(makeCharacterData({
          id: created.id,
          name: c.name,
          gold: c.gold,
        }));
      }

      const rows = memDb.prepare(
        'SELECT name, gold FROM characters ORDER BY gold DESC LIMIT 10'
      ).all() as { name: string; gold: number }[];

      expect(rows).toHaveLength(3);
      expect(rows[0].name).toBe('Gold_B');
      expect(rows[0].gold).toBe(10000);
      expect(rows[1].name).toBe('Gold_C');
      expect(rows[1].gold).toBe(2500);
    });

    it('should allow querying characters by ascension count', () => {
      const chars = [
        { name: 'Asc_A', ascensionCount: 0 },
        { name: 'Asc_B', ascensionCount: 5 },
        { name: 'Asc_C', ascensionCount: 3 },
      ];

      for (const c of chars) {
        const created = service.createCharacter(c.name, 'pass');
        service.saveCharacter(makeCharacterData({
          id: created.id,
          name: c.name,
          ascensionCount: c.ascensionCount,
        }));
      }

      const rows = memDb.prepare(
        'SELECT name, ascension_count FROM characters ORDER BY ascension_count DESC LIMIT 10'
      ).all() as { name: string; ascension_count: number }[];

      expect(rows).toHaveLength(3);
      expect(rows[0].name).toBe('Asc_B');
      expect(rows[0].ascension_count).toBe(5);
    });

    it('should return empty result set when no characters exist', () => {
      // The service already has no characters from previous tests since
      // each test gets a fresh in-memory DB. But let's be explicit:
      const s = new SQLiteStorageService();
      s.initialize();

      const rows = memDb.prepare(
        'SELECT name, level FROM characters ORDER BY level DESC LIMIT 10'
      ).all();

      expect(rows).toHaveLength(0);
      s.close();
    });
  });

  // =========================================================================
  // Uninitialized DB guards
  // =========================================================================

  describe('uninitialized database guards', () => {
    it('getCharacter should return null when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      // Do NOT call s.initialize()
      expect(s.getCharacter('test')).toBeNull();
    });

    it('getCharacterById should return null when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      expect(s.getCharacterById('test-id')).toBeNull();
    });

    it('saveCharacter should return false when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      expect(s.saveCharacter(makeCharacterData())).toBe(false);
    });

    it('createCharacter should throw when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      expect(() => s.createCharacter('test', 'pass')).toThrow();
    });

    it('characterExists should return false when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      expect(s.characterExists('test')).toBe(false);
    });

    it('verifyPassword should return false when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      expect(s.verifyPassword('test', 'pass')).toBe(false);
    });

    it('getInventory should return 20 null slots when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      const inv = s.getInventory('test-id');
      expect(inv).toHaveLength(20);
      expect(inv.every(slot => slot === null)).toBe(true);
    });

    it('saveInventory should return false when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      expect(s.saveInventory('test-id', [])).toBe(false);
    });

    it('getAchievements should return empty achievements when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      const ach = s.getAchievements('test-id');
      expect(ach.unlocked).toEqual([]);
      expect(ach.progress).toEqual({});
      expect(ach.selectedTitle).toBeNull();
    });

    it('saveAchievements should return false when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      expect(s.saveAchievements('test-id', makeAchievements())).toBe(false);
    });

    it('getDailyData should return null when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      expect(s.getDailyData('test-id')).toBeNull();
    });

    it('saveDailyData should return false when DB is not initialized', () => {
      const s = new SQLiteStorageService();
      expect(s.saveDailyData('test-id', makeDailyData())).toBe(false);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('should handle special characters in player name during creation', () => {
      const char = service.createCharacter("O'Brien-Test", 'pass');
      expect(char.name).toBe("O'Brien-Test");

      const found = service.getCharacter("O'Brien-Test");
      expect(found).not.toBeNull();
      expect(found!.name).toBe("O'Brien-Test");
    });

    it('should handle very large gold values', () => {
      const created = service.createCharacter('RichPlayer', 'pass');
      service.saveCharacter(makeCharacterData({
        id: created.id,
        name: 'RichPlayer',
        gold: 999999999,
      }));

      const loaded = service.getCharacter('RichPlayer');
      expect(loaded!.gold).toBe(999999999);
    });

    it('should handle zero values for all numeric character fields', () => {
      const created = service.createCharacter('ZeroPlayer', 'pass');
      service.saveCharacter(makeCharacterData({
        id: created.id,
        name: 'ZeroPlayer',
        level: 0,
        xp: 0,
        gold: 0,
        x: 0,
        y: 0,
        ascensionCount: 0,
        restedXp: 0,
        lastLogoutTime: 0,
      }));

      const loaded = service.getCharacter('ZeroPlayer');
      expect(loaded!.level).toBe(0);
      expect(loaded!.xp).toBe(0);
      expect(loaded!.gold).toBe(0);
      expect(loaded!.ascensionCount).toBe(0);
      expect(loaded!.restedXp).toBe(0);
      expect(loaded!.lastLogoutTime).toBe(0);
    });

    it('should handle inventory items with complex nested properties', () => {
      const created = service.createCharacter('ComplexInv', 'pass');
      const slots: (SerializedInventorySlot | null)[] = new Array(20).fill(null);
      slots[0] = {
        k: 60,
        p: {
          attack: 25,
          defense: 10,
          durability: 100,
          level: 5,
          enchantment: 'fire',
          bonus: 0.15,
        },
        c: 1,
      };

      service.saveInventory(created.id, slots);
      const loaded = service.getInventory(created.id);

      expect(loaded[0]!.p).toEqual({
        attack: 25,
        defense: 10,
        durability: 100,
        level: 5,
        enchantment: 'fire',
        bonus: 0.15,
      });
    });

    it('should handle rapid successive saves without data corruption', () => {
      const created = service.createCharacter('RapidSave', 'pass');

      for (let i = 1; i <= 10; i++) {
        service.saveCharacter(makeCharacterData({
          id: created.id,
          name: 'RapidSave',
          level: i,
          gold: i * 100,
        }));
      }

      const loaded = service.getCharacter('RapidSave');
      expect(loaded!.level).toBe(10);
      expect(loaded!.gold).toBe(1000);
    });

    it('loadPlayerState should load all subsystems even if some are empty', () => {
      const created = service.createCharacter('PartialPlayer', 'pass');
      // Only save character data, nothing else
      service.saveCharacter(makeCharacterData({
        id: created.id,
        name: 'PartialPlayer',
        level: 7,
      }));

      const loaded = service.loadPlayerState('PartialPlayer');
      expect(loaded).not.toBeNull();
      expect(loaded!.character.level).toBe(7);
      expect(loaded!.inventory).toHaveLength(20);
      expect(loaded!.inventory.every(s => s === null)).toBe(true);
      expect(loaded!.achievements.unlocked).toEqual([]);
      expect(loaded!.daily).toEqual({
        lastLogin: '',
        currentStreak: 0,
        longestStreak: 0,
        totalLogins: 0,
      });
    });
  });
});
