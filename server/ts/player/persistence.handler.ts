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

  // Methods
  equipArmor: (kind: number) => void;
  equipWeapon: (kind: number) => void;
  setCharacterId: (id: string) => void;
  setTitle: (title: string | null) => void;

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

  console.log(`[Storage] Loaded character ${ctx.name} (${ctx.characterId}): Level ${ctx.level}, Gold ${ctx.gold}`);

  return true;
}

/**
 * Save player state to storage
 */
export function saveToStorage(ctx: PersistencePlayerContext, storage: IStorageService): void {
  if (!ctx.characterId) {
    console.warn(`[Storage] Cannot save player ${ctx.name}: No character ID`);
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
      y: ctx.y
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

  storage.savePlayerState(state);
  console.log(`[Storage] Saved character ${ctx.name} (${ctx.characterId})`);
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
      y: ctx.y
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
