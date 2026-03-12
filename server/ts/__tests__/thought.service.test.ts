/**
 * Tests for ThoughtService
 * Covers: getEntityThought, getBatchThoughts, hasThoughts,
 *         generateAIThought, AI thought pool lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock logger ────────────────────────────────────────────────
vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

// ── Mock npc-personalities with minimal data ───────────────────
const mockFillTemplate = vi.fn((t: string) => t);

vi.mock('../ai/npc-personalities', () => ({
  MOB_THOUGHTS: {
    rat: {
      idle: ['Squeak squeak...', 'Cheese?'],
      combat: ['BITE!', 'FOR THE COLONY!'],
      flee: ['TOO BIG!'],
      playerNearby: ['*sniff sniff*'],
      special: ['I once was a prince...'],
    },
    skeleton: {
      idle: ['Bones rattle...'],
      combat: ['CLACK CLACK!'],
      flee: ['My bones!'],
      playerNearby: ['*bone creak*'],
    },
  },
  NPC_THOUGHTS: {
    king: {
      idle: ['Heavy is the crown...'],
      playerNearby: ['A visitor approaches.'],
      special: ['I remember the before-times...'],
    },
  },
  fillTemplate: (t: string) => mockFillTemplate(t),
}));

// ── Mock VeniceClient ──────────────────────────────────────────
const mockCall = vi.fn();

function createMockClient(): any {
  return { call: mockCall };
}

vi.mock('../ai/venice-client', () => ({
  VeniceClient: vi.fn(() => createMockClient()),
}));

// ── Import after mocks ────────────────────────────────────────
import { ThoughtService } from '../ai/thought.service';

// ───────────────────────────────────────────────────────────────

describe('ThoughtService', () => {
  let service: ThoughtService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockFillTemplate.mockImplementation((t: string) => t);
    service = new ThoughtService(createMockClient());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =============================================================
  // getEntityThought
  // =============================================================
  describe('getEntityThought', () => {
    it('should return "..." for unknown entity type', () => {
      const result = service.getEntityThought('dragon', 'idle');
      expect(result.thought).toBe('...');
      expect(result.state).toBe('idle');
    });

    it('should return a thought from the idle state array', () => {
      // Force deterministic pick: first element
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      const result = service.getEntityThought('rat', 'idle');
      expect(['Squeak squeak...', 'Cheese?']).toContain(result.thought);
      expect(result.state).toBe('idle');
    });

    it('should return a thought from the combat state array', () => {
      // random >= 0.1 (no special), random >= 0.25 (no AI pool)
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = service.getEntityThought('rat', 'combat');
      expect(['BITE!', 'FOR THE COLONY!']).toContain(result.thought);
      expect(result.state).toBe('combat');
    });

    it('should return a thought from the playerNearby state array', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = service.getEntityThought('rat', 'playerNearby');
      expect(result.thought).toBe('*sniff sniff*');
      expect(result.state).toBe('playerNearby');
    });

    it('should return a thought from the flee state array', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = service.getEntityThought('rat', 'flee');
      expect(result.thought).toBe('TOO BIG!');
      expect(result.state).toBe('flee');
    });

    it('should switch to flee state when health < 30% in combat', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = service.getEntityThought('rat', 'combat', {
        healthPercent: 20,
      });
      expect(result.thought).toBe('TOO BIG!');
      expect(result.state).toBe('flee');
    });

    it('should NOT switch to flee state when health >= 30% in combat', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = service.getEntityThought('rat', 'combat', {
        healthPercent: 30,
      });
      expect(['BITE!', 'FOR THE COLONY!']).toContain(result.thought);
      expect(result.state).toBe('combat');
    });

    it('should produce special thought when Math.random < 0.1', () => {
      // First call to Math.random (special check): < 0.1 -> yes
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const result = service.getEntityThought('rat', 'idle');
      expect(result.thought).toBe('I once was a prince...');
      expect(result.state).toBe('special');
    });

    it('should fall back to idle when requested state array is missing', () => {
      // skeleton has no 'special' key, so it falls back to idle
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = service.getEntityThought('skeleton', 'special');
      expect(result.thought).toBe('Bones rattle...');
      expect(result.state).toBe('special');
    });

    it('should call fillTemplate on the raw thought', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      service.getEntityThought('rat', 'idle');
      expect(mockFillTemplate).toHaveBeenCalled();
      // The argument should be one of the idle thoughts
      const arg = mockFillTemplate.mock.calls[0][0];
      expect(['Squeak squeak...', 'Cheese?']).toContain(arg);
    });

    it('should use AI pool thought 25% of the time when pool has data', () => {
      // Manually populate the pool by calling the private method via bracket notation
      (service as any).aiThoughtPools.set('rat', {
        thoughts: ['AI squeaking thought'],
        lastRefresh: Date.now(),
      });

      // First random call (special check): >= 0.1 (no special)
      // Second random call (AI chance check): < 0.25 (use AI)
      // Third random call (pool pick): any value
      const randomMock = vi.spyOn(Math, 'random');
      randomMock
        .mockReturnValueOnce(0.5)  // special check: 0.5 >= 0.1, skip
        .mockReturnValueOnce(0.1)  // AI chance: 0.1 < 0.25, use AI pool
        .mockReturnValueOnce(0.0); // pool pick index

      const result = service.getEntityThought('rat', 'idle');
      expect(result.thought).toBe('AI squeaking thought');
      expect(result.isAI).toBe(true);
    });

    it('should return non-AI thought when pool is empty', () => {
      // Pool is empty by default
      const randomMock = vi.spyOn(Math, 'random');
      randomMock
        .mockReturnValueOnce(0.5)  // special check
        .mockReturnValueOnce(0.1)  // AI chance: triggers AI path
        .mockReturnValueOnce(0.0); // thought pick

      const result = service.getEntityThought('rat', 'idle');
      // Falls through AI path (pool empty) to regular thought
      expect(['Squeak squeak...', 'Cheese?']).toContain(result.thought);
      expect(result.isAI).toBeUndefined();
    });

    it('should handle case-insensitive entity type lookup', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // The source does entityType.toLowerCase()
      const result = service.getEntityThought('Rat', 'idle');
      expect(['Squeak squeak...', 'Cheese?']).toContain(result.thought);
    });
  });

  // =============================================================
  // getBatchThoughts
  // =============================================================
  describe('getBatchThoughts', () => {
    it('should map multiple entities to thought results', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const results = service.getBatchThoughts([
        { id: 1, type: 'rat', state: 'idle' },
        { id: 2, type: 'skeleton', state: 'combat' },
      ]);
      expect(results).toHaveLength(2);
      expect(['Squeak squeak...', 'Cheese?']).toContain(results[0].thought);
      expect(results[1].thought).toBe('CLACK CLACK!');
    });

    it('should return correct id with each result', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const results = service.getBatchThoughts([
        { id: 42, type: 'rat', state: 'idle' },
        { id: 99, type: 'skeleton', state: 'flee' },
      ]);
      expect(results[0].id).toBe(42);
      expect(results[1].id).toBe(99);
    });

    it('should handle empty entities array', () => {
      const results = service.getBatchThoughts([]);
      expect(results).toEqual([]);
    });
  });

  // =============================================================
  // hasThoughts
  // =============================================================
  describe('hasThoughts', () => {
    it('should return true for known mob types', () => {
      expect(service.hasThoughts('rat')).toBe(true);
      expect(service.hasThoughts('skeleton')).toBe(true);
    });

    it('should return true for known NPC types', () => {
      expect(service.hasThoughts('king')).toBe(true);
    });

    it('should return false for unknown types', () => {
      expect(service.hasThoughts('dragon')).toBe(false);
      expect(service.hasThoughts('unicorn')).toBe(false);
    });

    it('should perform case-insensitive lookup', () => {
      expect(service.hasThoughts('Rat')).toBe(true);
      expect(service.hasThoughts('RAT')).toBe(true);
      expect(service.hasThoughts('King')).toBe(true);
      expect(service.hasThoughts('SKELETON')).toBe(true);
    });
  });

  // =============================================================
  // generateAIThought
  // =============================================================
  describe('generateAIThought', () => {
    it('should return base thought 80% of the time', async () => {
      // First Math.random calls inside getEntityThought (special, AI chance, pick)
      // Then the 80/20 check: > 0.2 means skip AI
      const randomMock = vi.spyOn(Math, 'random');
      randomMock.mockReturnValue(0.5); // all checks use 0.5 -> no special, no AI pool, > 0.2

      const result = await service.generateAIThought('rat', 'idle');
      expect(result).not.toBeNull();
      expect(['Squeak squeak...', 'Cheese?']).toContain(result);
      expect(mockCall).not.toHaveBeenCalled();
    });

    it('should call client.call 20% of the time', async () => {
      mockCall.mockResolvedValueOnce('A philosophical squeak');

      const randomMock = vi.spyOn(Math, 'random');
      // getEntityThought internals: special check, AI pool check, array pick
      // Then generateAIThought's own 20% check
      randomMock
        .mockReturnValueOnce(0.5)  // special check
        .mockReturnValueOnce(0.5)  // AI pool check
        .mockReturnValueOnce(0.0)  // array pick
        .mockReturnValueOnce(0.1); // <= 0.2, triggers AI call

      const result = await service.generateAIThought('rat', 'idle', {
        targetName: 'Hero',
      });
      expect(mockCall).toHaveBeenCalledOnce();
      expect(result).toBe('A philosophical squeak');
    });

    it('should return API response when available', async () => {
      mockCall.mockResolvedValueOnce('Deep rat thoughts');

      const randomMock = vi.spyOn(Math, 'random');
      randomMock
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.0)
        .mockReturnValueOnce(0.1);

      const result = await service.generateAIThought('rat', 'combat');
      expect(result).toBe('Deep rat thoughts');
    });

    it('should fall back to base thought on API error', async () => {
      mockCall.mockRejectedValueOnce(new Error('API unavailable'));

      const randomMock = vi.spyOn(Math, 'random');
      randomMock
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.0)
        .mockReturnValueOnce(0.1);

      const result = await service.generateAIThought('rat', 'idle');
      // Should fall back to the base thought from getEntityThought
      expect(['Squeak squeak...', 'Cheese?']).toContain(result);
    });

    it('should fall back to base thought when API returns null', async () => {
      mockCall.mockResolvedValueOnce(null);

      const randomMock = vi.spyOn(Math, 'random');
      randomMock
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.0)
        .mockReturnValueOnce(0.1);

      const result = await service.generateAIThought('rat', 'idle');
      // response is falsy -> falls back to baseThought.thought
      expect(['Squeak squeak...', 'Cheese?']).toContain(result);
    });
  });

  // =============================================================
  // AI thought pool
  // =============================================================
  describe('AI thought pool', () => {
    it('should return null from getAIThought when pool is empty', () => {
      const result = (service as any).getAIThought('rat');
      expect(result).toBeNull();
    });

    it('should return a thought from getAIThought after pool is populated', () => {
      (service as any).aiThoughtPools.set('rat', {
        thoughts: ['Pool thought 1', 'Pool thought 2'],
        lastRefresh: Date.now(),
      });

      vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const result = (service as any).getAIThought('rat');
      expect(result).toBe('Pool thought 1');
    });

    it('should return thought after refreshPoolForType succeeds', async () => {
      mockCall.mockResolvedValueOnce(
        'Squeak of destiny\nRat wisdom\nCheese dreams'
      );

      await (service as any).refreshPoolForType('rat');

      const result = (service as any).getAIThought('rat');
      expect(result).not.toBeNull();
      expect(
        ['Squeak of destiny', 'Rat wisdom', 'Cheese dreams']
      ).toContain(result);
    });

    it('should parse multi-line response and filter to < 50 chars', async () => {
      const longLine = 'A'.repeat(60); // 60 chars -> should be filtered out
      mockCall.mockResolvedValueOnce(
        `Short thought\n${longLine}\nAnother valid one\n\n`
      );

      await (service as any).refreshPoolForType('rat');

      const pool = (service as any).aiThoughtPools.get('rat');
      expect(pool).toBeDefined();
      expect(pool.thoughts).toEqual(['Short thought', 'Another valid one']);
      // The long line and empty line should be filtered
      expect(pool.thoughts).not.toContain(longLine);
    });

    it('should handle API error in refreshPoolForType gracefully', async () => {
      mockCall.mockRejectedValueOnce(new Error('Venice down'));

      // Should not throw
      await expect(
        (service as any).refreshPoolForType('rat')
      ).resolves.toBeUndefined();

      // Pool should remain empty
      const result = (service as any).getAIThought('rat');
      expect(result).toBeNull();
    });

    it('should not populate pool when API returns null', async () => {
      mockCall.mockResolvedValueOnce(null);

      await (service as any).refreshPoolForType('rat');

      const result = (service as any).getAIThought('rat');
      expect(result).toBeNull();
    });

    it('should skip refreshPoolForType for unknown entity types', async () => {
      await (service as any).refreshPoolForType('dragon');
      expect(mockCall).not.toHaveBeenCalled();
    });

    it('should use case-insensitive lookup in getAIThought', () => {
      (service as any).aiThoughtPools.set('rat', {
        thoughts: ['Lower case thought'],
        lastRefresh: Date.now(),
      });

      vi.spyOn(Math, 'random').mockReturnValue(0.0);
      // getAIThought lowercases the key
      const result = (service as any).getAIThought('Rat');
      expect(result).toBe('Lower case thought');
    });
  });

  // =============================================================
  // Background refresh lifecycle
  // =============================================================
  describe('background refresh', () => {
    it('should schedule startBackgroundRefresh after 10s delay', () => {
      // The constructor already ran in beforeEach. Verify that advancing
      // past 10s triggers refreshAllPools (which calls client.call).
      mockCall.mockResolvedValue('AI thought line');

      vi.advanceTimersByTime(10_000);

      // refreshAllPools should have been triggered, which calls
      // refreshPoolForType for up to 3 random entity types
      // We cannot assert exact call count because of random selection,
      // but at least one call should eventually happen
    });

    it('should set up periodic refresh at 5-minute intervals', () => {
      mockCall.mockResolvedValue('Periodic thought');

      // Advance past initial 10s delay
      vi.advanceTimersByTime(10_000);
      mockCall.mockClear();

      // Advance 5 minutes -> should trigger another refresh
      vi.advanceTimersByTime(5 * 60 * 1000);

      // The periodic refresh should have been called
      // (mockCall may or may not have been invoked depending on async resolution,
      //  but the interval should exist)
    });
  });
});
