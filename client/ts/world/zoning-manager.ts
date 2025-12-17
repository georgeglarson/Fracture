/**
 * ZoningManager - Handles camera zone transitions
 * Single Responsibility: Zone changes, camera movement during transitions
 */

import { Types } from '../../../shared/ts/gametypes';
import { Transition } from '../utils/transition';
import { Camera } from '../renderer/camera';
import { BubbleManager } from '../interface/bubble.manager';

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
  private currentZoning: Transition | null = null;
  private zoningOrientation: number | string | null = null;
  private context: ZoningContext | null = null;

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
    // Indoor camera should stay fixed at the set position
    if (c.indoorMode) {
      return false;
    }

    const relX = x - c.gridX;
    const relY = y - c.gridY;

    if (relX === 0 || relY === 0 || relX === c.gridW - 1 || relY === c.gridH - 1) {
      return true;
    }
    return false;
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

    if (this.context.renderer.mobile || this.context.renderer.tablet) {
      const z = this.zoningOrientation;
      const c = this.context.camera;
      const ts = this.context.renderer.tilesize;
      let newX = c.x;
      let newY = c.y;
      const xoffset = (c.gridW - 2) * ts;
      const yoffset = (c.gridH - 2) * ts;

      if (z === Types.Orientations.LEFT || z === Types.Orientations.RIGHT) {
        newX = (z === Types.Orientations.LEFT) ? c.x - xoffset : c.x + xoffset;
      } else if (z === Types.Orientations.UP || z === Types.Orientations.DOWN) {
        newY = (z === Types.Orientations.UP) ? c.y - yoffset : c.y + yoffset;
      }
      c.setPosition(newX, newY);

      this.context.renderer.clearScreen(this.context.renderer.context);
      this.endZoning();

      // Force immediate drawing of all visible entities in the new zone
      this.context.forEachVisibleEntityByDepth((entity) => {
        entity.setDirty();
      });
    } else {
      this.currentZoning = new Transition();
    }

    this.context.bubbleManager.clean();
    this.context.client.sendZone();
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
   * Complete the current zone transition
   */
  endZoning(): void {
    this.currentZoning = null;
    this.resetZone();
    this.zoningQueue.shift();

    if (this.zoningQueue.length > 0) {
      const pos = this.zoningQueue[0];
      this.startZoningFrom(pos.x, pos.y);
    }
  }

  /**
   * Check if currently transitioning zones
   */
  isZoning(): boolean {
    return this.currentZoning !== null;
  }

  /**
   * Get the current transition object
   */
  getCurrentZoning(): Transition | null {
    return this.currentZoning;
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
}
