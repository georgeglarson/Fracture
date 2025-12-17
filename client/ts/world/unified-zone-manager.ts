/**
 * UnifiedZoneManager - Single source of truth for all zone state
 *
 * Handles both outdoor zones and interior zones using a unified zone system.
 * Replaces InteriorManager with zone-based interior handling.
 *
 * Key features:
 * - Zone stack for outdoor→interior transitions
 * - Dynamic viewport based on zone configuration
 * - Position clamping for interior bounds
 * - Backward compatible with legacy door format
 */

import { Camera } from '../renderer/camera';
import {
  ZoneDefinition,
  getZoneAtPosition,
  getInteriorZone,
  getInteriorZoneForDoor,
  DEFAULT_INTERIOR_WIDTH,
  DEFAULT_INTERIOR_HEIGHT
} from '../../../shared/ts/zones';

export type ZoneState = 'outdoor' | 'interior' | 'transitioning';

export interface ZoneTransition {
  fromZone: ZoneDefinition | null;
  toZone: ZoneDefinition | null;
  playerPosition: { x: number; y: number };
  orientation: string;
}

interface UnifiedZoneContext {
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
 * Manages zone state transitions for both outdoor and interior zones.
 *
 * Usage:
 *   unifiedZoneManager.handleDoorTransition(doorX, doorY, dest) - Call when player uses a door
 *   unifiedZoneManager.isIndoors() - Check if currently in an interior
 *   unifiedZoneManager.clampPosition(x, y) - Clamp position to interior bounds
 *   unifiedZoneManager.reset() - Reset to outdoor state (e.g., on death)
 */
export class UnifiedZoneManager {
  private state: ZoneState = 'outdoor';
  private currentZone: ZoneDefinition | null = null;
  private zoneStack: ZoneDefinition[] = [];
  private context: UnifiedZoneContext | null = null;

  /**
   * Set the context (camera, renderer) for zone transitions
   */
  setContext(context: UnifiedZoneContext): void {
    this.context = context;
  }

  /**
   * Get the current zone (null if no zone detected)
   */
  getCurrentZone(): ZoneDefinition | null {
    return this.currentZone;
  }

  /**
   * Get the current zone state
   */
  getState(): ZoneState {
    return this.state;
  }

  /**
   * Check if currently in an interior zone
   */
  isIndoors(): boolean {
    return this.currentZone?.type === 'interior';
  }

  /**
   * Handle a door transition
   * Determines if entering interior or exiting to outdoor and manages the transition.
   *
   * @param doorX Door X position (world grid)
   * @param doorY Door Y position (world grid)
   * @param dest Destination info from map.getDoorDestination()
   * @returns ZoneTransition if zone changed, null otherwise
   */
  handleDoorTransition(
    doorX: number,
    doorY: number,
    dest: {
      x: number;
      y: number;
      orientation: string;
      cameraX?: number;
      cameraY?: number;
    }
  ): ZoneTransition | null {
    // Check if door leads to an interior zone
    const interiorZoneId = getInteriorZoneForDoor(doorX, doorY);

    if (interiorZoneId) {
      // Door leads to a defined interior zone
      const zone = getInteriorZone(interiorZoneId);
      if (zone) {
        return this.enterZone(zone, dest.x, dest.y, dest.orientation);
      }
    }

    // Fallback: Check if door has camera coords (legacy interior format)
    if (dest.cameraX !== undefined && dest.cameraY !== undefined) {
      // Create a temporary zone from legacy door data
      const legacyZone = this.createLegacyInteriorZone(dest.cameraX, dest.cameraY);
      return this.enterZone(legacyZone, dest.x, dest.y, dest.orientation);
    }

    // Check if we're exiting an interior to outdoor
    if (this.isIndoors()) {
      return this.exitToOutdoor(dest.x, dest.y, dest.orientation);
    }

    // Outdoor-to-outdoor transition (might be a zone change)
    const outdoorZone = getZoneAtPosition(dest.x, dest.y);
    if (outdoorZone && outdoorZone.id !== this.currentZone?.id) {
      // Zone changed but both are outdoor - just update current zone
      const fromZone = this.currentZone;
      this.currentZone = outdoorZone;
      return {
        fromZone,
        toZone: outdoorZone,
        playerPosition: { x: dest.x, y: dest.y },
        orientation: dest.orientation
      };
    }

    return null;
  }

  /**
   * Enter a zone (interior or outdoor)
   */
  enterZone(
    zone: ZoneDefinition,
    playerX: number,
    playerY: number,
    orientation: string
  ): ZoneTransition {
    const fromZone = this.currentZone;

    this.state = 'transitioning';

    // If entering interior from outdoor, push current zone to stack
    if (zone.type === 'interior' && fromZone?.type !== 'interior') {
      if (fromZone) {
        this.zoneStack.push(fromZone);
      }
    }

    this.currentZone = zone;

    // Apply zone viewport to camera
    if (this.context && zone.type === 'interior' && zone.viewport) {
      this.applyZoneViewport(zone);
    }

    this.state = zone.type === 'interior' ? 'interior' : 'outdoor';

    console.debug('[Zone] Entered:', zone.name, `(${zone.id})`);

    return {
      fromZone,
      toZone: zone,
      playerPosition: { x: playerX, y: playerY },
      orientation
    };
  }

  /**
   * Exit interior to outdoor
   */
  exitToOutdoor(
    playerX: number,
    playerY: number,
    orientation: string
  ): ZoneTransition {
    const fromZone = this.currentZone;

    this.state = 'transitioning';

    // Pop from zone stack or determine outdoor zone from position
    let toZone: ZoneDefinition | null = this.zoneStack.pop() || null;
    if (!toZone) {
      toZone = getZoneAtPosition(playerX, playerY);
    }

    this.currentZone = toZone;

    // Reset camera to outdoor mode
    if (this.context) {
      this.applyOutdoorViewport();
    }

    this.state = 'outdoor';

    console.debug('[Zone] Exited to:', toZone?.name || 'outdoor');

    return {
      fromZone,
      toZone,
      playerPosition: { x: playerX, y: playerY },
      orientation
    };
  }

  /**
   * Apply zone-specific viewport to camera
   */
  private applyZoneViewport(zone: ZoneDefinition): void {
    if (!this.context || !zone.viewport) return;

    // Clear canvases for clean transition
    this.context.renderer.clearScreen(this.context.renderer.context);
    this.context.renderer.clearScreen(this.context.renderer.background);
    this.context.renderer.clearScreen(this.context.renderer.foreground);

    // Set camera to zone-defined viewport size
    this.context.camera.setZoneViewport(
      zone.viewport.width,
      zone.viewport.height,
      true // isFixed
    );

    // Position camera at zone's fixed position
    this.context.camera.setGridPosition(
      zone.viewport.cameraX,
      zone.viewport.cameraY
    );

    // Re-render static canvases for new view
    this.context.renderer.renderStaticCanvases();
  }

  /**
   * Reset camera to outdoor mode
   */
  private applyOutdoorViewport(): void {
    if (!this.context) return;

    // Clear canvases for clean transition
    this.context.renderer.clearScreen(this.context.renderer.context);
    this.context.renderer.clearScreen(this.context.renderer.background);
    this.context.renderer.clearScreen(this.context.renderer.foreground);

    // Set camera to full viewport
    this.context.camera.setZoneViewport(
      this.context.camera.fullGridW,
      this.context.camera.fullGridH,
      false // isFixed
    );
  }

  /**
   * Create a legacy interior zone from camera coordinates
   * Used for backward compatibility with doors not in DOOR_TO_ZONE map
   */
  private createLegacyInteriorZone(cameraX: number, cameraY: number): ZoneDefinition {
    return {
      id: `interior_legacy_${cameraX}_${cameraY}`,
      name: 'Interior',
      description: 'A building interior',
      type: 'interior',
      minLevel: 1,
      maxLevel: 50,
      rarityBonus: 0,
      goldBonus: 0,
      xpBonus: 0,
      armorDropBonus: 0,
      weaponDropBonus: 0,
      areas: [{
        x: cameraX,
        y: cameraY,
        w: DEFAULT_INTERIOR_WIDTH,
        h: DEFAULT_INTERIOR_HEIGHT
      }],
      viewport: {
        width: DEFAULT_INTERIOR_WIDTH,
        height: DEFAULT_INTERIOR_HEIGHT,
        cameraX,
        cameraY
      }
    };
  }

  /**
   * Clamp a position to current zone bounds (for interiors)
   * Returns original position if outdoor
   */
  clampPosition(x: number, y: number): { x: number; y: number; clamped: boolean } {
    if (!this.currentZone || this.currentZone.type !== 'interior') {
      return { x, y, clamped: false };
    }

    const area = this.currentZone.areas[0];
    if (!area) {
      return { x, y, clamped: false };
    }

    const clampedX = Math.max(area.x, Math.min(area.x + area.w - 1, x));
    const clampedY = Math.max(area.y, Math.min(area.y + area.h - 1, y));
    const clamped = clampedX !== x || clampedY !== y;

    if (clamped) {
      console.debug('[Zone] Clamped position from', x, y, 'to', clampedX, clampedY);
    }

    return { x: clampedX, y: clampedY, clamped };
  }

  /**
   * Check if a position is within current zone bounds
   */
  isPositionInBounds(x: number, y: number): boolean {
    if (!this.currentZone) return true;

    for (const area of this.currentZone.areas) {
      if (x >= area.x && x < area.x + area.w &&
          y >= area.y && y < area.y + area.h) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a move target is valid (for pathfinding)
   */
  isValidMoveTarget(x: number, y: number): boolean {
    if (this.state !== 'interior') return true;
    return this.isPositionInBounds(x, y);
  }

  /**
   * Update outdoor zone based on player position
   * Call this when player moves in outdoor areas
   */
  updateOutdoorZone(x: number, y: number): ZoneDefinition | null {
    if (this.isIndoors()) return this.currentZone;

    const zone = getZoneAtPosition(x, y);
    if (zone && zone.id !== this.currentZone?.id) {
      this.currentZone = zone;
      console.debug('[Zone] Now in:', zone.name);
    }
    return zone;
  }

  /**
   * Force reset to outdoor state (e.g., on death/respawn)
   */
  reset(): void {
    this.state = 'outdoor';
    this.currentZone = null;
    this.zoneStack = [];

    if (this.context) {
      this.applyOutdoorViewport();
    }

    console.debug('[Zone] Reset to outdoor');
  }
}
