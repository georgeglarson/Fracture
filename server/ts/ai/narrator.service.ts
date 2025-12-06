/**
 * Narrator Service - Dynamic event commentary
 * Single Responsibility: Generate dramatic narration for game events
 */

import { VeniceClient } from './venice-client';
import { ProfileService } from './profile.service';
import { PlayerProfile } from './types';

export interface NarrationResult {
  text: string;
  style: 'epic' | 'ominous' | 'humor' | 'info';
}

export class NarratorService {
  private client: VeniceClient;
  private profiles: ProfileService;

  constructor(client: VeniceClient, profiles: ProfileService) {
    this.client = client;
    this.profiles = profiles;
  }

  /**
   * Generate AI narration for an event
   */
  async generateNarration(
    event: string,
    playerName: string,
    playerId: string,
    details?: Record<string, any>
  ): Promise<NarrationResult | null> {
    const profile = this.profiles.getProfile(playerId);

    // Build context based on event type
    const eventContext = this.buildNarratorContext(event, playerName, profile, details);

    // Random style directives to ensure variety
    const tones = [
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

    const prompt = `You are an omniscient narrator in a fantasy RPG, watching a hero's journey unfold.
Your style: Witty, dramatic, occasionally breaking the fourth wall. Think Terry Pratchett meets D&D dungeon master.

EVENT: ${eventContext}

PLAYER STATS:
- Name: ${playerName}
- Total Kills: ${profile.totalKills}
- Deaths: ${profile.deaths}
- Areas Explored: ${profile.areas.length > 0 ? profile.areas.join(', ') : 'Just starting'}
- Quests Completed: ${profile.questsCompleted}

STYLE DIRECTIVE: ${randomTone} ${randomStructure}

Write a UNIQUE narrator comment (under 100 chars). Each response must be completely different from previous ones.
Do NOT use quotes. Do NOT use the word "begins" or "journey". Speak as if narrating a story.`;

    try {
      const text = await this.client.call(prompt);
      if (!text) return null;

      // Determine style based on event
      const style = this.getNarratorStyle(event);

      return { text, style };
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
