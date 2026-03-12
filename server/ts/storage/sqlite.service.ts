/**
 * SQLite Storage Service
 *
 * Implements IStorageService using better-sqlite3 for synchronous database access.
 * This is the MVP storage solution - zero infrastructure, single file.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  IStorageService,
  CharacterData,
  DailyData,
  PlayerSaveState
} from './storage.interface.js';
import { SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types.js';
import { PlayerAchievements, createEmptyPlayerAchievements } from '../../../shared/ts/achievements/achievement-data.js';
import { createModuleLogger } from '../utils/logger.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const log = createModuleLogger('Storage');
const tracer = trace.getTracer('fracture-server');

const DB_PATH = path.join(process.cwd(), 'server', 'data', 'fracture.db');

/**
 * Storage operation error with context
 */
class StorageError extends Error {
  constructor(operation: string, cause?: Error) {
    super(`Storage error in ${operation}: ${cause?.message || 'unknown error'}`);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

interface CharacterRow {
  id: string; name: string; level: number; xp: number; gold: number;
  armor_kind: number; weapon_kind: number; x: number; y: number;
  created_at: string; last_saved: string;
  ascension_count: number; rested_xp: number; last_logout_time: number;
}
interface PasswordRow { password_hash: string; }
interface InventoryRow { slot: number; item_kind: number; count: number; properties: string | null; }
interface AchievementRow { achievement_id: string; progress: number; unlocked_at: string | null; }
interface TitleRow { selected_title: string | null; }
interface DailyRow { last_login: string; current_streak: number; longest_streak: number; total_logins: number; }
interface RiftLeaderboardRow {
  player_name: string;
  max_depth: number;
  total_kills: number;
  completion_time: number;
  modifier_count: number;
  timestamp: number;
}

export class SQLiteStorageService implements IStorageService {
  private db: Database.Database | null = null;

  /**
   * Initialize database and create tables
   */
  initialize(): void {
    log.info({ path: DB_PATH }, 'Initializing SQLite database');

    try {
      // Ensure data directory exists
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        log.info({ dataDir }, 'Created data directory');
      }

      this.db = new Database(DB_PATH);
      this.db.pragma('journal_mode = WAL');

      // Create tables
      this.createTables();

      log.info('Database initialized successfully');
    } catch (error) {
      log.error({ err: error }, 'Failed to initialize database');
      throw new StorageError('initialize', error as Error);
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      log.info('Database connection closed');
    }
  }

  /**
   * Create database tables if they don't exist
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Characters table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        gold INTEGER DEFAULT 0,
        armor_kind INTEGER,
        weapon_kind INTEGER,
        x INTEGER DEFAULT 0,
        y INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_saved DATETIME
      )
    `);

    // Migration: Add password_hash column if missing (for existing DBs)
    try {
      this.db.exec(`ALTER TABLE characters ADD COLUMN password_hash TEXT`);
      log.info('Added password_hash column to existing database');
    } catch (e) {
      // Column already exists, ignore
    }

    // Migration: Add progression system columns
    try {
      this.db.exec(`ALTER TABLE characters ADD COLUMN ascension_count INTEGER DEFAULT 0`);
      log.info('Added ascension_count column');
    } catch (e) { /* Column already exists */ }

    try {
      this.db.exec(`ALTER TABLE characters ADD COLUMN rested_xp REAL DEFAULT 0`);
      log.info('Added rested_xp column');
    } catch (e) { /* Column already exists */ }

    try {
      this.db.exec(`ALTER TABLE characters ADD COLUMN last_logout_time INTEGER DEFAULT 0`);
      log.info('Added last_logout_time column');
    } catch (e) { /* Column already exists */ }

    // Inventory table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        character_id TEXT NOT NULL,
        slot INTEGER NOT NULL,
        item_kind INTEGER NOT NULL,
        count INTEGER DEFAULT 1,
        properties TEXT,
        PRIMARY KEY (character_id, slot),
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    // Achievements table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS achievements (
        character_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        unlocked_at DATETIME,
        PRIMARY KEY (character_id, achievement_id),
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    // Selected title table (separate for easy update)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS character_titles (
        character_id TEXT PRIMARY KEY,
        selected_title TEXT,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    // Daily login table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_logins (
        character_id TEXT PRIMARY KEY,
        last_login TEXT,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        total_logins INTEGER DEFAULT 0,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      )
    `);

    // Rift leaderboard table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rift_leaderboard (
        player_name TEXT PRIMARY KEY,
        max_depth INTEGER NOT NULL,
        total_kills INTEGER NOT NULL,
        completion_time INTEGER NOT NULL,
        modifier_count INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL
      )
    `);

    // Create indexes for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
      CREATE INDEX IF NOT EXISTS idx_inventory_character ON inventory(character_id);
      CREATE INDEX IF NOT EXISTS idx_achievements_character ON achievements(character_id);
    `);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Hash a password using SHA-256 with salt
   */
  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify a password against a stored hash
   */
  private checkPassword(password: string, storedHash: string): boolean {
    if (!storedHash) return false;
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const checkHash = crypto.createHash('sha256').update(password + salt).digest('hex');
    return hash === checkHash;
  }

  // ============ Character Methods ============

  getCharacter(name: string): CharacterData | null {
    if (!this.db) {
      log.error('getCharacter: Database not initialized');
      return null;
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, name, level, xp, gold, armor_kind, weapon_kind, x, y,
               created_at, last_saved, ascension_count, rested_xp, last_logout_time
        FROM characters WHERE name = ?
      `);

      const row = stmt.get(name) as CharacterRow | undefined;
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        level: row.level,
        xp: row.xp,
        gold: row.gold,
        armorKind: row.armor_kind,
        weaponKind: row.weapon_kind,
        x: row.x,
        y: row.y,
        createdAt: row.created_at,
        lastSaved: row.last_saved,
        ascensionCount: row.ascension_count || 0,
        restedXp: row.rested_xp || 0,
        lastLogoutTime: row.last_logout_time || 0
      };
    } catch (error) {
      log.error({ err: error, characterName: name }, 'getCharacter failed');
      return null;
    }
  }

  getCharacterById(id: string): CharacterData | null {
    if (!this.db) {
      log.error('getCharacterById: Database not initialized');
      return null;
    }

    try {
      const stmt = this.db.prepare(`
        SELECT id, name, level, xp, gold, armor_kind, weapon_kind, x, y,
               created_at, last_saved, ascension_count, rested_xp, last_logout_time
        FROM characters WHERE id = ?
      `);

      const row = stmt.get(id) as CharacterRow | undefined;
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        level: row.level,
        xp: row.xp,
        gold: row.gold,
        armorKind: row.armor_kind,
        weaponKind: row.weapon_kind,
        x: row.x,
        y: row.y,
        createdAt: row.created_at,
        lastSaved: row.last_saved,
        ascensionCount: row.ascension_count || 0,
        restedXp: row.rested_xp || 0,
        lastLogoutTime: row.last_logout_time || 0
      };
    } catch (error) {
      log.error({ err: error, characterId: id }, 'getCharacterById failed');
      return null;
    }
  }

  saveCharacter(data: CharacterData): boolean {
    if (!this.db) {
      log.error('saveCharacter: Database not initialized');
      return false;
    }

    return tracer.startActiveSpan('storage.saveCharacter', (span) => {
      span.setAttributes({
        'db.operation': 'saveCharacter',
        'character.id': data.id,
        'character.name': data.name,
        'character.level': data.level,
        'character.xp': data.xp,
        'character.gold': data.gold,
      });

      try {
        const stmt = this.db!.prepare(`
          UPDATE characters
          SET level = ?, xp = ?, gold = ?, armor_kind = ?, weapon_kind = ?,
              x = ?, y = ?, last_saved = CURRENT_TIMESTAMP,
              ascension_count = ?, rested_xp = ?, last_logout_time = ?
          WHERE id = ?
        `);

        stmt.run(
          data.level,
          data.xp,
          data.gold,
          data.armorKind,
          data.weaponKind,
          data.x,
          data.y,
          data.ascensionCount || 0,
          data.restedXp || 0,
          data.lastLogoutTime || 0,
          data.id
        );
        span.end();
        return true;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        span.end();
        log.error({ err: error, characterId: data.id, characterName: data.name, level: data.level, xp: data.xp }, 'saveCharacter failed');
        return false;
      }
    });
  }

  createCharacter(name: string, password: string): CharacterData {
    if (!this.db) {
      throw new StorageError('createCharacter', new Error('Database not initialized'));
    }

    return tracer.startActiveSpan('storage.createCharacter', (span) => {
      span.setAttributes({ 'db.operation': 'createCharacter', 'character.name': name });

      try {
        const id = this.generateId();
        const passwordHash = this.hashPassword(password);
        const stmt = this.db!.prepare(`
          INSERT INTO characters (id, name, password_hash, level, xp, gold, x, y)
          VALUES (?, ?, ?, 1, 0, 0, 0, 0)
        `);

        stmt.run(id, name, passwordHash);

        span.setAttribute('character.id', id);
        log.info({ characterId: id, characterName: name }, 'Created new character');

      return {
        id,
        name,
        level: 1,
        xp: 0,
        gold: 0,
        armorKind: null,
        weaponKind: null,
        x: 0,
        y: 0,
        ascensionCount: 0,
        restedXp: 0,
        lastLogoutTime: 0
      };
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      log.error({ err: error, characterName: name }, 'createCharacter failed');
      throw new StorageError('createCharacter', error as Error);
    } finally {
      span.end();
    }
    });
  }

  characterExists(name: string): boolean {
    if (!this.db) {
      log.error('characterExists: Database not initialized');
      return false;
    }

    try {
      const stmt = this.db.prepare('SELECT 1 FROM characters WHERE name = ?');
      return stmt.get(name) !== undefined;
    } catch (error) {
      log.error({ err: error, characterName: name }, 'characterExists failed');
      return false;
    }
  }

  /**
   * Verify password for a character
   * Returns true if password matches, false otherwise
   */
  verifyPassword(name: string, password: string): boolean {
    if (!this.db) {
      log.error('verifyPassword: Database not initialized');
      return false;
    }

    try {
      const stmt = this.db.prepare('SELECT password_hash FROM characters WHERE name = ?');
      const row = stmt.get(name) as PasswordRow | undefined;
      if (!row) return false;

      return this.checkPassword(password, row.password_hash);
    } catch (error) {
      log.error({ err: error, characterName: name }, 'verifyPassword failed');
      return false;
    }
  }

  // ============ Inventory Methods ============

  getInventory(characterId: string): (SerializedInventorySlot | null)[] {
    if (!this.db) {
      log.error('getInventory: Database not initialized');
      return new Array(20).fill(null);
    }

    try {
      const stmt = this.db.prepare(`
        SELECT slot, item_kind, count, properties
        FROM inventory WHERE character_id = ?
        ORDER BY slot
      `);

      const rows = stmt.all(characterId) as InventoryRow[];

      // Create 20-slot array
      const inventory: (SerializedInventorySlot | null)[] = new Array(20).fill(null);

      for (const row of rows) {
        if (row.slot >= 0 && row.slot < 20) {
          inventory[row.slot] = {
            k: row.item_kind,
            c: row.count,
            p: row.properties ? JSON.parse(row.properties) : null
          };
        }
      }

      return inventory;
    } catch (error) {
      log.error({ err: error, characterId }, 'getInventory failed');
      return new Array(20).fill(null);
    }
  }

  saveInventory(characterId: string, slots: (SerializedInventorySlot | null)[]): boolean {
    if (!this.db) {
      log.error('saveInventory: Database not initialized');
      return false;
    }

    try {
      // Delete existing inventory
      const deleteStmt = this.db.prepare('DELETE FROM inventory WHERE character_id = ?');
      deleteStmt.run(characterId);

      // Insert new inventory
      const insertStmt = this.db.prepare(`
        INSERT INTO inventory (character_id, slot, item_kind, count, properties)
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((slots: (SerializedInventorySlot | null)[]) => {
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          if (slot) {
            insertStmt.run(
              characterId,
              i,
              slot.k,
              slot.c || 1,
              slot.p ? JSON.stringify(slot.p) : null
            );
          }
        }
      });

      insertMany(slots);
      return true;
    } catch (error) {
      log.error({ err: error, characterId }, 'saveInventory failed');
      return false;
    }
  }

  // ============ Achievements Methods ============

  getAchievements(characterId: string): PlayerAchievements {
    if (!this.db) {
      log.error('getAchievements: Database not initialized');
      return createEmptyPlayerAchievements();
    }

    try {
      // Get unlocked achievements
      const achievementStmt = this.db.prepare(`
        SELECT achievement_id, progress, unlocked_at
        FROM achievements WHERE character_id = ?
      `);
      const rows = achievementStmt.all(characterId) as AchievementRow[];

      // Get selected title
      const titleStmt = this.db.prepare(`
        SELECT selected_title FROM character_titles WHERE character_id = ?
      `);
      const titleRow = titleStmt.get(characterId) as TitleRow | undefined;

      const unlocked: string[] = [];
      const progress: Record<string, number> = {};

      for (const row of rows) {
        if (row.unlocked_at) {
          unlocked.push(row.achievement_id);
        }
        if (row.progress > 0) {
          progress[row.achievement_id] = row.progress;
        }
      }

      return {
        unlocked,
        progress,
        selectedTitle: titleRow?.selected_title || null
      };
    } catch (error) {
      log.error({ err: error, characterId }, 'getAchievements failed');
      return createEmptyPlayerAchievements();
    }
  }

  saveAchievements(characterId: string, data: PlayerAchievements): boolean {
    if (!this.db) {
      log.error('saveAchievements: Database not initialized');
      return false;
    }

    try {
      // Save selected title
      const titleStmt = this.db.prepare(`
        INSERT INTO character_titles (character_id, selected_title)
        VALUES (?, ?)
        ON CONFLICT(character_id) DO UPDATE SET selected_title = excluded.selected_title
      `);
      titleStmt.run(characterId, data.selectedTitle);

      // Save achievements (upsert)
      const upsertStmt = this.db.prepare(`
        INSERT INTO achievements (character_id, achievement_id, progress, unlocked_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(character_id, achievement_id) DO UPDATE SET
          progress = excluded.progress,
          unlocked_at = COALESCE(achievements.unlocked_at, excluded.unlocked_at)
      `);

      const saveMany = this.db.transaction((achievements: PlayerAchievements) => {
        // Save unlocked achievements
        for (const achievementId of achievements.unlocked) {
          const progress = achievements.progress[achievementId] || 0;
          upsertStmt.run(characterId, achievementId, progress, new Date().toISOString());
        }

        // Save progress for non-unlocked achievements
        for (const [achievementId, progressValue] of Object.entries(achievements.progress)) {
          if (!achievements.unlocked.includes(achievementId)) {
            upsertStmt.run(characterId, achievementId, progressValue, null);
          }
        }
      });

      saveMany(data);
      return true;
    } catch (error) {
      log.error({ err: error, characterId }, 'saveAchievements failed');
      return false;
    }
  }

  // ============ Daily Login Methods ============

  getDailyData(characterId: string): DailyData | null {
    if (!this.db) {
      log.error('getDailyData: Database not initialized');
      return null;
    }

    try {
      const stmt = this.db.prepare(`
        SELECT last_login, current_streak, longest_streak, total_logins
        FROM daily_logins WHERE character_id = ?
      `);

      const row = stmt.get(characterId) as DailyRow | undefined;
      if (!row) return null;

      return {
        lastLogin: row.last_login,
        currentStreak: row.current_streak,
        longestStreak: row.longest_streak,
        totalLogins: row.total_logins
      };
    } catch (error) {
      log.error({ err: error, characterId }, 'getDailyData failed');
      return null;
    }
  }

  saveDailyData(characterId: string, data: DailyData): boolean {
    if (!this.db) {
      log.error('saveDailyData: Database not initialized');
      return false;
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO daily_logins (character_id, last_login, current_streak, longest_streak, total_logins)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(character_id) DO UPDATE SET
          last_login = excluded.last_login,
          current_streak = excluded.current_streak,
          longest_streak = excluded.longest_streak,
          total_logins = excluded.total_logins
      `);

      stmt.run(
        characterId,
        data.lastLogin,
        data.currentStreak,
        data.longestStreak,
        data.totalLogins
      );
      return true;
    } catch (error) {
      log.error({ err: error, characterId }, 'saveDailyData failed');
      return false;
    }
  }

  // ============ Rift Leaderboard Methods ============

  saveRiftEntry(entry: { playerName: string; maxDepth: number; totalKills: number; completionTime: number; modifierCount: number; timestamp: number }): boolean {
    if (!this.db) {
      log.error('saveRiftEntry: Database not initialized');
      return false;
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO rift_leaderboard (player_name, max_depth, total_kills, completion_time, modifier_count, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(player_name) DO UPDATE SET
          max_depth = CASE WHEN excluded.max_depth > rift_leaderboard.max_depth THEN excluded.max_depth
                          WHEN excluded.max_depth = rift_leaderboard.max_depth AND excluded.completion_time < rift_leaderboard.completion_time THEN excluded.max_depth
                          ELSE rift_leaderboard.max_depth END,
          total_kills = CASE WHEN excluded.max_depth > rift_leaderboard.max_depth THEN excluded.total_kills
                            WHEN excluded.max_depth = rift_leaderboard.max_depth AND excluded.completion_time < rift_leaderboard.completion_time THEN excluded.total_kills
                            ELSE rift_leaderboard.total_kills END,
          completion_time = CASE WHEN excluded.max_depth > rift_leaderboard.max_depth THEN excluded.completion_time
                               WHEN excluded.max_depth = rift_leaderboard.max_depth AND excluded.completion_time < rift_leaderboard.completion_time THEN excluded.completion_time
                               ELSE rift_leaderboard.completion_time END,
          modifier_count = CASE WHEN excluded.max_depth > rift_leaderboard.max_depth THEN excluded.modifier_count
                              WHEN excluded.max_depth = rift_leaderboard.max_depth AND excluded.completion_time < rift_leaderboard.completion_time THEN excluded.modifier_count
                              ELSE rift_leaderboard.modifier_count END,
          timestamp = CASE WHEN excluded.max_depth > rift_leaderboard.max_depth THEN excluded.timestamp
                         WHEN excluded.max_depth = rift_leaderboard.max_depth AND excluded.completion_time < rift_leaderboard.completion_time THEN excluded.timestamp
                         ELSE rift_leaderboard.timestamp END
      `);

      stmt.run(entry.playerName, entry.maxDepth, entry.totalKills, entry.completionTime, entry.modifierCount, entry.timestamp);
      return true;
    } catch (error) {
      log.error({ err: error, playerName: entry.playerName }, 'saveRiftEntry failed');
      return false;
    }
  }

  getRiftLeaderboard(limit: number = 100): RiftLeaderboardRow[] {
    if (!this.db) {
      log.error('getRiftLeaderboard: Database not initialized');
      return [];
    }

    try {
      const stmt = this.db.prepare(`
        SELECT player_name, max_depth, total_kills, completion_time, modifier_count, timestamp
        FROM rift_leaderboard
        ORDER BY max_depth DESC, completion_time ASC
        LIMIT ?
      `);

      return stmt.all(limit) as RiftLeaderboardRow[];
    } catch (error) {
      log.error({ err: error }, 'getRiftLeaderboard failed');
      return [];
    }
  }

  // ============ Convenience Methods ============

  savePlayerState(state: PlayerSaveState): boolean {
    return tracer.startActiveSpan('storage.savePlayerState', (span) => {
      span.setAttributes({
        'db.operation': 'savePlayerState',
        'character.id': state.character.id,
        'character.name': state.character.name,
        'character.level': state.character.level,
      });

      try {
        const charSuccess = this.saveCharacter(state.character);
        const invSuccess = this.saveInventory(state.character.id, state.inventory);
        const achSuccess = this.saveAchievements(state.character.id, state.achievements);
        const dailySuccess = this.saveDailyData(state.character.id, state.daily);

        if (!charSuccess || !invSuccess || !achSuccess || !dailySuccess) {
          log.warn({ characterName: state.character.name, charSuccess, invSuccess, achSuccess, dailySuccess }, 'Partial save failure');
        }

        span.end();
        return charSuccess && invSuccess && achSuccess && dailySuccess;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        span.end();
        log.error({ err: error, characterName: state.character.name }, 'savePlayerState failed');
        return false;
      }
    });
  }

  loadPlayerState(characterName: string): PlayerSaveState | null {
    return tracer.startActiveSpan('storage.loadPlayerState', (span) => {
      span.setAttributes({
        'db.operation': 'loadPlayerState',
        'character.name': characterName,
      });

      try {
        const character = this.getCharacter(characterName);
        if (!character) {
          span.end();
          return null;
        }

        span.setAttribute('character.id', character.id);
        span.setAttribute('character.level', character.level);

        const result = {
          character,
          inventory: this.getInventory(character.id),
          achievements: this.getAchievements(character.id),
          daily: this.getDailyData(character.id) || {
            lastLogin: '',
            currentStreak: 0,
            longestStreak: 0,
            totalLogins: 0
          }
        };
        span.end();
        return result;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        span.end();
        log.error({ err: error, characterName }, 'loadPlayerState failed');
        return null;
      }
    });
  }
}

// Singleton instance
let storageInstance: SQLiteStorageService | null = null;

export function getStorageService(): SQLiteStorageService {
  if (!storageInstance) {
    storageInstance = new SQLiteStorageService();
    storageInstance.initialize();
  }
  return storageInstance;
}

export function closeStorageService(): void {
  if (storageInstance) {
    storageInstance.close();
    storageInstance = null;
  }
}
