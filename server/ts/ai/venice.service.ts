/**
 * Venice AI Service for BrowserQuest
 * Uses @venice-ai/node SDK for AI-powered NPC dialogue, quests, and more
 */

import { VeniceAI } from '@venice-dev-tools/core';
import {
  PlayerProfile,
  ConversationExchange,
  Quest,
  QuestResult
} from './types';
import {
  NPC_PERSONALITIES,
  COMPANION_TRIGGERS,
  QUEST_TEMPLATES,
  ITEM_CONTEXTS
} from './npc-personalities';

export class VeniceService {
  private venice: VeniceAI;
  private model: string;
  private timeout: number;

  // Memory storage: { playerId: { npcType: [messages...] } }
  private conversationMemory: Map<string, Map<string, ConversationExchange[]>> = new Map();

  // Player profiles: { playerId: profile }
  private playerProfiles: Map<string, PlayerProfile> = new Map();

  // Active quests: { playerId: quest }
  private activeQuests: Map<string, Quest> = new Map();

  // Item lore cache: { itemType: lore }
  private itemLoreCache: Map<string, string> = new Map();

  constructor(apiKey: string, options?: { model?: string; timeout?: number }) {
    this.venice = new VeniceAI({ apiKey });
    this.model = options?.model || 'llama-3.3-70b';
    this.timeout = options?.timeout || 5000;
  }

  // ============================================================================
  // CONVERSATION MEMORY
  // ============================================================================

  private getMemory(playerId: string, npcType: string): ConversationExchange[] {
    if (!this.conversationMemory.has(playerId)) {
      this.conversationMemory.set(playerId, new Map());
    }
    const playerMemory = this.conversationMemory.get(playerId)!;
    if (!playerMemory.has(npcType)) {
      playerMemory.set(npcType, []);
    }
    return playerMemory.get(npcType)!;
  }

  private addMemory(playerId: string, npcType: string, exchange: ConversationExchange): void {
    const memory = this.getMemory(playerId, npcType);
    memory.push(exchange);
    // Keep last 5 exchanges
    if (memory.length > 5) {
      memory.shift();
    }
  }

  // ============================================================================
  // PLAYER PROFILES
  // ============================================================================

  getProfile(playerId: string): PlayerProfile {
    if (!this.playerProfiles.has(playerId)) {
      this.playerProfiles.set(playerId, {
        kills: {},
        totalKills: 0,
        areas: [],
        items: [],
        deaths: 0,
        lastActive: Date.now(),
        questsCompleted: 0
      });
    }
    return this.playerProfiles.get(playerId)!;
  }

  recordKill(playerId: string, mobType: string): QuestResult | null {
    const profile = this.getProfile(playerId);
    profile.kills[mobType] = (profile.kills[mobType] || 0) + 1;
    profile.totalKills++;
    profile.lastActive = Date.now();

    // Check quest progress
    return this.checkQuestProgress(playerId, 'kill', mobType);
  }

  recordArea(playerId: string, area: string): QuestResult | null {
    const profile = this.getProfile(playerId);
    if (!profile.areas.includes(area)) {
      profile.areas.push(area);
      return this.checkQuestProgress(playerId, 'explore', area);
    }
    profile.lastActive = Date.now();
    return null;
  }

  recordItem(playerId: string, itemType: string): void {
    const profile = this.getProfile(playerId);
    profile.items.push(itemType);
    profile.lastActive = Date.now();
  }

  recordDeath(playerId: string): void {
    const profile = this.getProfile(playerId);
    profile.deaths++;
  }

  // ============================================================================
  // NPC DIALOGUE WITH MEMORY
  // ============================================================================

  async generateNpcDialogue(
    npcType: string,
    playerName: string,
    playerId: string
  ): Promise<string> {
    const personality = NPC_PERSONALITIES[npcType.toLowerCase()];
    const profile = this.getProfile(playerId);
    const memory = this.getMemory(playerId, npcType);

    if (!personality) {
      return "...";
    }

    // Special case for nyan
    if (npcType.toLowerCase() === 'nyan') {
      const nyans = ["nyan nyan nyan!", "nyan nyan nyan nyan nyan", "nyan? nyan nyan!"];
      return nyans[Math.floor(Math.random() * nyans.length)];
    }

    // Build context from memory and profile
    const context = this.buildContext(profile, memory);

    const prompt = `You are ${personality.name} in a fantasy RPG.

PERSONALITY: ${personality.personality}
SPEECH STYLE: ${personality.speechStyle}

${context}
RULES:
- Keep response under 80 characters
- Stay in character
- Reference past conversations if relevant
- Acknowledge player achievements naturally

The player "${playerName}" approaches. Respond in character:`;

    try {
      const response = await this.callVenice(prompt);
      if (response) {
        this.addMemory(playerId, npcType, {
          time: Date.now(),
          response
        });
      }
      return response || personality.greeting;
    } catch (error) {
      console.error('Venice NPC dialogue error:', error);
      return personality.greeting;
    }
  }

  private buildContext(profile: PlayerProfile, memory: ConversationExchange[]): string {
    let context = '';

    // Add player achievements
    if (profile.totalKills > 0) {
      context += `PLAYER STATUS: Slain ${profile.totalKills} monsters. `;
      if (profile.kills['boss']) context += 'Defeated the boss! ';
      if ((profile.kills['skeleton'] || 0) > 10) context += 'Skeleton slayer. ';
      if (profile.deaths > 3) context += `Has died ${profile.deaths} times. `;
      context += '\n';
    }

    // Add areas explored
    if (profile.areas.length > 0) {
      context += `EXPLORED: ${profile.areas.join(', ')}\n`;
    }

    // Add conversation history
    if (memory.length > 0) {
      context += `PAST MEETINGS: You've spoken ${memory.length} times before. `;
      const lastMeeting = memory[memory.length - 1];
      context += `Last you said: "${lastMeeting.response.substring(0, 40)}..."\n`;
    }

    return context;
  }

  // ============================================================================
  // AI COMPANION
  // ============================================================================

  async getCompanionHint(
    playerId: string,
    trigger: string,
    data?: { percent?: number; area?: string; time?: number; mobType?: string; killer?: string }
  ): Promise<string | null> {
    const profile = this.getProfile(playerId);
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
      const response = await this.callVenice(prompt);
      return response || staticHints[0];
    } catch (error) {
      return staticHints[0];
    }
  }

  private describeSituation(
    trigger: string,
    data?: { percent?: number; area?: string; time?: number; mobType?: string; killer?: string },
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

  // ============================================================================
  // QUEST GENERATION
  // ============================================================================

  async generateQuest(playerId: string, npcType: string): Promise<Quest> {
    const profile = this.getProfile(playerId);

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
        const required =
          target === 'rat' ? 0 :
          target === 'crab' ? 5 :
          target === 'goblin' ? 20 : 50;
        return profile.totalKills >= required;
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
      description = await this.callVenice(prompt) ||
        `Defeat ${template.count || 1} ${template.target || template.area}!`;
    } catch {
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

  private completeQuest(playerId: string): QuestResult | null {
    const quest = this.activeQuests.get(playerId);
    if (!quest) return null;

    const profile = this.getProfile(playerId);
    profile.questsCompleted++;

    const result: QuestResult = {
      completed: true,
      reward: quest.reward,
      xp: quest.xp,
      description: quest.description
    };

    this.activeQuests.delete(playerId);
    return result;
  }

  getQuestStatus(playerId: string): Quest | null {
    return this.activeQuests.get(playerId) || null;
  }

  // ============================================================================
  // ITEM LORE GENERATION
  // ============================================================================

  async generateItemLore(itemType: string): Promise<string> {
    // Check cache first
    const cached = this.itemLoreCache.get(itemType);
    if (cached) {
      return cached;
    }

    const context = ITEM_CONTEXTS[itemType.toLowerCase()];
    if (!context) {
      return "A mysterious item of unknown origin.";
    }

    const prompt = `You are a fantasy RPG lore master.

ITEM TYPE: ${context.type}
ERA: ${context.era}
ORIGIN: ${context.origin}

Write a SHORT mystical description of this ${itemType} (under 80 chars).
Make it sound legendary and interesting:`;

    try {
      const lore = await this.callVenice(prompt) || `An item of ${context.era} origin.`;
      this.itemLoreCache.set(itemType, lore);
      return lore;
    } catch {
      const fallback = `An item of ${context.era} origin.`;
      this.itemLoreCache.set(itemType, fallback);
      return fallback;
    }
  }

  // ============================================================================
  // CORE VENICE API CALL
  // ============================================================================

  private async callVenice(prompt: string): Promise<string | null> {
    try {
      const response = await this.venice.chat.createCompletion({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.9
      });

      let text = response.choices?.[0]?.message?.content;
      if (text) {
        text = text.trim();
        if (text.startsWith('"') && text.endsWith('"')) {
          text = text.slice(1, -1);
        }
        return text;
      }
      return null;
    } catch (error) {
      console.error('Venice API error:', error);
      return null;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getFallback(npcType: string): string {
    const personality = NPC_PERSONALITIES[npcType.toLowerCase()];
    return personality ? personality.greeting : "...";
  }

  getPersonality(npcType: string) {
    return NPC_PERSONALITIES[npcType.toLowerCase()];
  }

  // Cleanup player data
  cleanupPlayer(playerId: string): void {
    this.conversationMemory.delete(playerId);
    this.playerProfiles.delete(playerId);
    this.activeQuests.delete(playerId);
  }
}

// Singleton instance
let veniceService: VeniceService | null = null;

export function initVeniceService(apiKey: string, options?: { model?: string; timeout?: number }): VeniceService {
  veniceService = new VeniceService(apiKey, options);
  return veniceService;
}

export function getVeniceService(): VeniceService | null {
  return veniceService;
}
