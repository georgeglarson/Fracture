/**
 * SkillUIHandler - Handles skill bar initialization, effects, cooldowns, and unlocks
 *
 * Single Responsibility: Skill UI lifecycle and visual feedback
 * Extracted from Game.ts to reduce its size.
 */

import { SkillBarUI } from '../ui/skill-bar-ui';
import { SkillId } from '../../../shared/ts/skills';

/**
 * Game context for skill UI operations
 */
export interface SkillUIContext {
  // UI
  skillBarUI: SkillBarUI | null;

  // State
  playerId: number;

  // Dependencies
  client: { sendSkillUse: (skillId: string) => void } | null;
  entityManager: { getEntityById: (id: string | number) => any } | null;
  player: { hasTarget: () => boolean; removeTarget: () => void } | null;
  renderer: { particles: { spawnHitParticles: (x: number, y: number, count: number, color: string) => void }; camera: { shake: (intensity: number, duration: number) => void } } | null;
  audioManager: { playSound: (name: string) => void } | null;

  // Methods
  showNotification: (message: string) => void;
}

/**
 * Initialize the skill bar UI
 */
export function initSkillBar(ctx: SkillUIContext): SkillBarUI {
  if (ctx.skillBarUI) return ctx.skillBarUI;

  const skillBarUI = new SkillBarUI();
  skillBarUI.setCallbacks({
    onSkillUse: (skillId: SkillId) => {
      if (ctx.client) {
        ctx.client.sendSkillUse(skillId);
      }
    }
  });

  console.info('[Skills] Skill bar initialized');
  return skillBarUI;
}

/**
 * Handle skill initialization from server
 */
export function handleSkillInit(
  ctx: SkillUIContext,
  skills: Array<{ id: string; name: string; description: string; cooldown: number; hotkey: number; icon: string; remainingCooldown: number }>
): void {
  if (!ctx.skillBarUI) {
    ctx.skillBarUI = initSkillBar(ctx);
  }
  ctx.skillBarUI?.initSkills(skills as any);
  ctx.skillBarUI?.setVisible(true);
}

/**
 * Handle skill visual effect
 */
export function handleSkillEffect(
  ctx: SkillUIContext,
  playerId: number,
  skillId: string,
  x: number,
  y: number,
  orientation: number
): void {
  const entity = ctx.entityManager?.getEntityById(playerId);
  if (!entity) return;

  const isLocalPlayer = playerId === ctx.playerId;
  console.log(`[Skills] Visual effect for ${skillId} at ${x},${y}`);

  // Handle Phase Shift - make player translucent and mark as phased
  if (skillId === 'phase_shift') {
    // Set entity as phased (for visual translucency)
    (entity as any).isPhased = true;
    (entity as any).phaseExpires = Date.now() + 2000; // 2 seconds

    // Clear phase after duration
    setTimeout(() => {
      (entity as any).isPhased = false;
      (entity as any).phaseExpires = 0;
      if (isLocalPlayer) {
        console.log('[Skills] Phase Shift ended');
      }
    }, 2000);

    if (isLocalPlayer) {
      // Disengage from any target - can't attack while phased
      if (ctx.player?.hasTarget()) {
        ctx.player.removeTarget();
      }
      ctx.showNotification('Phase Shift active!');
      ctx.audioManager?.playSound('glitch1');
    }
  }

  // Handle Power Strike - visual buff indicator
  if (skillId === 'power_strike') {
    if (isLocalPlayer) {
      ctx.showNotification('Power Strike ready! Next attack deals 2x damage');
      ctx.audioManager?.playSound('equip');
    }
    // Flash the entity
    ctx.renderer?.particles.spawnHitParticles(entity.x, entity.y - 8, 8, '#ff8800');
  }

  // Handle War Cry - visual stun effect
  if (skillId === 'war_cry') {
    if (isLocalPlayer) {
      ctx.showNotification('War Cry! Enemies stunned');
      ctx.audioManager?.playSound('hurt');
    }
    // Spawn particles in a ring around player - more particles for visibility
    ctx.renderer?.particles.spawnHitParticles(entity.x, entity.y - 8, 24, '#ffff00');
    ctx.renderer?.particles.spawnHitParticles(entity.x, entity.y - 8, 12, '#ffaa00');
    // Stronger camera shake for impact
    ctx.renderer?.camera.shake(8, 300);
  }

  // Handle Whirlwind - visual spin/damage effect
  if (skillId === 'whirlwind') {
    if (isLocalPlayer) {
      ctx.showNotification('Whirlwind!');
      ctx.audioManager?.playSound('hurt');
    }
    // Spawn particles around player
    ctx.renderer?.particles.spawnHitParticles(entity.x, entity.y - 8, 16, '#ff4444');
    ctx.renderer?.camera.shake(6, 200);
  }
}

/**
 * Handle skill cooldown start
 */
export function handleSkillCooldown(ctx: SkillUIContext, skillId: string, duration: number): void {
  ctx.skillBarUI?.startCooldown(skillId as SkillId, duration);
}

/**
 * Handle new skill unlock
 */
export function handleSkillUnlock(
  ctx: SkillUIContext,
  skill: { id: string; name: string; description: string; cooldown: number; hotkey: number; icon: string }
): void {
  ctx.skillBarUI?.unlockSkill(skill as any);
  // Play unlock sound
  ctx.audioManager?.playSound('loot');
}
