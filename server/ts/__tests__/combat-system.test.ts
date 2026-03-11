/**
 * Tests for CombatSystem
 * Covers: mob aggro, hate management, entity death, damage processing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../ai/venice.service.js', () => ({
  getVeniceService: () => null,
}));

vi.mock('../../../shared/ts/events/index.js', () => ({
  getServerEventBus: () => ({
    on: vi.fn(),
    emit: vi.fn(),
  }),
}));

vi.mock('../party/index.js', () => ({
  PartyService: {
    getInstance: () => ({
      isInParty: vi.fn(() => false),
      getMembersInRange: vi.fn(() => []),
      calculatePartyXpBonus: vi.fn(() => 1.0),
    }),
  },
}));

vi.mock('./kill-streak.service.js', () => ({
  getKillStreakService: () => ({
    recordKill: vi.fn(() => ({
      streak: 1,
      xpMultiplier: 1.0,
      goldMultiplier: 1.0,
      tier: null,
      isNewTier: false,
    })),
  }),
}));

// Track mock functions for CombatTracker
const mockForEachPlayerHated = vi.fn();
const mockClearMobAggro = vi.fn();
const mockGetMobsAttacking = vi.fn(() => [] as number[]);
const mockClearPlayerAggro = vi.fn();

vi.mock('../combat/combat-tracker.js', () => ({
  getCombatTracker: () => ({
    forEachPlayerHated: mockForEachPlayerHated,
    clearMobAggro: mockClearMobAggro,
    getMobsAttacking: mockGetMobsAttacking,
    clearPlayerAggro: mockClearPlayerAggro,
  }),
}));

import { CombatSystem, Entity, WorldContext, Message } from '../combat/combat-system';

describe('CombatSystem', () => {
  let combatSystem: CombatSystem;
  let mockWorld: WorldContext;
  let mockPlayer: Entity;
  let mockMob: Entity;

  beforeEach(() => {
    // Create mock entities - both at same position for melee range
    mockPlayer = {
      id: 1,
      type: 'player',
      kind: 1,
      name: 'TestPlayer',
      hitPoints: 100,
      armorLevel: 5,
      x: 100,
      y: 100,
      attackers: {},
      removeAttacker: vi.fn(),
      addAttacker: vi.fn(),
      removeHater: vi.fn(),
      addHater: vi.fn(),
      forEachAttacker: vi.fn(),
      health: vi.fn(() => ({ serialize: () => [1, 100] })),
      grantXP: vi.fn(),
      grantGold: vi.fn(),
      handleKill: vi.fn(),
      checkKillAchievements: vi.fn(),
    };

    mockMob = {
      id: 100,
      type: 'mob',
      kind: 10,
      hitPoints: 50,
      armorLevel: 3,
      group: 'zone1',
      target: null,
      x: 100, // Same position as player = within melee range
      y: 100,
      increaseHateFor: vi.fn(),
      getHatedPlayerId: vi.fn(() => 1),
      setTarget: vi.fn(),
      clearTarget: vi.fn(),
      forgetPlayer: vi.fn(),
      attack: vi.fn(() => ({ serialize: () => [2, 100] })),
      despawn: vi.fn(() => ({ serialize: () => [3, 100] })),
      drop: vi.fn((item) => ({ serialize: () => [4, item.id] })),
    };

    // Reset CombatTracker mocks
    mockForEachPlayerHated.mockReset();
    mockClearMobAggro.mockReset();
    mockGetMobsAttacking.mockReset().mockReturnValue([]);
    mockClearPlayerAggro.mockReset();

    // Create mock world context
    mockWorld = {
      getEntityById: vi.fn((id) => {
        if (id === 1) return mockPlayer;
        if (id === 100) return mockMob;
        return undefined;
      }),
      pushToPlayer: vi.fn(),
      pushToAdjacentGroups: vi.fn(),
      pushBroadcast: vi.fn(),
      getDroppedItem: vi.fn(() => null),
      handleItemDespawn: vi.fn(),
      removeEntity: vi.fn(),
      handleEntityGroupMembership: vi.fn(() => true),
    };

    combatSystem = new CombatSystem(mockWorld);
  });

  describe('handleMobHate', () => {
    it('should increase hate for mob towards player', () => {
      combatSystem.handleMobHate(100, 1, 10);

      expect(mockMob.increaseHateFor).toHaveBeenCalledWith(1, 10);
      expect(mockPlayer.addHater).toHaveBeenCalledWith(mockMob);
    });

    it('should trigger target selection for living mobs', () => {
      mockMob.hitPoints = 50;
      combatSystem.handleMobHate(100, 1, 10);

      expect(mockMob.getHatedPlayerId).toHaveBeenCalled();
    });

    it('should not trigger target selection for dead mobs', () => {
      mockMob.hitPoints = 0;
      combatSystem.handleMobHate(100, 1, 10);

      expect(mockMob.getHatedPlayerId).not.toHaveBeenCalled();
    });
  });

  describe('chooseMobTarget', () => {
    it('should set mob target and register attacker when in melee range', () => {
      mockMob.getHatedPlayerId = vi.fn(() => 1);
      mockPlayer.attackers = {};

      combatSystem.chooseMobTarget(mockMob);

      expect(mockMob.setTarget).toHaveBeenCalledWith(mockPlayer);
      expect(mockPlayer.addAttacker).toHaveBeenCalledWith(mockMob);
    });

    it('should broadcast attack when in melee range', () => {
      mockMob.getHatedPlayerId = vi.fn(() => 1);
      mockPlayer.attackers = {};

      combatSystem.chooseMobTarget(mockMob);

      expect(mockWorld.pushToAdjacentGroups).toHaveBeenCalled();
    });

    it('should register attacker and broadcast attack even when out of melee range', () => {
      mockMob.getHatedPlayerId = vi.fn(() => 1);
      mockMob.x = 0;  // Far from player at (100, 100)
      mockMob.y = 0;
      mockPlayer.attackers = {};

      combatSystem.chooseMobTarget(mockMob);

      expect(mockMob.setTarget).toHaveBeenCalledWith(mockPlayer);
      expect(mockPlayer.addAttacker).toHaveBeenCalledWith(mockMob);
      // Attack always broadcast so client knows mob is hostile
      expect(mockWorld.pushToAdjacentGroups).toHaveBeenCalled();
    });

    it('should switch target when mob.target differs from chosen player', () => {
      // Mob is currently targeting player 2, but chooseMobTarget picks player 1
      const player2 = { ...mockPlayer, id: 2, removeAttacker: vi.fn(), addAttacker: vi.fn() };
      mockWorld.getEntityById = vi.fn((id) => {
        if (id === 1) return mockPlayer;
        if (id === 2) return player2;
        if (id === 100) return mockMob;
        return undefined;
      });
      mockMob.target = 2; // Currently targeting player 2
      mockMob.getHatedPlayerId = vi.fn(() => 1); // Hate rank picks player 1

      combatSystem.chooseMobTarget(mockMob);

      // Should clear old link (remove mob from player 2's attackers)
      expect(player2.removeAttacker).toHaveBeenCalledWith(mockMob);
      // Should set new target to player 1
      expect(mockMob.setTarget).toHaveBeenCalledWith(mockPlayer);
      expect(mockPlayer.addAttacker).toHaveBeenCalledWith(mockMob);
    });

    it('should not re-register when mob already targets the chosen player', () => {
      mockMob.target = 1; // Already targeting player 1
      mockMob.getHatedPlayerId = vi.fn(() => 1);

      combatSystem.chooseMobTarget(mockMob);

      // Should NOT re-set target or re-add attacker
      expect(mockMob.setTarget).not.toHaveBeenCalled();
      expect(mockPlayer.addAttacker).not.toHaveBeenCalled();
    });

    it('should do nothing if no hated player exists', () => {
      mockMob.getHatedPlayerId = vi.fn(() => null);

      combatSystem.chooseMobTarget(mockMob);

      expect(mockPlayer.addAttacker).not.toHaveBeenCalled();
    });

    it('should skip phased players and try next target', () => {
      mockPlayer.isPhased = vi.fn(() => true);
      mockMob.getHatedPlayerId = vi.fn()
        .mockReturnValueOnce(1)   // First call: phased player
        .mockReturnValueOnce(null); // Second call: no one else

      combatSystem.chooseMobTarget(mockMob);

      expect(mockMob.setTarget).not.toHaveBeenCalled();
    });

    it('should not target during stun', () => {
      mockMob.stunUntil = Date.now() + 10000; // Stunned for 10s

      combatSystem.chooseMobTarget(mockMob);

      expect(mockMob.getHatedPlayerId).not.toHaveBeenCalled();
    });
  });

  describe('clearMobAggroLink', () => {
    it('should remove mob from player attackers', () => {
      mockMob.target = 1;

      combatSystem.clearMobAggroLink(mockMob);

      expect(mockPlayer.removeAttacker).toHaveBeenCalledWith(mockMob);
    });

    it('should do nothing if mob has no target', () => {
      mockMob.target = undefined;

      combatSystem.clearMobAggroLink(mockMob);

      expect(mockPlayer.removeAttacker).not.toHaveBeenCalled();
    });
  });

  describe('clearMobHateLinks', () => {
    it('should remove mob from all hated players via CombatTracker', () => {
      const player2 = { ...mockPlayer, id: 2, removeHater: vi.fn() };
      mockWorld.getEntityById = vi.fn((id) => {
        if (id === 1) return mockPlayer;
        if (id === 2) return player2;
        return undefined;
      });

      // Mock CombatTracker to iterate over player IDs 1 and 2
      mockForEachPlayerHated.mockImplementation((mobId, callback) => {
        callback(1);
        callback(2);
      });

      combatSystem.clearMobHateLinks(mockMob);

      expect(mockForEachPlayerHated).toHaveBeenCalledWith(100, expect.any(Function));
      expect(mockPlayer.removeHater).toHaveBeenCalledWith(mockMob);
      expect(player2.removeHater).toHaveBeenCalledWith(mockMob);
      expect(mockClearMobAggro).toHaveBeenCalledWith(100);
    });
  });

  describe('handleHurtEntity', () => {
    it('should send health update to hurt player', () => {
      mockPlayer.hitPoints = 50;

      combatSystem.handleHurtEntity(mockPlayer);

      expect(mockWorld.pushToPlayer).toHaveBeenCalledWith(mockPlayer, expect.anything());
    });

    it('should send damage notification to attacker for mob damage', () => {
      mockMob.hitPoints = 30;

      combatSystem.handleHurtEntity(mockMob, mockPlayer, 20);

      expect(mockWorld.pushToPlayer).toHaveBeenCalled();
    });

    it('should trigger death when hitPoints reach 0', () => {
      mockMob.hitPoints = 0;

      combatSystem.handleHurtEntity(mockMob, mockPlayer, 50);

      expect(mockWorld.removeEntity).toHaveBeenCalledWith(mockMob);
    });

    it('should skip already-dead entities (isDead flag)', () => {
      mockMob.hitPoints = 0;
      mockMob.isDead = true;

      combatSystem.handleHurtEntity(mockMob, mockPlayer, 50);

      expect(mockWorld.removeEntity).not.toHaveBeenCalled();
    });
  });

  describe('handlePlayerVanish', () => {
    it('should clear aggro for all mobs attacking the player via CombatTracker', () => {
      mockGetMobsAttacking.mockReturnValue([100]);

      combatSystem.handlePlayerVanish(mockPlayer);

      expect(mockGetMobsAttacking).toHaveBeenCalledWith(1);
      expect(mockMob.clearTarget).toHaveBeenCalled();
      expect(mockMob.forgetPlayer).toHaveBeenCalledWith(1, 1000);
    });

    it('should clear player aggro in CombatTracker and update groups', () => {
      mockGetMobsAttacking.mockReturnValue([]);

      combatSystem.handlePlayerVanish(mockPlayer);

      expect(mockClearPlayerAggro).toHaveBeenCalledWith(1);
      expect(mockWorld.handleEntityGroupMembership).toHaveBeenCalledWith(mockPlayer);
    });
  });

  describe('broadcastAttacker', () => {
    it('should broadcast attack to adjacent groups', () => {
      combatSystem.broadcastAttacker(mockMob);

      expect(mockWorld.pushToAdjacentGroups).toHaveBeenCalledWith(
        'zone1',
        expect.anything(),
        100
      );
    });

    it('should call attack callback if set', () => {
      const attackCallback = vi.fn();
      combatSystem.onEntityAttack(attackCallback);

      combatSystem.broadcastAttacker(mockMob);

      expect(attackCallback).toHaveBeenCalledWith(mockMob);
    });

    it('should do nothing for entity without group', () => {
      mockMob.group = undefined;

      combatSystem.broadcastAttacker(mockMob);

      expect(mockWorld.pushToAdjacentGroups).not.toHaveBeenCalled();
    });
  });

  describe('mob death handling', () => {
    beforeEach(() => {
      mockMob.hitPoints = 0;
    });

    it('should set isDead flag immediately on death', () => {
      combatSystem.handleHurtEntity(mockMob, mockPlayer, 50);

      expect((mockMob as any).isDead).toBe(true);
    });

    it('should send kill message to attacker', () => {
      combatSystem.handleHurtEntity(mockMob, mockPlayer, 50);

      expect(mockWorld.pushToPlayer).toHaveBeenCalled();
    });

    it('should broadcast despawn to adjacent groups', () => {
      combatSystem.handleHurtEntity(mockMob, mockPlayer, 50);

      expect(mockWorld.pushToAdjacentGroups).toHaveBeenCalled();
    });

    it('should remove entity from world', () => {
      combatSystem.handleHurtEntity(mockMob, mockPlayer, 50);

      expect(mockWorld.removeEntity).toHaveBeenCalledWith(mockMob);
    });

    it('should trigger kill handling on attacker', () => {
      combatSystem.handleHurtEntity(mockMob, mockPlayer, 50);

      expect(mockPlayer.handleKill).toHaveBeenCalled();
    });

    it('should check kill achievements', () => {
      combatSystem.handleHurtEntity(mockMob, mockPlayer, 50);

      expect(mockPlayer.checkKillAchievements).toHaveBeenCalledWith(mockMob.kind);
    });
  });

  describe('player death handling', () => {
    beforeEach(() => {
      mockPlayer.hitPoints = 0;
      mockPlayer.group = 'zone1';
      mockPlayer.despawn = vi.fn(() => ({ serialize: () => [3, 1] }));
      mockPlayer.forEachAttacker = vi.fn();
      mockGetMobsAttacking.mockReturnValue([]);
    });

    it('should call handlePlayerVanish on death (updates group membership)', () => {
      combatSystem.handleHurtEntity(mockPlayer, mockMob, 100);

      expect(mockWorld.handleEntityGroupMembership).toHaveBeenCalledWith(mockPlayer);
    });

    it('should broadcast player despawn', () => {
      combatSystem.handleHurtEntity(mockPlayer, mockMob, 100);

      expect(mockWorld.pushToAdjacentGroups).toHaveBeenCalled();
    });

    it('should remove player from world', () => {
      combatSystem.handleHurtEntity(mockPlayer, mockMob, 100);

      expect(mockWorld.removeEntity).toHaveBeenCalledWith(mockPlayer);
    });

    it('should clear player aggro in CombatTracker', () => {
      combatSystem.handleHurtEntity(mockPlayer, mockMob, 100);

      expect(mockClearPlayerAggro).toHaveBeenCalledWith(1);
    });
  });

  describe('isMobStunned', () => {
    it('should return false for unstunned mobs', () => {
      expect(combatSystem.isMobStunned(mockMob)).toBe(false);
    });

    it('should return true for actively stunned mobs', () => {
      mockMob.stunUntil = Date.now() + 10000;
      expect(combatSystem.isMobStunned(mockMob)).toBe(true);
    });

    it('should return false when stun has expired', () => {
      mockMob.stunUntil = Date.now() - 1000;
      expect(combatSystem.isMobStunned(mockMob)).toBe(false);
    });
  });
});
