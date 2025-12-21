/**
 * CombatTracker - Single source of truth for combat/aggro relationships
 *
 * This service manages bidirectional aggro relationships between mobs and players.
 * It replaces the scattered haters/attackers/hatelist tracking across multiple classes.
 */

import { normalizeId } from '../utils';

export interface AggroEntry {
  entityId: number;
  hate: number;
  lastDamageTime: number;
}

export interface CombatEntity {
  id: number | string;
  isDead?: boolean;
  hitPoints?: number;
  x?: number;
  y?: number;
  weaponLevel?: number;
}

export class CombatTracker {
  // Singleton instance
  private static instance: CombatTracker | null = null;

  // Mob -> Players it hates (replaces mob.hatelist)
  // Map<mobId, Map<playerId, AggroEntry>>
  private mobToPlayers: Map<number, Map<number, AggroEntry>> = new Map();

  // Player -> Mobs that hate them (replaces player.haters)
  // Map<playerId, Set<mobId>>
  private playerToMobs: Map<number, Set<number>> = new Map();

  // Reference to entity lookup function (set during init)
  private entityLookup: ((id: number) => CombatEntity | undefined) | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): CombatTracker {
    if (!CombatTracker.instance) {
      CombatTracker.instance = new CombatTracker();
    }
    return CombatTracker.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    CombatTracker.instance = null;
  }

  /**
   * Set the entity lookup function (called during World init)
   */
  setEntityLookup(lookup: (id: number) => CombatEntity | undefined): void {
    this.entityLookup = lookup;
  }

  /**
   * Add or increase aggro between a mob and player
   * This is the primary method for establishing combat relationships
   */
  addAggro(mobId: number | string, playerId: number | string, hate: number = 1): void {
    // Normalize IDs to numbers for consistent Map key comparison
    const normMobId = normalizeId(mobId);
    const normPlayerId = normalizeId(playerId);

    // Get or create mob's player map
    let playerMap = this.mobToPlayers.get(normMobId);
    if (!playerMap) {
      playerMap = new Map();
      this.mobToPlayers.set(normMobId, playerMap);
    }

    // Get or create aggro entry
    const existing = playerMap.get(normPlayerId);
    if (existing) {
      existing.hate += hate;
      existing.lastDamageTime = Date.now();
    } else {
      playerMap.set(normPlayerId, {
        entityId: normPlayerId,
        hate,
        lastDamageTime: Date.now()
      });
    }

    // Add to reverse lookup
    let mobSet = this.playerToMobs.get(normPlayerId);
    if (!mobSet) {
      mobSet = new Set();
      this.playerToMobs.set(normPlayerId, mobSet);
    }
    mobSet.add(normMobId);

    console.debug(`[CombatTracker] Mob ${normMobId} now hates player ${normPlayerId} (hate: ${playerMap.get(normPlayerId)?.hate})`);
  }

  /**
   * Remove aggro between a specific mob and player
   */
  removeAggro(mobId: number | string, playerId: number | string): void {
    // Normalize IDs
    const normMobId = normalizeId(mobId);
    const normPlayerId = normalizeId(playerId);

    // Remove from mob -> player map
    const playerMap = this.mobToPlayers.get(normMobId);
    if (playerMap) {
      playerMap.delete(normPlayerId);
      if (playerMap.size === 0) {
        this.mobToPlayers.delete(normMobId);
      }
    }

    // Remove from player -> mob map
    const mobSet = this.playerToMobs.get(normPlayerId);
    if (mobSet) {
      mobSet.delete(normMobId);
      if (mobSet.size === 0) {
        this.playerToMobs.delete(normPlayerId);
      }
    }

    console.debug(`[CombatTracker] Removed aggro: mob ${normMobId} -> player ${normPlayerId}`);
  }

  /**
   * Clear all aggro for a mob (when mob dies or resets)
   */
  clearMobAggro(mobId: number | string): void {
    const normMobId = normalizeId(mobId);
    const playerMap = this.mobToPlayers.get(normMobId);
    if (playerMap) {
      // Remove this mob from all players' mob sets
      for (const playerId of playerMap.keys()) {
        const mobSet = this.playerToMobs.get(playerId);
        if (mobSet) {
          mobSet.delete(normMobId);
          if (mobSet.size === 0) {
            this.playerToMobs.delete(playerId);
          }
        }
      }
      this.mobToPlayers.delete(normMobId);
    }
    console.debug(`[CombatTracker] Cleared all aggro for mob ${normMobId}`);
  }

  /**
   * Clear all aggro for a player (when player dies or disconnects)
   */
  clearPlayerAggro(playerId: number | string): void {
    const normPlayerId = normalizeId(playerId);
    const mobSet = this.playerToMobs.get(normPlayerId);
    if (mobSet) {
      // Remove this player from all mobs' player maps
      for (const mobId of mobSet) {
        const playerMap = this.mobToPlayers.get(mobId);
        if (playerMap) {
          playerMap.delete(normPlayerId);
          if (playerMap.size === 0) {
            this.mobToPlayers.delete(mobId);
          }
        }
      }
      this.playerToMobs.delete(normPlayerId);
    }
    console.debug(`[CombatTracker] Cleared all aggro for player ${normPlayerId}`);
  }

  /**
   * Check if a mob has aggro on a specific player
   */
  hasAggro(mobId: number, playerId: number): boolean {
    const playerMap = this.mobToPlayers.get(mobId);
    return playerMap?.has(playerId) ?? false;
  }

  /**
   * Get hate value for a specific mob-player relationship
   */
  getHate(mobId: number, playerId: number): number {
    const playerMap = this.mobToPlayers.get(mobId);
    return playerMap?.get(playerId)?.hate ?? 0;
  }

  /**
   * Get all mobs attacking a specific player
   */
  getMobsAttacking(playerId: number): number[] {
    const mobSet = this.playerToMobs.get(playerId);
    return mobSet ? Array.from(mobSet) : [];
  }

  /**
   * Get all players hated by a specific mob
   */
  getPlayersHated(mobId: number): AggroEntry[] {
    const playerMap = this.mobToPlayers.get(mobId);
    return playerMap ? Array.from(playerMap.values()) : [];
  }

  /**
   * Get the highest hate target for a mob
   * Returns the player ID with the most hate, or null if no targets
   */
  getHighestHateTarget(mobId: number, skipPlayerId?: number): number | null {
    const playerMap = this.mobToPlayers.get(mobId);
    if (!playerMap || playerMap.size === 0) {
      return null;
    }

    let highestHate = -1;
    let targetId: number | null = null;

    for (const [playerId, entry] of playerMap) {
      // Skip specified player (used when finding next target)
      if (skipPlayerId !== undefined && playerId === skipPlayerId) {
        continue;
      }
      if (entry.hate > highestHate) {
        highestHate = entry.hate;
        targetId = playerId;
      }
    }

    return targetId;
  }

  /**
   * Get the player with the nth highest hate (for target fallback)
   * hateRank 1 = highest, 2 = second highest, etc.
   */
  getHatedPlayerId(mobId: number, hateRank: number = 1): number | null {
    const playerMap = this.mobToPlayers.get(mobId);
    if (!playerMap || playerMap.size === 0) {
      return null;
    }

    // Sort by hate descending
    const sorted = Array.from(playerMap.entries())
      .sort((a, b) => b[1].hate - a[1].hate);

    const index = hateRank - 1;
    if (index >= 0 && index < sorted.length) {
      return sorted[index][0];
    }

    return null;
  }

  /**
   * Get count of players a mob hates
   */
  getMobAggroCount(mobId: number): number {
    const playerMap = this.mobToPlayers.get(mobId);
    return playerMap?.size ?? 0;
  }

  /**
   * Get count of mobs attacking a player
   */
  getPlayerAggroCount(playerId: number): number {
    const mobSet = this.playerToMobs.get(playerId);
    return mobSet?.size ?? 0;
  }

  /**
   * Iterate over all mobs attacking a player
   */
  forEachMobAttacking(playerId: number, callback: (mobId: number) => void): void {
    const mobSet = this.playerToMobs.get(playerId);
    if (mobSet) {
      for (const mobId of mobSet) {
        callback(mobId);
      }
    }
  }

  /**
   * Iterate over all players hated by a mob
   */
  forEachPlayerHated(mobId: number, callback: (playerId: number, entry: AggroEntry) => void): void {
    const playerMap = this.mobToPlayers.get(mobId);
    if (playerMap) {
      for (const [playerId, entry] of playerMap) {
        callback(playerId, entry);
      }
    }
  }

  /**
   * Get mob entities attacking a player (requires entity lookup)
   * Returns CombatEntity objects for each mob
   */
  getMobEntitiesAttacking(playerId: number): CombatEntity[] {
    if (!this.entityLookup) {
      console.warn('[CombatTracker] Entity lookup not set');
      return [];
    }

    const mobIds = this.getMobsAttacking(playerId);
    const entities: CombatEntity[] = [];

    for (const mobId of mobIds) {
      const entity = this.entityLookup(mobId);
      if (entity && !entity.isDead && (entity.hitPoints === undefined || entity.hitPoints > 0)) {
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Iterate over all mobs attacking a player with actual entity objects
   * This is the primary API for replacing player.haters local caches
   * Callback receives the mob entity (or null if mob no longer exists)
   */
  forEachMobAttackingWithEntity<T>(
    playerId: number,
    callback: (mob: T) => void
  ): void {
    if (!this.entityLookup) {
      console.warn('[CombatTracker] Entity lookup not set');
      return;
    }

    const mobIds = this.getMobsAttacking(playerId);
    for (const mobId of mobIds) {
      const entity = this.entityLookup(mobId);
      if (entity && !entity.isDead && (entity.hitPoints === undefined || entity.hitPoints > 0)) {
        callback(entity as T);
      }
    }
  }

  /**
   * Debug: Print current state
   */
  debugPrint(): void {
    console.log('[CombatTracker] Current state:');
    console.log('  Mob -> Players:');
    for (const [mobId, playerMap] of this.mobToPlayers) {
      const entries = Array.from(playerMap.entries())
        .map(([pid, e]) => `${pid}(hate:${e.hate})`)
        .join(', ');
      console.log(`    Mob ${mobId}: ${entries}`);
    }
    console.log('  Player -> Mobs:');
    for (const [playerId, mobSet] of this.playerToMobs) {
      console.log(`    Player ${playerId}: ${Array.from(mobSet).join(', ')}`);
    }
  }
}

// Export singleton accessor
export function getCombatTracker(): CombatTracker {
  return CombatTracker.getInstance();
}
