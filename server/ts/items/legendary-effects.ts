/**
 * Legendary Effects Handler - Server-side legendary item effect processing
 *
 * Handles unique effects for legendary items:
 * - SECOND_CHANCE: Revive with 50% HP (5min cooldown)
 * - GOLD_GREED: +50% gold from kills
 * - DOUBLE_STRIKE: 10% chance double damage
 * - FIRE_REFLECT: Reflect 25% damage to attackers
 * - VOID_TOUCH: 15% lifesteal
 * - SOUL_HARVEST: +2% max HP per kill (caps at 50%)
 */

import { LegendaryEffect, getLegendaryByKind } from '../../../shared/ts/items/legendary-data';
import { Types } from '../../../shared/ts/gametypes';

/**
 * Player legendary state tracking
 */
interface LegendaryState {
  // Second Chance cooldown timestamp
  secondChanceLastUsed: number;
  // Soul Harvest stacks (each = +2% HP)
  soulHarvestStacks: number;
}

// Track legendary state per player
const playerStates = new Map<number, LegendaryState>();

/**
 * Get or create legendary state for a player
 */
function getState(playerId: number): LegendaryState {
  let state = playerStates.get(playerId);
  if (!state) {
    state = {
      secondChanceLastUsed: 0,
      soulHarvestStacks: 0
    };
    playerStates.set(playerId, state);
  }
  return state;
}

/**
 * Check if player has a legendary effect active (from equipped items)
 */
export function hasLegendaryEffect(
  weaponKind: number,
  armorKind: number,
  effect: LegendaryEffect
): boolean {
  const weaponLegendary = getLegendaryByKind(weaponKind);
  const armorLegendary = getLegendaryByKind(armorKind);

  return (weaponLegendary?.effect === effect) || (armorLegendary?.effect === effect);
}

/**
 * Get gold multiplier from legendary effects
 * Returns 1.0 for no bonus, 1.5 for Greed's Edge
 */
export function getGoldMultiplier(weaponKind: number): number {
  if (hasLegendaryEffect(weaponKind, 0, LegendaryEffect.GOLD_GREED)) {
    return 1.5; // +50% gold
  }
  return 1.0;
}

/**
 * Check for double strike proc (Dragonbone Cleaver)
 * Returns true if damage should be doubled
 */
export function checkDoubleStrike(weaponKind: number): boolean {
  if (hasLegendaryEffect(weaponKind, 0, LegendaryEffect.DOUBLE_STRIKE)) {
    return Math.random() < 0.10; // 10% chance
  }
  return false;
}

/**
 * Calculate lifesteal from Voidheart Blade
 * Returns HP to heal based on damage dealt
 */
export function calculateLifesteal(weaponKind: number, damageDealt: number): number {
  if (hasLegendaryEffect(weaponKind, 0, LegendaryEffect.VOID_TOUCH)) {
    return Math.floor(damageDealt * 0.15); // 15% lifesteal
  }
  return 0;
}

/**
 * Calculate reflected damage from Hellfire Mantle
 * Returns damage to reflect back to attacker
 */
export function calculateReflectedDamage(armorKind: number, damageReceived: number): number {
  if (hasLegendaryEffect(0, armorKind, LegendaryEffect.FIRE_REFLECT)) {
    return Math.floor(damageReceived * 0.25); // 25% reflect
  }
  return 0;
}

/**
 * Check if Second Chance can trigger (Crown of the Undying)
 * Returns true if player should revive instead of dying
 */
export function canTriggerSecondChance(playerId: number, armorKind: number): boolean {
  if (!hasLegendaryEffect(0, armorKind, LegendaryEffect.SECOND_CHANCE)) {
    return false;
  }

  const state = getState(playerId);
  const now = Date.now();
  const cooldown = 5 * 60 * 1000; // 5 minutes

  if (now - state.secondChanceLastUsed >= cooldown) {
    state.secondChanceLastUsed = now;
    return true;
  }

  return false;
}

/**
 * Get remaining Second Chance cooldown in seconds
 */
export function getSecondChanceCooldown(playerId: number): number {
  const state = getState(playerId);
  const now = Date.now();
  const cooldown = 5 * 60 * 1000;
  const remaining = cooldown - (now - state.secondChanceLastUsed);
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Record a kill for Soul Harvester stacking
 * Returns the HP bonus multiplier (1.0 to 1.5)
 */
export function recordSoulHarvestKill(playerId: number, weaponKind: number): number {
  if (!hasLegendaryEffect(weaponKind, 0, LegendaryEffect.SOUL_HARVEST)) {
    return 1.0;
  }

  const state = getState(playerId);
  const maxStacks = 25; // 25 stacks * 2% = 50% max

  if (state.soulHarvestStacks < maxStacks) {
    state.soulHarvestStacks++;
    console.log(`[Legendary] ${playerId} Soul Harvest: ${state.soulHarvestStacks} stacks (+${state.soulHarvestStacks * 2}% HP)`);
  }

  return 1 + (state.soulHarvestStacks * 0.02);
}

/**
 * Get current Soul Harvest HP multiplier
 */
export function getSoulHarvestMultiplier(playerId: number): number {
  const state = getState(playerId);
  return 1 + (state.soulHarvestStacks * 0.02);
}

/**
 * Reset Soul Harvest stacks (on death)
 */
export function resetSoulHarvestStacks(playerId: number): void {
  const state = getState(playerId);
  if (state.soulHarvestStacks > 0) {
    console.log(`[Legendary] ${playerId} Soul Harvest reset (was ${state.soulHarvestStacks} stacks)`);
    state.soulHarvestStacks = 0;
  }
}

/**
 * Clean up player state on disconnect
 */
export function cleanupPlayerState(playerId: number): void {
  playerStates.delete(playerId);
}

/**
 * Get all active legendary effects for display
 */
export function getActiveLegendaryEffects(
  weaponKind: number,
  armorKind: number
): LegendaryEffect[] {
  const effects: LegendaryEffect[] = [];

  const weaponLegendary = getLegendaryByKind(weaponKind);
  const armorLegendary = getLegendaryByKind(armorKind);

  if (weaponLegendary) effects.push(weaponLegendary.effect);
  if (armorLegendary) effects.push(armorLegendary.effect);

  return effects;
}
