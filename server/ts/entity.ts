import {Messages} from './message';
import {Utils} from './utils';

// Message return type for serializable messages
interface SerializableMessage {
  serialize(): unknown[];
}

export abstract class Entity {
  id: number;
  type: string;
  kind: number;
  x: number;
  y: number;
  group?: string; // Spatial group ID, assigned by SpatialManager

  constructor(id: string | number, type: string, kind: number, x: number, y: number) {
    this.id = typeof id === 'string' ? parseInt(id) : id;
    this.type = type;
    this.kind = kind;
    this.x = x;
    this.y = y;
  }

  abstract destroy(): void;

  _getBaseState(): unknown[] {
    return [
      this.id,
      this.kind,
      this.x,
      this.y
    ];
  }

  getState(): unknown[] {
    return this._getBaseState();
  }

  spawn(): SerializableMessage {
    return new Messages.Spawn(this);
  }

  despawn(): SerializableMessage {
    return new Messages.Despawn(this.id);
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  getPositionNextTo(entity: Entity): { x: number; y: number } | null {
    var pos: { x: number; y: number } | null = null;
    if (entity) {
      pos = { x: entity.x, y: entity.y };
      // This is a quick & dirty way to give mobs a random position
      // close to another entity.
      var r = Utils.random(4);

      if (r === 0)
        pos.y -= 1;
      if (r === 1)
        pos.y += 1;
      if (r === 2)
        pos.x -= 1;
      if (r === 3)
        pos.x += 1;
    }
    return pos;
  }
}
