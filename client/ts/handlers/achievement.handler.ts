/**
 * AchievementHandler - Handles client-side achievement operations
 *
 * Single Responsibility: Achievement init, unlock, progress, title updates
 * Extracted from Game.ts to reduce its size.
 */

import { getAchievementById } from '../../../shared/ts/achievements/achievement-data';
import { AchievementUI } from '../ui/achievement-ui';
import { AudioManager } from '../audio';

/**
 * Game context for achievement operations
 */
export interface AchievementGameContext {
  player: { id: number } | null;
  storage: any; // Storage class with saveAchievements method
  app: any; // App class with showAchievementNotification method
  audioManager: AudioManager | null;
  achievementUI: AchievementUI | null;

  // State
  unlockedAchievements: string[];
  achievementProgress: Record<string, { current: number; target: number }>;
  selectedTitle: string | null;
  playerTitles: Record<number, string | null>;

  // Callbacks
  achievementunlock_callback: ((id: string) => void) | null;
  achievementprogress_callback: ((id: string, current: number, target: number) => void) | null;
  playertitleupdate_callback: ((playerId: number, title: string | null) => void) | null;
}

/**
 * Handle initial achievement data from server
 */
export function handleAchievementInit(
  ctx: AchievementGameContext,
  unlockedIds: string[],
  progressMap: Record<string, { current: number; target: number }>,
  selectedTitle: string | null
): void {
  ctx.unlockedAchievements = unlockedIds;
  ctx.achievementProgress = progressMap;
  ctx.selectedTitle = selectedTitle;

  // Store own title
  if (ctx.player && ctx.player.id) {
    ctx.playerTitles[ctx.player.id] = selectedTitle;
  }

  // Save to storage
  ctx.storage.saveAchievements(unlockedIds, selectedTitle);

  // Update achievement panel UI
  if (ctx.achievementUI) {
    // Convert progressMap to simple current values for UI
    const progressCurrent: Record<string, number> = {};
    for (const [id, data] of Object.entries(progressMap)) {
      progressCurrent[id] = data.current;
    }
    ctx.achievementUI.updateData(unlockedIds, progressCurrent, selectedTitle);
  }

  console.info('[Achievements] Initialized:', unlockedIds.length, 'unlocked, title:', selectedTitle);
}

/**
 * Handle achievement unlock notification from server
 */
export function handleAchievementUnlock(ctx: AchievementGameContext, achievementId: string): void {
  if (!ctx.unlockedAchievements.includes(achievementId)) {
    ctx.unlockedAchievements.push(achievementId);
  }

  // Save to storage
  ctx.storage.saveAchievements(ctx.unlockedAchievements, ctx.selectedTitle);

  // Look up achievement data for name
  const achievement = getAchievementById(achievementId);
  const achievementName = achievement ? achievement.name : achievementId;

  // Show achievement notification through app
  if (ctx.app) {
    ctx.app.showAchievementNotification(achievementId, achievementName);
  }

  // Trigger unlock callback for UI notification
  if (ctx.achievementunlock_callback) {
    ctx.achievementunlock_callback(achievementId);
  }

  // Update achievement panel UI
  if (ctx.achievementUI) {
    ctx.achievementUI.unlockAchievement(achievementId);
  }

  // Play achievement sound
  if (ctx.audioManager) {
    ctx.audioManager.playSound('achievement');
  }

  console.info('[Achievements] Unlocked:', achievementId, '(' + achievementName + ')');
}

/**
 * Handle achievement progress update from server
 */
export function handleAchievementProgress(
  ctx: AchievementGameContext,
  achievementId: string,
  current: number,
  target: number
): void {
  ctx.achievementProgress[achievementId] = { current, target };

  if (ctx.achievementprogress_callback) {
    ctx.achievementprogress_callback(achievementId, current, target);
  }

  // Update achievement panel UI
  if (ctx.achievementUI) {
    ctx.achievementUI.updateProgress(achievementId, current);
  }

  console.debug('[Achievements] Progress:', achievementId, current + '/' + target);
}

/**
 * Handle player title update from server
 */
export function handlePlayerTitleUpdate(
  ctx: AchievementGameContext,
  playerId: number,
  title: string | null
): void {
  ctx.playerTitles[playerId] = title;

  // Update own selected title if it's for this player
  if (ctx.player && playerId === ctx.player.id) {
    ctx.selectedTitle = title;
    ctx.storage.saveAchievements(ctx.unlockedAchievements, title);
  }

  if (ctx.playertitleupdate_callback) {
    ctx.playertitleupdate_callback(playerId, title);
  }

  console.info('[Achievements] Player', playerId, 'title changed to:', title);
}

/**
 * Get a player's current title
 */
export function getPlayerTitle(ctx: AchievementGameContext, playerId: number): string | null {
  return ctx.playerTitles[playerId] || null;
}
