/**
 * QuestController - Client-side quest state management
 *
 * Single Responsibility: Track active quest, progress, and completion
 * Follows the same DI pattern as PlayerController and InteractionController.
 */

import EventEmitter from 'eventemitter3';

/**
 * Quest data structure (matches server Quest type)
 */
export interface Quest {
  type: 'kill' | 'explore';
  target: string;
  count: number;
  progress: number;
  reward: string;
  xp: number;
  description: string;
  giver?: string;
}

/**
 * Quest completion result
 */
export interface QuestResult {
  reward: string;
  xp: number;
  description: string;
}

/**
 * Events emitted by QuestController
 */
export const QuestEvents = {
  QUEST_RECEIVED: 'questReceived',
  QUEST_UPDATED: 'questUpdated',
  QUEST_COMPLETED: 'questCompleted',
  QUEST_ABANDONED: 'questAbandoned',
} as const;

/**
 * Dependencies injected into QuestController
 */
export interface QuestControllerDeps {
  // Network
  sendRequestQuest: (npcKind: number) => void;

  // UI callbacks
  showNotification: (message: string) => void;
  showNarratorText: (text: string, style: string) => void;

  // Audio
  playSound: (soundName: string) => void;
}

/**
 * QuestController class - manages all quest-related state on the client
 */
export class QuestController extends EventEmitter {
  private deps: QuestControllerDeps;
  private activeQuest: Quest | null = null;
  private lastQuestGiverKind: number | null = null;

  constructor(deps: QuestControllerDeps) {
    super();
    this.deps = deps;
  }

  /**
   * Request a quest from an NPC
   */
  requestQuest(npcKind: number): void {
    if (this.activeQuest) {
      this.deps.showNotification('You already have an active quest!');
      return;
    }

    this.lastQuestGiverKind = npcKind;
    this.deps.sendRequestQuest(npcKind);
    console.info('[Quest] Requesting quest from NPC kind:', npcKind);
  }

  /**
   * Handle quest offer from server
   */
  handleQuestOffer(quest: Quest): void {
    this.activeQuest = quest;
    this.emit(QuestEvents.QUEST_RECEIVED, quest);

    // Show quest accepted notification
    const targetDisplay = quest.type === 'kill'
      ? `${quest.count} ${quest.target}${quest.count > 1 ? 's' : ''}`
      : quest.target;

    this.deps.showNarratorText(`Quest: ${quest.description}`, 'quest');
    this.deps.playSound('npc');

    console.info('[Quest] Received quest:', quest.type, targetDisplay);
  }

  /**
   * Handle quest status update from server
   */
  handleQuestStatus(status: Partial<Quest> | null): void {
    if (status === null) {
      this.activeQuest = null;
      this.emit(QuestEvents.QUEST_UPDATED, null);
      return;
    }

    if (this.activeQuest) {
      // Update progress
      if (status.progress !== undefined) {
        const oldProgress = this.activeQuest.progress;
        this.activeQuest.progress = status.progress;

        if (status.progress > oldProgress) {
          this.deps.showNotification(
            `Quest progress: ${status.progress}/${this.activeQuest.count}`
          );
          this.deps.playSound('loot');
        }
      }

      this.emit(QuestEvents.QUEST_UPDATED, this.activeQuest);
    }
  }

  /**
   * Handle quest completion from server
   */
  handleQuestComplete(result: QuestResult): void {
    const completedQuest = this.activeQuest;
    this.activeQuest = null;
    this.lastQuestGiverKind = null;

    this.emit(QuestEvents.QUEST_COMPLETED, result, completedQuest);

    // Show completion notification
    this.deps.showNarratorText('Quest Complete!', 'achievement');
    this.deps.showNotification(`Reward: ${result.reward}, +${result.xp} XP`);
    this.deps.playSound('achievement');

    console.info('[Quest] Completed! Reward:', result.reward, 'XP:', result.xp);
  }

  /**
   * Abandon current quest (client-side only for now)
   */
  abandonQuest(): void {
    if (!this.activeQuest) {
      return;
    }

    const abandoned = this.activeQuest;
    this.activeQuest = null;
    this.lastQuestGiverKind = null;

    this.emit(QuestEvents.QUEST_ABANDONED, abandoned);
    this.deps.showNotification('Quest abandoned');

    console.info('[Quest] Abandoned quest');
  }

  /**
   * Get current active quest
   */
  getActiveQuest(): Quest | null {
    return this.activeQuest;
  }

  /**
   * Check if player has an active quest
   */
  hasActiveQuest(): boolean {
    return this.activeQuest !== null;
  }

  /**
   * Get quest progress as percentage (0-100)
   */
  getProgressPercent(): number {
    if (!this.activeQuest) return 0;
    return Math.floor((this.activeQuest.progress / this.activeQuest.count) * 100);
  }

  /**
   * Get formatted quest objective string
   */
  getObjectiveText(): string {
    if (!this.activeQuest) return '';

    const q = this.activeQuest;
    if (q.type === 'kill') {
      return `${q.target}: ${q.progress}/${q.count}`;
    } else {
      return `Explore: ${q.target}`;
    }
  }

  /**
   * Check if a kill target matches current quest
   */
  isQuestTarget(mobType: string): boolean {
    if (!this.activeQuest || this.activeQuest.type !== 'kill') {
      return false;
    }
    return this.activeQuest.target.toLowerCase() === mobType.toLowerCase();
  }

  /**
   * Check if an area matches current explore quest
   */
  isQuestArea(area: string): boolean {
    if (!this.activeQuest || this.activeQuest.type !== 'explore') {
      return false;
    }
    return this.activeQuest.target.toLowerCase() === area.toLowerCase();
  }
}
