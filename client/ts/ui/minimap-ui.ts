/**
 * MinimapUI - Displays a mini-map in the corner of the screen
 * Shows terrain, player position, entities, and viewport
 */

export interface MinimapCallbacks {
  getMap: () => any;
  getPlayer: () => any;
  getCamera: () => any;
  forEachEntity: (callback: (entity: any) => void) => void;
}

export class MinimapUI {
  private visible = true;
  private callbacks: MinimapCallbacks | null = null;

  // Canvas for the minimap
  private container: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // Terrain cache (rendered once)
  private terrainCanvas: HTMLCanvasElement | null = null;
  private terrainCtx: CanvasRenderingContext2D | null = null;
  private terrainRendered = false;

  // Map dimensions
  private mapWidth = 172;
  private mapHeight = 314;

  // Display settings
  private displayWidth = 180;
  private displayHeight = 180;
  private scale = 1; // Pixels per tile

  constructor() {
    this.createContainer();
  }

  setCallbacks(callbacks: MinimapCallbacks): void {
    this.callbacks = callbacks;
  }

  private createContainer(): void {
    // Create container div - parchment/scroll style
    this.container = document.createElement('div');
    this.container.id = 'minimap-container';
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: ${this.displayWidth + 8}px;
      height: ${this.displayHeight + 28}px;
      background: linear-gradient(135deg, #d4c4a8 0%, #c9b896 50%, #bfae87 100%);
      border: 3px solid #6b4423;
      border-radius: 3px;
      box-shadow:
        inset 0 0 10px rgba(139, 90, 43, 0.3),
        2px 2px 8px rgba(0, 0, 0, 0.4),
        inset 0 0 30px rgba(139, 90, 43, 0.1);
      z-index: 5000;
      user-select: none;
      display: block;
    `;

    // Header - parchment style
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 3px 8px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12px;
      color: #4a3520;
      border-bottom: 1px solid #8b5a2b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
    `;
    header.innerHTML = `
      <span style="font-weight: bold;">Map</span>
      <span style="font-size: 10px; color: #6b4423; font-style: italic;">[M]</span>
    `;
    this.container.appendChild(header);

    // Canvas - with parchment border inset
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.displayWidth;
    this.canvas.height = this.displayHeight;
    this.canvas.style.cssText = `
      display: block;
      margin: 4px;
      border: 1px solid #8b5a2b;
      border-radius: 2px;
    `;
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Create terrain cache canvas
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = this.mapWidth;
    this.terrainCanvas.height = this.mapHeight;
    this.terrainCtx = this.terrainCanvas.getContext('2d');

    document.body.appendChild(this.container);
  }

  /**
   * Render static terrain (called once when map loads)
   */
  renderTerrain(): void {
    if (!this.callbacks || !this.terrainCtx) return;

    const map = this.callbacks.getMap();
    if (!map) return;

    this.mapWidth = map.width;
    this.mapHeight = map.height;

    // Calculate scale to fit map in display
    this.scale = Math.min(
      this.displayWidth / this.mapWidth,
      this.displayHeight / this.mapHeight
    );

    // Resize terrain canvas
    this.terrainCanvas!.width = Math.ceil(this.mapWidth * this.scale);
    this.terrainCanvas!.height = Math.ceil(this.mapHeight * this.scale);

    const ctx = this.terrainCtx;

    // Clear - warm sepia base
    ctx.fillStyle = '#c4a882';
    ctx.fillRect(0, 0, this.terrainCanvas!.width, this.terrainCanvas!.height);

    // Draw each tile
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        let color: string;

        if (map.isColliding(x, y)) {
          // Walls/obstacles - dark brown ink
          color = '#5c4a3a';
        } else if (map.isPlateau && map.isPlateau(x, y)) {
          // Elevated terrain - darker parchment
          color = '#a08060';
        } else {
          // Walkable terrain - zone-appropriate warm colors
          const zone = this.getZoneColor(x, y);
          color = zone;
        }

        ctx.fillStyle = color;
        ctx.fillRect(
          Math.floor(x * this.scale),
          Math.floor(y * this.scale),
          Math.ceil(this.scale),
          Math.ceil(this.scale)
        );
      }
    }

    this.terrainRendered = true;
  }

  /**
   * Get zone-appropriate color for terrain variety
   * Uses warm, hand-drawn map style colors
   */
  private getZoneColor(x: number, y: number): string {
    // Approximate zone colors based on map regions
    // Village area (top-left) - soft green ink
    if (x < 50 && y < 80) {
      return '#7a9a6a'; // Sage green
    }
    // Beach area (right side, middle) - sandy tan
    if (x > 120 && y > 100 && y < 200) {
      return '#d4c4a0'; // Light sand
    }
    // Forest (middle-left) - darker olive ink
    if (x < 80 && y > 80 && y < 180) {
      return '#6a8a5a'; // Forest olive
    }
    // Cave/graveyard (various dark areas) - gray-brown
    if (y > 180 && y < 250) {
      return '#8a7a6a'; // Stone gray
    }
    // Desert (bottom right area) - warm ochre
    if (x > 80 && y > 200 && y < 280) {
      return '#c4a070'; // Desert ochre
    }
    // Lava area (bottom) - deep burnt sienna
    if (y > 270) {
      return '#8a5a4a'; // Burnt sienna
    }
    // Default grassland - warm tan-green
    return '#a0906a';
  }

  /**
   * Update and render the minimap (called each frame)
   */
  update(): void {
    if (!this.visible || !this.callbacks || !this.ctx || !this.canvas) return;

    const map = this.callbacks.getMap();
    const player = this.callbacks.getPlayer();
    const camera = this.callbacks.getCamera();

    if (!map || !player) return;

    // Render terrain on first update
    if (!this.terrainRendered) {
      this.renderTerrain();
    }

    const ctx = this.ctx;

    // Clear canvas - warm parchment color
    ctx.fillStyle = '#c9b896';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate centering offset
    const terrainW = this.terrainCanvas!.width;
    const terrainH = this.terrainCanvas!.height;
    const offsetX = Math.floor((this.displayWidth - terrainW) / 2);
    const offsetY = Math.floor((this.displayHeight - terrainH) / 2);

    // Draw cached terrain
    if (this.terrainCanvas) {
      ctx.drawImage(this.terrainCanvas, offsetX, offsetY);
    }

    // Draw entities
    this.callbacks.forEachEntity((entity: any) => {
      if (!entity || entity.gridX === undefined) return;

      const ex = offsetX + Math.floor(entity.gridX * this.scale);
      const ey = offsetY + Math.floor(entity.gridY * this.scale);

      // Skip if outside bounds
      if (ex < 0 || ey < 0 || ex > this.displayWidth || ey > this.displayHeight) return;

      // Different colors for different entity types - ink-style colors
      if (entity === player) {
        // Skip player here, draw last
        return;
      } else if (entity.kind !== undefined) {
        // Check entity type by properties
        if (entity.type === 'mob') {
          ctx.fillStyle = '#8b3a3a'; // Dark red ink for mobs
        } else if (entity.type === 'npc') {
          ctx.fillStyle = '#3a5a8b'; // Dark blue ink for NPCs
        } else if (entity.type === 'player') {
          // Other players - dark green ink
          ctx.fillStyle = '#3a6b3a';
        } else if (entity.type === 'item') {
          ctx.fillStyle = '#8b7a2a'; // Gold ink for items
        } else {
          return; // Skip unknown
        }

        // Draw entity dot
        ctx.fillRect(ex - 1, ey - 1, 2, 2);
      }
    });

    // Draw camera viewport rectangle - brown ink style
    if (camera) {
      ctx.strokeStyle = 'rgba(107, 68, 35, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        offsetX + Math.floor(camera.gridX * this.scale),
        offsetY + Math.floor(camera.gridY * this.scale),
        Math.floor(camera.gridW * this.scale),
        Math.floor(camera.gridH * this.scale)
      );
    }

    // Draw player (last, so it's on top) - ink marker style
    if (player && player.gridX !== undefined) {
      const px = offsetX + Math.floor(player.gridX * this.scale);
      const py = offsetY + Math.floor(player.gridY * this.scale);

      // Dark red ink marker for player
      ctx.fillStyle = '#6b2020';
      ctx.fillRect(px - 2, py - 2, 4, 4);
      ctx.strokeStyle = '#4a1515';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 2, py - 2, 4, 4);
    }
  }

  /**
   * Toggle visibility
   */
  toggle(): void {
    this.visible = !this.visible;
    if (this.container) {
      this.container.style.display = this.visible ? 'block' : 'none';
    }
  }

  /**
   * Show the minimap
   */
  show(): void {
    this.visible = true;
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  /**
   * Hide the minimap
   */
  hide(): void {
    this.visible = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Check if visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Force terrain re-render (if map changes)
   */
  invalidateTerrain(): void {
    this.terrainRendered = false;
  }
}
