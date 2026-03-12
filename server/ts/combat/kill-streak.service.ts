/**
 * Kill Streak Service - Tracks consecutive kills and rewards
 * Single Responsibility: Manage kill streaks with escalating rewards
 */

import { getServerEventBus } from '../../../shared/ts/events/index.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('KillStreak');

export interface StreakData {
  count: number;
  lastKillTime: number;
  bonusXpEarned: number;
  bonusGoldEarned: number;
}

export interface StreakReward {
  xpMultiplier: number;
  goldMultiplier: number;
  title: string;
  announcement?: string;
}

// Streak thresholds and their rewards
const STREAK_TIERS: { [threshold: number]: StreakReward } = {
  3: { xpMultiplier: 1.1, goldMultiplier: 1.1, title: 'Killing Spree', announcement: 'is on a killing spree!' },
  5: { xpMultiplier: 1.25, goldMultiplier: 1.25, title: 'Rampage', announcement: 'is on a rampage!' },
  7: { xpMultiplier: 1.4, goldMultiplier: 1.4, title: 'Dominating', announcement: 'is dominating!' },
  10: { xpMultiplier: 1.6, goldMultiplier: 1.6, title: 'Unstoppable', announcement: 'is unstoppable!' },
  15: { xpMultiplier: 1.8, goldMultiplier: 1.8, title: 'Godlike', announcement: 'is GODLIKE!' },
  20: { xpMultiplier: 2.0, goldMultiplier: 2.0, title: 'Legendary', announcement: 'has achieved LEGENDARY status!' },
};

// Time window for streak to continue (5 minutes)
const STREAK_TIMEOUT_MS = 5 * 60 * 1000;

class KillStreakService {
  private streaks: Map<number, StreakData> = new Map();
  private eventBus = getServerEventBus();

  constructor() {
    // Listen for player deaths to reset streaks
    this.eventBus.on('player:died', (event) => {
      this.endStreak(event.playerId, event.killerId);
    });
  }

  /**
   * Record a kill and update streak
   * Returns the current streak count and any bonus multipliers
   */
  recordKill(playerId: number, playerName: string): {
    streak: number;
    xpMultiplier: number;
    goldMultiplier: number;
    tier: StreakReward | null;
    isNewTier: boolean;
  } {
    const now = Date.now();
    let streakData = this.streaks.get(playerId);

    // Check if streak has expired
    if (streakData && (now - streakData.lastKillTime) > STREAK_TIMEOUT_MS) {
      // Streak expired, reset
      streakData = undefined;
    }

    if (!streakData) {
      streakData = {
        count: 0,
        lastKillTime: now,
        bonusXpEarned: 0,
        bonusGoldEarned: 0
      };
    }

    // Increment streak
    streakData.count++;
    streakData.lastKillTime = now;
    this.streaks.set(playerId, streakData);

    // Find current tier
    const tier = this.getCurrentTier(streakData.count);
    const previousTier = this.getCurrentTier(streakData.count - 1);
    const isNewTier = tier !== previousTier && tier !== null;

    // Calculate multipliers
    const xpMultiplier = tier?.xpMultiplier ?? 1.0;
    const goldMultiplier = tier?.goldMultiplier ?? 1.0;

    // Emit streak event if we hit a new tier
    if (isNewTier && tier) {
      this.eventBus.emit('player:streak', {
        playerId,
        playerName,
        streak: streakData.count,
        tier: tier.title,
        announcement: tier.announcement
      });

      log.info({ playerName, tier: tier.title, kills: streakData.count }, 'Streak reached new tier');
    }

    return {
      streak: streakData.count,
      xpMultiplier,
      goldMultiplier,
      tier,
      isNewTier
    };
  }

  /**
   * End a player's streak (on death or disconnect)
   */
  endStreak(playerId: number, endedBy?: number): StreakData | null {
    const streakData = this.streaks.get(playerId);

    if (streakData && streakData.count >= 3) {
      // Emit streak ended event for announcements
      this.eventBus.emit('player:streakEnded', {
        playerId,
        streak: streakData.count,
        endedById: endedBy
      });

      log.info({ playerId, streak: streakData.count }, 'Streak ended');
    }

    this.streaks.delete(playerId);
    return streakData ?? null;
  }

  /**
   * Get current streak for a player
   */
  getStreak(playerId: number): number {
    const now = Date.now();
    const streakData = this.streaks.get(playerId);

    if (!streakData) return 0;

    // Check if expired
    if ((now - streakData.lastKillTime) > STREAK_TIMEOUT_MS) {
      this.streaks.delete(playerId);
      return 0;
    }

    return streakData.count;
  }

  /**
   * Get the current tier for a streak count
   */
  private getCurrentTier(count: number): StreakReward | null {
    let currentTier: StreakReward | null = null;

    for (const [threshold, reward] of Object.entries(STREAK_TIERS)) {
      if (count >= parseInt(threshold)) {
        currentTier = reward;
      }
    }

    return currentTier;
  }

  /**
   * Get streak info for display
   */
  getStreakInfo(playerId: number): {
    count: number;
    tier: StreakReward | null;
    timeRemaining: number;
  } {
    const now = Date.now();
    const streakData = this.streaks.get(playerId);

    if (!streakData) {
      return { count: 0, tier: null, timeRemaining: 0 };
    }

    const elapsed = now - streakData.lastKillTime;
    if (elapsed > STREAK_TIMEOUT_MS) {
      this.streaks.delete(playerId);
      return { count: 0, tier: null, timeRemaining: 0 };
    }

    return {
      count: streakData.count,
      tier: this.getCurrentTier(streakData.count),
      timeRemaining: STREAK_TIMEOUT_MS - elapsed
    };
  }

  /**
   * Get top active streaks (for leaderboard)
   */
  getTopStreaks(limit: number = 5): Array<{ playerId: number; count: number; tier: string | null }> {
    const now = Date.now();
    const activeStreaks: Array<{ playerId: number; count: number; tier: string | null }> = [];

    for (const [playerId, data] of this.streaks.entries()) {
      if ((now - data.lastKillTime) <= STREAK_TIMEOUT_MS && data.count >= 3) {
        const tier = this.getCurrentTier(data.count);
        activeStreaks.push({
          playerId,
          count: data.count,
          tier: tier?.title ?? null
        });
      }
    }

    // Sort by count descending
    activeStreaks.sort((a, b) => b.count - a.count);

    return activeStreaks.slice(0, limit);
  }
}

// Singleton instance
let killStreakServiceInstance: KillStreakService | null = null;

export function getKillStreakService(): KillStreakService {
  if (!killStreakServiceInstance) {
    killStreakServiceInstance = new KillStreakService();
  }
  return killStreakServiceInstance;
}

export { KillStreakService };
