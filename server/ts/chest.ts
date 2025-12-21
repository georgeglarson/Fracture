import {Item} from './item';
import {Types} from '../../shared/ts/gametypes';
import {Utils} from './utils';

export class Chest extends Item {
  items: number[] = []; // Item kinds

  constructor(id: string | number, x: number, y: number, kind: number = Types.Entities.CHEST) {
    super(id, kind, x, y);
  }

  setItems(items: number[]): void {
    this.items = items;
  }

  getRandomItem(): number | null {
    var nbItems = this.items.length,
      item: number | null = null;

    if (nbItems > 0) {
      item = this.items[Utils.random(nbItems)];
    }
    return item;
  }
}
