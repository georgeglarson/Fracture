/**
 * Tests for SpatialManager
 * Covers: zone group initialization, entity group membership,
 *   incoming entity handling, group processing/broadcasting,
 *   query methods, edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before importing SpatialManager
vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

// Mock Chest and Item with classes that support instanceof checks
vi.mock('../chest.js', () => ({
  Chest: class MockChest {
    constructor() {}
  },
}));

vi.mock('../item.js', () => ({
  Item: class MockItem {
    constructor() {}
  },
}));

// Mock Messages - must use a class since the code calls `new Messages.Spawn(entity)`
vi.mock('../message.js', () => {
  const SpawnMock = vi.fn(function (this: any, entity: any) {
    this.type = 'spawn';
    this.entity = entity;
  });
  return {
    Messages: {
      Spawn: SpawnMock,
    },
  };
});

import { SpatialManager, MapContext, BroadcasterContext } from '../world/spatial-manager';
import { Chest } from '../chest.js';
import { Item } from '../item.js';
import { Messages } from '../message.js';

/**
 * Create a mock MapContext with three groups: g1, g2, g3
 * Adjacency: g1 -> [g1, g2], g2 -> [g1, g2, g3], g3 -> [g2, g3]
 */
function createMockMap(): MapContext {
  const adjacency: Record<string, string[]> = {
    g1: ['g1', 'g2'],
    g2: ['g1', 'g2', 'g3'],
    g3: ['g2', 'g3'],
  };
  return {
    forEachGroup: vi.fn((cb) => {
      ['g1', 'g2', 'g3'].forEach(cb);
    }),
    forEachAdjacentGroup: vi.fn((gid: string, cb: (id: string) => void) => {
      (adjacency[gid] || []).forEach(cb);
    }),
    getGroupIdFromPosition: vi.fn((x: number, _y: number) => {
      if (x < 10) return 'g1';
      if (x < 20) return 'g2';
      return 'g3';
    }),
  };
}

function createMockBroadcaster(): BroadcasterContext {
  return { pushToGroup: vi.fn() };
}

function makeEntity(id: string | number, type = 'mob', x = 5, y = 5) {
  return { id, type, x, y, group: null as string | null, recentlyLeftGroups: undefined as string[] | undefined };
}

function makePlayerEntity(id: string | number, x = 5, y = 5) {
  return makeEntity(id, 'player', x, y);
}

describe('SpatialManager', () => {
  let sm: SpatialManager;
  let mockMap: MapContext;
  let mockBroadcaster: BroadcasterContext;

  beforeEach(() => {
    vi.clearAllMocks();
    sm = new SpatialManager();
    mockMap = createMockMap();
    mockBroadcaster = createMockBroadcaster();
    sm.setMap(mockMap);
    sm.setBroadcaster(mockBroadcaster);
  });

  // ========== initZoneGroups ==========

  describe('initZoneGroups', () => {
    it('creates groups from map callback', () => {
      sm.initZoneGroups();
      expect(sm.groups).toHaveProperty('g1');
      expect(sm.groups).toHaveProperty('g2');
      expect(sm.groups).toHaveProperty('g3');
    });

    it('sets zoneGroupsReady to true', () => {
      expect(sm.zoneGroupsReady).toBe(false);
      sm.initZoneGroups();
      expect(sm.zoneGroupsReady).toBe(true);
    });

    it('each group has empty entities, players, and incoming', () => {
      sm.initZoneGroups();
      for (const gid of ['g1', 'g2', 'g3']) {
        const group = sm.groups[gid];
        expect(group.entities).toEqual({});
        expect(group.players).toEqual([]);
        expect(group.incoming).toEqual([]);
      }
    });

    it('sets zoneGroupsReady even when map is not set', () => {
      const sm2 = new SpatialManager();
      sm2.initZoneGroups();
      expect(sm2.zoneGroupsReady).toBe(true);
      expect(Object.keys(sm2.groups)).toHaveLength(0);
    });
  });

  // ========== removeFromGroups ==========

  describe('removeFromGroups', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('removes entity from all adjacent groups entities', () => {
      const entity = makeEntity('e1', 'mob');
      sm.addToGroup(entity, 'g1');
      // entity should be in g1 and g2 (g1's adjacency)
      expect(sm.groups['g1'].entities['e1']).toBe(entity);
      expect(sm.groups['g2'].entities['e1']).toBe(entity);

      sm.removeFromGroups(entity);
      expect(sm.groups['g1'].entities['e1']).toBeUndefined();
      expect(sm.groups['g2'].entities['e1']).toBeUndefined();
    });

    it('removes player from group.players array', () => {
      const player = makePlayerEntity('p1');
      sm.addToGroup(player, 'g1');
      expect(sm.groups['g1'].players).toContain('p1');

      sm.removeFromGroups(player);
      expect(sm.groups['g1'].players).not.toContain('p1');
    });

    it('sets entity.group to null', () => {
      const entity = makeEntity('e1', 'mob');
      sm.addToGroup(entity, 'g1');
      expect(entity.group).toBe('g1');

      sm.removeFromGroups(entity);
      expect(entity.group).toBeNull();
    });

    it('returns list of old group IDs', () => {
      const entity = makeEntity('e1', 'mob');
      sm.addToGroup(entity, 'g1');
      const oldGroups = sm.removeFromGroups(entity);
      expect(oldGroups).toContain('g1');
      expect(oldGroups).toContain('g2');
      expect(oldGroups).toHaveLength(2);
    });

    it('returns empty array for entity with no group', () => {
      const entity = makeEntity('e1', 'mob');
      entity.group = null;
      const result = sm.removeFromGroups(entity);
      expect(result).toEqual([]);
    });

    it('returns empty array for null entity', () => {
      const result = sm.removeFromGroups(null);
      expect(result).toEqual([]);
    });

    it('does not remove non-player entity from players array', () => {
      const player = makePlayerEntity('p1');
      const mob = makeEntity('m1', 'mob');
      sm.addToGroup(player, 'g1');
      sm.addToGroup(mob, 'g1');

      sm.removeFromGroups(mob);
      expect(sm.groups['g1'].players).toContain('p1');
    });
  });

  // ========== addToGroup ==========

  describe('addToGroup', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('adds entity to all adjacent groups entities', () => {
      const entity = makeEntity('e1', 'mob');
      sm.addToGroup(entity, 'g2');

      // g2 is adjacent to g1, g2, g3
      expect(sm.groups['g1'].entities['e1']).toBe(entity);
      expect(sm.groups['g2'].entities['e1']).toBe(entity);
      expect(sm.groups['g3'].entities['e1']).toBe(entity);
    });

    it('sets entity.group to the groupId', () => {
      const entity = makeEntity('e1', 'mob');
      sm.addToGroup(entity, 'g2');
      expect(entity.group).toBe('g2');
    });

    it('adds player type entity to group.players', () => {
      const player = makePlayerEntity('p1');
      sm.addToGroup(player, 'g1');
      expect(sm.groups['g1'].players).toContain('p1');
    });

    it('does NOT add non-player entity to group.players', () => {
      const mob = makeEntity('m1', 'mob');
      sm.addToGroup(mob, 'g1');
      expect(sm.groups['g1'].players).not.toContain('m1');
    });

    it('returns list of new group IDs', () => {
      const entity = makeEntity('e1', 'mob');
      const newGroups = sm.addToGroup(entity, 'g2');
      expect(newGroups).toEqual(['g1', 'g2', 'g3']);
    });

    it('returns empty array for invalid groupId', () => {
      const entity = makeEntity('e1', 'mob');
      const result = sm.addToGroup(entity, 'nonexistent');
      expect(result).toEqual([]);
    });

    it('returns empty array for null entity', () => {
      const result = sm.addToGroup(null, 'g1');
      expect(result).toEqual([]);
    });

    it('returns empty array for empty groupId', () => {
      const entity = makeEntity('e1', 'mob');
      const result = sm.addToGroup(entity, '');
      expect(result).toEqual([]);
    });
  });

  // ========== addAsIncomingToGroup ==========

  describe('addAsIncomingToGroup', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('adds entity to incoming array of adjacent groups', () => {
      const entity = makeEntity('e1', 'mob');
      sm.addAsIncomingToGroup(entity, 'g1');

      // g1 adjacent to g1, g2
      expect(sm.groups['g1'].incoming).toContain(entity);
      expect(sm.groups['g2'].incoming).toContain(entity);
      // g3 is not adjacent to g1
      expect(sm.groups['g3'].incoming).not.toContain(entity);
    });

    it('skips entities already in group.entities (no duplicate incoming)', () => {
      const entity = makeEntity('e1', 'mob');
      sm.addToGroup(entity, 'g1');
      // entity is now in g1 and g2 entities

      sm.addAsIncomingToGroup(entity, 'g1');
      // Should not be added to incoming since already in entities
      expect(sm.groups['g1'].incoming).not.toContain(entity);
      expect(sm.groups['g2'].incoming).not.toContain(entity);
    });

    it('skips dropped items (isItem && !isStatic && !isFromChest)', () => {
      const droppedItem = Object.assign(Object.create(Item.prototype), {
        id: 'di1',
        type: 'item',
        isStatic: false,
        isFromChest: false,
      });

      sm.addAsIncomingToGroup(droppedItem, 'g1');
      expect(sm.groups['g1'].incoming).not.toContain(droppedItem);
      expect(sm.groups['g2'].incoming).not.toContain(droppedItem);
    });

    it('does NOT skip Chest instances', () => {
      const chest = Object.assign(Object.create(Chest.prototype), {
        id: 'c1',
        type: 'item',
        isStatic: false,
        isFromChest: false,
      });
      // Chest also extends Item in the mock chain; force instanceof Item to be true
      // Since our mocks are separate classes, Chest won't be instanceof Item
      // but the code checks isChest first, so this should still work
      sm.addAsIncomingToGroup(chest, 'g1');
      expect(sm.groups['g1'].incoming).toContain(chest);
    });

    it('does NOT skip static items', () => {
      const staticItem = Object.assign(Object.create(Item.prototype), {
        id: 'si1',
        type: 'item',
        isStatic: true,
        isFromChest: false,
      });

      sm.addAsIncomingToGroup(staticItem, 'g1');
      expect(sm.groups['g1'].incoming).toContain(staticItem);
    });

    it('does NOT skip items from chests (isFromChest = true)', () => {
      const chestItem = Object.assign(Object.create(Item.prototype), {
        id: 'ci1',
        type: 'item',
        isStatic: false,
        isFromChest: true,
      });

      sm.addAsIncomingToGroup(chestItem, 'g1');
      expect(sm.groups['g1'].incoming).toContain(chestItem);
    });

    it('does nothing for null entity', () => {
      sm.addAsIncomingToGroup(null, 'g1');
      expect(sm.groups['g1'].incoming).toHaveLength(0);
    });

    it('does nothing for empty groupId', () => {
      const entity = makeEntity('e1', 'mob');
      sm.addAsIncomingToGroup(entity, '');
      // Nothing should be added since groupId is falsy
      for (const gid of ['g1', 'g2', 'g3']) {
        expect(sm.groups[gid].incoming).toHaveLength(0);
      }
    });
  });

  // ========== handleEntityGroupMembership ==========

  describe('handleEntityGroupMembership', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('returns true when entity has no group (first placement)', () => {
      const entity = makeEntity('e1', 'mob', 5, 5);
      entity.group = null;
      const changed = sm.handleEntityGroupMembership(entity);
      expect(changed).toBe(true);
    });

    it('returns true when entity moves to a different group', () => {
      const entity = makeEntity('e1', 'mob', 5, 5);
      sm.handleEntityGroupMembership(entity);
      expect(entity.group).toBe('g1');

      // Move to g2 territory
      entity.x = 15;
      const changed = sm.handleEntityGroupMembership(entity);
      expect(changed).toBe(true);
      expect(entity.group).toBe('g2');
    });

    it('returns false when entity stays in same group', () => {
      const entity = makeEntity('e1', 'mob', 5, 5);
      sm.handleEntityGroupMembership(entity);

      // Same group territory
      entity.x = 7;
      const changed = sm.handleEntityGroupMembership(entity);
      expect(changed).toBe(false);
    });

    it('sets recentlyLeftGroups correctly', () => {
      const entity = makeEntity('e1', 'mob', 5, 5);
      sm.handleEntityGroupMembership(entity);
      // entity in g1, entities registered in adjacent g1 + g2

      // Move from g1 to g3 (x >= 20)
      entity.x = 25;
      sm.handleEntityGroupMembership(entity);
      // old groups from g1: [g1, g2], new groups from g3: [g2, g3]
      // recentlyLeftGroups = [g1] (g1 is in old but not in new)
      expect(entity.recentlyLeftGroups).toEqual(['g1']);
    });

    it('does not set recentlyLeftGroups when entity had no previous group', () => {
      const entity = makeEntity('e1', 'mob', 5, 5);
      entity.group = null;
      sm.handleEntityGroupMembership(entity);
      expect(entity.recentlyLeftGroups).toBeUndefined();
    });

    it('returns false for null entity', () => {
      const changed = sm.handleEntityGroupMembership(null);
      expect(changed).toBe(false);
    });

    it('returns false when map is not set', () => {
      const sm2 = new SpatialManager();
      sm2.initZoneGroups();
      const entity = makeEntity('e1', 'mob', 5, 5);
      const changed = sm2.handleEntityGroupMembership(entity);
      expect(changed).toBe(false);
    });
  });

  // ========== processGroups ==========

  describe('processGroups', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('broadcasts Spawn for incoming entities', () => {
      const entity = makeEntity('e1', 'mob');
      sm.groups['g1'].incoming.push(entity);

      sm.processGroups();

      expect(Messages.Spawn).toHaveBeenCalledWith(entity);
      expect(mockBroadcaster.pushToGroup).toHaveBeenCalled();
    });

    it('passes entity.id as ignoredPlayerId for player entities', () => {
      const player = makePlayerEntity('p1');
      sm.groups['g1'].incoming.push(player);

      sm.processGroups();

      expect(Messages.Spawn).toHaveBeenCalledWith(player);
      expect(mockBroadcaster.pushToGroup).toHaveBeenCalledWith(
        'g1',
        expect.objectContaining({ type: 'spawn', entity: player }),
        'p1',
      );
    });

    it('does NOT pass ignoredPlayerId for non-player entities', () => {
      const mob = makeEntity('m1', 'mob');
      sm.groups['g1'].incoming.push(mob);

      sm.processGroups();

      expect(mockBroadcaster.pushToGroup).toHaveBeenCalledWith(
        'g1',
        expect.objectContaining({ type: 'spawn', entity: mob }),
      );
      // Ensure it was called with exactly 2 args (no ignoredPlayerId)
      const call = (mockBroadcaster.pushToGroup as ReturnType<typeof vi.fn>).mock.calls.find(
        (c) => c[0] === 'g1',
      );
      expect(call).toHaveLength(2);
    });

    it('clears incoming array after processing', () => {
      const entity = makeEntity('e1', 'mob');
      sm.groups['g1'].incoming.push(entity);

      sm.processGroups();

      expect(sm.groups['g1'].incoming).toEqual([]);
    });

    it('does nothing when zoneGroupsReady is false', () => {
      sm.zoneGroupsReady = false;
      const entity = makeEntity('e1', 'mob');
      sm.groups['g1'].incoming.push(entity);

      sm.processGroups();

      expect(mockBroadcaster.pushToGroup).not.toHaveBeenCalled();
    });

    it('does nothing when no broadcaster is set', () => {
      const sm2 = new SpatialManager();
      sm2.setMap(mockMap);
      sm2.initZoneGroups();
      sm2.groups['g1'].incoming.push(makeEntity('e1', 'mob'));

      sm2.processGroups();

      expect(mockBroadcaster.pushToGroup).not.toHaveBeenCalled();
    });

    it('does nothing when map is not set', () => {
      const sm2 = new SpatialManager();
      sm2.setBroadcaster(mockBroadcaster);
      sm2.zoneGroupsReady = true;

      sm2.processGroups();

      expect(mockBroadcaster.pushToGroup).not.toHaveBeenCalled();
    });

    it('processes multiple incoming entities in one group', () => {
      const e1 = makeEntity('e1', 'mob');
      const e2 = makeEntity('e2', 'mob');
      sm.groups['g2'].incoming.push(e1, e2);

      sm.processGroups();

      expect(Messages.Spawn).toHaveBeenCalledTimes(2);
      expect(sm.groups['g2'].incoming).toEqual([]);
    });

    it('skips groups with empty incoming arrays', () => {
      // All groups have empty incoming, so nothing should be broadcast
      sm.processGroups();
      expect(mockBroadcaster.pushToGroup).not.toHaveBeenCalled();
    });
  });

  // ========== Query Methods ==========

  describe('getGroup', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('returns correct group for valid groupId', () => {
      const group = sm.getGroup('g1');
      expect(group).toBeDefined();
      expect(group).toBe(sm.groups['g1']);
    });

    it('returns undefined for nonexistent groupId', () => {
      const group = sm.getGroup('nonexistent');
      expect(group).toBeUndefined();
    });
  });

  describe('groupExists', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('returns true for existing group', () => {
      expect(sm.groupExists('g1')).toBe(true);
      expect(sm.groupExists('g2')).toBe(true);
      expect(sm.groupExists('g3')).toBe(true);
    });

    it('returns false for nonexistent group', () => {
      expect(sm.groupExists('g99')).toBe(false);
    });
  });

  describe('getPlayersInGroup', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('returns players array for existing group', () => {
      const player = makePlayerEntity('p1');
      sm.addToGroup(player, 'g1');
      expect(sm.getPlayersInGroup('g1')).toContain('p1');
    });

    it('returns empty array for group with no players', () => {
      expect(sm.getPlayersInGroup('g1')).toEqual([]);
    });

    it('returns empty array for nonexistent group', () => {
      expect(sm.getPlayersInGroup('nonexistent')).toEqual([]);
    });
  });

  describe('getPlayersNearGroup', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('returns deduplicated players from adjacent groups', () => {
      const p1 = makePlayerEntity('p1');
      const p2 = makePlayerEntity('p2');
      sm.addToGroup(p1, 'g1');
      sm.addToGroup(p2, 'g2');

      // g1 is adjacent to [g1, g2], so querying near g1 gets both p1 and p2
      const nearG1 = sm.getPlayersNearGroup('g1');
      expect(nearG1).toHaveLength(2);
      expect(nearG1).toContainEqual(expect.objectContaining({ id: 'p1' }));
      expect(nearG1).toContainEqual(expect.objectContaining({ id: 'p2' }));
    });

    it('deduplicates players that appear in multiple adjacent groups', () => {
      const p1 = makePlayerEntity('p1');
      sm.addToGroup(p1, 'g1');
      // p1 is added to entities of g1 and g2 (g1 adjacency)
      // Querying near g2 checks [g1, g2, g3] - p1 appears in both g1 and g2

      const nearG2 = sm.getPlayersNearGroup('g2');
      const p1Count = nearG2.filter((p: any) => p.id === 'p1').length;
      expect(p1Count).toBe(1);
    });

    it('returns empty array for null groupId', () => {
      expect(sm.getPlayersNearGroup(null as any)).toEqual([]);
    });

    it('returns empty array for empty string groupId', () => {
      expect(sm.getPlayersNearGroup('')).toEqual([]);
    });

    it('returns empty array when map is not set', () => {
      const sm2 = new SpatialManager();
      sm2.initZoneGroups();
      expect(sm2.getPlayersNearGroup('g1')).toEqual([]);
    });

    it('only returns entities that exist in group.entities', () => {
      // Manually add a player id to players array but not to entities
      sm.groups['g1'].players.push('ghost');
      const nearG1 = sm.getPlayersNearGroup('g1');
      // 'ghost' has no matching entity, should not be returned
      expect(nearG1).toEqual([]);
    });
  });

  // ========== logGroupPlayers ==========

  describe('logGroupPlayers', () => {
    it('does not throw when called with a valid group', () => {
      sm.initZoneGroups();
      expect(() => sm.logGroupPlayers('g1')).not.toThrow();
    });
  });

  // ========== Integration-style: full lifecycle ==========

  describe('full entity lifecycle', () => {
    beforeEach(() => {
      sm.initZoneGroups();
    });

    it('entity moves through groups correctly', () => {
      const entity = makeEntity('e1', 'mob', 5, 5);

      // First placement
      const changed1 = sm.handleEntityGroupMembership(entity);
      expect(changed1).toBe(true);
      expect(entity.group).toBe('g1');
      expect(sm.groups['g1'].entities['e1']).toBe(entity);
      expect(sm.groups['g2'].entities['e1']).toBe(entity);

      // Move within same group
      entity.x = 8;
      const changed2 = sm.handleEntityGroupMembership(entity);
      expect(changed2).toBe(false);

      // Move to g2
      entity.x = 15;
      const changed3 = sm.handleEntityGroupMembership(entity);
      expect(changed3).toBe(true);
      expect(entity.group).toBe('g2');
      // g2 adjacent to g1, g2, g3 - entity should be in all three
      expect(sm.groups['g1'].entities['e1']).toBe(entity);
      expect(sm.groups['g2'].entities['e1']).toBe(entity);
      expect(sm.groups['g3'].entities['e1']).toBe(entity);
    });

    it('player lifecycle: add, move, remove', () => {
      const player = makePlayerEntity('p1', 5, 5);

      sm.handleEntityGroupMembership(player);
      expect(sm.groups['g1'].players).toContain('p1');
      expect(sm.getPlayersInGroup('g1')).toContain('p1');

      // Move to g3
      player.x = 25;
      sm.handleEntityGroupMembership(player);
      expect(sm.groups['g1'].players).not.toContain('p1');
      expect(sm.groups['g3'].players).toContain('p1');

      // Remove entirely
      sm.removeFromGroups(player);
      expect(sm.groups['g3'].players).not.toContain('p1');
      expect(player.group).toBeNull();
    });
  });
});
