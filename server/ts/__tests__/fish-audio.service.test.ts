/**
 * Tests for FishAudioService
 * Covers: construction, voice mapping, text sanitization, caching (memory + disk),
 *         speech generation (NPC, narrator, boss, intro), cache management,
 *         error handling, singleton lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockReaddirSync = vi.fn().mockReturnValue([]);
const mockStatSync = vi.fn();
const mockUnlinkSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
  readdirSync: (...args: any[]) => mockReaddirSync(...args),
  statSync: (...args: any[]) => mockStatSync(...args),
  unlinkSync: (...args: any[]) => mockUnlinkSync(...args),
}));

vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('abc123hash'),
  })),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  FishAudioService,
  VOICES,
  initFishAudioService,
  getFishAudioService,
} from '../ai/fish-audio.service';
import type { FishAudioConfig } from '../ai/fish-audio.service';

// ── Helpers ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: FishAudioConfig = { apiKey: 'test-api-key' };

function createService(config: Partial<FishAudioConfig> = {}): FishAudioService {
  return new FishAudioService({ ...DEFAULT_CONFIG, ...config });
}

function mockFetchOk(audioBytes: number[] = [0xff, 0xfb, 0x90]) {
  const buffer = new Uint8Array(audioBytes).buffer;
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(buffer),
  });
}

function mockFetchError(status: number, body = 'error') {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    text: vi.fn().mockResolvedValue(body),
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe('FishAudioService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default the cache dir already exists so constructor does not mkdir
    mockExistsSync.mockReturnValue(false);
  });

  // ── Construction ──────────────────────────────────────────────────

  describe('construction', () => {
    it('should create cache directory when it does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      createService();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true },
      );
    });

    it('should not create cache directory when it already exists', () => {
      mockExistsSync.mockReturnValue(true);

      createService();

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('should use provided cacheDir', () => {
      mockExistsSync.mockReturnValue(false);

      createService({ cacheDir: '/tmp/custom-cache' });

      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/tmp/custom-cache',
        { recursive: true },
      );
    });

    it('should default cacheDir to data/tts-cache relative to project root', () => {
      mockExistsSync.mockReturnValue(false);

      createService();

      const calledPath = mockMkdirSync.mock.calls[0][0] as string;
      expect(calledPath).toContain('tts-cache');
    });
  });

  // ── getVoiceForType ───────────────────────────────────────────────

  describe('getVoiceForType', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      service = createService();
    });

    it('should return horror_narrator for narrator_dark', () => {
      expect(service.getVoiceForType('narrator_dark')).toBe(VOICES.horror_narrator);
    });

    it('should return marcus_worm for narrator_epic', () => {
      expect(service.getVoiceForType('narrator_epic')).toBe(VOICES.marcus_worm);
    });

    it('should return raiden_shogun for king', () => {
      expect(service.getVoiceForType('king')).toBe(VOICES.raiden_shogun);
    });

    it('should return horror_narrator for boss', () => {
      expect(service.getVoiceForType('boss')).toBe(VOICES.horror_narrator);
    });

    it('should return venti for friendly_npc', () => {
      expect(service.getVoiceForType('friendly_npc')).toBe(VOICES.venti);
    });
  });

  // ── getVoiceForNpc ────────────────────────────────────────────────

  describe('getVoiceForNpc', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      service = createService();
    });

    it('should return raiden_shogun voice for king', () => {
      expect(service.getVoiceForNpc('king')).toBe(VOICES.raiden_shogun);
    });

    it('should be case-insensitive', () => {
      expect(service.getVoiceForNpc('King')).toBe(VOICES.raiden_shogun);
      expect(service.getVoiceForNpc('KING')).toBe(VOICES.raiden_shogun);
    });

    it('should return null for non-voiced NPCs', () => {
      expect(service.getVoiceForNpc('goblin')).toBeNull();
      expect(service.getVoiceForNpc('merchant')).toBeNull();
      expect(service.getVoiceForNpc('rat')).toBeNull();
    });
  });

  // ── shouldVoice ───────────────────────────────────────────────────

  describe('shouldVoice', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      service = createService();
    });

    it('should return true for voiced NPCs', () => {
      expect(service.shouldVoice('king')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(service.shouldVoice('King')).toBe(true);
      expect(service.shouldVoice('KING')).toBe(true);
    });

    it('should return false for non-voiced NPCs', () => {
      expect(service.shouldVoice('goblin')).toBe(false);
      expect(service.shouldVoice('skeleton')).toBe(false);
    });
  });

  // ── textToSpeech ──────────────────────────────────────────────────

  describe('textToSpeech', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
      service = createService();
      // After construction, reset for speech generation checks
      mockExistsSync.mockReturnValue(false);
      mockFetchOk();
    });

    it('should return null for non-voiced NPCs', async () => {
      const result = await service.textToSpeech('Hello adventurer', 'goblin');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should generate speech for voiced NPCs', async () => {
      const result = await service.textToSpeech('Welcome to my castle', 'king');

      expect(result).not.toBeNull();
      expect(result!.audioUrl).toContain('/tts/');
      expect(result!.audioUrl).toContain('.mp3');
      expect(result!.cached).toBe(false);
    });
  });

  // ── narratorSpeech ────────────────────────────────────────────────

  describe('narratorSpeech', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
      service = createService();
      mockExistsSync.mockReturnValue(false);
      mockFetchOk();
    });

    it('should default to dark style', async () => {
      const result = await service.narratorSpeech('A shadow falls');

      expect(result).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.reference_id).toBe(VOICES.horror_narrator);
    });

    it('should use narrator_epic voice for epic style', async () => {
      const result = await service.narratorSpeech('Victory is at hand', 'epic');

      expect(result).not.toBeNull();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.reference_id).toBe(VOICES.marcus_worm);
    });
  });

  // ── bossSpeech ────────────────────────────────────────────────────

  describe('bossSpeech', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
      service = createService();
      mockExistsSync.mockReturnValue(false);
      mockFetchOk();
    });

    it('should use boss voice type (horror_narrator)', async () => {
      const result = await service.bossSpeech('You dare challenge me?');

      expect(result).not.toBeNull();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.reference_id).toBe(VOICES.horror_narrator);
    });
  });

  // ── generateIntroSpeech ───────────────────────────────────────────

  describe('generateIntroSpeech', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
      service = createService();
      mockExistsSync.mockReturnValue(false);
      mockFetchOk();
    });

    it('should use the provided voiceId directly', async () => {
      const customVoiceId = 'custom-voice-id-12345';
      const result = await service.generateIntroSpeech('Welcome to the world', customVoiceId);

      expect(result).not.toBeNull();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.reference_id).toBe(customVoiceId);
    });
  });

  // ── Caching ───────────────────────────────────────────────────────

  describe('caching', () => {
    it('should return cached result on memory cache hit', async () => {
      mockExistsSync.mockReturnValue(false);
      const service = createService();
      mockExistsSync.mockReturnValue(false);
      mockFetchOk();

      // First call populates memory cache
      const first = await service.narratorSpeech('A dark omen');
      expect(first!.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should hit memory cache
      const second = await service.narratorSpeech('A dark omen');
      expect(second!.cached).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // no additional fetch
    });

    it('should return cached result on disk cache hit', async () => {
      mockExistsSync.mockReturnValue(false);
      const service = createService();

      // existsSync returns true for disk cache check (the cache file)
      mockExistsSync.mockReturnValue(true);

      const result = await service.narratorSpeech('A dark omen');

      expect(result!.cached).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should write file to disk on new generation', async () => {
      mockExistsSync.mockReturnValue(false);
      const service = createService();
      mockExistsSync.mockReturnValue(false);
      mockFetchOk();

      await service.narratorSpeech('New narration');

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const writtenPath = mockWriteFileSync.mock.calls[0][0] as string;
      expect(writtenPath).toContain('.mp3');
    });
  });

  // ── Text sanitization ─────────────────────────────────────────────

  describe('text sanitization (via generateSpeech)', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
      service = createService();
      mockExistsSync.mockReturnValue(false);
      mockFetchOk();
    });

    it('should return null for empty text', async () => {
      const result = await service.narratorSpeech('');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null for whitespace-only text', async () => {
      const result = await service.narratorSpeech('   \t  ');

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should pass smart quotes through when regex only matches ASCII', async () => {
      // Note: The source regex /[""]/g contains two identical ASCII 0x22 chars,
      // so it does NOT actually match Unicode smart quotes (U+201C, U+201D).
      await service.narratorSpeech('\u201CHello\u201D');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toBe('\u201CHello\u201D');
    });

    it('should pass smart apostrophes through when regex only matches ASCII', async () => {
      // Note: The source regex /['']/g contains two identical ASCII 0x27 chars,
      // so it does NOT actually match Unicode smart apostrophes (U+2018, U+2019).
      await service.narratorSpeech('It\u2019s dangerous');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toBe('It\u2019s dangerous');
    });

    it('should remove backslashes', async () => {
      await service.narratorSpeech('path\\to\\doom');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toBe('pathtodoom');
    });

    it('should remove control characters', async () => {
      await service.narratorSpeech('Hello\x00World\x1F');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text).toBe('HelloWorld');
    });
  });

  // ── getCacheFilePath ──────────────────────────────────────────────

  describe('getCacheFilePath', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      service = createService();
    });

    it('should return absolute path when file exists on disk', () => {
      mockExistsSync.mockReturnValue(true);

      const result = service.getCacheFilePath('abc123.mp3');

      expect(result).not.toBeNull();
      expect(result).toContain('abc123.mp3');
    });

    it('should return null when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = service.getCacheFilePath('nonexistent.mp3');

      expect(result).toBeNull();
    });
  });

  // ── clearOldCache ─────────────────────────────────────────────────

  describe('clearOldCache', () => {
    let service: FishAudioService;
    const now = Date.now();

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      service = createService();
    });

    it('should remove files older than maxAge', () => {
      const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
      mockReaddirSync.mockReturnValue(['old.mp3', 'new.mp3']);
      mockStatSync
        .mockReturnValueOnce({ mtimeMs: now - eightDaysMs })  // old
        .mockReturnValueOnce({ mtimeMs: now - 1000 });        // new

      const cleared = service.clearOldCache();

      expect(cleared).toBe(1);
      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
      expect(mockUnlinkSync.mock.calls[0][0]).toContain('old.mp3');
    });

    it('should not remove files newer than maxAge', () => {
      mockReaddirSync.mockReturnValue(['recent.mp3']);
      mockStatSync.mockReturnValue({ mtimeMs: now - 1000 });

      const cleared = service.clearOldCache();

      expect(cleared).toBe(0);
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it('should use custom maxAge when provided', () => {
      const oneHourMs = 60 * 60 * 1000;
      mockReaddirSync.mockReturnValue(['semi-old.mp3']);
      mockStatSync.mockReturnValue({ mtimeMs: now - 2 * oneHourMs });

      const cleared = service.clearOldCache(oneHourMs);

      expect(cleared).toBe(1);
      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully and return 0', () => {
      mockReaddirSync.mockImplementation(() => { throw new Error('ENOENT'); });

      const cleared = service.clearOldCache();

      expect(cleared).toBe(0);
    });
  });

  // ── getCacheStats ─────────────────────────────────────────────────

  describe('getCacheStats', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      service = createService();
    });

    it('should return file count and total size', () => {
      mockReaddirSync.mockReturnValue(['a.mp3', 'b.mp3', 'c.mp3']);
      mockStatSync
        .mockReturnValueOnce({ size: 1000 })
        .mockReturnValueOnce({ size: 2000 })
        .mockReturnValueOnce({ size: 3000 });

      const stats = service.getCacheStats();

      expect(stats.files).toBe(3);
      expect(stats.size).toBe(6000);
    });

    it('should return zeros for empty cache', () => {
      mockReaddirSync.mockReturnValue([]);

      const stats = service.getCacheStats();

      expect(stats.files).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should return zeros on error', () => {
      mockReaddirSync.mockImplementation(() => { throw new Error('EACCES'); });

      const stats = service.getCacheStats();

      expect(stats.files).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  // ── Error handling ────────────────────────────────────────────────

  describe('error handling', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
      service = createService();
      mockExistsSync.mockReturnValue(false);
    });

    it('should return null on HTTP error response', async () => {
      mockFetchError(500, 'Internal Server Error');

      const result = await service.narratorSpeech('A dark omen');

      expect(result).toBeNull();
    });

    it('should return null on 401 unauthorized', async () => {
      mockFetchError(401, 'Unauthorized');

      const result = await service.narratorSpeech('A dark omen');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.narratorSpeech('A dark omen');

      expect(result).toBeNull();
    });

    it('should return null on timeout', async () => {
      const timeoutError = new Error('The operation was aborted due to timeout');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValue(timeoutError);

      const result = await service.narratorSpeech('A dark omen');

      expect(result).toBeNull();
    });
  });

  // ── Fetch call shape ──────────────────────────────────────────────

  describe('fetch call shape', () => {
    let service: FishAudioService;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
      service = createService();
      mockExistsSync.mockReturnValue(false);
      mockFetchOk();
    });

    it('should POST to the Fish Audio TTS endpoint', async () => {
      await service.narratorSpeech('Hello world');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fish.audio/v1/tts',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should include Bearer authorization header', async () => {
      await service.narratorSpeech('Hello world');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer test-api-key');
    });

    it('should send JSON content type', async () => {
      await service.narratorSpeech('Hello world');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should include abort signal for timeout', async () => {
      await service.narratorSpeech('Hello world');

      const options = mockFetch.mock.calls[0][1];
      expect(options.signal).toBeDefined();
    });
  });

  // ── Singleton management ──────────────────────────────────────────

  describe('singleton management', () => {
    afterEach(() => {
      // Reset the module-level singleton by re-importing is not practical,
      // so we test the observable behavior.
      vi.resetModules();
    });

    it('should return null before initialization', async () => {
      // Re-import to get fresh module state
      const mod = await import('../ai/fish-audio.service');
      expect(mod.getFishAudioService()).toBeNull();
    });

    it('should return the instance after initFishAudioService', () => {
      mockExistsSync.mockReturnValue(true);
      const instance = initFishAudioService(DEFAULT_CONFIG);

      expect(instance).toBeInstanceOf(FishAudioService);
      expect(getFishAudioService()).toBe(instance);
    });

    it('should replace the instance on repeated init', () => {
      mockExistsSync.mockReturnValue(true);
      const first = initFishAudioService(DEFAULT_CONFIG);
      const second = initFishAudioService({ apiKey: 'different-key' });

      expect(getFishAudioService()).toBe(second);
      expect(getFishAudioService()).not.toBe(first);
    });
  });
});
