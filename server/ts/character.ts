import {Entity} from './entity';
import {Utils, normalizeId} from './utils';
import {Messages} from './message';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('Character');

// Message return type for serializable messages
interface SerializableMessage {
  serialize(): unknown[];
}

export abstract class Character extends Entity {

  orientation: number;
  attackers: Record<number | string, Character> = {};
  target: number | null = null;
  maxHitPoints: number = 0;
  hitPoints: number = 0;

  /** Flag to distinguish AIPlayer from human Player (both have type === 'player') */
  isAI: boolean = false;

  constructor(id: string | number, type: string, kind: number, x: number, y: number) {
    super(id, type, kind, x, y);

    this.orientation = Utils.randomOrientation();
  }

  getState(): unknown[] {
    const basestate = this._getBaseState();
    const state: unknown[] = [];

    state.push(this.orientation);
    if (this.target) {
      state.push(this.target);
    }

    return basestate.concat(state);
  }

  resetHitPoints(maxHitPoints: number): void {
    this.maxHitPoints = maxHitPoints;
    this.hitPoints = this.maxHitPoints;
  }

  regenHealthBy(value: number): void {
    var hp = this.hitPoints,
      max = this.maxHitPoints;

    if (hp < max) {
      if (hp + value <= max) {
        this.hitPoints += value;
      }
      else {
        this.hitPoints = max;
      }
    }
  }

  hasFullHealth(): boolean {
    return this.hitPoints === this.maxHitPoints;
  }

  setTarget(entity: Entity): void {
    this.target = entity.id;
  }

  clearTarget(): void {
    this.target = null;
  }

  hasTarget(): boolean {
    return this.target !== null;
  }

  attack(): SerializableMessage {
    return new Messages.Attack(this.id, this.target);
  }

  health(): SerializableMessage {
    return new Messages.Health(this.hitPoints, false);
  }

  regen(): SerializableMessage {
    return new Messages.Health(this.hitPoints, true);
  }

  addAttacker(entity: Character): void {
    if (entity) {
      // Normalize ID for consistent key lookup
      const key = normalizeId(entity.id);
      this.attackers[key] = entity;
    }
  }

  removeAttacker(entity: Character): void {
    if (entity) {
      // Normalize ID for consistent key lookup
      const key = normalizeId(entity.id);
      if (key in this.attackers) {
        delete this.attackers[key];
        log.debug({ entityId: this.id, attackerId: key }, 'Removed attacker');
      }
    }
  }

  forEachAttacker(callback: (attacker: Character) => void): void {
    for (const id in this.attackers) {
      callback(this.attackers[id]);
    }
  }
}
