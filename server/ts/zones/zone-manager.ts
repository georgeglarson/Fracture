/**
 * Server-side zone manager
 * Tracks player zones and applies zone bonuses to loot/xp/gold
 */

import { getZoneAtPosition, getZoneLevelWarning, ZoneDefinition } from '../../../shared/ts/zones';
import { Types } from '../../../shared/ts/gametypes';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('ZoneManager');

export class ZoneManager {
  // Track current zone per player
  private playerZones: Map<string, string | null> = new Map();

  constructor() {
    log.info('Initialized');
  }

  /**
   * Update player's zone and return zone if changed
   */
  updatePlayerZone(playerId: string, x: number, y: number, playerLevel: number): {
    zone: ZoneDefinition | null;
    changed: boolean;
    warning: string | null;
  } {
    const zone = getZoneAtPosition(x, y);
    const currentZoneId = this.playerZones.get(playerId);
    const newZoneId = zone?.id || null;

    if (currentZoneId !== newZoneId) {
      this.playerZones.set(playerId, newZoneId);
      const warning = zone ? getZoneLevelWarning(playerLevel, zone) : null;
      return { zone, changed: true, warning };
    }

    return { zone, changed: false, warning: null };
  }

  /**
   * Get player's current zone
   */
  getPlayerZone(playerId: string): string | null {
    return this.playerZones.get(playerId) || null;
  }

  /**
   * Get zone at position
   */
  getZoneAt(x: number, y: number): ZoneDefinition | null {
    return getZoneAtPosition(x, y);
  }

  /**
   * Apply zone bonuses to item rarity roll
   * Returns adjusted rarity roll (0-100, higher = rarer)
   */
  applyRarityBonus(baseRoll: number, zone: ZoneDefinition | null): number {
    if (!zone) return baseRoll;
    // Apply bonus: if zone has +30% rarity bonus, a roll of 50 becomes 65
    return Math.min(100, baseRoll + (100 * zone.rarityBonus));
  }

  /**
   * Apply zone bonuses to gold amount
   */
  applyGoldBonus(baseGold: number, zone: ZoneDefinition | null): number {
    if (!zone) return baseGold;
    return Math.floor(baseGold * (1 + zone.goldBonus));
  }

  /**
   * Apply zone bonuses to XP amount
   */
  applyXpBonus(baseXp: number, zone: ZoneDefinition | null): number {
    if (!zone) return baseXp;
    return Math.floor(baseXp * (1 + zone.xpBonus));
  }

  /**
   * Modify drop table based on zone
   * Returns modified drops with zone bonuses applied
   */
  modifyDropTable(drops: Record<string, number>, zone: ZoneDefinition | null): Record<string, number> {
    if (!zone) return drops;

    const modified: Record<string, number> = {};

    for (const [itemName, chance] of Object.entries(drops)) {
      let newChance = chance;

      // Apply armor/weapon bonuses
      const kind = Types.getKindFromString(itemName);
      if (kind && Types.isArmor(kind)) {
        newChance = Math.min(100, chance * (1 + zone.armorDropBonus));
      } else if (kind && Types.isWeapon(kind)) {
        newChance = Math.min(100, chance * (1 + zone.weaponDropBonus));
      }

      modified[itemName] = newChance;
    }

    return modified;
  }

  /**
   * Remove player from tracking
   */
  removePlayer(playerId: string): void {
    this.playerZones.delete(playerId);
  }

  /**
   * Create zone enter message
   */
  createZoneEnterMessage(zone: ZoneDefinition, warning: string | null): any[] {
    return [
      Types.Messages.ZONE_ENTER,
      zone.id,
      zone.name,
      zone.minLevel,
      zone.maxLevel,
      warning || null
    ];
  }

  /**
   * Create zone info message (for UI display)
   */
  createZoneInfoMessage(zone: ZoneDefinition): any[] {
    return [
      Types.Messages.ZONE_INFO,
      zone.id,
      Math.round(zone.rarityBonus * 100),  // Convert to percentage
      Math.round(zone.goldBonus * 100),
      Math.round(zone.xpBonus * 100)
    ];
  }
}

// Singleton instance
let zoneManagerInstance: ZoneManager | null = null;

export function getZoneManager(): ZoneManager {
  if (!zoneManagerInstance) {
    zoneManagerInstance = new ZoneManager();
  }
  return zoneManagerInstance;
}
