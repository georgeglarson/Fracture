/**
 * Tests for KillStreakService
 * Covers: streak tracking, tier progression, multipliers, expiration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the event bus before importing the service
vi.mock('../../../shared/ts/events/index.js', () => ({
  getServerEventBus: () => ({
    on: vi.fn(),
    emit: vi.fn(),
  }),
}));

// Import after mocking
import { KillStreakService } from '../combat/kill-streak.service';

describe('KillStreakService', () => {
  let service: KillStreakService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new KillStreakService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('recordKill', () => {
    it('should start a streak at 1 on first kill', () => {
      const result = service.recordKill(1, 'TestPlayer');

      expect(result.streak).toBe(1);
      expect(result.xpMultiplier).toBe(1.0);
      expect(result.goldMultiplier).toBe(1.0);
      expect(result.tier).toBeNull();
      expect(result.isNewTier).toBe(false);
    });

    it('should increment streak on consecutive kills', () => {
      service.recordKill(1, 'TestPlayer');
      service.recordKill(1, 'TestPlayer');
      const result = service.recordKill(1, 'TestPlayer');

      expect(result.streak).toBe(3);
    });

    it('should reach Killing Spree tier at 3 kills', () => {
      service.recordKill(1, 'TestPlayer');
      service.recordKill(1, 'TestPlayer');
      const result = service.recordKill(1, 'TestPlayer');

      expect(result.streak).toBe(3);
      expect(result.tier?.title).toBe('Killing Spree');
      expect(result.xpMultiplier).toBe(1.1);
      expect(result.goldMultiplier).toBe(1.1);
      expect(result.isNewTier).toBe(true);
    });

    it('should reach Rampage tier at 5 kills', () => {
      for (let i = 0; i < 4; i++) {
        service.recordKill(1, 'TestPlayer');
      }
      const result = service.recordKill(1, 'TestPlayer');

      expect(result.streak).toBe(5);
      expect(result.tier?.title).toBe('Rampage');
      expect(result.xpMultiplier).toBe(1.25);
      expect(result.isNewTier).toBe(true);
    });

    it('should reach Dominating tier at 7 kills', () => {
      for (let i = 0; i < 6; i++) {
        service.recordKill(1, 'TestPlayer');
      }
      const result = service.recordKill(1, 'TestPlayer');

      expect(result.streak).toBe(7);
      expect(result.tier?.title).toBe('Dominating');
      expect(result.xpMultiplier).toBe(1.4);
    });

    it('should reach Unstoppable tier at 10 kills', () => {
      for (let i = 0; i < 9; i++) {
        service.recordKill(1, 'TestPlayer');
      }
      const result = service.recordKill(1, 'TestPlayer');

      expect(result.streak).toBe(10);
      expect(result.tier?.title).toBe('Unstoppable');
      expect(result.xpMultiplier).toBe(1.6);
    });

    it('should reach Godlike tier at 15 kills', () => {
      for (let i = 0; i < 14; i++) {
        service.recordKill(1, 'TestPlayer');
      }
      const result = service.recordKill(1, 'TestPlayer');

      expect(result.streak).toBe(15);
      expect(result.tier?.title).toBe('Godlike');
      expect(result.xpMultiplier).toBe(1.8);
    });

    it('should reach Legendary tier at 20 kills', () => {
      for (let i = 0; i < 19; i++) {
        service.recordKill(1, 'TestPlayer');
      }
      const result = service.recordKill(1, 'TestPlayer');

      expect(result.streak).toBe(20);
      expect(result.tier?.title).toBe('Legendary');
      expect(result.xpMultiplier).toBe(2.0);
      expect(result.goldMultiplier).toBe(2.0);
    });

    it('should not flag isNewTier when staying in same tier', () => {
      // Get to Killing Spree
      for (let i = 0; i < 3; i++) {
        service.recordKill(1, 'TestPlayer');
      }

      // Next kill should still be Killing Spree, not a new tier
      const result = service.recordKill(1, 'TestPlayer');

      expect(result.streak).toBe(4);
      expect(result.tier?.title).toBe('Killing Spree');
      expect(result.isNewTier).toBe(false);
    });

    it('should track separate streaks for different players', () => {
      service.recordKill(1, 'Player1');
      service.recordKill(1, 'Player1');
      service.recordKill(2, 'Player2');

      const result1 = service.recordKill(1, 'Player1');
      const result2 = service.recordKill(2, 'Player2');

      expect(result1.streak).toBe(3);
      expect(result2.streak).toBe(2);
    });
  });

  describe('streak expiration', () => {
    it('should reset streak after 5 minutes of inactivity', () => {
      // Build a streak
      service.recordKill(1, 'TestPlayer');
      service.recordKill(1, 'TestPlayer');
      service.recordKill(1, 'TestPlayer');

      expect(service.getStreak(1)).toBe(3);

      // Advance time past 5 minute timeout
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Streak should be expired
      expect(service.getStreak(1)).toBe(0);

      // New kill should start fresh
      const result = service.recordKill(1, 'TestPlayer');
      expect(result.streak).toBe(1);
    });

    it('should maintain streak within 5 minute window', () => {
      service.recordKill(1, 'TestPlayer');
      service.recordKill(1, 'TestPlayer');

      // Advance time but stay within timeout
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Streak should still be active
      expect(service.getStreak(1)).toBe(2);

      // Next kill should continue streak
      const result = service.recordKill(1, 'TestPlayer');
      expect(result.streak).toBe(3);
    });
  });

  describe('endStreak', () => {
    it('should clear streak on death', () => {
      // Build a streak
      service.recordKill(1, 'TestPlayer');
      service.recordKill(1, 'TestPlayer');
      service.recordKill(1, 'TestPlayer');

      expect(service.getStreak(1)).toBe(3);

      // End streak
      const endedStreak = service.endStreak(1, 2);

      expect(endedStreak?.count).toBe(3);
      expect(service.getStreak(1)).toBe(0);
    });

    it('should return null if no streak exists', () => {
      const result = service.endStreak(999);
      expect(result).toBeNull();
    });
  });

  describe('getStreakInfo', () => {
    it('should return correct streak info', () => {
      // Build a Rampage streak
      for (let i = 0; i < 5; i++) {
        service.recordKill(1, 'TestPlayer');
      }

      const info = service.getStreakInfo(1);

      expect(info.count).toBe(5);
      expect(info.tier?.title).toBe('Rampage');
      expect(info.timeRemaining).toBeGreaterThan(0);
      expect(info.timeRemaining).toBeLessThanOrEqual(5 * 60 * 1000);
    });

    it('should return empty info for non-existent player', () => {
      const info = service.getStreakInfo(999);

      expect(info.count).toBe(0);
      expect(info.tier).toBeNull();
      expect(info.timeRemaining).toBe(0);
    });
  });

  describe('getTopStreaks', () => {
    it('should return top active streaks sorted by count', () => {
      // Create multiple players with different streaks
      for (let i = 0; i < 10; i++) service.recordKill(1, 'Player1');
      for (let i = 0; i < 5; i++) service.recordKill(2, 'Player2');
      for (let i = 0; i < 7; i++) service.recordKill(3, 'Player3');
      for (let i = 0; i < 2; i++) service.recordKill(4, 'Player4'); // Below threshold

      const top = service.getTopStreaks(5);

      expect(top.length).toBe(3); // Player4 excluded (below 3)
      expect(top[0].playerId).toBe(1);
      expect(top[0].count).toBe(10);
      expect(top[1].playerId).toBe(3);
      expect(top[1].count).toBe(7);
      expect(top[2].playerId).toBe(2);
      expect(top[2].count).toBe(5);
    });

    it('should exclude expired streaks', () => {
      for (let i = 0; i < 5; i++) service.recordKill(1, 'Player1');

      // Expire the streak
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      const top = service.getTopStreaks(5);
      expect(top.length).toBe(0);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 5; i++) service.recordKill(1, 'Player1');
      for (let i = 0; i < 5; i++) service.recordKill(2, 'Player2');
      for (let i = 0; i < 5; i++) service.recordKill(3, 'Player3');

      const top = service.getTopStreaks(2);
      expect(top.length).toBe(2);
    });
  });
});
