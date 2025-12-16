import { Types } from '../../../shared/ts/gametypes';
import {
  Achievement,
  ACHIEVEMENTS,
  PlayerAchievements,
  getAchievementById,
  getAchievementTitle,
  getMobTypeFromKind,
  createEmptyPlayerAchievements
} from '../../../shared/ts/achievements';

export class AchievementService {
  // Per-player achievement state (keyed by player ID)
  private playerAchievements: Map<string, PlayerAchievements> = new Map();

  // Callbacks to send messages to players (set via setSendCallback/setBroadcastCallback)
  private sendCallback!: (playerId: string, message: any[]) => void;
  private broadcastCallback!: (message: any[]) => void;

  constructor() {}

  /**
   * Set callback for sending messages to a specific player
   */
  setSendCallback(callback: (playerId: string, message: any[]) => void) {
    this.sendCallback = callback;
  }

  /**
   * Set callback for broadcasting messages to all players
   */
  setBroadcastCallback(callback: (message: any[]) => void) {
    this.broadcastCallback = callback;
  }

  /**
   * Initialize achievements for a player (called on connect)
   */
  initPlayer(playerId: string, savedData?: PlayerAchievements): PlayerAchievements {
    const achievements = savedData || createEmptyPlayerAchievements();
    this.playerAchievements.set(playerId, achievements);

    console.log(`[Achievement] Initialized player ${playerId} with ${achievements.unlocked.length} unlocked achievements`);
    return achievements;
  }

  /**
   * Get achievements for a player
   */
  getPlayerAchievements(playerId: string): PlayerAchievements {
    return this.playerAchievements.get(playerId) || createEmptyPlayerAchievements();
  }

  /**
   * Clean up player data on disconnect
   */
  cleanupPlayer(playerId: string) {
    this.playerAchievements.delete(playerId);
  }

  /**
   * Record a mob kill and check for kill-based achievements
   * Returns rewards to grant (gold, xp)
   */
  recordKill(playerId: string, mobKind: number): { gold: number; xp: number } | null {
    const state = this.playerAchievements.get(playerId);
    if (!state) return null;

    const mobType = getMobTypeFromKind(mobKind);
    let rewards = { gold: 0, xp: 0 };

    // Update total kills progress
    state.progress['total_kills'] = (state.progress['total_kills'] || 0) + 1;
    const totalKills = state.progress['total_kills'];

    // Update type-specific kills
    if (mobType) {
      const typeKey = `kills_${mobType}`;
      state.progress[typeKey] = (state.progress[typeKey] || 0) + 1;
    }

    // Check all kill-related achievements
    for (const achievement of ACHIEVEMENTS) {
      if (state.unlocked.includes(achievement.id)) continue;

      const req = achievement.requirement;
      let progress = 0;
      let unlocked = false;

      if (req.type === 'kills') {
        progress = totalKills;
        if (progress >= req.target) {
          unlocked = true;
        }
      } else if (req.type === 'kills_type' && mobType && req.mobType === mobType) {
        const typeKey = `kills_${mobType}`;
        progress = state.progress[typeKey] || 0;
        if (progress >= req.target) {
          unlocked = true;
        }
      }

      // Send progress update if not yet unlocked
      if (!unlocked && progress > 0 && (req.type === 'kills' || (req.type === 'kills_type' && mobType === req.mobType))) {
        this.sendProgress(playerId, achievement.id, progress, req.target);
      }

      // Unlock achievement
      if (unlocked) {
        const achievementRewards = this.unlockAchievement(playerId, achievement);
        if (achievementRewards) {
          rewards.gold += achievementRewards.gold;
          rewards.xp += achievementRewards.xp;
        }
      }
    }

    return rewards.gold > 0 || rewards.xp > 0 ? rewards : null;
  }

  /**
   * Record gold earned and check for wealth achievements
   * Returns rewards to grant (xp)
   */
  recordGoldEarned(playerId: string, amount: number): { gold: number; xp: number } | null {
    const state = this.playerAchievements.get(playerId);
    if (!state) return null;

    state.progress['gold_earned'] = (state.progress['gold_earned'] || 0) + amount;
    const totalGold = state.progress['gold_earned'];

    let rewards = { gold: 0, xp: 0 };

    for (const achievement of ACHIEVEMENTS) {
      if (state.unlocked.includes(achievement.id)) continue;
      if (achievement.requirement.type !== 'gold_earned') continue;

      const progress = totalGold;
      const target = achievement.requirement.target;

      if (progress < target) {
        this.sendProgress(playerId, achievement.id, progress, target);
      } else {
        const achievementRewards = this.unlockAchievement(playerId, achievement);
        if (achievementRewards) {
          rewards.gold += achievementRewards.gold;
          rewards.xp += achievementRewards.xp;
        }
      }
    }

    return rewards.gold > 0 || rewards.xp > 0 ? rewards : null;
  }

  /**
   * Record gold spent (first purchase achievement)
   */
  recordGoldSpent(playerId: string, amount: number): { gold: number; xp: number } | null {
    const state = this.playerAchievements.get(playerId);
    if (!state) return null;

    state.progress['gold_spent'] = (state.progress['gold_spent'] || 0) + amount;

    let rewards = { gold: 0, xp: 0 };

    for (const achievement of ACHIEVEMENTS) {
      if (state.unlocked.includes(achievement.id)) continue;
      if (achievement.requirement.type !== 'gold_spent') continue;

      // First purchase only needs 1 gold spent
      if (state.progress['gold_spent'] >= achievement.requirement.target) {
        const achievementRewards = this.unlockAchievement(playerId, achievement);
        if (achievementRewards) {
          rewards.gold += achievementRewards.gold;
          rewards.xp += achievementRewards.xp;
        }
      }
    }

    return rewards.gold > 0 || rewards.xp > 0 ? rewards : null;
  }

  /**
   * Check level-based achievements
   */
  recordLevel(playerId: string, level: number): { gold: number; xp: number } | null {
    const state = this.playerAchievements.get(playerId);
    if (!state) return null;

    state.progress['level'] = level;
    let rewards = { gold: 0, xp: 0 };

    for (const achievement of ACHIEVEMENTS) {
      if (state.unlocked.includes(achievement.id)) continue;
      if (achievement.requirement.type !== 'level') continue;

      const target = achievement.requirement.target;

      if (level >= target) {
        const achievementRewards = this.unlockAchievement(playerId, achievement);
        if (achievementRewards) {
          rewards.gold += achievementRewards.gold;
          rewards.xp += achievementRewards.xp;
        }
      }
    }

    return rewards.gold > 0 || rewards.xp > 0 ? rewards : null;
  }

  /**
   * Record login streak
   */
  recordStreak(playerId: string, streak: number): { gold: number; xp: number } | null {
    const state = this.playerAchievements.get(playerId);
    if (!state) return null;

    state.progress['streak'] = Math.max(state.progress['streak'] || 0, streak);
    let rewards = { gold: 0, xp: 0 };

    for (const achievement of ACHIEVEMENTS) {
      if (state.unlocked.includes(achievement.id)) continue;
      if (achievement.requirement.type !== 'streak') continue;

      if (streak >= achievement.requirement.target) {
        const achievementRewards = this.unlockAchievement(playerId, achievement);
        if (achievementRewards) {
          rewards.gold += achievementRewards.gold;
          rewards.xp += achievementRewards.xp;
        }
      }
    }

    return rewards.gold > 0 || rewards.xp > 0 ? rewards : null;
  }

  /**
   * Unlock "First Steps" achievement (entering game)
   */
  recordFirstSteps(playerId: string): { gold: number; xp: number } | null {
    const state = this.playerAchievements.get(playerId);
    if (!state) return null;

    const achievement = getAchievementById('first_steps');
    if (!achievement || state.unlocked.includes('first_steps')) return null;

    return this.unlockAchievement(playerId, achievement);
  }

  /**
   * Unlock an achievement and grant rewards
   * Returns the rewards to be granted
   */
  private unlockAchievement(playerId: string, achievement: Achievement): { gold: number; xp: number } | null {
    const state = this.playerAchievements.get(playerId);
    if (!state || state.unlocked.includes(achievement.id)) return null;

    // Mark as unlocked
    state.unlocked.push(achievement.id);
    console.log(`[Achievement] Player ${playerId} unlocked: ${achievement.name}`);

    // Send unlock notification
    if (this.sendCallback) {
      this.sendCallback(playerId, [Types.Messages.ACHIEVEMENT_UNLOCK, achievement.id]);
    }

    // Return rewards to be granted by caller
    return {
      gold: achievement.reward?.gold || 0,
      xp: achievement.reward?.xp || 0
    };
  }

  /**
   * Send progress update to player
   */
  private sendProgress(playerId: string, achievementId: string, current: number, target: number) {
    if (this.sendCallback) {
      this.sendCallback(playerId, [Types.Messages.ACHIEVEMENT_PROGRESS, achievementId, current, target]);
    }
  }

  /**
   * Select a title for the player
   */
  selectTitle(playerId: string, achievementId: string | null): string | null {
    const state = this.playerAchievements.get(playerId);
    if (!state) return null;

    // Null means clear title
    if (achievementId === null) {
      state.selectedTitle = null;
      console.log(`[Achievement] Player ${playerId} cleared title`);
      return null;
    }

    // Check if achievement is unlocked
    if (!state.unlocked.includes(achievementId)) {
      console.log(`[Achievement] Player ${playerId} cannot select locked title: ${achievementId}`);
      return null;
    }

    // Check if achievement has a title
    const title = getAchievementTitle(achievementId);
    if (!title) {
      console.log(`[Achievement] Achievement ${achievementId} has no title`);
      return null;
    }

    state.selectedTitle = achievementId;
    console.log(`[Achievement] Player ${playerId} selected title: ${title}`);
    return title;
  }

  /**
   * Get the selected title string for a player
   */
  getSelectedTitle(playerId: string): string | null {
    const state = this.playerAchievements.get(playerId);
    if (!state || !state.selectedTitle) return null;
    return getAchievementTitle(state.selectedTitle);
  }

  /**
   * Get serializable achievement state for persistence
   */
  getSerializableState(playerId: string): PlayerAchievements | null {
    return this.playerAchievements.get(playerId) || null;
  }
}

// Singleton instance
let achievementService: AchievementService | null = null;

export function getAchievementService(): AchievementService {
  if (!achievementService) {
    achievementService = new AchievementService();
  }
  return achievementService;
}
