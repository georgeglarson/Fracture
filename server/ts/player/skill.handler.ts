/**
 * SkillHandler - Handles all skill operations for players
 *
 * Single Responsibility: Skill usage, cooldowns, and effect execution
 */

import { Types } from '../../../shared/ts/gametypes';
import {
  SkillId,
  SKILLS,
  PlayerSkillState,
  createInitialSkillState,
  isSkillReady,
  hasUnlockedSkill,
  getUnlockedSkills
} from '../../../shared/ts/skills';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Skill');

/**
 * Player context for skill operations
 * Uses existing Player/World methods
 */
export interface SkillPlayerContext {
  id: number;
  name: string;
  x: number;
  y: number;
  orientation: number;
  level: number;
  weapon: number;
  armor: number;
  hitPoints: number;
  maxHitPoints: number;

  // Methods
  send: (message: any) => void;
  broadcast: (message: any, ignoreSelf?: boolean) => void;
  broadcastToZone: (message: any, ignoreSelf?: boolean) => void;
  setPosition: (x: number, y: number) => void;

  // Skill state (stored on player)
  getSkillState: () => PlayerSkillState;

  // World access (uses existing World class via getter)
  getWorld: () => {
    isValidPosition: (x: number, y: number) => boolean;
    forEachMob: (callback: (mob: any) => void) => void;
  };

  // Combat reference for damage calculation
  getWeaponDamage: () => { min: number; max: number };

  // Power strike buff
  setPowerStrikeBuff: (active: boolean, expires: number) => void;

  // Phase shift (invisibility)
  setPhaseShift: (active: boolean, expires: number) => void;
}

/**
 * Send skill init to client (unlocked skills and current cooldowns)
 */
export function sendSkillInit(ctx: SkillPlayerContext): void {
  const unlockedSkills = getUnlockedSkills(ctx.level);
  const skillState = ctx.getSkillState();

  const skillData = unlockedSkills.map(skill => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    cooldown: skill.cooldown,
    hotkey: skill.hotkey,
    icon: skill.icon,
    remainingCooldown: Math.max(0, Math.ceil((skillState.cooldowns[skill.id] - Date.now()) / 1000))
  }));

  ctx.send([Types.Messages.SKILL_INIT, skillData]);
}

/**
 * Check if a new skill was unlocked on level up and notify
 */
export function checkSkillUnlock(ctx: SkillPlayerContext, oldLevel: number, newLevel: number): void {
  for (const skill of Object.values(SKILLS)) {
    if (skill.unlockLevel > oldLevel && skill.unlockLevel <= newLevel) {
      // New skill unlocked!
      ctx.send([Types.Messages.SKILL_UNLOCK, {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        cooldown: skill.cooldown,
        hotkey: skill.hotkey,
        icon: skill.icon
      }]);

      log.info({ player: ctx.name, skill: skill.name, level: newLevel }, 'Unlocked skill');
    }
  }
}

/**
 * Handle skill use request from client
 */
export function handleSkillUse(ctx: SkillPlayerContext, skillId: string): void {
  try {
    log.info({ player: ctx.name, skillId }, 'Attempting to use skill');

    const skill = SKILLS[skillId as SkillId];

    if (!skill) {
      log.info({ skillId }, 'Unknown skill');
      return;
    }

    // Check if player has unlocked this skill
    if (!hasUnlockedSkill(skillId as SkillId, ctx.level)) {
      log.info({ player: ctx.name, skill: skill.name, playerLevel: ctx.level, requiredLevel: skill.unlockLevel }, 'Skill not unlocked');
      return;
    }

    // Check cooldown
    const skillState = ctx.getSkillState();
    if (!isSkillReady(skillState, skillId as SkillId)) {
      const remaining = Math.ceil((skillState.cooldowns[skillId as SkillId] - Date.now()) / 1000);
      log.debug({ player: ctx.name, skill: skill.name, remainingSeconds: remaining }, 'Skill on cooldown');
      return;
    }

    // Execute skill
    const success = executeSkill(ctx, skill);

    if (success) {
      // Set cooldown
      skillState.cooldowns[skillId as SkillId] = Date.now() + (skill.cooldown * 1000);

      // Send cooldown update to player
      ctx.send([Types.Messages.SKILL_COOLDOWN, skillId, skill.cooldown]);

      // Send skill effect to the player (for visual feedback)
      // Using direct send since broadcastToZone requires Message objects with serialize()
      ctx.send([Types.Messages.SKILL_EFFECT, ctx.id, skillId, ctx.x, ctx.y, ctx.orientation]);

      log.info({ player: ctx.name, skill: skill.name }, 'Used skill');
    }
  } catch (error) {
    log.error({ err: error }, 'Error in handleSkillUse');
  }
}

/**
 * Execute a specific skill - returns true if successful
 */
function executeSkill(ctx: SkillPlayerContext, skill: typeof SKILLS[SkillId]): boolean {
  switch (skill.params.type) {
    case 'phase_shift':
      return executePhaseShift(ctx, skill.params.duration);

    case 'power_strike':
      return executePowerStrike(ctx, skill.params.damageMultiplier, skill.params.duration);

    case 'war_cry':
      return executeWarCry(ctx, skill.params.radius, skill.params.stunDuration);

    case 'whirlwind':
      return executeWhirlwind(ctx, skill.params.radius, skill.params.damagePercent);

    default:
      log.info('Unknown skill type');
      return false;
  }
}

/**
 * Phase Shift - Become invisible, clear aggro, allow walking through entities
 */
function executePhaseShift(ctx: SkillPlayerContext, duration: number): boolean {
  const expires = Date.now() + duration;
  const skillState = ctx.getSkillState();

  // Set phase shift active
  skillState.phaseShiftActive = true;
  skillState.phaseShiftExpires = expires;
  ctx.setPhaseShift(true, expires);

  // Make all mobs completely forget this player
  // This removes them from hate lists and makes mobs return to spawn if no other targets
  ctx.getWorld().forEachMob((mob: any) => {
    // Clear target if mob was actively targeting this player
    if (mob.target === ctx.id) {
      if (mob.clearTarget) {
        mob.clearTarget();
      }
    }
    // Remove from aggro/hate tracking
    if (mob.forgetPlayer) {
      mob.forgetPlayer(ctx.id);
    }
  });

  log.info({ player: ctx.name, durationMs: duration }, 'Activated Phase Shift');
  return true;
}

/**
 * Power Strike - Buff next attack for double damage
 */
function executePowerStrike(ctx: SkillPlayerContext, multiplier: number, duration: number): boolean {
  const expires = Date.now() + duration;
  ctx.setPowerStrikeBuff(true, expires);

  // Store the multiplier in skill state for combat system to check
  const skillState = ctx.getSkillState();
  skillState.powerStrikeActive = true;
  skillState.powerStrikeExpires = expires;

  return true;
}

/**
 * Calculate distance between two points
 */
function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

/**
 * War Cry - Stun all enemies in radius
 */
function executeWarCry(ctx: SkillPlayerContext, radius: number, stunDuration: number): boolean {
  let stunCount = 0;

  ctx.getWorld().forEachMob((mob: any) => {
    // Skip dead mobs
    if (mob.isDead) return;

    const dist = getDistance(ctx.x, ctx.y, mob.x, mob.y);
    if (dist <= radius) {
      // Stun the mob - clear target and prevent re-aggro
      if (mob.clearTarget) {
        mob.clearTarget();
      }
      // Set stun timer to prevent attacks and re-aggro during stun
      mob.stunUntil = Date.now() + stunDuration;
      stunCount++;
    }
  });

  log.info({ stunCount, radius }, 'War Cry stunned enemies');
  return true;
}

/**
 * Whirlwind - Deal AOE damage to all enemies in radius
 */
function executeWhirlwind(ctx: SkillPlayerContext, radius: number, damagePercent: number): boolean {
  const weaponDmg = ctx.getWeaponDamage();

  // Calculate damage as percentage of weapon average
  const avgDamage = (weaponDmg.min + weaponDmg.max) / 2;
  const damage = Math.floor(avgDamage * (damagePercent / 100));

  let hitCount = 0;

  ctx.getWorld().forEachMob((mob: any) => {
    const dist = getDistance(ctx.x, ctx.y, mob.x, mob.y);
    if (dist <= radius && !mob.isDead) {
      // Deal damage directly
      mob.receiveDamage(damage);
      hitCount++;

      // Send damage feedback to the player who used the skill
      // Using ctx.send() since broadcastToZone requires serialize()
      ctx.send([Types.Messages.DAMAGE, mob.id, damage]);
    }
  });

  log.info({ hitCount, damage }, 'Whirlwind hit enemies');
  return true;
}

/**
 * Check and consume power strike buff on attack
 * Returns damage multiplier (1.0 if no buff, 2.0 if buff active)
 */
export function consumePowerStrikeBuff(ctx: SkillPlayerContext): number {
  const skillState = ctx.getSkillState();

  if (skillState.powerStrikeActive && Date.now() < skillState.powerStrikeExpires) {
    // Consume the buff
    skillState.powerStrikeActive = false;
    skillState.powerStrikeExpires = 0;
    ctx.setPowerStrikeBuff(false, 0);

    log.info({ player: ctx.name }, 'Consumed Power Strike buff');
    return 2.0; // Double damage
  }

  return 1.0; // Normal damage
}
