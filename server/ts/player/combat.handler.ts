/**
 * CombatHandler - Handles ATTACK, HIT, HURT messages
 *
 * Single Responsibility: Player combat actions (target, deal damage, receive damage)
 * Extracted from message-router.ts to reduce its size.
 */

import { Formulas } from '../formulas';
import { MELEE_RANGE } from '../combat/combat-constants.js';
import { getAscensionDamageMultiplier } from './progression.handler.js';
import { createModuleLogger } from '../utils/logger.js';
import type { Player } from '../player';

const log = createModuleLogger('CombatHandler');

/**
 * Check if two entities are within melee range (Chebyshev distance)
 */
export function isInMeleeRange(e1: { x: number; y: number }, e2: { x: number; y: number }): boolean {
  const dx = Math.abs(e1.x - e2.x);
  const dy = Math.abs(e1.y - e2.y);
  return Math.max(dx, dy) <= MELEE_RANGE;
}

/**
 * ATTACK - Set target and broadcast attacker intent
 */
export function handleAttack(player: Player, msg: any[]): void {
  const mob = player.getWorld().getEntityById(msg[1]);
  if (mob) {
    player.setTarget(mob);
    player.getWorld().broadcastAttacker(player);
  }
}

/**
 * HIT - Deal damage to a mob
 */
export function handleHit(player: Player, msg: any[]): void {
  // Attacking clears spawn protection - you chose to fight
  player.spawnProtectionUntil = 0;

  const mob = player.getWorld().getEntityById(msg[1]);
  // Check mob exists, is not already dead, AND is in melee range
  if (mob && !mob.isDead && isInMeleeRange(player, mob)) {
    // Apply Power Strike multiplier (consumes the buff if active)
    const powerStrikeMultiplier = player.consumePowerStrike();
    // Ascension damage bonus (+5% per ascension, advertised via PROGRESSION_INIT)
    const ascensionMultiplier = getAscensionDamageMultiplier(player.ascensionCount ?? 0);
    const baseDmg = Formulas.dmg(player.weaponLevel, mob.armorLevel, player.level);
    const dmg = Math.floor(baseDmg * powerStrikeMultiplier * ascensionMultiplier);
    if (dmg > 0) {
      const mobHpBefore = mob.hitPoints;
      mob.receiveDamage(dmg, player.id);
      player.getAuditLog()?.record('combat', 'hit', { mobId: mob.id, mobHp: mobHpBefore }, { mobHp: mob.hitPoints, isDead: mob.isDead }, { dmg, weaponLevel: player.weaponLevel, mobArmorLevel: mob.armorLevel });
      player.getWorld().handleMobHate(mob.id, player.id, dmg);
      player.getWorld().handleHurtEntity(mob, player, dmg);
    }
  }
}

/**
 * HURT - Receive damage from a mob
 */
export function handleHurt(player: Player, msg: any[]): void {
  const world = player.getWorld();
  const mob = world.getEntityById(msg[1]);
  // Check mob exists, is alive (isDead flag + hitPoints > 0), and player is alive
  // Double-check (hitPoints > 0) prevents damage from mobs in death animation
  // Phase shift makes player immune to damage
  // Stunned mobs (War Cry) can't deal damage
  const isStunned = mob?.stunUntil && Date.now() < mob.stunUntil;
  if (mob && !mob.isDead && mob.hitPoints > 0 && !player.isDead && player.hitPoints > 0 && !player.isPhased() && !isStunned) {
    // Range check: mob must be adjacent (melee range) to deal damage
    if (!isInMeleeRange(player, mob)) {
      log.trace({ mobId: mob.id, meleeRange: MELEE_RANGE, playerName: player.name }, 'HURT rejected: mob out of range');
      return;
    }

    // Create attack link if not already attacking (for mobs that chased from far away)
    if (player.attackers && !(mob.id in player.attackers)) {
      player.addAttacker(mob);
      world.broadcastAttacker(mob);
    }

    const hpBefore = player.hitPoints;
    // Nemesis power: mobs that have killed players hit harder (set by nemesis.service)
    const nemesisMultiplier = typeof mob.nemesisPowerLevel === 'number' ? mob.nemesisPowerLevel : 1;
    const dmg = Math.floor(Formulas.dmg(mob.weaponLevel, player.armorLevel, mob.level ?? 1) * nemesisMultiplier);
    player.hitPoints = Math.max(0, player.hitPoints - dmg);
    player.getAuditLog()?.record('hp', 'hurt', { hp: hpBefore }, { hp: player.hitPoints }, { mobId: mob.id, dmg, mobWeaponLevel: mob.weaponLevel, armorLevel: player.armorLevel });
    // Pass the attacking mob through so player:died carries killerId (nemesis system)
    world.handleHurtEntity(player, mob, dmg);

    if (player.hitPoints <= 0) {
      player.isDead = true;
      player.getAuditLog()?.flush('death');
      if (player.firepotionTimeout) {
        clearTimeout(player.firepotionTimeout);
      }
    }
  }
}
