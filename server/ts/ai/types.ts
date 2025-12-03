/**
 * Venice AI Types for BrowserQuest
 */

export interface NpcPersonality {
  name: string;
  personality: string;
  speechStyle: string;
  greeting: string;
}

export interface PlayerProfile {
  kills: Record<string, number>;
  totalKills: number;
  areas: string[];
  items: string[];
  deaths: number;
  lastActive: number;
  questsCompleted: number;
}

export interface ConversationExchange {
  time: number;
  response: string;
}

export interface CompanionTrigger {
  threshold?: number;
  hints: string[];
}

export interface QuestTemplate {
  target?: string;
  area?: string;
  count?: number;
  reward: string;
  xp: number;
}

export interface Quest {
  type: 'kill' | 'explore';
  target: string;
  count: number;
  progress: number;
  reward: string;
  xp: number;
  description: string;
  giver: string;
  startTime: number;
}

export interface QuestResult {
  completed: boolean;
  reward: string;
  xp: number;
  description: string;
}

export interface ItemContext {
  type: string;
  era: string;
  origin: string;
}
