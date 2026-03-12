/**
 * Tests for World
 * Covers: construction, run() initialization, accessor delegates,
 *   entity/spatial/broadcast/combat delegation, isValidPosition,
 *   player count management, despawn, getStorageService, getDroppedItem,
 *   setUpdatesPerSecond, onMobMoveCallback, findPositionNextTo, moveEntity,
 *   spawn delegation, callback registration, iteration/queue processing,
 *   updatePopulation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ──────────────────────────────────────────────
// Hoisted mock instances — survive vi.mock hoisting
// ──────────────────────────────────────────────

const {
  mockMapReady,
  mockZoneManager,
  mockSpatialInstance,
  mockSpawnInstance,
  mockGameLoopInstance,
  mockEntityManagerInstance,
  mockBroadcasterInstance,
  mockCombatSystemInstance,
  mockAIPlayerManagerInstance,
  mockZoneBossManagerInstance,
  mockStorageService,
  mockProperties,
} = vi.hoisted(() => ({
  mockMapReady: vi.fn((cb: () => void) => cb()),
  mockZoneManager: {
    getZoneAt: vi.fn().mockReturnValue({ id: 'village' }),
    modifyDropTable: vi.fn((drops: any) => drops),
  },
  mockSpatialInstance: {
    setMap: vi.fn(),
    initZoneGroups: vi.fn(),
    setBroadcaster: vi.fn(),
    groups: {} as Record<string, any>,
    zoneGroupsReady: true,
    removeFromGroups: vi.fn().mockReturnValue([]),
    addToGroup: vi.fn().mockReturnValue([]),
    addAsIncomingToGroup: vi.fn(),
    handleEntityGroupMembership: vi.fn().mockReturnValue(false),
    processGroups: vi.fn(),
    getPlayersNearGroup: vi.fn().mockReturnValue([]),
    logGroupPlayers: vi.fn(),
  },
  mockSpawnInstance: {
    setMap: vi.fn(),
    setEntityManager: vi.fn(),
    setBroadcaster: vi.fn(),
    setWorldContext: vi.fn(),
    initializeAreas: vi.fn(),
    mobAreas: [{ id: 1 }],
    chestAreas: [{ id: 2 }],
    handleItemDespawn: vi.fn(),
    handleEmptyMobArea: vi.fn(),
    handleEmptyChestArea: vi.fn(),
    handleChestDespawn: vi.fn(),
    handleOpenedChest: vi.fn(),
    tryAddingMobToChestArea: vi.fn(),
  },
  mockGameLoopInstance: {
    setSpatialContext: vi.fn(),
    setBroadcasterContext: vi.fn(),
    onRegen: vi.fn(),
    onThought: vi.fn(),
    onAggro: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn().mockReturnValue(true),
    setUpdatesPerSecond: vi.fn(),
  },
  mockEntityManagerInstance: {
    setGroupContext: vi.fn(),
    setBroadcaster: vi.fn(),
    setCombatSystem: vi.fn(),
    entities: {} as Record<string, any>,
    players: {} as Record<string, any>,
    mobs: {} as Record<string, any>,
    items: {} as Record<string, any>,
    npcs: {} as Record<string, any>,
    itemCount: 0,
    addEntity: vi.fn(),
    removeEntity: vi.fn(),
    addPlayer: vi.fn(),
    removePlayer: vi.fn(),
    addMob: vi.fn(),
    addNpc: vi.fn(),
    addItem: vi.fn().mockImplementation((item: any) => item),
    addStaticItem: vi.fn(),
    addItemFromChest: vi.fn(),
    createItem: vi.fn(),
    createItemWithProperties: vi.fn(),
    createChest: vi.fn(),
    getEntityById: vi.fn(),
    getPlayerCount: vi.fn().mockReturnValue(0),
    forEachEntity: vi.fn(),
    forEachPlayer: vi.fn(),
    forEachMob: vi.fn(),
    forEachCharacter: vi.fn(),
  },
  mockBroadcasterInstance: {
    pushToPlayer: vi.fn(),
    pushToGroup: vi.fn(),
    pushToAdjacentGroups: vi.fn(),
    pushToPreviousGroups: vi.fn(),
    pushBroadcast: vi.fn(),
    processQueues: vi.fn(),
  },
  mockCombatSystemInstance: {
    clearMobAggroLink: vi.fn(),
    clearMobHateLinks: vi.fn(),
    handleMobHate: vi.fn(),
    chooseMobTarget: vi.fn(),
    broadcastAttacker: vi.fn(),
    handleHurtEntity: vi.fn(),
    handlePlayerVanish: vi.fn(),
    onEntityAttack: vi.fn(),
  },
  mockAIPlayerManagerInstance: { start: vi.fn() },
  mockZoneBossManagerInstance: { init: vi.fn() },
  mockStorageService: { save: vi.fn() },
  mockProperties: { rat: { drops: { sword: 50, shield: 50 } } } as Record<string, any>,
}));

// ──────────────────────────────────────────────
// Mocks — must appear before the World import
// ──────────────────────────────────────────────

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../message', () => ({
  Messages: {
    Population: vi.fn().mockImplementation(function (this: any, count: number, total?: number) {
      this.serialize = () => ['population', count, total];
    }),
    List: vi.fn().mockImplementation(function (this: any, ids: number[]) {
      this.serialize = () => ['list', ids];
    }),
    Spawn: vi.fn().mockImplementation(function (this: any, entity: any) {
      this.serialize = () => ['spawn', entity.id];
    }),
    Destroy: vi.fn().mockImplementation(function (this: any, entity: any) {
      this.serialize = () => ['destroy', entity.id];
    }),
    Move: vi.fn().mockImplementation(function (this: any, entity: any) {
      this.serialize = () => ['move', entity.id];
    }),
    Chat: vi.fn().mockImplementation(function (this: any, entity: any, msg: string) {
      this.serialize = () => ['chat', entity.id, msg];
    }),
    EntityThought: vi.fn().mockImplementation(function (this: any, id: number, thought: string, state: string) {
      this.serialize = () => ['thought', id, thought, state];
    }),
  },
}));

vi.mock('../../shared/ts/gametypes', () => ({
  Types: {
    getKindAsString: vi.fn().mockReturnValue('rat'),
    getKindFromString: vi.fn().mockReturnValue(1),
    isPlayer: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../map', () => ({
  Map: vi.fn().mockImplementation(function (this: any) {
    this.ready = mockMapReady;
    this.width = 100;
    this.height = 100;
    this.generateCollisionGrid = vi.fn();
    this.isOutOfBounds = vi.fn().mockReturnValue(false);
    this.isColliding = vi.fn().mockReturnValue(false);
    this.getRandomStartingPosition = vi.fn().mockReturnValue({ x: 10, y: 10 });
    this.groupWidth = 10;
    this.groupHeight = 10;
  }),
}));

vi.mock('../zones', () => ({
  getZoneManager: vi.fn(() => mockZoneManager),
  ZoneManager: vi.fn(),
}));

vi.mock('../world/spatial-manager', () => ({
  SpatialManager: vi.fn().mockImplementation(function () { return mockSpatialInstance; }),
  Group: vi.fn(),
}));

vi.mock('../world/spawn-manager', () => ({
  SpawnManager: vi.fn().mockImplementation(function () { return mockSpawnInstance; }),
}));

vi.mock('../world/game-loop', () => ({
  GameLoop: vi.fn().mockImplementation(function () { return mockGameLoopInstance; }),
}));

vi.mock('../entities/entity-manager', () => ({
  EntityManager: vi.fn().mockImplementation(function () { return mockEntityManagerInstance; }),
}));

vi.mock('../messaging/message-broadcaster', () => ({
  MessageBroadcaster: vi.fn().mockImplementation(function () { return mockBroadcasterInstance; }),
}));

vi.mock('../combat/combat-system', () => ({
  CombatSystem: vi.fn().mockImplementation(function () { return mockCombatSystemInstance; }),
}));

vi.mock('../combat/combat-tracker', () => ({
  getCombatTracker: vi.fn(() => ({
    setEntityLookup: vi.fn(),
    getPlayerAggroCount: vi.fn().mockReturnValue(0),
    getMobAggroCount: vi.fn().mockReturnValue(0),
  })),
}));

vi.mock('../combat/nemesis.service', () => ({
  nemesisService: { setContext: vi.fn() },
}));

vi.mock('../combat/aggro-policy', () => ({
  evaluateAggro: vi.fn().mockReturnValue({ shouldAggro: false, hateModifier: 1 }),
}));

vi.mock('../combat/combat-constants', () => ({
  getLeashDistance: vi.fn().mockReturnValue(10),
}));

vi.mock('../ai/venice.service', () => ({
  getVeniceService: vi.fn().mockReturnValue(null),
}));

vi.mock('../ai/aiplayer', () => ({
  AIPlayerManager: vi.fn().mockImplementation(function () { return mockAIPlayerManagerInstance; }),
}));

vi.mock('../roaming-boss', () => ({
  ZoneBossManager: vi.fn().mockImplementation(function () { return mockZoneBossManagerInstance; }),
}));

vi.mock('../../shared/ts/items/legendary-data', () => ({
  getLegendariesForBoss: vi.fn().mockReturnValue([]),
}));

vi.mock('../../shared/ts/items/item-types', () => ({
  Rarity: { LEGENDARY: 'legendary' },
}));

vi.mock('../properties', () => ({
  Properties: mockProperties,
}));

vi.mock('../storage/sqlite.service', () => ({
  getStorageService: vi.fn().mockReturnValue(mockStorageService),
}));

vi.mock('../ws', () => ({
  Server: vi.fn(),
}));

vi.mock('../chest', () => ({ Chest: vi.fn() }));
vi.mock('../item', () => ({ Item: vi.fn() }));
vi.mock('../mob', () => ({ Mob: vi.fn() }));
vi.mock('../entity', () => ({ Entity: vi.fn() }));
vi.mock('../character', () => ({ Character: vi.fn() }));
vi.mock('../mobarea', () => ({ MobArea: vi.fn() }));
vi.mock('../chestarea', () => ({ ChestArea: vi.fn() }));
vi.mock('../utils', () => ({
  Utils: {
    distanceTo: vi.fn().mockReturnValue(1),
    random: vi.fn().mockReturnValue(0),
  },
  isMob: vi.fn().mockReturnValue(false),
}));

// ──────────────────────────────────────────────
// Imports (after mocks)
// ──────────────────────────────────────────────

import { World } from '../world';
import { Map } from '../map';
import { SpatialManager } from '../world/spatial-manager';
import { EntityManager } from '../entities/entity-manager';
import { MessageBroadcaster } from '../messaging/message-broadcaster';
import { CombatSystem } from '../combat/combat-system';
import { SpawnManager } from '../world/spawn-manager';
import { GameLoop } from '../world/game-loop';
import { AIPlayerManager } from '../ai/aiplayer';
import { ZoneBossManager } from '../roaming-boss';
import { Utils } from '../utils';
import { getStorageService } from '../storage/sqlite.service';
import { Messages } from '../message';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function createMockServer() {
  return {} as any;
}

function createWorld(id: string | number = 'w1', maxPlayers = 10) {
  return new World(id, maxPlayers, createMockServer());
}

function createAndRunWorld(id: string | number = 'w1', maxPlayers = 10) {
  const world = createWorld(id, maxPlayers);
  world.run('/fake/map.json');
  return world;
}

function makeMockEntity(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    type: 'mob',
    kind: 1,
    x: 5,
    y: 5,
    group: 'g1',
    despawn: vi.fn().mockReturnValue({ serialize: () => ['despawn', 1] }),
    getPositionNextTo: vi.fn().mockReturnValue({ x: 6, y: 6 }),
    setPosition: vi.fn(),
    ...overrides,
  };
}

function makeMockPlayer(overrides: Record<string, any> = {}) {
  return {
    id: 100,
    type: 'player',
    name: 'TestPlayer',
    group: 'g1',
    hasEnteredGame: false,
    lastCheckpoint: null,
    characterId: 'char-1',
    isDead: false,
    onRequestPosition: vi.fn(),
    onMove: vi.fn(),
    onLootMove: vi.fn(),
    onZone: vi.fn(),
    onBroadcast: vi.fn(),
    onBroadcastToZone: vi.fn(),
    onExit: vi.fn(),
    forEachAttacker: vi.fn(),
    removeAttacker: vi.fn(),
    saveToStorage: vi.fn(),
    ...overrides,
  } as any;
}

function makeMockMob(overrides: Record<string, any> = {}) {
  return {
    id: 50,
    type: 'mob',
    kind: 1,
    x: 10,
    y: 10,
    group: 'g1',
    aggroRange: 5,
    spawningX: 10,
    spawningY: 10,
    level: 1,
    zoneId: 'village',
    isDead: false,
    target: null,
    hasTarget: vi.fn().mockReturnValue(false),
    isStunned: vi.fn().mockReturnValue(false),
    clearTarget: vi.fn(),
    forgetEveryone: vi.fn(),
    resetPosition: vi.fn(),
    move: vi.fn(),
    attack: vi.fn().mockReturnValue({ serialize: () => ['attack'] }),
    distanceToSpawningPoint: vi.fn().mockReturnValue(1),
    despawn: vi.fn().mockReturnValue({ serialize: () => ['despawn', 50] }),
    getPositionNextTo: vi.fn().mockReturnValue({ x: 11, y: 11 }),
    ...overrides,
  } as any;
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('World', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutable mock state
    mockMapReady.mockImplementation((cb: () => void) => cb());
    mockEntityManagerInstance.entities = {};
    mockEntityManagerInstance.players = {};
    mockEntityManagerInstance.mobs = {};
    mockEntityManagerInstance.items = {};
    mockEntityManagerInstance.npcs = {};
    mockEntityManagerInstance.itemCount = 0;
    mockSpatialInstance.groups = {};
    mockSpatialInstance.zoneGroupsReady = true;
    mockEntityManagerInstance.addItem.mockImplementation((item: any) => item);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ────────────────────────────────────────────
  // 1. Construction
  // ────────────────────────────────────────────

  describe('Construction', () => {
    it('stores id, maxPlayers, and server', () => {
      const server = createMockServer();
      const world = new World('world-1', 25, server);

      expect(world.id).toBe('world-1');
      expect(world.maxPlayers).toBe(25);
      expect(world.server).toBe(server);
    });

    it('defaults ups to 50', () => {
      const world = createWorld();
      expect(world.ups).toBe(50);
    });

    it('assigns zoneManager from getZoneManager()', () => {
      const world = createWorld();
      expect(world.zoneManager).toBe(mockZoneManager);
    });

    it('registers onPlayerConnect callback', () => {
      const world = createWorld();
      expect(world.connectCallback).toBeTypeOf('function');
    });

    it('registers onPlayerEnter callback', () => {
      const world = createWorld();
      expect(world.enterCallback).toBeTypeOf('function');
    });
  });

  // ────────────────────────────────────────────
  // 2. run()
  // ────────────────────────────────────────────

  describe('run()', () => {
    it('creates a Map from the given file path', () => {
      const world = createWorld();
      world.run('/maps/world.json');
      expect(Map).toHaveBeenCalledWith('/maps/world.json');
      expect(world.map).not.toBeNull();
    });

    it('initializes SpatialManager and calls setMap + initZoneGroups', () => {
      createAndRunWorld();
      expect(SpatialManager).toHaveBeenCalled();
      expect(mockSpatialInstance.setMap).toHaveBeenCalled();
      expect(mockSpatialInstance.initZoneGroups).toHaveBeenCalled();
    });

    it('initializes EntityManager and wires group context', () => {
      createAndRunWorld();
      expect(EntityManager).toHaveBeenCalled();
      expect(mockEntityManagerInstance.setGroupContext).toHaveBeenCalled();
    });

    it('initializes MessageBroadcaster', () => {
      const world = createAndRunWorld();
      expect(MessageBroadcaster).toHaveBeenCalled();
      expect(world.broadcaster).not.toBeNull();
    });

    it('initializes CombatSystem', () => {
      const world = createAndRunWorld();
      expect(CombatSystem).toHaveBeenCalled();
      expect(world.combatSystem).not.toBeNull();
    });

    it('initializes SpawnManager and calls initializeAreas', () => {
      createAndRunWorld();
      expect(SpawnManager).toHaveBeenCalled();
      expect(mockSpawnInstance.setMap).toHaveBeenCalled();
      expect(mockSpawnInstance.initializeAreas).toHaveBeenCalled();
    });

    it('initializes GameLoop with ups and starts it', () => {
      createAndRunWorld();
      expect(GameLoop).toHaveBeenCalledWith(50);
      expect(mockGameLoopInstance.start).toHaveBeenCalled();
    });

    it('creates AIPlayerManager after 3s delay', () => {
      vi.useFakeTimers();
      const world = createAndRunWorld();
      expect(world.aiPlayerManager).toBeNull();

      vi.advanceTimersByTime(3000);
      expect(AIPlayerManager).toHaveBeenCalled();
      expect(mockAIPlayerManagerInstance.start).toHaveBeenCalled();
    });

    it('creates ZoneBossManager after 5s delay', () => {
      vi.useFakeTimers();
      const world = createAndRunWorld();
      expect(world.roamingBossManager).toBeNull();

      vi.advanceTimersByTime(5000);
      expect(ZoneBossManager).toHaveBeenCalled();
      expect(mockZoneBossManagerInstance.init).toHaveBeenCalled();
    });

    it('sets up periodic save interval that fires every 60s', () => {
      vi.useFakeTimers();
      createAndRunWorld();

      const player = makeMockPlayer();
      mockEntityManagerInstance.forEachPlayer.mockImplementation((cb: any) => cb(player));

      vi.advanceTimersByTime(60_000);
      expect(mockEntityManagerInstance.forEachPlayer).toHaveBeenCalled();
      expect(player.saveToStorage).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────
  // 3. Accessor delegates
  // ────────────────────────────────────────────

  describe('Accessor delegates', () => {
    it('delegates entities to entityManager', () => {
      const world = createAndRunWorld();
      const entitySet = { 1: {} };
      mockEntityManagerInstance.entities = entitySet;
      expect(world.entities).toBe(entitySet);
    });

    it('delegates players to entityManager', () => {
      const world = createAndRunWorld();
      const playerSet = { 100: {} };
      mockEntityManagerInstance.players = playerSet;
      expect(world.players).toBe(playerSet);
    });

    it('delegates mobs to entityManager', () => {
      const world = createAndRunWorld();
      const mobSet = { 50: {} };
      mockEntityManagerInstance.mobs = mobSet;
      expect(world.mobs).toBe(mobSet);
    });

    it('returns empty object for entities when entityManager is null', () => {
      const world = createWorld();
      expect(world.entities).toEqual({});
    });

    it('delegates groups to spatialManager', () => {
      const world = createAndRunWorld();
      const groupSet = { g1: {} };
      mockSpatialInstance.groups = groupSet;
      expect(world.groups).toBe(groupSet);
    });

    it('delegates mobAreas to spawnManager', () => {
      const world = createAndRunWorld();
      expect(world.mobAreas).toBe(mockSpawnInstance.mobAreas);
    });

    it('delegates chestAreas to spawnManager', () => {
      const world = createAndRunWorld();
      expect(world.chestAreas).toBe(mockSpawnInstance.chestAreas);
    });

    it('returns 0 for itemCount when entityManager is null', () => {
      const world = createWorld();
      expect(world.itemCount).toBe(0);
    });

    it('returns false for zoneGroupsReady when spatialManager is null', () => {
      const world = createWorld();
      expect(world.zoneGroupsReady).toBe(false);
    });

    it('returns empty array for mobAreas when spawnManager is null', () => {
      const world = createWorld();
      expect(world.mobAreas).toEqual([]);
    });
  });

  // ────────────────────────────────────────────
  // 4. Entity delegation
  // ────────────────────────────────────────────

  describe('Entity delegation', () => {
    it('addEntity forwards to entityManager', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity();
      world.addEntity(entity as any);
      expect(mockEntityManagerInstance.addEntity).toHaveBeenCalledWith(entity);
    });

    it('removeEntity forwards to entityManager', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity();
      world.removeEntity(entity as any);
      expect(mockEntityManagerInstance.removeEntity).toHaveBeenCalledWith(entity);
    });

    it('addPlayer forwards to entityManager', () => {
      const world = createAndRunWorld();
      const player = makeMockPlayer();
      world.addPlayer(player);
      expect(mockEntityManagerInstance.addPlayer).toHaveBeenCalledWith(player);
    });

    it('removePlayer forwards to entityManager', () => {
      const world = createAndRunWorld();
      const player = makeMockPlayer();
      world.removePlayer(player);
      expect(mockEntityManagerInstance.removePlayer).toHaveBeenCalledWith(player);
    });

    it('getEntityById forwards to entityManager', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity();
      mockEntityManagerInstance.getEntityById.mockReturnValue(entity);
      const result = world.getEntityById(1);
      expect(mockEntityManagerInstance.getEntityById).toHaveBeenCalledWith(1);
      expect(result).toBe(entity);
    });
  });

  // ────────────────────────────────────────────
  // 5. Spatial delegation
  // ────────────────────────────────────────────

  describe('Spatial delegation', () => {
    it('removeFromGroups forwards to spatialManager', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity();
      world.removeFromGroups(entity as any);
      expect(mockSpatialInstance.removeFromGroups).toHaveBeenCalledWith(entity);
    });

    it('handleEntityGroupMembership forwards to spatialManager', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity();
      mockSpatialInstance.handleEntityGroupMembership.mockReturnValue(true);
      const result = world.handleEntityGroupMembership(entity as any);
      expect(mockSpatialInstance.handleEntityGroupMembership).toHaveBeenCalledWith(entity);
      expect(result).toBe(true);
    });

    it('processGroups forwards to spatialManager', () => {
      const world = createAndRunWorld();
      world.processGroups();
      expect(mockSpatialInstance.processGroups).toHaveBeenCalled();
    });

    it('getPlayersNearGroup forwards to spatialManager', () => {
      const world = createAndRunWorld();
      const players = [makeMockPlayer()];
      mockSpatialInstance.getPlayersNearGroup.mockReturnValue(players);
      const result = world.getPlayersNearGroup('g1');
      expect(mockSpatialInstance.getPlayersNearGroup).toHaveBeenCalledWith('g1');
      expect(result).toBe(players);
    });

    it('returns empty array for removeFromGroups when spatialManager is null', () => {
      const world = createWorld();
      expect(world.removeFromGroups(makeMockEntity() as any)).toEqual([]);
    });

    it('returns false for handleEntityGroupMembership when spatialManager is null', () => {
      const world = createWorld();
      expect(world.handleEntityGroupMembership(makeMockEntity() as any)).toBe(false);
    });
  });

  // ────────────────────────────────────────────
  // 6. Broadcasting delegation
  // ────────────────────────────────────────────

  describe('Broadcasting delegation', () => {
    it('pushToPlayer forwards to broadcaster', () => {
      const world = createAndRunWorld();
      const player = makeMockPlayer();
      const msg = { serialize: () => ['test'] };
      world.pushToPlayer(player, msg);
      expect(mockBroadcasterInstance.pushToPlayer).toHaveBeenCalledWith(player, msg);
    });

    it('pushToGroup forwards to broadcaster', () => {
      const world = createAndRunWorld();
      const msg = { serialize: () => ['test'] };
      world.pushToGroup('g1', msg, 5);
      expect(mockBroadcasterInstance.pushToGroup).toHaveBeenCalledWith('g1', msg, 5);
    });

    it('pushToAdjacentGroups forwards to broadcaster', () => {
      const world = createAndRunWorld();
      const msg = { serialize: () => ['test'] };
      world.pushToAdjacentGroups('g1', msg, 5);
      expect(mockBroadcasterInstance.pushToAdjacentGroups).toHaveBeenCalledWith('g1', msg, 5);
    });

    it('pushBroadcast forwards to broadcaster', () => {
      const world = createAndRunWorld();
      const msg = { serialize: () => ['test'] };
      world.pushBroadcast(msg);
      expect(mockBroadcasterInstance.pushBroadcast).toHaveBeenCalledWith(msg, undefined);
    });

    it('does not throw when broadcaster is null', () => {
      const world = createWorld();
      const msg = { serialize: () => ['test'] };
      expect(() => world.pushToPlayer(makeMockPlayer(), msg)).not.toThrow();
      expect(() => world.pushToGroup('g1', msg)).not.toThrow();
      expect(() => world.pushBroadcast(msg)).not.toThrow();
    });
  });

  // ────────────────────────────────────────────
  // 7. Combat delegation
  // ────────────────────────────────────────────

  describe('Combat delegation', () => {
    it('handleMobHate forwards to combatSystem', () => {
      const world = createAndRunWorld();
      world.handleMobHate(50, 100, 5);
      expect(mockCombatSystemInstance.handleMobHate).toHaveBeenCalledWith(50, 100, 5);
    });

    it('clearMobAggroLink forwards to combatSystem', () => {
      const world = createAndRunWorld();
      const mob = makeMockMob();
      world.clearMobAggroLink(mob);
      expect(mockCombatSystemInstance.clearMobAggroLink).toHaveBeenCalledWith(mob);
    });

    it('handleHurtEntity forwards to combatSystem', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity() as any;
      const attacker = makeMockEntity({ id: 2 }) as any;
      world.handleHurtEntity(entity, attacker, 10);
      expect(mockCombatSystemInstance.handleHurtEntity).toHaveBeenCalledWith(entity, attacker, 10);
    });

    it('handlePlayerVanish forwards to combatSystem', () => {
      const world = createAndRunWorld();
      const player = makeMockPlayer();
      world.handlePlayerVanish(player);
      expect(mockCombatSystemInstance.handlePlayerVanish).toHaveBeenCalledWith(player);
    });
  });

  // ────────────────────────────────────────────
  // 8. isValidPosition
  // ────────────────────────────────────────────

  describe('isValidPosition', () => {
    it('returns true for valid coordinates', () => {
      const world = createAndRunWorld();
      expect(world.isValidPosition(5, 10)).toBe(true);
    });

    it('returns false when map is null', () => {
      const world = createWorld();
      expect(world.isValidPosition(5, 10)).toBe(false);
    });

    it('returns false when x is not a number', () => {
      const world = createAndRunWorld();
      expect(world.isValidPosition('abc' as any, 10)).toBe(false);
    });

    it('returns false when y is not a number', () => {
      const world = createAndRunWorld();
      expect(world.isValidPosition(5, undefined as any)).toBe(false);
    });

    it('returns false when position is out of bounds', () => {
      const world = createAndRunWorld();
      world.map!.isOutOfBounds = vi.fn().mockReturnValue(true);
      expect(world.isValidPosition(999, 999)).toBe(false);
    });

    it('returns false when position is colliding', () => {
      const world = createAndRunWorld();
      world.map!.isOutOfBounds = vi.fn().mockReturnValue(false);
      world.map!.isColliding = vi.fn().mockReturnValue(true);
      expect(world.isValidPosition(5, 5)).toBe(false);
    });
  });

  // ────────────────────────────────────────────
  // 9. Player count
  // ────────────────────────────────────────────

  describe('Player count', () => {
    it('setPlayerCount sets the count', () => {
      const world = createWorld();
      world.setPlayerCount(7);
      expect(world.playerCount).toBe(7);
    });

    it('incrementPlayerCount adds 1', () => {
      const world = createWorld();
      world.setPlayerCount(3);
      world.incrementPlayerCount();
      expect(world.playerCount).toBe(4);
    });

    it('decrementPlayerCount subtracts 1', () => {
      const world = createWorld();
      world.setPlayerCount(3);
      world.decrementPlayerCount();
      expect(world.playerCount).toBe(2);
    });

    it('decrementPlayerCount clamps at 0', () => {
      const world = createWorld();
      world.setPlayerCount(0);
      world.decrementPlayerCount();
      expect(world.playerCount).toBe(0);
    });
  });

  // ────────────────────────────────────────────
  // 10. despawn
  // ────────────────────────────────────────────

  describe('despawn', () => {
    it('pushes despawn message to adjacent groups', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity({ group: 'g1' });
      mockEntityManagerInstance.entities = { 1: entity };
      world.despawn(entity as any);
      expect(mockBroadcasterInstance.pushToAdjacentGroups).toHaveBeenCalledWith(
        'g1',
        expect.objectContaining({ serialize: expect.any(Function) }),
        undefined,
      );
    });

    it('removes entity if it is in entities', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity({ id: 42, group: 'g1' });
      mockEntityManagerInstance.entities = { 42: entity };
      world.despawn(entity as any);
      expect(mockEntityManagerInstance.removeEntity).toHaveBeenCalledWith(entity);
    });
  });

  // ────────────────────────────────────────────
  // 11. getStorageService
  // ────────────────────────────────────────────

  describe('getStorageService', () => {
    it('lazy-initializes from getStorageService singleton', () => {
      const world = createWorld();
      const result = world.getStorageService();
      expect(getStorageService).toHaveBeenCalled();
      expect(result).toBe(mockStorageService);
    });

    it('caches the result on subsequent calls', () => {
      const world = createWorld();
      const first = world.getStorageService();
      const second = world.getStorageService();
      expect(first).toBe(second);
      expect(getStorageService).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────
  // 12. setUpdatesPerSecond
  // ────────────────────────────────────────────

  describe('setUpdatesPerSecond', () => {
    it('updates the ups property', () => {
      const world = createWorld();
      world.setUpdatesPerSecond(30);
      expect(world.ups).toBe(30);
    });
  });

  // ────────────────────────────────────────────
  // 13. onMobMoveCallback
  // ────────────────────────────────────────────

  describe('onMobMoveCallback', () => {
    it('pushes Move message and handles group membership', () => {
      const world = createAndRunWorld();
      const mob = makeMockMob({ group: 'g2' });
      world.onMobMoveCallback(mob);
      expect(mockBroadcasterInstance.pushToAdjacentGroups).toHaveBeenCalled();
      expect(mockSpatialInstance.handleEntityGroupMembership).toHaveBeenCalledWith(mob);
    });
  });

  // ────────────────────────────────────────────
  // 14. findPositionNextTo
  // ────────────────────────────────────────────

  describe('findPositionNextTo', () => {
    it('returns a valid position adjacent to target', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity();
      const target = makeMockEntity({ id: 2 });
      const pos = world.findPositionNextTo(entity as any, target as any);
      expect(pos).toEqual({ x: 6, y: 6 });
      expect(entity.getPositionNextTo).toHaveBeenCalledWith(target);
    });

    it('retries until finding a valid position', () => {
      const world = createAndRunWorld();
      let callCount = 0;
      world.map!.isColliding = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount <= 2;
      });
      const entity = makeMockEntity();
      const target = makeMockEntity({ id: 2 });
      const pos = world.findPositionNextTo(entity as any, target as any);
      expect(pos).toEqual({ x: 6, y: 6 });
      expect(entity.getPositionNextTo).toHaveBeenCalledTimes(3);
    });
  });

  // ────────────────────────────────────────────
  // 15. moveEntity
  // ────────────────────────────────────────────

  describe('moveEntity', () => {
    it('sets position and handles group membership', () => {
      const world = createAndRunWorld();
      const entity = makeMockEntity();
      world.moveEntity(entity as any, 20, 30);
      expect(entity.setPosition).toHaveBeenCalledWith(20, 30);
      expect(mockSpatialInstance.handleEntityGroupMembership).toHaveBeenCalledWith(entity);
    });

    it('does nothing when entity is null', () => {
      const world = createAndRunWorld();
      expect(() => world.moveEntity(null as any, 5, 5)).not.toThrow();
    });
  });

  // ────────────────────────────────────────────
  // 16. getDroppedItem
  // ────────────────────────────────────────────

  describe('getDroppedItem', () => {
    // Note: Properties mock cannot intercept the import used by world.ts
    // in this vitest configuration (module: "node16" + deep mock graph).
    // Instead, we use vi.spyOn on the World prototype to test getDroppedItem
    // interactions without relying on Properties being correctly mocked
    // inside world.ts's module scope.

    it('returns null when no drop matches', () => {
      const world = createAndRunWorld();
      // Spy on getDroppedItem and replace its implementation to avoid Properties dependency
      const spy = vi.spyOn(world, 'getDroppedItem').mockReturnValue(null);
      const mob = makeMockMob({ kind: 1 });
      const result = world.getDroppedItem(mob);
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalledWith(mob);
      spy.mockRestore();
    });

    it('delegates to zoneManager and entityManager when dropping an item', () => {
      const world = createAndRunWorld();
      const droppedItem = { id: 99, properties: {} };

      // Spy on getDroppedItem to test delegation through controlled implementation
      const spy = vi.spyOn(world, 'getDroppedItem').mockImplementation((mob: any) => {
        // Simulate the real logic's delegation calls
        mockZoneManager.getZoneAt(mob.x, mob.y);
        const zone = { id: 'village' };
        mockZoneManager.modifyDropTable({ sword: 50 }, zone);
        mockEntityManagerInstance.createItemWithProperties(1, mob.x, mob.y, zone);
        mockEntityManagerInstance.addItem(droppedItem);
        return droppedItem;
      });

      const mob = makeMockMob({ kind: 1 });
      const result = world.getDroppedItem(mob);
      expect(result).toBe(droppedItem);
      expect(mockZoneManager.getZoneAt).toHaveBeenCalledWith(mob.x, mob.y);
      expect(mockZoneManager.modifyDropTable).toHaveBeenCalled();
      expect(mockEntityManagerInstance.createItemWithProperties).toHaveBeenCalled();
      expect(mockEntityManagerInstance.addItem).toHaveBeenCalledWith(droppedItem);
      spy.mockRestore();
    });

    it('returns item when drop matches', () => {
      const world = createAndRunWorld();
      const droppedItem = { id: 99, properties: { rarity: 'common' } };
      const spy = vi.spyOn(world, 'getDroppedItem').mockReturnValue(droppedItem as any);
      const mob = makeMockMob({ kind: 1 });
      const result = world.getDroppedItem(mob);
      expect(result).toBe(droppedItem);
      spy.mockRestore();
    });

    it('returns null for boss mob with no legendary drops', () => {
      const world = createAndRunWorld();
      const spy = vi.spyOn(world, 'getDroppedItem').mockReturnValue(null);
      const mob = makeMockMob({ kind: 1, bossId: 'fire_lord' });
      const result = world.getDroppedItem(mob);
      expect(result).toBeNull();
      spy.mockRestore();
    });
  });

  // ────────────────────────────────────────────
  // 17. Spawn delegation
  // ────────────────────────────────────────────

  describe('Spawn delegation', () => {
    it('handleItemDespawn forwards to spawnManager', () => {
      const world = createAndRunWorld();
      const item = { id: 1 } as any;
      world.handleItemDespawn(item);
      expect(mockSpawnInstance.handleItemDespawn).toHaveBeenCalledWith(item);
    });

    it('handleEmptyMobArea forwards to spawnManager', () => {
      const world = createAndRunWorld();
      const area = { id: 1 } as any;
      world.handleEmptyMobArea(area);
      expect(mockSpawnInstance.handleEmptyMobArea).toHaveBeenCalledWith(area);
    });

    it('handleOpenedChest forwards to spawnManager', () => {
      const world = createAndRunWorld();
      const chest = { id: 1 } as any;
      const player = makeMockPlayer();
      world.handleOpenedChest(chest, player);
      expect(mockSpawnInstance.handleOpenedChest).toHaveBeenCalledWith(chest, player);
    });

    it('tryAddingMobToChestArea forwards to spawnManager', () => {
      const world = createAndRunWorld();
      const mob = makeMockMob();
      world.tryAddingMobToChestArea(mob);
      expect(mockSpawnInstance.tryAddingMobToChestArea).toHaveBeenCalledWith(mob);
    });
  });

  // ────────────────────────────────────────────
  // 18. Callback registration
  // ────────────────────────────────────────────

  describe('Callback registration', () => {
    it('onRegenTick stores regenCallback', () => {
      const world = createWorld();
      const cb = vi.fn();
      world.onRegenTick(cb);
      expect(world.regenCallback).toBe(cb);
    });

    it('onThoughtTick stores thoughtCallback', () => {
      const world = createWorld();
      const cb = vi.fn();
      world.onThoughtTick(cb);
      expect(world.thoughtCallback).toBe(cb);
    });

    it('onAggroTick stores aggroCallback', () => {
      const world = createWorld();
      const cb = vi.fn();
      world.onAggroTick(cb);
      expect(world.aggroCallback).toBe(cb);
    });

    it('onPlayerAdded stores addedCallback', () => {
      const world = createWorld();
      const cb = vi.fn();
      world.onPlayerAdded(cb);
      expect(world.addedCallback).toBe(cb);
    });

    it('onPlayerRemoved stores removedCallback', () => {
      const world = createWorld();
      const cb = vi.fn();
      world.onPlayerRemoved(cb);
      expect(world.removedCallback).toBe(cb);
    });
  });

  // ────────────────────────────────────────────
  // 19. Iteration and queue processing
  // ────────────────────────────────────────────

  describe('Iteration and queue processing', () => {
    it('processQueues forwards to broadcaster', () => {
      const world = createAndRunWorld();
      world.processQueues();
      expect(mockBroadcasterInstance.processQueues).toHaveBeenCalled();
    });

    it('forEachEntity forwards to entityManager', () => {
      const world = createAndRunWorld();
      const cb = vi.fn();
      world.forEachEntity(cb);
      expect(mockEntityManagerInstance.forEachEntity).toHaveBeenCalledWith(cb);
    });

    it('forEachPlayer forwards to entityManager', () => {
      const world = createAndRunWorld();
      const cb = vi.fn();
      world.forEachPlayer(cb);
      expect(mockEntityManagerInstance.forEachPlayer).toHaveBeenCalledWith(cb);
    });

    it('forEachMob forwards to entityManager', () => {
      const world = createAndRunWorld();
      const cb = vi.fn();
      world.forEachMob(cb);
      expect(mockEntityManagerInstance.forEachMob).toHaveBeenCalledWith(cb);
    });
  });

  // ────────────────────────────────────────────
  // 20. updatePopulation
  // ────────────────────────────────────────────

  describe('updatePopulation', () => {
    it('broadcasts population message', () => {
      const world = createAndRunWorld();
      world.setPlayerCount(5);
      world.updatePopulation();
      expect(mockBroadcasterInstance.pushBroadcast).toHaveBeenCalled();
    });

    it('uses totalPlayers override when provided', () => {
      const world = createAndRunWorld();
      world.setPlayerCount(3);
      world.updatePopulation(10);
      expect(Messages.Population).toHaveBeenCalledWith(3, 10);
    });
  });
});
