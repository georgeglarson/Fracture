/**
 * ProgressionHandler - Manages XP/Gold efficiency, rested bonuses, and ascension
 *
 * Single Responsibility: Track session efficiency and apply progression multipliers
 */

import { Types } from '../../../shared/ts/gametypes';

/**
 * Ascension titles based on prestige level
 */
const ASCENSION_TITLES = [
  '',           // 0 - no title
  'Ascended',   // 1
  'Transcendent', // 2
  'Exalted',    // 3
  'Divine',     // 4
  'Eternal',    // 5
  // 6+ get "Eternal II", "Eternal III", etc.
];

/**
 * Session efficiency tiers (diminishing returns)
 */
const EFFICIENCY_TIERS = [
  { maxMinutes: 30, rate: 1.0 },    // 0-30 min: 100%
  { maxMinutes: 60, rate: 0.75 },   // 30-60 min: 75%
  { maxMinutes: 90, rate: 0.50 },   // 60-90 min: 50%
  { maxMinutes: Infinity, rate: 0.25 } // 90+ min: 25%
];

/**
 * Configuration constants
 */
const RESTED_XP_PER_HOUR = 5;     // 5% per hour offline
const RESTED_XP_MAX = 100;        // Max 100% rested bonus
const RESTED_BURN_RATE = 1;       // 1% per kill
const RESET_OFFLINE_HOURS = 4;    // Hours offline to reset efficiency
const MAX_LEVEL = 50;             // Level required for ascension

// Ascension bonuses (per ascension)
const ASCENSION_XP_BONUS = 0.10;     // +10% XP per ascension
const ASCENSION_DAMAGE_BONUS = 0.05; // +5% damage per ascension
const ASCENSION_HP_BONUS = 0.05;     // +5% HP per ascension

/**
 * Player context for progression operations
 */
export interface ProgressionPlayerContext {
  id: number;
  name: string;
  level: number;
  xp: number;

  // Progression data
  ascensionCount: number;
  restedXp: number;
  lastLogoutTime: number;
  sessionStartTime: number;   // In-memory only, set on login

  // Methods
  send: (message: any) => void;
  setLevel: (level: number) => void;
  setXp: (xp: number) => void;
  getMaxHitPoints: () => number;
}

/**
 * Get ascension title based on count
 */
export function getAscensionTitle(ascensionCount: number): string {
  if (ascensionCount === 0) return '';
  if (ascensionCount <= 5) return ASCENSION_TITLES[ascensionCount];
  return `Eternal ${toRoman(ascensionCount - 4)}`; // Eternal II, III, IV...
}

/**
 * Convert number to roman numerals (for titles)
 */
function toRoman(num: number): string {
  const romanNumerals = [
    ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
  ] as const;

  let result = '';
  let remaining = num;
  for (const [letter, value] of romanNumerals) {
    while (remaining >= value) {
      result += letter;
      remaining -= value;
    }
  }
  return result;
}

/**
 * Calculate session efficiency based on time played
 */
export function getSessionEfficiency(sessionStartTime: number): number {
  if (!sessionStartTime) return 1.0;

  const minutesPlayed = (Date.now() - sessionStartTime) / (1000 * 60);

  for (const tier of EFFICIENCY_TIERS) {
    if (minutesPlayed < tier.maxMinutes) {
      return tier.rate;
    }
  }
  return 0.25; // Fallback
}

/**
 * Calculate rested XP accumulated during offline time
 */
export function calculateRestedXp(lastLogoutTime: number, currentRestedXp: number): number {
  if (!lastLogoutTime) return currentRestedXp;

  const hoursOffline = (Date.now() - lastLogoutTime) / (1000 * 60 * 60);
  const newRested = Math.min(RESTED_XP_MAX, currentRestedXp + (hoursOffline * RESTED_XP_PER_HOUR));

  return Math.round(newRested * 10) / 10; // Round to 1 decimal
}

/**
 * Check if session efficiency should be reset (player was offline long enough)
 */
export function shouldResetEfficiency(lastLogoutTime: number): boolean {
  if (!lastLogoutTime) return true;
  const hoursOffline = (Date.now() - lastLogoutTime) / (1000 * 60 * 60);
  return hoursOffline >= RESET_OFFLINE_HOURS;
}

/**
 * Calculate XP multiplier including all bonuses
 */
export function calculateXpMultiplier(ctx: ProgressionPlayerContext): {
  total: number;
  efficiency: number;
  rested: number;
  ascension: number;
} {
  const efficiency = getSessionEfficiency(ctx.sessionStartTime);
  const rested = ctx.restedXp > 0 ? (ctx.restedXp / 100) : 0; // Convert % to multiplier
  const ascension = ctx.ascensionCount * ASCENSION_XP_BONUS;

  // Efficiency applies first, then bonuses add on
  const total = efficiency * (1 + rested + ascension);

  return { total, efficiency, rested, ascension };
}

/**
 * Apply XP gain with all multipliers, consume rested XP
 */
export function applyXpGain(ctx: ProgressionPlayerContext, baseXp: number): {
  finalXp: number;
  restedConsumed: number;
} {
  const multipliers = calculateXpMultiplier(ctx);
  let finalXp = Math.floor(baseXp * multipliers.total);

  // Consume rested XP if any was used
  let restedConsumed = 0;
  if (ctx.restedXp > 0) {
    restedConsumed = Math.min(ctx.restedXp, RESTED_BURN_RATE);
    ctx.restedXp = Math.max(0, ctx.restedXp - restedConsumed);
  }

  return { finalXp, restedConsumed };
}

/**
 * Apply gold gain with efficiency multiplier (no rested bonus for gold)
 */
export function applyGoldMultiplier(ctx: ProgressionPlayerContext, baseGold: number): number {
  const efficiency = getSessionEfficiency(ctx.sessionStartTime);
  return Math.floor(baseGold * efficiency);
}

/**
 * Get ascension damage bonus multiplier
 */
export function getAscensionDamageMultiplier(ascensionCount: number): number {
  return 1 + (ascensionCount * ASCENSION_DAMAGE_BONUS);
}

/**
 * Get ascension HP bonus multiplier
 */
export function getAscensionHpMultiplier(ascensionCount: number): number {
  return 1 + (ascensionCount * ASCENSION_HP_BONUS);
}

/**
 * Check if player can ascend
 */
export function canAscend(level: number): boolean {
  return level >= MAX_LEVEL;
}

/**
 * Perform ascension - returns new state
 */
export function performAscension(ctx: ProgressionPlayerContext): boolean {
  if (!canAscend(ctx.level)) {
    console.log(`[Progression] ${ctx.name} cannot ascend - level ${ctx.level} < ${MAX_LEVEL}`);
    return false;
  }

  // Increment ascension count
  ctx.ascensionCount += 1;

  // Reset level and XP
  ctx.setLevel(1);
  ctx.setXp(0);

  const title = getAscensionTitle(ctx.ascensionCount);
  console.log(`[Progression] ${ctx.name} ASCENDED! Now ${title} (Ascension ${ctx.ascensionCount})`);

  // Send ascension notification to client
  ctx.send([Types.Messages.PROGRESSION_ASCEND, ctx.ascensionCount, title]);

  return true;
}

/**
 * Initialize progression on player login
 */
export function initProgression(ctx: ProgressionPlayerContext): void {
  // Calculate rested XP from time offline
  if (ctx.lastLogoutTime > 0) {
    const previousRested = ctx.restedXp;
    ctx.restedXp = calculateRestedXp(ctx.lastLogoutTime, ctx.restedXp);

    if (ctx.restedXp > previousRested) {
      console.log(`[Progression] ${ctx.name} gained ${(ctx.restedXp - previousRested).toFixed(1)}% rested XP`);
    }
  }

  // Set session start time
  ctx.sessionStartTime = Date.now();

  // Send progression init to client
  sendProgressionInit(ctx);
}

/**
 * Send progression state to client
 */
export function sendProgressionInit(ctx: ProgressionPlayerContext): void {
  const efficiency = getSessionEfficiency(ctx.sessionStartTime);
  const title = getAscensionTitle(ctx.ascensionCount);

  ctx.send([Types.Messages.PROGRESSION_INIT, {
    ascensionCount: ctx.ascensionCount,
    restedXp: Math.round(ctx.restedXp * 10) / 10,
    efficiency: Math.round(efficiency * 100),
    title: title,
    canAscend: canAscend(ctx.level),
    maxLevel: MAX_LEVEL,
    bonuses: {
      xp: Math.round(ctx.ascensionCount * ASCENSION_XP_BONUS * 100),
      damage: Math.round(ctx.ascensionCount * ASCENSION_DAMAGE_BONUS * 100),
      hp: Math.round(ctx.ascensionCount * ASCENSION_HP_BONUS * 100)
    }
  }]);
}

/**
 * Update session logout time for rested XP calculation
 */
export function onPlayerLogout(ctx: ProgressionPlayerContext): number {
  return Date.now();
}

/**
 * Handle ascension request from client
 */
export function handleAscendRequest(ctx: ProgressionPlayerContext): void {
  if (performAscension(ctx)) {
    // Send updated progression state
    sendProgressionInit(ctx);
  }
}
