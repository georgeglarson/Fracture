import { Item } from './item';
import { Types } from '../../../../shared/ts/gametypes';
import { getChestSpriteName } from '../../../../shared/ts/entities/chest-config';

export class Chest extends Item {

  open_callback;

  constructor(id, kind: number = Types.Entities.CHEST) {
    super(id, kind);
  }

  getSpriteName() {
    return getChestSpriteName(this.kind);
  }

  isMoving() {
    return false;
  }

  open() {
    if (this.open_callback) {
      this.open_callback();
    }
  }

  onOpen(callback) {
    this.open_callback = callback;
  }
}
