/**
 * Intro Story Service - Generate unique intro narratives for new players
 * Single Responsibility: Create AI-generated intro stories with TTS
 *
 * Uses a pre-cached intro system:
 * - Keeps 1 pre-generated intro ready for instant serving
 * - After serving, generates new intro in background
 * - Player name is inserted at serve time via placeholder replacement
 */

import { VeniceClient } from './venice-client';
import { FishAudioService, getFishAudioService, VOICES } from './fish-audio.service';
import { sanitizeForPrompt } from './prompt-utils';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('IntroService');

// Placeholder for player name in pre-generated intros
// Use "Traveler" - unique enough to not appear elsewhere, sounds natural when spoken
const PLAYER_PLACEHOLDER = 'Traveler';

// Fixed lore points that AI must include (picked randomly for variety)
const LORE_FRAGMENTS = {
  theEvent: [
    'The Fracture - a cataclysm that shattered reality itself',
    'The day the world broke, when dimensions collided',
    'The Great Sundering that tore the fabric of existence',
    'When the barrier between worlds cracked like glass'
  ],
  theWorld: [
    'scattered remnants of a once-whole realm',
    'floating islands of broken reality',
    'shards of different dimensions fused together',
    'twisted landscapes where nothing is as it seems'
  ],
  theHope: [
    'Yet heroes emerge from the chaos',
    'But in the cracks, opportunity awaits',
    'From destruction comes rebirth',
    'And some see fortune in the ruins'
  ],
  theMystery: [
    'No one knows what caused the Fracture',
    'The truth lies buried in the broken world',
    'Ancient powers stir in the fragments',
    'Something waits beyond the shattered veil'
  ]
};

// Narrator voice pool - pick randomly for variety
const NARRATOR_VOICES = [
  { id: VOICES.horror_narrator, name: 'The Dark One', style: 'ominous' },
  { id: VOICES.marcus_worm, name: 'The Grim Chronicler', style: 'gritty' },
  { id: VOICES.raiden_shogun, name: 'The Sovereign', style: 'commanding' },
];

export interface IntroStoryResult {
  story: string;
  lines: string[];
  audioUrl?: string;
  voiceName: string;
  cached: boolean;
}

// Internal cache structure - text only, no audio
interface CachedIntroText {
  story: string;
  lines: string[];
  narrator: { id: string; name: string; style: string };
}

export class IntroService {
  private client: VeniceClient;
  private cachedText: CachedIntroText | null = null;
  private isGenerating = false;

  constructor(client: VeniceClient) {
    this.client = client;
    // Start pre-generating the first intro text immediately
    this.generateCachedText();
  }

  /**
   * Pre-generate intro TEXT only (no audio) for the cache
   * Audio is generated on-demand when player requests intro
   */
  private async generateCachedText(): Promise<void> {
    if (this.isGenerating) return;
    this.isGenerating = true;

    log.info('Pre-generating cached intro text');
    try {
      const result = await this.generateTextOnly(PLAYER_PLACEHOLDER);
      if (result) {
        this.cachedText = result;
        log.info({ narrator: result.narrator.name, preview: result.lines[0].substring(0, 50) }, 'Cached text ready');
      } else {
        log.warn('Failed to pre-generate intro text, will use static fallback');
      }
    } catch (error) {
      log.error({ err: error }, 'Error pre-generating intro text');
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Pick a random element from an array
   */
  private pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Get an intro for a player:
   * 1. Use cached text (instant)
   * 2. Substitute player name
   * 3. Generate TTS with Fish Audio (player waits for this)
   * 4. Start generating next text in background
   */
  async generateIntro(playerName: string): Promise<IntroStoryResult | null> {
    const fishAudio = getFishAudioService();

    // If we have cached text, use it
    if (this.cachedText) {
      log.info({ playerName }, 'Using cached text');
      const cached = this.cachedText;

      // Clear cache and start generating next text in background
      this.cachedText = null;
      setImmediate(() => this.generateCachedText());

      // Personalize text with player name
      const personalizedLines = cached.lines.map(line =>
        line.replace(new RegExp(PLAYER_PLACEHOLDER, 'gi'), playerName)
      );
      const personalizedStory = personalizedLines.join(' ');

      // Fire-and-forget TTS — don't block player login
      if (fishAudio) {
        fishAudio.generateIntroSpeech(personalizedStory, cached.narrator.id)
          .then(ttsResult => {
            if (ttsResult) {
              log.info({ audioUrl: ttsResult.audioUrl }, 'Background TTS ready');
            }
          })
          .catch(ttsError => {
            log.warn({ err: ttsError }, 'Background TTS generation failed');
          });
      }

      return {
        story: personalizedStory,
        lines: personalizedLines,
        audioUrl: undefined,
        voiceName: cached.narrator.name,
        cached: true
      };
    }

    // No cache - generate fresh (first player or cache miss)
    log.info({ playerName }, 'No cached text, generating fresh');
    const result = await this.generateFreshIntro(playerName);

    // Start generating next cached text in background
    setImmediate(() => this.generateCachedText());

    return result;
  }

  /**
   * Generate TEXT only (no TTS) - used for pre-caching
   */
  private async generateTextOnly(playerName: string): Promise<CachedIntroText | null> {
    // Pick random lore elements
    const theEvent = this.pick(LORE_FRAGMENTS.theEvent);
    const theWorld = this.pick(LORE_FRAGMENTS.theWorld);
    const theHope = this.pick(LORE_FRAGMENTS.theHope);
    const theMystery = this.pick(LORE_FRAGMENTS.theMystery);

    // Pick random narrator voice
    const narrator = this.pick(NARRATOR_VOICES);

    const prompt = `You are a dramatic narrator introducing a player to the world of Fracture, a dark fantasy MMO.

LORE REQUIREMENTS (you MUST weave these into your narration):
- The Event: ${theEvent}
- The World: ${theWorld}
- The Hope: ${theHope}
- The Mystery: ${theMystery}

PLAYER NAME: ${sanitizeForPrompt(playerName)}

VOICE STYLE: You are "${narrator.name}" - speak in a ${narrator.style} manner.

Write a compelling intro narration in EXACTLY 4 sentences:
1. Describe the Fracture event dramatically
2. Paint the broken world that resulted
3. Hint at the mystery and danger
4. Address the player using EXACTLY "${playerName}" (use this exact spelling)

RULES:
- Each sentence should be 15-25 words
- Be evocative and atmospheric
- NO clichés like "long ago" or "once upon a time"
- The 4th sentence MUST include "${playerName}" exactly as written
- Do NOT use quotation marks
- Make it feel like a movie trailer narration

Output ONLY the 4 sentences, one per line.`;

    try {
      const response = await this.client.call(prompt);
      if (!response) return null;

      // Split into lines, clean up
      const lines = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 4); // Ensure max 4 lines

      if (lines.length < 2) {
        log.warn('AI returned too few lines');
        return null;
      }

      const story = lines.join(' ');

      // Return text only - no TTS for cached version
      return {
        story,
        lines,
        narrator
      };
    } catch (error) {
      log.error({ err: error }, 'Generation error');
      return null;
    }
  }

  /**
   * Generate a complete intro with TTS (used when cache is empty)
   */
  private async generateFreshIntro(playerName: string): Promise<IntroStoryResult | null> {
    const textResult = await this.generateTextOnly(playerName);
    if (!textResult) return null;

    // Generate TTS for the fresh intro
    let audioUrl: string | undefined;
    const fishAudio = getFishAudioService();
    if (fishAudio) {
      try {
        log.info({ voice: textResult.narrator.name }, 'Generating fresh TTS');
        const ttsResult = await fishAudio.generateIntroSpeech(textResult.story, textResult.narrator.id);
        if (ttsResult) {
          audioUrl = ttsResult.audioUrl;
          log.info({ audioUrl }, 'Fresh TTS ready');
        }
      } catch (ttsError) {
        log.warn({ err: ttsError }, 'Fresh TTS failed');
      }
    }

    return {
      story: textResult.story,
      lines: textResult.lines,
      audioUrl,
      voiceName: textResult.narrator.name,
      cached: false
    };
  }

  /**
   * Get a static fallback intro (when AI fails)
   */
  getStaticIntro(playerName: string): IntroStoryResult {
    const narrator = this.pick(NARRATOR_VOICES);

    const intros = [
      [
        'Reality shattered like a mirror struck by divine fury, and the world we knew ceased to exist.',
        'Now only fragments remain - twisted shards of land floating in an endless void of possibility.',
        'Ancient powers stir in the broken places, and something watches from beyond the cracks.',
        `${playerName}, you awaken in this fractured realm, where every step writes your legend.`
      ],
      [
        'They called it the Fracture - the moment when dimensions collided and existence itself screamed.',
        'Mountains float beside oceans, forests grow sideways, and the laws of nature bend like reeds.',
        'None remember what triggered the cataclysm, but the answers lie buried in the chaos.',
        `Rise, ${playerName}, and carve your name into the bones of this broken world.`
      ],
      [
        'When the barrier between worlds cracked, reality poured through like sand through fingers.',
        'What remains is beautiful in its destruction - a kaleidoscope of shattered realities fused as one.',
        'Danger lurks in every shadow, but so does opportunity for those brave enough to seize it.',
        `Welcome to the Fracture, ${playerName}. Your story begins in the ruins of everything.`
      ]
    ];

    const lines = this.pick(intros);

    return {
      story: lines.join(' '),
      lines,
      voiceName: narrator.name,
      cached: false
    };
  }
}

// Singleton
let introService: IntroService | null = null;

export function initIntroService(client: VeniceClient): IntroService {
  introService = new IntroService(client);
  return introService;
}

export function getIntroService(): IntroService | null {
  return introService;
}
