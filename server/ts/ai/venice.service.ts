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
  ITEM_CONTEXTS,
  MOB_THOUGHTS,
  NPC_THOUGHTS,
  fillTemplate
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

  // World events for Town Crier feature
  private worldEvents: Array<{
    type: string;
    timestamp: number;
    playerName?: string;
    details: Record<string, any>;
  }> = [];

  // Cached newspaper (regenerated periodically)
  private cachedNewspaper: { headlines: string[]; generatedAt: number } | null = null;

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
      const response = await this.venice.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.9,
        stream: false
      });

      const content = (response as any).choices?.[0]?.message?.content;
      if (content) {
        // Handle both string and ContentItem[] response types
        let text: string;
        if (typeof content === 'string') {
          text = content;
        } else if (Array.isArray(content)) {
          // Extract text from ContentItem array
          text = content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('');
        } else {
          return null;
        }

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
  // AI NARRATOR - Dynamic commentary on player actions
  // ============================================================================

  async generateNarration(
    event: string,
    playerName: string,
    playerId: string,
    details?: Record<string, any>
  ): Promise<{ text: string; style: string } | null> {
    const profile = this.getProfile(playerId);

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
      const text = await this.callVenice(prompt);
      if (!text) return null;

      // Determine style based on event
      const style = this.getNarratorStyle(event);

      return { text, style };
    } catch (error) {
      console.error('Venice narrator error:', error);
      return null;
    }
  }

  private buildNarratorContext(
    event: string,
    playerName: string,
    profile: PlayerProfile,
    details?: Record<string, any>
  ): string {
    // Helper for random variety in context
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

  private getNarratorStyle(event: string): string {
    const ominousEvents = ['death', 'lowHealth', 'bossNear'];
    const epicEvents = ['bossKill', 'rareItem', 'killMilestone', 'comeback'];
    const humorEvents = ['idle', 'firstKill'];

    if (ominousEvents.includes(event)) return 'ominous';
    if (epicEvents.includes(event)) return 'epic';
    if (humorEvents.includes(event)) return 'humor';
    return 'info';
  }

  // Get static fallback narration for when AI is slow/unavailable
  getStaticNarration(event: string, playerName: string, details?: Record<string, any>): { text: string; style: string } {
    const fallbacks: Record<string, { text: string; style: string }[]> = {
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

    const options = fallbacks[event] || [{ text: `${playerName} does something noteworthy.`, style: 'info' }];
    return options[Math.floor(Math.random() * options.length)];
  }

  // ============================================================================
  // ENTITY THOUGHT BUBBLES - The "Ant Farm" Feature
  // ============================================================================

  /**
   * Get a thought for an entity based on its current state
   * Uses predefined templates 80% of the time, AI generation 20%
   */
  getEntityThought(
    entityType: string,
    state: 'idle' | 'combat' | 'flee' | 'playerNearby' | 'special',
    context?: {
      targetName?: string;
      healthPercent?: number;
      nearbyPlayerCount?: number;
    }
  ): { thought: string; state: string } {
    const mobThoughts = MOB_THOUGHTS[entityType.toLowerCase()];
    const npcThoughts = NPC_THOUGHTS[entityType.toLowerCase()];
    const thoughts = mobThoughts || npcThoughts;

    if (!thoughts) {
      // Fallback for unknown entity types
      return { thought: '...', state: 'idle' };
    }

    // Determine actual state based on context
    let effectiveState = state;
    if (context?.healthPercent && context.healthPercent < 30 && state === 'combat') {
      effectiveState = 'flee';
    }

    // 10% chance of special thought
    if (thoughts.special && Math.random() < 0.1) {
      effectiveState = 'special';
    }

    // Get thought array for this state
    const thoughtArray = thoughts[effectiveState] || thoughts.idle;
    if (!thoughtArray || thoughtArray.length === 0) {
      return { thought: '...', state: effectiveState };
    }

    // Pick random thought from array and fill in mad-libs templates
    const rawThought = thoughtArray[Math.floor(Math.random() * thoughtArray.length)];
    const thought = fillTemplate(rawThought);

    return { thought, state: effectiveState };
  }

  /**
   * Generate an AI-enhanced thought (used sparingly for special moments)
   */
  async generateAIThought(
    entityType: string,
    state: string,
    context?: {
      targetName?: string;
      nearbyPlayers?: string[];
      worldEvent?: string;
    }
  ): Promise<string | null> {
    const baseThought = this.getEntityThought(entityType, state as any);

    // Only 20% of thoughts get AI enhancement
    if (Math.random() > 0.2) {
      return baseThought.thought;
    }

    const prompt = `You are a ${entityType} in a fantasy RPG. Your current mood is: ${state}.
${context?.targetName ? `You see a player named ${context.targetName}.` : ''}
${context?.worldEvent ? `World event: ${context.worldEvent}` : ''}

Write a SHORT thought bubble (under 40 chars). Be funny, dramatic, or weird.
Examples for ${entityType}: "${baseThought.thought}"

Your thought:`;

    try {
      const response = await this.callVenice(prompt);
      return response || baseThought.thought;
    } catch {
      return baseThought.thought;
    }
  }

  /**
   * Get multiple thoughts for a batch of entities (efficient for world updates)
   */
  getBatchThoughts(
    entities: Array<{
      id: number;
      type: string;
      state: 'idle' | 'combat' | 'flee' | 'playerNearby';
      context?: any;
    }>
  ): Array<{ id: number; thought: string; state: string }> {
    return entities.map(entity => {
      const result = this.getEntityThought(entity.type, entity.state, entity.context);
      return {
        id: entity.id,
        thought: result.thought,
        state: result.state
      };
    });
  }

  // ============================================================================
  // TOWN CRIER - World News Generation
  // ============================================================================

  /**
   * Record a world event for the Town Crier
   */
  recordWorldEvent(
    type: string,
    playerName?: string,
    details: Record<string, any> = {}
  ): void {
    this.worldEvents.push({
      type,
      timestamp: Date.now(),
      playerName,
      details
    });

    // Keep only last 100 events
    if (this.worldEvents.length > 100) {
      this.worldEvents = this.worldEvents.slice(-100);
    }

    // Invalidate cached newspaper if we have significant new events
    if (this.worldEvents.length % 10 === 0) {
      this.cachedNewspaper = null;
    }
  }

  /**
   * Get aggregated stats from world events
   */
  private getWorldStats(): {
    totalKills: number;
    totalDeaths: number;
    topKiller: { name: string; kills: number } | null;
    mostDied: { name: string; deaths: number } | null;
    recentJoins: string[];
    bossKills: Array<{ player: string; boss: string }>;
    mobKillCounts: Record<string, number>;
  } {
    const stats = {
      totalKills: 0,
      totalDeaths: 0,
      topKiller: null as { name: string; kills: number } | null,
      mostDied: null as { name: string; deaths: number } | null,
      recentJoins: [] as string[],
      bossKills: [] as Array<{ player: string; boss: string }>,
      mobKillCounts: {} as Record<string, number>
    };

    const playerKills: Record<string, number> = {};
    const playerDeaths: Record<string, number> = {};

    for (const event of this.worldEvents) {
      switch (event.type) {
        case 'kill':
          stats.totalKills++;
          if (event.playerName) {
            playerKills[event.playerName] = (playerKills[event.playerName] || 0) + 1;
          }
          if (event.details.mobType) {
            stats.mobKillCounts[event.details.mobType] =
              (stats.mobKillCounts[event.details.mobType] || 0) + 1;
          }
          break;
        case 'bossKill':
          stats.bossKills.push({
            player: event.playerName || 'Unknown',
            boss: event.details.bossType || 'boss'
          });
          break;
        case 'death':
          stats.totalDeaths++;
          if (event.playerName) {
            playerDeaths[event.playerName] = (playerDeaths[event.playerName] || 0) + 1;
          }
          break;
        case 'join':
          if (event.playerName) {
            stats.recentJoins.push(event.playerName);
          }
          break;
      }
    }

    // Find top killer
    let maxKills = 0;
    for (const [name, kills] of Object.entries(playerKills)) {
      if (kills > maxKills) {
        maxKills = kills;
        stats.topKiller = { name, kills };
      }
    }

    // Find most deaths
    let maxDeaths = 0;
    for (const [name, deaths] of Object.entries(playerDeaths)) {
      if (deaths > maxDeaths) {
        maxDeaths = deaths;
        stats.mostDied = { name, deaths };
      }
    }

    return stats;
  }

  /**
   * Generate or return cached newspaper headlines
   */
  async generateNewspaper(): Promise<{ headlines: string[]; generatedAt: number }> {
    // Return cached if less than 5 minutes old
    if (this.cachedNewspaper && Date.now() - this.cachedNewspaper.generatedAt < 5 * 60 * 1000) {
      return this.cachedNewspaper;
    }

    const stats = this.getWorldStats();
    const headlines: string[] = [];

    // Generate AI headline for most interesting stat
    const prompt = this.buildNewsPrompt(stats);

    try {
      const aiHeadline = await this.callVenice(prompt);
      if (aiHeadline) {
        headlines.push(aiHeadline);
      }
    } catch (error) {
      console.error('Venice newspaper error:', error);
    }

    // Add stat-based headlines
    if (stats.topKiller) {
      headlines.push(`🗡️ ${stats.topKiller.name} leads the kill count with ${stats.topKiller.kills} slain!`);
    }

    if (stats.mostDied && stats.mostDied.deaths >= 3) {
      headlines.push(`💀 ${stats.mostDied.name} has died ${stats.mostDied.deaths} times. Thoughts and prayers.`);
    }

    if (stats.bossKills.length > 0) {
      const latest = stats.bossKills[stats.bossKills.length - 1];
      headlines.push(`👑 BOSS SLAIN! ${latest.player} defeated the mighty ${latest.boss}!`);
    }

    if (stats.totalKills > 0) {
      headlines.push(`📊 Total monsters slain today: ${stats.totalKills}`);
    }

    // Most hunted mob
    const sortedMobs = Object.entries(stats.mobKillCounts).sort((a, b) => b[1] - a[1]);
    if (sortedMobs.length > 0) {
      const [mobType, count] = sortedMobs[0];
      headlines.push(`🐀 ${mobType}s are having a bad day: ${count} killed`);
    }

    // Recent visitors
    if (stats.recentJoins.length > 0) {
      const uniqueJoins = [...new Set(stats.recentJoins)].slice(-3);
      headlines.push(`👋 Recent visitors: ${uniqueJoins.join(', ')}`);
    }

    // Fallback if no events
    if (headlines.length === 0) {
      headlines.push('📰 The realm is quiet... too quiet.');
      headlines.push('🏰 No news from the frontier today.');
    }

    this.cachedNewspaper = {
      headlines: headlines.slice(0, 6), // Max 6 headlines
      generatedAt: Date.now()
    };

    return this.cachedNewspaper;
  }

  private buildNewsPrompt(stats: {
    totalKills: number;
    totalDeaths: number;
    topKiller: { name: string; kills: number } | null;
    mostDied: { name: string; deaths: number } | null;
    bossKills: Array<{ player: string; boss: string }>;
  }): string {
    let context = 'WORLD NEWS SUMMARY:\n';

    if (stats.topKiller) {
      context += `- Top warrior: ${stats.topKiller.name} with ${stats.topKiller.kills} kills\n`;
    }
    if (stats.mostDied) {
      context += `- Most unfortunate: ${stats.mostDied.name} died ${stats.mostDied.deaths} times\n`;
    }
    if (stats.bossKills.length > 0) {
      context += `- Boss defeats: ${stats.bossKills.map(b => `${b.player} vs ${b.boss}`).join(', ')}\n`;
    }
    context += `- Total kills: ${stats.totalKills}, Total deaths: ${stats.totalDeaths}\n`;

    return `You are a medieval town crier writing headlines for a fantasy RPG newspaper.

${context}

Write ONE witty, dramatic headline (under 80 chars) about the most interesting event.
Be creative - use puns, alliteration, or dramatic flair. Examples:
- "Rat Apocalypse! Heroes Decimate Rodent Population"
- "Death Becomes Him: Player Sets New Record for Respawns"
- "Boss Battle Bonanza: Dragon Falls to Unlikely Hero"

Your headline:`;
  }

  /**
   * Get quick stats without AI generation
   */
  getQuickStats(): {
    totalKills: number;
    totalDeaths: number;
    activeEvents: number;
  } {
    const stats = this.getWorldStats();
    return {
      totalKills: stats.totalKills,
      totalDeaths: stats.totalDeaths,
      activeEvents: this.worldEvents.length
    };
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
