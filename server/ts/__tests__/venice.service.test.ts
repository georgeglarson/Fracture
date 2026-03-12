/**
 * Tests for VeniceService (facade)
 * Covers: construction, delegation to all 8 sub-services, item lore caching,
 *         cleanupPlayer, getServices, singleton management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock sub-service constructors ────────────────────────────────────
// We are testing the facade, not the sub-services, so every dependency
// is replaced with a lightweight stub.  Arrow functions cannot be used
// with `new`, so each mock uses `function()` syntax.

const mockClientCall = vi.fn();
const mockClientGetMetrics = vi.fn();
const mockClientHealthCheck = vi.fn();

vi.mock('../ai/venice-client', () => ({
  VeniceClient: vi.fn().mockImplementation(function (this: any) {
    this.call = mockClientCall;
    this.getMetrics = mockClientGetMetrics;
    this.healthCheck = mockClientHealthCheck;
  }),
}));

const mockGetProfile = vi.fn().mockReturnValue({
  kills: {}, totalKills: 0, areas: [], items: [], deaths: 0,
  lastActive: 0, questsCompleted: 0,
});
const mockRecordKill = vi.fn().mockReturnValue({ isMilestone: false });
const mockRecordArea = vi.fn().mockReturnValue(true);
const mockRecordItem = vi.fn();
const mockRecordDeath = vi.fn();
const mockProfileCleanup = vi.fn();

vi.mock('../ai/profile.service', () => ({
  ProfileService: vi.fn().mockImplementation(function (this: any) {
    this.getProfile = mockGetProfile;
    this.recordKill = mockRecordKill;
    this.recordArea = mockRecordArea;
    this.recordItem = mockRecordItem;
    this.recordDeath = mockRecordDeath;
    this.cleanup = mockProfileCleanup;
  }),
}));

const mockGenerateNpcDialogue = vi.fn().mockResolvedValue('Hello adventurer!');
const mockGetFallback = vi.fn().mockReturnValue('Greetings.');
const mockGetPersonality = vi.fn().mockReturnValue({ name: 'Guard', personality: 'stern' });
const mockDialogueCleanup = vi.fn();

vi.mock('../ai/dialogue.service', () => ({
  DialogueService: vi.fn().mockImplementation(function (this: any) {
    this.generateNpcDialogue = mockGenerateNpcDialogue;
    this.getFallback = mockGetFallback;
    this.getPersonality = mockGetPersonality;
    this.cleanup = mockDialogueCleanup;
  }),
}));

const mockGenerateQuest = vi.fn().mockResolvedValue({
  type: 'kill', target: 'rat', count: 3, progress: 0,
  reward: 'burger', xp: 10, description: 'Kill rats', giver: 'guard', startTime: 0,
});
const mockCheckQuestProgress = vi.fn().mockReturnValue(null);
const mockGetQuestStatus = vi.fn().mockReturnValue(null);
const mockQuestCleanup = vi.fn();

vi.mock('../ai/quest.service', () => ({
  QuestService: vi.fn().mockImplementation(function (this: any) {
    this.generateQuest = mockGenerateQuest;
    this.checkQuestProgress = mockCheckQuestProgress;
    this.getQuestStatus = mockGetQuestStatus;
    this.cleanup = mockQuestCleanup;
  }),
}));

const mockGetCompanionHint = vi.fn().mockResolvedValue('Watch out!');

vi.mock('../ai/companion.service', () => ({
  CompanionService: vi.fn().mockImplementation(function (this: any) {
    this.getCompanionHint = mockGetCompanionHint;
  }),
}));

const mockGenerateNarration = vi.fn().mockResolvedValue({ text: 'A tale unfolds...' });
const mockGetStaticNarration = vi.fn().mockReturnValue({ text: 'Static narration.' });

vi.mock('../ai/narrator.service', () => ({
  NarratorService: vi.fn().mockImplementation(function (this: any) {
    this.generateNarration = mockGenerateNarration;
    this.getStaticNarration = mockGetStaticNarration;
  }),
}));

const mockGetEntityThought = vi.fn().mockReturnValue({ thought: 'Hmm...', state: 'idle' });
const mockGenerateAIThought = vi.fn().mockResolvedValue('Deep thought.');
const mockGetBatchThoughts = vi.fn().mockReturnValue([]);

vi.mock('../ai/thought.service', () => ({
  ThoughtService: vi.fn().mockImplementation(function (this: any) {
    this.getEntityThought = mockGetEntityThought;
    this.generateAIThought = mockGenerateAIThought;
    this.getBatchThoughts = mockGetBatchThoughts;
  }),
}));

const mockRecordWorldEvent = vi.fn();
const mockGenerateNewspaper = vi.fn().mockResolvedValue({ headline: 'Breaking news!' });
const mockGetQuickStats = vi.fn().mockReturnValue({ totalKills: 0 });

vi.mock('../ai/news.service', () => ({
  NewsService: vi.fn().mockImplementation(function (this: any) {
    this.recordWorldEvent = mockRecordWorldEvent;
    this.generateNewspaper = mockGenerateNewspaper;
    this.getQuickStats = mockGetQuickStats;
  }),
}));

// Mock npc-personalities for dynamic import in generateItemLore
vi.mock('../ai/npc-personalities.js', () => ({
  ITEM_CONTEXTS: {
    sword: { type: 'weapon', era: 'Ancient', origin: 'Forged in dragon fire' },
    shield: { type: 'armor', era: 'Medieval', origin: 'Crafted by dwarves' },
  },
}));

// ── Import after mocks ──────────────────────────────────────────────

import {
  VeniceService,
  initVeniceService,
  getVeniceService,
  getVeniceClient,
} from '../ai/venice.service';
import { VeniceClient } from '../ai/venice-client';
import { ProfileService } from '../ai/profile.service';
import { DialogueService } from '../ai/dialogue.service';
import { QuestService } from '../ai/quest.service';
import { CompanionService } from '../ai/companion.service';
import { NarratorService } from '../ai/narrator.service';
import { ThoughtService } from '../ai/thought.service';
import { NewsService } from '../ai/news.service';

// ─────────────────────────────────────────────────────────────────────

describe('VeniceService', () => {
  let service: VeniceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VeniceService('test-key', { model: 'test-model', timeout: 1000 });
  });

  // ── Construction ───────────────────────────────────────────────────

  describe('construction', () => {
    it('should create VeniceClient with apiKey and options', () => {
      expect(VeniceClient).toHaveBeenCalledWith('test-key', { model: 'test-model', timeout: 1000 });
    });

    it('should create all 7 sub-services', () => {
      expect(ProfileService).toHaveBeenCalledOnce();
      expect(DialogueService).toHaveBeenCalledOnce();
      expect(QuestService).toHaveBeenCalledOnce();
      expect(CompanionService).toHaveBeenCalledOnce();
      expect(NarratorService).toHaveBeenCalledOnce();
      expect(ThoughtService).toHaveBeenCalledOnce();
      expect(NewsService).toHaveBeenCalledOnce();
    });

    it('should work without options', () => {
      const basic = new VeniceService('key-only');
      expect(VeniceClient).toHaveBeenCalledWith('key-only', undefined);
    });
  });

  // ── Profile delegation ─────────────────────────────────────────────

  describe('profile delegation', () => {
    it('should delegate getProfile to ProfileService', () => {
      const profile = service.getProfile('player1');

      expect(mockGetProfile).toHaveBeenCalledWith('player1');
      expect(profile).toEqual(expect.objectContaining({ kills: {}, deaths: 0 }));
    });

    it('should delegate recordKill and check quest progress', () => {
      service.recordKill('player1', 'goblin');

      expect(mockRecordKill).toHaveBeenCalledWith('player1', 'goblin');
      expect(mockCheckQuestProgress).toHaveBeenCalledWith('player1', 'kill', 'goblin');
    });

    it('should return quest result from recordKill when quest completes', () => {
      const questResult = { completed: true, reward: 'axe', xp: 30, description: 'Kill goblins' };
      mockCheckQuestProgress.mockReturnValueOnce(questResult);

      const result = service.recordKill('player1', 'goblin');

      expect(result).toEqual(questResult);
    });

    it('should delegate recordArea and check quest progress when area is new', () => {
      mockRecordArea.mockReturnValueOnce(true);

      service.recordArea('player1', 'forest');

      expect(mockRecordArea).toHaveBeenCalledWith('player1', 'forest');
      expect(mockCheckQuestProgress).toHaveBeenCalledWith('player1', 'explore', 'forest');
    });

    it('should not check quest progress when area is already visited', () => {
      mockRecordArea.mockReturnValueOnce(false);

      const result = service.recordArea('player1', 'village');

      expect(mockRecordArea).toHaveBeenCalledWith('player1', 'village');
      expect(mockCheckQuestProgress).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should delegate recordItem to ProfileService', () => {
      service.recordItem('player1', 'sword');

      expect(mockRecordItem).toHaveBeenCalledWith('player1', 'sword');
    });

    it('should delegate recordDeath to ProfileService', () => {
      service.recordDeath('player1');

      expect(mockRecordDeath).toHaveBeenCalledWith('player1');
    });
  });

  // ── Dialogue delegation ────────────────────────────────────────────

  describe('dialogue delegation', () => {
    it('should delegate generateNpcDialogue to DialogueService', async () => {
      const result = await service.generateNpcDialogue('guard', 'Hero', 'player1');

      expect(mockGenerateNpcDialogue).toHaveBeenCalledWith('guard', 'Hero', 'player1');
      expect(result).toBe('Hello adventurer!');
    });

    it('should delegate getFallback to DialogueService', () => {
      const result = service.getFallback('merchant');

      expect(mockGetFallback).toHaveBeenCalledWith('merchant');
      expect(result).toBe('Greetings.');
    });

    it('should delegate getPersonality to DialogueService', () => {
      const result = service.getPersonality('guard');

      expect(mockGetPersonality).toHaveBeenCalledWith('guard');
      expect(result).toEqual({ name: 'Guard', personality: 'stern' });
    });
  });

  // ── Quest delegation ───────────────────────────────────────────────

  describe('quest delegation', () => {
    it('should delegate generateQuest to QuestService', async () => {
      const quest = await service.generateQuest('player1', 'guard');

      expect(mockGenerateQuest).toHaveBeenCalledWith('player1', 'guard');
      expect(quest).toEqual(expect.objectContaining({ type: 'kill', target: 'rat' }));
    });

    it('should delegate checkQuestProgress to QuestService', () => {
      service.checkQuestProgress('player1', 'kill', 'rat');

      expect(mockCheckQuestProgress).toHaveBeenCalledWith('player1', 'kill', 'rat');
    });

    it('should delegate getQuestStatus to QuestService', () => {
      service.getQuestStatus('player1');

      expect(mockGetQuestStatus).toHaveBeenCalledWith('player1');
    });
  });

  // ── Companion delegation ───────────────────────────────────────────

  describe('companion delegation', () => {
    it('should delegate getCompanionHint to CompanionService', async () => {
      const result = await service.getCompanionHint('player1', 'lowHealth', { health: 10 } as any);

      expect(mockGetCompanionHint).toHaveBeenCalledWith('player1', 'lowHealth', { health: 10 });
      expect(result).toBe('Watch out!');
    });

    it('should delegate getCompanionHint without optional data', async () => {
      const result = await service.getCompanionHint('player1', 'idle');

      expect(mockGetCompanionHint).toHaveBeenCalledWith('player1', 'idle', undefined);
      expect(result).toBe('Watch out!');
    });
  });

  // ── Narrator delegation ────────────────────────────────────────────

  describe('narrator delegation', () => {
    it('should delegate generateNarration to NarratorService', async () => {
      const result = await service.generateNarration('levelUp', 'Hero', 'player1', { level: 5 });

      expect(mockGenerateNarration).toHaveBeenCalledWith('levelUp', 'Hero', 'player1', { level: 5 });
      expect(result).toEqual({ text: 'A tale unfolds...' });
    });

    it('should delegate getStaticNarration to NarratorService', () => {
      const result = service.getStaticNarration('spawn', 'Hero', { zone: 'village' });

      expect(mockGetStaticNarration).toHaveBeenCalledWith('spawn', 'Hero', { zone: 'village' });
      expect(result).toEqual({ text: 'Static narration.' });
    });
  });

  // ── Thought delegation ─────────────────────────────────────────────

  describe('thought delegation', () => {
    it('should delegate getEntityThought to ThoughtService', () => {
      const result = service.getEntityThought('rat', 'idle' as any, { nearbyPlayers: ['Hero'] } as any);

      expect(mockGetEntityThought).toHaveBeenCalledWith('rat', 'idle', { nearbyPlayers: ['Hero'] });
      expect(result).toEqual({ thought: 'Hmm...', state: 'idle' });
    });

    it('should delegate generateAIThought to ThoughtService', async () => {
      const result = await service.generateAIThought('dragon', 'combat', { targetName: 'Hero' });

      expect(mockGenerateAIThought).toHaveBeenCalledWith('dragon', 'combat', { targetName: 'Hero' });
      expect(result).toBe('Deep thought.');
    });

    it('should delegate getBatchThoughts to ThoughtService', () => {
      const entities = [{ entityType: 'rat', state: 'idle' as any }] as any;
      service.getBatchThoughts(entities);

      expect(mockGetBatchThoughts).toHaveBeenCalledWith(entities);
    });
  });

  // ── News delegation ────────────────────────────────────────────────

  describe('news delegation', () => {
    it('should delegate recordWorldEvent to NewsService', () => {
      service.recordWorldEvent('kill', 'Hero', { mobType: 'dragon' });

      expect(mockRecordWorldEvent).toHaveBeenCalledWith('kill', 'Hero', { mobType: 'dragon' });
    });

    it('should delegate generateNewspaper to NewsService', async () => {
      const result = await service.generateNewspaper();

      expect(mockGenerateNewspaper).toHaveBeenCalledOnce();
      expect(result).toEqual({ headline: 'Breaking news!' });
    });

    it('should delegate getQuickStats to NewsService', () => {
      const result = service.getQuickStats();

      expect(mockGetQuickStats).toHaveBeenCalledOnce();
      expect(result).toEqual({ totalKills: 0 });
    });
  });

  // ── Item lore (inline logic) ───────────────────────────────────────

  describe('generateItemLore', () => {
    it('should call client and cache result for known items', async () => {
      mockClientCall.mockResolvedValueOnce('A blade of ancient power.');

      const result = await service.generateItemLore('sword');

      expect(mockClientCall).toHaveBeenCalledOnce();
      expect(mockClientCall).toHaveBeenCalledWith(expect.stringContaining('weapon'));
      expect(result).toBe('A blade of ancient power.');
    });

    it('should return cached value on second call', async () => {
      mockClientCall.mockResolvedValueOnce('A blade of ancient power.');

      await service.generateItemLore('sword');
      const result = await service.generateItemLore('sword');

      expect(mockClientCall).toHaveBeenCalledOnce();
      expect(result).toBe('A blade of ancient power.');
    });

    it('should return mystery text for unknown items', async () => {
      const result = await service.generateItemLore('unknownThing');

      expect(mockClientCall).not.toHaveBeenCalled();
      expect(result).toBe('A mysterious item of unknown origin.');
    });

    it('should fall back to era-based text when API returns null', async () => {
      mockClientCall.mockResolvedValueOnce(null);

      const result = await service.generateItemLore('sword');

      expect(result).toBe('An item of Ancient origin.');
    });

    it('should fall back to era-based text on API error', async () => {
      mockClientCall.mockRejectedValueOnce(new Error('API down'));

      const result = await service.generateItemLore('shield');

      expect(result).toBe('An item of Medieval origin.');
    });

    it('should cache the fallback value on API failure', async () => {
      mockClientCall.mockRejectedValueOnce(new Error('API down'));

      await service.generateItemLore('shield');
      const result = await service.generateItemLore('shield');

      expect(mockClientCall).toHaveBeenCalledOnce();
      expect(result).toBe('An item of Medieval origin.');
    });

    it('should be case-insensitive for item type lookup', async () => {
      mockClientCall.mockResolvedValueOnce('A mighty blade.');

      const result = await service.generateItemLore('SWORD');

      expect(mockClientCall).toHaveBeenCalledOnce();
      expect(result).toBe('A mighty blade.');
    });
  });

  // ── cleanupPlayer ──────────────────────────────────────────────────

  describe('cleanupPlayer', () => {
    it('should call cleanup on profile, dialogue, and quest services', () => {
      service.cleanupPlayer('player1');

      expect(mockProfileCleanup).toHaveBeenCalledWith('player1');
      expect(mockDialogueCleanup).toHaveBeenCalledWith('player1');
      expect(mockQuestCleanup).toHaveBeenCalledWith('player1');
    });
  });

  // ── getServices ────────────────────────────────────────────────────

  describe('getServices', () => {
    it('should return all sub-services', () => {
      const services = service.getServices();

      expect(services).toHaveProperty('client');
      expect(services).toHaveProperty('profiles');
      expect(services).toHaveProperty('dialogue');
      expect(services).toHaveProperty('quests');
      expect(services).toHaveProperty('companion');
      expect(services).toHaveProperty('narrator');
      expect(services).toHaveProperty('thoughts');
      expect(services).toHaveProperty('news');
    });

    it('should return the same instances used internally', () => {
      const services = service.getServices();

      // The client mock should have the `call` method we set up
      expect(services.client).toHaveProperty('call');
      expect(services.profiles).toHaveProperty('getProfile');
    });
  });

  // ── Singleton management ───────────────────────────────────────────

  describe('singleton management', () => {
    it('should create and return a singleton via initVeniceService', () => {
      const svc = initVeniceService('singleton-key', { model: 'singleton-model' });

      expect(svc).toBeInstanceOf(VeniceService);
      expect(getVeniceService()).toBe(svc);
    });

    it('should return the singleton from getVeniceService after init', () => {
      const svc = initVeniceService('key-1');

      expect(getVeniceService()).toBe(svc);
    });

    it('should overwrite singleton on subsequent initVeniceService calls', () => {
      const first = initVeniceService('key-1');
      const second = initVeniceService('key-2');

      expect(getVeniceService()).toBe(second);
      expect(getVeniceService()).not.toBe(first);
    });

    it('should return client from getVeniceClient when singleton exists', () => {
      initVeniceService('key-1');

      const client = getVeniceClient();

      expect(client).not.toBeNull();
      expect(client).toHaveProperty('call');
    });

    it('should return the client belonging to the singleton', () => {
      const svc = initVeniceService('key-1');
      const client = getVeniceClient();

      expect(client).toBe(svc.getServices().client);
    });
  });
});
