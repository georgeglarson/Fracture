/**
 * AchievementHandler - Handles all achievement operations for players
 *
 * Single Responsibility: Achievement init, tracking, title selection
 * Extracted from Player.ts to reduce its size.
 */

import { Types } from '../../../shared/ts/gametypes';
import { Messages } from '../message';
import { getAchievementService } from '../achievements/achievement.service';
import { PlayerAchievements } from '../../../shared/ts/achievements';

/**
 * Player context for achievement operations
 */
export interface AchievementPlayerContext {
  id: number;
  title: string | null;
  send: (message: any) => void;
  broadcast: (message: any) => void;
  grantGold: (amount: number) => void;
  grantXP: (amount: number) => void;
  setTitle: (title: string | null) => void;
}

/**
 * Initialize achievements for this player
 */
export function initAchievements(ctx: AchievementPlayerContext, savedData?: PlayerAchievements): void {
  const achievementService = getAchievementService();

  // Set up callback for sending messages to this player
  achievementService.setSendCallback((playerId, message) => {
    if (playerId === ctx.id.toString()) {
      ctx.send(message);
    }
  });

  // Initialize player achievements
  const achievements = achievementService.initPlayer(ctx.id.toString(), savedData);

  // Set title from saved data
  ctx.setTitle(achievementService.getSelectedTitle(ctx.id.toString()));

  // Send initial achievement state to client
  ctx.send([
    Types.Messages.ACHIEVEMENT_INIT,
    achievements.unlocked,
    JSON.stringify(achievements.progress),
    achievements.selectedTitle || ''
  ]);

  // Unlock "First Steps" achievement for new players
  if (!achievements.unlocked.includes('first_steps')) {
    const rewards = achievementService.recordFirstSteps(ctx.id.toString());
    if (rewards) {
      if (rewards.gold > 0) ctx.grantGold(rewards.gold);
      if (rewards.xp > 0) ctx.grantXP(rewards.xp);
    }
  }
}

/**
 * Handle title selection from client
 */
export function handleSelectTitle(ctx: AchievementPlayerContext, achievementId: string | null): void {
  const achievementService = getAchievementService();
  const newTitle = achievementService.selectTitle(ctx.id.toString(), achievementId);
  ctx.setTitle(newTitle);

  // Broadcast title change to all players
  ctx.broadcast(new Messages.PlayerTitleUpdate(ctx.id, newTitle));
}

/**
 * Called when player kills a mob - check kill achievements
 */
export function checkKillAchievements(ctx: AchievementPlayerContext, mobKind: number): void {
  const achievementService = getAchievementService();
  const rewards = achievementService.recordKill(ctx.id.toString(), mobKind);
  if (rewards) {
    if (rewards.gold > 0) ctx.grantGold(rewards.gold);
    if (rewards.xp > 0) ctx.grantXP(rewards.xp);
  }
}

/**
 * Called when player earns gold - check wealth achievements
 */
export function checkGoldAchievements(ctx: AchievementPlayerContext, amount: number): void {
  const achievementService = getAchievementService();
  const rewards = achievementService.recordGoldEarned(ctx.id.toString(), amount);
  if (rewards) {
    if (rewards.gold > 0) ctx.grantGold(rewards.gold);
    if (rewards.xp > 0) ctx.grantXP(rewards.xp);
  }
}

/**
 * Called when player spends gold - check first purchase achievement
 */
export function checkPurchaseAchievements(ctx: AchievementPlayerContext, amount: number): void {
  const achievementService = getAchievementService();
  const rewards = achievementService.recordGoldSpent(ctx.id.toString(), amount);
  if (rewards) {
    if (rewards.gold > 0) ctx.grantGold(rewards.gold);
    if (rewards.xp > 0) ctx.grantXP(rewards.xp);
  }
}

/**
 * Called when player levels up - check level achievements
 */
export function checkLevelAchievements(ctx: AchievementPlayerContext, level: number): void {
  const achievementService = getAchievementService();
  const rewards = achievementService.recordLevel(ctx.id.toString(), level);
  if (rewards) {
    if (rewards.gold > 0) ctx.grantGold(rewards.gold);
    if (rewards.xp > 0) ctx.grantXP(rewards.xp);
  }
}

/**
 * Called after daily reward streak - check streak achievements
 */
export function checkStreakAchievements(ctx: AchievementPlayerContext, streak: number): void {
  const achievementService = getAchievementService();
  const rewards = achievementService.recordStreak(ctx.id.toString(), streak);
  if (rewards) {
    if (rewards.gold > 0) ctx.grantGold(rewards.gold);
    if (rewards.xp > 0) ctx.grantXP(rewards.xp);
  }
}

/**
 * Get serializable achievement state for persistence
 */
export function getAchievementState(ctx: AchievementPlayerContext): PlayerAchievements | null {
  const achievementService = getAchievementService();
  return achievementService.getSerializableState(ctx.id.toString());
}

/**
 * Cleanup achievement data on disconnect
 */
export function cleanupAchievements(ctx: AchievementPlayerContext): void {
  const achievementService = getAchievementService();
  achievementService.cleanupPlayer(ctx.id.toString());
}
