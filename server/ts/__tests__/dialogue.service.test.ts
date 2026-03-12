/**
 * Tests for DialogueService
 * Covers: NPC dialogue generation, fallback greetings, personality lookup,
 *         conversation memory management, context building
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

// npc-personalities is NOT mocked — uses the real data.
// Tests reference actual NPC_PERSONALITIES values.

import { DialogueService } from '../ai/dialogue.service';
import { ProfileService } from '../ai/profile.service';

function createMockClient() {
  return { call: vi.fn() } as any;
}

describe('DialogueService', () => {
  let service: DialogueService;
  let client: ReturnType<typeof createMockClient>;
  let profiles: ProfileService;

  beforeEach(() => {
    client = createMockClient();
    profiles = new ProfileService();
    service = new DialogueService(client, profiles);
  });

  // ── generateNpcDialogue ────────────────────────────────────────

  describe('generateNpcDialogue', () => {
    it('should return "..." for an unknown NPC type', async () => {
      const result = await service.generateNpcDialogue('unknown', 'Hero', 'p1');
      expect(result).toBe('...');
    });

    it('should return "..." for unknown NPC regardless of casing', async () => {
      const result = await service.generateNpcDialogue('UNKNOWN', 'Hero', 'p1');
      expect(result).toBe('...');
    });

    it('should not call the API for unknown NPC types', async () => {
      await service.generateNpcDialogue('unknown', 'Hero', 'p1');
      expect(client.call).not.toHaveBeenCalled();
    });

    it('should return a nyan phrase for nyan NPC type', async () => {
      const nyanPhrases = [
        'nyan nyan nyan!',
        'nyan nyan nyan nyan nyan',
        'nyan? nyan nyan!',
      ];
      const result = await service.generateNpcDialogue('nyan', 'Hero', 'p1');
      expect(nyanPhrases).toContain(result);
    });

    it('should handle nyan NPC case-insensitively', async () => {
      const nyanPhrases = [
        'nyan nyan nyan!',
        'nyan nyan nyan nyan nyan',
        'nyan? nyan nyan!',
      ];
      const result = await service.generateNpcDialogue('Nyan', 'Hero', 'p1');
      expect(nyanPhrases).toContain(result);
    });

    it('should not call the API for nyan NPC', async () => {
      await service.generateNpcDialogue('nyan', 'Hero', 'p1');
      expect(client.call).not.toHaveBeenCalled();
    });

    it('should return the API response for a known NPC', async () => {
      client.call.mockResolvedValue('Hail, adventurer!');
      const result = await service.generateNpcDialogue('king', 'Hero', 'p1');
      expect(result).toBe('Hail, adventurer!');
    });

    it('should pass a prompt containing personality and player name to the API', async () => {
      client.call.mockResolvedValue('Response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      expect(client.call).toHaveBeenCalledOnce();
      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('The Steward');
      expect(prompt).toContain('Steward');
      expect(prompt).toContain('SPEECH STYLE');
      expect(prompt).toContain('"Hero"');
    });

    it('should store the API response in conversation memory', async () => {
      client.call.mockResolvedValue('First response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      // Second call should include past meeting context
      client.call.mockResolvedValue('Second response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[1][0] as string;
      expect(prompt).toContain('PAST MEETINGS');
      expect(prompt).toContain('First response');
    });

    it('should fall back to greeting when the API returns null', async () => {
      client.call.mockResolvedValue(null);
      const result = await service.generateNpcDialogue('king', 'Hero', 'p1');
      expect(result).toBe('Another survivor finds their way here. We rebuilt what we could... some things we left buried.');
    });

    it('should not store null responses in memory', async () => {
      client.call.mockResolvedValue(null);
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      // Second call should have no past meetings
      client.call.mockResolvedValue('Later response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[1][0] as string;
      expect(prompt).not.toContain('PAST MEETINGS');
    });

    it('should fall back to greeting when the API throws', async () => {
      client.call.mockRejectedValue(new Error('API down'));
      const result = await service.generateNpcDialogue('guard', 'Hero', 'p1');
      expect(result).toBe('You came from out there? Then you know why we watch.');
    });

    it('should handle NPC type case-insensitively for known NPCs', async () => {
      client.call.mockResolvedValue('Royal greeting!');
      const result = await service.generateNpcDialogue('King', 'Hero', 'p1');
      expect(result).toBe('Royal greeting!');
    });
  });

  // ── getFallback ────────────────────────────────────────────────

  describe('getFallback', () => {
    it('should return the greeting for a known NPC', () => {
      expect(service.getFallback('king')).toBe('Another survivor finds their way here. We rebuilt what we could... some things we left buried.');
    });

    it('should return the greeting for another known NPC', () => {
      expect(service.getFallback('guard')).toBe('You came from out there? Then you know why we watch.');
    });

    it('should return "..." for an unknown NPC', () => {
      expect(service.getFallback('dragon')).toBe('...');
    });

    it('should handle casing insensitively', () => {
      expect(service.getFallback('KING')).toBe('Another survivor finds their way here. We rebuilt what we could... some things we left buried.');
    });
  });

  // ── getPersonality ─────────────────────────────────────────────

  describe('getPersonality', () => {
    it('should return personality data for a known NPC', () => {
      const personality = service.getPersonality('king');
      expect(personality).toBeDefined();
      expect(personality!.name).toBe('The Steward');
      expect(personality!.greeting).toContain('Another survivor');
    });

    it('should return undefined for an unknown NPC', () => {
      expect(service.getPersonality('dragon')).toBeUndefined();
    });

    it('should handle casing insensitively', () => {
      expect(service.getPersonality('Guard')).toBeDefined();
      expect(service.getPersonality('Guard')!.name).toBeDefined();
    });
  });

  // ── cleanup ────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('should remove all conversation memory for a player', async () => {
      client.call.mockResolvedValue('Hello again!');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      service.cleanup('p1');

      // After cleanup, no past meetings should appear
      client.call.mockResolvedValue('Fresh start');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[1][0] as string;
      expect(prompt).not.toContain('PAST MEETINGS');
    });

    it('should not affect other players memory', async () => {
      client.call.mockResolvedValue('Response for p1');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      client.call.mockResolvedValue('Response for p2');
      await service.generateNpcDialogue('king', 'Alice', 'p2');

      service.cleanup('p1');

      // p2 should still have memory
      client.call.mockResolvedValue('Follow up');
      await service.generateNpcDialogue('king', 'Alice', 'p2');

      const prompt = client.call.mock.calls[2][0] as string;
      expect(prompt).toContain('PAST MEETINGS');
    });

    it('should be safe to call for a non-existent player', () => {
      expect(() => service.cleanup('nonexistent')).not.toThrow();
    });
  });

  // ── Conversation memory ────────────────────────────────────────

  describe('conversation memory', () => {
    it('should store multiple exchanges per NPC', async () => {
      client.call.mockResolvedValueOnce('Response 1');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      client.call.mockResolvedValueOnce('Response 2');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      client.call.mockResolvedValueOnce('Response 3');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[2][0] as string;
      expect(prompt).toContain("spoken 2 times before");
      expect(prompt).toContain('Response 2');
    });

    it('should trim memory to 5 exchanges', async () => {
      for (let i = 1; i <= 6; i++) {
        client.call.mockResolvedValueOnce(`Response ${i}`);
        await service.generateNpcDialogue('king', 'Hero', 'p1');
      }

      // 7th call prompt should reference 5 past meetings (since 6 stored, but trimmed to 5)
      client.call.mockResolvedValueOnce('Response 7');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[6][0] as string;
      expect(prompt).toContain("spoken 5 times before");
    });

    it('should keep separate memory per NPC type', async () => {
      client.call.mockResolvedValueOnce('King response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      client.call.mockResolvedValueOnce('Guard response');
      await service.generateNpcDialogue('guard', 'Hero', 'p1');

      // King should show 1 past meeting referencing king response
      client.call.mockResolvedValueOnce('King follow-up');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const kingPrompt = client.call.mock.calls[2][0] as string;
      expect(kingPrompt).toContain("spoken 1 times before");
      expect(kingPrompt).toContain('King response');
    });

    it('should include kill stats in context when present', async () => {
      profiles.recordKill('p1', 'goblin');
      profiles.recordKill('p1', 'goblin');

      client.call.mockResolvedValue('Response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Slain 2 monsters');
    });

    it('should include boss kill in context', async () => {
      profiles.recordKill('p1', 'boss');

      client.call.mockResolvedValue('Response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Defeated the boss');
    });

    it('should include skeleton slayer status when kills exceed 10', async () => {
      for (let i = 0; i < 11; i++) {
        profiles.recordKill('p1', 'skeleton');
      }

      client.call.mockResolvedValue('Response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Skeleton slayer');
    });

    it('should include death count when deaths exceed 3', async () => {
      for (let i = 0; i < 4; i++) {
        profiles.recordDeath('p1');
      }
      // Need at least one kill to enter the PLAYER STATUS block
      profiles.recordKill('p1', 'rat');

      client.call.mockResolvedValue('Response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Has died 4 times');
    });

    it('should include explored areas in context', async () => {
      profiles.recordArea('p1', 'forest');
      profiles.recordArea('p1', 'cave');

      client.call.mockResolvedValue('Response');
      await service.generateNpcDialogue('king', 'Hero', 'p1');

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('EXPLORED: forest, cave');
    });
  });
});
