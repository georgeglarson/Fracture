/**
 * Tests for AchievementHandler
 * Covers: init (fresh & saved), kill/gold/level/streak/purchase checks,
 *         title selection, serialization, cleanup, reward grants,
 *         and double-unlock prevention.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';
import {
  PlayerAchievements,
  getAchievementById,
} from '../../../shared/ts/achievements';
import { AchievementService } from '../achievements/achievement.service';

// ---------------------------------------------------------------------------
// Mock the singleton factory so every test controls its own service instance.
// vi.mock is hoisted; the factory closure references `mockService` which is
// set in beforeEach before each test runs.
// ---------------------------------------------------------------------------
let mockService: AchievementService;

vi.mock('../achievements/achievement.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../achievements/achievement.service')>();
  return {
    ...actual,
    getAchievementService: () => mockService,
  };
});

// Also mock the Messages import used by handleSelectTitle
vi.mock('../message.js', () => ({
  Messages: {
    PlayerTitleUpdate: class {
      constructor(public playerId: number, public title: string | null) {}
      serialize() { return [53, this.playerId, this.title || '']; }
    },
  },
}));

// Import the handler functions *after* the mocks are declared
import {
  AchievementPlayerContext,
  initAchievements,
  checkKillAchievements,
  checkGoldAchievements,
  checkLevelAchievements,
  checkStreakAchievements,
  checkPurchaseAchievements,
  handleSelectTitle,
  getAchievementState,
  cleanupAchievements,
} from '../player/achievement.handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Entity kind numbers from gametypes */
const RAT_KIND = Types.Entities.RAT;           // 2
const SKELETON_KIND = Types.Entities.SKELETON;  // 3
const BOSS_KIND = Types.Entities.BOSS;          // 13

// This variable is set inside beforeEach so the setTitle mock can close
// over the correct reference.
let ctx: AchievementPlayerContext;

function createMockCtx(): AchievementPlayerContext {
  const c: AchievementPlayerContext = {
    id: 42,
    title: null,
    send: vi.fn(),
    broadcast: vi.fn(),
    grantGold: vi.fn(),
    grantXP: vi.fn(),
    setTitle: vi.fn((t: string | null) => { c.title = t; }),
  };
  return c;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AchievementHandler', () => {
  beforeEach(() => {
    // Create a fresh service instance for every test so state never leaks.
    mockService = new AchievementService();
    ctx = createMockCtx();
  });

  // =========================================================================
  // initAchievements
  // =========================================================================
  describe('initAchievements', () => {
    it('should send ACHIEVEMENT_INIT message with empty state for a new player', () => {
      initAchievements(ctx);

      // The init message is: [ACHIEVEMENT_INIT, unlocked[], progressJSON, title]
      const sendFn = ctx.send as ReturnType<typeof vi.fn>;
      const initCall = sendFn.mock.calls.find(
        (c: any[]) => Array.isArray(c[0]) && c[0][0] === Types.Messages.ACHIEVEMENT_INIT,
      );
      expect(initCall).toBeDefined();
    });

    it('should unlock first_steps for a brand-new player and grant its rewards', () => {
      initAchievements(ctx);

      const firstSteps = getAchievementById('first_steps')!;
      // first_steps rewards: gold: 5
      expect(ctx.grantGold).toHaveBeenCalledWith(firstSteps.reward!.gold);
    });

    it('should NOT unlock first_steps again for a returning player that already has it', () => {
      const saved: PlayerAchievements = {
        unlocked: ['first_steps'],
        progress: {},
        selectedTitle: null,
      };

      initAchievements(ctx, saved);

      // grantGold should not be called because first_steps was already unlocked
      expect(ctx.grantGold).not.toHaveBeenCalled();
      expect(ctx.grantXP).not.toHaveBeenCalled();
    });

    it('should restore the selected title from saved data', () => {
      const saved: PlayerAchievements = {
        unlocked: ['first_steps'],
        progress: {},
        selectedTitle: 'first_steps',
      };

      initAchievements(ctx, saved);

      // setTitle should be called with the title string for 'first_steps'
      expect(ctx.setTitle).toHaveBeenCalledWith('Newcomer');
    });

    it('should pass null title when saved data has no selected title', () => {
      const saved: PlayerAchievements = {
        unlocked: ['first_steps'],
        progress: {},
        selectedTitle: null,
      };

      initAchievements(ctx, saved);

      expect(ctx.setTitle).toHaveBeenCalledWith(null);
    });
  });

  // =========================================================================
  // checkKillAchievements
  // =========================================================================
  describe('checkKillAchievements', () => {
    beforeEach(() => {
      // Initialize the player fresh then pre-unlock first_steps
      // so it does not confuse reward assertions.
      mockService.initPlayer('42');
      mockService.recordFirstSteps('42');
    });

    it('should unlock first_blood after the first kill', () => {
      checkKillAchievements(ctx, RAT_KIND);

      const firstBlood = getAchievementById('first_blood')!;
      expect(ctx.grantXP).toHaveBeenCalledWith(firstBlood.reward!.xp);
    });

    it('should track total kill progress across multiple calls', () => {
      for (let i = 0; i < 5; i++) {
        checkKillAchievements(ctx, RAT_KIND);
      }

      const state = mockService.getPlayerAchievements('42');
      expect(state.progress['total_kills']).toBe(5);
    });

    it('should track mob-type specific kill progress', () => {
      for (let i = 0; i < 3; i++) {
        checkKillAchievements(ctx, SKELETON_KIND);
      }

      const state = mockService.getPlayerAchievements('42');
      expect(state.progress['kills_skeleton']).toBe(3);
    });

    it('should unlock rat_slayer after 10 rat kills', () => {
      for (let i = 0; i < 10; i++) {
        (ctx.grantGold as ReturnType<typeof vi.fn>).mockClear();
        (ctx.grantXP as ReturnType<typeof vi.fn>).mockClear();
        checkKillAchievements(ctx, RAT_KIND);
      }

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('rat_slayer');

      const ratSlayer = getAchievementById('rat_slayer')!;
      expect(ctx.grantGold).toHaveBeenCalledWith(ratSlayer.reward!.gold);
    });

    it('should unlock skeleton_crusher after 25 skeleton kills', () => {
      for (let i = 0; i < 25; i++) {
        checkKillAchievements(ctx, SKELETON_KIND);
      }

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('skeleton_crusher');
    });

    it('should unlock boss_hunter on first boss kill', () => {
      // Pre-unlock first_blood so only boss_hunter triggers on this kill
      const state = mockService.getPlayerAchievements('42');
      state.unlocked.push('first_blood');

      checkKillAchievements(ctx, BOSS_KIND);

      expect(state.unlocked).toContain('boss_hunter');

      const bossHunter = getAchievementById('boss_hunter')!;
      expect(ctx.grantGold).toHaveBeenCalledWith(bossHunter.reward!.gold);
      expect(ctx.grantXP).toHaveBeenCalledWith(bossHunter.reward!.xp);
    });

    it('should unlock centurion after 100 total kills', () => {
      for (let i = 0; i < 100; i++) {
        checkKillAchievements(ctx, RAT_KIND);
      }

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('centurion');
    });

    it('should not grant rewards when no achievement is unlocked', () => {
      // first kill unlocks first_blood; second kill should not grant anything
      checkKillAchievements(ctx, RAT_KIND);
      (ctx.grantGold as ReturnType<typeof vi.fn>).mockClear();
      (ctx.grantXP as ReturnType<typeof vi.fn>).mockClear();

      checkKillAchievements(ctx, RAT_KIND);

      expect(ctx.grantGold).not.toHaveBeenCalled();
      expect(ctx.grantXP).not.toHaveBeenCalled();
    });

    it('should not double-grant rewards for an already-unlocked achievement', () => {
      const state = mockService.getPlayerAchievements('42');
      state.unlocked.push('first_blood');

      checkKillAchievements(ctx, RAT_KIND);

      expect(ctx.grantXP).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // checkGoldAchievements
  // =========================================================================
  describe('checkGoldAchievements', () => {
    beforeEach(() => {
      mockService.initPlayer('42');
    });

    it('should unlock pocket_change when 100 gold is earned', () => {
      checkGoldAchievements(ctx, 100);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('pocket_change');

      const pocketChange = getAchievementById('pocket_change')!;
      expect(ctx.grantXP).toHaveBeenCalledWith(pocketChange.reward!.xp);
    });

    it('should accumulate gold across multiple calls', () => {
      checkGoldAchievements(ctx, 50);

      let state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).not.toContain('pocket_change');

      checkGoldAchievements(ctx, 50);

      state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('pocket_change');
    });

    it('should unlock investor at 1,000 gold earned', () => {
      checkGoldAchievements(ctx, 1000);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('investor');
    });

    it('should unlock wealthy at 10,000 gold earned', () => {
      checkGoldAchievements(ctx, 10000);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('wealthy');
    });

    it('should unlock multiple gold achievements at once when earning a large amount', () => {
      checkGoldAchievements(ctx, 10000);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('pocket_change');
      expect(state.unlocked).toContain('investor');
      expect(state.unlocked).toContain('wealthy');
    });

    it('should not double-grant a gold achievement already unlocked', () => {
      const state = mockService.getPlayerAchievements('42');
      state.unlocked.push('pocket_change');

      checkGoldAchievements(ctx, 200);

      expect(ctx.grantXP).not.toHaveBeenCalled();
      expect(ctx.grantGold).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // checkLevelAchievements
  // =========================================================================
  describe('checkLevelAchievements', () => {
    beforeEach(() => {
      mockService.initPlayer('42');
    });

    it('should unlock adventurer at level 5', () => {
      checkLevelAchievements(ctx, 5);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('adventurer');

      const adventurer = getAchievementById('adventurer')!;
      expect(ctx.grantGold).toHaveBeenCalledWith(adventurer.reward!.gold);
    });

    it('should unlock warrior at level 10', () => {
      checkLevelAchievements(ctx, 10);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('warrior');
    });

    it('should unlock multiple level achievements when jumping past thresholds', () => {
      checkLevelAchievements(ctx, 50);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('adventurer');
      expect(state.unlocked).toContain('warrior');
      expect(state.unlocked).toContain('veteran');
      expect(state.unlocked).toContain('champion');
      expect(state.unlocked).toContain('elite');
      expect(state.unlocked).toContain('legend');
    });

    it('should not unlock level achievements below the threshold', () => {
      checkLevelAchievements(ctx, 4);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).not.toContain('adventurer');
    });

    it('should not double-grant a level achievement already unlocked', () => {
      const state = mockService.getPlayerAchievements('42');
      state.unlocked.push('adventurer');

      checkLevelAchievements(ctx, 5);

      expect(ctx.grantGold).not.toHaveBeenCalled();
    });

    it('should grant both gold and xp for champion (level 30)', () => {
      // Pre-unlock lower level achievements so they do not fire
      const state = mockService.getPlayerAchievements('42');
      state.unlocked.push('adventurer', 'warrior', 'veteran');

      checkLevelAchievements(ctx, 30);

      const champion = getAchievementById('champion')!;
      expect(ctx.grantGold).toHaveBeenCalledWith(champion.reward!.gold);
      expect(ctx.grantXP).toHaveBeenCalledWith(champion.reward!.xp);
    });
  });

  // =========================================================================
  // checkStreakAchievements
  // =========================================================================
  describe('checkStreakAchievements', () => {
    beforeEach(() => {
      mockService.initPlayer('42');
    });

    it('should unlock daily_devotee at 7-day streak', () => {
      checkStreakAchievements(ctx, 7);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('daily_devotee');

      const devotee = getAchievementById('daily_devotee')!;
      expect(ctx.grantGold).toHaveBeenCalledWith(devotee.reward!.gold);
      expect(ctx.grantXP).toHaveBeenCalledWith(devotee.reward!.xp);
    });

    it('should not unlock daily_devotee below 7-day streak', () => {
      checkStreakAchievements(ctx, 6);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).not.toContain('daily_devotee');
    });

    it('should not double-grant when called with the same streak again', () => {
      checkStreakAchievements(ctx, 7);
      (ctx.grantGold as ReturnType<typeof vi.fn>).mockClear();
      (ctx.grantXP as ReturnType<typeof vi.fn>).mockClear();

      checkStreakAchievements(ctx, 7);

      expect(ctx.grantGold).not.toHaveBeenCalled();
      expect(ctx.grantXP).not.toHaveBeenCalled();
    });

    it('should track the highest streak in progress', () => {
      checkStreakAchievements(ctx, 3);
      checkStreakAchievements(ctx, 5);

      const state = mockService.getPlayerAchievements('42');
      expect(state.progress['streak']).toBe(5);
    });
  });

  // =========================================================================
  // checkPurchaseAchievements
  // =========================================================================
  describe('checkPurchaseAchievements', () => {
    beforeEach(() => {
      mockService.initPlayer('42');
    });

    it('should unlock first_purchase after spending any gold', () => {
      checkPurchaseAchievements(ctx, 50);

      const state = mockService.getPlayerAchievements('42');
      expect(state.unlocked).toContain('first_purchase');

      const firstPurchase = getAchievementById('first_purchase')!;
      expect(ctx.grantGold).toHaveBeenCalledWith(firstPurchase.reward!.gold);
    });

    it('should not double-grant first_purchase', () => {
      checkPurchaseAchievements(ctx, 50);
      (ctx.grantGold as ReturnType<typeof vi.fn>).mockClear();

      checkPurchaseAchievements(ctx, 100);

      expect(ctx.grantGold).not.toHaveBeenCalled();
    });

    it('should accumulate gold_spent progress', () => {
      checkPurchaseAchievements(ctx, 30);
      checkPurchaseAchievements(ctx, 70);

      const state = mockService.getPlayerAchievements('42');
      expect(state.progress['gold_spent']).toBe(100);
    });
  });

  // =========================================================================
  // handleSelectTitle
  // =========================================================================
  describe('handleSelectTitle', () => {
    beforeEach(() => {
      // Player has first_steps unlocked (which grants title "Newcomer")
      mockService.initPlayer('42', {
        unlocked: ['first_steps'],
        progress: {},
        selectedTitle: null,
      });
    });

    it('should set the title from an unlocked achievement', () => {
      handleSelectTitle(ctx, 'first_steps');

      expect(ctx.setTitle).toHaveBeenCalledWith('Newcomer');
    });

    it('should broadcast the title change', () => {
      handleSelectTitle(ctx, 'first_steps');

      expect(ctx.broadcast).toHaveBeenCalled();
    });

    it('should clear the title when null is passed', () => {
      handleSelectTitle(ctx, 'first_steps');
      (ctx.setTitle as ReturnType<typeof vi.fn>).mockClear();

      handleSelectTitle(ctx, null);

      expect(ctx.setTitle).toHaveBeenCalledWith(null);
    });

    it('should not set a title for a locked achievement', () => {
      handleSelectTitle(ctx, 'centurion');

      // centurion is not unlocked, so selectTitle returns null
      expect(ctx.setTitle).toHaveBeenCalledWith(null);
    });

    it('should not set a title for an achievement with no title reward', () => {
      // pocket_change has no title reward. Unlock it first.
      const state = mockService.getPlayerAchievements('42');
      state.unlocked.push('pocket_change');

      handleSelectTitle(ctx, 'pocket_change');

      expect(ctx.setTitle).toHaveBeenCalledWith(null);
    });
  });

  // =========================================================================
  // getAchievementState
  // =========================================================================
  describe('getAchievementState', () => {
    it('should return the serializable state after init', () => {
      mockService.initPlayer('42');

      const state = getAchievementState(ctx);

      expect(state).not.toBeNull();
      expect(state).toHaveProperty('unlocked');
      expect(state).toHaveProperty('progress');
      expect(state).toHaveProperty('selectedTitle');
    });

    it('should reflect unlocked achievements', () => {
      mockService.initPlayer('42');
      mockService.recordFirstSteps('42');

      const state = getAchievementState(ctx);

      expect(state!.unlocked).toContain('first_steps');
    });

    it('should reflect progress', () => {
      mockService.initPlayer('42');
      mockService.recordKill('42', RAT_KIND);

      const state = getAchievementState(ctx);

      expect(state!.progress['total_kills']).toBe(1);
    });

    it('should return null for an uninitialized player', () => {
      // Do NOT call initPlayer
      const state = getAchievementState(ctx);

      expect(state).toBeNull();
    });
  });

  // =========================================================================
  // cleanupAchievements
  // =========================================================================
  describe('cleanupAchievements', () => {
    it('should remove the player state so subsequent lookups return null', () => {
      mockService.initPlayer('42');

      cleanupAchievements(ctx);

      const state = getAchievementState(ctx);
      expect(state).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      mockService.initPlayer('42');

      cleanupAchievements(ctx);
      cleanupAchievements(ctx);

      expect(getAchievementState(ctx)).toBeNull();
    });
  });

  // =========================================================================
  // Achievement rewards (XP and gold grants on unlock)
  // =========================================================================
  describe('Achievement rewards', () => {
    beforeEach(() => {
      mockService.initPlayer('42');
    });

    it('should grant only gold when achievement reward has gold but no xp', () => {
      // Pre-unlock first_blood so only rat_slayer fires at kill 10
      const state = mockService.getPlayerAchievements('42');
      state.unlocked.push('first_blood');

      for (let i = 0; i < 10; i++) {
        (ctx.grantGold as ReturnType<typeof vi.fn>).mockClear();
        (ctx.grantXP as ReturnType<typeof vi.fn>).mockClear();
        checkKillAchievements(ctx, RAT_KIND);
      }

      // rat_slayer reward: gold: 25, no xp
      expect(ctx.grantGold).toHaveBeenCalledWith(25);
      expect(ctx.grantXP).not.toHaveBeenCalled();
    });

    it('should grant only xp when achievement reward has xp but no gold', () => {
      // first_blood: xp: 10, no gold (has title but that is not a gold/xp reward)
      checkKillAchievements(ctx, RAT_KIND);

      expect(ctx.grantXP).toHaveBeenCalledWith(10);
      expect(ctx.grantGold).not.toHaveBeenCalled();
    });

    it('should grant both gold and xp when achievement reward has both', () => {
      // boss_hunter: gold: 100, xp: 100
      // Pre-unlock first_blood so only boss_hunter fires
      const state = mockService.getPlayerAchievements('42');
      state.unlocked.push('first_blood');

      checkKillAchievements(ctx, BOSS_KIND);

      expect(ctx.grantGold).toHaveBeenCalledWith(100);
      expect(ctx.grantXP).toHaveBeenCalledWith(100);
    });

    it('should not call grantGold when reward gold is 0 or absent', () => {
      // pocket_change: xp: 25, no gold
      checkGoldAchievements(ctx, 100);

      expect(ctx.grantGold).not.toHaveBeenCalled();
      expect(ctx.grantXP).toHaveBeenCalledWith(25);
    });
  });

  // =========================================================================
  // Already-unlocked achievements (no double grants)
  // =========================================================================
  describe('Already-unlocked achievements', () => {
    it('should not re-grant kill achievements that are in the saved unlocked list', () => {
      mockService.initPlayer('42', {
        unlocked: ['first_blood', 'centurion'],
        progress: { total_kills: 200 },
        selectedTitle: null,
      });

      checkKillAchievements(ctx, RAT_KIND);

      expect(ctx.grantXP).not.toHaveBeenCalled();
      expect(ctx.grantGold).not.toHaveBeenCalled();
    });

    it('should not re-grant gold achievements from saved data', () => {
      mockService.initPlayer('42', {
        unlocked: ['pocket_change', 'investor'],
        progress: { gold_earned: 5000 },
        selectedTitle: null,
      });

      checkGoldAchievements(ctx, 100);

      expect(ctx.grantXP).not.toHaveBeenCalled();
      expect(ctx.grantGold).not.toHaveBeenCalled();
    });

    it('should not re-grant level achievements from saved data', () => {
      mockService.initPlayer('42', {
        unlocked: ['adventurer', 'warrior'],
        progress: { level: 10 },
        selectedTitle: null,
      });

      checkLevelAchievements(ctx, 10);

      expect(ctx.grantGold).not.toHaveBeenCalled();
      expect(ctx.grantXP).not.toHaveBeenCalled();
    });

    it('should not re-grant streak achievements from saved data', () => {
      mockService.initPlayer('42', {
        unlocked: ['daily_devotee'],
        progress: { streak: 10 },
        selectedTitle: null,
      });

      checkStreakAchievements(ctx, 14);

      expect(ctx.grantGold).not.toHaveBeenCalled();
      expect(ctx.grantXP).not.toHaveBeenCalled();
    });

    it('should not re-grant purchase achievements from saved data', () => {
      mockService.initPlayer('42', {
        unlocked: ['first_purchase'],
        progress: { gold_spent: 500 },
        selectedTitle: null,
      });

      checkPurchaseAchievements(ctx, 100);

      expect(ctx.grantGold).not.toHaveBeenCalled();
    });
  });
});
