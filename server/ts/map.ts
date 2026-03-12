import * as fs from 'fs';
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
    var self = this;


    fs.exists(filepath, function (exists) {
      if (!exists) {
        log.error({ filepath }, 'Map file does not exist');
        return;
      }

      fs.readFile(filepath, function (err, file) {
        var json = JSON.parse(file.toString());

        self.initMap(json);
      });
    });
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
    var x = 0,
      y = 0;

    var getX = function (num: number, w: number) {
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
      var tileIndex = 0;
      for (var j, i = 0; i < this.height; i++) {
        this.grid[i] = [];
        for (j = 0; j < this.width; j++) {
          if (this.collisions.includes(tileIndex)) {
            this.grid[i][j] = 1;
          } else {
            this.grid[i][j] = 0;
          }
          tileIndex += 1;
        }
      }
      //console.info("Collision grid generated.");
    }
  }

  isOutOfBounds(x: number, y: number) {
    return x <= 0 || x >= this.width || y <= 0 || y >= this.height;
  }

  isColliding(x: number, y: number) {
    if (this.isOutOfBounds(x, y)) {
      return false;
    }
    return this.grid[y][x] === 1;
  }

  GroupIdToGroupPosition(id: string): Position {
    var posArray = id.split('-');

    return pos(parseInt(posArray[0]), parseInt(posArray[1]));
  }

  forEachGroup(callback: (groupId: string) => void) {
    var width = this.groupWidth,
      height = this.groupHeight;

    for (var x = 0; x < width; x += 1) {
      for (var y = 0; y < height; y += 1) {
        callback(x + '-' + y);
      }
    }
  }

  getGroupIdFromPosition(x: number, y: number) {
    var w = this.zoneWidth,
      h = this.zoneHeight,
      gx = Math.floor((x - 1) / w),
      gy = Math.floor((y - 1) / h);

    return gx + '-' + gy;
  }

  getAdjacentGroupPositions(id: string) {
    var self = this,
      position = this.GroupIdToGroupPosition(id),
      x = position.x,
      y = position.y,
      // surrounding groups
      list = [pos(x - 1, y - 1), pos(x, y - 1), pos(x + 1, y - 1),
        pos(x - 1, y), pos(x, y), pos(x + 1, y),
        pos(x - 1, y + 1), pos(x, y + 1), pos(x + 1, y + 1)];

    // groups connected via doors
    if (this.connectedGroups[id]) {
      this.connectedGroups[id].forEach(function (position: Position) {
        // don't add a connected group if it's already part of the surrounding ones.
        if (!list.some(function (groupPos: Position) {
            return equalPositions(groupPos, position);
          })) {
          list.push(position);
        }
      });
    }

    return list.filter(function (p: Position) {
      return p.x >= 0 && p.y >= 0 && p.x < self.groupWidth && p.y < self.groupHeight;
    });
  }

  forEachAdjacentGroup(groupId: string, callback: (groupId: string) => void) {
    if (groupId) {
      this.getAdjacentGroupPositions(groupId).forEach(function (p: Position) {
        callback(p.x + '-' + p.y);
      });
    }
  }

  initConnectedGroups(doors: DoorData[]) {
    var self = this;

    this.connectedGroups = {};
    doors.forEach(function (door: DoorData) {
      var groupId = self.getGroupIdFromPosition(door.x, door.y),
        connectedGroupId = self.getGroupIdFromPosition(door.tx, door.ty),
        connectedPosition = self.GroupIdToGroupPosition(connectedGroupId);

      if (groupId in self.connectedGroups) {
        self.connectedGroups[groupId].push(connectedPosition);
      } else {
        self.connectedGroups[groupId] = [connectedPosition];
      }
    });
  }

  initCheckpoints(cpList: CheckpointData[]) {
    var self = this;

    this.checkpoints = {};
    this.startingAreas = [];

    cpList.forEach(function (cp: CheckpointData) {
      var checkpoint = new Checkpoint(cp.id, cp.x, cp.y, cp.w, cp.h);
      self.checkpoints[checkpoint.id] = checkpoint;
      if (cp.s === 1) {
        self.startingAreas.push(checkpoint);
      }
    });
  }

  getCheckpoint(id: number) {
    return this.checkpoints[id];
  }

  getRandomStartingPosition() {
    var nbAreas = this.startingAreas.length;
    var i = Utils.randomInt(0, nbAreas - 1);
    var area = this.startingAreas[i];

    return area.getRandomPosition();
  }

  /**
   * Get a random position from non-starting checkpoints (for AI players)
   * Falls back to starting position if no other checkpoints exist
   */
  getRandomNonStartingPosition() {
    var nonStarting = Object.values(this.checkpoints).filter(
      (cp: Checkpoint) => !this.startingAreas.includes(cp)
    );
    if (nonStarting.length === 0) {
      return this.getRandomStartingPosition();
    }
    var i = Utils.randomInt(0, nonStarting.length - 1);
    return nonStarting[i].getRandomPosition();
  }
}

var pos = function (x: number, y: number): Position {
  return {x: x, y: y};
};

var equalPositions = function (pos1: Position, pos2: Position) {
  return pos1.x === pos2.x && pos1.y === pos2.y;
};
