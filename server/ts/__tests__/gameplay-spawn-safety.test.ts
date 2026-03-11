/**
 * Gameplay Integration Tests — Spawn Safety
 *
 * Tests the full spawn-to-combat experience using the AggroPolicy:
 *   1. Village zone mobs are passive (replaces safe zone bounding box)
 *   2. Aggro tick respects spawn protection and phase
 *   3. Mob density near starting areas stays reasonable
 *   4. Density cap prevents swarming
 *   5. Zone transitions create graduated difficulty
 *
 * These are the kinds of tests you write when a player reports
 * "rats swarmed from everywhere and killed me on spawn."
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Utils } from '../utils';
import { evaluateAggro, type AggroContext } from '../combat/aggro-policy';

// =========================================================================
// Helpers
// =========================================================================

interface FakeMob {
  id: number;
  kind: string;
  x: number;
  y: number;
  spawningX: number;
  spawningY: number;
  aggroRange: number;
  level: number;
  zoneId: string | null;
  isDead: boolean;
  target: number | null;
  hasTarget(): boolean;
}

function createMob(
  id: number, kind: string, x: number, y: number,
  aggroRange: number, level: number = 1, zoneId: string | null = null,
): FakeMob {
  return {
    id, kind, x, y,
    spawningX: x, spawningY: y,
    aggroRange, level, zoneId,
    isDead: false, target: null,
    hasTarget() { return this.target !== null; },
  };
}

interface FakePlayer {
  id: number;
  name: string;
  x: number;
  y: number;
  level: number;
  isDead: boolean;
  spawnProtectionUntil: number;
  isPhased: boolean;
}

function createPlayer(
  id: number, name: string, x: number, y: number, level: number = 1,
): FakePlayer {
  return {
    id, name, x, y, level,
    isDead: false,
    spawnProtectionUntil: 0,
    isPhased: false,
  };
}

// Production rat spawn areas (from world_server.json, post-density-fix)
const PRODUCTION_RAT_AREAS = [
  { id: 0, x: 10, y: 206, w: 13, h: 7, count: 2 },
  { id: 1, x: 39, y: 206, w: 8, h: 9, count: 2 },
  { id: 2, x: 31, y: 218, w: 20, h: 9, count: 2 },
  { id: 3, x: 6, y: 223, w: 15, h: 5, count: 2 },
  { id: 7, x: 6, y: 243, w: 8, h: 8, count: 2 },
  { id: 8, x: 66, y: 221, w: 9, h: 6, count: 2 },
  { id: 19, x: 32, y: 231, w: 13, h: 6, count: 2 },
  { id: 20, x: 46, y: 242, w: 9, h: 9, count: 2 },
  { id: 21, x: 16, y: 235, w: 10, h: 4, count: 2 },
  { id: 22, x: 58, y: 230, w: 2, h: 4, count: 1 },
];

/**
 * Simulate one aggro tick — mirrors the production aggro loop in world.ts
 * but uses evaluateAggro directly (same as production code does).
 */
function simulateAggroTick(
  mobs: FakeMob[],
  players: FakePlayer[],
  /** Simulated aggro count per player (from CombatTracker) */
  aggroCountByPlayer: Record<number, number> = {},
): Array<{ mobId: number; playerId: number; distance: number }> {
  const results: Array<{ mobId: number; playerId: number; distance: number }> = [];

  for (const mob of mobs) {
    if (mob.isDead || !mob.aggroRange || mob.aggroRange <= 0) continue;
    if (mob.hasTarget()) continue;

    let closestPlayer: FakePlayer | null = null;
    let closestDistance = mob.aggroRange;

    for (const player of players) {
      if (!player || player.isDead) continue;
      if (player.spawnProtectionUntil && Date.now() < player.spawnProtectionUntil) continue;
      if (player.isPhased) continue;

      const distance = Utils.distanceTo(mob.x, mob.y, player.x, player.y);

      const decision = evaluateAggro({
        mobX: mob.x,
        mobY: mob.y,
        mobSpawnX: mob.spawningX,
        mobSpawnY: mob.spawningY,
        mobLevel: mob.level,
        mobAggroRange: mob.aggroRange,
        mobZoneId: mob.zoneId,
        playerX: player.x,
        playerY: player.y,
        playerLevel: player.level,
        distance,
        currentAggroOnPlayer: aggroCountByPlayer[player.id] ?? 0,
      });

      if (decision.shouldAggro && distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    }

    if (closestPlayer) {
      // Track aggro count for density cap
      aggroCountByPlayer[closestPlayer.id] = (aggroCountByPlayer[closestPlayer.id] ?? 0) + 1;
      results.push({
        mobId: mob.id,
        playerId: closestPlayer.id,
        distance: closestDistance,
      });
    }
  }

  return results;
}

// =========================================================================
// Test Suite
// =========================================================================

describe('Gameplay: Spawn Safety', () => {

  // -----------------------------------------------------------------------
  // 1. Village Zone Passivity (replaces safe zone bounding box)
  // -----------------------------------------------------------------------
  describe('village zone passivity', () => {
    it('should NOT aggro a player standing in the village', () => {
      // Rat in village zone, player right next to it
      const player = createPlayer(1, 'NewPlayer', 40, 215);
      const rat = createMob(100, 'rat', 41, 215, 3, 1, 'village');

      const results = simulateAggroTick([rat], [player]);
      expect(results).toHaveLength(0);
    });

    it('should be passive for ALL village mobs regardless of distance', () => {
      const player = createPlayer(1, 'NewPlayer', 40, 210);
      const mobs = [
        createMob(100, 'rat', 40, 210, 3, 1, 'village'), // same tile
        createMob(101, 'rat', 41, 210, 3, 1, 'village'), // 1 tile
        createMob(102, 'rat', 42, 210, 3, 1, 'village'), // 2 tiles
      ];

      const results = simulateAggroTick(mobs, [player]);
      expect(results).toHaveLength(0);
    });

    it('all starting area rat spawns resolve to village zone', () => {
      // Village zone: y: 195-253. All rat areas should be within this.
      for (const area of PRODUCTION_RAT_AREAS) {
        const centerY = area.y + Math.floor(area.h / 2);
        expect(centerY).toBeGreaterThanOrEqual(195);
        expect(centerY).toBeLessThan(253);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 2. Spawn Protection
  // -----------------------------------------------------------------------
  describe('spawn protection', () => {
    it('should NOT aggro a player with active spawn protection', () => {
      // Player in beach zone (not village) but has spawn protection
      const player = createPlayer(1, 'NewPlayer', 30, 280);
      player.spawnProtectionUntil = Date.now() + 10000;

      const crab = createMob(100, 'crab', 31, 280, 4, 3, 'beach');

      const results = simulateAggroTick([crab], [player]);
      expect(results).toHaveLength(0);
    });

    it('should aggro after spawn protection expires', () => {
      const player = createPlayer(1, 'NewPlayer', 30, 170, 5);
      player.spawnProtectionUntil = Date.now() - 1; // expired

      const bat = createMob(100, 'bat', 31, 170, 4, 4, 'forest');

      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Player State Exclusions
  // -----------------------------------------------------------------------
  describe('player state exclusions', () => {
    it('should NOT aggro dead players', () => {
      const player = createPlayer(1, 'Dead', 30, 170, 5);
      player.isDead = true;

      const bat = createMob(100, 'bat', 31, 170, 4, 4, 'forest');
      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(0);
    });

    it('should NOT aggro phased players', () => {
      const player = createPlayer(1, 'Phased', 30, 170, 5);
      player.isPhased = true;

      const bat = createMob(100, 'bat', 31, 170, 4, 4, 'forest');
      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(0);
    });

    it('should skip dead mobs', () => {
      const player = createPlayer(1, 'Test', 30, 170, 5);
      const bat = createMob(100, 'bat', 31, 170, 4, 4, 'forest');
      bat.isDead = true;

      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(0);
    });

    it('should skip mobs that already have a target', () => {
      const player = createPlayer(1, 'Test', 30, 170, 5);
      const bat = createMob(100, 'bat', 31, 170, 4, 4, 'forest');
      bat.target = 99;

      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Aggro Range & Distance (Chebyshev)
  // -----------------------------------------------------------------------
  describe('aggro range mechanics', () => {
    it('should aggro players within range', () => {
      const player = createPlayer(1, 'Test', 30, 170, 5);
      const bat = createMob(100, 'bat', 32, 170, 4, 4, 'forest');

      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(1);
    });

    it('should NOT aggro players beyond range', () => {
      const player = createPlayer(1, 'Test', 30, 170, 5);
      const bat = createMob(100, 'bat', 35, 170, 4, 4, 'forest'); // 5 tiles, range 4

      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(0);
    });

    it('should pick the closest player when multiple are in range', () => {
      const near = createPlayer(1, 'Near', 31, 170, 5);
      const far = createPlayer(2, 'Far', 33, 170, 5);
      const bat = createMob(100, 'bat', 30, 170, 4, 4, 'forest');

      const results = simulateAggroTick([bat], [near, far]);
      expect(results).toHaveLength(1);
      expect(results[0].playerId).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Density Cap — Swarming Prevention
  // -----------------------------------------------------------------------
  describe('density cap prevents swarming', () => {
    it('should cap at 3 simultaneous aggressors by default', () => {
      const player = createPlayer(1, 'Swarmed', 30, 170, 5);
      const mobs = [];
      for (let i = 0; i < 6; i++) {
        mobs.push(createMob(100 + i, 'bat', 31, 170, 4, 4, 'forest'));
      }

      const results = simulateAggroTick(mobs, [player]);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should allow first mob to aggro freely', () => {
      const player = createPlayer(1, 'Test', 30, 170, 5);
      const bat = createMob(100, 'bat', 31, 170, 4, 4, 'forest');

      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(1);
    });

    it('should allow strong mobs through the cap', () => {
      const player = createPlayer(1, 'Test', 30, 120, 5);

      // 3 weak mobs already aggroing (simulated via aggroCount)
      const strongMob = createMob(104, 'skeleton', 31, 120, 5, 15, 'cave');

      // Pre-set aggro count to 3 (at cap)
      const results = simulateAggroTick([strongMob], [player], { 1: 3 });
      // Mob level 15, player level 5 → bonus = floor(10/5) = 2, cap = 5
      // 3 < 5 → allowed
      expect(results).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Zone Transition Gradient
  // -----------------------------------------------------------------------
  describe('zone transition gradient', () => {
    it('should reduce aggro range for mobs near zone boundary', () => {
      const player = createPlayer(1, 'Test', 30, 194, 4);
      // Mob at y=194, near southern edge of forest (y=195)
      // Transition: distFromSouthEdge = 195-194 = 1, mult = 0.44
      // Effective range: 4 * 0.44 = 1.76
      // Distance: 2 → out of reduced range
      const bat = createMob(100, 'bat', 32, 194, 4, 4, 'forest');

      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(0);
    });

    it('should allow full aggro for mobs deep in zone', () => {
      const player = createPlayer(1, 'Test', 30, 170, 4);
      // Mob at y=170, deep inside forest
      const bat = createMob(100, 'bat', 33, 170, 4, 4, 'forest');

      const results = simulateAggroTick([bat], [player]);
      expect(results).toHaveLength(1);
    });

    it('should create graduated difficulty — deeper mobs aggro from further', () => {
      const player = createPlayer(1, 'Test', 30, 170, 4);

      // Edge mob (y=194) — should NOT aggro from 2 tiles
      const edgeBat = createMob(100, 'bat', 32, 194, 4, 4, 'forest');
      const edgeResult = simulateAggroTick([edgeBat], [player]);

      // Deep mob (y=170) — should aggro from 3 tiles
      const deepBat = createMob(101, 'bat', 33, 170, 4, 4, 'forest');
      const deepResult = simulateAggroTick([deepBat], [player]);

      expect(edgeResult).toHaveLength(0);
      expect(deepResult).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Spawn Density Data Validation
  // -----------------------------------------------------------------------
  describe('spawn density near starting zone', () => {
    it('should have no more than 2 rats per spawn area', () => {
      for (const area of PRODUCTION_RAT_AREAS) {
        expect(area.count).toBeLessThanOrEqual(2);
      }
    });

    it('should have at most 19 total rats across all areas', () => {
      const total = PRODUCTION_RAT_AREAS.reduce((sum, a) => sum + a.count, 0);
      expect(total).toBeLessThanOrEqual(19);
    });

    it('should have the 4 closest areas reduced to 2 rats each', () => {
      for (const id of [0, 1, 2, 3]) {
        const area = PRODUCTION_RAT_AREAS.find(a => a.id === id);
        expect(area).toBeDefined();
        expect(area!.count).toBe(2);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 8. Chebyshev Distance
  // -----------------------------------------------------------------------
  describe('Chebyshev distance (Utils.distanceTo)', () => {
    it('should return max of dx and dy', () => {
      expect(Utils.distanceTo(0, 0, 3, 4)).toBe(4);
      expect(Utils.distanceTo(0, 0, 5, 2)).toBe(5);
    });

    it('should return 0 for same position', () => {
      expect(Utils.distanceTo(10, 20, 10, 20)).toBe(0);
    });

    it('should be symmetric', () => {
      expect(Utils.distanceTo(1, 2, 5, 8)).toBe(Utils.distanceTo(5, 8, 1, 2));
    });

    it('should correctly determine 3-tile aggro range', () => {
      // Player 2 tiles east, 1 tile north = Chebyshev 2 tiles
      const dist = Utils.distanceTo(10, 10, 12, 9);
      expect(dist).toBe(2);
      expect(dist).toBeLessThan(3); // within rat aggro range
    });

    it('should correctly reject 4-tile distance for 3-tile aggro', () => {
      const dist = Utils.distanceTo(10, 10, 14, 10);
      expect(dist).toBe(4);
      expect(dist).toBeGreaterThanOrEqual(3); // outside rat aggro range
    });
  });

  // -----------------------------------------------------------------------
  // 9. Full Scenario — New Player Spawns and Explores
  // -----------------------------------------------------------------------
  describe('full scenario — new player experience', () => {
    it('should let a new player walk through the village without being attacked', () => {
      const player = createPlayer(1, 'Newbie', 40, 220, 1);
      const villageRats: FakeMob[] = [];

      // Place rats at centers of all production rat areas (all in village zone)
      let id = 100;
      for (const area of PRODUCTION_RAT_AREAS) {
        for (let i = 0; i < area.count; i++) {
          const rx = area.x + Math.floor(area.w / 2);
          const ry = area.y + Math.floor(area.h / 2);
          villageRats.push(createMob(id++, 'rat', rx, ry, 3, 1, 'village'));
        }
      }

      // Walk the player across the village (y stays in 195-253 range)
      for (let x = 10; x <= 70; x += 5) {
        player.x = x;
        const results = simulateAggroTick(villageRats, [player]);
        expect(results).toHaveLength(0);
      }
    });

    it('should start encountering mobs when entering the forest', () => {
      const player = createPlayer(1, 'Explorer', 30, 185, 3);

      // Forest bats deep inside the zone
      const forestBats = [
        createMob(200, 'bat', 31, 185, 4, 4, 'forest'),
        createMob(201, 'bat', 32, 185, 4, 4, 'forest'),
      ];

      const results = simulateAggroTick(forestBats, [player]);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should encounter fewer mobs at zone edge than deep inside', () => {
      const player = createPlayer(1, 'Explorer', 30, 0, 4); // y doesn't matter for player

      // Edge mobs (y=194, just inside forest's southern border)
      const edgeMobs = Array.from({ length: 5 }, (_, i) =>
        createMob(300 + i, 'bat', 30 + i, 194, 4, 4, 'forest')
      );
      player.y = 194;
      const edgeResults = simulateAggroTick(edgeMobs, [player]);

      // Deep mobs (y=170, well inside forest)
      const deepMobs = Array.from({ length: 5 }, (_, i) =>
        createMob(400 + i, 'bat', 30 + i, 170, 4, 4, 'forest')
      );
      player.y = 170;
      const deepResults = simulateAggroTick(deepMobs, [player]);

      // Density cap limits both, but edge mobs have reduced range
      // so fewer edge mobs should aggro compared to deep mobs
      expect(edgeResults.length).toBeLessThanOrEqual(deepResults.length);
    });
  });
});
