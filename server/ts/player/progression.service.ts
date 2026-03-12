/**
 * ProgressionService - Handles XP, leveling, and gold management
 * Single Responsibility: Manage player progression state
 */

import {Formulas} from '../formulas';
import {Messages} from '../message';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Progression');

export interface ProgressionState {
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
}

export interface LevelUpResult {
  newLevel: number;
  bonusHP: number;
  bonusDamage: number;
}

export interface XPGainResult {
  amount: number;
  currentXP: number;
  xpToNext: number;
  levelUps: LevelUpResult[];
}

export interface GoldGainResult {
  amount: number;
  total: number;
}

/**
 * Player callbacks for progression events
 */
export interface ProgressionCallbacks {
  send: (message: any) => void;
  updateHitPoints: () => void;
  getMaxHitPoints: () => number;
  checkLevelAchievements: (level: number) => void;
  checkGoldAchievements: (amount: number) => void;
  getName: () => string;
}

export class ProgressionService {
  private callbacks: ProgressionCallbacks;

  // State
  level: number = 1;
  xp: number = 0;
  xpToNext: number = 100;
  gold: number = 0;

  constructor(callbacks: ProgressionCallbacks) {
    this.callbacks = callbacks;
    this.xpToNext = Formulas.xpToNextLevel(1);
  }

  /**
   * Grant XP to the player, handling level ups
   */
  grantXP(amount: number): XPGainResult {
    const levelUps: LevelUpResult[] = [];

    if (this.level >= Formulas.MAX_LEVEL) {
      return { amount: 0, currentXP: this.xp, xpToNext: this.xpToNext, levelUps };
    }

    this.xp += amount;
    log.info({ playerName: this.callbacks.getName(), amount, currentXp: this.xp, xpToNext: this.xpToNext }, 'XP gained');

    // Send XP gain message to player
    this.callbacks.send(new Messages.XpGain(amount, this.xp, this.xpToNext).serialize());

    // Check for level up
    while (this.xp >= this.xpToNext && this.level < Formulas.MAX_LEVEL) {
      const result = this.levelUp();
      levelUps.push(result);
    }

    return { amount, currentXP: this.xp, xpToNext: this.xpToNext, levelUps };
  }

  /**
   * Level up the player
   */
  private levelUp(): LevelUpResult {
    this.xp -= this.xpToNext;
    this.level++;
    this.xpToNext = Formulas.xpToNextLevel(this.level);

    const bonusHP = Formulas.levelBonusHP(this.level);
    const bonusDamage = Formulas.levelBonusDamage(this.level);

    log.info({ playerName: this.callbacks.getName(), oldLevel: this.level - 1, newLevel: this.level, bonusHP, bonusDamage }, 'Level up');

    // Update HP with new level bonus
    this.callbacks.updateHitPoints();

    // Send level up message
    this.callbacks.send(new Messages.LevelUp(this.level, bonusHP, bonusDamage).serialize());
    this.callbacks.send(new Messages.HitPoints(this.callbacks.getMaxHitPoints()).serialize());

    // Check level achievements
    this.callbacks.checkLevelAchievements(this.level);

    return { newLevel: this.level, bonusHP, bonusDamage };
  }

  /**
   * Set player level directly (for restoring from save)
   */
  setLevel(level: number, xp: number = 0): void {
    this.level = Math.min(Math.max(1, level), Formulas.MAX_LEVEL);
    this.xp = xp;
    this.xpToNext = Formulas.xpToNextLevel(this.level);
    this.callbacks.updateHitPoints();
  }

  /**
   * Grant gold to the player
   */
  grantGold(amount: number): GoldGainResult {
    this.gold += amount;
    log.info({ playerName: this.callbacks.getName(), amount, totalGold: this.gold }, 'Gold gained');

    // Send gold gain message to player
    this.callbacks.send(new Messages.GoldGain(amount, this.gold).serialize());

    // Check wealth achievements
    if (amount > 0) {
      this.callbacks.checkGoldAchievements(amount);
    }

    return { amount, total: this.gold };
  }

  /**
   * Set player gold directly (for restoring from save)
   */
  setGold(gold: number): void {
    this.gold = Math.max(0, gold);
  }

  /**
   * Get current progression state (for serialization)
   */
  getState(): ProgressionState {
    return {
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      gold: this.gold
    };
  }

  /**
   * Load progression state (from storage)
   */
  loadState(state: Partial<ProgressionState>): void {
    if (state.level !== undefined) {
      this.level = Math.min(Math.max(1, state.level), Formulas.MAX_LEVEL);
    }
    if (state.xp !== undefined) {
      this.xp = state.xp;
    }
    if (state.gold !== undefined) {
      this.gold = Math.max(0, state.gold);
    }
    this.xpToNext = Formulas.xpToNextLevel(this.level);
  }
}

// Singleton factory
let progressionServiceFactory: ((callbacks: ProgressionCallbacks) => ProgressionService) | null = null;

export function createProgressionService(callbacks: ProgressionCallbacks): ProgressionService {
  return new ProgressionService(callbacks);
}
