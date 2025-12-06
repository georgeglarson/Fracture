/**
 * Grid Manager - Handles all grid-based spatial data
 * Single Responsibility: Entity positioning, collision detection, and spatial queries
 */

import { Entity } from '../entity/entity';
import { Character } from '../entity/character/character';
import { Player } from '../entity/character/player/player';
import { Mob } from '../entity/character/mob/mob';
import { Npc } from '../entity/character/npc/npc';
import { Chest } from '../entity/objects/chest';
import { Item } from '../entity/objects/item';
import { Types } from '../../../shared/ts/gametypes';
import _ from 'lodash';

export interface MapContext {
  width: number;
  height: number;
  grid: number[][];
  isOutOfBounds(x: number, y: number): boolean;
}

export class GridManager {
  private map: MapContext;

  // Spatial grids
  entityGrid: Record<string | number, Entity>[][] | null = null;
  pathingGrid: number[][] | null = null;
  renderingGrid: Record<string | number, Entity>[][] | null = null;
  itemGrid: Record<string | number, Item>[][] | null = null;

  constructor(map: MapContext) {
    this.map = map;
  }

  /**
   * Initialize the pathing grid from the map's collision data
   */
  initPathingGrid(): void {
    this.pathingGrid = [];
    for (let i = 0; i < this.map.height; i += 1) {
      this.pathingGrid[i] = [];
      for (let j = 0; j < this.map.width; j += 1) {
        this.pathingGrid[i][j] = this.map.grid[i][j];
      }
    }
    console.info('Initialized the pathing grid with static colliding cells.');
  }

  /**
   * Initialize an empty entity grid
   */
  initEntityGrid(): void {
    this.entityGrid = [];
    for (let i = 0; i < this.map.height; i += 1) {
      this.entityGrid[i] = [];
      for (let j = 0; j < this.map.width; j += 1) {
        this.entityGrid[i][j] = {};
      }
    }
    console.info('Initialized the entity grid.');
  }

  /**
   * Initialize an empty rendering grid
   */
  initRenderingGrid(): void {
    this.renderingGrid = [];
    for (let i = 0; i < this.map.height; i += 1) {
      this.renderingGrid[i] = [];
      for (let j = 0; j < this.map.width; j += 1) {
        this.renderingGrid[i][j] = {};
      }
    }
    console.info('Initialized the rendering grid.');
  }

  /**
   * Initialize an empty item grid
   */
  initItemGrid(): void {
    this.itemGrid = [];
    for (let i = 0; i < this.map.height; i += 1) {
      this.itemGrid[i] = [];
      for (let j = 0; j < this.map.width; j += 1) {
        this.itemGrid[i][j] = {};
      }
    }
    console.info('Initialized the item grid.');
  }

  /**
   * Initialize all grids at once
   */
  initAllGrids(): void {
    this.initEntityGrid();
    this.initItemGrid();
    this.initPathingGrid();
    this.initRenderingGrid();
  }

  // ========== Grid Add/Remove Operations ==========

  addToRenderingGrid(entity: Entity, x: number, y: number): void {
    if (!this.map.isOutOfBounds(x, y) && this.renderingGrid) {
      this.renderingGrid[y][x][entity.id] = entity;
    }
  }

  removeFromRenderingGrid(entity: Entity, x: number, y: number): void {
    if (entity && this.renderingGrid && this.renderingGrid[y][x] && entity.id in this.renderingGrid[y][x]) {
      delete this.renderingGrid[y][x][entity.id];
    }
  }

  removeFromEntityGrid(entity: Entity, x: number, y: number): void {
    if (this.entityGrid && this.entityGrid[y][x][entity.id]) {
      delete this.entityGrid[y][x][entity.id];
    }
  }

  removeFromItemGrid(item: Item, x: number, y: number): void {
    if (item && this.itemGrid && this.itemGrid[y][x][item.id]) {
      delete this.itemGrid[y][x][item.id];
    }
  }

  removeFromPathingGrid(x: number, y: number): void {
    if (this.pathingGrid) {
      this.pathingGrid[y][x] = 0;
    }
  }

  // ========== Entity Registration ==========

  /**
   * Registers the entity at two adjacent positions on the grid at the same time.
   * This situation is temporary and should only occur when the entity is moving.
   * This is useful for the hit testing algorithm used when hovering entities with the mouse cursor.
   */
  registerEntityDualPosition(entity: any): void {
    if (entity && this.entityGrid && this.pathingGrid) {
      this.entityGrid[entity.gridY][entity.gridX][entity.id] = entity;

      this.addToRenderingGrid(entity, entity.gridX, entity.gridY);

      if (entity.nextGridX >= 0 && entity.nextGridY >= 0) {
        this.entityGrid[entity.nextGridY][entity.nextGridX][entity.id] = entity;
        if (!(entity instanceof Player)) {
          this.pathingGrid[entity.nextGridY][entity.nextGridX] = 1;
        }
      }
    }
  }

  /**
   * Clears the position(s) of this entity in the entity grid.
   */
  unregisterEntityPosition(entity: any): void {
    if (entity) {
      this.removeFromEntityGrid(entity, entity.gridX, entity.gridY);
      this.removeFromPathingGrid(entity.gridX, entity.gridY);

      this.removeFromRenderingGrid(entity, entity.gridX, entity.gridY);

      if (entity.nextGridX >= 0 && entity.nextGridY >= 0) {
        this.removeFromEntityGrid(entity, entity.nextGridX, entity.nextGridY);
        this.removeFromPathingGrid(entity.nextGridX, entity.nextGridY);
      }
    }
  }

  /**
   * Register an entity at its current position
   */
  registerEntityPosition(entity: Entity): void {
    const x = entity.gridX;
    const y = entity.gridY;

    if (entity && this.entityGrid && this.itemGrid && this.pathingGrid) {
      if (entity instanceof Character || entity instanceof Chest) {
        this.entityGrid[y][x][entity.id] = entity;
        if (!(entity instanceof Player)) {
          this.pathingGrid[y][x] = 1;
        }
      }
      if (entity instanceof Item) {
        this.itemGrid[y][x][entity.id] = entity;
      }

      this.addToRenderingGrid(entity, x, y);
    }
  }

  // ========== Grid Query Operations ==========

  /**
   * Returns the entity located at the given position on the world grid.
   * @returns the entity located at (x, y) or null if there is none.
   */
  getEntityAt(x: number, y: number): Entity | null {
    if (this.map.isOutOfBounds(x, y) || !this.entityGrid) {
      return null;
    }

    const entities = this.entityGrid[y][x];
    let entity: Entity | null = null;
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

  getItemAt(x: number, y: number): Item | null {
    if (this.map.isOutOfBounds(x, y) || !this.itemGrid) {
      return null;
    }
    const items = this.itemGrid[y][x];
    let item: Item | null = null;

    if (_.size(items) > 0) {
      // If there are potions/burgers stacked with equipment items on the same tile, always get expendable items first.
      _.each(items, function (i: Item) {
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

  /**
   * Check if there's another mob on the same tile as the given mob
   */
  isMobOnSameTile(mob: Mob, x?: number, y?: number): boolean {
    const X = x || mob.gridX;
    const Y = y || mob.gridY;

    if (!this.entityGrid) return false;

    const list = this.entityGrid[Y][X];
    let result = false;

    _.each(list, function (entity: Entity) {
      if (entity instanceof Mob && entity.id !== mob.id) {
        result = true;
      }
    });
    return result;
  }

  /**
   * Iterate over entities in the rendering grid around a position
   */
  forEachEntityAround(x: number, y: number, radius: number, callback: (entity: Entity) => void): void {
    if (!this.renderingGrid) return;

    for (let i = x - radius, max_i = x + radius; i <= max_i; i += 1) {
      for (let j = y - radius, max_j = y + radius; j <= max_j; j += 1) {
        if (!this.map.isOutOfBounds(i, j)) {
          _.each(this.renderingGrid[j][i], function (entity: Entity) {
            callback(entity);
          });
        }
      }
    }
  }
}
