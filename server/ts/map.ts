import * as fs from 'fs/promises';
import {Checkpoint} from './checkpoint';
import {Utils} from './utils';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('Map');

interface Position {
  x: number;
  y: number;
}

// Map data interfaces from JSON
interface MobAreaData {
  id: number;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nb?: number;
}

interface ChestAreaData {
  x: number;
  y: number;
  w: number;
  h: number;
  i?: number[];
  tx?: number;
  ty?: number;
}

interface StaticChestData {
  x: number;
  y: number;
  i?: number[];
}

interface DoorData {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

interface CheckpointData {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  s?: number; // starting area flag
}

interface MapData {
  width: number;
  height: number;
  collisions: number[];
  roamingAreas: MobAreaData[];
  chestAreas: ChestAreaData[];
  staticChests: StaticChestData[];
  staticEntities: Record<string, string>; // Entity name strings e.g. "rat", "skeleton"
  doors: DoorData[];
  checkpoints: CheckpointData[];
}

export class Map {
  isLoaded = false;
  width: number = 0;
  height: number = 0;
  collisions: number[] = [];
  mobAreas: MobAreaData[] = [];
  chestAreas: ChestAreaData[] = [];
  staticChests: StaticChestData[] = [];
  staticEntities: Record<string, string> = {}; // Entity name strings e.g. "rat", "skeleton"
  zoneWidth: number = 0;
  zoneHeight: number = 0;
  groupWidth: number = 0;
  groupHeight: number = 0;
  grid: number[][] = [];
  ready_func: (() => void) | null = null;
  connectedGroups: Record<string, Position[]> = {};
  checkpoints: Record<number, Checkpoint> = {};
  startingAreas: Checkpoint[] = [];

  constructor(filepath: string) {
    (async () => {
      try {
        const file = await fs.readFile(filepath);
        const json = JSON.parse(file.toString());
        this.initMap(json);
      } catch (err) {
        log.error({ filepath, err }, 'Failed to load map file');
        throw new Error(`Failed to load map: ${filepath}`);
      }
    })();
  }

  initMap(map: MapData) {
    this.width = map.width;
    this.height = map.height;
    this.collisions = map.collisions;
    this.mobAreas = map.roamingAreas;
    this.chestAreas = map.chestAreas;
    this.staticChests = map.staticChests;
    this.staticEntities = map.staticEntities;
    this.isLoaded = true;

    // zone groups
    this.zoneWidth = 28;
    this.zoneHeight = 12;
    this.groupWidth = Math.floor(this.width / this.zoneWidth);
    this.groupHeight = Math.floor(this.height / this.zoneHeight);

    this.initConnectedGroups(map.doors);
    this.initCheckpoints(map.checkpoints);

    if (this.ready_func) {
      this.ready_func();
    }
  }

  ready(f: () => void) {
    this.ready_func = f;
  }

  tileIndexToGridPosition(tileNum: number) {
    let x = 0,
      y = 0;

    const getX = (num: number, w: number) => {
      if (num == 0) {
        return 0;
      }
      return (num % w == 0) ? w - 1 : (num % w) - 1;
    }

    tileNum -= 1;
    x = getX(tileNum + 1, this.width);
    y = Math.floor(tileNum / this.width);

    return {x: x, y: y};
  }

  GridPositionToTileIndex(x: number, y: number) {
    return (y * this.width) + x + 1;
  }

  generateCollisionGrid() {
    this.grid = [];

    if (this.isLoaded) {
      const collisionSet = new Set(this.collisions);
      let tileIndex = 0;
      for (let j, i = 0; i < this.height; i++) {
        this.grid[i] = [];
        for (j = 0; j < this.width; j++) {
          this.grid[i][j] = collisionSet.has(tileIndex) ? 1 : 0;
          tileIndex += 1;
        }
      }
    }
  }

  isOutOfBounds(x: number, y: number) {
    return x <= 0 || x >= this.width || y <= 0 || y >= this.height;
  }

  isColliding(x: number, y: number) {
    if (this.isOutOfBounds(x, y)) {
      return true;
    }
    return this.grid[y][x] === 1;
  }

  GroupIdToGroupPosition(id: string): Position {
    const posArray = id.split('-');

    return pos(parseInt(posArray[0]), parseInt(posArray[1]));
  }

  forEachGroup(callback: (groupId: string) => void) {
    const width = this.groupWidth,
      height = this.groupHeight;

    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        callback(x + '-' + y);
      }
    }
  }

  getGroupIdFromPosition(x: number, y: number) {
    const w = this.zoneWidth,
      h = this.zoneHeight,
      gx = Math.floor((x - 1) / w),
      gy = Math.floor((y - 1) / h);

    return gx + '-' + gy;
  }

  getAdjacentGroupPositions(id: string) {
    const position = this.GroupIdToGroupPosition(id),
      x = position.x,
      y = position.y,
      // surrounding groups
      list = [pos(x - 1, y - 1), pos(x, y - 1), pos(x + 1, y - 1),
        pos(x - 1, y), pos(x, y), pos(x + 1, y),
        pos(x - 1, y + 1), pos(x, y + 1), pos(x + 1, y + 1)];

    // groups connected via doors
    if (this.connectedGroups[id]) {
      this.connectedGroups[id].forEach((position: Position) => {
        // don't add a connected group if it's already part of the surrounding ones.
        if (!list.some((groupPos: Position) => equalPositions(groupPos, position))) {
          list.push(position);
        }
      });
    }

    return list.filter((p: Position) => p.x >= 0 && p.y >= 0 && p.x < this.groupWidth && p.y < this.groupHeight);
  }

  forEachAdjacentGroup(groupId: string, callback: (groupId: string) => void) {
    if (groupId) {
      this.getAdjacentGroupPositions(groupId).forEach((p: Position) => {
        callback(p.x + '-' + p.y);
      });
    }
  }

  initConnectedGroups(doors: DoorData[]) {
    this.connectedGroups = {};
    doors.forEach((door: DoorData) => {
      const groupId = this.getGroupIdFromPosition(door.x, door.y),
        connectedGroupId = this.getGroupIdFromPosition(door.tx, door.ty),
        connectedPosition = this.GroupIdToGroupPosition(connectedGroupId);

      if (groupId in this.connectedGroups) {
        this.connectedGroups[groupId].push(connectedPosition);
      } else {
        this.connectedGroups[groupId] = [connectedPosition];
      }
    });
  }

  initCheckpoints(cpList: CheckpointData[]) {
    this.checkpoints = {};
    this.startingAreas = [];

    cpList.forEach((cp: CheckpointData) => {
      const checkpoint = new Checkpoint(cp.id, cp.x, cp.y, cp.w, cp.h);
      this.checkpoints[checkpoint.id] = checkpoint;
      if (cp.s === 1) {
        this.startingAreas.push(checkpoint);
      }
    });
  }

  getCheckpoint(id: number) {
    return this.checkpoints[id];
  }

  getRandomStartingPosition() {
    const nbAreas = this.startingAreas.length;
    if (nbAreas === 0) {
      return { x: 0, y: 0 };
    }
    const i = Utils.randomInt(0, nbAreas - 1);
    const area = this.startingAreas[i];

    return area.getRandomPosition();
  }

  /**
   * Get a random position from non-starting checkpoints (for AI players)
   * Falls back to starting position if no other checkpoints exist
   */
  getRandomNonStartingPosition() {
    const nonStarting = Object.values(this.checkpoints).filter(
      (cp: Checkpoint) => !this.startingAreas.includes(cp)
    );
    if (nonStarting.length === 0) {
      return this.getRandomStartingPosition();
    }
    const i = Utils.randomInt(0, nonStarting.length - 1);
    return nonStarting[i].getRandomPosition();
  }
}

const pos = (x: number, y: number): Position => {
  return {x: x, y: y};
};

const equalPositions = (pos1: Position, pos2: Position) => {
  return pos1.x === pos2.x && pos1.y === pos2.y;
};
