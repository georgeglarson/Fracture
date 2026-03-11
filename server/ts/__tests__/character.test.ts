import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

// Stub Messages so we avoid pulling in the real module
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
  },
}));

// Deterministic orientation for tests
vi.mock('../utils', () => ({
  Utils: {
    randomOrientation: vi.fn().mockReturnValue(2), // DOWN
    random: vi.fn().mockReturnValue(0),
  },
  normalizeId: (id: string | number) =>
    typeof id === 'number' ? id : parseInt(id, 10),
}));

// ---------------------------------------------------------------------------
// Because Character is abstract we need a concrete subclass to test it.
// ---------------------------------------------------------------------------
import { Character } from '../character';

class TestCharacter extends Character {
  constructor(id: string | number, kind: number, x: number, y: number) {
    super(id, 'player', kind, x, y);
  }
  destroy(): void {
    // no-op for tests
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createChar(
  id: string | number = 1,
  kind = 1,
  x = 10,
  y = 20,
): TestCharacter {
  return new TestCharacter(id, kind, x, y);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Character', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Construction – extends Entity
  // =========================================================================
  describe('construction (extends Entity)', () => {
    it('should store id as a number', () => {
      const c = createChar('99');
      expect(c.id).toBe(99);
    });

    it('should store numeric id directly', () => {
      const c = createChar(7);
      expect(c.id).toBe(7);
    });

    it('should set type, kind, and position from constructor args', () => {
      const c = createChar(1, 5, 30, 40);
      expect(c.type).toBe('player');
      expect(c.kind).toBe(5);
      expect(c.x).toBe(30);
      expect(c.y).toBe(40);
    });

    it('should assign a random orientation', () => {
      // Utils.randomOrientation is mocked to return 2
      const c = createChar();
      expect(c.orientation).toBe(2);
    });

    it('should initialise hitPoints and maxHitPoints to 0', () => {
      const c = createChar();
      expect(c.hitPoints).toBe(0);
      expect(c.maxHitPoints).toBe(0);
    });

    it('should initialise target to null', () => {
      const c = createChar();
      expect(c.target).toBeNull();
    });

    it('should initialise attackers as an empty record', () => {
      const c = createChar();
      expect(Object.keys(c.attackers)).toHaveLength(0);
    });

    it('should default isAI to false', () => {
      const c = createChar();
      expect(c.isAI).toBe(false);
    });
  });

  // =========================================================================
  // HP management
  // =========================================================================
  describe('HP management', () => {
    describe('resetHitPoints', () => {
      it('should set both maxHitPoints and hitPoints', () => {
        const c = createChar();
        c.resetHitPoints(200);
        expect(c.maxHitPoints).toBe(200);
        expect(c.hitPoints).toBe(200);
      });

      it('should overwrite previously set HP values', () => {
        const c = createChar();
        c.resetHitPoints(100);
        c.resetHitPoints(300);
        expect(c.maxHitPoints).toBe(300);
        expect(c.hitPoints).toBe(300);
      });
    });

    describe('regenHealthBy', () => {
      it('should increase hitPoints by the given value', () => {
        const c = createChar();
        c.resetHitPoints(100);
        c.hitPoints = 60;
        c.regenHealthBy(20);
        expect(c.hitPoints).toBe(80);
      });

      it('should not exceed maxHitPoints', () => {
        const c = createChar();
        c.resetHitPoints(100);
        c.hitPoints = 90;
        c.regenHealthBy(50);
        expect(c.hitPoints).toBe(100);
      });

      it('should do nothing when already at full health', () => {
        const c = createChar();
        c.resetHitPoints(100);
        c.regenHealthBy(10);
        expect(c.hitPoints).toBe(100);
      });

      it('should heal exactly to max when value matches the deficit', () => {
        const c = createChar();
        c.resetHitPoints(100);
        c.hitPoints = 80;
        c.regenHealthBy(20);
        expect(c.hitPoints).toBe(100);
      });
    });

    describe('hasFullHealth', () => {
      it('should return true when hitPoints equals maxHitPoints', () => {
        const c = createChar();
        c.resetHitPoints(100);
        expect(c.hasFullHealth()).toBe(true);
      });

      it('should return false when hitPoints is below max', () => {
        const c = createChar();
        c.resetHitPoints(100);
        c.hitPoints = 99;
        expect(c.hasFullHealth()).toBe(false);
      });

      it('should return true when both are 0 (initial state)', () => {
        const c = createChar();
        expect(c.hasFullHealth()).toBe(true);
      });
    });

    describe('health', () => {
      it('should return a Health message with current hitPoints and isRegen=false', () => {
        const c = createChar();
        c.resetHitPoints(80);
        c.hitPoints = 55;
        const msg = c.health();
        expect(msg.serialize()).toEqual(['health', 55, false]);
      });
    });

    describe('regen', () => {
      it('should return a Health message with isRegen=true', () => {
        const c = createChar();
        c.resetHitPoints(80);
        const msg = c.regen();
        expect(msg.serialize()).toEqual(['health', 80, true]);
      });
    });
  });

  // =========================================================================
  // Attacker tracking
  // =========================================================================
  describe('attacker tracking', () => {
    function makeAttacker(id: number): TestCharacter {
      return createChar(id, 1, 0, 0);
    }

    describe('addAttacker', () => {
      it('should store the attacker keyed by normalised id', () => {
        const c = createChar();
        const attacker = makeAttacker(10);
        c.addAttacker(attacker);
        expect(c.attackers[10]).toBe(attacker);
      });

      it('should handle multiple distinct attackers', () => {
        const c = createChar();
        const a1 = makeAttacker(10);
        const a2 = makeAttacker(20);
        c.addAttacker(a1);
        c.addAttacker(a2);
        expect(Object.keys(c.attackers)).toHaveLength(2);
        expect(c.attackers[10]).toBe(a1);
        expect(c.attackers[20]).toBe(a2);
      });

      it('should silently ignore null/undefined', () => {
        const c = createChar();
        c.addAttacker(null as any);
        c.addAttacker(undefined as any);
        expect(Object.keys(c.attackers)).toHaveLength(0);
      });

      it('should overwrite when same id is added twice', () => {
        const c = createChar();
        const a1 = makeAttacker(10);
        const a2 = makeAttacker(10);
        c.addAttacker(a1);
        c.addAttacker(a2);
        expect(c.attackers[10]).toBe(a2);
        expect(Object.keys(c.attackers)).toHaveLength(1);
      });
    });

    describe('removeAttacker', () => {
      it('should delete the attacker from the record', () => {
        const c = createChar();
        const attacker = makeAttacker(10);
        c.addAttacker(attacker);
        c.removeAttacker(attacker);
        expect(c.attackers[10]).toBeUndefined();
        expect(Object.keys(c.attackers)).toHaveLength(0);
      });

      it('should not error when removing an attacker that was never added', () => {
        const c = createChar();
        const attacker = makeAttacker(99);
        expect(() => c.removeAttacker(attacker)).not.toThrow();
      });

      it('should silently ignore null/undefined', () => {
        const c = createChar();
        expect(() => c.removeAttacker(null as any)).not.toThrow();
        expect(() => c.removeAttacker(undefined as any)).not.toThrow();
      });

      it('should only remove the specified attacker', () => {
        const c = createChar();
        const a1 = makeAttacker(10);
        const a2 = makeAttacker(20);
        c.addAttacker(a1);
        c.addAttacker(a2);
        c.removeAttacker(a1);
        expect(c.attackers[10]).toBeUndefined();
        expect(c.attackers[20]).toBe(a2);
      });
    });

    describe('forEachAttacker', () => {
      it('should invoke callback for every attacker', () => {
        const c = createChar();
        const a1 = makeAttacker(10);
        const a2 = makeAttacker(20);
        const a3 = makeAttacker(30);
        c.addAttacker(a1);
        c.addAttacker(a2);
        c.addAttacker(a3);
        const seen: number[] = [];
        c.forEachAttacker((att) => seen.push(att.id));
        expect(seen.sort()).toEqual([10, 20, 30]);
      });

      it('should not invoke callback when there are no attackers', () => {
        const c = createChar();
        const cb = vi.fn();
        c.forEachAttacker(cb);
        expect(cb).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // setPosition / orientation
  // =========================================================================
  describe('setPosition', () => {
    it('should update x and y', () => {
      const c = createChar(1, 1, 0, 0);
      c.setPosition(50, 60);
      expect(c.x).toBe(50);
      expect(c.y).toBe(60);
    });
  });

  describe('orientation', () => {
    it('should be settable after construction', () => {
      const c = createChar();
      c.orientation = 4; // RIGHT
      expect(c.orientation).toBe(4);
    });
  });

  // =========================================================================
  // Target management (inherited but part of Character API)
  // =========================================================================
  describe('target management', () => {
    it('setTarget should store entity.id', () => {
      const c = createChar();
      c.setTarget({ id: 77 } as any);
      expect(c.target).toBe(77);
    });

    it('clearTarget should set target to null', () => {
      const c = createChar();
      c.setTarget({ id: 77 } as any);
      c.clearTarget();
      expect(c.target).toBeNull();
    });

    it('hasTarget should return current state', () => {
      const c = createChar();
      expect(c.hasTarget()).toBe(false);
      c.setTarget({ id: 1 } as any);
      expect(c.hasTarget()).toBe(true);
    });
  });

  // =========================================================================
  // _getBaseState serialisation
  // =========================================================================
  describe('_getBaseState serialisation', () => {
    it('should return [id, kind, x, y]', () => {
      const c = createChar(5, 3, 11, 22);
      const base = c._getBaseState();
      expect(base).toEqual([5, 3, 11, 22]);
    });

    it('should reflect position changes', () => {
      const c = createChar(1, 1, 0, 0);
      c.setPosition(99, 88);
      const base = c._getBaseState();
      expect(base).toEqual([1, 1, 99, 88]);
    });
  });

  // =========================================================================
  // getState serialisation (Character override)
  // =========================================================================
  describe('getState serialisation', () => {
    it('should include base state followed by orientation', () => {
      const c = createChar(5, 3, 11, 22);
      const state = c.getState();
      // [id, kind, x, y, orientation]
      expect(state.slice(0, 4)).toEqual([5, 3, 11, 22]);
      expect(state[4]).toBe(c.orientation);
    });

    it('should append target when set', () => {
      const c = createChar(5, 3, 11, 22);
      c.setTarget({ id: 42 } as any);
      const state = c.getState();
      expect(state).toEqual([5, 3, 11, 22, c.orientation, 42]);
    });

    it('should omit target when null', () => {
      const c = createChar(5, 3, 11, 22);
      const state = c.getState();
      expect(state).toHaveLength(5);
    });
  });

  // =========================================================================
  // attack() message
  // =========================================================================
  describe('attack', () => {
    it('should return an Attack message with id and target', () => {
      const c = createChar(7, 1, 0, 0);
      c.setTarget({ id: 55 } as any);
      const msg = c.attack();
      expect(msg.serialize()).toEqual(['attack', 7, 55]);
    });
  });
});
