/**
 * Tests for EntityManager
 * Covers: entity creation, item management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';
import { EntityManager } from '../entities/entity-manager';

// Note: Zone-themed chest creation is tested via integration tests
// because Types.getChestKindForZone is dynamically attached and
// doesn't work well with ESM module mocking.

describe('EntityManager', () => {
  let entityManager: EntityManager;

  beforeEach(() => {
    entityManager = new EntityManager();
  });

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
});
