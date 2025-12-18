/**
 * InteriorManager - DEPRECATED
 *
 * @deprecated Use UnifiedZoneManager instead.
 * This class is kept for backward compatibility and forwards to UnifiedZoneManager.
 *
 * Migration guide:
 * - Replace InteriorManager with UnifiedZoneManager
 * - Replace enterInterior()/exitInterior() with handleDoorTransition()
 * - Interior zones are now defined in shared/ts/zones/interior-zones.ts
 */

import { Camera } from '../renderer/camera';
import { UnifiedZoneManager } from './unified-zone-manager';

export interface InteriorBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cameraX: number;
  cameraY: number;
}

export interface InteriorDefinition {
  id: string;
  bounds: InteriorBounds;
  name?: string;
}

type InteriorState = 'outdoor' | 'indoor' | 'transitioning';

interface InteriorContext {
  camera: Camera;
  renderer: {
    clearScreen(ctx: CanvasRenderingContext2D): void;
    context: CanvasRenderingContext2D;
    background: CanvasRenderingContext2D;
    foreground: CanvasRenderingContext2D;
    renderStaticCanvases(): void;
  };
}

/**
 * @deprecated Use UnifiedZoneManager instead.
 * Legacy interior manager - forwards to UnifiedZoneManager for actual implementation.
 */
export class InteriorManager {
  private unifiedManager: UnifiedZoneManager | null = null;
  private context: InteriorContext | null = null;

  // Legacy state (for backward compatibility)
  private legacyCurrentInterior: InteriorDefinition | null = null;

  /**
   * Set the unified zone manager to forward calls to
   */
  setUnifiedManager(manager: UnifiedZoneManager): void {
    this.unifiedManager = manager;
  }

  setContext(context: InteriorContext): void {
    this.context = context;
    // Note: UnifiedZoneManager context is set separately in game-bootstrap.ts
    // with the additional isColliding function for dynamic room bounds
  }

  /**
   * @deprecated No longer needed - zones are defined in interior-zones.ts
   */
  registerInterior(interior: InteriorDefinition): void {
    console.warn('[InteriorManager] registerInterior is deprecated. Define zones in interior-zones.ts');
  }

  /**
   * Create interior from door destination data
   * @deprecated Use UnifiedZoneManager.handleDoorTransition() instead
   */
  createInteriorFromDoor(doorId: string, dest: {
    x: number;
    y: number;
    cameraX?: number;
    cameraY?: number
  }): InteriorDefinition | null {
    if (dest.cameraX === undefined || dest.cameraY === undefined) {
      return null;
    }

    const bounds: InteriorBounds = {
      cameraX: dest.cameraX,
      cameraY: dest.cameraY,
      minX: dest.cameraX,
      maxX: dest.cameraX + Camera.INDOOR_GRID_W - 1,
      minY: dest.cameraY,
      maxY: dest.cameraY + Camera.INDOOR_GRID_H - 1,
    };

    return {
      id: doorId,
      bounds,
    };
  }

  /**
   * Enter an interior
   * @deprecated Use UnifiedZoneManager.handleDoorTransition() instead
   */
  enterInterior(interior: InteriorDefinition): void {
    console.warn('[InteriorManager] enterInterior is deprecated. Use UnifiedZoneManager.handleDoorTransition()');

    // Store for legacy compatibility
    this.legacyCurrentInterior = interior;

    // Forward to unified manager if available, otherwise use legacy behavior
    if (this.unifiedManager && this.context) {
      // Create a fake transition through the unified manager
      const fakeZone = {
        id: interior.id,
        name: interior.name || 'Interior',
        description: 'Legacy interior',
        type: 'interior' as const,
        minLevel: 1,
        maxLevel: 50,
        rarityBonus: 0,
        goldBonus: 0,
        xpBonus: 0,
        armorDropBonus: 0,
        weaponDropBonus: 0,
        areas: [{
          x: interior.bounds.cameraX,
          y: interior.bounds.cameraY,
          w: Camera.INDOOR_GRID_W,
          h: Camera.INDOOR_GRID_H
        }],
        viewport: {
          width: Camera.INDOOR_GRID_W,
          height: Camera.INDOOR_GRID_H,
          cameraX: interior.bounds.cameraX,
          cameraY: interior.bounds.cameraY
        }
      };
      this.unifiedManager.enterZone(fakeZone, interior.bounds.cameraX, interior.bounds.cameraY, 'u');
    } else if (this.context) {
      // Legacy fallback
      this.context.renderer.clearScreen(this.context.renderer.context);
      this.context.renderer.clearScreen(this.context.renderer.background);
      this.context.renderer.clearScreen(this.context.renderer.foreground);
      this.context.camera.setIndoorMode(true);
      this.context.camera.setGridPosition(interior.bounds.cameraX, interior.bounds.cameraY);
      this.context.renderer.renderStaticCanvases();
    }
  }

  /**
   * Exit interior
   * @deprecated Use UnifiedZoneManager.handleDoorTransition() instead
   */
  exitInterior(): void {
    console.warn('[InteriorManager] exitInterior is deprecated. Use UnifiedZoneManager.handleDoorTransition()');

    this.legacyCurrentInterior = null;

    if (this.unifiedManager) {
      this.unifiedManager.reset();
    } else if (this.context) {
      // Legacy fallback
      this.context.renderer.clearScreen(this.context.renderer.context);
      this.context.renderer.clearScreen(this.context.renderer.background);
      this.context.renderer.clearScreen(this.context.renderer.foreground);
      this.context.camera.setIndoorMode(false);
    }
  }

  /**
   * Check if currently indoors
   */
  isIndoors(): boolean {
    if (this.unifiedManager) {
      return this.unifiedManager.isIndoors();
    }
    return this.legacyCurrentInterior !== null;
  }

  /**
   * Get current interior
   */
  getCurrentInterior(): InteriorDefinition | null {
    return this.legacyCurrentInterior;
  }

  /**
   * Clamp position to interior bounds
   */
  clampPosition(x: number, y: number): { x: number; y: number; clamped: boolean } {
    if (this.unifiedManager) {
      return this.unifiedManager.clampPosition(x, y);
    }

    if (!this.legacyCurrentInterior) {
      return { x, y, clamped: false };
    }

    const bounds = this.legacyCurrentInterior.bounds;
    const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, x));
    const clampedY = Math.max(bounds.minY, Math.min(bounds.maxY, y));
    const clamped = clampedX !== x || clampedY !== y;

    return { x: clampedX, y: clampedY, clamped };
  }

  /**
   * Check if position is in bounds
   */
  isPositionInBounds(x: number, y: number): boolean {
    if (this.unifiedManager) {
      return this.unifiedManager.isPositionInBounds(x, y);
    }

    if (!this.legacyCurrentInterior) return true;

    const bounds = this.legacyCurrentInterior.bounds;
    return x >= bounds.minX && x <= bounds.maxX &&
           y >= bounds.minY && y <= bounds.maxY;
  }

  /**
   * Check if move target is valid
   */
  isValidMoveTarget(x: number, y: number): boolean {
    if (this.unifiedManager) {
      return this.unifiedManager.isValidMoveTarget(x, y);
    }
    return this.isPositionInBounds(x, y);
  }

  /**
   * Get current state
   */
  getState(): InteriorState {
    if (this.unifiedManager) {
      return this.unifiedManager.getState() as InteriorState;
    }
    return this.legacyCurrentInterior ? 'indoor' : 'outdoor';
  }

  /**
   * Reset to outdoor state
   */
  reset(): void {
    this.legacyCurrentInterior = null;
    if (this.unifiedManager) {
      this.unifiedManager.reset();
    } else if (this.context) {
      this.context.camera.setIndoorMode(false);
    }
  }
}
