/**
 * Tests for ProfileService
 * Covers: profile creation, kill tracking, area exploration, items,
 *         deaths, quests, query methods, cleanup, multi-player isolation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProfileService } from '../ai/profile.service';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ProfileService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getProfile', () => {
    it('should create a default profile on first access', () => {
      const profile = service.getProfile('player1');

      expect(profile).toEqual({
        kills: {},
        totalKills: 0,
        areas: [],
        items: [],
        deaths: 0,
        lastActive: Date.now(),
        questsCompleted: 0
      });
    });

    it('should return the same profile on subsequent access', () => {
      const first = service.getProfile('player1');
      first.deaths = 5;
      const second = service.getProfile('player1');

      expect(second).toBe(first);
      expect(second.deaths).toBe(5);
    });
  });

  describe('recordKill', () => {
    it('should increment kill count for specific mob type', () => {
      service.recordKill('player1', 'goblin');
      service.recordKill('player1', 'goblin');
      service.recordKill('player1', 'skeleton');

      const profile = service.getProfile('player1');
      expect(profile.kills['goblin']).toBe(2);
      expect(profile.kills['skeleton']).toBe(1);
    });

    it('should increment totalKills across all mob types', () => {
      service.recordKill('player1', 'goblin');
      service.recordKill('player1', 'skeleton');
      service.recordKill('player1', 'goblin');

      const profile = service.getProfile('player1');
      expect(profile.totalKills).toBe(3);
    });

    it('should update lastActive on kill', () => {
      vi.setSystemTime(1000);
      service.getProfile('player1');

      vi.setSystemTime(5000);
      service.recordKill('player1', 'goblin');

      expect(service.getProfile('player1').lastActive).toBe(5000);
    });

    it('should return count equal to totalKills', () => {
      service.recordKill('player1', 'goblin');
      const result = service.recordKill('player1', 'skeleton');

      expect(result.count).toBe(2);
    });

    it('should detect milestone at 10 kills', () => {
      let result;
      for (let i = 0; i < 10; i++) {
        result = service.recordKill('player1', 'goblin');
      }
      expect(result!.isMilestone).toBe(true);
      expect(result!.count).toBe(10);
    });

    it('should detect milestone at 25 kills', () => {
      let result;
      for (let i = 0; i < 25; i++) {
        result = service.recordKill('player1', 'goblin');
      }
      expect(result!.isMilestone).toBe(true);
      expect(result!.count).toBe(25);
    });

    it('should detect milestone at 100 kills', () => {
      let result;
      for (let i = 0; i < 100; i++) {
        result = service.recordKill('player1', 'goblin');
      }
      expect(result!.isMilestone).toBe(true);
    });

    it('should detect milestone at 1000 kills', () => {
      let result;
      for (let i = 0; i < 1000; i++) {
        result = service.recordKill('player1', 'goblin');
      }
      expect(result!.isMilestone).toBe(true);
      expect(result!.count).toBe(1000);
    });

    it('should not flag non-milestone counts', () => {
      let result;
      for (let i = 0; i < 11; i++) {
        result = service.recordKill('player1', 'goblin');
      }
      expect(result!.isMilestone).toBe(false);
      expect(result!.count).toBe(11);
    });
  });

  describe('recordArea', () => {
    it('should return true for a new area', () => {
      const result = service.recordArea('player1', 'forest');

      expect(result).toBe(true);
    });

    it('should return false for a duplicate area', () => {
      service.recordArea('player1', 'forest');
      const result = service.recordArea('player1', 'forest');

      expect(result).toBe(false);
    });

    it('should append new areas to the profile', () => {
      service.recordArea('player1', 'forest');
      service.recordArea('player1', 'cave');
      service.recordArea('player1', 'forest');

      const profile = service.getProfile('player1');
      expect(profile.areas).toEqual(['forest', 'cave']);
    });

    it('should update lastActive for both new and duplicate areas', () => {
      vi.setSystemTime(1000);
      service.recordArea('player1', 'forest');

      vi.setSystemTime(5000);
      service.recordArea('player1', 'forest');

      expect(service.getProfile('player1').lastActive).toBe(5000);
    });
  });

  describe('recordItem', () => {
    it('should append item to the items array', () => {
      service.recordItem('player1', 'sword');
      service.recordItem('player1', 'shield');

      const profile = service.getProfile('player1');
      expect(profile.items).toEqual(['sword', 'shield']);
    });

    it('should allow duplicate items', () => {
      service.recordItem('player1', 'potion');
      service.recordItem('player1', 'potion');

      const profile = service.getProfile('player1');
      expect(profile.items).toEqual(['potion', 'potion']);
    });

    it('should update lastActive', () => {
      vi.setSystemTime(1000);
      service.getProfile('player1');

      vi.setSystemTime(9000);
      service.recordItem('player1', 'sword');

      expect(service.getProfile('player1').lastActive).toBe(9000);
    });
  });

  describe('recordDeath', () => {
    it('should increment death counter and return the count', () => {
      expect(service.recordDeath('player1')).toBe(1);
      expect(service.recordDeath('player1')).toBe(2);
      expect(service.recordDeath('player1')).toBe(3);
    });

    it('should reflect in the profile', () => {
      service.recordDeath('player1');
      service.recordDeath('player1');

      expect(service.getProfile('player1').deaths).toBe(2);
    });
  });

  describe('incrementQuestsCompleted', () => {
    it('should increment and return the count', () => {
      expect(service.incrementQuestsCompleted('player1')).toBe(1);
      expect(service.incrementQuestsCompleted('player1')).toBe(2);
      expect(service.incrementQuestsCompleted('player1')).toBe(3);
    });

    it('should reflect in the profile', () => {
      service.incrementQuestsCompleted('player1');

      expect(service.getProfile('player1').questsCompleted).toBe(1);
    });
  });

  describe('hasKilled', () => {
    it('should return false for an unkilled mob type', () => {
      expect(service.hasKilled('player1', 'dragon')).toBe(false);
    });

    it('should return true after killing a mob type', () => {
      service.recordKill('player1', 'dragon');

      expect(service.hasKilled('player1', 'dragon')).toBe(true);
    });
  });

  describe('getKillCount', () => {
    it('should return 0 for an unkilled mob type', () => {
      expect(service.getKillCount('player1', 'troll')).toBe(0);
    });

    it('should return the correct count after kills', () => {
      service.recordKill('player1', 'troll');
      service.recordKill('player1', 'troll');
      service.recordKill('player1', 'troll');

      expect(service.getKillCount('player1', 'troll')).toBe(3);
    });
  });

  describe('hasExplored', () => {
    it('should return false for an unexplored area', () => {
      expect(service.hasExplored('player1', 'dungeon')).toBe(false);
    });

    it('should return true after exploring an area', () => {
      service.recordArea('player1', 'dungeon');

      expect(service.hasExplored('player1', 'dungeon')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove the player profile', () => {
      service.recordKill('player1', 'goblin');
      service.cleanup('player1');

      expect(service.getAllProfiles().has('player1')).toBe(false);
    });

    it('should return a fresh profile after cleanup on next access', () => {
      service.recordKill('player1', 'goblin');
      service.recordDeath('player1');
      service.cleanup('player1');

      const profile = service.getProfile('player1');
      expect(profile.totalKills).toBe(0);
      expect(profile.deaths).toBe(0);
      expect(profile.kills).toEqual({});
    });

    it('should be a no-op for a non-existent player', () => {
      expect(() => service.cleanup('nonexistent')).not.toThrow();
    });
  });

  describe('getAllProfiles', () => {
    it('should return an empty map initially', () => {
      expect(service.getAllProfiles().size).toBe(0);
    });

    it('should contain all created profiles', () => {
      service.getProfile('player1');
      service.getProfile('player2');

      const all = service.getAllProfiles();
      expect(all.size).toBe(2);
      expect(all.has('player1')).toBe(true);
      expect(all.has('player2')).toBe(true);
    });
  });

  describe('multiple players', () => {
    it('should maintain independent profiles per player', () => {
      service.recordKill('alice', 'goblin');
      service.recordKill('alice', 'goblin');
      service.recordKill('bob', 'skeleton');
      service.recordDeath('bob');
      service.recordArea('alice', 'forest');

      const alice = service.getProfile('alice');
      const bob = service.getProfile('bob');

      expect(alice.totalKills).toBe(2);
      expect(alice.deaths).toBe(0);
      expect(alice.areas).toEqual(['forest']);

      expect(bob.totalKills).toBe(1);
      expect(bob.deaths).toBe(1);
      expect(bob.areas).toEqual([]);
    });

    it('should not affect other players on cleanup', () => {
      service.recordKill('alice', 'goblin');
      service.recordKill('bob', 'skeleton');
      service.cleanup('alice');

      expect(service.getAllProfiles().has('alice')).toBe(false);
      expect(service.getProfile('bob').totalKills).toBe(1);
    });
  });
});
