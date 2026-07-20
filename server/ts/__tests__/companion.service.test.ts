/**
 * Tests for CompanionService
 * Covers: companion hint generation, static hints, trigger validation,
 *         API fallback behavior, situation description formatting
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('../ai/npc-personalities', () => ({
  COMPANION_TRIGGERS: {
    lowHealth: { threshold: 0.3, hints: ['Heal up!', 'Find food!', 'Run away!'] },
    newArea: { hints: ['Stay alert.', 'Watch for traps.'] },
    nearBoss: { hints: ['Prepare yourself!', 'Dark energy ahead.'] },
    idle: { threshold: 30000, hints: ['Go explore!', 'Adventure awaits!'] },
    firstKill: { hints: ['Well done!', 'Victory!'] },
    death: { hints: ['Rise again!', 'Come back stronger.'] },
  },
}));

import { CompanionService } from '../ai/companion.service';
import { ProfileService } from '../ai/profile.service';

function createMockClient() {
  return { call: vi.fn() } as any;
}

describe('CompanionService', () => {
  let service: CompanionService;
  let client: ReturnType<typeof createMockClient>;
  let profiles: ProfileService;
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = createMockClient();
    profiles = new ProfileService();
    service = new CompanionService(client, profiles);
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  // ── getCompanionHint ───────────────────────────────────────────

  describe('getCompanionHint', () => {
    it('should return null for an unknown trigger', async () => {
      const result = await service.getCompanionHint('p1', 'unknownTrigger');
      expect(result).toBeNull();
    });

    it('should not call the API for an unknown trigger', async () => {
      await service.getCompanionHint('p1', 'unknownTrigger');
      expect(client.call).not.toHaveBeenCalled();
    });

    it('should return a static hint when Math.random < 0.7', async () => {
      randomSpy.mockReturnValue(0.5);
      const result = await service.getCompanionHint('p1', 'lowHealth');

      expect(['Heal up!', 'Find food!', 'Run away!']).toContain(result);
      expect(client.call).not.toHaveBeenCalled();
    });

    it('should return a static hint at the boundary (0.69)', async () => {
      randomSpy.mockReturnValue(0.69);
      const result = await service.getCompanionHint('p1', 'newArea');

      expect(['Stay alert.', 'Watch for traps.']).toContain(result);
      expect(client.call).not.toHaveBeenCalled();
    });

    it('should call the API when Math.random >= 0.7', async () => {
      randomSpy.mockReturnValue(0.8);
      client.call.mockResolvedValue('AI-generated hint');
      const result = await service.getCompanionHint('p1', 'lowHealth');

      expect(result).toBe('AI-generated hint');
      expect(client.call).toHaveBeenCalledOnce();
    });

    it('should include situation description in the API prompt', async () => {
      randomSpy.mockReturnValue(0.8);
      client.call.mockResolvedValue('Hint');
      await service.getCompanionHint('p1', 'lowHealth', { percent: 15 });

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Player health is critical (15%)');
    });

    it('should include player stats in the API prompt', async () => {
      profiles.recordKill('p1', 'goblin');
      profiles.recordKill('p1', 'goblin');
      profiles.recordDeath('p1');

      randomSpy.mockReturnValue(0.8);
      client.call.mockResolvedValue('Hint');
      await service.getCompanionHint('p1', 'nearBoss');

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('2 kills');
      expect(prompt).toContain('1 deaths');
    });

    it('should fall back to a random static hint when API returns null', async () => {
      randomSpy.mockReturnValue(0.8);
      client.call.mockResolvedValue(null);
      const result = await service.getCompanionHint('p1', 'lowHealth');

      // random 0.8 -> index 2 of 3 hints
      expect(result).toBe('Run away!');
    });

    it('should fall back to a random static hint when API throws', async () => {
      randomSpy.mockReturnValue(0.8);
      client.call.mockRejectedValue(new Error('API failure'));
      const result = await service.getCompanionHint('p1', 'death');

      // random 0.8 -> index 1 of 2 hints
      expect(result).toBe('Come back stronger.');
    });

    it('should describe newArea situation correctly', async () => {
      randomSpy.mockReturnValue(0.8);
      client.call.mockResolvedValue('Hint');
      await service.getCompanionHint('p1', 'newArea', { area: 'Dark Forest' });

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Player entered new area: Dark Forest');
    });

    it('should describe nearBoss situation correctly', async () => {
      randomSpy.mockReturnValue(0.8);
      client.call.mockResolvedValue('Hint');
      await service.getCompanionHint('p1', 'nearBoss');

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Player is near a boss monster');
    });

    it('should describe idle situation with time in seconds', async () => {
      randomSpy.mockReturnValue(0.8);
      client.call.mockResolvedValue('Hint');
      await service.getCompanionHint('p1', 'idle', { time: 45000 });

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Player has been idle for 45 seconds');
    });

    it('should describe firstKill situation with mob type', async () => {
      randomSpy.mockReturnValue(0.8);
      client.call.mockResolvedValue('Hint');
      await service.getCompanionHint('p1', 'firstKill', { mobType: 'goblin' });

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Player just killed their first goblin');
    });

    it('should describe death situation with killer', async () => {
      randomSpy.mockReturnValue(0.8);
      client.call.mockResolvedValue('Hint');
      await service.getCompanionHint('p1', 'death', { killer: 'skeleton' });

      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('Player just died to skeleton');
    });
  });

  // ── getStaticHint ──────────────────────────────────────────────

  describe('getStaticHint', () => {
    it('should return a hint from a valid trigger', () => {
      randomSpy.mockReturnValue(0);
      const result = service.getStaticHint('lowHealth');
      expect(['Heal up!', 'Find food!', 'Run away!']).toContain(result);
    });

    it('should return null for an invalid trigger', () => {
      expect(service.getStaticHint('nonexistent')).toBeNull();
    });

    it('should pick a random hint from the list', () => {
      randomSpy.mockReturnValue(0.99);
      const result = service.getStaticHint('lowHealth');
      expect(result).toBe('Run away!');
    });
  });

  // ── no-AI mode (null client) ───────────────────────────────────

  describe('no-AI mode (null client)', () => {
    it('should return a random static hint without any API call', async () => {
      const noAi = new CompanionService(null, new ProfileService());
      // random 0.8 would take the AI path if a client existed
      randomSpy.mockReturnValue(0.8);

      const result = await noAi.getCompanionHint('p1', 'lowHealth');

      expect(result).toBe('Run away!');
    });

    it('should return null for an unknown trigger without a client', async () => {
      const noAi = new CompanionService(null, new ProfileService());

      const result = await noAi.getCompanionHint('p1', 'unknownTrigger');

      expect(result).toBeNull();
    });
  });
});
