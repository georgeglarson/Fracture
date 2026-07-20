/**
 * Tests for RiftHandler
 * Covers: handleRiftEnter, handleRiftKill, handleRiftExit, handleRiftDeath,
 *         handleRiftLeaderboardRequest, isPlayerInRift, isRiftMob,
 *         getRiftModifierEffects, getRiftState, handleRiftDisconnect,
 *         position save/teleport/restore and leftover-mob cleanup.
 *
 * All client-bound messages are positional arrays matching the client
 * parsers in client/ts/network/gameclient.ts (receiveRift*).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';
import { RiftModifier, formatModifier } from '../../../shared/ts/rifts/rift-data';

// ---------------------------------------------------------------------------
// Mock the rift-manager singleton.
// vi.mock is hoisted; the factory closure captures `mockRiftManager` which is
// set in beforeEach before each test runs (same pattern as achievement.handler).
// ---------------------------------------------------------------------------
let mockRiftManager: Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../rifts/rift-manager.js', () => ({
  riftManager: new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string) {
      return mockRiftManager[prop];
    },
  }),
}));

import {
  RiftPlayerContext,
  handleRiftEnter,
  handleRiftKill,
  handleRiftExit,
  handleRiftDeath,
  handleRiftLeaderboardRequest,
  isPlayerInRift,
  isRiftMob,
  getRiftModifierEffects,
  getRiftState,
  handleRiftDisconnect,
} from '../player/rift.handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockCtx(overrides: Partial<RiftPlayerContext> = {}): RiftPlayerContext {
  return {
    id: 1,
    name: 'TestPlayer',
    level: 10,
    hitPoints: 100,
    maxHitPoints: 100,
    send: vi.fn(),
    broadcast: vi.fn(),
    addXP: vi.fn(),
    addGold: vi.fn(),
    getPosition: vi.fn(() => ({ x: 50, y: 220 })),
    teleport: vi.fn(),
    despawnMobs: vi.fn(),
    ...overrides,
  };
}

function makeActiveRun(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'rift_123_abc',
    playerId: 1,
    playerName: 'TestPlayer',
    depth: 1,
    modifiers: [RiftModifier.EMPOWERED],
    killCount: 0,
    startTime: Date.now(),
    currentFloorKills: 0,
    requiredKills: 7,
    isComplete: false,
    completedDepth: 0,
    ...overrides,
  };
}

function makeEndResult(overrides: Record<string, unknown> = {}) {
  return {
    run: makeActiveRun({ completedDepth: 3, killCount: 21 }),
    finalRewards: { xp: 405, gold: 192 },
    leaderboardRank: 5,
    spawnedMobIds: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockRiftManager = {
    startRun: vi.fn(),
    recordKill: vi.fn(),
    endRun: vi.fn(),
    getLeaderboard: vi.fn(),
    getPlayerRank: vi.fn(),
    isInRift: vi.fn(),
    isRiftMob: vi.fn(),
    getArenaCenter: vi.fn(() => ({ x: 20, y: 20 })),
    getModifierEffects: vi.fn(),
    getActiveRun: vi.fn(),
    cleanupDisconnectedPlayer: vi.fn(),
  };
});

// ==========================================================================
// handleRiftEnter
// ==========================================================================

describe('handleRiftEnter', () => {
  it('should start a rift run and send a positional RIFT_START message', () => {
    const ctx = createMockCtx();
    const run = makeActiveRun();
    mockRiftManager.startRun.mockReturnValue(run);

    const result = handleRiftEnter(ctx);

    expect(result).toBe(true);
    expect(mockRiftManager.startRun).toHaveBeenCalledWith(ctx.id, ctx.name, ctx.level);
    expect(ctx.send).toHaveBeenCalledTimes(1);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    // receiveRiftStart: runId, depth, modifiers, requiredKills, killCount
    expect(sentMsg[0]).toBe(Types.Messages.RIFT_START);
    expect(sentMsg[1]).toBe(run.runId);
    expect(sentMsg[2]).toBe(run.depth);
    expect(sentMsg[4]).toBe(run.requiredKills);
    expect(sentMsg[5]).toBe(0);
  });

  it('should include formatted modifier info in start message slot 3', () => {
    const ctx = createMockCtx();
    const run = makeActiveRun({ modifiers: [RiftModifier.EMPOWERED, RiftModifier.FRAGILE] });
    mockRiftManager.startRun.mockReturnValue(run);

    handleRiftEnter(ctx);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    const modifiers = sentMsg[3];
    expect(modifiers).toHaveLength(2);

    const expected0 = formatModifier(RiftModifier.EMPOWERED);
    expect(modifiers[0]).toEqual(expect.objectContaining({
      id: RiftModifier.EMPOWERED,
      name: expected0.name,
      description: expected0.description,
      color: expected0.color,
    }));

    const expected1 = formatModifier(RiftModifier.FRAGILE);
    expect(modifiers[1]).toEqual(expect.objectContaining({
      id: RiftModifier.FRAGILE,
      name: expected1.name,
      description: expected1.description,
      color: expected1.color,
    }));
  });

  it('should return false and send RIFT_END (success 0) when riftManager returns null', () => {
    const ctx = createMockCtx();
    mockRiftManager.startRun.mockReturnValue(null);

    const result = handleRiftEnter(ctx);

    expect(result).toBe(false);
    expect(ctx.send).toHaveBeenCalledTimes(1);
    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[0]).toBe(Types.Messages.RIFT_END);
    // Client treats data[1] === 1 as success; failure must be 0
    expect(sentMsg[1]).toBe(0);
    expect(typeof sentMsg[2]).toBe('string');
    // No teleport on failed enter
    expect(ctx.teleport).not.toHaveBeenCalled();
  });

  it('should pass correct player info to riftManager.startRun', () => {
    const ctx = createMockCtx({ id: 42, name: 'Alice', level: 25 });
    mockRiftManager.startRun.mockReturnValue(null);

    handleRiftEnter(ctx);

    expect(mockRiftManager.startRun).toHaveBeenCalledWith(42, 'Alice', 25);
  });

  it('should handle run with no modifiers', () => {
    const ctx = createMockCtx();
    const run = makeActiveRun({ modifiers: [] });
    mockRiftManager.startRun.mockReturnValue(run);

    handleRiftEnter(ctx);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[3]).toHaveLength(0);
  });

  it('should save the current position and teleport into the arena center', () => {
    const ctx = createMockCtx();
    mockRiftManager.startRun.mockReturnValue(makeActiveRun());

    handleRiftEnter(ctx);

    expect(ctx.getPosition).toHaveBeenCalled();
    expect(ctx.savedPosition).toEqual({ x: 50, y: 220 });
    expect(mockRiftManager.getArenaCenter).toHaveBeenCalled();
    expect(ctx.teleport).toHaveBeenCalledWith(20, 20);
  });
});

// ==========================================================================
// handleRiftKill
// ==========================================================================

describe('handleRiftKill', () => {
  it('should send positional RIFT_PROGRESS when kill does not advance floor', () => {
    const ctx = createMockCtx();
    mockRiftManager.recordKill.mockReturnValue({
      advanced: false,
      newDepth: 1,
      killCount: 3,
      requiredKills: 7,
    });

    handleRiftKill(ctx, 100);

    expect(mockRiftManager.recordKill).toHaveBeenCalledWith(ctx.id, 100);
    expect(ctx.send).toHaveBeenCalledTimes(1);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    // receiveRiftProgress: killCount, requiredKills
    expect(sentMsg[0]).toBe(Types.Messages.RIFT_PROGRESS);
    expect(sentMsg[1]).toBe(3);
    expect(sentMsg[2]).toBe(7);
  });

  it('should send RIFT_ADVANCE and award rewards when floor advances', () => {
    const ctx = createMockCtx();
    const rewards = { xp: 500, gold: 200, bonusDropChance: 0.04 };
    mockRiftManager.recordKill.mockReturnValue({
      advanced: true,
      newDepth: 2,
      killCount: 7,
      requiredKills: 9,
      rewards,
    });

    handleRiftKill(ctx, 200);

    expect(ctx.addXP).toHaveBeenCalledWith(rewards.xp, 'Rift Floor Completion');
    expect(ctx.addGold).toHaveBeenCalledWith(rewards.gold, 'Rift Floor Completion');

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    // receiveRiftAdvance: newDepth, killCount, requiredKills, rewards
    expect(sentMsg[0]).toBe(Types.Messages.RIFT_ADVANCE);
    expect(sentMsg[1]).toBe(2);
    expect(sentMsg[2]).toBe(0);
    expect(sentMsg[3]).toBe(9);
    expect(sentMsg[4]).toEqual(rewards);
  });

  it('should do nothing when recordKill returns null', () => {
    const ctx = createMockCtx();
    mockRiftManager.recordKill.mockReturnValue(null);

    handleRiftKill(ctx, 300);

    expect(ctx.send).not.toHaveBeenCalled();
    expect(ctx.addXP).not.toHaveBeenCalled();
    expect(ctx.addGold).not.toHaveBeenCalled();
  });

  it('should not award rewards if advanced but rewards is undefined', () => {
    const ctx = createMockCtx();
    mockRiftManager.recordKill.mockReturnValue({
      advanced: true,
      newDepth: 3,
      killCount: 14,
      requiredKills: 11,
      rewards: undefined,
    });

    handleRiftKill(ctx, 400);

    expect(ctx.addXP).not.toHaveBeenCalled();
    expect(ctx.addGold).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledTimes(1);
    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[4]).toBeNull();
  });

  it('should pass the correct mob id to recordKill', () => {
    const ctx = createMockCtx({ id: 55 });
    mockRiftManager.recordKill.mockReturnValue(null);

    handleRiftKill(ctx, 999);

    expect(mockRiftManager.recordKill).toHaveBeenCalledWith(55, 999);
  });
});

// ==========================================================================
// handleRiftExit
// ==========================================================================

describe('handleRiftExit', () => {
  it('should award full rewards and send RIFT_END with success 1', () => {
    const ctx = createMockCtx();
    const endResult = makeEndResult();
    mockRiftManager.endRun.mockReturnValue(endResult);

    handleRiftExit(ctx);

    expect(mockRiftManager.endRun).toHaveBeenCalledWith(ctx.id, 'exit');
    expect(ctx.addXP).toHaveBeenCalledWith(405, 'Rift Completion');
    expect(ctx.addGold).toHaveBeenCalledWith(192, 'Rift Completion');

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    // receiveRiftEnd: success, reason, completedDepth, totalKills, rewards, leaderboardRank
    expect(sentMsg[0]).toBe(Types.Messages.RIFT_END);
    expect(sentMsg[1]).toBe(1);
    expect(sentMsg[2]).toBe('exit');
    expect(sentMsg[3]).toBe(3);
    expect(sentMsg[4]).toBe(21);
    expect(sentMsg[5]).toEqual(endResult.finalRewards);
    expect(sentMsg[6]).toBe(5);
  });

  it('should send failure message when not in a rift', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(null);

    handleRiftExit(ctx);

    expect(ctx.addXP).not.toHaveBeenCalled();
    expect(ctx.addGold).not.toHaveBeenCalled();

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[0]).toBe(Types.Messages.RIFT_END);
    expect(sentMsg[1]).toBe(0);
    expect(sentMsg[2]).toBe('Not in a rift');
  });

  it('should include null leaderboardRank when run had no completed depth', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(makeEndResult({
      run: makeActiveRun({ completedDepth: 0, killCount: 2 }),
      finalRewards: { xp: 10, gold: 4 },
      leaderboardRank: null,
    }));

    handleRiftExit(ctx);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[6]).toBeNull();
  });

  it('should restore the saved position and clear it', () => {
    const ctx = createMockCtx();
    ctx.savedPosition = { x: 50, y: 220 };
    mockRiftManager.endRun.mockReturnValue(makeEndResult());

    handleRiftExit(ctx);

    expect(ctx.teleport).toHaveBeenCalledWith(50, 220);
    expect(ctx.savedPosition).toBeUndefined();
  });

  it('should despawn leftover rift mobs', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(makeEndResult({ spawnedMobIds: [611, 622] }));

    handleRiftExit(ctx);

    expect(ctx.despawnMobs).toHaveBeenCalledWith([611, 622]);
  });

  it('should not teleport when there is no saved position', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(makeEndResult());

    handleRiftExit(ctx);

    expect(ctx.teleport).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// handleRiftDeath
// ==========================================================================

describe('handleRiftDeath', () => {
  it('should award 50% rewards on death', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(makeEndResult({
      run: makeActiveRun({ completedDepth: 2, depth: 3, killCount: 15 }),
      finalRewards: { xp: 300, gold: 180 },
      leaderboardRank: 8,
    }));

    handleRiftDeath(ctx);

    expect(mockRiftManager.endRun).toHaveBeenCalledWith(ctx.id, 'death');
    expect(ctx.addXP).toHaveBeenCalledWith(150, 'Rift (Death)');
    expect(ctx.addGold).toHaveBeenCalledWith(90, 'Rift (Death)');
  });

  it('should send RIFT_END with success 0 and reason death', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(makeEndResult({
      run: makeActiveRun({ completedDepth: 2, depth: 3, killCount: 15 }),
      finalRewards: { xp: 300, gold: 180 },
      leaderboardRank: 8,
    }));

    handleRiftDeath(ctx);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[0]).toBe(Types.Messages.RIFT_END);
    expect(sentMsg[1]).toBe(0);
    expect(sentMsg[2]).toBe('death');
    expect(sentMsg[3]).toBe(2);
    expect(sentMsg[4]).toBe(15);
    expect(sentMsg[6]).toBe(8);
  });

  it('should floor death rewards to integers', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(makeEndResult({
      run: makeActiveRun({ completedDepth: 1, killCount: 3 }),
      finalRewards: { xp: 111, gold: 55 },
      leaderboardRank: null,
    }));

    handleRiftDeath(ctx);

    // 111 * 0.5 = 55.5 -> floor = 55
    expect(ctx.addXP).toHaveBeenCalledWith(55, 'Rift (Death)');
    // 55 * 0.5 = 27.5 -> floor = 27
    expect(ctx.addGold).toHaveBeenCalledWith(27, 'Rift (Death)');
  });

  it('should include halved rewards in RIFT_END payload slot 5', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(makeEndResult({
      run: makeActiveRun({ completedDepth: 1, killCount: 3 }),
      finalRewards: { xp: 200, gold: 100 },
      leaderboardRank: null,
    }));

    handleRiftDeath(ctx);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[5]).toEqual({ xp: 100, gold: 50 });
  });

  it('should do nothing when endRun returns null', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(null);

    handleRiftDeath(ctx);

    expect(ctx.send).not.toHaveBeenCalled();
    expect(ctx.addXP).not.toHaveBeenCalled();
    expect(ctx.addGold).not.toHaveBeenCalled();
  });

  it('should handle zero rewards gracefully', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(makeEndResult({
      run: makeActiveRun({ completedDepth: 0, killCount: 0 }),
      finalRewards: { xp: 0, gold: 0 },
      leaderboardRank: null,
    }));

    handleRiftDeath(ctx);

    expect(ctx.addXP).toHaveBeenCalledWith(0, 'Rift (Death)');
    expect(ctx.addGold).toHaveBeenCalledWith(0, 'Rift (Death)');
  });

  it('should handle odd reward values (test rounding)', () => {
    const ctx = createMockCtx();
    mockRiftManager.endRun.mockReturnValue(makeEndResult({
      run: makeActiveRun({ completedDepth: 1, killCount: 1 }),
      finalRewards: { xp: 1, gold: 1 },
      leaderboardRank: null,
    }));

    handleRiftDeath(ctx);

    // 1 * 0.5 = 0.5 -> floor = 0
    expect(ctx.addXP).toHaveBeenCalledWith(0, 'Rift (Death)');
    expect(ctx.addGold).toHaveBeenCalledWith(0, 'Rift (Death)');
  });

  it('should clear the saved position without teleporting (respawn flow relocates)', () => {
    const ctx = createMockCtx();
    ctx.savedPosition = { x: 50, y: 220 };
    mockRiftManager.endRun.mockReturnValue(makeEndResult({ spawnedMobIds: [611] }));

    handleRiftDeath(ctx);

    expect(ctx.teleport).not.toHaveBeenCalled();
    expect(ctx.savedPosition).toBeUndefined();
    expect(ctx.despawnMobs).toHaveBeenCalledWith([611]);
  });
});

// ==========================================================================
// handleRiftLeaderboardRequest
// ==========================================================================

describe('handleRiftLeaderboardRequest', () => {
  it('should send RIFT_LEADERBOARD with entries and player rank', () => {
    const ctx = createMockCtx({ name: 'Alice' });
    const leaderboardEntries = [
      { rank: 1, playerName: 'Bob', maxDepth: 10, totalKills: 50 },
      { rank: 2, playerName: 'Alice', maxDepth: 8, totalKills: 40 },
    ];
    mockRiftManager.getLeaderboard.mockReturnValue(leaderboardEntries);
    mockRiftManager.getPlayerRank.mockReturnValue(2);

    handleRiftLeaderboardRequest(ctx);

    expect(mockRiftManager.getLeaderboard).toHaveBeenCalledWith(10);
    expect(mockRiftManager.getPlayerRank).toHaveBeenCalledWith('Alice');

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    // receiveRiftLeaderboard: entries, playerRank
    expect(sentMsg[0]).toBe(Types.Messages.RIFT_LEADERBOARD);
    expect(sentMsg[1]).toEqual(leaderboardEntries);
    expect(sentMsg[2]).toBe(2);
  });

  it('should return null player rank when player has no entry', () => {
    const ctx = createMockCtx({ name: 'NewPlayer' });
    mockRiftManager.getLeaderboard.mockReturnValue([]);
    mockRiftManager.getPlayerRank.mockReturnValue(null);

    handleRiftLeaderboardRequest(ctx);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[2]).toBeNull();
  });

  it('should send empty entries when leaderboard is empty', () => {
    const ctx = createMockCtx();
    mockRiftManager.getLeaderboard.mockReturnValue([]);
    mockRiftManager.getPlayerRank.mockReturnValue(null);

    handleRiftLeaderboardRequest(ctx);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[1]).toEqual([]);
  });
});

// ==========================================================================
// isPlayerInRift
// ==========================================================================

describe('isPlayerInRift', () => {
  it('should return true when player is in a rift', () => {
    mockRiftManager.isInRift.mockReturnValue(true);

    expect(isPlayerInRift(42)).toBe(true);
    expect(mockRiftManager.isInRift).toHaveBeenCalledWith(42);
  });

  it('should return false when player is not in a rift', () => {
    mockRiftManager.isInRift.mockReturnValue(false);

    expect(isPlayerInRift(99)).toBe(false);
    expect(mockRiftManager.isInRift).toHaveBeenCalledWith(99);
  });
});

// ==========================================================================
// isRiftMob
// ==========================================================================

describe('isRiftMob', () => {
  it('should delegate to the rift manager', () => {
    mockRiftManager.isRiftMob.mockReturnValue(true);

    expect(isRiftMob(42, 611)).toBe(true);
    expect(mockRiftManager.isRiftMob).toHaveBeenCalledWith(42, 611);
  });

  it('should return false for mobs outside the run', () => {
    mockRiftManager.isRiftMob.mockReturnValue(false);

    expect(isRiftMob(42, 999)).toBe(false);
  });
});

// ==========================================================================
// getRiftModifierEffects
// ==========================================================================

describe('getRiftModifierEffects', () => {
  it('should return modifier effects from rift manager', () => {
    const effects = {
      playerDamageMult: 0.75,
      playerHpMult: 1.25,
      canHeal: false,
      speedMult: 1.3,
    };
    mockRiftManager.getModifierEffects.mockReturnValue(effects);

    const result = getRiftModifierEffects(10);

    expect(result).toEqual(effects);
    expect(mockRiftManager.getModifierEffects).toHaveBeenCalledWith(10);
  });

  it('should return default effects when player not in rift', () => {
    const defaultEffects = {
      playerDamageMult: 1,
      playerHpMult: 1,
      canHeal: true,
      speedMult: 1,
    };
    mockRiftManager.getModifierEffects.mockReturnValue(defaultEffects);

    const result = getRiftModifierEffects(999);

    expect(result).toEqual(defaultEffects);
  });
});

// ==========================================================================
// getRiftState
// ==========================================================================

describe('getRiftState', () => {
  it('should return rift state when player has an active run', () => {
    const activeRun = {
      runId: 'rift_abc',
      playerId: 1,
      playerName: 'TestPlayer',
      depth: 3,
      modifiers: [RiftModifier.FORTIFIED, RiftModifier.BLESSED],
      killCount: 12,
      startTime: Date.now(),
      currentFloorKills: 4,
      requiredKills: 11,
      isComplete: false,
      completedDepth: 2,
    };
    mockRiftManager.getActiveRun.mockReturnValue(activeRun);

    const state = getRiftState(1);

    expect(state).not.toBeNull();
    expect(state).toEqual({
      inRift: true,
      depth: 3,
      killCount: 4,
      requiredKills: 11,
      modifiers: [RiftModifier.FORTIFIED, RiftModifier.BLESSED],
    });
  });

  it('should return null when player has no active run', () => {
    mockRiftManager.getActiveRun.mockReturnValue(null);

    const state = getRiftState(999);

    expect(state).toBeNull();
  });

  it('should map currentFloorKills to killCount in returned state', () => {
    const activeRun = {
      depth: 5,
      modifiers: [],
      currentFloorKills: 7,
      requiredKills: 15,
    };
    mockRiftManager.getActiveRun.mockReturnValue(activeRun);

    const state = getRiftState(1);

    expect(state!.killCount).toBe(7);
  });

  it('should return inRift as true even at depth 1 with zero kills', () => {
    mockRiftManager.getActiveRun.mockReturnValue({
      depth: 1,
      modifiers: [],
      currentFloorKills: 0,
      requiredKills: 7,
    });

    const state = getRiftState(1);

    expect(state!.inRift).toBe(true);
    expect(state!.depth).toBe(1);
    expect(state!.killCount).toBe(0);
  });
});

// ==========================================================================
// handleRiftDisconnect
// ==========================================================================

describe('handleRiftDisconnect', () => {
  it('should call cleanupDisconnectedPlayer with the player id', () => {
    handleRiftDisconnect(42);

    expect(mockRiftManager.cleanupDisconnectedPlayer).toHaveBeenCalledWith(42);
  });

  it('should work even when called with a player not in a rift', () => {
    handleRiftDisconnect(999);

    expect(mockRiftManager.cleanupDisconnectedPlayer).toHaveBeenCalledWith(999);
  });

  it('should return the cleanup result so callers can despawn leftover mobs', () => {
    const endResult = makeEndResult({ spawnedMobIds: [611, 622] });
    mockRiftManager.cleanupDisconnectedPlayer.mockReturnValue(endResult);

    const result = handleRiftDisconnect(42);

    expect(result).toBe(endResult);
  });
});

// ==========================================================================
// Integration-style: full rift lifecycle
// ==========================================================================

describe('Rift lifecycle', () => {
  it('should handle a complete enter -> kill -> advance -> exit flow', () => {
    const ctx = createMockCtx({ id: 7, name: 'Hero', level: 15 });

    // 1. Enter rift
    const run = makeActiveRun({
      playerId: 7,
      playerName: 'Hero',
      modifiers: [RiftModifier.WEAKENED],
      requiredKills: 7,
    });
    mockRiftManager.startRun.mockReturnValue(run);
    const entered = handleRiftEnter(ctx);
    expect(entered).toBe(true);
    expect(ctx.teleport).toHaveBeenCalledWith(20, 20);

    vi.mocked(ctx.send).mockClear();

    // 2. Record a kill (no advance)
    mockRiftManager.recordKill.mockReturnValue({
      advanced: false,
      newDepth: 1,
      killCount: 1,
      requiredKills: 7,
    });
    handleRiftKill(ctx, 50);
    const progressMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(progressMsg[0]).toBe(Types.Messages.RIFT_PROGRESS);

    vi.mocked(ctx.send).mockClear();
    vi.mocked(ctx.addXP).mockClear();
    vi.mocked(ctx.addGold).mockClear();

    // 3. Record kill that advances floor
    const floorRewards = { xp: 250, gold: 100, bonusDropChance: 0.02 };
    mockRiftManager.recordKill.mockReturnValue({
      advanced: true,
      newDepth: 2,
      killCount: 7,
      requiredKills: 9,
      rewards: floorRewards,
    });
    handleRiftKill(ctx, 51);
    expect(ctx.addXP).toHaveBeenCalledWith(250, 'Rift Floor Completion');
    expect(ctx.addGold).toHaveBeenCalledWith(100, 'Rift Floor Completion');
    const advMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(advMsg[0]).toBe(Types.Messages.RIFT_ADVANCE);

    vi.mocked(ctx.send).mockClear();
    vi.mocked(ctx.addXP).mockClear();
    vi.mocked(ctx.addGold).mockClear();
    vi.mocked(ctx.teleport).mockClear();

    // 4. Exit rift — teleports back to the saved entry position
    mockRiftManager.endRun.mockReturnValue(makeEndResult({
      run: makeActiveRun({ completedDepth: 1, killCount: 8 }),
      finalRewards: { xp: 140, gold: 66 },
      leaderboardRank: 3,
      spawnedMobIds: [611],
    }));
    handleRiftExit(ctx);
    expect(ctx.addXP).toHaveBeenCalledWith(140, 'Rift Completion');
    expect(ctx.addGold).toHaveBeenCalledWith(66, 'Rift Completion');
    const endMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(endMsg[0]).toBe(Types.Messages.RIFT_END);
    expect(endMsg[1]).toBe(1);
    expect(ctx.teleport).toHaveBeenCalledWith(50, 220);
    expect(ctx.despawnMobs).toHaveBeenCalledWith([611]);
  });

  it('should handle enter -> die flow with partial rewards', () => {
    const ctx = createMockCtx({ id: 12, name: 'Victim', level: 5 });

    // Enter
    mockRiftManager.startRun.mockReturnValue(makeActiveRun({
      playerId: 12,
      playerName: 'Victim',
      modifiers: [],
    }));
    handleRiftEnter(ctx);

    vi.mocked(ctx.send).mockClear();
    vi.mocked(ctx.addXP).mockClear();
    vi.mocked(ctx.addGold).mockClear();

    // Die
    mockRiftManager.endRun.mockReturnValue(makeEndResult({
      run: makeActiveRun({ completedDepth: 0, depth: 1, killCount: 2 }),
      finalRewards: { xp: 10, gold: 4 },
      leaderboardRank: null,
    }));
    handleRiftDeath(ctx);

    expect(ctx.addXP).toHaveBeenCalledWith(5, 'Rift (Death)');
    expect(ctx.addGold).toHaveBeenCalledWith(2, 'Rift (Death)');

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[1]).toBe(0);
    expect(sentMsg[2]).toBe('death');
  });

  it('should handle failed enter followed by successful enter', () => {
    const ctx = createMockCtx();

    // First attempt fails
    mockRiftManager.startRun.mockReturnValue(null);
    const first = handleRiftEnter(ctx);
    expect(first).toBe(false);

    vi.mocked(ctx.send).mockClear();

    // Second attempt succeeds
    mockRiftManager.startRun.mockReturnValue(makeActiveRun());
    const second = handleRiftEnter(ctx);
    expect(second).toBe(true);

    const sentMsg = vi.mocked(ctx.send).mock.calls[0][0];
    expect(sentMsg[0]).toBe(Types.Messages.RIFT_START);
  });
});
