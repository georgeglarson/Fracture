/**
 * Tests for CombatHandler
 * Covers: findRetargetCandidate, handleTargetDeath, autoRetaliate, handleCombatMusicOnAttack
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findRetargetCandidate,
  handleTargetDeath,
  autoRetaliate,
  handleCombatMusicOnAttack,
  CombatGameContext,
} from '../handlers/combat.handler';

function createMockPlayer(overrides: any = {}) {
  const attackers: Record<number, any> = overrides.attackers ?? {};
  return {
    target: overrides.target ?? null,
    isDying: overrides.isDying ?? false,
    isDead: overrides.isDead ?? false,
    disengage: vi.fn(),
    stop: vi.fn(),
    idle: vi.fn(),
    isAttacking: vi.fn().mockReturnValue(overrides.isAttacking ?? false),
    forEachAttacker: vi.fn((cb: (a: any) => void) => {
      Object.values(attackers).forEach(cb);
    }),
    getDistanceToEntity: vi.fn((entity: any) => entity._distance ?? 1),
  };
}

function createMockContext(overrides: any = {}): CombatGameContext {
  return {
    player: overrides.player ?? createMockPlayer(),
    playerId: overrides.playerId ?? 1,
    audioManager: {
      enterCombat: vi.fn(),
      exitCombat: vi.fn(),
      refreshCombat: vi.fn(),
      ...(overrides.audioManager ?? {}),
    },
    makePlayerAttack: vi.fn(),
    ...(overrides.ctx ?? {}),
  };
}

function mob(id: number, opts: any = {}) {
  return {
    id,
    isDead: opts.isDead ?? false,
    isDying: opts.isDying ?? false,
    _distance: opts.distance ?? 1,
  };
}

describe('findRetargetCandidate', () => {
  it('returns null when no attackers', () => {
    const player = createMockPlayer({ attackers: {} });
    expect(findRetargetCandidate(player)).toBeNull();
  });

  it('returns nearest living attacker', () => {
    const a = mob(10, { distance: 3 });
    const b = mob(11, { distance: 1 });
    const player = createMockPlayer({ attackers: { 10: a, 11: b } });
    expect(findRetargetCandidate(player)).toBe(b);
  });

  it('skips dead attackers', () => {
    const a = mob(10, { isDead: true, distance: 1 });
    const b = mob(11, { distance: 3 });
    const player = createMockPlayer({ attackers: { 10: a, 11: b } });
    expect(findRetargetCandidate(player)).toBe(b);
  });

  it('skips dying attackers', () => {
    const a = mob(10, { isDying: true, distance: 1 });
    const b = mob(11, { distance: 3 });
    const player = createMockPlayer({ attackers: { 10: a, 11: b } });
    expect(findRetargetCandidate(player)).toBe(b);
  });

  it('excludes specified id', () => {
    const a = mob(10, { distance: 1 });
    const b = mob(11, { distance: 2 });
    const player = createMockPlayer({ attackers: { 10: a, 11: b } });
    expect(findRetargetCandidate(player, 10)).toBe(b);
  });

  it('returns null when all dead', () => {
    const a = mob(10, { isDead: true });
    const b = mob(11, { isDying: true });
    const player = createMockPlayer({ attackers: { 10: a, 11: b } });
    expect(findRetargetCandidate(player)).toBeNull();
  });

  it('returns null when player is null', () => {
    expect(findRetargetCandidate(null)).toBeNull();
  });
});

describe('handleTargetDeath', () => {
  it('disengages, stops, and idles player', () => {
    const target = mob(10);
    const player = createMockPlayer({ target, attackers: {} });
    const ctx = createMockContext({ player });

    handleTargetDeath(ctx, 10);

    expect(player.disengage).toHaveBeenCalled();
    expect(player.stop).toHaveBeenCalled();
    expect(player.idle).toHaveBeenCalled();
  });

  it('retargets nearest attacker', () => {
    const target = mob(10);
    const next = mob(11, { distance: 2 });
    const player = createMockPlayer({ target, attackers: { 11: next } });
    const ctx = createMockContext({ player });

    handleTargetDeath(ctx, 10);

    expect(ctx.makePlayerAttack).toHaveBeenCalledWith(next);
    expect(ctx.audioManager.exitCombat).not.toHaveBeenCalled();
  });

  it('exits combat when no retarget candidate', () => {
    const target = mob(10);
    const player = createMockPlayer({ target, attackers: {} });
    const ctx = createMockContext({ player });

    handleTargetDeath(ctx, 10);

    expect(ctx.makePlayerAttack).not.toHaveBeenCalled();
    expect(ctx.audioManager.exitCombat).toHaveBeenCalled();
  });

  it('no-ops if player not targeting dead mob', () => {
    const target = mob(99);
    const player = createMockPlayer({ target, attackers: {} });
    const ctx = createMockContext({ player });

    handleTargetDeath(ctx, 10);

    expect(player.disengage).not.toHaveBeenCalled();
  });

  it('no-ops if player is null', () => {
    const ctx = createMockContext({ player: null });
    // Should not throw
    handleTargetDeath(ctx, 10);
    expect(ctx.makePlayerAttack).not.toHaveBeenCalled();
  });

  it('is idempotent — second call is a no-op after disengage clears target', () => {
    const target = mob(10);
    const player = createMockPlayer({ target, attackers: {} });
    // Simulate disengage clearing target
    player.disengage.mockImplementation(() => { player.target = null; });
    const ctx = createMockContext({ player });

    handleTargetDeath(ctx, 10);
    handleTargetDeath(ctx, 10);

    // disengage only called once — second call sees target is null
    expect(player.disengage).toHaveBeenCalledTimes(1);
  });
});

describe('autoRetaliate', () => {
  it('no-ops if already attacking', () => {
    const player = createMockPlayer({ isAttacking: true });
    const ctx = createMockContext({ player });

    autoRetaliate(ctx);

    expect(ctx.makePlayerAttack).not.toHaveBeenCalled();
  });

  it('no-ops if dying', () => {
    const player = createMockPlayer({ isDying: true });
    const ctx = createMockContext({ player });

    autoRetaliate(ctx);

    expect(ctx.makePlayerAttack).not.toHaveBeenCalled();
  });

  it('attacks nearest in range', () => {
    const a = mob(10, { distance: 2 });
    const b = mob(11, { distance: 1 });
    const player = createMockPlayer({ attackers: { 10: a, 11: b } });
    const ctx = createMockContext({ player });

    autoRetaliate(ctx);

    expect(ctx.makePlayerAttack).toHaveBeenCalledWith(b);
  });

  it('ignores attackers beyond melee range', () => {
    const a = mob(10, { distance: 5 });
    const player = createMockPlayer({ attackers: { 10: a } });
    const ctx = createMockContext({ player });

    autoRetaliate(ctx);

    expect(ctx.makePlayerAttack).not.toHaveBeenCalled();
  });

  it('no-ops if no attackers', () => {
    const player = createMockPlayer({ attackers: {} });
    const ctx = createMockContext({ player });

    autoRetaliate(ctx);

    expect(ctx.makePlayerAttack).not.toHaveBeenCalled();
  });

  it('no-ops if player is null', () => {
    const ctx = createMockContext({ player: null });
    autoRetaliate(ctx);
    expect(ctx.makePlayerAttack).not.toHaveBeenCalled();
  });
});

describe('handleCombatMusicOnAttack', () => {
  it('enters combat when player is attacker', () => {
    const ctx = createMockContext({ playerId: 1 });
    handleCombatMusicOnAttack(ctx, 1, 99);
    expect(ctx.audioManager.enterCombat).toHaveBeenCalled();
  });

  it('enters combat when player is target', () => {
    const ctx = createMockContext({ playerId: 1 });
    handleCombatMusicOnAttack(ctx, 99, 1);
    expect(ctx.audioManager.enterCombat).toHaveBeenCalled();
  });

  it('does not enter combat when player is uninvolved', () => {
    const ctx = createMockContext({ playerId: 1 });
    handleCombatMusicOnAttack(ctx, 50, 99);
    expect(ctx.audioManager.enterCombat).not.toHaveBeenCalled();
  });
});
