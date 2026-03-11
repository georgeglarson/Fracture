/**
 * Tests for NemesisService
 * Covers: nemesis tracking, power scaling, revenge detection,
 *         player record management, mob promotion, power boost application
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted runs before vi.mock hoisting, so these are available in the factory
const { mockEventBusOn, mockEventBusEmit } = vi.hoisted(() => ({
  mockEventBusOn: vi.fn(),
  mockEventBusEmit: vi.fn(),
}));

vi.mock('../../../shared/ts/events/index.js', () => ({
  getServerEventBus: () => ({
    on: mockEventBusOn,
    emit: mockEventBusEmit,
  }),
}));

// Import after mocking -- this pulls in the singleton which calls the constructor
import { nemesisService, NemesisContext } from '../combat/nemesis.service';

// The broadcastNemesisEvent private method uses a dynamic require('../message')
// which cannot be easily intercepted by vi.mock. We replace the method with a
// spy so we can observe broadcasts without hitting the missing module.
const broadcastSpy = vi.fn();
(nemesisService as any).broadcastNemesisEvent = broadcastSpy;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal NemesisContext with mock functions.
 */
function createMockContext(overrides: Partial<NemesisContext> = {}): NemesisContext {
  return {
    pushBroadcast: vi.fn(),
    getMobName: vi.fn().mockReturnValue('Skeleton'),
    getMob: vi.fn().mockReturnValue({
      kind: 3,
      maxHitPoints: 100,
      hitPoints: 100,
    }),
    getPlayer: vi.fn().mockReturnValue({ id: 1, name: 'TestPlayer' }),
    ...overrides,
  };
}

/**
 * Simulate a player being killed by a mob by calling the event handler
 * that NemesisService registered for 'player:died'.
 */
function simulatePlayerDeath(playerId: number, playerName: string, killerId: number) {
  const playerDiedHandler = mockEventBusOn.mock.calls.find(
    (call) => call[0] === 'player:died'
  );
  if (!playerDiedHandler) throw new Error('player:died handler not registered');
  playerDiedHandler[1]({
    playerId,
    playerName,
    killerId,
    killerType: 3, // mob kind
  });
}

/**
 * Simulate a mob being killed by calling the event handler
 * that NemesisService registered for 'mob:killed'.
 */
function simulateMobKilled(mobId: number, killerId: number, killerName: string) {
  const mobKilledHandler = mockEventBusOn.mock.calls.find(
    (call) => call[0] === 'mob:killed'
  );
  if (!mobKilledHandler) throw new Error('mob:killed handler not registered');
  mobKilledHandler[1]({ mobId, killerId, killerName });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NemesisService', () => {
  let ctx: NemesisContext;

  beforeEach(() => {
    ctx = createMockContext();
    nemesisService.setContext(ctx);
    broadcastSpy.mockClear();
  });

  afterEach(() => {
    // Directly clear the private Maps on the singleton so each test starts clean.
    (nemesisService as any).nemeses = new Map();
    (nemesisService as any).playerNemeses = new Map();
  });

  // -----------------------------------------------------------------------
  // Event bus registration
  // -----------------------------------------------------------------------
  describe('event bus registration', () => {
    it('should register a handler for player:died', () => {
      const playerDiedCalls = mockEventBusOn.mock.calls.filter(
        (call) => call[0] === 'player:died'
      );
      expect(playerDiedCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should register a handler for mob:killed', () => {
      const mobKilledCalls = mockEventBusOn.mock.calls.filter(
        (call) => call[0] === 'mob:killed'
      );
      expect(mobKilledCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Nemesis creation and tracking
  // -----------------------------------------------------------------------
  describe('onPlayerKilledByMob (via player:died event)', () => {
    it('should create nemesis data on first player kill', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);

      const info = nemesisService.getNemesisInfo(50);
      expect(info).toBeDefined();
      expect(info!.playerKills).toBe(1);
      expect(info!.powerLevel).toBeCloseTo(1.15, 5);
      expect(info!.nemesisName).toBe(''); // not promoted yet
    });

    it('should increment kill counts on repeated kills', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(1, 'TestPlayer', 50);

      const info = nemesisService.getNemesisInfo(50);
      expect(info!.playerKills).toBe(2);
    });

    it('should track different victims in the nemesis data', () => {
      simulatePlayerDeath(1, 'Alice', 50);
      simulatePlayerDeath(2, 'Bob', 50);

      const info = nemesisService.getNemesisInfo(50);
      expect(info!.playerKills).toBe(2);
      expect(info!.victims.get(1)).toBe(1);
      expect(info!.victims.get(2)).toBe(1);
    });

    it('should do nothing when context is not set', () => {
      nemesisService.setContext(null as any);
      // Should not throw
      simulatePlayerDeath(1, 'TestPlayer', 50);
      expect(nemesisService.getNemesisInfo(50)).toBeUndefined();
      // Restore context for other tests
      nemesisService.setContext(ctx);
    });

    it('should do nothing when mob is not found', () => {
      const noMobCtx = createMockContext({ getMob: vi.fn().mockReturnValue(null) });
      nemesisService.setContext(noMobCtx);

      simulatePlayerDeath(1, 'TestPlayer', 50);
      expect(nemesisService.getNemesisInfo(50)).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Power scaling
  // -----------------------------------------------------------------------
  describe('power scaling', () => {
    it('should increase power level by 0.15 per kill', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      expect(nemesisService.getNemesisInfo(50)!.powerLevel).toBeCloseTo(1.15, 5);

      simulatePlayerDeath(2, 'Bob', 50);
      expect(nemesisService.getNemesisInfo(50)!.powerLevel).toBeCloseTo(1.30, 5);

      simulatePlayerDeath(3, 'Charlie', 50);
      expect(nemesisService.getNemesisInfo(50)!.powerLevel).toBeCloseTo(1.45, 5);
    });

    it('should cap power level at 3.0', () => {
      // 3.0 = 1.0 + (kills * 0.15) => kills = 2.0/0.15 ~= 14
      for (let i = 0; i < 20; i++) {
        simulatePlayerDeath(i + 1, `Player${i}`, 50);
      }

      const info = nemesisService.getNemesisInfo(50);
      expect(info!.powerLevel).toBe(3.0);
    });
  });

  // -----------------------------------------------------------------------
  // Nemesis promotion
  // -----------------------------------------------------------------------
  describe('nemesis promotion', () => {
    it('should NOT promote to nemesis before threshold (2 kills)', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);

      const info = nemesisService.getNemesisInfo(50);
      expect(info!.nemesisName).toBe('');
      expect(info!.title).toBe('');
    });

    it('should promote to named nemesis at exactly threshold kills', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(2, 'Bob', 50);

      const info = nemesisService.getNemesisInfo(50);
      expect(info!.nemesisName).not.toBe('');
      expect(info!.title).not.toBe('');
    });

    it('should not re-promote an already named nemesis', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(2, 'Bob', 50);

      const firstNemesisName = nemesisService.getNemesisInfo(50)!.nemesisName;

      simulatePlayerDeath(3, 'Charlie', 50);
      const secondNemesisName = nemesisService.getNemesisInfo(50)!.nemesisName;

      // Name should stay the same (not re-generated)
      expect(secondNemesisName).toBe(firstNemesisName);
    });
  });

  // -----------------------------------------------------------------------
  // Power boost application
  // -----------------------------------------------------------------------
  describe('applyPowerBoost', () => {
    it('should scale mob maxHitPoints by power level', () => {
      const mob = { kind: 3, maxHitPoints: 100, hitPoints: 100 };
      (ctx.getMob as ReturnType<typeof vi.fn>).mockReturnValue(mob);

      simulatePlayerDeath(1, 'TestPlayer', 50);

      // After 1 kill: powerLevel = 1.15
      expect(mob.maxHitPoints).toBe(Math.floor(100 * 1.15));
    });

    it('should preserve originalMaxHp across multiple boosts', () => {
      const mob = { kind: 3, maxHitPoints: 100, hitPoints: 100 } as any;
      (ctx.getMob as ReturnType<typeof vi.fn>).mockReturnValue(mob);

      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(2, 'Bob', 50);

      // After 2 kills: powerLevel = 1.30
      // originalMaxHp should still be 100
      expect(mob.originalMaxHp).toBe(100);
      expect(mob.maxHitPoints).toBe(Math.floor(100 * 1.30));
    });

    it('should set nemesisPowerLevel and nemesisName on mob', () => {
      const mob = { kind: 3, maxHitPoints: 100, hitPoints: 100 } as any;
      (ctx.getMob as ReturnType<typeof vi.fn>).mockReturnValue(mob);

      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(2, 'Bob', 50);

      expect(mob.nemesisPowerLevel).toBeCloseTo(1.30, 5);
      expect(mob.nemesisName).toBeTruthy(); // promoted after 2 kills
    });
  });

  // -----------------------------------------------------------------------
  // Player nemesis records
  // -----------------------------------------------------------------------
  describe('recordNemesisForPlayer / getPlayerNemeses', () => {
    it('should record a nemesis entry for the player on death', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);

      const records = nemesisService.getPlayerNemeses(1);
      expect(records.length).toBe(1);
      expect(records[0].nemesisMobId).toBe(50);
      expect(records[0].deathCount).toBe(1);
    });

    it('should increment deathCount on repeated deaths to same mob', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(1, 'TestPlayer', 50);

      const records = nemesisService.getPlayerNemeses(1);
      expect(records.length).toBe(1);
      expect(records[0].deathCount).toBe(3);
    });

    it('should track separate nemeses from different mobs', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(1, 'TestPlayer', 51);

      const records = nemesisService.getPlayerNemeses(1);
      expect(records.length).toBe(2);
    });

    it('should keep only top 5 nemeses sorted by deathCount', () => {
      // First, build 5 nemesis records with deathCounts 2..6
      for (let mobId = 50; mobId <= 54; mobId++) {
        const deathCount = (mobId - 50) + 2; // 2, 3, 4, 5, 6
        for (let d = 0; d < deathCount; d++) {
          simulatePlayerDeath(1, 'TestPlayer', mobId);
        }
      }
      expect(nemesisService.getPlayerNemeses(1).length).toBe(5);

      // Now add a 6th nemesis with only 1 death -- it should be evicted
      // because all existing records have deathCount >= 2
      simulatePlayerDeath(1, 'TestPlayer', 55);

      const records = nemesisService.getPlayerNemeses(1);
      expect(records.length).toBe(5);
      // Should be sorted by deathCount descending
      expect(records[0].deathCount).toBeGreaterThanOrEqual(records[1].deathCount);
      // mob55 with only 1 death should be evicted
      expect(records.find((r) => r.nemesisMobId === 55)).toBeUndefined();
    });

    it('should return empty array for unknown player', () => {
      expect(nemesisService.getPlayerNemeses(999)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Revenge detection
  // -----------------------------------------------------------------------
  describe('isRevengeKill / getRevengeMultipliers', () => {
    it('should detect a revenge kill when player has died to that mob', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);

      expect(nemesisService.isRevengeKill(1, 50)).toBe(true);
    });

    it('should not flag revenge for mobs that never killed the player', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);

      expect(nemesisService.isRevengeKill(1, 99)).toBe(false);
    });

    it('should not flag revenge for different players', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);

      expect(nemesisService.isRevengeKill(2, 50)).toBe(false);
    });

    it('should return boosted multipliers for revenge kill', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);

      const mult = nemesisService.getRevengeMultipliers(1, 50);
      expect(mult.xp).toBe(2.5);
      expect(mult.gold).toBe(2.0);
    });

    it('should return 1x multipliers for non-revenge kill', () => {
      const mult = nemesisService.getRevengeMultipliers(1, 99);
      expect(mult.xp).toBe(1.0);
      expect(mult.gold).toBe(1.0);
    });
  });

  // -----------------------------------------------------------------------
  // onMobKilled (via mob:killed event)
  // -----------------------------------------------------------------------
  describe('onMobKilled (via mob:killed event)', () => {
    it('should remove nemesis data when mob is killed', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      expect(nemesisService.getNemesisInfo(50)).toBeDefined();

      simulateMobKilled(50, 1, 'TestPlayer');
      expect(nemesisService.getNemesisInfo(50)).toBeUndefined();
    });

    it('should clean up player nemesis record when mob is killed by that player', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      expect(nemesisService.isRevengeKill(1, 50)).toBe(true);

      simulateMobKilled(50, 1, 'TestPlayer');
      expect(nemesisService.isRevengeKill(1, 50)).toBe(false);
    });

    it('should do nothing for untracked mobs', () => {
      // Should not throw
      simulateMobKilled(999, 1, 'TestPlayer');
      expect(nemesisService.getNemesisInfo(999)).toBeUndefined();
    });

    it('should call broadcastNemesisEvent when a named nemesis is killed', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(2, 'Bob', 50); // now promoted
      broadcastSpy.mockClear();

      simulateMobKilled(50, 1, 'TestPlayer');
      expect(broadcastSpy).toHaveBeenCalledWith(
        'NEMESIS_KILLED',
        50,
        expect.objectContaining({ nemesisName: expect.any(String) }),
        'TestPlayer',
        true // isRevenge because player 1 died to mob 50
      );
    });
  });

  // -----------------------------------------------------------------------
  // Player disconnect
  // -----------------------------------------------------------------------
  describe('onPlayerDisconnect', () => {
    it('should remove all nemesis records for the player', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(1, 'TestPlayer', 51);
      expect(nemesisService.getPlayerNemeses(1).length).toBe(2);

      nemesisService.onPlayerDisconnect(1);
      expect(nemesisService.getPlayerNemeses(1)).toEqual([]);
    });

    it('should not affect other players records', () => {
      simulatePlayerDeath(1, 'Alice', 50);
      simulatePlayerDeath(2, 'Bob', 51);

      nemesisService.onPlayerDisconnect(1);

      expect(nemesisService.getPlayerNemeses(1)).toEqual([]);
      expect(nemesisService.getPlayerNemeses(2).length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Broadcast behavior (via broadcastSpy)
  // -----------------------------------------------------------------------
  describe('broadcast behavior', () => {
    it('should not broadcast before nemesis promotion', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      // First kill: no name yet, no broadcast
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it('should call broadcastNemesisEvent when mob is first promoted', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(2, 'Bob', 50);
      // Second kill: promoted + broadcast
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(broadcastSpy).toHaveBeenCalledWith(
        'NEMESIS_POWER_UP',
        50,
        expect.objectContaining({ playerKills: 2 }),
        'Bob'
      );
    });

    it('should broadcast on subsequent kills after promotion', () => {
      simulatePlayerDeath(1, 'TestPlayer', 50);
      simulatePlayerDeath(2, 'Bob', 50); // promoted
      broadcastSpy.mockClear();

      simulatePlayerDeath(3, 'Charlie', 50); // already named
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
    });
  });
});
