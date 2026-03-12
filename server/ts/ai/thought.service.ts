/**
 * Thought Service - Entity thought bubbles
 * Single Responsibility: Generate thoughts for mobs and NPCs
 *
 * Uses a "thought pool" system to periodically fetch AI-generated thoughts
 * and mix them with static templates for variety.
 */

import { VeniceClient } from './venice-client';
import { MOB_THOUGHTS, NPC_THOUGHTS, fillTemplate } from './npc-personalities';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Thoughts');

export type ThoughtState = 'idle' | 'combat' | 'flee' | 'playerNearby' | 'special';

export interface ThoughtContext {
  targetName?: string;
  healthPercent?: number;
  nearbyPlayerCount?: number;
}

export interface ThoughtResult {
  thought: string;
  state: string;
  isAI?: boolean;
}

export interface EntityThoughtRequest {
  id: number;
  type: string;
  state: ThoughtState;
  context?: ThoughtContext;
}

export interface EntityThoughtResult {
  id: number;
  thought: string;
  state: string;
}

// AI-generated thoughts are cached per entity type
interface AIThoughtPool {
  thoughts: string[];
  lastRefresh: number;
}

export class ThoughtService {
  private client: VeniceClient;
  private aiThoughtPools: Map<string, AIThoughtPool> = new Map();
  private refreshInterval = 5 * 60 * 1000; // Refresh AI thoughts every 5 minutes
  private poolSize = 10; // Number of AI thoughts per entity type
  private aiChance = 0.25; // 25% chance to use AI thought
  private isRefreshing = false;

  constructor(client: VeniceClient) {
    this.client = client;
    // Start background refresh after a short delay
    setTimeout(() => this.startBackgroundRefresh(), 10000);
  }

  /**
   * Start background task to refresh AI thought pools
   */
  private startBackgroundRefresh(): void {
    // Initial population
    this.refreshAllPools();

    // Periodic refresh
    setInterval(() => this.refreshAllPools(), this.refreshInterval);
  }

  /**
   * Refresh AI thoughts for all known entity types
   */
  private async refreshAllPools(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    // Get all entity types that have thoughts defined
    const mobTypes = Object.keys(MOB_THOUGHTS);
    const npcTypes = Object.keys(NPC_THOUGHTS);

    // Only refresh a subset each cycle to avoid API spam
    const typesToRefresh = [...mobTypes, ...npcTypes]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    log.info({ entityTypes: typesToRefresh }, 'Refreshing AI pool');

    for (const entityType of typesToRefresh) {
      try {
        await this.refreshPoolForType(entityType);
      } catch (err) {
        // Silently fail - fallback thoughts will be used
      }
    }

    this.isRefreshing = false;
  }

  /**
   * Generate fresh AI thoughts for a specific entity type
   */
  private async refreshPoolForType(entityType: string): Promise<void> {
    const thoughts = MOB_THOUGHTS[entityType] || NPC_THOUGHTS[entityType];
    if (!thoughts) return;

    // Get example thoughts for context
    const examples = [
      ...(thoughts.idle || []),
      ...(thoughts.playerNearby || []),
      ...(thoughts.special || [])
    ].slice(0, 5).join('" or "');

    const prompt = `You are writing thought bubbles for a ${entityType} in a fantasy RPG called Fracture.
The world was shattered by "The Breaking" - reality fractured. Generate 5 SHORT thought bubbles (under 40 chars each).
Be funny, weird, dramatic, or philosophical. Mix humor with darkness.

Examples of thoughts for ${entityType}: "${examples}"

Output exactly 5 thoughts, one per line. No numbering or punctuation at start:`;

    try {
      const response = await this.client.call(prompt);
      if (response) {
        const newThoughts = response
          .split('\n')
          .map(t => t.trim())
          .filter(t => t.length > 0 && t.length < 50)
          .slice(0, this.poolSize);

        if (newThoughts.length > 0) {
          this.aiThoughtPools.set(entityType, {
            thoughts: newThoughts,
            lastRefresh: Date.now()
          });
          log.info({ entityType, count: newThoughts.length }, 'AI pool refreshed');
        }
      }
    } catch {
      // Silently fail - use fallback
    }
  }

  /**
   * Get an AI thought from the pool if available
   */
  private getAIThought(entityType: string): string | null {
    const pool = this.aiThoughtPools.get(entityType.toLowerCase());
    if (!pool || pool.thoughts.length === 0) return null;

    // Pick random thought from pool
    return pool.thoughts[Math.floor(Math.random() * pool.thoughts.length)];
  }

  /**
   * Get a thought for an entity based on its current state
   * Uses predefined templates 80% of the time, AI generation 20%
   */
  getEntityThought(
    entityType: string,
    state: ThoughtState,
    context?: ThoughtContext
  ): ThoughtResult {
    const mobThoughts = MOB_THOUGHTS[entityType.toLowerCase()];
    const npcThoughts = NPC_THOUGHTS[entityType.toLowerCase()];
    const thoughts = mobThoughts || npcThoughts;

    if (!thoughts) {
      // Fallback for unknown entity types
      return { thought: '...', state: 'idle' };
    }

    // Determine actual state based on context
    let effectiveState: string = state;
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

    // 25% chance to use AI-generated thought from pool
    if (Math.random() < this.aiChance) {
      const aiThought = this.getAIThought(entityType);
      if (aiThought) {
        return { thought: aiThought, state: effectiveState, isAI: true };
      }
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
    const baseThought = this.getEntityThought(entityType, state as ThoughtState);

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
      const response = await this.client.call(prompt);
      return response || baseThought.thought;
    } catch {
      return baseThought.thought;
    }
  }

  /**
   * Get multiple thoughts for a batch of entities (efficient for world updates)
   */
  getBatchThoughts(entities: EntityThoughtRequest[]): EntityThoughtResult[] {
    return entities.map(entity => {
      const result = this.getEntityThought(entity.type, entity.state, entity.context);
      return {
        id: entity.id,
        thought: result.thought,
        state: result.state
      };
    });
  }

  /**
   * Check if entity type has thoughts defined
   */
  hasThoughts(entityType: string): boolean {
    return !!(MOB_THOUGHTS[entityType.toLowerCase()] || NPC_THOUGHTS[entityType.toLowerCase()]);
  }
}
