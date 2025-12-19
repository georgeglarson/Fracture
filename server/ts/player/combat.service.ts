/**
 * Combat Service - Single Responsibility: Combat damage calculations and state management
 *
 * Handles all combat-related logic including:
 * - Damage calculation for player hits on mobs
 * - Damage calculation for mob hits on player
 * - Death determination
 * - Fire potion effect tracking
 */

import {Formulas} from '../formulas';
import { SetBonus } from '../../../shared/ts/equipment/set-data';

/**
 * Result of player attacking a mob
 */
export interface PlayerAttackResult {
  damage: number;
  targetDied: boolean;
  isCritical?: boolean;
}

/**
 * Result of player receiving damage
 */
export interface PlayerDamageResult {
  damage: number;
  newHitPoints: number;
  died: boolean;
}

/**
 * Fire potion state
 */
export interface FirePotionState {
  active: boolean;
  expiresAt: number | null;
}

/**
 * CombatService - Handles combat calculations and state
 */
export class CombatService {
  private static readonly FIRE_POTION_DURATION = 15000; // 15 seconds

  /**
   * Calculate damage dealt by player to a mob
   *
   * @param playerWeaponLevel - Player's weapon level
   * @param mobArmorLevel - Mob's armor level
   * @param playerLevel - Player's character level
   * @param setBonus - Optional set bonus modifiers
   * @returns Damage result with amount and crit status
   */
  calculatePlayerDamage(
    playerWeaponLevel: number,
    mobArmorLevel: number,
    playerLevel: number = 1,
    setBonus?: SetBonus
  ): { damage: number; isCritical: boolean } {
    let damage = Formulas.dmg(playerWeaponLevel, mobArmorLevel, playerLevel, setBonus);
    const isCritical = Formulas.isCriticalHit(setBonus);

    if (isCritical) {
      damage = Formulas.criticalDamage(damage);
    }

    return { damage, isCritical };
  }

  /**
   * Calculate and apply damage to player from a mob
   *
   * @param currentHitPoints - Player's current HP
   * @param mobWeaponLevel - Mob's weapon level
   * @param playerArmorLevel - Player's armor level
   * @param playerSetBonus - Optional player set bonus for defense
   * @returns Damage result with new HP and death status
   */
  calculateMobDamageToPlayer(
    currentHitPoints: number,
    mobWeaponLevel: number,
    playerArmorLevel: number,
    playerSetBonus?: SetBonus
  ): PlayerDamageResult {
    // Mob attacking player: mob has no set bonus, player has defense set bonus
    const damage = Formulas.dmg(mobWeaponLevel, playerArmorLevel, 1, undefined, playerSetBonus);
    const newHitPoints = Math.max(0, currentHitPoints - damage);
    const died = newHitPoints <= 0;

    return {
      damage,
      newHitPoints,
      died
    };
  }

  /**
   * Calculate fire potion expiration time
   *
   * @returns Timestamp when fire potion effect ends
   */
  getFirePotionExpiration(): number {
    return Date.now() + CombatService.FIRE_POTION_DURATION;
  }

  /**
   * Check if fire potion effect is still active
   *
   * @param expiresAt - Expiration timestamp
   * @returns True if effect is still active
   */
  isFirePotionActive(expiresAt: number | null): boolean {
    if (!expiresAt) return false;
    return Date.now() < expiresAt;
  }

  /**
   * Get fire potion duration in milliseconds
   */
  getFirePotionDuration(): number {
    return CombatService.FIRE_POTION_DURATION;
  }

  /**
   * Calculate XP reward for killing a mob
   *
   * @param mobArmorLevel - The mob's armor level (toughness)
   * @param zoneXpBonus - Zone XP bonus multiplier (0-1)
   * @returns XP amount to grant
   */
  calculateKillXP(mobArmorLevel: number, zoneXpBonus: number = 0): number {
    const baseXP = Formulas.xpFromMob(mobArmorLevel);
    const bonusXP = Math.floor(baseXP * zoneXpBonus);
    return baseXP + bonusXP;
  }

  /**
   * Calculate gold reward for killing a mob
   *
   * @param mobArmorLevel - The mob's armor level (toughness)
   * @param zoneGoldBonus - Zone gold bonus multiplier (0-1)
   * @returns Gold amount to grant
   */
  calculateKillGold(mobArmorLevel: number, zoneGoldBonus: number = 0): number {
    const baseGold = Formulas.goldFromMob(mobArmorLevel);
    const bonusGold = Math.floor(baseGold * zoneGoldBonus);
    return baseGold + bonusGold;
  }

  /**
   * Determine if an attack is a critical hit
   * @param setBonus - Optional set bonus with critBonus
   */
  isCriticalHit(setBonus?: SetBonus): boolean {
    return Formulas.isCriticalHit(setBonus);
  }

  /**
   * Calculate damage with level bonus
   *
   * @param baseDamage - Base damage from weapon
   * @param playerLevel - Player's level
   * @returns Total damage including level bonus
   */
  applyLevelBonus(baseDamage: number, playerLevel: number): number {
    const levelBonus = Formulas.levelBonusDamage(playerLevel);
    return baseDamage + levelBonus;
  }
}

// Singleton instance
let combatService: CombatService | null = null;

/**
 * Get the singleton CombatService instance
 */
export function getCombatService(): CombatService {
  if (!combatService) {
    combatService = new CombatService();
  }
  return combatService;
}
