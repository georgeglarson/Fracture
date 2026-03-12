import {Types} from '../../shared/ts/gametypes';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('Utils');

// HTML entities for escaping
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;'
};

export class Utils {

  /**
   * Sanitize user input by stripping HTML tags and escaping entities.
   * This prevents XSS attacks in chat messages and player names.
   */
  static sanitize(string: string): string {
    if (!string) return '';
    // Strip HTML tags
    const stripped = string.replace(/<[^>]*>/g, '');
    // Escape HTML entities
    return stripped.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
  }

  static random(range: number): number {
    return Math.floor(Math.random() * range);
  }

  static randomRange(min: number, max: number): number {
    return min + (Math.random() * (max - min));
  }

  static randomInt(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  static clamp(min: number, max: number, value: number): number {
    if (value < min) {
      return min;
    } else if (value > max) {
      return max;
    } else {
      return value;
    }
  }

  static randomOrientation(): number {
    let o: number = Types.Orientations.DOWN;
    const r = Utils.random(4);

    if (r === 0)
      o = Types.Orientations.LEFT;
    if (r === 1)
      o = Types.Orientations.RIGHT;
    if (r === 2)
      o = Types.Orientations.UP;
    if (r === 3)
      o = Types.Orientations.DOWN;

    return o;
  }

  static Mixin(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    if (source) {
      for (let key, keys = Object.keys(source), l = keys.length; l--;) {
        key = keys[l];

        if (source.hasOwnProperty(key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  }

  static distanceTo(x: number, y: number, x2: number, y2: number): number {
    const distX = Math.abs(x - x2);
    const distY = Math.abs(y - y2);

    return (distX > distY) ? distX : distY;
  }
}

// ============================================================================
// Entity ID Normalization & Type Guards
// ============================================================================

/**
 * Normalize entity IDs to numbers.
 * IDs in the codebase are sometimes strings, sometimes numbers.
 * This function ensures consistent number-based comparison.
 */
export function normalizeId(id: string | number): number {
  if (typeof id === 'number') return id;
  const parsed = parseInt(id, 10);
  if (isNaN(parsed)) {
    log.error({ id }, 'Invalid ID in normalizeId');
    return 0;
  }
  return parsed;
}

/**
 * Type guard: Check if entity is a human Player (not AIPlayer).
 * Both Player and AIPlayer have type === 'player', so we check isAI flag.
 */
export function isPlayer(entity: any): boolean {
  return entity?.type === 'player' && !entity.isAI;
}

/**
 * Type guard: Check if entity is an AIPlayer.
 */
export function isAIPlayer(entity: any): boolean {
  return entity?.type === 'player' && entity.isAI === true;
}

/**
 * Type guard: Check if entity is a Mob.
 */
export function isMob(entity: any): boolean {
  return entity?.type === 'mob';
}

/**
 * Type guard: Check if entity is an NPC.
 */
export function isNpc(entity: any): boolean {
  return entity?.type === 'npc';
}

/**
 * Type guard: Check if entity is an Item.
 */
export function isItem(entity: any): boolean {
  return entity?.type === 'item';
}
