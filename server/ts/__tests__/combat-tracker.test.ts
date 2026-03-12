/**
 * Tests for CombatTracker
 * Covers: singleton/factory, addAggro, removeAggro, clearMobAggro,
 *         clearPlayerAggro, hasAggro, getHate, getHatedPlayerId,
 *         getHighestHateTarget, getMobsAttacking, getPlayersHated,
 *         forEachPlayerHated, forEachMobAttacking, getMobAggroCount,
 *         getPlayerAggroCount, getMobEntitiesAttacking,
 *         forEachMobAttackingWithEntity, setEntityLookup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatTracker, getCombatTracker } from '../combat/combat-tracker';
import type { AggroEntry, CombatEntity } from '../combat/combat-tracker';

describe('CombatTracker', () => {
  let tracker: CombatTracker;

  beforeEach(() => {
    CombatTracker.reset();
    tracker = CombatTracker.getInstance();
  });

  // ---------------------------------------------------------------
  // Singleton / factory
  // ---------------------------------------------------------------
  describe('singleton / factory', () => {
    it('should return the same instance on repeated getInstance calls', () => {
      const a = CombatTracker.getInstance();
      const b = CombatTracker.getInstance();
      expect(a).toBe(b);
    });

    it('should return a fresh instance after reset()', () => {
      const first = CombatTracker.getInstance();
      first.addAggro(1, 100, 5);

      CombatTracker.reset();
      const second = CombatTracker.getInstance();
      expect(second).not.toBe(first);
      expect(second.getMobAggroCount(1)).toBe(0);
    });

    it('getCombatTracker() should return the singleton', () => {
      const fromFactory = getCombatTracker();
      const fromStatic = CombatTracker.getInstance();
      expect(fromFactory).toBe(fromStatic);
    });
  });

  // ---------------------------------------------------------------
  // addAggro
  // ---------------------------------------------------------------
  describe('addAggro', () => {
    it('should establish aggro between a mob and a player', () => {
      tracker.addAggro(1, 100);
      expect(tracker.hasAggro(1, 100)).toBe(true);
    });

    it('should default hate to 1 when not specified', () => {
      tracker.addAggro(1, 100);
      expect(tracker.getHate(1, 100)).toBe(1);
    });

    it('should use the supplied hate value', () => {
      tracker.addAggro(1, 100, 10);
      expect(tracker.getHate(1, 100)).toBe(10);
    });

    it('should accumulate hate on repeated calls', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 100, 3);
      expect(tracker.getHate(1, 100)).toBe(8);
    });

    it('should normalise string IDs to numbers', () => {
      tracker.addAggro('1', '100', 4);
      expect(tracker.hasAggro(1, 100)).toBe(true);
      expect(tracker.getHate(1, 100)).toBe(4);
    });

    it('should support multiple players per mob', () => {
      tracker.addAggro(1, 100, 2);
      tracker.addAggro(1, 200, 7);
      expect(tracker.hasAggro(1, 100)).toBe(true);
      expect(tracker.hasAggro(1, 200)).toBe(true);
      expect(tracker.getMobAggroCount(1)).toBe(2);
    });

    it('should update the reverse lookup (player -> mobs)', () => {
      tracker.addAggro(1, 100);
      tracker.addAggro(2, 100);
      const mobs = tracker.getMobsAttacking(100);
      expect(mobs).toContain(1);
      expect(mobs).toContain(2);
    });
  });

  // ---------------------------------------------------------------
  // removeAggro
  // ---------------------------------------------------------------
  describe('removeAggro', () => {
    it('should remove a specific mob-player aggro link', () => {
      tracker.addAggro(1, 100, 5);
      tracker.removeAggro(1, 100);
      expect(tracker.hasAggro(1, 100)).toBe(false);
    });

    it('should normalise string IDs when removing', () => {
      tracker.addAggro(1, 100, 5);
      tracker.removeAggro('1', '100');
      expect(tracker.hasAggro(1, 100)).toBe(false);
    });

    it('should leave other players on the same mob untouched', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 3);
      tracker.removeAggro(1, 100);
      expect(tracker.hasAggro(1, 200)).toBe(true);
      expect(tracker.getMobAggroCount(1)).toBe(1);
    });

    it('should update the reverse lookup', () => {
      tracker.addAggro(1, 100);
      tracker.removeAggro(1, 100);
      expect(tracker.getMobsAttacking(100)).toEqual([]);
    });

    it('should be safe to call when no aggro exists', () => {
      expect(() => tracker.removeAggro(999, 888)).not.toThrow();
    });

    it('should clean up empty maps after last entry removed', () => {
      tracker.addAggro(1, 100);
      tracker.removeAggro(1, 100);
      // After removal the mob and player entries should be fully purged
      expect(tracker.getMobAggroCount(1)).toBe(0);
      expect(tracker.getPlayerAggroCount(100)).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // clearMobAggro
  // ---------------------------------------------------------------
  describe('clearMobAggro', () => {
    it('should remove all players from a mob hatelist', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 3);
      tracker.clearMobAggro(1);
      expect(tracker.getMobAggroCount(1)).toBe(0);
      expect(tracker.hasAggro(1, 100)).toBe(false);
      expect(tracker.hasAggro(1, 200)).toBe(false);
    });

    it('should update all affected players reverse lookups', () => {
      tracker.addAggro(1, 100);
      tracker.addAggro(2, 100);
      tracker.clearMobAggro(1);
      const mobs = tracker.getMobsAttacking(100);
      expect(mobs).not.toContain(1);
      expect(mobs).toContain(2);
    });

    it('should clean up player entries when mob was their only attacker', () => {
      tracker.addAggro(1, 100);
      tracker.clearMobAggro(1);
      expect(tracker.getPlayerAggroCount(100)).toBe(0);
    });

    it('should normalise string mob IDs', () => {
      tracker.addAggro(1, 100, 5);
      tracker.clearMobAggro('1');
      expect(tracker.getMobAggroCount(1)).toBe(0);
    });

    it('should be safe to call for a mob with no aggro', () => {
      expect(() => tracker.clearMobAggro(999)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------
  // clearPlayerAggro
  // ---------------------------------------------------------------
  describe('clearPlayerAggro', () => {
    it('should remove a player from all mob hatelists', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(2, 100, 3);
      tracker.clearPlayerAggro(100);
      expect(tracker.hasAggro(1, 100)).toBe(false);
      expect(tracker.hasAggro(2, 100)).toBe(false);
    });

    it('should clean up mob entries when player was the only target', () => {
      tracker.addAggro(1, 100);
      tracker.clearPlayerAggro(100);
      expect(tracker.getMobAggroCount(1)).toBe(0);
    });

    it('should leave other players on the same mobs untouched', () => {
      tracker.addAggro(1, 100);
      tracker.addAggro(1, 200);
      tracker.clearPlayerAggro(100);
      expect(tracker.hasAggro(1, 200)).toBe(true);
      expect(tracker.getMobAggroCount(1)).toBe(1);
    });

    it('should normalise string player IDs', () => {
      tracker.addAggro(1, 100);
      tracker.clearPlayerAggro('100');
      expect(tracker.hasAggro(1, 100)).toBe(false);
    });

    it('should be safe to call for a player with no aggro', () => {
      expect(() => tracker.clearPlayerAggro(888)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------
  // hasAggro
  // ---------------------------------------------------------------
  describe('hasAggro', () => {
    it('should return true when aggro exists', () => {
      tracker.addAggro(1, 100);
      expect(tracker.hasAggro(1, 100)).toBe(true);
    });

    it('should return false when no aggro exists', () => {
      expect(tracker.hasAggro(1, 100)).toBe(false);
    });

    it('should return false after aggro is removed', () => {
      tracker.addAggro(1, 100);
      tracker.removeAggro(1, 100);
      expect(tracker.hasAggro(1, 100)).toBe(false);
    });

    it('should return false for wrong player on same mob', () => {
      tracker.addAggro(1, 100);
      expect(tracker.hasAggro(1, 200)).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // getHate
  // ---------------------------------------------------------------
  describe('getHate', () => {
    it('should return 0 for non-existent relationship', () => {
      expect(tracker.getHate(1, 100)).toBe(0);
    });

    it('should return accumulated hate', () => {
      tracker.addAggro(1, 100, 10);
      tracker.addAggro(1, 100, 5);
      expect(tracker.getHate(1, 100)).toBe(15);
    });
  });

  // ---------------------------------------------------------------
  // getHatedPlayerId (rank-based)
  // ---------------------------------------------------------------
  describe('getHatedPlayerId', () => {
    it('should return the highest-hate player by default (rank 1)', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 10);
      tracker.addAggro(1, 300, 3);
      expect(tracker.getHatedPlayerId(1)).toBe(200);
    });

    it('should return the second-highest when rank is 2', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 10);
      tracker.addAggro(1, 300, 3);
      expect(tracker.getHatedPlayerId(1, 2)).toBe(100);
    });

    it('should return the third-highest when rank is 3', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 10);
      tracker.addAggro(1, 300, 3);
      expect(tracker.getHatedPlayerId(1, 3)).toBe(300);
    });

    it('should return null when rank exceeds number of targets', () => {
      tracker.addAggro(1, 100, 5);
      expect(tracker.getHatedPlayerId(1, 2)).toBeNull();
    });

    it('should return null for a mob with no aggro', () => {
      expect(tracker.getHatedPlayerId(1)).toBeNull();
    });

    it('should return null for rank 0 (out of bounds)', () => {
      tracker.addAggro(1, 100, 5);
      expect(tracker.getHatedPlayerId(1, 0)).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // getHighestHateTarget
  // ---------------------------------------------------------------
  describe('getHighestHateTarget', () => {
    it('should return the player with the most hate', () => {
      tracker.addAggro(1, 100, 3);
      tracker.addAggro(1, 200, 7);
      expect(tracker.getHighestHateTarget(1)).toBe(200);
    });

    it('should skip the specified player', () => {
      tracker.addAggro(1, 100, 3);
      tracker.addAggro(1, 200, 7);
      expect(tracker.getHighestHateTarget(1, 200)).toBe(100);
    });

    it('should return null when all players are skipped', () => {
      tracker.addAggro(1, 100, 3);
      expect(tracker.getHighestHateTarget(1, 100)).toBeNull();
    });

    it('should return null for a mob with no aggro', () => {
      expect(tracker.getHighestHateTarget(1)).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // getMobsAttacking
  // ---------------------------------------------------------------
  describe('getMobsAttacking', () => {
    it('should return all mobs attacking a player', () => {
      tracker.addAggro(1, 100);
      tracker.addAggro(2, 100);
      tracker.addAggro(3, 100);
      const mobs = tracker.getMobsAttacking(100);
      expect(mobs.sort()).toEqual([1, 2, 3]);
    });

    it('should return an empty array when no mobs are attacking', () => {
      expect(tracker.getMobsAttacking(100)).toEqual([]);
    });

    it('should not include mobs attacking other players', () => {
      tracker.addAggro(1, 100);
      tracker.addAggro(2, 200);
      expect(tracker.getMobsAttacking(100)).toEqual([1]);
    });
  });

  // ---------------------------------------------------------------
  // getPlayersHated
  // ---------------------------------------------------------------
  describe('getPlayersHated', () => {
    it('should return all AggroEntry objects for a mob', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 3);
      const entries = tracker.getPlayersHated(1);
      expect(entries).toHaveLength(2);
      const ids = entries.map((e: AggroEntry) => e.entityId).sort();
      expect(ids).toEqual([100, 200]);
    });

    it('should return an empty array for a mob with no aggro', () => {
      expect(tracker.getPlayersHated(1)).toEqual([]);
    });

    it('should include correct hate values', () => {
      tracker.addAggro(1, 100, 7);
      const entries = tracker.getPlayersHated(1);
      expect(entries[0].hate).toBe(7);
    });
  });

  // ---------------------------------------------------------------
  // forEachPlayerHated
  // ---------------------------------------------------------------
  describe('forEachPlayerHated', () => {
    it('should invoke callback for every hated player', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 3);

      const visited: Array<{ playerId: number; hate: number }> = [];
      tracker.forEachPlayerHated(1, (playerId, entry) => {
        visited.push({ playerId, hate: entry.hate });
      });

      expect(visited).toHaveLength(2);
      const ids = visited.map((v) => v.playerId).sort();
      expect(ids).toEqual([100, 200]);
    });

    it('should not invoke callback if mob has no aggro', () => {
      const cb = vi.fn();
      tracker.forEachPlayerHated(999, cb);
      expect(cb).not.toHaveBeenCalled();
    });

    it('should pass correct AggroEntry data', () => {
      tracker.addAggro(1, 100, 12);

      tracker.forEachPlayerHated(1, (_pid, entry) => {
        expect(entry.entityId).toBe(100);
        expect(entry.hate).toBe(12);
        expect(entry.lastDamageTime).toBeGreaterThan(0);
      });
    });
  });

  // ---------------------------------------------------------------
  // forEachMobAttacking
  // ---------------------------------------------------------------
  describe('forEachMobAttacking', () => {
    it('should invoke callback for every mob attacking a player', () => {
      tracker.addAggro(1, 100);
      tracker.addAggro(2, 100);

      const visited: number[] = [];
      tracker.forEachMobAttacking(100, (mobId) => {
        visited.push(mobId);
      });

      expect(visited.sort()).toEqual([1, 2]);
    });

    it('should not invoke callback if player has no attackers', () => {
      const cb = vi.fn();
      tracker.forEachMobAttacking(999, cb);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // getMobAggroCount
  // ---------------------------------------------------------------
  describe('getMobAggroCount', () => {
    it('should return the number of players a mob hates', () => {
      tracker.addAggro(1, 100);
      tracker.addAggro(1, 200);
      tracker.addAggro(1, 300);
      expect(tracker.getMobAggroCount(1)).toBe(3);
    });

    it('should return 0 for a mob with no aggro', () => {
      expect(tracker.getMobAggroCount(1)).toBe(0);
    });

    it('should decrease after removeAggro', () => {
      tracker.addAggro(1, 100);
      tracker.addAggro(1, 200);
      tracker.removeAggro(1, 100);
      expect(tracker.getMobAggroCount(1)).toBe(1);
    });
  });

  // ---------------------------------------------------------------
  // getPlayerAggroCount
  // ---------------------------------------------------------------
  describe('getPlayerAggroCount', () => {
    it('should return the number of mobs attacking a player', () => {
      tracker.addAggro(1, 100);
      tracker.addAggro(2, 100);
      expect(tracker.getPlayerAggroCount(100)).toBe(2);
    });

    it('should return 0 when no mobs are attacking', () => {
      expect(tracker.getPlayerAggroCount(100)).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // setEntityLookup / getMobEntitiesAttacking
  // ---------------------------------------------------------------
  describe('getMobEntitiesAttacking', () => {
    const entities: Record<number, CombatEntity> = {
      1: { id: 1, isDead: false, hitPoints: 50 },
      2: { id: 2, isDead: false, hitPoints: 30 },
      3: { id: 3, isDead: true, hitPoints: 0 },
      4: { id: 4, isDead: false, hitPoints: 0 },
    };

    it('should return living mob entities attacking a player', () => {
      tracker.setEntityLookup((id) => entities[id]);
      tracker.addAggro(1, 100);
      tracker.addAggro(2, 100);

      const result = tracker.getMobEntitiesAttacking(100);
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id).sort()).toEqual([1, 2]);
    });

    it('should exclude dead mobs (isDead flag)', () => {
      tracker.setEntityLookup((id) => entities[id]);
      tracker.addAggro(1, 100);
      tracker.addAggro(3, 100);

      const result = tracker.getMobEntitiesAttacking(100);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should exclude mobs with 0 hitPoints', () => {
      tracker.setEntityLookup((id) => entities[id]);
      tracker.addAggro(1, 100);
      tracker.addAggro(4, 100);

      const result = tracker.getMobEntitiesAttacking(100);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should include mobs where hitPoints is undefined', () => {
      const noHpEntity: CombatEntity = { id: 5, isDead: false };
      tracker.setEntityLookup((id) => (id === 5 ? noHpEntity : entities[id]));
      tracker.addAggro(5, 100);

      const result = tracker.getMobEntitiesAttacking(100);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(5);
    });

    it('should skip mobs not found by entity lookup', () => {
      tracker.setEntityLookup(() => undefined);
      tracker.addAggro(1, 100);

      const result = tracker.getMobEntitiesAttacking(100);
      expect(result).toHaveLength(0);
    });

    it('should return empty array when entityLookup is not set', () => {
      tracker.addAggro(1, 100);

      const result = tracker.getMobEntitiesAttacking(100);
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // forEachMobAttackingWithEntity
  // ---------------------------------------------------------------
  describe('forEachMobAttackingWithEntity', () => {
    const entities: Record<number, CombatEntity> = {
      1: { id: 1, isDead: false, hitPoints: 50 },
      2: { id: 2, isDead: true, hitPoints: 0 },
    };

    it('should invoke callback for each living mob entity', () => {
      tracker.setEntityLookup((id) => entities[id]);
      tracker.addAggro(1, 100);
      tracker.addAggro(2, 100);

      const visited: CombatEntity[] = [];
      tracker.forEachMobAttackingWithEntity<CombatEntity>(100, (mob) => {
        visited.push(mob);
      });

      expect(visited).toHaveLength(1);
      expect(visited[0].id).toBe(1);
    });

    it('should not invoke callback when entityLookup is unset', () => {
      tracker.addAggro(1, 100);

      const cb = vi.fn();
      tracker.forEachMobAttackingWithEntity(100, cb);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // Complex / integration-style scenarios
  // ---------------------------------------------------------------
  describe('complex scenarios', () => {
    it('should handle multiple mobs each hating multiple players', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 3);
      tracker.addAggro(2, 100, 2);
      tracker.addAggro(2, 300, 8);

      expect(tracker.getMobAggroCount(1)).toBe(2);
      expect(tracker.getMobAggroCount(2)).toBe(2);
      expect(tracker.getPlayerAggroCount(100)).toBe(2);
      expect(tracker.getPlayerAggroCount(200)).toBe(1);
      expect(tracker.getPlayerAggroCount(300)).toBe(1);
    });

    it('clearPlayerAggro should not corrupt other relationships', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 3);
      tracker.addAggro(2, 100, 2);
      tracker.addAggro(2, 200, 8);

      tracker.clearPlayerAggro(100);

      // mob 1 and mob 2 should still hate player 200
      expect(tracker.hasAggro(1, 200)).toBe(true);
      expect(tracker.hasAggro(2, 200)).toBe(true);
      // player 100 should be gone from both
      expect(tracker.hasAggro(1, 100)).toBe(false);
      expect(tracker.hasAggro(2, 100)).toBe(false);
      // counts
      expect(tracker.getMobAggroCount(1)).toBe(1);
      expect(tracker.getMobAggroCount(2)).toBe(1);
      expect(tracker.getPlayerAggroCount(100)).toBe(0);
      expect(tracker.getPlayerAggroCount(200)).toBe(2);
    });

    it('clearMobAggro should not corrupt other relationships', () => {
      tracker.addAggro(1, 100, 5);
      tracker.addAggro(1, 200, 3);
      tracker.addAggro(2, 100, 2);

      tracker.clearMobAggro(1);

      // mob 2 should still hate player 100
      expect(tracker.hasAggro(2, 100)).toBe(true);
      expect(tracker.getPlayerAggroCount(100)).toBe(1);
      // player 200 was only targeted by mob 1, so should be fully gone
      expect(tracker.getPlayerAggroCount(200)).toBe(0);
    });

    it('hate rankings update correctly after incremental addAggro', () => {
      tracker.addAggro(1, 100, 1);
      tracker.addAggro(1, 200, 10);
      expect(tracker.getHatedPlayerId(1, 1)).toBe(200);

      // player 100 overtakes player 200
      tracker.addAggro(1, 100, 20);
      expect(tracker.getHatedPlayerId(1, 1)).toBe(100);
      expect(tracker.getHatedPlayerId(1, 2)).toBe(200);
    });

    it('should handle mixed string and number IDs consistently', () => {
      tracker.addAggro('5', 100, 3);
      tracker.addAggro(5, '100', 2);
      expect(tracker.getHate(5, 100)).toBe(5);
      expect(tracker.getMobAggroCount(5)).toBe(1);
    });
  });
});
