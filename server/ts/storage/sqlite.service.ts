/**
 * SQLite Storage Service
 *
 * Implements IStorageService using better-sqlite3 for synchronous database access.
 * This is the MVP storage solution - zero infrastructure, single file.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  IStorageService,
  CharacterData,
  DailyData,
  PlayerSaveState
} from './storage.interface.js';
import { SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types.js';
import { PlayerAchievements, createEmptyPlayerAchievements } from '../../../shared/ts/achievements/achievement-data.js';

const DB_PATH = path.join(process.cwd(), 'server', 'data', 'fracture.db');

export class SQLiteStorageService implements IStorageService {
  private db: Database.Database | null = null;

  /**
   * Initialize database and create tables
   */
  initialize(): void {
    console.log(`[Storage] Initializing SQLite database at ${DB_PATH}`);

    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.createTables();

    console.log('[Storage] Database initialized successfully');
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[Storage] Database connection closed');
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
      console.log('[Storage] Added password_hash column to existing database');
    } catch (e) {
      // Column already exists, ignore
    }

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
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT id, name, level, xp, gold, armor_kind, weapon_kind, x, y,
             created_at, last_saved
      FROM characters WHERE name = ?
    `);

    const row = stmt.get(name) as any;
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
      lastSaved: row.last_saved
    };
  }

  getCharacterById(id: string): CharacterData | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT id, name, level, xp, gold, armor_kind, weapon_kind, x, y,
             created_at, last_saved
      FROM characters WHERE id = ?
    `);

    const row = stmt.get(id) as any;
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
      lastSaved: row.last_saved
    };
  }

  saveCharacter(data: CharacterData): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE characters
      SET level = ?, xp = ?, gold = ?, armor_kind = ?, weapon_kind = ?,
          x = ?, y = ?, last_saved = CURRENT_TIMESTAMP
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
      data.id
    );
  }

  createCharacter(name: string, password: string): CharacterData {
    if (!this.db) throw new Error('Database not initialized');

    const id = this.generateId();
    const passwordHash = this.hashPassword(password);
    const stmt = this.db.prepare(`
      INSERT INTO characters (id, name, password_hash, level, xp, gold, x, y)
      VALUES (?, ?, ?, 1, 0, 0, 0, 0)
    `);

    stmt.run(id, name, passwordHash);

    console.log(`[Storage] Created new character: ${name} (${id})`);

    return {
      id,
      name,
      level: 1,
      xp: 0,
      gold: 0,
      armorKind: null,
      weaponKind: null,
      x: 0,
      y: 0
    };
  }

  characterExists(name: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT 1 FROM characters WHERE name = ?');
    return stmt.get(name) !== undefined;
  }

  /**
   * Verify password for a character
   * Returns true if password matches, false otherwise
   */
  verifyPassword(name: string, password: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT password_hash FROM characters WHERE name = ?');
    const row = stmt.get(name) as any;
    if (!row) return false;

    return this.checkPassword(password, row.password_hash);
  }

  // ============ Inventory Methods ============

  getInventory(characterId: string): (SerializedInventorySlot | null)[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT slot, item_kind, count, properties
      FROM inventory WHERE character_id = ?
      ORDER BY slot
    `);

    const rows = stmt.all(characterId) as any[];

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
  }

  saveInventory(characterId: string, slots: (SerializedInventorySlot | null)[]): void {
    if (!this.db) throw new Error('Database not initialized');

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
  }

  // ============ Achievements Methods ============

  getAchievements(characterId: string): PlayerAchievements {
    if (!this.db) throw new Error('Database not initialized');

    // Get unlocked achievements
    const achievementStmt = this.db.prepare(`
      SELECT achievement_id, progress, unlocked_at
      FROM achievements WHERE character_id = ?
    `);
    const rows = achievementStmt.all(characterId) as any[];

    // Get selected title
    const titleStmt = this.db.prepare(`
      SELECT selected_title FROM character_titles WHERE character_id = ?
    `);
    const titleRow = titleStmt.get(characterId) as any;

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
  }

  saveAchievements(characterId: string, data: PlayerAchievements): void {
    if (!this.db) throw new Error('Database not initialized');

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
  }

  // ============ Daily Login Methods ============

  getDailyData(characterId: string): DailyData | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT last_login, current_streak, longest_streak, total_logins
      FROM daily_logins WHERE character_id = ?
    `);

    const row = stmt.get(characterId) as any;
    if (!row) return null;

    return {
      lastLogin: row.last_login,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      totalLogins: row.total_logins
    };
  }

  saveDailyData(characterId: string, data: DailyData): void {
    if (!this.db) throw new Error('Database not initialized');

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
  }

  // ============ Convenience Methods ============

  savePlayerState(state: PlayerSaveState): void {
    this.saveCharacter(state.character);
    this.saveInventory(state.character.id, state.inventory);
    this.saveAchievements(state.character.id, state.achievements);
    this.saveDailyData(state.character.id, state.daily);
  }

  loadPlayerState(characterName: string): PlayerSaveState | null {
    const character = this.getCharacter(characterName);
    if (!character) return null;

    return {
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
