/**
 * Quest UI - Displays active quest tracker in the game HUD
 *
 * Single Responsibility: Render and update quest progress display
 * Follows the UI pattern established by toast.ts and other UI components.
 */

import { QuestController, Quest, QuestEvents, QuestResult } from '../quest/quest-controller';

/**
 * Quest UI component - renders the on-screen quest tracker
 */
export class QuestUI {
  private container: HTMLDivElement | null = null;
  private questController: QuestController;
  private isVisible = false;

  constructor(questController: QuestController) {
    this.questController = questController;
    this.createContainer();
    this.injectStyles();
    this.bindEvents();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'quest-tracker';
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    if (document.getElementById('quest-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'quest-ui-styles';
    style.textContent = `
      #quest-tracker {
        position: fixed;
        top: 80px;
        left: 20px;
        z-index: 9000;
        width: 280px;
        background: linear-gradient(135deg, rgba(20, 30, 40, 0.95) 0%, rgba(30, 40, 55, 0.95) 100%);
        border: 1px solid rgba(100, 140, 180, 0.4);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        font-family: 'Cinzel', Georgia, serif;
        color: #e8e8e8;
        overflow: hidden;
        transition: opacity 0.3s ease, transform 0.3s ease;
        opacity: 0;
        transform: translateX(-20px);
      }

      #quest-tracker.visible {
        opacity: 1;
        transform: translateX(0);
      }

      #quest-tracker.completing {
        animation: questComplete 0.6s ease;
      }

      @keyframes questComplete {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(255, 215, 0, 0.5); }
        100% { transform: scale(1); }
      }

      .quest-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: linear-gradient(90deg, rgba(80, 120, 160, 0.3) 0%, transparent 100%);
        border-bottom: 1px solid rgba(100, 140, 180, 0.3);
      }

      .quest-header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #8ab4d4;
      }

      .quest-header-icon {
        font-size: 14px;
      }

      .quest-abandon-btn {
        background: none;
        border: none;
        color: rgba(255, 100, 100, 0.6);
        font-size: 14px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .quest-abandon-btn:hover {
        color: #ff6666;
        background: rgba(255, 100, 100, 0.15);
      }

      .quest-body {
        padding: 12px;
      }

      .quest-description {
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 12px;
        color: #d4d4d4;
        font-style: italic;
      }

      .quest-objective {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .quest-objective-icon {
        font-size: 16px;
        width: 24px;
        text-align: center;
      }

      .quest-objective-text {
        flex: 1;
        font-size: 14px;
        font-weight: 500;
      }

      .quest-objective-count {
        font-size: 13px;
        color: #8ab4d4;
        font-weight: 600;
      }

      .quest-progress-container {
        height: 6px;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 10px;
      }

      .quest-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4a8bc2 0%, #6aafef 100%);
        border-radius: 3px;
        transition: width 0.3s ease;
        box-shadow: 0 0 8px rgba(106, 175, 239, 0.4);
      }

      .quest-progress-bar.complete {
        background: linear-gradient(90deg, #4ab882 0%, #6aefc2 100%);
        box-shadow: 0 0 12px rgba(106, 239, 194, 0.6);
      }

      .quest-reward {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 10px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        font-size: 12px;
      }

      .quest-reward-label {
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .quest-reward-item {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #ffd700;
      }

      .quest-reward-xp {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #8ab4d4;
      }

      /* Mobile responsiveness */
      @media (max-width: 768px) {
        #quest-tracker {
          top: auto;
          bottom: 80px;
          left: 10px;
          right: 10px;
          width: auto;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private bindEvents(): void {
    // Listen to quest controller events
    this.questController.on(QuestEvents.QUEST_RECEIVED, (quest: Quest) => {
      this.render(quest);
      this.show();
    });

    this.questController.on(QuestEvents.QUEST_UPDATED, (quest: Quest | null) => {
      if (quest) {
        this.render(quest);
      } else {
        this.hide();
      }
    });

    this.questController.on(QuestEvents.QUEST_COMPLETED, () => {
      this.playCompleteAnimation();
      setTimeout(() => this.hide(), 2000);
    });

    this.questController.on(QuestEvents.QUEST_ABANDONED, () => {
      this.hide();
    });
  }

  /**
   * Render quest data to the tracker
   */
  private render(quest: Quest): void {
    if (!this.container) return;

    const progressPercent = Math.floor((quest.progress / quest.count) * 100);
    const isComplete = progressPercent >= 100;
    const objectiveIcon = quest.type === 'kill' ? '&#x2694;' : '&#x1F9ED;'; // Crossed swords or compass

    this.container.innerHTML = `
      <div class="quest-header">
        <div class="quest-header-title">
          <span class="quest-header-icon">&#x1F4DC;</span>
          Active Quest
        </div>
        <button class="quest-abandon-btn" title="Abandon Quest">&#x2716;</button>
      </div>
      <div class="quest-body">
        <div class="quest-description">${this.escapeHtml(quest.description)}</div>
        <div class="quest-objective">
          <span class="quest-objective-icon">${objectiveIcon}</span>
          <span class="quest-objective-text">${this.capitalizeFirst(quest.target)}</span>
          <span class="quest-objective-count">${quest.progress}/${quest.count}</span>
        </div>
        <div class="quest-progress-container">
          <div class="quest-progress-bar ${isComplete ? 'complete' : ''}" style="width: ${progressPercent}%"></div>
        </div>
        <div class="quest-reward">
          <span class="quest-reward-label">Reward:</span>
          <span class="quest-reward-item">&#x1F381; ${this.capitalizeFirst(quest.reward)}</span>
          <span class="quest-reward-xp">+${quest.xp} XP</span>
        </div>
      </div>
    `;

    // Bind abandon button
    const abandonBtn = this.container.querySelector('.quest-abandon-btn');
    abandonBtn?.addEventListener('click', () => {
      this.questController.abandonQuest();
    });
  }

  /**
   * Show the quest tracker
   */
  show(): void {
    if (!this.container || this.isVisible) return;

    this.container.style.display = 'block';
    requestAnimationFrame(() => {
      this.container?.classList.add('visible');
    });
    this.isVisible = true;
  }

  /**
   * Hide the quest tracker
   */
  hide(): void {
    if (!this.container || !this.isVisible) return;

    this.container.classList.remove('visible');
    setTimeout(() => {
      if (this.container) {
        this.container.style.display = 'none';
      }
    }, 300);
    this.isVisible = false;
  }

  /**
   * Play completion animation
   */
  private playCompleteAnimation(): void {
    if (!this.container) return;

    this.container.classList.add('completing');
    setTimeout(() => {
      this.container?.classList.remove('completing');
    }, 600);
  }

  /**
   * Update quest progress (for manual updates)
   */
  update(): void {
    const quest = this.questController.getActiveQuest();
    if (quest) {
      this.render(quest);
    }
  }

  /**
   * Check if tracker is currently visible
   */
  isTrackerVisible(): boolean {
    return this.isVisible;
  }

  // Utility methods
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Singleton management
let questUI: QuestUI | null = null;

export function initQuestUI(questController: QuestController): QuestUI {
  questUI = new QuestUI(questController);
  return questUI;
}

export function getQuestUI(): QuestUI | null {
  return questUI;
}
