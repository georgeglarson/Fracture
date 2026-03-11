/**
 * Tests for ZoneHandler
 * Covers: checkZoneChange, getCurrentZone, isInDangerZone,
 *         getZoneXPBonus, getZoneGoldBonus, getZoneDropBonus,
 *         zone boundary detection, zone callback triggering, edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZoneManager } from '../zones/zone-manager';
import { ZONE_DATA, ZoneDefinition } from '../../../shared/ts/zones/zone-data';
import {
  checkZoneChange,
  getCurrentZone,
  isInDangerZone,
  getZoneXPBonus,
  getZoneGoldBonus,
  getZoneDropBonus,
  ZonePlayerContext,
} from '../player/zone.handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockZoneManager(): ZoneManager {
  return new ZoneManager();
}

function makeMockCtx(overrides?: Partial<ZonePlayerContext>): ZonePlayerContext {
  const zoneManager = createMockZoneManager();

  return {
    id: 1,
    name: 'TestPlayer',
    level: 10,
    send: vi.fn(),

    getWorld: () => ({
      zoneManager,
    }),

    ...overrides,
  };
}

// Known zone coordinates (derived from ZONE_DATA definitions)
const COORDS = {
  beach:    { x: 50, y: 280 },   // y: 253-314
  village:  { x: 50, y: 220 },   // y: 195-253
  forest:   { x: 50, y: 170 },   // y: 145-195
  cave:     { x: 50, y: 120 },   // y: 100-145
  desert:   { x: 50, y: 80 },    // y: 60-100
  lavaland: { x: 50, y: 30 },    // y: 0-60
  boss:     { x: 150, y: 55 },   // x: 140-169, y: 48-73 (within lavaland)
  nowhere:  { x: 1000, y: 1000 }, // Outside all zones
};

// ==========================================================================
// Tests
// ==========================================================================

describe('ZoneHandler', () => {
  let ctx: ZonePlayerContext;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  // ========================================================================
  // checkZoneChange
  // ========================================================================

  describe('checkZoneChange', () => {
    it('should send zone enter message when entering a zone for the first time', () => {
      checkZoneChange(ctx, COORDS.beach.x, COORDS.beach.y);

      expect(ctx.send).toHaveBeenCalled();
      // Two messages: zone enter + zone info
      expect(ctx.send).toHaveBeenCalledTimes(2);
    });

    it('should NOT send messages when staying in the same zone', () => {
      // Enter beach
      checkZoneChange(ctx, COORDS.beach.x, COORDS.beach.y);
      vi.mocked(ctx.send).mockClear();

      // Move within beach
      checkZoneChange(ctx, COORDS.beach.x + 10, COORDS.beach.y + 5);

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should send messages when moving to a different zone', () => {
      // Enter beach
      checkZoneChange(ctx, COORDS.beach.x, COORDS.beach.y);
      vi.mocked(ctx.send).mockClear();

      // Move to forest
      checkZoneChange(ctx, COORDS.forest.x, COORDS.forest.y);

      expect(ctx.send).toHaveBeenCalled();
    });

    it('should send zone enter message with zone details', () => {
      checkZoneChange(ctx, COORDS.forest.x, COORDS.forest.y);

      const calls = vi.mocked(ctx.send).mock.calls;
      // First call is the zone enter message
      const enterMsg = calls[0][0];
      expect(enterMsg).toContain(ZONE_DATA.forest.id);
      expect(enterMsg).toContain(ZONE_DATA.forest.name);
    });

    it('should send zone info message with bonus percentages', () => {
      checkZoneChange(ctx, COORDS.forest.x, COORDS.forest.y);

      const calls = vi.mocked(ctx.send).mock.calls;
      // Second call is the zone info message
      const infoMsg = calls[1][0];
      expect(infoMsg).toContain(ZONE_DATA.forest.id);
    });

    it('should include level warning when player is under-leveled', () => {
      const lowLevelCtx = makeMockCtx({ level: 1 });

      // Enter cave (minLevel 7) with level 1 player
      checkZoneChange(lowLevelCtx, COORDS.cave.x, COORDS.cave.y);

      const calls = vi.mocked(lowLevelCtx.send).mock.calls;
      const enterMsg = calls[0][0];
      // The warning should be a non-null string
      expect(enterMsg[enterMsg.length - 1]).not.toBeNull();
    });

    it('should NOT include level warning when player is at-level', () => {
      const highLevelCtx = makeMockCtx({ level: 15 });

      // Enter cave (minLevel 7) with level 15 player
      checkZoneChange(highLevelCtx, COORDS.cave.x, COORDS.cave.y);

      const calls = vi.mocked(highLevelCtx.send).mock.calls;
      const enterMsg = calls[0][0];
      // The warning should be null (last element)
      expect(enterMsg[enterMsg.length - 1]).toBeNull();
    });

    it('should handle moving from zone to no-zone (outside map bounds)', () => {
      // Enter beach first
      checkZoneChange(ctx, COORDS.beach.x, COORDS.beach.y);
      vi.mocked(ctx.send).mockClear();

      // Move outside all zones
      checkZoneChange(ctx, COORDS.nowhere.x, COORDS.nowhere.y);

      // Zone changed (from beach to null) but no zone enter message is sent
      // because result.zone is null
      // The function only sends messages when result.zone is truthy
      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should send messages when re-entering a zone from outside', () => {
      // Enter beach
      checkZoneChange(ctx, COORDS.beach.x, COORDS.beach.y);
      vi.mocked(ctx.send).mockClear();

      // Leave to nowhere
      checkZoneChange(ctx, COORDS.nowhere.x, COORDS.nowhere.y);
      vi.mocked(ctx.send).mockClear();

      // Re-enter beach
      checkZoneChange(ctx, COORDS.beach.x, COORDS.beach.y);

      expect(ctx.send).toHaveBeenCalled();
    });

    it('should detect zone transitions through multiple zones', () => {
      // Walk from beach through village, forest, cave
      const zones = [
        { coords: COORDS.beach, id: 'beach' },
        { coords: COORDS.village, id: 'village' },
        { coords: COORDS.forest, id: 'forest' },
        { coords: COORDS.cave, id: 'cave' },
      ];

      for (const zone of zones) {
        vi.mocked(ctx.send).mockClear();
        checkZoneChange(ctx, zone.coords.x, zone.coords.y);
        // Each zone transition should trigger messages
        expect(ctx.send).toHaveBeenCalled();
      }
    });
  });

  // ========================================================================
  // getCurrentZone
  // ========================================================================

  describe('getCurrentZone', () => {
    it('should return the zone at beach coordinates', () => {
      const zone = getCurrentZone(ctx, COORDS.beach.x, COORDS.beach.y);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('beach');
    });

    it('should return the zone at forest coordinates', () => {
      const zone = getCurrentZone(ctx, COORDS.forest.x, COORDS.forest.y);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('forest');
    });

    it('should return the zone at cave coordinates', () => {
      const zone = getCurrentZone(ctx, COORDS.cave.x, COORDS.cave.y);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('cave');
    });

    it('should return the zone at desert coordinates', () => {
      const zone = getCurrentZone(ctx, COORDS.desert.x, COORDS.desert.y);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('desert');
    });

    it('should return the zone at lavaland coordinates', () => {
      const zone = getCurrentZone(ctx, COORDS.lavaland.x, COORDS.lavaland.y);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('lavaland');
    });

    it('should return the boss zone at boss coordinates (overlaps lavaland)', () => {
      const zone = getCurrentZone(ctx, COORDS.boss.x, COORDS.boss.y);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('boss');
    });

    it('should return null for coordinates outside all zones', () => {
      const zone = getCurrentZone(ctx, COORDS.nowhere.x, COORDS.nowhere.y);
      expect(zone).toBeNull();
    });
  });

  // ========================================================================
  // Zone boundary detection
  // ========================================================================

  describe('zone boundary detection', () => {
    it('should detect zone at lower boundary of beach', () => {
      // Bottom of beach area: y = 253 (inclusive start)
      const zone = getCurrentZone(ctx, 50, 253);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('beach');
    });

    it('should detect zone at upper boundary of beach', () => {
      // Top of beach area: y = 313 (just inside)
      const zone = getCurrentZone(ctx, 50, 313);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('beach');
    });

    it('should detect boundary between beach and village', () => {
      // Just inside village (y = 252, which is 195+57)
      const villageZone = getCurrentZone(ctx, 50, 252);
      expect(villageZone).not.toBeNull();
      expect(villageZone.id).toBe('village');

      // Just inside beach (y = 253)
      const beachZone = getCurrentZone(ctx, 50, 253);
      expect(beachZone).not.toBeNull();
      expect(beachZone.id).toBe('beach');
    });

    it('should detect boss zone taking priority over lavaland', () => {
      // Boss area overlaps lavaland: x: 140-169, y: 48-73
      const bossZone = getCurrentZone(ctx, 145, 50);
      expect(bossZone).not.toBeNull();
      expect(bossZone.id).toBe('boss');

      // Just outside boss area but in lavaland
      const lavaZone = getCurrentZone(ctx, 10, 30);
      expect(lavaZone).not.toBeNull();
      expect(lavaZone.id).toBe('lavaland');
    });

    it('should handle left boundary of zones (x = 0)', () => {
      const zone = getCurrentZone(ctx, 0, 280);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('beach');
    });

    it('should handle right boundary of zones (x = 171)', () => {
      const zone = getCurrentZone(ctx, 171, 280);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('beach');
    });

    it('should return null just outside zone boundaries', () => {
      // x = 172 is outside all zones (zone width is 172, x range: 0-171)
      const zone = getCurrentZone(ctx, 172, 280);
      expect(zone).toBeNull();
    });
  });

  // ========================================================================
  // isInDangerZone
  // ========================================================================

  describe('isInDangerZone', () => {
    it('should return true when player level is below zone minLevel', () => {
      const lowLevelCtx = makeMockCtx({ level: 1 });
      // Cave minLevel is 7
      expect(isInDangerZone(lowLevelCtx, COORDS.cave.x, COORDS.cave.y)).toBe(true);
    });

    it('should return false when player level is at zone minLevel', () => {
      const atLevelCtx = makeMockCtx({ level: 7 });
      expect(isInDangerZone(atLevelCtx, COORDS.cave.x, COORDS.cave.y)).toBe(false);
    });

    it('should return false when player level is above zone minLevel', () => {
      const highLevelCtx = makeMockCtx({ level: 20 });
      expect(isInDangerZone(highLevelCtx, COORDS.cave.x, COORDS.cave.y)).toBe(false);
    });

    it('should return false when outside all zones', () => {
      expect(isInDangerZone(ctx, COORDS.nowhere.x, COORDS.nowhere.y)).toBe(false);
    });

    it('should detect danger in boss zone for low-level player', () => {
      const lowCtx = makeMockCtx({ level: 10 });
      // Boss minLevel is 25
      expect(isInDangerZone(lowCtx, COORDS.boss.x, COORDS.boss.y)).toBe(true);
    });

    it('should not detect danger in beach for level 1 player', () => {
      const newCtx = makeMockCtx({ level: 1 });
      // Beach minLevel is 1
      expect(isInDangerZone(newCtx, COORDS.beach.x, COORDS.beach.y)).toBe(false);
    });
  });

  // ========================================================================
  // getZoneXPBonus
  // ========================================================================

  describe('getZoneXPBonus', () => {
    it('should return zone xpBonus for a valid zone', () => {
      const bonus = getZoneXPBonus(ctx, COORDS.forest.x, COORDS.forest.y);
      expect(bonus).toBe(ZONE_DATA.forest.xpBonus);
    });

    it('should return 1.0 when outside all zones', () => {
      const bonus = getZoneXPBonus(ctx, COORDS.nowhere.x, COORDS.nowhere.y);
      expect(bonus).toBe(1.0);
    });

    it('should return village xpBonus (0)', () => {
      const bonus = getZoneXPBonus(ctx, COORDS.village.x, COORDS.village.y);
      // Village has xpBonus = 0, so || 1.0 returns 1.0
      expect(bonus).toBe(1.0);
    });

    it('should return higher bonus for more dangerous zones', () => {
      const beachBonus = getZoneXPBonus(ctx, COORDS.beach.x, COORDS.beach.y);
      const lavaBonus = getZoneXPBonus(ctx, COORDS.lavaland.x, COORDS.lavaland.y);
      expect(lavaBonus).toBeGreaterThan(beachBonus);
    });

    it('should return boss zone xpBonus', () => {
      const bonus = getZoneXPBonus(ctx, COORDS.boss.x, COORDS.boss.y);
      expect(bonus).toBe(ZONE_DATA.boss.xpBonus);
    });
  });

  // ========================================================================
  // getZoneGoldBonus
  // ========================================================================

  describe('getZoneGoldBonus', () => {
    it('should return zone goldBonus for a valid zone', () => {
      const bonus = getZoneGoldBonus(ctx, COORDS.cave.x, COORDS.cave.y);
      expect(bonus).toBe(ZONE_DATA.cave.goldBonus);
    });

    it('should return 1.0 when outside all zones', () => {
      const bonus = getZoneGoldBonus(ctx, COORDS.nowhere.x, COORDS.nowhere.y);
      expect(bonus).toBe(1.0);
    });

    it('should return higher bonus for more dangerous zones', () => {
      const forestBonus = getZoneGoldBonus(ctx, COORDS.forest.x, COORDS.forest.y);
      const bossBonus = getZoneGoldBonus(ctx, COORDS.boss.x, COORDS.boss.y);
      expect(bossBonus).toBeGreaterThan(forestBonus);
    });
  });

  // ========================================================================
  // getZoneDropBonus
  // ========================================================================

  describe('getZoneDropBonus', () => {
    it('should return 1.0 when outside all zones', () => {
      const bonus = getZoneDropBonus(ctx, COORDS.nowhere.x, COORDS.nowhere.y);
      expect(bonus).toBe(1.0);
    });

    it('should return 1.0 for zone with no dropBonus property', () => {
      // Zone definitions do not have a dropBonus field in zone-data,
      // so the handler falls back to 1.0
      const bonus = getZoneDropBonus(ctx, COORDS.beach.x, COORDS.beach.y);
      expect(bonus).toBe(1.0);
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe('edge cases', () => {
    it('should handle same zone re-check without triggering change', () => {
      checkZoneChange(ctx, COORDS.beach.x, COORDS.beach.y);
      const firstCallCount = vi.mocked(ctx.send).mock.calls.length;

      checkZoneChange(ctx, COORDS.beach.x, COORDS.beach.y);
      const secondCallCount = vi.mocked(ctx.send).mock.calls.length;

      // No additional calls
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('should handle negative coordinates (outside all zones)', () => {
      const zone = getCurrentZone(ctx, -10, -10);
      expect(zone).toBeNull();
    });

    it('should handle very large coordinates (outside all zones)', () => {
      const zone = getCurrentZone(ctx, 99999, 99999);
      expect(zone).toBeNull();
    });

    it('should handle zero coordinates (lavaland top-left corner)', () => {
      const zone = getCurrentZone(ctx, 0, 0);
      expect(zone).not.toBeNull();
      expect(zone.id).toBe('lavaland');
    });

    it('should handle multiple players entering zones independently', () => {
      const ctx1 = makeMockCtx({ id: 1, name: 'Player1' });
      const ctx2 = makeMockCtx({ id: 2, name: 'Player2' });

      // They share the same ZoneManager since they share the same world
      // But in tests each has their own, so they are independent
      checkZoneChange(ctx1, COORDS.beach.x, COORDS.beach.y);
      checkZoneChange(ctx2, COORDS.forest.x, COORDS.forest.y);

      expect(ctx1.send).toHaveBeenCalled();
      expect(ctx2.send).toHaveBeenCalled();
    });

    it('should correctly identify all zones by their coordinates', () => {
      const zoneChecks = [
        { coords: COORDS.beach, expectedId: 'beach' },
        { coords: COORDS.village, expectedId: 'village' },
        { coords: COORDS.forest, expectedId: 'forest' },
        { coords: COORDS.cave, expectedId: 'cave' },
        { coords: COORDS.desert, expectedId: 'desert' },
        { coords: COORDS.lavaland, expectedId: 'lavaland' },
        { coords: COORDS.boss, expectedId: 'boss' },
      ];

      for (const check of zoneChecks) {
        const zone = getCurrentZone(ctx, check.coords.x, check.coords.y);
        expect(zone).not.toBeNull();
        expect(zone.id).toBe(check.expectedId);
      }
    });
  });
});
