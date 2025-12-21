/**
 * Skill System - Core definitions for combat abilities
 *
 * Skills are active abilities on cooldown that give players combat agency.
 * All skill effects are server-authoritative.
 */

export enum SkillId {
  PHASE_SHIFT = 'phase_shift',
  POWER_STRIKE = 'power_strike',
  WAR_CRY = 'war_cry',
  WHIRLWIND = 'whirlwind'
}

export enum SkillType {
  MOBILITY = 'mobility',
  OFFENSIVE = 'offensive',
  UTILITY = 'utility'
}

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  type: SkillType;
  unlockLevel: number;
  cooldown: number;       // seconds
  hotkey: number;         // 1-4
  icon: string;           // CSS class or sprite name

  // Skill-specific parameters
  params: SkillParams;
}

export type SkillParams =
  | PhaseShiftParams
  | PowerStrikeParams
  | WarCryParams
  | WhirlwindParams;

export interface PhaseShiftParams {
  type: 'phase_shift';
  duration: number;       // ms - how long invisibility lasts
}

export interface PowerStrikeParams {
  type: 'power_strike';
  damageMultiplier: number;
  duration: number;       // ms - buff duration
}

export interface WarCryParams {
  type: 'war_cry';
  radius: number;         // tiles
  stunDuration: number;   // ms
}

export interface WhirlwindParams {
  type: 'whirlwind';
  radius: number;         // tiles
  damagePercent: number;  // % of weapon damage
}

/**
 * Master skill definitions - source of truth
 */
export const SKILLS: Record<SkillId, SkillDefinition> = {
  [SkillId.PHASE_SHIFT]: {
    id: SkillId.PHASE_SHIFT,
    name: 'Phase Shift',
    description: 'Become invisible for 2s. Enemies lose aggro and you can walk through them.',
    type: SkillType.MOBILITY,
    unlockLevel: 5,
    cooldown: 12,
    hotkey: 1,
    icon: 'skill-phase',
    params: {
      type: 'phase_shift',
      duration: 2000  // 2 seconds
    }
  },

  [SkillId.POWER_STRIKE]: {
    id: SkillId.POWER_STRIKE,
    name: 'Power Strike',
    description: 'Your next attack deals 200% damage',
    type: SkillType.OFFENSIVE,
    unlockLevel: 10,
    cooldown: 12,
    hotkey: 2,
    icon: 'skill-power-strike',
    params: {
      type: 'power_strike',
      damageMultiplier: 2.0,
      duration: 5000  // 5 seconds to use the empowered attack
    }
  },

  [SkillId.WAR_CRY]: {
    id: SkillId.WAR_CRY,
    name: 'War Cry',
    description: 'Stun all enemies within 2 tiles for 1.5 seconds',
    type: SkillType.UTILITY,
    unlockLevel: 15,
    cooldown: 20,
    hotkey: 3,
    icon: 'skill-war-cry',
    params: {
      type: 'war_cry',
      radius: 3,
      stunDuration: 3000
    }
  },

  [SkillId.WHIRLWIND]: {
    id: SkillId.WHIRLWIND,
    name: 'Whirlwind',
    description: 'Deal 75% weapon damage to all enemies within 1 tile',
    type: SkillType.OFFENSIVE,
    unlockLevel: 20,
    cooldown: 15,
    hotkey: 4,
    icon: 'skill-whirlwind',
    params: {
      type: 'whirlwind',
      radius: 1,
      damagePercent: 75
    }
  }
};

/**
 * Get skills unlocked at or before a given level
 */
export function getUnlockedSkills(level: number): SkillDefinition[] {
  return Object.values(SKILLS).filter(skill => skill.unlockLevel <= level);
}

/**
 * Get skill by hotkey (1-4)
 */
export function getSkillByHotkey(hotkey: number): SkillDefinition | null {
  return Object.values(SKILLS).find(skill => skill.hotkey === hotkey) || null;
}

/**
 * Check if player has unlocked a skill
 */
export function hasUnlockedSkill(skillId: SkillId, playerLevel: number): boolean {
  const skill = SKILLS[skillId];
  return skill ? playerLevel >= skill.unlockLevel : false;
}

/**
 * Player skill state - tracked per player
 */
export interface PlayerSkillState {
  cooldowns: Record<SkillId, number>;  // skill -> timestamp when ready
  powerStrikeActive: boolean;          // For Power Strike buff tracking
  powerStrikeExpires: number;          // Timestamp when buff expires
  phaseShiftActive: boolean;           // For Phase Shift invisibility
  phaseShiftExpires: number;           // Timestamp when phasing ends
}

/**
 * Create initial skill state for a new player
 */
export function createInitialSkillState(): PlayerSkillState {
  return {
    cooldowns: {
      [SkillId.PHASE_SHIFT]: 0,
      [SkillId.POWER_STRIKE]: 0,
      [SkillId.WAR_CRY]: 0,
      [SkillId.WHIRLWIND]: 0
    },
    powerStrikeActive: false,
    powerStrikeExpires: 0,
    phaseShiftActive: false,
    phaseShiftExpires: 0
  };
}

/**
 * Check if a skill is ready (off cooldown)
 */
export function isSkillReady(state: PlayerSkillState, skillId: SkillId): boolean {
  return Date.now() >= (state.cooldowns[skillId] || 0);
}

/**
 * Get remaining cooldown in seconds
 */
export function getRemainingCooldown(state: PlayerSkillState, skillId: SkillId): number {
  const readyAt = state.cooldowns[skillId] || 0;
  const remaining = readyAt - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}
