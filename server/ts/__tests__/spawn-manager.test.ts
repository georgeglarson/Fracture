/**
 * Tests for SpawnManager
 * Covers: dependency injection, area initialization, entity spawning,
 *   despawn handlers, chest opening, and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all imported modules before importing SpawnManager

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn()
  })
}));

vi.mock('../mobarea.js', () => ({
  MobArea: vi.fn().mockImplementation(function(this: any) {
    this.entities = [];
    this.spawnMobs = vi.fn();
    this.onEmpty = vi.fn();
    return this;
  })
}));

vi.mock('../chestarea.js', () => ({
  ChestArea: vi.fn().mockImplementation(function(this: any, _id: any, _x: any, _y: any, _w: any, _h: any, tx: any, ty: any, items: any) {
    this.chestX = tx;
    this.chestY = ty;
    this.items = items;
    this.entities = [];
    this.onEmpty = vi.fn();
    this.setNumberOfEntities = vi.fn();
    this.contains = vi.fn().mockReturnValue(false);
    this.addToArea = vi.fn();
    return this;
  })
}));

vi.mock('../../../shared/ts/gametypes.js', () => ({
  Types: {
    getKindFromString: vi.fn(),
    isNpc: vi.fn().mockReturnValue(false),
    isMob: vi.fn().mockReturnValue(false),
    isItem: vi.fn().mockReturnValue(false),
  }
}));

vi.mock('../mob.js', () => ({
  Mob: vi.fn().mockImplementation(function(this: any, id: any, kind: any, x: any, y: any) {
    this.id = id;
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.isDead = false;
    this.area = null;
    this.onRespawn = vi.fn();
    this.onMove = vi.fn();
    return this;
  })
}));

vi.mock('../message.js', () => ({
  Messages: {
    Blink: vi.fn().mockImplementation(function(this: any, entity: any) {
      this.type = 'blink';
      this.entity = entity;
    }),
    Destroy: vi.fn().mockImplementation(function(this: any, entity: any) {
      this.type = 'destroy';
      this.entity = entity;
    }),
    Spawn: vi.fn().mockImplementation(function(this: any, entity: any) {
      this.type = 'spawn';
      this.entity = entity;
    }),
  }
}));

import { SpawnManager } from '../world/spawn-manager';
import { MobArea } from '../mobarea';
import { ChestArea } from '../chestarea';
import { Types } from '../../../shared/ts/gametypes';
import { Mob } from '../mob';
import { Messages } from '../message';

// ========== Mock Factory Helpers ==========

function createMockMap(): any {
  return {
    mobAreas: [],
    chestAreas: [],
    staticChests: [],
    staticEntities: {},
    tileIndexToGridPosition: vi.fn().mockReturnValue({ x: 5, y: 10 }),
  };
}

function createMockEntityManager(): any {
  return {
    addNpc: vi.fn(),
    addMob: vi.fn(),
    addItem: vi.fn().mockImplementation(x => x),
    addStaticItem: vi.fn(),
    addItemFromChest: vi.fn().mockReturnValue({ id: 'item-1', group: 'g1', handleDespawn: vi.fn() }),
    createItem: vi.fn().mockReturnValue({ id: 'item-1' }),
    createChest: vi.fn().mockReturnValue({ id: 'chest-1' }),
    removeEntity: vi.fn(),
  };
}

function createMockBroadcaster(): any {
  return { pushToAdjacentGroups: vi.fn() };
}

function createMockWorldContext(): any {
  return {
    onMobMoveCallback: vi.fn(),
    isValidPosition: vi.fn().mockReturnValue(true),
    addMob: vi.fn(),
  };
}

// ========== Tests ==========

describe('SpawnManager', () => {
  let sm: SpawnManager;
  let mockMap: ReturnType<typeof createMockMap>;
  let mockEntityManager: ReturnType<typeof createMockEntityManager>;
  let mockBroadcaster: ReturnType<typeof createMockBroadcaster>;
  let mockWorldContext: ReturnType<typeof createMockWorldContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    sm = new SpawnManager();
    mockMap = createMockMap();
    mockEntityManager = createMockEntityManager();
    mockBroadcaster = createMockBroadcaster();
    mockWorldContext = createMockWorldContext();
  });

  // ========== Dependency Injection ==========

  describe('dependency injection', () => {
    it('setMap stores the map reference', () => {
      sm.setMap(mockMap);
      // Verify map is stored by using it in initializeAreas
      sm.setWorldContext(mockWorldContext);
      mockMap.mobAreas = [{ id: 1, nb: 1, type: 'rat', x: 0, y: 0, width: 10, height: 10 }];
      sm.initializeAreas();
      expect(MobArea).toHaveBeenCalledTimes(1);
    });

    it('setEntityManager stores the entity manager reference', () => {
      sm.setEntityManager(mockEntityManager);
      sm.setMap(mockMap);
      sm.setWorldContext(mockWorldContext);
      sm.setBroadcaster(mockBroadcaster);
      mockMap.staticChests = [{ x: 1, y: 2, i: [10] }];
      sm.initializeAreas();
      expect(mockEntityManager.createChest).toHaveBeenCalled();
    });

    it('setBroadcaster stores the broadcaster reference', () => {
      sm.setBroadcaster(mockBroadcaster);
      sm.setEntityManager(mockEntityManager);
      const item = { group: 'g1', handleDespawn: vi.fn() };
      sm.handleItemDespawn(item);
      expect(item.handleDespawn).toHaveBeenCalled();
    });

    it('setWorldContext stores the world context reference', () => {
      sm.setWorldContext(mockWorldContext);
      sm.setMap(mockMap);
      sm.setEntityManager(mockEntityManager);
      mockMap.mobAreas = [{ id: 1, nb: 1, type: 'rat', x: 0, y: 0, width: 10, height: 10 }];
      sm.initializeAreas();
      expect(MobArea).toHaveBeenCalledWith(
        1, 1, 'rat', 0, 0, 10, 10, mockWorldContext
      );
    });
  });

  // ========== initializeAreas ==========

  describe('initializeAreas', () => {
    it('returns early if map is not set', () => {
      sm.setWorldContext(mockWorldContext);
      sm.initializeAreas();
      expect(MobArea).not.toHaveBeenCalled();
      expect(sm.mobAreas).toHaveLength(0);
    });

    it('returns early if worldContext is not set', () => {
      sm.setMap(mockMap);
      mockMap.mobAreas = [{ id: 1, nb: 1, type: 'rat', x: 0, y: 0, width: 10, height: 10 }];
      sm.initializeAreas();
      expect(MobArea).not.toHaveBeenCalled();
      expect(sm.mobAreas).toHaveLength(0);
    });

    it('creates MobAreas from map.mobAreas and calls spawnMobs on each', () => {
      sm.setMap(mockMap);
      sm.setWorldContext(mockWorldContext);
      sm.setEntityManager(mockEntityManager);
      mockMap.mobAreas = [
        { id: 1, nb: 3, type: 'rat', x: 0, y: 0, width: 10, height: 10 },
        { id: 2, nb: 5, type: 'skeleton', x: 20, y: 20, width: 15, height: 15 },
      ];
      sm.initializeAreas();

      expect(MobArea).toHaveBeenCalledTimes(2);
      expect(sm.mobAreas).toHaveLength(2);
      sm.mobAreas.forEach(area => {
        expect(area.spawnMobs).toHaveBeenCalledTimes(1);
        expect(area.onEmpty).toHaveBeenCalledTimes(1);
      });
    });

    it('creates ChestAreas from map.chestAreas', () => {
      sm.setMap(mockMap);
      sm.setWorldContext(mockWorldContext);
      sm.setEntityManager(mockEntityManager);
      mockMap.chestAreas = [
        { id: 10, x: 5, y: 5, w: 10, h: 10, tx: 7, ty: 7, i: [100, 101] },
        { id: 11, x: 20, y: 20, w: 8, h: 8, tx: 24, ty: 24, i: [200] },
      ];
      sm.initializeAreas();

      expect(ChestArea).toHaveBeenCalledTimes(2);
      expect(sm.chestAreas).toHaveLength(2);
      sm.chestAreas.forEach(area => {
        expect(area.onEmpty).toHaveBeenCalledTimes(1);
      });
    });

    it('spawns static chests via entityManager', () => {
      sm.setMap(mockMap);
      sm.setWorldContext(mockWorldContext);
      sm.setEntityManager(mockEntityManager);
      mockMap.staticChests = [
        { x: 10, y: 20, i: [50, 51] },
        { x: 30, y: 40, i: [60] },
      ];
      sm.initializeAreas();

      expect(mockEntityManager.createChest).toHaveBeenCalledTimes(2);
      expect(mockEntityManager.createChest).toHaveBeenCalledWith(10, 20, [50, 51]);
      expect(mockEntityManager.createChest).toHaveBeenCalledWith(30, 40, [60]);
      expect(mockEntityManager.addStaticItem).toHaveBeenCalledTimes(2);
    });

    it('calls spawnStaticEntities during initialization', () => {
      sm.setMap(mockMap);
      sm.setWorldContext(mockWorldContext);
      sm.setEntityManager(mockEntityManager);
      const spy = vi.spyOn(sm, 'spawnStaticEntities');
      sm.initializeAreas();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('sets numberOfEntities on each chest area after initialization', () => {
      sm.setMap(mockMap);
      sm.setWorldContext(mockWorldContext);
      sm.setEntityManager(mockEntityManager);
      mockMap.chestAreas = [
        { id: 10, x: 5, y: 5, w: 10, h: 10, tx: 7, ty: 7, i: [100] },
      ];
      sm.initializeAreas();

      expect(sm.chestAreas[0].setNumberOfEntities).toHaveBeenCalledWith(
        sm.chestAreas[0].entities.length
      );
    });
  });

  // ========== spawnStaticEntities ==========

  describe('spawnStaticEntities', () => {
    beforeEach(() => {
      sm.setMap(mockMap);
      sm.setEntityManager(mockEntityManager);
      sm.setWorldContext(mockWorldContext);
    });

    it('returns early if map is not set', () => {
      const sm2 = new SpawnManager();
      sm2.setEntityManager(mockEntityManager);
      sm2.setWorldContext(mockWorldContext);
      sm2.spawnStaticEntities();
      expect(mockEntityManager.addNpc).not.toHaveBeenCalled();
    });

    it('returns early if entityManager is not set', () => {
      const sm2 = new SpawnManager();
      sm2.setMap(mockMap);
      sm2.setWorldContext(mockWorldContext);
      mockMap.staticEntities = { '100': 'guard' };
      sm2.spawnStaticEntities();
      expect(Types.getKindFromString).not.toHaveBeenCalled();
    });

    it('returns early if worldContext is not set', () => {
      const sm2 = new SpawnManager();
      sm2.setMap(mockMap);
      sm2.setEntityManager(mockEntityManager);
      mockMap.staticEntities = { '100': 'guard' };
      sm2.spawnStaticEntities();
      expect(Types.getKindFromString).not.toHaveBeenCalled();
    });

    it('skips entities with undefined kind', () => {
      vi.mocked(Types.getKindFromString).mockReturnValue(undefined);
      mockMap.staticEntities = { '100': 'unknown_entity' };
      sm.spawnStaticEntities();
      expect(mockEntityManager.addNpc).not.toHaveBeenCalled();
      expect(mockEntityManager.addMob).not.toHaveBeenCalled();
      expect(mockEntityManager.addStaticItem).not.toHaveBeenCalled();
    });

    it('spawns NPCs for NPC-type entities', () => {
      vi.mocked(Types.getKindFromString).mockReturnValue(50);
      vi.mocked(Types.isNpc).mockReturnValue(true);
      mockMap.staticEntities = { '200': 'guard' };
      mockMap.tileIndexToGridPosition.mockReturnValue({ x: 10, y: 20 });

      sm.spawnStaticEntities();

      expect(Types.getKindFromString).toHaveBeenCalledWith('guard');
      expect(mockMap.tileIndexToGridPosition).toHaveBeenCalledWith(200);
      expect(mockEntityManager.addNpc).toHaveBeenCalledWith(50, 11, 20);
    });

    it('spawns mobs for mob-type entities with correct ID format', () => {
      vi.mocked(Types.getKindFromString).mockReturnValue(30);
      vi.mocked(Types.isMob).mockReturnValue(true);
      mockMap.staticEntities = { '300': 'rat' };
      mockMap.tileIndexToGridPosition.mockReturnValue({ x: 5, y: 10 });

      sm.spawnStaticEntities();

      expect(Mob).toHaveBeenCalledWith('7300', 30, 6, 10);
      expect(mockEntityManager.addMob).toHaveBeenCalled();
    });

    it('registers onRespawn and onMove callbacks for spawned mobs', () => {
      vi.mocked(Types.getKindFromString).mockReturnValue(30);
      vi.mocked(Types.isMob).mockReturnValue(true);
      mockMap.staticEntities = { '300': 'rat' };

      sm.spawnStaticEntities();

      const mob = vi.mocked(Mob).mock.instances[0] as any;
      expect(mob.onRespawn).toHaveBeenCalledWith(expect.any(Function));
      expect(mob.onMove).toHaveBeenCalledWith(expect.any(Function));
    });

    it('spawns items for item-type entities', () => {
      vi.mocked(Types.getKindFromString).mockReturnValue(70);
      vi.mocked(Types.isItem).mockReturnValue(true);
      mockMap.staticEntities = { '400': 'flask' };
      mockMap.tileIndexToGridPosition.mockReturnValue({ x: 3, y: 7 });

      sm.spawnStaticEntities();

      expect(mockEntityManager.createItem).toHaveBeenCalledWith(70, 4, 7);
      expect(mockEntityManager.addStaticItem).toHaveBeenCalled();
    });

    it('tries adding spawned mobs to chest areas', () => {
      vi.mocked(Types.getKindFromString).mockReturnValue(30);
      vi.mocked(Types.isMob).mockReturnValue(true);
      mockMap.staticEntities = { '300': 'rat' };
      const spy = vi.spyOn(sm, 'tryAddingMobToChestArea');

      sm.spawnStaticEntities();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ========== handleEmptyMobArea ==========

  describe('handleEmptyMobArea', () => {
    it('does not throw (is a no-op)', () => {
      const fakeArea = {} as any;
      expect(() => sm.handleEmptyMobArea(fakeArea)).not.toThrow();
    });
  });

  // ========== handleEmptyChestArea ==========

  describe('handleEmptyChestArea', () => {
    it('creates a chest and starts despawn when area and entityManager exist', () => {
      sm.setEntityManager(mockEntityManager);
      sm.setBroadcaster(mockBroadcaster);
      const fakeArea = { chestX: 15, chestY: 25, items: [100, 101] } as any;
      const fakeChest = { id: 'chest-new', group: 'g2', handleDespawn: vi.fn() };
      mockEntityManager.createChest.mockReturnValue(fakeChest);
      mockEntityManager.addItem.mockReturnValue(fakeChest);

      sm.handleEmptyChestArea(fakeArea);

      expect(mockEntityManager.createChest).toHaveBeenCalledWith(15, 25, [100, 101]);
      expect(mockEntityManager.addItem).toHaveBeenCalledWith(fakeChest);
      expect(fakeChest.handleDespawn).toHaveBeenCalled();
    });

    it('does nothing if area is falsy', () => {
      sm.setEntityManager(mockEntityManager);
      sm.handleEmptyChestArea(null as any);
      expect(mockEntityManager.createChest).not.toHaveBeenCalled();
    });

    it('does nothing if entityManager is not set', () => {
      const fakeArea = { chestX: 1, chestY: 2, items: [10] } as any;
      sm.handleEmptyChestArea(fakeArea);
      // Should not throw
    });
  });

  // ========== tryAddingMobToChestArea ==========

  describe('tryAddingMobToChestArea', () => {
    it('adds mob to chest area if area.contains returns true', () => {
      sm.setMap(mockMap);
      sm.setWorldContext(mockWorldContext);
      sm.setEntityManager(mockEntityManager);
      mockMap.chestAreas = [
        { id: 10, x: 0, y: 0, w: 20, h: 20, tx: 5, ty: 5, i: [100] },
      ];
      sm.initializeAreas();
      const chestArea = sm.chestAreas[0];
      chestArea.contains = vi.fn().mockReturnValue(true);

      const fakeMob = { x: 5, y: 5 };
      sm.tryAddingMobToChestArea(fakeMob);

      expect(chestArea.contains).toHaveBeenCalledWith(fakeMob);
      expect(chestArea.addToArea).toHaveBeenCalledWith(fakeMob);
    });

    it('does not add mob if area.contains returns false', () => {
      sm.setMap(mockMap);
      sm.setWorldContext(mockWorldContext);
      sm.setEntityManager(mockEntityManager);
      mockMap.chestAreas = [
        { id: 10, x: 0, y: 0, w: 20, h: 20, tx: 5, ty: 5, i: [100] },
      ];
      sm.initializeAreas();
      const chestArea = sm.chestAreas[0];
      chestArea.contains = vi.fn().mockReturnValue(false);

      const fakeMob = { x: 50, y: 50 };
      sm.tryAddingMobToChestArea(fakeMob);

      expect(chestArea.contains).toHaveBeenCalledWith(fakeMob);
      expect(chestArea.addToArea).not.toHaveBeenCalled();
    });
  });

  // ========== handleItemDespawn ==========

  describe('handleItemDespawn', () => {
    beforeEach(() => {
      sm.setBroadcaster(mockBroadcaster);
      sm.setEntityManager(mockEntityManager);
    });

    it('calls item.handleDespawn with correct timing config', () => {
      const item = { group: 'g1', handleDespawn: vi.fn() };
      sm.handleItemDespawn(item);

      expect(item.handleDespawn).toHaveBeenCalledTimes(1);
      const config = item.handleDespawn.mock.calls[0][0];
      expect(config.beforeBlinkDelay).toBe(10000);
      expect(config.blinkingDuration).toBe(4000);
      expect(typeof config.blinkCallback).toBe('function');
      expect(typeof config.despawnCallback).toBe('function');
    });

    it('blink callback broadcasts Blink message to adjacent groups', () => {
      const item = { group: 'g1', handleDespawn: vi.fn() };
      sm.handleItemDespawn(item);

      const config = item.handleDespawn.mock.calls[0][0];
      config.blinkCallback();

      expect(Messages.Blink).toHaveBeenCalledWith(item);
      expect(mockBroadcaster.pushToAdjacentGroups).toHaveBeenCalledWith(
        'g1',
        expect.any(Messages.Blink as any)
      );
    });

    it('despawn callback broadcasts Destroy message and removes entity', () => {
      const item = { group: 'g1', handleDespawn: vi.fn() };
      sm.handleItemDespawn(item);

      const config = item.handleDespawn.mock.calls[0][0];
      config.despawnCallback();

      expect(Messages.Destroy).toHaveBeenCalledWith(item);
      expect(mockBroadcaster.pushToAdjacentGroups).toHaveBeenCalledWith(
        'g1',
        expect.any(Messages.Destroy as any)
      );
      expect(mockEntityManager.removeEntity).toHaveBeenCalledWith(item);
    });

    it('does nothing if item is null', () => {
      sm.handleItemDespawn(null);
      expect(mockBroadcaster.pushToAdjacentGroups).not.toHaveBeenCalled();
    });

    it('does nothing if item is undefined', () => {
      sm.handleItemDespawn(undefined);
      expect(mockBroadcaster.pushToAdjacentGroups).not.toHaveBeenCalled();
    });

    it('does nothing if broadcaster is not set', () => {
      const sm2 = new SpawnManager();
      sm2.setEntityManager(mockEntityManager);
      const item = { group: 'g1', handleDespawn: vi.fn() };
      sm2.handleItemDespawn(item);
      expect(item.handleDespawn).not.toHaveBeenCalled();
    });

    it('does nothing if entityManager is not set', () => {
      const sm2 = new SpawnManager();
      sm2.setBroadcaster(mockBroadcaster);
      const item = { group: 'g1', handleDespawn: vi.fn() };
      sm2.handleItemDespawn(item);
      expect(item.handleDespawn).not.toHaveBeenCalled();
    });
  });

  // ========== handleChestDespawn ==========

  describe('handleChestDespawn', () => {
    beforeEach(() => {
      sm.setBroadcaster(mockBroadcaster);
      sm.setEntityManager(mockEntityManager);
    });

    it('calls chest.handleDespawn with correct timing config', () => {
      const chest = { group: 'g2', handleDespawn: vi.fn() };
      sm.handleChestDespawn(chest);

      expect(chest.handleDespawn).toHaveBeenCalledTimes(1);
      const config = chest.handleDespawn.mock.calls[0][0];
      expect(config.beforeBlinkDelay).toBe(60000);
      expect(config.blinkingDuration).toBe(10000);
      expect(typeof config.blinkCallback).toBe('function');
      expect(typeof config.despawnCallback).toBe('function');
    });

    it('blink callback broadcasts Blink message to adjacent groups', () => {
      const chest = { group: 'g2', handleDespawn: vi.fn() };
      sm.handleChestDespawn(chest);

      const config = chest.handleDespawn.mock.calls[0][0];
      config.blinkCallback();

      expect(Messages.Blink).toHaveBeenCalledWith(chest);
      expect(mockBroadcaster.pushToAdjacentGroups).toHaveBeenCalledWith(
        'g2',
        expect.any(Messages.Blink as any)
      );
    });

    it('despawn callback broadcasts Destroy message and removes entity', () => {
      const chest = { group: 'g2', handleDespawn: vi.fn() };
      sm.handleChestDespawn(chest);

      const config = chest.handleDespawn.mock.calls[0][0];
      config.despawnCallback();

      expect(Messages.Destroy).toHaveBeenCalledWith(chest);
      expect(mockBroadcaster.pushToAdjacentGroups).toHaveBeenCalledWith(
        'g2',
        expect.any(Messages.Destroy as any)
      );
      expect(mockEntityManager.removeEntity).toHaveBeenCalledWith(chest);
    });

    it('does nothing if chest is null', () => {
      sm.handleChestDespawn(null);
      expect(mockBroadcaster.pushToAdjacentGroups).not.toHaveBeenCalled();
    });

    it('does nothing if broadcaster is not set', () => {
      const sm2 = new SpawnManager();
      sm2.setEntityManager(mockEntityManager);
      const chest = { group: 'g2', handleDespawn: vi.fn() };
      sm2.handleChestDespawn(chest);
      expect(chest.handleDespawn).not.toHaveBeenCalled();
    });

    it('does nothing if entityManager is not set', () => {
      const sm2 = new SpawnManager();
      sm2.setBroadcaster(mockBroadcaster);
      const chest = { group: 'g2', handleDespawn: vi.fn() };
      sm2.handleChestDespawn(chest);
      expect(chest.handleDespawn).not.toHaveBeenCalled();
    });
  });

  // ========== handleOpenedChest ==========

  describe('handleOpenedChest', () => {
    beforeEach(() => {
      sm.setBroadcaster(mockBroadcaster);
      sm.setEntityManager(mockEntityManager);
    });

    it('broadcasts despawn and removes chest entity', () => {
      const despawnMsg = { type: 'despawn' };
      const chest = {
        id: 'c1', group: 'g3', x: 10, y: 20, items: [100],
        despawn: vi.fn().mockReturnValue(despawnMsg),
        getRandomItem: vi.fn().mockReturnValue(null),
      };
      const player = { id: 'p1' };

      sm.handleOpenedChest(chest, player);

      expect(chest.despawn).toHaveBeenCalled();
      expect(mockBroadcaster.pushToAdjacentGroups).toHaveBeenCalledWith('g3', despawnMsg);
      expect(mockEntityManager.removeEntity).toHaveBeenCalledWith(chest);
    });

    it('creates random item from chest, broadcasts Spawn, and starts despawn timer', () => {
      const spawnedItem = { id: 'item-new', group: 'g3', handleDespawn: vi.fn() };
      mockEntityManager.addItemFromChest.mockReturnValue(spawnedItem);
      const chest = {
        id: 'c1', group: 'g3', x: 10, y: 20, items: [100, 101],
        despawn: vi.fn().mockReturnValue({}),
        getRandomItem: vi.fn().mockReturnValue(100),
      };
      const player = { id: 'p1' };

      sm.handleOpenedChest(chest, player);

      expect(mockEntityManager.addItemFromChest).toHaveBeenCalledWith(100, 10, 20);
      expect(Messages.Spawn).toHaveBeenCalledWith(spawnedItem);
      expect(mockBroadcaster.pushToAdjacentGroups).toHaveBeenCalledWith(
        'g3',
        expect.any(Messages.Spawn as any)
      );
      // The item should have despawn handling set up
      expect(spawnedItem.handleDespawn).toHaveBeenCalled();
    });

    it('handles null getRandomItem gracefully (no item created)', () => {
      const chest = {
        id: 'c1', group: 'g3', x: 10, y: 20, items: [],
        despawn: vi.fn().mockReturnValue({}),
        getRandomItem: vi.fn().mockReturnValue(null),
      };
      const player = { id: 'p1' };

      sm.handleOpenedChest(chest, player);

      expect(mockEntityManager.addItemFromChest).not.toHaveBeenCalled();
      expect(Messages.Spawn).not.toHaveBeenCalled();
    });

    it('does nothing if chest is null', () => {
      sm.handleOpenedChest(null, { id: 'p1' });
      expect(mockBroadcaster.pushToAdjacentGroups).not.toHaveBeenCalled();
      expect(mockEntityManager.removeEntity).not.toHaveBeenCalled();
    });

    it('does nothing if broadcaster is not set', () => {
      const sm2 = new SpawnManager();
      sm2.setEntityManager(mockEntityManager);
      const chest = {
        id: 'c1', group: 'g3', x: 10, y: 20,
        despawn: vi.fn(), getRandomItem: vi.fn(),
      };
      sm2.handleOpenedChest(chest, { id: 'p1' });
      expect(chest.despawn).not.toHaveBeenCalled();
    });

    it('does nothing if entityManager is not set', () => {
      const sm2 = new SpawnManager();
      sm2.setBroadcaster(mockBroadcaster);
      const chest = {
        id: 'c1', group: 'g3', x: 10, y: 20,
        despawn: vi.fn(), getRandomItem: vi.fn(),
      };
      sm2.handleOpenedChest(chest, { id: 'p1' });
      expect(chest.despawn).not.toHaveBeenCalled();
    });
  });
});
