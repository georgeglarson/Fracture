import * as _ from 'lodash';
import {Utils} from './utils';

export class Area {

  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  world: any;
  entities: any[] = [];
  hasCompletelyRespawned = true;
  nbEntities: number = 0;
  empty_callback: (() => void) | null = null;

  constructor(id: number, x: number, y: number, width: number, height: number, world: any) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.world = world;

  }

  _getRandomPositionInsideArea(): { x: number; y: number } {
    var pos: { x: number; y: number } = { x: 0, y: 0 },
      valid = false;

    while (!valid) {
      pos.x = this.x + Utils.random(this.width + 1);
      pos.y = this.y + Utils.random(this.height + 1);
      valid = this.world.isValidPosition(pos.x, pos.y);
    }
    return pos;
  }

  removeFromArea(entity: any): void {
    var i = _.indexOf(_.map(this.entities, 'id'), entity.id);
    this.entities.splice(i, 1);

    if (this.isEmpty() && this.hasCompletelyRespawned && this.empty_callback) {
      this.hasCompletelyRespawned = false;
      this.empty_callback();
    }
  }

  addToArea(entity: any): void {
    if (entity) {
      this.entities.push(entity);
      entity.area = this;
    }

    if (this.isFull()) {
      this.hasCompletelyRespawned = true;
    }
  }

  setNumberOfEntities(nb: number): void {
    this.nbEntities = nb;
  }

  isEmpty(): boolean {
    return !_.some(this.entities, function (entity: any) {
      return !entity.isDead
    });
  }

  isFull(): boolean {
    return !this.isEmpty() && (this.nbEntities === _.size(this.entities));
  }

  onEmpty(callback: () => void): void {
    this.empty_callback = callback;
  }
}
