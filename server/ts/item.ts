import {Entity} from './entity';
import { ItemProperties, GeneratedItem, serializeProperties } from '../../shared/ts/items/index.js';

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
  blinkTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   *
   */
  despawnTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   *
   */
  respawnCallback: (() => void) | null = null;

  /**
   *
   * @param id
   * @param kind
   * @param x
   * @param y
   * @param generatedItem Optional generated item with properties
   */
  constructor(id: string | number, kind: number, x: number, y: number, generatedItem?: GeneratedItem) {
    super(id, 'item', kind, x, y);
    if (generatedItem) {
      this.properties = generatedItem.properties;
      this.displayName = generatedItem.displayName;
    }
  }

  /**
   * Override getState to include item properties in Spawn messages
   */
  getState() {
    const baseState = this._getBaseState();
    // Add serialized properties as 5th element (after id, kind, x, y)
    const serializedProps = this.properties ? serializeProperties(this.properties) : null;
    return [...baseState, serializedProps];
  }

  /**
   *
   * @param params
   */
  handleDespawn(params: { blinkCallback: () => void; despawnCallback: () => void; blinkingDuration: number; beforeBlinkDelay: number }) {
    this.blinkTimeout = setTimeout(() => {
      params.blinkCallback();
      this.despawnTimeout = setTimeout(params.despawnCallback, params.blinkingDuration);
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
  scheduleRespawn(delay: number) {
    setTimeout(() => {
      if (this.respawnCallback) {
        this.respawnCallback();
      }
    }, delay);
  }

  /**
   *
   * @param callback
   */
  onRespawn(callback: () => void) {
    this.respawnCallback = callback;
  }
}
