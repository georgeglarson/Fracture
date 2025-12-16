import {Entity} from './entity';
import {Utils} from './utils';
import {Messages} from './message';

export abstract class Character extends Entity {

  orientation: number;
  attackers: Record<number | string, any> = {};
  target: number | null = null;
  maxHitPoints: number = 0;
  hitPoints: number = 0;

  constructor(id: string | number, type: string, kind: number, x: number, y: number) {
    super(id, type, kind, x, y);

    this.orientation = Utils.randomOrientation();
  }

  getState(): any[] {
    var basestate = this._getBaseState(),
      state: any[] = [];

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

  attack(): any {
    return new Messages.Attack(this.id, this.target);
  }

  health(): any {
    return new Messages.Health(this.hitPoints, false);
  }

  regen(): any {
    return new Messages.Health(this.hitPoints, true);
  }

  addAttacker(entity: any): void {
    if (entity) {
      this.attackers[entity.id] = entity;
    }
  }

  removeAttacker(entity: any): void {
    if (entity && entity.id in this.attackers) {
      delete this.attackers[entity.id];
      console.debug(this.id + " REMOVED ATTACKER " + entity.id);
    }
  }

  forEachAttacker(callback: (attacker: any) => void): void {
    for (var id in this.attackers) {
      callback(this.attackers[id]);
    }
  }
}
