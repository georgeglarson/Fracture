/**
 * ProgressionUIHandler - Handles progression, ascension, and efficiency UI
 *
 * Single Responsibility: Progression init, ascend, and update
 * Extracted from Game.ts to reduce its size.
 */

import { ProgressionUI, initProgressionUI } from '../ui/progression-ui';

/**
 * Progression state data stored on the game
 */
export interface ProgressionState {
  ascensionCount: number;
  restedXp: number;
  efficiency: number;
  title: string;
  canAscend: boolean;
}

/**
 * Game context for progression UI operations
 */
export interface ProgressionUIContext {
  // UI
  progressionUI: ProgressionUI | null;

  // State
  progressionData: ProgressionState | null;

  // Dependencies
  client: { sendAscendRequest: () => void } | null;
  audioManager: { playSound: (name: string) => void } | null;

  // Methods
  showNotification: (message: string) => void;
}

/**
 * Handle progression initialization from server
 */
export function handleProgressionInit(
  ctx: ProgressionUIContext,
  data: { ascensionCount: number; restedXp: number; efficiency: number; title: string; canAscend: boolean; maxLevel: number; bonuses: { xp: number; damage: number; hp: number } }
): void {
  console.log('[Progression] Initialized:', data);
  ctx.progressionData = {
    ascensionCount: data.ascensionCount,
    restedXp: data.restedXp,
    efficiency: data.efficiency,
    title: data.title,
    canAscend: data.canAscend
  };

  // Initialize and update progression UI
  if (!ctx.progressionUI) {
    ctx.progressionUI = initProgressionUI({
      onAscend: () => {
        if (ctx.client) {
          ctx.client.sendAscendRequest();
        }
      }
    });
  }
  ctx.progressionUI.update({
    ...ctx.progressionData,
    bonuses: data.bonuses
  });

  // Show notification if there's rested XP or ascension bonuses
  if (data.restedXp > 0) {
    ctx.showNotification(`Rested XP: +${data.restedXp.toFixed(1)}% bonus`);
  }
  if (data.ascensionCount > 0) {
    ctx.showNotification(`${data.title} (+${data.bonuses.xp}% XP, +${data.bonuses.damage}% DMG)`);
  }
  if (data.efficiency < 100) {
    ctx.showNotification(`Session efficiency: ${data.efficiency}%`);
  }
}

/**
 * Handle ascension completion
 */
export function handleProgressionAscend(
  ctx: ProgressionUIContext,
  ascensionCount: number,
  title: string
): void {
  console.log('[Progression] ASCENDED!', ascensionCount, title);
  ctx.progressionData = {
    ...ctx.progressionData!,
    ascensionCount,
    title,
    canAscend: false
  };
  ctx.showNotification(`ASCENDED! You are now ${title}`);
  ctx.audioManager?.playSound('loot');

  // Update UI
  if (ctx.progressionUI && ctx.progressionData) {
    ctx.progressionUI.update(ctx.progressionData);
  }
}

/**
 * Handle efficiency/rested XP update
 */
export function handleProgressionUpdate(
  ctx: ProgressionUIContext,
  data: { efficiency: number; restedXp: number }
): void {
  console.log('[Progression] Update:', data);
  if (ctx.progressionData) {
    ctx.progressionData.efficiency = data.efficiency;
    ctx.progressionData.restedXp = data.restedXp;

    // Update UI
    if (ctx.progressionUI) {
      ctx.progressionUI.update(ctx.progressionData);
    }
  }
}
