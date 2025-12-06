/**
 * News Service - Town Crier / World news generation
 * Single Responsibility: Track world events and generate newspaper headlines
 */

import { VeniceClient } from './venice-client';

export interface WorldEvent {
  type: string;
  timestamp: number;
  playerName?: string;
  details: Record<string, any>;
}

export interface WorldStats {
  totalKills: number;
  totalDeaths: number;
  topKiller: { name: string; kills: number } | null;
  mostDied: { name: string; deaths: number } | null;
  recentJoins: string[];
  bossKills: Array<{ player: string; boss: string }>;
  mobKillCounts: Record<string, number>;
}

export interface NewspaperResult {
  headlines: string[];
  generatedAt: number;
}

export interface QuickStats {
  totalKills: number;
  totalDeaths: number;
  activeEvents: number;
}

export class NewsService {
  private client: VeniceClient;

  // World events for Town Crier feature
  private worldEvents: WorldEvent[] = [];

  // Cached newspaper (regenerated periodically)
  private cachedNewspaper: NewspaperResult | null = null;

  constructor(client: VeniceClient) {
    this.client = client;
  }

  /**
   * Record a world event
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
   * Generate or return cached newspaper headlines
   */
  async generateNewspaper(): Promise<NewspaperResult> {
    // Return cached if less than 5 minutes old
    if (this.cachedNewspaper && Date.now() - this.cachedNewspaper.generatedAt < 5 * 60 * 1000) {
      return this.cachedNewspaper;
    }

    const stats = this.getWorldStats();
    const headlines: string[] = [];

    // Generate AI headline for most interesting stat
    const prompt = this.buildNewsPrompt(stats);

    try {
      const aiHeadline = await this.client.call(prompt);
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

  /**
   * Get aggregated stats from world events
   */
  getWorldStats(): WorldStats {
    const stats: WorldStats = {
      totalKills: 0,
      totalDeaths: 0,
      topKiller: null,
      mostDied: null,
      recentJoins: [],
      bossKills: [],
      mobKillCounts: {}
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
   * Build prompt for AI newspaper headline
   */
  private buildNewsPrompt(stats: WorldStats): string {
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
  getQuickStats(): QuickStats {
    const stats = this.getWorldStats();
    return {
      totalKills: stats.totalKills,
      totalDeaths: stats.totalDeaths,
      activeEvents: this.worldEvents.length
    };
  }

  /**
   * Clear all events (for testing or reset)
   */
  clearEvents(): void {
    this.worldEvents = [];
    this.cachedNewspaper = null;
  }

  /**
   * Get recent events (for debugging)
   */
  getRecentEvents(count: number = 10): WorldEvent[] {
    return this.worldEvents.slice(-count);
  }
}
