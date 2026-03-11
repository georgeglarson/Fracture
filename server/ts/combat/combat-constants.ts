/**
 * Shared combat constants.
 * All distances are in TILES (entity positions are tile-based).
 */

/** Melee attack range in tiles (Chebyshev distance). Covers diagonal adjacency + desync buffer. */
export const MELEE_RANGE = 2;

/** Minimum leash distance in tiles. Must exceed largest mob spawn area dimension. */
export const LEASH_BASE = 15;

/** Leash multiplier applied to mob aggroRange. */
export const LEASH_AGGRO_MULT = 4;

/** Compute leash distance for a mob given its aggro range. */
export function getLeashDistance(aggroRange: number): number {
  return Math.max(LEASH_BASE, aggroRange * LEASH_AGGRO_MULT);
}
