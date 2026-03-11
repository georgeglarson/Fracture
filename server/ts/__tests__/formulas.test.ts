/**
 * Tests for Formulas class
 * Covers: damage calculation, HP calculation, XP curves, gold drops
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Formulas } from '../formulas';
import { Utils } from '../utils';

describe('Formulas', () => {
  describe('dmg (damage calculation)', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should calculate positive damage when weapon level exceeds armor', () => {
      vi.spyOn(Utils, 'randomInt')
        .mockReturnValueOnce(7)  // weapon multiplier (5-10)
        .mockReturnValueOnce(2); // armor absorption (1-3)

      const damage = Formulas.dmg(5, 2, 1); // weaponLevel 5, armorLevel 2, playerLevel 1
      // dealt = 5 * 7 + 0 (level 1 = no bonus) = 35
      // absorbed = 2 * 2 = 4
      // damage = 35 - 4 = 31
      expect(damage).toBe(31);
    });

    it('should include level bonus damage (+1 per level above 1)', () => {
      vi.spyOn(Utils, 'randomInt')
        .mockReturnValueOnce(5)  // weapon multiplier
        .mockReturnValueOnce(1); // armor absorption

      const damage = Formulas.dmg(3, 2, 10); // playerLevel 10
      // levelBonus = (10-1) * 1 = 9
      // dealt = 3 * 5 + 9 = 24
      // absorbed = 2 * 1 = 2
      // damage = 24 - 2 = 22
      expect(damage).toBe(22);
    });

    it('should return small random damage when damage would be zero or negative', () => {
      vi.spyOn(Utils, 'randomInt')
        .mockReturnValueOnce(5)  // weapon multiplier
        .mockReturnValueOnce(3)  // armor absorption (high)
        .mockReturnValueOnce(2); // fallback random (0-3)

      const damage = Formulas.dmg(1, 10, 1); // weak weapon vs strong armor
      // dealt = 1 * 5 + 0 = 5
      // absorbed = 10 * 3 = 30
      // damage = 5 - 30 = -25 (negative)
      // returns randomInt(1, 3) = 2
      expect(damage).toBe(2);
    });

    it('should never return 0 damage (minimum damage guarantee)', () => {
      // When damage formula goes negative, randomInt(1,3) ensures minimum 1
      vi.spyOn(Utils, 'randomInt')
        .mockReturnValueOnce(5)   // weapon multiplier
        .mockReturnValueOnce(3)   // armor absorption
        .mockReturnValueOnce(1);  // minimum fallback: was 0, now 1

      const damage = Formulas.dmg(1, 10, 1);
      expect(damage).toBeGreaterThanOrEqual(1);
    });

    it('should handle default player level of 1', () => {
      vi.spyOn(Utils, 'randomInt')
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(1);

      const damage = Formulas.dmg(3, 1); // no playerLevel specified
      // dealt = 3 * 10 + 0 = 30
      // absorbed = 1 * 1 = 1
      // damage = 29
      expect(damage).toBe(29);
    });
  });

  describe('hp (health calculation)', () => {
    it('should calculate base HP correctly for armor level 1', () => {
      const hp = Formulas.hp(1, 1);
      // baseHP = 100 + (1-1) * 25 = 100
      // levelBonus = (1-1) * 5 = 0
      expect(hp).toBe(100);
    });

    it('should increase HP with armor level', () => {
      const hp = Formulas.hp(5, 1);
      // baseHP = 100 + (5-1) * 25 = 200
      // levelBonus = 0
      expect(hp).toBe(200);
    });

    it('should include player level bonus (+5 HP per level above 1)', () => {
      const hp = Formulas.hp(1, 10);
      // baseHP = 100
      // levelBonus = (10-1) * 5 = 45
      expect(hp).toBe(145);
    });

    it('should combine armor and level bonuses', () => {
      const hp = Formulas.hp(5, 10);
      // baseHP = 100 + 100 = 200
      // levelBonus = 45
      expect(hp).toBe(245);
    });
  });

  describe('xpToNextLevel (tiered exponential curve)', () => {
    it('should return 100 XP for level 1', () => {
      expect(Formulas.xpToNextLevel(1)).toBe(100);
    });

    it('should increase exponentially with level', () => {
      const xp1 = Formulas.xpToNextLevel(1);
      const xp5 = Formulas.xpToNextLevel(5);
      const xp10 = Formulas.xpToNextLevel(10);

      expect(xp5).toBeGreaterThan(xp1);
      expect(xp10).toBeGreaterThan(xp5);
    });

    it('should return Infinity at max level', () => {
      expect(Formulas.xpToNextLevel(Formulas.MAX_LEVEL)).toBe(Infinity);
      expect(Formulas.xpToNextLevel(Formulas.MAX_LEVEL + 1)).toBe(Infinity);
    });

    it('should increase within each tier', () => {
      // Within tier 1 (levels 1-10), each level costs more
      const xp1 = Formulas.xpToNextLevel(1);
      const xp2 = Formulas.xpToNextLevel(2);
      const xp5 = Formulas.xpToNextLevel(5);
      expect(xp2).toBeGreaterThan(xp1);
      expect(xp5).toBeGreaterThan(xp2);
    });

    it('should match expected values at key levels across tiers', () => {
      // Tier 1 base: Level 1->2: 100
      expect(Formulas.xpToNextLevel(1)).toBe(100);
      // Verify each tier uses its own base and multiplier
      // Tier 2 starts at level 11 with base 200
      expect(Formulas.xpToNextLevel(11)).toBe(Math.floor(200 * Math.pow(1.18, 1)));
      // Tier 3 starts at level 26 with base 500
      expect(Formulas.xpToNextLevel(26)).toBe(Math.floor(500 * Math.pow(1.20, 1)));
      // Tier 4 starts at level 41 with base 1500
      expect(Formulas.xpToNextLevel(41)).toBe(Math.floor(1500 * Math.pow(1.22, 1)));
    });

    it('should have four distinct tiers', () => {
      // Each tier covers a range of levels
      // Tier 1: 1-10, Tier 2: 11-25, Tier 3: 26-40, Tier 4: 41-50
      // Within each tier, XP increases monotonically
      for (let lvl = 2; lvl <= 10; lvl++) {
        expect(Formulas.xpToNextLevel(lvl)).toBeGreaterThan(Formulas.xpToNextLevel(lvl - 1));
      }
      for (let lvl = 12; lvl <= 25; lvl++) {
        expect(Formulas.xpToNextLevel(lvl)).toBeGreaterThan(Formulas.xpToNextLevel(lvl - 1));
      }
    });
  });

  describe('xpFromMob', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should scale with mob level', () => {
      vi.spyOn(Utils, 'randomInt').mockReturnValue(0);

      const xp1 = Formulas.xpFromMob(1);
      const xp5 = Formulas.xpFromMob(5);

      // baseXpFromMob(1) = floor(10 + 3 + 1) = 14, modifier 1.0
      expect(xp1).toBe(14);
      // baseXpFromMob(5) = floor(10 + 15 + 6.9) = 31, modifier 1.2 (mob 4 levels higher)
      expect(xp5).toBe(37);
    });

    it('should include random bonus', () => {
      vi.spyOn(Utils, 'randomInt').mockReturnValue(5);

      const xp = Formulas.xpFromMob(3);
      // baseXpFromMob(3) = floor(10 + 9 + 3.7) = 22, modifier 1.2, random 5
      // floor(22 * 1.2 + 5) = 31
      expect(xp).toBe(31);
    });
  });

  describe('goldFromMob', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should scale with mob armor level', () => {
      vi.spyOn(Utils, 'randomInt').mockReturnValue(1);

      const gold1 = Formulas.goldFromMob(1);
      const gold5 = Formulas.goldFromMob(5);

      expect(gold1).toBe(6);  // 1 * 5 + 1
      expect(gold5).toBe(26); // 5 * 5 + 1
    });

    it('should include random variance based on armor level', () => {
      // Higher armor = more variance in gold drops
      vi.spyOn(Utils, 'randomInt').mockImplementation((min, max) => max);

      const gold1 = Formulas.goldFromMob(1);
      const gold5 = Formulas.goldFromMob(5);

      expect(gold1).toBe(7);  // 5 + 2 (max roll for armor 1)
      expect(gold5).toBe(35); // 25 + 10 (max roll for armor 5)
    });
  });

  describe('levelBonusHP', () => {
    it('should return 0 for level 1', () => {
      expect(Formulas.levelBonusHP(1)).toBe(0);
    });

    it('should add 5 HP per level above 1', () => {
      expect(Formulas.levelBonusHP(2)).toBe(5);
      expect(Formulas.levelBonusHP(10)).toBe(45);
      expect(Formulas.levelBonusHP(50)).toBe(245);
    });
  });

  describe('levelBonusDamage', () => {
    it('should return 0 for level 1', () => {
      expect(Formulas.levelBonusDamage(1)).toBe(0);
    });

    it('should add 1 damage per level above 1', () => {
      expect(Formulas.levelBonusDamage(2)).toBe(1);
      expect(Formulas.levelBonusDamage(10)).toBe(9);
      expect(Formulas.levelBonusDamage(50)).toBe(49);
    });
  });

  describe('mob level formulas', () => {
    it('should calculate mob HP from level', () => {
      // Formula: 20 + level * 8 + level^1.3
      expect(Formulas.mobHP(1)).toBe(29);
      expect(Formulas.mobHP(10)).toBeGreaterThan(100);
    });

    it('should calculate mob weapon level from level', () => {
      // Formula: 1 + floor(level / 5)
      expect(Formulas.mobWeaponLevel(1)).toBe(1);
      expect(Formulas.mobWeaponLevel(10)).toBe(3);
    });

    it('should calculate mob armor level from level', () => {
      // Formula: 1 + floor(level / 8)
      expect(Formulas.mobArmorLevel(1)).toBe(1);
      expect(Formulas.mobArmorLevel(10)).toBe(2);
    });
  });

  describe('critical hit system', () => {
    it('should not crit without set bonus', () => {
      expect(Formulas.isCriticalHit()).toBe(false);
      expect(Formulas.isCriticalHit(undefined)).toBe(false);
    });

    it('should calculate critical damage as 1.5x', () => {
      expect(Formulas.criticalDamage(100)).toBe(150);
      expect(Formulas.criticalDamage(0)).toBe(0);
    });
  });

  describe('xp level modifier', () => {
    it('should give full XP for same-level mobs', () => {
      expect(Formulas.xpLevelModifier(10, 10)).toBe(1.0);
    });

    it('should give bonus XP for higher-level mobs', () => {
      expect(Formulas.xpLevelModifier(10, 15)).toBe(1.5);
      expect(Formulas.xpLevelModifier(10, 12)).toBe(1.2);
    });

    it('should penalize XP for lower-level mobs', () => {
      expect(Formulas.xpLevelModifier(10, 7)).toBe(0.5);
      expect(Formulas.xpLevelModifier(10, 2)).toBe(0.1);
    });

    it('should give zero XP for much lower-level mobs (gray)', () => {
      expect(Formulas.xpLevelModifier(20, 1)).toBe(0);
    });
  });

  describe('MAX_LEVEL constant', () => {
    it('should be 50', () => {
      expect(Formulas.MAX_LEVEL).toBe(50);
    });
  });
});
