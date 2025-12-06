/**
 * Spawn Manager - Handles entity spawning, despawning, and area management
 * Single Responsibility: Manage MobAreas, ChestAreas, and entity lifecycle
 */

import * as _ from 'lodash';
import { MobArea } from '../mobarea.js';
import { ChestArea } from '../chestarea.js';
import { Types } from '../../../shared/ts/gametypes.js';
import { Mob } from '../mob.js';
import { Messages } from '../message.js';

export interface MapSpawnContext {
  mobAreas: any[];
  chestAreas: any[];
  staticChests: any[];
  staticEntities: Record<string, string>;
  tileIndexToGridPosition(tid: string | number): { x: number; y: number };
}

export interface EntityManagerContext {
  addNpc(kind: number, x: number, y: number): any;
  addMob(mob: any): void;
  addItem(item: any): any;
  addStaticItem(item: any): any;
  addItemFromChest(kind: number, x: number, y: number): any;
  createItem(kind: number, x: number, y: number): any;
  createChest(x: number, y: number, items: number[]): any;
  removeEntity(entity: any): void;
}

export interface BroadcasterContext {
  pushToAdjacentGroups(groupId: string, message: any): void;
}

export interface WorldContext {
  onMobMoveCallback(mob: any): void;
}

export class SpawnManager {
  // Area storage
  mobAreas: MobArea[] = [];
  chestAreas: ChestArea[] = [];

  // Dependencies
  private map: MapSpawnContext | null = null;
  private entityManager: EntityManagerContext | null = null;
  private broadcaster: BroadcasterContext | null = null;
  private worldContext: WorldContext | null = null;

  constructor() {}

  /**
   * Set map context for spawn data
   */
  setMap(map: MapSpawnContext): void {
    this.map = map;
  }

  /**
   * Set entity manager for creating entities
   */
  setEntityManager(entityManager: EntityManagerContext): void {
    this.entityManager = entityManager;
  }

  /**
   * Set broadcaster for despawn messages
   */
  setBroadcaster(broadcaster: BroadcasterContext): void {
    this.broadcaster = broadcaster;
  }

  /**
   * Set world context for mob move callbacks
   */
  setWorldContext(worldContext: WorldContext): void {
    this.worldContext = worldContext;
  }

  // ========== Area Initialization ==========

  /**
   * Initialize all mob and chest areas from map data
   */
  initializeAreas(): void {
    if (!this.map || !this.worldContext) return;

    const self = this;

    // Populate all mob "roaming" areas
    _.each(this.map.mobAreas, function(a) {
      const area = new MobArea(a.id, a.nb, a.type, a.x, a.y, a.width, a.height, self.worldContext);
      area.spawnMobs();
      area.onEmpty(self.handleEmptyMobArea.bind(self, area));
      self.mobAreas.push(area);
    });

    // Create all chest areas
    _.each(this.map.chestAreas, function(a) {
      const area = new ChestArea(a.id, a.x, a.y, a.w, a.h, a.tx, a.ty, a.i, self.worldContext);
      self.chestAreas.push(area);
      area.onEmpty(self.handleEmptyChestArea.bind(self, area));
    });

    // Spawn static chests
    _.each(this.map.staticChests, function(chest) {
      const c = self.entityManager!.createChest(chest.x, chest.y, chest.i);
      self.entityManager!.addStaticItem(c);
    });

    // Spawn static entities
    this.spawnStaticEntities();

    // Set maximum number of entities contained in each chest area
    _.each(this.chestAreas, function(area) {
      area.setNumberOfEntities(area.entities.length);
    });
  }

  /**
   * Spawn static entities (NPCs, mobs, items) from map data
   */
  spawnStaticEntities(): void {
    if (!this.map || !this.entityManager || !this.worldContext) return;

    const self = this;
    let count = 0;

    _.each(this.map.staticEntities, function(kindName, tid) {
      const kind = Types.getKindFromString(kindName);
      const pos = self.map!.tileIndexToGridPosition(tid);

      if (Types.isNpc(kind)) {
        self.entityManager!.addNpc(kind, pos.x + 1, pos.y);
      }
      if (Types.isMob(kind)) {
        const mob = new Mob('7' + kind + count++, kind, pos.x + 1, pos.y);
        mob.onRespawn(function() {
          mob.isDead = false;
          self.entityManager!.addMob(mob);
          if (mob.area && mob.area instanceof ChestArea) {
            mob.area.addToArea(mob);
          }
        });
        mob.onMove(self.worldContext!.onMobMoveCallback.bind(self.worldContext));
        self.entityManager!.addMob(mob);
        self.tryAddingMobToChestArea(mob);
      }
      if (Types.isItem(kind)) {
        self.entityManager!.addStaticItem(self.entityManager!.createItem(kind, pos.x + 1, pos.y));
      }
    });
  }

  // ========== Area Event Handlers ==========

  /**
   * Handle when a mob area becomes empty (all mobs killed)
   * Currently a no-op - mobs respawn individually
   */
  handleEmptyMobArea(area: MobArea): void {
    // No-op: mobs respawn individually via their own timers
  }

  /**
   * Handle when a chest area becomes empty (all mobs killed)
   * Spawns a chest with items
   */
  handleEmptyChestArea(area: ChestArea): void {
    if (area && this.entityManager) {
      const chest = this.entityManager.addItem(
        this.entityManager.createChest(area.chestX, area.chestY, area.items)
      );
      this.handleChestDespawn(chest);
    }
  }

  /**
   * Try to add a mob to any chest area it's contained in
   */
  tryAddingMobToChestArea(mob: any): void {
    _.each(this.chestAreas, function(area) {
      if (area.contains(mob)) {
        area.addToArea(mob);
      }
    });
  }

  // ========== Despawn Handlers ==========

  /**
   * Handle item despawn lifecycle (blink then destroy)
   */
  handleItemDespawn(item: any): void {
    if (!item || !this.broadcaster || !this.entityManager) return;

    const self = this;

    item.handleDespawn({
      beforeBlinkDelay: 10000,
      blinkCallback() {
        self.broadcaster!.pushToAdjacentGroups(item.group, new Messages.Blink(item));
      },
      blinkingDuration: 4000,
      despawnCallback() {
        self.broadcaster!.pushToAdjacentGroups(item.group, new Messages.Destroy(item));
        self.entityManager!.removeEntity(item);
      }
    });
  }

  /**
   * Handle chest despawn lifecycle (longer timer than regular items)
   */
  handleChestDespawn(chest: any): void {
    if (!chest || !this.broadcaster || !this.entityManager) return;

    const self = this;

    chest.handleDespawn({
      beforeBlinkDelay: 60000,  // 60 seconds before blinking
      blinkCallback() {
        self.broadcaster!.pushToAdjacentGroups(chest.group, new Messages.Blink(chest));
      },
      blinkingDuration: 10000,  // 10 seconds of blinking
      despawnCallback() {
        self.broadcaster!.pushToAdjacentGroups(chest.group, new Messages.Destroy(chest));
        self.entityManager!.removeEntity(chest);
      }
    });
  }

  /**
   * Handle when a chest is opened by a player
   */
  handleOpenedChest(chest: any, player: any): void {
    if (!chest || !this.broadcaster || !this.entityManager) return;

    const chestGroup = chest.group;  // Save group before removing
    console.log('[Chest] Opening chest', chest.id, 'at', chest.x, chest.y);
    console.log('[Chest] Chest items:', chest.items);

    this.broadcaster.pushToAdjacentGroups(chestGroup, chest.despawn());
    this.entityManager.removeEntity(chest);

    const kind = chest.getRandomItem();
    console.log('[Chest] Random item kind:', kind);

    if (kind) {
      const item = this.entityManager.addItemFromChest(kind, chest.x, chest.y);
      console.log('[Chest] Created item', item.id, 'of kind', kind, 'at', chest.x, chest.y);
      // Push to adjacent groups - player is already in these groups
      this.broadcaster.pushToAdjacentGroups(chestGroup, new Messages.Spawn(item));
      this.handleItemDespawn(item);
    } else {
      console.log('[Chest] No item dropped - chest.items was:', chest.items);
    }
  }
}
