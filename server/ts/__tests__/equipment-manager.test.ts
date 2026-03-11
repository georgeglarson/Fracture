/**
 * Tests for EquipmentManager
 * Covers: default equipment, equip/drop, getters, levels, ranks,
 * set bonus detection, callbacks, edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentManager } from '../equipment/equipment-manager';
import { Types } from '../../../shared/ts/gametypes';
import { Rarity, ItemProperties } from '../../../shared/ts/items/item-types';
import { EquipmentSlot, SLOT_CONFIG } from '../../../shared/ts/equipment/equipment-types';
import {
  initSetMappings,
  calculateSetBonuses,
  EQUIPMENT_SETS,
  SetId,
  getItemSet
} from '../../../shared/ts/equipment/set-data';

// Ensure set mappings are initialized before tests run
initSetMappings();

function makeWeaponProps(overrides?: Partial<ItemProperties>): ItemProperties {
  return {
    rarity: Rarity.COMMON,
    level: 1,
    category: 'weapon',
    damageMin: 5,
    damageMax: 10,
    ...overrides
  };
}

function makeArmorProps(overrides?: Partial<ItemProperties>): ItemProperties {
  return {
    rarity: Rarity.COMMON,
    level: 1,
    category: 'armor',
    defense: 3,
    ...overrides
  };
}

describe('EquipmentManager', () => {
  let mgr: EquipmentManager;

  beforeEach(() => {
    mgr = new EquipmentManager();
  });

  // ==========================================================================
  // Default equipment
  // ==========================================================================

  describe('default equipment', () => {
    it('should start with SWORD1 in the weapon slot', () => {
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.SWORD1);
    });

    it('should start with CLOTHARMOR in the armor slot', () => {
      expect(mgr.getEquipped('armor')).toBe(Types.Entities.CLOTHARMOR);
    });

    it('should have null properties for default items', () => {
      expect(mgr.getProperties('weapon')).toBeNull();
      expect(mgr.getProperties('armor')).toBeNull();
    });

    it('should report default items via hasDefault()', () => {
      expect(mgr.hasDefault('weapon')).toBe(true);
      expect(mgr.hasDefault('armor')).toBe(true);
    });

    it('should have level 1 for default weapon and armor', () => {
      expect(mgr.getLevel('weapon')).toBe(1);
      expect(mgr.getLevel('armor')).toBe(1);
    });

    it('should have rank 0 for default weapon and armor', () => {
      expect(mgr.getRank('weapon')).toBe(0);
      expect(mgr.getRank('armor')).toBe(0);
    });
  });

  // ==========================================================================
  // Legacy getters
  // ==========================================================================

  describe('legacy getters', () => {
    it('weapon getter should return SWORD1 by default', () => {
      expect(mgr.weapon).toBe(Types.Entities.SWORD1);
    });

    it('armor getter should return CLOTHARMOR by default', () => {
      expect(mgr.armor).toBe(Types.Entities.CLOTHARMOR);
    });

    it('weaponLevel getter should return 1 by default', () => {
      expect(mgr.weaponLevel).toBe(1);
    });

    it('armorLevel getter should return 1 by default', () => {
      expect(mgr.armorLevel).toBe(1);
    });

    it('weaponLevel should increase after equipping a better weapon', () => {
      mgr.equip(Types.Entities.AXE);
      // AXE is index 2 in SLOT_CONFIG weapon rankedItems => level 3
      expect(mgr.weaponLevel).toBe(3);
    });

    it('armorLevel should increase after equipping better armor', () => {
      mgr.equip(Types.Entities.PLATEARMOR);
      // PLATEARMOR is index 3 in SLOT_CONFIG armor rankedItems => level 4
      expect(mgr.armorLevel).toBe(4);
    });
  });

  // ==========================================================================
  // equip()
  // ==========================================================================

  describe('equip()', () => {
    it('should equip a weapon and return the weapon slot', () => {
      const slot = mgr.equip(Types.Entities.SWORD2);
      expect(slot).toBe('weapon');
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.SWORD2);
    });

    it('should equip an armor and return the armor slot', () => {
      const slot = mgr.equip(Types.Entities.LEATHERARMOR);
      expect(slot).toBe('armor');
      expect(mgr.getEquipped('armor')).toBe(Types.Entities.LEATHERARMOR);
    });

    it('should store properties when provided', () => {
      const props = makeWeaponProps({ rarity: Rarity.RARE, damageMin: 15, damageMax: 30 });
      mgr.equip(Types.Entities.SWORD2, props);
      expect(mgr.getProperties('weapon')).toBe(props);
    });

    it('should set properties to null when none are provided', () => {
      mgr.equip(Types.Entities.AXE);
      expect(mgr.getProperties('weapon')).toBeNull();
    });

    it('should return null for an invalid item kind', () => {
      const slot = mgr.equip(99999);
      expect(slot).toBeNull();
    });

    it('should not change equipment when given an invalid item kind', () => {
      mgr.equip(99999);
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.SWORD1);
      expect(mgr.getEquipped('armor')).toBe(Types.Entities.CLOTHARMOR);
    });

    it('should replace the current weapon when equipping a new one', () => {
      mgr.equip(Types.Entities.SWORD2);
      mgr.equip(Types.Entities.AXE);
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.AXE);
    });

    it('should replace the current armor when equipping a new one', () => {
      mgr.equip(Types.Entities.LEATHERARMOR);
      mgr.equip(Types.Entities.MAILARMOR);
      expect(mgr.getEquipped('armor')).toBe(Types.Entities.MAILARMOR);
    });

    it('should update the level when equipping a new item', () => {
      mgr.equip(Types.Entities.GOLDENSWORD);
      // GOLDENSWORD is index 6 in SLOT_CONFIG weapon rankedItems => level 7
      expect(mgr.getLevel('weapon')).toBe(7);
    });

    it('should mark slot as non-default after equipping a non-default item', () => {
      mgr.equip(Types.Entities.SWORD2);
      expect(mgr.hasDefault('weapon')).toBe(false);
    });
  });

  // ==========================================================================
  // equipToSlot()
  // ==========================================================================

  describe('equipToSlot()', () => {
    it('should force-equip an item to a specific slot', () => {
      mgr.equipToSlot('weapon', Types.Entities.BLUESWORD);
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.BLUESWORD);
    });

    it('should store properties when provided', () => {
      const props = makeArmorProps({ rarity: Rarity.EPIC, defense: 10 });
      mgr.equipToSlot('armor', Types.Entities.REDARMOR, props);
      expect(mgr.getProperties('armor')).toBe(props);
    });

    it('should allow equipping items not in SLOT_CONFIG rankedItems', () => {
      // Use a raw numeric ID (777) that is not in any SLOT_CONFIG rankedItems.
      // equip() would return null for this, but equipToSlot() bypasses that check.
      const customItemKind = 777;
      mgr.equipToSlot('weapon', customItemKind);
      expect(mgr.getEquipped('weapon')).toBe(customItemKind);
    });

    it('should update level to 1 for unranked items forced into a slot', () => {
      const customItemKind = 777;
      mgr.equipToSlot('weapon', customItemKind);
      // getLevel returns rank+1, and rank for an unranked item is -1, so level = 1
      expect(mgr.getLevel('weapon')).toBe(1);
    });
  });

  // ==========================================================================
  // drop()
  // ==========================================================================

  describe('drop()', () => {
    it('should return the dropped item kind and properties', () => {
      const props = makeWeaponProps();
      mgr.equip(Types.Entities.SWORD2, props);

      const dropped = mgr.drop('weapon');
      expect(dropped).not.toBeNull();
      expect(dropped!.kind).toBe(Types.Entities.SWORD2);
      expect(dropped!.properties).toBe(props);
    });

    it('should revert the slot to the default item after dropping', () => {
      mgr.equip(Types.Entities.SWORD2);
      mgr.drop('weapon');
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.SWORD1);
      expect(mgr.hasDefault('weapon')).toBe(true);
    });

    it('should revert armor slot to CLOTHARMOR after dropping', () => {
      mgr.equip(Types.Entities.PLATEARMOR);
      mgr.drop('armor');
      expect(mgr.getEquipped('armor')).toBe(Types.Entities.CLOTHARMOR);
    });

    it('should clear properties after dropping', () => {
      mgr.equip(Types.Entities.SWORD2, makeWeaponProps());
      mgr.drop('weapon');
      expect(mgr.getProperties('weapon')).toBeNull();
    });

    it('should reset level to 1 after dropping back to default', () => {
      mgr.equip(Types.Entities.AXE);
      expect(mgr.getLevel('weapon')).toBe(3);
      mgr.drop('weapon');
      expect(mgr.getLevel('weapon')).toBe(1);
    });

    it('should return null when trying to drop a default item', () => {
      const dropped = mgr.drop('weapon');
      expect(dropped).toBeNull();
    });

    it('should return null when trying to drop default armor', () => {
      const dropped = mgr.drop('armor');
      expect(dropped).toBeNull();
    });

    it('should return null properties when the dropped item had no properties', () => {
      mgr.equip(Types.Entities.SWORD2);
      const dropped = mgr.drop('weapon');
      expect(dropped).not.toBeNull();
      expect(dropped!.properties).toBeNull();
    });
  });

  // ==========================================================================
  // getLevel() and getRank()
  // ==========================================================================

  describe('getLevel() and getRank()', () => {
    it('should return increasing levels for ranked weapons', () => {
      const weapons = SLOT_CONFIG.weapon.rankedItems;
      for (let i = 0; i < weapons.length; i++) {
        mgr.equip(weapons[i]);
        expect(mgr.getLevel('weapon')).toBe(i + 1);
        expect(mgr.getRank('weapon')).toBe(i);
      }
    });

    it('should return increasing levels for ranked armors', () => {
      const armors = SLOT_CONFIG.armor.rankedItems;
      for (let i = 0; i < armors.length; i++) {
        mgr.equip(armors[i]);
        expect(mgr.getLevel('armor')).toBe(i + 1);
        expect(mgr.getRank('armor')).toBe(i);
      }
    });

    it('should return level 1 for an uninitialized/unknown slot', () => {
      // accessory slot has defaultItem 0, so it may not be set
      expect(mgr.getLevel('accessory')).toBe(1);
    });
  });

  // ==========================================================================
  // isUpgrade()
  // ==========================================================================

  describe('isUpgrade()', () => {
    it('should return true when the item has a higher rank than current', () => {
      // Default weapon is SWORD1 (rank 0)
      expect(mgr.isUpgrade(Types.Entities.SWORD2)).toBe(true);
      expect(mgr.isUpgrade(Types.Entities.GOLDENSWORD)).toBe(true);
    });

    it('should return false when the item has a lower rank than current', () => {
      mgr.equip(Types.Entities.GOLDENSWORD);
      expect(mgr.isUpgrade(Types.Entities.SWORD1)).toBe(false);
      expect(mgr.isUpgrade(Types.Entities.SWORD2)).toBe(false);
    });

    it('should return false when equipping the same item', () => {
      expect(mgr.isUpgrade(Types.Entities.SWORD1)).toBe(false);
    });

    it('should return false for an invalid/unknown item kind', () => {
      expect(mgr.isUpgrade(99999)).toBe(false);
    });

    it('should compare armor items against current armor', () => {
      // Default armor is CLOTHARMOR (rank 0)
      expect(mgr.isUpgrade(Types.Entities.LEATHERARMOR)).toBe(true);
      mgr.equip(Types.Entities.GOLDENARMOR);
      expect(mgr.isUpgrade(Types.Entities.CLOTHARMOR)).toBe(false);
    });
  });

  // ==========================================================================
  // getState()
  // ==========================================================================

  describe('getState()', () => {
    it('should return default weapon and armor state', () => {
      const state = mgr.getState();
      expect(state).toEqual({
        weapon: Types.Entities.SWORD1,
        armor: Types.Entities.CLOTHARMOR
      });
    });

    it('should reflect currently equipped items', () => {
      mgr.equip(Types.Entities.AXE);
      mgr.equip(Types.Entities.PLATEARMOR);

      const state = mgr.getState();
      expect(state).toEqual({
        weapon: Types.Entities.AXE,
        armor: Types.Entities.PLATEARMOR
      });
    });
  });

  // ==========================================================================
  // Callbacks
  // ==========================================================================

  describe('callbacks', () => {
    it('should call onHPUpdate when equipping armor (affectsHP = true)', () => {
      const onHPUpdate = vi.fn();
      mgr.setCallbacks({ onHPUpdate });

      mgr.equip(Types.Entities.LEATHERARMOR);
      expect(onHPUpdate).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onHPUpdate when equipping a weapon (affectsHP = false)', () => {
      const onHPUpdate = vi.fn();
      mgr.setCallbacks({ onHPUpdate });

      mgr.equip(Types.Entities.SWORD2);
      expect(onHPUpdate).not.toHaveBeenCalled();
    });

    it('should call onHPUpdate when dropping armor', () => {
      mgr.equip(Types.Entities.LEATHERARMOR);

      const onHPUpdate = vi.fn();
      mgr.setCallbacks({ onHPUpdate });

      mgr.drop('armor');
      expect(onHPUpdate).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onHPUpdate when dropping a weapon', () => {
      mgr.equip(Types.Entities.SWORD2);

      const onHPUpdate = vi.fn();
      mgr.setCallbacks({ onHPUpdate });

      mgr.drop('weapon');
      expect(onHPUpdate).not.toHaveBeenCalled();
    });

    it('should call onHPUpdate when using equipToSlot on armor', () => {
      const onHPUpdate = vi.fn();
      mgr.setCallbacks({ onHPUpdate });

      mgr.equipToSlot('armor', Types.Entities.MAILARMOR);
      expect(onHPUpdate).toHaveBeenCalledTimes(1);
    });

    it('should not crash when callback is not set', () => {
      // No callbacks set - should not throw
      expect(() => mgr.equip(Types.Entities.LEATHERARMOR)).not.toThrow();
      expect(() => mgr.drop('armor')).not.toThrow();
    });
  });

  // ==========================================================================
  // Set bonus detection
  // ==========================================================================

  describe('set bonus detection', () => {
    // Resolve the actual set piece item IDs at runtime.
    // These may be undefined if the entity constants are not present in the
    // runtime build, so we derive them from the set definitions directly.
    const berserkerPieces = EQUIPMENT_SETS[SetId.BERSERKER].pieces;
    const guardianPieces = EQUIPMENT_SETS[SetId.GUARDIAN].pieces;
    const shadowPieces = EQUIPMENT_SETS[SetId.SHADOW].pieces;
    const dragonPieces = EQUIPMENT_SETS[SetId.DRAGON].pieces;

    // Check whether set item IDs are valid (non-undefined) at runtime.
    // If the entity constants are not available in the test build, the pieces
    // array will contain undefined values and set tests must be skipped.
    const setItemsAvailable = berserkerPieces.every(p => p !== undefined);

    it('should have no active set bonus by default', () => {
      expect(mgr.hasActiveSetBonus()).toBe(false);
      expect(mgr.getSetBonus()).toEqual({});
    });

    it('should expose getActiveSets() as a Map', () => {
      const activeSets = mgr.getActiveSets();
      expect(activeSets).toBeInstanceOf(Map);
    });

    it('should expose getSetBonus() as an object', () => {
      const bonus = mgr.getSetBonus();
      expect(typeof bonus).toBe('object');
    });

    it('should update set bonuses when equipping via equipToSlot()', () => {
      // Even with standard items, updateSetBonuses is called.
      // Standard items are not part of any set, so bonus should remain empty.
      mgr.equipToSlot('weapon', Types.Entities.GOLDENSWORD);
      mgr.equipToSlot('armor', Types.Entities.GOLDENARMOR);
      expect(mgr.hasActiveSetBonus()).toBe(false);
    });

    it('should update set bonuses when equipping via equip()', () => {
      mgr.equip(Types.Entities.SWORD2);
      expect(mgr.hasActiveSetBonus()).toBe(false);
    });

    it.skipIf(!setItemsAvailable)(
      'should detect Berserker set when both pieces are equipped',
      () => {
        mgr.equipToSlot('weapon', berserkerPieces[0]);
        mgr.equipToSlot('armor', berserkerPieces[1]);

        expect(mgr.hasActiveSetBonus()).toBe(true);
        const bonus = mgr.getSetBonus();
        expect(bonus.damageMult).toBe(1.25);
        expect(bonus.hpMult).toBe(0.85);
      }
    );

    it.skipIf(!setItemsAvailable)(
      'should detect Guardian set when both pieces are equipped',
      () => {
        mgr.equipToSlot('weapon', guardianPieces[0]);
        mgr.equipToSlot('armor', guardianPieces[1]);

        expect(mgr.hasActiveSetBonus()).toBe(true);
        const bonus = mgr.getSetBonus();
        expect(bonus.defenseMult).toBe(1.30);
        expect(bonus.hpMult).toBe(1.15);
        expect(bonus.damageMult).toBe(0.90);
      }
    );

    it.skipIf(!setItemsAvailable)(
      'should detect Shadow set when both pieces are equipped',
      () => {
        mgr.equipToSlot('weapon', shadowPieces[0]);
        mgr.equipToSlot('armor', shadowPieces[1]);

        expect(mgr.hasActiveSetBonus()).toBe(true);
        const bonus = mgr.getSetBonus();
        expect(bonus.critBonus).toBe(20);
        expect(bonus.moveSpeedMult).toBe(1.15);
        expect(bonus.damageMult).toBe(1.10);
      }
    );

    it.skipIf(!setItemsAvailable)(
      'should detect Dragon set when both pieces are equipped',
      () => {
        mgr.equipToSlot('weapon', dragonPieces[0]);
        mgr.equipToSlot('armor', dragonPieces[1]);

        expect(mgr.hasActiveSetBonus()).toBe(true);
        const bonus = mgr.getSetBonus();
        expect(bonus.damageMult).toBe(1.15);
        expect(bonus.defenseMult).toBe(1.10);
        expect(bonus.burnChance).toBe(0.20);
        expect(bonus.burnDamage).toBe(5);
      }
    );

    it.skipIf(!setItemsAvailable)(
      'should NOT activate set bonus with only one piece',
      () => {
        mgr.equipToSlot('weapon', berserkerPieces[0]);
        // Armor is still CLOTHARMOR (default)
        expect(mgr.hasActiveSetBonus()).toBe(false);
        expect(mgr.getSetBonus()).toEqual({});
      }
    );

    it.skipIf(!setItemsAvailable)(
      'should deactivate set bonus when a piece is replaced',
      () => {
        mgr.equipToSlot('weapon', berserkerPieces[0]);
        mgr.equipToSlot('armor', berserkerPieces[1]);
        expect(mgr.hasActiveSetBonus()).toBe(true);

        // Replace weapon with a standard non-set weapon
        mgr.equipToSlot('weapon', Types.Entities.SWORD2);
        expect(mgr.hasActiveSetBonus()).toBe(false);
        expect(mgr.getSetBonus()).toEqual({});
      }
    );

    it('should recalculate set bonuses on drop()', () => {
      // Equip a non-default item, then drop it. Set bonus should remain empty.
      mgr.equip(Types.Entities.GOLDENSWORD);
      mgr.drop('weapon');
      expect(mgr.hasActiveSetBonus()).toBe(false);
    });

    describe('calculateSetBonuses (unit)', () => {
      it('should return empty bonus when no set items are equipped', () => {
        const result = calculateSetBonuses([
          Types.Entities.SWORD1,
          Types.Entities.CLOTHARMOR
        ]);
        expect(result.combinedBonus).toEqual({});
        expect(result.activeSets.size).toBe(0);
      });

      it.skipIf(!setItemsAvailable)(
        'should count pieces per set correctly',
        () => {
          const result = calculateSetBonuses([berserkerPieces[0]]);
          expect(result.activeSets.get(SetId.BERSERKER)).toBe(1);
          expect(result.combinedBonus).toEqual({});
        }
      );

      it.skipIf(!setItemsAvailable)(
        'should activate bonus when required pieces are met',
        () => {
          const result = calculateSetBonuses(berserkerPieces);
          expect(result.activeSets.get(SetId.BERSERKER)).toBe(2);
          expect(result.combinedBonus.damageMult).toBe(1.25);
        }
      );
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should allow re-equipping the same item', () => {
      mgr.equip(Types.Entities.SWORD2);
      const slot = mgr.equip(Types.Entities.SWORD2);
      expect(slot).toBe('weapon');
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.SWORD2);
    });

    it('should overwrite properties when re-equipping with new properties', () => {
      const propsOld = makeWeaponProps({ damageMin: 5, damageMax: 10 });
      const propsNew = makeWeaponProps({ damageMin: 20, damageMax: 40 });

      mgr.equip(Types.Entities.SWORD2, propsOld);
      mgr.equip(Types.Entities.SWORD2, propsNew);
      expect(mgr.getProperties('weapon')).toBe(propsNew);
    });

    it('should clear properties when re-equipping without properties', () => {
      mgr.equip(Types.Entities.SWORD2, makeWeaponProps());
      mgr.equip(Types.Entities.SWORD2);
      expect(mgr.getProperties('weapon')).toBeNull();
    });

    it('should handle equipping default items explicitly', () => {
      mgr.equip(Types.Entities.AXE);
      mgr.equip(Types.Entities.SWORD1);
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.SWORD1);
      expect(mgr.hasDefault('weapon')).toBe(true);
    });

    it('should not allow dropping default item even if explicitly re-equipped', () => {
      mgr.equip(Types.Entities.SWORD1);
      const dropped = mgr.drop('weapon');
      expect(dropped).toBeNull();
    });

    it('should handle rapid weapon swaps correctly', () => {
      const weapons = SLOT_CONFIG.weapon.rankedItems;
      for (const kind of weapons) {
        mgr.equip(kind);
      }
      // Should end up with the last weapon in the list
      expect(mgr.getEquipped('weapon')).toBe(weapons[weapons.length - 1]);
    });

    it('should maintain independent weapon and armor state', () => {
      mgr.equip(Types.Entities.GOLDENSWORD);
      mgr.equip(Types.Entities.GOLDENARMOR);

      // Dropping armor should not affect weapon
      mgr.drop('armor');
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.GOLDENSWORD);
      expect(mgr.getEquipped('armor')).toBe(Types.Entities.CLOTHARMOR);
    });

    it('should handle equipping with explicit null properties', () => {
      const slot = mgr.equip(Types.Entities.SWORD2, null);
      expect(slot).toBe('weapon');
      expect(mgr.getProperties('weapon')).toBeNull();
    });

    it('should return default item for accessory slot with no default', () => {
      // accessory has defaultItem = 0
      expect(mgr.getEquipped('accessory')).toBe(0);
    });

    it('should handle multiple equip-drop cycles', () => {
      for (let i = 0; i < 5; i++) {
        mgr.equip(Types.Entities.SWORD2, makeWeaponProps());
        expect(mgr.getEquipped('weapon')).toBe(Types.Entities.SWORD2);
        expect(mgr.getProperties('weapon')).not.toBeNull();

        mgr.drop('weapon');
        expect(mgr.getEquipped('weapon')).toBe(Types.Entities.SWORD1);
        expect(mgr.getProperties('weapon')).toBeNull();
      }
    });

    it('should drop items equipped via equipToSlot that are not the default', () => {
      const customItemKind = 777;
      mgr.equipToSlot('weapon', customItemKind);
      // 777 !== SWORD1 (60), so it is not the default and can be dropped
      const dropped = mgr.drop('weapon');
      expect(dropped).not.toBeNull();
      expect(dropped!.kind).toBe(customItemKind);
      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.SWORD1);
    });
  });

  // ==========================================================================
  // Multiple independent EquipmentManager instances
  // ==========================================================================

  describe('instance isolation', () => {
    it('should not share state between instances', () => {
      const mgr2 = new EquipmentManager();

      mgr.equip(Types.Entities.GOLDENSWORD);
      mgr2.equip(Types.Entities.AXE);

      expect(mgr.getEquipped('weapon')).toBe(Types.Entities.GOLDENSWORD);
      expect(mgr2.getEquipped('weapon')).toBe(Types.Entities.AXE);
    });

    it('should not share callbacks between instances', () => {
      const mgr2 = new EquipmentManager();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      mgr.setCallbacks({ onHPUpdate: cb1 });
      mgr2.setCallbacks({ onHPUpdate: cb2 });

      mgr.equip(Types.Entities.LEATHERARMOR);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).not.toHaveBeenCalled();

      mgr2.equip(Types.Entities.MAILARMOR);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });
});
