/**
 * Tests for Area, ChestArea, Chest, and Item classes.
 * Covers: construction, position generation, entity management,
 *   callbacks, containment checks, chest item handling, item
 *   properties, despawn timers, destroy lifecycle, and respawn.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Area } from '../area';
import { ChestArea } from '../chestarea';
import { Chest } from '../chest';
import { Item } from '../item';
import { Types } from '../../../shared/ts/gametypes';
import { Rarity } from '../../../shared/ts/items/item-types';
import { Utils } from '../utils';

// ---------------------------------------------------------------------------
// Shared mock helpers
// ---------------------------------------------------------------------------

function makeMockWorld(isValidPosition = true) {
  return {
    isValidPosition: vi.fn(() => isValidPosition),
  };
}

function makeMockEntity(id: number | string, isDead = false) {
  return { id, isDead, area: undefined as Area | undefined };
}

function makeGeneratedItem(overrides: Partial<{ displayName: string; rarity: string }> = {}) {
  return {
    kind: Types.Entities.SWORD2,
    kindName: 'sword2',
    displayName: overrides.displayName ?? 'Steel Sword',
    properties: {
      rarity: (overrides.rarity as Rarity) ?? Rarity.COMMON,
      level: 1,
      category: 'weapon' as const,
      damageMin: 10,
      damageMax: 20,
    },
  };
}

// ---------------------------------------------------------------------------
// Area
// ---------------------------------------------------------------------------

describe('Area', () => {
  let world: ReturnType<typeof makeMockWorld>;

  beforeEach(() => {
    world = makeMockWorld();
  });

  // ---------- Constructor ----------

  describe('constructor', () => {
    it('sets all fields correctly', () => {
      const area = new Area(1, 10, 20, 5, 8, world);
      expect(area.id).toBe(1);
      expect(area.x).toBe(10);
      expect(area.y).toBe(20);
      expect(area.width).toBe(5);
      expect(area.height).toBe(8);
      expect(area.world).toBe(world);
    });

    it('initializes entities to an empty array', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      expect(area.entities).toEqual([]);
    });

    it('initializes hasCompletelyRespawned to true', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      expect(area.hasCompletelyRespawned).toBe(true);
    });

    it('initializes nbEntities to 0', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      expect(area.nbEntities).toBe(0);
    });

    it('clamps width to minimum 1 when given 0', () => {
      const area = new Area(1, 0, 0, 0, 5, world);
      expect(area.width).toBe(1);
    });

    it('clamps height to minimum 1 when given 0', () => {
      const area = new Area(1, 0, 0, 5, 0, world);
      expect(area.height).toBe(1);
    });

    it('clamps width to minimum 1 when given a negative value', () => {
      const area = new Area(1, 0, 0, -10, 5, world);
      expect(area.width).toBe(1);
    });

    it('clamps height to minimum 1 when given a negative value', () => {
      const area = new Area(1, 0, 0, 5, -10, world);
      expect(area.height).toBe(1);
    });

    it('accepts positive width and height without clamping', () => {
      const area = new Area(1, 0, 0, 3, 7, world);
      expect(area.width).toBe(3);
      expect(area.height).toBe(7);
    });
  });

  // ---------- _getRandomPositionInsideArea ----------

  describe('_getRandomPositionInsideArea', () => {
    it('returns a position whose x is within [area.x, area.x + width)', () => {
      const area = new Area(1, 10, 20, 5, 8, world);
      const pos = area._getRandomPositionInsideArea();
      expect(pos.x).toBeGreaterThanOrEqual(10);
      expect(pos.x).toBeLessThan(10 + 5);
    });

    it('returns a position whose y is within [area.y, area.y + height)', () => {
      const area = new Area(1, 10, 20, 5, 8, world);
      const pos = area._getRandomPositionInsideArea();
      expect(pos.y).toBeGreaterThanOrEqual(20);
      expect(pos.y).toBeLessThan(20 + 8);
    });

    it('calls world.isValidPosition with the generated coordinates', () => {
      const area = new Area(1, 10, 20, 5, 8, world);
      area._getRandomPositionInsideArea();
      expect(world.isValidPosition).toHaveBeenCalled();
    });

    it('returns a valid position on the first valid attempt', () => {
      world.isValidPosition.mockReturnValue(true);
      const area = new Area(1, 0, 0, 10, 10, world);
      const pos = area._getRandomPositionInsideArea();
      expect(pos).toHaveProperty('x');
      expect(pos).toHaveProperty('y');
      // Only one call needed because the first position is valid.
      expect(world.isValidPosition).toHaveBeenCalledTimes(1);
    });

    it('falls back to the center when no valid position is found after 100 attempts', () => {
      world.isValidPosition.mockReturnValue(false);
      const area = new Area(1, 10, 20, 6, 8, world);
      const pos = area._getRandomPositionInsideArea();
      // Center: x = 10 + floor(6/2) = 13, y = 20 + floor(8/2) = 24
      expect(pos.x).toBe(10 + Math.floor(6 / 2));
      expect(pos.y).toBe(20 + Math.floor(8 / 2));
    });

    it('retries up to 100 times before falling back', () => {
      world.isValidPosition.mockReturnValue(false);
      const area = new Area(1, 0, 0, 4, 4, world);
      area._getRandomPositionInsideArea();
      expect(world.isValidPosition).toHaveBeenCalledTimes(100);
    });

    it('stops retrying once a valid position is found', () => {
      // First two calls invalid, third valid.
      world.isValidPosition
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      const area = new Area(1, 0, 0, 10, 10, world);
      area._getRandomPositionInsideArea();
      expect(world.isValidPosition).toHaveBeenCalledTimes(3);
    });
  });

  // ---------- addToArea ----------

  describe('addToArea', () => {
    it('pushes entity into entities array', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      const entity = makeMockEntity(42);
      area.addToArea(entity);
      expect(area.entities).toContain(entity);
    });

    it('sets entity.area to this area', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      const entity = makeMockEntity(42);
      area.addToArea(entity);
      expect(entity.area).toBe(area);
    });

    it('adds multiple entities without overwriting previous ones', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      const e1 = makeMockEntity(1);
      const e2 = makeMockEntity(2);
      area.addToArea(e1);
      area.addToArea(e2);
      expect(area.entities).toHaveLength(2);
      expect(area.entities).toContain(e1);
      expect(area.entities).toContain(e2);
    });

    it('sets hasCompletelyRespawned to true when area becomes full', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.setNumberOfEntities(1);
      area.hasCompletelyRespawned = false;
      const entity = makeMockEntity(1);
      area.addToArea(entity);
      // isFull() is true because !isEmpty() && nbEntities === entities.length
      expect(area.hasCompletelyRespawned).toBe(true);
    });

    it('does not set hasCompletelyRespawned when area is not yet full', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.setNumberOfEntities(3);
      area.hasCompletelyRespawned = false;
      area.addToArea(makeMockEntity(1));
      // Only one of three entities added – not full yet.
      expect(area.hasCompletelyRespawned).toBe(false);
    });
  });

  // ---------- removeFromArea ----------

  describe('removeFromArea', () => {
    it('removes entity from entities array by id', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      const entity = makeMockEntity(10);
      area.addToArea(entity);
      area.removeFromArea(entity);
      expect(area.entities).not.toContain(entity);
    });

    it('does nothing when entity is not in the area', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      const entity = makeMockEntity(99);
      // Should not throw.
      expect(() => area.removeFromArea(entity)).not.toThrow();
    });

    it('triggers emptyCallback when area becomes empty and hasCompletelyRespawned is true', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.setNumberOfEntities(1);
      const callback = vi.fn();
      area.onEmpty(callback);

      const entity = makeMockEntity(1);
      area.addToArea(entity);
      // Force hasCompletelyRespawned to true (was set by addToArea since full).
      expect(area.hasCompletelyRespawned).toBe(true);

      area.removeFromArea(entity);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('sets hasCompletelyRespawned to false after triggering the emptyCallback', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.setNumberOfEntities(1);
      area.onEmpty(vi.fn());

      const entity = makeMockEntity(1);
      area.addToArea(entity);
      area.removeFromArea(entity);
      expect(area.hasCompletelyRespawned).toBe(false);
    });

    it('does NOT trigger emptyCallback when hasCompletelyRespawned is false', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      const callback = vi.fn();
      area.onEmpty(callback);
      area.hasCompletelyRespawned = false;

      const entity = makeMockEntity(1);
      area.entities.push(entity); // add directly without updating hasCompletelyRespawned
      area.removeFromArea(entity);
      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT trigger emptyCallback when area is not empty after removal', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      const callback = vi.fn();
      area.onEmpty(callback);
      area.setNumberOfEntities(2);

      const e1 = makeMockEntity(1);
      const e2 = makeMockEntity(2);
      area.addToArea(e1);
      area.addToArea(e2);
      // After adding two live entities, isFull() is true → hasCompletelyRespawned = true.
      area.removeFromArea(e1);
      // e2 is still alive → isEmpty() is false → callback should not fire.
      expect(callback).not.toHaveBeenCalled();
    });

    it('does NOT trigger emptyCallback when emptyCallback is null', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      const entity = makeMockEntity(1);
      area.addToArea(entity);
      // Callback is null by default.
      expect(() => area.removeFromArea(entity)).not.toThrow();
    });
  });

  // ---------- isEmpty ----------

  describe('isEmpty', () => {
    it('returns true when entities array is empty', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      expect(area.isEmpty()).toBe(true);
    });

    it('returns false when at least one living entity is present', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.entities.push(makeMockEntity(1, false));
      expect(area.isEmpty()).toBe(false);
    });

    it('returns true when all entities are dead', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.entities.push(makeMockEntity(1, true));
      area.entities.push(makeMockEntity(2, true));
      expect(area.isEmpty()).toBe(true);
    });

    it('returns false when a mix of dead and living entities exists', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.entities.push(makeMockEntity(1, true));
      area.entities.push(makeMockEntity(2, false));
      expect(area.isEmpty()).toBe(false);
    });
  });

  // ---------- isFull ----------

  describe('isFull', () => {
    it('returns false when area is empty', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.setNumberOfEntities(2);
      expect(area.isFull()).toBe(false);
    });

    it('returns true when entity count matches nbEntities and area is not empty', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.setNumberOfEntities(2);
      area.entities.push(makeMockEntity(1, false));
      area.entities.push(makeMockEntity(2, false));
      expect(area.isFull()).toBe(true);
    });

    it('returns false when entities.length does not match nbEntities', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.setNumberOfEntities(3);
      area.entities.push(makeMockEntity(1, false));
      expect(area.isFull()).toBe(false);
    });

    it('returns false when all entities are dead even if count matches nbEntities', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.setNumberOfEntities(2);
      area.entities.push(makeMockEntity(1, true));
      area.entities.push(makeMockEntity(2, true));
      // isEmpty() is true, so isFull() must be false.
      expect(area.isFull()).toBe(false);
    });
  });

  // ---------- setNumberOfEntities / onEmpty ----------

  describe('setNumberOfEntities', () => {
    it('updates nbEntities', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      area.setNumberOfEntities(7);
      expect(area.nbEntities).toBe(7);
    });
  });

  describe('onEmpty', () => {
    it('registers the callback', () => {
      const area = new Area(1, 0, 0, 5, 5, world);
      const cb = vi.fn();
      area.onEmpty(cb);
      expect(area.emptyCallback).toBe(cb);
    });
  });
});

// ---------------------------------------------------------------------------
// ChestArea
// ---------------------------------------------------------------------------

describe('ChestArea', () => {
  let world: ReturnType<typeof makeMockWorld>;

  beforeEach(() => {
    world = makeMockWorld();
  });

  // ---------- Constructor ----------

  describe('constructor', () => {
    it('sets chest position correctly', () => {
      const ca = new ChestArea(1, 0, 0, 10, 10, 5, 6, [1, 2, 3], world);
      expect(ca.chestX).toBe(5);
      expect(ca.chestY).toBe(6);
    });

    it('stores items array', () => {
      const items = [Types.Entities.FLASK, Types.Entities.SWORD2];
      const ca = new ChestArea(1, 0, 0, 10, 10, 0, 0, items, world);
      expect(ca.items).toEqual(items);
    });

    it('inherits Area fields from super constructor', () => {
      const ca = new ChestArea(7, 3, 4, 8, 9, 1, 2, [], world);
      expect(ca.id).toBe(7);
      expect(ca.x).toBe(3);
      expect(ca.y).toBe(4);
      expect(ca.width).toBe(8);
      expect(ca.height).toBe(9);
    });
  });

  // ---------- contains ----------

  describe('contains', () => {
    let ca: ChestArea;

    beforeEach(() => {
      // Area occupies x:[10,20), y:[20,30)
      ca = new ChestArea(1, 10, 20, 10, 10, 15, 25, [], world);
    });

    it('returns true for an entity strictly inside the bounds', () => {
      expect(ca.contains({ x: 15, y: 25 })).toBe(true);
    });

    it('returns true for entity at the top-left corner (x, y)', () => {
      expect(ca.contains({ x: 10, y: 20 })).toBe(true);
    });

    it('returns true for entity at the far boundary (x+width-1, y+height-1)', () => {
      expect(ca.contains({ x: 19, y: 29 })).toBe(true);
    });

    it('returns false for entity exactly at x+width (right boundary)', () => {
      expect(ca.contains({ x: 20, y: 25 })).toBe(false);
    });

    it('returns false for entity exactly at y+height (bottom boundary)', () => {
      expect(ca.contains({ x: 15, y: 30 })).toBe(false);
    });

    it('returns false for entity to the left of the area', () => {
      expect(ca.contains({ x: 9, y: 25 })).toBe(false);
    });

    it('returns false for entity above the area', () => {
      expect(ca.contains({ x: 15, y: 19 })).toBe(false);
    });

    it('returns false for entity to the right of the area', () => {
      expect(ca.contains({ x: 21, y: 25 })).toBe(false);
    });

    it('returns false for entity below the area', () => {
      expect(ca.contains({ x: 15, y: 31 })).toBe(false);
    });

    it('returns false for null', () => {
      expect(ca.contains(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(ca.contains(undefined)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Chest
// ---------------------------------------------------------------------------

describe('Chest', () => {
  // ---------- setItems ----------

  describe('setItems', () => {
    it('stores the items array', () => {
      const chest = new Chest(1, 10, 20);
      const items = [Types.Entities.FLASK, Types.Entities.BURGER];
      chest.setItems(items);
      expect(chest.items).toEqual(items);
    });

    it('replaces previously stored items', () => {
      const chest = new Chest(1, 10, 20);
      chest.setItems([Types.Entities.FLASK]);
      chest.setItems([Types.Entities.SWORD2, Types.Entities.BURGER]);
      expect(chest.items).toEqual([Types.Entities.SWORD2, Types.Entities.BURGER]);
    });
  });

  // ---------- getRandomItem ----------

  describe('getRandomItem', () => {
    it('returns null when items list is empty', () => {
      const chest = new Chest(1, 10, 20);
      expect(chest.getRandomItem()).toBeNull();
    });

    it('returns an item kind that is present in the list', () => {
      const chest = new Chest(1, 10, 20);
      const items = [Types.Entities.FLASK, Types.Entities.BURGER, Types.Entities.SWORD2];
      chest.setItems(items);
      const result = chest.getRandomItem();
      expect(result).not.toBeNull();
      expect(items).toContain(result);
    });

    it('always returns the only item when list has one entry', () => {
      const chest = new Chest(1, 10, 20);
      chest.setItems([Types.Entities.FLASK]);
      for (let i = 0; i < 10; i++) {
        expect(chest.getRandomItem()).toBe(Types.Entities.FLASK);
      }
    });

    it('uses Utils.random so results are within the valid index range', () => {
      const randomSpy = vi.spyOn(Utils, 'random').mockReturnValue(1);
      const chest = new Chest(1, 10, 20);
      const items = [Types.Entities.FLASK, Types.Entities.SWORD2, Types.Entities.BURGER];
      chest.setItems(items);
      const result = chest.getRandomItem();
      expect(result).toBe(items[1]);
      randomSpy.mockRestore();
    });
  });

  // ---------- constructor defaults ----------

  describe('constructor', () => {
    it('defaults to Types.Entities.CHEST when no kind is supplied', () => {
      const chest = new Chest(1, 5, 10);
      expect(chest.kind).toBe(Types.Entities.CHEST);
    });

    it('accepts a custom kind', () => {
      const chest = new Chest(1, 5, 10, Types.Entities.CHEST_CRATE);
      expect(chest.kind).toBe(Types.Entities.CHEST_CRATE);
    });

    it('sets position', () => {
      const chest = new Chest(2, 15, 30);
      expect(chest.x).toBe(15);
      expect(chest.y).toBe(30);
    });

    it('initializes items as an empty array', () => {
      const chest = new Chest(1, 0, 0);
      expect(chest.items).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

describe('Item', () => {
  // ---------- Constructor ----------

  describe('constructor', () => {
    it('sets position and kind from arguments', () => {
      const item = new Item(1, Types.Entities.SWORD2, 10, 20);
      expect(item.id).toBe(1);
      expect(item.kind).toBe(Types.Entities.SWORD2);
      expect(item.x).toBe(10);
      expect(item.y).toBe(20);
    });

    it('leaves properties and displayName null when no generatedItem is passed', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      expect(item.properties).toBeNull();
      expect(item.displayName).toBeNull();
    });

    it('sets properties from generatedItem', () => {
      const generated = makeGeneratedItem();
      const item = new Item(1, Types.Entities.SWORD2, 0, 0, generated);
      expect(item.properties).toEqual(generated.properties);
    });

    it('sets displayName from generatedItem', () => {
      const generated = makeGeneratedItem({ displayName: 'Legendary Blade' });
      const item = new Item(1, Types.Entities.SWORD2, 0, 0, generated);
      expect(item.displayName).toBe('Legendary Blade');
    });

    it('initializes isStatic to false', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      expect(item.isStatic).toBe(false);
    });

    it('initializes isFromChest to false', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      expect(item.isFromChest).toBe(false);
    });

    it('initializes blinkTimeout and despawnTimeout to null', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      expect(item.blinkTimeout).toBeNull();
      expect(item.despawnTimeout).toBeNull();
    });

    it('converts string id to number', () => {
      const item = new Item('42', Types.Entities.FLASK, 0, 0);
      expect(item.id).toBe(42);
    });
  });

  // ---------- getState ----------

  describe('getState', () => {
    it('returns base state as first four elements [id, kind, x, y]', () => {
      const item = new Item(5, Types.Entities.SWORD2, 11, 22);
      const state = item.getState();
      expect(state[0]).toBe(5);
      expect(state[1]).toBe(Types.Entities.SWORD2);
      expect(state[2]).toBe(11);
      expect(state[3]).toBe(22);
    });

    it('returns null as the 5th element when no properties are set', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const state = item.getState();
      expect(state).toHaveLength(5);
      expect(state[4]).toBeNull();
    });

    it('returns serialized properties as the 5th element when properties exist', () => {
      const generated = makeGeneratedItem();
      const item = new Item(1, Types.Entities.SWORD2, 0, 0, generated);
      const state = item.getState();
      expect(state).toHaveLength(5);
      const serialized = state[4] as Record<string, unknown>;
      expect(serialized).not.toBeNull();
      // serializeProperties maps rarity → 'r', level → 'l', category → 'c'
      expect(serialized.r).toBe(Rarity.COMMON);
      expect(serialized.l).toBe(1);
      expect(serialized.c).toBe('weapon');
    });

    it('includes damage stats in serialized properties for weapons', () => {
      const generated = makeGeneratedItem();
      const item = new Item(1, Types.Entities.SWORD2, 0, 0, generated);
      const state = item.getState();
      const serialized = state[4] as Record<string, unknown>;
      expect(serialized.dMin).toBe(10);
      expect(serialized.dMax).toBe(20);
    });
  });

  // ---------- handleDespawn ----------

  describe('handleDespawn', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('sets blinkTimeout after beforeBlinkDelay ms', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const blinkCallback = vi.fn();
      const despawnCallback = vi.fn();

      item.handleDespawn({
        blinkCallback,
        despawnCallback,
        blinkingDuration: 2000,
        beforeBlinkDelay: 1000,
      });

      expect(item.blinkTimeout).not.toBeNull();
      expect(blinkCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(blinkCallback).toHaveBeenCalledTimes(1);
    });

    it('sets despawnTimeout and calls despawnCallback after blinkingDuration', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const blinkCallback = vi.fn();
      const despawnCallback = vi.fn();

      item.handleDespawn({
        blinkCallback,
        despawnCallback,
        blinkingDuration: 500,
        beforeBlinkDelay: 300,
      });

      vi.advanceTimersByTime(300); // triggers blink
      expect(item.despawnTimeout).not.toBeNull();
      expect(despawnCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500); // triggers despawn
      expect(despawnCallback).toHaveBeenCalledTimes(1);
    });

    it('does not call callbacks before the delays elapse', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const blinkCallback = vi.fn();
      const despawnCallback = vi.fn();

      item.handleDespawn({
        blinkCallback,
        despawnCallback,
        blinkingDuration: 2000,
        beforeBlinkDelay: 1000,
      });

      vi.advanceTimersByTime(500);
      expect(blinkCallback).not.toHaveBeenCalled();
      expect(despawnCallback).not.toHaveBeenCalled();
    });
  });

  // ---------- destroy ----------

  describe('destroy', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('clears blinkTimeout', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const blinkCallback = vi.fn();
      const despawnCallback = vi.fn();

      item.handleDespawn({
        blinkCallback,
        despawnCallback,
        blinkingDuration: 2000,
        beforeBlinkDelay: 1000,
      });

      item.destroy();
      vi.advanceTimersByTime(1000);
      // blink should NOT fire because the timeout was cleared.
      expect(blinkCallback).not.toHaveBeenCalled();
    });

    it('clears despawnTimeout when set', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const despawnCallback = vi.fn();

      item.handleDespawn({
        blinkCallback: vi.fn(),
        despawnCallback,
        blinkingDuration: 500,
        beforeBlinkDelay: 100,
      });

      // Advance past blink delay so despawnTimeout is set.
      vi.advanceTimersByTime(100);
      item.destroy();
      vi.advanceTimersByTime(500);
      expect(despawnCallback).not.toHaveBeenCalled();
    });

    it('does not throw when no timeouts are set', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      expect(() => item.destroy()).not.toThrow();
    });

    it('does NOT schedule respawn for non-static items', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const respawnCallback = vi.fn();
      item.onRespawn(respawnCallback);
      item.isStatic = false;
      item.destroy();
      vi.advanceTimersByTime(60000);
      expect(respawnCallback).not.toHaveBeenCalled();
    });

    it('schedules respawn after 30 seconds for static items', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const respawnCallback = vi.fn();
      item.onRespawn(respawnCallback);
      item.isStatic = true;
      item.destroy();

      vi.advanceTimersByTime(29999);
      expect(respawnCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(respawnCallback).toHaveBeenCalledTimes(1);
    });
  });

  // ---------- scheduleRespawn ----------

  describe('scheduleRespawn', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls respawnCallback after the given delay', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const cb = vi.fn();
      item.onRespawn(cb);
      item.scheduleRespawn(1000);
      vi.advanceTimersByTime(1000);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not call respawnCallback before the delay', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const cb = vi.fn();
      item.onRespawn(cb);
      item.scheduleRespawn(1000);
      vi.advanceTimersByTime(999);
      expect(cb).not.toHaveBeenCalled();
    });

    it('does not throw when respawnCallback is null', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      item.scheduleRespawn(100);
      expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    });
  });

  // ---------- onRespawn ----------

  describe('onRespawn', () => {
    it('registers the respawn callback', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const cb = vi.fn();
      item.onRespawn(cb);
      expect(item.respawnCallback).toBe(cb);
    });

    it('replaces a previously registered callback', () => {
      const item = new Item(1, Types.Entities.FLASK, 0, 0);
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      item.onRespawn(cb1);
      item.onRespawn(cb2);
      expect(item.respawnCallback).toBe(cb2);
    });
  });
});
