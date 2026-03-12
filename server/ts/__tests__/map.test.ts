/**
 * Tests for Map class
 * Covers: tileIndexToGridPosition, GridPositionToTileIndex, isOutOfBounds,
 *   isColliding, generateCollisionGrid, getGroupIdFromPosition,
 *   getAdjacentGroupPositions, getRandomStartingPosition,
 *   getRandomNonStartingPosition, initCheckpoints, initConnectedGroups
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before importing Map
vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

// Mock fs/promises so the constructor's async IIFE never settles (no unhandled
// rejection noise from the throw in the catch block).
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn().mockReturnValue(new Promise(() => {})),
  },
  readFile: vi.fn().mockReturnValue(new Promise(() => {})),
}));

// Mock Utils.randomInt so random-dependent tests are deterministic
vi.mock('../utils.js', () => ({
  Utils: {
    randomInt: vi.fn((min: number, _max: number) => min),
  },
}));

import { Map } from '../map';
import { Utils } from '../utils.js';

// ──────────────────────────────────────────────────────────────────────────────
// Test-data helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Minimal MapData that satisfies the MapData interface.
 * width=56, height=24 → groupWidth=2, groupHeight=2 (56/28=2, 24/12=2)
 */
function makeMapData(overrides: Partial<{
  width: number;
  height: number;
  collisions: number[];
  doors: Array<{ x: number; y: number; tx: number; ty: number }>;
  checkpoints: Array<{ id: number; x: number; y: number; w: number; h: number; s?: number }>;
}> = {}) {
  return {
    width: 56,
    height: 24,
    collisions: [],
    roamingAreas: [],
    chestAreas: [],
    staticChests: [],
    staticEntities: {},
    doors: [],
    checkpoints: [],
    ...overrides,
  };
}

/**
 * Create a Map and immediately call initMap() with provided data.
 * The constructor's async IIFE will eventually throw (mocked fs), but
 * initMap() is synchronous and sets all state immediately.
 */
function createMap(data = makeMapData()): Map {
  const m = new Map('__dummy__');
  m.initMap(data as any);
  return m;
}

// ──────────────────────────────────────────────────────────────────────────────
// tileIndexToGridPosition
// ──────────────────────────────────────────────────────────────────────────────

describe('tileIndexToGridPosition', () => {
  let map: Map;

  beforeEach(() => {
    // width=10, height=4 – easy mental-math grid
    map = createMap(makeMapData({ width: 10, height: 4 }));
  });

  it('converts tile 1 (first tile) to {x:0, y:0}', () => {
    expect(map.tileIndexToGridPosition(1)).toEqual({ x: 0, y: 0 });
  });

  it('converts tile at end of first row', () => {
    // tile 10 → tileNum-1=9, getX(10,10): 10%10==0 → w-1=9
    expect(map.tileIndexToGridPosition(10)).toEqual({ x: 9, y: 0 });
  });

  it('converts first tile of second row', () => {
    // tile 11 → tileNum-1=10, getX(11,10): 11%10=1 → 1-1=0; y=floor(10/10)=1
    expect(map.tileIndexToGridPosition(11)).toEqual({ x: 0, y: 1 });
  });

  it('converts a mid-row tile correctly', () => {
    // tile 15 → tileNum-1=14, getX(15,10): 15%10=5 → 5-1=4; y=floor(14/10)=1
    expect(map.tileIndexToGridPosition(15)).toEqual({ x: 4, y: 1 });
  });

  it('converts last tile of last row', () => {
    // width=10, height=4 → 40 tiles. tile 40 → tileNum-1=39
    // getX(40,10): 40%10==0 → w-1=9; y=floor(39/10)=3
    expect(map.tileIndexToGridPosition(40)).toEqual({ x: 9, y: 3 });
  });

  it('converts tile exactly on a row boundary (tile 20)', () => {
    // tile 20 → tileNum-1=19, getX(20,10): 20%10==0 → w-1=9; y=floor(19/10)=1
    expect(map.tileIndexToGridPosition(20)).toEqual({ x: 9, y: 1 });
  });

  it('handles width=56 (real-world zoneWidth multiple)', () => {
    const m = createMap(); // width=56
    // tile 1 → {x:0, y:0}
    expect(m.tileIndexToGridPosition(1)).toEqual({ x: 0, y: 0 });
    // tile 56 → end of row 0 → {x:55, y:0}
    expect(m.tileIndexToGridPosition(56)).toEqual({ x: 55, y: 0 });
    // tile 57 → start of row 1 → {x:0, y:1}
    expect(m.tileIndexToGridPosition(57)).toEqual({ x: 0, y: 1 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GridPositionToTileIndex
// ──────────────────────────────────────────────────────────────────────────────

describe('GridPositionToTileIndex', () => {
  let map: Map;

  beforeEach(() => {
    map = createMap(makeMapData({ width: 10, height: 4 }));
  });

  it('converts (0,0) to tile index 1', () => {
    expect(map.GridPositionToTileIndex(0, 0)).toBe(1);
  });

  it('converts (9,0) to tile index 10', () => {
    expect(map.GridPositionToTileIndex(9, 0)).toBe(10);
  });

  it('converts (0,1) to tile index 11', () => {
    expect(map.GridPositionToTileIndex(0, 1)).toBe(11);
  });

  it('converts (4,1) to tile index 15', () => {
    expect(map.GridPositionToTileIndex(4, 1)).toBe(15);
  });

  it('converts (9,3) (last tile) to tile index 40', () => {
    expect(map.GridPositionToTileIndex(9, 3)).toBe(40);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Round-trip: tileIndexToGridPosition ↔ GridPositionToTileIndex
// ──────────────────────────────────────────────────────────────────────────────

describe('tileIndex ↔ GridPosition round-trip', () => {
  let map: Map;

  beforeEach(() => {
    map = createMap(makeMapData({ width: 10, height: 4 }));
  });

  const tiles = [1, 5, 10, 11, 20, 25, 39, 40];

  tiles.forEach((tile) => {
    it(`round-trips tile ${tile}`, () => {
      const { x, y } = map.tileIndexToGridPosition(tile);
      expect(map.GridPositionToTileIndex(x, y)).toBe(tile);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// isOutOfBounds
// ──────────────────────────────────────────────────────────────────────────────

describe('isOutOfBounds', () => {
  // width=10, height=8  →  valid interior: x ∈ [1,9), y ∈ [1,7)
  let map: Map;

  beforeEach(() => {
    map = createMap(makeMapData({ width: 10, height: 8 }));
  });

  it('returns false for a clearly interior position', () => {
    expect(map.isOutOfBounds(5, 4)).toBe(false);
  });

  it('returns true when x === 0 (left border)', () => {
    expect(map.isOutOfBounds(0, 4)).toBe(true);
  });

  it('returns true when x === width (right border)', () => {
    expect(map.isOutOfBounds(10, 4)).toBe(true);
  });

  it('returns true when y === 0 (top border)', () => {
    expect(map.isOutOfBounds(5, 0)).toBe(true);
  });

  it('returns true when y === height (bottom border)', () => {
    expect(map.isOutOfBounds(5, 8)).toBe(true);
  });

  it('returns true when x < 0', () => {
    expect(map.isOutOfBounds(-1, 4)).toBe(true);
  });

  it('returns true when y < 0', () => {
    expect(map.isOutOfBounds(5, -1)).toBe(true);
  });

  it('returns false for x=1 (first valid column)', () => {
    expect(map.isOutOfBounds(1, 4)).toBe(false);
  });

  it('returns false for x=width-1 (last valid column)', () => {
    expect(map.isOutOfBounds(9, 4)).toBe(false);
  });

  it('returns false for y=1 (first valid row)', () => {
    expect(map.isOutOfBounds(5, 1)).toBe(false);
  });

  it('returns false for y=height-1 (last valid row)', () => {
    expect(map.isOutOfBounds(5, 7)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// generateCollisionGrid + isColliding
// ──────────────────────────────────────────────────────────────────────────────

describe('generateCollisionGrid', () => {
  it('builds a grid of the correct dimensions', () => {
    const map = createMap(makeMapData({ width: 6, height: 4, collisions: [] }));
    map.generateCollisionGrid();
    expect(map.grid).toHaveLength(4);
    map.grid.forEach((row) => expect(row).toHaveLength(6));
  });

  it('marks collision tiles as 1 and non-collision tiles as 0', () => {
    // width=4, height=2 → tiles are 0-indexed flat array:
    //   row0: indices 0,1,2,3  row1: indices 4,5,6,7
    // Mark tile-index 2 (row0, col2) and tile-index 5 (row1, col1) as collisions
    const map = createMap(makeMapData({ width: 4, height: 2, collisions: [2, 5] }));
    map.generateCollisionGrid();

    expect(map.grid[0][0]).toBe(0);
    expect(map.grid[0][1]).toBe(0);
    expect(map.grid[0][2]).toBe(1); // collision
    expect(map.grid[0][3]).toBe(0);
    expect(map.grid[1][0]).toBe(0);
    expect(map.grid[1][1]).toBe(1); // collision
    expect(map.grid[1][2]).toBe(0);
    expect(map.grid[1][3]).toBe(0);
  });

  it('produces an all-zero grid when collisions array is empty', () => {
    const map = createMap(makeMapData({ width: 3, height: 3, collisions: [] }));
    map.generateCollisionGrid();
    for (const row of map.grid) {
      for (const cell of row) {
        expect(cell).toBe(0);
      }
    }
  });

  it('produces an all-one grid when every tile is a collision', () => {
    const w = 3, h = 3;
    const collisions = Array.from({ length: w * h }, (_, i) => i);
    const map = createMap(makeMapData({ width: w, height: h, collisions }));
    map.generateCollisionGrid();
    for (const row of map.grid) {
      for (const cell of row) {
        expect(cell).toBe(1);
      }
    }
  });

  it('does not build grid when isLoaded is false', () => {
    const map = createMap(makeMapData({ width: 4, height: 4 }));
    map.isLoaded = false;
    map.grid = [];
    map.generateCollisionGrid();
    expect(map.grid).toHaveLength(0);
  });

  it('resets existing grid on each call', () => {
    const map = createMap(makeMapData({ width: 2, height: 2, collisions: [0] }));
    map.generateCollisionGrid();
    const first = map.grid[0][0];
    map.collisions = [];
    map.generateCollisionGrid();
    // Now 0 is no longer a collision
    expect(map.grid[0][0]).toBe(0);
    expect(first).toBe(1); // first call had it as 1
  });
});

describe('isColliding', () => {
  let map: Map;

  beforeEach(() => {
    // width=6, height=4; mark flat index 8 → row1, col2 as collision
    map = createMap(makeMapData({ width: 6, height: 4, collisions: [8] }));
    map.generateCollisionGrid();
  });

  it('returns false for an open interior tile', () => {
    expect(map.isColliding(1, 1)).toBe(false);
  });

  it('returns true for a collision tile', () => {
    // flat index 8 = row1 * 6 + col2
    expect(map.isColliding(2, 1)).toBe(true);
  });

  it('returns true when out of bounds (x=0)', () => {
    expect(map.isColliding(0, 2)).toBe(true);
  });

  it('returns true when out of bounds (x=width)', () => {
    expect(map.isColliding(6, 2)).toBe(true);
  });

  it('returns true when out of bounds (y=0)', () => {
    expect(map.isColliding(3, 0)).toBe(true);
  });

  it('returns true when out of bounds (y=height)', () => {
    expect(map.isColliding(3, 4)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getGroupIdFromPosition
// ──────────────────────────────────────────────────────────────────────────────

describe('getGroupIdFromPosition', () => {
  // width=56, height=24 → zoneWidth=28, zoneHeight=12
  // gx = floor((x-1)/28), gy = floor((y-1)/12)
  let map: Map;

  beforeEach(() => {
    map = createMap(); // default width=56, height=24
  });

  it('returns "0-0" for position (1,1) – top-left of first zone', () => {
    expect(map.getGroupIdFromPosition(1, 1)).toBe('0-0');
  });

  it('returns "0-0" for position (28,12) – last tile of zone (0,0)', () => {
    // gx=floor(27/28)=0, gy=floor(11/12)=0
    expect(map.getGroupIdFromPosition(28, 12)).toBe('0-0');
  });

  it('returns "1-0" for position (29,1) – first column of second x-zone', () => {
    // gx=floor(28/28)=1, gy=floor(0/12)=0
    expect(map.getGroupIdFromPosition(29, 1)).toBe('1-0');
  });

  it('returns "0-1" for position (1,13) – first row of second y-zone', () => {
    // gx=floor(0/28)=0, gy=floor(12/12)=1
    expect(map.getGroupIdFromPosition(1, 13)).toBe('0-1');
  });

  it('returns "1-1" for position (29,13) – second x and y zone', () => {
    expect(map.getGroupIdFromPosition(29, 13)).toBe('1-1');
  });

  it('returns "1-1" for position (56,24) – far corner', () => {
    // gx=floor(55/28)=1, gy=floor(23/12)=1
    expect(map.getGroupIdFromPosition(56, 24)).toBe('1-1');
  });

  it('produces correct gx with a wider map (3 zones wide)', () => {
    const m = createMap(makeMapData({ width: 84, height: 24 })); // 84/28=3 groups
    expect(m.getGroupIdFromPosition(57, 1)).toBe('2-0'); // floor(56/28)=2
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getAdjacentGroupPositions
// ──────────────────────────────────────────────────────────────────────────────

describe('getAdjacentGroupPositions', () => {
  // width=56, height=24 → groupWidth=2, groupHeight=2
  // Valid group positions: (0,0), (1,0), (0,1), (1,1)
  let map: Map;

  beforeEach(() => {
    map = createMap();
  });

  it('returns only in-bounds groups for corner "0-0"', () => {
    const groups = map.getAdjacentGroupPositions('0-0');
    // 3×3 surrounding "0-0" includes negative coords — must be filtered
    expect(groups.every((p) => p.x >= 0 && p.y >= 0)).toBe(true);
    expect(groups.every((p) => p.x < map.groupWidth && p.y < map.groupHeight)).toBe(true);
  });

  it('returns 4 positions for corner group "0-0" (2×2 map)', () => {
    // valid in 2×2: (0,0),(1,0),(0,1),(1,1) – all reachable from "0-0" adjacency
    const groups = map.getAdjacentGroupPositions('0-0');
    expect(groups).toHaveLength(4);
  });

  it('returns 4 positions for corner group "1-1" (2×2 map)', () => {
    const groups = map.getAdjacentGroupPositions('1-1');
    expect(groups).toHaveLength(4);
  });

  it('includes the center group itself', () => {
    const groups = map.getAdjacentGroupPositions('1-1');
    expect(groups.some((p) => p.x === 1 && p.y === 1)).toBe(true);
  });

  it('returns 9 positions for a center group in a large map', () => {
    // 3 zones wide, 3 zones tall → center group (1,1) has full 3×3 neighbourhood
    const m = createMap(makeMapData({ width: 84, height: 36 }));
    const groups = m.getAdjacentGroupPositions('1-1');
    expect(groups).toHaveLength(9);
  });

  it('filters out groups with negative x or y', () => {
    const groups = map.getAdjacentGroupPositions('0-0');
    expect(groups.some((p) => p.x < 0 || p.y < 0)).toBe(false);
  });

  it('filters out groups beyond groupWidth / groupHeight', () => {
    const groups = map.getAdjacentGroupPositions('1-1');
    expect(groups.some((p) => p.x >= map.groupWidth || p.y >= map.groupHeight)).toBe(false);
  });

  it('appends connected groups from doors (non-adjacent)', () => {
    // Add a door that connects group "0-0" to a far-away group "(1,1)"
    // by setting connectedGroups manually to avoid complex door math
    map.connectedGroups['0-0'] = [{ x: 1, y: 1 }];
    const groups = map.getAdjacentGroupPositions('0-0');
    expect(groups.some((p) => p.x === 1 && p.y === 1)).toBe(true);
  });

  it('does not duplicate a connected group that is already adjacent', () => {
    // "(1,0)" is already adjacent to "0-0"; adding it as a connected group
    // should not produce a duplicate entry
    map.connectedGroups['0-0'] = [{ x: 1, y: 0 }];
    const groups = map.getAdjacentGroupPositions('0-0');
    const count = groups.filter((p) => p.x === 1 && p.y === 0).length;
    expect(count).toBe(1);
  });

  it('returns no duplicates in any scenario', () => {
    map.connectedGroups['0-0'] = [{ x: 1, y: 1 }];
    const groups = map.getAdjacentGroupPositions('0-0');
    const uniqueKeys = new Set(groups.map((p) => `${p.x}-${p.y}`));
    expect(uniqueKeys.size).toBe(groups.length);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// initCheckpoints
// ──────────────────────────────────────────────────────────────────────────────

describe('initCheckpoints', () => {
  let map: Map;

  beforeEach(() => {
    map = createMap();
  });

  it('populates checkpoints by id', () => {
    map.initCheckpoints([
      { id: 1, x: 10, y: 5, w: 4, h: 4 },
      { id: 2, x: 20, y: 8, w: 3, h: 3 },
    ]);
    expect(map.checkpoints[1]).toBeDefined();
    expect(map.checkpoints[2]).toBeDefined();
    expect(map.checkpoints[1].x).toBe(10);
    expect(map.checkpoints[2].x).toBe(20);
  });

  it('does not add non-starting checkpoints to startingAreas', () => {
    map.initCheckpoints([{ id: 1, x: 10, y: 5, w: 4, h: 4 }]);
    expect(map.startingAreas).toHaveLength(0);
  });

  it('adds checkpoints with s===1 to startingAreas', () => {
    map.initCheckpoints([
      { id: 1, x: 10, y: 5, w: 4, h: 4, s: 1 },
      { id: 2, x: 20, y: 8, w: 3, h: 3 },
    ]);
    expect(map.startingAreas).toHaveLength(1);
    expect(map.startingAreas[0].id).toBe(1);
  });

  it('adds multiple starting areas when multiple checkpoints have s===1', () => {
    map.initCheckpoints([
      { id: 1, x: 10, y: 5, w: 4, h: 4, s: 1 },
      { id: 2, x: 20, y: 8, w: 3, h: 3, s: 1 },
    ]);
    expect(map.startingAreas).toHaveLength(2);
  });

  it('clears previous checkpoints on re-initialisation', () => {
    map.initCheckpoints([{ id: 1, x: 0, y: 0, w: 1, h: 1 }]);
    map.initCheckpoints([{ id: 2, x: 5, y: 5, w: 2, h: 2 }]);
    expect(map.checkpoints[1]).toBeUndefined();
    expect(map.checkpoints[2]).toBeDefined();
  });

  it('clears previous startingAreas on re-initialisation', () => {
    map.initCheckpoints([{ id: 1, x: 0, y: 0, w: 1, h: 1, s: 1 }]);
    map.initCheckpoints([{ id: 2, x: 5, y: 5, w: 2, h: 2 }]);
    expect(map.startingAreas).toHaveLength(0);
  });

  it('handles an empty checkpoint list', () => {
    map.initCheckpoints([]);
    expect(Object.keys(map.checkpoints)).toHaveLength(0);
    expect(map.startingAreas).toHaveLength(0);
  });

  it('stores the correct Checkpoint dimensions', () => {
    map.initCheckpoints([{ id: 7, x: 3, y: 4, w: 8, h: 6 }]);
    const cp = map.checkpoints[7];
    expect(cp.width).toBe(8);
    expect(cp.height).toBe(6);
    expect(cp.y).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// initConnectedGroups
// ──────────────────────────────────────────────────────────────────────────────

describe('initConnectedGroups', () => {
  // width=56, height=24 → zoneWidth=28, zoneHeight=12
  // door at (1,1) → group "0-0", door.tx/ty at (29,1) → group "1-0"
  let map: Map;

  beforeEach(() => {
    map = createMap();
  });

  it('creates a connected group entry for a door', () => {
    map.initConnectedGroups([{ x: 1, y: 1, tx: 29, ty: 1 }]);
    expect(map.connectedGroups['0-0']).toBeDefined();
  });

  it('stores the target group position correctly', () => {
    map.initConnectedGroups([{ x: 1, y: 1, tx: 29, ty: 1 }]);
    expect(map.connectedGroups['0-0']).toContainEqual({ x: 1, y: 0 });
  });

  it('accumulates multiple doors from the same source group', () => {
    map.initConnectedGroups([
      { x: 1, y: 1, tx: 29, ty: 1 },   // 0-0 → 1-0
      { x: 1, y: 1, tx: 29, ty: 13 },  // 0-0 → 1-1
    ]);
    expect(map.connectedGroups['0-0']).toHaveLength(2);
  });

  it('handles doors from different source groups independently', () => {
    map.initConnectedGroups([
      { x: 1, y: 1, tx: 29, ty: 1 },   // 0-0 → 1-0
      { x: 29, y: 1, tx: 1, ty: 13 },  // 1-0 → 0-1
    ]);
    expect(map.connectedGroups['0-0']).toContainEqual({ x: 1, y: 0 });
    expect(map.connectedGroups['1-0']).toContainEqual({ x: 0, y: 1 });
  });

  it('clears previous connected groups on re-initialisation', () => {
    map.initConnectedGroups([{ x: 1, y: 1, tx: 29, ty: 1 }]);
    map.initConnectedGroups([]);
    expect(Object.keys(map.connectedGroups)).toHaveLength(0);
  });

  it('handles an empty doors list without error', () => {
    expect(() => map.initConnectedGroups([])).not.toThrow();
    expect(Object.keys(map.connectedGroups)).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getRandomStartingPosition
// ──────────────────────────────────────────────────────────────────────────────

describe('getRandomStartingPosition', () => {
  let map: Map;

  beforeEach(() => {
    vi.mocked(Utils.randomInt).mockImplementation((min: number, _max: number) => min);
    map = createMap();
  });

  it('returns {x:0, y:0} when startingAreas is empty', () => {
    map.startingAreas = [];
    expect(map.getRandomStartingPosition()).toEqual({ x: 0, y: 0 });
  });

  it('returns a position from the single starting area', () => {
    map.initCheckpoints([{ id: 1, x: 10, y: 5, w: 4, h: 4, s: 1 }]);
    const pos = map.getRandomStartingPosition();
    // Utils.randomInt mocked to return min → offset 0 from (10,5)
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(5);
  });

  it('picks from one of multiple starting areas', () => {
    map.initCheckpoints([
      { id: 1, x: 10, y: 5, w: 1, h: 1, s: 1 },
      { id: 2, x: 20, y: 8, w: 1, h: 1, s: 1 },
    ]);
    // randomInt always returns min (0), so area index 0 → checkpoint id=1
    const pos = map.getRandomStartingPosition();
    expect(pos).toEqual({ x: 10, y: 5 });
  });

  it('returns a position within checkpoint bounds', () => {
    // Use real randomInt behaviour: any result must satisfy x in [cx, cx+w-1]
    vi.mocked(Utils.randomInt).mockImplementation(
      (min: number, max: number) => Math.floor((min + max) / 2),
    );
    map.initCheckpoints([{ id: 1, x: 10, y: 5, w: 4, h: 4, s: 1 }]);
    const pos = map.getRandomStartingPosition();
    expect(pos.x).toBeGreaterThanOrEqual(10);
    expect(pos.x).toBeLessThanOrEqual(13);
    expect(pos.y).toBeGreaterThanOrEqual(5);
    expect(pos.y).toBeLessThanOrEqual(8);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getRandomNonStartingPosition
// ──────────────────────────────────────────────────────────────────────────────

describe('getRandomNonStartingPosition', () => {
  let map: Map;

  beforeEach(() => {
    vi.mocked(Utils.randomInt).mockImplementation((min: number, _max: number) => min);
    map = createMap();
  });

  it('falls back to starting position when no non-starting checkpoints exist', () => {
    map.initCheckpoints([{ id: 1, x: 10, y: 5, w: 1, h: 1, s: 1 }]);
    // Only starting areas → fall back to getRandomStartingPosition
    const pos = map.getRandomNonStartingPosition();
    expect(pos).toEqual({ x: 10, y: 5 });
  });

  it('returns {x:0, y:0} when no checkpoints exist at all', () => {
    map.initCheckpoints([]);
    const pos = map.getRandomNonStartingPosition();
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('returns a position from a non-starting checkpoint', () => {
    map.initCheckpoints([
      { id: 1, x: 10, y: 5, w: 1, h: 1, s: 1 }, // starting
      { id: 2, x: 30, y: 15, w: 1, h: 1 },       // non-starting
    ]);
    const pos = map.getRandomNonStartingPosition();
    expect(pos).toEqual({ x: 30, y: 15 });
  });

  it('never returns a starting-area checkpoint when non-starting ones exist', () => {
    map.initCheckpoints([
      { id: 1, x: 10, y: 5, w: 1, h: 1, s: 1 },
      { id: 2, x: 30, y: 15, w: 1, h: 1 },
      { id: 3, x: 40, y: 18, w: 1, h: 1 },
    ]);
    // randomInt always returns min index (0 of non-starting list) → checkpoint id=2
    const pos = map.getRandomNonStartingPosition();
    expect(pos).toEqual({ x: 30, y: 15 });
  });

  it('picks from multiple non-starting checkpoints via randomInt', () => {
    map.initCheckpoints([
      { id: 1, x: 10, y: 5, w: 1, h: 1, s: 1 },
      { id: 2, x: 30, y: 15, w: 1, h: 1 },
      { id: 3, x: 40, y: 18, w: 1, h: 1 },
    ]);
    // Force selection of index 1 (second non-starting → id=3)
    vi.mocked(Utils.randomInt).mockReturnValueOnce(1).mockReturnValue(0);
    const pos = map.getRandomNonStartingPosition();
    expect(pos).toEqual({ x: 40, y: 18 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// initMap (integration)
// ──────────────────────────────────────────────────────────────────────────────

describe('initMap', () => {
  it('sets width and height from map data', () => {
    const map = createMap(makeMapData({ width: 112, height: 48 }));
    expect(map.width).toBe(112);
    expect(map.height).toBe(48);
  });

  it('sets isLoaded to true', () => {
    const map = createMap();
    expect(map.isLoaded).toBe(true);
  });

  it('sets zoneWidth to 28 and zoneHeight to 12 regardless of map size', () => {
    const map = createMap(makeMapData({ width: 200, height: 100 }));
    expect(map.zoneWidth).toBe(28);
    expect(map.zoneHeight).toBe(12);
  });

  it('computes groupWidth as floor(width / 28)', () => {
    const map = createMap(makeMapData({ width: 84, height: 24 }));
    expect(map.groupWidth).toBe(3); // 84/28 = 3
  });

  it('computes groupHeight as floor(height / 12)', () => {
    const map = createMap(makeMapData({ width: 56, height: 36 }));
    expect(map.groupHeight).toBe(3); // 36/12 = 3
  });

  it('calls ready_func when set', () => {
    const map = new Map('__dummy__');
    const readyFn = vi.fn();
    map.ready(readyFn);
    map.initMap(makeMapData() as any);
    expect(readyFn).toHaveBeenCalledOnce();
  });

  it('does not throw when ready_func is null', () => {
    const map = new Map('__dummy__');
    map.ready_func = null;
    expect(() => map.initMap(makeMapData() as any)).not.toThrow();
  });

  it('copies mobAreas, chestAreas, staticChests, and staticEntities', () => {
    const data = makeMapData({}) as any;
    data.roamingAreas = [{ id: 1, type: 'rat', x: 5, y: 5, width: 3, height: 3 }];
    data.chestAreas = [{ x: 1, y: 1, w: 2, h: 2 }];
    data.staticChests = [{ x: 3, y: 3 }];
    data.staticEntities = { '5-5': 'npc1' };
    const map = createMap(data);
    expect(map.mobAreas).toHaveLength(1);
    expect(map.chestAreas).toHaveLength(1);
    expect(map.staticChests).toHaveLength(1);
    expect(map.staticEntities['5-5']).toBe('npc1');
  });
});
