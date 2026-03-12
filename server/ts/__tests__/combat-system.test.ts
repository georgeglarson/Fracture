/**
 * CombatSystem Bug Fix & Security Tests
 *
 * Specifically targets:
 *   1. XP calculated from mob.level (not armorLevel)
 *   2. chooseMobTarget is iterative (not recursive) — safe under large hate lists
 *   3. Double death prevention (isDead guard in handleHurtEntity)
 *   4. armorLevel falsy check (!=null passes for 0, reward distribution still fires)
 *   5. Party XP requires combat participation (combat tracker hasAggro filter)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports that transitively load them
// ---------------------------------------------------------------------------

vi.mock('../formulas.js', () => ({
  Formulas: {
    xpFromMob: vi.fn((level: number) => level * 10),
    goldFromMob: vi.fn((armorLevel: number) => armorLevel * 5),
  },
}));

vi.mock('../ai/venice.service.js', () => ({
  getVeniceService: vi.fn(() => null),
}));

vi.mock('../../../shared/ts/events/index.js', () => ({
  getServerEventBus: vi.fn(() => ({ emit: vi.fn(), on: vi.fn() })),
}));

vi.mock('../../../shared/ts/gametypes.js', () => ({
  Types: {
    getKindAsString: vi.fn(() => 'rat'),
    Entities: { BOSS: 999 },
  },
}));

vi.mock('../combat/kill-streak.service.js', () => ({
  getKillStreakService: vi.fn(() => ({
    recordKill: vi.fn(() => ({
      streak: 1,
      xpMultiplier: 1.0,
      goldMultiplier: 1.0,
      tier: null,
      isNewTier: false,
    })),
  })),
}));

// Mutable references so individual tests can override behaviour
const mockHasAggro = vi.fn(() => false);
const mockForEachPlayerHated = vi.fn();
const mockClearMobAggro = vi.fn();
const mockGetMobsAttacking = vi.fn(() => [] as number[]);
const mockClearPlayerAggro = vi.fn();

vi.mock('../combat/combat-tracker.js', () => ({
  getCombatTracker: vi.fn(() => ({
    hasAggro: mockHasAggro,
    forEachPlayerHated: mockForEachPlayerHated,
    clearMobAggro: mockClearMobAggro,
    getMobsAttacking: mockGetMobsAttacking,
    clearPlayerAggro: mockClearPlayerAggro,
  })),
}));

const mockIsInParty = vi.fn(() => false);
const mockGetMembersInRange = vi.fn(() => [] as number[]);
const mockCalculatePartyXpBonus = vi.fn(() => 1.0);

vi.mock('../party/index.js', () => ({
  PartyService: {
    getInstance: vi.fn(() => ({
      isInParty: mockIsInParty,
      getMembersInRange: mockGetMembersInRange,
      calculatePartyXpBonus: mockCalculatePartyXpBonus,
    })),
  },
}));

// ---------------------------------------------------------------------------
// Now import the module under test (after all vi.mock calls)
// ---------------------------------------------------------------------------

import { CombatSystem, Entity, WorldContext } from '../combat/combat-system.js';
import { Formulas } from '../formulas.js';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function createMockEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 1,
    type: 'mob',
    kind: 10,
    hitPoints: 100,
    level: 5,
    armorLevel: 2,
    weaponLevel: 1,
    x: 10,
    y: 10,
    ...overrides,
  };
}

function createMockWorld(overrides: Partial<WorldContext> = {}): WorldContext {
  return {
    getEntityById: vi.fn(),
    pushToPlayer: vi.fn(),
    pushToAdjacentGroups: vi.fn(),
    pushBroadcast: vi.fn(),
    getDroppedItem: vi.fn(() => null),
    handleItemDespawn: vi.fn(),
    removeEntity: vi.fn(),
    handleEntityGroupMembership: vi.fn(() => false),
    ...overrides,
  };
}

function createMockPlayer(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 1,
    type: 'player',
    kind: 1,
    name: 'TestPlayer',
    hitPoints: 100,
    armorLevel: 5,
    x: 10,
    y: 10,
    attackers: {},
    removeAttacker: vi.fn(),
    addAttacker: vi.fn(),
    removeHater: vi.fn(),
    addHater: vi.fn(),
    health: vi.fn(() => ({ serialize: () => [1, 100] })),
    grantXP: vi.fn(),
    grantGold: vi.fn(),
    handleKill: vi.fn(),
    checkKillAchievements: vi.fn(),
    despawn: vi.fn(() => ({ serialize: () => [3, 1] })),
    ...overrides,
  };
}

function createMockMob(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 100,
    type: 'mob',
    kind: 10,
    hitPoints: 50,
    level: 5,
    armorLevel: 3,
    group: 'zone1',
    x: 10,
    y: 10,
    increaseHateFor: vi.fn(),
    getHatedPlayerId: vi.fn(() => null),
    setTarget: vi.fn(),
    clearTarget: vi.fn(),
    forgetPlayer: vi.fn(),
    attack: vi.fn(() => ({ serialize: () => [2, 100] })),
    despawn: vi.fn(() => ({ serialize: () => [3, 100] })),
    drop: vi.fn((item: any) => ({ serialize: () => [4, item.id] })),
    grantXP: vi.fn(),
    grantGold: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CombatSystem — Bug Fix & Security Tests', () => {
  let combatSystem: CombatSystem;
  let world: WorldContext;
  let player: Entity;
  let mob: Entity;

  beforeEach(() => {
    vi.clearAllMocks();

    mockHasAggro.mockReturnValue(false);
    mockGetMobsAttacking.mockReturnValue([]);

    player = createMockPlayer();
    mob = createMockMob();

    world = createMockWorld({
      getEntityById: vi.fn((id) => {
        if (id === 1) return player;
        if (id === 100) return mob;
        return undefined;
      }),
    });

    combatSystem = new CombatSystem(world);
  });

  // =========================================================================
  // Bug Fix 1: XP calculated from mob.level (not armorLevel)
  // =========================================================================

  describe('Bug Fix 1 — XP uses mob.level, not armorLevel', () => {
    it('calls Formulas.xpFromMob with mob.level, not armorLevel', () => {
      mob = createMockMob({ id: 100, level: 25, armorLevel: 3, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      expect(Formulas.xpFromMob).toHaveBeenCalledWith(25);
      expect(Formulas.xpFromMob).not.toHaveBeenCalledWith(3);
    });

    it('passes mob.level=25 to xpFromMob (XP = 250 not 30 from armorLevel=3)', () => {
      mob = createMockMob({ id: 100, level: 25, armorLevel: 3, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // Mock: xpFromMob(level) = level * 10 → level 25 yields 250 XP
      expect(player.grantXP).toHaveBeenCalledWith(250);
    });

    it('does NOT award 30 XP (which would happen if armorLevel=3 were used instead)', () => {
      mob = createMockMob({ id: 100, level: 25, armorLevel: 3, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // If armorLevel were used: 3 * 10 = 30 — this must NOT happen
      expect(player.grantXP).not.toHaveBeenCalledWith(30);
    });

    it('calls Formulas.goldFromMob with mob.armorLevel (gold still uses armorLevel)', () => {
      mob = createMockMob({ id: 100, level: 25, armorLevel: 3, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      expect(Formulas.goldFromMob).toHaveBeenCalledWith(3);
    });

    it('grants correct gold from armorLevel', () => {
      mob = createMockMob({ id: 100, level: 25, armorLevel: 3, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // Mock: goldFromMob(armorLevel) = armorLevel * 5 → 3 * 5 = 15 gold
      expect(player.grantGold).toHaveBeenCalledWith(15);
    });
  });

  // =========================================================================
  // Bug Fix 2: chooseMobTarget is iterative, not recursive
  // =========================================================================

  describe('Bug Fix 2 — chooseMobTarget iterative loop (no stack overflow)', () => {
    it('skips phased players and selects the first non-phased target', () => {
      const phasedPlayer = createMockPlayer({ id: 10, isPhased: vi.fn(() => true) });
      const normalPlayer = createMockPlayer({ id: 11, isPhased: vi.fn(() => false), addAttacker: vi.fn() });

      mob.getHatedPlayerId = vi.fn()
        .mockReturnValueOnce(10)   // rank 1: phased
        .mockReturnValueOnce(11)   // rank 2: normal
        .mockReturnValue(null);

      world.getEntityById = vi.fn((id) => {
        if (id === 10) return phasedPlayer;
        if (id === 11) return normalPlayer;
        return undefined;
      });

      combatSystem.chooseMobTarget(mob);

      expect(mob.setTarget).toHaveBeenCalledWith(normalPlayer);
      expect(normalPlayer.addAttacker).toHaveBeenCalledWith(mob);
    });

    it('skips multiple consecutive phased players before finding a valid target', () => {
      const makePhasedPlayer = (id: number) =>
        createMockPlayer({ id, isPhased: vi.fn(() => true) });
      const validTarget = createMockPlayer({ id: 99, isPhased: vi.fn(() => false), addAttacker: vi.fn() });

      // 5 phased players, then the real target
      const getHated = vi.fn();
      [20, 21, 22, 23, 24].forEach((id, i) => getHated.mockReturnValueOnce(id));
      getHated.mockReturnValueOnce(99).mockReturnValue(null);
      mob.getHatedPlayerId = getHated;

      world.getEntityById = vi.fn((id) => {
        if (id >= 20 && id <= 24) return makePhasedPlayer(id);
        if (id === 99) return validTarget;
        return undefined;
      });

      combatSystem.chooseMobTarget(mob);

      expect(mob.setTarget).toHaveBeenCalledWith(validTarget);
    });

    it('returns without crashing when ALL hated players are phased', () => {
      const allPhased = [30, 31, 32].map(id =>
        createMockPlayer({ id, isPhased: vi.fn(() => true) })
      );

      const getHated = vi.fn()
        .mockReturnValueOnce(30)
        .mockReturnValueOnce(31)
        .mockReturnValueOnce(32)
        .mockReturnValue(null);
      mob.getHatedPlayerId = getHated;

      world.getEntityById = vi.fn((id) => {
        return allPhased.find(p => p.id === id) ?? undefined;
      });

      // Should not throw and should not set a target
      expect(() => combatSystem.chooseMobTarget(mob)).not.toThrow();
      expect(mob.setTarget).not.toHaveBeenCalled();
    });

    it('stops iterating at rank 20 even with unlimited phased players', () => {
      // Return a phased player for every rank up to 20
      const phasedPlayer = createMockPlayer({ isPhased: vi.fn(() => true) });
      mob.getHatedPlayerId = vi.fn(() => 999);
      world.getEntityById = vi.fn(() => phasedPlayer);

      combatSystem.chooseMobTarget(mob);

      // getHatedPlayerId should have been called at most 20 times (ranks 1–20)
      const callCount = (mob.getHatedPlayerId as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(20);
    });

    it('iterates sequentially through hate ranks (rank 1, 2, 3…)', () => {
      const getHated = vi.fn()
        .mockReturnValueOnce(50)   // rank 1 — phased
        .mockReturnValueOnce(51)   // rank 2 — valid
        .mockReturnValue(null);
      mob.getHatedPlayerId = getHated;

      const phasedPlayer = createMockPlayer({ id: 50, isPhased: vi.fn(() => true) });
      const target = createMockPlayer({ id: 51, isPhased: vi.fn(() => false), addAttacker: vi.fn() });
      world.getEntityById = vi.fn((id) => {
        if (id === 50) return phasedPlayer;
        if (id === 51) return target;
        return undefined;
      });

      combatSystem.chooseMobTarget(mob);

      // First call: rank 1 (default), second call: rank 2
      expect(getHated.mock.calls[0][0]).toBe(1);
      expect(getHated.mock.calls[1][0]).toBe(2);
    });
  });

  // =========================================================================
  // Bug Fix 3: Double death prevention (isDead flag set in handleHurtEntity)
  // =========================================================================

  describe('Bug Fix 3 — Double death prevention via isDead guard', () => {
    it('sets isDead=true on the entity when hitPoints reach 0', () => {
      mob.hitPoints = 0;

      combatSystem.handleHurtEntity(mob, player, 50);

      expect(mob.isDead).toBe(true);
    });

    it('sets isDead=true before calling removeEntity to prevent re-entry', () => {
      mob.hitPoints = 0;
      let isDeadAtRemoval = false;

      (world.removeEntity as ReturnType<typeof vi.fn>).mockImplementation(() => {
        isDeadAtRemoval = mob.isDead === true;
      });

      combatSystem.handleHurtEntity(mob, player, 50);

      expect(isDeadAtRemoval).toBe(true);
    });

    it('is a no-op for an already-dead entity (isDead=true)', () => {
      mob.hitPoints = 0;
      mob.isDead = true;

      combatSystem.handleHurtEntity(mob, player, 50);

      expect(world.removeEntity).not.toHaveBeenCalled();
      expect(world.pushToPlayer).not.toHaveBeenCalled();
    });

    it('does not call removeEntity twice when handleHurtEntity is called twice on same entity', () => {
      mob.hitPoints = 0;

      combatSystem.handleHurtEntity(mob, player, 50);   // first call — sets isDead, removes
      combatSystem.handleHurtEntity(mob, player, 50);   // second call — guarded by isDead

      expect(world.removeEntity).toHaveBeenCalledTimes(1);
    });

    it('does not grant XP twice for the same kill', () => {
      mob.hitPoints = 0;

      combatSystem.handleHurtEntity(mob, player, 50);
      combatSystem.handleHurtEntity(mob, player, 50);

      expect(player.grantXP).toHaveBeenCalledTimes(1);
    });

    it('does not send kill message twice for the same kill', () => {
      mob.hitPoints = 0;

      combatSystem.handleHurtEntity(mob, player, 50);
      const callsAfterFirstDeath = (world.pushToPlayer as ReturnType<typeof vi.fn>).mock.calls.length;

      // Second call is guarded by isDead — no additional pushToPlayer invocations
      combatSystem.handleHurtEntity(mob, player, 50);
      const callsAfterSecondAttempt = (world.pushToPlayer as ReturnType<typeof vi.fn>).mock.calls.length;

      expect(callsAfterSecondAttempt).toBe(callsAfterFirstDeath);
    });

    it('still processes a living entity even after a different entity was killed', () => {
      const mob2 = createMockMob({ id: 200, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => {
          if (id === 1) return player;
          if (id === 100) return mob;
          if (id === 200) return mob2;
          return undefined;
        }),
      });
      combatSystem = new CombatSystem(world);

      // Kill mob2 first
      combatSystem.handleHurtEntity(mob2, player, 50);
      expect(mob2.isDead).toBe(true);

      // mob is still alive — processing should not be blocked
      mob.hitPoints = 60;
      combatSystem.handleHurtEntity(mob, player, 10);

      // A living mob with positive HP should not be removed
      expect(world.removeEntity).toHaveBeenCalledTimes(1); // only mob2
    });
  });

  // =========================================================================
  // Bug Fix 4: armorLevel falsy check — armorLevel=0 still distributes rewards
  // =========================================================================

  describe('Bug Fix 4 — armorLevel=0 passes the != null guard', () => {
    it('distributes rewards when armorLevel is 0 (not skipped as falsy)', () => {
      mob = createMockMob({ id: 100, level: 5, armorLevel: 0, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // Rewards must be distributed even for armorLevel=0
      expect(player.grantXP).toHaveBeenCalled();
      expect(player.grantGold).toHaveBeenCalled();
    });

    it('calls Formulas.xpFromMob even when mob armorLevel is 0', () => {
      mob = createMockMob({ id: 100, level: 7, armorLevel: 0, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      expect(Formulas.xpFromMob).toHaveBeenCalledWith(7);
    });

    it('calls Formulas.goldFromMob with 0 when armorLevel is 0', () => {
      mob = createMockMob({ id: 100, level: 5, armorLevel: 0, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      expect(Formulas.goldFromMob).toHaveBeenCalledWith(0);
    });

    it('does NOT distribute rewards when armorLevel is null', () => {
      mob = createMockMob({ id: 100, level: 5, armorLevel: undefined, hitPoints: 0 });
      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      expect(player.grantXP).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Bug Fix 5: Party XP requires combat participation (hasAggro filter)
  // =========================================================================

  describe('Bug Fix 5 — Party XP only for combat participants', () => {
    beforeEach(() => {
      mob = createMockMob({ id: 100, level: 10, armorLevel: 2, hitPoints: 0 });
    });

    it('excludes idle party members who have no aggro on the mob', () => {
      // Party: player (id=1, attacker), member2 (id=2, participated), member3 (id=3, idle)
      const member2 = createMockPlayer({ id: 2, grantXP: vi.fn(), grantGold: vi.fn() });
      const member3 = createMockPlayer({ id: 3, grantXP: vi.fn(), grantGold: vi.fn() });

      mockIsInParty.mockReturnValue(true);
      // All three are nearby
      mockGetMembersInRange.mockReturnValue([1, 2, 3]);
      // hasAggro: mob (id=100) with player 2 — yes; player 3 — no
      mockHasAggro.mockImplementation((mobId: number, playerId: number) => {
        return playerId === 2;
      });
      mockCalculatePartyXpBonus.mockReturnValue(1.5);

      world = createMockWorld({
        getEntityById: vi.fn((id) => {
          if (id === 1) return player;
          if (id === 2) return member2;
          if (id === 3) return member3;
          if (id === 100) return mob;
          return undefined;
        }),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // Participants: player (attacker, always included) + member2 (has aggro) = 2
      // member3 should be excluded
      expect(member3.grantXP).not.toHaveBeenCalled();
    });

    it('grants XP to attacker even if only one party participant', () => {
      const member2 = createMockPlayer({ id: 2, grantXP: vi.fn() });

      mockIsInParty.mockReturnValue(true);
      mockGetMembersInRange.mockReturnValue([1, 2]);
      // member2 has no aggro → only attacker (id=1) qualifies
      mockHasAggro.mockReturnValue(false);

      world = createMockWorld({
        getEntityById: vi.fn((id) => {
          if (id === 1) return player;
          if (id === 2) return member2;
          if (id === 100) return mob;
          return undefined;
        }),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // Only 1 participant → falls back to solo reward distribution
      expect(player.grantXP).toHaveBeenCalled();
    });

    it('attacker is always included as participant regardless of hasAggro', () => {
      const member2 = createMockPlayer({ id: 2, grantXP: vi.fn() });

      mockIsInParty.mockReturnValue(true);
      mockGetMembersInRange.mockReturnValue([1, 2]);
      // hasAggro returns false for everyone — but attacker (id=1) is always included
      mockHasAggro.mockReturnValue(false);
      mockCalculatePartyXpBonus.mockReturnValue(1.5);

      world = createMockWorld({
        getEntityById: vi.fn((id) => {
          if (id === 1) return player;
          if (id === 2) return member2;
          if (id === 100) return mob;
          return undefined;
        }),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // Participants = [1] (attacker always included) → 1 participant → solo path
      expect(player.grantXP).toHaveBeenCalled();
    });

    it('distributes XP among all participants that have aggro', () => {
      const member2 = createMockPlayer({ id: 2, grantXP: vi.fn(), grantGold: vi.fn() });

      mockIsInParty.mockReturnValue(true);
      mockGetMembersInRange.mockReturnValue([1, 2]);
      // member2 has aggro
      mockHasAggro.mockImplementation((mobId: number, playerId: number) => playerId === 2);
      // bonus for 2 members
      mockCalculatePartyXpBonus.mockReturnValue(1.3);

      world = createMockWorld({
        getEntityById: vi.fn((id) => {
          if (id === 1) return player;
          if (id === 2) return member2;
          if (id === 100) return mob;
          return undefined;
        }),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // Both should receive XP (party share path: participants=2)
      expect(player.grantXP).toHaveBeenCalled();
      expect(member2.grantXP).toHaveBeenCalled();
    });

    it('gives gold only to the killer even in a party', () => {
      const member2 = createMockPlayer({ id: 2, grantXP: vi.fn(), grantGold: vi.fn() });

      mockIsInParty.mockReturnValue(true);
      mockGetMembersInRange.mockReturnValue([1, 2]);
      mockHasAggro.mockImplementation((mobId: number, playerId: number) => playerId === 2);
      mockCalculatePartyXpBonus.mockReturnValue(1.3);

      world = createMockWorld({
        getEntityById: vi.fn((id) => {
          if (id === 1) return player;
          if (id === 2) return member2;
          if (id === 100) return mob;
          return undefined;
        }),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // Gold goes only to the killer (attacker)
      expect(player.grantGold).toHaveBeenCalled();
      expect(member2.grantGold).not.toHaveBeenCalled();
    });

    it('falls back to solo rewards when not in a party', () => {
      mockIsInParty.mockReturnValue(false);

      world = createMockWorld({
        getEntityById: vi.fn((id) => (id === 1 ? player : id === 100 ? mob : undefined)),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      expect(player.grantXP).toHaveBeenCalledTimes(1);
      expect(player.grantGold).toHaveBeenCalledTimes(1);
    });

    it('uses calculatePartyXpBonus with participant count (not full nearby count)', () => {
      const member2 = createMockPlayer({ id: 2, grantXP: vi.fn() });
      const member3 = createMockPlayer({ id: 3, grantXP: vi.fn() });

      mockIsInParty.mockReturnValue(true);
      // 3 nearby, but only member2 participated (id=2 has aggro)
      mockGetMembersInRange.mockReturnValue([1, 2, 3]);
      mockHasAggro.mockImplementation((mobId: number, playerId: number) => playerId === 2);
      mockCalculatePartyXpBonus.mockReturnValue(1.3);

      world = createMockWorld({
        getEntityById: vi.fn((id) => {
          if (id === 1) return player;
          if (id === 2) return member2;
          if (id === 3) return member3;
          if (id === 100) return mob;
          return undefined;
        }),
      });
      combatSystem = new CombatSystem(world);

      combatSystem.handleHurtEntity(mob, player, 50);

      // Should be called with 2 (participants: 1 + 2), not 3 (all nearby)
      expect(mockCalculatePartyXpBonus).toHaveBeenCalledWith(2);
    });
  });
});
