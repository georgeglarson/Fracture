/**
 * Narrator Service - Dynamic event commentary
 * Single Responsibility: Generate dramatic narration for game events
 */

import { VeniceClient } from './venice-client';
import { ProfileService } from './profile.service';
import { PlayerProfile } from './types';
import { FishAudioService, getFishAudioService } from './fish-audio.service';

export interface NarrationResult {
  text: string;
  style: 'epic' | 'ominous' | 'humor' | 'info';
  audioUrl?: string;
}

/**
 * Dimension-specific narrator styles
 * Each zone has a unique narrative voice
 */
export const DIMENSION_NARRATOR_STYLES: Record<string, {
  name: string;
  personality: string;
  vocabulary: string[];
  tones: string[];
}> = {
  village: {
    name: 'The Refuge',
    personality: 'A warm, welcoming voice. Like a kind innkeeper or village elder. Safe and hopeful.',
    vocabulary: ['hearth', 'home', 'rest', 'sanctuary', 'beginning', 'hope', 'shelter'],
    tones: [
      'Be warm and welcoming.',
      'Sound like a friendly tavern keeper.',
      'Be gently encouraging.',
      'Speak of safety and new beginnings.'
    ]
  },
  beach: {
    name: 'Shattered Coast',
    personality: 'An eerie, waterlogged voice. Like whispers from drowned sailors. Reality glitches like corrupted data.',
    vocabulary: ['tides', 'depths', 'static', 'signal', 'waves', 'fragments', 'echoes', 'distortion'],
    tones: [
      'Sound like a corrupted radio transmission.',
      'Speak as if underwater, glitching.',
      'Be mysteriously aquatic and digital.',
      'Reference broken signals and lost transmissions.'
    ]
  },
  forest: {
    name: 'Glitch Woods',
    personality: 'A digital, matrix-like voice. The forest is made of corrupted code. Trees are data structures.',
    vocabulary: ['code', 'compile', 'error', 'recursive', 'branch', 'root', 'null', 'overflow', 'debug'],
    tones: [
      'Speak like a corrupted AI system.',
      'Use programming metaphors.',
      'Be glitchy and fragmented.',
      'Reference system errors and code.'
    ]
  },
  cave: {
    name: 'The Underdepths',
    personality: 'A cosmic horror voice. Lovecraftian whispers from beyond the stars. Ancient and unknowable.',
    vocabulary: ['void', 'ancient', 'stars', 'madness', 'beyond', 'eternal', 'whispers', 'abyss', 'eldritch'],
    tones: [
      'Be ominously Lovecraftian.',
      'Speak of ancient cosmic horrors.',
      'Be mysteriously unsettling.',
      'Reference things beyond mortal comprehension.'
    ]
  },
  desert: {
    name: 'The Null Zone',
    personality: 'A nihilistic, synthwave voice. The void speaks in neon. Reality is optional here.',
    vocabulary: ['void', 'null', 'neon', 'static', 'empty', 'zero', 'infinite', 'synthetic', 'grid'],
    tones: [
      'Be existentially nihilistic.',
      'Speak in synthwave aesthetic.',
      'Reference the void and nothingness.',
      'Be coldly philosophical.'
    ]
  },
  lavaland: {
    name: 'The Core Breach',
    personality: 'An apocalyptic, fiery voice. The world is ending. Everything burns with terrible beauty.',
    vocabulary: ['fire', 'ash', 'burn', 'apocalypse', 'molten', 'cataclysm', 'inferno', 'phoenix'],
    tones: [
      'Be apocalyptically dramatic.',
      'Speak of fire and destruction.',
      'Be intensely ominous.',
      'Reference the end of all things.'
    ]
  },
  boss: {
    name: "Reality's Edge",
    personality: 'A meta, reality-breaking voice. The narrator knows it\'s a game. Fourth wall is shattered.',
    vocabulary: ['reality', 'simulation', 'code', 'player', 'respawn', 'game', 'dimension', 'fracture'],
    tones: [
      'Break the fourth wall completely.',
      'Acknowledge the game itself.',
      'Be meta and reality-bending.',
      'Reference the player as player, not character.'
    ]
  }
};

export class NarratorService {
  private client: VeniceClient;
  private profiles: ProfileService;

  constructor(client: VeniceClient, profiles: ProfileService) {
    this.client = client;
    this.profiles = profiles;
  }

  /**
   * Generate AI narration for an event
   * @param zone - Optional zone ID for dimension-specific narration style
   */
  async generateNarration(
    event: string,
    playerName: string,
    playerId: string,
    details?: Record<string, any>,
    zone?: string
  ): Promise<NarrationResult | null> {
    const profile = this.profiles.getProfile(playerId);

    // Build context based on event type
    const eventContext = this.buildNarratorContext(event, playerName, profile, details);

    // Get dimension-specific style if zone provided
    const dimensionStyle = zone ? DIMENSION_NARRATOR_STYLES[zone] : null;

    // Use dimension-specific tones or fall back to default
    const tones = dimensionStyle?.tones || [
      'Be dramatic and epic.',
      'Be darkly humorous.',
      'Be ominously foreboding.',
      'Be wryly observational.',
      'Be sarcastically witty.',
      'Be poetically dramatic.',
      'Break the fourth wall cleverly.',
      'Be mysteriously cryptic.'
    ];
    const randomTone = tones[Math.floor(Math.random() * tones.length)];

    // Random structural directives
    const structures = [
      'Start with the player\'s name.',
      'End with an ellipsis for suspense.',
      'Use alliteration if possible.',
      'Reference fate or destiny.',
      'Make an observation about violence.',
      'Hint at what\'s to come.',
      'Comment on the irony of the moment.',
      'Use a metaphor.'
    ];
    const randomStructure = structures[Math.floor(Math.random() * structures.length)];

    // Build dimension-specific prompt additions
    const dimensionContext = dimensionStyle
      ? `\nDIMENSION: ${dimensionStyle.name}
NARRATOR PERSONALITY: ${dimensionStyle.personality}
SUGGESTED VOCABULARY: ${dimensionStyle.vocabulary.join(', ')}`
      : '';

    const basePersonality = dimensionStyle
      ? `You are the voice of ${dimensionStyle.name}, a fractured dimension in a reality-bending RPG.`
      : 'You are an omniscient narrator in a fantasy RPG, watching a hero\'s journey unfold.';

    const prompt = `${basePersonality}
Your style: ${dimensionStyle?.personality || 'Witty, dramatic, occasionally breaking the fourth wall. Think Terry Pratchett meets D&D dungeon master.'}
${dimensionContext}

EVENT: ${eventContext}

PLAYER STATS:
- Name: ${playerName}
- Total Kills: ${profile.totalKills}
- Deaths: ${profile.deaths}
- Areas Explored: ${profile.areas.length > 0 ? profile.areas.join(', ') : 'Just starting'}
- Quests Completed: ${profile.questsCompleted}

STYLE DIRECTIVE: ${randomTone} ${randomStructure}

Write a UNIQUE narrator comment (under 100 chars). Each response must be completely different from previous ones.
Do NOT use quotes. Do NOT use the word "begins" or "journey". Speak as if narrating a story.
${dimensionStyle ? `Try to incorporate the dimension's aesthetic and vocabulary naturally.` : ''}`;

    try {
      const text = await this.client.call(prompt);
      if (!text) return null;

      // Determine style based on event
      const style = this.getNarratorStyle(event);

      // Generate TTS audio if Fish Audio service is available
      let audioUrl: string | undefined;
      const fishAudio = getFishAudioService();
      if (fishAudio) {
        try {
          const ttsStyle = style === 'ominous' ? 'dark' : 'epic';
          const ttsResult = await fishAudio.narratorSpeech(text, ttsStyle);
          if (ttsResult) {
            audioUrl = ttsResult.audioUrl;
            console.log(`[Narrator] TTS generated: ${audioUrl}`);
          }
        } catch (ttsError) {
          console.warn('[Narrator] TTS generation failed:', ttsError);
          // Continue without audio - TTS is optional
        }
      }

      return { text, style, audioUrl };
    } catch (error) {
      console.error('Venice narrator error:', error);
      return null;
    }
  }

  /**
   * Get static fallback narration
   */
  getStaticNarration(event: string, playerName: string, details?: Record<string, any>): NarrationResult {
    const fallbacks: Record<string, NarrationResult[]> = {
      join: [
        { text: `And so ${playerName}'s legend begins...`, style: 'epic' },
        { text: `${playerName} enters the realm. The monsters tremble. Or maybe that's just the lag.`, style: 'humor' },
      ],
      firstKill: [
        { text: `${playerName} draws first blood. Many more shall follow.`, style: 'epic' },
        { text: `That ${details?.mobType || 'creature'} had a family, ${playerName}. Just saying.`, style: 'humor' },
      ],
      death: [
        { text: `${playerName} has fallen. But death is merely an inconvenience here.`, style: 'ominous' },
        { text: `RIP ${playerName}. Press F to pay respects.`, style: 'humor' },
      ],
      newArea: [
        { text: `${playerName} ventures into the unknown...`, style: 'info' },
        { text: `New area unlocked! ${playerName} is basically a tourist now.`, style: 'humor' },
      ],
      bossKill: [
        { text: `THE BOSS FALLS! ${playerName} stands victorious!`, style: 'epic' },
      ],
      lowHealth: [
        { text: `${playerName} dances with death itself...`, style: 'ominous' },
      ],
    };

    const options = fallbacks[event] || [{ text: `${playerName} does something noteworthy.`, style: 'info' as const }];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Build context description for narrator
   */
  private buildNarratorContext(
    event: string,
    playerName: string,
    profile: PlayerProfile,
    details?: Record<string, any>
  ): string {
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    switch (event) {
      case 'join':
        return pick([
          `${playerName} materializes in the village, blinking at the pixelated sun.`,
          `A fresh soul called ${playerName} awakens in the realm.`,
          `The world gains another wanderer: ${playerName} has arrived.`,
          `${playerName} spawns into existence, destiny unknown.`
        ]);

      case 'firstKill':
        return pick([
          `${playerName} has drawn first blood against a ${details?.mobType || 'creature'}!`,
          `The ${details?.mobType || 'creature'} becomes ${playerName}'s inaugural victim.`,
          `${playerName} claims their first kill - a ${details?.mobType || 'creature'} lies defeated.`,
          `Blood stains ${playerName}'s hands for the first time. The ${details?.mobType || 'creature'} is no more.`
        ]);

      case 'killMilestone':
        return pick([
          `${playerName} reaches ${details?.count || profile.totalKills} kills! The ${details?.mobType || 'monster'} was merely the latest.`,
          `Kill count: ${details?.count || profile.totalKills}. ${playerName} adds another ${details?.mobType || 'corpse'} to the tally.`,
          `${playerName}'s body count hits ${details?.count || profile.totalKills}. The ${details?.mobType || 'monster'} didn't stand a chance.`
        ]);

      case 'death':
        return `${playerName} has fallen in battle to a ${details?.killer || 'monster'}. This is death number ${profile.deaths}.`;

      case 'newArea':
        return `${playerName} ventures into ${details?.area || 'unknown territory'} for the first time.`;

      case 'bossNear':
        return `${playerName} approaches a powerful boss: ${details?.bossType || 'a terrible creature'}.`;

      case 'bossKill':
        return `${playerName} has defeated the mighty ${details?.bossType || 'boss'}! A legendary victory!`;

      case 'loot':
        return `${playerName} discovers ${details?.itemName || 'treasure'}!`;

      case 'rareItem':
        return `${playerName} has found a rare ${details?.itemName || 'artifact'}! Fortune favors the bold.`;

      case 'lowHealth':
        return `${playerName} clings to life with only ${details?.healthPercent || 'a sliver of'}% health remaining.`;

      case 'comeback':
        return `${playerName} survives a near-death experience! From ${details?.lowHealth}% to safety.`;

      case 'killStreak':
        return `${playerName} is on a killing spree! ${details?.streak || 'Multiple'} kills without taking damage.`;

      case 'idle':
        return `${playerName} stands motionless, perhaps contemplating the meaning of pixelated existence.`;

      default:
        return `Something interesting happens to ${playerName}.`;
    }
  }

  /**
   * Determine narration style based on event type
   */
  private getNarratorStyle(event: string): NarrationResult['style'] {
    const ominousEvents = ['death', 'lowHealth', 'bossNear'];
    const epicEvents = ['bossKill', 'rareItem', 'killMilestone', 'comeback'];
    const humorEvents = ['idle', 'firstKill'];

    if (ominousEvents.includes(event)) return 'ominous';
    if (epicEvents.includes(event)) return 'epic';
    if (humorEvents.includes(event)) return 'humor';
    return 'info';
  }
}
