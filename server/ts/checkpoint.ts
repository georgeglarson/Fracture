import {Utils} from './utils';

export class Checkpoint {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;

  constructor(id: number, x: number, y: number, width: number, height: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  getRandomPosition(): { x: number; y: number } {
    return {
      x: this.x + Utils.randomInt(0, this.width - 1),
      y: this.y + Utils.randomInt(0, this.height - 1)
    };
  }
}
