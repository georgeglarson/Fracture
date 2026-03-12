/**
 * Spawn Manager - Handles entity spawning, despawning, and area management
 * Single Responsibility: Manage MobAreas, ChestAreas, and entity lifecycle
 */

import { MobArea } from '../mobarea.js';
import { ChestArea } from '../chestarea.js';
import { Types } from '../../../shared/ts/gametypes.js';
import { Mob } from '../mob.js';
import { Messages } from '../message.js';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('SpawnManager');

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
  onMobMoveCallback(mob: Mob): void;
  isValidPosition(x: number, y: number): boolean;
  addMob(mob: Mob): void;
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

    // Populate all mob "roaming" areas
    this.map.mobAreas.forEach((a) => {
      const area = new MobArea(a.id, a.nb, a.type, a.x, a.y, a.width, a.height, this.worldContext);
      area.spawnMobs();
      area.onEmpty(this.handleEmptyMobArea.bind(this, area));
      this.mobAreas.push(area);
    });

    // Create all chest areas
    this.map.chestAreas.forEach((a) => {
      const area = new ChestArea(a.id, a.x, a.y, a.w, a.h, a.tx, a.ty, a.i, this.worldContext);
      this.chestAreas.push(area);
      area.onEmpty(this.handleEmptyChestArea.bind(this, area));
    });

    // Spawn static chests
    const em = this.entityManager;
    this.map.staticChests.forEach((chest) => {
      const c = em.createChest(chest.x, chest.y, chest.i);
      em.addStaticItem(c);
    });

    // Spawn static entities
    this.spawnStaticEntities();

    // Set maximum number of entities contained in each chest area
    this.chestAreas.forEach((area) => {
      area.setNumberOfEntities(area.entities.length);
    });
  }

  /**
   * Spawn static entities (NPCs, mobs, items) from map data
   */
  spawnStaticEntities(): void {
    if (!this.map || !this.entityManager || !this.worldContext) return;

    const map = this.map;
    const em = this.entityManager;
    const world = this.worldContext;
    let count = 0;

    Object.entries(map.staticEntities).forEach(([tid, kindName]: [string, string]) => {
      const kind = Types.getKindFromString(kindName);
      if (kind === undefined) return;
      const pos = map.tileIndexToGridPosition(parseInt(tid));

      if (Types.isNpc(kind)) {
        em.addNpc(kind, pos.x + 1, pos.y);
      }
      if (Types.isMob(kind)) {
        const mob = new Mob('7' + kind + count++, kind, pos.x + 1, pos.y);
        mob.onRespawn(() => {
          mob.isDead = false;
          em.addMob(mob);
          if (mob.area && mob.area instanceof ChestArea) {
            mob.area.addToArea(mob);
          }
        });
        mob.onMove(world.onMobMoveCallback.bind(world));
        em.addMob(mob);
        this.tryAddingMobToChestArea(mob);
      }
      if (Types.isItem(kind)) {
        em.addStaticItem(em.createItem(kind, pos.x + 1, pos.y));
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
    this.chestAreas.forEach((area) => {
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

    const broadcaster = this.broadcaster;
    const entityManager = this.entityManager;
    item.handleDespawn({
      beforeBlinkDelay: 10000,
      blinkCallback: () => {
        broadcaster.pushToAdjacentGroups(item.group, new Messages.Blink(item));
      },
      blinkingDuration: 4000,
      despawnCallback: () => {
        broadcaster.pushToAdjacentGroups(item.group, new Messages.Destroy(item));
        entityManager.removeEntity(item);
      }
    });
  }

  /**
   * Handle chest despawn lifecycle (longer timer than regular items)
   */
  handleChestDespawn(chest: any): void {
    if (!chest || !this.broadcaster || !this.entityManager) return;

    const broadcaster = this.broadcaster;
    const entityManager = this.entityManager;
    chest.handleDespawn({
      beforeBlinkDelay: 60000,  // 60 seconds before blinking
      blinkCallback: () => {
        broadcaster.pushToAdjacentGroups(chest.group, new Messages.Blink(chest));
      },
      blinkingDuration: 10000,  // 10 seconds of blinking
      despawnCallback: () => {
        broadcaster.pushToAdjacentGroups(chest.group, new Messages.Destroy(chest));
        entityManager.removeEntity(chest);
      }
    });
  }

  /**
   * Handle when a chest is opened by a player
   */
  handleOpenedChest(chest: any, player: any): void {
    if (!chest || !this.broadcaster || !this.entityManager) return;

    const chestGroup = chest.group;  // Save group before removing
    log.info({ chestId: chest.id, x: chest.x, y: chest.y }, 'Opening chest');
    log.debug({ chestId: chest.id, items: chest.items }, 'Chest items');

    this.broadcaster.pushToAdjacentGroups(chestGroup, chest.despawn());
    this.entityManager.removeEntity(chest);

    const kind = chest.getRandomItem();
    log.debug({ kind }, 'Random item kind from chest');

    if (kind) {
      const item = this.entityManager.addItemFromChest(kind, chest.x, chest.y);
      if (item) {
        log.debug({ itemId: item.id, kind, x: chest.x, y: chest.y }, 'Created item from chest');
        // Push to adjacent groups - player is already in these groups
        this.broadcaster.pushToAdjacentGroups(chestGroup, new Messages.Spawn(item));
        this.handleItemDespawn(item);
      }
    } else {
      log.debug({ items: chest.items }, 'No item dropped from chest');
    }
  }
}
