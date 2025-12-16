import {Item} from './item';
import {Types} from '../../shared/ts/gametypes';
import {Utils} from './utils';
import * as _ from 'lodash';

export class Chest extends Item {
  items: any[] = [];

  constructor(id: string | number, x: number, y: number) {
    super(id, Types.Entities.CHEST, x, y);
  }

  setItems(items: any[]): void {
    this.items = items;
  }

  getRandomItem(): any {
    var nbItems = _.size(this.items),
      item = null;

    if (nbItems > 0) {
      item = this.items[Utils.random(nbItems)];
    }
    return item;
  }
}
