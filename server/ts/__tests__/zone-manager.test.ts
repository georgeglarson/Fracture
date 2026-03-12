/**
 * Tests for ZoneManager class
 * Covers: constructor, updatePlayerZone, getPlayerZone, getZoneAt,
 *         applyRarityBonus, applyGoldBonus, applyXpBonus,
 *         modifyDropTable, removePlayer, createZoneEnterMessage,
 *         createZoneInfoMessage, getZoneManager singleton
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZoneManager, getZoneManager } from '../zones/zone-manager';
import { ZONE_DATA, ZoneDefinition } from '../../../shared/ts/zones/zone-data';
import { Types } from '../../../shared/ts/gametypes';

// Known zone coordinates (from zone-data.ts area definitions)
const COORDS = {
  beach:    { x: 50, y: 280 },   // y: 253-314
  village:  { x: 50, y: 220 },   // y: 195-253
  forest:   { x: 50, y: 170 },   // y: 145-195
  cave:     { x: 50, y: 120 },   // y: 100-145
  desert:   { x: 50, y: 80 },    // y: 60-100
  lavaland: { x: 50, y: 30 },    // y: 0-60
  boss:     { x: 150, y: 55 },   // x: 140-169, y: 48-73
  nowhere:  { x: 1000, y: 1000 },
};

describe('ZoneManager', () => {
  let zm: ZoneManager;

  beforeEach(() => {
    zm = new ZoneManager();
  });

  // ==========================================================================
  // Construction
  // ==========================================================================

  describe('constructor', () => {
    it('should create a new ZoneManager instance', () => {
      expect(zm).toBeInstanceOf(ZoneManager);
    });

    it('should initialize without throwing', () => {
      const _zm = new ZoneManager();
      expect(_zm).toBeInstanceOf(ZoneManager);
    });
  });

  // ==========================================================================
  // getZoneAt
  // ==========================================================================

  describe('getZoneAt', () => {
    it('should return the zone at a valid position', () => {
      const zone = zm.getZoneAt(COORDS.beach.x, COORDS.beach.y);
      expect(zone).not.toBeNull();
      expect(zone!.id).toBe('beach');
    });

    it('should return null for positions outside all zones', () => {
      const zone = zm.getZoneAt(COORDS.nowhere.x, COORDS.nowhere.y);
      expect(zone).toBeNull();
    });

    it('should return each zone for its corresponding coordinates', () => {
      const checks: Array<{ coords: { x: number; y: number }; id: string }> = [
        { coords: COORDS.beach, id: 'beach' },
        { coords: COORDS.village, id: 'village' },
        { coords: COORDS.forest, id: 'forest' },
        { coords: COORDS.cave, id: 'cave' },
        { coords: COORDS.desert, id: 'desert' },
        { coords: COORDS.lavaland, id: 'lavaland' },
        { coords: COORDS.boss, id: 'boss' },
      ];
      for (const check of checks) {
        const zone = zm.getZoneAt(check.coords.x, check.coords.y);
        expect(zone).not.toBeNull();
        expect(zone!.id).toBe(check.id);
      }
    });
  });

  // ==========================================================================
  // getPlayerZone
  // ==========================================================================

  describe('getPlayerZone', () => {
    it('should return null for an unknown player', () => {
      expect(zm.getPlayerZone('unknown-player')).toBeNull();
    });

    it('should return the zone id after the player enters a zone', () => {
      zm.updatePlayerZone('p1', COORDS.forest.x, COORDS.forest.y, 5);
      expect(zm.getPlayerZone('p1')).toBe('forest');
    });

    it('should return null after the player moves outside all zones', () => {
      zm.updatePlayerZone('p1', COORDS.forest.x, COORDS.forest.y, 5);
      zm.updatePlayerZone('p1', COORDS.nowhere.x, COORDS.nowhere.y, 5);
      expect(zm.getPlayerZone('p1')).toBeNull();
    });

    it('should track multiple players independently', () => {
      zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      zm.updatePlayerZone('p2', COORDS.cave.x, COORDS.cave.y, 10);
      expect(zm.getPlayerZone('p1')).toBe('beach');
      expect(zm.getPlayerZone('p2')).toBe('cave');
    });
  });

  // ==========================================================================
  // updatePlayerZone
  // ==========================================================================

  describe('updatePlayerZone', () => {
    it('should report changed=true on first zone entry', () => {
      const result = zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      expect(result.changed).toBe(true);
      expect(result.zone).not.toBeNull();
      expect(result.zone!.id).toBe('beach');
    });

    it('should report changed=false when staying in the same zone', () => {
      zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      const result = zm.updatePlayerZone('p1', COORDS.beach.x + 10, COORDS.beach.y, 1);
      expect(result.changed).toBe(false);
    });

    it('should report changed=true when moving to a different zone', () => {
      zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      const result = zm.updatePlayerZone('p1', COORDS.forest.x, COORDS.forest.y, 5);
      expect(result.changed).toBe(true);
      expect(result.zone!.id).toBe('forest');
    });

    it('should report changed=true when moving from a zone to outside', () => {
      zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      const result = zm.updatePlayerZone('p1', COORDS.nowhere.x, COORDS.nowhere.y, 1);
      expect(result.changed).toBe(true);
      expect(result.zone).toBeNull();
    });

    it('should report changed=true when re-entering a zone from outside', () => {
      zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      zm.updatePlayerZone('p1', COORDS.nowhere.x, COORDS.nowhere.y, 1);
      const result = zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      expect(result.changed).toBe(true);
    });

    it('should return warning=null when player level meets zone minimum', () => {
      const result = zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 5);
      expect(result.changed).toBe(true);
      expect(result.warning).toBeNull();
    });

    it('should return a warning when player is under-leveled for the zone', () => {
      // Cave minLevel is 7; entering at level 1 should produce a warning
      const result = zm.updatePlayerZone('p1', COORDS.cave.x, COORDS.cave.y, 1);
      expect(result.changed).toBe(true);
      expect(result.warning).not.toBeNull();
      expect(result.warning).toContain('Danger');
    });

    it('should return a caution warning for slight under-level', () => {
      // Forest minLevel is 3; entering at level 2 gives diff=1 -> caution
      const result = zm.updatePlayerZone('p1', COORDS.forest.x, COORDS.forest.y, 2);
      expect(result.warning).toContain('Caution');
    });

    it('should return a Warning for moderate under-level', () => {
      // Cave minLevel is 7; entering at level 4 gives diff=3 -> Warning
      const result = zm.updatePlayerZone('p1', COORDS.cave.x, COORDS.cave.y, 4);
      expect(result.warning).toContain('Warning');
    });

    it('should return warning=null when zone is null (no zone at position)', () => {
      const result = zm.updatePlayerZone('p1', COORDS.nowhere.x, COORDS.nowhere.y, 1);
      expect(result.warning).toBeNull();
    });

    it('should return warning=null when zone does not change', () => {
      zm.updatePlayerZone('p1', COORDS.cave.x, COORDS.cave.y, 1);
      // Same zone, still under-leveled, but changed=false so warning is null
      const result = zm.updatePlayerZone('p1', COORDS.cave.x + 5, COORDS.cave.y, 1);
      expect(result.changed).toBe(false);
      expect(result.warning).toBeNull();
    });

    it('should update stored zone id after transition', () => {
      zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      expect(zm.getPlayerZone('p1')).toBe('beach');

      zm.updatePlayerZone('p1', COORDS.desert.x, COORDS.desert.y, 15);
      expect(zm.getPlayerZone('p1')).toBe('desert');
    });
  });

  // ==========================================================================
  // removePlayer
  // ==========================================================================

  describe('removePlayer', () => {
    it('should remove a tracked player', () => {
      zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      expect(zm.getPlayerZone('p1')).toBe('beach');

      zm.removePlayer('p1');
      expect(zm.getPlayerZone('p1')).toBeNull();
    });

    it('should not throw when removing an unknown player', () => {
      expect(() => zm.removePlayer('nonexistent')).not.toThrow();
    });

    it('should not affect other tracked players', () => {
      zm.updatePlayerZone('p1', COORDS.beach.x, COORDS.beach.y, 1);
      zm.updatePlayerZone('p2', COORDS.cave.x, COORDS.cave.y, 10);

      zm.removePlayer('p1');
      expect(zm.getPlayerZone('p1')).toBeNull();
      expect(zm.getPlayerZone('p2')).toBe('cave');
    });
  });

  // ==========================================================================
  // applyRarityBonus
  // ==========================================================================

  describe('applyRarityBonus', () => {
    it('should return baseRoll unchanged when zone is null', () => {
      expect(zm.applyRarityBonus(50, null)).toBe(50);
    });

    it('should add rarity bonus based on zone definition', () => {
      // Lavaland rarityBonus = 0.3, so 50 + (100 * 0.3) = 80
      const result = zm.applyRarityBonus(50, ZONE_DATA.lavaland);
      expect(result).toBe(80);
    });

    it('should apply zero bonus correctly', () => {
      // Village rarityBonus = 0
      const result = zm.applyRarityBonus(50, ZONE_DATA.village);
      expect(result).toBe(50);
    });

    it('should cap the result at 100', () => {
      // Boss rarityBonus = 0.5, so 80 + (100 * 0.5) = 130 -> capped at 100
      const result = zm.applyRarityBonus(80, ZONE_DATA.boss);
      expect(result).toBe(100);
    });

    it('should handle baseRoll of 0', () => {
      // Forest rarityBonus = 0.1, so 0 + (100 * 0.1) = 10
      const result = zm.applyRarityBonus(0, ZONE_DATA.forest);
      expect(result).toBe(10);
    });

    it('should handle baseRoll of 100 and cap correctly', () => {
      const result = zm.applyRarityBonus(100, ZONE_DATA.beach);
      expect(result).toBe(100);
    });
  });

  // ==========================================================================
  // applyGoldBonus
  // ==========================================================================

  describe('applyGoldBonus', () => {
    it('should return baseGold unchanged when zone is null', () => {
      expect(zm.applyGoldBonus(100, null)).toBe(100);
    });

    it('should apply gold bonus from zone definition', () => {
      // Cave goldBonus = 0.2, so floor(100 * 1.2) = 120
      const result = zm.applyGoldBonus(100, ZONE_DATA.cave);
      expect(result).toBe(120);
    });

    it('should apply zero bonus correctly', () => {
      // Village goldBonus = 0, so floor(100 * 1.0) = 100
      const result = zm.applyGoldBonus(100, ZONE_DATA.village);
      expect(result).toBe(100);
    });

    it('should floor the result', () => {
      // Desert goldBonus = 0.25, so floor(33 * 1.25) = floor(41.25) = 41
      const result = zm.applyGoldBonus(33, ZONE_DATA.desert);
      expect(result).toBe(41);
    });

    it('should handle baseGold of 0', () => {
      const result = zm.applyGoldBonus(0, ZONE_DATA.boss);
      expect(result).toBe(0);
    });

    it('should handle large gold amounts', () => {
      // Boss goldBonus = 0.5, so floor(1000 * 1.5) = 1500
      const result = zm.applyGoldBonus(1000, ZONE_DATA.boss);
      expect(result).toBe(1500);
    });
  });

  // ==========================================================================
  // applyXpBonus
  // ==========================================================================

  describe('applyXpBonus', () => {
    it('should return baseXp unchanged when zone is null', () => {
      expect(zm.applyXpBonus(200, null)).toBe(200);
    });

    it('should apply XP bonus from zone definition', () => {
      // Lavaland xpBonus = 0.3, so floor(200 * 1.3) = 260
      const result = zm.applyXpBonus(200, ZONE_DATA.lavaland);
      expect(result).toBe(260);
    });

    it('should apply zero bonus correctly', () => {
      // Village xpBonus = 0, so floor(200 * 1.0) = 200
      const result = zm.applyXpBonus(200, ZONE_DATA.village);
      expect(result).toBe(200);
    });

    it('should floor the result', () => {
      // Forest xpBonus = 0.1, so floor(55 * 1.1) = floor(60.5) = 60
      const result = zm.applyXpBonus(55, ZONE_DATA.forest);
      expect(result).toBe(60);
    });

    it('should handle baseXp of 0', () => {
      const result = zm.applyXpBonus(0, ZONE_DATA.boss);
      expect(result).toBe(0);
    });

    it('should apply boss zone bonus correctly', () => {
      // Boss xpBonus = 0.5, so floor(100 * 1.5) = 150
      const result = zm.applyXpBonus(100, ZONE_DATA.boss);
      expect(result).toBe(150);
    });
  });

  // ==========================================================================
  // modifyDropTable
  // ==========================================================================

  describe('modifyDropTable', () => {
    it('should return drops unchanged when zone is null', () => {
      const drops = { flask: 50, sword1: 10 };
      const result = zm.modifyDropTable(drops, null);
      expect(result).toEqual(drops);
    });

    it('should return the same object reference when zone is null', () => {
      const drops = { flask: 50 };
      const result = zm.modifyDropTable(drops, null);
      expect(result).toBe(drops);
    });

    it('should boost armor drop chances using armorDropBonus', () => {
      // Cave armorDropBonus = 0.15
      const drops = { leatherarmor: 20 };
      const result = zm.modifyDropTable(drops, ZONE_DATA.cave);
      // 20 * (1 + 0.15) = 23
      expect(result.leatherarmor).toBe(23);
    });

    it('should boost weapon drop chances using weaponDropBonus', () => {
      // Lavaland weaponDropBonus = 0.25
      const drops = { sword2: 40 };
      const result = zm.modifyDropTable(drops, ZONE_DATA.lavaland);
      // 40 * (1 + 0.25) = 50
      expect(result.sword2).toBe(50);
    });

    it('should not modify items that are neither armor nor weapon', () => {
      // flask is an object, not armor or weapon
      const drops = { flask: 50 };
      const result = zm.modifyDropTable(drops, ZONE_DATA.boss);
      expect(result.flask).toBe(50);
    });

    it('should cap modified chances at 100', () => {
      // Boss weaponDropBonus = 0.3, so 90 * 1.3 = 117 -> capped at 100
      const drops = { sword1: 90 };
      const result = zm.modifyDropTable(drops, ZONE_DATA.boss);
      expect(result.sword1).toBe(100);
    });

    it('should handle unknown item names (not in kinds registry)', () => {
      const drops = { unknownItem: 30 };
      const result = zm.modifyDropTable(drops, ZONE_DATA.boss);
      // getKindFromString returns undefined, so no bonus applied
      expect(result.unknownItem).toBe(30);
    });

    it('should handle an empty drop table', () => {
      const drops: Record<string, number> = {};
      const result = zm.modifyDropTable(drops, ZONE_DATA.forest);
      expect(result).toEqual({});
    });

    it('should handle mixed armor, weapon, and other items', () => {
      // Desert: armorDropBonus = 0.1, weaponDropBonus = 0.15
      const drops = {
        platearmor: 10,  // armor
        axe: 20,         // weapon
        flask: 50,       // object
      };
      const result = zm.modifyDropTable(drops, ZONE_DATA.desert);
      expect(result.platearmor).toBe(Math.min(100, 10 * (1 + 0.1)));   // 11
      expect(result.axe).toBe(Math.min(100, 20 * (1 + 0.15)));         // 23
      expect(result.flask).toBe(50);                                     // unchanged
    });

    it('should not mutate the original drops object', () => {
      const drops = { sword1: 20 };
      zm.modifyDropTable(drops, ZONE_DATA.cave);
      expect(drops.sword1).toBe(20);
    });

    it('should handle zero bonus multipliers', () => {
      // Village: armorDropBonus = 0, weaponDropBonus = 0
      const drops = { clotharmor: 30, sword1: 40 };
      const result = zm.modifyDropTable(drops, ZONE_DATA.village);
      expect(result.clotharmor).toBe(30);
      expect(result.sword1).toBe(40);
    });
  });

  // ==========================================================================
  // createZoneEnterMessage
  // ==========================================================================

  describe('createZoneEnterMessage', () => {
    it('should create a properly formatted enter message without warning', () => {
      const msg = zm.createZoneEnterMessage(ZONE_DATA.forest, null);
      expect(msg).toEqual([
        Types.Messages.ZONE_ENTER,
        'forest',
        'Glitch Woods',
        3,   // minLevel
        7,   // maxLevel
        null,
      ]);
    });

    it('should include warning string when provided', () => {
      const warning = 'Danger! Too dangerous';
      const msg = zm.createZoneEnterMessage(ZONE_DATA.lavaland, warning);
      expect(msg[0]).toBe(Types.Messages.ZONE_ENTER);
      expect(msg[1]).toBe('lavaland');
      expect(msg[2]).toBe('The Core Breach');
      expect(msg[3]).toBe(15);  // minLevel
      expect(msg[4]).toBe(35);  // maxLevel
      expect(msg[5]).toBe(warning);
    });

    it('should include correct data for each zone', () => {
      for (const zoneId of ['beach', 'village', 'cave', 'desert', 'boss']) {
        const zone = ZONE_DATA[zoneId];
        const msg = zm.createZoneEnterMessage(zone, null);
        expect(msg[0]).toBe(Types.Messages.ZONE_ENTER);
        expect(msg[1]).toBe(zone.id);
        expect(msg[2]).toBe(zone.name);
        expect(msg[3]).toBe(zone.minLevel);
        expect(msg[4]).toBe(zone.maxLevel);
        expect(msg[5]).toBeNull();
      }
    });
  });

  // ==========================================================================
  // createZoneInfoMessage
  // ==========================================================================

  describe('createZoneInfoMessage', () => {
    it('should create a properly formatted info message', () => {
      const msg = zm.createZoneInfoMessage(ZONE_DATA.cave);
      expect(msg).toEqual([
        Types.Messages.ZONE_INFO,
        'cave',
        15,  // rarityBonus 0.15 * 100 rounded
        20,  // goldBonus 0.2 * 100 rounded
        15,  // xpBonus 0.15 * 100 rounded
      ]);
    });

    it('should convert bonuses to percentages and round', () => {
      const msg = zm.createZoneInfoMessage(ZONE_DATA.beach);
      // beach: rarityBonus=0.05, goldBonus=0.1, xpBonus=0.05
      expect(msg[2]).toBe(5);
      expect(msg[3]).toBe(10);
      expect(msg[4]).toBe(5);
    });

    it('should return zero percentages for village (no bonuses)', () => {
      const msg = zm.createZoneInfoMessage(ZONE_DATA.village);
      expect(msg[2]).toBe(0);
      expect(msg[3]).toBe(0);
      expect(msg[4]).toBe(0);
    });

    it('should return high percentages for boss zone', () => {
      const msg = zm.createZoneInfoMessage(ZONE_DATA.boss);
      // boss: rarityBonus=0.5, goldBonus=0.5, xpBonus=0.5
      expect(msg[2]).toBe(50);
      expect(msg[3]).toBe(50);
      expect(msg[4]).toBe(50);
    });
  });

  // ==========================================================================
  // getZoneManager (singleton)
  // ==========================================================================

  describe('getZoneManager', () => {
    it('should return a ZoneManager instance', () => {
      const mgr = getZoneManager();
      expect(mgr).toBeInstanceOf(ZoneManager);
    });

    it('should return the same instance on repeated calls', () => {
      const mgr1 = getZoneManager();
      const mgr2 = getZoneManager();
      expect(mgr1).toBe(mgr2);
    });
  });
});
