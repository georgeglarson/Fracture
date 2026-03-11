/**
 * RiftUIHandler - Handles Fracture Rift UI lifecycle
 *
 * Single Responsibility: Rift start/progress/advance/end, leaderboard, enter/exit
 * Extracted from Game.ts to reduce its size.
 */

import { RiftUI } from '../ui/rift-ui';

/**
 * Game context for rift UI operations
 */
export interface RiftUIContext {
  // UI
  riftUI: RiftUI | null;

  // Dependencies
  client: { sendRiftEnter: () => void; sendRiftExit: () => void; sendRiftLeaderboardRequest: () => void } | null;
  audioManager: { playSound: (name: string) => void } | null;

  // Methods
  showNotification: (message: string) => void;
}

/**
 * Handle rift start
 */
export function handleRiftStart(
  ctx: RiftUIContext,
  data: { runId: string; depth: number; modifiers: Array<{ id: string; name: string; description: string; color: string }>; requiredKills: number; killCount: number }
): void {
  console.log('[Rift] Starting rift:', data);

  // Create rift UI if it doesn't exist
  if (!ctx.riftUI) {
    ctx.riftUI = new RiftUI();
  }

  ctx.riftUI.onRiftStart(data);
  ctx.audioManager?.playSound('glitch1');
  ctx.showNotification(`Entering Fracture Rift - Depth ${data.depth}`);
}

/**
 * Handle rift kill progress
 */
export function handleRiftProgress(
  ctx: RiftUIContext,
  data: { killCount: number; requiredKills: number }
): void {
  console.log('[Rift] Progress:', data);
  ctx.riftUI?.onRiftProgress(data);
}

/**
 * Handle rift depth advance
 */
export function handleRiftAdvance(
  ctx: RiftUIContext,
  data: { newDepth: number; killCount: number; requiredKills: number; rewards?: { xp: number; gold: number } }
): void {
  console.log('[Rift] Advancing to depth:', data.newDepth);
  ctx.riftUI?.onRiftAdvance(data);
  ctx.audioManager?.playSound('levelup');

  if (data.rewards) {
    ctx.showNotification(`Depth ${data.newDepth}! +${data.rewards.xp} XP, +${data.rewards.gold} Gold`);
  }
}

/**
 * Handle rift end
 */
export function handleRiftEnd(
  ctx: RiftUIContext,
  data: { success: boolean; reason: string; completedDepth?: number; totalKills?: number; rewards?: { xp: number; gold: number }; leaderboardRank?: number | null }
): void {
  console.log('[Rift] Ended:', data);
  ctx.riftUI?.onRiftEnd(data);

  if (data.reason === 'death') {
    ctx.showNotification(`Rift Failed at Depth ${data.completedDepth || 0}`);
    ctx.audioManager?.playSound('hurt');
  } else if (data.success) {
    let msg = `Rift Complete! Depth ${data.completedDepth}, ${data.totalKills} kills`;
    if (data.leaderboardRank) {
      msg += ` - Rank #${data.leaderboardRank}`;
    }
    ctx.showNotification(msg);
    ctx.audioManager?.playSound('quest');
  }
}

/**
 * Handle rift leaderboard data
 */
export function handleRiftLeaderboard(
  ctx: RiftUIContext,
  data: { entries: Array<{ rank: number; playerName: string; maxDepth: number; totalKills: number; completionTime: number }>; playerRank: number | null }
): void {
  console.log('[Rift] Leaderboard:', data);
  ctx.riftUI?.showLeaderboard(data.entries, data.playerRank);
}

/**
 * Send request to enter a rift
 */
export function enterRift(ctx: RiftUIContext): void {
  if (ctx.client) {
    ctx.client.sendRiftEnter();
  }
}

/**
 * Send request to exit a rift
 */
export function exitRift(ctx: RiftUIContext): void {
  if (ctx.client) {
    ctx.client.sendRiftExit();
  }
}

/**
 * Send request for rift leaderboard
 */
export function requestRiftLeaderboard(ctx: RiftUIContext): void {
  if (ctx.client) {
    ctx.client.sendRiftLeaderboardRequest();
  }
}
