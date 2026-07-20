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
  cleanupVenice,
} from '../player/venice.handler';
import { getStaticServices, resetStaticServices } from '../ai/static-services';

function createCtx(id = 42) {
  return { id, name: 'Hero', send: vi.fn() };
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

      expect(ctx.send).toHaveBeenCalledTimes(1);
      // [QUEST_OFFER, type, target, count, progress, reward, xp, description]
      const msg = ctx.send.mock.calls[0][0];
      expect(msg[0]).toBe(Types.Messages.QUEST_OFFER);
      expect(msg[1]).toBe('kill');
      expect(msg[7]).toMatch(/^Defeat \d+ \w+!$/);
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
      expect(ctx.send).toHaveBeenCalledTimes(1);
      const offer = ctx.send.mock.calls[0][0];
      expect(offer[0]).toBe(Types.Messages.QUEST_OFFER);
      expect(offer[1]).toBe('kill');
      expect(offer[2]).toBe('rat');
      expect(offer[3]).toBe(3);

      const triggerNarration = vi.fn();
      handleKill(ctx, 'rat', triggerNarration);
      handleKill(ctx, 'rat', triggerNarration);
      expect(ctx.send).toHaveBeenCalledTimes(1); // 2/3 — not complete yet

      handleKill(ctx, 'rat', triggerNarration);
      expect(ctx.send).toHaveBeenCalledTimes(2);
      // [QUEST_COMPLETE, reward, xp, description]
      const complete = ctx.send.mock.calls[1][0];
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
