import {Utils} from './utils';
import type {Entity} from './entity';

// Minimal World interface to avoid circular dependencies
interface WorldLike {
  isValidPosition(x: number, y: number): boolean;
}

// Entity-like object for area management
interface AreaEntity {
  id: number | string;
  isDead?: boolean;
  area?: Area;
}

export class Area {

  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  world: WorldLike;
  entities: AreaEntity[] = [];
  hasCompletelyRespawned = true;
  nbEntities: number = 0;
  emptyCallback: (() => void) | null = null;

  constructor(id: number, x: number, y: number, width: number, height: number, world: WorldLike) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.world = world;

  }

  _getRandomPositionInsideArea(): { x: number; y: number } {
    const MAX_SPAWN_ATTEMPTS = 100;
    let pos: { x: number; y: number } = { x: 0, y: 0 };
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < MAX_SPAWN_ATTEMPTS) {
      pos.x = this.x + Utils.random(this.width);
      pos.y = this.y + Utils.random(this.height);
      valid = this.world.isValidPosition(pos.x, pos.y);
      attempts++;
    }

    if (!valid) {
      pos.x = this.x + Math.floor(this.width / 2);
      pos.y = this.y + Math.floor(this.height / 2);
    }

    return pos;
  }

  removeFromArea(entity: AreaEntity): void {
    const i = this.entities.findIndex(e => e.id === entity.id);
    if (i >= 0) {
      this.entities.splice(i, 1);
    }

    if (this.isEmpty() && this.hasCompletelyRespawned && this.emptyCallback) {
      this.hasCompletelyRespawned = false;
      this.emptyCallback();
    }
  }

  addToArea(entity: AreaEntity): void {
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
    return !this.entities.some((entity: AreaEntity) => !entity.isDead);
  }

  isFull(): boolean {
    return !this.isEmpty() && (this.nbEntities === this.entities.length);
  }

  onEmpty(callback: () => void): void {
    this.emptyCallback = callback;
  }
}
