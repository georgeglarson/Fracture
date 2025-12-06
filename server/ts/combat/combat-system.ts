/**
 * Combat System - Handles all combat-related logic
 * Single Responsibility: Combat mechanics, damage, death, aggro management
 */

import * as _ from 'lodash';
import { Messages } from '../message.js';
import { Types } from '../../../shared/ts/gametypes.js';
import { Formulas } from '../formulas.js';
import { getVeniceService } from '../ai/venice.service.js';
import { getServerEventBus } from '../../../shared/ts/events/index.js';

export interface Entity {
  id: string | number;
  type: string;
  kind: number;
  name?: string;
  group?: string;
  hitPoints: number;
  armorLevel?: number;  // For XP calculation
  target?: string | number;
  hatelist?: Array<{ id: string | number }>;
  attackers?: Record<string | number, any>;
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
}

export interface Message {
  serialize(): any[];
}

export interface WorldContext {
  getEntityById(id: string | number): Entity | undefined;
  pushToPlayer(player: Entity | undefined, message: Message): void;
  pushToAdjacentGroups(groupId: string, message: Message, ignoredPlayer?: string | number): void;
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
   */
  clearMobHateLinks(mob: Entity): void {
    if (mob && mob.hatelist) {
      _.each(mob.hatelist, (obj) => {
        const player = this.world.getEntityById(obj.id);
        if (player) {
          player.removeHater?.(mob);
        }
      });
    }
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
   * Choose mob's target based on hate ranking
   */
  chooseMobTarget(mob: Entity, hateRank?: number): void {
    const playerId = mob.getHatedPlayerId?.(hateRank);
    if (!playerId) return;

    const player = this.world.getEntityById(playerId);

    // If the mob is not already attacking the player, create an attack link
    if (player && player.attackers && !(mob.id in player.attackers)) {
      this.clearMobAggroLink(mob);

      player.addAttacker?.(mob);
      mob.setTarget?.(player);

      this.broadcastAttacker(mob);
      console.debug(mob.id + ' is now attacking ' + player.id);
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
    if (entity.type === 'player') {
      // A player is only aware of his own hitpoints
      if (entity.health) {
        this.world.pushToPlayer(entity, entity.health());
      }
    }

    if (entity.type === 'mob' && attacker) {
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
    const item = this.world.getDroppedItem(mob);

    if (attacker) {
      this.world.pushToPlayer(attacker, new Messages.Kill(mob));

      // Grant XP to the attacker
      if (attacker.grantXP && mob.armorLevel) {
        const xpGained = Formulas.xpFromMob(mob.armorLevel);
        attacker.grantXP(xpGained);
      }

      // AI: Trigger kill handling for narrator and quest tracking
      const mobType = Types.getKindAsString(mob.kind);
      if (attacker.handleKill && mobType) {
        attacker.handleKill(mobType);
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
    const previousAttackers: Entity[] = [];

    // Collect all mobs attacking this player and redirect them
    player.forEachAttacker?.((mob) => {
      previousAttackers.push(mob);
      this.chooseMobTarget(mob, 2); // Target second most hated player
    });

    // Clean up the attack links
    _.each(previousAttackers, (mob) => {
      player.removeAttacker?.(mob);
      mob.clearTarget?.();
      mob.forgetPlayer?.(player.id, 1000);
    });

    this.world.handleEntityGroupMembership(player);
  }
}
