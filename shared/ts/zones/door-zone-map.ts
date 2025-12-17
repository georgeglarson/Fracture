/**
 * Door to Zone Mapping
 *
 * Maps door positions (world coordinates) to their target interior zone IDs.
 * Only interior doors (those with tcx/tcy in map data) are included.
 *
 * Key format: "x_y" (door world position)
 * Value: Interior zone ID from interior-zones.ts
 */

/**
 * Mapping of door positions to interior zone IDs
 * Format: "doorX_doorY" -> "interior_zone_id"
 */
export const DOOR_TO_ZONE: Record<string, string> = {
  // ============================================
  // VILLAGE DOORS (y: 195-253)
  // ============================================

  // Village house 1 - at (80, 211) -> camera (148, 306)
  '80_211': 'interior_village_house_1',

  // Village shop - at (51, 205) -> camera (147, 138)
  '51_205': 'interior_village_shop',

  // Village house 2 - at (77, 206) -> camera (119, 138)
  '77_206': 'interior_village_house_2',

  // Village house 3 - at (27, 209) -> camera (148, 281)
  '27_209': 'interior_village_house_3',

  // ============================================
  // BEACH DOORS (y: 253-314)
  // ============================================

  // Beach portal 1 - at (77, 237) -> camera (72, 231)
  '77_237': 'interior_beach_portal_1',

  // Beach portal 2 - at (82, 234) -> camera (65, 235)
  '82_234': 'interior_beach_portal_2',

  // Beach house 1 - at (26, 296) -> camera (120, 162)
  '26_296': 'interior_beach_house_1',

  // Beach house 2 - at (25, 292) -> camera (120, 157)
  '25_292': 'interior_beach_house_2',

  // Beach house 3 - at (38, 245) -> camera (120, 294)
  '38_245': 'interior_beach_house_3',

  // ============================================
  // FOREST DOORS (y: 145-195)
  // ============================================

  // Forest cabin - at (20, 145) -> camera (151, 115)
  '20_145': 'interior_forest_cabin',

  // Forest lodge - at (74, 145) -> camera (149, 211)
  '74_145': 'interior_forest_lodge',

  // Forest house - at (78, 137) -> camera (149, 291)
  '78_137': 'interior_forest_house',

  // ============================================
  // CAVE DOORS (y: 100-145)
  // ============================================

  // Cave chamber 1 - at (65, 125) -> camera (120, 115)
  '65_125': 'interior_cave_chamber_1',

  // Cave hideout - at (18, 113) -> camera (148, 15)
  '18_113': 'interior_cave_hideout',

  // Cave chamber 2 - at (79, 102) and (75, 102) -> camera (120, 270)
  '79_102': 'interior_cave_chamber_2',
  '75_102': 'interior_cave_chamber_2',

  // Cave dungeon - at (49, 97) -> camera (151, 259)
  '49_97': 'interior_cave_dungeon',

  // Cave teleporter destination - at (147, 254) -> camera (28, 90)
  '147_254': 'interior_cave_teleporter',

  // ============================================
  // DESERT DOORS (y: 60-100)
  // ============================================

  // Desert ruin 1 - at (18, 86) -> camera (149, 236)
  '18_86': 'interior_desert_ruin_1',

  // Desert ruin 2 - at (19, 77) -> camera (123, 236)
  '19_77': 'interior_desert_ruin_2',

  // Desert fortress - at (70, 80) -> camera (155, 31)
  '70_80': 'interior_desert_fortress',

  // ============================================
  // LAVALAND DOORS (y: 0-60)
  // ============================================

  // Lava chamber 1 - at (79, 45) -> camera (89, 50)
  '79_45': 'interior_lava_chamber_1',

  // Lava forge - at (78, 40) -> camera (112, 91)
  '78_40': 'interior_lava_forge',

  // Lava sanctum - at (91, 29) -> camera (125, 86)
  '91_29': 'interior_lava_sanctum',

  // Lava portal - at (117, 94) -> camera (72, 40)
  '117_94': 'interior_lava_portal',

  // Lava tower 1 - at (6, 10) -> camera (149, 180)
  '6_10': 'interior_lava_tower_1',

  // Lava tower 2 - at (9, 17) -> camera (149, 185)
  '9_17': 'interior_lava_tower_2',

  // Lava citadel - at (104, 7) -> camera (148, 157)
  '104_7': 'interior_lava_citadel',

  // Lava throne - at (71, 3) -> camera (148, 65)
  '71_3': 'interior_lava_throne',

  // ============================================
  // CAVE COMPLEX DOORS (multi-room dungeon)
  // ============================================

  // Cave complex 1 - at (158, 208) -> camera (120, 210)
  '158_208': 'interior_cave_complex_1',

  // Cave complex 2 - at (152, 202) -> camera (120, 205)
  '152_202': 'interior_cave_complex_2',

  // ============================================
  // BOSS AREA DOORS
  // ============================================

  // Boss antechamber - at (143, 26) -> camera (49, 75)
  '143_26': 'interior_boss_antechamber',

  // Boss portal - at (53, 76) -> camera (140, 27)
  '53_76': 'interior_boss_portal_1',

  // Boss portal chain entries
  '158_35': 'interior_boss_portal_2',
  '148_32': 'interior_boss_portal_3',
  '155_29': 'interior_boss_portal_4',
  '142_32': 'interior_boss_arena'
};

/**
 * Get the interior zone ID for a door at the given position
 * @param x Door X position (world grid)
 * @param y Door Y position (world grid)
 * @returns Interior zone ID or null if not an interior door
 */
export function getInteriorZoneForDoor(x: number, y: number): string | null {
  const key = `${x}_${y}`;
  return DOOR_TO_ZONE[key] || null;
}

/**
 * Check if a door leads to an interior
 */
export function isInteriorDoor(x: number, y: number): boolean {
  return getInteriorZoneForDoor(x, y) !== null;
}

/**
 * Get all door positions that lead to a specific interior zone
 */
export function getDoorsForZone(zoneId: string): Array<{ x: number; y: number }> {
  const doors: Array<{ x: number; y: number }> = [];
  for (const [key, value] of Object.entries(DOOR_TO_ZONE)) {
    if (value === zoneId) {
      const [x, y] = key.split('_').map(Number);
      doors.push({ x, y });
    }
  }
  return doors;
}
