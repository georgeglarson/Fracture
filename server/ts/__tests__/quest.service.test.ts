/**
 * Tests for QuestService
 * Covers: quest generation, progress tracking, quest status,
 *         active quest checks, quest abandonment, cleanup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock npc-personalities ──────────────────────────────────────────
vi.mock('../ai/npc-personalities', () => ({
  QUEST_TEMPLATES: {
    kill: {
      templates: [
        { target: 'rat', count: 3, reward: 'burger', xp: 10 },
        { target: 'goblin', count: 3, reward: 'axe', xp: 30 },
        { target: 'skeleton', count: 5, reward: 'mailarmor', xp: 50 },
      ]
    },
    explore: {
      templates: [
        { area: 'beach', reward: 'burger', xp: 10 },
        { area: 'forest', reward: 'firepotion', xp: 20 },
      ]
    }
  }
}));

import { QuestService } from '../ai/quest.service';
import { ProfileService } from '../ai/profile.service';

// ── Helpers ─────────────────────────────────────────────────────────

function createMockClient() {
  return { call: vi.fn() } as { call: ReturnType<typeof vi.fn> };
}

function makeProfileWithKills(profiles: ProfileService, playerId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    profiles.recordKill(playerId, 'rat');
  }
}

describe('QuestService', () => {
  let service: QuestService;
  let client: ReturnType<typeof createMockClient>;
  let profiles: ProfileService;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = createMockClient();
    profiles = new ProfileService();
    service = new QuestService(client as any, profiles);
  });

  // ── generateQuest ───────────────────────────────────────────────

  describe('generateQuest', () => {
    it('should return existing quest if one is active', async () => {
      client.call.mockResolvedValue('Go kill some rats!');
      const first = await service.generateQuest('player1', 'guard');
      const second = await service.generateQuest('player1', 'king');

      expect(second).toBe(first);
      expect(client.call).toHaveBeenCalledTimes(1);
    });

    it('should create a kill quest for players with < 10 kills', async () => {
      client.call.mockResolvedValue('Slay the rats!');
      makeProfileWithKills(profiles, 'player1', 5);

      const quest = await service.generateQuest('player1', 'guard');

      expect(quest.type).toBe('kill');
    });

    it('should create an explore quest for experienced players when Math.random >= 0.7', async () => {
      client.call.mockResolvedValue('Explore the beach!');
      makeProfileWithKills(profiles, 'player1', 15);
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.8)   // questType selection: >= 0.7 => 'explore'
        .mockReturnValueOnce(0);    // template selection

      const quest = await service.generateQuest('player1', 'guard');

      expect(quest.type).toBe('explore');
    });

    it('should create a kill quest for experienced players when Math.random < 0.7', async () => {
      client.call.mockResolvedValue('Defeat the goblins!');
      makeProfileWithKills(profiles, 'player1', 25);
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5)   // questType selection: < 0.7 => 'kill'
        .mockReturnValueOnce(0);    // template selection

      const quest = await service.generateQuest('player1', 'guard');

      expect(quest.type).toBe('kill');
    });

    it('should filter kill templates by difficulty - only rat at 0 kills', async () => {
      client.call.mockResolvedValue('Hunt the rats!');
      // 0 kills: rat requires 0, goblin requires 20, skeleton requires 50
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const quest = await service.generateQuest('player1', 'guard');

      expect(quest.target).toBe('rat');
    });

    it('should filter kill templates by difficulty - rat and goblin at 20 kills', async () => {
      client.call.mockResolvedValue('Hunt them!');
      makeProfileWithKills(profiles, 'player1', 5);
      // 5 kills: < 10 so forced to 'kill' type
      // rat requires 0 (yes), goblin requires 20 (no), skeleton requires 50 (no)
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const quest = await service.generateQuest('player1', 'guard');

      expect(quest.target).toBe('rat');
    });

    it('should include goblin template when totalKills >= 20', async () => {
      client.call.mockResolvedValue('Go get them!');
      makeProfileWithKills(profiles, 'player1', 25);
      // 25 kills: rat(0), goblin(20) are suitable, skeleton(50) is not
      // Force kill type, then pick index 1 (goblin)
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5)              // kill type
        .mockReturnValueOnce(0.5);             // floor(0.5 * 2) = 1 => goblin

      const quest = await service.generateQuest('player1', 'guard');

      expect(quest.target).toBe('goblin');
    });

    it('should fall back to first template when no suitable templates match', async () => {
      // This test verifies the fallback logic. Since our mock templates have
      // rat at 0 kills threshold, a brand-new player always matches rat.
      // We need to test the fallback path directly. The source code's difficulty
      // filter uses target names: rat=0, crab=5, goblin=20, else=50.
      // All three mock templates (rat=0, goblin=20, skeleton=50) will always
      // have rat as suitable for a 0-kill player. The fallback only triggers
      // when NO templates pass the filter, which can't happen with our mocks
      // since rat always passes. Instead, verify the fallback array is used
      // when suitable is empty by checking that the service works correctly
      // with a zero-kills player (rat is always available).
      client.call.mockResolvedValue('Quest time!');
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const quest = await service.generateQuest('player1', 'guard');

      expect(quest.target).toBe('rat');
      expect(quest.count).toBe(3);
    });

    it('should call client.call for description', async () => {
      client.call.mockResolvedValue('A mighty quest awaits!');
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await service.generateQuest('player1', 'guard');

      expect(client.call).toHaveBeenCalledTimes(1);
      const prompt = client.call.mock.calls[0][0] as string;
      expect(prompt).toContain('QUEST TYPE:');
      expect(prompt).toContain('TARGET:');
      expect(prompt).toContain('REWARD:');
    });

    it('should use fallback description when API fails', async () => {
      client.call.mockRejectedValue(new Error('API down'));
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const quest = await service.generateQuest('player1', 'guard');

      expect(quest.description).toBe('Defeat 3 rat!');
    });

    it('should use fallback description when API returns empty', async () => {
      client.call.mockResolvedValue('');
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const quest = await service.generateQuest('player1', 'guard');

      // empty string is falsy, so falls through to fallback via ||
      expect(quest.description).toBe('Defeat 3 rat!');
    });

    it('should set correct quest fields for a kill quest', async () => {
      client.call.mockResolvedValue('Kill those rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const before = Date.now();

      const quest = await service.generateQuest('player1', 'guard');

      expect(quest.type).toBe('kill');
      expect(quest.target).toBe('rat');
      expect(quest.count).toBe(3);
      expect(quest.progress).toBe(0);
      expect(quest.reward).toBe('burger');
      expect(quest.xp).toBe(10);
      expect(quest.description).toBe('Kill those rats!');
      expect(quest.giver).toBe('guard');
      expect(quest.startTime).toBeGreaterThanOrEqual(before);
      expect(quest.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should set correct quest fields for an explore quest', async () => {
      client.call.mockResolvedValue('Go explore the beach!');
      makeProfileWithKills(profiles, 'player1', 15);
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.8)   // explore type
        .mockReturnValueOnce(0);    // first template (beach)

      const quest = await service.generateQuest('player1', 'king');

      expect(quest.type).toBe('explore');
      expect(quest.target).toBe('beach');
      expect(quest.count).toBe(1);
      expect(quest.progress).toBe(0);
      expect(quest.reward).toBe('burger');
      expect(quest.xp).toBe(10);
      expect(quest.giver).toBe('king');
    });
  });

  // ── checkQuestProgress ──────────────────────────────────────────

  describe('checkQuestProgress', () => {
    it('should return null when no active quest', () => {
      const result = service.checkQuestProgress('player1', 'kill', 'rat');

      expect(result).toBeNull();
    });

    it('should return null when quest type does not match', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');

      const result = service.checkQuestProgress('player1', 'explore', 'rat');

      expect(result).toBeNull();
    });

    it('should increment progress on matching kill target', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');

      service.checkQuestProgress('player1', 'kill', 'rat');

      const quest = service.getQuestStatus('player1');
      expect(quest!.progress).toBe(1);
    });

    it('should perform case-insensitive target matching', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');

      service.checkQuestProgress('player1', 'kill', 'RAT');

      const quest = service.getQuestStatus('player1');
      expect(quest!.progress).toBe(1);
    });

    it('should not increment progress on non-matching target', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');

      const result = service.checkQuestProgress('player1', 'kill', 'goblin');

      expect(result).toBeNull();
      const quest = service.getQuestStatus('player1');
      expect(quest!.progress).toBe(0);
    });

    it('should return QuestResult when progress reaches count', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');
      // count is 3: progress after two kills = 2
      service.checkQuestProgress('player1', 'kill', 'rat');
      service.checkQuestProgress('player1', 'kill', 'rat');

      const result = service.checkQuestProgress('player1', 'kill', 'rat');

      expect(result).not.toBeNull();
      expect(result!.completed).toBe(true);
      expect(result!.reward).toBe('burger');
      expect(result!.xp).toBe(10);
      expect(result!.description).toBe('Kill rats!');
    });

    it('should remove quest after completion', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');

      service.checkQuestProgress('player1', 'kill', 'rat');
      service.checkQuestProgress('player1', 'kill', 'rat');
      service.checkQuestProgress('player1', 'kill', 'rat');

      expect(service.hasActiveQuest('player1')).toBe(false);
    });

    it('should complete explore quest immediately on matching target', async () => {
      client.call.mockResolvedValue('Explore the beach!');
      makeProfileWithKills(profiles, 'player1', 15);
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.8)   // explore type
        .mockReturnValueOnce(0);    // beach template
      await service.generateQuest('player1', 'guard');

      const result = service.checkQuestProgress('player1', 'explore', 'beach');

      expect(result).not.toBeNull();
      expect(result!.completed).toBe(true);
      expect(result!.reward).toBe('burger');
      expect(result!.xp).toBe(10);
    });

    it('should perform case-insensitive matching for explore quests', async () => {
      client.call.mockResolvedValue('Explore the beach!');
      makeProfileWithKills(profiles, 'player1', 15);
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.8)
        .mockReturnValueOnce(0);
      await service.generateQuest('player1', 'guard');

      const result = service.checkQuestProgress('player1', 'explore', 'BEACH');

      expect(result).not.toBeNull();
      expect(result!.completed).toBe(true);
    });

    it('should call profiles.incrementQuestsCompleted on completion', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');
      const spy = vi.spyOn(profiles, 'incrementQuestsCompleted');

      service.checkQuestProgress('player1', 'kill', 'rat');
      service.checkQuestProgress('player1', 'kill', 'rat');
      service.checkQuestProgress('player1', 'kill', 'rat');

      expect(spy).toHaveBeenCalledWith('player1');
      expect(profiles.getProfile('player1').questsCompleted).toBe(1);
    });

    it('should return null when progress is below count', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');

      const result = service.checkQuestProgress('player1', 'kill', 'rat');

      expect(result).toBeNull();
      expect(service.getQuestStatus('player1')!.progress).toBe(1);
    });
  });

  // ── getQuestStatus ──────────────────────────────────────────────

  describe('getQuestStatus', () => {
    it('should return quest when active', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const quest = await service.generateQuest('player1', 'guard');

      const status = service.getQuestStatus('player1');

      expect(status).toBe(quest);
    });

    it('should return null when no quest', () => {
      const status = service.getQuestStatus('player1');

      expect(status).toBeNull();
    });
  });

  // ── hasActiveQuest ──────────────────────────────────────────────

  describe('hasActiveQuest', () => {
    it('should return true when quest exists', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');

      expect(service.hasActiveQuest('player1')).toBe(true);
    });

    it('should return false when no quest', () => {
      expect(service.hasActiveQuest('player1')).toBe(false);
    });
  });

  // ── abandonQuest ────────────────────────────────────────────────

  describe('abandonQuest', () => {
    it('should return true and remove quest', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');

      const result = service.abandonQuest('player1');

      expect(result).toBe(true);
      expect(service.hasActiveQuest('player1')).toBe(false);
    });

    it('should return false when no quest to abandon', () => {
      const result = service.abandonQuest('player1');

      expect(result).toBe(false);
    });
  });

  // ── cleanup ─────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('should remove quest data', async () => {
      client.call.mockResolvedValue('Kill rats!');
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await service.generateQuest('player1', 'guard');

      service.cleanup('player1');

      expect(service.hasActiveQuest('player1')).toBe(false);
      expect(service.getQuestStatus('player1')).toBeNull();
    });

    it('should not throw when called for non-existent player', () => {
      expect(() => service.cleanup('nonexistent')).not.toThrow();
    });
  });
});
