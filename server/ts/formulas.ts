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
   */
  static hp(armorLevel: number, playerLevel: number = 1, setBonus?: SetBonus): number {
    const baseHP = 80 + ((armorLevel - 1) * 30);
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
   * XP required to reach the next level (exponential curve with gentle scaling)
   * Using 1.25 multiplier for sustainable late-game progression:
   * Level 1->2: 100, Level 10->11: 745, Level 20->21: 5,527, Level 50: 70,064
   */
  static xpToNextLevel(currentLevel: number): number {
    if (currentLevel >= Formulas.MAX_LEVEL) return Infinity;
    return Math.floor(100 * Math.pow(1.25, currentLevel - 1));
  }

  /**
   * XP granted from killing a mob, based on mob's armor level (toughness)
   */
  static xpFromMob(mobArmorLevel: number): number {
    return mobArmorLevel * 10 + Utils.randomInt(0, 5);
  }

  /**
   * Bonus HP per player level (+10 HP per level above 1)
   */
  static levelBonusHP(level: number): number {
    return (level - 1) * 10;
  }

  /**
   * Bonus damage per player level (+2 damage per level above 1)
   */
  static levelBonusDamage(level: number): number {
    return (level - 1) * 2;
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
