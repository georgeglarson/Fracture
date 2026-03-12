/**
 * Daily Reward Service - Single Responsibility: Streak tracking and reward calculation
 *
 * Handles all daily reward logic including:
 * - Streak calculation based on consecutive logins
 * - Reward amount lookup by streak day
 * - Date handling for UTC-based day comparison
 */

/**
 * Result of checking daily reward eligibility
 */
export interface DailyRewardResult {
  gold: number;
  xp: number;
  streak: number;
  isNewDay: boolean;
}

/**
 * DailyRewardService - Calculates daily rewards based on login streaks
 */
export class DailyRewardService {
  // Reward tables (streak day 1-7, resets after day 7)
  private static readonly DAILY_GOLD = [10, 15, 20, 25, 35, 50, 100];
  private static readonly DAILY_XP = [25, 35, 50, 65, 85, 100, 200];

  /**
   * Check daily reward eligibility and calculate rewards
   *
   * @param lastLoginDate - ISO date string (YYYY-MM-DD) of last login, or null for first login
   * @param currentStreak - Current streak count from client
   * @returns Reward result, or null if already claimed today
   */
  checkDailyReward(lastLoginDate: string | null, currentStreak: number): DailyRewardResult {
    const today = this.getTodayUTC();

    // First time player - grant day 1 reward
    if (!lastLoginDate) {
      return this.calculateReward(1, true);
    }

    // Already claimed today
    if (lastLoginDate === today) {
      return {
        gold: 0,
        xp: 0,
        streak: currentStreak,
        isNewDay: false
      };
    }

    // Calculate new streak
    const yesterday = this.getYesterdayUTC();
    const twoDaysAgo = this.getTwoDaysAgoUTC();
    let newStreak: number;

    if (lastLoginDate === yesterday) {
      // Consecutive day - increment streak (max 7, then wrap to 1)
      newStreak = currentStreak >= 7 ? 1 : currentStreak + 1;
    } else if (lastLoginDate === twoDaysAgo) {
      // 1-day grace: maintain streak but don't advance
      newStreak = currentStreak || 1;
    } else {
      // Missed more than 1 day - reset to day 1
      newStreak = 1;
    }

    return this.calculateReward(newStreak, true);
  }

  /**
   * Calculate rewards for a given streak
   */
  private calculateReward(streak: number, isNewDay: boolean): DailyRewardResult {
    const index = Math.min(streak, 7) - 1; // 0-indexed, max at day 7
    return {
      gold: DailyRewardService.DAILY_GOLD[index],
      xp: DailyRewardService.DAILY_XP[index],
      streak,
      isNewDay
    };
  }

  /**
   * Get reward amounts for a specific streak day (for UI display)
   */
  getRewardForDay(day: number): { gold: number; xp: number } {
    const index = Math.min(Math.max(1, day), 7) - 1;
    return {
      gold: DailyRewardService.DAILY_GOLD[index],
      xp: DailyRewardService.DAILY_XP[index]
    };
  }

  /**
   * Get all reward tiers (for UI display)
   */
  getAllRewardTiers(): { day: number; gold: number; xp: number }[] {
    return DailyRewardService.DAILY_GOLD.map((gold, index) => ({
      day: index + 1,
      gold,
      xp: DailyRewardService.DAILY_XP[index]
    }));
  }

  /**
   * Get today's date in UTC as ISO string (YYYY-MM-DD)
   */
  private getTodayUTC(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get yesterday's date in UTC as ISO string (YYYY-MM-DD)
   */
  private getYesterdayUTC(): string {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  /**
   * Get the date two days ago in UTC as ISO string (YYYY-MM-DD)
   */
  private getTwoDaysAgoUTC(): string {
    const twoDaysAgo = new Date();
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
    return twoDaysAgo.toISOString().split('T')[0];
  }
}

// Singleton instance
let dailyRewardService: DailyRewardService | null = null;

/**
 * Get the singleton DailyRewardService instance
 */
export function getDailyRewardService(): DailyRewardService {
  if (!dailyRewardService) {
    dailyRewardService = new DailyRewardService();
  }
  return dailyRewardService;
}
