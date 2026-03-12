/**
 * Tests for SkillHandler
 * Covers: sendSkillInit, handleSkillUse (all skill types), cooldown enforcement,
 * level requirements, consumePowerStrikeBuff, checkSkillUnlock, edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';
import {
  SkillId,
  SKILLS,
  createInitialSkillState,
  PlayerSkillState,
} from '../../../shared/ts/skills';
import {
  SkillPlayerContext,
  sendSkillInit,
  handleSkillUse,
  consumePowerStrikeBuff,
  checkSkillUnlock,
} from '../player/skill.handler';

/**
 * Create a mock player context with sensible defaults.
 * Every method is a vi.fn() so tests can assert calls.
 */
function createMockContext(overrides: Partial<SkillPlayerContext> = {}): SkillPlayerContext {
  const skillState = createInitialSkillState();
  const mobs: any[] = [];
  const mobMap = new Map<number, any>();

  const ctx: SkillPlayerContext = {
    id: 1,
    name: 'TestPlayer',
    x: 100,
    y: 100,
    orientation: 1,
    level: 20,           // High enough to unlock all skills by default
    weapon: 10,
    armor: 5,
    weaponLevel: 10,
    hitPoints: 100,
    maxHitPoints: 100,
    send: vi.fn(),
    broadcast: vi.fn(),
    broadcastToZone: vi.fn(),
    setPosition: vi.fn(),
    getSkillState: vi.fn(() => skillState),
    getWorld: vi.fn(() => ({
      isValidPosition: vi.fn(() => true),
      forEachMob: vi.fn((cb: (mob: any) => void) => mobs.forEach(cb)),
      handleMobHate: vi.fn(),
      handleHurtEntity: vi.fn(),
      getEntityById: vi.fn((id: number) => mobMap.get(id) ?? null),
    })),
    getCombatTracker: vi.fn(() => ({
      getMobsAttacking: vi.fn((playerId: number) => {
        // Return IDs of mobs that target this player
        return mobs.filter(m => m.target === playerId).map(m => m.id);
      }),
      clearPlayerAggro: vi.fn(),
    })),
    getWeaponDamage: vi.fn(() => ({ min: 10, max: 20 })),
    setPowerStrikeBuff: vi.fn(),
    setPhaseShift: vi.fn(),
    ...overrides,
  };

  // Attach helpers for test manipulation
  (ctx as any)._skillState = skillState;
  (ctx as any)._mobs = mobs;
  (ctx as any)._addMob = (mob: any) => {
    mobs.push(mob);
    if (mob.id != null) mobMap.set(mob.id, mob);
  };

  return ctx;
}

// ---------------------------------------------------------------------------
// sendSkillInit
// ---------------------------------------------------------------------------
describe('sendSkillInit', () => {
  it('should send unlocked skills for a high-level player', () => {
    const ctx = createMockContext({ level: 20 });
    sendSkillInit(ctx);

    expect(ctx.send).toHaveBeenCalledTimes(1);
    const [msgType, skillData] = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(msgType).toBe(Types.Messages.SKILL_INIT);
    expect(skillData).toHaveLength(4); // All four skills unlocked at level 20
  });

  it('should send only skills unlocked at the player level', () => {
    const ctx = createMockContext({ level: 5 });
    sendSkillInit(ctx);

    const [, skillData] = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Level 5 unlocks Phase Shift only
    expect(skillData).toHaveLength(1);
    expect(skillData[0].id).toBe(SkillId.PHASE_SHIFT);
  });

  it('should send no skills for a level 1 player', () => {
    const ctx = createMockContext({ level: 1 });
    sendSkillInit(ctx);

    const [msgType, skillData] = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(msgType).toBe(Types.Messages.SKILL_INIT);
    expect(skillData).toHaveLength(0);
  });

  it('should include remaining cooldown for skills on cooldown', () => {
    const ctx = createMockContext({ level: 20 });
    const state = (ctx as any)._skillState as PlayerSkillState;
    // Put Phase Shift on 10-second cooldown
    state.cooldowns[SkillId.PHASE_SHIFT] = Date.now() + 10000;

    sendSkillInit(ctx);

    const [, skillData] = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const phaseShiftData = skillData.find((s: any) => s.id === SkillId.PHASE_SHIFT);
    expect(phaseShiftData.remainingCooldown).toBeGreaterThan(0);
    expect(phaseShiftData.remainingCooldown).toBeLessThanOrEqual(10);
  });

  it('should report 0 remaining cooldown for ready skills', () => {
    const ctx = createMockContext({ level: 20 });
    sendSkillInit(ctx);

    const [, skillData] = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    for (const s of skillData) {
      expect(s.remainingCooldown).toBe(0);
    }
  });

  it('should include correct metadata fields for each skill', () => {
    const ctx = createMockContext({ level: 20 });
    sendSkillInit(ctx);

    const [, skillData] = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    for (const s of skillData) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('description');
      expect(s).toHaveProperty('cooldown');
      expect(s).toHaveProperty('hotkey');
      expect(s).toHaveProperty('icon');
      expect(s).toHaveProperty('remainingCooldown');
    }
  });
});

// ---------------------------------------------------------------------------
// handleSkillUse - Power Strike
// ---------------------------------------------------------------------------
describe('handleSkillUse - Power Strike', () => {
  it('should activate power strike buff', () => {
    const ctx = createMockContext({ level: 10 });
    handleSkillUse(ctx, SkillId.POWER_STRIKE);

    expect(ctx.setPowerStrikeBuff).toHaveBeenCalledWith(true, expect.any(Number));
    const state = (ctx as any)._skillState as PlayerSkillState;
    expect(state.powerStrikeActive).toBe(true);
    expect(state.powerStrikeExpires).toBeGreaterThan(Date.now());
  });

  it('should send cooldown and effect messages', () => {
    const ctx = createMockContext({ level: 10 });
    handleSkillUse(ctx, SkillId.POWER_STRIKE);

    // send is called with: SKILL_COOLDOWN, then SKILL_EFFECT
    const calls = (ctx.send as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(2);

    const [cdType, cdSkillId, cdDuration] = calls[0][0];
    expect(cdType).toBe(Types.Messages.SKILL_COOLDOWN);
    expect(cdSkillId).toBe(SkillId.POWER_STRIKE);
    expect(cdDuration).toBe(SKILLS[SkillId.POWER_STRIKE].cooldown);

    const [effectType, effectPlayerId, effectSkillId] = calls[1][0];
    expect(effectType).toBe(Types.Messages.SKILL_EFFECT);
    expect(effectPlayerId).toBe(ctx.id);
    expect(effectSkillId).toBe(SkillId.POWER_STRIKE);
  });

  it('should set cooldown timestamp in skill state', () => {
    const ctx = createMockContext({ level: 10 });
    const before = Date.now();
    handleSkillUse(ctx, SkillId.POWER_STRIKE);

    const state = (ctx as any)._skillState as PlayerSkillState;
    const expectedMin = before + SKILLS[SkillId.POWER_STRIKE].cooldown * 1000;
    expect(state.cooldowns[SkillId.POWER_STRIKE]).toBeGreaterThanOrEqual(expectedMin);
  });
});

// ---------------------------------------------------------------------------
// handleSkillUse - Phase Shift
// ---------------------------------------------------------------------------
describe('handleSkillUse - Phase Shift', () => {
  it('should activate phase shift and notify context', () => {
    const ctx = createMockContext({ level: 5 });
    handleSkillUse(ctx, SkillId.PHASE_SHIFT);

    expect(ctx.setPhaseShift).toHaveBeenCalledWith(true, expect.any(Number));
    const state = (ctx as any)._skillState as PlayerSkillState;
    expect(state.phaseShiftActive).toBe(true);
    expect(state.phaseShiftExpires).toBeGreaterThan(Date.now());
  });

  it('should clear aggro from mobs targeting this player', () => {
    const ctx = createMockContext({ level: 5 });
    const mob = {
      id: 10,
      target: ctx.id,
      clearTarget: vi.fn(),
      forgetPlayer: vi.fn(),
    };
    (ctx as any)._addMob(mob);

    handleSkillUse(ctx, SkillId.PHASE_SHIFT);

    expect(mob.clearTarget).toHaveBeenCalled();
    expect(mob.forgetPlayer).toHaveBeenCalledWith(ctx.id);
  });

  it('should not clear target on mobs targeting someone else', () => {
    const ctx = createMockContext({ level: 5 });
    const mob = {
      id: 11,
      target: 999, // Different player
      clearTarget: vi.fn(),
      forgetPlayer: vi.fn(),
    };
    (ctx as any)._addMob(mob);

    handleSkillUse(ctx, SkillId.PHASE_SHIFT);

    // Mob targets someone else, so CombatTracker won't return its ID
    expect(mob.clearTarget).not.toHaveBeenCalled();
    expect(mob.forgetPlayer).not.toHaveBeenCalled();
  });

  it('should handle mobs without clearTarget or forgetPlayer gracefully', () => {
    const ctx = createMockContext({ level: 5 });
    const mob = { id: 12, target: ctx.id }; // No clearTarget / forgetPlayer methods
    (ctx as any)._addMob(mob);

    // Should not throw
    expect(() => handleSkillUse(ctx, SkillId.PHASE_SHIFT)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// handleSkillUse - War Cry
// ---------------------------------------------------------------------------
describe('handleSkillUse - War Cry', () => {
  it('should stun mobs within radius', () => {
    const ctx = createMockContext({ level: 15, x: 100, y: 100 });
    const nearMob = {
      x: 102, y: 102, // Within 3-tile radius
      isDead: false,
      clearTarget: vi.fn(),
      stunUntil: 0,
    };
    (ctx as any)._addMob(nearMob);

    handleSkillUse(ctx, SkillId.WAR_CRY);

    expect(nearMob.clearTarget).toHaveBeenCalled();
    expect(nearMob.stunUntil).toBeGreaterThan(Date.now());
  });

  it('should not stun mobs outside radius', () => {
    const ctx = createMockContext({ level: 15, x: 100, y: 100 });
    const farMob = {
      x: 300, y: 300, // Well outside 3-tile radius
      isDead: false,
      clearTarget: vi.fn(),
      stunUntil: 0,
    };
    (ctx as any)._addMob(farMob);

    handleSkillUse(ctx, SkillId.WAR_CRY);

    expect(farMob.clearTarget).not.toHaveBeenCalled();
    expect(farMob.stunUntil).toBe(0);
  });

  it('should skip dead mobs', () => {
    const ctx = createMockContext({ level: 15, x: 100, y: 100 });
    const deadMob = {
      x: 105, y: 105, // Within radius
      isDead: true,
      clearTarget: vi.fn(),
      stunUntil: 0,
    };
    (ctx as any)._addMob(deadMob);

    handleSkillUse(ctx, SkillId.WAR_CRY);

    expect(deadMob.clearTarget).not.toHaveBeenCalled();
    expect(deadMob.stunUntil).toBe(0);
  });

  it('should stun multiple mobs in range', () => {
    const ctx = createMockContext({ level: 15, x: 100, y: 100 });
    const mobs = [
      { x: 102, y: 100, isDead: false, clearTarget: vi.fn(), stunUntil: 0 },
      { x: 100, y: 103, isDead: false, clearTarget: vi.fn(), stunUntil: 0 },
      { x: 102, y: 102, isDead: false, clearTarget: vi.fn(), stunUntil: 0 },
    ];
    for (const mob of mobs) (ctx as any)._addMob(mob);

    handleSkillUse(ctx, SkillId.WAR_CRY);

    for (const mob of mobs) {
      expect(mob.clearTarget).toHaveBeenCalled();
      expect(mob.stunUntil).toBeGreaterThan(Date.now());
    }
  });
});

// ---------------------------------------------------------------------------
// handleSkillUse - Whirlwind
// ---------------------------------------------------------------------------
describe('handleSkillUse - Whirlwind', () => {
  it('should deal damage to mobs within radius', () => {
    const ctx = createMockContext({ level: 20, x: 100, y: 100 });
    const mob = {
      id: 50,
      x: 101, y: 101, // Within 1-tile radius
      isDead: false,
      receiveDamage: vi.fn(),
    };
    (ctx as any)._addMob(mob);

    handleSkillUse(ctx, SkillId.WHIRLWIND);

    expect(mob.receiveDamage).toHaveBeenCalledTimes(1);
    // Weapon avg = (10+20)/2 = 15, + weaponLevel(10) + level(20) = 45, 75% = 33.75, floored to 33
    expect(mob.receiveDamage).toHaveBeenCalledWith(33, 1);
  });

  it('should send DAMAGE message per mob hit', () => {
    const ctx = createMockContext({ level: 20, x: 100, y: 100 });
    const mob = {
      id: 50,
      x: 101, y: 101,
      isDead: false,
      receiveDamage: vi.fn(),
    };
    (ctx as any)._addMob(mob);

    handleSkillUse(ctx, SkillId.WHIRLWIND);

    // send calls: DAMAGE per mob, SKILL_COOLDOWN, SKILL_EFFECT
    const calls = (ctx.send as ReturnType<typeof vi.fn>).mock.calls;
    const damageCall = calls.find((c: any) => c[0][0] === Types.Messages.DAMAGE);
    expect(damageCall).toBeDefined();
    expect(damageCall![0][1]).toBe(mob.id);
    expect(damageCall![0][2]).toBe(33);
  });

  it('should not damage mobs outside radius', () => {
    const ctx = createMockContext({ level: 20, x: 100, y: 100 });
    const farMob = {
      id: 51,
      x: 200, y: 200,
      isDead: false,
      receiveDamage: vi.fn(),
    };
    (ctx as any)._addMob(farMob);

    handleSkillUse(ctx, SkillId.WHIRLWIND);

    expect(farMob.receiveDamage).not.toHaveBeenCalled();
  });

  it('should not damage dead mobs', () => {
    const ctx = createMockContext({ level: 20, x: 100, y: 100 });
    const deadMob = {
      id: 52,
      x: 105, y: 105,
      isDead: true,
      receiveDamage: vi.fn(),
    };
    (ctx as any)._addMob(deadMob);

    handleSkillUse(ctx, SkillId.WHIRLWIND);

    expect(deadMob.receiveDamage).not.toHaveBeenCalled();
  });

  it('should hit multiple mobs in radius', () => {
    const ctx = createMockContext({ level: 20, x: 100, y: 100 });
    const mobs = [
      { id: 60, x: 101, y: 100, isDead: false, receiveDamage: vi.fn() },
      { id: 61, x: 100, y: 101, isDead: false, receiveDamage: vi.fn() },
    ];
    for (const mob of mobs) (ctx as any)._addMob(mob);

    handleSkillUse(ctx, SkillId.WHIRLWIND);

    for (const mob of mobs) {
      expect(mob.receiveDamage).toHaveBeenCalledWith(33, 1);
    }
  });

  it('should scale damage based on weapon damage', () => {
    const ctx = createMockContext({ level: 20, x: 100, y: 100 });
    (ctx.getWeaponDamage as ReturnType<typeof vi.fn>).mockReturnValue({ min: 40, max: 60 });
    const mob = {
      id: 70,
      x: 101, y: 101,
      isDead: false,
      receiveDamage: vi.fn(),
    };
    (ctx as any)._addMob(mob);

    handleSkillUse(ctx, SkillId.WHIRLWIND);

    // Weapon avg = (40+60)/2 = 50, + weaponLevel(10) + level(20) = 80, 75% = 60
    expect(mob.receiveDamage).toHaveBeenCalledWith(60, 1);
  });
});

// ---------------------------------------------------------------------------
// Cooldown enforcement
// ---------------------------------------------------------------------------
describe('Cooldown enforcement', () => {
  it('should reject skill use when on cooldown', () => {
    const ctx = createMockContext({ level: 20 });
    const state = (ctx as any)._skillState as PlayerSkillState;
    // Put power strike on 30-second cooldown
    state.cooldowns[SkillId.POWER_STRIKE] = Date.now() + 30000;

    handleSkillUse(ctx, SkillId.POWER_STRIKE);

    // No messages sent means skill did not fire
    expect(ctx.send).not.toHaveBeenCalled();
    expect(ctx.setPowerStrikeBuff).not.toHaveBeenCalled();
  });

  it('should allow skill use when cooldown has expired', () => {
    const ctx = createMockContext({ level: 20 });
    const state = (ctx as any)._skillState as PlayerSkillState;
    // Set cooldown in the past
    state.cooldowns[SkillId.POWER_STRIKE] = Date.now() - 1000;

    handleSkillUse(ctx, SkillId.POWER_STRIKE);

    expect(ctx.send).toHaveBeenCalled();
    expect(ctx.setPowerStrikeBuff).toHaveBeenCalled();
  });

  it('should set cooldown after successful skill use', () => {
    const ctx = createMockContext({ level: 20 });
    const state = (ctx as any)._skillState as PlayerSkillState;

    handleSkillUse(ctx, SkillId.WAR_CRY);

    expect(state.cooldowns[SkillId.WAR_CRY]).toBeGreaterThan(Date.now());
  });

  it('should not overwrite cooldown on rejected skill use', () => {
    const ctx = createMockContext({ level: 20 });
    const state = (ctx as any)._skillState as PlayerSkillState;
    const futureTimestamp = Date.now() + 30000;
    state.cooldowns[SkillId.WAR_CRY] = futureTimestamp;

    handleSkillUse(ctx, SkillId.WAR_CRY);

    // Cooldown should remain unchanged
    expect(state.cooldowns[SkillId.WAR_CRY]).toBe(futureTimestamp);
  });
});

// ---------------------------------------------------------------------------
// Level requirements
// ---------------------------------------------------------------------------
describe('Level requirements', () => {
  it('should reject Phase Shift below level 5', () => {
    const ctx = createMockContext({ level: 4 });
    handleSkillUse(ctx, SkillId.PHASE_SHIFT);

    expect(ctx.send).not.toHaveBeenCalled();
    expect(ctx.setPhaseShift).not.toHaveBeenCalled();
  });

  it('should allow Phase Shift at exactly level 5', () => {
    const ctx = createMockContext({ level: 5 });
    handleSkillUse(ctx, SkillId.PHASE_SHIFT);

    expect(ctx.send).toHaveBeenCalled();
    expect(ctx.setPhaseShift).toHaveBeenCalled();
  });

  it('should reject Power Strike below level 10', () => {
    const ctx = createMockContext({ level: 9 });
    handleSkillUse(ctx, SkillId.POWER_STRIKE);

    expect(ctx.send).not.toHaveBeenCalled();
    expect(ctx.setPowerStrikeBuff).not.toHaveBeenCalled();
  });

  it('should allow Power Strike at exactly level 10', () => {
    const ctx = createMockContext({ level: 10 });
    handleSkillUse(ctx, SkillId.POWER_STRIKE);

    expect(ctx.send).toHaveBeenCalled();
    expect(ctx.setPowerStrikeBuff).toHaveBeenCalled();
  });

  it('should reject War Cry below level 15', () => {
    const ctx = createMockContext({ level: 14 });
    handleSkillUse(ctx, SkillId.WAR_CRY);

    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('should reject Whirlwind below level 20', () => {
    const ctx = createMockContext({ level: 19 });
    handleSkillUse(ctx, SkillId.WHIRLWIND);

    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('should allow Whirlwind at level 20', () => {
    const ctx = createMockContext({ level: 20 });
    handleSkillUse(ctx, SkillId.WHIRLWIND);

    expect(ctx.send).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// consumePowerStrikeBuff
// ---------------------------------------------------------------------------
describe('consumePowerStrikeBuff', () => {
  it('should return 2.0 and consume active buff', () => {
    const ctx = createMockContext();
    const state = (ctx as any)._skillState as PlayerSkillState;
    state.powerStrikeActive = true;
    state.powerStrikeExpires = Date.now() + 5000;

    const multiplier = consumePowerStrikeBuff(ctx);

    expect(multiplier).toBe(2.0);
    expect(state.powerStrikeActive).toBe(false);
    expect(state.powerStrikeExpires).toBe(0);
    expect(ctx.setPowerStrikeBuff).toHaveBeenCalledWith(false, 0);
  });

  it('should return 1.0 when no buff is active', () => {
    const ctx = createMockContext();

    const multiplier = consumePowerStrikeBuff(ctx);

    expect(multiplier).toBe(1.0);
    expect(ctx.setPowerStrikeBuff).not.toHaveBeenCalled();
  });

  it('should return 1.0 when buff has expired', () => {
    const ctx = createMockContext();
    const state = (ctx as any)._skillState as PlayerSkillState;
    state.powerStrikeActive = true;
    state.powerStrikeExpires = Date.now() - 1000; // Expired 1 second ago

    const multiplier = consumePowerStrikeBuff(ctx);

    expect(multiplier).toBe(1.0);
    // Should not call setPowerStrikeBuff since the check short-circuits
    expect(ctx.setPowerStrikeBuff).not.toHaveBeenCalled();
  });

  it('should only consume once per activation', () => {
    const ctx = createMockContext();
    const state = (ctx as any)._skillState as PlayerSkillState;
    state.powerStrikeActive = true;
    state.powerStrikeExpires = Date.now() + 5000;

    const first = consumePowerStrikeBuff(ctx);
    const second = consumePowerStrikeBuff(ctx);

    expect(first).toBe(2.0);
    expect(second).toBe(1.0);
  });

  it('should be active after handleSkillUse triggers it', () => {
    const ctx = createMockContext({ level: 10 });
    handleSkillUse(ctx, SkillId.POWER_STRIKE);

    const multiplier = consumePowerStrikeBuff(ctx);
    expect(multiplier).toBe(2.0);

    // Second consumption returns normal
    const multiplier2 = consumePowerStrikeBuff(ctx);
    expect(multiplier2).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// checkSkillUnlock
// ---------------------------------------------------------------------------
describe('checkSkillUnlock', () => {
  it('should notify when Phase Shift unlocks at level 5', () => {
    const ctx = createMockContext({ level: 5 });
    checkSkillUnlock(ctx, 4, 5);

    expect(ctx.send).toHaveBeenCalledTimes(1);
    const [msgType, data] = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(msgType).toBe(Types.Messages.SKILL_UNLOCK);
    expect(data.id).toBe(SkillId.PHASE_SHIFT);
    expect(data.name).toBe('Phase Shift');
  });

  it('should notify when Power Strike unlocks at level 10', () => {
    const ctx = createMockContext({ level: 10 });
    checkSkillUnlock(ctx, 9, 10);

    expect(ctx.send).toHaveBeenCalledTimes(1);
    const [, data] = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(data.id).toBe(SkillId.POWER_STRIKE);
  });

  it('should unlock multiple skills when jumping levels', () => {
    const ctx = createMockContext({ level: 15 });
    // Jumping from level 4 to 15 should unlock Phase Shift (5), Power Strike (10), War Cry (15)
    checkSkillUnlock(ctx, 4, 15);

    expect(ctx.send).toHaveBeenCalledTimes(3);
    const unlockedIds = (ctx.send as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: any) => c[0][1].id
    );
    expect(unlockedIds).toContain(SkillId.PHASE_SHIFT);
    expect(unlockedIds).toContain(SkillId.POWER_STRIKE);
    expect(unlockedIds).toContain(SkillId.WAR_CRY);
  });

  it('should not notify for already-unlocked skills', () => {
    const ctx = createMockContext({ level: 6 });
    // Going from 5 to 6 -- Phase Shift was already unlocked at 5
    checkSkillUnlock(ctx, 5, 6);

    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('should not notify when no new skills are unlocked', () => {
    const ctx = createMockContext({ level: 3 });
    checkSkillUnlock(ctx, 2, 3);

    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('should include all metadata fields in unlock message', () => {
    const ctx = createMockContext({ level: 20 });
    checkSkillUnlock(ctx, 19, 20);

    const [, data] = (ctx.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('cooldown');
    expect(data).toHaveProperty('hotkey');
    expect(data).toHaveProperty('icon');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('should silently ignore an invalid/unknown skillId', () => {
    const ctx = createMockContext({ level: 20 });

    expect(() => handleSkillUse(ctx, 'nonexistent_skill')).not.toThrow();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('should silently ignore an empty string skillId', () => {
    const ctx = createMockContext({ level: 20 });

    expect(() => handleSkillUse(ctx, '')).not.toThrow();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('should handle a world with zero mobs for War Cry', () => {
    const ctx = createMockContext({ level: 15 });
    // No mobs added -- empty world

    expect(() => handleSkillUse(ctx, SkillId.WAR_CRY)).not.toThrow();
    // Skill should still succeed (just stuns 0 mobs)
    expect(ctx.send).toHaveBeenCalled();
  });

  it('should handle a world with zero mobs for Whirlwind', () => {
    const ctx = createMockContext({ level: 20 });

    expect(() => handleSkillUse(ctx, SkillId.WHIRLWIND)).not.toThrow();
    expect(ctx.send).toHaveBeenCalled();
  });

  it('should handle a world with zero mobs for Phase Shift', () => {
    const ctx = createMockContext({ level: 5 });

    expect(() => handleSkillUse(ctx, SkillId.PHASE_SHIFT)).not.toThrow();
    expect(ctx.send).toHaveBeenCalled();
  });

  it('should handle mobs at exact boundary of War Cry radius', () => {
    const ctx = createMockContext({ level: 15, x: 100, y: 100 });
    // War Cry radius is 3 tiles. Chebyshev distance at (103, 100) = 3.
    const boundaryMob = {
      x: 103, y: 100,
      isDead: false,
      clearTarget: vi.fn(),
      stunUntil: 0,
    };
    (ctx as any)._addMob(boundaryMob);

    handleSkillUse(ctx, SkillId.WAR_CRY);

    expect(boundaryMob.clearTarget).toHaveBeenCalled();
    expect(boundaryMob.stunUntil).toBeGreaterThan(Date.now());
  });

  it('should handle mobs just outside War Cry radius', () => {
    const ctx = createMockContext({ level: 15, x: 100, y: 100 });
    // 4 tiles away, just outside the 3-tile radius
    const outsideMob = {
      x: 104, y: 100,
      isDead: false,
      clearTarget: vi.fn(),
      stunUntil: 0,
    };
    (ctx as any)._addMob(outsideMob);

    handleSkillUse(ctx, SkillId.WAR_CRY);

    expect(outsideMob.clearTarget).not.toHaveBeenCalled();
    expect(outsideMob.stunUntil).toBe(0);
  });

  it('should handle concurrent skill use attempts (both on cooldown)', () => {
    const ctx = createMockContext({ level: 20 });

    // Use power strike -- goes on cooldown
    handleSkillUse(ctx, SkillId.POWER_STRIKE);
    vi.mocked(ctx.send).mockClear();

    // Attempt to use it again immediately
    handleSkillUse(ctx, SkillId.POWER_STRIKE);

    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('should allow using different skills independently', () => {
    const ctx = createMockContext({ level: 20 });

    handleSkillUse(ctx, SkillId.POWER_STRIKE);
    vi.mocked(ctx.send).mockClear();

    // War Cry is a different skill, should work even though Power Strike is on cooldown
    handleSkillUse(ctx, SkillId.WAR_CRY);

    expect(ctx.send).toHaveBeenCalled();
    const calls = (ctx.send as ReturnType<typeof vi.fn>).mock.calls;
    const cooldownCall = calls.find((c: any) => c[0][0] === Types.Messages.SKILL_COOLDOWN);
    expect(cooldownCall![0][1]).toBe(SkillId.WAR_CRY);
  });
});
