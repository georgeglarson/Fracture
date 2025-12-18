/**
 * ZoningManager - Handles camera zone transitions
 *
 * Refactored to use CameraZoningMachine state machine for:
 * - Single source of truth for zoning state
 * - Declarative targets (handles resize naturally)
 * - Clean state transitions
 */

import { Types } from '../../../shared/ts/gametypes';
import { Camera } from '../renderer/camera';
import { BubbleManager } from '../interface/bubble.manager';
import {
  CameraZoningMachine,
  orientationToDirection,
  ZoningDirection
} from './camera-zoning-machine';

export interface ZoningContext {
  camera: Camera;
  renderer: {
    mobile: boolean;
    tablet: boolean;
    tilesize: number;
    context: CanvasRenderingContext2D;
    clearScreen(ctx: CanvasRenderingContext2D): void;
    renderStaticCanvases(): void;
  };
  bubbleManager: BubbleManager;
  client: {
    sendZone(): void;
  };
  initAnimatedTiles(): void;
  forEachVisibleEntityByDepth(callback: (entity: any) => void): void;
}

export class ZoningManager {
  private zoningQueue: Array<{ x: number; y: number }> = [];
  private zoningMachine: CameraZoningMachine;
  private zoningOrientation: number | string | null = null;
  private context: ZoningContext | null = null;

  constructor() {
    this.zoningMachine = new CameraZoningMachine();

    // Set up callbacks for state machine events
    this.zoningMachine.setCallbacks({
      onTransitionTick: () => {
        // Re-render static canvases during transition for smooth visuals
        if (this.context) {
          this.context.initAnimatedTiles();
          this.context.renderer.renderStaticCanvases();
        }
      },
      onTransitionEnd: () => {
        // Transition complete - process queue
        this.onTransitionComplete();
      }
    });
  }

  setContext(context: ZoningContext): void {
    this.context = context;
  }

  get orientation(): number | string | null {
    return this.zoningOrientation;
  }

  /**
   * Check if a tile is at the edge of the camera (triggers zone change)
   * IMPORTANT: Never trigger zone transitions in indoor mode - camera stays fixed
   */
  isZoningTile(x: number, y: number): boolean {
    if (!this.context) return false;
    const c = this.context.camera;

    // Never trigger zone transitions in indoor mode
    if (c.indoorMode) {
      return false;
    }

    const relX = x - c.gridX;
    const relY = y - c.gridY;

    return relX === 0 || relY === 0 || relX === c.gridW - 1 || relY === c.gridH - 1;
  }

  /**
   * Get the direction of zone transition based on position
   */
  getZoningOrientation(x: number, y: number): number | string {
    if (!this.context) return '';
    const c = this.context.camera;

    const relX = x - c.gridX;
    const relY = y - c.gridY;

    if (relX === 0) {
      return Types.Orientations.LEFT;
    } else if (relY === 0) {
      return Types.Orientations.UP;
    } else if (relX === c.gridW - 1) {
      return Types.Orientations.RIGHT;
    } else if (relY === c.gridH - 1) {
      return Types.Orientations.DOWN;
    }

    return '';
  }

  /**
   * Start a zone transition from the given position
   */
  startZoningFrom(x: number, y: number): void {
    if (!this.context) return;

    this.zoningOrientation = this.getZoningOrientation(x, y);
    const direction = orientationToDirection(this.zoningOrientation);

    console.log('[Zoning] Starting zone from', x, y,
      'direction:', direction,
      'camera:', this.context.camera.gridX, this.context.camera.gridY,
      'size:', this.context.camera.gridW, 'x', this.context.camera.gridH);

    if (!direction) {
      console.warn('[Zoning] Invalid direction, cancelling');
      this.endZoning();
      return;
    }

    // Mobile/tablet: instant transition (no animation)
    if (this.context.renderer.mobile || this.context.renderer.tablet) {
      this.performInstantTransition(direction);
    } else {
      // Desktop: use state machine for smooth animation
      this.zoningMachine.startTransition(direction, this.context.camera);
    }

    this.context.bubbleManager.clean();
    this.context.client.sendZone();
  }

  /**
   * Perform instant transition for mobile/tablet
   */
  private performInstantTransition(direction: ZoningDirection): void {
    if (!this.context) return;

    const c = this.context.camera;
    const ts = this.context.renderer.tilesize;
    const xOffset = (c.gridW - 2) * ts;
    const yOffset = (c.gridH - 2) * ts;

    let newX = c.x;
    let newY = c.y;

    switch (direction) {
      case 'left': newX = c.x - xOffset; break;
      case 'right': newX = c.x + xOffset; break;
      case 'up': newY = c.y - yOffset; break;
      case 'down': newY = c.y + yOffset; break;
    }

    c.setPosition(newX, newY);
    this.context.renderer.clearScreen(this.context.renderer.context);

    // Force immediate drawing of all visible entities
    this.context.forEachVisibleEntityByDepth((entity) => {
      entity.setDirty();
    });

    this.endZoning();
  }

  /**
   * Queue a zone transition
   */
  enqueueZoningFrom(x: number, y: number): void {
    this.zoningQueue.push({ x, y });

    if (this.zoningQueue.length === 1) {
      this.startZoningFrom(x, y);
    }
  }

  /**
   * Called when a transition completes (from state machine callback)
   */
  private onTransitionComplete(): void {
    this.resetZone();
    this.zoningQueue.shift();

    // Process next in queue if any
    if (this.zoningQueue.length > 0) {
      const pos = this.zoningQueue[0];
      this.startZoningFrom(pos.x, pos.y);
    }
  }

  /**
   * Complete/cancel the current zone transition
   */
  endZoning(): void {
    this.zoningMachine.cancel();
    this.zoningOrientation = null;
    this.resetZone();
    this.zoningQueue.shift();

    // Process next in queue if any
    if (this.zoningQueue.length > 0) {
      const pos = this.zoningQueue[0];
      this.startZoningFrom(pos.x, pos.y);
    }
  }

  /**
   * Check if currently transitioning zones
   */
  isZoning(): boolean {
    return this.zoningMachine.isActive();
  }

  /**
   * Tick the zoning animation - call every frame
   * @param deltaTime Time since last frame in milliseconds
   */
  tick(deltaTime: number): void {
    if (!this.context) return;
    this.zoningMachine.tick(deltaTime, this.context.camera);
  }

  /**
   * Handle viewport resize during transition
   */
  onViewportResize(): void {
    if (!this.context) return;
    this.zoningMachine.onViewportResize(this.context.camera);
  }

  /**
   * Reset zone state (bubbles, animated tiles, static canvases)
   */
  resetZone(): void {
    if (!this.context) return;

    this.context.bubbleManager.clean();
    this.context.initAnimatedTiles();
    this.context.renderer.renderStaticCanvases();
  }

  /**
   * @deprecated Use isZoning() instead
   * Kept for compatibility during migration
   */
  getCurrentZoning(): any {
    return this.zoningMachine.isActive() ? { inProgress: true } : null;
  }
}
