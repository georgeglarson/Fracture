/**
 * Tests for CombatHandler
 * Covers: handleAttack, handleHit, handleHurt, isInMeleeRange
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Formulas at module level (static import in combat.handler.ts)
vi.mock('../formulas', () => ({
  Formulas: {
    dmg: vi.fn(() => 10),
  },
}));

vi.mock('../combat/combat-constants.js', () => ({
  MELEE_RANGE: 2,
}));

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

import { handleAttack, handleHit, handleHurt, isInMeleeRange } from '../player/combat.handler';
import { Formulas } from '../formulas';
import type { Player } from '../player';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockWorld() {
  return {
    getEntityById: vi.fn(() => null),
    broadcastAttacker: vi.fn(),
    handleMobHate: vi.fn(),
    handleHurtEntity: vi.fn(),
  };
}

function createMockPlayer(overrides: Record<string, any> = {}): Player {
  const world = createMockWorld();
  return {
    id: 1,
    name: 'TestPlayer',
    x: 50,
    y: 50,
    level: 1,
    weaponLevel: 1,
    armorLevel: 1,
    hitPoints: 100,
    maxHitPoints: 100,
    isDead: false,
    spawnProtectionUntil: 0,
    attackers: {},

    getWorld: vi.fn(() => world),
    setTarget: vi.fn(),
    addAttacker: vi.fn(),
    isPhased: vi.fn(() => false),
    consumePowerStrike: vi.fn(() => 1),
    firepotionTimeout: null,

    send: vi.fn(),
    broadcast: vi.fn(),

    ...overrides,
  } as unknown as Player;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CombatHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // isInMeleeRange
  // =========================================================================

  describe('isInMeleeRange', () => {
    it('should return true when entities are adjacent', () => {
      expect(isInMeleeRange({ x: 50, y: 50 }, { x: 51, y: 51 })).toBe(true);
    });

    it('should return true when entities are at same position', () => {
      expect(isInMeleeRange({ x: 50, y: 50 }, { x: 50, y: 50 })).toBe(true);
    });

    it('should return true at exact melee range', () => {
      expect(isInMeleeRange({ x: 50, y: 50 }, { x: 52, y: 50 })).toBe(true);
    });

    it('should return false when entities are too far', () => {
      expect(isInMeleeRange({ x: 50, y: 50 }, { x: 200, y: 200 })).toBe(false);
    });

    it('should return false when just outside melee range', () => {
      expect(isInMeleeRange({ x: 50, y: 50 }, { x: 53, y: 50 })).toBe(false);
    });
  });

  // =========================================================================
  // handleAttack
  // =========================================================================

  describe('handleAttack', () => {
    it('should set target and broadcast attacker', () => {
      const player = createMockPlayer();
      const world = player.getWorld() as ReturnType<typeof createMockWorld>;
      const mob = { id: 42 };
      world.getEntityById = vi.fn(() => mob);

      handleAttack(player, [7, 42]);

      expect(player.setTarget).toHaveBeenCalledWith(mob);
      expect(world.broadcastAttacker).toHaveBeenCalledWith(player);
    });

    it('should not attack non-existent entity', () => {
      const player = createMockPlayer();

      handleAttack(player, [7, 999]);

      expect(player.setTarget).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleHit
  // =========================================================================

  describe('handleHit', () => {
    let player: Player;
    let world: ReturnType<typeof createMockWorld>;
    let mob: any;

    beforeEach(() => {
      player = createMockPlayer();
      world = player.getWorld() as ReturnType<typeof createMockWorld>;
      mob = {
        id: 42,
        isDead: false,
        armorLevel: 1,
        weaponLevel: 1,
        receiveDamage: vi.fn(),
        hitPoints: 50,
        x: 51,
        y: 50,
      };
      world.getEntityById = vi.fn(() => mob);
      vi.mocked(Formulas.dmg).mockReturnValue(10);
    });

    it('should deal damage to a living mob', () => {
      handleHit(player, [8, 42]);

      expect(world.getEntityById).toHaveBeenCalledWith(42);
      expect(Formulas.dmg).toHaveBeenCalledWith(
        player.weaponLevel,
        mob.armorLevel,
        player.level,
      );
      expect(mob.receiveDamage).toHaveBeenCalledWith(10, player.id);
      expect(world.handleMobHate).toHaveBeenCalledWith(mob.id, player.id, 10);
      expect(world.handleHurtEntity).toHaveBeenCalledWith(mob, player, 10);
    });

    it('should not hit a dead mob', () => {
      mob.isDead = true;

      handleHit(player, [8, 42]);

      expect(mob.receiveDamage).not.toHaveBeenCalled();
    });

    it('should not hit a non-existent entity', () => {
      world.getEntityById = vi.fn(() => null);

      handleHit(player, [8, 999]);

      expect(Formulas.dmg).not.toHaveBeenCalled();
    });

    it('should clear spawn protection on attack', () => {
      player.spawnProtectionUntil = Date.now() + 10000;

      handleHit(player, [8, 42]);

      expect(player.spawnProtectionUntil).toBe(0);
    });

    it('should clear spawn protection even if mob is null', () => {
      player.spawnProtectionUntil = Date.now() + 10000;
      world.getEntityById = vi.fn(() => null);

      handleHit(player, [8, 999]);

      expect(player.spawnProtectionUntil).toBe(0);
    });

    it('should not deal damage when dmg formula returns 0', () => {
      vi.mocked(Formulas.dmg).mockReturnValue(0);

      handleHit(player, [8, 42]);

      expect(mob.receiveDamage).not.toHaveBeenCalled();
      expect(world.handleHurtEntity).not.toHaveBeenCalled();
    });

    it('should apply power strike multiplier', () => {
      (player.consumePowerStrike as ReturnType<typeof vi.fn>).mockReturnValue(2);
      vi.mocked(Formulas.dmg).mockReturnValue(15);

      handleHit(player, [8, 42]);

      expect(mob.receiveDamage).toHaveBeenCalledWith(30, player.id);
      expect(world.handleMobHate).toHaveBeenCalledWith(mob.id, player.id, 30);
    });

    it('should floor the damage after multiplier', () => {
      (player.consumePowerStrike as ReturnType<typeof vi.fn>).mockReturnValue(1.5);
      vi.mocked(Formulas.dmg).mockReturnValue(7);

      handleHit(player, [8, 42]);

      // Math.floor(7 * 1.5) = Math.floor(10.5) = 10
      expect(mob.receiveDamage).toHaveBeenCalledWith(10, player.id);
    });

    it('should consume power strike buff on each hit', () => {
      handleHit(player, [8, 42]);

      expect(player.consumePowerStrike).toHaveBeenCalled();
    });

    it('should pass player level to damage formula', () => {
      player.level = 25;
      handleHit(player, [8, 42]);

      expect(Formulas.dmg).toHaveBeenCalledWith(
        player.weaponLevel,
        mob.armorLevel,
        25,
      );
    });

    it('should not hit mob out of melee range', () => {
      mob.x = 200;
      mob.y = 200;

      handleHit(player, [8, 42]);

      expect(mob.receiveDamage).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleHurt
  // =========================================================================

  describe('handleHurt', () => {
    let player: Player;
    let world: ReturnType<typeof createMockWorld>;
    let mob: any;

    beforeEach(() => {
      player = createMockPlayer();
      world = player.getWorld() as ReturnType<typeof createMockWorld>;
      mob = {
        id: 42,
        isDead: false,
        hitPoints: 50,
        weaponLevel: 1,
        x: 50,
        y: 50,
        clearTarget: vi.fn(),
        forgetPlayer: vi.fn(),
      };
      world.getEntityById = vi.fn(() => mob);
      vi.mocked(Formulas.dmg).mockReturnValue(10);
    });

    it('should reduce player hitPoints when hurt by mob', () => {
      handleHurt(player, [9, 42]);

      expect(player.hitPoints).toBeLessThan(100);
      expect(world.handleHurtEntity).toHaveBeenCalledWith(player);
    });

    it('should clamp hitPoints at 0 on overkill damage', () => {
      player.hitPoints = 5;
      vi.mocked(Formulas.dmg).mockReturnValue(20);

      handleHurt(player, [9, 42]);

      expect(player.hitPoints).toBe(0);
    });

    it('should not take damage from a dead mob', () => {
      mob.isDead = true;

      handleHurt(player, [9, 42]);

      expect(player.hitPoints).toBe(100);
    });

    it('should not take damage from a non-existent mob', () => {
      world.getEntityById = vi.fn(() => null);

      handleHurt(player, [9, 999]);

      expect(player.hitPoints).toBe(100);
    });

    it('should not take damage when player is dead', () => {
      player.hitPoints = 0;

      handleHurt(player, [9, 42]);

      expect(world.handleHurtEntity).not.toHaveBeenCalled();
    });

    it('should not take damage when phased', () => {
      (player.isPhased as ReturnType<typeof vi.fn>).mockReturnValue(true);

      handleHurt(player, [9, 42]);

      expect(player.hitPoints).toBe(100);
    });

    it('should set isDead and clear firepotion timeout when killed', () => {
      player.hitPoints = 5;
      vi.mocked(Formulas.dmg).mockReturnValue(10);
      const timeout = setTimeout(() => {}, 15000);
      player.firepotionTimeout = timeout;

      handleHurt(player, [9, 42]);

      expect(player.isDead).toBe(true);
      clearTimeout(timeout);
    });

    it('should reject damage from mob too far away', () => {
      mob.x = 200;
      mob.y = 200;

      handleHurt(player, [9, 42]);

      expect(player.hitPoints).toBe(100);
      expect(mob.clearTarget).not.toHaveBeenCalled();
      expect(mob.forgetPlayer).not.toHaveBeenCalled();
    });

    it('should allow damage from mob within melee range', () => {
      mob.x = 51;
      mob.y = 51;

      handleHurt(player, [9, 42]);

      expect(player.hitPoints).toBeLessThan(100);
    });

    it('should not take damage from stunned mob', () => {
      mob.stunUntil = Date.now() + 5000;

      handleHurt(player, [9, 42]);

      expect(player.hitPoints).toBe(100);
    });

    it('should not take damage from mob with 0 hitPoints', () => {
      mob.hitPoints = 0;

      handleHurt(player, [9, 42]);

      expect(player.hitPoints).toBe(100);
    });

    it('should pass mob level to damage formula', () => {
      mob.level = 15;

      handleHurt(player, [9, 42]);

      expect(Formulas.dmg).toHaveBeenCalledWith(
        mob.weaponLevel,
        player.armorLevel,
        15,
      );
    });

    it('should default mob level to 1 when not set', () => {
      mob.level = undefined;

      handleHurt(player, [9, 42]);

      expect(Formulas.dmg).toHaveBeenCalledWith(
        mob.weaponLevel,
        player.armorLevel,
        1,
      );
    });

    it('should add attacker link if not already attacking', () => {
      handleHurt(player, [9, 42]);

      expect(player.addAttacker).toHaveBeenCalledWith(mob);
      expect(world.broadcastAttacker).toHaveBeenCalledWith(mob);
    });
  });
});
