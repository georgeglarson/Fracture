/**
 * PlayerInspect - Popup showing another player's stats
 * Single Responsibility: Display player inspection information
 */

import { Types } from '../../../shared/ts/gametypes.js';

export interface InspectData {
  playerId: number;
  name: string;
  title: string | null;
  level: number;
  weapon: number;
  armor: number;
}

export interface InspectCallbacks {
  onInviteToParty: (playerId: number) => void;
}

export class PlayerInspect {
  private currentData: InspectData | null = null;
  private callbacks: InspectCallbacks | null = null;
  private isInParty: () => boolean = () => false;

  constructor() {}

  /**
   * Set callback handlers
   */
  setCallbacks(callbacks: InspectCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set party status checker
   */
  setPartyStatusChecker(checker: () => boolean): void {
    this.isInParty = checker;
  }

  /**
   * Show player inspection popup
   */
  show(data: InspectData): void {
    this.currentData = data;
    this.render();
  }

  /**
   * Hide the popup
   */
  hide(): void {
    this.currentData = null;
    const popup = document.getElementById('player-inspect-popup');
    if (popup) {
      popup.remove();
    }
  }

  /**
   * Render the inspection popup
   */
  private render(): void {
    if (!this.currentData) return;

    // Remove existing popup
    const existing = document.getElementById('player-inspect-popup');
    if (existing) {
      existing.remove();
    }

    const popup = document.createElement('div');
    popup.id = 'player-inspect-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 280px;
      padding: 20px;
      background: linear-gradient(to bottom, rgba(50, 50, 60, 0.95), rgba(40, 40, 50, 0.95));
      border: 2px solid #666;
      border-radius: 10px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
      z-index: 10000;
      font-family: Arial, sans-serif;
      color: #fff;
    `;

    const weaponName = Types.getKindAsString(this.currentData.weapon) || 'None';
    const armorName = Types.getKindAsString(this.currentData.armor) || 'None';
    const titleDisplay = this.currentData.title ? `<span style="color: #ffd700;">${this.currentData.title}</span>` : '';

    popup.innerHTML = `
      <div style="text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #444;">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">
          ${this.currentData.name}
        </div>
        ${titleDisplay ? `<div style="font-size: 12px; font-style: italic;">${titleDisplay}</div>` : ''}
      </div>

      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #333;">
          <span style="color: #aaa;">Level</span>
          <span style="font-weight: bold;">${this.currentData.level}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #333;">
          <span style="color: #aaa;">Weapon</span>
          <span style="color: #ff9966;">${this.formatItemName(weaponName)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 5px 0;">
          <span style="color: #aaa;">Armor</span>
          <span style="color: #66b3ff;">${this.formatItemName(armorName)}</span>
        </div>
      </div>

      <div style="display: flex; gap: 10px; justify-content: center;">
        ${!this.isInParty() ? `
          <button id="inspect-invite-btn" style="
            padding: 8px 16px;
            background: #4a7c4a;
            color: #fff;
            border: 1px solid #6a9c6a;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
          ">Invite to Party</button>
        ` : ''}
        <button id="inspect-close-btn" style="
          padding: 8px 16px;
          background: #555;
          color: #fff;
          border: 1px solid #777;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        ">Close</button>
      </div>
    `;

    document.body.appendChild(popup);

    // Add event handlers
    const inviteBtn = document.getElementById('inspect-invite-btn');
    if (inviteBtn && this.currentData) {
      const playerId = this.currentData.playerId;
      inviteBtn.onclick = () => {
        if (this.callbacks) {
          this.callbacks.onInviteToParty(playerId);
        }
        this.hide();
      };
    }

    const closeBtn = document.getElementById('inspect-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    // Close on click outside
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        this.hide();
      }
    });

    // Close on Escape key
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Format item name for display (capitalize, remove underscores)
   */
  private formatItemName(name: string): string {
    if (!name || name === 'null' || name === 'undefined') return 'None';
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.hide();
  }
}
