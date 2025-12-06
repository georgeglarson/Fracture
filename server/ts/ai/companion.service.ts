/**
 * Companion Service - AI companion hints and tips
 * Single Responsibility: Generate contextual hints for players
 */

import { VeniceClient } from './venice-client';
import { ProfileService } from './profile.service';
import { PlayerProfile } from './types';
import { COMPANION_TRIGGERS } from './npc-personalities';

export interface CompanionData {
  percent?: number;
  area?: string;
  time?: number;
  mobType?: string;
  killer?: string;
}

export class CompanionService {
  private client: VeniceClient;
  private profiles: ProfileService;

  constructor(client: VeniceClient, profiles: ProfileService) {
    this.client = client;
    this.profiles = profiles;
  }

  /**
   * Get a contextual companion hint
   */
  async getCompanionHint(
    playerId: string,
    trigger: string,
    data?: CompanionData
  ): Promise<string | null> {
    const profile = this.profiles.getProfile(playerId);
    const triggerConfig = COMPANION_TRIGGERS[trigger];

    if (!triggerConfig) {
      return null;
    }

    const staticHints = triggerConfig.hints;

    // 70% chance to use static hint (faster, cheaper)
    if (staticHints && Math.random() < 0.7) {
      return staticHints[Math.floor(Math.random() * staticHints.length)];
    }

    // Generate dynamic hint with context
    const prompt = `You are a helpful fairy companion in a fantasy RPG.

SITUATION: ${this.describeSituation(trigger, data, profile)}
PLAYER STATUS: ${profile.totalKills} kills, ${profile.deaths} deaths

Give a SHORT helpful hint (under 60 chars). Be encouraging but practical:`;

    try {
      const response = await this.client.call(prompt);
      return response || staticHints[0];
    } catch (error) {
      return staticHints[0];
    }
  }

  /**
   * Describe the current situation for AI context
   */
  private describeSituation(
    trigger: string,
    data?: CompanionData,
    profile?: PlayerProfile
  ): string {
    switch (trigger) {
      case 'lowHealth':
        return `Player health is critical (${data?.percent || 0}%)`;
      case 'newArea':
        return `Player entered new area: ${data?.area || 'unknown'}`;
      case 'nearBoss':
        return 'Player is near a boss monster';
      case 'idle':
        return `Player has been idle for ${Math.floor((data?.time || 0) / 1000)} seconds`;
      case 'firstKill':
        return `Player just killed their first ${data?.mobType || 'monster'}`;
      case 'death':
        return `Player just died to ${data?.killer || 'a monster'}`;
      default:
        return 'Player is adventuring';
    }
  }

  /**
   * Get a random static hint for a trigger
   */
  getStaticHint(trigger: string): string | null {
    const triggerConfig = COMPANION_TRIGGERS[trigger];
    if (!triggerConfig || !triggerConfig.hints) {
      return null;
    }
    return triggerConfig.hints[Math.floor(Math.random() * triggerConfig.hints.length)];
  }
}
