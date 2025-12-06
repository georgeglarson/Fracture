import {Entity} from '../entity';
import {Types} from '../../../../shared/ts/gametypes';
import {
  ItemProperties,
  Rarity,
  RarityColors,
  RarityNames,
  deserializeProperties,
  formatItemStats
} from '../../../../shared/ts/items/index';

export class Item extends Entity {

  itemKind;
  type;
  wasDropped = false;
  lootMessage;
  properties: ItemProperties | null = null;

  constructor(id, kind, type?) {
    super(id, kind);

    this.itemKind = Types.getKindAsString(kind);
    this.type = type;
  }

  /**
   * Set item properties from server data
   */
  setProperties(propsData: Record<string, unknown> | null): void {
    if (propsData) {
      this.properties = deserializeProperties(propsData);
    }
  }

  /**
   * Get the rarity of this item
   */
  getRarity(): Rarity {
    return this.properties?.rarity || Rarity.COMMON;
  }

  /**
   * Get the rarity color for display
   */
  getRarityColor(): string {
    return RarityColors[this.getRarity()];
  }

  hasShadow() {
    return true;
  }

  onLoot(player) {
    if (this.type === 'weapon') {
      player.switchWeapon(this.itemKind);
    }
    else if (this.type === 'armor') {
      player.armorloot_callback(this.itemKind);
    }
  }

  getSpriteName() {
    return 'item-' + this.itemKind;
  }

  getLootMessage() {
    // If we have properties, generate a dynamic loot message
    if (this.properties) {
      const rarity = this.getRarity();
      const rarityName = rarity !== Rarity.COMMON ? RarityNames[rarity] + ' ' : '';
      const stats = formatItemStats(this.properties);
      const baseMessage = this.lootMessage || `You pick up a ${this.itemKind}`;

      // Build message with rarity and stats
      if (stats) {
        return `${baseMessage.replace(this.itemKind, rarityName + this.itemKind)} (${stats})`;
      }
      return baseMessage.replace(this.itemKind, rarityName + this.itemKind);
    }
    return this.lootMessage;
  }
}
