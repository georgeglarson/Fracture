/**
 * Game Types - Core constants and helper functions
 *
 * This module defines:
 * - Message type IDs (network protocol)
 * - Entity kind IDs (players, mobs, items, NPCs)
 * - Orientation constants
 * - Helper functions for type checking and lookups
 */

import * as _ from 'lodash';
import type {
  GameTypes,
  EntityCategory,
  KindsRegistry,
  ZoneId
} from './domain/game-constants';

// Re-export types for convenience
export type { EntityKind, Orientation, ZoneId, EntityCategory } from './domain/game-constants';

// ============================================================================
// Message Types - Network Protocol
// ============================================================================

const Messages = {
  HELLO: 0,
  WELCOME: 1,
  SPAWN: 2,
  DESPAWN: 3,
  MOVE: 4,
  LOOTMOVE: 5,
  AGGRO: 6,
  ATTACK: 7,
  HIT: 8,
  HURT: 9,
  HEALTH: 10,
  CHAT: 11,
  LOOT: 12,
  EQUIP: 13,
  DROP: 14,
  TELEPORT: 15,
  DAMAGE: 16,
  POPULATION: 17,
  KILL: 18,
  LIST: 19,
  WHO: 20,
  ZONE: 21,
  DESTROY: 22,
  HP: 23,
  BLINK: 24,
  OPEN: 25,
  CHECK: 26,
  NPCTALK: 27,
  NPCTALK_RESPONSE: 28,
  COMPANION_HINT: 29,
  QUEST_OFFER: 30,
  QUEST_STATUS: 31,
  QUEST_COMPLETE: 32,
  ITEM_LORE: 33,
  REQUEST_QUEST: 34,
  NARRATOR: 35,
  ENTITY_THOUGHT: 36,
  WORLD_EVENT: 37,
  NEWS_REQUEST: 38,
  NEWS_RESPONSE: 39,
  DROP_ITEM: 40,
  XP_GAIN: 41,
  LEVEL_UP: 42,
  GOLD_GAIN: 43,
  DAILY_CHECK: 44,
  DAILY_REWARD: 45,
  SHOP_OPEN: 46,
  SHOP_BUY: 47,
  SHOP_BUY_RESULT: 48,
  ACHIEVEMENT_INIT: 49,
  ACHIEVEMENT_SELECT_TITLE: 50,
  ACHIEVEMENT_UNLOCK: 51,
  ACHIEVEMENT_PROGRESS: 52,
  PLAYER_TITLE_UPDATE: 53,
  PARTY_INVITE: 54,
  PARTY_INVITE_RECEIVED: 55,
  PARTY_ACCEPT: 56,
  PARTY_DECLINE: 57,
  PARTY_JOIN: 58,
  PARTY_LEAVE: 59,
  PARTY_KICK: 60,
  PARTY_DISBAND: 61,
  PARTY_UPDATE: 62,
  PARTY_CHAT: 63,
  PLAYER_INSPECT: 64,
  PLAYER_INSPECT_RESULT: 65,
  INVENTORY_INIT: 66,
  INVENTORY_ADD: 67,
  INVENTORY_REMOVE: 68,
  INVENTORY_UPDATE: 69,
  INVENTORY_USE: 70,
  INVENTORY_EQUIP: 71,
  INVENTORY_DROP: 72,
  INVENTORY_SWAP: 73,
  INVENTORY_PICKUP: 74,
  ZONE_ENTER: 75,
  ZONE_INFO: 76,
  SHOP_SELL: 77,
  SHOP_SELL_RESULT: 78,
  LEADERBOARD_REQUEST: 79,
  LEADERBOARD_RESPONSE: 80,
  BOSS_KILL: 81,
  KILL_STREAK: 82,
  KILL_STREAK_ENDED: 83,
  NEMESIS_POWER_UP: 84,
  NEMESIS_KILLED: 85,
  AUTH_FAIL: 86,
  UNEQUIP_TO_INVENTORY: 87,

  // Skill messages
  SKILL_USE: 88,           // Client -> Server: Player uses a skill
  SKILL_EFFECT: 89,        // Server -> Client: Skill visual effect for all players
  SKILL_COOLDOWN: 90,      // Server -> Client: Cooldown update
  SKILL_UNLOCK: 91,        // Server -> Client: New skill unlocked
  SKILL_INIT: 92,          // Server -> Client: Initial skill state on login

  // Progression messages
  PROGRESSION_INIT: 93,    // Server -> Client: Progression state on login
  PROGRESSION_ASCEND: 94,  // Server -> Client: Player ascended
  PROGRESSION_UPDATE: 95,  // Server -> Client: Efficiency/rested update
  ASCEND_REQUEST: 96       // Client -> Server: Player requests ascension
} as const;

// ============================================================================
// Entity Types
// ============================================================================

const Entities = {
  // Player
  WARRIOR: 1,

  // Mobs
  RAT: 2,
  SKELETON: 3,
  GOBLIN: 4,
  OGRE: 5,
  SPECTRE: 6,
  CRAB: 7,
  BAT: 8,
  WIZARD: 9,
  EYE: 10,
  SNAKE: 11,
  SKELETON2: 12,
  BOSS: 13,
  DEATHKNIGHT: 14,
  ZOMBIE: 15,
  ZOMBIEGIRL: 16,
  ZOMAGENT: 17,

  // Armors
  FIREFOX: 20,
  CLOTHARMOR: 21,
  LEATHERARMOR: 22,
  MAILARMOR: 23,
  PLATEARMOR: 24,
  REDARMOR: 25,
  GOLDENARMOR: 26,

  // Objects
  FLASK: 35,
  BURGER: 36,
  CHEST: 37,
  FIREPOTION: 38,
  CAKE: 39,

  // NPCs
  GUARD: 40,
  KING: 41,
  OCTOCAT: 42,
  VILLAGEGIRL: 43,
  VILLAGER: 44,
  PRIEST: 45,
  SCIENTIST: 46,
  AGENT: 47,
  RICK: 48,
  NYAN: 49,
  SORCERER: 50,
  BEACHNPC: 51,
  FORESTNPC: 52,
  DESERTNPC: 53,
  LAVANPC: 54,
  CODER: 55,

  // Weapons
  SWORD1: 60,
  SWORD2: 61,
  REDSWORD: 62,
  GOLDENSWORD: 63,
  MORNINGSTAR: 64,
  AXE: 65,
  BLUESWORD: 66,

  // Zone-themed chests
  CHEST_CRATE: 70,
  CHEST_LOG: 71,
  CHEST_STONE: 72,
  CHEST_URN: 73,
  CHEST_OBSIDIAN: 74,
  CHEST_GLITCH: 75,

  // Dimension Weapons - Tech/Cyber
  RAYGUN: 80,
  LASERGUN: 81,
  MP5: 82,
  TEC9: 83,
  PLASMAHELIX: 84,

  // Dimension Weapons - Cosmic/Void
  TENTACLE: 85,
  VOIDBLADE: 86,
  CRYSTALSTAFF: 87,

  // Dimension Armor - Tech/Cyber
  HAZMATSUIT: 90,
  MECHARMOR: 91,
  SHIELDBUBBLE: 92,

  // Dimension Armor - Cosmic/Void
  VOIDCLOAK: 93,
  CRYSTALSHELL: 94,

  // Equipment Set Items - Weapons
  BERSERKER_BLADE: 100,
  GUARDIAN_HAMMER: 101,
  SHADOW_DAGGER: 102,
  DRAGON_SWORD: 103,

  // Equipment Set Items - Armor
  BERSERKER_MAIL: 110,
  GUARDIAN_PLATE: 111,
  SHADOW_CLOAK: 112,
  DRAGON_SCALE: 113
} as const;

// ============================================================================
// Orientations
// ============================================================================

const Orientations = {
  UP: 1,
  DOWN: 2,
  LEFT: 3,
  RIGHT: 4
} as const;

// ============================================================================
// Kind Registry - Maps entity names to [kind, category]
// ============================================================================

const kinds: KindsRegistry = {
  warrior: [Entities.WARRIOR, 'player'],

  rat: [Entities.RAT, 'mob'],
  skeleton: [Entities.SKELETON, 'mob'],
  goblin: [Entities.GOBLIN, 'mob'],
  ogre: [Entities.OGRE, 'mob'],
  spectre: [Entities.SPECTRE, 'mob'],
  deathknight: [Entities.DEATHKNIGHT, 'mob'],
  crab: [Entities.CRAB, 'mob'],
  snake: [Entities.SNAKE, 'mob'],
  bat: [Entities.BAT, 'mob'],
  wizard: [Entities.WIZARD, 'mob'],
  eye: [Entities.EYE, 'mob'],
  skeleton2: [Entities.SKELETON2, 'mob'],
  boss: [Entities.BOSS, 'mob'],
  zombie: [Entities.ZOMBIE, 'mob'],
  zombiegirl: [Entities.ZOMBIEGIRL, 'mob'],
  zomagent: [Entities.ZOMAGENT, 'mob'],

  sword1: [Entities.SWORD1, 'weapon'],
  sword2: [Entities.SWORD2, 'weapon'],
  axe: [Entities.AXE, 'weapon'],
  redsword: [Entities.REDSWORD, 'weapon'],
  bluesword: [Entities.BLUESWORD, 'weapon'],
  goldensword: [Entities.GOLDENSWORD, 'weapon'],
  morningstar: [Entities.MORNINGSTAR, 'weapon'],

  raygun: [Entities.RAYGUN, 'weapon'],
  lasergun: [Entities.LASERGUN, 'weapon'],
  mp5: [Entities.MP5, 'weapon'],
  tec9: [Entities.TEC9, 'weapon'],
  plasmahelix: [Entities.PLASMAHELIX, 'weapon'],

  tentacle: [Entities.TENTACLE, 'weapon'],
  voidblade: [Entities.VOIDBLADE, 'weapon'],
  crystalstaff: [Entities.CRYSTALSTAFF, 'weapon'],

  berserkerblade: [Entities.BERSERKER_BLADE, 'weapon'],
  guardianhammer: [Entities.GUARDIAN_HAMMER, 'weapon'],
  shadowdagger: [Entities.SHADOW_DAGGER, 'weapon'],
  dragonsword: [Entities.DRAGON_SWORD, 'weapon'],

  firefox: [Entities.FIREFOX, 'armor'],
  clotharmor: [Entities.CLOTHARMOR, 'armor'],
  leatherarmor: [Entities.LEATHERARMOR, 'armor'],
  mailarmor: [Entities.MAILARMOR, 'armor'],
  platearmor: [Entities.PLATEARMOR, 'armor'],
  redarmor: [Entities.REDARMOR, 'armor'],
  goldenarmor: [Entities.GOLDENARMOR, 'armor'],

  hazmatsuit: [Entities.HAZMATSUIT, 'armor'],
  mecharmor: [Entities.MECHARMOR, 'armor'],
  shieldbubble: [Entities.SHIELDBUBBLE, 'armor'],

  voidcloak: [Entities.VOIDCLOAK, 'armor'],
  crystalshell: [Entities.CRYSTALSHELL, 'armor'],

  berserkermail: [Entities.BERSERKER_MAIL, 'armor'],
  guardianplate: [Entities.GUARDIAN_PLATE, 'armor'],
  shadowcloak: [Entities.SHADOW_CLOAK, 'armor'],
  dragonscale: [Entities.DRAGON_SCALE, 'armor'],

  flask: [Entities.FLASK, 'object'],
  cake: [Entities.CAKE, 'object'],
  burger: [Entities.BURGER, 'object'],
  chest: [Entities.CHEST, 'object'],
  firepotion: [Entities.FIREPOTION, 'object'],

  chestcrate: [Entities.CHEST_CRATE, 'object'],
  chestlog: [Entities.CHEST_LOG, 'object'],
  cheststone: [Entities.CHEST_STONE, 'object'],
  chesturn: [Entities.CHEST_URN, 'object'],
  chestobsidian: [Entities.CHEST_OBSIDIAN, 'object'],
  chestglitch: [Entities.CHEST_GLITCH, 'object'],

  guard: [Entities.GUARD, 'npc'],
  villagegirl: [Entities.VILLAGEGIRL, 'npc'],
  villager: [Entities.VILLAGER, 'npc'],
  coder: [Entities.CODER, 'npc'],
  scientist: [Entities.SCIENTIST, 'npc'],
  priest: [Entities.PRIEST, 'npc'],
  king: [Entities.KING, 'npc'],
  rick: [Entities.RICK, 'npc'],
  nyan: [Entities.NYAN, 'npc'],
  sorcerer: [Entities.SORCERER, 'npc'],
  agent: [Entities.AGENT, 'npc'],
  octocat: [Entities.OCTOCAT, 'npc'],
  beachnpc: [Entities.BEACHNPC, 'npc'],
  forestnpc: [Entities.FORESTNPC, 'npc'],
  desertnpc: [Entities.DESERTNPC, 'npc'],
  lavanpc: [Entities.LAVANPC, 'npc']
};

// ============================================================================
// Ranked Equipment Arrays
// ============================================================================

const rankedWeapons = [
  Entities.SWORD1,
  Entities.SWORD2,
  Entities.AXE,
  Entities.TEC9,
  Entities.MORNINGSTAR,
  Entities.MP5,
  Entities.RAYGUN,
  Entities.BLUESWORD,
  Entities.TENTACLE,
  Entities.LASERGUN,
  Entities.REDSWORD,
  Entities.CRYSTALSTAFF,
  Entities.VOIDBLADE,
  Entities.PLASMAHELIX,
  Entities.GOLDENSWORD,
  // Set Weapons (high tier)
  Entities.BERSERKER_BLADE,
  Entities.GUARDIAN_HAMMER,
  Entities.SHADOW_DAGGER,
  Entities.DRAGON_SWORD
] as const;

const rankedArmors = [
  Entities.CLOTHARMOR,
  Entities.LEATHERARMOR,
  Entities.HAZMATSUIT,
  Entities.MAILARMOR,
  Entities.VOIDCLOAK,
  Entities.PLATEARMOR,
  Entities.SHIELDBUBBLE,
  Entities.REDARMOR,
  Entities.CRYSTALSHELL,
  Entities.MECHARMOR,
  Entities.GOLDENARMOR,
  // Set Armors (high tier)
  Entities.BERSERKER_MAIL,
  Entities.GUARDIAN_PLATE,
  Entities.SHADOW_CLOAK,
  Entities.DRAGON_SCALE
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

function getTypeFromKind(kind: number): EntityCategory | undefined {
  const kindStr = getKindAsString(kind);
  return kindStr && kinds[kindStr] ? kinds[kindStr][1] : undefined;
}

function getKindAsString(kind: number): string | undefined {
  for (const k in kinds) {
    if (kinds[k][0] === kind) {
      return k;
    }
  }
  return undefined;
}

function getKindFromString(kind: string): number | undefined {
  if (kind in kinds) {
    return kinds[kind][0];
  }
  return undefined;
}

function isPlayer(kind: number): boolean {
  return getTypeFromKind(kind) === 'player';
}

function isMob(kind: number): boolean {
  return getTypeFromKind(kind) === 'mob';
}

function isNpc(kind: number): boolean {
  return getTypeFromKind(kind) === 'npc';
}

function isCharacter(kind: number): boolean {
  return isMob(kind) || isNpc(kind) || isPlayer(kind);
}

function isArmor(kind: number): boolean {
  return getTypeFromKind(kind) === 'armor';
}

function isWeapon(kind: number): boolean {
  return getTypeFromKind(kind) === 'weapon';
}

function isObject(kind: number): boolean {
  return getTypeFromKind(kind) === 'object';
}

function isChest(kind: number): boolean {
  return kind === Entities.CHEST
    || kind === Entities.CHEST_CRATE
    || kind === Entities.CHEST_LOG
    || kind === Entities.CHEST_STONE
    || kind === Entities.CHEST_URN
    || kind === Entities.CHEST_OBSIDIAN
    || kind === Entities.CHEST_GLITCH;
}

function isItem(kind: number): boolean {
  return isWeapon(kind) || isArmor(kind) || (isObject(kind) && !isChest(kind));
}

function isHealingItem(kind: number): boolean {
  return kind === Entities.FLASK || kind === Entities.BURGER;
}

function isExpendableItem(kind: number): boolean {
  return isHealingItem(kind) || kind === Entities.FIREPOTION || kind === Entities.CAKE;
}

function getChestKindForZone(zone: string): number {
  const zoneChests: Record<string, number> = {
    'village': Entities.CHEST_CRATE,
    'beach': Entities.CHEST,
    'forest': Entities.CHEST_LOG,
    'cave': Entities.CHEST_STONE,
    'desert': Entities.CHEST_URN,
    'lavaland': Entities.CHEST_OBSIDIAN,
    'boss': Entities.CHEST_GLITCH
  };
  return zoneChests[zone] || Entities.CHEST;
}

function getWeaponRank(weaponKind: number): number {
  return _.indexOf(rankedWeapons as unknown as number[], weaponKind);
}

function getArmorRank(armorKind: number): number {
  return _.indexOf(rankedArmors as unknown as number[], armorKind);
}

function forEachKind(callback: (kind: number, kindName: string) => void): void {
  for (const k in kinds) {
    callback(kinds[k][0], k);
  }
}

function forEachArmor(callback: (kind: number, kindName: string) => void): void {
  forEachKind((kind, kindName) => {
    if (isArmor(kind)) {
      callback(kind, kindName);
    }
  });
}

function forEachMobOrNpcKind(callback: (kind: number, kindName: string) => void): void {
  forEachKind((kind, kindName) => {
    if (isMob(kind) || isNpc(kind)) {
      callback(kind, kindName);
    }
  });
}

function forEachArmorKind(callback: (kind: number, kindName: string) => void): void {
  forEachKind((kind, kindName) => {
    if (isArmor(kind)) {
      callback(kind, kindName);
    }
  });
}

function getOrientationAsString(orientation: number): string | undefined {
  switch (orientation) {
    case Orientations.LEFT: return 'left';
    case Orientations.RIGHT: return 'right';
    case Orientations.UP: return 'up';
    case Orientations.DOWN: return 'down';
    default: return undefined;
  }
}

function getRandomItemKind(): number {
  const all = _.union(rankedWeapons as unknown as number[], rankedArmors as unknown as number[]);
  const forbidden = [Entities.SWORD1, Entities.CLOTHARMOR];
  const itemKinds = _.difference(all, forbidden);
  const i = Math.floor(Math.random() * itemKinds.length);
  return itemKinds[i];
}

function getMessageTypeAsString(type: number): string {
  for (const name of Object.keys(Messages)) {
    if (Messages[name as keyof typeof Messages] === type) {
      return name;
    }
  }
  return 'UNKNOWN';
}

// ============================================================================
// Export Types Object
// ============================================================================

/**
 * Core game constants and helper functions.
 *
 * This is the central registry for all game type information.
 * Use Types.Entities.X, Types.Messages.X, etc.
 */
export const Types: GameTypes = {
  Messages,
  Entities,
  Orientations,
  rankedWeapons: rankedWeapons as unknown as readonly number[],
  rankedArmors: rankedArmors as unknown as readonly number[],
  getWeaponRank,
  getArmorRank,
  isPlayer,
  isMob,
  isNpc,
  isCharacter,
  isArmor,
  isWeapon,
  isObject,
  isChest,
  isItem,
  isHealingItem,
  isExpendableItem,
  getChestKindForZone,
  getKindFromString,
  getKindAsString,
  forEachKind,
  forEachArmor,
  forEachMobOrNpcKind,
  forEachArmorKind,
  getOrientationAsString,
  getRandomItemKind,
  getMessageTypeAsString
};
