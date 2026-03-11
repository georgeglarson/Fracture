/**
 * Tests for ProgressionService
 * Covers: XP granting, leveling up, gold management, level cap,
 *         state serialization/loading, and callback invocations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Formulas } from '../formulas';
import {
  ProgressionService,
  createProgressionService,
  ProgressionCallbacks,
} from '../player/progression.service';

/**
 * Build a mock ProgressionCallbacks object with vi.fn() stubs.
 */
function makeCallbacks(): ProgressionCallbacks {
  return {
    send: vi.fn(),
    updateHitPoints: vi.fn(),
    getMaxHitPoints: vi.fn().mockReturnValue(200),
    checkLevelAchievements: vi.fn(),
    checkGoldAchievements: vi.fn(),
    getName: vi.fn().mockReturnValue('TestPlayer'),
  };
}

describe('ProgressionService', () => {
  let service: ProgressionService;
  let callbacks: ProgressionCallbacks;

  beforeEach(() => {
    vi.restoreAllMocks();
    callbacks = makeCallbacks();
    service = new ProgressionService(callbacks);
  });

  // --------------------------------------------------------------------------
  // createProgressionService factory
  // --------------------------------------------------------------------------

  describe('createProgressionService', () => {
    it('should return a ProgressionService instance', () => {
      const svc = createProgressionService(callbacks);
      expect(svc).toBeInstanceOf(ProgressionService);
    });

    it('should initialise with level 1, 0 XP, and 0 gold', () => {
      const svc = createProgressionService(callbacks);
      expect(svc.level).toBe(1);
      expect(svc.xp).toBe(0);
      expect(svc.gold).toBe(0);
    });

    it('should compute xpToNext from Formulas for level 1', () => {
      const svc = createProgressionService(callbacks);
      expect(svc.xpToNext).toBe(Formulas.xpToNextLevel(1));
    });
  });

  // --------------------------------------------------------------------------
  // Constructor / initial state
  // --------------------------------------------------------------------------

  describe('initial state', () => {
    it('should start at level 1 with 0 XP and 0 gold', () => {
      expect(service.level).toBe(1);
      expect(service.xp).toBe(0);
      expect(service.gold).toBe(0);
    });

    it('should set xpToNext via Formulas.xpToNextLevel(1)', () => {
      expect(service.xpToNext).toBe(Formulas.xpToNextLevel(1));
    });
  });

  // --------------------------------------------------------------------------
  // grantXP
  // --------------------------------------------------------------------------

  describe('grantXP', () => {
    it('should increase XP by the given amount', () => {
      const result = service.grantXP(50);

      expect(service.xp).toBe(50);
      expect(result.amount).toBe(50);
      expect(result.currentXP).toBe(50);
      expect(result.xpToNext).toBe(Formulas.xpToNextLevel(1));
      expect(result.levelUps).toHaveLength(0);
    });

    it('should accumulate XP across multiple calls', () => {
      service.grantXP(30);
      service.grantXP(20);

      expect(service.xp).toBe(50);
    });

    it('should send an XP gain message to the player', () => {
      service.grantXP(42);

      expect(callbacks.send).toHaveBeenCalledTimes(1);
      // The first send call should be the serialized XpGain message
      const payload = (callbacks.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(payload).toBeInstanceOf(Array);
    });

    // Level-up scenarios

    it('should level up when XP meets the threshold exactly', () => {
      const xpNeeded = Formulas.xpToNextLevel(1); // 100 at level 1
      const result = service.grantXP(xpNeeded);

      expect(service.level).toBe(2);
      expect(result.levelUps).toHaveLength(1);
      expect(result.levelUps[0].newLevel).toBe(2);
      expect(service.xp).toBe(0); // leftover XP should be 0
      expect(service.xpToNext).toBe(Formulas.xpToNextLevel(2));
    });

    it('should carry over excess XP after a level up', () => {
      const xpNeeded = Formulas.xpToNextLevel(1);
      const excess = 17;
      service.grantXP(xpNeeded + excess);

      expect(service.level).toBe(2);
      expect(service.xp).toBe(excess);
    });

    it('should handle multiple level ups from a single XP grant', () => {
      // Give enough XP to go from level 1 to level 3 or beyond
      const xpFor1 = Formulas.xpToNextLevel(1);
      const xpFor2 = Formulas.xpToNextLevel(2);
      const totalNeeded = xpFor1 + xpFor2 + 5; // 5 XP leftover into level 3

      const result = service.grantXP(totalNeeded);

      expect(service.level).toBe(3);
      expect(result.levelUps).toHaveLength(2);
      expect(result.levelUps[0].newLevel).toBe(2);
      expect(result.levelUps[1].newLevel).toBe(3);
      expect(service.xp).toBe(5);
    });

    it('should report correct bonusHP and bonusDamage in LevelUpResult', () => {
      const result = service.grantXP(Formulas.xpToNextLevel(1));

      const lvlUp = result.levelUps[0];
      expect(lvlUp.bonusHP).toBe(Formulas.levelBonusHP(2));
      expect(lvlUp.bonusDamage).toBe(Formulas.levelBonusDamage(2));
    });

    it('should invoke updateHitPoints on each level up', () => {
      const xpFor1 = Formulas.xpToNextLevel(1);
      const xpFor2 = Formulas.xpToNextLevel(2);
      service.grantXP(xpFor1 + xpFor2);

      expect(callbacks.updateHitPoints).toHaveBeenCalledTimes(2);
    });

    it('should invoke checkLevelAchievements with the new level', () => {
      service.grantXP(Formulas.xpToNextLevel(1));

      expect(callbacks.checkLevelAchievements).toHaveBeenCalledWith(2);
    });

    it('should send LevelUp and HitPoints messages on level up', () => {
      service.grantXP(Formulas.xpToNextLevel(1));

      // XP gain message + LevelUp message + HitPoints message = 3 sends
      expect(callbacks.send).toHaveBeenCalledTimes(3);
    });

    // Level-cap behaviour

    it('should not grant XP when already at MAX_LEVEL', () => {
      service.setLevel(Formulas.MAX_LEVEL);

      const result = service.grantXP(9999);

      expect(result.amount).toBe(0);
      expect(result.levelUps).toHaveLength(0);
      expect(service.level).toBe(Formulas.MAX_LEVEL);
      expect(callbacks.send).not.toHaveBeenCalled();
    });

    it('should stop leveling at MAX_LEVEL even with massive XP', () => {
      // Start near the cap
      service.setLevel(Formulas.MAX_LEVEL - 1);
      (callbacks.send as ReturnType<typeof vi.fn>).mockClear();
      (callbacks.updateHitPoints as ReturnType<typeof vi.fn>).mockClear();

      const xpNeeded = Formulas.xpToNextLevel(Formulas.MAX_LEVEL - 1);
      const result = service.grantXP(xpNeeded + 999999);

      expect(service.level).toBe(Formulas.MAX_LEVEL);
      expect(result.levelUps).toHaveLength(1);
      expect(result.levelUps[0].newLevel).toBe(Formulas.MAX_LEVEL);
    });
  });

  // --------------------------------------------------------------------------
  // grantGold
  // --------------------------------------------------------------------------

  describe('grantGold', () => {
    it('should increase gold by the given amount', () => {
      const result = service.grantGold(100);

      expect(service.gold).toBe(100);
      expect(result.amount).toBe(100);
      expect(result.total).toBe(100);
    });

    it('should accumulate gold across multiple calls', () => {
      service.grantGold(50);
      service.grantGold(75);

      expect(service.gold).toBe(125);
    });

    it('should return the running total', () => {
      service.grantGold(10);
      const result = service.grantGold(20);

      expect(result.total).toBe(30);
    });

    it('should send a GoldGain message', () => {
      service.grantGold(42);

      expect(callbacks.send).toHaveBeenCalledTimes(1);
      const payload = (callbacks.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(payload).toBeInstanceOf(Array);
    });

    it('should invoke checkGoldAchievements for positive amounts', () => {
      service.grantGold(100);

      expect(callbacks.checkGoldAchievements).toHaveBeenCalledWith(100);
    });

    it('should not invoke checkGoldAchievements for zero amount', () => {
      service.grantGold(0);

      expect(callbacks.checkGoldAchievements).not.toHaveBeenCalled();
    });

    it('should not invoke checkGoldAchievements for negative amounts', () => {
      service.grantGold(-10);

      expect(callbacks.checkGoldAchievements).not.toHaveBeenCalled();
    });

    it('should still adjust gold for negative amounts (spending)', () => {
      service.grantGold(100);
      service.grantGold(-30);

      expect(service.gold).toBe(70);
    });
  });

  // --------------------------------------------------------------------------
  // setLevel
  // --------------------------------------------------------------------------

  describe('setLevel', () => {
    it('should set level and recalculate xpToNext', () => {
      service.setLevel(10);

      expect(service.level).toBe(10);
      expect(service.xpToNext).toBe(Formulas.xpToNextLevel(10));
    });

    it('should default XP to 0', () => {
      service.setLevel(5);

      expect(service.xp).toBe(0);
    });

    it('should accept an explicit XP value', () => {
      service.setLevel(5, 42);

      expect(service.level).toBe(5);
      expect(service.xp).toBe(42);
    });

    it('should clamp level to minimum of 1', () => {
      service.setLevel(0);
      expect(service.level).toBe(1);

      service.setLevel(-5);
      expect(service.level).toBe(1);
    });

    it('should clamp level to MAX_LEVEL', () => {
      service.setLevel(999);

      expect(service.level).toBe(Formulas.MAX_LEVEL);
      expect(service.xpToNext).toBe(Formulas.xpToNextLevel(Formulas.MAX_LEVEL));
    });

    it('should invoke updateHitPoints', () => {
      service.setLevel(10);

      expect(callbacks.updateHitPoints).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // setGold
  // --------------------------------------------------------------------------

  describe('setGold', () => {
    it('should set gold to the given value', () => {
      service.setGold(500);

      expect(service.gold).toBe(500);
    });

    it('should clamp negative values to 0', () => {
      service.setGold(-100);

      expect(service.gold).toBe(0);
    });

    it('should allow setting gold to 0', () => {
      service.setGold(100);
      service.setGold(0);

      expect(service.gold).toBe(0);
    });

    it('should not invoke any callbacks', () => {
      service.setGold(500);

      expect(callbacks.send).not.toHaveBeenCalled();
      expect(callbacks.checkGoldAchievements).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // XP-to-next-level calculations (via constructor & level-ups)
  // --------------------------------------------------------------------------

  describe('xpToNext tracking', () => {
    it('should initialise xpToNext to the level-1 requirement', () => {
      expect(service.xpToNext).toBe(100); // Formulas: 100 * 1.15^0 = 100
    });

    it('should update xpToNext after a level up', () => {
      service.grantXP(Formulas.xpToNextLevel(1));

      expect(service.xpToNext).toBe(Formulas.xpToNextLevel(2));
    });

    it('should track xpToNext correctly through multiple level ups', () => {
      service.setLevel(10);
      const expected = Formulas.xpToNextLevel(10);

      expect(service.xpToNext).toBe(expected);
    });

    it('should be Infinity at MAX_LEVEL', () => {
      service.setLevel(Formulas.MAX_LEVEL);

      expect(service.xpToNext).toBe(Infinity);
    });
  });

  // --------------------------------------------------------------------------
  // getState / loadState (serialization round-trip)
  // --------------------------------------------------------------------------

  describe('getState', () => {
    it('should return current level, xp, xpToNext, and gold', () => {
      service.setLevel(15, 42);
      service.setGold(300);

      const state = service.getState();

      expect(state).toEqual({
        level: 15,
        xp: 42,
        xpToNext: Formulas.xpToNextLevel(15),
        gold: 300,
      });
    });

    it('should reflect default state for a fresh service', () => {
      const state = service.getState();

      expect(state).toEqual({
        level: 1,
        xp: 0,
        xpToNext: Formulas.xpToNextLevel(1),
        gold: 0,
      });
    });
  });

  describe('loadState', () => {
    it('should restore full state from a saved object', () => {
      service.loadState({ level: 20, xp: 55, gold: 1000 });

      expect(service.level).toBe(20);
      expect(service.xp).toBe(55);
      expect(service.gold).toBe(1000);
      expect(service.xpToNext).toBe(Formulas.xpToNextLevel(20));
    });

    it('should handle partial state (only level)', () => {
      service.grantGold(100);
      service.loadState({ level: 5 });

      expect(service.level).toBe(5);
      expect(service.xpToNext).toBe(Formulas.xpToNextLevel(5));
      // xp and gold should remain as they were
      expect(service.gold).toBe(100);
    });

    it('should handle partial state (only gold)', () => {
      service.setLevel(10);
      service.loadState({ gold: 999 });

      expect(service.gold).toBe(999);
      expect(service.level).toBe(10); // unchanged
    });

    it('should clamp level to valid range', () => {
      service.loadState({ level: 0 });
      expect(service.level).toBe(1);

      service.loadState({ level: 9999 });
      expect(service.level).toBe(Formulas.MAX_LEVEL);
    });

    it('should clamp gold to non-negative', () => {
      service.loadState({ gold: -50 });

      expect(service.gold).toBe(0);
    });

    it('should recalculate xpToNext based on loaded level', () => {
      service.loadState({ level: 30 });

      expect(service.xpToNext).toBe(Formulas.xpToNextLevel(30));
    });

    it('should handle empty partial state without error', () => {
      service.setLevel(10, 50);
      service.setGold(200);

      service.loadState({});

      expect(service.level).toBe(10);
      expect(service.xp).toBe(50);
      expect(service.gold).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // Level cap edge cases (MAX_LEVEL = 50)
  // --------------------------------------------------------------------------

  describe('level cap behaviour', () => {
    it('MAX_LEVEL should be 50', () => {
      expect(Formulas.MAX_LEVEL).toBe(50);
    });

    it('should not level past MAX_LEVEL when XP is granted at level 49', () => {
      service.setLevel(49);
      (callbacks.updateHitPoints as ReturnType<typeof vi.fn>).mockClear();

      const xpNeeded = Formulas.xpToNextLevel(49);
      service.grantXP(xpNeeded);

      expect(service.level).toBe(50);
      // One level-up should have occurred
      expect(callbacks.updateHitPoints).toHaveBeenCalledTimes(1);
    });

    it('should return xpToNext as Infinity when at MAX_LEVEL', () => {
      service.setLevel(Formulas.MAX_LEVEL);

      expect(service.xpToNext).toBe(Infinity);
    });

    it('grantXP at MAX_LEVEL should be a no-op', () => {
      service.setLevel(Formulas.MAX_LEVEL);
      (callbacks.send as ReturnType<typeof vi.fn>).mockClear();

      const result = service.grantXP(100);

      expect(result.amount).toBe(0);
      expect(result.currentXP).toBe(service.xp);
      expect(result.levelUps).toHaveLength(0);
      expect(callbacks.send).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Callback integration
  // --------------------------------------------------------------------------

  describe('callback invocations', () => {
    it('should call getName when granting XP (for logging)', () => {
      service.grantXP(10);

      expect(callbacks.getName).toHaveBeenCalled();
    });

    it('should call getName when granting gold (for logging)', () => {
      service.grantGold(10);

      expect(callbacks.getName).toHaveBeenCalled();
    });

    it('should call getMaxHitPoints during level up (for HP message)', () => {
      service.grantXP(Formulas.xpToNextLevel(1));

      expect(callbacks.getMaxHitPoints).toHaveBeenCalled();
    });

    it('should call checkLevelAchievements once per level gained', () => {
      const xpFor1 = Formulas.xpToNextLevel(1);
      const xpFor2 = Formulas.xpToNextLevel(2);
      service.grantXP(xpFor1 + xpFor2);

      expect(callbacks.checkLevelAchievements).toHaveBeenCalledTimes(2);
      expect(callbacks.checkLevelAchievements).toHaveBeenCalledWith(2);
      expect(callbacks.checkLevelAchievements).toHaveBeenCalledWith(3);
    });

    it('should not call level/gold achievement callbacks on setLevel/setGold', () => {
      service.setLevel(10);
      service.setGold(500);

      expect(callbacks.checkLevelAchievements).not.toHaveBeenCalled();
      expect(callbacks.checkGoldAchievements).not.toHaveBeenCalled();
    });
  });
});
