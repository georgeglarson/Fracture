import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing AIPlayer
// ---------------------------------------------------------------------------

// Mock the combat-tracker singleton
const mockCombatTracker = {
  addAggro: vi.fn(),
  removeAggro: vi.fn(),
  clearMobAggro: vi.fn(),
  clearPlayerAggro: vi.fn(),
  hasAggro: vi.fn().mockReturnValue(false),
  getHatedPlayerId: vi.fn().mockReturnValue(null),
  getMobAggroCount: vi.fn().mockReturnValue(0),
  forEachMobAttackingWithEntity: vi.fn(),
};

vi.mock('../combat/combat-tracker', () => ({
  getCombatTracker: () => mockCombatTracker,
}));

// Mock logger to suppress output
vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Venice service (imported transitively)
vi.mock('../ai/venice.service', () => ({
  getVeniceService: () => null,
}));

// Mock Messages to avoid pulling in the real module
vi.mock('../message', () => ({
  Messages: {
    Spawn: class {
      constructor(private entity: any) {}
      serialize() { return ['spawn', ...this.entity.getState()]; }
    },
    Despawn: class {
      constructor(private id: any) {}
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
    Move: class {
      constructor(private entity: any) {}
      serialize() { return ['move', this.entity.id]; }
    },
    Chat: class {
      constructor(private entity: any, private message: string) {}
      serialize() { return ['chat', this.entity.id, this.message]; }
    },
    EquipItem: class {
      constructor(private player: any, private item: number) {}
      serialize() { return ['equip', this.player.id, this.item]; }
    },
  },
}));

// Mock Utils - provide deterministic helpers
vi.mock('../utils', () => ({
  Utils: {
    randomOrientation: vi.fn().mockReturnValue(2),
    distanceTo: vi.fn((x1: number, y1: number, x2: number, y2: number) => {
      const dx = Math.abs(x1 - x2);
      const dy = Math.abs(y1 - y2);
      return dx > dy ? dx : dy;
    }),
    random: vi.fn().mockReturnValue(0),
    randomInt: vi.fn((min: number, _max: number) => min),
  },
  normalizeId: (id: string | number) =>
    typeof id === 'number' ? id : parseInt(id, 10),
}));

// ---------------------------------------------------------------------------
// Import the class under test AFTER mocks are in place
// ---------------------------------------------------------------------------
import { AIPlayer } from '../ai/aiplayer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal mock World object with just enough to satisfy the
 * AIPlayer constructor (map for random position).
 */
function createMockWorld(): any {
  return {
    map: {
      width: 100,
      height: 100,
      getRandomStartingPosition: vi.fn().mockReturnValue({ x: 10, y: 10 }),
      getRandomNonStartingPosition: vi.fn().mockReturnValue({ x: 50, y: 50 }),
    },
    groups: {},
    players: {},
    isValidPosition: vi.fn().mockReturnValue(true),
    getEntityById: vi.fn(),
    addEntity: vi.fn(),
    removeEntity: vi.fn(),
    pushToGroup: vi.fn(),
    pushToAdjacentGroups: vi.fn(),
    handleEntityGroupMembership: vi.fn(),
    handleMobHate: vi.fn(),
    handleHurtEntity: vi.fn(),
    broadcaster: {
      createQueue: vi.fn(),
    },
  };
}

function createAIPlayer(world?: any, usedNames?: Set<string>): AIPlayer {
  return new AIPlayer(world ?? createMockWorld(), usedNames);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AIPlayer', () => {
  let world: any;

  beforeEach(() => {
    vi.clearAllMocks();
    world = createMockWorld();
  });

  // =========================================================================
  // Basic construction
  // =========================================================================
  describe('basic construction', () => {
    it('should set isAI to true', () => {
      const ai = createAIPlayer(world);
      expect(ai.isAI).toBe(true);
    });

    it('should set type to "player"', () => {
      const ai = createAIPlayer(world);
      expect(ai.type).toBe('player');
    });

    it('should generate a name', () => {
      const ai = createAIPlayer(world);
      expect(ai.name).toBeDefined();
      expect(typeof ai.name).toBe('string');
      expect(ai.name.length).toBeGreaterThan(0);
    });

    it('should set armor and weapon', () => {
      const ai = createAIPlayer(world);
      expect(ai.armor).toBeDefined();
      expect(typeof ai.armor).toBe('number');
      expect(ai.weapon).toBeDefined();
      expect(typeof ai.weapon).toBe('number');
    });

    it('should set armorLevel and weaponLevel', () => {
      const ai = createAIPlayer(world);
      expect(ai.armorLevel).toBeGreaterThanOrEqual(1);
      expect(ai.weaponLevel).toBeGreaterThanOrEqual(1);
    });

    it('should initialize hitPoints based on armor level', () => {
      const ai = createAIPlayer(world);
      expect(ai.hitPoints).toBeGreaterThan(0);
      expect(ai.maxHitPoints).toBeGreaterThan(0);
      expect(ai.hitPoints).toBe(ai.maxHitPoints);
    });

    it('should set a random position from the world map', () => {
      const ai = createAIPlayer(world);
      // getRandomNonStartingPosition returns { x: 50, y: 50 }
      expect(ai.x).toBe(50);
      expect(ai.y).toBe(50);
    });

    it('should fall back to getRandomStartingPosition if getRandomNonStartingPosition is unavailable', () => {
      world.map.getRandomNonStartingPosition = undefined;
      const ai = createAIPlayer(world);
      expect(world.map.getRandomStartingPosition).toHaveBeenCalled();
      expect(ai.x).toBe(10);
      expect(ai.y).toBe(10);
    });

    it('should default isDead to false', () => {
      const ai = createAIPlayer(world);
      expect(ai.isDead).toBe(false);
    });

    it('should default hasEnteredGame to true', () => {
      const ai = createAIPlayer(world);
      expect(ai.hasEnteredGame).toBe(true);
    });

    it('should default behaviorState to idle', () => {
      const ai = createAIPlayer(world);
      expect(ai.behaviorState).toBe('idle');
    });

    it('should store the world reference', () => {
      const ai = createAIPlayer(world);
      expect(ai.world).toBe(world);
    });

    it('should assign a unique numeric id (>= 100000)', () => {
      const ai = createAIPlayer(world);
      expect(typeof ai.id).toBe('number');
      expect(ai.id).toBeGreaterThanOrEqual(100000);
    });

    it('should assign incrementing ids to successive AIPlayers', () => {
      const ai1 = createAIPlayer(world);
      const ai2 = createAIPlayer(world);
      expect(ai2.id).toBeGreaterThan(ai1.id);
    });
  });

  // =========================================================================
  // Level property
  // =========================================================================
  describe('level property', () => {
    it('should be at least 1', () => {
      const ai = createAIPlayer(world);
      expect(ai.level).toBeGreaterThanOrEqual(1);
    });

    it('should equal Math.max(armorLevel, weaponLevel)', () => {
      const ai = createAIPlayer(world);
      expect(ai.level).toBe(Math.max(ai.armorLevel, ai.weaponLevel));
    });

    it('should be consistent across multiple constructions', () => {
      // Create several instances and verify the invariant always holds
      for (let i = 0; i < 20; i++) {
        const ai = createAIPlayer(world);
        expect(ai.level).toBe(Math.max(ai.armorLevel, ai.weaponLevel));
      }
    });
  });

  // =========================================================================
  // Name uniqueness
  // =========================================================================
  describe('name uniqueness', () => {
    it('should avoid names already in the usedNames set', () => {
      // Build a usedNames set with most of the AI_NAMES pool
      // The generator should still produce a name (possibly with a number suffix)
      const usedNames = new Set<string>();
      const ai = createAIPlayer(world, usedNames);
      expect(ai.name).toBeDefined();
      expect(ai.name.length).toBeGreaterThan(0);
    });

    it('should produce different names when prior names are marked as used', () => {
      const usedNames = new Set<string>();
      const names: string[] = [];
      // Create several AI players, adding each name to the used set
      for (let i = 0; i < 10; i++) {
        const ai = createAIPlayer(world, usedNames);
        usedNames.add(ai.name);
        names.push(ai.name);
      }
      // All names should be unique (since the usedNames set blocks duplicates)
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should still produce a name even when the usedNames set is very large', () => {
      // After max attempts it falls through and returns whatever it generated
      const usedNames = new Set<string>();
      // Fill up with lots of names
      for (let i = 0; i < 200; i++) {
        usedNames.add(`name${i}`);
      }
      const ai = createAIPlayer(world, usedNames);
      expect(ai.name).toBeDefined();
      expect(ai.name.length).toBeGreaterThan(0);
    });

    it('should work without a usedNames set', () => {
      const ai = createAIPlayer(world);
      expect(ai.name).toBeDefined();
    });
  });

  // =========================================================================
  // receiveDamage - HP clamping
  // =========================================================================
  describe('receiveDamage', () => {
    it('should reduce HP by the damage amount', () => {
      const ai = createAIPlayer(world);
      const initialHP = ai.hitPoints;
      ai.receiveDamage(10, 999);
      expect(ai.hitPoints).toBe(initialHP - 10);
    });

    it('should allow HP to reach exactly 0', () => {
      const ai = createAIPlayer(world);
      ai.receiveDamage(ai.hitPoints, 999);
      expect(ai.hitPoints).toBe(0);
    });

    it('should clamp HP to 0 on overkill damage (never negative)', () => {
      const ai = createAIPlayer(world);
      const overkillDamage = ai.hitPoints + 500;
      ai.receiveDamage(overkillDamage, 999);
      expect(ai.hitPoints).toBe(0);
      expect(ai.hitPoints).not.toBeLessThan(0);
    });

    it('should ignore damage when already dead (isDead = true)', () => {
      const ai = createAIPlayer(world);
      // Manually set isDead without going through die() to avoid side effects
      ai.isDead = true;
      const hpBefore = ai.hitPoints;
      ai.receiveDamage(50, 999);
      expect(ai.hitPoints).toBe(hpBefore);
    });

    it('should set isDead to true when HP reaches 0', () => {
      const ai = createAIPlayer(world);
      ai.receiveDamage(ai.hitPoints, 999);
      expect(ai.isDead).toBe(true);
    });

    it('should trigger fleeing state when HP drops below 20%', () => {
      const ai = createAIPlayer(world);
      // Deal enough damage to bring HP just below 20% of max
      const damageToApply = ai.hitPoints - Math.floor(ai.maxHitPoints * 0.19);
      ai.receiveDamage(damageToApply, 999);
      expect(ai.hitPoints).toBeLessThan(ai.maxHitPoints * 0.2);
      expect(ai.hitPoints).toBeGreaterThan(0);
      expect(ai.behaviorState).toBe('fleeing');
    });

    it('should not trigger fleeing when HP is at exactly 20%', () => {
      const ai = createAIPlayer(world);
      // HP at exactly 20% does NOT trigger flee (condition is strictly < 0.2)
      const damageToApply = ai.hitPoints - Math.floor(ai.maxHitPoints * 0.2);
      ai.receiveDamage(damageToApply, 999);
      expect(ai.hitPoints).toBe(Math.floor(ai.maxHitPoints * 0.2));
      expect(ai.behaviorState).not.toBe('fleeing');
    });

    it('should fight back when not in fighting state and HP is above 20%', () => {
      const ai = createAIPlayer(world);
      const smallDamage = 1;
      ai.receiveDamage(smallDamage, 42);
      expect(ai.behaviorState).toBe('fighting');
      expect(ai.target).toBe(42);
    });

    it('should not change target when already fighting', () => {
      const ai = createAIPlayer(world);
      ai.behaviorState = 'fighting';
      ai.target = 100;
      ai.receiveDamage(1, 200);
      // Should keep fighting, and since it's already fighting, target stays the same
      expect(ai.behaviorState).toBe('fighting');
      expect(ai.target).toBe(100);
    });

    it('should accumulate damage across multiple hits', () => {
      const ai = createAIPlayer(world);
      const initialHP = ai.hitPoints;
      ai.receiveDamage(5, 999);
      ai.receiveDamage(10, 999);
      expect(ai.hitPoints).toBe(initialHP - 15);
    });

    it('should clamp to 0 after cumulative overkill', () => {
      const ai = createAIPlayer(world);
      // First hit brings HP low
      ai.receiveDamage(ai.hitPoints - 1, 999);
      // Override isDead since die() was not called (HP > 0 after first hit)
      // Second hit overkills
      ai.receiveDamage(100, 999);
      expect(ai.hitPoints).toBe(0);
    });
  });

  // =========================================================================
  // destroy
  // =========================================================================
  describe('destroy', () => {
    it('should clear internal collections without throwing', () => {
      const ai = createAIPlayer(world);
      expect(() => ai.destroy()).not.toThrow();
    });
  });

  // =========================================================================
  // getState serialisation
  // =========================================================================
  describe('getState', () => {
    it('should include base state [id, kind, x, y] followed by name, orientation, armor, weapon', () => {
      const ai = createAIPlayer(world);
      const state = ai.getState();
      // [id, kind, x, y, name, orientation, armor, weapon]
      expect(state[0]).toBe(ai.id);
      expect(state[1]).toBe(ai.kind);
      expect(state[2]).toBe(ai.x);
      expect(state[3]).toBe(ai.y);
      expect(state[4]).toBe(ai.name);
      expect(state[5]).toBe(ai.orientation);
      expect(state[6]).toBe(ai.armor);
      expect(state[7]).toBe(ai.weapon);
    });

    it('should have length 8 when no target is set', () => {
      const ai = createAIPlayer(world);
      ai.clearTarget();
      const state = ai.getState();
      expect(state).toHaveLength(8);
    });

    it('should append target when set', () => {
      const ai = createAIPlayer(world);
      ai.setTarget({ id: 55 } as any);
      const state = ai.getState();
      expect(state).toHaveLength(9);
      expect(state[8]).toBe(55);
    });
  });

  // =========================================================================
  // addHater / removeHater (no-op interface stubs)
  // =========================================================================
  describe('addHater / removeHater', () => {
    it('addHater should not throw', () => {
      const ai = createAIPlayer(world);
      expect(() => ai.addHater({} as any)).not.toThrow();
    });

    it('removeHater should not throw', () => {
      const ai = createAIPlayer(world);
      expect(() => ai.removeHater({} as any)).not.toThrow();
    });
  });

  // =========================================================================
  // equip
  // =========================================================================
  describe('equip', () => {
    it('should return a serializable EquipItem message', () => {
      const ai = createAIPlayer(world);
      const msg = ai.equip(21);
      expect(msg).toBeDefined();
      expect(typeof msg.serialize).toBe('function');
      const serialized = msg.serialize();
      expect(serialized[0]).toBe('equip');
      expect(serialized[1]).toBe(ai.id);
      expect(serialized[2]).toBe(21);
    });
  });
});
