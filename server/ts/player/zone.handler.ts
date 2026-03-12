/**
 * ZoneHandler - Handles zone tracking and transitions for players
 *
 * Single Responsibility: Zone enter/exit, level warnings, zone bonuses
 * Extracted from Player.ts to reduce its size.
 */

import { ZoneManager } from '../zones/zone-manager';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Zone');

/**
 * Player context for zone operations
 */
export interface ZonePlayerContext {
  id: number;
  name: string;
  level: number;

  // Methods
  send: (message: any) => void;

  // World access for zone manager
  getWorld: () => {
    zoneManager: ZoneManager;
  };
}

/**
 * Check if player entered a new zone and send notifications
 */
export function checkZoneChange(ctx: ZonePlayerContext, x: number, y: number): void {
  const world = ctx.getWorld();
  const result = world.zoneManager.updatePlayerZone(String(ctx.id), x, y, ctx.level);

  if (result.changed && result.zone) {
    // Send zone enter notification
    ctx.send(world.zoneManager.createZoneEnterMessage(result.zone, result.warning));

    // Send zone info (bonus percentages)
    ctx.send(world.zoneManager.createZoneInfoMessage(result.zone));

    log.info({ playerName: ctx.name, zoneName: result.zone.name, minLevel: result.zone.minLevel, maxLevel: result.zone.maxLevel }, 'Player entered zone');
  }
}

/**
 * Get current zone for a player position
 */
export function getCurrentZone(ctx: ZonePlayerContext, x: number, y: number): any {
  const world = ctx.getWorld();
  return world.zoneManager.getZoneAt(x, y);
}

/**
 * Check if player is in a dangerous zone for their level
 */
export function isInDangerZone(ctx: ZonePlayerContext, x: number, y: number): boolean {
  const zone = getCurrentZone(ctx, x, y);
  if (!zone) return false;
  return ctx.level < zone.minLevel;
}

/**
 * Get zone XP bonus multiplier
 */
export function getZoneXPBonus(ctx: ZonePlayerContext, x: number, y: number): number {
  const zone = getCurrentZone(ctx, x, y);
  if (!zone) return 1.0;
  return zone.xpBonus || 1.0;
}

/**
 * Get zone gold bonus multiplier
 */
export function getZoneGoldBonus(ctx: ZonePlayerContext, x: number, y: number): number {
  const zone = getCurrentZone(ctx, x, y);
  if (!zone) return 1.0;
  return zone.goldBonus || 1.0;
}

/**
 * Get zone drop rate bonus multiplier
 */
export function getZoneDropBonus(ctx: ZonePlayerContext, x: number, y: number): number {
  const zone = getCurrentZone(ctx, x, y);
  if (!zone) return 1.0;
  return zone.dropBonus || 1.0;
}
