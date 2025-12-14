/**
 * Zone Boss Configuration
 *
 * Defines unique bosses for each zone with their stats, behavior, and spawn areas.
 * Each boss uses an existing mob sprite but with boss-level stats.
 */

import { Types } from '../../shared/ts/gametypes';
import { ZONE_DATA } from '../../shared/ts/zones/zone-data';

export interface ZoneBossConfig {
  id: string;           // Unique boss identifier
  name: string;         // Display name for announcements
  kind: number;         // Entity type (sprite)
  zoneId: string;       // Zone where this boss spawns

  // Combat stats
  hp: number;           // Base HP (before player scaling)
  damage: number;       // Base damage
  armor: number;        // Damage reduction

  // Behavior
  aggroRange: number;   // Tiles to detect players
  roamSpeed: number;    // Movement speed modifier (1.0 = normal)

  // Spawn config
  respawnTime: number;  // Milliseconds between respawns

  // Loot multipliers
  xpMultiplier: number;
  goldMultiplier: number;
  dropBonus: number;    // Extra rarity chance

  // Announcement flavor
  spawnTitle: string;
  spawnMessage: string;
}

// Zone boss definitions - one per zone (excluding village which is safe)
export const ZONE_BOSSES: ZoneBossConfig[] = [
  {
    id: 'giant_crab',
    name: 'Giant Crab',
    kind: Types.Entities.CRAB,
    zoneId: 'beach',
    hp: 300,
    damage: 20,
    armor: 5,
    aggroRange: 6,
    roamSpeed: 0.8,
    respawnTime: 45000,  // 45 seconds
    xpMultiplier: 3,
    goldMultiplier: 2.5,
    dropBonus: 0.15,
    spawnTitle: 'The Giant Crab Emerges!',
    spawnMessage: 'A massive crustacean crawls from the depths, its claws gleaming in the sun.'
  },
  {
    id: 'goblin_warlord',
    name: 'Goblin Warlord',
    kind: Types.Entities.GOBLIN,
    zoneId: 'forest',
    hp: 500,
    damage: 35,
    armor: 10,
    aggroRange: 7,
    roamSpeed: 1.0,
    respawnTime: 60000,  // 1 minute
    xpMultiplier: 4,
    goldMultiplier: 3,
    dropBonus: 0.2,
    spawnTitle: 'The Goblin Warlord Arrives!',
    spawnMessage: 'A cunning goblin commander emerges from the shadows, rallying its brethren.'
  },
  {
    id: 'bone_dragon',
    name: 'Bone Dragon',
    kind: Types.Entities.SKELETON2,
    zoneId: 'cave',
    hp: 800,
    damage: 50,
    armor: 15,
    aggroRange: 8,
    roamSpeed: 0.9,
    respawnTime: 90000,  // 1.5 minutes
    xpMultiplier: 5,
    goldMultiplier: 4,
    dropBonus: 0.25,
    spawnTitle: 'The Bone Dragon Awakens!',
    spawnMessage: 'Ancient bones rattle to life as a skeletal terror rises from the depths.'
  },
  {
    id: 'sand_wurm',
    name: 'Sand Wurm',
    kind: Types.Entities.SNAKE,
    zoneId: 'desert',
    hp: 1000,
    damage: 65,
    armor: 20,
    aggroRange: 9,
    roamSpeed: 1.1,
    respawnTime: 120000,  // 2 minutes
    xpMultiplier: 6,
    goldMultiplier: 5,
    dropBonus: 0.3,
    spawnTitle: 'The Sand Wurm Surfaces!',
    spawnMessage: 'The ground trembles as a colossal serpent bursts from the dunes.'
  },
  {
    id: 'demon_lord',
    name: 'Demon Lord',
    kind: Types.Entities.SPECTRE,
    zoneId: 'lavaland',
    hp: 1500,
    damage: 85,
    armor: 25,
    aggroRange: 10,
    roamSpeed: 1.0,
    respawnTime: 180000,  // 3 minutes
    xpMultiplier: 8,
    goldMultiplier: 6,
    dropBonus: 0.35,
    spawnTitle: 'The Demon Lord Descends!',
    spawnMessage: 'Fire and shadow coalesce as a lord of the underworld manifests.'
  },
  {
    id: 'skeleton_king',
    name: 'Skeleton King',
    kind: Types.Entities.BOSS,
    zoneId: 'boss',
    hp: 2500,
    damage: 100,
    armor: 30,
    aggroRange: 12,
    roamSpeed: 0.9,
    respawnTime: 300000,  // 5 minutes
    xpMultiplier: 10,
    goldMultiplier: 8,
    dropBonus: 0.5,
    spawnTitle: 'The Skeleton King Has Risen!',
    spawnMessage: 'A powerful undead lord roams the land, hunting all who cross its path.'
  }
];

/**
 * Get boss config for a specific zone
 */
export function getBossForZone(zoneId: string): ZoneBossConfig | null {
  return ZONE_BOSSES.find(b => b.zoneId === zoneId) || null;
}

/**
 * Get random spawn position within a zone
 */
export function getZoneSpawnPosition(zoneId: string): { x: number; y: number } | null {
  const zone = ZONE_DATA[zoneId];
  if (!zone || zone.areas.length === 0) return null;

  // Pick a random area within the zone
  const area = zone.areas[Math.floor(Math.random() * zone.areas.length)];

  // Pick a random position within that area (with margin)
  const margin = 2;
  const x = area.x + margin + Math.floor(Math.random() * (area.w - margin * 2));
  const y = area.y + margin + Math.floor(Math.random() * (area.h - margin * 2));

  return { x, y };
}

/**
 * Get all boss configs
 */
export function getAllBossConfigs(): ZoneBossConfig[] {
  return [...ZONE_BOSSES];
}
