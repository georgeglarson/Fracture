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
import { handleRequestQuest, handleNewsRequest } from '../player/venice.handler';
import { getStaticServices } from '../ai/static-services';

function createCtx() {
  return { id: 42, name: 'Hero', send: vi.fn() };
}

describe('VeniceHandler no-AI mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVeniceService.mockReturnValue(null);
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
});
