/**
 * Aggro Policy — Zone-aware mob aggro decision engine
 *
 * Pure function module that decides whether a mob should aggro a player.
 * Replaces ad-hoc safe zone bounding boxes and density patches with
 * a unified system that understands zones, transitions, and density.
 *
 * All inputs are primitive data (no World/Map dependencies),
 * making this trivially unit-testable.
 */
import { ZONE_DATA, getZoneAtPosition, type ZoneDefinition } from '../../../shared/ts/zones/zone-data';

// =========================================================================
// Configuration — all tunable constants in one place
// =========================================================================

export const AGGRO_CONFIG = {
  /** Max mobs that can simultaneously aggro one player */
  MAX_SIMULTANEOUS_AGGRO: 3,

  /** Tiles inward from zone boundary where aggro ramps up */
  TRANSITION_BAND_TILES: 5,

  /** Minimum aggro multiplier at zone edge (ramps to 1.0 at interior) */
  TRANSITION_MIN_MULTIPLIER: 0.3,

  /** Player levels above mob before aggro range is reduced */
  HIGH_LEVEL_THRESHOLD: 5,

  /** Aggro range multiplier when player is significantly higher level */
  HIGH_LEVEL_RANGE_MULT: 0.5,

  /** Zones where mobs are completely passive (aggro range = 0) */
  PASSIVE_ZONES: ['village'] as string[],

  /** Zones where mobs have reduced aggro range */
  REDUCED_ZONES: ['beach'] as string[],

  /** Aggro range multiplier in reduced zones */
  REDUCED_ZONE_MULT: 0.5,
};

// =========================================================================
// Types
// =========================================================================

export interface AggroContext {
  /** Mob's current position (tiles) */
  mobX: number;
  mobY: number;
  /** Mob's spawn position (tiles) — used for zone lookup */
  mobSpawnX: number;
  mobSpawnY: number;
  /** Mob's level */
  mobLevel: number;
  /** Mob's base aggro range (tiles) */
  mobAggroRange: number;
  /** Mob's zone ID (cached on mob, or null if unknown) */
  mobZoneId: string | null;

  /** Player's current position (tiles) */
  playerX: number;
  playerY: number;
  /** Player's level */
  playerLevel: number;

  /** Precomputed Chebyshev distance between mob and player (tiles) */
  distance: number;
  /** How many mobs already aggroing this player */
  currentAggroOnPlayer: number;
}

export interface AggroDecision {
  /** Whether the mob should aggro */
  shouldAggro: boolean;
  /** Effective aggro range after all modifiers (tiles) */
  effectiveRange: number;
  /** Hate point multiplier (1.0 = normal) */
  hateModifier: number;
  /** Why aggro was denied (for debugging/testing) */
  reason?: string;
}

// =========================================================================
// Policy
// =========================================================================

/**
 * Evaluate whether a mob should aggro a player.
 *
 * Applies four layers of modification to the base aggro range:
 * 1. Zone passivity (village = 0, beach = 0.5x)
 * 2. Zone boundary transition (30%-100% based on proximity to edge)
 * 3. Player level scaling (high-level players reduce mob aggro)
 * 4. Density cap (max N mobs aggroing one player)
 */
export function evaluateAggro(ctx: AggroContext): AggroDecision {
  const baseRange = ctx.mobAggroRange;

  // 1. Zone passivity — village mobs are passive, beach mobs are cautious
  const zoneMult = getZoneMultiplier(ctx.mobZoneId);
  if (zoneMult === 0) {
    return { shouldAggro: false, effectiveRange: 0, hateModifier: 0, reason: 'passive_zone' };
  }

  // 2. Zone boundary transition — mobs near zone edges have reduced range
  const transitionMult = getTransitionMultiplier(ctx.mobSpawnY, ctx.mobZoneId);

  // 3. Level scaling — high-level players are less threatening to weak mobs
  const levelMult = getLevelMultiplier(ctx.mobLevel, ctx.playerLevel);

  // Compute effective range
  const effectiveRange = baseRange * zoneMult * transitionMult * levelMult;

  // Distance check
  if (ctx.distance >= effectiveRange) {
    return { shouldAggro: false, effectiveRange, hateModifier: 0, reason: 'out_of_range' };
  }

  // 4. Density cap — prevent swarming
  if (!isDensityAllowed(ctx.currentAggroOnPlayer, ctx.mobLevel, ctx.playerLevel)) {
    return { shouldAggro: false, effectiveRange, hateModifier: 0, reason: 'density_cap' };
  }

  // Calculate hate modifier (closer = more hate, same formula as before)
  const hateModifier = zoneMult * transitionMult;

  return { shouldAggro: true, effectiveRange, hateModifier };
}

// =========================================================================
// Internal helpers (exported for testing)
// =========================================================================

/**
 * Get aggro range multiplier based on mob's zone.
 * Village = 0 (passive), Beach = 0.5, everywhere else = 1.0
 */
export function getZoneMultiplier(zoneId: string | null): number {
  if (!zoneId) return 1.0;
  if (AGGRO_CONFIG.PASSIVE_ZONES.includes(zoneId)) return 0;
  if (AGGRO_CONFIG.REDUCED_ZONES.includes(zoneId)) return AGGRO_CONFIG.REDUCED_ZONE_MULT;
  return 1.0;
}

/**
 * Get aggro range multiplier based on proximity to zone boundary.
 * Mobs deep in their zone have full range; mobs near the edge have reduced range.
 * This creates a graduated difficulty transition between zones.
 */
export function getTransitionMultiplier(mobSpawnY: number, zoneId: string | null): number {
  if (!zoneId || !(zoneId in ZONE_DATA)) return 1.0;

  const zone = ZONE_DATA[zoneId];
  if (!zone.areas || zone.areas.length === 0) return 1.0;

  // Boss zone has no transition — hard boundary by design
  if (zoneId === 'boss') return 1.0;

  const area = zone.areas[0]; // Primary area
  const zoneTop = area.y;                  // Northern edge (lower y = further north = harder)
  const zoneBottom = area.y + area.h;      // Southern edge (higher y = further south = safer)

  const band = AGGRO_CONFIG.TRANSITION_BAND_TILES;
  const minMult = AGGRO_CONFIG.TRANSITION_MIN_MULTIPLIER;

  // Distance from the southern (safer) boundary — where players enter from easier zones
  // Map goes south (high y, easy) to north (low y, hard)
  const distFromSouthEdge = zoneBottom - mobSpawnY;

  if (distFromSouthEdge <= 0) return minMult; // At or beyond southern edge
  if (distFromSouthEdge >= band) return 1.0;  // Deep enough inside — full aggro

  // Linear ramp from minMult at edge to 1.0 at band depth
  return minMult + (1.0 - minMult) * (distFromSouthEdge / band);
}

/**
 * Get aggro range multiplier based on level difference.
 * High-level players get less aggro from weak mobs.
 */
export function getLevelMultiplier(mobLevel: number, playerLevel: number): number {
  if (playerLevel - mobLevel >= AGGRO_CONFIG.HIGH_LEVEL_THRESHOLD) {
    return AGGRO_CONFIG.HIGH_LEVEL_RANGE_MULT;
  }
  return 1.0;
}

/**
 * Check if another mob is allowed to aggro this player (density cap).
 * Stronger mobs can push through the cap.
 */
export function isDensityAllowed(
  currentAggroOnPlayer: number,
  mobLevel: number,
  playerLevel: number,
): boolean {
  // Higher-level mobs get bonus cap slots
  const levelBonus = Math.max(0, Math.ceil((mobLevel - playerLevel) / 5));
  const cap = AGGRO_CONFIG.MAX_SIMULTANEOUS_AGGRO + levelBonus;
  return currentAggroOnPlayer < cap;
}

/**
 * Resolve a mob's zone from its spawn position.
 * Called once per mob at construction time and cached.
 */
export function resolveZoneId(spawnX: number, spawnY: number): string | null {
  const zone = getZoneAtPosition(spawnX, spawnY);
  return zone?.id ?? null;
}
