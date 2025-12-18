/**
 * CameraZoningMachine - State machine for camera zone transitions
 *
 * Design principles:
 * - Single source of truth for all zoning state
 * - Declarative targets - recalculates each tick based on current viewport
 * - Handles resize naturally by not caching stale values
 * - Clear state transitions: idle -> transitioning -> idle
 *
 * Usage:
 *   machine.startTransition(direction, camera)  // Start moving
 *   machine.tick(deltaTime, camera)             // Call each frame
 *   machine.cancel()                            // Abort transition
 *   machine.isActive()                          // Check if transitioning
 */

import { Types } from '../../../shared/ts/gametypes';

export type ZoningState = 'idle' | 'transitioning';
export type ZoningDirection = 'up' | 'down' | 'left' | 'right';

export interface CameraContext {
  x: number;           // Pixel position
  y: number;
  gridX: number;       // Grid position
  gridY: number;
  gridW: number;       // Viewport size in tiles
  gridH: number;
  setPosition(x: number, y: number): void;
  setGridPosition(gridX: number, gridY: number): void;
}

export interface ZoningCallbacks {
  onTransitionStart?: () => void;
  onTransitionTick?: () => void;   // Called each frame during transition
  onTransitionEnd?: () => void;
}

/**
 * Convert orientation number to direction string
 */
export function orientationToDirection(orientation: number | string | null): ZoningDirection | null {
  switch (orientation) {
    case Types.Orientations.UP: return 'up';
    case Types.Orientations.DOWN: return 'down';
    case Types.Orientations.LEFT: return 'left';
    case Types.Orientations.RIGHT: return 'right';
    default: return null;
  }
}

export class CameraZoningMachine {
  private state: ZoningState = 'idle';
  private direction: ZoningDirection | null = null;
  private progress: number = 0;  // 0 to 1
  private callbacks: ZoningCallbacks = {};

  // Animation settings
  private readonly transitionDuration = 500;  // ms
  private readonly tileSize = 16;

  // Cached start position for smooth interpolation
  private startX: number = 0;
  private startY: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;

  /**
   * Set callbacks for transition events
   */
  setCallbacks(callbacks: ZoningCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Check if currently transitioning
   */
  isActive(): boolean {
    return this.state === 'transitioning';
  }

  /**
   * Get current state
   */
  getState(): ZoningState {
    return this.state;
  }

  /**
   * Get current direction (null if idle)
   */
  getDirection(): ZoningDirection | null {
    return this.direction;
  }

  /**
   * Start a zone transition in the given direction
   * Calculates target based on CURRENT camera viewport (handles resize)
   */
  startTransition(direction: ZoningDirection, camera: CameraContext): boolean {
    if (this.state === 'transitioning') {
      console.warn('[CameraZoning] Already transitioning, ignoring new request');
      return false;
    }

    if (!direction) {
      console.warn('[CameraZoning] Invalid direction:', direction);
      return false;
    }

    this.state = 'transitioning';
    this.direction = direction;
    this.progress = 0;

    // Calculate start and target positions based on CURRENT viewport
    this.startX = camera.x;
    this.startY = camera.y;
    this.calculateTarget(camera);

    console.log(`[CameraZoning] Starting ${direction} transition:`,
      `from (${this.startX}, ${this.startY}) to (${this.targetX}, ${this.targetY})`,
      `viewport: ${camera.gridW}x${camera.gridH}`);

    this.callbacks.onTransitionStart?.();
    return true;
  }

  /**
   * Calculate target position based on current viewport
   * Called at start and can be recalculated on resize
   */
  private calculateTarget(camera: CameraContext): void {
    // Move by (viewport - 2) tiles to create overlap
    const xOffset = (camera.gridW - 2) * this.tileSize;
    const yOffset = (camera.gridH - 2) * this.tileSize;

    switch (this.direction) {
      case 'left':
        this.targetX = this.startX - xOffset;
        this.targetY = this.startY;
        break;
      case 'right':
        this.targetX = this.startX + xOffset;
        this.targetY = this.startY;
        break;
      case 'up':
        this.targetX = this.startX;
        this.targetY = this.startY - yOffset;
        break;
      case 'down':
        this.targetX = this.startX;
        this.targetY = this.startY + yOffset;
        break;
    }
  }

  /**
   * Handle viewport resize during transition
   * Recalculates target to prevent overshoot/undershoot
   */
  onViewportResize(camera: CameraContext): void {
    if (this.state !== 'transitioning') return;

    // Recalculate start position based on current progress
    // This ensures smooth continuation after resize
    const currentX = camera.x;
    const currentY = camera.y;

    // Update start to current position
    this.startX = currentX;
    this.startY = currentY;

    // Recalculate target based on new viewport
    this.calculateTarget(camera);

    // Reset progress since we're measuring from new position
    this.progress = 0;

    console.log(`[CameraZoning] Viewport resized, recalculated target:`,
      `(${this.targetX}, ${this.targetY})`);
  }

  /**
   * Tick the state machine - call every frame
   * Returns true if transition is still in progress
   */
  tick(deltaTime: number, camera: CameraContext): boolean {
    if (this.state !== 'transitioning') {
      return false;
    }

    // Advance progress
    this.progress += deltaTime / this.transitionDuration;

    if (this.progress >= 1) {
      // Transition complete - snap to exact target
      this.progress = 1;
      camera.setPosition(this.targetX, this.targetY);
      this.complete();
      return false;
    }

    // Interpolate position with easing
    const t = this.easeInOutQuad(this.progress);
    const x = this.startX + (this.targetX - this.startX) * t;
    const y = this.startY + (this.targetY - this.startY) * t;

    camera.setPosition(Math.round(x), Math.round(y));
    this.callbacks.onTransitionTick?.();

    return true;
  }

  /**
   * Smooth easing function
   */
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /**
   * Complete the transition and reset state
   */
  private complete(): void {
    console.log(`[CameraZoning] Transition complete`);

    this.state = 'idle';
    this.direction = null;
    this.progress = 0;

    this.callbacks.onTransitionEnd?.();
  }

  /**
   * Cancel any in-progress transition
   */
  cancel(): void {
    if (this.state !== 'transitioning') return;

    console.log('[CameraZoning] Transition cancelled');

    this.state = 'idle';
    this.direction = null;
    this.progress = 0;

    // Don't call onTransitionEnd for cancellations
  }

  /**
   * Force complete the transition immediately (snap to target)
   */
  forceComplete(camera: CameraContext): void {
    if (this.state !== 'transitioning') return;

    camera.setPosition(this.targetX, this.targetY);
    this.complete();
  }
}
