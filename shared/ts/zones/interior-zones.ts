/**
 * Interior Zone Definitions
 *
 * Auto-generated from door data with camera positions (tcx/tcy).
 * Each interior zone has explicit bounds and viewport configuration.
 *
 * Naming convention: interior_{parentZone}_{descriptive_name}
 * Bounds default to 11x9 (standard interior viewport) but can be customized.
 */

import { ZoneDefinition } from './zone-data';

/**
 * Default interior viewport dimensions (tiles)
 * Most interiors fit within this size
 */
export const DEFAULT_INTERIOR_WIDTH = 11;
export const DEFAULT_INTERIOR_HEIGHT = 9;

/**
 * Create a standard interior zone definition
 */
function createInterior(
  id: string,
  name: string,
  cameraX: number,
  cameraY: number,
  parentZone: string,
  description: string = '',
  width: number = DEFAULT_INTERIOR_WIDTH,
  height: number = DEFAULT_INTERIOR_HEIGHT
): ZoneDefinition {
  // Get parent zone bonuses (inherit from parent)
  return {
    id,
    name,
    description: description || `Interior in ${parentZone}`,
    type: 'interior',
    minLevel: 1,
    maxLevel: 50,
    // Interior zones inherit bonuses from parent (applied at runtime)
    rarityBonus: 0,
    goldBonus: 0,
    xpBonus: 0,
    armorDropBonus: 0,
    weaponDropBonus: 0,
    areas: [{ x: cameraX, y: cameraY, w: width, h: height }],
    viewport: { width, height, cameraX, cameraY },
    parentZone
  };
}

/**
 * All interior zone definitions
 * Key format: "interior_{zone}_{description}" or camera-based ID
 */
export const INTERIOR_ZONES: Record<string, ZoneDefinition> = {
  // ============================================
  // VILLAGE INTERIORS (y: 195-253)
  // ============================================

  // Village house 1 - Entry at (80, 211)
  'interior_village_house_1': createInterior(
    'interior_village_house_1',
    'Village House',
    148, 306,
    'village',
    'A modest dwelling in The Refuge.'
  ),

  // Village shop - Entry at (51, 205)
  'interior_village_shop': createInterior(
    'interior_village_shop',
    'Village Shop',
    147, 138,
    'village',
    'A merchant shop in The Refuge.'
  ),

  // Village house 2 - Entry at (77, 206)
  'interior_village_house_2': createInterior(
    'interior_village_house_2',
    'Village Cottage',
    119, 138,
    'village',
    'A small cottage in The Refuge.'
  ),

  // Village house 3 - Entry at (27, 209)
  'interior_village_house_3': createInterior(
    'interior_village_house_3',
    'Western Dwelling',
    148, 281,
    'village',
    'A house on the western edge of The Refuge.'
  ),

  // ============================================
  // BEACH INTERIORS (y: 253-314)
  // ============================================

  // Beach village portal chambers - Entry at (77, 237) and (82, 234)
  'interior_beach_portal_1': createInterior(
    'interior_beach_portal_1',
    'Portal Chamber',
    72, 231,
    'beach',
    'A mysterious portal chamber.'
  ),

  'interior_beach_portal_2': createInterior(
    'interior_beach_portal_2',
    'Portal Nexus',
    65, 235,
    'beach',
    'The central portal nexus.'
  ),

  // Beach house - Entry at (26, 296)
  'interior_beach_house_1': createInterior(
    'interior_beach_house_1',
    'Coastal Shack',
    120, 162,
    'beach',
    'A small shack near the shore.'
  ),

  // Beach house 2 - Entry at (25, 292)
  'interior_beach_house_2': createInterior(
    'interior_beach_house_2',
    'Fisher\'s Hut',
    120, 157,
    'beach',
    'A fisherman\'s humble dwelling.'
  ),

  // Beach house 3 - Entry at (38, 245)
  'interior_beach_house_3': createInterior(
    'interior_beach_house_3',
    'Beachside Cottage',
    120, 294,
    'beach',
    'A cottage near the beach.'
  ),

  // ============================================
  // FOREST INTERIORS (y: 145-195)
  // ============================================

  // Forest cabin - Entry at (20, 145)
  'interior_forest_cabin': createInterior(
    'interior_forest_cabin',
    'Forest Cabin',
    151, 115,
    'forest',
    'An abandoned cabin in Glitch Woods.'
  ),

  // Forest structure - Entry at (74, 145)
  'interior_forest_lodge': createInterior(
    'interior_forest_lodge',
    'Woodland Lodge',
    149, 211,
    'forest',
    'A hunter\'s lodge deep in the forest.'
  ),

  // Forest house - Entry at (78, 137)
  'interior_forest_house': createInterior(
    'interior_forest_house',
    'Forest Dwelling',
    149, 291,
    'forest',
    'A dwelling nestled in the woods.'
  ),

  // ============================================
  // CAVE INTERIORS (y: 100-145)
  // ============================================

  // Cave entrance - Entry at (65, 125)
  'interior_cave_chamber_1': createInterior(
    'interior_cave_chamber_1',
    'Underground Chamber',
    120, 115,
    'cave',
    'A chamber in The Underdepths.'
  ),

  // Cave building - Entry at (18, 113)
  'interior_cave_hideout': createInterior(
    'interior_cave_hideout',
    'Hidden Hideout',
    148, 15,
    'cave',
    'A secret hideout in the caves.'
  ),

  // Cave rooms - Entry at (79, 102) and (75, 102)
  'interior_cave_chamber_2': createInterior(
    'interior_cave_chamber_2',
    'Deep Chamber',
    120, 270,
    'cave',
    'A chamber deep within the caves.'
  ),

  // Cave dungeon - Entry at (49, 97)
  'interior_cave_dungeon': createInterior(
    'interior_cave_dungeon',
    'Cave Dungeon',
    151, 259,
    'cave',
    'An ancient dungeon beneath the surface.'
  ),

  // ============================================
  // DESERT INTERIORS (y: 60-100)
  // ============================================

  // Desert building 1 - Entry at (18, 86)
  'interior_desert_ruin_1': createInterior(
    'interior_desert_ruin_1',
    'Desert Ruin',
    149, 236,
    'desert',
    'Crumbling ruins in The Null Zone.'
  ),

  // Desert building 2 - Entry at (19, 77)
  'interior_desert_ruin_2': createInterior(
    'interior_desert_ruin_2',
    'Sunken Temple',
    123, 236,
    'desert',
    'A half-buried temple.'
  ),

  // Desert building 3 - Entry at (70, 80)
  'interior_desert_fortress': createInterior(
    'interior_desert_fortress',
    'Desert Fortress',
    155, 31,
    'desert',
    'An ancient fortification.'
  ),

  // ============================================
  // LAVALAND INTERIORS (y: 0-60)
  // ============================================

  // Lava chamber - Entry at (79, 45)
  'interior_lava_chamber_1': createInterior(
    'interior_lava_chamber_1',
    'Magma Chamber',
    89, 50,
    'lavaland',
    'A chamber above the molten core.'
  ),

  // Lava building - Entry at (78, 40)
  'interior_lava_forge': createInterior(
    'interior_lava_forge',
    'The Forge',
    112, 91,
    'lavaland',
    'An ancient forge powered by volcanic heat.'
  ),

  // Lava structure - Entry at (91, 29)
  'interior_lava_sanctum': createInterior(
    'interior_lava_sanctum',
    'Fire Sanctum',
    125, 86,
    'lavaland',
    'A sacred chamber of flame.'
  ),

  // Lava portal - Entry at (117, 94)
  'interior_lava_portal': createInterior(
    'interior_lava_portal',
    'Dimensional Rift',
    72, 40,
    'lavaland',
    'A tear in reality itself.'
  ),

  // Northern lava buildings
  'interior_lava_tower_1': createInterior(
    'interior_lava_tower_1',
    'Obsidian Tower',
    149, 180,
    'lavaland',
    'A tower of volcanic glass.'
  ),

  'interior_lava_tower_2': createInterior(
    'interior_lava_tower_2',
    'Ember Spire',
    149, 185,
    'lavaland',
    'A spire wreathed in eternal flame.'
  ),

  // Northern fortress - Entry at (104, 7)
  'interior_lava_citadel': createInterior(
    'interior_lava_citadel',
    'Core Citadel',
    148, 157,
    'lavaland',
    'The heart of the breach.'
  ),

  // Far north - Entry at (71, 3)
  'interior_lava_throne': createInterior(
    'interior_lava_throne',
    'Throne of Ash',
    148, 65,
    'lavaland',
    'Where the old king once ruled.'
  ),

  // ============================================
  // CAVE DUNGEON COMPLEX (multi-room system)
  // ============================================

  // Cave multi-room complex entries
  'interior_cave_complex_1': createInterior(
    'interior_cave_complex_1',
    'Dungeon Entrance',
    120, 210,
    'cave',
    'Entrance to the dungeon complex.'
  ),

  'interior_cave_complex_2': createInterior(
    'interior_cave_complex_2',
    'Dungeon Hall',
    120, 205,
    'cave',
    'A hall within the dungeon.'
  ),

  // ============================================
  // SPECIAL INTERIORS
  // ============================================

  // Cave teleporter destination - Entry at (147, 254)
  'interior_cave_teleporter': createInterior(
    'interior_cave_teleporter',
    'Ancient Teleporter',
    28, 90,
    'cave',
    'A mysterious teleportation chamber.'
  ),

  // Boss area portals
  'interior_boss_antechamber': createInterior(
    'interior_boss_antechamber',
    'Architect\'s Antechamber',
    49, 75,
    'boss',
    'The approach to Reality\'s Edge.'
  ),

  'interior_boss_portal_1': createInterior(
    'interior_boss_portal_1',
    'Reality Shard',
    140, 27,
    'boss',
    'A fragment of stable reality.'
  ),

  'interior_boss_portal_2': createInterior(
    'interior_boss_portal_2',
    'Void Fragment',
    142, 28,
    'boss',
    'A piece of the void.'
  ),

  'interior_boss_portal_3': createInterior(
    'interior_boss_portal_3',
    'Chaos Pocket',
    148, 26,
    'boss',
    'A pocket of pure chaos.'
  ),

  'interior_boss_portal_4': createInterior(
    'interior_boss_portal_4',
    'Order Nexus',
    140, 26,
    'boss',
    'A nexus of order.'
  ),

  'interior_boss_arena': createInterior(
    'interior_boss_arena',
    'The Fracture\'s Heart',
    155, 31,
    'boss',
    'Where reality ends.'
  )
};

/**
 * Get an interior zone by ID
 */
export function getInteriorZone(id: string): ZoneDefinition | null {
  return INTERIOR_ZONES[id] || null;
}

/**
 * Get all interior zone IDs
 */
export function getInteriorZoneIds(): string[] {
  return Object.keys(INTERIOR_ZONES);
}
