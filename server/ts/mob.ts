import {Character} from './character';
import {Properties} from './properties';
import {Messages} from './message';
import {ChestArea} from './chestarea';
import {MobArea} from './mobarea';
import {Utils} from './utils';
import {getCombatTracker} from './combat/combat-tracker';
import type {Item} from './item';

// Message return type
interface SerializableMessage {
  serialize(): unknown[];
}

export class Mob extends Character {
  area: MobArea | ChestArea | null = null;
  spawningX: number;
  spawningY: number;
  armorLevel: number;
  weaponLevel: number;
  aggroRange: number;
  respawnTimeout: ReturnType<typeof setTimeout> | null = null;
  returnTimeout: ReturnType<typeof setTimeout> | null = null;
  isDead: boolean = false;
  respawn_callback: (() => void) | null = null;
  move_callback: ((mob: Mob) => void) | null = null;

  constructor(id: string | number, kind: number, x: number, y: number) {
    super(id, 'mob', kind, x, y);

    this.spawningX = x;
    this.spawningY = y;
    this.armorLevel = Properties.getArmorLevel(this.kind) ?? 1;
    this.weaponLevel = Properties.getWeaponLevel(this.kind) ?? 1;
    this.aggroRange = Properties.getAggroRange(this.kind);
    this.updateHitPoints();
  }

  destroy(): void {
    this.isDead = true;
    // Clear all aggro relationships in CombatTracker
    getCombatTracker().clearMobAggro(this.id as number);
    this.clearTarget();
    this.updateHitPoints();
    this.resetPosition();

    this.handleRespawn();
  }

  receiveDamage(points: number, playerId: number): void {
    this.hitPoints -= points;
  }

  hates(playerId: number): boolean {
    return getCombatTracker().hasAggro(this.id as number, playerId);
  }

  increaseHateFor(playerId: number, points: number): void {
    // Add aggro through CombatTracker (handles both new and existing hate)
    getCombatTracker().addAggro(this.id as number, playerId, points);

    if (this.returnTimeout) {
      // Prevent the mob from returning to its spawning position
      // since it has aggroed a new player
      clearTimeout(this.returnTimeout);
      this.returnTimeout = null;
    }
  }

  getHatedPlayerId(hateRank?: number): number | undefined {
    const tracker = getCombatTracker();
    const result = tracker.getHatedPlayerId(this.id as number, hateRank ?? 1);
    return result ?? undefined;
  }

  forgetPlayer(playerId: number, duration?: number): void {
    getCombatTracker().removeAggro(this.id as number, playerId);

    if (getCombatTracker().getMobAggroCount(this.id as number) === 0) {
      this.returnToSpawningPosition(duration);
    }
  }

  forgetEveryone(): void {
    getCombatTracker().clearMobAggro(this.id as number);
    this.returnToSpawningPosition(1);
  }

  drop(item: Item | null): SerializableMessage | undefined {
    if (item) {
      return new Messages.Drop(this, item);
    }
  }

  handleRespawn(): void {
    var delay = 30000,
      self = this;

    if (this.area && this.area instanceof MobArea) {
      // Respawn inside the area if part of a MobArea
      this.area.respawnMob(this, delay);
    }
    else {
      if (this.area && this.area instanceof ChestArea) {
        this.area.removeFromArea(this);
      }

      setTimeout(function () {
        if (self.respawn_callback) {
          self.respawn_callback();
        }
      }, delay);
    }
  }

  onRespawn(callback: () => void): void {
    this.respawn_callback = callback;
  }

  resetPosition(): void {
    this.setPosition(this.spawningX, this.spawningY);
  }

  returnToSpawningPosition(waitDuration?: number): void {
    var self = this,
      delay = waitDuration || 4000;

    this.clearTarget();

    this.returnTimeout = setTimeout(function () {
      self.resetPosition();
      self.move(self.x, self.y);
    }, delay);
  }

  onMove(callback: (mob: Mob) => void): void {
    this.move_callback = callback;
  }

  move(x: number, y: number): void {
    this.setPosition(x, y);
    if (this.move_callback) {
      this.move_callback(this);
    }
  }

  updateHitPoints(): void {
    this.resetHitPoints(Properties.getHitPoints(this.kind));
  }

  distanceToSpawningPoint(x: number, y: number): number {
    return Utils.distanceTo(x, y, this.spawningX, this.spawningY);
  }

  /**
   * Override getState to include HP for health bar display
   * Mob spawns: [id, kind, x, y, orientation, hitPoints, maxHitPoints, target?]
   */
  getState(): unknown[] {
    const basestate = this._getBaseState();
    const state: unknown[] = [];

    state.push(this.orientation);
    // Add HP info at fixed positions for client parsing
    state.push(this.hitPoints);
    state.push(this.maxHitPoints);
    // Target is optional, always last
    if (this.target) {
      state.push(this.target);
    }

    return basestate.concat(state);
  }
}
