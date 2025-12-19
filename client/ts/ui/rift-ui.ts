/**
 * RiftUI - Client-side Fracture Rift user interface
 *
 * Displays:
 * - Rift progress HUD (depth, kills, modifiers)
 * - Rift start/end notifications
 * - Leaderboard panel
 */

import { RiftModifier } from '../../../shared/ts/rifts/rift-data';

interface ModifierInfo {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface RiftState {
  active: boolean;
  runId: string;
  depth: number;
  killCount: number;
  requiredKills: number;
  modifiers: ModifierInfo[];
}

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  maxDepth: number;
  totalKills: number;
  completionTime: number;
}

export class RiftUI {
  private container: HTMLDivElement | null = null;
  private hudElement: HTMLDivElement | null = null;
  private leaderboardElement: HTMLDivElement | null = null;
  private state: RiftState = {
    active: false,
    runId: '',
    depth: 0,
    killCount: 0,
    requiredKills: 0,
    modifiers: []
  };

  constructor() {
    this.createElements();
  }

  private createElements(): void {
    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'rift-container';

    // Create HUD
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'rift-hud';
    this.hudElement.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(180deg, rgba(20,0,40,0.95) 0%, rgba(40,0,60,0.9) 100%);
      border: 2px solid #a020f0;
      border-radius: 8px;
      padding: 12px 20px;
      color: #fff;
      font-family: 'GraphicPixel', monospace;
      font-size: 14px;
      z-index: 500;
      display: none;
      min-width: 300px;
      box-shadow: 0 0 20px rgba(160, 32, 240, 0.5);
    `;
    this.container.appendChild(this.hudElement);

    // Create leaderboard panel
    this.leaderboardElement = document.createElement('div');
    this.leaderboardElement.id = 'rift-leaderboard';
    this.leaderboardElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(20,0,40,0.95) 100%);
      border: 2px solid #a020f0;
      border-radius: 8px;
      padding: 20px;
      color: #fff;
      font-family: 'GraphicPixel', monospace;
      font-size: 12px;
      z-index: 600;
      display: none;
      min-width: 400px;
      max-height: 500px;
      overflow-y: auto;
      box-shadow: 0 0 30px rgba(160, 32, 240, 0.6);
    `;
    this.container.appendChild(this.leaderboardElement);

    document.body.appendChild(this.container);
  }

  /**
   * Handle rift start message
   */
  onRiftStart(data: {
    runId: string;
    depth: number;
    modifiers: ModifierInfo[];
    requiredKills: number;
    killCount: number;
  }): void {
    this.state = {
      active: true,
      runId: data.runId,
      depth: data.depth,
      killCount: data.killCount,
      requiredKills: data.requiredKills,
      modifiers: data.modifiers
    };

    this.updateHUD();
    this.showNotification(`Entering Fracture Rift - Depth ${data.depth}`, '#a020f0');
  }

  /**
   * Handle rift progress update
   */
  onRiftProgress(data: { killCount: number; requiredKills: number }): void {
    this.state.killCount = data.killCount;
    this.state.requiredKills = data.requiredKills;
    this.updateHUD();
  }

  /**
   * Handle rift advance to next depth
   */
  onRiftAdvance(data: {
    newDepth: number;
    killCount: number;
    requiredKills: number;
    rewards?: { xp: number; gold: number };
  }): void {
    this.state.depth = data.newDepth;
    this.state.killCount = data.killCount;
    this.state.requiredKills = data.requiredKills;
    this.updateHUD();

    if (data.rewards) {
      this.showNotification(
        `Depth ${data.newDepth}! +${data.rewards.xp} XP, +${data.rewards.gold} Gold`,
        '#44ff44'
      );
    }
  }

  /**
   * Handle rift end
   */
  onRiftEnd(data: {
    success: boolean;
    reason: string;
    completedDepth?: number;
    totalKills?: number;
    rewards?: { xp: number; gold: number };
    leaderboardRank?: number | null;
  }): void {
    this.state.active = false;
    this.hideHUD();

    if (data.reason === 'death') {
      this.showNotification(
        `Rift Failed at Depth ${data.completedDepth || 0}`,
        '#ff4444'
      );
    } else if (data.success) {
      let msg = `Rift Complete! Depth ${data.completedDepth}, ${data.totalKills} kills`;
      if (data.leaderboardRank) {
        msg += ` - Rank #${data.leaderboardRank}`;
      }
      this.showNotification(msg, '#44ff44');
    }
  }

  /**
   * Update the rift HUD display
   */
  private updateHUD(): void {
    if (!this.hudElement || !this.state.active) return;

    const progressPercent = (this.state.killCount / this.state.requiredKills) * 100;

    let modifiersHtml = '';
    if (this.state.modifiers.length > 0) {
      modifiersHtml = `
        <div style="margin-top: 8px; border-top: 1px solid #666; padding-top: 8px;">
          ${this.state.modifiers.map(m => `
            <span style="
              display: inline-block;
              background: ${m.color}40;
              border: 1px solid ${m.color};
              border-radius: 4px;
              padding: 2px 6px;
              margin: 2px;
              font-size: 10px;
              color: ${m.color};
            " title="${m.description}">${m.name}</span>
          `).join('')}
        </div>
      `;
    }

    this.hudElement.innerHTML = `
      <div style="text-align: center; margin-bottom: 8px;">
        <span style="color: #a020f0; font-size: 16px; font-weight: bold;">
          FRACTURE RIFT
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span>Depth: <span style="color: #ff8800; font-weight: bold;">${this.state.depth}</span></span>
        <span>Kills: <span style="color: #44ff44;">${this.state.killCount}</span> / ${this.state.requiredKills}</span>
      </div>
      <div style="
        background: #333;
        border-radius: 4px;
        height: 8px;
        overflow: hidden;
      ">
        <div style="
          background: linear-gradient(90deg, #a020f0, #ff00ff);
          height: 100%;
          width: ${progressPercent}%;
          transition: width 0.3s ease;
        "></div>
      </div>
      ${modifiersHtml}
      <div style="text-align: center; margin-top: 8px; font-size: 10px; color: #888;">
        Press ESC to exit rift
      </div>
    `;

    this.hudElement.style.display = 'block';
  }

  /**
   * Hide the rift HUD
   */
  private hideHUD(): void {
    if (this.hudElement) {
      this.hudElement.style.display = 'none';
    }
  }

  /**
   * Show notification message
   */
  private showNotification(message: string, color: string): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 150px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid ${color};
      border-radius: 8px;
      padding: 12px 24px;
      color: ${color};
      font-family: 'GraphicPixel', monospace;
      font-size: 16px;
      z-index: 700;
      animation: rift-fade-in 0.3s ease;
      box-shadow: 0 0 20px ${color}80;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'rift-fade-out 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Show leaderboard panel
   */
  showLeaderboard(entries: LeaderboardEntry[], playerRank: number | null): void {
    if (!this.leaderboardElement) return;

    let html = `
      <div style="text-align: center; margin-bottom: 16px;">
        <span style="color: #a020f0; font-size: 18px; font-weight: bold;">
          RIFT LEADERBOARD
        </span>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="color: #888; border-bottom: 1px solid #444;">
            <th style="padding: 8px; text-align: left;">Rank</th>
            <th style="padding: 8px; text-align: left;">Player</th>
            <th style="padding: 8px; text-align: right;">Depth</th>
            <th style="padding: 8px; text-align: right;">Kills</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const entry of entries) {
      const rankColor = entry.rank === 1 ? '#ffd700' :
                        entry.rank === 2 ? '#c0c0c0' :
                        entry.rank === 3 ? '#cd7f32' : '#fff';
      html += `
        <tr style="border-bottom: 1px solid #333;">
          <td style="padding: 8px; color: ${rankColor};">#${entry.rank}</td>
          <td style="padding: 8px;">${entry.playerName}</td>
          <td style="padding: 8px; text-align: right; color: #ff8800;">${entry.maxDepth}</td>
          <td style="padding: 8px; text-align: right; color: #44ff44;">${entry.totalKills}</td>
        </tr>
      `;
    }

    html += `
        </tbody>
      </table>
    `;

    if (playerRank) {
      html += `
        <div style="margin-top: 16px; text-align: center; color: #a020f0;">
          Your best rank: #${playerRank}
        </div>
      `;
    }

    html += `
      <div style="margin-top: 16px; text-align: center;">
        <button id="close-leaderboard" style="
          background: #a020f0;
          border: none;
          border-radius: 4px;
          padding: 8px 24px;
          color: #fff;
          font-family: 'GraphicPixel', monospace;
          cursor: pointer;
        ">Close</button>
      </div>
    `;

    this.leaderboardElement.innerHTML = html;
    this.leaderboardElement.style.display = 'block';

    // Add close handler
    const closeBtn = document.getElementById('close-leaderboard');
    if (closeBtn) {
      closeBtn.onclick = () => this.hideLeaderboard();
    }
  }

  /**
   * Hide leaderboard panel
   */
  hideLeaderboard(): void {
    if (this.leaderboardElement) {
      this.leaderboardElement.style.display = 'none';
    }
  }

  /**
   * Check if rift is currently active
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Get current rift depth
   */
  getCurrentDepth(): number {
    return this.state.depth;
  }
}

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes rift-fade-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes rift-fade-out {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  }
`;
document.head.appendChild(style);
