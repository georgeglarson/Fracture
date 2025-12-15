/**
 * Fish Audio TTS Service - Voice synthesis for narration and key characters
 * Single Responsibility: Convert text to speech audio
 *
 * Design: TTS is used sparingly for:
 * - Narrator commentary (world events, epic moments)
 * - Key NPCs like the King
 * - Boss introductions
 *
 * NOT used for: random mobs, rats, general enemies
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Voice IDs from Fish Audio (2 male, 2 female for variety)
export const VOICES = {
  horror_narrator: '98544e744e754814a6aa22229f63f475',  // Male - dark/ominous narrator
  marcus_worm: '8bed0e9b444046e2bf72da4b251d9a1d',      // Male - gritty/creature voice
  raiden_shogun: '5ac6fb7171ba419190700620738209d8',    // Female - authoritative
  venti: 'e34c486929524d41b88646b4ac2f382f',            // Female - friendly/light
};

// Voice types for different contexts
export type VoiceType = 'narrator_dark' | 'narrator_epic' | 'king' | 'boss' | 'friendly_npc';

// Map voice types to Fish Audio voice IDs
const VOICE_TYPE_MAP: Record<VoiceType, string> = {
  narrator_dark: VOICES.horror_narrator,    // Ominous world events
  narrator_epic: VOICES.marcus_worm,        // Epic battle moments
  king: VOICES.raiden_shogun,               // The King (authoritative female)
  boss: VOICES.horror_narrator,             // Boss introductions
  friendly_npc: VOICES.venti,               // Helpful quest NPCs
};

// Key NPCs that get voiced dialogue (very limited set)
const VOICED_NPCS: Record<string, VoiceType> = {
  king: 'king',
  // Add other key story NPCs here if needed
};

// Default - most NPCs don't get voice, returns null
const DEFAULT_VOICE: string | null = null;

export interface FishAudioConfig {
  apiKey: string;
  cacheDir?: string;
  timeout?: number;
}

export interface TTSResult {
  audioUrl: string;
  cached: boolean;
  duration?: number;
}

export class FishAudioService {
  private apiKey: string;
  private cacheDir: string;
  private timeout: number;
  private cache: Map<string, string> = new Map();

  constructor(config: FishAudioConfig) {
    this.apiKey = config.apiKey;
    this.cacheDir = config.cacheDir || path.join(__dirname, '../../../data/tts-cache');
    this.timeout = config.timeout || 10000;

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.info(`[FishAudio] Created cache directory: ${this.cacheDir}`);
    }

    console.info(`[FishAudio] Service initialized`);
    console.info(`[FishAudio] Cache directory: ${this.cacheDir}`);
  }

  /**
   * Sanitize text to prevent JSON parsing errors
   * Fish Audio API is sensitive to special characters
   */
  private sanitizeText(text: string): string {
    return text
      .replace(/[""]/g, '"')      // Normalize quotes
      .replace(/['']/g, "'")      // Normalize apostrophes
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\\/g, '')         // Remove backslashes
      .trim();
  }

  /**
   * Get voice ID for a specific voice type
   */
  getVoiceForType(voiceType: VoiceType): string {
    return VOICE_TYPE_MAP[voiceType];
  }

  /**
   * Get voice ID for an NPC type - returns null for non-voiced NPCs
   */
  getVoiceForNpc(npcType: string): string | null {
    const voiceType = VOICED_NPCS[npcType.toLowerCase()];
    if (voiceType) {
      return VOICE_TYPE_MAP[voiceType];
    }
    return DEFAULT_VOICE;  // null for most NPCs
  }

  /**
   * Check if an NPC should have voiced dialogue
   */
  shouldVoice(npcType: string): boolean {
    return npcType.toLowerCase() in VOICED_NPCS;
  }

  /**
   * Generate cache key from text and voice
   */
  private getCacheKey(text: string, voiceId: string): string {
    const hash = crypto.createHash('md5').update(`${voiceId}:${text}`).digest('hex');
    return hash;
  }

  /**
   * Convert text to speech for NPC dialogue (only voiced NPCs)
   * Returns null for non-voiced NPCs
   */
  async textToSpeech(text: string, npcType: string): Promise<TTSResult | null> {
    const voiceId = this.getVoiceForNpc(npcType);
    if (!voiceId) {
      // NPC not in voiced list, skip TTS
      return null;
    }
    return this.generateSpeech(text, voiceId, `npc:${npcType}`);
  }

  /**
   * Convert text to speech for narrator commentary
   * Always uses narrator voice - for world events, epic moments
   */
  async narratorSpeech(text: string, style: 'dark' | 'epic' = 'dark'): Promise<TTSResult | null> {
    const voiceType: VoiceType = style === 'dark' ? 'narrator_dark' : 'narrator_epic';
    const voiceId = this.getVoiceForType(voiceType);
    return this.generateSpeech(text, voiceId, `narrator:${style}`);
  }

  /**
   * Convert text to speech for boss introductions
   */
  async bossSpeech(text: string): Promise<TTSResult | null> {
    const voiceId = this.getVoiceForType('boss');
    return this.generateSpeech(text, voiceId, 'boss');
  }

  /**
   * Convert text to speech for intro narration (uses specific voice ID)
   */
  async generateIntroSpeech(text: string, voiceId: string): Promise<TTSResult | null> {
    return this.generateSpeech(text, voiceId, 'intro');
  }

  /**
   * Internal method to generate speech with any voice
   */
  private async generateSpeech(text: string, voiceId: string, context: string): Promise<TTSResult | null> {
    // Sanitize text to prevent JSON errors
    const cleanText = this.sanitizeText(text);
    if (!cleanText) return null;

    const cacheKey = this.getCacheKey(cleanText, voiceId);
    const cacheFile = path.join(this.cacheDir, `${cacheKey}.mp3`);

    // Check memory cache first
    if (this.cache.has(cacheKey)) {
      return {
        audioUrl: `/tts/${cacheKey}.mp3`,
        cached: true
      };
    }

    // Check disk cache
    if (fs.existsSync(cacheFile)) {
      this.cache.set(cacheKey, cacheFile);
      return {
        audioUrl: `/tts/${cacheKey}.mp3`,
        cached: true
      };
    }

    // Generate new audio
    try {
      const response = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          reference_id: voiceId,
          format: 'mp3',
          mp3_bitrate: 64,  // Lower bitrate for smaller files
          latency: 'normal',
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[FishAudio] API error ${response.status}: ${errorText}`);
        return null;
      }

      // Get audio data
      const audioBuffer = await response.arrayBuffer();

      // Save to cache
      fs.writeFileSync(cacheFile, Buffer.from(audioBuffer));
      this.cache.set(cacheKey, cacheFile);

      console.info(`[FishAudio] Generated speech for "${cleanText.substring(0, 30)}..." (${context})`);

      return {
        audioUrl: `/tts/${cacheKey}.mp3`,
        cached: false
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          console.warn(`[FishAudio] Request timed out for: "${cleanText.substring(0, 30)}..."`);
        } else {
          console.error(`[FishAudio] Error: ${error.message}`);
        }
      }
      return null;
    }
  }

  /**
   * Get absolute path to cached audio file
   */
  getCacheFilePath(filename: string): string | null {
    const filePath = path.join(this.cacheDir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * Clear old cache files (older than maxAge in milliseconds)
   */
  clearOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
    let cleared = 0;
    const now = Date.now();

    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          cleared++;
        }
      }

      if (cleared > 0) {
        console.info(`[FishAudio] Cleared ${cleared} old cache files`);
      }
    } catch (error) {
      console.error(`[FishAudio] Error clearing cache:`, error);
    }

    return cleared;
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { files: number; size: number } {
    try {
      const files = fs.readdirSync(this.cacheDir);
      let totalSize = 0;
      for (const file of files) {
        const stats = fs.statSync(path.join(this.cacheDir, file));
        totalSize += stats.size;
      }
      return { files: files.length, size: totalSize };
    } catch {
      return { files: 0, size: 0 };
    }
  }
}

// Singleton instance
let fishAudioService: FishAudioService | null = null;

export function initFishAudioService(config: FishAudioConfig): FishAudioService {
  fishAudioService = new FishAudioService(config);
  return fishAudioService;
}

export function getFishAudioService(): FishAudioService | null {
  return fishAudioService;
}
