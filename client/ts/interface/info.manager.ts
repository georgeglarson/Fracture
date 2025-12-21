import {Game} from '../game';
import {DamageInfo} from './damage.info';

export class InfoManager {

  game: Game;
  infos: Record<string, DamageInfo> = {};
  destroyQueue: string[] = [];

  constructor(game: Game) {
    this.game = game;
  }


  addDamageInfo(value, x, y, type) {
    var time = this.game.currentTime,
      id = time + '' + Math.abs(value) + '' + x + '' + y,
      self = this,
      info = new DamageInfo(id, value, x, y, DamageInfo.DURATION, type);

    info.onDestroy(function (id) {
      self.destroyQueue.push(id);
    });
    this.infos[id] = info;
  }

  forEachInfo(callback) {
    Object.values(this.infos).forEach(function (info) {
      callback(info);
    });
  }

  update(time) {
    var self = this;

    this.forEachInfo(function (info) {
      info.update(time);
    });

    this.destroyQueue.forEach(function (id) {
      delete self.infos[id];
    });
    this.destroyQueue = [];
  }
}
