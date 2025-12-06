/**
 * Thought Service - Entity thought bubbles
 * Single Responsibility: Generate thoughts for mobs and NPCs
 */

import { VeniceClient } from './venice-client';
import { MOB_THOUGHTS, NPC_THOUGHTS, fillTemplate } from './npc-personalities';

export type ThoughtState = 'idle' | 'combat' | 'flee' | 'playerNearby' | 'special';

export interface ThoughtContext {
  targetName?: string;
  healthPercent?: number;
  nearbyPlayerCount?: number;
}

export interface ThoughtResult {
  thought: string;
  state: string;
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

export class ThoughtService {
  private client: VeniceClient;

  constructor(client: VeniceClient) {
    this.client = client;
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
