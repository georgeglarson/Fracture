/**
 * Aggro Policy Tests
 *
 * Tests the zone-aware aggro decision engine that replaces
 * the ad-hoc safe zone bounding box and density patches.
 *
 * All tests use plain objects — no mocking, no World instance needed.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateAggro,
  getZoneMultiplier,
  getTransitionMultiplier,
  getLevelMultiplier,
  isDensityAllowed,
  resolveZoneId,
  AGGRO_CONFIG,
  type AggroContext,
} from '../combat/aggro-policy';

// =========================================================================
// Helpers
// =========================================================================

function makeContext(overrides: Partial<AggroContext> = {}): AggroContext {
  return {
    mobX: 30,
    mobY: 170,       // Forest zone (y: 145-195)
    mobSpawnX: 30,
    mobSpawnY: 170,
    mobLevel: 4,
    mobAggroRange: 4, // bat-level
    mobZoneId: 'forest',
    playerX: 32,
    playerY: 170,
    playerLevel: 4,
    distance: 2,      // 2 tiles away
    currentAggroOnPlayer: 0,
    ...overrides,
  };
}

// =========================================================================
// Zone Multiplier
// =========================================================================

describe('getZoneMultiplier', () => {
  it('should return 0 for village (passive zone)', () => {
    expect(getZoneMultiplier('village')).toBe(0);
  });

  it('should return 0.5 for beach (reduced zone)', () => {
    expect(getZoneMultiplier('beach')).toBe(AGGRO_CONFIG.REDUCED_ZONE_MULT);
  });

  it('should return 1.0 for forest', () => {
    expect(getZoneMultiplier('forest')).toBe(1.0);
  });

  it('should return 1.0 for cave', () => {
    expect(getZoneMultiplier('cave')).toBe(1.0);
  });

  it('should return 1.0 for lavaland', () => {
    expect(getZoneMultiplier('lavaland')).toBe(1.0);
  });

  it('should return 1.0 for boss', () => {
    expect(getZoneMultiplier('boss')).toBe(1.0);
  });

  it('should return 1.0 for null (unknown zone)', () => {
    expect(getZoneMultiplier(null)).toBe(1.0);
  });
});

// =========================================================================
// Zone Transition Multiplier
// =========================================================================

describe('getTransitionMultiplier', () => {
  // Forest zone: y: 145-195 (area.y=145, area.h=50, so bottom=195)
  // Transition band: 5 tiles from southern edge (y=195)
  // Mobs at y=195 (edge): min multiplier (0.3)
  // Mobs at y=190 (5 tiles deep): full multiplier (1.0)

  it('should return 1.0 for mob deep inside zone', () => {
    // Mob at y=170, well inside forest (y:145-195)
    expect(getTransitionMultiplier(170, 'forest')).toBe(1.0);
  });

  it('should return min multiplier at zone southern edge', () => {
    // Mob at y=195 — the very southern edge of forest
    // distFromSouthEdge = 195 - 195 = 0
    expect(getTransitionMultiplier(195, 'forest')).toBe(AGGRO_CONFIG.TRANSITION_MIN_MULTIPLIER);
  });

  it('should return interpolated value within transition band', () => {
    // Mob at y=192 — 3 tiles from southern edge of forest (195)
    // distFromSouthEdge = 195 - 192 = 3
    // factor = 0.3 + 0.7 * (3/5) = 0.3 + 0.42 = 0.72
    const result = getTransitionMultiplier(192, 'forest');
    expect(result).toBeCloseTo(0.72, 2);
  });

  it('should return 1.0 at exactly the transition band depth', () => {
    // Mob at y=190 — exactly 5 tiles from edge
    // distFromSouthEdge = 195 - 190 = 5 = band
    expect(getTransitionMultiplier(190, 'forest')).toBe(1.0);
  });

  it('should return 1.0 for boss zone (no transition)', () => {
    expect(getTransitionMultiplier(55, 'boss')).toBe(1.0);
  });

  it('should return 1.0 for null zone', () => {
    expect(getTransitionMultiplier(170, null)).toBe(1.0);
  });

  it('should return 1.0 for unknown zone', () => {
    expect(getTransitionMultiplier(170, 'nonexistent')).toBe(1.0);
  });

  it('should handle cave zone transition (y: 100-145, bottom=145)', () => {
    // Cave bottom edge at y=145
    // Mob at y=143 → distFromSouthEdge = 145 - 143 = 2
    // factor = 0.3 + 0.7 * (2/5) = 0.3 + 0.28 = 0.58
    const result = getTransitionMultiplier(143, 'cave');
    expect(result).toBeCloseTo(0.58, 2);
  });
});

// =========================================================================
// Level Multiplier
// =========================================================================

describe('getLevelMultiplier', () => {
  it('should return 1.0 when player is same level as mob', () => {
    expect(getLevelMultiplier(5, 5)).toBe(1.0);
  });

  it('should return 1.0 when player is slightly higher', () => {
    expect(getLevelMultiplier(5, 9)).toBe(1.0); // 4 levels above, under threshold
  });

  it('should return reduced mult when player is 5+ levels above', () => {
    expect(getLevelMultiplier(5, 10)).toBe(AGGRO_CONFIG.HIGH_LEVEL_RANGE_MULT);
  });

  it('should return reduced mult when player is way above mob', () => {
    expect(getLevelMultiplier(1, 30)).toBe(AGGRO_CONFIG.HIGH_LEVEL_RANGE_MULT);
  });

  it('should return 1.0 when mob is higher level than player', () => {
    expect(getLevelMultiplier(10, 5)).toBe(1.0);
  });
});

// =========================================================================
// Density Cap
// =========================================================================

describe('isDensityAllowed', () => {
  it('should allow aggro when player has no current aggressors', () => {
    expect(isDensityAllowed(0, 5, 5)).toBe(true);
  });

  it('should allow aggro up to the cap', () => {
    expect(isDensityAllowed(2, 5, 5)).toBe(true);
  });

  it('should block aggro at the cap', () => {
    expect(isDensityAllowed(3, 5, 5)).toBe(false);
  });

  it('should block aggro above the cap', () => {
    expect(isDensityAllowed(5, 5, 5)).toBe(false);
  });

  it('should allow higher-level mobs to push through cap', () => {
    // Mob level 15, player level 5 → levelBonus = floor(10/5) = 2
    // cap = 3 + 2 = 5
    expect(isDensityAllowed(4, 15, 5)).toBe(true);
  });

  it('should not give bonus for lower-level mobs', () => {
    // Mob level 3, player level 10 → levelBonus = max(0, floor(-7/5)) = 0
    expect(isDensityAllowed(3, 3, 10)).toBe(false);
  });
});

// =========================================================================
// evaluateAggro — Integration
// =========================================================================

describe('evaluateAggro', () => {
  // -----------------------------------------------------------------------
  // Zone passivity
  // -----------------------------------------------------------------------
  describe('zone passivity', () => {
    it('should deny aggro for village mobs', () => {
      const ctx = makeContext({ mobZoneId: 'village', distance: 1 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(false);
      expect(result.reason).toBe('passive_zone');
    });

    it('should allow beach mobs with halved range', () => {
      // mobAggroRange = 4, beach mult = 0.5, effective = 2
      // distance = 1 → in range
      const ctx = makeContext({ mobZoneId: 'beach', distance: 1, mobAggroRange: 4 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(true);
      expect(result.effectiveRange).toBeLessThan(4);
    });

    it('should deny beach mob when player is beyond halved range', () => {
      // mobAggroRange = 4, beach mult = 0.5, effective = 2
      // distance = 3 → out of range
      const ctx = makeContext({ mobZoneId: 'beach', distance: 3, mobAggroRange: 4 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(false);
      expect(result.reason).toBe('out_of_range');
    });

    it('should allow forest mobs at full range', () => {
      const ctx = makeContext({ mobZoneId: 'forest', distance: 3, mobAggroRange: 4 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Zone transition gradient
  // -----------------------------------------------------------------------
  describe('zone transition gradient', () => {
    it('should reduce range for mob at zone boundary', () => {
      // Mob at forest southern edge (y=195)
      const ctx = makeContext({
        mobSpawnY: 195,
        mobZoneId: 'forest',
        mobAggroRange: 4,
        distance: 2,
      });
      const result = evaluateAggro(ctx);
      // effectiveRange = 4 * 1.0 (zone) * 0.3 (transition) * 1.0 (level) = 1.2
      // distance 2 > 1.2 → out of range
      expect(result.shouldAggro).toBe(false);
    });

    it('should allow mob deep in zone at full range', () => {
      const ctx = makeContext({
        mobSpawnY: 170,
        mobZoneId: 'forest',
        mobAggroRange: 4,
        distance: 3,
      });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(true);
      expect(result.effectiveRange).toBe(4);
    });

    it('should create graduated difficulty across transition band', () => {
      const ranges: number[] = [];
      // Walk from zone edge (y=195) to interior (y=190)
      for (let y = 195; y >= 190; y--) {
        const ctx = makeContext({
          mobSpawnY: y,
          mobZoneId: 'forest',
          mobAggroRange: 4,
          distance: 0,
        });
        const result = evaluateAggro(ctx);
        ranges.push(result.effectiveRange);
      }
      // Each step deeper should increase the effective range
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i]).toBeGreaterThanOrEqual(ranges[i - 1]);
      }
      // Edge should be minimal, interior should be full
      expect(ranges[0]).toBeCloseTo(4 * 0.3, 1); // ~1.2
      expect(ranges[ranges.length - 1]).toBe(4);  // full range
    });
  });

  // -----------------------------------------------------------------------
  // Level scaling
  // -----------------------------------------------------------------------
  describe('level scaling', () => {
    it('should reduce range when player is much higher level', () => {
      const ctx = makeContext({
        mobLevel: 1,
        playerLevel: 10,
        mobAggroRange: 3,
        distance: 2,
      });
      const result = evaluateAggro(ctx);
      // effectiveRange = 3 * 1.0 * 1.0 * 0.5 = 1.5
      // distance 2 > 1.5 → out of range
      expect(result.shouldAggro).toBe(false);
    });

    it('should use full range when player is similar level', () => {
      const ctx = makeContext({
        mobLevel: 5,
        playerLevel: 5,
        mobAggroRange: 4,
        distance: 3,
      });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(true);
      expect(result.effectiveRange).toBe(4);
    });
  });

  // -----------------------------------------------------------------------
  // Density cap
  // -----------------------------------------------------------------------
  describe('density cap', () => {
    it('should block aggro when player already has 3 mobs on them', () => {
      const ctx = makeContext({ currentAggroOnPlayer: 3, distance: 1 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(false);
      expect(result.reason).toBe('density_cap');
    });

    it('should allow first mob to aggro', () => {
      const ctx = makeContext({ currentAggroOnPlayer: 0, distance: 1 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(true);
    });

    it('should allow strong mob through cap', () => {
      // Player level 5, mob level 15 → cap = 3 + 2 = 5
      const ctx = makeContext({
        currentAggroOnPlayer: 4,
        mobLevel: 15,
        playerLevel: 5,
        distance: 1,
      });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Distance checks
  // -----------------------------------------------------------------------
  describe('distance', () => {
    it('should deny aggro when out of range', () => {
      const ctx = makeContext({ mobAggroRange: 3, distance: 5 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(false);
      expect(result.reason).toBe('out_of_range');
    });

    it('should allow aggro when in range', () => {
      const ctx = makeContext({ mobAggroRange: 3, distance: 2 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(true);
    });

    it('should deny at exactly aggro range', () => {
      const ctx = makeContext({ mobAggroRange: 3, distance: 3 });
      const result = evaluateAggro(ctx);
      // distance >= effectiveRange → out of range
      expect(result.shouldAggro).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Combined modifiers
  // -----------------------------------------------------------------------
  describe('combined modifiers', () => {
    it('should stack beach zone + transition band', () => {
      // Beach mob at southern edge of beach zone (y=253+61=314)
      // Beach: y=253, h=61, bottom=314
      // Mob at y=312 → distFromSouthEdge = 314 - 312 = 2
      // transitionMult = 0.3 + 0.7 * (2/5) = 0.58
      // zoneMult = 0.5 (beach)
      // effectiveRange = 4 * 0.5 * 0.58 * 1.0 = 1.16
      const ctx = makeContext({
        mobZoneId: 'beach',
        mobSpawnY: 312,
        mobAggroRange: 4,
        distance: 2,
      });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(false); // 2 > 1.16
      expect(result.effectiveRange).toBeCloseTo(1.16, 1);
    });

    it('should stack level scaling + transition', () => {
      // Forest mob at edge (y=194), player 5+ levels above
      // transitionMult for y=194: distFromSouthEdge = 195-194 = 1 → 0.3 + 0.7*(1/5) = 0.44
      // levelMult = 0.5
      // effectiveRange = 4 * 1.0 * 0.44 * 0.5 = 0.88
      const ctx = makeContext({
        mobSpawnY: 194,
        mobZoneId: 'forest',
        mobLevel: 3,
        playerLevel: 10,
        mobAggroRange: 4,
        distance: 1,
      });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(false); // 1 > 0.88
    });

    it('should apply hate modifier from zone and transition', () => {
      // Beach mob, deep in zone → zoneMult=0.5, transitionMult=1.0
      const ctx = makeContext({
        mobZoneId: 'beach',
        mobSpawnY: 270,
        mobAggroRange: 4,
        distance: 1,
      });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(true);
      expect(result.hateModifier).toBeCloseTo(0.5, 2);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle mob with null zone', () => {
      const ctx = makeContext({ mobZoneId: null, distance: 2 });
      const result = evaluateAggro(ctx);
      // null zone → all multipliers default to 1.0
      expect(result.shouldAggro).toBe(true);
    });

    it('should handle zero aggro range', () => {
      const ctx = makeContext({ mobAggroRange: 0, distance: 0 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(false);
    });

    it('should handle zero distance', () => {
      const ctx = makeContext({ distance: 0, mobAggroRange: 3 });
      const result = evaluateAggro(ctx);
      expect(result.shouldAggro).toBe(true);
    });
  });
});

// =========================================================================
// resolveZoneId
// =========================================================================

describe('resolveZoneId', () => {
  it('should resolve village zone from coordinates', () => {
    expect(resolveZoneId(30, 220)).toBe('village');
  });

  it('should resolve forest zone', () => {
    expect(resolveZoneId(30, 170)).toBe('forest');
  });

  it('should resolve beach zone', () => {
    expect(resolveZoneId(30, 280)).toBe('beach');
  });

  it('should resolve cave zone', () => {
    expect(resolveZoneId(30, 120)).toBe('cave');
  });

  it('should resolve boss zone (overlaps lavaland)', () => {
    expect(resolveZoneId(150, 55)).toBe('boss');
  });

  it('should resolve lavaland when not in boss area', () => {
    expect(resolveZoneId(30, 30)).toBe('lavaland');
  });

  it('should return null for out-of-bounds position', () => {
    expect(resolveZoneId(999, 999)).toBeNull();
  });
});
