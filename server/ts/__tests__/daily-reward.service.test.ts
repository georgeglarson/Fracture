/**
 * Tests for DailyRewardService
 * Covers: singleton, streak tracking, reward scaling, date boundary handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DailyRewardService,
  getDailyRewardService,
  type DailyRewardResult,
} from '../player/daily-reward.service';

describe('DailyRewardService', () => {
  let service: DailyRewardService;

  // Fixed reference date: 2026-03-11T12:00:00Z (a Wednesday)
  const FIXED_NOW = new Date('2026-03-11T12:00:00.000Z');
  const TODAY = '2026-03-11';
  const YESTERDAY = '2026-03-10';
  const TWO_DAYS_AGO = '2026-03-09';
  const WEEK_AGO = '2026-03-04';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    service = new DailyRewardService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Reward tables for reference ──────────────────────────────
  // Day:  1   2   3   4   5   6   7
  // Gold: 10  15  20  25  35  50  100
  // XP:   25  35  50  65  85  100 200

  describe('getDailyRewardService (singleton)', () => {
    it('should return the same instance on repeated calls', () => {
      // getDailyRewardService uses module-level state, so we need a fresh
      // import context. For a basic check, just verify it returns a service.
      const a = getDailyRewardService();
      const b = getDailyRewardService();

      expect(a).toBe(b);
      expect(a).toBeInstanceOf(DailyRewardService);
    });
  });

  describe('checkDailyReward', () => {
    // ── First login (null lastLogin) ─────────────────────────
    describe('first login (null lastLoginDate)', () => {
      it('should grant day-1 rewards', () => {
        const result = service.checkDailyReward(null, 0);

        expect(result.gold).toBe(10);
        expect(result.xp).toBe(25);
        expect(result.streak).toBe(1);
        expect(result.isNewDay).toBe(true);
      });

      it('should ignore whatever currentStreak is passed in', () => {
        const result = service.checkDailyReward(null, 5);

        expect(result.streak).toBe(1);
        expect(result.gold).toBe(10);
        expect(result.xp).toBe(25);
      });
    });

    // ── Same day (already claimed) ───────────────────────────
    describe('same day (already claimed)', () => {
      it('should return zero rewards when lastLoginDate is today', () => {
        const result = service.checkDailyReward(TODAY, 3);

        expect(result.gold).toBe(0);
        expect(result.xp).toBe(0);
        expect(result.streak).toBe(3);
        expect(result.isNewDay).toBe(false);
      });

      it('should preserve the existing streak count', () => {
        const result = service.checkDailyReward(TODAY, 7);

        expect(result.streak).toBe(7);
        expect(result.isNewDay).toBe(false);
      });
    });

    // ── Streak continuation (consecutive day) ────────────────
    describe('streak continuation (logged in yesterday)', () => {
      it('should increment streak from 1 to 2', () => {
        const result = service.checkDailyReward(YESTERDAY, 1);

        expect(result.streak).toBe(2);
        expect(result.gold).toBe(15);
        expect(result.xp).toBe(35);
        expect(result.isNewDay).toBe(true);
      });

      it('should increment streak from 3 to 4', () => {
        const result = service.checkDailyReward(YESTERDAY, 3);

        expect(result.streak).toBe(4);
        expect(result.gold).toBe(25);
        expect(result.xp).toBe(65);
        expect(result.isNewDay).toBe(true);
      });

      it('should increment streak from 6 to 7 (max tier)', () => {
        const result = service.checkDailyReward(YESTERDAY, 6);

        expect(result.streak).toBe(7);
        expect(result.gold).toBe(100);
        expect(result.xp).toBe(200);
        expect(result.isNewDay).toBe(true);
      });

      it('should wrap streak from 7 back to 1', () => {
        const result = service.checkDailyReward(YESTERDAY, 7);

        expect(result.streak).toBe(1);
        expect(result.gold).toBe(10);
        expect(result.xp).toBe(25);
        expect(result.isNewDay).toBe(true);
      });
    });

    // ── Streak reset (missed a day) ──────────────────────────
    describe('streak reset (missed one or more days)', () => {
      it('should reset to day 1 when last login was two days ago', () => {
        const result = service.checkDailyReward(TWO_DAYS_AGO, 5);

        expect(result.streak).toBe(1);
        expect(result.gold).toBe(10);
        expect(result.xp).toBe(25);
        expect(result.isNewDay).toBe(true);
      });

      it('should reset to day 1 when last login was a week ago', () => {
        const result = service.checkDailyReward(WEEK_AGO, 7);

        expect(result.streak).toBe(1);
        expect(result.gold).toBe(10);
        expect(result.xp).toBe(25);
        expect(result.isNewDay).toBe(true);
      });

      it('should reset to day 1 even for very old dates', () => {
        const result = service.checkDailyReward('2020-01-01', 4);

        expect(result.streak).toBe(1);
        expect(result.isNewDay).toBe(true);
      });
    });

    // ── Gold and XP scaling across all 7 streak days ─────────
    describe('reward scaling with streak', () => {
      const expectedRewards = [
        { day: 1, gold: 10, xp: 25 },
        { day: 2, gold: 15, xp: 35 },
        { day: 3, gold: 20, xp: 50 },
        { day: 4, gold: 25, xp: 65 },
        { day: 5, gold: 35, xp: 85 },
        { day: 6, gold: 50, xp: 100 },
        { day: 7, gold: 100, xp: 200 },
      ];

      expectedRewards.forEach(({ day, gold, xp }) => {
        it(`should award ${gold} gold and ${xp} xp on streak day ${day}`, () => {
          // Simulate consecutive login: currentStreak is day-1, last login was yesterday
          const currentStreak = day - 1;
          // For day 1 via continuation: streak wraps from 7, but we can also
          // trigger day 1 via a missed-day reset to keep things simple.
          let result: DailyRewardResult;
          if (day === 1) {
            // Use a missed-day scenario to land on streak 1
            result = service.checkDailyReward(TWO_DAYS_AGO, 3);
          } else {
            result = service.checkDailyReward(YESTERDAY, currentStreak);
          }

          expect(result.gold).toBe(gold);
          expect(result.xp).toBe(xp);
          expect(result.streak).toBe(day);
        });
      });
    });
  });

  // ── Date boundary handling ─────────────────────────────────
  describe('date boundary handling', () => {
    it('should treat 23:59:59 UTC and 00:00:01 UTC on next day as different days', () => {
      // Set clock to just before midnight
      vi.setSystemTime(new Date('2026-03-11T23:59:59.000Z'));
      const resultBefore = service.checkDailyReward('2026-03-11', 2);

      // Same day - should not grant reward
      expect(resultBefore.isNewDay).toBe(false);
      expect(resultBefore.gold).toBe(0);

      // Advance past midnight
      vi.setSystemTime(new Date('2026-03-12T00:00:01.000Z'));
      const resultAfter = service.checkDailyReward('2026-03-11', 2);

      // Now it is a new day and yesterday was 2026-03-11 -> streak continues
      expect(resultAfter.isNewDay).toBe(true);
      expect(resultAfter.streak).toBe(3);
      expect(resultAfter.gold).toBe(20);
    });

    it('should handle month boundary (last day of month to first day of next)', () => {
      // Set clock to April 1st
      vi.setSystemTime(new Date('2026-04-01T10:00:00.000Z'));
      const result = service.checkDailyReward('2026-03-31', 4);

      // March 31 -> April 1 is consecutive
      expect(result.isNewDay).toBe(true);
      expect(result.streak).toBe(5);
    });

    it('should handle year boundary (Dec 31 to Jan 1)', () => {
      vi.setSystemTime(new Date('2027-01-01T10:00:00.000Z'));
      const result = service.checkDailyReward('2026-12-31', 6);

      expect(result.isNewDay).toBe(true);
      expect(result.streak).toBe(7);
      expect(result.gold).toBe(100);
      expect(result.xp).toBe(200);
    });

    it('should handle leap year Feb 28 -> Feb 29', () => {
      // 2028 is a leap year
      vi.setSystemTime(new Date('2028-02-29T10:00:00.000Z'));
      const result = service.checkDailyReward('2028-02-28', 2);

      expect(result.isNewDay).toBe(true);
      expect(result.streak).toBe(3);
    });

    it('should handle leap year Feb 29 -> Mar 1', () => {
      vi.setSystemTime(new Date('2028-03-01T10:00:00.000Z'));
      const result = service.checkDailyReward('2028-02-29', 3);

      expect(result.isNewDay).toBe(true);
      expect(result.streak).toBe(4);
    });

    it('should reset streak when gap spans a month boundary', () => {
      // March 29 -> April 1 is a 3-day gap (missed March 30 and 31)
      vi.setSystemTime(new Date('2026-04-01T10:00:00.000Z'));
      const result = service.checkDailyReward('2026-03-29', 5);

      expect(result.isNewDay).toBe(true);
      expect(result.streak).toBe(1);
    });
  });

  // ── getRewardForDay ────────────────────────────────────────
  describe('getRewardForDay', () => {
    it('should return correct rewards for each day 1-7', () => {
      const expected = [
        { day: 1, gold: 10, xp: 25 },
        { day: 2, gold: 15, xp: 35 },
        { day: 3, gold: 20, xp: 50 },
        { day: 4, gold: 25, xp: 65 },
        { day: 5, gold: 35, xp: 85 },
        { day: 6, gold: 50, xp: 100 },
        { day: 7, gold: 100, xp: 200 },
      ];

      for (const { day, gold, xp } of expected) {
        const result = service.getRewardForDay(day);
        expect(result.gold).toBe(gold);
        expect(result.xp).toBe(xp);
      }
    });

    it('should clamp day below 1 to day 1 rewards', () => {
      const result = service.getRewardForDay(0);
      expect(result.gold).toBe(10);
      expect(result.xp).toBe(25);
    });

    it('should clamp day above 7 to day 7 rewards', () => {
      const result = service.getRewardForDay(99);
      expect(result.gold).toBe(100);
      expect(result.xp).toBe(200);
    });

    it('should clamp negative day to day 1 rewards', () => {
      const result = service.getRewardForDay(-5);
      expect(result.gold).toBe(10);
      expect(result.xp).toBe(25);
    });
  });

  // ── getAllRewardTiers ───────────────────────────────────────
  describe('getAllRewardTiers', () => {
    it('should return exactly 7 tiers', () => {
      const tiers = service.getAllRewardTiers();
      expect(tiers).toHaveLength(7);
    });

    it('should have days numbered 1 through 7', () => {
      const tiers = service.getAllRewardTiers();
      const days = tiers.map((t) => t.day);
      expect(days).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should have increasing gold values', () => {
      const tiers = service.getAllRewardTiers();
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].gold).toBeGreaterThan(tiers[i - 1].gold);
      }
    });

    it('should have increasing xp values', () => {
      const tiers = service.getAllRewardTiers();
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].xp).toBeGreaterThan(tiers[i - 1].xp);
      }
    });

    it('should match the exact reward tables', () => {
      const tiers = service.getAllRewardTiers();
      expect(tiers).toEqual([
        { day: 1, gold: 10, xp: 25 },
        { day: 2, gold: 15, xp: 35 },
        { day: 3, gold: 20, xp: 50 },
        { day: 4, gold: 25, xp: 65 },
        { day: 5, gold: 35, xp: 85 },
        { day: 6, gold: 50, xp: 100 },
        { day: 7, gold: 100, xp: 200 },
      ]);
    });
  });
});
