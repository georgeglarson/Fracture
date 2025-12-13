/**
 * AchievementUI - Achievement panel showing unlocked and locked achievements
 * Single Responsibility: Display and interact with achievement progress
 */

import {
  ACHIEVEMENTS,
  Achievement,
  AchievementCategory,
  getAchievementsByCategory
} from '../../../shared/ts/achievements/achievement-data';

// Category display info
const CATEGORY_INFO: Record<AchievementCategory, { name: string; icon: string; color: string }> = {
  combat: { name: 'Combat', icon: '⚔️', color: '#ff6b6b' },
  wealth: { name: 'Wealth', icon: '💰', color: '#ffd700' },
  progression: { name: 'Progression', icon: '📈', color: '#69db7c' },
  exploration: { name: 'Exploration', icon: '🗺️', color: '#74c0fc' }
};

export class AchievementUI {
  private visible = false;
  private panel: HTMLDivElement | null = null;
  private unlockedIds: string[] = [];
  private progress: Record<string, number> = {};
  private selectedTitle: string | null = null;
  private selectedCategory: AchievementCategory = 'combat';
  private onSelectTitle: ((achievementId: string | null) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {}

  /**
   * Set callback for title selection
   */
  setOnSelectTitle(callback: (achievementId: string | null) => void): void {
    this.onSelectTitle = callback;
  }

  /**
   * Update achievement data from server
   */
  updateData(unlocked: string[], progress: Record<string, number>, selectedTitle: string | null): void {
    this.unlockedIds = unlocked;
    this.progress = progress;
    this.selectedTitle = selectedTitle;
    if (this.visible) {
      this.render();
    }
  }

  /**
   * Mark an achievement as unlocked
   */
  unlockAchievement(achievementId: string): void {
    if (!this.unlockedIds.includes(achievementId)) {
      this.unlockedIds.push(achievementId);
      if (this.visible) {
        this.render();
      }
    }
  }

  /**
   * Update progress for an achievement
   */
  updateProgress(achievementId: string, current: number): void {
    this.progress[achievementId] = current;
    if (this.visible) {
      this.render();
    }
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show the panel
   */
  show(): void {
    this.visible = true;
    this.render();
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.visible = false;
    // Remove keyboard listener
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  /**
   * Check if visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Render the achievement panel
   */
  private render(): void {
    if (this.panel) {
      this.panel.remove();
    }

    this.panel = document.createElement('div');
    this.panel.id = 'achievement-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-height: 80vh;
      background: linear-gradient(to bottom, rgba(45, 45, 55, 0.98), rgba(35, 35, 45, 0.98));
      border: 2px solid #666;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      z-index: 9000;
      font-family: Arial, sans-serif;
      color: #fff;
      user-select: none;
      overflow: hidden;
    `;

    const totalAchievements = ACHIEVEMENTS.length;
    const unlockedCount = this.unlockedIds.length;

    let html = `
      <!-- Header -->
      <div style="
        padding: 15px 20px;
        background: linear-gradient(to right, rgba(100, 80, 60, 0.8), rgba(80, 60, 40, 0.8));
        border-bottom: 2px solid #8B7355;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div>
          <div style="font-size: 18px; font-weight: bold; color: #ffd700;">🏆 Achievements</div>
          <div style="font-size: 12px; color: #aaa; margin-top: 4px;">
            ${unlockedCount} / ${totalAchievements} unlocked
          </div>
        </div>
        <button id="achievement-close" style="
          width: 28px;
          height: 28px;
          background: #7c4a4a;
          color: #fff;
          border: 1px solid #9c6a6a;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        ">✕</button>
      </div>

      <!-- Progress bar -->
      <div style="padding: 10px 20px; background: rgba(0,0,0,0.2);">
        <div style="
          height: 8px;
          background: rgba(0,0,0,0.4);
          border-radius: 4px;
          overflow: hidden;
        ">
          <div style="
            height: 100%;
            width: ${(unlockedCount / totalAchievements) * 100}%;
            background: linear-gradient(to right, #ffd700, #ffaa00);
            border-radius: 4px;
            transition: width 0.3s ease;
          "></div>
        </div>
      </div>

      <!-- Category tabs -->
      <div style="
        display: flex;
        padding: 0 15px;
        background: rgba(0,0,0,0.15);
        border-bottom: 1px solid #444;
      ">
    `;

    // Add category tabs
    const categories: AchievementCategory[] = ['combat', 'wealth', 'progression', 'exploration'];
    for (const cat of categories) {
      const info = CATEGORY_INFO[cat];
      const isSelected = cat === this.selectedCategory;
      const catAchievements = getAchievementsByCategory(cat);
      const catUnlocked = catAchievements.filter(a => this.unlockedIds.includes(a.id)).length;

      html += `
        <button class="achievement-tab" data-category="${cat}" style="
          flex: 1;
          padding: 10px 5px;
          background: ${isSelected ? 'rgba(255,255,255,0.1)' : 'transparent'};
          border: none;
          border-bottom: ${isSelected ? `3px solid ${info.color}` : '3px solid transparent'};
          color: ${isSelected ? info.color : '#888'};
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        ">
          <span style="font-size: 16px;">${info.icon}</span><br>
          <span>${info.name}</span><br>
          <span style="font-size: 10px; opacity: 0.7;">${catUnlocked}/${catAchievements.length}</span>
        </button>
      `;
    }

    html += `</div>`;

    // Achievement list
    html += `<div style="padding: 15px; max-height: 400px; overflow-y: auto;">`;

    const categoryAchievements = getAchievementsByCategory(this.selectedCategory);

    for (const achievement of categoryAchievements) {
      const isUnlocked = this.unlockedIds.includes(achievement.id);
      const currentProgress = this.progress[achievement.id] || 0;
      const progressPercent = Math.min(100, (currentProgress / achievement.requirement.target) * 100);
      const hasTitle = !!achievement.reward?.title;
      const isSelectedTitle = this.selectedTitle === achievement.id;

      html += `
        <div class="achievement-item" data-id="${achievement.id}" style="
          display: flex;
          align-items: center;
          padding: 12px;
          margin-bottom: 10px;
          background: ${isUnlocked ? 'rgba(100, 180, 100, 0.15)' : 'rgba(60, 60, 70, 0.5)'};
          border: 1px solid ${isUnlocked ? '#4a7c4a' : '#444'};
          border-radius: 8px;
          opacity: ${isUnlocked ? '1' : '0.7'};
          transition: all 0.2s;
          cursor: ${hasTitle && isUnlocked ? 'pointer' : 'default'};
        ">
          <!-- Icon -->
          <div style="
            width: 48px;
            height: 48px;
            background: ${isUnlocked ? CATEGORY_INFO[this.selectedCategory].color : '#555'};
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-right: 12px;
            box-shadow: ${isUnlocked ? '0 0 10px rgba(255,215,0,0.3)' : 'none'};
          ">${isUnlocked ? '✓' : '🔒'}</div>

          <!-- Info -->
          <div style="flex: 1; min-width: 0;">
            <div style="
              font-weight: bold;
              font-size: 14px;
              color: ${isUnlocked ? '#fff' : '#999'};
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              ${achievement.name}
              ${isSelectedTitle ? '<span style="font-size: 10px; background: #ffd700; color: #000; padding: 2px 6px; border-radius: 4px;">ACTIVE TITLE</span>' : ''}
            </div>
            <div style="font-size: 12px; color: #888; margin-top: 2px;">
              ${achievement.description}
            </div>
            ${!isUnlocked ? `
              <div style="margin-top: 6px;">
                <div style="
                  height: 4px;
                  background: rgba(0,0,0,0.4);
                  border-radius: 2px;
                  overflow: hidden;
                ">
                  <div style="
                    height: 100%;
                    width: ${progressPercent}%;
                    background: ${CATEGORY_INFO[this.selectedCategory].color};
                    border-radius: 2px;
                  "></div>
                </div>
                <div style="font-size: 10px; color: #666; margin-top: 2px;">
                  ${currentProgress} / ${achievement.requirement.target}
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Rewards -->
          <div style="text-align: right; margin-left: 10px;">
            ${achievement.reward?.title ? `<div style="font-size: 10px; color: #ffd700;">📜 "${achievement.reward.title}"</div>` : ''}
            ${achievement.reward?.gold ? `<div style="font-size: 11px; color: #ffd700;">+${achievement.reward.gold}g</div>` : ''}
            ${achievement.reward?.xp ? `<div style="font-size: 11px; color: #69db7c;">+${achievement.reward.xp} XP</div>` : ''}
          </div>
        </div>
      `;
    }

    html += `</div>`;

    // Help text
    html += `
      <div style="
        padding: 10px 15px;
        border-top: 1px solid #444;
        font-size: 10px;
        color: #666;
        text-align: center;
        background: rgba(0,0,0,0.2);
      ">
        Click unlocked achievements with titles to set as your active title • Press 'J' or Escape to close
      </div>
    `;

    this.panel.innerHTML = html;
    document.body.appendChild(this.panel);

    this.attachEventHandlers();
  }

  /**
   * Attach event handlers
   */
  private attachEventHandlers(): void {
    if (!this.panel) return;

    // Close button
    const closeBtn = this.panel.querySelector('#achievement-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Category tabs
    const tabs = this.panel.querySelectorAll('.achievement-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const category = (tab as HTMLElement).dataset.category as AchievementCategory;
        if (category) {
          this.selectedCategory = category;
          this.render();
        }
      });
      tab.addEventListener('mouseenter', () => {
        (tab as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
      });
      tab.addEventListener('mouseleave', () => {
        const isSelected = (tab as HTMLElement).dataset.category === this.selectedCategory;
        (tab as HTMLElement).style.background = isSelected ? 'rgba(255,255,255,0.1)' : 'transparent';
      });
    });

    // Achievement items (for title selection)
    const items = this.panel.querySelectorAll('.achievement-item');
    items.forEach(item => {
      const achievementId = (item as HTMLElement).dataset.id;
      if (!achievementId) return;

      const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
      const isUnlocked = this.unlockedIds.includes(achievementId);
      const hasTitle = !!achievement?.reward?.title;

      if (hasTitle && isUnlocked) {
        item.addEventListener('click', () => {
          // Toggle title selection
          const newTitle = this.selectedTitle === achievementId ? null : achievementId;
          this.selectedTitle = newTitle;
          if (this.onSelectTitle) {
            this.onSelectTitle(newTitle);
          }
          this.render();
        });

        item.addEventListener('mouseenter', () => {
          (item as HTMLElement).style.transform = 'scale(1.02)';
          (item as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        });
        item.addEventListener('mouseleave', () => {
          (item as HTMLElement).style.transform = 'scale(1)';
          (item as HTMLElement).style.boxShadow = 'none';
        });
      }
    });

    // Close on escape (not 'j' - that's handled by main.ts toggle)
    // Remove old handler first if it exists
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.hide();
  }
}
