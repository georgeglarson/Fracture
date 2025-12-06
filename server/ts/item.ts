import {Entity} from './entity';
import { ItemProperties, GeneratedItem } from '../../shared/ts/items/index.js';

export class Item extends Entity {

  /**
   * Item properties (rarity, stats, bonuses)
   */
  properties: ItemProperties | null = null;

  /**
   * Display name (includes rarity prefix)
   */
  displayName: string | null = null;

  /**
   *
   * @type {boolean}
   */
  isStatic = false;

  /**
   *
   * @type {boolean}
   */
  isFromChest = false;

  /**
   *
   */
  blinkTimeout;

  /**
   *
   */
  despawnTimeout;

  /**
   *
   */
  respawn_callback;

  /**
   *
   * @param id
   * @param kind
   * @param x
   * @param y
   * @param generatedItem Optional generated item with properties
   */
  constructor(id, kind, x, y, generatedItem?: GeneratedItem) {
    super(id, 'item', kind, x, y);
    if (generatedItem) {
      this.properties = generatedItem.properties;
      this.displayName = generatedItem.displayName;
    }
  }

  /**
   *
   * @param params
   */
  handleDespawn(params) {
    const self = this;

    this.blinkTimeout = setTimeout(function () {
      params.blinkCallback();
      self.despawnTimeout = setTimeout(params.despawnCallback, params.blinkingDuration);
    }, params.beforeBlinkDelay);
  }

  /**
   *
   */
  destroy() {
    if (this.blinkTimeout) {
      clearTimeout(this.blinkTimeout);
    }
    if (this.despawnTimeout) {
      clearTimeout(this.despawnTimeout);
    }
    if (this.isStatic) {
      this.scheduleRespawn(30000);
    }
  }

  /**
   *
   * @param delay
   */
  scheduleRespawn(delay) {
    const self = this;
    setTimeout(function () {
      if (self.respawn_callback) {
        self.respawn_callback();
      }
    }, delay);
  }

  /**
   *
   * @param callback
   */
  onRespawn(callback) {
    this.respawn_callback = callback;
  }
}
