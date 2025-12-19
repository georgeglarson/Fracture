/**
 * Progression UI - Displays session efficiency, rested XP, and ascension status
 * Positioned below the minimap, collapsible, semi-transparent
 */

export interface ProgressionData {
  ascensionCount: number;
  restedXp: number;
  efficiency: number;
  title: string;
  canAscend: boolean;
  bonuses?: { xp: number; damage: number; hp: number };
}

export interface ProgressionCallbacks {
  onAscend: () => void;
}

export class ProgressionUI {
  private container: HTMLDivElement | null = null;
  private data: ProgressionData | null = null;
  private callbacks: ProgressionCallbacks;
  private isVisible = false;
  private isExpanded = false;

  constructor(callbacks: ProgressionCallbacks) {
    this.callbacks = callbacks;
    this.createContainer();
    this.injectStyles();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'progression-panel';
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
  }

  private injectStyles(): void {
    if (document.getElementById('progression-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'progression-ui-styles';
    style.textContent = `
      #progression-panel {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 8900;
        width: 188px;
        background: linear-gradient(135deg, rgba(20, 30, 40, 0.75) 0%, rgba(30, 40, 55, 0.75) 100%);
        border: 1px solid rgba(100, 140, 180, 0.3);
        border-radius: 6px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        font-family: 'Cinzel', Georgia, serif;
        color: #e8e8e8;
        overflow: hidden;
        transition: opacity 0.3s ease, transform 0.3s ease, background 0.2s ease;
        opacity: 0;
        transform: translateX(20px);
      }

      #progression-panel:hover {
        background: linear-gradient(135deg, rgba(20, 30, 40, 0.9) 0%, rgba(30, 40, 55, 0.9) 100%);
      }

      #progression-panel.visible {
        opacity: 1;
        transform: translateX(0);
      }

      .progression-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        background: linear-gradient(90deg, rgba(80, 120, 160, 0.2) 0%, transparent 100%);
        border-bottom: 1px solid rgba(100, 140, 180, 0.2);
        cursor: pointer;
        user-select: none;
      }

      .progression-header:hover {
        background: linear-gradient(90deg, rgba(80, 120, 160, 0.35) 0%, transparent 100%);
      }

      .progression-header-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .progression-header-title {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #8ab4d4;
      }

      .progression-expand-icon {
        font-size: 8px;
        color: #666;
        transition: transform 0.2s ease;
      }

      #progression-panel.expanded .progression-expand-icon {
        transform: rotate(180deg);
      }

      .progression-compact-stats {
        display: flex;
        gap: 8px;
        font-size: 10px;
      }

      .progression-compact-stat {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .progression-compact-stat.high { color: #4ade80; }
      .progression-compact-stat.medium { color: #fbbf24; }
      .progression-compact-stat.low { color: #f87171; }
      .progression-compact-stat.rested { color: #60a5fa; }

      .progression-ascension-badge {
        font-size: 9px;
        padding: 1px 4px;
        background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
        border-radius: 3px;
        color: #fff;
      }

      .progression-body {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease, padding 0.3s ease;
        padding: 0 10px;
      }

      #progression-panel.expanded .progression-body {
        max-height: 200px;
        padding: 8px 10px;
      }

      .progression-stat {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        font-size: 11px;
      }

      .progression-stat-label {
        color: #888;
        font-size: 10px;
      }

      .progression-stat-value {
        font-weight: 600;
        font-size: 11px;
      }

      .progression-stat-value.high { color: #4ade80; }
      .progression-stat-value.medium { color: #fbbf24; }
      .progression-stat-value.low { color: #f87171; }
      .progression-stat-value.bonus { color: #60a5fa; }

      .progression-bar-container {
        height: 3px;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 2px;
        margin-bottom: 8px;
      }

      .progression-bar {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .progression-bar.efficiency {
        background: linear-gradient(90deg, #22c55e 0%, #4ade80 100%);
      }

      .progression-bar.efficiency.medium {
        background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
      }

      .progression-bar.efficiency.low {
        background: linear-gradient(90deg, #ef4444 0%, #f87171 100%);
      }

      .progression-bar.rested {
        background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
      }

      .progression-divider {
        height: 1px;
        background: rgba(100, 140, 180, 0.15);
        margin: 6px 0;
      }

      .progression-bonuses {
        font-size: 9px;
        color: #888;
      }

      .progression-bonus-row {
        display: flex;
        gap: 6px;
        margin-top: 3px;
        flex-wrap: wrap;
      }

      .progression-bonus {
        color: #a78bfa;
        font-size: 9px;
      }

      .progression-ascend-btn {
        width: 100%;
        padding: 6px;
        margin-top: 6px;
        background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
        border: none;
        border-radius: 4px;
        color: #fff;
        font-family: 'Cinzel', Georgia, serif;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .progression-ascend-btn:hover {
        background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
        box-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
      }

      .progression-title {
        font-size: 9px;
        color: #a78bfa;
        text-align: center;
        margin-top: 4px;
        font-style: italic;
      }

      @media (max-width: 768px) {
        #progression-panel {
          top: auto;
          bottom: 180px;
          right: 10px;
          width: 170px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  update(data: ProgressionData): void {
    this.data = data;
    this.render();
    if (!this.isVisible) {
      this.show();
    }
  }

  private render(): void {
    if (!this.container || !this.data) return;

    const { ascensionCount, restedXp, efficiency, title, canAscend, bonuses } = this.data;

    // Determine efficiency color class
    let efficiencyClass = 'high';
    if (efficiency <= 50) efficiencyClass = 'low';
    else if (efficiency <= 75) efficiencyClass = 'medium';

    const ascensionBadge = ascensionCount > 0
      ? `<span class="progression-ascension-badge">A${ascensionCount}</span>`
      : '';

    const bonusesHtml = bonuses && (bonuses.xp > 0 || bonuses.damage > 0 || bonuses.hp > 0)
      ? `
        <div class="progression-divider"></div>
        <div class="progression-bonuses">
          Bonuses:
          <div class="progression-bonus-row">
            ${bonuses.xp > 0 ? `<span class="progression-bonus">+${bonuses.xp}%XP</span>` : ''}
            ${bonuses.damage > 0 ? `<span class="progression-bonus">+${bonuses.damage}%DMG</span>` : ''}
            ${bonuses.hp > 0 ? `<span class="progression-bonus">+${bonuses.hp}%HP</span>` : ''}
          </div>
        </div>
      `
      : '';

    const ascendButton = canAscend
      ? `<button class="progression-ascend-btn">Ascend</button>`
      : '';

    const titleHtml = title && title !== 'Novice'
      ? `<div class="progression-title">"${title}"</div>`
      : '';

    // Compact stats for collapsed header
    const compactStats = `
      <div class="progression-compact-stats">
        <span class="progression-compact-stat ${efficiencyClass}">${efficiency}%</span>
        ${restedXp > 0 ? `<span class="progression-compact-stat rested">+${Math.floor(restedXp)}%</span>` : ''}
      </div>
    `;

    this.container.innerHTML = `
      <div class="progression-header">
        <div class="progression-header-left">
          <span class="progression-expand-icon">&#9660;</span>
          <span class="progression-header-title">Progress</span>
          ${ascensionBadge}
        </div>
        ${compactStats}
      </div>
      <div class="progression-body">
        <div class="progression-stat">
          <span class="progression-stat-label">Session Efficiency</span>
          <span class="progression-stat-value ${efficiencyClass}">${efficiency}%</span>
        </div>
        <div class="progression-bar-container">
          <div class="progression-bar efficiency ${efficiencyClass}" style="width: ${efficiency}%"></div>
        </div>

        <div class="progression-stat">
          <span class="progression-stat-label">Rested XP Bonus</span>
          <span class="progression-stat-value bonus">+${restedXp.toFixed(1)}%</span>
        </div>
        <div class="progression-bar-container">
          <div class="progression-bar rested" style="width: ${Math.min(restedXp, 100)}%"></div>
        </div>

        ${bonusesHtml}
        ${titleHtml}
        ${ascendButton}
      </div>
    `;

    // Apply expanded state
    if (this.isExpanded) {
      this.container.classList.add('expanded');
    }

    // Bind header click for toggle
    const header = this.container.querySelector('.progression-header');
    header?.addEventListener('click', (e) => {
      // Don't toggle if clicking ascend button
      if ((e.target as HTMLElement).classList.contains('progression-ascend-btn')) return;
      this.toggleExpanded();
    });

    // Bind ascend button
    const ascendBtn = this.container.querySelector('.progression-ascend-btn');
    ascendBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onAscend();
    });
  }

  private toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.container?.classList.add('expanded');
    } else {
      this.container?.classList.remove('expanded');
    }
  }

  show(): void {
    if (!this.container || this.isVisible) return;

    this.container.style.display = 'block';
    requestAnimationFrame(() => {
      this.container?.classList.add('visible');
    });
    this.isVisible = true;
  }

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

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else if (this.data) {
      this.show();
    }
  }

  isShowing(): boolean {
    return this.isVisible;
  }
}

// Singleton management
let progressionUI: ProgressionUI | null = null;

export function initProgressionUI(callbacks: ProgressionCallbacks): ProgressionUI {
  progressionUI = new ProgressionUI(callbacks);
  return progressionUI;
}

export function getProgressionUI(): ProgressionUI | null {
  return progressionUI;
}
