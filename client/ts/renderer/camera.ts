
export class Camera {

  renderer;
  x;
  y;
  gridX;
  gridY;
  offset;

  gridW;
  gridH;

  // Screen shake properties
  shakeOffsetX: number = 0;
  shakeOffsetY: number = 0;
  shakeIntensity: number = 0;
  shakeDuration: number = 0;
  shakeStartTime: number = 0;

  constructor(renderer) {
    this.renderer = renderer;
    this.x = 0;
    this.y = 0;
    this.gridX = 0;
    this.gridY = 0;
    this.offset = 0.5;
    this.rescale();
  }

  /**
   * Trigger screen shake effect
   * @param intensity - Max pixel offset (default 4)
   * @param duration - Duration in ms (default 150)
   */
  shake(intensity: number = 4, duration: number = 150) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeStartTime = Date.now();
  }

  /**
   * Update shake effect - call each frame
   */
  updateShake() {
    if (this.shakeIntensity === 0) {
      return;
    }

    const elapsed = Date.now() - this.shakeStartTime;
    if (elapsed >= this.shakeDuration) {
      // Shake finished
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeIntensity = 0;
      return;
    }

    // Decay intensity over duration
    const progress = elapsed / this.shakeDuration;
    const currentIntensity = this.shakeIntensity * (1 - progress);

    // Random offset within intensity range
    this.shakeOffsetX = (Math.random() * 2 - 1) * currentIntensity;
    this.shakeOffsetY = (Math.random() * 2 - 1) * currentIntensity;
  }

  rescale() {
    // Calculate grid size to fill the entire viewport
    var scale = this.renderer.scale || 2;
    var tilesize = this.renderer.tilesize || 16;

    // How many tiles fit in the window?
    this.gridW = Math.ceil(window.innerWidth / (tilesize * scale));
    this.gridH = Math.ceil(window.innerHeight / (tilesize * scale));

    // Ensure minimum size
    this.gridW = Math.max(this.gridW, 15);
    this.gridH = Math.max(this.gridH, 7);

    console.debug('---------');
    console.debug('Scale:' + scale + ' Tilesize:' + tilesize);
    console.debug('Viewport:' + window.innerWidth + 'x' + window.innerHeight);
    console.debug('Grid W:' + this.gridW + ' H:' + this.gridH);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;

    this.gridX = Math.floor(x / 16);
    this.gridY = Math.floor(y / 16);
  }

  setGridPosition(x, y) {
    this.gridX = x;
    this.gridY = y;

    this.x = this.gridX * 16;
    this.y = this.gridY * 16;
  }

  lookAt(entity) {
    var r = this.renderer,
      x = Math.round(entity.x - (Math.floor(this.gridW / 2) * r.tilesize)),
      y = Math.round(entity.y - (Math.floor(this.gridH / 2) * r.tilesize));

    this.setPosition(x, y);
  }

  forEachVisiblePosition(callback, extra) {
    var extra = extra || 0;
    for (var y = this.gridY - extra, maxY = this.gridY + this.gridH + (extra * 2); y < maxY; y += 1) {
      for (var x = this.gridX - extra, maxX = this.gridX + this.gridW + (extra * 2); x < maxX; x += 1) {
        callback(x, y);
      }
    }
  }

  isVisible(entity) {
    return this.isVisiblePosition(entity.gridX, entity.gridY);
  }

  isVisiblePosition(x, y) {
    if (y >= this.gridY && y < this.gridY + this.gridH
      && x >= this.gridX && x < this.gridX + this.gridW) {
      return true;
    } else {
      return false;
    }
  }

  focusEntity(entity) {
    var w = this.gridW - 2,
      h = this.gridH - 2,
      x = Math.floor((entity.gridX - 1) / w) * w,
      y = Math.floor((entity.gridY - 1) / h) * h;

    this.setGridPosition(x, y);
  }
}
