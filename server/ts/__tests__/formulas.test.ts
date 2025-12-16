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
      // Reset any mocks between tests
      vi.restoreAllMocks();
    });

    it('should calculate positive damage when weapon level exceeds armor', () => {
      // Mock randomInt to return consistent values for testing
      vi.spyOn(Utils, 'randomInt')
        .mockReturnValueOnce(7)  // weapon multiplier (5-10)
        .mockReturnValueOnce(2); // armor absorption (1-3)

      const damage = Formulas.dmg(5, 2, 1); // weaponLevel 5, armorLevel 2, playerLevel 1
      // dealt = 5 * 7 + 0 (level 1 = no bonus) = 35
      // absorbed = 2 * 2 = 4
      // damage = 35 - 4 = 31
      expect(damage).toBe(31);
    });

    it('should include level bonus damage', () => {
      vi.spyOn(Utils, 'randomInt')
        .mockReturnValueOnce(5)  // weapon multiplier
        .mockReturnValueOnce(1); // armor absorption

      const damage = Formulas.dmg(3, 2, 10); // playerLevel 10
      // levelBonus = (10-1) * 2 = 18
      // dealt = 3 * 5 + 18 = 33
      // absorbed = 2 * 1 = 2
      // damage = 33 - 2 = 31
      expect(damage).toBe(31);
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
      // returns randomInt(0, 3) = 2
      expect(damage).toBe(2);
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
      // baseHP = 80 + (1-1) * 30 = 80
      // levelBonus = (1-1) * 10 = 0
      expect(hp).toBe(80);
    });

    it('should increase HP with armor level', () => {
      const hp = Formulas.hp(5, 1);
      // baseHP = 80 + (5-1) * 30 = 80 + 120 = 200
      // levelBonus = 0
      expect(hp).toBe(200);
    });

    it('should include player level bonus', () => {
      const hp = Formulas.hp(1, 10);
      // baseHP = 80
      // levelBonus = (10-1) * 10 = 90
      expect(hp).toBe(170);
    });

    it('should combine armor and level bonuses', () => {
      const hp = Formulas.hp(5, 10);
      // baseHP = 80 + 120 = 200
      // levelBonus = 90
      expect(hp).toBe(290);
    });
  });

  describe('xpToNextLevel', () => {
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

    it('should use 1.25 multiplier per level', () => {
      const xp1 = Formulas.xpToNextLevel(1);
      const xp2 = Formulas.xpToNextLevel(2);
      // xp2 = 100 * 1.25^1 = 125
      expect(xp2).toBe(125);
    });

    it('should match expected values at key levels', () => {
      // Level 1->2: 100
      expect(Formulas.xpToNextLevel(1)).toBe(100);
      // Level 10->11: 745 (100 * 1.25^9)
      expect(Formulas.xpToNextLevel(10)).toBe(745);
      // Level 20->21: 6938 (100 * 1.25^19)
      expect(Formulas.xpToNextLevel(20)).toBe(6938);
    });
  });

  describe('xpFromMob', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should scale with mob armor level', () => {
      vi.spyOn(Utils, 'randomInt').mockReturnValue(0);

      const xp1 = Formulas.xpFromMob(1);
      const xp5 = Formulas.xpFromMob(5);

      expect(xp1).toBe(10);  // 1 * 10 + 0
      expect(xp5).toBe(50);  // 5 * 10 + 0
    });

    it('should include random bonus', () => {
      vi.spyOn(Utils, 'randomInt').mockReturnValue(5);

      const xp = Formulas.xpFromMob(3);
      expect(xp).toBe(35); // 3 * 10 + 5
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

    it('should add 10 HP per level above 1', () => {
      expect(Formulas.levelBonusHP(2)).toBe(10);
      expect(Formulas.levelBonusHP(10)).toBe(90);
      expect(Formulas.levelBonusHP(50)).toBe(490);
    });
  });

  describe('levelBonusDamage', () => {
    it('should return 0 for level 1', () => {
      expect(Formulas.levelBonusDamage(1)).toBe(0);
    });

    it('should add 2 damage per level above 1', () => {
      expect(Formulas.levelBonusDamage(2)).toBe(2);
      expect(Formulas.levelBonusDamage(10)).toBe(18);
      expect(Formulas.levelBonusDamage(50)).toBe(98);
    });
  });

  describe('MAX_LEVEL constant', () => {
    it('should be 50', () => {
      expect(Formulas.MAX_LEVEL).toBe(50);
    });
  });
});
