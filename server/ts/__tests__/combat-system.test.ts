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

// Track mock function for forEachPlayerHated
const mockForEachPlayerHated = vi.fn();
const mockClearMobAggro = vi.fn();

vi.mock('../combat/combat-tracker.js', () => ({
  getCombatTracker: () => ({
    forEachPlayerHated: mockForEachPlayerHated,
    clearMobAggro: mockClearMobAggro,
  }),
}));

import { CombatSystem, Entity, WorldContext, Message } from '../combat/combat-system';

describe('CombatSystem', () => {
  let combatSystem: CombatSystem;
  let mockWorld: WorldContext;
  let mockPlayer: Entity;
  let mockMob: Entity;

  beforeEach(() => {
    // Create mock entities
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
    it('should set mob target to most hated player', () => {
      mockMob.getHatedPlayerId = vi.fn(() => 1);
      mockPlayer.attackers = {};

      combatSystem.chooseMobTarget(mockMob);

      expect(mockPlayer.addAttacker).toHaveBeenCalledWith(mockMob);
      expect(mockMob.setTarget).toHaveBeenCalledWith(mockPlayer);
    });

    it('should broadcast attack when target is set', () => {
      mockMob.getHatedPlayerId = vi.fn(() => 1);
      mockPlayer.attackers = {};

      combatSystem.chooseMobTarget(mockMob);

      expect(mockWorld.pushToAdjacentGroups).toHaveBeenCalled();
    });

    it('should do nothing if no hated player exists', () => {
      mockMob.getHatedPlayerId = vi.fn(() => null);

      combatSystem.chooseMobTarget(mockMob);

      expect(mockPlayer.addAttacker).not.toHaveBeenCalled();
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
  });

  describe('handlePlayerVanish', () => {
    it('should redirect all attackers to next target', () => {
      const attackingMobs = [mockMob];
      mockPlayer.forEachAttacker = vi.fn((cb) => attackingMobs.forEach(cb));

      combatSystem.handlePlayerVanish(mockPlayer);

      expect(mockMob.clearTarget).toHaveBeenCalled();
      expect(mockMob.forgetPlayer).toHaveBeenCalledWith(1, 1000);
      expect(mockPlayer.removeAttacker).toHaveBeenCalledWith(mockMob);
    });

    it('should update entity group membership', () => {
      mockPlayer.forEachAttacker = vi.fn();

      combatSystem.handlePlayerVanish(mockPlayer);

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

      // Verify pushToPlayer was called with Kill message
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
    });

    it('should call handlePlayerVanish on death', () => {
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
  });
});
