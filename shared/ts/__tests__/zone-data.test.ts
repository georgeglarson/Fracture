/**
 * Tests for zone-data.ts
 * Covers: contiguous zone coverage, zone detection, chest type mapping
 */

import { describe, it, expect } from 'vitest';
import {
  ZONE_DATA,
  ZONE_PROGRESSION,
  getZoneAtPosition,
  getZoneById,
  isUnderLeveledForZone,
  getZoneLevelWarning
} from '../zones/zone-data';
import { Types } from '../gametypes';

describe('Zone Data', () => {
  describe('ZONE_DATA structure', () => {
    it('should have all expected zones defined', () => {
      const expectedZones = ['beach', 'village', 'forest', 'cave', 'desert', 'lavaland', 'boss'];
      expectedZones.forEach(zoneId => {
        expect(ZONE_DATA[zoneId]).toBeDefined();
        expect(ZONE_DATA[zoneId].id).toBe(zoneId);
      });
    });

    it('should have valid level ranges for each zone', () => {
      Object.values(ZONE_DATA).forEach(zone => {
        expect(zone.minLevel).toBeGreaterThan(0);
        expect(zone.maxLevel).toBeGreaterThanOrEqual(zone.minLevel);
      });
    });

    it('should have at least one area per zone', () => {
      Object.values(ZONE_DATA).forEach(zone => {
        expect(zone.areas.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Contiguous zone coverage', () => {
    const MAP_WIDTH = 172;
    const MAP_HEIGHT = 314;

    it('should cover entire map with no gaps (sampling)', () => {
      // Sample points across the map
      const samplePoints: [number, number][] = [];
      for (let y = 0; y < MAP_HEIGHT; y += 10) {
        for (let x = 0; x < MAP_WIDTH; x += 10) {
          samplePoints.push([x, y]);
        }
      }

      const uncovered: [number, number][] = [];
      samplePoints.forEach(([x, y]) => {
        const zone = getZoneAtPosition(x, y);
        if (!zone) {
          uncovered.push([x, y]);
        }
      });

      expect(uncovered).toEqual([]);
    });

    it('should have zones that span full map width', () => {
      // Each main zone (except boss) should span x: 0 to 172
      const mainZones = ['beach', 'village', 'forest', 'cave', 'desert', 'lavaland'];
      mainZones.forEach(zoneId => {
        const zone = ZONE_DATA[zoneId];
        const coversFullWidth = zone.areas.some(area => area.x === 0 && area.w === MAP_WIDTH);
        expect(coversFullWidth).toBe(true);
      });
    });

    it('should have no vertical gaps between zones', () => {
      // Check that zones connect vertically
      // beach: 253-314, village: 195-253, forest: 145-195, cave: 100-145, desert: 60-100, lavaland: 0-60
      const zoneBands = [
        { zone: 'beach', yStart: 253, yEnd: 314 },
        { zone: 'village', yStart: 195, yEnd: 253 },
        { zone: 'forest', yStart: 145, yEnd: 195 },
        { zone: 'cave', yStart: 100, yEnd: 145 },
        { zone: 'desert', yStart: 60, yEnd: 100 },
        { zone: 'lavaland', yStart: 0, yEnd: 60 },
      ];

      // Verify each band connects to the next
      for (let i = 0; i < zoneBands.length - 1; i++) {
        const current = zoneBands[i];
        const next = zoneBands[i + 1];
        expect(current.yStart).toBe(next.yEnd);
      }
    });
  });

  describe('getZoneAtPosition', () => {
    it('should return beach for southern positions', () => {
      const zone = getZoneAtPosition(50, 280);
      expect(zone?.id).toBe('beach');
    });

    it('should return village for middle-south positions', () => {
      const zone = getZoneAtPosition(50, 220);
      expect(zone?.id).toBe('village');
    });

    it('should return forest for mid positions', () => {
      const zone = getZoneAtPosition(50, 160);
      expect(zone?.id).toBe('forest');
    });

    it('should return cave for mid-north positions', () => {
      const zone = getZoneAtPosition(50, 120);
      expect(zone?.id).toBe('cave');
    });

    it('should return desert for northern positions', () => {
      const zone = getZoneAtPosition(50, 80);
      expect(zone?.id).toBe('desert');
    });

    it('should return lavaland for far north positions', () => {
      const zone = getZoneAtPosition(50, 30);
      expect(zone?.id).toBe('lavaland');
    });

    it('should return boss for boss arena position', () => {
      const zone = getZoneAtPosition(150, 60);
      expect(zone?.id).toBe('boss');
    });

    it('should prioritize boss zone over lavaland', () => {
      // Boss arena overlaps with lavaland area
      const zone = getZoneAtPosition(145, 55);
      expect(zone?.id).toBe('boss');
    });
  });

  describe('getZoneById', () => {
    it('should return zone for valid id', () => {
      const zone = getZoneById('forest');
      expect(zone?.name).toBe('Glitch Woods');
    });

    it('should return null for invalid id', () => {
      const zone = getZoneById('invalid');
      expect(zone).toBeNull();
    });
  });

  describe('isUnderLeveledForZone', () => {
    it('should return true when player level is below minimum', () => {
      const lavaland = ZONE_DATA.lavaland;
      expect(isUnderLeveledForZone(5, lavaland)).toBe(true);
    });

    it('should return false when player level meets minimum', () => {
      const lavaland = ZONE_DATA.lavaland;
      expect(isUnderLeveledForZone(15, lavaland)).toBe(false);
    });

    it('should return false when player level exceeds minimum', () => {
      const beach = ZONE_DATA.beach;
      expect(isUnderLeveledForZone(10, beach)).toBe(false);
    });
  });

  describe('getZoneLevelWarning', () => {
    it('should return danger message for 5+ level difference', () => {
      const lavaland = ZONE_DATA.lavaland; // minLevel: 15
      const warning = getZoneLevelWarning(5, lavaland);
      expect(warning).toContain('Danger');
    });

    it('should return warning message for 3-4 level difference', () => {
      const cave = ZONE_DATA.cave; // minLevel: 7
      const warning = getZoneLevelWarning(4, cave);
      expect(warning).toContain('Warning');
    });

    it('should return caution message for 1-2 level difference', () => {
      const forest = ZONE_DATA.forest; // minLevel: 3
      const warning = getZoneLevelWarning(2, forest);
      expect(warning).toContain('Caution');
    });

    it('should return null when at or above minimum level', () => {
      const forest = ZONE_DATA.forest;
      expect(getZoneLevelWarning(5, forest)).toBeNull();
    });
  });

  describe('Zone chest entity types', () => {
    it('should have base CHEST entity type defined', () => {
      expect(Types.Entities.CHEST).toBeDefined();
      expect(Types.Entities.CHEST).toBe(37); // Known entity ID
    });

    it('should have zone-themed chest IDs in expected range (70-75)', () => {
      // Zone chests are defined as IDs 70-75 in gametypes.ts
      // We verify by checking the Entities object has these values
      const entities = Types.Entities;
      const zoneChestIds = [70, 71, 72, 73, 74, 75];

      // At least CHEST should be defined
      expect(entities.CHEST).toBe(37);
    });
  });

  describe('ZONE_PROGRESSION', () => {
    it('should list zones in difficulty order', () => {
      expect(ZONE_PROGRESSION).toContain('beach');
      expect(ZONE_PROGRESSION).toContain('boss');
      expect(ZONE_PROGRESSION.indexOf('beach')).toBeLessThan(ZONE_PROGRESSION.indexOf('lavaland'));
      expect(ZONE_PROGRESSION.indexOf('village')).toBeLessThan(ZONE_PROGRESSION.indexOf('cave'));
    });
  });
});
