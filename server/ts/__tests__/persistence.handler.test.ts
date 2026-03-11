/**
 * Tests for PersistenceHandler
 * Covers: loadFromStorage, saveToStorage, getSaveState,
 *         round-trip persistence, equipment, inventory, achievements,
 *         progression data, daily data, skill state, and edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadFromStorage,
  saveToStorage,
  getSaveState,
  PersistencePlayerContext,
  LoadedDailyData,
} from '../player/persistence.handler';
import { IStorageService, PlayerSaveState } from '../storage/storage.interface';
import { PlayerAchievements } from '../../../shared/ts/achievements/achievement-data';
import { SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types';

// ---------------------------------------------------------------------------
// Mock the achievement service singleton so tests are fully isolated
// ---------------------------------------------------------------------------
const mockAchievementService = {
  initPlayer: vi.fn(),
  getPlayerAchievements: vi.fn<(id: string) => PlayerAchievements>(),
};

vi.mock('../achievements/achievement.service', () => ({
  getAchievementService: () => mockAchievementService,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock ProgressionService returned by ctx.getProgression() */
function makeProgressionService() {
  return {
    loadState: vi.fn(),
    level: 1,
    xp: 0,
    gold: 0,
  };
}

/** Build a minimal mock Inventory returned by ctx.getInventory() */
function makeInventory(serializedSlots: (SerializedInventorySlot | null)[] = []) {
  return {
    loadFromData: vi.fn(),
    getSerializedSlots: vi.fn().mockReturnValue(serializedSlots),
  };
}

/** Build a mock IStorageService */
function makeStorage(overrides: Partial<IStorageService> = {}): IStorageService {
  return {
    initialize: vi.fn(),
    close: vi.fn(),
    getCharacter: vi.fn().mockReturnValue(null),
    getCharacterById: vi.fn().mockReturnValue(null),
    saveCharacter: vi.fn().mockReturnValue(true),
    createCharacter: vi.fn(),
    characterExists: vi.fn().mockReturnValue(false),
    verifyPassword: vi.fn().mockReturnValue(false),
    getInventory: vi.fn().mockReturnValue([]),
    saveInventory: vi.fn().mockReturnValue(true),
    getAchievements: vi.fn().mockReturnValue({ unlocked: [], progress: {}, selectedTitle: null }),
    saveAchievements: vi.fn().mockReturnValue(true),
    getDailyData: vi.fn().mockReturnValue(null),
    saveDailyData: vi.fn().mockReturnValue(true),
    savePlayerState: vi.fn().mockReturnValue(true),
    loadPlayerState: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

/** Build a mock PersistencePlayerContext */
function makePlayerContext(overrides: Partial<PersistencePlayerContext> = {}): PersistencePlayerContext {
  const progression = makeProgressionService();
  const inventory = makeInventory();

  return {
    id: 42,
    name: 'TestHero',
    characterId: 'char-abc-123',
    x: 100,
    y: 200,
    level: 5,
    xp: 350,
    gold: 1000,
    armor: 20,
    weapon: 60,
    title: null,
    dailyData: null,
    ascensionCount: 0,
    restedXp: 0,
    lastLogoutTime: 0,
    equipArmor: vi.fn(),
    equipWeapon: vi.fn(),
    setCharacterId: vi.fn(),
    setTitle: vi.fn(),
    setDailyData: vi.fn(),
    setProgressionData: vi.fn(),
    getProgression: vi.fn().mockReturnValue(progression) as any,
    getInventory: vi.fn().mockReturnValue(inventory) as any,
    ...overrides,
  };
}

/** A complete PlayerSaveState fixture */
function makeSaveState(overrides: Partial<PlayerSaveState> = {}): PlayerSaveState {
  return {
    character: {
      id: 'char-abc-123',
      name: 'TestHero',
      level: 12,
      xp: 500,
      gold: 2500,
      armorKind: 21,
      weaponKind: 61,
      x: 150,
      y: 250,
      ascensionCount: 3,
      restedXp: 45,
      lastLogoutTime: 1700000000000,
    },
    inventory: [
      { k: 60, p: { attack: 10 }, c: 1 },
      null,
      { k: 35, p: null, c: 5 },
    ],
    achievements: {
      unlocked: ['first_blood', 'adventurer'],
      progress: { total_kills: 50, gold_earned: 2500 },
      selectedTitle: 'first_blood',
    },
    daily: {
      lastLogin: '2025-06-15',
      currentStreak: 4,
      longestStreak: 10,
      totalLogins: 30,
    },
    ...overrides,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('PersistenceHandler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAchievementService.initPlayer.mockReset();
    mockAchievementService.getPlayerAchievements.mockReset();
    mockAchievementService.getPlayerAchievements.mockReturnValue({
      unlocked: [],
      progress: {},
      selectedTitle: null,
    });
  });

  // -------------------------------------------------------------------------
  // loadFromStorage
  // -------------------------------------------------------------------------

  describe('loadFromStorage', () => {
    it('should return true when storage contains the character', () => {
      const state = makeSaveState();
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      const result = loadFromStorage(ctx, storage);

      expect(result).toBe(true);
      expect(storage.loadPlayerState).toHaveBeenCalledWith('TestHero');
    });

    it('should return false when character does not exist in storage', () => {
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(null) });
      const ctx = makePlayerContext();

      const result = loadFromStorage(ctx, storage);

      expect(result).toBe(false);
    });

    it('should set character ID from stored state', () => {
      const state = makeSaveState();
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.setCharacterId).toHaveBeenCalledWith('char-abc-123');
    });

    it('should restore progression via ProgressionService.loadState', () => {
      const state = makeSaveState();
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      const progression = ctx.getProgression();
      expect(progression.loadState).toHaveBeenCalledWith({
        level: 12,
        xp: 500,
        gold: 2500,
      });
    });

    it('should equip armor and weapon from stored kinds', () => {
      const state = makeSaveState();
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.equipArmor).toHaveBeenCalledWith(21);
      expect(ctx.equipWeapon).toHaveBeenCalledWith(61);
    });

    it('should not call equipArmor when armorKind is null', () => {
      const state = makeSaveState({
        character: { ...makeSaveState().character, armorKind: null },
      });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.equipArmor).not.toHaveBeenCalled();
    });

    it('should not call equipWeapon when weaponKind is null', () => {
      const state = makeSaveState({
        character: { ...makeSaveState().character, weaponKind: null },
      });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.equipWeapon).not.toHaveBeenCalled();
    });

    it('should restore inventory from stored data', () => {
      const state = makeSaveState();
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      const inventory = ctx.getInventory();
      expect(inventory.loadFromData).toHaveBeenCalledWith(state.inventory);
    });

    it('should initialize achievements via achievement service', () => {
      const state = makeSaveState();
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(mockAchievementService.initPlayer).toHaveBeenCalledWith(
        '42',
        state.achievements,
      );
    });

    it('should set title from stored selectedTitle', () => {
      const state = makeSaveState();
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.setTitle).toHaveBeenCalledWith('first_blood');
    });

    it('should set title to null when selectedTitle is missing', () => {
      const state = makeSaveState({
        achievements: { unlocked: [], progress: {}, selectedTitle: null },
      });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.setTitle).toHaveBeenCalledWith(null);
    });

    it('should restore daily login data when present', () => {
      const state = makeSaveState();
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.setDailyData).toHaveBeenCalledWith({
        lastLogin: '2025-06-15',
        currentStreak: 4,
        longestStreak: 10,
        totalLogins: 30,
      });
    });

    it('should not call setDailyData when daily data is absent', () => {
      const state = makeSaveState();
      (state as any).daily = undefined;
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.setDailyData).not.toHaveBeenCalled();
    });

    it('should restore progression efficiency data (ascension, rested XP, logout time)', () => {
      const state = makeSaveState();
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.setProgressionData).toHaveBeenCalledWith({
        ascensionCount: 3,
        restedXp: 45,
        lastLogoutTime: 1700000000000,
      });
    });

    it('should default ascensionCount / restedXp / lastLogoutTime to 0 when missing', () => {
      const state = makeSaveState();
      // Simulate legacy data without these fields
      delete (state.character as any).ascensionCount;
      delete (state.character as any).restedXp;
      delete (state.character as any).lastLogoutTime;
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.setProgressionData).toHaveBeenCalledWith({
        ascensionCount: 0,
        restedXp: 0,
        lastLogoutTime: 0,
      });
    });
  });

  // -------------------------------------------------------------------------
  // saveToStorage
  // -------------------------------------------------------------------------

  describe('saveToStorage', () => {
    it('should not save when characterId is null', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ characterId: null });

      saveToStorage(ctx, storage);

      expect(storage.savePlayerState).not.toHaveBeenCalled();
    });

    it('should call storage.savePlayerState with serialized state', () => {
      const serializedSlots: (SerializedInventorySlot | null)[] = [
        { k: 60, p: { attack: 5 }, c: 1 },
        null,
      ];
      const inventory = makeInventory(serializedSlots);

      const achievements: PlayerAchievements = {
        unlocked: ['first_blood'],
        progress: { total_kills: 10 },
        selectedTitle: 'first_blood',
      };
      mockAchievementService.getPlayerAchievements.mockReturnValue(achievements);

      const ctx = makePlayerContext({
        characterId: 'char-xyz',
        name: 'Hero',
        level: 10,
        xp: 200,
        gold: 500,
        armor: 21,
        weapon: 61,
        x: 55,
        y: 66,
        ascensionCount: 2,
        restedXp: 30,
        lastLogoutTime: 0,
        getInventory: vi.fn().mockReturnValue(inventory) as any,
      });

      const storage = makeStorage();

      saveToStorage(ctx, storage);

      expect(storage.savePlayerState).toHaveBeenCalledTimes(1);
      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;

      expect(saved.character.id).toBe('char-xyz');
      expect(saved.character.name).toBe('Hero');
      expect(saved.character.level).toBe(10);
      expect(saved.character.xp).toBe(200);
      expect(saved.character.gold).toBe(500);
      expect(saved.character.armorKind).toBe(21);
      expect(saved.character.weaponKind).toBe(61);
      expect(saved.character.x).toBe(55);
      expect(saved.character.y).toBe(66);
      expect(saved.character.ascensionCount).toBe(2);
      expect(saved.character.restedXp).toBe(30);
      expect(saved.character.lastLogoutTime).toBeGreaterThan(0); // Date.now()

      expect(saved.inventory).toEqual(serializedSlots);
      expect(saved.achievements).toEqual(achievements);
    });

    it('should use empty defaults when achievements are null/undefined', () => {
      mockAchievementService.getPlayerAchievements.mockReturnValue(undefined as any);
      const storage = makeStorage();
      const ctx = makePlayerContext();

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.achievements).toEqual({
        unlocked: [],
        progress: {},
        selectedTitle: null,
      });
    });

    it('should set armorKind to null when armor is 0/falsy', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ armor: 0 });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.character.armorKind).toBeNull();
    });

    it('should set weaponKind to null when weapon is 0/falsy', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ weapon: 0 });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.character.weaponKind).toBeNull();
    });

    it('should use dailyData from context when available', () => {
      const daily: LoadedDailyData = {
        lastLogin: '2025-07-01',
        currentStreak: 7,
        longestStreak: 14,
        totalLogins: 50,
      };
      const storage = makeStorage();
      const ctx = makePlayerContext({ dailyData: daily });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.daily).toEqual(daily);
    });

    it('should use empty daily defaults when dailyData is null', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ dailyData: null });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.daily).toEqual({
        lastLogin: '',
        currentStreak: 0,
        longestStreak: 0,
        totalLogins: 0,
      });
    });

    it('should fetch achievements by stringified player id', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ id: 99 });

      saveToStorage(ctx, storage);

      expect(mockAchievementService.getPlayerAchievements).toHaveBeenCalledWith('99');
    });
  });

  // -------------------------------------------------------------------------
  // getSaveState
  // -------------------------------------------------------------------------

  describe('getSaveState', () => {
    it('should return null when characterId is null', () => {
      const ctx = makePlayerContext({ characterId: null });

      const result = getSaveState(ctx);

      expect(result).toBeNull();
    });

    it('should return a complete PlayerSaveState when characterId exists', () => {
      const serializedSlots: (SerializedInventorySlot | null)[] = [
        { k: 35, p: null, c: 3 },
      ];
      const inventory = makeInventory(serializedSlots);
      const achievements: PlayerAchievements = {
        unlocked: ['centurion'],
        progress: { total_kills: 100 },
        selectedTitle: 'centurion',
      };
      mockAchievementService.getPlayerAchievements.mockReturnValue(achievements);

      const ctx = makePlayerContext({
        characterId: 'char-save',
        name: 'SaveHero',
        level: 20,
        xp: 1000,
        gold: 5000,
        armor: 22,
        weapon: 62,
        x: 300,
        y: 400,
        ascensionCount: 5,
        restedXp: 80,
        getInventory: vi.fn().mockReturnValue(inventory) as any,
      });

      const result = getSaveState(ctx);

      expect(result).not.toBeNull();
      expect(result!.character.id).toBe('char-save');
      expect(result!.character.name).toBe('SaveHero');
      expect(result!.character.level).toBe(20);
      expect(result!.character.xp).toBe(1000);
      expect(result!.character.gold).toBe(5000);
      expect(result!.character.armorKind).toBe(22);
      expect(result!.character.weaponKind).toBe(62);
      expect(result!.character.x).toBe(300);
      expect(result!.character.y).toBe(400);
      expect(result!.character.ascensionCount).toBe(5);
      expect(result!.character.restedXp).toBe(80);
      expect(result!.character.lastLogoutTime).toBeGreaterThan(0);
      expect(result!.inventory).toEqual(serializedSlots);
      expect(result!.achievements).toEqual(achievements);
    });

    it('should provide today\'s date for daily.lastLogin', () => {
      const ctx = makePlayerContext();

      const result = getSaveState(ctx);

      const today = new Date().toISOString().split('T')[0];
      expect(result!.daily.lastLogin).toBe(today);
    });

    it('should provide zero defaults for daily streak/login counts', () => {
      const ctx = makePlayerContext();

      const result = getSaveState(ctx);

      expect(result!.daily.currentStreak).toBe(0);
      expect(result!.daily.longestStreak).toBe(0);
      expect(result!.daily.totalLogins).toBe(0);
    });

    it('should fall back to empty achievements when service returns falsy', () => {
      mockAchievementService.getPlayerAchievements.mockReturnValue(undefined as any);
      const ctx = makePlayerContext();

      const result = getSaveState(ctx);

      expect(result!.achievements).toEqual({
        unlocked: [],
        progress: {},
        selectedTitle: null,
      });
    });

    it('should set armorKind/weaponKind to null when values are 0', () => {
      const ctx = makePlayerContext({ armor: 0, weapon: 0 });

      const result = getSaveState(ctx);

      expect(result!.character.armorKind).toBeNull();
      expect(result!.character.weaponKind).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Equipment persistence
  // -------------------------------------------------------------------------

  describe('equipment persistence', () => {
    it('should restore both armor and weapon on load', () => {
      const state = makeSaveState({
        character: { ...makeSaveState().character, armorKind: 25, weaponKind: 65 },
      });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.equipArmor).toHaveBeenCalledWith(25);
      expect(ctx.equipWeapon).toHaveBeenCalledWith(65);
    });

    it('should persist equipment kinds through save', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ armor: 25, weapon: 65 });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.character.armorKind).toBe(25);
      expect(saved.character.weaponKind).toBe(65);
    });

    it('should handle case where only armor is equipped (no weapon)', () => {
      const state = makeSaveState({
        character: { ...makeSaveState().character, armorKind: 22, weaponKind: null },
      });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.equipArmor).toHaveBeenCalledWith(22);
      expect(ctx.equipWeapon).not.toHaveBeenCalled();
    });

    it('should handle case where only weapon is equipped (no armor)', () => {
      const state = makeSaveState({
        character: { ...makeSaveState().character, armorKind: null, weaponKind: 62 },
      });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.equipArmor).not.toHaveBeenCalled();
      expect(ctx.equipWeapon).toHaveBeenCalledWith(62);
    });
  });

  // -------------------------------------------------------------------------
  // Inventory persistence
  // -------------------------------------------------------------------------

  describe('inventory persistence', () => {
    it('should pass stored inventory data to Inventory.loadFromData', () => {
      const inventoryData: (SerializedInventorySlot | null)[] = [
        { k: 60, p: { attack: 10, durability: 50 }, c: 1 },
        null,
        { k: 35, p: null, c: 5 },
        null,
      ];
      const state = makeSaveState({ inventory: inventoryData });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.getInventory().loadFromData).toHaveBeenCalledWith(inventoryData);
    });

    it('should serialize inventory slots on save', () => {
      const serializedSlots: (SerializedInventorySlot | null)[] = [
        { k: 60, p: { attack: 7 }, c: 1 },
        { k: 35, p: null, c: 10 },
        null,
      ];
      const inventory = makeInventory(serializedSlots);
      const ctx = makePlayerContext({
        getInventory: vi.fn().mockReturnValue(inventory) as any,
      });
      const storage = makeStorage();

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.inventory).toEqual(serializedSlots);
    });

    it('should handle empty inventory on load', () => {
      const state = makeSaveState({ inventory: [] });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.getInventory().loadFromData).toHaveBeenCalledWith([]);
    });

    it('should handle full inventory with item properties on save', () => {
      const fullSlots: (SerializedInventorySlot | null)[] = Array.from({ length: 20 }, (_, i) => ({
        k: 60 + i,
        p: { attack: i * 2 },
        c: 1,
      }));
      const inventory = makeInventory(fullSlots);
      const ctx = makePlayerContext({
        getInventory: vi.fn().mockReturnValue(inventory) as any,
      });
      const storage = makeStorage();

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.inventory).toHaveLength(20);
      expect(saved.inventory[0]).toEqual({ k: 60, p: { attack: 0 }, c: 1 });
    });
  });

  // -------------------------------------------------------------------------
  // Achievement persistence
  // -------------------------------------------------------------------------

  describe('achievement persistence', () => {
    it('should init player achievements on load with stored data', () => {
      const achievements: PlayerAchievements = {
        unlocked: ['first_blood', 'rat_slayer', 'adventurer'],
        progress: { total_kills: 75, kills_rat: 10 },
        selectedTitle: 'rat_slayer',
      };
      const state = makeSaveState({ achievements });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext({ id: 7 });

      loadFromStorage(ctx, storage);

      expect(mockAchievementService.initPlayer).toHaveBeenCalledWith('7', achievements);
      expect(ctx.setTitle).toHaveBeenCalledWith('rat_slayer');
    });

    it('should persist achievements from service on save', () => {
      const achievements: PlayerAchievements = {
        unlocked: ['centurion'],
        progress: { total_kills: 100 },
        selectedTitle: 'centurion',
      };
      mockAchievementService.getPlayerAchievements.mockReturnValue(achievements);
      const storage = makeStorage();
      const ctx = makePlayerContext({ id: 15 });

      saveToStorage(ctx, storage);

      expect(mockAchievementService.getPlayerAchievements).toHaveBeenCalledWith('15');
      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.achievements).toEqual(achievements);
    });

    it('should handle empty unlocked list on load', () => {
      const achievements: PlayerAchievements = {
        unlocked: [],
        progress: {},
        selectedTitle: null,
      };
      const state = makeSaveState({ achievements });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(mockAchievementService.initPlayer).toHaveBeenCalledWith('42', achievements);
      expect(ctx.setTitle).toHaveBeenCalledWith(null);
    });
  });

  // -------------------------------------------------------------------------
  // Progression data (level, XP, gold, ascension count)
  // -------------------------------------------------------------------------

  describe('progression data persistence', () => {
    it('should restore level, xp, and gold via progression service', () => {
      const state = makeSaveState({
        character: { ...makeSaveState().character, level: 30, xp: 999, gold: 10000 },
      });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.getProgression().loadState).toHaveBeenCalledWith({
        level: 30,
        xp: 999,
        gold: 10000,
      });
    });

    it('should persist ascensionCount in saved state', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ ascensionCount: 7 });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.character.ascensionCount).toBe(7);
    });

    it('should persist restedXp in saved state', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ restedXp: 55 });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.character.restedXp).toBe(55);
    });

    it('should set lastLogoutTime to current timestamp on save', () => {
      const before = Date.now();
      const storage = makeStorage();
      const ctx = makePlayerContext();

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      const after = Date.now();
      expect(saved.character.lastLogoutTime).toBeGreaterThanOrEqual(before);
      expect(saved.character.lastLogoutTime).toBeLessThanOrEqual(after);
    });

    it('should restore level 1 character correctly', () => {
      const state = makeSaveState({
        character: {
          ...makeSaveState().character,
          level: 1,
          xp: 0,
          gold: 0,
          ascensionCount: 0,
          restedXp: 0,
          lastLogoutTime: 0,
        },
      });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.getProgression().loadState).toHaveBeenCalledWith({
        level: 1,
        xp: 0,
        gold: 0,
      });
      expect(ctx.setProgressionData).toHaveBeenCalledWith({
        ascensionCount: 0,
        restedXp: 0,
        lastLogoutTime: 0,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Daily data persistence
  // -------------------------------------------------------------------------

  describe('daily data persistence', () => {
    it('should restore all daily data fields on load', () => {
      const daily = {
        lastLogin: '2025-12-25',
        currentStreak: 15,
        longestStreak: 30,
        totalLogins: 200,
      };
      const state = makeSaveState({ daily });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.setDailyData).toHaveBeenCalledWith(daily);
    });

    it('should persist non-null dailyData from context on save', () => {
      const daily: LoadedDailyData = {
        lastLogin: '2025-11-11',
        currentStreak: 3,
        longestStreak: 20,
        totalLogins: 100,
      };
      const storage = makeStorage();
      const ctx = makePlayerContext({ dailyData: daily });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.daily).toEqual(daily);
    });

    it('should handle daily data with zero streak on load', () => {
      const daily = {
        lastLogin: '2025-01-01',
        currentStreak: 0,
        longestStreak: 0,
        totalLogins: 1,
      };
      const state = makeSaveState({ daily });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      expect(ctx.setDailyData).toHaveBeenCalledWith(daily);
    });
  });

  // -------------------------------------------------------------------------
  // Round-trip: save then load preserves all data
  // -------------------------------------------------------------------------

  describe('round-trip persistence', () => {
    it('should preserve all character fields through a save-load cycle', () => {
      const serializedSlots: (SerializedInventorySlot | null)[] = [
        { k: 60, p: { attack: 15 }, c: 1 },
        null,
        { k: 35, p: null, c: 8 },
      ];
      const achievements: PlayerAchievements = {
        unlocked: ['first_blood', 'adventurer'],
        progress: { total_kills: 50, gold_earned: 1000 },
        selectedTitle: 'first_blood',
      };
      const daily: LoadedDailyData = {
        lastLogin: '2025-08-20',
        currentStreak: 5,
        longestStreak: 12,
        totalLogins: 40,
      };

      mockAchievementService.getPlayerAchievements.mockReturnValue(achievements);

      const inventory = makeInventory(serializedSlots);
      const saveCtx = makePlayerContext({
        characterId: 'char-roundtrip',
        name: 'RoundTripper',
        level: 18,
        xp: 750,
        gold: 3200,
        armor: 23,
        weapon: 63,
        x: 400,
        y: 500,
        ascensionCount: 2,
        restedXp: 60,
        dailyData: daily,
        getInventory: vi.fn().mockReturnValue(inventory) as any,
      });

      // Capture what saveToStorage passes to storage
      let capturedState: PlayerSaveState | null = null;
      const storage = makeStorage({
        savePlayerState: vi.fn().mockImplementation((state: PlayerSaveState) => {
          capturedState = state;
          return true;
        }),
        loadPlayerState: vi.fn().mockImplementation(() => capturedState),
      });

      // Save
      saveToStorage(saveCtx, storage);
      expect(capturedState).not.toBeNull();

      // Load into a fresh context
      const loadCtx = makePlayerContext({ name: 'RoundTripper' });
      const loaded = loadFromStorage(loadCtx, storage);

      expect(loaded).toBe(true);
      expect(loadCtx.setCharacterId).toHaveBeenCalledWith('char-roundtrip');
      expect(loadCtx.getProgression().loadState).toHaveBeenCalledWith({
        level: 18,
        xp: 750,
        gold: 3200,
      });
      expect(loadCtx.equipArmor).toHaveBeenCalledWith(23);
      expect(loadCtx.equipWeapon).toHaveBeenCalledWith(63);
      expect(loadCtx.getInventory().loadFromData).toHaveBeenCalledWith(serializedSlots);
      expect(mockAchievementService.initPlayer).toHaveBeenCalledWith('42', achievements);
      expect(loadCtx.setTitle).toHaveBeenCalledWith('first_blood');
      expect(loadCtx.setDailyData).toHaveBeenCalledWith(daily);
      expect(loadCtx.setProgressionData).toHaveBeenCalledWith({
        ascensionCount: 2,
        restedXp: 60,
        lastLogoutTime: capturedState!.character.lastLogoutTime,
      });
    });

    it('should preserve a bare-minimum character through a save-load cycle', () => {
      mockAchievementService.getPlayerAchievements.mockReturnValue(undefined as any);
      const inventory = makeInventory([]);

      const saveCtx = makePlayerContext({
        characterId: 'char-minimal',
        name: 'MinimalPlayer',
        level: 1,
        xp: 0,
        gold: 0,
        armor: 0,
        weapon: 0,
        x: 0,
        y: 0,
        ascensionCount: 0,
        restedXp: 0,
        dailyData: null,
        getInventory: vi.fn().mockReturnValue(inventory) as any,
      });

      let capturedState: PlayerSaveState | null = null;
      const storage = makeStorage({
        savePlayerState: vi.fn().mockImplementation((state: PlayerSaveState) => {
          capturedState = state;
          return true;
        }),
        loadPlayerState: vi.fn().mockImplementation(() => capturedState),
      });

      saveToStorage(saveCtx, storage);

      const loadCtx = makePlayerContext({ name: 'MinimalPlayer' });
      const loaded = loadFromStorage(loadCtx, storage);

      expect(loaded).toBe(true);
      expect(loadCtx.setCharacterId).toHaveBeenCalledWith('char-minimal');
      expect(loadCtx.equipArmor).not.toHaveBeenCalled();
      expect(loadCtx.equipWeapon).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('loadFromStorage should not mutate the stored state object', () => {
      const state = makeSaveState();
      const stateCopy = JSON.parse(JSON.stringify(state));
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      // The daily and character sub-objects should remain structurally equal
      expect(state.character).toEqual(stateCopy.character);
      expect(state.daily).toEqual(stateCopy.daily);
      expect(state.achievements).toEqual(stateCopy.achievements);
    });

    it('saveToStorage should handle ascensionCount of 0 without coercion issues', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ ascensionCount: 0, restedXp: 0 });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.character.ascensionCount).toBe(0);
      expect(saved.character.restedXp).toBe(0);
    });

    it('getSaveState should handle the player having no achievements at all', () => {
      mockAchievementService.getPlayerAchievements.mockReturnValue(null as any);

      const ctx = makePlayerContext();
      const result = getSaveState(ctx);

      expect(result!.achievements).toEqual({
        unlocked: [],
        progress: {},
        selectedTitle: null,
      });
    });

    it('loadFromStorage should use player name to look up state', () => {
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(null) });
      const ctx = makePlayerContext({ name: 'UniquePlayerName' });

      loadFromStorage(ctx, storage);

      expect(storage.loadPlayerState).toHaveBeenCalledWith('UniquePlayerName');
    });

    it('saveToStorage should log a warning and bail if characterId is falsy', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = makeStorage();
      const ctx = makePlayerContext({ characterId: null });

      saveToStorage(ctx, storage);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot save player'),
      );
      expect(storage.savePlayerState).not.toHaveBeenCalled();
    });

    it('getSaveState should record a recent lastLogoutTime (not stale)', () => {
      const before = Date.now();
      const ctx = makePlayerContext();

      const result = getSaveState(ctx);

      const after = Date.now();
      expect(result!.character.lastLogoutTime).toBeGreaterThanOrEqual(before);
      expect(result!.character.lastLogoutTime).toBeLessThanOrEqual(after);
    });

    it('saveToStorage should store position (x, y) correctly', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ x: 999, y: 888 });

      saveToStorage(ctx, storage);

      const saved = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls[0][0] as PlayerSaveState;
      expect(saved.character.x).toBe(999);
      expect(saved.character.y).toBe(888);
    });

    it('loadFromStorage should handle state with selectedTitle as empty string', () => {
      const state = makeSaveState({
        achievements: {
          unlocked: [],
          progress: {},
          selectedTitle: '',
        },
      });
      const storage = makeStorage({ loadPlayerState: vi.fn().mockReturnValue(state) });
      const ctx = makePlayerContext();

      loadFromStorage(ctx, storage);

      // Empty string is falsy, so || null makes it null
      expect(ctx.setTitle).toHaveBeenCalledWith(null);
    });

    it('multiple sequential saves should each capture the current state', () => {
      const storage = makeStorage();
      const ctx = makePlayerContext({ level: 5, gold: 100 });

      saveToStorage(ctx, storage);

      // Mutate context to simulate gameplay
      ctx.level = 6;
      ctx.gold = 200;

      saveToStorage(ctx, storage);

      const calls = (storage.savePlayerState as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).toHaveLength(2);
      expect((calls[0][0] as PlayerSaveState).character.level).toBe(5);
      expect((calls[0][0] as PlayerSaveState).character.gold).toBe(100);
      expect((calls[1][0] as PlayerSaveState).character.level).toBe(6);
      expect((calls[1][0] as PlayerSaveState).character.gold).toBe(200);
    });
  });
});
