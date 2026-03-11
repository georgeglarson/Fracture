/**
 * Tests for ItemGenerator and Item
 * Covers: rollRarity, generateItem, generateSimpleItem, item-tables helpers,
 *         rarity bonus shifting, drop rate distributions, edge cases (unknown
 *         kinds, level boundaries), and the Item entity class.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';
import { Rarity } from '../../../shared/ts/items/item-types';
import {
  rollRarity,
  generateItem,
  generateSimpleItem,
} from '../items/item-generator';
import {
  WeaponStats,
  ArmorStats,
  ConsumableStats,
  RarityWeights,
  RarityMultipliers,
  RarityBonusCount,
  BonusPropertyRanges,
  getItemCategory,
  getItemLevel,
  getDisplayName,
} from '../items/item-tables';
import { Item } from '../item';

// ---------------------------------------------------------------------------
// Constants used across tests
// ---------------------------------------------------------------------------
// Use numeric literals for entity kinds that appear in the stale gametypes.js.
// The compiled .js co-located with gametypes.ts only includes the original
// entities (up through kind 66). Newer IDs (dimension, set, legendary) are
// present in WeaponStats/ArmorStats but are not registered in the kinds
// registry at runtime, so getItemCategory / isWeapon / isArmor do not
// recognize them. Tests that iterate WeaponStats/ArmorStats keys therefore
// skip unregistered kinds.
const SWORD1 = Types.Entities.SWORD1;       // 60
const SWORD2 = Types.Entities.SWORD2;       // 61
const AXE = Types.Entities.AXE;             // 65
const GOLDENSWORD = Types.Entities.GOLDENSWORD; // 63
const CLOTHARMOR = Types.Entities.CLOTHARMOR;   // 21
const GOLDENARMOR = Types.Entities.GOLDENARMOR; // 26
const PLATEARMOR = Types.Entities.PLATEARMOR;   // 24
const REDARMOR = Types.Entities.REDARMOR;       // 25
const FLASK = Types.Entities.FLASK;             // 35
const BURGER = Types.Entities.BURGER;           // 36
const FIREPOTION = Types.Entities.FIREPOTION;   // 38
const CAKE = Types.Entities.CAKE;               // 39
const CHEST = Types.Entities.CHEST;             // 37
const RAT = Types.Entities.RAT;                 // 2
const BOSS = Types.Entities.BOSS;               // 13
const GUARD = Types.Entities.GUARD;             // 40
const WARRIOR = Types.Entities.WARRIOR;         // 1
const MORNINGSTAR = Types.Entities.MORNINGSTAR; // 64
const BLUESWORD = Types.Entities.BLUESWORD;     // 66
const REDSWORD = Types.Entities.REDSWORD;       // 62

/**
 * Helper: filter WeaponStats/ArmorStats/ConsumableStats keys to only
 * those that the kinds registry actually recognizes (avoids stale .js issue
 * where newer entity IDs are not registered).
 */
function registeredWeaponKinds(): number[] {
  return Object.keys(WeaponStats)
    .map(Number)
    .filter(k => Types.isWeapon(k));
}

function registeredArmorKinds(): number[] {
  return Object.keys(ArmorStats)
    .map(Number)
    .filter(k => Types.isArmor(k));
}

function registeredConsumableKinds(): number[] {
  return Object.keys(ConsumableStats)
    .map(Number)
    .filter(k => Types.isObject(k) && !Types.isChest(k));
}

// ============================================================================
// item-tables.ts helpers
// ============================================================================

describe('item-tables', () => {
  describe('getItemCategory', () => {
    it('should return "weapon" for weapon kinds', () => {
      expect(getItemCategory(SWORD1)).toBe('weapon');
      expect(getItemCategory(SWORD2)).toBe('weapon');
      expect(getItemCategory(AXE)).toBe('weapon');
      expect(getItemCategory(GOLDENSWORD)).toBe('weapon');
      expect(getItemCategory(MORNINGSTAR)).toBe('weapon');
      expect(getItemCategory(BLUESWORD)).toBe('weapon');
      expect(getItemCategory(REDSWORD)).toBe('weapon');
    });

    it('should return "armor" for armor kinds', () => {
      expect(getItemCategory(CLOTHARMOR)).toBe('armor');
      expect(getItemCategory(GOLDENARMOR)).toBe('armor');
      expect(getItemCategory(PLATEARMOR)).toBe('armor');
      expect(getItemCategory(REDARMOR)).toBe('armor');
    });

    it('should return "consumable" for non-chest objects', () => {
      expect(getItemCategory(FLASK)).toBe('consumable');
      expect(getItemCategory(BURGER)).toBe('consumable');
      expect(getItemCategory(FIREPOTION)).toBe('consumable');
      expect(getItemCategory(CAKE)).toBe('consumable');
    });

    it('should return null for chests', () => {
      expect(getItemCategory(CHEST)).toBeNull();
    });

    it('should return null for mobs and NPCs', () => {
      expect(getItemCategory(RAT)).toBeNull();
      expect(getItemCategory(BOSS)).toBeNull();
      expect(getItemCategory(GUARD)).toBeNull();
    });

    it('should return null for player kind', () => {
      expect(getItemCategory(WARRIOR)).toBeNull();
    });
  });

  describe('getItemLevel', () => {
    it('should return rank + 1 for weapons', () => {
      // SWORD1 is rank 0 => level 1
      expect(getItemLevel(SWORD1)).toBe(Types.getWeaponRank(SWORD1) + 1);
      expect(getItemLevel(SWORD1)).toBe(1);

      // GOLDENSWORD is a higher-ranked weapon
      const goldenRank = Types.getWeaponRank(GOLDENSWORD);
      expect(getItemLevel(GOLDENSWORD)).toBe(goldenRank + 1);
      expect(getItemLevel(GOLDENSWORD)).toBeGreaterThan(1);
    });

    it('should return rank + 1 for armors', () => {
      expect(getItemLevel(CLOTHARMOR)).toBe(Types.getArmorRank(CLOTHARMOR) + 1);
      expect(getItemLevel(CLOTHARMOR)).toBe(1);

      const goldenArmorRank = Types.getArmorRank(GOLDENARMOR);
      expect(getItemLevel(GOLDENARMOR)).toBe(goldenArmorRank + 1);
      expect(getItemLevel(GOLDENARMOR)).toBeGreaterThan(1);
    });

    it('should return 1 for consumables', () => {
      expect(getItemLevel(FLASK)).toBe(1);
      expect(getItemLevel(BURGER)).toBe(1);
    });

    it('should return 1 for unknown kinds', () => {
      expect(getItemLevel(RAT)).toBe(1);
    });

    it('should return increasing levels along the weapon rank array', () => {
      const prev = getItemLevel(SWORD1);
      const next = getItemLevel(GOLDENSWORD);
      expect(next).toBeGreaterThan(prev);
    });

    it('should return increasing levels along the armor rank array', () => {
      const prev = getItemLevel(CLOTHARMOR);
      const next = getItemLevel(GOLDENARMOR);
      expect(next).toBeGreaterThan(prev);
    });
  });

  describe('getDisplayName', () => {
    it('should return the display name from WeaponStats', () => {
      expect(getDisplayName(SWORD1)).toBe('Wooden Sword');
      expect(getDisplayName(SWORD2)).toBe('Steel Sword');
      expect(getDisplayName(GOLDENSWORD)).toBe('Golden Sword');
    });

    it('should return the display name from ArmorStats', () => {
      expect(getDisplayName(CLOTHARMOR)).toBe('Cloth Armor');
      expect(getDisplayName(GOLDENARMOR)).toBe('Golden Armor');
    });

    it('should return the display name from ConsumableStats', () => {
      expect(getDisplayName(FLASK)).toBe('Health Potion');
      expect(getDisplayName(BURGER)).toBe('Burger');
      expect(getDisplayName(CAKE)).toBe('Cake');
    });

    it('should fall back to gametypes kind string for unknown items', () => {
      const result = getDisplayName(RAT);
      expect(result).toBe(Types.getKindAsString(RAT) || 'Unknown Item');
    });

    it('should return "Unknown Item" for a totally unknown kind', () => {
      const result = getDisplayName(99999);
      expect(result).toBe('Unknown Item');
    });
  });

  describe('RarityWeights', () => {
    it('should sum to 100', () => {
      const total = Object.values(RarityWeights).reduce((sum, w) => sum + w, 0);
      expect(total).toBe(100);
    });

    it('should have decreasing weights for increasing rarity', () => {
      expect(RarityWeights[Rarity.COMMON]).toBeGreaterThan(RarityWeights[Rarity.UNCOMMON]);
      expect(RarityWeights[Rarity.UNCOMMON]).toBeGreaterThan(RarityWeights[Rarity.RARE]);
      expect(RarityWeights[Rarity.RARE]).toBeGreaterThan(RarityWeights[Rarity.EPIC]);
      expect(RarityWeights[Rarity.EPIC]).toBeGreaterThan(RarityWeights[Rarity.LEGENDARY]);
    });

    it('should have all positive weights', () => {
      for (const weight of Object.values(RarityWeights)) {
        expect(weight).toBeGreaterThan(0);
      }
    });
  });

  describe('RarityMultipliers', () => {
    it('should have COMMON at 1.0 base', () => {
      expect(RarityMultipliers[Rarity.COMMON]).toBe(1.0);
    });

    it('should increase for every rarity tier', () => {
      expect(RarityMultipliers[Rarity.UNCOMMON]).toBeGreaterThan(RarityMultipliers[Rarity.COMMON]);
      expect(RarityMultipliers[Rarity.RARE]).toBeGreaterThan(RarityMultipliers[Rarity.UNCOMMON]);
      expect(RarityMultipliers[Rarity.EPIC]).toBeGreaterThan(RarityMultipliers[Rarity.RARE]);
      expect(RarityMultipliers[Rarity.LEGENDARY]).toBeGreaterThan(RarityMultipliers[Rarity.EPIC]);
    });

    it('should have LEGENDARY at 2.0x', () => {
      expect(RarityMultipliers[Rarity.LEGENDARY]).toBe(2.0);
    });
  });

  describe('RarityBonusCount', () => {
    it('should give COMMON zero bonus properties', () => {
      expect(RarityBonusCount[Rarity.COMMON]).toEqual({ min: 0, max: 0 });
    });

    it('should give LEGENDARY max bonus properties', () => {
      expect(RarityBonusCount[Rarity.LEGENDARY]).toEqual({ min: 3, max: 3 });
    });

    it('should have non-decreasing min across tiers', () => {
      const tiers = [Rarity.COMMON, Rarity.UNCOMMON, Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY];
      for (let i = 1; i < tiers.length; i++) {
        expect(RarityBonusCount[tiers[i]].min).toBeGreaterThanOrEqual(
          RarityBonusCount[tiers[i - 1]].min
        );
      }
    });

    it('should have non-decreasing max across tiers', () => {
      const tiers = [Rarity.COMMON, Rarity.UNCOMMON, Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY];
      for (let i = 1; i < tiers.length; i++) {
        expect(RarityBonusCount[tiers[i]].max).toBeGreaterThanOrEqual(
          RarityBonusCount[tiers[i - 1]].max
        );
      }
    });

    it('should always have min <= max within each tier', () => {
      for (const rarity of Object.values(Rarity)) {
        expect(RarityBonusCount[rarity].min).toBeLessThanOrEqual(RarityBonusCount[rarity].max);
      }
    });
  });

  describe('BonusPropertyRanges', () => {
    it('should define ranges for bonusHealth, bonusStrength, bonusCritChance', () => {
      expect(BonusPropertyRanges.bonusHealth).toBeDefined();
      expect(BonusPropertyRanges.bonusStrength).toBeDefined();
      expect(BonusPropertyRanges.bonusCritChance).toBeDefined();
    });

    it('should have min < max for every range', () => {
      for (const [, range] of Object.entries(BonusPropertyRanges)) {
        expect(range.min).toBeLessThan(range.max);
      }
    });

    it('should have positive min values', () => {
      for (const [, range] of Object.entries(BonusPropertyRanges)) {
        expect(range.min).toBeGreaterThan(0);
      }
    });
  });

  describe('WeaponStats coverage', () => {
    it('should have damageMin < damageMax for every weapon', () => {
      for (const [, stats] of Object.entries(WeaponStats)) {
        expect(stats.damageMin).toBeLessThan(stats.damageMax);
      }
    });

    it('should have a displayName for every weapon', () => {
      for (const [, stats] of Object.entries(WeaponStats)) {
        expect(stats.displayName).toBeTruthy();
      }
    });

    it('should have positive damage values', () => {
      for (const [, stats] of Object.entries(WeaponStats)) {
        expect(stats.damageMin).toBeGreaterThan(0);
        expect(stats.damageMax).toBeGreaterThan(0);
      }
    });
  });

  describe('ArmorStats coverage', () => {
    it('should have positive defense for every armor', () => {
      for (const [, stats] of Object.entries(ArmorStats)) {
        expect(stats.defense).toBeGreaterThan(0);
      }
    });

    it('should have a displayName for every armor', () => {
      for (const [, stats] of Object.entries(ArmorStats)) {
        expect(stats.displayName).toBeTruthy();
      }
    });
  });
});

// ============================================================================
// rollRarity
// ============================================================================

describe('rollRarity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return a valid Rarity enum value', () => {
    const rarity = rollRarity();
    const validValues = Object.values(Rarity);
    expect(validValues).toContain(rarity);
  });

  it('should return COMMON when roll is 0 (start of range)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // roll = 0
    expect(rollRarity()).toBe(Rarity.COMMON);
  });

  it('should return COMMON for a low roll', () => {
    // RarityWeights.common = 70, so roll < 70 => COMMON
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // roll = 50
    expect(rollRarity()).toBe(Rarity.COMMON);
  });

  it('should return UNCOMMON for roll in 70..89 range', () => {
    // cumulative: common=70, uncommon=90, so 70 <= roll < 90 => UNCOMMON
    vi.spyOn(Math, 'random').mockReturnValue(0.75); // roll = 75
    expect(rollRarity()).toBe(Rarity.UNCOMMON);
  });

  it('should return RARE for roll in 90..96 range', () => {
    // cumulative: ..90, rare=97, so 90 <= roll < 97 => RARE
    vi.spyOn(Math, 'random').mockReturnValue(0.93); // roll = 93
    expect(rollRarity()).toBe(Rarity.RARE);
  });

  it('should return EPIC for roll in 97..99.4 range', () => {
    // cumulative: ..97, epic=99.5, so 97 <= roll < 99.5 => EPIC
    vi.spyOn(Math, 'random').mockReturnValue(0.98); // roll = 98
    expect(rollRarity()).toBe(Rarity.EPIC);
  });

  it('should return LEGENDARY for roll >= 99.5', () => {
    // cumulative: ..99.5, legendary=100, so 99.5 <= roll < 100 => LEGENDARY
    vi.spyOn(Math, 'random').mockReturnValue(0.998); // roll = 99.8
    expect(rollRarity()).toBe(Rarity.LEGENDARY);
  });

  it('should fallback to COMMON if roll somehow exceeds all weights', () => {
    // If Math.random returns exactly 1.0 (impossible in practice, but tests the fallback)
    vi.spyOn(Math, 'random').mockReturnValue(1.0); // roll = 100
    expect(rollRarity()).toBe(Rarity.COMMON);
  });

  it('should return COMMON at the boundary just below 70', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.699); // roll = 69.9
    expect(rollRarity()).toBe(Rarity.COMMON);
  });

  it('should return UNCOMMON at exactly the COMMON boundary', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.70); // roll = 70
    expect(rollRarity()).toBe(Rarity.UNCOMMON);
  });

  describe('rarity bonus', () => {
    it('should shift weights away from COMMON with a positive bonus', () => {
      // With rarityBonus = 0.3, common weight drops by 70*0.3 = 21
      // New common weight = 49, so roll at 50 is no longer COMMON
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // roll = 50
      const rarity = rollRarity(0.3);
      expect(rarity).not.toBe(Rarity.COMMON);
    });

    it('should still return COMMON for very low rolls even with a bonus', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // roll = 10
      expect(rollRarity(0.3)).toBe(Rarity.COMMON);
    });

    it('should not change weights when bonus is 0', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // roll = 50
      expect(rollRarity(0)).toBe(Rarity.COMMON);
    });

    it('should make legendary more likely with a high bonus', () => {
      // bonus=1.0: common goes to 0, weights redistribute
      // common=0, uncommon=20+35=55, rare=7+17.5=24.5, epic=2.5+10.5=13, leg=0.5+7=7.5
      // cumulative: 0, 55, 79.5, 92.5, 100
      // roll=95 => legendary
      vi.spyOn(Math, 'random').mockReturnValue(0.95); // roll = 95
      expect(rollRarity(1.0)).toBe(Rarity.LEGENDARY);
    });

    it('should correctly shift UNCOMMON weight with bonus', () => {
      // bonus=0.3: common=49, uncommon=20+10.5=30.5
      // cumulative: 49, 79.5
      // roll=60 => UNCOMMON
      vi.spyOn(Math, 'random').mockReturnValue(0.6); // roll = 60
      expect(rollRarity(0.3)).toBe(Rarity.UNCOMMON);
    });
  });
});

// ============================================================================
// generateItem
// ============================================================================

describe('generateItem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('weapon generation', () => {
    it('should generate a weapon with correct structure', () => {
      const item = generateItem(SWORD2);
      expect(item.kind).toBe(SWORD2);
      expect(item.kindName).toBe(Types.getKindAsString(SWORD2));
      expect(item.properties.category).toBe('weapon');
      expect(item.properties.damageMin).toBeDefined();
      expect(item.properties.damageMax).toBeDefined();
      expect(item.properties.level).toBe(getItemLevel(SWORD2));
    });

    it('should ensure damageMin <= damageMax', () => {
      for (let i = 0; i < 20; i++) {
        const item = generateItem(SWORD1);
        expect(item.properties.damageMin!).toBeLessThanOrEqual(item.properties.damageMax!);
      }
    });

    it('should apply rarity multiplier to weapon damage', () => {
      // Force LEGENDARY rarity (2x multiplier)
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.999)  // rollRarity => legendary
        .mockReturnValueOnce(0.5)    // variance for damageMin => 1.0
        .mockReturnValueOnce(0.5);   // variance for damageMax => 1.0

      const item = generateItem(SWORD1);
      const base = WeaponStats[SWORD1];
      const mult = RarityMultipliers[Rarity.LEGENDARY];

      // With variance at ~1.0, damage should be close to base * mult
      expect(item.properties.damageMin).toBeGreaterThanOrEqual(
        Math.round(base.damageMin * mult * 0.85)
      );
      expect(item.properties.damageMax).toBeLessThanOrEqual(
        Math.round(base.damageMax * mult * 1.15)
      );
    });

    it('should add rarity prefix to displayName for non-COMMON items', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.93); // RARE
      const item = generateItem(SWORD2);
      expect(item.displayName).toMatch(/^Rare /);
      expect(item.displayName).toContain('Steel Sword');
    });

    it('should not add rarity prefix for COMMON items', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // COMMON
      const item = generateItem(SWORD2);
      expect(item.displayName).toBe('Steel Sword');
    });

    it('should capitalize rarity name in display prefix', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.75); // UNCOMMON
      const item = generateItem(SWORD2);
      expect(item.displayName).toMatch(/^Uncommon Steel Sword$/);
    });

    it('should generate EPIC prefix correctly', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.98); // EPIC
      const item = generateItem(SWORD2);
      expect(item.displayName).toMatch(/^Epic Steel Sword$/);
    });

    it('should generate LEGENDARY prefix correctly', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999); // LEGENDARY
      const item = generateItem(SWORD1);
      expect(item.displayName).toMatch(/^Legendary /);
    });

    it('should work for Morning Star', () => {
      const item = generateItem(MORNINGSTAR);
      expect(item.properties.category).toBe('weapon');
      expect(item.properties.damageMin).toBeDefined();
      expect(item.properties.damageMax).toBeDefined();
    });

    it('should work for Blue Sword', () => {
      const item = generateItem(BLUESWORD);
      expect(item.properties.category).toBe('weapon');
      expect(item.displayName).toContain('Sapphire Sword');
    });

    it('should work for Red Sword', () => {
      const item = generateItem(REDSWORD);
      expect(item.properties.category).toBe('weapon');
    });

    it('should set rarity on the properties object', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.93); // RARE
      const item = generateItem(SWORD2);
      expect(item.properties.rarity).toBe(Rarity.RARE);
    });
  });

  describe('armor generation', () => {
    it('should generate armor with correct structure', () => {
      const item = generateItem(PLATEARMOR);
      expect(item.kind).toBe(PLATEARMOR);
      expect(item.properties.category).toBe('armor');
      expect(item.properties.defense).toBeDefined();
      expect(item.properties.defense).toBeGreaterThanOrEqual(1);
      expect(item.properties.level).toBe(getItemLevel(PLATEARMOR));
    });

    it('should enforce minimum defense of 1', () => {
      for (let i = 0; i < 20; i++) {
        const item = generateItem(CLOTHARMOR);
        expect(item.properties.defense).toBeGreaterThanOrEqual(1);
      }
    });

    it('should apply rarity multiplier to armor defense', () => {
      // Force LEGENDARY rarity
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.999)  // rollRarity => legendary
        .mockReturnValueOnce(0.5);   // variance => 1.0

      const item = generateItem(GOLDENARMOR);
      const base = ArmorStats[GOLDENARMOR];
      const mult = RarityMultipliers[Rarity.LEGENDARY];

      expect(item.properties.defense).toBeGreaterThanOrEqual(
        Math.round(base.defense * mult * 0.9)
      );
      expect(item.properties.defense).toBeLessThanOrEqual(
        Math.round(base.defense * mult * 1.1)
      );
    });

    it('should work for leather armor', () => {
      const item = generateItem(Types.Entities.LEATHERARMOR);
      expect(item.properties.category).toBe('armor');
      expect(item.properties.defense).toBeDefined();
    });

    it('should work for mail armor', () => {
      const item = generateItem(Types.Entities.MAILARMOR);
      expect(item.properties.category).toBe('armor');
    });

    it('should work for red armor', () => {
      const item = generateItem(REDARMOR);
      expect(item.properties.category).toBe('armor');
    });

    it('should set rarity on armor properties', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.75); // UNCOMMON
      const item = generateItem(PLATEARMOR);
      expect(item.properties.rarity).toBe(Rarity.UNCOMMON);
    });

    it('should add rarity prefix to armor displayName', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.93); // RARE
      const item = generateItem(PLATEARMOR);
      expect(item.displayName).toBe('Rare Plate Armor');
    });
  });

  describe('consumable generation', () => {
    it('should generate consumable with COMMON rarity always', () => {
      const item = generateItem(FLASK);
      expect(item.properties.rarity).toBe(Rarity.COMMON);
      expect(item.properties.category).toBe('consumable');
      expect(item.properties.level).toBe(1);
    });

    it('should include healAmount from ConsumableStats', () => {
      const item = generateItem(FLASK);
      expect(item.properties.healAmount).toBe(ConsumableStats[FLASK].healAmount);
    });

    it('should handle consumables with no healAmount (fire potion)', () => {
      const item = generateItem(FIREPOTION);
      expect(item.properties.category).toBe('consumable');
      expect(item.properties.healAmount).toBeUndefined();
    });

    it('should not add rarity prefix to consumable display name', () => {
      const item = generateItem(FLASK);
      expect(item.displayName).toBe('Health Potion');
    });

    it('should generate burger with correct heal amount', () => {
      const item = generateItem(BURGER);
      expect(item.properties.healAmount).toBe(100);
    });

    it('should generate cake with correct heal amount', () => {
      const item = generateItem(CAKE);
      expect(item.properties.healAmount).toBe(60);
    });

    it('should ignore rarityBonus for consumables', () => {
      const item = generateItem(FLASK, 0.9);
      expect(item.properties.rarity).toBe(Rarity.COMMON);
    });
  });

  describe('bonus properties', () => {
    it('should not generate bonus properties for COMMON items', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1); // COMMON
      const item = generateItem(SWORD2);
      expect(item.properties.bonusHealth).toBeUndefined();
      expect(item.properties.bonusStrength).toBeUndefined();
      expect(item.properties.bonusCritChance).toBeUndefined();
    });

    it('should eventually generate bonus properties on non-COMMON items', () => {
      // Over 50 tries, at least some non-COMMON items should have bonuses
      let foundBonus = false;
      for (let i = 0; i < 50; i++) {
        const item = generateItem(SWORD2);
        if (
          item.properties.bonusHealth !== undefined ||
          item.properties.bonusStrength !== undefined ||
          item.properties.bonusCritChance !== undefined
        ) {
          foundBonus = true;
          break;
        }
      }
      expect(foundBonus).toBe(true);
    });

    it('should have bonus values within scaled ranges', () => {
      for (let i = 0; i < 50; i++) {
        const item = generateItem(GOLDENSWORD);
        if (item.properties.bonusHealth !== undefined) {
          expect(item.properties.bonusHealth).toBeGreaterThanOrEqual(1);
          expect(item.properties.bonusHealth).toBeLessThanOrEqual(
            Math.round(BonusPropertyRanges.bonusHealth.max * RarityMultipliers[Rarity.LEGENDARY])
          );
        }
        if (item.properties.bonusStrength !== undefined) {
          expect(item.properties.bonusStrength).toBeGreaterThanOrEqual(1);
          expect(item.properties.bonusStrength).toBeLessThanOrEqual(
            Math.round(BonusPropertyRanges.bonusStrength.max * RarityMultipliers[Rarity.LEGENDARY])
          );
        }
        if (item.properties.bonusCritChance !== undefined) {
          expect(item.properties.bonusCritChance).toBeGreaterThanOrEqual(1);
          expect(item.properties.bonusCritChance).toBeLessThanOrEqual(
            Math.round(BonusPropertyRanges.bonusCritChance.max * RarityMultipliers[Rarity.LEGENDARY])
          );
        }
      }
    });

    it('should not assign bonuses to consumable items', () => {
      for (let i = 0; i < 20; i++) {
        const item = generateItem(FLASK);
        expect(item.properties.bonusHealth).toBeUndefined();
        expect(item.properties.bonusStrength).toBeUndefined();
        expect(item.properties.bonusCritChance).toBeUndefined();
      }
    });
  });

  describe('edge cases', () => {
    it('should throw for an unknown/invalid kind (mob kind)', () => {
      expect(() => generateItem(RAT)).toThrow();
    });

    it('should throw for chest kind (null category)', () => {
      expect(() => generateItem(CHEST)).toThrow();
    });

    it('should throw for player kind', () => {
      expect(() => generateItem(WARRIOR)).toThrow();
    });

    it('should throw for an NPC kind', () => {
      expect(() => generateItem(GUARD)).toThrow();
    });

    it('should throw with a descriptive error message', () => {
      expect(() => generateItem(RAT)).toThrow(/Cannot generate item for kind/);
    });

    it('should generate valid items for every registered weapon kind', () => {
      for (const kind of registeredWeaponKinds()) {
        const item = generateItem(kind);
        expect(item.properties.category).toBe('weapon');
        expect(item.properties.damageMin).toBeDefined();
        expect(item.properties.damageMax).toBeDefined();
        expect(item.properties.damageMin!).toBeLessThanOrEqual(item.properties.damageMax!);
      }
    });

    it('should generate valid items for every registered armor kind', () => {
      for (const kind of registeredArmorKinds()) {
        const item = generateItem(kind);
        expect(item.properties.category).toBe('armor');
        expect(item.properties.defense).toBeDefined();
        expect(item.properties.defense).toBeGreaterThanOrEqual(1);
      }
    });

    it('should generate valid items for every registered consumable kind', () => {
      for (const kind of registeredConsumableKinds()) {
        const item = generateItem(kind);
        expect(item.properties.category).toBe('consumable');
        expect(item.properties.rarity).toBe(Rarity.COMMON);
      }
    });

    it('should throw for kind 0', () => {
      expect(() => generateItem(0)).toThrow();
    });

    it('should throw for negative kind', () => {
      expect(() => generateItem(-1)).toThrow();
    });

    it('should throw for very large unknown kind', () => {
      expect(() => generateItem(99999)).toThrow();
    });
  });

  describe('rarityBonus parameter', () => {
    it('should accept rarityBonus = 0 (default behavior)', () => {
      const item = generateItem(SWORD2, 0);
      expect(item).toBeDefined();
    });

    it('should accept rarityBonus = 1 (maximum shift)', () => {
      const item = generateItem(SWORD2, 1.0);
      expect(item).toBeDefined();
    });

    it('should default rarityBonus to 0 when not specified', () => {
      // With no bonus, COMMON at 70% should be most frequent
      let commonCount = 0;
      const N = 100;
      for (let i = 0; i < N; i++) {
        if (generateItem(SWORD2).properties.rarity === Rarity.COMMON) {
          commonCount++;
        }
      }
      expect(commonCount).toBeGreaterThan(N * 0.4);
    });

    it('should produce higher average rarity with higher bonus', () => {
      const rarityOrder = [
        Rarity.COMMON, Rarity.UNCOMMON, Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY,
      ];
      const toNum = (r: Rarity) => rarityOrder.indexOf(r);

      let sumNoBonus = 0;
      let sumHighBonus = 0;
      const iterations = 500;

      for (let i = 0; i < iterations; i++) {
        sumNoBonus += toNum(generateItem(SWORD2, 0).properties.rarity);
        sumHighBonus += toNum(generateItem(SWORD2, 0.8).properties.rarity);
      }

      expect(sumHighBonus / iterations).toBeGreaterThan(sumNoBonus / iterations);
    });
  });
});

// ============================================================================
// generateSimpleItem
// ============================================================================

describe('generateSimpleItem', () => {
  it('should generate a weapon with base stats and COMMON rarity', () => {
    const item = generateSimpleItem(SWORD2);
    expect(item.kind).toBe(SWORD2);
    expect(item.properties.rarity).toBe(Rarity.COMMON);
    expect(item.properties.category).toBe('weapon');
    expect(item.properties.damageMin).toBe(WeaponStats[SWORD2].damageMin);
    expect(item.properties.damageMax).toBe(WeaponStats[SWORD2].damageMax);
    expect(item.displayName).toBe('Steel Sword');
  });

  it('should generate armor with base stats and COMMON rarity', () => {
    const item = generateSimpleItem(PLATEARMOR);
    expect(item.properties.rarity).toBe(Rarity.COMMON);
    expect(item.properties.category).toBe('armor');
    expect(item.properties.defense).toBe(ArmorStats[PLATEARMOR].defense);
    expect(item.displayName).toBe('Plate Armor');
  });

  it('should generate consumable with base stats', () => {
    const item = generateSimpleItem(FLASK);
    expect(item.properties.rarity).toBe(Rarity.COMMON);
    expect(item.properties.category).toBe('consumable');
    expect(item.properties.healAmount).toBe(ConsumableStats[FLASK].healAmount);
    expect(item.displayName).toBe('Health Potion');
  });

  it('should not have bonus properties', () => {
    const item = generateSimpleItem(GOLDENSWORD);
    expect(item.properties.bonusHealth).toBeUndefined();
    expect(item.properties.bonusStrength).toBeUndefined();
    expect(item.properties.bonusCritChance).toBeUndefined();
  });

  it('should not have rarity prefix in displayName', () => {
    const item = generateSimpleItem(GOLDENSWORD);
    expect(item.displayName).toBe('Golden Sword');
  });

  it('should use "consumable" as fallback category for null category', () => {
    const item = generateSimpleItem(CHEST);
    expect(item.properties.category).toBe('consumable');
  });

  it('should produce deterministic results (no randomization)', () => {
    const item1 = generateSimpleItem(SWORD2);
    const item2 = generateSimpleItem(SWORD2);
    expect(item1.properties.damageMin).toBe(item2.properties.damageMin);
    expect(item1.properties.damageMax).toBe(item2.properties.damageMax);
    expect(item1.properties.rarity).toBe(item2.properties.rarity);
    expect(item1.properties.level).toBe(item2.properties.level);
  });

  it('should set level correctly', () => {
    const item = generateSimpleItem(GOLDENSWORD);
    expect(item.properties.level).toBe(getItemLevel(GOLDENSWORD));
  });

  it('should return correct kindName', () => {
    const item = generateSimpleItem(SWORD2);
    expect(item.kindName).toBe('sword2');
  });

  it('should handle all registered weapons', () => {
    for (const kind of registeredWeaponKinds()) {
      const item = generateSimpleItem(kind);
      expect(item.properties.category).toBe('weapon');
      expect(item.properties.damageMin).toBe(WeaponStats[kind].damageMin);
      expect(item.properties.damageMax).toBe(WeaponStats[kind].damageMax);
    }
  });

  it('should handle all registered armors', () => {
    for (const kind of registeredArmorKinds()) {
      const item = generateSimpleItem(kind);
      expect(item.properties.category).toBe('armor');
      expect(item.properties.defense).toBe(ArmorStats[kind].defense);
    }
  });

  it('should handle all registered consumables', () => {
    for (const kind of registeredConsumableKinds()) {
      const item = generateSimpleItem(kind);
      expect(item.properties.category).toBe('consumable');
    }
  });
});

// ============================================================================
// Drop rate distribution (statistical)
// ============================================================================

describe('drop rate distribution', () => {
  it('should approximate expected rarity distribution over many rolls', () => {
    const counts: Record<string, number> = {
      [Rarity.COMMON]: 0,
      [Rarity.UNCOMMON]: 0,
      [Rarity.RARE]: 0,
      [Rarity.EPIC]: 0,
      [Rarity.LEGENDARY]: 0,
    };

    const N = 10000;
    for (let i = 0; i < N; i++) {
      counts[rollRarity()]++;
    }

    // COMMON ~70%, UNCOMMON ~20%, RARE ~7%, EPIC ~2.5%, LEGENDARY ~0.5%
    expect(counts[Rarity.COMMON] / N).toBeGreaterThan(0.55);
    expect(counts[Rarity.COMMON] / N).toBeLessThan(0.85);

    expect(counts[Rarity.UNCOMMON] / N).toBeGreaterThan(0.10);
    expect(counts[Rarity.UNCOMMON] / N).toBeLessThan(0.30);

    expect(counts[Rarity.RARE] / N).toBeGreaterThan(0.02);
    expect(counts[Rarity.RARE] / N).toBeLessThan(0.15);

    expect(counts[Rarity.EPIC] / N).toBeGreaterThan(0.005);
    expect(counts[Rarity.EPIC] / N).toBeLessThan(0.06);

    expect(counts[Rarity.LEGENDARY]).toBeGreaterThan(0);
    expect(counts[Rarity.LEGENDARY] / N).toBeLessThan(0.03);
  });

  it('should show measurable rarity shift with bonus', () => {
    let legendaryNoBonus = 0;
    let legendaryHighBonus = 0;

    const N = 5000;
    for (let i = 0; i < N; i++) {
      if (rollRarity(0) === Rarity.LEGENDARY) legendaryNoBonus++;
      if (rollRarity(0.5) === Rarity.LEGENDARY) legendaryHighBonus++;
    }

    expect(legendaryHighBonus).toBeGreaterThan(legendaryNoBonus);
  });

  it('should produce more non-COMMON results with bonus', () => {
    let nonCommonNoBonus = 0;
    let nonCommonWithBonus = 0;

    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (rollRarity(0) !== Rarity.COMMON) nonCommonNoBonus++;
      if (rollRarity(0.5) !== Rarity.COMMON) nonCommonWithBonus++;
    }

    expect(nonCommonWithBonus).toBeGreaterThan(nonCommonNoBonus);
  });
});

// ============================================================================
// Item entity class (server/ts/item.ts)
// ============================================================================

describe('Item (entity class)', () => {
  it('should construct with basic properties', () => {
    const item = new Item(1, SWORD2, 10, 20);
    expect(item.id).toBe(1);
    expect(item.kind).toBe(SWORD2);
    expect(item.x).toBe(10);
    expect(item.y).toBe(20);
    expect(item.type).toBe('item');
    expect(item.properties).toBeNull();
    expect(item.displayName).toBeNull();
  });

  it('should accept string id and parse to number', () => {
    const item = new Item('42', SWORD2, 0, 0);
    expect(item.id).toBe(42);
  });

  it('should store generated item properties when provided', () => {
    const generated = generateSimpleItem(SWORD2);
    const item = new Item(1, SWORD2, 5, 5, generated);
    expect(item.properties).toEqual(generated.properties);
    expect(item.displayName).toBe(generated.displayName);
  });

  it('should have correct defaults', () => {
    const item = new Item(1, FLASK, 0, 0);
    expect(item.isStatic).toBe(false);
    expect(item.isFromChest).toBe(false);
    expect(item.blinkTimeout).toBeNull();
    expect(item.despawnTimeout).toBeNull();
    expect(item.respawn_callback).toBeNull();
  });

  it('should allow setting isStatic and isFromChest', () => {
    const item = new Item(1, FLASK, 0, 0);
    item.isStatic = true;
    item.isFromChest = true;
    expect(item.isStatic).toBe(true);
    expect(item.isFromChest).toBe(true);
  });

  describe('getState', () => {
    it('should return base state with null properties when no generated item', () => {
      const item = new Item(1, SWORD2, 10, 20);
      const state = item.getState();
      expect(state).toEqual([1, SWORD2, 10, 20, null]);
    });

    it('should return serialized properties in state', () => {
      const generated = generateSimpleItem(SWORD2);
      const item = new Item(1, SWORD2, 10, 20, generated);
      const state = item.getState();
      expect(state[0]).toBe(1);
      expect(state[1]).toBe(SWORD2);
      expect(state[2]).toBe(10);
      expect(state[3]).toBe(20);
      const serialized = state[4] as Record<string, unknown>;
      expect(serialized).not.toBeNull();
      expect(serialized.r).toBe(Rarity.COMMON);
      expect(serialized.c).toBe('weapon');
      expect(serialized.dMin).toBe(WeaponStats[SWORD2].damageMin);
      expect(serialized.dMax).toBe(WeaponStats[SWORD2].damageMax);
    });

    it('should include defense in serialized armor properties', () => {
      const generated = generateSimpleItem(PLATEARMOR);
      const item = new Item(1, PLATEARMOR, 0, 0, generated);
      const state = item.getState();
      const serialized = state[4] as Record<string, unknown>;
      expect(serialized.def).toBe(ArmorStats[PLATEARMOR].defense);
    });

    it('should include heal amount in serialized consumable properties', () => {
      const generated = generateSimpleItem(FLASK);
      const item = new Item(1, FLASK, 0, 0, generated);
      const state = item.getState();
      const serialized = state[4] as Record<string, unknown>;
      expect(serialized.heal).toBe(ConsumableStats[FLASK].healAmount);
    });
  });

  describe('handleDespawn', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call blinkCallback after beforeBlinkDelay', () => {
      const item = new Item(1, FLASK, 0, 0);
      const blinkCallback = vi.fn();
      const despawnCallback = vi.fn();

      item.handleDespawn({
        blinkCallback,
        despawnCallback,
        blinkingDuration: 2000,
        beforeBlinkDelay: 5000,
      });

      expect(blinkCallback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      expect(blinkCallback).toHaveBeenCalledOnce();
    });

    it('should call despawnCallback after blink + blinkingDuration', () => {
      const item = new Item(1, FLASK, 0, 0);
      const blinkCallback = vi.fn();
      const despawnCallback = vi.fn();

      item.handleDespawn({
        blinkCallback,
        despawnCallback,
        blinkingDuration: 2000,
        beforeBlinkDelay: 5000,
      });

      vi.advanceTimersByTime(5000);
      expect(despawnCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(despawnCallback).toHaveBeenCalledOnce();
    });

    it('should not fire blink before the delay', () => {
      const item = new Item(1, FLASK, 0, 0);
      const blinkCallback = vi.fn();
      const despawnCallback = vi.fn();

      item.handleDespawn({
        blinkCallback,
        despawnCallback,
        blinkingDuration: 2000,
        beforeBlinkDelay: 5000,
      });

      vi.advanceTimersByTime(4999);
      expect(blinkCallback).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clear blink and despawn timeouts', () => {
      const item = new Item(1, FLASK, 0, 0);
      const blinkCallback = vi.fn();
      const despawnCallback = vi.fn();

      item.handleDespawn({
        blinkCallback,
        despawnCallback,
        blinkingDuration: 2000,
        beforeBlinkDelay: 5000,
      });

      item.destroy();

      vi.advanceTimersByTime(10000);
      expect(blinkCallback).not.toHaveBeenCalled();
      expect(despawnCallback).not.toHaveBeenCalled();
    });

    it('should schedule respawn for static items', () => {
      const item = new Item(1, FLASK, 0, 0);
      item.isStatic = true;
      const respawnCb = vi.fn();
      item.onRespawn(respawnCb);

      item.destroy();

      expect(respawnCb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(30000);
      expect(respawnCb).toHaveBeenCalledOnce();
    });

    it('should not schedule respawn for non-static items', () => {
      const item = new Item(1, FLASK, 0, 0);
      item.isStatic = false;
      const respawnCb = vi.fn();
      item.onRespawn(respawnCb);

      item.destroy();

      vi.advanceTimersByTime(60000);
      expect(respawnCb).not.toHaveBeenCalled();
    });

    it('should safely destroy when no timeouts were set', () => {
      const item = new Item(1, FLASK, 0, 0);
      expect(() => item.destroy()).not.toThrow();
    });
  });

  describe('onRespawn', () => {
    it('should register a respawn callback', () => {
      const item = new Item(1, FLASK, 0, 0);
      const cb = vi.fn();
      item.onRespawn(cb);
      expect(item.respawn_callback).toBe(cb);
    });

    it('should overwrite a previous callback', () => {
      const item = new Item(1, FLASK, 0, 0);
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      item.onRespawn(cb1);
      item.onRespawn(cb2);
      expect(item.respawn_callback).toBe(cb2);
    });
  });

  describe('scheduleRespawn', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call respawn callback after specified delay', () => {
      const item = new Item(1, FLASK, 0, 0);
      const cb = vi.fn();
      item.onRespawn(cb);

      item.scheduleRespawn(10000);

      expect(cb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(10000);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('should not throw if no respawn callback is set', () => {
      const item = new Item(1, FLASK, 0, 0);
      item.scheduleRespawn(1000);
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });

    it('should respect the delay parameter', () => {
      const item = new Item(1, FLASK, 0, 0);
      const cb = vi.fn();
      item.onRespawn(cb);

      item.scheduleRespawn(5000);

      vi.advanceTimersByTime(4999);
      expect(cb).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  describe('setPosition', () => {
    it('should update x and y coordinates', () => {
      const item = new Item(1, FLASK, 0, 0);
      item.setPosition(15, 25);
      expect(item.x).toBe(15);
      expect(item.y).toBe(25);
    });
  });
});

// ============================================================================
// Item type distribution across generation
// ============================================================================

describe('item type distributions', () => {
  it('should generate weapons across all registered weapon tiers', () => {
    for (const kind of registeredWeaponKinds()) {
      const item = generateItem(kind);
      expect(item.kind).toBe(kind);
      expect(item.properties.category).toBe('weapon');
    }
  });

  it('should preserve kindName from gametypes', () => {
    const item = generateItem(SWORD2);
    expect(item.kindName).toBe('sword2');
  });

  it('should generate items with level corresponding to weapon rank progression', () => {
    const sword1 = generateItem(SWORD1);
    const golden = generateItem(GOLDENSWORD);

    expect(golden.properties.level).toBeGreaterThan(sword1.properties.level);
  });

  it('should generate items with level corresponding to armor rank progression', () => {
    const cloth = generateItem(CLOTHARMOR);
    const goldenArmor = generateItem(GOLDENARMOR);

    expect(goldenArmor.properties.level).toBeGreaterThan(cloth.properties.level);
  });

  it('should produce all rarity types when generating many items', () => {
    const seenRarities = new Set<Rarity>();
    // Generate enough items to see all rarities
    for (let i = 0; i < 5000 && seenRarities.size < 5; i++) {
      const item = generateItem(SWORD2);
      seenRarities.add(item.properties.rarity);
    }
    expect(seenRarities.size).toBe(5);
  });
});
