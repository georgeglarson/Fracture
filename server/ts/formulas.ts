import {Utils} from './utils';
import { SetBonus } from '../../shared/ts/equipment/set-data';

/**
 * Optional set bonus modifiers for combat calculations
 */
export interface SetBonusModifiers {
  damageMult?: number;      // Multiply final damage
  defenseMult?: number;     // Multiply defense absorption
  hpMult?: number;          // Multiply max HP
  critBonus?: number;       // Added crit chance %
}

export class Formulas {

  // ============================================================================
  // COMBAT FORMULAS
  // ============================================================================

  /**
   * Calculate damage dealt, now including player level bonus and set bonuses
   * @param weaponLevel - Weapon's base level
   * @param armorLevel - Target's armor level
   * @param attackerLevel - Attacker's character level (default 1)
   * @param setBonus - Optional set bonus modifiers
   */
  static dmg(
    weaponLevel: number,
    armorLevel: number,
    attackerLevel: number = 1,
    attackerSetBonus?: SetBonus,
    targetSetBonus?: SetBonus
  ): number {
    const levelBonus = Formulas.levelBonusDamage(attackerLevel);
    let dealt = weaponLevel * Utils.randomInt(5, 10) + levelBonus;

    // Apply attacker's damage multiplier from set bonus
    if (attackerSetBonus?.damageMult) {
      dealt = Math.floor(dealt * attackerSetBonus.damageMult);
    }

    let absorbed = armorLevel * Utils.randomInt(1, 3);

    // Apply target's defense multiplier from set bonus
    if (targetSetBonus?.defenseMult) {
      absorbed = Math.floor(absorbed * targetSetBonus.defenseMult);
    }

    const dmg = dealt - absorbed;

    if (dmg <= 0) {
      return Utils.randomInt(0, 3);
    } else {
      return dmg;
    }
  }

  /**
   * Check for critical hit based on set bonus
   * @param setBonus - Set bonus with critBonus field
   * @returns true if critical hit
   */
  static isCriticalHit(setBonus?: SetBonus): boolean {
    if (!setBonus?.critBonus) return false;
    return Math.random() * 100 < setBonus.critBonus;
  }

  /**
   * Calculate critical damage (1.5x base)
   */
  static criticalDamage(baseDamage: number): number {
    return Math.floor(baseDamage * 1.5);
  }

  /**
   * Calculate max HP, now including player level bonus and set bonuses
   * @param armorLevel - Armor's base level
   * @param playerLevel - Player's character level (default 1)
   * @param setBonus - Optional set bonus modifiers
   *
   * Base HP increased (100 + 25/level) to compensate for reduced per-level bonus
   */
  static hp(armorLevel: number, playerLevel: number = 1, setBonus?: SetBonus): number {
    const baseHP = 100 + ((armorLevel - 1) * 25);
    const levelBonus = Formulas.levelBonusHP(playerLevel);
    let totalHP = baseHP + levelBonus;

    // Apply HP multiplier from set bonus
    if (setBonus?.hpMult) {
      totalHP = Math.floor(totalHP * setBonus.hpMult);
    }

    return totalHP;
  }

  // ============================================================================
  // PROGRESSION FORMULAS
  // ============================================================================

  static readonly MAX_LEVEL = 50;

  /**
   * XP required to reach the next level (tiered exponential curve)
   *
   * Tiers:
   * - Levels 1-10: Fast early game (100 * 1.15^level)
   * - Levels 11-25: Mid game ramp (200 * 1.18^(level-10))
   * - Levels 26-40: Late game grind (500 * 1.20^(level-25))
   * - Levels 41-50: Endgame (1500 * 1.22^(level-40))
   */
  static xpToNextLevel(currentLevel: number): number {
    if (currentLevel >= Formulas.MAX_LEVEL) return Infinity;

    if (currentLevel <= 10) {
      return Math.floor(100 * Math.pow(1.15, currentLevel - 1));
    } else if (currentLevel <= 25) {
      return Math.floor(200 * Math.pow(1.18, currentLevel - 10));
    } else if (currentLevel <= 40) {
      return Math.floor(500 * Math.pow(1.20, currentLevel - 25));
    } else {
      return Math.floor(1500 * Math.pow(1.22, currentLevel - 40));
    }
  }

  /**
   * Base XP from mob based on mob's level
   * Formula: 10 + level * 3 + level^1.2
   */
  static baseXpFromMob(mobLevel: number): number {
    return Math.floor(10 + mobLevel * 3 + Math.pow(mobLevel, 1.2));
  }

  /**
   * XP modifier based on player vs mob level difference
   * Encourages fighting level-appropriate mobs
   */
  static xpLevelModifier(playerLevel: number, mobLevel: number): number {
    const diff = mobLevel - playerLevel;

    if (diff >= 5) return 1.5;      // Much higher = 50% bonus
    if (diff >= 2) return 1.2;      // Higher = 20% bonus
    if (diff >= -2) return 1.0;     // Even = full XP
    if (diff >= -5) return 0.5;     // Lower = 50% penalty
    if (diff >= -10) return 0.1;    // Much lower = 10%
    return 0;                        // Way below = no XP (gray mob)
  }

  /**
   * XP granted from killing a mob, scaled by mob level and player level
   * @param mobLevel - The mob's level
   * @param playerLevel - The player's level (for scaling)
   */
  static xpFromMob(mobLevel: number, playerLevel: number = 1): number {
    const base = Formulas.baseXpFromMob(mobLevel);
    const modifier = Formulas.xpLevelModifier(playerLevel, mobLevel);
    return Math.floor(base * modifier + Utils.randomInt(0, 5));
  }

  /**
   * Bonus HP per player level (+5 HP per level above 1)
   * Reduced from +10 to keep high-level content challenging
   */
  static levelBonusHP(level: number): number {
    return (level - 1) * 5;
  }

  /**
   * Bonus damage per player level (+1 damage per level above 1)
   * Reduced from +2 to keep high-level content challenging
   */
  static levelBonusDamage(level: number): number {
    return (level - 1) * 1;
  }

  // ============================================================================
  // MOB LEVEL FORMULAS
  // ============================================================================

  /**
   * Mob HP derived from mob level
   * Formula: 20 + level * 8 + level^1.3
   * Results: L1=29, L10=120, L20=243, L30=400, L40=589, L50=809
   */
  static mobHP(mobLevel: number): number {
    return Math.floor(20 + mobLevel * 8 + Math.pow(mobLevel, 1.3));
  }

  /**
   * Mob weapon level (damage) derived from mob level
   * Formula: 1 + floor(level / 5)
   * Results: L1=1, L10=3, L20=5, L30=7, L40=9, L50=11
   */
  static mobWeaponLevel(mobLevel: number): number {
    return 1 + Math.floor(mobLevel / 5);
  }

  /**
   * Mob armor level (defense) derived from mob level
   * Formula: 1 + floor(level / 8)
   * Results: L1=1, L10=2, L20=3, L30=4, L40=6, L50=7
   */
  static mobArmorLevel(mobLevel: number): number {
    return 1 + Math.floor(mobLevel / 8);
  }

  /**
   * Get mob level from properties (helper for backward compatibility)
   */
  static getMobLevel(mobKind: string, properties: Record<string, any>): number {
    return properties[mobKind]?.level || 1;
  }

  // ============================================================================
  // ECONOMY FORMULAS
  // ============================================================================

  /**
   * Gold dropped from killing a mob, based on mob's armor level (toughness)
   * Includes random variance for excitement
   */
  static goldFromMob(mobArmorLevel: number): number {
    const baseGold = mobArmorLevel * 5;
    return baseGold + Utils.randomInt(1, mobArmorLevel * 2);
  }
}
