
export class Camera {

  renderer;
  x;
  y;
  gridX;
  gridY;
  offset;

  gridW;
  gridH;

  // Full viewport size (for outdoor areas)
  fullGridW: number = 0;
  fullGridH: number = 0;

  // Zone-based viewport system
  // When viewportFixed = true, camera stays fixed (for interiors)
  // When viewportFixed = false, camera follows player (outdoor)
  private viewportFixed: boolean = false;

  // Legacy constants for backward compatibility
  static readonly INDOOR_GRID_W = 11;
  static readonly INDOOR_GRID_H = 9;

  // Map bounds for clamping
  mapWidth: number = 0;
  mapHeight: number = 0;

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

    // Status bar height (60px + 3px border)
    var statusBarHeight = 63;

    // How many tiles fit in the window? Subtract status bar from height
    this.fullGridW = Math.ceil(window.innerWidth / (tilesize * scale));
    this.fullGridH = Math.ceil((window.innerHeight - statusBarHeight) / (tilesize * scale));

    // Ensure minimum size
    this.fullGridW = Math.max(this.fullGridW, 15);
    this.fullGridH = Math.max(this.fullGridH, 7);

    // Apply fixed viewport limits if active (e.g., in interior zone)
    // Note: gridW/gridH are set by setZoneViewport when entering interiors
    if (!this.viewportFixed) {
      this.gridW = this.fullGridW;
      this.gridH = this.fullGridH;
    }
    // If viewportFixed, keep current gridW/gridH (set by setZoneViewport)

    console.debug('---------');
    console.debug('Scale:' + scale + ' Tilesize:' + tilesize);
    console.debug('Viewport:' + window.innerWidth + 'x' + window.innerHeight);
    console.debug('Grid W:' + this.gridW + ' H:' + this.gridH + (this.viewportFixed ? ' (fixed)' : ''));
  }

  /**
   * Set viewport based on zone configuration
   * @param width Grid viewport width (tiles)
   * @param height Grid viewport height (tiles)
   * @param isFixed If true, camera stays fixed (interior). If false, follows player (outdoor)
   */
  setZoneViewport(width: number, height: number, isFixed: boolean): void {
    this.viewportFixed = isFixed;

    if (isFixed) {
      // Use zone-defined dimensions (capped by window size)
      this.gridW = Math.min(this.fullGridW, width);
      this.gridH = Math.min(this.fullGridH, height);
    } else {
      // Outdoor mode - use full window
      this.gridW = this.fullGridW;
      this.gridH = this.fullGridH;
    }

    console.debug('Camera viewport:', this.gridW, 'x', this.gridH, isFixed ? '(fixed)' : '(dynamic)');
  }

  /**
   * Check if viewport is fixed (interior/zone mode)
   */
  isViewportFixed(): boolean {
    return this.viewportFixed;
  }

  /**
   * Legacy: Enter indoor mode with default 11x9 viewport
   * @deprecated Use setZoneViewport() instead
   */
  setIndoorMode(indoor: boolean): void {
    if (indoor) {
      this.setZoneViewport(Camera.INDOOR_GRID_W, Camera.INDOOR_GRID_H, true);
    } else {
      this.setZoneViewport(this.fullGridW, this.fullGridH, false);
    }
  }

  /**
   * Legacy getter for backward compatibility
   * @deprecated Use isViewportFixed() instead
   */
  get indoorMode(): boolean {
    return this.viewportFixed;
  }

  setPosition(x, y) {
    // Clamp to map bounds if we know them
    if (this.mapWidth > 0 && this.mapHeight > 0) {
      const maxX = Math.max(0, (this.mapWidth - this.gridW) * 16);
      const maxY = Math.max(0, (this.mapHeight - this.gridH) * 16);
      x = Math.max(0, Math.min(x, maxX));
      y = Math.max(0, Math.min(y, maxY));
    }

    this.x = x;
    this.y = y;

    this.gridX = Math.floor(x / 16);
    this.gridY = Math.floor(y / 16);
  }

  setGridPosition(x, y) {
    // Clamp to map bounds if we know them
    if (this.mapWidth > 0 && this.mapHeight > 0) {
      // Don't let camera go negative
      x = Math.max(0, x);
      y = Math.max(0, y);
      // Don't let camera go past map edge minus viewport
      x = Math.min(x, Math.max(0, this.mapWidth - this.gridW));
      y = Math.min(y, Math.max(0, this.mapHeight - this.gridH));
    }

    this.gridX = x;
    this.gridY = y;

    this.x = this.gridX * 16;
    this.y = this.gridY * 16;
  }

  setMapSize(width: number, height: number) {
    this.mapWidth = width;
    this.mapHeight = height;
    console.debug('Camera map bounds set to ' + width + 'x' + height);
  }

  lookAt(entity) {
    // In fixed viewport mode (interiors), don't follow entities - camera stays fixed
    if (this.viewportFixed) {
      return;
    }

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
    // In fixed viewport mode (interiors), don't refocus camera - stays fixed
    if (this.viewportFixed) {
      return;
    }

    var w = this.gridW - 2,
      h = this.gridH - 2,
      x = Math.floor((entity.gridX - 1) / w) * w,
      y = Math.floor((entity.gridY - 1) / h) * h;

    this.setGridPosition(x, y);
  }
}
