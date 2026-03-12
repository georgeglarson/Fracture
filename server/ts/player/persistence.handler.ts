/**
 * PersistenceHandler - Handles all save/load operations for players
 *
 * Single Responsibility: Saving and loading player state
 * Extracted from Player.ts to reduce its size.
 */

import { getAchievementService } from '../achievements/achievement.service';
import { IStorageService, PlayerSaveState } from '../storage/storage.interface';
import { Inventory } from '../inventory/inventory';
import { ProgressionService } from './progression.service';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Persistence');

/**
 * Daily data loaded from storage
 */
export interface LoadedDailyData {
  lastLogin: string;
  currentStreak: number;
  longestStreak: number;
  totalLogins: number;
}

/**
 * Player context for persistence operations
 */
export interface PersistencePlayerContext {
  id: number;
  name: string;
  characterId: string | null;
  x: number;
  y: number;
  level: number;
  xp: number;
  gold: number;
  armor: number;
  weapon: number;
  title: string | null;
  dailyData: LoadedDailyData | null;

  // Progression efficiency data
  ascensionCount: number;
  restedXp: number;
  lastLogoutTime: number;

  // Methods
  equipArmor: (kind: number) => void;
  equipWeapon: (kind: number) => void;
  setCharacterId: (id: string) => void;
  setTitle: (title: string | null) => void;
  setDailyData: (data: LoadedDailyData) => void;
  setProgressionData: (data: { ascensionCount: number; restedXp: number; lastLogoutTime: number }) => void;

  // Service access
  getProgression: () => ProgressionService;
  getInventory: () => Inventory;
}

/**
 * Load player state from storage
 * Returns true if character was found and loaded, false if new character
 */
export function loadFromStorage(ctx: PersistencePlayerContext, storage: IStorageService): boolean {
  const state = storage.loadPlayerState(ctx.name);
  if (!state) {
    return false;
  }

  // Set character ID
  ctx.setCharacterId(state.character.id);

  // Restore progression (use service's loadState for consistency)
  ctx.getProgression().loadState({
    level: state.character.level,
    xp: state.character.xp,
    gold: state.character.gold
  });

  // Restore equipment (if any)
  if (state.character.armorKind) {
    ctx.equipArmor(state.character.armorKind);
  }
  if (state.character.weaponKind) {
    ctx.equipWeapon(state.character.weaponKind);
  }

  // Restore inventory
  ctx.getInventory().loadFromData(state.inventory);

  // Restore achievements
  const achievementService = getAchievementService();
  achievementService.initPlayer(String(ctx.id), state.achievements);
  ctx.setTitle(state.achievements.selectedTitle || null);

  // Restore daily login data
  if (state.daily) {
    ctx.setDailyData({
      lastLogin: state.daily.lastLogin,
      currentStreak: state.daily.currentStreak,
      longestStreak: state.daily.longestStreak,
      totalLogins: state.daily.totalLogins
    });
  }

  // Restore progression efficiency data
  ctx.setProgressionData({
    ascensionCount: state.character.ascensionCount || 0,
    restedXp: state.character.restedXp || 0,
    lastLogoutTime: state.character.lastLogoutTime || 0
  });

  log.info({ characterId: ctx.characterId, playerName: ctx.name, level: ctx.level, gold: ctx.gold, ascension: state.character.ascensionCount || 0, streak: state.daily?.currentStreak || 0 }, 'Loaded character');

  return true;
}

/**
 * Save player state to storage
 */
export function saveToStorage(ctx: PersistencePlayerContext, storage: IStorageService): void {
  if (!ctx.characterId) {
    log.warn({ playerName: ctx.name }, 'Cannot save player: No character ID');
    return;
  }

  const achievementService = getAchievementService();
  const achievements = achievementService.getPlayerAchievements(String(ctx.id));

  const state: PlayerSaveState = {
    character: {
      id: ctx.characterId,
      name: ctx.name,
      level: ctx.level,
      xp: ctx.xp,
      gold: ctx.gold,
      armorKind: ctx.armor || null,
      weaponKind: ctx.weapon || null,
      x: ctx.x,
      y: ctx.y,
      ascensionCount: ctx.ascensionCount || 0,
      restedXp: ctx.restedXp || 0,
      lastLogoutTime: Date.now()
    },
    inventory: ctx.getInventory().getSerializedSlots(),
    achievements: achievements || { unlocked: [], progress: {}, selectedTitle: null },
    daily: ctx.dailyData || {
      lastLogin: '',
      currentStreak: 0,
      longestStreak: 0,
      totalLogins: 0
    }
  };

  storage.savePlayerState(state);
  log.info({ characterId: ctx.characterId, playerName: ctx.name, level: ctx.level, xp: ctx.xp, gold: ctx.gold }, 'Saved character');
}

/**
 * Get the full save state for this player
 */
export function getSaveState(ctx: PersistencePlayerContext): PlayerSaveState | null {
  if (!ctx.characterId) {
    return null;
  }

  const achievementService = getAchievementService();
  const achievements = achievementService.getPlayerAchievements(String(ctx.id));

  return {
    character: {
      id: ctx.characterId,
      name: ctx.name,
      level: ctx.level,
      xp: ctx.xp,
      gold: ctx.gold,
      armorKind: ctx.armor || null,
      weaponKind: ctx.weapon || null,
      x: ctx.x,
      y: ctx.y,
      ascensionCount: ctx.ascensionCount || 0,
      restedXp: ctx.restedXp || 0,
      lastLogoutTime: Date.now()
    },
    inventory: ctx.getInventory().getSerializedSlots(),
    achievements: achievements || { unlocked: [], progress: {}, selectedTitle: null },
    daily: {
      lastLogin: new Date().toISOString().split('T')[0],
      currentStreak: 0,
      longestStreak: 0,
      totalLogins: 0
    }
  };
}
