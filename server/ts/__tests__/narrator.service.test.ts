/**
 * Tests for NarratorService
 * Covers: generateNarration, getStaticNarration, getNarratorStyle (indirect),
 *         DIMENSION_NARRATOR_STYLES, TTS integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

const mockNarratorSpeech = vi.fn();
vi.mock('../ai/fish-audio.service', () => ({
  getFishAudioService: vi.fn(() => null),
}));

vi.mock('@opentelemetry/api', () => {
  const mockSpan = {
    setAttributes: vi.fn(),
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
  };
  return {
    trace: {
      getTracer: () => ({
        startActiveSpan: (_name: string, fn: (span: any) => any) => fn(mockSpan),
      }),
    },
    SpanStatusCode: { ERROR: 2 },
  };
});

import { NarratorService, DIMENSION_NARRATOR_STYLES } from '../ai/narrator.service';
import { ProfileService } from '../ai/profile.service';
import { getFishAudioService } from '../ai/fish-audio.service';

// ── Helpers ─────────────────────────────────────────────────────────

function createMockClient(response: string | null = 'A dark omen looms overhead.') {
  return {
    call: vi.fn().mockResolvedValue(response),
  } as any;
}

function createService(client?: any) {
  const mockClient = client ?? createMockClient();
  const profiles = new ProfileService();
  return { service: new NarratorService(mockClient, profiles), client: mockClient, profiles };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('NarratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getFishAudioService as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  // ── generateNarration ─────────────────────────────────────────────

  describe('generateNarration', () => {
    it('should return NarrationResult with text and style on API success', async () => {
      const { service } = createService();

      const result = await service.generateNarration('join', 'Hero', 'p1');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('style');
      expect(typeof result!.text).toBe('string');
      expect(['epic', 'ominous', 'humor', 'info']).toContain(result!.style);
    });

    it('should return null on API error', async () => {
      const client = { call: vi.fn().mockRejectedValue(new Error('API down')) } as any;
      const { service } = createService(client);

      const result = await service.generateNarration('join', 'Hero', 'p1');

      expect(result).toBeNull();
    });

    it('should return null when API returns null', async () => {
      const { service } = createService(createMockClient(null));

      const result = await service.generateNarration('join', 'Hero', 'p1');

      expect(result).toBeNull();
    });

    it('should include dimension-specific style when zone provided', async () => {
      const client = createMockClient('The cave whispers ancient truths.');
      const { service } = createService(client);

      await service.generateNarration('join', 'Hero', 'p1', undefined, 'cave');

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('The Underdepths');
      expect(prompt).toContain('Lovecraftian');
    });

    it('should use default style when no zone provided', async () => {
      const client = createMockClient('The hero approaches.');
      const { service } = createService(client);

      await service.generateNarration('join', 'Hero', 'p1');

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('omniscient narrator');
      expect(prompt).toContain('Terry Pratchett');
    });

    it('should return style ominous for death events', async () => {
      const { service } = createService();

      const result = await service.generateNarration('death', 'Hero', 'p1');

      expect(result!.style).toBe('ominous');
    });

    it('should return style epic for bossKill events', async () => {
      const { service } = createService();

      const result = await service.generateNarration('bossKill', 'Hero', 'p1');

      expect(result!.style).toBe('epic');
    });

    it('should return style humor for firstKill events', async () => {
      const { service } = createService();

      const result = await service.generateNarration('firstKill', 'Hero', 'p1');

      expect(result!.style).toBe('humor');
    });

    it('should return style info for unknown events', async () => {
      const { service } = createService();

      const result = await service.generateNarration('somethingRandom', 'Hero', 'p1');

      expect(result!.style).toBe('info');
    });

    it('should generate TTS when FishAudioService is available', async () => {
      mockNarratorSpeech.mockResolvedValue({ audioUrl: '/tts/abc123.mp3', cached: false });
      (getFishAudioService as ReturnType<typeof vi.fn>).mockReturnValue({
        narratorSpeech: mockNarratorSpeech,
      });

      const { service } = createService();

      const result = await service.generateNarration('join', 'Hero', 'p1');

      expect(result).not.toBeNull();
      expect(mockNarratorSpeech).toHaveBeenCalled();
      expect(result!.audioUrl).toBe('/tts/abc123.mp3');
    });

    it('should continue without audio when TTS fails', async () => {
      mockNarratorSpeech.mockRejectedValue(new Error('TTS service error'));
      (getFishAudioService as ReturnType<typeof vi.fn>).mockReturnValue({
        narratorSpeech: mockNarratorSpeech,
      });

      const { service } = createService();

      const result = await service.generateNarration('join', 'Hero', 'p1');

      expect(result).not.toBeNull();
      expect(result!.text).toBeDefined();
      expect(result!.audioUrl).toBeUndefined();
    });

    it('should not attempt TTS when FishAudioService is null', async () => {
      (getFishAudioService as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const { service } = createService();

      const result = await service.generateNarration('join', 'Hero', 'p1');

      expect(result).not.toBeNull();
      expect(mockNarratorSpeech).not.toHaveBeenCalled();
      expect(result!.audioUrl).toBeUndefined();
    });
  });

  // ── getStaticNarration ────────────────────────────────────────────

  describe('getStaticNarration', () => {
    it('should return narration for join event', () => {
      const { service } = createService();

      const result = service.getStaticNarration('join', 'Hero');

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('style');
      expect(result.text).toContain('Hero');
    });

    it('should return narration for firstKill event with details', () => {
      const { service } = createService();

      const result = service.getStaticNarration('firstKill', 'Hero', { mobType: 'goblin' });

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('style');
    });

    it('should return narration for death event', () => {
      const { service } = createService();

      const result = service.getStaticNarration('death', 'Hero');

      expect(result.text).toContain('Hero');
      expect(['ominous', 'humor']).toContain(result.style);
    });

    it('should return narration for newArea event', () => {
      const { service } = createService();

      const result = service.getStaticNarration('newArea', 'Hero');

      expect(result.text).toContain('Hero');
      expect(['info', 'humor']).toContain(result.style);
    });

    it('should return narration for bossKill event', () => {
      const { service } = createService();

      const result = service.getStaticNarration('bossKill', 'Hero');

      expect(result.text).toContain('Hero');
      expect(result.style).toBe('epic');
    });

    it('should return narration for lowHealth event', () => {
      const { service } = createService();

      const result = service.getStaticNarration('lowHealth', 'Hero');

      expect(result.text).toContain('Hero');
      expect(result.style).toBe('ominous');
    });

    it('should return generic narration for unknown event', () => {
      const { service } = createService();

      const result = service.getStaticNarration('unknownEvent', 'Hero');

      expect(result.text).toContain('Hero');
      expect(result.style).toBe('info');
    });

    it('should return results with correct NarrationResult shape', () => {
      const { service } = createService();
      const events = ['join', 'firstKill', 'death', 'newArea', 'bossKill', 'lowHealth', 'unknownEvent'];

      for (const event of events) {
        const result = service.getStaticNarration(event, 'TestPlayer');
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('style');
        expect(typeof result.text).toBe('string');
        expect(['epic', 'ominous', 'humor', 'info']).toContain(result.style);
      }
    });

    it('should include playerName in text', () => {
      const { service } = createService();
      const events = ['join', 'firstKill', 'death', 'newArea', 'bossKill', 'lowHealth'];

      for (const event of events) {
        const result = service.getStaticNarration(event, 'UniquePlayerName');
        expect(result.text).toContain('UniquePlayerName');
      }
    });
  });

  // ── DIMENSION_NARRATOR_STYLES ─────────────────────────────────────

  describe('DIMENSION_NARRATOR_STYLES', () => {
    const expectedZones = ['village', 'beach', 'forest', 'cave', 'desert', 'lavaland', 'boss'];

    it('should have entries for all 7 zones', () => {
      for (const zone of expectedZones) {
        expect(DIMENSION_NARRATOR_STYLES).toHaveProperty(zone);
      }
      expect(Object.keys(DIMENSION_NARRATOR_STYLES)).toHaveLength(7);
    });

    it('should have name, personality, vocabulary, and tones for each entry', () => {
      for (const zone of expectedZones) {
        const entry = DIMENSION_NARRATOR_STYLES[zone];
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('personality');
        expect(entry).toHaveProperty('vocabulary');
        expect(entry).toHaveProperty('tones');
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.personality).toBe('string');
        expect(Array.isArray(entry.vocabulary)).toBe(true);
        expect(Array.isArray(entry.tones)).toBe(true);
        expect(entry.vocabulary.length).toBeGreaterThan(0);
        expect(entry.tones.length).toBeGreaterThan(0);
      }
    });
  });

  // ── getNarratorStyle (tested indirectly) ──────────────────────────

  describe('getNarratorStyle (via generateNarration)', () => {
    it('should map death to ominous', async () => {
      const { service } = createService();
      const result = await service.generateNarration('death', 'Hero', 'p1');
      expect(result!.style).toBe('ominous');
    });

    it('should map lowHealth to ominous', async () => {
      const { service } = createService();
      const result = await service.generateNarration('lowHealth', 'Hero', 'p1');
      expect(result!.style).toBe('ominous');
    });

    it('should map bossNear to ominous', async () => {
      const { service } = createService();
      const result = await service.generateNarration('bossNear', 'Hero', 'p1');
      expect(result!.style).toBe('ominous');
    });

    it('should map bossKill to epic', async () => {
      const { service } = createService();
      const result = await service.generateNarration('bossKill', 'Hero', 'p1');
      expect(result!.style).toBe('epic');
    });

    it('should map rareItem to epic', async () => {
      const { service } = createService();
      const result = await service.generateNarration('rareItem', 'Hero', 'p1');
      expect(result!.style).toBe('epic');
    });

    it('should map killMilestone to epic', async () => {
      const { service } = createService();
      const result = await service.generateNarration('killMilestone', 'Hero', 'p1');
      expect(result!.style).toBe('epic');
    });

    it('should map comeback to epic', async () => {
      const { service } = createService();
      const result = await service.generateNarration('comeback', 'Hero', 'p1');
      expect(result!.style).toBe('epic');
    });

    it('should map idle to humor', async () => {
      const { service } = createService();
      const result = await service.generateNarration('idle', 'Hero', 'p1');
      expect(result!.style).toBe('humor');
    });

    it('should map firstKill to humor', async () => {
      const { service } = createService();
      const result = await service.generateNarration('firstKill', 'Hero', 'p1');
      expect(result!.style).toBe('humor');
    });

    it('should map other events to info', async () => {
      const { service } = createService();

      for (const event of ['join', 'newArea', 'loot', 'killStreak', 'unknownEvent']) {
        const result = await service.generateNarration(event, 'Hero', 'p1');
        expect(result!.style).toBe('info');
      }
    });
  });
});
