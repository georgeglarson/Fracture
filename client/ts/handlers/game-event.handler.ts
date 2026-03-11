/**
 * GameEventHandler - Handles game world events and notifications
 *
 * Single Responsibility: Zone transitions, boss kills, kill streaks, nemesis system
 * Extracted from Game.ts to reduce its size.
 */

import { FractureAtmosphere } from '../ui/fracture-atmosphere.js';

/**
 * Game context for game event operations
 */
export interface GameEventContext {
  // State
  currentZone: { id: string; name: string; minLevel: number; maxLevel: number } | null;

  // Methods
  showNotification: (message: string) => void;
  showNarratorText: (text: string, style: string) => void;

  // Atmosphere (optional)
  fractureAtmosphere?: FractureAtmosphere | null;
}

/**
 * Zone data type
 */
export interface ZoneData {
  id: string;
  name: string;
  minLevel: number;
  maxLevel: number;
}

/**
 * Handle entering a new zone
 */
export function handleZoneEnter(
  ctx: GameEventContext,
  zoneId: string,
  zoneName: string,
  minLevel: number,
  maxLevel: number,
  warning: string | null
): ZoneData {
  const zone = { id: zoneId, name: zoneName, minLevel, maxLevel };

  // Trigger dimension theme change BEFORE showing narrator text
  // This way the theme transition happens alongside the zone notification
  if (ctx.fractureAtmosphere) {
    // Don't show dimension name since we show zone name via narrator
    ctx.fractureAtmosphere.setDimensionTheme(zoneId, false);
  }

  // Show zone enter notification using narrator style for epic feel
  const levelRange = `Level ${minLevel}-${maxLevel}`;
  ctx.showNarratorText(`Entering ${zoneName}`, 'zone');

  // Show warning if under-leveled
  if (warning) {
    setTimeout(() => {
      ctx.showNotification(warning);
    }, 2000);
  }

  console.info(`[Zone] Entered ${zoneName} (${levelRange})`);
  return zone;
}

/**
 * Handle zone info with bonuses
 */
export function handleZoneInfo(
  ctx: GameEventContext,
  zoneId: string,
  rarityBonus: number,
  goldBonus: number,
  xpBonus: number
): void {
  // Store zone bonuses for UI display
  if (ctx.currentZone && ctx.currentZone.id === zoneId) {
    console.info(`[Zone] Bonuses - Rarity: +${rarityBonus}%, Gold: +${goldBonus}%, XP: +${xpBonus}%`);
  }
}

/**
 * Handle boss leaderboard response
 */
export function handleLeaderboardResponse(
  ctx: GameEventContext,
  entries: Array<{ rank: number; name: string; kills: number }>
): void {
  console.info('[Leaderboard] Received entries:', entries);
  // For now, just show in notifications. A full UI can be built later.
  if (entries && entries.length > 0) {
    ctx.showNotification('Boss Kill Leaderboard');
    entries.slice(0, 5).forEach((entry) => {
      ctx.showNotification(`#${entry.rank} ${entry.name}: ${entry.kills} kills`);
    });
  } else {
    ctx.showNotification('No boss kills recorded yet!');
  }
}

/**
 * Handle boss kill announcement
 */
export function handleBossKill(
  ctx: GameEventContext,
  bossName: string,
  killerName: string
): void {
  // Show a dramatic notification for boss kills
  ctx.showNotification(`${killerName} has slain ${bossName}!`);
  console.info(`[Boss] ${killerName} has slain ${bossName}!`);
}

/**
 * Handle kill streak announcement
 */
export function handleKillStreak(
  ctx: GameEventContext,
  playerId: number,
  playerName: string,
  streakCount: number,
  tierTitle: string,
  announcement: string
): void {
  // Show a dramatic announcement for kill streaks
  ctx.showNotification(announcement);
  console.info(`[KillStreak] ${playerName} - ${tierTitle} (${streakCount} kills)`);
}

/**
 * Handle kill streak ended notification
 */
export function handleKillStreakEnded(
  ctx: GameEventContext,
  playerId: number,
  playerName: string,
  streakCount: number,
  endedByName: string
): void {
  // Show notification when a streak ends
  if (streakCount >= 5) {
    const message = endedByName
      ? `${playerName}'s ${streakCount}-kill streak was ended by ${endedByName}!`
      : `${playerName}'s ${streakCount}-kill streak has ended!`;
    ctx.showNotification(message);
    console.info(`[KillStreak] ${message}`);
  }
}

/**
 * Handle nemesis power up notification
 */
export function handleNemesisPowerUp(
  ctx: GameEventContext,
  mobId: number,
  originalName: string,
  nemesisName: string,
  title: string,
  powerLevel: number,
  kills: number,
  victimName: string
): void {
  // Show ominous notification when a nemesis grows stronger
  const message = kills === 2
    ? `A ${originalName} has become ${nemesisName} ${title} after killing ${victimName}!`
    : `${nemesisName} ${title} grows stronger! (${powerLevel}% power)`;
  ctx.showNotification(message);
  console.info(`[Nemesis] ${message}`);
}

/**
 * Handle nemesis killed notification
 */
export function handleNemesisKilled(
  ctx: GameEventContext,
  mobId: number,
  nemesisName: string,
  title: string,
  kills: number,
  killerName: string,
  isRevenge: boolean
): void {
  // Show triumphant notification when a nemesis is slain
  const revengeText = isRevenge ? ' REVENGE!' : '';
  const message = `${killerName} has slain ${nemesisName} ${title}!${revengeText}`;
  ctx.showNotification(message);
  console.info(`[Nemesis] ${message}`);
}

/**
 * Show daily reward popup
 */
export function showDailyRewardPopup(gold: number, xp: number, streak: number): void {
  const popup = document.getElementById('daily-reward-popup');
  if (!popup) return;

  // Update the popup content
  const streakEl = document.getElementById('daily-streak');
  const goldEl = document.getElementById('daily-gold-amount');
  const xpEl = document.getElementById('daily-xp-amount');
  const flamesEl = document.getElementById('streak-flames');

  if (streakEl) streakEl.textContent = streak.toString();
  if (goldEl) goldEl.textContent = gold.toString();
  if (xpEl) xpEl.textContent = xp.toString();

  // Add flames based on streak (cap at 7)
  if (flamesEl) {
    const flameCount = Math.min(streak, 7);
    flamesEl.innerHTML = Array(flameCount).fill('\uD83D\uDD25').join('');
  }

  // Show the popup
  popup.classList.add('show');

  // Hide after 3 seconds
  setTimeout(() => {
    popup.classList.remove('show');
  }, 3000);

  console.info('[Daily] Reward popup shown: +' + gold + 'g, +' + xp + ' XP, streak: ' + streak);
}
