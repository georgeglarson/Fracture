import { Types } from '../gametypes';

export type AchievementCategory = 'combat' | 'wealth' | 'progression' | 'exploration';
export type RequirementType = 'kills' | 'kills_type' | 'gold_earned' | 'gold_spent' | 'level' | 'streak' | 'custom';

export interface AchievementRequirement {
  type: RequirementType;
  target: number;
  mobType?: string;  // for kills_type
}

export interface AchievementReward {
  title?: string;
  gold?: number;
  xp?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  requirement: AchievementRequirement;
  reward?: AchievementReward;
  icon: string;  // CSS class or sprite reference
}

export interface PlayerAchievements {
  unlocked: string[];  // achievement IDs
  progress: Record<string, number>;  // partial progress by achievement ID
  selectedTitle: string | null;  // achievement ID that grants the selected title
}

// All achievements in the game
export const ACHIEVEMENTS: Achievement[] = [
  // === COMBAT ACHIEVEMENTS ===
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Kill your first enemy',
    category: 'combat',
    requirement: { type: 'kills', target: 1 },
    reward: { title: 'Blooded', xp: 10 },
    icon: 'achievement-first-blood'
  },
  {
    id: 'rat_slayer',
    name: 'Rat Slayer',
    description: 'Kill 10 rats',
    category: 'combat',
    requirement: { type: 'kills_type', target: 10, mobType: 'rat' },
    reward: { title: 'Rat Slayer', gold: 25 },
    icon: 'achievement-rat-slayer'
  },
  {
    id: 'skeleton_crusher',
    name: 'Skeleton Crusher',
    description: 'Kill 25 skeletons',
    category: 'combat',
    requirement: { type: 'kills_type', target: 25, mobType: 'skeleton' },
    reward: { title: 'Bone Breaker', gold: 50 },
    icon: 'achievement-skeleton-crusher'
  },
  {
    id: 'boss_hunter',
    name: 'Boss Hunter',
    description: 'Defeat a boss',
    category: 'combat',
    requirement: { type: 'kills_type', target: 1, mobType: 'boss' },
    reward: { title: 'Boss Slayer', gold: 100, xp: 100 },
    icon: 'achievement-boss-hunter'
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Kill 100 enemies',
    category: 'combat',
    requirement: { type: 'kills', target: 100 },
    reward: { title: 'Centurion', gold: 200 },
    icon: 'achievement-centurion'
  },

  // === WEALTH ACHIEVEMENTS ===
  {
    id: 'pocket_change',
    name: 'Pocket Change',
    description: 'Earn 100 gold',
    category: 'wealth',
    requirement: { type: 'gold_earned', target: 100 },
    reward: { xp: 25 },
    icon: 'achievement-pocket-change'
  },
  {
    id: 'investor',
    name: 'Investor',
    description: 'Earn 1,000 gold',
    category: 'wealth',
    requirement: { type: 'gold_earned', target: 1000 },
    reward: { title: 'Merchant', xp: 100 },
    icon: 'achievement-investor'
  },
  {
    id: 'wealthy',
    name: 'Wealthy',
    description: 'Earn 10,000 gold',
    category: 'wealth',
    requirement: { type: 'gold_earned', target: 10000 },
    reward: { title: 'Wealthy', xp: 500 },
    icon: 'achievement-wealthy'
  },
  {
    id: 'first_purchase',
    name: 'First Purchase',
    description: 'Buy something from a shop',
    category: 'wealth',
    requirement: { type: 'gold_spent', target: 1 },
    reward: { gold: 10 },
    icon: 'achievement-first-purchase'
  },

  // === PROGRESSION ACHIEVEMENTS ===
  {
    id: 'adventurer',
    name: 'Adventurer',
    description: 'Reach level 5',
    category: 'progression',
    requirement: { type: 'level', target: 5 },
    reward: { title: 'Adventurer', gold: 50 },
    icon: 'achievement-adventurer'
  },
  {
    id: 'warrior',
    name: 'Warrior',
    description: 'Reach level 10',
    category: 'progression',
    requirement: { type: 'level', target: 10 },
    reward: { title: 'Warrior', gold: 100 },
    icon: 'achievement-warrior'
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Reach level 20',
    category: 'progression',
    requirement: { type: 'level', target: 20 },
    reward: { title: 'Veteran', gold: 250 },
    icon: 'achievement-veteran'
  },
  {
    id: 'champion',
    name: 'Champion',
    description: 'Reach level 30',
    category: 'progression',
    requirement: { type: 'level', target: 30 },
    reward: { title: 'Champion', gold: 500, xp: 500 },
    icon: 'achievement-champion'
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'Reach level 40',
    category: 'progression',
    requirement: { type: 'level', target: 40 },
    reward: { title: 'Elite', gold: 1000, xp: 1000 },
    icon: 'achievement-elite'
  },
  {
    id: 'legend',
    name: 'Legend',
    description: 'Reach level 50',
    category: 'progression',
    requirement: { type: 'level', target: 50 },
    reward: { title: 'Legend', gold: 2500, xp: 2500 },
    icon: 'achievement-legend'
  },

  // === EXPLORATION ACHIEVEMENTS ===
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Enter the game world',
    category: 'exploration',
    requirement: { type: 'custom', target: 1 },
    reward: { title: 'Newcomer', gold: 5 },
    icon: 'achievement-first-steps'
  },
  {
    id: 'daily_devotee',
    name: 'Daily Devotee',
    description: 'Login 7 days in a row',
    category: 'exploration',
    requirement: { type: 'streak', target: 7 },
    reward: { title: 'Devoted', gold: 100, xp: 200 },
    icon: 'achievement-daily-devotee'
  }
];

// Helper to get achievement by ID
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// Helper to get achievements by category
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

// Get the title string for an achievement (if any)
export function getAchievementTitle(achievementId: string): string | null {
  const achievement = getAchievementById(achievementId);
  return achievement?.reward?.title || null;
}

// Get mob type string from entity kind
export function getMobTypeFromKind(kind: number): string | null {
  const kindStr = Types.getKindAsString(kind);
  if (kindStr && Types.isMob(kind)) {
    return kindStr;
  }
  return null;
}

// Create empty player achievements state
export function createEmptyPlayerAchievements(): PlayerAchievements {
  return {
    unlocked: [],
    progress: {},
    selectedTitle: null
  };
}
