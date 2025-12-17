import {Item} from './item';
import {Types} from '../../../../shared/ts/gametypes';

// Map chest entity kinds to sprite names
const CHEST_SPRITES: Record<number, string> = {
  [Types.Entities.CHEST]: 'chest',
  [Types.Entities.CHEST_CRATE]: 'chestcrate',
  [Types.Entities.CHEST_LOG]: 'chestlog',
  [Types.Entities.CHEST_STONE]: 'cheststone',
  [Types.Entities.CHEST_URN]: 'chesturn',
  [Types.Entities.CHEST_OBSIDIAN]: 'chestobsidian',
  [Types.Entities.CHEST_GLITCH]: 'chestglitch',
};

export class Chest extends Item {

  open_callback;

  constructor(id, kind: number = Types.Entities.CHEST) {
    super(id, kind);
  }

  getSpriteName() {
    return CHEST_SPRITES[this.kind] || 'chest';
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
