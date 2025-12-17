/**
 * Zone definitions with metadata for progression and loot modifiers
 *
 * Map is 172 x 314 tiles. Zones are contiguous horizontal bands
 * progressing from safe (south) to dangerous (north).
 *
 * Interior zones are building interiors with fixed camera viewports.
 */

export interface ZoneBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Zone type: outdoor (normal scrolling) or interior (fixed viewport)
 */
export type ZoneType = 'outdoor' | 'interior';

/**
 * Viewport configuration for interior zones
 */
export interface ZoneViewport {
  width: number;    // Grid viewport width (tiles)
  height: number;   // Grid viewport height (tiles)
  cameraX: number;  // Fixed camera grid X position
  cameraY: number;  // Fixed camera grid Y position
}

export interface ZoneDefinition {
  id: string;
  name: string;
  description: string;
  minLevel: number;
  maxLevel: number;
  // Loot modifiers (multipliers)
  rarityBonus: number;      // Bonus to rarity rolls (0 = none, 0.1 = +10%)
  goldBonus: number;        // Bonus to gold drops
  xpBonus: number;          // Bonus to XP gains
  // Special drop chances
  armorDropBonus: number;   // Bonus to armor drop chance
  weaponDropBonus: number;  // Bonus to weapon drop chance
  // Zone areas (can have multiple areas per zone type)
  areas: ZoneBounds[];

  // Zone type (default: 'outdoor')
  type?: ZoneType;
  // Interior-specific: viewport configuration
  viewport?: ZoneViewport;
  // Interior-specific: parent outdoor zone (inherits bonuses if not specified)
  parentZone?: string;
}

// Full map: 172 x 314
// Zones progress south (safe) to north (dangerous)
// Each zone spans full width (172) as horizontal bands

export const ZONE_DATA: Record<string, ZoneDefinition> = {
  // === SOUTH: Safe starting areas ===

  beach: {
    id: 'beach',
    name: 'Shattered Coast',
    description: 'Where reality meets the void. Waves crash against broken fragments of what was.',
    minLevel: 1,
    maxLevel: 5,
    rarityBonus: 0.05,
    goldBonus: 0.1,
    xpBonus: 0.05,
    armorDropBonus: 0,
    weaponDropBonus: 0.05,
    areas: [
      { x: 0, y: 253, w: 172, h: 61 }  // y: 253-314 (bottom of map)
    ]
  },

  village: {
    id: 'village',
    name: 'The Refuge',
    description: 'Last safe haven in the fractured world. Survivors gather here.',
    minLevel: 1,
    maxLevel: 3,
    rarityBonus: 0,
    goldBonus: 0,
    xpBonus: 0,
    armorDropBonus: 0,
    weaponDropBonus: 0,
    areas: [
      { x: 0, y: 195, w: 172, h: 58 }  // y: 195-253
    ]
  },

  // === MIDDLE: Progression zones ===

  forest: {
    id: 'forest',
    name: 'Glitch Woods',
    description: 'Trees frozen mid-corruption. Digital artifacts flicker between the branches.',
    minLevel: 3,
    maxLevel: 7,
    rarityBonus: 0.1,
    goldBonus: 0.15,
    xpBonus: 0.1,
    armorDropBonus: 0.1,
    weaponDropBonus: 0,
    areas: [
      { x: 0, y: 145, w: 172, h: 50 }  // y: 145-195
    ]
  },

  cave: {
    id: 'cave',
    name: 'The Underdepths',
    description: 'Collapsed infrastructure echoes with whispers of civilization that was.',
    minLevel: 7,
    maxLevel: 12,
    rarityBonus: 0.15,
    goldBonus: 0.2,
    xpBonus: 0.15,
    armorDropBonus: 0.15,
    weaponDropBonus: 0.1,
    areas: [
      { x: 0, y: 100, w: 172, h: 45 }  // y: 100-145
    ]
  },

  // === NORTH: Dangerous endgame zones ===

  desert: {
    id: 'desert',
    name: 'The Null Zone',
    description: 'Where reality has been erased. Nothing survives here for long.',
    minLevel: 10,
    maxLevel: 15,
    rarityBonus: 0.2,
    goldBonus: 0.25,
    xpBonus: 0.2,
    armorDropBonus: 0.1,
    weaponDropBonus: 0.15,
    areas: [
      { x: 0, y: 60, w: 172, h: 40 }   // y: 60-100
    ]
  },

  lavaland: {
    id: 'lavaland',
    name: 'The Core Breach',
    description: 'Heart of the Fracture. Raw dimensional energy tears through reality.',
    minLevel: 15,
    maxLevel: 35,
    rarityBonus: 0.3,
    goldBonus: 0.35,
    xpBonus: 0.3,
    armorDropBonus: 0.2,
    weaponDropBonus: 0.25,
    areas: [
      { x: 0, y: 0, w: 172, h: 60 }    // y: 0-60 (top of map)
    ]
  },

  // === SPECIAL: Boss arena (checked first due to order) ===

  boss: {
    id: 'boss',
    name: 'Reality\'s Edge',
    description: 'Where the Fracture originated. The Architect waits.',
    minLevel: 25,
    maxLevel: 50,
    rarityBonus: 0.5,
    goldBonus: 0.5,
    xpBonus: 0.5,
    armorDropBonus: 0.3,
    weaponDropBonus: 0.3,
    areas: [
      { x: 140, y: 48, w: 29, h: 25 }  // Special boss arena within lavaland
    ]
  }
};

// Zone progression order (for level warnings)
export const ZONE_PROGRESSION = ['beach', 'village', 'forest', 'cave', 'desert', 'lavaland', 'boss'];

/**
 * Get zone at a given position
 * Boss zone is checked first since it overlaps lavaland
 */
export function getZoneAtPosition(x: number, y: number): ZoneDefinition | null {
  // Check boss zone first (special area that overlaps lavaland)
  const bossZone = ZONE_DATA.boss;
  for (const area of bossZone.areas) {
    if (x >= area.x && x < area.x + area.w &&
        y >= area.y && y < area.y + area.h) {
      return bossZone;
    }
  }

  // Check other zones
  for (const zoneId of Object.keys(ZONE_DATA)) {
    if (zoneId === 'boss') continue; // Already checked
    const zone = ZONE_DATA[zoneId];
    for (const area of zone.areas) {
      if (x >= area.x && x < area.x + area.w &&
          y >= area.y && y < area.y + area.h) {
        return zone;
      }
    }
  }
  return null;
}

/**
 * Get zone by ID
 */
export function getZoneById(id: string): ZoneDefinition | null {
  return ZONE_DATA[id] || null;
}

/**
 * Check if player is under-leveled for a zone
 */
export function isUnderLeveledForZone(playerLevel: number, zone: ZoneDefinition): boolean {
  return playerLevel < zone.minLevel;
}

/**
 * Get warning message if player is under-leveled
 */
export function getZoneLevelWarning(playerLevel: number, zone: ZoneDefinition): string | null {
  if (playerLevel < zone.minLevel) {
    const diff = zone.minLevel - playerLevel;
    if (diff >= 5) {
      return `Danger! This area is far too dangerous for you (Lvl ${zone.minLevel}+)`;
    } else if (diff >= 3) {
      return `Warning: This area is very dangerous for your level (Lvl ${zone.minLevel}+)`;
    } else {
      return `Caution: This area is meant for level ${zone.minLevel}+`;
    }
  }
  return null;
}
