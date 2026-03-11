/**
 * Tests for ProgressionHandler
 * Covers: applyXpGain, applyGoldMultiplier, initProgression,
 *         handleAscendRequest, performAscension, calculateXpMultiplier,
 *         getSessionEfficiency, calculateRestedXp, shouldResetEfficiency,
 *         getAscensionTitle, canAscend, ascension bonus multipliers,
 *         edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  applyXpGain,
  applyGoldMultiplier,
  initProgression,
  handleAscendRequest,
  performAscension,
  calculateXpMultiplier,
  getSessionEfficiency,
  calculateRestedXp,
  shouldResetEfficiency,
  getAscensionTitle,
  canAscend,
  getAscensionDamageMultiplier,
  getAscensionHpMultiplier,
  sendProgressionInit,
  onPlayerLogout,
  ProgressionPlayerContext,
} from '../player/progression.handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockCtx(overrides?: Partial<ProgressionPlayerContext>): ProgressionPlayerContext {
  const ctx: ProgressionPlayerContext = {
    id: 1,
    name: 'TestPlayer',
    level: 10,
    xp: 500,

    ascensionCount: 0,
    restedXp: 0,
    lastLogoutTime: 0,
    sessionStartTime: Date.now(),

    send: vi.fn(),
    setLevel: vi.fn((level: number) => { ctx.level = level; }),
    setXp: vi.fn((xp: number) => { ctx.xp = xp; }),
    getMaxHitPoints: vi.fn(() => 200),

    ...overrides,
  };
  return ctx;
}

// ==========================================================================
// Tests
// ==========================================================================

describe('ProgressionHandler', () => {
  let ctx: ProgressionPlayerContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    ctx = makeMockCtx();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ========================================================================
  // getAscensionTitle
  // ========================================================================

  describe('getAscensionTitle', () => {
    it('should return empty string for ascension 0', () => {
      expect(getAscensionTitle(0)).toBe('');
    });

    it('should return "Ascended" for ascension 1', () => {
      expect(getAscensionTitle(1)).toBe('Ascended');
    });

    it('should return "Transcendent" for ascension 2', () => {
      expect(getAscensionTitle(2)).toBe('Transcendent');
    });

    it('should return "Exalted" for ascension 3', () => {
      expect(getAscensionTitle(3)).toBe('Exalted');
    });

    it('should return "Divine" for ascension 4', () => {
      expect(getAscensionTitle(4)).toBe('Divine');
    });

    it('should return "Eternal" for ascension 5', () => {
      expect(getAscensionTitle(5)).toBe('Eternal');
    });

    it('should return "Eternal II" for ascension 6', () => {
      // toRoman(6 - 4) = toRoman(2) = "II"
      expect(getAscensionTitle(6)).toBe('Eternal II');
    });

    it('should return "Eternal III" for ascension 7', () => {
      expect(getAscensionTitle(7)).toBe('Eternal III');
    });

    it('should return "Eternal V" for ascension 9', () => {
      expect(getAscensionTitle(9)).toBe('Eternal V');
    });

    it('should return "Eternal X" for ascension 14', () => {
      expect(getAscensionTitle(14)).toBe('Eternal X');
    });
  });

  // ========================================================================
  // getSessionEfficiency
  // ========================================================================

  describe('getSessionEfficiency', () => {
    it('should return 1.0 when session just started', () => {
      const start = Date.now();
      expect(getSessionEfficiency(start)).toBe(1.0);
    });

    it('should return 1.0 for first 30 minutes', () => {
      const start = Date.now() - (20 * 60 * 1000); // 20 minutes ago
      expect(getSessionEfficiency(start)).toBe(1.0);
    });

    it('should return 0.75 between 30-60 minutes', () => {
      const start = Date.now() - (45 * 60 * 1000); // 45 minutes ago
      expect(getSessionEfficiency(start)).toBe(0.75);
    });

    it('should return 0.50 between 60-90 minutes', () => {
      const start = Date.now() - (75 * 60 * 1000); // 75 minutes ago
      expect(getSessionEfficiency(start)).toBe(0.50);
    });

    it('should return 0.25 after 90 minutes', () => {
      const start = Date.now() - (120 * 60 * 1000); // 120 minutes ago
      expect(getSessionEfficiency(start)).toBe(0.25);
    });

    it('should return 1.0 when sessionStartTime is 0 (falsy)', () => {
      expect(getSessionEfficiency(0)).toBe(1.0);
    });

    it('should return 0.75 at exactly 30 minutes', () => {
      const start = Date.now() - (30 * 60 * 1000); // Exactly 30 minutes
      expect(getSessionEfficiency(start)).toBe(0.75);
    });

    it('should return 0.50 at exactly 60 minutes', () => {
      const start = Date.now() - (60 * 60 * 1000); // Exactly 60 minutes
      expect(getSessionEfficiency(start)).toBe(0.50);
    });

    it('should return 0.25 at exactly 90 minutes', () => {
      const start = Date.now() - (90 * 60 * 1000); // Exactly 90 minutes
      expect(getSessionEfficiency(start)).toBe(0.25);
    });
  });

  // ========================================================================
  // calculateRestedXp
  // ========================================================================

  describe('calculateRestedXp', () => {
    it('should return current rested XP when lastLogoutTime is 0', () => {
      expect(calculateRestedXp(0, 10)).toBe(10);
    });

    it('should add 5% per hour offline', () => {
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      // 2 hours * 5% = 10% + 0 existing = 10%
      const result = calculateRestedXp(twoHoursAgo, 0);
      expect(result).toBe(10);
    });

    it('should add rested XP to existing amount', () => {
      const oneHourAgo = Date.now() - (1 * 60 * 60 * 1000);
      // 1 hour * 5% = 5% + 20% existing = 25%
      const result = calculateRestedXp(oneHourAgo, 20);
      expect(result).toBe(25);
    });

    it('should cap at 100% maximum', () => {
      const thirtyHoursAgo = Date.now() - (30 * 60 * 60 * 1000);
      // 30 hours * 5% = 150% -> capped at 100%
      const result = calculateRestedXp(thirtyHoursAgo, 0);
      expect(result).toBe(100);
    });

    it('should cap at 100% when current rested plus gain exceeds max', () => {
      const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
      // 4 hours * 5% = 20% + 90% existing = 110% -> capped at 100%
      const result = calculateRestedXp(fourHoursAgo, 90);
      expect(result).toBe(100);
    });

    it('should round to 1 decimal place', () => {
      const halfHourAgo = Date.now() - (30 * 60 * 1000);
      // 0.5 hours * 5% = 2.5%
      const result = calculateRestedXp(halfHourAgo, 0);
      expect(result).toBe(2.5);
    });

    it('should return 0 for very recent logout (seconds ago)', () => {
      const justNow = Date.now() - (10 * 1000); // 10 seconds ago
      // 10 seconds / 3600 * 5 = 0.0138... rounds to 0
      const result = calculateRestedXp(justNow, 0);
      expect(result).toBe(0);
    });
  });

  // ========================================================================
  // shouldResetEfficiency
  // ========================================================================

  describe('shouldResetEfficiency', () => {
    it('should return true when lastLogoutTime is 0', () => {
      expect(shouldResetEfficiency(0)).toBe(true);
    });

    it('should return true when offline for 4+ hours', () => {
      const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
      expect(shouldResetEfficiency(fiveHoursAgo)).toBe(true);
    });

    it('should return true at exactly 4 hours', () => {
      const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
      expect(shouldResetEfficiency(fourHoursAgo)).toBe(true);
    });

    it('should return false when offline less than 4 hours', () => {
      const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
      expect(shouldResetEfficiency(threeHoursAgo)).toBe(false);
    });

    it('should return false when logged out just seconds ago', () => {
      const justNow = Date.now() - (10 * 1000);
      expect(shouldResetEfficiency(justNow)).toBe(false);
    });
  });

  // ========================================================================
  // calculateXpMultiplier
  // ========================================================================

  describe('calculateXpMultiplier', () => {
    it('should return 1.0 total for fresh session with no bonuses', () => {
      const result = calculateXpMultiplier(ctx);
      expect(result.total).toBe(1.0);
      expect(result.efficiency).toBe(1.0);
      expect(result.rested).toBe(0);
      expect(result.ascension).toBe(0);
    });

    it('should include rested XP bonus', () => {
      ctx.restedXp = 50; // 50%
      const result = calculateXpMultiplier(ctx);
      // rested = 50/100 = 0.5
      // total = 1.0 * (1 + 0.5 + 0) = 1.5
      expect(result.rested).toBe(0.5);
      expect(result.total).toBe(1.5);
    });

    it('should include ascension bonus', () => {
      ctx.ascensionCount = 3;
      const result = calculateXpMultiplier(ctx);
      // ascension = 3 * 0.10 = 0.30
      // total = 1.0 * (1 + 0 + 0.30) = 1.30
      expect(result.ascension).toBeCloseTo(0.30);
      expect(result.total).toBeCloseTo(1.30);
    });

    it('should combine rested and ascension bonuses', () => {
      ctx.restedXp = 100; // 100%
      ctx.ascensionCount = 2;
      const result = calculateXpMultiplier(ctx);
      // rested = 1.0, ascension = 0.20
      // total = 1.0 * (1 + 1.0 + 0.20) = 2.20
      expect(result.total).toBeCloseTo(2.20);
    });

    it('should apply efficiency reduction', () => {
      // 45 minutes into session -> 0.75 efficiency
      ctx.sessionStartTime = Date.now() - (45 * 60 * 1000);
      const result = calculateXpMultiplier(ctx);
      // total = 0.75 * (1 + 0 + 0) = 0.75
      expect(result.efficiency).toBe(0.75);
      expect(result.total).toBe(0.75);
    });

    it('should apply efficiency reduction with bonuses', () => {
      ctx.sessionStartTime = Date.now() - (45 * 60 * 1000);
      ctx.restedXp = 50;
      ctx.ascensionCount = 1;
      const result = calculateXpMultiplier(ctx);
      // efficiency = 0.75, rested = 0.5, ascension = 0.10
      // total = 0.75 * (1 + 0.5 + 0.10) = 0.75 * 1.60 = 1.20
      expect(result.total).toBeCloseTo(1.20);
    });
  });

  // ========================================================================
  // applyXpGain
  // ========================================================================

  describe('applyXpGain', () => {
    it('should return base XP when no multipliers are active', () => {
      const result = applyXpGain(ctx, 100);
      // Multiplier = 1.0 * (1 + 0 + 0) = 1.0
      expect(result.finalXp).toBe(100);
      expect(result.restedConsumed).toBe(0);
    });

    it('should apply efficiency multiplier', () => {
      ctx.sessionStartTime = Date.now() - (45 * 60 * 1000); // 0.75 efficiency
      const result = applyXpGain(ctx, 100);
      // floor(100 * 0.75) = 75
      expect(result.finalXp).toBe(75);
    });

    it('should apply rested XP bonus', () => {
      ctx.restedXp = 50; // 50%
      const result = applyXpGain(ctx, 100);
      // total = 1.0 * (1 + 0.5) = 1.5
      // floor(100 * 1.5) = 150
      expect(result.finalXp).toBe(150);
    });

    it('should consume rested XP at the burn rate', () => {
      ctx.restedXp = 10;
      const result = applyXpGain(ctx, 100);
      // Burn rate is 1% per kill
      expect(result.restedConsumed).toBe(1);
      expect(ctx.restedXp).toBe(9);
    });

    it('should not consume more rested XP than available', () => {
      ctx.restedXp = 0.5;
      const result = applyXpGain(ctx, 100);
      // Burn rate is 1, but only 0.5 available
      expect(result.restedConsumed).toBe(0.5);
      expect(ctx.restedXp).toBe(0);
    });

    it('should not consume rested XP when none exists', () => {
      ctx.restedXp = 0;
      const result = applyXpGain(ctx, 100);
      expect(result.restedConsumed).toBe(0);
      expect(ctx.restedXp).toBe(0);
    });

    it('should apply ascension bonus', () => {
      ctx.ascensionCount = 5;
      const result = applyXpGain(ctx, 100);
      // ascension = 5 * 0.10 = 0.50
      // total = 1.0 * (1 + 0 + 0.50) = 1.50
      // floor(100 * 1.50) = 150
      expect(result.finalXp).toBe(150);
    });

    it('should combine all multipliers', () => {
      ctx.sessionStartTime = Date.now() - (45 * 60 * 1000); // 0.75
      ctx.restedXp = 100; // 1.0
      ctx.ascensionCount = 2; // 0.20
      const result = applyXpGain(ctx, 100);
      // total = 0.75 * (1 + 1.0 + 0.20) = 0.75 * 2.20 = 1.65
      // floor(100 * 1.65) = 165
      expect(result.finalXp).toBe(165);
    });

    it('should return 0 for zero base XP', () => {
      ctx.restedXp = 50;
      ctx.ascensionCount = 3;
      const result = applyXpGain(ctx, 0);
      expect(result.finalXp).toBe(0);
    });

    it('should floor the result', () => {
      ctx.restedXp = 10; // 10% -> 0.1
      // total = 1.0 * (1 + 0.1) = 1.1
      // 77 * 1.1 = 84.7 -> floor = 84
      const result = applyXpGain(ctx, 77);
      expect(result.finalXp).toBe(84);
    });

    it('should still consume rested XP even with zero base XP', () => {
      ctx.restedXp = 5;
      const result = applyXpGain(ctx, 0);
      // Rested is consumed regardless
      expect(result.restedConsumed).toBe(1);
      expect(ctx.restedXp).toBe(4);
    });
  });

  // ========================================================================
  // applyGoldMultiplier
  // ========================================================================

  describe('applyGoldMultiplier', () => {
    it('should return full gold at 100% efficiency', () => {
      const result = applyGoldMultiplier(ctx, 100);
      expect(result).toBe(100);
    });

    it('should apply efficiency reduction to gold', () => {
      ctx.sessionStartTime = Date.now() - (45 * 60 * 1000); // 0.75
      const result = applyGoldMultiplier(ctx, 100);
      // floor(100 * 0.75) = 75
      expect(result).toBe(75);
    });

    it('should not apply rested XP bonus to gold', () => {
      ctx.restedXp = 100;
      const result = applyGoldMultiplier(ctx, 100);
      // Gold only uses efficiency, not rested
      expect(result).toBe(100);
    });

    it('should not apply ascension bonus to gold', () => {
      ctx.ascensionCount = 5;
      const result = applyGoldMultiplier(ctx, 100);
      // Gold only uses efficiency
      expect(result).toBe(100);
    });

    it('should return 0 for zero base gold', () => {
      const result = applyGoldMultiplier(ctx, 0);
      expect(result).toBe(0);
    });

    it('should floor the result', () => {
      ctx.sessionStartTime = Date.now() - (45 * 60 * 1000); // 0.75
      // 77 * 0.75 = 57.75 -> floor = 57
      const result = applyGoldMultiplier(ctx, 77);
      expect(result).toBe(57);
    });

    it('should apply severe efficiency at 90+ minutes', () => {
      ctx.sessionStartTime = Date.now() - (120 * 60 * 1000); // 0.25
      const result = applyGoldMultiplier(ctx, 100);
      // floor(100 * 0.25) = 25
      expect(result).toBe(25);
    });
  });

  // ========================================================================
  // initProgression
  // ========================================================================

  describe('initProgression', () => {
    it('should set sessionStartTime to now', () => {
      const now = Date.now();
      ctx.lastLogoutTime = 0;
      initProgression(ctx);
      expect(ctx.sessionStartTime).toBe(now);
    });

    it('should calculate rested XP from logout time', () => {
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      ctx.lastLogoutTime = twoHoursAgo;
      ctx.restedXp = 0;

      initProgression(ctx);

      // 2 hours * 5% = 10%
      expect(ctx.restedXp).toBe(10);
    });

    it('should add to existing rested XP', () => {
      const oneHourAgo = Date.now() - (1 * 60 * 60 * 1000);
      ctx.lastLogoutTime = oneHourAgo;
      ctx.restedXp = 15;

      initProgression(ctx);

      // 1 hour * 5% = 5% + 15% existing = 20%
      expect(ctx.restedXp).toBe(20);
    });

    it('should cap rested XP at 100%', () => {
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
      ctx.lastLogoutTime = dayAgo;
      ctx.restedXp = 0;

      initProgression(ctx);

      expect(ctx.restedXp).toBe(100);
    });

    it('should not change rested XP when lastLogoutTime is 0', () => {
      ctx.lastLogoutTime = 0;
      ctx.restedXp = 25;

      initProgression(ctx);

      expect(ctx.restedXp).toBe(25);
    });

    it('should send progression init message', () => {
      initProgression(ctx);
      expect(ctx.send).toHaveBeenCalled();
    });

    it('should send correct progression data structure', () => {
      ctx.ascensionCount = 2;
      ctx.restedXp = 30;
      ctx.level = 10;

      initProgression(ctx);

      const call = vi.mocked(ctx.send).mock.calls[0][0];
      expect(call).toBeInstanceOf(Array);
      const data = call[1];
      expect(data.ascensionCount).toBe(2);
      expect(data.restedXp).toBe(30);
      expect(data.title).toBe('Transcendent');
    });
  });

  // ========================================================================
  // canAscend
  // ========================================================================

  describe('canAscend', () => {
    it('should return true at max level (50)', () => {
      expect(canAscend(50)).toBe(true);
    });

    it('should return true above max level', () => {
      expect(canAscend(55)).toBe(true);
    });

    it('should return false below max level', () => {
      expect(canAscend(49)).toBe(false);
    });

    it('should return false at level 1', () => {
      expect(canAscend(1)).toBe(false);
    });
  });

  // ========================================================================
  // performAscension
  // ========================================================================

  describe('performAscension', () => {
    it('should succeed at level 50', () => {
      ctx.level = 50;
      const result = performAscension(ctx);
      expect(result).toBe(true);
    });

    it('should fail below level 50', () => {
      ctx.level = 49;
      const result = performAscension(ctx);
      expect(result).toBe(false);
    });

    it('should increment ascension count', () => {
      ctx.level = 50;
      ctx.ascensionCount = 0;

      performAscension(ctx);

      expect(ctx.ascensionCount).toBe(1);
    });

    it('should reset level to 1', () => {
      ctx.level = 50;
      performAscension(ctx);
      expect(ctx.setLevel).toHaveBeenCalledWith(1);
    });

    it('should reset XP to 0', () => {
      ctx.level = 50;
      ctx.xp = 999;
      performAscension(ctx);
      expect(ctx.setXp).toHaveBeenCalledWith(0);
    });

    it('should send ascension notification', () => {
      ctx.level = 50;
      performAscension(ctx);
      expect(ctx.send).toHaveBeenCalled();
    });

    it('should include ascension count and title in notification', () => {
      ctx.level = 50;
      ctx.ascensionCount = 0;

      performAscension(ctx);

      const call = vi.mocked(ctx.send).mock.calls[0][0];
      expect(call).toContain(1); // new ascension count
      expect(call).toContain('Ascended'); // title for ascension 1
    });

    it('should not modify state on failure', () => {
      ctx.level = 10;
      ctx.ascensionCount = 0;
      const xpBefore = ctx.xp;

      performAscension(ctx);

      expect(ctx.ascensionCount).toBe(0);
      expect(ctx.setLevel).not.toHaveBeenCalled();
      expect(ctx.setXp).not.toHaveBeenCalled();
    });

    it('should support multiple ascensions', () => {
      ctx.level = 50;
      ctx.ascensionCount = 2;

      performAscension(ctx);

      expect(ctx.ascensionCount).toBe(3);
      const call = vi.mocked(ctx.send).mock.calls[0][0];
      expect(call).toContain('Exalted');
    });
  });

  // ========================================================================
  // handleAscendRequest
  // ========================================================================

  describe('handleAscendRequest', () => {
    it('should perform ascension at level 50 and send progression init', () => {
      ctx.level = 50;
      handleAscendRequest(ctx);

      expect(ctx.ascensionCount).toBe(1);
      // Should send ascension notification + progression init
      expect(ctx.send).toHaveBeenCalledTimes(2);
    });

    it('should not ascend below level 50', () => {
      ctx.level = 30;
      handleAscendRequest(ctx);

      expect(ctx.ascensionCount).toBe(0);
      expect(ctx.setLevel).not.toHaveBeenCalled();
    });

    it('should send updated progression state after ascension', () => {
      ctx.level = 50;
      ctx.ascensionCount = 0;

      handleAscendRequest(ctx);

      // Second send call is sendProgressionInit
      const calls = vi.mocked(ctx.send).mock.calls;
      expect(calls.length).toBe(2);
      const progressionData = calls[1][0][1];
      expect(progressionData.ascensionCount).toBe(1);
      expect(progressionData.title).toBe('Ascended');
    });

    it('should correctly reset level and XP during ascension', () => {
      ctx.level = 50;
      ctx.xp = 9999;

      handleAscendRequest(ctx);

      expect(ctx.setLevel).toHaveBeenCalledWith(1);
      expect(ctx.setXp).toHaveBeenCalledWith(0);
    });
  });

  // ========================================================================
  // Ascension bonus multipliers
  // ========================================================================

  describe('ascension bonus multipliers', () => {
    it('getAscensionDamageMultiplier should return 1.0 for zero ascensions', () => {
      expect(getAscensionDamageMultiplier(0)).toBe(1.0);
    });

    it('getAscensionDamageMultiplier should return 1.05 for 1 ascension', () => {
      expect(getAscensionDamageMultiplier(1)).toBeCloseTo(1.05);
    });

    it('getAscensionDamageMultiplier should return 1.25 for 5 ascensions', () => {
      expect(getAscensionDamageMultiplier(5)).toBeCloseTo(1.25);
    });

    it('getAscensionHpMultiplier should return 1.0 for zero ascensions', () => {
      expect(getAscensionHpMultiplier(0)).toBe(1.0);
    });

    it('getAscensionHpMultiplier should return 1.05 for 1 ascension', () => {
      expect(getAscensionHpMultiplier(1)).toBeCloseTo(1.05);
    });

    it('getAscensionHpMultiplier should return 1.25 for 5 ascensions', () => {
      expect(getAscensionHpMultiplier(5)).toBeCloseTo(1.25);
    });
  });

  // ========================================================================
  // sendProgressionInit
  // ========================================================================

  describe('sendProgressionInit', () => {
    it('should send data with canAscend=false for low level', () => {
      ctx.level = 10;
      sendProgressionInit(ctx);

      const call = vi.mocked(ctx.send).mock.calls[0][0];
      const data = call[1];
      expect(data.canAscend).toBe(false);
    });

    it('should send data with canAscend=true for level 50', () => {
      ctx.level = 50;
      sendProgressionInit(ctx);

      const call = vi.mocked(ctx.send).mock.calls[0][0];
      const data = call[1];
      expect(data.canAscend).toBe(true);
    });

    it('should include bonus percentages', () => {
      ctx.ascensionCount = 2;
      sendProgressionInit(ctx);

      const call = vi.mocked(ctx.send).mock.calls[0][0];
      const data = call[1];
      // 2 * 10% XP = 20%
      expect(data.bonuses.xp).toBe(20);
      // 2 * 5% damage = 10%
      expect(data.bonuses.damage).toBe(10);
      // 2 * 5% HP = 10%
      expect(data.bonuses.hp).toBe(10);
    });

    it('should include maxLevel', () => {
      sendProgressionInit(ctx);

      const call = vi.mocked(ctx.send).mock.calls[0][0];
      const data = call[1];
      expect(data.maxLevel).toBe(50);
    });
  });

  // ========================================================================
  // onPlayerLogout
  // ========================================================================

  describe('onPlayerLogout', () => {
    it('should return a timestamp', () => {
      const result = onPlayerLogout(ctx);
      expect(result).toBe(Date.now());
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe('edge cases', () => {
    it('should handle zero XP gain with rested XP', () => {
      ctx.restedXp = 50;
      const result = applyXpGain(ctx, 0);
      expect(result.finalXp).toBe(0);
      // Rested is still consumed
      expect(result.restedConsumed).toBe(1);
    });

    it('should handle max level player gaining XP', () => {
      ctx.level = 50;
      const result = applyXpGain(ctx, 100);
      // XP is still calculated, but whether it levels up is not this handler's job
      expect(result.finalXp).toBe(100);
    });

    it('should handle very small rested XP', () => {
      ctx.restedXp = 0.1;
      const result = applyXpGain(ctx, 100);
      // rested = 0.1/100 = 0.001
      // total = 1.0 * (1 + 0.001) = 1.001
      // floor(100 * 1.001) = 100
      expect(result.finalXp).toBe(100);
      expect(result.restedConsumed).toBe(0.1);
      expect(ctx.restedXp).toBe(0);
    });

    it('should handle very large base XP', () => {
      const result = applyXpGain(ctx, 999999);
      expect(result.finalXp).toBe(999999);
    });

    it('should handle very large gold amount', () => {
      const result = applyGoldMultiplier(ctx, 999999);
      expect(result).toBe(999999);
    });

    it('should handle multiple ascensions accumulated over time', () => {
      ctx.level = 50;

      // First ascension
      performAscension(ctx);
      expect(ctx.ascensionCount).toBe(1);

      // Simulate leveling back up
      ctx.level = 50;
      performAscension(ctx);
      expect(ctx.ascensionCount).toBe(2);

      ctx.level = 50;
      performAscension(ctx);
      expect(ctx.ascensionCount).toBe(3);
    });

    it('should correctly title high ascension counts', () => {
      // toRoman(10 - 4) = toRoman(6) = "VI"
      expect(getAscensionTitle(10)).toBe('Eternal VI');
    });

    it('should handle no rested XP on first login (lastLogoutTime = 0)', () => {
      ctx.lastLogoutTime = 0;
      ctx.restedXp = 0;

      initProgression(ctx);

      expect(ctx.restedXp).toBe(0);
    });

    it('should handle efficiency at the exact tier boundaries', () => {
      // Just under 30 min
      const just29 = Date.now() - (29.9 * 60 * 1000);
      expect(getSessionEfficiency(just29)).toBe(1.0);

      // Just over 30 min
      const just31 = Date.now() - (30.1 * 60 * 1000);
      expect(getSessionEfficiency(just31)).toBe(0.75);
    });

    it('should handle concurrent XP and gold calculations independently', () => {
      ctx.sessionStartTime = Date.now() - (45 * 60 * 1000); // 0.75
      ctx.restedXp = 50;
      ctx.ascensionCount = 1;

      const xpResult = applyXpGain(ctx, 100);
      const goldResult = applyGoldMultiplier(ctx, 100);

      // XP: 0.75 * (1 + 0.5 + 0.1) = 0.75 * 1.6 = 1.2 => floor(100 * 1.2) = 120
      expect(xpResult.finalXp).toBe(120);
      // Gold: only efficiency => floor(100 * 0.75) = 75
      expect(goldResult).toBe(75);
    });
  });
});
