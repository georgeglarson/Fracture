/**
 * Tests for QuestController
 * Covers: quest lifecycle, progress tracking, events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestController, Quest, QuestResult, QuestEvents, QuestControllerDeps } from '../quest/quest-controller';

describe('QuestController', () => {
  let controller: QuestController;
  let mockDeps: QuestControllerDeps;

  const sampleKillQuest: Quest = {
    type: 'kill',
    target: 'rat',
    count: 5,
    progress: 0,
    reward: 'Gold Sword',
    xp: 100,
    description: 'Kill 5 rats in the village',
    giver: 'Guard',
  };

  const sampleExploreQuest: Quest = {
    type: 'explore',
    target: 'Dark Cave',
    count: 1,
    progress: 0,
    reward: 'Explorer Badge',
    xp: 50,
    description: 'Explore the Dark Cave',
  };

  beforeEach(() => {
    mockDeps = {
      sendRequestQuest: vi.fn(),
      showNotification: vi.fn(),
      showNarratorText: vi.fn(),
      playSound: vi.fn(),
    };

    controller = new QuestController(mockDeps);
  });

  describe('requestQuest', () => {
    it('should send quest request to server', () => {
      controller.requestQuest(42);

      expect(mockDeps.sendRequestQuest).toHaveBeenCalledWith(42);
    });

    it('should not request if already has active quest', () => {
      controller.handleQuestOffer(sampleKillQuest);
      controller.requestQuest(42);

      // Should only be called 0 times (first call was before active quest)
      expect(mockDeps.sendRequestQuest).not.toHaveBeenCalled();
      expect(mockDeps.showNotification).toHaveBeenCalledWith('You already have an active quest!');
    });
  });

  describe('handleQuestOffer', () => {
    it('should set active quest', () => {
      controller.handleQuestOffer(sampleKillQuest);

      expect(controller.hasActiveQuest()).toBe(true);
      expect(controller.getActiveQuest()).toEqual(sampleKillQuest);
    });

    it('should emit QUEST_RECEIVED event', () => {
      const listener = vi.fn();
      controller.on(QuestEvents.QUEST_RECEIVED, listener);

      controller.handleQuestOffer(sampleKillQuest);

      expect(listener).toHaveBeenCalledWith(sampleKillQuest);
    });

    it('should show narrator text and play sound', () => {
      controller.handleQuestOffer(sampleKillQuest);

      expect(mockDeps.showNarratorText).toHaveBeenCalledWith(
        `Quest: ${sampleKillQuest.description}`,
        'quest'
      );
      expect(mockDeps.playSound).toHaveBeenCalledWith('npc');
    });
  });

  describe('handleQuestStatus', () => {
    beforeEach(() => {
      controller.handleQuestOffer(sampleKillQuest);
    });

    it('should update progress', () => {
      controller.handleQuestStatus({ progress: 3 });

      expect(controller.getActiveQuest()?.progress).toBe(3);
    });

    it('should emit QUEST_UPDATED event', () => {
      const listener = vi.fn();
      controller.on(QuestEvents.QUEST_UPDATED, listener);

      controller.handleQuestStatus({ progress: 2 });

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ progress: 2 }));
    });

    it('should show notification when progress increases', () => {
      // Create completely isolated test setup
      const testDeps = {
        sendRequestQuest: vi.fn(),
        showNotification: vi.fn(),
        showNarratorText: vi.fn(),
        playSound: vi.fn(),
      };
      const testController = new QuestController(testDeps);
      testController.handleQuestOffer({ ...sampleKillQuest, progress: 0 });

      // Increase progress from 0 to 2
      testController.handleQuestStatus({ progress: 2 });

      // Verify notification was called
      expect(testDeps.showNotification).toHaveBeenCalledWith('Quest progress: 2/5');
      expect(testDeps.playSound).toHaveBeenCalledWith('loot');
    });

    it('should not notify if progress did not increase', () => {
      // Reset call history
      mockDeps.showNotification.mockClear();

      controller.handleQuestStatus({ progress: 0 });

      expect(mockDeps.showNotification).not.toHaveBeenCalled();
    });

    it('should clear quest when status is null', () => {
      controller.handleQuestStatus(null);

      expect(controller.hasActiveQuest()).toBe(false);
    });
  });

  describe('handleQuestComplete', () => {
    const result: QuestResult = {
      reward: 'Gold Sword',
      xp: 100,
      description: 'Quest Complete!',
    };

    beforeEach(() => {
      controller.handleQuestOffer(sampleKillQuest);
    });

    it('should clear active quest', () => {
      controller.handleQuestComplete(result);

      expect(controller.hasActiveQuest()).toBe(false);
    });

    it('should emit QUEST_COMPLETED event with result and completed quest', () => {
      const listener = vi.fn();
      controller.on(QuestEvents.QUEST_COMPLETED, listener);

      controller.handleQuestComplete(result);

      expect(listener).toHaveBeenCalledWith(result, sampleKillQuest);
    });

    it('should show completion notifications', () => {
      controller.handleQuestComplete(result);

      expect(mockDeps.showNarratorText).toHaveBeenCalledWith('Quest Complete!', 'achievement');
      expect(mockDeps.showNotification).toHaveBeenCalledWith('Reward: Gold Sword, +100 XP');
      expect(mockDeps.playSound).toHaveBeenCalledWith('achievement');
    });
  });

  describe('abandonQuest', () => {
    beforeEach(() => {
      controller.handleQuestOffer(sampleKillQuest);
    });

    it('should clear active quest', () => {
      controller.abandonQuest();

      expect(controller.hasActiveQuest()).toBe(false);
    });

    it('should emit QUEST_ABANDONED event', () => {
      const listener = vi.fn();
      controller.on(QuestEvents.QUEST_ABANDONED, listener);

      controller.abandonQuest();

      expect(listener).toHaveBeenCalledWith(sampleKillQuest);
    });

    it('should show notification', () => {
      controller.abandonQuest();

      expect(mockDeps.showNotification).toHaveBeenCalledWith('Quest abandoned');
    });

    it('should do nothing if no active quest', () => {
      controller.abandonQuest(); // First abandon
      const listener = vi.fn();
      controller.on(QuestEvents.QUEST_ABANDONED, listener);

      controller.abandonQuest(); // Second abandon - should do nothing

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getProgressPercent', () => {
    it('should return 0 when no active quest', () => {
      expect(controller.getProgressPercent()).toBe(0);
    });

    it('should calculate correct percentage', () => {
      controller.handleQuestOffer(sampleKillQuest);
      controller.handleQuestStatus({ progress: 3 });

      expect(controller.getProgressPercent()).toBe(60); // 3/5 = 60%
    });

    it('should return 100 when complete', () => {
      controller.handleQuestOffer(sampleKillQuest);
      controller.handleQuestStatus({ progress: 5 });

      expect(controller.getProgressPercent()).toBe(100);
    });
  });

  describe('getObjectiveText', () => {
    it('should return empty string when no quest', () => {
      expect(controller.getObjectiveText()).toBe('');
    });

    it('should format kill quest objective', () => {
      controller.handleQuestOffer(sampleKillQuest);
      controller.handleQuestStatus({ progress: 2 });

      expect(controller.getObjectiveText()).toBe('rat: 2/5');
    });

    it('should format explore quest objective', () => {
      controller.handleQuestOffer(sampleExploreQuest);

      expect(controller.getObjectiveText()).toBe('Explore: Dark Cave');
    });
  });

  describe('isQuestTarget', () => {
    it('should return false when no quest', () => {
      expect(controller.isQuestTarget('rat')).toBe(false);
    });

    it('should return true for matching mob type (case insensitive)', () => {
      controller.handleQuestOffer(sampleKillQuest);

      expect(controller.isQuestTarget('rat')).toBe(true);
      expect(controller.isQuestTarget('RAT')).toBe(true);
      expect(controller.isQuestTarget('Rat')).toBe(true);
    });

    it('should return false for non-matching mob', () => {
      controller.handleQuestOffer(sampleKillQuest);

      expect(controller.isQuestTarget('skeleton')).toBe(false);
    });

    it('should return false for explore quests', () => {
      controller.handleQuestOffer(sampleExploreQuest);

      expect(controller.isQuestTarget('rat')).toBe(false);
    });
  });

  describe('isQuestArea', () => {
    it('should return false when no quest', () => {
      expect(controller.isQuestArea('Dark Cave')).toBe(false);
    });

    it('should return true for matching area (case insensitive)', () => {
      controller.handleQuestOffer(sampleExploreQuest);

      expect(controller.isQuestArea('Dark Cave')).toBe(true);
      expect(controller.isQuestArea('dark cave')).toBe(true);
      expect(controller.isQuestArea('DARK CAVE')).toBe(true);
    });

    it('should return false for non-matching area', () => {
      controller.handleQuestOffer(sampleExploreQuest);

      expect(controller.isQuestArea('Forest')).toBe(false);
    });

    it('should return false for kill quests', () => {
      controller.handleQuestOffer(sampleKillQuest);

      expect(controller.isQuestArea('Village')).toBe(false);
    });
  });

  describe('hasActiveQuest', () => {
    it('should return false initially', () => {
      expect(controller.hasActiveQuest()).toBe(false);
    });

    it('should return true after receiving quest', () => {
      controller.handleQuestOffer(sampleKillQuest);

      expect(controller.hasActiveQuest()).toBe(true);
    });

    it('should return false after completion', () => {
      controller.handleQuestOffer(sampleKillQuest);
      controller.handleQuestComplete({ reward: 'Sword', xp: 100, description: 'Done' });

      expect(controller.hasActiveQuest()).toBe(false);
    });
  });
});
