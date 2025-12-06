/**
 * Input Manager - Handles mouse position, cursor state, and hover detection
 * Single Responsibility: Track input state and provide coordinate conversion
 */

export interface CameraContext {
  gridX: number;
  gridY: number;
}

export interface RendererContext {
  camera: CameraContext;
  scale: number;
  tilesize: number;
  mobile: boolean;
  tablet: boolean;
  supportsSilhouettes: boolean;
}

export interface MapContext {
  isColliding(x: number, y: number): boolean;
  isPlateau(x: number, y: number): boolean;
}

export interface EntityQueryContext {
  isMobAt(x: number, y: number): boolean;
  isItemAt(x: number, y: number): boolean;
  isNpcAt(x: number, y: number): boolean;
  isChestAt(x: number, y: number): boolean;
  getEntityAt(x: number, y: number): any;
}

export interface PlayerContext {
  isOnPlateau: boolean;
}

export interface GridPosition {
  x: number;
  y: number;
}

export class InputManager {
  // Mouse state
  mouse = { x: 0, y: 0 };
  previousClickPosition: GridPosition = { x: -1, y: -1 };

  // Cursor state
  currentCursor: any = null;
  currentCursorOrientation: number | undefined;
  cursors: Record<string, any> = {};

  // Hover state
  hoveringMob = false;
  hoveringItem = false;
  hoveringNpc = false;
  hoveringChest = false;
  hoveringCollidingTile = false;
  hoveringPlateauTile = false;
  hoveringTarget = false;
  lastHovered: any = null;

  // Target cell display
  selectedX = 0;
  selectedY = 0;
  selectedCellVisible = false;
  targetColor = 'rgba(255, 255, 255, 0.5)';
  targetCellVisible = true;

  // Dependencies
  private renderer: RendererContext | null = null;
  private map: MapContext | null = null;
  private entityQuery: EntityQueryContext | null = null;
  private playerProvider: (() => PlayerContext | null) | null = null;
  private gameStartedProvider: (() => boolean) | null = null;

  constructor() {}

  /**
   * Set renderer context for coordinate conversion
   */
  setRenderer(renderer: RendererContext): void {
    this.renderer = renderer;
  }

  /**
   * Set map context for collision/plateau checks
   */
  setMap(map: MapContext): void {
    this.map = map;
  }

  /**
   * Set entity query context for hover detection
   */
  setEntityQuery(entityQuery: EntityQueryContext): void {
    this.entityQuery = entityQuery;
  }

  /**
   * Set player provider function
   */
  setPlayerProvider(provider: () => PlayerContext | null): void {
    this.playerProvider = provider;
  }

  /**
   * Set game started provider function
   */
  setGameStartedProvider(provider: () => boolean): void {
    this.gameStartedProvider = provider;
  }

  /**
   * Register available cursors
   */
  setCursors(cursors: Record<string, any>): void {
    this.cursors = cursors;
  }

  // ========== Mouse Position ==========

  /**
   * Update mouse position from screen coordinates
   */
  setMousePosition(x: number, y: number): void {
    this.mouse.x = x;
    this.mouse.y = y;
  }

  /**
   * Convert current mouse position to world grid coordinates
   */
  getMouseGridPosition(): GridPosition {
    if (!this.renderer) {
      return { x: 0, y: 0 };
    }

    const mx = this.mouse.x;
    const my = this.mouse.y;
    const c = this.renderer.camera;
    const s = this.renderer.scale;
    const ts = this.renderer.tilesize;
    const offsetX = mx % (ts * s);
    const offsetY = my % (ts * s);
    const x = ((mx - offsetX) / (ts * s)) + c.gridX;
    const y = ((my - offsetY) / (ts * s)) + c.gridY;

    return { x, y };
  }

  // ========== Cursor Management ==========

  /**
   * Set the current cursor by name
   */
  setCursor(name: string, orientation?: number): void {
    if (name in this.cursors) {
      this.currentCursor = this.cursors[name];
      this.currentCursorOrientation = orientation;
    } else {
      console.error('Unknown cursor name: ' + name);
    }
  }

  /**
   * Update cursor based on current hover state
   */
  updateCursorLogic(): void {
    const started = this.gameStartedProvider?.() ?? false;

    // Update target color based on collision
    if (this.hoveringCollidingTile && started) {
      this.targetColor = 'rgba(255, 50, 50, 0.5)';
    } else {
      this.targetColor = 'rgba(255, 255, 255, 0.5)';
    }

    // Update cursor based on what we're hovering
    if (this.hoveringMob && started) {
      this.setCursor('sword');
      this.hoveringTarget = false;
      this.targetCellVisible = false;
    } else if (this.hoveringNpc && started) {
      this.setCursor('talk');
      this.hoveringTarget = false;
      this.targetCellVisible = false;
    } else if ((this.hoveringItem || this.hoveringChest) && started) {
      this.setCursor('loot');
      this.hoveringTarget = false;
      this.targetCellVisible = true;
    } else {
      this.setCursor('hand');
      this.hoveringTarget = false;
      this.targetCellVisible = true;
    }
  }

  // ========== Hover Detection ==========

  /**
   * Update hover state based on current mouse position
   * Called when mouse moves
   */
  updateHoverState(): void {
    if (!this.renderer || !this.map || !this.entityQuery) return;

    const player = this.playerProvider?.();
    if (!player || this.renderer.mobile || this.renderer.tablet) return;

    const pos = this.getMouseGridPosition();
    const x = pos.x;
    const y = pos.y;

    this.hoveringCollidingTile = this.map.isColliding(x, y);
    this.hoveringPlateauTile = player.isOnPlateau
      ? !this.map.isPlateau(x, y)
      : this.map.isPlateau(x, y);
    this.hoveringMob = this.entityQuery.isMobAt(x, y);
    this.hoveringItem = this.entityQuery.isItemAt(x, y);
    this.hoveringNpc = this.entityQuery.isNpcAt(x, y);
    this.hoveringChest = this.entityQuery.isChestAt(x, y);

    // Handle entity highlighting
    if (this.hoveringMob || this.hoveringNpc || this.hoveringChest) {
      const entity = this.entityQuery.getEntityAt(x, y);

      if (entity && !entity.isHighlighted && this.renderer.supportsSilhouettes) {
        if (this.lastHovered) {
          this.lastHovered.setHighlight(false);
        }
        this.lastHovered = entity;
        entity.setHighlight(true);
      }
    } else if (this.lastHovered) {
      this.lastHovered.setHighlight(false);
      this.lastHovered = null;
    }
  }

  // ========== Click Handling ==========

  /**
   * Check if click is at a new position (prevents duplicate clicks)
   * Returns true if this is a new click position
   */
  isNewClickPosition(): boolean {
    const pos = this.getMouseGridPosition();

    if (pos.x === this.previousClickPosition.x &&
        pos.y === this.previousClickPosition.y) {
      return false;
    }

    this.previousClickPosition = pos;
    return true;
  }

  /**
   * Check if click should be processed (game state checks)
   */
  canProcessClick(isZoning: boolean, isZoningAtTarget: boolean, playerIsDead: boolean): boolean {
    const started = this.gameStartedProvider?.() ?? false;
    const player = this.playerProvider?.();

    return started &&
           player !== null &&
           !isZoning &&
           !isZoningAtTarget &&
           !playerIsDead &&
           !this.hoveringCollidingTile &&
           !this.hoveringPlateauTile;
  }

  // ========== Target Cell ==========

  /**
   * Set selected cell position
   */
  setSelectedCell(x: number, y: number): void {
    this.selectedX = x;
    this.selectedY = y;
  }

  /**
   * Show/hide selected cell
   */
  setSelectedCellVisible(visible: boolean): void {
    this.selectedCellVisible = visible;
  }

  /**
   * Clear all hover state (useful for cleanup)
   */
  clearHoverState(): void {
    this.hoveringMob = false;
    this.hoveringItem = false;
    this.hoveringNpc = false;
    this.hoveringChest = false;
    this.hoveringCollidingTile = false;
    this.hoveringPlateauTile = false;
    this.hoveringTarget = false;

    if (this.lastHovered) {
      this.lastHovered.setHighlight(false);
      this.lastHovered = null;
    }
  }
}
