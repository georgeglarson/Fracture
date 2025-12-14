/**
 * Zone definitions with metadata for progression and loot modifiers
 */

export interface ZoneBounds {
  x: number;
  y: number;
  w: number;
  h: number;
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
}

// Zone definitions with progression from south (village) to north (boss)
export const ZONE_DATA: Record<string, ZoneDefinition> = {
  village: {
    id: 'village',
    name: 'Village',
    description: 'A peaceful starting town',
    minLevel: 1,
    maxLevel: 3,
    rarityBonus: 0,
    goldBonus: 0,
    xpBonus: 0,
    armorDropBonus: 0,
    weaponDropBonus: 0,
    areas: [
      { x: 1, y: 195, w: 84, h: 58 }
    ]
  },

  beach: {
    id: 'beach',
    name: 'Sandy Beach',
    description: 'Crabs roam the shoreline',
    minLevel: 2,
    maxLevel: 5,
    rarityBonus: 0.05,      // +5% rarity
    goldBonus: 0.1,         // +10% gold
    xpBonus: 0.05,
    armorDropBonus: 0,
    weaponDropBonus: 0.05,
    areas: [
      { x: 2, y: 265, w: 84, h: 37 },
      { x: 112, y: 156, w: 30, h: 16 }
    ]
  },

  forest: {
    id: 'forest',
    name: 'Dark Forest',
    description: 'Goblins lurk among the trees',
    minLevel: 3,
    maxLevel: 7,
    rarityBonus: 0.1,       // +10% rarity
    goldBonus: 0.15,
    xpBonus: 0.1,
    armorDropBonus: 0.1,    // +10% armor drops
    weaponDropBonus: 0,
    areas: [
      { x: 4, y: 145, w: 81, h: 36 }
    ]
  },

  cave: {
    id: 'cave',
    name: 'Caverns',
    description: 'Dark tunnels filled with skeletons',
    minLevel: 7,
    maxLevel: 12,
    rarityBonus: 0.15,      // +15% rarity
    goldBonus: 0.2,
    xpBonus: 0.15,
    armorDropBonus: 0.15,   // Caves are good for armor
    weaponDropBonus: 0.1,
    areas: [
      { x: 112, y: 193, w: 58, h: 50 },
      { x: 110, y: 104, w: 60, h: 20 }
    ]
  },

  desert: {
    id: 'desert',
    name: 'Scorched Desert',
    description: 'A harsh wasteland with deadly creatures',
    minLevel: 10,
    maxLevel: 15,
    rarityBonus: 0.2,       // +20% rarity
    goldBonus: 0.25,
    xpBonus: 0.2,
    armorDropBonus: 0.1,
    weaponDropBonus: 0.15,  // Good for weapons
    areas: [
      { x: 4, y: 71, w: 81, h: 62 },
      { x: 140, y: 24, w: 30, h: 16 },
      { x: 113, y: 250, w: 57, h: 27 },
      { x: 150, y: 14, w: 10, h: 8 }
    ]
  },

  lavaland: {
    id: 'lavaland',
    name: 'Lavaland',
    description: 'Rivers of molten fire and demons',
    minLevel: 15,
    maxLevel: 35,
    rarityBonus: 0.3,       // +30% rarity
    goldBonus: 0.35,
    xpBonus: 0.3,
    armorDropBonus: 0.2,
    weaponDropBonus: 0.25,  // Best loot
    areas: [
      { x: 1, y: 1, w: 113, h: 60 },
      { x: 110, y: 81, w: 60, h: 20 },
      { x: 145, y: 156, w: 20, h: 16 },
      { x: 146, y: 176, w: 20, h: 16 }
    ]
  },

  boss: {
    id: 'boss',
    name: 'Skeleton King\'s Lair',
    description: 'The final challenge awaits',
    minLevel: 25,
    maxLevel: 50,
    rarityBonus: 0.5,       // +50% rarity - best drops
    goldBonus: 0.5,
    xpBonus: 0.5,
    armorDropBonus: 0.3,
    weaponDropBonus: 0.3,
    areas: [
      { x: 140, y: 48, w: 29, h: 25 }
    ]
  }
};

// Zone progression order (for level warnings)
export const ZONE_PROGRESSION = ['village', 'beach', 'forest', 'cave', 'desert', 'lavaland', 'boss'];

/**
 * Get zone at a given position
 */
export function getZoneAtPosition(x: number, y: number): ZoneDefinition | null {
  for (const zoneId of Object.keys(ZONE_DATA)) {
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
