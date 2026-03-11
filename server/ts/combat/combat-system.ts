/**
 * Combat System - Handles all combat-related logic
 * Single Responsibility: Combat mechanics, damage, death, aggro management
 */

import { Messages } from '../message.js';
import { Types } from '../../../shared/ts/gametypes.js';
import { Formulas } from '../formulas.js';
import { getVeniceService } from '../ai/venice.service.js';
import { getServerEventBus } from '../../../shared/ts/events/index.js';
import { PartyService } from '../party/index.js';
import { getKillStreakService } from './kill-streak.service.js';
import { getCombatTracker } from './combat-tracker.js';

export interface Entity {
  id: string | number;
  type: string;
  kind: number;
  name?: string;
  group?: string;
  hitPoints: number;
  armorLevel?: number;  // For XP calculation
  weaponLevel?: number;  // For damage calculation
  x?: number;  // Pixel position X
  y?: number;  // Pixel position Y
  target?: string | number;
  attackers?: Record<string | number, any>;
  stunUntil?: number;  // Timestamp when stun expires (War Cry)
  isDead?: boolean;  // Death flag to prevent processing dead entities
  increaseHateFor?(playerId: string | number, hatePoints: number): void;
  addHater?(mob: any): void;
  removeHater?(mob: any): void;
  addAttacker?(mob: any): void;
  removeAttacker?(mob: any): void;
  setTarget?(target: any): void;
  clearTarget?(): void;
  forgetPlayer?(playerId: string | number, delay: number): void;
  forEachAttacker?(callback: (mob: any) => void): void;
  getHatedPlayerId?(hateRank?: number): string | number;
  attack?(): any;
  despawn?(): any;
  drop?(item: any): any;
  health?(): any;
  handleKill?(mobType: string): void;
  grantXP?(amount: number): void;  // For progression system
  grantGold?(amount: number): void;  // For economy system
  checkKillAchievements?(mobKind: number): void;  // For achievement system
  isPhased?(): boolean;  // Phase shift immunity check
}

export interface Message {
  serialize(): any[];
}

export interface WorldContext {
  getEntityById(id: string | number): Entity | undefined;
  pushToPlayer(player: Entity | undefined, message: Message): void;
  pushToAdjacentGroups(groupId: string, message: Message, ignoredPlayer?: string | number): void;
  pushBroadcast(message: Message): void;  // Broadcast to all players
  getDroppedItem(mob: Entity): Entity | null;
  handleItemDespawn(item: Entity): void;
  removeEntity(entity: Entity): void;
  handleEntityGroupMembership(entity: Entity): boolean;
}

export class CombatSystem {
  private world: WorldContext;
  private attackCallback: ((character: Entity) => void) | null = null;

  constructor(world: WorldContext) {
    this.world = world;
  }

  /**
   * Set the callback for when an entity attacks
   */
  onEntityAttack(callback: (character: Entity) => void): void {
    this.attackCallback = callback;
  }

  /**
   * Clear the mob's aggro link to its current target
   */
  clearMobAggroLink(mob: Entity): void {
    if (mob.target) {
      const player = this.world.getEntityById(mob.target);
      if (player) {
        player.removeAttacker?.(mob);
      }
    }
  }

  /**
   * Clear all hate links between mob and players
   * Uses CombatTracker as the source of truth
   */
  clearMobHateLinks(mob: Entity): void {
    if (!mob) return;

    const mobId = typeof mob.id === 'string' ? parseInt(mob.id, 10) : mob.id;
    const tracker = getCombatTracker();

    // Iterate all players this mob has aggro on
    tracker.forEachPlayerHated(mobId, (playerId) => {
      const player = this.world.getEntityById(playerId);
      if (player) {
        player.removeHater?.(mob);
      }
    });

    // Clear the mob's aggro in CombatTracker
    tracker.clearMobAggro(mobId);
  }

  /**
   * Process mob hate/aggro towards a player
   */
  handleMobHate(mobId: string | number, playerId: string | number, hatePoints: number): void {
    const mob = this.world.getEntityById(mobId);
    const player = this.world.getEntityById(playerId);

    if (player && mob) {
      mob.increaseHateFor?.(playerId, hatePoints);
      player.addHater?.(mob);

      if (mob.hitPoints > 0) {
        this.chooseMobTarget(mob);
      }
    }
  }

  /**
   * Check if a mob is currently stunned (War Cry)
   */
  isMobStunned(mob: Entity): boolean {
    return mob.stunUntil !== undefined && Date.now() < mob.stunUntil;
  }

  /**
   * Choose mob's target based on hate ranking
   */
  chooseMobTarget(mob: Entity, hateRank?: number): void {
    // Stunned mobs can't acquire new targets
    if (this.isMobStunned(mob)) {
      return;
    }

    const playerId = mob.getHatedPlayerId?.(hateRank);
    if (!playerId) return;

    const player = this.world.getEntityById(playerId);

    // Skip phased players - they are invisible/invulnerable
    if (player && player.isPhased?.()) {
      // Try next most hated player instead
      this.chooseMobTarget(mob, (hateRank || 1) + 1);
      return;
    }

    // If the mob's current target differs from the chosen player, switch targets
    if (player && mob.target !== playerId) {
      this.clearMobAggroLink(mob);

      mob.setTarget?.(player);
      player.addAttacker?.(mob);
      this.broadcastAttacker(mob);
    }
  }

  /**
   * Broadcast that an entity is attacking
   */
  broadcastAttacker(character: Entity): void {
    if (character && character.group && character.attack) {
      this.world.pushToAdjacentGroups(character.group, character.attack(), character.id);
    }
    if (this.attackCallback) {
      this.attackCallback(character);
    }
  }

  /**
   * Handle entity taking damage
   */
  handleHurtEntity(entity: Entity, attacker?: Entity, damage?: number): void {
    // Skip processing for already-dead entities to prevent double death handling
    if (entity.isDead) {
      return;
    }

    if (entity.type === 'player') {
      // A player is only aware of his own hitpoints
      if (entity.health) {
        this.world.pushToPlayer(entity, entity.health());
      }
    }

    if (entity.type === 'mob' && attacker && damage !== undefined) {
      // Let the mob's attacker (player) know how much damage was inflicted
      this.world.pushToPlayer(attacker, new Messages.Damage(entity, damage));
    }

    // If the entity is about to die
    if (entity.hitPoints <= 0) {
      this.handleEntityDeath(entity, attacker);
    }
  }

  /**
   * Handle entity death
   */
  private handleEntityDeath(entity: Entity, attacker?: Entity): void {
    if (entity.type === 'mob') {
      this.handleMobDeath(entity, attacker);
    }

    if (entity.type === 'player') {
      this.handlePlayerDeath(entity, attacker);
    }

    this.world.removeEntity(entity);
  }

  /**
   * Handle mob death - drops, kill tracking, etc.
   */
  private handleMobDeath(mob: Entity, attacker?: Entity): void {
    // CRITICAL: Set isDead flag IMMEDIATELY to prevent further damage processing
    // This must happen before any messages are sent to prevent race conditions
    mob.isDead = true;

    const item = this.world.getDroppedItem(mob);

    if (attacker) {
      this.world.pushToPlayer(attacker, new Messages.Kill(mob));

      // Record kill streak and get multipliers
      const streakService = getKillStreakService();
      const streakResult = streakService.recordKill(
        attacker.id as number,
        attacker.name || 'Unknown'
      );

      // Broadcast streak announcements when reaching new tier
      if (streakResult.isNewTier && streakResult.tier) {
        this.world.pushBroadcast(new Messages.KillStreak(
          attacker.id as number,
          attacker.name || 'Unknown',
          streakResult.streak,
          streakResult.tier.title,
          `${attacker.name} ${streakResult.tier.announcement}`
        ));
      }

      // Grant XP and gold with party sharing and streak bonuses
      if (mob.armorLevel) {
        this.distributePartyRewards(attacker, mob, streakResult.xpMultiplier, streakResult.goldMultiplier);
      }

      // AI: Trigger kill handling for narrator and quest tracking
      const mobType = Types.getKindAsString(mob.kind);
      if (attacker.handleKill && mobType) {
        attacker.handleKill(mobType);
      }

      // Check kill achievements
      if (attacker.checkKillAchievements) {
        attacker.checkKillAchievements(mob.kind);
      }

      // Record world event for Town Crier
      const venice = getVeniceService();
      if (venice && mobType) {
        const isBoss = mob.kind === Types.Entities.BOSS;
        venice.recordWorldEvent(isBoss ? 'bossKill' : 'kill', attacker.name, {
          mobType,
          bossType: isBoss ? mobType : undefined
        });
      }

      // Emit mob:killed event for decoupled systems
      const eventBus = getServerEventBus();
      eventBus.emit('mob:killed', {
        mobId: mob.id as number,
        mobType: mob.kind,
        mobName: mobType || 'unknown',
        killerId: attacker.id as number,
        killerName: attacker.name || 'unknown',
        x: (mob as any).x ?? 0,
        y: (mob as any).y ?? 0
      });
    }

    // Despawn must be enqueued before the item drop
    if (mob.group && mob.despawn) {
      this.world.pushToAdjacentGroups(mob.group, mob.despawn());
    }

    if (item && mob.group) {
      if (mob.drop) {
        this.world.pushToAdjacentGroups(mob.group, mob.drop(item));
      }
      this.world.handleItemDespawn(item);
    }
  }

  /**
   * Handle player death
   */
  private handlePlayerDeath(player: Entity, attacker?: Entity): void {
    // Record world event for Town Crier
    const venice = getVeniceService();
    if (venice) {
      const killerType = attacker ? Types.getKindAsString(attacker.kind) : 'unknown';
      venice.recordWorldEvent('death', player.name, {
        killer: killerType
      });
    }

    // Emit player:died event
    const eventBus = getServerEventBus();
    eventBus.emit('player:died', {
      playerId: player.id as number,
      playerName: player.name || 'unknown',
      killerId: attacker?.id as number | undefined,
      killerType: attacker?.kind,
      x: (player as any).x ?? 0,
      y: (player as any).y ?? 0
    });

    this.handlePlayerVanish(player);

    if (player.group && player.despawn) {
      this.world.pushToAdjacentGroups(player.group, player.despawn());
    }
  }

  /**
   * Handle player vanishing (death or teleport)
   * Redirects all attacking mobs to their next target
   */
  handlePlayerVanish(player: Entity): void {
    const playerId = typeof player.id === 'string' ? parseInt(player.id, 10) : player.id;
    const tracker = getCombatTracker();

    // Get all mobs that have aggro on this player from CombatTracker (source of truth)
    const mobIds = tracker.getMobsAttacking(playerId);

    // Redirect each mob to a new target and clear their aggro
    for (const mobId of mobIds) {
      const mob = this.world.getEntityById(mobId);
      if (mob) {
        // Clear the mob's target
        mob.clearTarget?.();
        // Tell mob to forget this player (also removes from CombatTracker)
        mob.forgetPlayer?.(playerId, 1000);
        // Try to find a new target (second most hated)
        this.chooseMobTarget(mob, 2);
      }
    }

    // Clear player's local attackers cache
    if (player.attackers) {
      player.attackers = {};
    }

    // Clear all aggro for this player in CombatTracker (belt and suspenders)
    tracker.clearPlayerAggro(playerId);

    this.world.handleEntityGroupMembership(player);
  }

  /**
   * Distribute XP and gold rewards, with party sharing if applicable
   * Party members within 15 tiles get a share of XP with a bonus per member
   * @param xpMultiplier - Streak bonus multiplier for XP (default 1.0)
   * @param goldMultiplier - Streak bonus multiplier for gold (default 1.0)
   */
  private distributePartyRewards(attacker: Entity, mob: Entity, xpMultiplier: number = 1.0, goldMultiplier: number = 1.0): void {
    const partyService = PartyService.getInstance();
    const attackerId = attacker.id as number;
    const attackerX = attacker.x ?? 0;
    const attackerY = attacker.y ?? 0;

    // Apply streak multipliers to base rewards
    const baseXp = Math.floor(Formulas.xpFromMob(mob.armorLevel!) * xpMultiplier);
    const baseGold = Math.floor(Formulas.goldFromMob(mob.armorLevel!) * goldMultiplier);

    // Check if attacker is in a party
    if (partyService.isInParty(attackerId)) {
      // Get nearby party members (within 15 tiles)
      const nearbyMembers = partyService.getMembersInRange(attackerId, attackerX, attackerY, 15);

      if (nearbyMembers.length > 1) {
        // Calculate party bonus
        const xpBonus = partyService.calculatePartyXpBonus(nearbyMembers.length);
        const totalXp = Math.floor(baseXp * xpBonus);
        const xpPerMember = Math.floor(totalXp / nearbyMembers.length);

        console.log(`[Party XP] ${nearbyMembers.length} members share ${totalXp} XP (${baseXp} base × ${xpBonus.toFixed(2)} bonus), ${xpPerMember} each`);

        // Distribute XP to all nearby party members
        for (const memberId of nearbyMembers) {
          const member = this.world.getEntityById(memberId);
          if (member && member.grantXP) {
            member.grantXP(xpPerMember);
          }
        }

        // Gold only goes to the killer (no party gold sharing for now)
        if (attacker.grantGold) {
          attacker.grantGold(baseGold);
        }
        return;
      }
    }

    // No party or solo - give full rewards to attacker
    if (attacker.grantXP) {
      attacker.grantXP(baseXp);
    }
    if (attacker.grantGold) {
      attacker.grantGold(baseGold);
    }
  }
}
