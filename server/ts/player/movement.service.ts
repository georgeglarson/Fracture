/**
 * Movement Service - Single Responsibility: Player movement validation and zone tracking
 *
 * Handles all movement-related logic including:
 * - Position validation
 * - Zone change detection
 * - Teleportation validation
 */

/**
 * Result of a movement attempt
 */
export interface MovementResult {
  valid: boolean;
  x: number;
  y: number;
}

/**
 * Result of zone change check
 */
export interface ZoneChangeResult {
  changed: boolean;
  previousZone: string | null;
  newZone: string | null;
}

/**
 * Position coordinates
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * MovementService - Handles movement validation and zone tracking
 */
export class MovementService {
  /**
   * Validate that a position is within world bounds
   *
   * @param x - Target X coordinate
   * @param y - Target Y coordinate
   * @param worldWidth - World width in tiles
   * @param worldHeight - World height in tiles
   * @returns True if position is valid
   */
  isValidPosition(x: number, y: number, worldWidth: number, worldHeight: number): boolean {
    return x >= 0 && x < worldWidth && y >= 0 && y < worldHeight;
  }

  /**
   * Calculate distance between two positions
   *
   * @param from - Starting position
   * @param to - Target position
   * @returns Euclidean distance
   */
  calculateDistance(from: Position, to: Position): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate Manhattan distance (grid distance)
   *
   * @param from - Starting position
   * @param to - Target position
   * @returns Manhattan distance
   */
  calculateManhattanDistance(from: Position, to: Position): number {
    return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  }

  /**
   * Check if a movement is valid (not too far in one step)
   *
   * @param from - Current position
   * @param to - Target position
   * @param maxDistance - Maximum allowed distance per step
   * @returns True if movement is valid
   */
  isValidMovement(from: Position, to: Position, maxDistance: number = 2): boolean {
    const distance = this.calculateManhattanDistance(from, to);
    return distance <= maxDistance;
  }

  /**
   * Check if teleportation target is valid
   *
   * @param target - Target position
   * @param checkpoints - List of valid checkpoint positions
   * @returns True if target is a valid checkpoint
   */
  isValidTeleportTarget(target: Position, checkpoints: Position[]): boolean {
    return checkpoints.some(cp => cp.x === target.x && cp.y === target.y);
  }

  /**
   * Calculate orientation based on movement direction
   *
   * @param from - Starting position
   * @param to - Target position
   * @returns Orientation (1=up, 2=down, 3=left, 4=right)
   */
  calculateOrientation(from: Position, to: Position): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    // Priority: horizontal over vertical when equal
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? 4 : 3; // right : left
    } else {
      return dy > 0 ? 2 : 1; // down : up
    }
  }

  /**
   * Get adjacent positions (for pathfinding/collision)
   *
   * @param position - Center position
   * @returns Array of 4 adjacent positions
   */
  getAdjacentPositions(position: Position): Position[] {
    return [
      { x: position.x, y: position.y - 1 }, // up
      { x: position.x, y: position.y + 1 }, // down
      { x: position.x - 1, y: position.y }, // left
      { x: position.x + 1, y: position.y }, // right
    ];
  }

  /**
   * Check if two positions are adjacent
   *
   * @param pos1 - First position
   * @param pos2 - Second position
   * @returns True if positions are adjacent
   */
  areAdjacent(pos1: Position, pos2: Position): boolean {
    return this.calculateManhattanDistance(pos1, pos2) === 1;
  }

  /**
   * Check if two positions are within interaction range
   *
   * @param pos1 - First position
   * @param pos2 - Second position
   * @param range - Interaction range (default 1)
   * @returns True if within range
   */
  isWithinRange(pos1: Position, pos2: Position, range: number = 1): boolean {
    return this.calculateManhattanDistance(pos1, pos2) <= range;
  }
}

// Singleton instance
let movementService: MovementService | null = null;

/**
 * Get the singleton MovementService instance
 */
export function getMovementService(): MovementService {
  if (!movementService) {
    movementService = new MovementService();
  }
  return movementService;
}
