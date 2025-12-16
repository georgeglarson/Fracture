import {Area} from './area';

export class ChestArea extends Area {

  items: any[];
  chestX: number;
  chestY: number;

  constructor(id: number, x: number, y: number, width: number, height: number, cx: number, cy: number, items: any[], world: any) {
    super(id, x, y, width, height, world);
    this.items = items;
    this.chestX = cx;
    this.chestY = cy;
  }

  contains(entity: any): boolean {
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
