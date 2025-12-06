/**
 * Dialogue Service - NPC conversation management
 * Single Responsibility: Generate and manage NPC dialogue with memory
 */

import { VeniceClient } from './venice-client';
import { ProfileService } from './profile.service';
import { ConversationExchange, PlayerProfile } from './types';
import { NPC_PERSONALITIES } from './npc-personalities';

export class DialogueService {
  private client: VeniceClient;
  private profiles: ProfileService;

  // Conversation memory: { playerId: { npcType: [exchanges...] } }
  private conversationMemory: Map<string, Map<string, ConversationExchange[]>> = new Map();

  constructor(client: VeniceClient, profiles: ProfileService) {
    this.client = client;
    this.profiles = profiles;
  }

  /**
   * Generate NPC dialogue response
   */
  async generateNpcDialogue(
    npcType: string,
    playerName: string,
    playerId: string
  ): Promise<string> {
    const personality = NPC_PERSONALITIES[npcType.toLowerCase()];
    const profile = this.profiles.getProfile(playerId);
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
      const response = await this.client.call(prompt);
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

  /**
   * Get fallback greeting for an NPC type
   */
  getFallback(npcType: string): string {
    const personality = NPC_PERSONALITIES[npcType.toLowerCase()];
    return personality ? personality.greeting : "...";
  }

  /**
   * Get personality data for an NPC type
   */
  getPersonality(npcType: string) {
    return NPC_PERSONALITIES[npcType.toLowerCase()];
  }

  /**
   * Build context string from player profile and conversation history
   */
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

  /**
   * Get conversation memory for a player-NPC pair
   */
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

  /**
   * Add a conversation exchange to memory
   */
  private addMemory(playerId: string, npcType: string, exchange: ConversationExchange): void {
    const memory = this.getMemory(playerId, npcType);
    memory.push(exchange);
    // Keep last 5 exchanges
    if (memory.length > 5) {
      memory.shift();
    }
  }

  /**
   * Cleanup player conversation data
   */
  cleanup(playerId: string): void {
    this.conversationMemory.delete(playerId);
  }
}
