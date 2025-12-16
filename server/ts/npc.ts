import {Entity} from './entity';

export class Npc extends Entity {
  constructor(id: string | number, kind: number, x: number, y: number) {
    super(id, 'npc', kind, x, y);
  }

  destroy() {

  }
}
