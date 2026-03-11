/**
 * Tests for Entity base class
 * Covers: constructor, getState, spawn, despawn, setPosition, getPositionNextTo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../entity';

// Concrete subclass since Entity is abstract
class TestEntity extends Entity {
  destroyed = false;
  destroy(): void {
    this.destroyed = true;
  }
}

describe('Entity', () => {
  let entity: TestEntity;

  beforeEach(() => {
    entity = new TestEntity(42, 'mob', 10, 100, 200);
  });

  // ========== Constructor ==========

  describe('constructor', () => {
    it('should set numeric id directly', () => {
      const e = new TestEntity(7, 'mob', 5, 10, 20);
      expect(e.id).toBe(7);
    });

    it('should parse string id to number', () => {
      const e = new TestEntity('123', 'item', 5, 10, 20);
      expect(e.id).toBe(123);
    });

    it('should set type', () => {
      expect(entity.type).toBe('mob');
    });

    it('should set kind', () => {
      expect(entity.kind).toBe(10);
    });

    it('should set x and y', () => {
      expect(entity.x).toBe(100);
      expect(entity.y).toBe(200);
    });

    it('should leave group undefined by default', () => {
      expect(entity.group).toBeUndefined();
    });
  });

  // ========== _getBaseState ==========

  describe('_getBaseState', () => {
    it('should return [id, kind, x, y]', () => {
      const state = entity._getBaseState();
      expect(state).toEqual([42, 10, 100, 200]);
    });

    it('should reflect updated position', () => {
      entity.x = 300;
      entity.y = 400;
      const state = entity._getBaseState();
      expect(state).toEqual([42, 10, 300, 400]);
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('should delegate to _getBaseState by default', () => {
      const state = entity.getState();
      expect(state).toEqual([42, 10, 100, 200]);
    });
  });

  // ========== spawn ==========

  describe('spawn', () => {
    it('should return a serializable Spawn message', () => {
      const msg = entity.spawn();
      expect(msg).toBeDefined();
      expect(typeof msg.serialize).toBe('function');
    });

    it('should serialize with entity state', () => {
      const msg = entity.spawn();
      const serialized = msg.serialize();
      // First element is the message type, rest is the entity state
      expect(serialized.length).toBeGreaterThan(1);
      // Entity state (id, kind, x, y) should appear after the message type
      expect(serialized).toContain(42);
      expect(serialized).toContain(10);
      expect(serialized).toContain(100);
      expect(serialized).toContain(200);
    });
  });

  // ========== despawn ==========

  describe('despawn', () => {
    it('should return a serializable Despawn message', () => {
      const msg = entity.despawn();
      expect(msg).toBeDefined();
      expect(typeof msg.serialize).toBe('function');
    });

    it('should serialize with entity id', () => {
      const msg = entity.despawn();
      const serialized = msg.serialize();
      expect(serialized).toContain(42);
    });
  });

  // ========== setPosition ==========

  describe('setPosition', () => {
    it('should update x and y', () => {
      entity.setPosition(500, 600);
      expect(entity.x).toBe(500);
      expect(entity.y).toBe(600);
    });

    it('should allow setting to zero', () => {
      entity.setPosition(0, 0);
      expect(entity.x).toBe(0);
      expect(entity.y).toBe(0);
    });

    it('should allow negative coordinates', () => {
      entity.setPosition(-10, -20);
      expect(entity.x).toBe(-10);
      expect(entity.y).toBe(-20);
    });
  });

  // ========== getPositionNextTo ==========

  describe('getPositionNextTo', () => {
    let other: TestEntity;

    beforeEach(() => {
      other = new TestEntity(99, 'npc', 1, 50, 50);
    });

    it('should return a position object when given a valid entity', () => {
      const pos = entity.getPositionNextTo(other);
      expect(pos).not.toBeNull();
      expect(pos).toHaveProperty('x');
      expect(pos).toHaveProperty('y');
    });

    it('should return a position within 1 tile of the target entity', () => {
      // Run multiple times to cover the random branches
      for (let i = 0; i < 50; i++) {
        const pos = entity.getPositionNextTo(other);
        expect(pos).not.toBeNull();
        const dx = Math.abs(pos!.x - other.x);
        const dy = Math.abs(pos!.y - other.y);
        // Exactly one of dx or dy should be 1, the other 0
        expect(dx + dy).toBe(1);
      }
    });

    it('should return null when entity is falsy', () => {
      const pos = entity.getPositionNextTo(null as unknown as Entity);
      expect(pos).toBeNull();
    });

    it('should return position with y-1 when random returns 0', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // Utils.random(4) => floor(0*4) = 0
      const pos = entity.getPositionNextTo(other);
      expect(pos).toEqual({ x: 50, y: 49 });
      vi.restoreAllMocks();
    });

    it('should return position with y+1 when random returns 1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.25); // Utils.random(4) => floor(0.25*4) = 1
      const pos = entity.getPositionNextTo(other);
      expect(pos).toEqual({ x: 50, y: 51 });
      vi.restoreAllMocks();
    });

    it('should return position with x-1 when random returns 2', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Utils.random(4) => floor(0.5*4) = 2
      const pos = entity.getPositionNextTo(other);
      expect(pos).toEqual({ x: 49, y: 50 });
      vi.restoreAllMocks();
    });

    it('should return position with x+1 when random returns 3', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.75); // Utils.random(4) => floor(0.75*4) = 3
      const pos = entity.getPositionNextTo(other);
      expect(pos).toEqual({ x: 51, y: 50 });
      vi.restoreAllMocks();
    });
  });
});
