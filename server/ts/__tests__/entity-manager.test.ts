/**
 * Tests for EntityManager
 * Covers: entity creation, item management, player/mob lifecycle,
 *   iteration, lookup, context dependencies, edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';
import {
  EntityManager,
  CombatSystemContext,
  BroadcasterContext,
  GroupContext,
} from '../entities/entity-manager';

// Note: Zone-themed chest creation is tested via integration tests
// because Types.getChestKindForZone is dynamically attached and
// doesn't work well with ESM module mocking.

/** Helper: create a minimal mock entity with the fields EntityManager uses */
function makeMockEntity(id: number | string, type = 'item', kind = Types.Entities.FLASK) {
  return {
    id,
    type,
    kind,
    x: 10,
    y: 20,
    destroy: vi.fn(),
    broadcast: vi.fn(),
    despawn: vi.fn(() => ({ serialize: () => [] })),
  };
}

function makeMockCombatSystem(): CombatSystemContext {
  return {
    clearMobAggroLink: vi.fn(),
    clearMobHateLinks: vi.fn(),
  };
}

function makeMockBroadcaster(): BroadcasterContext {
  return {
    createQueue: vi.fn(),
    removeQueue: vi.fn(),
  };
}

function makeMockGroupContext(): GroupContext {
  return {
    handleEntityGroupMembership: vi.fn(() => true),
    removeFromGroups: vi.fn(),
  };
}

describe('EntityManager', () => {
  let entityManager: EntityManager;

  beforeEach(() => {
    entityManager = new EntityManager();
  });

  // ==================== Existing tests ====================

  describe('createItem - Basic items', () => {
    it('should create a flask item', () => {
      const item = entityManager.createItem(Types.Entities.FLASK, 50, 50);
      expect(item.kind).toBe(Types.Entities.FLASK);
      expect(item.x).toBe(50);
      expect(item.y).toBe(50);
    });

    it('should create a weapon item', () => {
      const item = entityManager.createItem(Types.Entities.SWORD2, 100, 100);
      expect(item.kind).toBe(Types.Entities.SWORD2);
    });

    it('should create an armor item', () => {
      const item = entityManager.createItem(Types.Entities.LEATHERARMOR, 100, 100);
      expect(item.kind).toBe(Types.Entities.LEATHERARMOR);
    });

    it('should generate unique IDs for items', () => {
      const item1 = entityManager.createItem(Types.Entities.FLASK, 50, 50);
      const item2 = entityManager.createItem(Types.Entities.FLASK, 60, 60);
      expect(item1.id).not.toBe(item2.id);
    });
  });

  describe('addItem and getEntityById', () => {
    it('should add item to entities map', () => {
      const item = entityManager.createItem(Types.Entities.FLASK, 50, 50);
      entityManager.addItem(item);

      const retrieved = entityManager.getEntityById(item.id);
      expect(retrieved).toBe(item);
    });

    it('should return undefined for non-existent entity', () => {
      const result = entityManager.getEntityById('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('removeEntity', () => {
    it('should remove entity from entities map', () => {
      const item = entityManager.createItem(Types.Entities.FLASK, 50, 50);
      entityManager.addItem(item);

      entityManager.removeEntity(item);

      const retrieved = entityManager.getEntityById(item.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('forEachEntity', () => {
    it('should iterate over all entities', () => {
      const item1 = entityManager.createItem(Types.Entities.FLASK, 50, 50);
      const item2 = entityManager.createItem(Types.Entities.BURGER, 60, 60);
      entityManager.addItem(item1);
      entityManager.addItem(item2);

      const visited: any[] = [];
      entityManager.forEachEntity((entity) => {
        visited.push(entity);
      });

      expect(visited).toContain(item1);
      expect(visited).toContain(item2);
    });
  });

  describe('Entity type definitions', () => {
    it('should have CHEST entity type defined', () => {
      expect(Types.Entities.CHEST).toBeDefined();
      expect(Types.Entities.CHEST).toBe(37);
    });

    it('should have consumable entity types defined', () => {
      expect(Types.Entities.FLASK).toBeDefined();
      expect(Types.Entities.BURGER).toBeDefined();
    });

    it('should have weapon entity types defined', () => {
      expect(Types.Entities.SWORD1).toBeDefined();
      expect(Types.Entities.SWORD2).toBeDefined();
    });

    it('should have armor entity types defined', () => {
      expect(Types.Entities.CLOTHARMOR).toBeDefined();
      expect(Types.Entities.LEATHERARMOR).toBeDefined();
    });
  });

  // ==================== New tests ====================

  // ---------- Context setters ----------

  describe('setCombatSystem / setBroadcaster / setGroupContext', () => {
    it('should store the combat system reference', () => {
      const cs = makeMockCombatSystem();
      entityManager.setCombatSystem(cs);
      // Verify it is used: remove a mob-type entity
      const mob = makeMockEntity(1, 'mob');
      entityManager.addEntity(mob);
      entityManager.removeEntity(mob);
      expect(cs.clearMobAggroLink).toHaveBeenCalledWith(mob);
      expect(cs.clearMobHateLinks).toHaveBeenCalledWith(mob);
    });

    it('should store the broadcaster reference', () => {
      const bc = makeMockBroadcaster();
      entityManager.setBroadcaster(bc);
      const player = makeMockEntity(1, 'player');
      entityManager.addPlayer(player);
      expect(bc.createQueue).toHaveBeenCalledWith(1);
    });

    it('should store the group context reference', () => {
      const gc = makeMockGroupContext();
      entityManager.setGroupContext(gc);
      const entity = makeMockEntity(1);
      entityManager.addEntity(entity);
      expect(gc.handleEntityGroupMembership).toHaveBeenCalledWith(entity);
    });
  });

  // ---------- addEntity edge cases ----------

  describe('addEntity', () => {
    it('should return true on successful add', () => {
      const entity = makeMockEntity(1);
      expect(entityManager.addEntity(entity)).toBe(true);
    });

    it('should return false for null entity', () => {
      expect(entityManager.addEntity(null)).toBe(false);
    });

    it('should return false for undefined entity', () => {
      expect(entityManager.addEntity(undefined)).toBe(false);
    });

    it('should return false for entity without id', () => {
      expect(entityManager.addEntity({ type: 'mob' })).toBe(false);
    });

    it('should call groupContext.handleEntityGroupMembership when context is set', () => {
      const gc = makeMockGroupContext();
      entityManager.setGroupContext(gc);
      const entity = makeMockEntity(5);
      entityManager.addEntity(entity);
      expect(gc.handleEntityGroupMembership).toHaveBeenCalledWith(entity);
    });

    it('should work without groupContext set', () => {
      const entity = makeMockEntity(5);
      expect(entityManager.addEntity(entity)).toBe(true);
      expect(entityManager.getEntityById(5)).toBe(entity);
    });
  });

  // ---------- removeEntity edge cases ----------

  describe('removeEntity - edge cases', () => {
    it('should return true on successful removal', () => {
      const entity = makeMockEntity(1);
      entityManager.addEntity(entity);
      expect(entityManager.removeEntity(entity)).toBe(true);
    });

    it('should return false for null entity', () => {
      expect(entityManager.removeEntity(null)).toBe(false);
    });

    it('should return false for undefined entity', () => {
      expect(entityManager.removeEntity(undefined)).toBe(false);
    });

    it('should return false for entity without id', () => {
      expect(entityManager.removeEntity({ type: 'mob' })).toBe(false);
    });

    it('should remove from mobs map when entity is in mobs', () => {
      const mob = makeMockEntity(10, 'mob');
      entityManager.addMob(mob);
      expect(entityManager.mobs[10]).toBe(mob);
      entityManager.removeEntity(mob);
      expect(entityManager.mobs[10]).toBeUndefined();
    });

    it('should remove from items map when entity is in items', () => {
      const item = entityManager.createItem(Types.Entities.FLASK, 5, 5);
      entityManager.addItem(item);
      expect(entityManager.items[item.id]).toBe(item);
      entityManager.removeEntity(item);
      expect(entityManager.items[item.id]).toBeUndefined();
    });

    it('should call combatSystem methods for mob-type entities', () => {
      const cs = makeMockCombatSystem();
      entityManager.setCombatSystem(cs);
      const mob = makeMockEntity(10, 'mob');
      entityManager.addEntity(mob);
      entityManager.removeEntity(mob);
      expect(cs.clearMobAggroLink).toHaveBeenCalledWith(mob);
      expect(cs.clearMobHateLinks).toHaveBeenCalledWith(mob);
    });

    it('should not call combatSystem methods for non-mob entities', () => {
      const cs = makeMockCombatSystem();
      entityManager.setCombatSystem(cs);
      const item = makeMockEntity(10, 'item');
      entityManager.addEntity(item);
      entityManager.removeEntity(item);
      expect(cs.clearMobAggroLink).not.toHaveBeenCalled();
      expect(cs.clearMobHateLinks).not.toHaveBeenCalled();
    });

    it('should call entity.destroy()', () => {
      const entity = makeMockEntity(1);
      entityManager.addEntity(entity);
      entityManager.removeEntity(entity);
      expect(entity.destroy).toHaveBeenCalled();
    });

    it('should call groupContext.removeFromGroups when context is set', () => {
      const gc = makeMockGroupContext();
      entityManager.setGroupContext(gc);
      const entity = makeMockEntity(1);
      entityManager.addEntity(entity);
      entityManager.removeEntity(entity);
      expect(gc.removeFromGroups).toHaveBeenCalledWith(entity);
    });

    it('should handle removing an entity that is not in the entities map', () => {
      const entity = makeMockEntity(999);
      // Entity not added, but removeEntity should still work (destroy + groups)
      expect(entityManager.removeEntity(entity)).toBe(true);
    });
  });

  // ---------- Player management ----------

  describe('addPlayer', () => {
    it('should add player to both entities and players maps', () => {
      const player = makeMockEntity(1, 'player');
      expect(entityManager.addPlayer(player)).toBe(true);
      expect(entityManager.getEntityById(1)).toBe(player);
      expect(entityManager.players[1]).toBe(player);
    });

    it('should call broadcaster.createQueue when broadcaster is set', () => {
      const bc = makeMockBroadcaster();
      entityManager.setBroadcaster(bc);
      const player = makeMockEntity(1, 'player');
      entityManager.addPlayer(player);
      expect(bc.createQueue).toHaveBeenCalledWith(1);
    });

    it('should return false for invalid player', () => {
      expect(entityManager.addPlayer(null)).toBe(false);
    });

    it('should return false for player without id', () => {
      expect(entityManager.addPlayer({ type: 'player' })).toBe(false);
    });
  });

  describe('removePlayer', () => {
    it('should remove player from entities and players maps', () => {
      const player = makeMockEntity(1, 'player');
      entityManager.addPlayer(player);
      expect(entityManager.removePlayer(player)).toBe(true);
      expect(entityManager.getEntityById(1)).toBeUndefined();
      expect(entityManager.players[1]).toBeUndefined();
    });

    it('should call player.broadcast with despawn message', () => {
      const player = makeMockEntity(1, 'player');
      entityManager.addPlayer(player);
      entityManager.removePlayer(player);
      expect(player.broadcast).toHaveBeenCalled();
    });

    it('should call broadcaster.removeQueue when broadcaster is set', () => {
      const bc = makeMockBroadcaster();
      entityManager.setBroadcaster(bc);
      const player = makeMockEntity(1, 'player');
      entityManager.addPlayer(player);
      entityManager.removePlayer(player);
      expect(bc.removeQueue).toHaveBeenCalledWith(1);
    });

    it('should return false for invalid player', () => {
      expect(entityManager.removePlayer(null)).toBe(false);
    });
  });

  // ---------- Mob management ----------

  describe('addMob', () => {
    it('should add mob to both entities and mobs maps', () => {
      const mob = makeMockEntity(1, 'mob');
      expect(entityManager.addMob(mob)).toBe(true);
      expect(entityManager.getEntityById(1)).toBe(mob);
      expect(entityManager.mobs[1]).toBe(mob);
    });

    it('should return false for invalid mob', () => {
      expect(entityManager.addMob(null)).toBe(false);
    });

    it('should return false for mob without id', () => {
      expect(entityManager.addMob({ type: 'mob' })).toBe(false);
    });
  });

  // ---------- NPC management ----------

  describe('addNpc', () => {
    it('should create and add an NPC', () => {
      const npc = entityManager.addNpc(Types.Entities.GUARD, 10, 20);
      expect(npc).not.toBeNull();
      expect(npc!.kind).toBe(Types.Entities.GUARD);
      expect(npc!.x).toBe(10);
      expect(npc!.y).toBe(20);
    });

    it('should add the NPC to npcs map', () => {
      const npc = entityManager.addNpc(Types.Entities.GUARD, 10, 20);
      expect(entityManager.npcs[npc!.id]).toBe(npc);
    });

    it('should add the NPC to entities map', () => {
      const npc = entityManager.addNpc(Types.Entities.GUARD, 10, 20);
      expect(entityManager.getEntityById(npc!.id)).toBe(npc);
    });

    it('should generate NPC ID from coordinates', () => {
      const npc = entityManager.addNpc(Types.Entities.GUARD, 15, 25);
      // ID is '8' + x + '' + y parsed as int
      expect(npc!.id).toBe(parseInt('8' + 15 + '' + 25));
    });
  });

  // ---------- Item management - additional tests ----------

  describe('addItem - additional', () => {
    it('should add item to items map', () => {
      const item = entityManager.createItem(Types.Entities.FLASK, 5, 5);
      entityManager.addItem(item);
      expect(entityManager.items[item.id]).toBe(item);
    });

    it('should return the item', () => {
      const item = entityManager.createItem(Types.Entities.FLASK, 5, 5);
      const returned = entityManager.addItem(item);
      expect(returned).toBe(item);
    });
  });

  describe('createItem - chest types', () => {
    it('should create a Chest when kind is CHEST_CRATE', () => {
      const chest = entityManager.createItem(Types.Entities.CHEST_CRATE, 10, 20);
      expect(chest).not.toBeNull();
      expect(chest!.kind).toBe(Types.Entities.CHEST_CRATE);
    });

    it('should create a Chest for other chest kinds', () => {
      const chest = entityManager.createItem(Types.Entities.CHEST_LOG, 10, 20);
      expect(chest).not.toBeNull();
      expect(chest!.kind).toBe(Types.Entities.CHEST_LOG);
    });

    it('should increment itemCount for each created item', () => {
      expect(entityManager.itemCount).toBe(0);
      entityManager.createItem(Types.Entities.FLASK, 1, 1);
      expect(entityManager.itemCount).toBe(1);
      entityManager.createItem(Types.Entities.FLASK, 2, 2);
      expect(entityManager.itemCount).toBe(2);
    });
  });

  describe('createItemWithProperties', () => {
    it('should create a regular item without properties', () => {
      const item = entityManager.createItemWithProperties(Types.Entities.SWORD2, 10, 20);
      expect(item).not.toBeNull();
      expect(item!.kind).toBe(Types.Entities.SWORD2);
    });

    it('should create a chest when kind is a chest type', () => {
      const chest = entityManager.createItemWithProperties(Types.Entities.CHEST_CRATE, 10, 20);
      expect(chest).not.toBeNull();
      expect(chest!.kind).toBe(Types.Entities.CHEST_CRATE);
    });

    it('should use existing properties when passed a properties object', () => {
      const existingProps = { rarity: 'rare', displayName: 'Cool Sword' };
      const item = entityManager.createItemWithProperties(Types.Entities.SWORD2, 10, 20, existingProps);
      expect(item).not.toBeNull();
    });

    it('should use rarity bonus when passed a zone-like object', () => {
      const zoneObj = { rarityBonus: 0.5 };
      const item = entityManager.createItemWithProperties(Types.Entities.SWORD2, 10, 20, zoneObj);
      expect(item).not.toBeNull();
      expect(item!.kind).toBe(Types.Entities.SWORD2);
    });

    it('should increment itemCount', () => {
      expect(entityManager.itemCount).toBe(0);
      entityManager.createItemWithProperties(Types.Entities.FLASK, 1, 1);
      expect(entityManager.itemCount).toBe(1);
    });
  });

  describe('createChest', () => {
    it('should create a chest with items', () => {
      const items = [Types.Entities.FLASK, Types.Entities.SWORD2];
      const chest = entityManager.createChest(10, 20, items, Types.Entities.CHEST_CRATE);
      expect(chest).not.toBeNull();
      expect(chest!.kind).toBe(Types.Entities.CHEST_CRATE);
    });

    it('should set items on the chest', () => {
      const items = [Types.Entities.FLASK, Types.Entities.BURGER];
      const chest = entityManager.createChest(10, 20, items, Types.Entities.CHEST_CRATE);
      expect(chest).not.toBeNull();
      expect(chest!.items).toEqual(items);
    });
  });

  describe('addStaticItem', () => {
    it('should mark item as static', () => {
      const item = entityManager.createItem(Types.Entities.FLASK, 5, 5);
      entityManager.addStaticItem(item);
      expect(item.isStatic).toBe(true);
    });

    it('should register a respawn callback', () => {
      const item = entityManager.createItem(Types.Entities.FLASK, 5, 5);
      entityManager.addStaticItem(item);
      expect(item.respawnCallback).toBeDefined();
      expect(typeof item.respawnCallback).toBe('function');
    });

    it('should add the item to entities and items maps', () => {
      const item = entityManager.createItem(Types.Entities.FLASK, 5, 5);
      entityManager.addStaticItem(item);
      expect(entityManager.getEntityById(item.id)).toBe(item);
      expect(entityManager.items[item.id]).toBe(item);
    });
  });

  describe('addItemFromChest', () => {
    it('should create an item and mark it as from chest', () => {
      const item = entityManager.addItemFromChest(Types.Entities.FLASK, 10, 20);
      expect(item).not.toBeNull();
      expect(item!.isFromChest).toBe(true);
    });

    it('should add the item to entities and items maps', () => {
      const item = entityManager.addItemFromChest(Types.Entities.FLASK, 10, 20);
      expect(entityManager.getEntityById(item!.id)).toBe(item);
      expect(entityManager.items[item!.id]).toBe(item);
    });
  });

  // ---------- Iteration ----------

  describe('forEachPlayer', () => {
    it('should iterate over all players', () => {
      const p1 = makeMockEntity(1, 'player');
      const p2 = makeMockEntity(2, 'player');
      entityManager.addPlayer(p1);
      entityManager.addPlayer(p2);

      const visited: any[] = [];
      entityManager.forEachPlayer((player) => {
        visited.push(player);
      });

      expect(visited).toHaveLength(2);
      expect(visited).toContain(p1);
      expect(visited).toContain(p2);
    });

    it('should iterate zero times when no players', () => {
      const visited: any[] = [];
      entityManager.forEachPlayer((player) => visited.push(player));
      expect(visited).toHaveLength(0);
    });
  });

  describe('forEachMob', () => {
    it('should iterate over all mobs', () => {
      const m1 = makeMockEntity(1, 'mob');
      const m2 = makeMockEntity(2, 'mob');
      entityManager.addMob(m1);
      entityManager.addMob(m2);

      const visited: any[] = [];
      entityManager.forEachMob((mob) => {
        visited.push(mob);
      });

      expect(visited).toHaveLength(2);
      expect(visited).toContain(m1);
      expect(visited).toContain(m2);
    });

    it('should iterate zero times when no mobs', () => {
      const visited: any[] = [];
      entityManager.forEachMob((mob) => visited.push(mob));
      expect(visited).toHaveLength(0);
    });
  });

  describe('forEachCharacter', () => {
    it('should iterate over both players and mobs', () => {
      const p1 = makeMockEntity(1, 'player');
      const m1 = makeMockEntity(2, 'mob');
      entityManager.addPlayer(p1);
      entityManager.addMob(m1);

      const visited: any[] = [];
      entityManager.forEachCharacter((char) => {
        visited.push(char);
      });

      expect(visited).toHaveLength(2);
      expect(visited).toContain(p1);
      expect(visited).toContain(m1);
    });

    it('should work with only players', () => {
      const p1 = makeMockEntity(1, 'player');
      entityManager.addPlayer(p1);

      const visited: any[] = [];
      entityManager.forEachCharacter((char) => visited.push(char));
      expect(visited).toHaveLength(1);
      expect(visited).toContain(p1);
    });

    it('should work with only mobs', () => {
      const m1 = makeMockEntity(1, 'mob');
      entityManager.addMob(m1);

      const visited: any[] = [];
      entityManager.forEachCharacter((char) => visited.push(char));
      expect(visited).toHaveLength(1);
      expect(visited).toContain(m1);
    });
  });

  // ---------- Lookup ----------

  describe('getPlayerCount', () => {
    it('should return 0 when no players', () => {
      expect(entityManager.getPlayerCount()).toBe(0);
    });

    it('should return correct count with players', () => {
      entityManager.addPlayer(makeMockEntity(1, 'player'));
      entityManager.addPlayer(makeMockEntity(2, 'player'));
      entityManager.addPlayer(makeMockEntity(3, 'player'));
      expect(entityManager.getPlayerCount()).toBe(3);
    });

    it('should decrease when players are removed', () => {
      const p1 = makeMockEntity(1, 'player');
      const p2 = makeMockEntity(2, 'player');
      entityManager.addPlayer(p1);
      entityManager.addPlayer(p2);
      expect(entityManager.getPlayerCount()).toBe(2);

      entityManager.removePlayer(p1);
      expect(entityManager.getPlayerCount()).toBe(1);
    });
  });

  describe('entityExists', () => {
    it('should return false for non-existent entity', () => {
      expect(entityManager.entityExists(999)).toBe(false);
    });

    it('should return true for existing entity', () => {
      const entity = makeMockEntity(42);
      entityManager.addEntity(entity);
      expect(entityManager.entityExists(42)).toBe(true);
    });

    it('should return false after entity is removed', () => {
      const entity = makeMockEntity(42);
      entityManager.addEntity(entity);
      entityManager.removeEntity(entity);
      expect(entityManager.entityExists(42)).toBe(false);
    });
  });
});
