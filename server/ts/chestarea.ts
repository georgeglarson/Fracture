import {Area} from './area';

// Minimal interface for position checking
interface HasPosition {
  x: number;
  y: number;
}

// Minimal world interface for chest areas
interface ChestAreaWorld {
  isValidPosition(x: number, y: number): boolean;
}

export class ChestArea extends Area {

  items: number[]; // Item kinds
  chestX: number;
  chestY: number;

  constructor(id: number, x: number, y: number, width: number, height: number, cx: number, cy: number, items: number[], world: ChestAreaWorld) {
    super(id, x, y, width, height, world);
    this.items = items;
    this.chestX = cx;
    this.chestY = cy;
  }

  contains(entity: HasPosition | null | undefined): boolean {
    if (entity) {
      return entity.x >= this.x
        && entity.y >= this.y
        && entity.x < this.x + this.width
        && entity.y < this.y + this.height;
    } else {
      return false;
    }
  }
}
