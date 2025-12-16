import * as fs from 'fs';
import * as _ from 'lodash';
import {Checkpoint} from './checkpoint';
import {Utils} from './utils';

interface Position {
  x: number;
  y: number;
}

export class Map {
  isLoaded = false;
  width: number = 0;
  height: number = 0;
  collisions: number[] = [];
  mobAreas: any[] = [];
  chestAreas: any[] = [];
  staticChests: any[] = [];
  staticEntities: Record<string, any> = {};
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
        console.error(filepath + ' doesnt exist.');
        return;
      }

      fs.readFile(filepath, function (err, file) {
        var json = JSON.parse(file.toString());

        self.initMap(json);
      });
    });
  }

  initMap(map: any) {
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
          if (_.include(this.collisions, tileIndex)) {
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
    _.each(this.connectedGroups[id], function (position: Position) {
      // don't add a connected group if it's already part of the surrounding ones.
      if (!_.some(list, function (groupPos: Position) {
          return equalPositions(groupPos, position);
        })) {
        list.push(position);
      }
    });

    return _.reject(list, function (p: Position) {
      return p.x < 0 || p.y < 0 || p.x >= self.groupWidth || p.y >= self.groupHeight;
    });
  }

  forEachAdjacentGroup(groupId: string, callback: (groupId: string) => void) {
    if (groupId) {
      _.each(this.getAdjacentGroupPositions(groupId), function (p: Position) {
        callback(p.x + '-' + p.y);
      });
    }
  }

  initConnectedGroups(doors: any[]) {
    var self = this;

    this.connectedGroups = {};
    _.each(doors, function (door: any) {
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

  initCheckpoints(cpList: any[]) {
    var self = this;

    this.checkpoints = {};
    this.startingAreas = [];

    _.each(cpList, function (cp: any) {
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
    var nbAreas = _.size(this.startingAreas);
    var i = Utils.randomInt(0, nbAreas - 1);
    var area = this.startingAreas[i];

    return area.getRandomPosition();
  }
}

var pos = function (x: number, y: number): Position {
  return {x: x, y: y};
};

var equalPositions = function (pos1: Position, pos2: Position) {
  return pos1.x === pos2.x && pos1.y === pos2.y;
};
