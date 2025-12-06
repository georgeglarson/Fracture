/**
 * Client Entity Manager - Handles entity storage and lifecycle
 * Single Responsibility: Entity CRUD operations, iteration, and lookup
 */

import { Entity } from '../entity/entity';
import { Mob } from '../entity/character/mob/mob';
import _ from 'lodash';

export interface GridManagerContext {
  registerEntityPosition(entity: any): void;
  unregisterEntityPosition(entity: any): void;
  removeFromItemGrid(item: any, x: number, y: number): void;
  removeFromRenderingGrid(entity: any, x: number, y: number): void;
}

export interface RendererContext {
  mobile: boolean;
  tablet: boolean;
  getEntityBoundingRect(entity: any): any;
}

export interface CameraContext {
  isVisible(entity: any): boolean;
}

export class EntityManager {
  // Entity storage - using any for flexibility with different entity types
  entities: Record<string | number, any> = {};
  deathpositions: Record<string | number, { x: number; y: number }> = {};
  obsoleteEntities: any[] | null = null;

  // Dependencies
  private gridManager: GridManagerContext | null = null;
  private renderer: RendererContext | null = null;
  private camera: CameraContext | null = null;
  private currentTimeProvider: () => number = () => Date.now();
  private dirtyRectCallback: ((rect: any, entity: any, x: number, y: number) => void) | null = null;

  constructor() {}

  /**
   * Set grid manager for grid operations
   */
  setGridManager(gridManager: GridManagerContext): void {
    this.gridManager = gridManager;
  }

  /**
   * Set renderer for mobile/tablet checks and bounding rect
   */
  setRenderer(renderer: RendererContext): void {
    this.renderer = renderer;
  }

  /**
   * Set camera for visibility checks
   */
  setCamera(camera: CameraContext): void {
    this.camera = camera;
  }

  /**
   * Set current time provider for animations
   */
  setCurrentTimeProvider(provider: () => number): void {
    this.currentTimeProvider = provider;
  }

  /**
   * Set callback for dirty rect checking
   */
  setDirtyRectCallback(callback: (rect: any, entity: any, x: number, y: number) => void): void {
    this.dirtyRectCallback = callback;
  }

  // ========== Entity CRUD ==========

  /**
   * Add an entity to the entities map and register its position
   */
  addEntity(entity: any): boolean {
    if (this.entities[entity.id] !== undefined) {
      console.error('This entity already exists : ' + entity.id + ' (' + entity.kind + ')');
      return false;
    }

    this.entities[entity.id] = entity;
    this.gridManager?.registerEntityPosition(entity);

    // Handle fade-in animation (skip for dropped items on mobile/tablet)
    const isDroppedItem = entity.wasDropped;
    const isMobileOrTablet = this.renderer?.mobile || this.renderer?.tablet;

    if (!isDroppedItem && !isMobileOrTablet) {
      entity.fadeIn?.(this.currentTimeProvider());
    }

    // Setup dirty rect tracking for mobile/tablet
    if (isMobileOrTablet && this.camera && this.renderer) {
      const self = this;
      entity.onDirty?.(function(e: any) {
        if (self.camera?.isVisible(e)) {
          e.dirtyRect = self.renderer?.getEntityBoundingRect(e);
          self.dirtyRectCallback?.(e.dirtyRect, e, e.gridX, e.gridY);
        }
      });
    }

    return true;
  }

  /**
   * Remove an entity from the entities map and unregister its position
   */
  removeEntity(entity: any): boolean {
    if (!(entity.id in this.entities)) {
      console.error('Cannot remove entity. Unknown ID : ' + entity.id);
      return false;
    }

    this.gridManager?.unregisterEntityPosition(entity);
    delete this.entities[entity.id];
    return true;
  }

  /**
   * Remove an item (also clears from item/rendering grids)
   */
  removeItem(item: any): boolean {
    if (!item) {
      console.error('Cannot remove item. Unknown ID : ' + item?.id);
      return false;
    }

    this.gridManager?.removeFromItemGrid(item, item.gridX, item.gridY);
    this.gridManager?.removeFromRenderingGrid(item, item.gridX, item.gridY);
    delete this.entities[item.id];
    return true;
  }

  // ========== Entity Lookup ==========

  /**
   * Check if an entity with given ID exists
   */
  entityIdExists(id: string | number): boolean {
    return id in this.entities;
  }

  /**
   * Get entity by ID
   */
  getEntityById(id: string | number): any {
    if (id in this.entities) {
      return this.entities[id];
    } else {
      console.error('Unknown entity id : ' + id, true);
      return undefined;
    }
  }

  // ========== Death Position Tracking ==========

  /**
   * Record where a mob died (for item drop spawning)
   */
  recordDeathPosition(entityId: string | number, x: number, y: number): void {
    this.deathpositions[entityId] = { x, y };
  }

  /**
   * Get and remove a mob's death position
   */
  getDeadMobPosition(mobId: string | number): { x: number; y: number } | undefined {
    if (mobId in this.deathpositions) {
      const position = this.deathpositions[mobId];
      delete this.deathpositions[mobId];
      return position;
    }
    return undefined;
  }

  // ========== Entity Iteration ==========

  /**
   * Iterate through all entities
   */
  forEachEntity(callback: (entity: any) => void): void {
    _.each(this.entities, function(entity) {
      callback(entity);
    });
  }

  /**
   * Iterate through all Mob entities
   */
  forEachMob(callback: (mob: any) => void): void {
    _.each(this.entities, function(entity) {
      if (entity instanceof Mob) {
        callback(entity);
      }
    });
  }

  // ========== Obsolete Entity Management ==========

  /**
   * Set the list of obsolete entities to be removed
   */
  setObsoleteEntities(entities: any[]): void {
    this.obsoleteEntities = entities;
  }

  /**
   * Remove all obsolete entities (except the player)
   */
  removeObsoleteEntities(playerId: string | number): number {
    const nb = _.size(this.obsoleteEntities);
    const self = this;

    if (nb > 0 && this.obsoleteEntities) {
      _.each(this.obsoleteEntities, function(entity) {
        if (entity.id !== playerId) {
          self.removeEntity(entity);
        }
      });
      console.debug('Removed ' + nb + ' entities: ' + _.pluck(
        _.reject(this.obsoleteEntities, function(entity) {
          return entity.id === playerId;
        }),
        'id'
      ));
      this.obsoleteEntities = null;
    }

    return nb;
  }

  /**
   * Clear all entities (for restart)
   */
  clearAll(): void {
    this.entities = {};
    this.deathpositions = {};
    this.obsoleteEntities = null;
  }
}
