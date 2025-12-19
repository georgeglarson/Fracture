/**
 * Fracture Rift Data - Shared definitions for roguelike dungeon content
 *
 * Fracture Rifts are infinitely scaling challenge dungeons with:
 * - Progressive difficulty per depth level
 * - Random modifiers per run
 * - Leaderboard competition
 * - Scaling rewards
 */

import { Types } from '../gametypes';

/**
 * Rift modifier types - random effects applied to each run
 */
export enum RiftModifier {
  // Enemy modifiers (harder)
  EMPOWERED = 'empowered',         // +50% enemy damage
  FORTIFIED = 'fortified',         // +50% enemy HP
  SWIFT = 'swift',                 // +30% enemy speed
  VAMPIRIC = 'vampiric',           // Enemies heal 10% of damage dealt
  EXPLOSIVE = 'explosive',         // Enemies explode on death

  // Player debuffs (harder)
  FRAGILE = 'fragile',             // -25% player HP
  WEAKENED = 'weakened',           // -25% player damage
  CURSED = 'cursed',               // No healing from consumables
  BLINDED = 'blinded',             // Reduced visibility range

  // Player buffs (easier - rare)
  BLESSED = 'blessed',             // +25% player damage
  RESILIENT = 'resilient',         // +25% player HP
  LUCKY = 'lucky',                 // 2x drop rate
  HASTY = 'hasty'                  // +30% player speed
}

/**
 * Modifier definition with display info
 */
export interface ModifierDefinition {
  id: RiftModifier;
  name: string;
  description: string;
  color: string;            // Display color
  difficulty: number;       // Difficulty multiplier (1.0 = neutral, >1 = harder)
  isDebuff: boolean;        // True if makes run harder
}

/**
 * All modifier definitions
 */
export const MODIFIERS: Record<RiftModifier, ModifierDefinition> = {
  [RiftModifier.EMPOWERED]: {
    id: RiftModifier.EMPOWERED,
    name: 'Empowered',
    description: 'Enemies deal 50% more damage',
    color: '#ff4444',
    difficulty: 1.3,
    isDebuff: true
  },
  [RiftModifier.FORTIFIED]: {
    id: RiftModifier.FORTIFIED,
    name: 'Fortified',
    description: 'Enemies have 50% more health',
    color: '#ff6600',
    difficulty: 1.25,
    isDebuff: true
  },
  [RiftModifier.SWIFT]: {
    id: RiftModifier.SWIFT,
    name: 'Swift',
    description: 'Enemies move 30% faster',
    color: '#ffaa00',
    difficulty: 1.15,
    isDebuff: true
  },
  [RiftModifier.VAMPIRIC]: {
    id: RiftModifier.VAMPIRIC,
    name: 'Vampiric',
    description: 'Enemies heal 10% of damage dealt',
    color: '#aa00ff',
    difficulty: 1.2,
    isDebuff: true
  },
  [RiftModifier.EXPLOSIVE]: {
    id: RiftModifier.EXPLOSIVE,
    name: 'Explosive',
    description: 'Enemies explode on death',
    color: '#ff0000',
    difficulty: 1.35,
    isDebuff: true
  },
  [RiftModifier.FRAGILE]: {
    id: RiftModifier.FRAGILE,
    name: 'Fragile',
    description: 'You have 25% less health',
    color: '#ff8888',
    difficulty: 1.25,
    isDebuff: true
  },
  [RiftModifier.WEAKENED]: {
    id: RiftModifier.WEAKENED,
    name: 'Weakened',
    description: 'You deal 25% less damage',
    color: '#888888',
    difficulty: 1.2,
    isDebuff: true
  },
  [RiftModifier.CURSED]: {
    id: RiftModifier.CURSED,
    name: 'Cursed',
    description: 'Consumables cannot heal you',
    color: '#660066',
    difficulty: 1.3,
    isDebuff: true
  },
  [RiftModifier.BLINDED]: {
    id: RiftModifier.BLINDED,
    name: 'Blinded',
    description: 'Reduced visibility range',
    color: '#333333',
    difficulty: 1.1,
    isDebuff: true
  },
  [RiftModifier.BLESSED]: {
    id: RiftModifier.BLESSED,
    name: 'Blessed',
    description: 'You deal 25% more damage',
    color: '#44ff44',
    difficulty: 0.8,
    isDebuff: false
  },
  [RiftModifier.RESILIENT]: {
    id: RiftModifier.RESILIENT,
    name: 'Resilient',
    description: 'You have 25% more health',
    color: '#44ffff',
    difficulty: 0.85,
    isDebuff: false
  },
  [RiftModifier.LUCKY]: {
    id: RiftModifier.LUCKY,
    name: 'Lucky',
    description: 'Double drop rate',
    color: '#ffff00',
    difficulty: 0.9,
    isDebuff: false
  },
  [RiftModifier.HASTY]: {
    id: RiftModifier.HASTY,
    name: 'Hasty',
    description: 'You move 30% faster',
    color: '#00ffff',
    difficulty: 0.9,
    isDebuff: false
  }
};

/**
 * Rift tier (depth) - determines base difficulty and rewards
 */
export interface RiftTier {
  depth: number;              // Rift level (1-∞)
  hpMultiplier: number;       // Enemy HP multiplier
  damageMultiplier: number;   // Enemy damage multiplier
  xpMultiplier: number;       // XP reward multiplier
  goldMultiplier: number;     // Gold reward multiplier
  dropRateBonus: number;      // Extra drop rate (0-1)
  modifierCount: number;      // Number of random modifiers
  minLevel: number;           // Minimum player level to enter
  bossAtEnd: boolean;         // Whether a boss spawns at end
}

/**
 * Calculate rift tier stats for a given depth
 */
export function getRiftTier(depth: number): RiftTier {
  // Exponential scaling - gets progressively harder
  const scaleFactor = Math.pow(1.15, depth - 1);

  return {
    depth,
    hpMultiplier: 1 + (depth * 0.25),           // +25% HP per depth
    damageMultiplier: 1 + (depth * 0.15),       // +15% damage per depth
    xpMultiplier: 1 + (depth * 0.5),            // +50% XP per depth
    goldMultiplier: 1 + (depth * 0.4),          // +40% gold per depth
    dropRateBonus: Math.min(0.5, depth * 0.02), // +2% per depth, caps at 50%
    modifierCount: Math.min(4, Math.floor(depth / 3) + 1), // 1-4 modifiers
    minLevel: Math.min(40, depth * 2),          // Level 2, 4, 6... up to 40
    bossAtEnd: depth >= 5 && depth % 5 === 0    // Boss every 5 depths starting at 5
  };
}

/**
 * Rift entrance portal locations (zone-based)
 */
export interface RiftEntranceLocation {
  zone: string;
  x: number;
  y: number;
  minLevel: number;  // Minimum level to see/use this portal
}

/**
 * Fixed rift entrance locations in the world
 */
export const RIFT_ENTRANCES: RiftEntranceLocation[] = [
  { zone: 'village', x: 50, y: 50, minLevel: 5 },
  { zone: 'forest', x: 120, y: 80, minLevel: 10 },
  { zone: 'beach', x: 40, y: 140, minLevel: 15 },
  { zone: 'cave', x: 90, y: 110, minLevel: 20 },
  { zone: 'desert', x: 160, y: 50, minLevel: 25 },
  { zone: 'lavaland', x: 200, y: 100, minLevel: 30 }
];

/**
 * Active rift run state
 */
export interface RiftRunState {
  runId: string;              // Unique run identifier
  playerId: number;           // Player in the rift
  playerName: string;         // Player name for leaderboard
  depth: number;              // Current depth level
  modifiers: RiftModifier[];  // Active modifiers for this run
  killCount: number;          // Enemies killed this run
  startTime: number;          // Run start timestamp
  currentFloorKills: number;  // Kills on current floor
  requiredKills: number;      // Kills needed to advance
  isComplete: boolean;        // Run finished (death or exit)
  completedDepth: number;     // Highest depth completed
}

/**
 * Leaderboard entry
 */
export interface RiftLeaderboardEntry {
  rank: number;
  playerName: string;
  maxDepth: number;
  totalKills: number;
  completionTime: number;     // Time to reach max depth (ms)
  modifierCount: number;      // How many debuff modifiers
  timestamp: number;          // When the run was completed
}

/**
 * Calculate required kills for a floor
 */
export function getRequiredKills(depth: number): number {
  // Base 5 kills, +2 per depth
  return 5 + (depth * 2);
}

/**
 * Calculate total difficulty multiplier for a run
 */
export function calculateDifficultyMultiplier(depth: number, modifiers: RiftModifier[]): number {
  const tier = getRiftTier(depth);
  const baseDifficulty = tier.hpMultiplier * tier.damageMultiplier;

  // Add modifier difficulties
  let modifierMultiplier = 1.0;
  for (const mod of modifiers) {
    modifierMultiplier *= MODIFIERS[mod].difficulty;
  }

  return baseDifficulty * modifierMultiplier;
}

/**
 * Get mob types that can spawn at a given rift depth
 */
export function getRiftMobTypes(depth: number): number[] {
  // Progress through mob tiers based on depth
  const allMobs = [
    Types.Entities.RAT,
    Types.Entities.CRAB,
    Types.Entities.BAT,
    Types.Entities.GOBLIN,
    Types.Entities.SKELETON,
    Types.Entities.SNAKE,
    Types.Entities.OGRE,
    Types.Entities.SPECTRE,
    Types.Entities.DEATHKNIGHT,
    Types.Entities.EYE,
    Types.Entities.BOSS
  ];

  // Start with easier mobs, add harder ones as depth increases
  const mobCount = Math.min(allMobs.length, 3 + Math.floor(depth / 2));
  const startIndex = Math.min(allMobs.length - mobCount, Math.floor(depth / 3));

  return allMobs.slice(startIndex, startIndex + mobCount);
}

/**
 * Select random modifiers for a rift run
 */
export function selectRandomModifiers(count: number, seed?: number): RiftModifier[] {
  const debuffMods = Object.values(RiftModifier).filter(m => MODIFIERS[m].isDebuff);
  const buffMods = Object.values(RiftModifier).filter(m => !MODIFIERS[m].isDebuff);

  const selected: RiftModifier[] = [];
  const random = seed ? (() => {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  })() : Math.random;

  // 80% chance each modifier is a debuff
  for (let i = 0; i < count; i++) {
    const pool = random() < 0.8 ? debuffMods : buffMods;
    const availableMods = pool.filter(m => !selected.includes(m));
    if (availableMods.length > 0) {
      const idx = Math.floor(random() * availableMods.length);
      selected.push(availableMods[idx]);
    }
  }

  return selected;
}

/**
 * Format modifier for display
 */
export function formatModifier(modifier: RiftModifier): { name: string; description: string; color: string } {
  const def = MODIFIERS[modifier];
  return {
    name: def.name,
    description: def.description,
    color: def.color
  };
}

/**
 * Calculate rewards for completing a rift depth
 */
export function calculateRiftRewards(depth: number, modifiers: RiftModifier[], killCount: number): {
  xp: number;
  gold: number;
  bonusDropChance: number;
} {
  const tier = getRiftTier(depth);
  const difficultyBonus = calculateDifficultyMultiplier(depth, modifiers);

  // Base rewards scale with depth and difficulty
  const baseXP = 100 * depth * tier.xpMultiplier * (difficultyBonus / 2);
  const baseGold = 50 * depth * tier.goldMultiplier * (difficultyBonus / 2);

  return {
    xp: Math.floor(baseXP + (killCount * 5)),
    gold: Math.floor(baseGold + (killCount * 2)),
    bonusDropChance: tier.dropRateBonus
  };
}
