import {Area} from './area';
import {Mob} from './mob';
import {Types} from '../../shared/ts/gametypes';
import {Utils} from './utils';

// Extended World interface for MobArea's needs
interface MobAreaWorld {
  isValidPosition(x: number, y: number): boolean;
  addMob(mob: Mob): void;
  onMobMoveCallback: (mob: Mob) => void;
}

export class MobArea extends Area {
  nb: number;
  kind: string;
  respawns: unknown[] = [];
  declare world: MobAreaWorld; // Override parent type

  constructor(id: number, nb: number, kind: string, x: number, y: number, width: number, height: number, world: MobAreaWorld) {
    super(id, x, y, width, height, world);
    this.nb = nb;
    this.kind = kind;
    this.setNumberOfEntities(this.nb);

    this.initRoaming();
  }

  spawnMobs() {
    for (var i = 0; i < this.nb; i += 1) {
      this.addToArea(this._createMobInsideArea());
    }
  }

  _createMobInsideArea() {
    var k = Types.getKindFromString(this.kind),
      pos = this._getRandomPositionInsideArea(),
      mob = new Mob('1' + this.id + '' + k + '' + this.entities.length, k, pos.x, pos.y);

    mob.onMove(this.world.onMobMoveCallback.bind(this.world));

    return mob;
  }

  respawnMob(mob: Mob, delay: number) {
    var self = this;

    this.removeFromArea(mob);

    setTimeout(function () {
      var pos = self._getRandomPositionInsideArea();

      mob.x = pos.x;
      mob.y = pos.y;
      mob.spawningX = pos.x;
      mob.spawningY = pos.y;
      mob.isDead = false;
      mob.updateHitPoints();
      // Ensure clean state on respawn - no target or attackers
      mob.clearTarget();
      mob.attackers = {};
      self.addToArea(mob);
      self.world.addMob(mob);
    }, delay);
  }

  addToArea(entity: Mob) {
    super.addToArea(entity);
    if (entity instanceof Mob) {
      this.world.addMob(entity);
    }
  }

  initRoaming() {
    var self = this;

    setInterval(function () {
      self.entities.forEach(function (entity) {
        const mob = entity as Mob;
        var canRoam = (Utils.random(20) === 1),
          pos;

        if (canRoam) {
          if (!mob.hasTarget() && !mob.isDead) {
            pos = self._getRandomPositionInsideArea();
            mob.move(pos.x, pos.y);
          }
        }
      });
    }, 500);
  }

  createReward() {
    var pos = this._getRandomPositionInsideArea();

    return {x: pos.x, y: pos.y, kind: Types.Entities.CHEST};
  }
}
