/**
 * Tests for equipment-stats module
 * Verifies base stats calculations and comparison functions
 */

import { describe, it, expect } from 'vitest';
import {
  getWeaponStats,
  getArmorStats,
  getWeaponLevel,
  getArmorLevel,
  compareWeapons,
  compareArmors
} from '../equipment-stats';
import { Types } from '../../gametypes';

describe('equipment-stats', () => {
  describe('getWeaponStats', () => {
    it('should return stats for SWORD1 (level 1)', () => {
      const stats = getWeaponStats(Types.Entities.SWORD1);
      expect(stats).not.toBeNull();
      expect(stats?.level).toBe(1);
      expect(stats?.min).toBe(3);
      expect(stats?.max).toBe(6);
    });

    it('should return stats for SWORD2 (level 2)', () => {
      const stats = getWeaponStats(Types.Entities.SWORD2);
      expect(stats).not.toBeNull();
      expect(stats?.level).toBe(2);
      expect(stats?.min).toBe(6);
      expect(stats?.max).toBe(12);
    });

    it('should return stats for AXE (level 3)', () => {
      const stats = getWeaponStats(Types.Entities.AXE);
      expect(stats).not.toBeNull();
      expect(stats?.level).toBe(3);
      expect(stats?.min).toBe(9);
      expect(stats?.max).toBe(18);
    });

    it('should return stats for GOLDENSWORD (high level weapon)', () => {
      const stats = getWeaponStats(Types.Entities.GOLDENSWORD);
      expect(stats).not.toBeNull();
      // GOLDENSWORD should have higher level than basic swords
      expect(stats!.level).toBeGreaterThan(getWeaponLevel(Types.Entities.SWORD2));
      expect(stats!.min).toBeGreaterThan(6); // More than SWORD2
    });

    it('should return null for non-weapons', () => {
      const stats = getWeaponStats(Types.Entities.CLOTHARMOR);
      expect(stats).toBeNull();
    });
  });

  describe('getArmorStats', () => {
    it('should return stats for CLOTHARMOR (level 1)', () => {
      const stats = getArmorStats(Types.Entities.CLOTHARMOR);
      expect(stats).not.toBeNull();
      expect(stats?.level).toBe(1);
      expect(stats?.defense).toBe(1);
    });

    it('should return stats for LEATHERARMOR (level 2)', () => {
      const stats = getArmorStats(Types.Entities.LEATHERARMOR);
      expect(stats).not.toBeNull();
      expect(stats?.level).toBe(2);
      expect(stats?.defense).toBe(2);
    });

    it('should return stats for GOLDENARMOR (highest level)', () => {
      const stats = getArmorStats(Types.Entities.GOLDENARMOR);
      expect(stats).not.toBeNull();
      expect(stats!.level).toBeGreaterThan(5);
      expect(stats!.defense).toBeGreaterThan(5);
    });

    it('should return null for non-armors', () => {
      const stats = getArmorStats(Types.Entities.SWORD1);
      expect(stats).toBeNull();
    });
  });

  describe('getWeaponLevel', () => {
    it('should return level 1 for SWORD1', () => {
      expect(getWeaponLevel(Types.Entities.SWORD1)).toBe(1);
    });

    it('should return higher levels for better weapons', () => {
      const sword1Level = getWeaponLevel(Types.Entities.SWORD1);
      const sword2Level = getWeaponLevel(Types.Entities.SWORD2);
      const axeLevel = getWeaponLevel(Types.Entities.AXE);

      expect(sword2Level).toBeGreaterThan(sword1Level);
      expect(axeLevel).toBeGreaterThan(sword2Level);
    });

    it('should return 1 for non-weapons', () => {
      expect(getWeaponLevel(Types.Entities.CLOTHARMOR)).toBe(1);
    });
  });

  describe('getArmorLevel', () => {
    it('should return level 1 for CLOTHARMOR', () => {
      expect(getArmorLevel(Types.Entities.CLOTHARMOR)).toBe(1);
    });

    it('should return higher levels for better armors', () => {
      const clothLevel = getArmorLevel(Types.Entities.CLOTHARMOR);
      const leatherLevel = getArmorLevel(Types.Entities.LEATHERARMOR);

      expect(leatherLevel).toBeGreaterThan(clothLevel);
    });

    it('should return 1 for non-armors', () => {
      expect(getArmorLevel(Types.Entities.SWORD1)).toBe(1);
    });
  });

  describe('compareWeapons', () => {
    it('should return positive when new weapon is better (base stats)', () => {
      const diff = compareWeapons(
        Types.Entities.SWORD2,
        Types.Entities.SWORD1,
        null,
        null
      );
      expect(diff).toBeGreaterThan(0);
    });

    it('should return negative when new weapon is worse (base stats)', () => {
      const diff = compareWeapons(
        Types.Entities.SWORD1,
        Types.Entities.SWORD2,
        null,
        null
      );
      expect(diff).toBeLessThan(0);
    });

    it('should return 0 for same weapon', () => {
      const diff = compareWeapons(
        Types.Entities.SWORD1,
        Types.Entities.SWORD1,
        null,
        null
      );
      expect(diff).toBe(0);
    });

    it('should use properties when available', () => {
      // New weapon has properties with higher damage
      const diff = compareWeapons(
        Types.Entities.SWORD1,
        Types.Entities.SWORD2,
        { damageMin: 20, damageMax: 40 }, // Superior to SWORD2
        null
      );
      expect(diff).toBeGreaterThan(0);
    });

    it('should compare against equipped properties when available', () => {
      // New basic sword vs equipped sword with bonus damage
      const diff = compareWeapons(
        Types.Entities.SWORD2,
        Types.Entities.SWORD1,
        null,
        { damageMin: 15, damageMax: 30 } // Equipped has bonus properties
      );
      // SWORD2 base (6-12 avg 9) vs equipped SWORD1 with props (15-30 avg 22.5)
      expect(diff).toBeLessThan(0);
    });

    it('should handle both having properties', () => {
      const diff = compareWeapons(
        Types.Entities.SWORD1,
        Types.Entities.SWORD1,
        { damageMin: 10, damageMax: 20 },
        { damageMin: 5, damageMax: 10 }
      );
      // New avg 15, equipped avg 7.5
      expect(diff).toBeGreaterThan(0);
    });
  });

  describe('compareArmors', () => {
    it('should return positive when new armor is better', () => {
      const diff = compareArmors(
        Types.Entities.LEATHERARMOR,
        Types.Entities.CLOTHARMOR,
        null,
        null
      );
      expect(diff).toBeGreaterThan(0);
    });

    it('should return negative when new armor is worse', () => {
      const diff = compareArmors(
        Types.Entities.CLOTHARMOR,
        Types.Entities.LEATHERARMOR,
        null,
        null
      );
      expect(diff).toBeLessThan(0);
    });

    it('should use properties when available', () => {
      // New armor has properties with higher defense
      const diff = compareArmors(
        Types.Entities.CLOTHARMOR,
        Types.Entities.LEATHERARMOR,
        { defense: 10 }, // Superior defense
        null
      );
      expect(diff).toBeGreaterThan(0);
    });

    it('should compare against equipped properties', () => {
      const diff = compareArmors(
        Types.Entities.LEATHERARMOR,
        Types.Entities.CLOTHARMOR,
        null,
        { defense: 10 } // Equipped has bonus defense
      );
      // Leather base (2) vs equipped Cloth with bonus (10)
      expect(diff).toBeLessThan(0);
    });
  });
});
