/**
 * CombatHandler - Client-side combat state transitions
 *
 * Single Responsibility: retarget-on-death, auto-retaliate, combat music entry/exit.
 * Extracted from message-handlers.ts and game.ts to consolidate combat logic.
 */

/** Melee auto-retaliation range in tiles (Chebyshev distance) */
const MELEE_RANGE_TILES = 3;

/**
 * Minimal context the combat handler needs from the game.
 */
export interface CombatGameContext {
  player: {
    target: { id: number; isDying?: boolean; isDead?: boolean } | null;
    isDying: boolean;
    isDead: boolean;
    disengage(): void;
    stop(): void;
    idle(): void;
    isAttacking(): boolean;
    forEachAttacker(cb: (attacker: any) => void): void;
    getDistanceToEntity(entity: any): number;
  } | null;
  playerId: number;
  audioManager: {
    enterCombat(): void;
    exitCombat(): void;
    refreshCombat(): void;
  };
  makePlayerAttack(mob: any): void;
}

/**
 * Pure function: scan player's attackers, return nearest living non-dying attacker.
 * No distance cap — server controls aggro range.
 */
export function findRetargetCandidate(
  player: CombatGameContext['player'],
  excludeId?: number
): any | null {
  if (!player) return null;

  let nearest: any = null;
  let nearestDist = Infinity;

  player.forEachAttacker((attacker: any) => {
    if (!attacker || attacker.isDead || attacker.isDying) return;
    if (excludeId !== undefined && attacker.id === excludeId) return;

    const dist = player.getDistanceToEntity(attacker);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = attacker;
    }
  });

  return nearest;
}

/**
 * Handle a target dying: disengage, stop, idle, then retarget or exit combat.
 * Idempotent — safe to call from both DAMAGE and DESPAWN handlers.
 *
 * Fixes:
 *  - Bug A: DESPAWN path now retargets (was missing)
 *  - Bug C: player.stop() interrupts pathing to dead target
 */
export function handleTargetDeath(ctx: CombatGameContext, deadMobId: number): void {
  const player = ctx.player;
  if (!player) return;

  // If we're not targeting the dead mob, nothing to do
  if (!player.target || player.target.id !== deadMobId) return;

  // 1. Clear combat state
  player.disengage();
  // 2. Stop movement — prevents walking to corpse (Bug C fix)
  player.stop();
  // 3. Reset animation
  player.idle();

  // 4. Attempt retarget
  const nextTarget = findRetargetCandidate(player, deadMobId);
  if (nextTarget) {
    console.debug('[CombatHandler] Retargeting to', nextTarget.id);
    ctx.makePlayerAttack(nextTarget);
  } else {
    // No more attackers — fade combat music
    ctx.audioManager.exitCombat();
  }
}

/**
 * Auto-retaliate: attack nearest attacker within melee range if player is idle.
 * Uses own distance cap (MELEE_RANGE_TILES) — distinct from findRetargetCandidate.
 */
export function autoRetaliate(ctx: CombatGameContext): void {
  const player = ctx.player;
  if (!player || player.isDying || player.isDead) return;
  if (player.isAttacking()) return;

  let nearestAttacker: any = null;
  let nearestDist = Infinity;

  player.forEachAttacker((attacker: any) => {
    if (!attacker || attacker.isDead || attacker.isDying) return;
    const dist = player.getDistanceToEntity(attacker);
    if (dist <= MELEE_RANGE_TILES && dist < nearestDist) {
      nearestDist = dist;
      nearestAttacker = attacker;
    }
  });

  if (nearestAttacker) {
    console.debug('[Auto-retaliate] Fighting back against', nearestAttacker.id, 'at distance', nearestDist);
    ctx.makePlayerAttack(nearestAttacker);
  }
}

/**
 * Enter combat music if the player is involved in an attack.
 */
export function handleCombatMusicOnAttack(
  ctx: CombatGameContext,
  attackerId: number,
  targetId: number
): void {
  if (attackerId === ctx.playerId || targetId === ctx.playerId) {
    ctx.audioManager.enterCombat();
  }
}
