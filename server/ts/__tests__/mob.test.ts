import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies that Mob pulls in transitively
// ---------------------------------------------------------------------------

// Mock the combat-tracker singleton so tests never touch the real CombatTracker
const mockCombatTracker = {
  addAggro: vi.fn(),
  removeAggro: vi.fn(),
  clearMobAggro: vi.fn(),
  hasAggro: vi.fn().mockReturnValue(false),
  getHatedPlayerId: vi.fn().mockReturnValue(null),
  getMobAggroCount: vi.fn().mockReturnValue(0),
};

vi.mock('../combat/combat-tracker', () => ({
  getCombatTracker: () => mockCombatTracker,
}));

// Mock Properties so we control the stat values used during construction
vi.mock('../properties', () => ({
  Properties: {
    getMobLevel: vi.fn().mockReturnValue(5),
    getArmorLevel: vi.fn().mockReturnValue(2),
    getWeaponLevel: vi.fn().mockReturnValue(3),
    getAggroRange: vi.fn().mockReturnValue(4),
    getHitPoints: vi.fn().mockReturnValue(100),
  },
}));

// Mock MobArea and ChestArea so instanceof checks in handleRespawn work
vi.mock('../mobarea', () => {
  class MobArea {
    respawnMob = vi.fn();
  }
  return { MobArea };
});

vi.mock('../chestarea', () => {
  class ChestArea {
    removeFromArea = vi.fn();
  }
  return { ChestArea };
});

// Stub Area (parent of MobArea/ChestArea) to prevent transitive import issues
vi.mock('../area', () => {
  class Area {}
  return { Area };
});

// Mock Utils – provide deterministic helpers
vi.mock('../utils', () => ({
  Utils: {
    randomOrientation: vi.fn().mockReturnValue(2), // DOWN
    distanceTo: vi.fn((x1: number, y1: number, x2: number, y2: number) => {
      const dx = Math.abs(x1 - x2);
      const dy = Math.abs(y1 - y2);
      return dx > dy ? dx : dy;
    }),
    random: vi.fn().mockReturnValue(0),
  },
  normalizeId: (id: string | number) =>
    typeof id === 'number' ? id : parseInt(id, 10),
}));

// Stub Messages so we avoid pulling in the real message module
vi.mock('../message', () => ({
  Messages: {
    Spawn: class {
      constructor(private entity: any) {}
      serialize() { return ['spawn', ...this.entity.getState()]; }
    },
    Despawn: class {
      constructor(private id: number) {}
      serialize() { return ['despawn', this.id]; }
    },
    Attack: class {
      constructor(private a: any, private t: any) {}
      serialize() { return ['attack', this.a, this.t]; }
    },
    Health: class {
      constructor(private hp: number, private regen: boolean) {}
      serialize() { return ['health', this.hp, this.regen]; }
    },
    Drop: class {
      constructor(private mob: any, private item: any) {}
      serialize() { return ['drop', this.mob.id, this.item.id]; }
    },
  },
}));

// ---------------------------------------------------------------------------
// Import the class under test AFTER mocks are in place
// ---------------------------------------------------------------------------
import { Mob } from '../mob';
import { Properties } from '../properties';
import { MobArea } from '../mobarea';
import { ChestArea } from '../chestarea';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMob(id: string | number = 1, kind = 2, x = 10, y = 20): Mob {
  return new Mob(id, kind, x, y);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Mob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Reset default mock return values that individual tests may override
    mockCombatTracker.hasAggro.mockReturnValue(false);
    mockCombatTracker.getHatedPlayerId.mockReturnValue(null);
    mockCombatTracker.getMobAggroCount.mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Construction & initialisation
  // =========================================================================
  describe('construction and initialization', () => {
    it('should set spawning coordinates to the initial position', () => {
      const mob = createMob(1, 2, 15, 25);
      expect(mob.spawningX).toBe(15);
      expect(mob.spawningY).toBe(25);
      expect(mob.x).toBe(15);
      expect(mob.y).toBe(25);
    });

    it('should store the id as a number', () => {
      const mob = createMob('42', 2, 0, 0);
      expect(mob.id).toBe(42);
    });

    it('should set type to "mob"', () => {
      const mob = createMob();
      expect(mob.type).toBe('mob');
    });

    it('should read level, armor, weapon and aggro from Properties', () => {
      const mob = createMob(1, 2, 0, 0);
      expect(Properties.getMobLevel).toHaveBeenCalledWith(2);
      expect(Properties.getArmorLevel).toHaveBeenCalledWith(2);
      expect(Properties.getWeaponLevel).toHaveBeenCalledWith(2);
      expect(Properties.getAggroRange).toHaveBeenCalledWith(2);
      expect(mob.level).toBe(5);
      expect(mob.armorLevel).toBe(2);
      expect(mob.weaponLevel).toBe(3);
      expect(mob.aggroRange).toBe(4);
    });

    it('should initialise hitPoints via updateHitPoints', () => {
      const mob = createMob();
      // Properties.getHitPoints returns 100
      expect(mob.hitPoints).toBe(100);
      expect(mob.maxHitPoints).toBe(100);
    });

    it('should default isDead to false', () => {
      const mob = createMob();
      expect(mob.isDead).toBe(false);
    });

    it('should default area to null', () => {
      const mob = createMob();
      expect(mob.area).toBeNull();
    });
  });

  // =========================================================================
  // receiveDamage
  // =========================================================================
  describe('receiveDamage', () => {
    it('should reduce hitPoints by the given amount', () => {
      const mob = createMob();
      mob.receiveDamage(30, 100);
      expect(mob.hitPoints).toBe(70);
    });

    it('should allow hitPoints to reach 0', () => {
      const mob = createMob();
      mob.receiveDamage(100, 100);
      expect(mob.hitPoints).toBe(0);
    });

    it('should allow hitPoints to go negative (caller handles death)', () => {
      const mob = createMob();
      mob.receiveDamage(150, 100);
      expect(mob.hitPoints).toBe(-50);
    });

    it('should accept multiple damage applications cumulatively', () => {
      const mob = createMob();
      mob.receiveDamage(20, 100);
      mob.receiveDamage(35, 200);
      expect(mob.hitPoints).toBe(45);
    });
  });

  // =========================================================================
  // Hate system (via CombatTracker)
  // =========================================================================
  describe('hate system', () => {
    describe('increaseHateFor', () => {
      it('should delegate to combatTracker.addAggro', () => {
        const mob = createMob(5, 2, 0, 0);
        mob.increaseHateFor(100, 10);
        expect(mockCombatTracker.addAggro).toHaveBeenCalledWith(5, 100, 10);
      });

      it('should clear returnTimeout when hate is added', () => {
        const mob = createMob();
        // Simulate an active returnTimeout
        mob.returnTimeout = setTimeout(() => {}, 5000);
        mob.increaseHateFor(100, 5);
        expect(mob.returnTimeout).toBeNull();
      });
    });

    describe('getHatedPlayerId', () => {
      it('should return the player id from combatTracker when present', () => {
        mockCombatTracker.getHatedPlayerId.mockReturnValue(42);
        const mob = createMob(1, 2, 0, 0);
        expect(mob.getHatedPlayerId()).toBe(42);
        expect(mockCombatTracker.getHatedPlayerId).toHaveBeenCalledWith(1, 1);
      });

      it('should pass hateRank through when specified', () => {
        mockCombatTracker.getHatedPlayerId.mockReturnValue(99);
        const mob = createMob(1, 2, 0, 0);
        expect(mob.getHatedPlayerId(3)).toBe(99);
        expect(mockCombatTracker.getHatedPlayerId).toHaveBeenCalledWith(1, 3);
      });

      it('should return undefined when combatTracker returns null', () => {
        mockCombatTracker.getHatedPlayerId.mockReturnValue(null);
        const mob = createMob();
        expect(mob.getHatedPlayerId()).toBeUndefined();
      });
    });

    describe('hates', () => {
      it('should return true when combatTracker has aggro', () => {
        mockCombatTracker.hasAggro.mockReturnValue(true);
        const mob = createMob(7, 2, 0, 0);
        expect(mob.hates(100)).toBe(true);
        expect(mockCombatTracker.hasAggro).toHaveBeenCalledWith(7, 100);
      });

      it('should return false when combatTracker has no aggro', () => {
        mockCombatTracker.hasAggro.mockReturnValue(false);
        const mob = createMob(7, 2, 0, 0);
        expect(mob.hates(100)).toBe(false);
      });
    });

    describe('forgetPlayer', () => {
      it('should remove aggro via combatTracker', () => {
        const mob = createMob(3, 2, 0, 0);
        mob.forgetPlayer(200);
        expect(mockCombatTracker.removeAggro).toHaveBeenCalledWith(3, 200);
      });

      it('should trigger returnToSpawningPosition when no aggro remains', () => {
        mockCombatTracker.getMobAggroCount.mockReturnValue(0);
        const mob = createMob(3, 2, 0, 0);
        mob.forgetPlayer(200);
        // returnToSpawningPosition sets a returnTimeout
        expect(mob.returnTimeout).not.toBeNull();
      });

      it('should NOT trigger return when other aggro targets remain', () => {
        mockCombatTracker.getMobAggroCount.mockReturnValue(1);
        const mob = createMob(3, 2, 0, 0);
        mob.forgetPlayer(200);
        expect(mob.returnTimeout).toBeNull();
      });

      it('should accept an optional duration for the return delay', () => {
        mockCombatTracker.getMobAggroCount.mockReturnValue(0);
        const mob = createMob(3, 2, 5, 10);
        mob.forgetPlayer(200, 1000);
        // After the duration elapses the mob should reset position
        vi.advanceTimersByTime(1000);
        expect(mob.x).toBe(5);
        expect(mob.y).toBe(10);
      });
    });

    describe('forgetEveryone', () => {
      it('should clear all aggro and start returning', () => {
        const mob = createMob(3, 2, 0, 0);
        mob.forgetEveryone();
        expect(mockCombatTracker.clearMobAggro).toHaveBeenCalledWith(3);
        expect(mob.returnTimeout).not.toBeNull();
      });
    });
  });

  // =========================================================================
  // Target management
  // =========================================================================
  describe('target management', () => {
    it('setTarget should store entity id', () => {
      const mob = createMob();
      mob.setTarget({ id: 55, type: 'player', kind: 1, x: 0, y: 0 } as any);
      expect(mob.target).toBe(55);
    });

    it('clearTarget should reset target to null', () => {
      const mob = createMob();
      mob.setTarget({ id: 55 } as any);
      mob.clearTarget();
      expect(mob.target).toBeNull();
    });

    it('hasTarget should reflect current target state', () => {
      const mob = createMob();
      expect(mob.hasTarget()).toBe(false);
      mob.setTarget({ id: 10 } as any);
      expect(mob.hasTarget()).toBe(true);
      mob.clearTarget();
      expect(mob.hasTarget()).toBe(false);
    });
  });

  // =========================================================================
  // Return to spawn
  // =========================================================================
  describe('returnToSpawningPosition', () => {
    it('should clear current target', () => {
      const mob = createMob();
      mob.setTarget({ id: 99 } as any);
      mob.returnToSpawningPosition();
      expect(mob.target).toBeNull();
    });

    it('should set a returnTimeout', () => {
      const mob = createMob();
      mob.returnToSpawningPosition();
      expect(mob.returnTimeout).not.toBeNull();
    });

    it('should use default delay of 4000ms', () => {
      const mob = createMob(1, 2, 5, 10);
      mob.setPosition(20, 30); // move away from spawn
      mob.returnToSpawningPosition();
      // Position should NOT have changed yet
      expect(mob.x).toBe(20);
      vi.advanceTimersByTime(3999);
      expect(mob.x).toBe(20);
      vi.advanceTimersByTime(1);
      // Now position should be reset to spawning coords
      expect(mob.x).toBe(5);
      expect(mob.y).toBe(10);
    });

    it('should honour custom waitDuration', () => {
      const mob = createMob(1, 2, 5, 10);
      mob.setPosition(20, 30);
      mob.returnToSpawningPosition(2000);
      vi.advanceTimersByTime(1999);
      expect(mob.x).toBe(20);
      vi.advanceTimersByTime(1);
      expect(mob.x).toBe(5);
      expect(mob.y).toBe(10);
    });

    it('should invoke move_callback when timer fires', () => {
      const mob = createMob(1, 2, 5, 10);
      const moveCb = vi.fn();
      mob.onMove(moveCb);
      mob.setPosition(20, 30);
      mob.returnToSpawningPosition(100);
      vi.advanceTimersByTime(100);
      expect(moveCb).toHaveBeenCalledWith(mob);
    });
  });

  describe('resetPosition', () => {
    it('should set position back to spawning coordinates', () => {
      const mob = createMob(1, 2, 7, 14);
      mob.setPosition(100, 200);
      mob.resetPosition();
      expect(mob.x).toBe(7);
      expect(mob.y).toBe(14);
    });
  });

  // =========================================================================
  // Respawn behaviour
  // =========================================================================
  describe('handleRespawn', () => {
    it('should call area.respawnMob when mob belongs to a MobArea', () => {
      const mob = createMob();
      const fakeMobArea = new (MobArea as any)();
      fakeMobArea.respawnMob = vi.fn();
      mob.area = fakeMobArea;
      mob.handleRespawn();
      expect(fakeMobArea.respawnMob).toHaveBeenCalledWith(mob, 30000);
    });

    it('should call respawn_callback after delay when no MobArea', () => {
      const mob = createMob();
      mob.area = null;
      const cb = vi.fn();
      mob.onRespawn(cb);
      mob.handleRespawn();
      expect(cb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(30000);
      expect(cb).toHaveBeenCalledOnce();
    });

    it('should call removeFromArea for ChestArea', () => {
      const mob = createMob();
      const fakeChestArea = new (ChestArea as any)();
      fakeChestArea.removeFromArea = vi.fn();
      mob.area = fakeChestArea;
      const cb = vi.fn();
      mob.onRespawn(cb);
      mob.handleRespawn();
      expect(fakeChestArea.removeFromArea).toHaveBeenCalledWith(mob);
      vi.advanceTimersByTime(30000);
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // destroy()
  // =========================================================================
  describe('destroy', () => {
    it('should set isDead to true', () => {
      const mob = createMob();
      mob.destroy();
      expect(mob.isDead).toBe(true);
    });

    it('should clear returnTimeout if one is pending', () => {
      const mob = createMob();
      mob.returnTimeout = setTimeout(() => {}, 9999);
      mob.destroy();
      expect(mob.returnTimeout).toBeNull();
    });

    it('should clear mob aggro in the combatTracker', () => {
      const mob = createMob(8, 2, 0, 0);
      mob.destroy();
      expect(mockCombatTracker.clearMobAggro).toHaveBeenCalledWith(8);
    });

    it('should clear target', () => {
      const mob = createMob();
      mob.setTarget({ id: 50 } as any);
      mob.destroy();
      expect(mob.target).toBeNull();
    });

    it('should reset hitPoints to max', () => {
      const mob = createMob();
      mob.receiveDamage(60, 1);
      mob.destroy();
      expect(mob.hitPoints).toBe(mob.maxHitPoints);
    });

    it('should reset position to spawn point', () => {
      const mob = createMob(1, 2, 5, 10);
      mob.setPosition(99, 99);
      mob.destroy();
      expect(mob.x).toBe(5);
      expect(mob.y).toBe(10);
    });

    it('should trigger handleRespawn', () => {
      const mob = createMob();
      const cb = vi.fn();
      mob.onRespawn(cb);
      mob.destroy();
      // handleRespawn schedules the callback with a 30 s delay
      vi.advanceTimersByTime(30000);
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // getState() – serialisation
  // =========================================================================
  describe('getState', () => {
    it('should include base state fields [id, kind, x, y]', () => {
      const mob = createMob(7, 2, 12, 34);
      const state = mob.getState();
      expect(state[0]).toBe(7);
      expect(state[1]).toBe(2);
      expect(state[2]).toBe(12);
      expect(state[3]).toBe(34);
    });

    it('should include orientation after base state', () => {
      const mob = createMob();
      const state = mob.getState();
      // orientation is at index 4
      expect(state[4]).toBe(mob.orientation);
    });

    it('should include hitPoints, maxHitPoints, and level', () => {
      const mob = createMob();
      const state = mob.getState();
      expect(state[5]).toBe(mob.hitPoints);
      expect(state[6]).toBe(mob.maxHitPoints);
      expect(state[7]).toBe(mob.level);
    });

    it('should append target as last element when present', () => {
      const mob = createMob();
      mob.setTarget({ id: 42 } as any);
      const state = mob.getState();
      expect(state[state.length - 1]).toBe(42);
      // total length: 4 base + orientation + hp + maxHp + level + target = 9
      expect(state).toHaveLength(9);
    });

    it('should omit target when there is none', () => {
      const mob = createMob();
      const state = mob.getState();
      // 4 base + orientation + hp + maxHp + level = 8
      expect(state).toHaveLength(8);
    });
  });

  // =========================================================================
  // distanceToSpawningPoint
  // =========================================================================
  describe('distanceToSpawningPoint', () => {
    it('should compute Chebyshev distance to spawning coords', () => {
      const mob = createMob(1, 2, 10, 20);
      const dist = mob.distanceToSpawningPoint(15, 28);
      // max(|15-10|, |28-20|) = max(5, 8) = 8
      expect(dist).toBe(8);
    });

    it('should return 0 when given spawning coords', () => {
      const mob = createMob(1, 2, 10, 20);
      expect(mob.distanceToSpawningPoint(10, 20)).toBe(0);
    });
  });

  // =========================================================================
  // move()
  // =========================================================================
  describe('move', () => {
    it('should update position and invoke move_callback', () => {
      const mob = createMob();
      const cb = vi.fn();
      mob.onMove(cb);
      mob.move(50, 60);
      expect(mob.x).toBe(50);
      expect(mob.y).toBe(60);
      expect(cb).toHaveBeenCalledWith(mob);
    });

    it('should work without a move_callback', () => {
      const mob = createMob();
      mob.move(50, 60);
      expect(mob.x).toBe(50);
      expect(mob.y).toBe(60);
    });
  });

  // =========================================================================
  // updateHitPoints
  // =========================================================================
  describe('updateHitPoints', () => {
    it('should reset HP to value from Properties.getHitPoints', () => {
      const mob = createMob();
      mob.receiveDamage(50, 1);
      expect(mob.hitPoints).toBe(50);
      mob.updateHitPoints();
      expect(mob.hitPoints).toBe(100);
      expect(mob.maxHitPoints).toBe(100);
    });
  });
});
