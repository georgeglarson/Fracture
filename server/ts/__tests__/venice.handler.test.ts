/**
 * Tests for VeniceHandler no-AI mode fallbacks
 *
 * When VENICE_API_KEY is absent there is no VeniceService singleton. The
 * handlers must still deliver the static-fallback experience:
 *   - quest NPCs offer template quests (via the static QuestService)
 *   - the Town Crier serves stat-based headlines (via the static NewsService)
 * Behavior with Venice present must remain unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

// Venice singleton absent by default (no-AI mode)
const mockGetVeniceService = vi.hoisted(() => vi.fn((): unknown => null));

vi.mock('../ai', () => ({
  getVeniceService: mockGetVeniceService,
  getFishAudioService: vi.fn(() => null),
}));

vi.mock('../shop/shop.service', () => ({
  isMerchant: vi.fn(() => false),
  getShopInventory: vi.fn(() => null),
  shopService: {},
}));

import { Types } from '../../../shared/ts/gametypes';
import {
  handleRequestQuest,
  handleNewsRequest,
  handleKill,
  handleAreaChange,
  handleLowHealth,
  handleDeath,
  handleAbandonQuest,
  cleanupVenice,
} from '../player/venice.handler';
import { getStaticServices, resetStaticServices } from '../ai/static-services';

function createCtx(id = 42) {
  return { id, name: 'Hero', send: vi.fn() };
}

/**
 * Full gameplay context (what a real Player provides) for reward-granting
 * paths: inventory, world drop surface, XP grant, broadcast.
 */
function createFullCtx(id = 42) {
  const inventory = {
    hasRoom: vi.fn(() => true),
    addItem: vi.fn(() => 0),
    getSlot: vi.fn(() => ({ count: 1 })),
  };
  const world = {
    createItemWithProperties: vi.fn(() => ({ id: 9001 })),
    addItem: vi.fn(),
  };
  return {
    id,
    name: 'Hero',
    x: 33,
    y: 44,
    send: vi.fn(),
    broadcast: vi.fn(),
    grantXP: vi.fn(),
    getInventory: () => inventory,
    getWorld: () => world,
    _inventory: inventory,
    _world: world,
  };
}

describe('VeniceHandler no-AI mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVeniceService.mockReturnValue(null);
    resetStaticServices();
  });

  // ── handleRequestQuest ─────────────────────────────────────────

  describe('handleRequestQuest', () => {
    it('offers a template quest when Venice is absent', async () => {
      const ctx = createCtx();

      await handleRequestQuest(ctx, Types.Entities.GUARD);

      expect(ctx.send).toHaveBeenCalledTimes(2);
      // [QUEST_OFFER, type, target, count, progress, reward, xp, description]
      const msg = ctx.send.mock.calls[0][0];
      expect(msg[0]).toBe(Types.Messages.QUEST_OFFER);
      expect(msg[1]).toBe('kill');
      expect(msg[7]).toMatch(/^Defeat \d+ \w+!$/);
      // Tracker initializes from the server: [QUEST_STATUS, type, target, count, progress]
      const status = ctx.send.mock.calls[1][0];
      expect(status[0]).toBe(Types.Messages.QUEST_STATUS);
      expect(status[1]).toBe(msg[1]);
      expect(status[2]).toBe(msg[2]);
      expect(status[3]).toBe(msg[3]);
      expect(status[4]).toBe(0);
    });

    it('does nothing for an unknown NPC kind', async () => {
      const ctx = createCtx();

      await handleRequestQuest(ctx, 999999);

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('delegates to Venice when the service is present', async () => {
      const quest = {
        type: 'kill',
        target: 'rat',
        count: 3,
        progress: 0,
        reward: 'burger',
        xp: 10,
        description: 'AI-written quest text',
        giver: 'guard',
        startTime: Date.now(),
      };
      const generateQuest = vi.fn().mockResolvedValue(quest);
      mockGetVeniceService.mockReturnValue({ generateQuest });
      const ctx = createCtx();

      await handleRequestQuest(ctx, Types.Entities.GUARD);

      expect(generateQuest).toHaveBeenCalledWith('42', 'guard');
      const msg = ctx.send.mock.calls[0][0];
      expect(msg[0]).toBe(Types.Messages.QUEST_OFFER);
      expect(msg[7]).toBe('AI-written quest text');
      // Tracker initializes from the server (progress 0)
      const status = ctx.send.mock.calls[1][0];
      expect(status[0]).toBe(Types.Messages.QUEST_STATUS);
      expect(status[4]).toBe(0);
    });
  });

  // ── handleNewsRequest ──────────────────────────────────────────

  describe('handleNewsRequest', () => {
    it('serves headlines instead of an empty response when Venice is absent', async () => {
      const ctx = createCtx();

      await handleNewsRequest(ctx);

      expect(ctx.send).toHaveBeenCalledTimes(1);
      const msg = ctx.send.mock.calls[0][0];
      expect(msg[0]).toBe(Types.Messages.NEWS_RESPONSE);
      // [NEWS_RESPONSE, ...headlines] — must not be the bare empty response
      expect(msg.length).toBeGreaterThan(1);
      expect(msg.slice(1).every((h: unknown) => typeof h === 'string')).toBe(true);
    });

    it('includes stat-based headlines from recorded world events', async () => {
      // 10 events also busts the newspaper cache (invalidated every 10 events)
      const news = getStaticServices().news;
      for (let i = 0; i < 10; i++) {
        news.recordWorldEvent('kill', 'Alice', { mobType: 'rat' });
      }
      const ctx = createCtx();

      await handleNewsRequest(ctx);

      const headlines: string[] = ctx.send.mock.calls[0][0].slice(1);
      expect(headlines.some((h) => h.includes('Alice'))).toBe(true);
      expect(headlines.some((h) => h.includes('10'))).toBe(true);
    });

    it('delegates to Venice when the service is present', async () => {
      const generateNewspaper = vi.fn().mockResolvedValue({
        headlines: ['AI headline of the day'],
        generatedAt: Date.now(),
      });
      mockGetVeniceService.mockReturnValue({ generateNewspaper });
      const ctx = createCtx();

      await handleNewsRequest(ctx);

      expect(generateNewspaper).toHaveBeenCalledOnce();
      const msg = ctx.send.mock.calls[0][0];
      expect(msg[0]).toBe(Types.Messages.NEWS_RESPONSE);
      expect(msg.slice(1)).toEqual(['AI headline of the day']);
    });
  });

  // ── quest completion loop (no-AI mode) ─────────────────────────

  describe('quest completion loop (no-AI mode)', () => {
    it('completes a template kill quest through kill progress', async () => {
      const ctx = createCtx(777);

      // Offer: fresh player gets the rat kill quest (count 3)
      await handleRequestQuest(ctx, Types.Entities.GUARD);
      expect(ctx.send).toHaveBeenCalledTimes(2); // QUEST_OFFER + QUEST_STATUS
      const offer = ctx.send.mock.calls[0][0];
      expect(offer[0]).toBe(Types.Messages.QUEST_OFFER);
      expect(offer[1]).toBe('kill');
      expect(offer[2]).toBe('rat');
      expect(offer[3]).toBe(3);

      const triggerNarration = vi.fn();
      handleKill(ctx, 'rat', triggerNarration);
      handleKill(ctx, 'rat', triggerNarration);
      expect(ctx.send).toHaveBeenCalledTimes(4); // 2/3 — progress updates only

      // Progress updates carry the quest's current progress
      const p1 = ctx.send.mock.calls[2][0];
      const p2 = ctx.send.mock.calls[3][0];
      expect(p1).toEqual([Types.Messages.QUEST_STATUS, 'kill', 'rat', 3, 1]);
      expect(p2).toEqual([Types.Messages.QUEST_STATUS, 'kill', 'rat', 3, 2]);

      handleKill(ctx, 'rat', triggerNarration);
      expect(ctx.send).toHaveBeenCalledTimes(5);
      // [QUEST_COMPLETE, reward, xp, description]
      const complete = ctx.send.mock.calls[4][0];
      expect(complete[0]).toBe(Types.Messages.QUEST_COMPLETE);
      expect(complete[1]).toBe('burger');
      expect(complete[2]).toBe(10);

      expect(triggerNarration).not.toHaveBeenCalled(); // narration is Venice-only
    });

    it('completes an explore quest through area-change progress', async () => {
      const ctx = createCtx(778);
      // Explore quests unlock at 10+ kills; random >= 0.7 rolls explore
      const statics = getStaticServices();
      for (let i = 0; i < 10; i++) statics.profiles.recordKill(ctx.id.toString(), 'rat');
      const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      try {
        await handleRequestQuest(ctx, Types.Entities.GUARD);
        const offer = ctx.send.mock.calls[0][0];
        expect(offer[0]).toBe(Types.Messages.QUEST_OFFER);
        expect(offer[1]).toBe('explore');
        const targetArea = offer[2]; // real templates: last unvisited (lavaland)
        expect(targetArea).toBe('lavaland');

        ctx.send.mockClear();
        await handleAreaChange(ctx, targetArea, vi.fn());

        const msgs = ctx.send.mock.calls.map((c) => c[0]);
        const complete = msgs.find((m) => m[0] === Types.Messages.QUEST_COMPLETE);
        expect(complete).toBeTruthy();
        expect(complete[1]).toBe('bluesword');
        expect(complete[2]).toBe(75);
      } finally {
        rand.mockRestore();
      }
    });
  });

  // ── quest progress updates (fix: nothing sent QuestStatus) ──────────

  describe('quest progress updates (no-AI mode)', () => {
    it('sends no QUEST_STATUS for a kill that does not match the quest target', async () => {
      const ctx = createCtx(781);

      await handleRequestQuest(ctx, Types.Entities.GUARD); // rat quest, 2 sends
      ctx.send.mockClear();

      handleKill(ctx, 'goblin', vi.fn());

      expect(ctx.send).not.toHaveBeenCalled();
    });

    it('sends no QUEST_STATUS on area change for a kill quest', async () => {
      const ctx = createCtx(782);

      await handleRequestQuest(ctx, Types.Entities.GUARD); // kill quest
      ctx.send.mockClear();

      await handleAreaChange(ctx, 'forest', vi.fn());

      const msgs = ctx.send.mock.calls.map((c) => c[0]);
      expect(msgs.some((m) => m[0] === Types.Messages.QUEST_STATUS)).toBe(false);
    });
  });

  describe('quest progress updates (Venice mode)', () => {
    it('sends QUEST_STATUS on partial kill progress', () => {
      const activeQuest = {
        type: 'kill', target: 'rat', count: 3, progress: 1,
        reward: 'burger', xp: 10, description: 'd', giver: 'guard', startTime: Date.now(),
      };
      mockGetVeniceService.mockReturnValue({
        getProfile: vi.fn(() => ({ totalKills: 5, areas: [] })),
        recordKill: vi.fn(() => null),
        getQuestStatus: vi.fn(() => activeQuest),
      });
      const ctx = createCtx(83);

      handleKill(ctx, 'rat', vi.fn());

      expect(ctx.send).toHaveBeenCalledTimes(1);
      expect(ctx.send.mock.calls[0][0]).toEqual([Types.Messages.QUEST_STATUS, 'kill', 'rat', 3, 1]);
    });

    it('grants rewards on completion', () => {
      const result = { completed: true, reward: 'burger', xp: 10, description: 'd' };
      mockGetVeniceService.mockReturnValue({
        getProfile: vi.fn(() => ({ totalKills: 5, areas: [] })),
        recordKill: vi.fn(() => result),
        getQuestStatus: vi.fn(() => null),
      });
      const ctx = createFullCtx(84);

      handleKill(ctx, 'rat', vi.fn());

      const msgs = ctx.send.mock.calls.map((c) => c[0]);
      expect(msgs.some((m) => Array.isArray(m) && m[0] === Types.Messages.QUEST_COMPLETE)).toBe(true);
      expect(ctx.grantXP).toHaveBeenCalledWith(10);
      expect(ctx._inventory.addItem).toHaveBeenCalledWith(Types.Entities.BURGER, null, 1);
    });
  });

  // ── quest rewards granted (fix: completion gave nothing) ────────────

  describe('quest rewards (no-AI mode)', () => {
    it('grants XP and adds the reward item to inventory on completion', async () => {
      const ctx = createFullCtx(790);

      await handleRequestQuest(ctx, Types.Entities.GUARD); // rat x3 → burger + 10xp
      handleKill(ctx, 'rat', vi.fn());
      handleKill(ctx, 'rat', vi.fn());
      handleKill(ctx, 'rat', vi.fn());

      expect(ctx.grantXP).toHaveBeenCalledWith(10);
      expect(ctx._inventory.addItem).toHaveBeenCalledWith(Types.Entities.BURGER, null, 1);

      const msgs = ctx.send.mock.calls.map((c) => c[0]);
      const invAdd = msgs.find((m) => Array.isArray(m) && m[0] === Types.Messages.INVENTORY_ADD);
      expect(invAdd).toBeTruthy();
      expect(invAdd[1]).toBe(0); // slot index
      expect(invAdd[2]).toBe(Types.Entities.BURGER);
      // Nothing dropped on the ground
      expect(ctx._world.createItemWithProperties).not.toHaveBeenCalled();
    });

    it('drops the reward at the player feet when inventory is full', async () => {
      const ctx = createFullCtx(791);
      ctx._inventory.hasRoom.mockReturnValue(false);

      await handleRequestQuest(ctx, Types.Entities.GUARD);
      handleKill(ctx, 'rat', vi.fn());
      handleKill(ctx, 'rat', vi.fn());
      handleKill(ctx, 'rat', vi.fn());

      expect(ctx.grantXP).toHaveBeenCalledWith(10);
      expect(ctx._inventory.addItem).not.toHaveBeenCalled();
      expect(ctx._world.createItemWithProperties).toHaveBeenCalledWith(Types.Entities.BURGER, 33, 44, null);
      expect(ctx._world.addItem).toHaveBeenCalledWith({ id: 9001 });
      expect(ctx.broadcast).toHaveBeenCalledTimes(1);
      // INVENTORY_ADD was not sent
      const msgs = ctx.send.mock.calls.map((c) => c[0]);
      expect(msgs.some((m) => Array.isArray(m) && m[0] === Types.Messages.INVENTORY_ADD)).toBe(false);
    });

    it('still grants XP when the reward string is not a known entity kind', async () => {
      const result = { completed: true, reward: 'not_a_real_item', xp: 25, description: 'd' };
      mockGetVeniceService.mockReturnValue({
        getProfile: vi.fn(() => ({ totalKills: 5, areas: [] })),
        recordKill: vi.fn(() => result),
        getQuestStatus: vi.fn(() => null),
      });
      const ctx = createFullCtx(792);

      handleKill(ctx, 'rat', vi.fn());

      expect(ctx.grantXP).toHaveBeenCalledWith(25);
      expect(ctx._inventory.addItem).not.toHaveBeenCalled();
      expect(ctx._world.createItemWithProperties).not.toHaveBeenCalled();
    });
  });

  // ── quest abandon (fix: QUEST_ABANDON was unrouted) ──────────────────

  describe('handleAbandonQuest', () => {
    it('clears the active static quest and confirms with QUEST_STATUS(null)', async () => {
      const ctx = createCtx(795);

      await handleRequestQuest(ctx, Types.Entities.GUARD);
      const statics = getStaticServices();
      expect(statics.quests.hasActiveQuest(ctx.id.toString())).toBe(true);

      ctx.send.mockClear();
      handleAbandonQuest(ctx);

      expect(statics.quests.hasActiveQuest(ctx.id.toString())).toBe(false);
      expect(ctx.send).toHaveBeenCalledTimes(1);
      expect(ctx.send.mock.calls[0][0]).toEqual([Types.Messages.QUEST_STATUS, null]);
    });

    it('confirms with QUEST_STATUS(null) even when no quest is active', () => {
      const ctx = createCtx(796);

      handleAbandonQuest(ctx);

      expect(ctx.send).toHaveBeenCalledTimes(1);
      expect(ctx.send.mock.calls[0][0]).toEqual([Types.Messages.QUEST_STATUS, null]);
    });

    it('abandons through the Venice quest sub-service when Venice is present', () => {
      const abandonQuest = vi.fn(() => true);
      mockGetVeniceService.mockReturnValue({
        getServices: vi.fn(() => ({ quests: { abandonQuest } })),
      });
      const ctx = createCtx(797);

      handleAbandonQuest(ctx);

      expect(abandonQuest).toHaveBeenCalledWith('797');
      expect(ctx.send.mock.calls[0][0]).toEqual([Types.Messages.QUEST_STATUS, null]);
    });
  });

  // ── companion hints (no-AI mode) ───────────────────────────────

  describe('companion hints (no-AI mode)', () => {
    it('sends a static hint on low health without Venice', async () => {
      const ctx = createCtx(42);

      await handleLowHealth(ctx, 0.25);

      expect(ctx.send).toHaveBeenCalledTimes(1);
      const msg = ctx.send.mock.calls[0][0];
      expect(msg[0]).toBe(Types.Messages.COMPANION_HINT);
      expect(typeof msg[1]).toBe('string');
      expect(msg[1].length).toBeGreaterThan(0);
    });

    it('sends a static hint on area change without Venice', async () => {
      const ctx = createCtx(43);
      const triggerNarration = vi.fn();

      await handleAreaChange(ctx, 'forest', triggerNarration);

      const msgs = ctx.send.mock.calls.map((c) => c[0]);
      expect(msgs.some((m) => m[0] === Types.Messages.COMPANION_HINT)).toBe(true);
      expect(triggerNarration).not.toHaveBeenCalled();
    });

    it('sends a static hint on death without Venice', async () => {
      const ctx = createCtx(44);
      const triggerNarration = vi.fn();

      await handleDeath(ctx, 'skeleton', triggerNarration);

      const msgs = ctx.send.mock.calls.map((c) => c[0]);
      expect(msgs.some((m) => m[0] === Types.Messages.COMPANION_HINT)).toBe(true);
      expect(triggerNarration).not.toHaveBeenCalled();
    });
  });

  // ── disconnect cleanup (no-AI mode) ─────────────────────────────

  describe('cleanupVenice (no-AI mode)', () => {
    it('clears static per-player state on disconnect', async () => {
      const ctx = createCtx(45);

      await handleRequestQuest(ctx, Types.Entities.GUARD);
      const statics = getStaticServices();
      expect(statics.quests.hasActiveQuest(ctx.id.toString())).toBe(true);
      expect(statics.profiles.getAllProfiles().has(ctx.id.toString())).toBe(true);

      cleanupVenice(ctx.id.toString());

      expect(statics.quests.hasActiveQuest(ctx.id.toString())).toBe(false);
      expect(statics.profiles.getAllProfiles().has(ctx.id.toString())).toBe(false);
    });
  });
});
