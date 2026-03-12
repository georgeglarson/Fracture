/**
 * Tests for NewsService
 * Covers: world event recording, stat aggregation, newspaper generation,
 *         caching, quick stats, event clearing, recent events retrieval
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger before importing the service
vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

import { NewsService } from '../ai/news.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockClient() {
  return { call: vi.fn() } as any;
}

function addKillEvents(service: NewsService, playerName: string, count: number, mobType = 'Rat') {
  for (let i = 0; i < count; i++) {
    service.recordWorldEvent('kill', playerName, { mobType });
  }
}

function addDeathEvents(service: NewsService, playerName: string, count: number) {
  for (let i = 0; i < count; i++) {
    service.recordWorldEvent('death', playerName);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsService', () => {
  let service: NewsService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockClient = createMockClient();
    service = new NewsService(mockClient);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── recordWorldEvent ───────────────────────────────────────

  describe('recordWorldEvent', () => {
    it('should append an event to the list', () => {
      service.recordWorldEvent('kill', 'Alice', { mobType: 'Rat' });

      const events = service.getRecentEvents(10);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('kill');
      expect(events[0].playerName).toBe('Alice');
      expect(events[0].details).toEqual({ mobType: 'Rat' });
      expect(events[0].timestamp).toBeTypeOf('number');
    });

    it('should trim events to the last 100', () => {
      for (let i = 0; i < 110; i++) {
        service.recordWorldEvent('kill', `Player${i}`, { mobType: 'Rat' });
      }

      const events = service.getRecentEvents(200);
      expect(events).toHaveLength(100);
      // The first 10 events (Player0..Player9) should have been trimmed
      expect(events[0].playerName).toBe('Player10');
      expect(events[99].playerName).toBe('Player109');
    });

    it('should invalidate cached newspaper every 10 events', async () => {
      // Generate a cached newspaper first
      mockClient.call.mockResolvedValue('AI headline');
      addKillEvents(service, 'Alice', 5);
      await service.generateNewspaper();

      // Record events until count reaches a multiple of 10
      // Currently 5 events; need to reach 10
      for (let i = 0; i < 5; i++) {
        service.recordWorldEvent('kill', 'Bob', { mobType: 'Rat' });
      }

      // Advance time slightly (not 5 min) -- normally would return cached
      vi.advanceTimersByTime(1000);

      // The cache was invalidated at event #10, so this should call the API again
      mockClient.call.mockResolvedValue('Fresh headline');
      const result = await service.generateNewspaper();
      expect(mockClient.call).toHaveBeenCalledTimes(2);
      expect(result.headlines[0]).toBe('Fresh headline');
    });

    it('should not invalidate cache on non-multiples of 10', async () => {
      mockClient.call.mockResolvedValue('AI headline');
      addKillEvents(service, 'Alice', 3);
      const first = await service.generateNewspaper();

      // Add 4 more (total 7 -- not a multiple of 10)
      for (let i = 0; i < 4; i++) {
        service.recordWorldEvent('kill', 'Bob', { mobType: 'Rat' });
      }

      // Should still return cached since cache was not invalidated and < 5 min
      vi.advanceTimersByTime(1000);
      const second = await service.generateNewspaper();
      expect(second.generatedAt).toBe(first.generatedAt);
      expect(mockClient.call).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getWorldStats ──────────────────────────────────────────

  describe('getWorldStats', () => {
    it('should return zeroed stats when no events exist', () => {
      const stats = service.getWorldStats();

      expect(stats.totalKills).toBe(0);
      expect(stats.totalDeaths).toBe(0);
      expect(stats.topKiller).toBeNull();
      expect(stats.mostDied).toBeNull();
      expect(stats.recentJoins).toEqual([]);
      expect(stats.bossKills).toEqual([]);
      expect(stats.mobKillCounts).toEqual({});
    });

    it('should count kills correctly', () => {
      addKillEvents(service, 'Alice', 3);
      addKillEvents(service, 'Bob', 2);

      const stats = service.getWorldStats();
      expect(stats.totalKills).toBe(5);
    });

    it('should count deaths correctly', () => {
      addDeathEvents(service, 'Alice', 2);
      addDeathEvents(service, 'Bob', 4);

      const stats = service.getWorldStats();
      expect(stats.totalDeaths).toBe(6);
    });

    it('should track topKiller by name and count', () => {
      addKillEvents(service, 'Alice', 5);
      addKillEvents(service, 'Bob', 8);

      const stats = service.getWorldStats();
      expect(stats.topKiller).toEqual({ name: 'Bob', kills: 8 });
    });

    it('should track mostDied by name and count', () => {
      addDeathEvents(service, 'Alice', 2);
      addDeathEvents(service, 'Bob', 7);

      const stats = service.getWorldStats();
      expect(stats.mostDied).toEqual({ name: 'Bob', deaths: 7 });
    });

    it('should track recentJoins', () => {
      service.recordWorldEvent('join', 'Alice');
      service.recordWorldEvent('join', 'Bob');
      service.recordWorldEvent('join', 'Charlie');

      const stats = service.getWorldStats();
      expect(stats.recentJoins).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should track bossKills with player and boss', () => {
      service.recordWorldEvent('bossKill', 'Alice', { bossType: 'Dragon' });
      service.recordWorldEvent('bossKill', 'Bob', { bossType: 'Lich' });

      const stats = service.getWorldStats();
      expect(stats.bossKills).toEqual([
        { player: 'Alice', boss: 'Dragon' },
        { player: 'Bob', boss: 'Lich' },
      ]);
    });

    it('should track mobKillCounts per mob type', () => {
      addKillEvents(service, 'Alice', 3, 'Rat');
      addKillEvents(service, 'Bob', 2, 'Skeleton');
      addKillEvents(service, 'Alice', 1, 'Skeleton');

      const stats = service.getWorldStats();
      expect(stats.mobKillCounts).toEqual({ Rat: 3, Skeleton: 3 });
    });

    it('should handle multiple players correctly across all stat types', () => {
      addKillEvents(service, 'Alice', 4, 'Rat');
      addKillEvents(service, 'Bob', 6, 'Skeleton');
      addDeathEvents(service, 'Alice', 5);
      addDeathEvents(service, 'Bob', 1);
      service.recordWorldEvent('join', 'Alice');
      service.recordWorldEvent('join', 'Bob');
      service.recordWorldEvent('bossKill', 'Alice', { bossType: 'Dragon' });

      const stats = service.getWorldStats();
      expect(stats.totalKills).toBe(10);
      expect(stats.totalDeaths).toBe(6);
      expect(stats.topKiller).toEqual({ name: 'Bob', kills: 6 });
      expect(stats.mostDied).toEqual({ name: 'Alice', deaths: 5 });
      expect(stats.recentJoins).toEqual(['Alice', 'Bob']);
      expect(stats.bossKills).toHaveLength(1);
      expect(stats.mobKillCounts).toEqual({ Rat: 4, Skeleton: 6 });
    });
  });

  // ─── generateNewspaper ──────────────────────────────────────

  describe('generateNewspaper', () => {
    it('should return cached result if less than 5 minutes old', async () => {
      mockClient.call.mockResolvedValue('AI headline');
      addKillEvents(service, 'Alice', 3);

      const first = await service.generateNewspaper();
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes

      const second = await service.generateNewspaper();
      expect(second).toBe(first);
      expect(mockClient.call).toHaveBeenCalledTimes(1);
    });

    it('should generate fresh newspaper after cache expires', async () => {
      mockClient.call.mockResolvedValue('Old headline');
      addKillEvents(service, 'Alice', 3);
      await service.generateNewspaper();

      vi.advanceTimersByTime(5 * 60 * 1000 + 1); // Just past 5 minutes
      mockClient.call.mockResolvedValue('New headline');

      const result = await service.generateNewspaper();
      expect(result.headlines[0]).toBe('New headline');
      expect(mockClient.call).toHaveBeenCalledTimes(2);
    });

    it('should include AI headline when API succeeds', async () => {
      mockClient.call.mockResolvedValue('Rat Apocalypse! Heroes Decimate Rodent Population');
      addKillEvents(service, 'Alice', 3);

      const result = await service.generateNewspaper();
      expect(result.headlines[0]).toBe('Rat Apocalypse! Heroes Decimate Rodent Population');
    });

    it('should handle API error gracefully with no AI headline', async () => {
      mockClient.call.mockRejectedValue(new Error('API timeout'));
      addKillEvents(service, 'Alice', 3);

      const result = await service.generateNewspaper();
      // Should still have stat-based headlines, just no AI one
      expect(result.headlines.length).toBeGreaterThan(0);
      expect(result.headlines[0]).not.toBe('Rat Apocalypse!');
    });

    it('should add topKiller headline when present', async () => {
      mockClient.call.mockResolvedValue(null); // No AI headline
      addKillEvents(service, 'Alice', 5);

      const result = await service.generateNewspaper();
      const topKillerHeadline = result.headlines.find(h => h.includes('Alice') && h.includes('5 slain'));
      expect(topKillerHeadline).toBeDefined();
    });

    it('should add mostDied headline when deaths >= 3', async () => {
      mockClient.call.mockResolvedValue(null);
      addDeathEvents(service, 'Bob', 4);

      const result = await service.generateNewspaper();
      const diedHeadline = result.headlines.find(h => h.includes('Bob') && h.includes('4 times'));
      expect(diedHeadline).toBeDefined();
    });

    it('should NOT add mostDied headline when deaths < 3', async () => {
      mockClient.call.mockResolvedValue(null);
      addDeathEvents(service, 'Bob', 2);

      const result = await service.generateNewspaper();
      const diedHeadline = result.headlines.find(h => h.includes('Bob') && h.includes('died'));
      expect(diedHeadline).toBeUndefined();
    });

    it('should add bossKill headline', async () => {
      mockClient.call.mockResolvedValue(null);
      service.recordWorldEvent('bossKill', 'Alice', { bossType: 'Dragon' });

      const result = await service.generateNewspaper();
      const bossHeadline = result.headlines.find(h => h.includes('Alice') && h.includes('Dragon'));
      expect(bossHeadline).toBeDefined();
    });

    it('should add totalKills headline', async () => {
      mockClient.call.mockResolvedValue(null);
      addKillEvents(service, 'Alice', 7);

      const result = await service.generateNewspaper();
      const killsHeadline = result.headlines.find(h => h.includes('Total monsters slain') && h.includes('7'));
      expect(killsHeadline).toBeDefined();
    });

    it('should add most hunted mob headline', async () => {
      mockClient.call.mockResolvedValue(null);
      addKillEvents(service, 'Alice', 5, 'Rat');
      addKillEvents(service, 'Bob', 2, 'Skeleton');

      const result = await service.generateNewspaper();
      const mobHeadline = result.headlines.find(h => h.includes('Rat') && h.includes('5 killed'));
      expect(mobHeadline).toBeDefined();
    });

    it('should add recent visitors headline', async () => {
      mockClient.call.mockResolvedValue(null);
      service.recordWorldEvent('join', 'Alice');
      service.recordWorldEvent('join', 'Bob');

      const result = await service.generateNewspaper();
      const joinHeadline = result.headlines.find(h => h.includes('Recent visitors'));
      expect(joinHeadline).toBeDefined();
      expect(joinHeadline).toContain('Alice');
      expect(joinHeadline).toContain('Bob');
    });

    it('should show "realm is quiet" fallback when no events', async () => {
      mockClient.call.mockResolvedValue(null);

      const result = await service.generateNewspaper();
      expect(result.headlines[0]).toContain('The realm is quiet');
    });

    it('should cap at 6 headlines', async () => {
      mockClient.call.mockResolvedValue('AI headline');
      addKillEvents(service, 'Alice', 5, 'Rat');
      addKillEvents(service, 'Bob', 3, 'Skeleton');
      addDeathEvents(service, 'Charlie', 4);
      service.recordWorldEvent('bossKill', 'Alice', { bossType: 'Dragon' });
      service.recordWorldEvent('join', 'Dave');
      service.recordWorldEvent('join', 'Eve');

      const result = await service.generateNewspaper();
      expect(result.headlines.length).toBeLessThanOrEqual(6);
    });
  });

  // ─── getQuickStats ──────────────────────────────────────────

  describe('getQuickStats', () => {
    it('should return correct totalKills, totalDeaths, activeEvents', () => {
      addKillEvents(service, 'Alice', 4);
      addDeathEvents(service, 'Bob', 2);
      service.recordWorldEvent('join', 'Charlie');

      const quick = service.getQuickStats();
      expect(quick.totalKills).toBe(4);
      expect(quick.totalDeaths).toBe(2);
      expect(quick.activeEvents).toBe(7); // 4 kills + 2 deaths + 1 join
    });
  });

  // ─── clearEvents ────────────────────────────────────────────

  describe('clearEvents', () => {
    it('should reset events and cache', async () => {
      mockClient.call.mockResolvedValue('AI headline');
      addKillEvents(service, 'Alice', 5);
      await service.generateNewspaper();

      service.clearEvents();

      const events = service.getRecentEvents(100);
      expect(events).toHaveLength(0);

      const stats = service.getWorldStats();
      expect(stats.totalKills).toBe(0);

      // After clearing, generating should produce fresh call (cache was cleared)
      mockClient.call.mockResolvedValue(null);
      const result = await service.generateNewspaper();
      expect(result.headlines[0]).toContain('The realm is quiet');
      expect(mockClient.call).toHaveBeenCalledTimes(2);
    });
  });

  // ─── getRecentEvents ───────────────────────────────────────

  describe('getRecentEvents', () => {
    it('should return last N events', () => {
      for (let i = 0; i < 20; i++) {
        service.recordWorldEvent('kill', `Player${i}`, { mobType: 'Rat' });
      }

      const recent = service.getRecentEvents(5);
      expect(recent).toHaveLength(5);
      expect(recent[0].playerName).toBe('Player15');
      expect(recent[4].playerName).toBe('Player19');
    });

    it('should default to 10 events', () => {
      for (let i = 0; i < 20; i++) {
        service.recordWorldEvent('kill', `Player${i}`, { mobType: 'Rat' });
      }

      const recent = service.getRecentEvents();
      expect(recent).toHaveLength(10);
      expect(recent[0].playerName).toBe('Player10');
    });

    it('should return all events if fewer than N exist', () => {
      service.recordWorldEvent('kill', 'Alice', { mobType: 'Rat' });
      service.recordWorldEvent('kill', 'Bob', { mobType: 'Rat' });

      const recent = service.getRecentEvents(10);
      expect(recent).toHaveLength(2);
    });
  });
});
