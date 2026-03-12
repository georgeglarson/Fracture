/**
 * Quest Service - Quest generation and tracking
 * Single Responsibility: Manage player quests and progress
 */

import { VeniceClient } from './venice-client';
import { ProfileService } from './profile.service';
import { Quest, QuestResult } from './types';
import { QUEST_TEMPLATES } from './npc-personalities';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('QuestService');

export class QuestService {
  private client: VeniceClient;
  private profiles: ProfileService;

  // Active quests: { playerId: quest }
  private activeQuests: Map<string, Quest> = new Map();

  constructor(client: VeniceClient, profiles: ProfileService) {
    this.client = client;
    this.profiles = profiles;
  }

  /**
   * Generate a new quest for a player
   */
  async generateQuest(playerId: string, npcType: string): Promise<Quest> {
    const profile = this.profiles.getProfile(playerId);

    // Check if player already has an active quest
    const existing = this.activeQuests.get(playerId);
    if (existing) {
      return existing;
    }

    // Pick a quest template based on player progress
    const questType = profile.totalKills < 10 ? 'kill' : (Math.random() < 0.7 ? 'kill' : 'explore');
    const templates = QUEST_TEMPLATES[questType].templates;

    // Filter to appropriate difficulty
    const suitable = templates.filter(t => {
      if (questType === 'kill') {
        const target = t.target || '';
        const killThreshold =
          target === 'rat' ? 0 :
          target === 'crab' ? 5 :
          target === 'goblin' ? 20 : 50;
        const levelThreshold =
          target === 'rat' ? 1 :
          target === 'crab' ? 3 :
          target === 'goblin' ? 8 : 15;
        return profile.totalKills >= killThreshold || profile.level >= levelThreshold;
      }
      return true;
    });

    const finalTemplates = suitable.length > 0 ? suitable : [templates[0]];
    const template = finalTemplates[Math.floor(Math.random() * finalTemplates.length)];

    // Generate quest dialogue
    const prompt = `You are an NPC in a fantasy RPG giving a quest.
QUEST TYPE: ${questType}
TARGET: ${template.target || template.area}
COUNT: ${template.count || 1}
REWARD: ${template.reward}

Write a SHORT quest description (under 100 chars). Sound urgent but friendly:`;

    let description: string;
    try {
      description = await this.client.call(prompt) ||
        `Defeat ${template.count || 1} ${template.target || template.area}!`;
    } catch (err) {
      log.debug({ err }, 'Quest description generation failed');
      description = `Defeat ${template.count || 1} ${template.target || template.area}!`;
    }

    const quest: Quest = {
      type: questType as 'kill' | 'explore',
      target: template.target || template.area || '',
      count: template.count || 1,
      progress: 0,
      reward: template.reward,
      xp: template.xp,
      description,
      giver: npcType,
      startTime: Date.now()
    };

    this.activeQuests.set(playerId, quest);
    return quest;
  }

  /**
   * Check and update quest progress
   * @returns QuestResult if quest completed, null otherwise
   */
  checkQuestProgress(playerId: string, type: string, target: string): QuestResult | null {
    const quest = this.activeQuests.get(playerId);
    if (!quest || quest.type !== type) return null;

    if (type === 'kill' && target.toLowerCase() === quest.target.toLowerCase()) {
      quest.progress++;
      if (quest.progress >= quest.count) {
        return this.completeQuest(playerId);
      }
    } else if (type === 'explore' && target.toLowerCase() === quest.target.toLowerCase()) {
      quest.progress = 1;
      return this.completeQuest(playerId);
    }

    return null;
  }

  /**
   * Complete a quest and return rewards
   */
  private completeQuest(playerId: string): QuestResult | null {
    const quest = this.activeQuests.get(playerId);
    if (!quest) return null;

    this.profiles.incrementQuestsCompleted(playerId);

    const result: QuestResult = {
      completed: true,
      reward: quest.reward,
      xp: quest.xp,
      description: quest.description
    };

    this.activeQuests.delete(playerId);
    return result;
  }

  /**
   * Get current quest status
   */
  getQuestStatus(playerId: string): Quest | null {
    return this.activeQuests.get(playerId) || null;
  }

  /**
   * Check if player has an active quest
   */
  hasActiveQuest(playerId: string): boolean {
    return this.activeQuests.has(playerId);
  }

  /**
   * Abandon current quest
   */
  abandonQuest(playerId: string): boolean {
    return this.activeQuests.delete(playerId);
  }

  /**
   * Cleanup player quest data
   */
  cleanup(playerId: string): void {
    this.activeQuests.delete(playerId);
  }
}
