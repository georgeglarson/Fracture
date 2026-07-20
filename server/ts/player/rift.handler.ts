/**
 * RiftHandler - Handles Fracture Rift operations for players
 *
 * Single Responsibility: Rift entry, progress tracking, and rewards
 *
 * All client-bound messages use the Messages.* classes (positional arrays)
 * whose field order matches the client parsers in
 * client/ts/network/gameclient.ts (receiveRiftStart/Progress/Advance/End/Leaderboard).
 */

import { Messages } from '../message.js';
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

  // Position for rift teleport.
  // teleport() must move the player through the established path
  // (setPosition + broadcast Teleport + vanish/repush) as doors do.
  getPosition: () => { x: number; y: number };
  teleport: (x: number, y: number) => void;

  // Despawn leftover rift mobs when a run ends
  despawnMobs?: (mobIds: number[]) => void;

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
    ctx.send(new Messages.RiftEnd(
      false,
      'Cannot enter rift. Already in a rift or level too low.',
      0, 0, null, null
    ).serialize());
    return false;
  }

  // Format modifier info for client
  const modifiers = run.modifiers.map(m => ({
    id: m,
    ...formatModifier(m)
  }));

  // Send rift start message
  ctx.send(new Messages.RiftStart(
    run.runId,
    run.depth,
    modifiers,
    run.requiredKills,
    0
  ).serialize());

  // Save the return position and teleport the player into the rift arena
  ctx.savedPosition = ctx.getPosition();
  const center = riftManager.getArenaCenter();
  ctx.teleport(center.x, center.y);

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
    ctx.send(new Messages.RiftAdvance(
      result.newDepth,
      0,
      result.requiredKills,
      result.rewards ?? null
    ).serialize());
  } else {
    // Send progress update
    ctx.send(new Messages.RiftProgress(
      result.killCount,
      result.requiredKills
    ).serialize());
  }
}

/**
 * Handle rift exit request
 */
export function handleRiftExit(ctx: RiftPlayerContext): void {
  const result = riftManager.endRun(ctx.id, 'exit');

  if (!result) {
    ctx.send(new Messages.RiftEnd(
      false,
      'Not in a rift',
      0, 0, null, null
    ).serialize());
    return;
  }

  // Award final rewards
  ctx.addXP(result.finalRewards.xp, 'Rift Completion');
  ctx.addGold(result.finalRewards.gold, 'Rift Completion');

  // Send end message
  ctx.send(new Messages.RiftEnd(
    true,
    'exit',
    result.run.completedDepth,
    result.run.killCount,
    result.finalRewards,
    result.leaderboardRank
  ).serialize());

  // Return the player to where they entered and clean up leftover mobs
  if (ctx.savedPosition) {
    ctx.teleport(ctx.savedPosition.x, ctx.savedPosition.y);
    ctx.savedPosition = undefined;
  }
  ctx.despawnMobs?.(result.spawnedMobIds);

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

  ctx.send(new Messages.RiftEnd(
    false,
    'death',
    result.run.completedDepth,
    result.run.killCount,
    deathRewards,
    result.leaderboardRank
  ).serialize());

  // No teleport on death — the normal death/respawn flow relocates the
  // player to their checkpoint. Just drop the saved position and clean up.
  ctx.savedPosition = undefined;
  ctx.despawnMobs?.(result.spawnedMobIds);

  log.info({ player: ctx.name, depth: result.run.depth }, 'Died in rift');
}

/**
 * Handle leaderboard request
 */
export function handleRiftLeaderboardRequest(ctx: RiftPlayerContext): void {
  const leaderboard = riftManager.getLeaderboard(10);
  const playerRank = riftManager.getPlayerRank(ctx.name);

  ctx.send(new Messages.RiftLeaderboard(leaderboard, playerRank).serialize());
}

/**
 * Check if player is in a rift
 */
export function isPlayerInRift(playerId: number): boolean {
  return riftManager.isInRift(playerId);
}

/**
 * Check whether a mob belongs to the player's active rift run
 */
export function isRiftMob(playerId: number, mobId: number): boolean {
  return riftManager.isRiftMob(playerId, mobId);
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
 * Clean up on player disconnect.
 * Returns the manager's endRun result so the caller can despawn leftover mobs.
 */
export function handleRiftDisconnect(playerId: number): ReturnType<typeof riftManager.cleanupDisconnectedPlayer> {
  return riftManager.cleanupDisconnectedPlayer(playerId);
}
