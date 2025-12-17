/**
 * QuestHandler - Handles quest-related network messages
 *
 * Single Responsibility: Wire network events to QuestController
 * Extracted following the same pattern as other handlers.
 */

import { GameClient } from '../network/gameclient';
import { ClientEvents } from '../network/client-events';
import { QuestController, Quest, QuestResult } from '../quest/quest-controller';

/**
 * Setup quest event handlers
 */
export function setupQuestHandlers(
  client: GameClient,
  questController: QuestController
): void {
  // Quest offered by NPC
  client.on(ClientEvents.QUEST_OFFER, (quest: Quest) => {
    console.log('[QuestHandler] Quest offer received:', quest);
    questController.handleQuestOffer(quest);
  });

  // Quest status update (progress)
  client.on(ClientEvents.QUEST_STATUS, (quest: Partial<Quest> | null) => {
    console.log('[QuestHandler] Quest status update:', quest);
    questController.handleQuestStatus(quest);
  });

  // Quest completed
  client.on(ClientEvents.QUEST_COMPLETE, (result: QuestResult) => {
    console.log('[QuestHandler] Quest completed:', result);
    questController.handleQuestComplete(result);
  });

  console.info('[QuestHandler] Handlers registered');
}

/**
 * Get quest UI state for rendering
 */
export interface QuestUIState {
  hasQuest: boolean;
  questType: 'kill' | 'explore' | null;
  target: string;
  progress: number;
  total: number;
  progressPercent: number;
  description: string;
  reward: string;
  xp: number;
}

/**
 * Get current quest state for UI rendering
 */
export function getQuestUIState(questController: QuestController): QuestUIState {
  const quest = questController.getActiveQuest();

  if (!quest) {
    return {
      hasQuest: false,
      questType: null,
      target: '',
      progress: 0,
      total: 0,
      progressPercent: 0,
      description: '',
      reward: '',
      xp: 0,
    };
  }

  return {
    hasQuest: true,
    questType: quest.type,
    target: quest.target,
    progress: quest.progress,
    total: quest.count,
    progressPercent: questController.getProgressPercent(),
    description: quest.description,
    reward: quest.reward,
    xp: quest.xp,
  };
}
