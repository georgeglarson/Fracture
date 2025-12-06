const damageInfoColors = {
  'received': {
    fill: 'rgb(255, 50, 50)',
    stroke: 'rgb(255, 180, 180)'
  },
  'inflicted': {
    fill: 'white',
    stroke: '#373737'
  },
  'healed': {
    fill: 'rgb(80, 255, 80)',
    stroke: 'rgb(50, 120, 50)'
  },
  'xp': {
    fill: 'rgb(255, 215, 0)',  // Gold color for XP
    stroke: 'rgb(180, 150, 0)'
  }
};


export class DamageInfo {
  static DURATION: 1000;
  id;
  value;
  duration;
  x;
  y;
  opacity = 1.0;
  lastTime = 0;
  speed = 100;
  fillColor;
  strokeColor;
  destroy_callback;

  constructor(id, value, x, y, duration, type) {
    this.id = id;
    this.value = value;
    this.duration = duration;
    this.x = x;
    this.y = y;
    this.fillColor = damageInfoColors[type].fill;
    this.strokeColor = damageInfoColors[type].stroke;
  }

  isTimeToAnimate(time) {
    return (time - this.lastTime) > this.speed;
  }

  update(time) {
    if (this.isTimeToAnimate(time)) {
      this.lastTime = time;
      this.tick();
    }
  }

  tick() {
    this.y -= 1;
    this.opacity -= 0.07;
    if (this.opacity < 0) {
      this.destroy();
    }
  }

  onDestroy(callback) {
    this.destroy_callback = callback;
  }

  destroy() {
    if (this.destroy_callback) {
      this.destroy_callback(this.id);
    }
  }
}
