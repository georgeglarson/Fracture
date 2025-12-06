/**
 * MapQueryService - Handles entity queries at grid positions
 * Single Responsibility: Query entities, items, mobs, NPCs, chests at coordinates
 */

import { Mob } from '../entity/character/mob/mob';
import { Npc } from '../entity/character/npc/npc';
import { Chest } from '../entity/objects/chest';
import { Types } from '../../../shared/ts/gametypes';
import _ from 'lodash';

export interface MapBoundsContext {
  isOutOfBounds(x: number, y: number): boolean;
}

export interface GridContext {
  entityGrid: any[][] | null;
  itemGrid: any[][] | null;
}

export class MapQueryService {
  private map: MapBoundsContext | null = null;
  private gridProvider: (() => GridContext) | null = null;

  constructor() {}

  /**
   * Set map context for bounds checking
   */
  setMap(map: MapBoundsContext): void {
    this.map = map;
  }

  /**
   * Set grid provider for entity/item grid access
   */
  setGridProvider(provider: () => GridContext): void {
    this.gridProvider = provider;
  }

  private get entityGrid() {
    return this.gridProvider?.()?.entityGrid ?? null;
  }

  private get itemGrid() {
    return this.gridProvider?.()?.itemGrid ?? null;
  }

  // ========== Entity Getters ==========

  /**
   * Returns the entity located at a given position on the world grid.
   * @returns The entity located at (x, y) or null if there is none.
   */
  getEntityAt(x: number, y: number): any {
    if (!this.map || this.map.isOutOfBounds(x, y) || !this.entityGrid) {
      return null;
    }

    const entities = this.entityGrid[y][x];
    let entity = null;

    if (_.size(entities) > 0) {
      entity = entities[_.keys(entities)[0]];
    } else {
      entity = this.getItemAt(x, y);
    }
    return entity;
  }

  getMobAt(x: number, y: number): Mob | null {
    const entity = this.getEntityAt(x, y);
    if (entity && (entity instanceof Mob)) {
      return entity;
    }
    return null;
  }

  getNpcAt(x: number, y: number): Npc | null {
    const entity = this.getEntityAt(x, y);
    if (entity && (entity instanceof Npc)) {
      return entity;
    }
    return null;
  }

  getChestAt(x: number, y: number): Chest | null {
    const entity = this.getEntityAt(x, y);
    if (entity && (entity instanceof Chest)) {
      return entity;
    }
    return null;
  }

  getItemAt(x: number, y: number): any {
    if (!this.map || this.map.isOutOfBounds(x, y) || !this.itemGrid) {
      return null;
    }

    const items = this.itemGrid[y][x];
    let item = null;

    if (_.size(items) > 0) {
      // If there are potions/burgers stacked with equipment items on the same tile,
      // always get expendable items first.
      _.each(items, function(i) {
        if (Types.isExpendableItem(i.kind)) {
          item = i;
        }
      });

      // Else, get the first item of the stack
      if (!item) {
        item = items[_.keys(items)[0]];
      }
    }
    return item;
  }

  // ========== Entity Existence Checks ==========

  /**
   * Returns true if an entity is located at the given position on the world grid.
   */
  isEntityAt(x: number, y: number): boolean {
    return !_.isNull(this.getEntityAt(x, y));
  }

  isMobAt(x: number, y: number): boolean {
    return !_.isNull(this.getMobAt(x, y));
  }

  isItemAt(x: number, y: number): boolean {
    return !_.isNull(this.getItemAt(x, y));
  }

  isNpcAt(x: number, y: number): boolean {
    return !_.isNull(this.getNpcAt(x, y));
  }

  isChestAt(x: number, y: number): boolean {
    return !_.isNull(this.getChestAt(x, y));
  }
}
