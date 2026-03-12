/**
 * Venice AI Service - Facade for all AI services
 *
 * This class maintains backward compatibility by delegating to specialized services.
 * It's the only class that external code needs to interact with.
 *
 * SRP Refactoring: This file now delegates to:
 * - VeniceClient: API communication
 * - ProfileService: Player progress tracking
 * - DialogueService: NPC conversations
 * - QuestService: Quest generation and tracking
 * - CompanionService: AI companion hints
 * - NarratorService: Event narration
 * - ThoughtService: Entity thoughts
 * - NewsService: Town Crier / world news
 */

import { VeniceClient } from './venice-client';
import { ProfileService } from './profile.service';
import { DialogueService } from './dialogue.service';
import { QuestService } from './quest.service';
import { CompanionService, CompanionData } from './companion.service';
import { NarratorService, NarrationResult } from './narrator.service';
import { ThoughtService, ThoughtState, ThoughtContext, EntityThoughtRequest, EntityThoughtResult } from './thought.service';
import { NewsService, NewspaperResult, QuickStats } from './news.service';
import { PlayerProfile, Quest, QuestResult } from './types';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('VeniceService');

export class VeniceService {
  // Sub-services
  private client: VeniceClient;
  private profileService: ProfileService;
  private dialogueService: DialogueService;
  private questService: QuestService;
  private companionService: CompanionService;
  private narratorService: NarratorService;
  private thoughtService: ThoughtService;
  private newsService: NewsService;

  constructor(apiKey: string, options?: { model?: string; timeout?: number }) {
    // Initialize all services
    this.client = new VeniceClient(apiKey, options);
    this.profileService = new ProfileService();
    this.dialogueService = new DialogueService(this.client, this.profileService);
    this.questService = new QuestService(this.client, this.profileService);
    this.companionService = new CompanionService(this.client, this.profileService);
    this.narratorService = new NarratorService(this.client, this.profileService);
    this.thoughtService = new ThoughtService(this.client);
    this.newsService = new NewsService(this.client);
  }

  // ============================================================================
  // PROFILE SERVICE DELEGATES
  // ============================================================================

  getProfile(playerId: string): PlayerProfile {
    return this.profileService.getProfile(playerId);
  }

  recordKill(playerId: string, mobType: string): QuestResult | null {
    const { isMilestone } = this.profileService.recordKill(playerId, mobType);
    // Check quest progress
    return this.questService.checkQuestProgress(playerId, 'kill', mobType);
  }

  recordArea(playerId: string, area: string): QuestResult | null {
    const isNew = this.profileService.recordArea(playerId, area);
    if (isNew) {
      return this.questService.checkQuestProgress(playerId, 'explore', area);
    }
    return null;
  }

  recordItem(playerId: string, itemType: string): void {
    this.profileService.recordItem(playerId, itemType);
  }

  recordDeath(playerId: string): void {
    this.profileService.recordDeath(playerId);
  }

  // ============================================================================
  // DIALOGUE SERVICE DELEGATES
  // ============================================================================

  async generateNpcDialogue(
    npcType: string,
    playerName: string,
    playerId: string
  ): Promise<string> {
    return this.dialogueService.generateNpcDialogue(npcType, playerName, playerId);
  }

  getFallback(npcType: string): string {
    return this.dialogueService.getFallback(npcType);
  }

  getPersonality(npcType: string) {
    return this.dialogueService.getPersonality(npcType);
  }

  // ============================================================================
  // QUEST SERVICE DELEGATES
  // ============================================================================

  async generateQuest(playerId: string, npcType: string): Promise<Quest> {
    return this.questService.generateQuest(playerId, npcType);
  }

  checkQuestProgress(playerId: string, type: string, target: string): QuestResult | null {
    return this.questService.checkQuestProgress(playerId, type, target);
  }

  getQuestStatus(playerId: string): Quest | null {
    return this.questService.getQuestStatus(playerId);
  }

  // ============================================================================
  // COMPANION SERVICE DELEGATES
  // ============================================================================

  async getCompanionHint(
    playerId: string,
    trigger: string,
    data?: CompanionData
  ): Promise<string | null> {
    return this.companionService.getCompanionHint(playerId, trigger, data);
  }

  // ============================================================================
  // NARRATOR SERVICE DELEGATES
  // ============================================================================

  async generateNarration(
    event: string,
    playerName: string,
    playerId: string,
    details?: Record<string, any>
  ): Promise<NarrationResult | null> {
    return this.narratorService.generateNarration(event, playerName, playerId, details);
  }

  getStaticNarration(
    event: string,
    playerName: string,
    details?: Record<string, any>
  ): NarrationResult {
    return this.narratorService.getStaticNarration(event, playerName, details);
  }

  // ============================================================================
  // THOUGHT SERVICE DELEGATES
  // ============================================================================

  getEntityThought(
    entityType: string,
    state: ThoughtState,
    context?: ThoughtContext
  ): { thought: string; state: string } {
    return this.thoughtService.getEntityThought(entityType, state, context);
  }

  async generateAIThought(
    entityType: string,
    state: string,
    context?: {
      targetName?: string;
      nearbyPlayers?: string[];
      worldEvent?: string;
    }
  ): Promise<string | null> {
    return this.thoughtService.generateAIThought(entityType, state, context);
  }

  getBatchThoughts(entities: EntityThoughtRequest[]): EntityThoughtResult[] {
    return this.thoughtService.getBatchThoughts(entities);
  }

  // ============================================================================
  // NEWS SERVICE DELEGATES
  // ============================================================================

  recordWorldEvent(
    type: string,
    playerName?: string,
    details?: Record<string, any>
  ): void {
    this.newsService.recordWorldEvent(type, playerName, details);
  }

  async generateNewspaper(): Promise<NewspaperResult> {
    return this.newsService.generateNewspaper();
  }

  getQuickStats(): QuickStats {
    return this.newsService.getQuickStats();
  }

  // ============================================================================
  // ITEM LORE (kept inline as it's simple caching)
  // ============================================================================

  private itemLoreCache: Map<string, string> = new Map();

  async generateItemLore(itemType: string): Promise<string> {
    // Check cache first
    const cached = this.itemLoreCache.get(itemType);
    if (cached) {
      return cached;
    }

    const { ITEM_CONTEXTS } = await import('./npc-personalities.js');
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
      const lore = await this.client.call(prompt) || `An item of ${context.era} origin.`;
      this.itemLoreCache.set(itemType, lore);
      return lore;
    } catch (err) {
      log.debug({ err }, 'Item lore generation failed');
      const fallback = `An item of ${context.era} origin.`;
      this.itemLoreCache.set(itemType, fallback);
      return fallback;
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanupPlayer(playerId: string): void {
    this.profileService.cleanup(playerId);
    this.dialogueService.cleanup(playerId);
    this.questService.cleanup(playerId);
  }

  // ============================================================================
  // SERVICE ACCESS (for advanced usage)
  // ============================================================================

  getServices() {
    return {
      client: this.client,
      profiles: this.profileService,
      dialogue: this.dialogueService,
      quests: this.questService,
      companion: this.companionService,
      narrator: this.narratorService,
      thoughts: this.thoughtService,
      news: this.newsService
    };
  }
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

let veniceService: VeniceService | null = null;

export function initVeniceService(
  apiKey: string,
  options?: { model?: string; timeout?: number }
): VeniceService {
  veniceService = new VeniceService(apiKey, options);
  return veniceService;
}

export function getVeniceService(): VeniceService | null {
  return veniceService;
}

export function getVeniceClient(): VeniceClient | null {
  return veniceService?.getServices().client || null;
}

// Re-export types for convenience
export { NarrationResult } from './narrator.service';
export { NewspaperResult, QuickStats } from './news.service';
export { ThoughtState, ThoughtContext, EntityThoughtRequest, EntityThoughtResult } from './thought.service';
export { CompanionData } from './companion.service';
