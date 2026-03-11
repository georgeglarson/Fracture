/**
 * Tests for EquipmentHandler
 * Covers: equipArmor, equipWeapon, equipItem, updateHitPoints,
 *         handleDropItem, createEquipMessage, getWeapon/getArmor,
 *         getWeaponLevel/getArmorLevel, edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';
import { Formulas } from '../formulas';
import { EquipmentManager } from '../equipment/equipment-manager';
import {
  equipArmor,
  equipWeapon,
  equipItem,
  updateHitPoints,
  handleDropItem,
  createEquipMessage,
  getWeapon,
  getArmor,
  getWeaponLevel,
  getArmorLevel,
  EquipmentPlayerContext,
} from '../player/equipment.handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEquipmentManager(): EquipmentManager {
  return new EquipmentManager();
}

function createMockCtx(overrides?: Partial<EquipmentPlayerContext>): EquipmentPlayerContext {
  const equipment = createMockEquipmentManager();
  const mockItem: any = null;

  return {
    id: 1,
    name: 'TestPlayer',
    x: 50,
    y: 100,
    level: 5,
    maxHitPoints: 200,

    send: vi.fn(),
    broadcast: vi.fn(),
    resetHitPoints: vi.fn((hp: number) => {
      // Simulate what a real player does: store the new maxHitPoints
      ctx.maxHitPoints = hp;
    }),

    getEquipment: () => equipment,

    getWorld: () => ({
      createItemWithProperties: vi.fn(
        (kind: number, x: number, y: number, properties?: any) => ({
          id: 999,
          kind,
          x,
          y,
          properties: properties || null,
          getState: () => [kind, 999, x, y],
        }),
      ),
      addItem: vi.fn(),
    }),

    ...overrides,
  };

  // Need to capture the reference for resetHitPoints closure
  var ctx: EquipmentPlayerContext = undefined as any;
  ctx = {
    id: 1,
    name: 'TestPlayer',
    x: 50,
    y: 100,
    level: 5,
    maxHitPoints: 200,

    send: vi.fn(),
    broadcast: vi.fn(),
    resetHitPoints: vi.fn((hp: number) => {
      ctx.maxHitPoints = hp;
    }),

    getEquipment: () => equipment,

    getWorld: () => ({
      createItemWithProperties: vi.fn(
        (kind: number, x: number, y: number, properties?: any) => ({
          id: 999,
          kind,
          x,
          y,
          properties: properties || null,
          getState: () => [kind, 999, x, y],
        }),
      ),
      addItem: vi.fn(),
    }),

    ...overrides,
  };
  return ctx;
}

// Helper that creates the context and returns it together with a stable
// reference so the resetHitPoints closure can mutate the same object.
function makeMockCtx(overrides?: Partial<EquipmentPlayerContext>): EquipmentPlayerContext {
  const equipment = overrides?.getEquipment
    ? overrides.getEquipment()
    : createMockEquipmentManager();

  const world = {
    createItemWithProperties: vi.fn(
      (kind: number, x: number, y: number, properties?: any) => ({
        id: 999,
        kind,
        x,
        y,
        properties: properties || null,
        getState: () => [kind, 999, x, y],
      }),
    ),
    addItem: vi.fn(),
  };

  const ctx: EquipmentPlayerContext = {
    id: 1,
    name: 'TestPlayer',
    x: 50,
    y: 100,
    level: 5,
    maxHitPoints: 200,

    send: vi.fn(),
    broadcast: vi.fn(),
    resetHitPoints: vi.fn((hp: number) => {
      ctx.maxHitPoints = hp;
    }),

    getEquipment: () => equipment,
    getWorld: () => world,

    ...overrides,
  };
  return ctx;
}

// ==========================================================================
// Tests
// ==========================================================================

describe('EquipmentHandler', () => {
  let ctx: EquipmentPlayerContext;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  // ========================================================================
  // equipArmor
  // ========================================================================

  describe('equipArmor', () => {
    it('should equip armor to the armor slot', () => {
      equipArmor(ctx, Types.Entities.LEATHERARMOR);
      expect(ctx.getEquipment().armor).toBe(Types.Entities.LEATHERARMOR);
    });

    it('should replace existing armor', () => {
      equipArmor(ctx, Types.Entities.LEATHERARMOR);
      equipArmor(ctx, Types.Entities.PLATEARMOR);
      expect(ctx.getEquipment().armor).toBe(Types.Entities.PLATEARMOR);
    });

    it('should pass properties to equipment manager', () => {
      const props = { rarity: 1, level: 3, category: 'armor' as const, defense: 5 };
      equipArmor(ctx, Types.Entities.MAILARMOR, props);
      expect(ctx.getEquipment().getProperties('armor')).toEqual(props);
    });

    it('should update armor level after equipping', () => {
      equipArmor(ctx, Types.Entities.PLATEARMOR);
      // PLATEARMOR is index 3 in rankedItems => level 4
      expect(ctx.getEquipment().armorLevel).toBe(4);
    });

    it('should not affect weapon slot', () => {
      const weaponBefore = ctx.getEquipment().weapon;
      equipArmor(ctx, Types.Entities.REDARMOR);
      expect(ctx.getEquipment().weapon).toBe(weaponBefore);
    });
  });

  // ========================================================================
  // equipWeapon
  // ========================================================================

  describe('equipWeapon', () => {
    it('should equip weapon to the weapon slot', () => {
      equipWeapon(ctx, Types.Entities.SWORD2);
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.SWORD2);
    });

    it('should replace existing weapon', () => {
      equipWeapon(ctx, Types.Entities.SWORD2);
      equipWeapon(ctx, Types.Entities.AXE);
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.AXE);
    });

    it('should pass properties to equipment manager', () => {
      const props = { rarity: 2, level: 5, category: 'weapon' as const, damageMin: 10, damageMax: 20 };
      equipWeapon(ctx, Types.Entities.AXE, props);
      expect(ctx.getEquipment().getProperties('weapon')).toEqual(props);
    });

    it('should update weapon level after equipping', () => {
      equipWeapon(ctx, Types.Entities.GOLDENSWORD);
      // GOLDENSWORD is index 6 in rankedItems => level 7
      expect(ctx.getEquipment().weaponLevel).toBe(7);
    });

    it('should not affect armor slot', () => {
      const armorBefore = ctx.getEquipment().armor;
      equipWeapon(ctx, Types.Entities.BLUESWORD);
      expect(ctx.getEquipment().armor).toBe(armorBefore);
    });
  });

  // ========================================================================
  // equipItem (auto-detect slot)
  // ========================================================================

  describe('equipItem', () => {
    it('should auto-detect and equip a weapon', () => {
      equipItem(ctx, { kind: Types.Entities.AXE });
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.AXE);
    });

    it('should auto-detect and equip armor', () => {
      equipItem(ctx, { kind: Types.Entities.PLATEARMOR });
      expect(ctx.getEquipment().armor).toBe(Types.Entities.PLATEARMOR);
    });

    it('should do nothing when item is null', () => {
      const weaponBefore = ctx.getEquipment().weapon;
      const armorBefore = ctx.getEquipment().armor;

      equipItem(ctx, null);

      expect(ctx.getEquipment().weapon).toBe(weaponBefore);
      expect(ctx.getEquipment().armor).toBe(armorBefore);
      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should send HitPoints message when equipping armor', () => {
      equipItem(ctx, { kind: Types.Entities.LEATHERARMOR });
      expect(ctx.send).toHaveBeenCalled();
    });

    it('should call updateHitPoints when equipping armor', () => {
      equipItem(ctx, { kind: Types.Entities.MAILARMOR });
      // resetHitPoints is called inside updateHitPoints
      expect(ctx.resetHitPoints).toHaveBeenCalled();
    });

    it('should NOT send HitPoints message when equipping a weapon', () => {
      equipItem(ctx, { kind: Types.Entities.AXE });
      // For weapons, send is not called (no HP update)
      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('should pass properties from item to equipment manager', () => {
      const item = {
        kind: Types.Entities.SWORD2,
        properties: { rarity: 1, level: 2, category: 'weapon' as const, damageMin: 8, damageMax: 15 },
      };
      equipItem(ctx, item);
      expect(ctx.getEquipment().getProperties('weapon')).toEqual(item.properties);
    });

    it('should handle item with no properties', () => {
      equipItem(ctx, { kind: Types.Entities.SWORD2 });
      expect(ctx.getEquipment().getProperties('weapon')).toBeNull();
    });
  });

  // ========================================================================
  // updateHitPoints
  // ========================================================================

  describe('updateHitPoints', () => {
    it('should call resetHitPoints with formula result', () => {
      updateHitPoints(ctx);
      const expected = Formulas.hp(
        ctx.getEquipment().armorLevel,
        ctx.level,
        ctx.getEquipment().getSetBonus(),
      );
      expect(ctx.resetHitPoints).toHaveBeenCalledWith(expected);
    });

    it('should recalculate HP after armor upgrade', () => {
      equipArmor(ctx, Types.Entities.PLATEARMOR);
      updateHitPoints(ctx);

      const expected = Formulas.hp(
        ctx.getEquipment().armorLevel,
        ctx.level,
        ctx.getEquipment().getSetBonus(),
      );
      expect(ctx.resetHitPoints).toHaveBeenCalledWith(expected);
    });

    it('should produce higher HP for higher-level armor', () => {
      // Default armor (level 1)
      const hpDefault = Formulas.hp(1, ctx.level, ctx.getEquipment().getSetBonus());

      // Upgrade armor
      equipArmor(ctx, Types.Entities.GOLDENARMOR);
      const hpUpgraded = Formulas.hp(
        ctx.getEquipment().armorLevel,
        ctx.level,
        ctx.getEquipment().getSetBonus(),
      );

      expect(hpUpgraded).toBeGreaterThan(hpDefault);
    });

    it('should account for player level in HP calculation', () => {
      const ctxLow = makeMockCtx({ level: 1 });
      const ctxHigh = makeMockCtx({ level: 20 });

      updateHitPoints(ctxLow);
      updateHitPoints(ctxHigh);

      const hpLow = (ctxLow.resetHitPoints as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const hpHigh = (ctxHigh.resetHitPoints as ReturnType<typeof vi.fn>).mock.calls[0][0];

      expect(hpHigh).toBeGreaterThan(hpLow);
    });
  });

  // ========================================================================
  // handleDropItem
  // ========================================================================

  describe('handleDropItem', () => {
    it('should drop a non-default weapon and spawn it in the world', () => {
      equipWeapon(ctx, Types.Entities.SWORD2);
      handleDropItem(ctx, 'weapon');

      const world = ctx.getWorld();
      expect(world.createItemWithProperties).toHaveBeenCalledWith(
        Types.Entities.SWORD2,
        ctx.x,
        ctx.y,
        null, // no properties
      );
      expect(world.addItem).toHaveBeenCalled();
    });

    it('should drop a non-default armor and spawn it in the world', () => {
      equipArmor(ctx, Types.Entities.PLATEARMOR);
      handleDropItem(ctx, 'armor');

      const world = ctx.getWorld();
      expect(world.createItemWithProperties).toHaveBeenCalledWith(
        Types.Entities.PLATEARMOR,
        ctx.x,
        ctx.y,
        null,
      );
      expect(world.addItem).toHaveBeenCalled();
    });

    it('should NOT drop a default weapon (SWORD1)', () => {
      // Default weapon is SWORD1 - cannot be dropped
      handleDropItem(ctx, 'weapon');

      const world = ctx.getWorld();
      expect(world.createItemWithProperties).not.toHaveBeenCalled();
      expect(world.addItem).not.toHaveBeenCalled();
    });

    it('should NOT drop default armor (CLOTHARMOR)', () => {
      handleDropItem(ctx, 'armor');

      const world = ctx.getWorld();
      expect(world.createItemWithProperties).not.toHaveBeenCalled();
      expect(world.addItem).not.toHaveBeenCalled();
    });

    it('should revert to default item after dropping', () => {
      equipWeapon(ctx, Types.Entities.BLUESWORD);
      handleDropItem(ctx, 'weapon');

      expect(ctx.getEquipment().weapon).toBe(Types.Entities.SWORD1);
    });

    it('should revert armor to CLOTHARMOR after dropping', () => {
      equipArmor(ctx, Types.Entities.REDARMOR);
      handleDropItem(ctx, 'armor');

      expect(ctx.getEquipment().armor).toBe(Types.Entities.CLOTHARMOR);
    });

    it('should send equip message to player after dropping', () => {
      equipWeapon(ctx, Types.Entities.SWORD2);
      handleDropItem(ctx, 'weapon');

      // send is called with the new (default) equipment
      expect(ctx.send).toHaveBeenCalled();
    });

    it('should broadcast equip message after dropping', () => {
      equipWeapon(ctx, Types.Entities.AXE);
      handleDropItem(ctx, 'weapon');

      expect(ctx.broadcast).toHaveBeenCalled();
    });

    it('should broadcast spawn message for dropped item', () => {
      equipWeapon(ctx, Types.Entities.MORNINGSTAR);
      handleDropItem(ctx, 'weapon');

      // broadcast is called with the Spawn message (false = don't ignore self)
      expect(ctx.broadcast).toHaveBeenCalled();
    });

    it('should update HP when dropping armor', () => {
      equipArmor(ctx, Types.Entities.GOLDENARMOR);
      vi.mocked(ctx.resetHitPoints).mockClear();

      handleDropItem(ctx, 'armor');

      // resetHitPoints should be called to recalculate HP with default armor
      expect(ctx.resetHitPoints).toHaveBeenCalled();
    });

    it('should NOT update HP when dropping a weapon', () => {
      equipWeapon(ctx, Types.Entities.BLUESWORD);
      vi.mocked(ctx.resetHitPoints).mockClear();

      handleDropItem(ctx, 'weapon');

      // Weapon drops do not affect HP
      expect(ctx.resetHitPoints).not.toHaveBeenCalled();
    });

    it('should send HitPoints message after dropping armor', () => {
      equipArmor(ctx, Types.Entities.PLATEARMOR);
      vi.mocked(ctx.send).mockClear();

      handleDropItem(ctx, 'armor');

      // At least one send call should be for HitPoints
      expect(ctx.send).toHaveBeenCalled();
    });

    it('should preserve item properties when dropping', () => {
      const props = { rarity: 2, level: 4, category: 'weapon' as const, damageMin: 15, damageMax: 25 };
      equipWeapon(ctx, Types.Entities.AXE, props);

      handleDropItem(ctx, 'weapon');

      const world = ctx.getWorld();
      expect(world.createItemWithProperties).toHaveBeenCalledWith(
        Types.Entities.AXE,
        ctx.x,
        ctx.y,
        props,
      );
    });
  });

  // ========================================================================
  // createEquipMessage
  // ========================================================================

  describe('createEquipMessage', () => {
    it('should create a serializable message', () => {
      const message = createEquipMessage(ctx, Types.Entities.SWORD2);
      expect(message.serialize).toBeDefined();
      expect(typeof message.serialize).toBe('function');
    });

    it('should include the player id and item kind in serialized output', () => {
      const message = createEquipMessage(ctx, Types.Entities.AXE);
      const serialized = message.serialize();
      expect(serialized).toContain(ctx.id);
      expect(serialized).toContain(Types.Entities.AXE);
    });
  });

  // ========================================================================
  // getWeapon / getArmor / getWeaponLevel / getArmorLevel
  // ========================================================================

  describe('getters', () => {
    it('getWeapon should return default weapon initially', () => {
      expect(getWeapon(ctx)).toBe(Types.Entities.SWORD1);
    });

    it('getWeapon should return equipped weapon', () => {
      equipWeapon(ctx, Types.Entities.GOLDENSWORD);
      expect(getWeapon(ctx)).toBe(Types.Entities.GOLDENSWORD);
    });

    it('getArmor should return default armor initially', () => {
      expect(getArmor(ctx)).toBe(Types.Entities.CLOTHARMOR);
    });

    it('getArmor should return equipped armor', () => {
      equipArmor(ctx, Types.Entities.GOLDENARMOR);
      expect(getArmor(ctx)).toBe(Types.Entities.GOLDENARMOR);
    });

    it('getWeaponLevel should return 1 for default weapon', () => {
      expect(getWeaponLevel(ctx)).toBe(1);
    });

    it('getWeaponLevel should reflect equipped weapon rank', () => {
      equipWeapon(ctx, Types.Entities.AXE);
      // AXE is index 2 => level 3
      expect(getWeaponLevel(ctx)).toBe(3);
    });

    it('getArmorLevel should return 1 for default armor', () => {
      expect(getArmorLevel(ctx)).toBe(1);
    });

    it('getArmorLevel should reflect equipped armor rank', () => {
      equipArmor(ctx, Types.Entities.REDARMOR);
      // REDARMOR is index 4 => level 5
      expect(getArmorLevel(ctx)).toBe(5);
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe('edge cases', () => {
    it('should handle equipping the same weapon twice', () => {
      equipWeapon(ctx, Types.Entities.SWORD2);
      equipWeapon(ctx, Types.Entities.SWORD2);
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.SWORD2);
    });

    it('should handle equipping the same armor twice', () => {
      equipArmor(ctx, Types.Entities.MAILARMOR);
      equipArmor(ctx, Types.Entities.MAILARMOR);
      expect(ctx.getEquipment().armor).toBe(Types.Entities.MAILARMOR);
    });

    it('should handle equipping the default weapon explicitly', () => {
      equipWeapon(ctx, Types.Entities.AXE);
      equipWeapon(ctx, Types.Entities.SWORD1);
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.SWORD1);
      expect(ctx.getEquipment().hasDefault('weapon')).toBe(true);
    });

    it('should handle equipping the default armor explicitly', () => {
      equipArmor(ctx, Types.Entities.PLATEARMOR);
      equipArmor(ctx, Types.Entities.CLOTHARMOR);
      expect(ctx.getEquipment().armor).toBe(Types.Entities.CLOTHARMOR);
      expect(ctx.getEquipment().hasDefault('armor')).toBe(true);
    });

    it('should handle rapid weapon swaps', () => {
      equipWeapon(ctx, Types.Entities.SWORD2);
      equipWeapon(ctx, Types.Entities.AXE);
      equipWeapon(ctx, Types.Entities.BLUESWORD);
      equipWeapon(ctx, Types.Entities.GOLDENSWORD);

      expect(ctx.getEquipment().weapon).toBe(Types.Entities.GOLDENSWORD);
    });

    it('should handle rapid armor swaps', () => {
      equipArmor(ctx, Types.Entities.LEATHERARMOR);
      equipArmor(ctx, Types.Entities.MAILARMOR);
      equipArmor(ctx, Types.Entities.PLATEARMOR);
      equipArmor(ctx, Types.Entities.GOLDENARMOR);

      expect(ctx.getEquipment().armor).toBe(Types.Entities.GOLDENARMOR);
    });

    it('should maintain independent weapon and armor state', () => {
      equipWeapon(ctx, Types.Entities.GOLDENSWORD);
      equipArmor(ctx, Types.Entities.GOLDENARMOR);

      // Dropping weapon should not affect armor
      handleDropItem(ctx, 'weapon');
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.SWORD1);
      expect(ctx.getEquipment().armor).toBe(Types.Entities.GOLDENARMOR);
    });

    it('should handle equip-drop-equip cycle', () => {
      equipWeapon(ctx, Types.Entities.BLUESWORD);
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.BLUESWORD);

      handleDropItem(ctx, 'weapon');
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.SWORD1);

      equipWeapon(ctx, Types.Entities.REDSWORD);
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.REDSWORD);
    });

    it('should handle dropping after equipItem auto-detect', () => {
      equipItem(ctx, { kind: Types.Entities.MORNINGSTAR });
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.MORNINGSTAR);

      handleDropItem(ctx, 'weapon');
      expect(ctx.getEquipment().weapon).toBe(Types.Entities.SWORD1);
    });
  });
});
