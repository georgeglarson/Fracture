/**
 * Tests for RiftManager
 * Covers: rift run lifecycle, floor progression, modifier effects,
 *         reward calculations, mob spawning, leaderboard management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RiftModifier, MODIFIERS, getRiftTier, getRequiredKills, calculateRiftRewards } from '../../../shared/ts/rifts/rift-data';
import { RiftManager } from '../rifts/rift-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a fresh RiftManager for each test by resetting the singleton.
 * The class uses a static `instance` field which we clear.
 */
function freshManager(): RiftManager {
  // Clear the singleton so getInstance() creates a new one
  (RiftManager as any).instance = undefined;
  return RiftManager.getInstance();
}

// Player fixtures
const PLAYER_ID = 1;
const PLAYER_NAME = 'TestPlayer';
const PLAYER_LEVEL = 20; // high enough for depth 1 (minLevel = 2)

describe('RiftManager', () => {
  let mgr: RiftManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = freshManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // startRun
  // -----------------------------------------------------------------------
  describe('startRun', () => {
    it('should create a new rift run', () => {
      const run = mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      expect(run).not.toBeNull();
      expect(run!.playerId).toBe(PLAYER_ID);
      expect(run!.playerName).toBe(PLAYER_NAME);
      expect(run!.depth).toBe(1);
      expect(run!.killCount).toBe(0);
      expect(run!.currentFloorKills).toBe(0);
      expect(run!.isComplete).toBe(false);
      expect(run!.completedDepth).toBe(0);
      expect(run!.requiredKills).toBe(getRequiredKills(1));
    });

    it('should assign modifiers based on tier', () => {
      const run = mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      expect(run).not.toBeNull();
      // Depth 1 tier has modifierCount = Math.min(4, floor(1/3) + 1) = 1
      const tier = getRiftTier(1);
      expect(run!.modifiers.length).toBeLessThanOrEqual(tier.modifierCount);
    });

    it('should return null if player is already in a rift', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const second = mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      expect(second).toBeNull();
    });

    it('should return null if player level is below requirement', () => {
      // Depth 1 min level = min(40, 1*2) = 2
      const run = mgr.startRun(PLAYER_ID, PLAYER_NAME, 1); // level 1 < 2

      expect(run).toBeNull();
    });

    it('should allow different players to start runs independently', () => {
      const run1 = mgr.startRun(1, 'Alice', PLAYER_LEVEL);
      const run2 = mgr.startRun(2, 'Bob', PLAYER_LEVEL);

      expect(run1).not.toBeNull();
      expect(run2).not.toBeNull();
      expect(run1!.runId).not.toBe(run2!.runId);
    });
  });

  // -----------------------------------------------------------------------
  // isInRift / getActiveRun
  // -----------------------------------------------------------------------
  describe('isInRift / getActiveRun', () => {
    it('should return true for players in a rift', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      expect(mgr.isInRift(PLAYER_ID)).toBe(true);
    });

    it('should return false for players not in a rift', () => {
      expect(mgr.isInRift(999)).toBe(false);
    });

    it('should return the active run state', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const state = mgr.getActiveRun(PLAYER_ID);

      expect(state).not.toBeNull();
      expect(state!.playerId).toBe(PLAYER_ID);
    });

    it('should return null for inactive player', () => {
      expect(mgr.getActiveRun(999)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // recordKill - floor progression
  // -----------------------------------------------------------------------
  describe('recordKill', () => {
    it('should increment kill count', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      const result = mgr.recordKill(PLAYER_ID, 100);
      expect(result).not.toBeNull();
      expect(result!.advanced).toBe(false);
      expect(result!.killCount).toBe(1);
    });

    it('should return null for a player not in rift', () => {
      expect(mgr.recordKill(999, 100)).toBeNull();
    });

    it('should return null for a completed run', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      mgr.endRun(PLAYER_ID, 'death');

      expect(mgr.recordKill(PLAYER_ID, 100)).toBeNull();
    });

    it('should advance floor when required kills are met', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      const required = getRequiredKills(1); // 5 + 1*2 = 7
      let result;
      for (let i = 0; i < required; i++) {
        result = mgr.recordKill(PLAYER_ID, 100 + i);
      }

      expect(result!.advanced).toBe(true);
      expect(result!.newDepth).toBe(2);
      expect(result!.rewards).toBeDefined();
      expect(result!.rewards!.xp).toBeGreaterThan(0);
      expect(result!.rewards!.gold).toBeGreaterThan(0);
    });

    it('should reset currentFloorKills after advancing', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      const required = getRequiredKills(1);
      for (let i = 0; i < required; i++) {
        mgr.recordKill(PLAYER_ID, 100 + i);
      }

      // Next kill should be on the new floor
      const result = mgr.recordKill(PLAYER_ID, 200);
      expect(result!.killCount).toBe(1); // reset to 1 on new floor
      expect(result!.requiredKills).toBe(getRequiredKills(2));
    });

    it('should set completedDepth on floor advance', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      const required = getRequiredKills(1);
      for (let i = 0; i < required; i++) {
        mgr.recordKill(PLAYER_ID, 100 + i);
      }

      const run = mgr.getActiveRun(PLAYER_ID);
      expect(run!.completedDepth).toBe(1);
    });

    it('should track total killCount across floors', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      const floor1Kills = getRequiredKills(1);
      for (let i = 0; i < floor1Kills; i++) {
        mgr.recordKill(PLAYER_ID, 100 + i);
      }

      // Floor 2: kill a few more
      mgr.recordKill(PLAYER_ID, 200);
      mgr.recordKill(PLAYER_ID, 201);

      const run = mgr.getActiveRun(PLAYER_ID);
      expect(run!.killCount).toBe(floor1Kills + 2);
    });

    it('should remove mob from spawnedMobs set on kill', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      mgr.registerSpawnedMob(PLAYER_ID, 42);

      mgr.recordKill(PLAYER_ID, 42);

      // The mob should be removed from the tracked set.
      // We verify indirectly: spawning should still work when at max capacity minus one.
      const run = mgr.getActiveRun(PLAYER_ID) as any;
      expect(run.spawnedMobs.has(42)).toBe(false);
    });

    it('should provide rewards with bonusDropChance on floor advance', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      const required = getRequiredKills(1);
      let result;
      for (let i = 0; i < required; i++) {
        result = mgr.recordKill(PLAYER_ID, 100 + i);
      }

      expect(result!.rewards!.bonusDropChance).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-floor progression
  // -----------------------------------------------------------------------
  describe('multi-floor progression', () => {
    it('should progress through multiple floors correctly', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      let mobCounter = 0;

      for (let floor = 1; floor <= 3; floor++) {
        const required = getRequiredKills(floor);
        let result;
        for (let k = 0; k < required; k++) {
          result = mgr.recordKill(PLAYER_ID, mobCounter++);
        }
        expect(result!.advanced).toBe(true);
        expect(result!.newDepth).toBe(floor + 1);
      }

      const run = mgr.getActiveRun(PLAYER_ID);
      expect(run!.completedDepth).toBe(3);
      expect(run!.depth).toBe(4);
    });
  });

  // -----------------------------------------------------------------------
  // endRun
  // -----------------------------------------------------------------------
  describe('endRun', () => {
    it('should return run state and final rewards on death', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      // Complete first floor
      const required = getRequiredKills(1);
      for (let i = 0; i < required; i++) {
        mgr.recordKill(PLAYER_ID, 100 + i);
      }

      const result = mgr.endRun(PLAYER_ID, 'death');
      expect(result).not.toBeNull();
      expect(result!.run.isComplete).toBe(true);
      expect(result!.run.completedDepth).toBe(1);
      // Exponential: xp = floor(1.5^depth * 50) + kills*5, gold = floor(1.5^depth * 25) + kills*2
      expect(result!.finalRewards.xp).toBe(Math.floor(Math.pow(1.5, 1) * 50) + result!.run.killCount * 5);
      expect(result!.finalRewards.gold).toBe(Math.floor(Math.pow(1.5, 1) * 25) + result!.run.killCount * 2);
    });

    it('should remove the run from active runs', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      mgr.endRun(PLAYER_ID, 'exit');

      expect(mgr.isInRift(PLAYER_ID)).toBe(false);
      expect(mgr.getActiveRun(PLAYER_ID)).toBeNull();
    });

    it('should return null for a player not in a rift', () => {
      expect(mgr.endRun(999, 'death')).toBeNull();
    });

    it('should calculate final rewards based on completedDepth and killCount', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      // Kill some mobs but do not complete the floor
      mgr.recordKill(PLAYER_ID, 100);
      mgr.recordKill(PLAYER_ID, 101);

      const result = mgr.endRun(PLAYER_ID, 'exit');
      // completedDepth=0, killCount=2 — exponential formula
      expect(result!.finalRewards.xp).toBe(Math.floor(Math.pow(1.5, 0) * 50) + 2 * 5);
      expect(result!.finalRewards.gold).toBe(Math.floor(Math.pow(1.5, 0) * 25) + 2 * 2);
    });

    it('should not update leaderboard if completedDepth is 0', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const result = mgr.endRun(PLAYER_ID, 'death');

      expect(result!.leaderboardRank).toBeNull();
    });

    it('should update leaderboard when completedDepth > 0', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      const required = getRequiredKills(1);
      for (let i = 0; i < required; i++) {
        mgr.recordKill(PLAYER_ID, 100 + i);
      }

      const result = mgr.endRun(PLAYER_ID, 'death');
      expect(result!.leaderboardRank).toBe(1); // first entry
    });
  });

  // -----------------------------------------------------------------------
  // getMobToSpawn
  // -----------------------------------------------------------------------
  describe('getMobToSpawn', () => {
    it('should return null for player not in rift', () => {
      expect(mgr.getMobToSpawn(999)).toBeNull();
    });

    it('should return mob info with correct properties', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      // Advance time past spawn interval
      vi.advanceTimersByTime(4000);

      const spawn = mgr.getMobToSpawn(PLAYER_ID);
      expect(spawn).not.toBeNull();
      expect(spawn!.mobKind).toBeDefined();
      expect(spawn!.hpMultiplier).toBeGreaterThanOrEqual(1);
      expect(spawn!.damageMultiplier).toBeGreaterThanOrEqual(1);
      expect(spawn!.x).toBeGreaterThanOrEqual(10);
      expect(spawn!.x).toBeLessThan(30);
      expect(spawn!.y).toBeGreaterThanOrEqual(10);
      expect(spawn!.y).toBeLessThan(30);
    });

    it('should respect spawn interval timing', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      // Advance past first spawn interval
      vi.advanceTimersByTime(4000);
      const first = mgr.getMobToSpawn(PLAYER_ID);
      expect(first).not.toBeNull();

      // Immediately try again - should be null (too soon)
      const second = mgr.getMobToSpawn(PLAYER_ID);
      expect(second).toBeNull();

      // Advance past interval again
      vi.advanceTimersByTime(4000);
      const third = mgr.getMobToSpawn(PLAYER_ID);
      expect(third).not.toBeNull();
    });

    it('should return null when max active mobs is reached', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      // Register 5 mobs (MAX_ACTIVE_MOBS)
      for (let i = 0; i < 5; i++) {
        mgr.registerSpawnedMob(PLAYER_ID, 100 + i);
      }

      vi.advanceTimersByTime(4000);
      expect(mgr.getMobToSpawn(PLAYER_ID)).toBeNull();
    });

    it('should allow spawning after killing mobs reduces count', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);

      // Fill up mobs
      for (let i = 0; i < 5; i++) {
        mgr.registerSpawnedMob(PLAYER_ID, 100 + i);
      }

      // Kill one
      mgr.recordKill(PLAYER_ID, 100);

      vi.advanceTimersByTime(4000);
      expect(mgr.getMobToSpawn(PLAYER_ID)).not.toBeNull();
    });

    it('should return null for completed run', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      mgr.endRun(PLAYER_ID, 'death');

      vi.advanceTimersByTime(4000);
      // Run is no longer active
      expect(mgr.getMobToSpawn(PLAYER_ID)).toBeNull();
    });

    it('should apply FORTIFIED modifier to hpMultiplier', () => {
      // We need a run with the FORTIFIED modifier. Start many runs
      // until we get one, or just inject modifiers directly.
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.FORTIFIED];
      run.lastSpawnTime = 0;

      vi.advanceTimersByTime(4000);
      const spawn = mgr.getMobToSpawn(PLAYER_ID);

      const baseTier = getRiftTier(1);
      expect(spawn!.hpMultiplier).toBeCloseTo(baseTier.hpMultiplier * 1.5, 5);
    });

    it('should apply EMPOWERED modifier to damageMultiplier', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.EMPOWERED];
      run.lastSpawnTime = 0;

      vi.advanceTimersByTime(4000);
      const spawn = mgr.getMobToSpawn(PLAYER_ID);

      const baseTier = getRiftTier(1);
      expect(spawn!.damageMultiplier).toBeCloseTo(baseTier.damageMultiplier * 1.5, 5);
    });

    it('should stack FORTIFIED and EMPOWERED modifiers', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.FORTIFIED, RiftModifier.EMPOWERED];
      run.lastSpawnTime = 0;

      vi.advanceTimersByTime(4000);
      const spawn = mgr.getMobToSpawn(PLAYER_ID);

      const baseTier = getRiftTier(1);
      expect(spawn!.hpMultiplier).toBeCloseTo(baseTier.hpMultiplier * 1.5, 5);
      expect(spawn!.damageMultiplier).toBeCloseTo(baseTier.damageMultiplier * 1.5, 5);
    });
  });

  // -----------------------------------------------------------------------
  // registerSpawnedMob
  // -----------------------------------------------------------------------
  describe('registerSpawnedMob', () => {
    it('should add mob to spawnedMobs set', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      mgr.registerSpawnedMob(PLAYER_ID, 42);

      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      expect(run.spawnedMobs.has(42)).toBe(true);
    });

    it('should do nothing for inactive player', () => {
      // Should not throw
      mgr.registerSpawnedMob(999, 42);
    });
  });

  // -----------------------------------------------------------------------
  // getModifierEffects
  // -----------------------------------------------------------------------
  describe('getModifierEffects', () => {
    it('should return defaults when player is not in rift', () => {
      const effects = mgr.getModifierEffects(999);
      expect(effects.playerDamageMult).toBe(1);
      expect(effects.playerHpMult).toBe(1);
      expect(effects.canHeal).toBe(true);
      expect(effects.speedMult).toBe(1);
    });

    it('should apply WEAKENED modifier (-25% damage)', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.WEAKENED];

      const effects = mgr.getModifierEffects(PLAYER_ID);
      expect(effects.playerDamageMult).toBeCloseTo(0.75, 5);
    });

    it('should apply FRAGILE modifier (-25% HP)', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.FRAGILE];

      const effects = mgr.getModifierEffects(PLAYER_ID);
      expect(effects.playerHpMult).toBeCloseTo(0.75, 5);
    });

    it('should apply CURSED modifier (no healing)', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.CURSED];

      const effects = mgr.getModifierEffects(PLAYER_ID);
      expect(effects.canHeal).toBe(false);
    });

    it('should apply BLESSED modifier (+25% damage)', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.BLESSED];

      const effects = mgr.getModifierEffects(PLAYER_ID);
      expect(effects.playerDamageMult).toBeCloseTo(1.25, 5);
    });

    it('should apply RESILIENT modifier (+25% HP)', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.RESILIENT];

      const effects = mgr.getModifierEffects(PLAYER_ID);
      expect(effects.playerHpMult).toBeCloseTo(1.25, 5);
    });

    it('should apply HASTY modifier (+30% speed)', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.HASTY];

      const effects = mgr.getModifierEffects(PLAYER_ID);
      expect(effects.speedMult).toBeCloseTo(1.3, 5);
    });

    it('should stack multiple modifiers multiplicatively', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [RiftModifier.WEAKENED, RiftModifier.BLESSED];

      const effects = mgr.getModifierEffects(PLAYER_ID);
      // WEAKENED: 0.75, BLESSED: 1.25 => 0.75 * 1.25 = 0.9375
      expect(effects.playerDamageMult).toBeCloseTo(0.75 * 1.25, 5);
    });

    it('should handle empty modifiers list', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = [];

      const effects = mgr.getModifierEffects(PLAYER_ID);
      expect(effects.playerDamageMult).toBe(1);
      expect(effects.playerHpMult).toBe(1);
      expect(effects.canHeal).toBe(true);
      expect(effects.speedMult).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Leaderboard
  // -----------------------------------------------------------------------
  describe('leaderboard', () => {
    function completeSomeFloors(
      manager: RiftManager,
      playerId: number,
      playerName: string,
      floorsToComplete: number
    ) {
      manager.startRun(playerId, playerName, PLAYER_LEVEL);
      let mobCounter = 0;

      for (let floor = 1; floor <= floorsToComplete; floor++) {
        const required = getRequiredKills(floor);
        for (let k = 0; k < required; k++) {
          manager.recordKill(playerId, 1000 + playerId * 100 + mobCounter++);
        }
      }

      return manager.endRun(playerId, 'death');
    }

    it('should add entry when run completes with depth > 0', () => {
      completeSomeFloors(mgr, 1, 'Alice', 2);

      const lb = mgr.getLeaderboard(10);
      expect(lb.length).toBe(1);
      expect(lb[0].playerName).toBe('Alice');
      expect(lb[0].maxDepth).toBe(2);
    });

    it('should sort by maxDepth descending', () => {
      completeSomeFloors(mgr, 1, 'Alice', 1);
      completeSomeFloors(mgr, 2, 'Bob', 3);
      completeSomeFloors(mgr, 3, 'Charlie', 2);

      const lb = mgr.getLeaderboard(10);
      expect(lb[0].playerName).toBe('Bob');
      expect(lb[1].playerName).toBe('Charlie');
      expect(lb[2].playerName).toBe('Alice');
    });

    it('should update existing entry only if new run is better', () => {
      completeSomeFloors(mgr, 1, 'Alice', 3);
      completeSomeFloors(mgr, 1, 'Alice', 1); // worse run

      const lb = mgr.getLeaderboard(10);
      expect(lb.length).toBe(1);
      expect(lb[0].maxDepth).toBe(3); // kept the better run
    });

    it('should update existing entry if new depth is higher', () => {
      completeSomeFloors(mgr, 1, 'Alice', 1);
      completeSomeFloors(mgr, 1, 'Alice', 3); // better run

      const lb = mgr.getLeaderboard(10);
      expect(lb.length).toBe(1);
      expect(lb[0].maxDepth).toBe(3);
    });

    it('should respect leaderboard limit parameter', () => {
      completeSomeFloors(mgr, 1, 'Alice', 1);
      completeSomeFloors(mgr, 2, 'Bob', 2);
      completeSomeFloors(mgr, 3, 'Charlie', 3);

      const lb = mgr.getLeaderboard(2);
      expect(lb.length).toBe(2);
    });

    it('should assign correct ranks', () => {
      completeSomeFloors(mgr, 1, 'Alice', 1);
      completeSomeFloors(mgr, 2, 'Bob', 3);
      completeSomeFloors(mgr, 3, 'Charlie', 2);

      const lb = mgr.getLeaderboard(10);
      expect(lb[0].rank).toBe(1);
      expect(lb[1].rank).toBe(2);
      expect(lb[2].rank).toBe(3);
    });

    it('should return correct player rank', () => {
      completeSomeFloors(mgr, 1, 'Alice', 1);
      completeSomeFloors(mgr, 2, 'Bob', 3);

      expect(mgr.getPlayerRank('Bob')).toBe(1);
      expect(mgr.getPlayerRank('Alice')).toBe(2);
    });

    it('should return null rank for unknown player', () => {
      expect(mgr.getPlayerRank('Nobody')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // cleanupDisconnectedPlayer
  // -----------------------------------------------------------------------
  describe('cleanupDisconnectedPlayer', () => {
    it('should end run on disconnect', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      mgr.cleanupDisconnectedPlayer(PLAYER_ID);

      expect(mgr.isInRift(PLAYER_ID)).toBe(false);
    });

    it('should not throw for player not in rift', () => {
      expect(() => mgr.cleanupDisconnectedPlayer(999)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // getStats
  // -----------------------------------------------------------------------
  describe('getStats', () => {
    it('should reflect active runs count', () => {
      expect(mgr.getStats().activeRuns).toBe(0);

      mgr.startRun(1, 'Alice', PLAYER_LEVEL);
      mgr.startRun(2, 'Bob', PLAYER_LEVEL);
      expect(mgr.getStats().activeRuns).toBe(2);

      mgr.endRun(1, 'death');
      expect(mgr.getStats().activeRuns).toBe(1);
    });

    it('should reflect leaderboard size', () => {
      expect(mgr.getStats().leaderboardSize).toBe(0);

      // Complete a floor to generate leaderboard entry
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const required = getRequiredKills(1);
      for (let i = 0; i < required; i++) {
        mgr.recordKill(PLAYER_ID, 100 + i);
      }
      mgr.endRun(PLAYER_ID, 'death');

      expect(mgr.getStats().leaderboardSize).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Reward calculation integration
  // -----------------------------------------------------------------------
  describe('reward calculations', () => {
    it('should provide floor rewards matching calculateRiftRewards', () => {
      mgr.startRun(PLAYER_ID, PLAYER_NAME, PLAYER_LEVEL);
      const run = (mgr as any).activeRuns.get(PLAYER_ID);
      run.modifiers = []; // clear modifiers for deterministic test

      const required = getRequiredKills(1);
      let result;
      for (let i = 0; i < required; i++) {
        result = mgr.recordKill(PLAYER_ID, 100 + i);
      }

      // Floor rewards should match the shared calculation
      const expected = calculateRiftRewards(1, [], required);
      expect(result!.rewards!.xp).toBe(expected.xp);
      expect(result!.rewards!.gold).toBe(expected.gold);
      expect(result!.rewards!.bonusDropChance).toBe(expected.bonusDropChance);
    });

    it('should scale final rewards with depth and kills', () => {
      mgr.startRun(1, 'Alice', PLAYER_LEVEL);

      // Complete 2 floors
      let mobCounter = 0;
      for (let floor = 1; floor <= 2; floor++) {
        const required = getRequiredKills(floor);
        for (let k = 0; k < required; k++) {
          mgr.recordKill(1, mobCounter++);
        }
      }

      const result = mgr.endRun(1, 'death');
      const totalKills = getRequiredKills(1) + getRequiredKills(2);

      // Exponential rewards: floor(1.5^depth * 50) + kills*5
      expect(result!.finalRewards.xp).toBe(Math.floor(Math.pow(1.5, 2) * 50) + totalKills * 5);
      expect(result!.finalRewards.gold).toBe(Math.floor(Math.pow(1.5, 2) * 25) + totalKills * 2);
    });
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------
  describe('getInstance', () => {
    it('should return the same instance on repeated calls', () => {
      const a = RiftManager.getInstance();
      const b = RiftManager.getInstance();
      expect(a).toBe(b);
    });
  });
});
