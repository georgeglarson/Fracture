/**
 * Storage Service Interface
 *
 * Abstract interface for player data persistence.
 * Allows swapping between SQLite (MVP) and PostgreSQL (future).
 */

import { SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types.js';
import { PlayerAchievements } from '../../../shared/ts/achievements/achievement-data.js';

/**
 * Character data stored in database
 */
export interface CharacterData {
  id: string;
  name: string;
  level: number;
  xp: number;
  gold: number;
  armorKind: number | null;
  weaponKind: number | null;
  x: number;
  y: number;
  createdAt?: string;
  lastSaved?: string;

  // Progression system
  ascensionCount: number;       // Number of times prestige/ascended
  restedXp: number;             // Bonus XP % accumulated while offline (0-100)
  lastLogoutTime: number;       // Timestamp of last logout for rested XP calc
}

/**
 * Daily login data
 */
export interface DailyData {
  lastLogin: string;
  currentStreak: number;
  longestStreak: number;
  totalLogins: number;
}

/**
 * Full player save state for persistence
 */
export interface PlayerSaveState {
  character: CharacterData;
  inventory: (SerializedInventorySlot | null)[];
  achievements: PlayerAchievements;
  daily: DailyData;
}

/**
 * Storage service interface
 * All methods are synchronous for better-sqlite3 compatibility.
 * Save methods return boolean for success/failure indication.
 * Get methods return null on failure for graceful degradation.
 */
export interface IStorageService {
  // Lifecycle
  initialize(): void;
  close(): void;

  // Character
  getCharacter(name: string): CharacterData | null;
  getCharacterById(id: string): CharacterData | null;
  saveCharacter(data: CharacterData): boolean;
  createCharacter(name: string, password: string): CharacterData;
  characterExists(name: string): boolean;
  verifyPassword(name: string, password: string): boolean;

  // Inventory
  getInventory(characterId: string): (SerializedInventorySlot | null)[];
  saveInventory(characterId: string, slots: (SerializedInventorySlot | null)[]): boolean;

  // Achievements
  getAchievements(characterId: string): PlayerAchievements;
  saveAchievements(characterId: string, data: PlayerAchievements): boolean;

  // Daily login
  getDailyData(characterId: string): DailyData | null;
  saveDailyData(characterId: string, data: DailyData): boolean;

  // Convenience: Save all player data at once
  savePlayerState(state: PlayerSaveState): boolean;

  // Convenience: Load all player data at once
  loadPlayerState(characterName: string): PlayerSaveState | null;
}
