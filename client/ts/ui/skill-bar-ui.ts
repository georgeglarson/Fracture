/**
 * SkillBarUI - Combat ability hotbar
 * Single Responsibility: Display skills and cooldowns, handle skill activation
 */

import { Types } from '../../../shared/ts/gametypes';
import { SkillId, SKILLS, SkillDefinition } from '../../../shared/ts/skills';

export interface SkillSlot {
  id: SkillId;
  name: string;
  description: string;
  hotkey: number;
  icon: string;
  cooldown: number;        // Total cooldown in seconds
  remainingCooldown: number; // Current remaining cooldown
  unlocked: boolean;
}

export interface SkillBarCallbacks {
  onSkillUse: (skillId: SkillId) => void;
}

export class SkillBarUI {
  private container: HTMLDivElement | null = null;
  private slots: Map<SkillId, HTMLDivElement> = new Map();
  private cooldownTimers: Map<SkillId, number> = new Map();
  private unlockedSkills: Set<SkillId> = new Set();
  private callbacks: SkillBarCallbacks | null = null;
  private playerLevel: number = 1;

  constructor() {
    this.createContainer();
    this.setupKeyboardListeners();
  }

  /**
   * Set callbacks for skill actions
   */
  setCallbacks(callbacks: SkillBarCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Update player level (affects which skills are shown)
   */
  setPlayerLevel(level: number): void {
    this.playerLevel = level;
    this.updateSkillVisibility();
  }

  /**
   * Initialize skills from server data
   */
  initSkills(skillData: Array<{
    id: SkillId;
    name: string;
    description: string;
    cooldown: number;
    hotkey: number;
    icon: string;
    remainingCooldown: number;
  }>): void {
    this.unlockedSkills.clear();

    for (const skill of skillData) {
      this.unlockedSkills.add(skill.id);
      this.updateSlot(skill.id, skill.remainingCooldown);
    }

    this.updateSkillVisibility();
  }

  /**
   * Handle new skill unlock
   */
  unlockSkill(skillData: {
    id: SkillId;
    name: string;
    description: string;
    cooldown: number;
    hotkey: number;
    icon: string;
  }): void {
    this.unlockedSkills.add(skillData.id);
    this.updateSkillVisibility();

    // Show unlock notification
    this.showUnlockNotification(skillData.name, skillData.hotkey);
  }

  /**
   * Start cooldown for a skill
   */
  startCooldown(skillId: SkillId, duration: number): void {
    const slot = this.slots.get(skillId);
    if (!slot) return;

    // Clear any existing timer
    const existingTimer = this.cooldownTimers.get(skillId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    let remaining = duration;
    this.updateCooldownDisplay(skillId, remaining, duration);

    // Update every 100ms for smooth countdown
    const timer = window.setInterval(() => {
      remaining -= 0.1;
      if (remaining <= 0) {
        clearInterval(timer);
        this.cooldownTimers.delete(skillId);
        this.updateCooldownDisplay(skillId, 0, duration);
        this.flashReady(skillId);
      } else {
        this.updateCooldownDisplay(skillId, remaining, duration);
      }
    }, 100);

    this.cooldownTimers.set(skillId, timer);
  }

  /**
   * Try to use a skill (called from keyboard input)
   */
  useSkill(hotkey: number): void {
    // Find skill by hotkey
    const skillId = this.getSkillByHotkey(hotkey);
    if (!skillId) return;

    // Check if unlocked
    if (!this.unlockedSkills.has(skillId)) return;

    // Check if on cooldown
    if (this.cooldownTimers.has(skillId)) {
      this.showCooldownFeedback(skillId);
      return;
    }

    // Trigger callback
    if (this.callbacks?.onSkillUse) {
      this.callbacks.onSkillUse(skillId);
    }

    // Visual feedback for activation
    this.flashActivated(skillId);
  }

  /**
   * Show/hide the skill bar
   */
  setVisible(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'flex' : 'none';
    }
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'skill-bar';
    this.container.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 4px;
      z-index: 100;
      pointer-events: auto;
    `;

    // Create 4 skill slots
    const skills = Object.values(SKILLS);
    for (const skill of skills) {
      const slot = this.createSlot(skill);
      this.slots.set(skill.id, slot);
      this.container.appendChild(slot);
    }

    document.body.appendChild(this.container);
  }

  private createSlot(skill: SkillDefinition): HTMLDivElement {
    const slot = document.createElement('div');
    slot.className = 'skill-slot';
    slot.dataset.skillId = skill.id;
    slot.style.cssText = `
      width: 48px;
      height: 48px;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #444;
      border-radius: 4px;
      position: relative;
      cursor: pointer;
      transition: border-color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Skill icon (using emoji as placeholder)
    const icon = document.createElement('div');
    icon.className = 'skill-icon';
    icon.style.cssText = `
      font-size: 24px;
      color: #fff;
      text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
    `;
    icon.textContent = this.getSkillEmoji(skill.id);
    slot.appendChild(icon);

    // Cooldown overlay
    const cooldownOverlay = document.createElement('div');
    cooldownOverlay.className = 'skill-cooldown';
    cooldownOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: #fff;
      font-family: 'GraphicPixel', monospace;
      border-radius: 2px;
    `;
    slot.appendChild(cooldownOverlay);

    // Hotkey label
    const hotkeyLabel = document.createElement('div');
    hotkeyLabel.className = 'skill-hotkey';
    hotkeyLabel.style.cssText = `
      position: absolute;
      bottom: 2px;
      right: 2px;
      font-size: 10px;
      color: #888;
      font-family: 'GraphicPixel', monospace;
    `;
    hotkeyLabel.textContent = String(skill.hotkey);
    slot.appendChild(hotkeyLabel);

    // Tooltip on hover
    slot.addEventListener('mouseenter', () => this.showTooltip(slot, skill));
    slot.addEventListener('mouseleave', () => this.hideTooltip());

    // Click to use
    slot.addEventListener('click', () => this.useSkill(skill.hotkey));

    // Hover effect
    slot.addEventListener('mouseenter', () => {
      if (!this.cooldownTimers.has(skill.id) && this.unlockedSkills.has(skill.id)) {
        slot.style.borderColor = '#888';
      }
    });
    slot.addEventListener('mouseleave', () => {
      slot.style.borderColor = '#444';
    });

    return slot;
  }

  private getSkillEmoji(skillId: SkillId): string {
    switch (skillId) {
      case SkillId.PHASE_SHIFT: return '\uD83D\uDC7B'; // Ghost - invisibility
      case SkillId.POWER_STRIKE: return '\u2694'; // Crossed swords
      case SkillId.WAR_CRY: return '\uD83D\uDDE3'; // Speaking head
      case SkillId.WHIRLWIND: return '\uD83C\uDF00'; // Cyclone
      default: return '?';
    }
  }

  private updateSkillVisibility(): void {
    this.slots.forEach((slot, skillId) => {
      const unlocked = this.unlockedSkills.has(skillId);

      if (unlocked) {
        slot.style.opacity = '1';
        slot.style.filter = 'none';
      } else {
        slot.style.opacity = '0.4';
        slot.style.filter = 'grayscale(100%)';
      }
    });
  }

  private updateSlot(skillId: SkillId, remainingCooldown: number): void {
    if (remainingCooldown > 0) {
      const skill = SKILLS[skillId];
      this.startCooldown(skillId, remainingCooldown);
    }
  }

  private updateCooldownDisplay(skillId: SkillId, remaining: number, total: number): void {
    const slot = this.slots.get(skillId);
    if (!slot) return;

    const overlay = slot.querySelector('.skill-cooldown') as HTMLDivElement;
    if (!overlay) return;

    if (remaining <= 0) {
      overlay.style.display = 'none';
    } else {
      overlay.style.display = 'flex';
      overlay.textContent = Math.ceil(remaining).toString();

      // Sweep effect using clip-path
      const percent = (remaining / total) * 100;
      overlay.style.clipPath = `inset(0 0 0 0)`;
      overlay.style.background = `linear-gradient(to top, rgba(0,0,0,0.7) ${100 - percent}%, rgba(0,0,0,0.4) ${100 - percent}%)`;
    }
  }

  private flashReady(skillId: SkillId): void {
    const slot = this.slots.get(skillId);
    if (!slot) return;

    slot.style.borderColor = '#4f4';
    slot.style.boxShadow = '0 0 8px #4f4';

    setTimeout(() => {
      slot.style.borderColor = '#444';
      slot.style.boxShadow = 'none';
    }, 300);
  }

  private flashActivated(skillId: SkillId): void {
    const slot = this.slots.get(skillId);
    if (!slot) return;

    slot.style.transform = 'scale(0.9)';
    slot.style.borderColor = '#fff';

    setTimeout(() => {
      slot.style.transform = 'scale(1)';
      slot.style.borderColor = '#444';
    }, 100);
  }

  private showCooldownFeedback(skillId: SkillId): void {
    const slot = this.slots.get(skillId);
    if (!slot) return;

    slot.style.borderColor = '#f44';
    setTimeout(() => {
      slot.style.borderColor = '#444';
    }, 200);
  }

  private showUnlockNotification(name: string, hotkey: number): void {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #4f4;
      border-radius: 4px;
      padding: 16px 24px;
      color: #4f4;
      font-family: 'GraphicPixel', monospace;
      font-size: 16px;
      z-index: 2000;
      text-align: center;
      animation: skillUnlock 0.3s ease-out;
    `;
    notification.innerHTML = `
      <div style="font-size: 20px; margin-bottom: 8px;">New Skill Unlocked!</div>
      <div style="color: #fff;">${name}</div>
      <div style="color: #888; font-size: 12px; margin-top: 4px;">Press ${hotkey} to use</div>
    `;

    // Add animation keyframes
    if (!document.getElementById('skill-unlock-style')) {
      const style = document.createElement('style');
      style.id = 'skill-unlock-style';
      style.textContent = `
        @keyframes skillUnlock {
          from { transform: translateX(-50%) scale(0.8); opacity: 0; }
          to { transform: translateX(-50%) scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  private showTooltip(slot: HTMLDivElement, skill: SkillDefinition): void {
    // Remove existing tooltip
    this.hideTooltip();

    const unlocked = this.unlockedSkills.has(skill.id);

    const tooltip = document.createElement('div');
    tooltip.id = 'skill-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #555;
      border-radius: 4px;
      padding: 8px 12px;
      color: #fff;
      font-family: 'GraphicPixel', monospace;
      font-size: 12px;
      z-index: 2000;
      pointer-events: none;
      min-width: 180px;
    `;

    const rect = slot.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 8}px`;

    tooltip.innerHTML = `
      <div style="color: ${unlocked ? '#4f4' : '#888'}; font-weight: bold; margin-bottom: 4px;">
        ${skill.name}
        ${!unlocked ? `<span style="color: #f88;">(Level ${skill.unlockLevel})</span>` : ''}
      </div>
      <div style="color: #aaa; font-size: 10px; margin-bottom: 6px;">
        ${skill.description}
      </div>
      <div style="color: #888; font-size: 10px;">
        Cooldown: ${skill.cooldown}s
      </div>
    `;

    document.body.appendChild(tooltip);
  }

  private hideTooltip(): void {
    const existing = document.getElementById('skill-tooltip');
    if (existing) {
      existing.remove();
    }
  }

  private getSkillByHotkey(hotkey: number): SkillId | null {
    for (const skill of Object.values(SKILLS)) {
      if (skill.hotkey === hotkey) {
        return skill.id;
      }
    }
    return null;
  }

  private setupKeyboardListeners(): void {
    document.addEventListener('keydown', (e) => {
      // Only handle 1-4 keys
      if (e.key >= '1' && e.key <= '4') {
        // Don't trigger if typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }

        const hotkey = parseInt(e.key);
        this.useSkill(hotkey);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Clear all timers
    this.cooldownTimers.forEach((timer) => {
      clearInterval(timer);
    });
    this.cooldownTimers.clear();

    // Remove container
    if (this.container) {
      this.container.remove();
    }

    this.hideTooltip();
  }
}
