/**
 * Rift Manager - Server-side Fracture Rift management
 *
 * Handles:
 * - Player rift runs (enter, progress, exit)
 * - Mob spawning with difficulty scaling
 * - Modifier effects
 * - Progress tracking and rewards
 * - Leaderboard management
 */

import {
  RiftRunState,
  RiftModifier,
  RiftLeaderboardEntry,
  getRiftTier,
  getRequiredKills,
  selectRandomModifiers,
  calculateRiftRewards,
  getRiftMobTypes,
  MODIFIERS
} from '../../../shared/ts/rifts/rift-data';
import { Types } from '../../../shared/ts/gametypes';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('RiftManager');

// Simple unique ID generator
function generateRunId(): string {
  return `rift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Active rift run for a player
 */
interface ActiveRun extends RiftRunState {
  lastSpawnTime: number;
  spawnedMobs: Set<number>;  // Entity IDs of mobs spawned for this rift
}

/**
 * Rift Manager singleton
 */
export class RiftManager {
  private static instance: RiftManager;

  // Active runs by player ID
  private activeRuns: Map<number, ActiveRun> = new Map();

  // Leaderboard (sorted by maxDepth DESC)
  private leaderboard: RiftLeaderboardEntry[] = [];
  private readonly MAX_LEADERBOARD_SIZE = 100;

  // Spawn configuration
  private readonly SPAWN_INTERVAL = 3000;    // ms between mob spawns
  private readonly MAX_ACTIVE_MOBS = 5;      // Max mobs at once per player
  private readonly RIFT_BOUNDS = {           // Virtual rift arena bounds
    minX: 10,
    maxX: 30,
    minY: 10,
    maxY: 30
  };

  private constructor() {}

  static getInstance(): RiftManager {
    if (!RiftManager.instance) {
      RiftManager.instance = new RiftManager();
    }
    return RiftManager.instance;
  }

  /**
   * Start a new rift run for a player
   */
  startRun(playerId: number, playerName: string, playerLevel: number): ActiveRun | null {
    // Check if player already in a rift
    if (this.activeRuns.has(playerId)) {
      log.info({ playerId }, 'Player already in rift');
      return null;
    }

    // Start at depth 1
    const depth = 1;
    const tier = getRiftTier(depth);

    // Check level requirement
    if (playerLevel < tier.minLevel) {
      log.info({ playerId, playerLevel, requiredLevel: tier.minLevel }, 'Player level below rift requirement');
      return null;
    }

    // Select random modifiers
    const modifiers = selectRandomModifiers(tier.modifierCount);

    const run: ActiveRun = {
      runId: generateRunId(),
      playerId,
      playerName,
      depth,
      modifiers,
      killCount: 0,
      startTime: Date.now(),
      currentFloorKills: 0,
      requiredKills: getRequiredKills(depth),
      isComplete: false,
      completedDepth: 0,
      lastSpawnTime: 0,
      spawnedMobs: new Set()
    };

    this.activeRuns.set(playerId, run);
    log.info({ playerName, modifierCount: modifiers.length, modifiers }, 'Player started rift run');

    return run;
  }

  /**
   * Record a kill in the rift
   */
  recordKill(playerId: number, mobId: number): {
    advanced: boolean;
    newDepth: number;
    killCount: number;
    requiredKills: number;
    rewards?: { xp: number; gold: number; bonusDropChance: number };
  } | null {
    const run = this.activeRuns.get(playerId);
    if (!run || run.isComplete) return null;

    // Remove from spawned mobs
    run.spawnedMobs.delete(mobId);

    // Increment kill counts
    run.killCount++;
    run.currentFloorKills++;

    // Check if floor is complete
    if (run.currentFloorKills >= run.requiredKills) {
      // Award floor completion rewards
      const rewards = calculateRiftRewards(run.depth, run.modifiers, run.currentFloorKills);

      // Advance to next depth
      run.completedDepth = run.depth;
      run.depth++;
      run.currentFloorKills = 0;
      run.requiredKills = getRequiredKills(run.depth);

      // Add new modifiers at certain depths
      const newTier = getRiftTier(run.depth);
      if (newTier.modifierCount > run.modifiers.length) {
        const newMods = selectRandomModifiers(1).filter(m => !run.modifiers.includes(m));
        run.modifiers.push(...newMods);
        log.info({ playerId, modifier: newMods[0] }, 'Player gained new rift modifier');
      }

      log.info({ playerId, depth: run.depth }, 'Player advanced rift depth');

      return {
        advanced: true,
        newDepth: run.depth,
        killCount: run.killCount,
        requiredKills: run.requiredKills,
        rewards
      };
    }

    return {
      advanced: false,
      newDepth: run.depth,
      killCount: run.currentFloorKills,
      requiredKills: run.requiredKills
    };
  }

  /**
   * End a rift run (death or voluntary exit)
   */
  endRun(playerId: number, reason: 'death' | 'exit' | 'disconnect'): {
    run: RiftRunState;
    finalRewards: { xp: number; gold: number };
    leaderboardRank: number | null;
  } | null {
    const run = this.activeRuns.get(playerId);
    if (!run) return null;

    run.isComplete = true;

    // Calculate final rewards based on completed depth
    const finalRewards = {
      xp: Math.floor(Math.pow(1.5, run.completedDepth) * 50) + run.killCount * 5,
      gold: Math.floor(Math.pow(1.5, run.completedDepth) * 25) + run.killCount * 2
    };

    // Update leaderboard if this is a good run
    let leaderboardRank: number | null = null;
    if (run.completedDepth > 0) {
      leaderboardRank = this.updateLeaderboard({
        rank: 0,
        playerName: run.playerName,
        maxDepth: run.completedDepth,
        totalKills: run.killCount,
        completionTime: Date.now() - run.startTime,
        modifierCount: run.modifiers.filter(m => MODIFIERS[m].isDebuff).length,
        timestamp: Date.now()
      });
    }

    log.info({ playerName: run.playerName, depth: run.completedDepth, reason, kills: run.killCount }, 'Player ended rift run');

    // Clean up
    this.activeRuns.delete(playerId);

    return {
      run,
      finalRewards,
      leaderboardRank
    };
  }

  /**
   * Get mob to spawn for current rift depth
   */
  getMobToSpawn(playerId: number): {
    mobKind: number;
    hpMultiplier: number;
    damageMultiplier: number;
    x: number;
    y: number;
  } | null {
    const run = this.activeRuns.get(playerId);
    if (!run || run.isComplete) return null;

    // Check spawn timing
    const now = Date.now();
    if (now - run.lastSpawnTime < this.SPAWN_INTERVAL) return null;

    // Check mob count
    if (run.spawnedMobs.size >= this.MAX_ACTIVE_MOBS) return null;

    run.lastSpawnTime = now;

    // Get available mob types for this depth
    const mobTypes = getRiftMobTypes(run.depth);
    const mobKind = mobTypes[Math.floor(Math.random() * mobTypes.length)];

    // Calculate multipliers
    const tier = getRiftTier(run.depth);
    let hpMult = tier.hpMultiplier;
    let dmgMult = tier.damageMultiplier;

    // Apply modifiers
    for (const mod of run.modifiers) {
      if (mod === RiftModifier.FORTIFIED) hpMult *= 1.5;
      if (mod === RiftModifier.EMPOWERED) dmgMult *= 1.5;
    }

    // Random position in rift arena
    const x = Math.floor(Math.random() * (this.RIFT_BOUNDS.maxX - this.RIFT_BOUNDS.minX)) + this.RIFT_BOUNDS.minX;
    const y = Math.floor(Math.random() * (this.RIFT_BOUNDS.maxY - this.RIFT_BOUNDS.minY)) + this.RIFT_BOUNDS.minY;

    return {
      mobKind,
      hpMultiplier: hpMult,
      damageMultiplier: dmgMult,
      x,
      y
    };
  }

  /**
   * Register a spawned mob with a rift run
   */
  registerSpawnedMob(playerId: number, mobId: number): void {
    const run = this.activeRuns.get(playerId);
    if (run) {
      run.spawnedMobs.add(mobId);
    }
  }

  /**
   * Get active run for a player
   */
  getActiveRun(playerId: number): RiftRunState | null {
    return this.activeRuns.get(playerId) || null;
  }

  /**
   * Check if player is in a rift
   */
  isInRift(playerId: number): boolean {
    return this.activeRuns.has(playerId);
  }

  /**
   * Get modifier effects for damage calculation
   */
  getModifierEffects(playerId: number): {
    playerDamageMult: number;
    playerHpMult: number;
    canHeal: boolean;
    speedMult: number;
  } {
    const run = this.activeRuns.get(playerId);
    if (!run) {
      return { playerDamageMult: 1, playerHpMult: 1, canHeal: true, speedMult: 1 };
    }

    let playerDamageMult = 1;
    let playerHpMult = 1;
    let canHeal = true;
    let speedMult = 1;

    for (const mod of run.modifiers) {
      switch (mod) {
        case RiftModifier.WEAKENED:
          playerDamageMult *= 0.75;
          break;
        case RiftModifier.FRAGILE:
          playerHpMult *= 0.75;
          break;
        case RiftModifier.CURSED:
          canHeal = false;
          break;
        case RiftModifier.BLESSED:
          playerDamageMult *= 1.25;
          break;
        case RiftModifier.RESILIENT:
          playerHpMult *= 1.25;
          break;
        case RiftModifier.HASTY:
          speedMult *= 1.3;
          break;
      }
    }

    return { playerDamageMult, playerHpMult, canHeal, speedMult };
  }

  /**
   * Update leaderboard with a new entry
   */
  private updateLeaderboard(entry: RiftLeaderboardEntry): number {
    // Find if player already has an entry
    const existingIdx = this.leaderboard.findIndex(e => e.playerName === entry.playerName);

    if (existingIdx >= 0) {
      // Only update if new run is better
      const existing = this.leaderboard[existingIdx];
      if (entry.maxDepth > existing.maxDepth ||
          (entry.maxDepth === existing.maxDepth && entry.completionTime < existing.completionTime)) {
        this.leaderboard[existingIdx] = entry;
      } else {
        // Keep existing, return its rank
        return existingIdx + 1;
      }
    } else {
      this.leaderboard.push(entry);
    }

    // Sort by maxDepth DESC, then completionTime ASC
    this.leaderboard.sort((a, b) => {
      if (b.maxDepth !== a.maxDepth) return b.maxDepth - a.maxDepth;
      return a.completionTime - b.completionTime;
    });

    // Trim to max size
    if (this.leaderboard.length > this.MAX_LEADERBOARD_SIZE) {
      this.leaderboard = this.leaderboard.slice(0, this.MAX_LEADERBOARD_SIZE);
    }

    // Update ranks
    this.leaderboard.forEach((e, idx) => e.rank = idx + 1);

    // Return new rank
    const newIdx = this.leaderboard.findIndex(e => e.playerName === entry.playerName);
    return newIdx >= 0 ? newIdx + 1 : -1;
  }

  /**
   * Get leaderboard entries
   */
  getLeaderboard(limit: number = 10): RiftLeaderboardEntry[] {
    return this.leaderboard.slice(0, limit);
  }

  /**
   * Get player's leaderboard position
   */
  getPlayerRank(playerName: string): number | null {
    const idx = this.leaderboard.findIndex(e => e.playerName === playerName);
    return idx >= 0 ? idx + 1 : null;
  }

  /**
   * Clean up runs for disconnected players
   */
  cleanupDisconnectedPlayer(playerId: number): void {
    if (this.activeRuns.has(playerId)) {
      this.endRun(playerId, 'disconnect');
    }
  }

  /**
   * Get rift stats for debugging
   */
  getStats(): { activeRuns: number; leaderboardSize: number } {
    return {
      activeRuns: this.activeRuns.size,
      leaderboardSize: this.leaderboard.length
    };
  }
}

// Export singleton
export const riftManager = RiftManager.getInstance();
