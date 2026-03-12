/**
 * RiftHandler - Handles Fracture Rift operations for players
 *
 * Single Responsibility: Rift entry, progress tracking, and rewards
 */

import { Types } from '../../../shared/ts/gametypes';
import { riftManager } from '../rifts/rift-manager';
import { RiftModifier, MODIFIERS, formatModifier } from '../../../shared/ts/rifts/rift-data';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Rift');

/**
 * Player context for rift operations
 */
export interface RiftPlayerContext {
  id: number;
  name: string;
  level: number;
  hitPoints: number;
  maxHitPoints: number;

  // Methods
  send: (message: unknown[]) => void;
  broadcast: (message: unknown[], ignoreSelf?: boolean) => void;

  // XP/Gold rewards
  addXP: (amount: number, source: string) => void;
  addGold: (amount: number, source: string) => void;

  // Position for rift teleport
  setPosition: (x: number, y: number) => void;

  // Save/restore position for rift exit
  savedPosition?: { x: number; y: number };
}

/**
 * Handle rift enter request
 */
export function handleRiftEnter(ctx: RiftPlayerContext): boolean {
  // Try to start a new rift run
  const run = riftManager.startRun(ctx.id, ctx.name, ctx.level);

  if (!run) {
    ctx.send([Types.Messages.RIFT_END, {
      success: false,
      reason: 'Cannot enter rift. Already in a rift or level too low.'
    }]);
    return false;
  }

  // Format modifier info for client
  const modifiers = run.modifiers.map(m => ({
    id: m,
    ...formatModifier(m)
  }));

  // Send rift start message
  ctx.send([Types.Messages.RIFT_START, {
    runId: run.runId,
    depth: run.depth,
    modifiers,
    requiredKills: run.requiredKills,
    killCount: 0
  }]);

  log.info({ player: ctx.name, depth: 1 }, 'Entered rift');
  return true;
}

/**
 * Handle player kill in rift
 */
export function handleRiftKill(ctx: RiftPlayerContext, mobId: number): void {
  const result = riftManager.recordKill(ctx.id, mobId);
  if (!result) return;

  if (result.advanced) {
    // Award floor completion rewards
    if (result.rewards) {
      ctx.addXP(result.rewards.xp, 'Rift Floor Completion');
      ctx.addGold(result.rewards.gold, 'Rift Floor Completion');
    }

    // Send advance message
    ctx.send([Types.Messages.RIFT_ADVANCE, {
      newDepth: result.newDepth,
      killCount: 0,
      requiredKills: result.requiredKills,
      rewards: result.rewards
    }]);
  } else {
    // Send progress update
    ctx.send([Types.Messages.RIFT_PROGRESS, {
      killCount: result.killCount,
      requiredKills: result.requiredKills
    }]);
  }
}

/**
 * Handle rift exit request
 */
export function handleRiftExit(ctx: RiftPlayerContext): void {
  const result = riftManager.endRun(ctx.id, 'exit');

  if (!result) {
    ctx.send([Types.Messages.RIFT_END, {
      success: false,
      reason: 'Not in a rift'
    }]);
    return;
  }

  // Award final rewards
  ctx.addXP(result.finalRewards.xp, 'Rift Completion');
  ctx.addGold(result.finalRewards.gold, 'Rift Completion');

  // Send end message
  ctx.send([Types.Messages.RIFT_END, {
    success: true,
    reason: 'exit',
    completedDepth: result.run.completedDepth,
    totalKills: result.run.killCount,
    rewards: result.finalRewards,
    leaderboardRank: result.leaderboardRank
  }]);

  log.info({ player: ctx.name, completedDepth: result.run.completedDepth }, 'Exited rift');
}

/**
 * Handle player death in rift
 */
export function handleRiftDeath(ctx: RiftPlayerContext): void {
  const result = riftManager.endRun(ctx.id, 'death');

  if (!result) return;

  // Partial rewards on death
  const deathRewards = {
    xp: Math.floor(result.finalRewards.xp * 0.5),
    gold: Math.floor(result.finalRewards.gold * 0.5)
  };

  ctx.addXP(deathRewards.xp, 'Rift (Death)');
  ctx.addGold(deathRewards.gold, 'Rift (Death)');

  ctx.send([Types.Messages.RIFT_END, {
    success: false,
    reason: 'death',
    completedDepth: result.run.completedDepth,
    totalKills: result.run.killCount,
    rewards: deathRewards,
    leaderboardRank: result.leaderboardRank
  }]);

  log.info({ player: ctx.name, depth: result.run.depth }, 'Died in rift');
}

/**
 * Handle leaderboard request
 */
export function handleRiftLeaderboardRequest(ctx: RiftPlayerContext): void {
  const leaderboard = riftManager.getLeaderboard(10);
  const playerRank = riftManager.getPlayerRank(ctx.name);

  ctx.send([Types.Messages.RIFT_LEADERBOARD, {
    entries: leaderboard,
    playerRank
  }]);
}

/**
 * Check if player is in a rift
 */
export function isPlayerInRift(playerId: number): boolean {
  return riftManager.isInRift(playerId);
}

/**
 * Get modifier effects for combat calculations
 */
export function getRiftModifierEffects(playerId: number): {
  playerDamageMult: number;
  playerHpMult: number;
  canHeal: boolean;
  speedMult: number;
} {
  return riftManager.getModifierEffects(playerId);
}

/**
 * Get current rift state for a player
 */
export function getRiftState(playerId: number): {
  inRift: boolean;
  depth: number;
  killCount: number;
  requiredKills: number;
  modifiers: string[];
} | null {
  const run = riftManager.getActiveRun(playerId);
  if (!run) return null;

  return {
    inRift: true,
    depth: run.depth,
    killCount: run.currentFloorKills,
    requiredKills: run.requiredKills,
    modifiers: run.modifiers
  };
}

/**
 * Clean up on player disconnect
 */
export function handleRiftDisconnect(playerId: number): void {
  riftManager.cleanupDisconnectedPlayer(playerId);
}
