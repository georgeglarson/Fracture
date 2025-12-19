/**
 * Game Constants Type Definitions
 *
 * Strongly typed constants for messages, entities, and orientations.
 * This replaces the `any` type on the Types object in gametypes.ts.
 */

// ============================================================================
// Message Types
// ============================================================================

export interface MessageTypes {
  readonly HELLO: 0;
  readonly WELCOME: 1;
  readonly SPAWN: 2;
  readonly DESPAWN: 3;
  readonly MOVE: 4;
  readonly LOOTMOVE: 5;
  readonly AGGRO: 6;
  readonly ATTACK: 7;
  readonly HIT: 8;
  readonly HURT: 9;
  readonly HEALTH: 10;
  readonly CHAT: 11;
  readonly LOOT: 12;
  readonly EQUIP: 13;
  readonly DROP: 14;
  readonly TELEPORT: 15;
  readonly DAMAGE: 16;
  readonly POPULATION: 17;
  readonly KILL: 18;
  readonly LIST: 19;
  readonly WHO: 20;
  readonly ZONE: 21;
  readonly DESTROY: 22;
  readonly HP: 23;
  readonly BLINK: 24;
  readonly OPEN: 25;
  readonly CHECK: 26;
  readonly NPCTALK: 27;
  readonly NPCTALK_RESPONSE: 28;
  readonly COMPANION_HINT: 29;
  readonly QUEST_OFFER: 30;
  readonly QUEST_STATUS: 31;
  readonly QUEST_COMPLETE: 32;
  readonly ITEM_LORE: 33;
  readonly REQUEST_QUEST: 34;
  readonly NARRATOR: 35;
  readonly ENTITY_THOUGHT: 36;
  readonly WORLD_EVENT: 37;
  readonly NEWS_REQUEST: 38;
  readonly NEWS_RESPONSE: 39;
  readonly DROP_ITEM: 40;
  readonly XP_GAIN: 41;
  readonly LEVEL_UP: 42;
  readonly GOLD_GAIN: 43;
  readonly DAILY_CHECK: 44;
  readonly DAILY_REWARD: 45;
  readonly SHOP_OPEN: 46;
  readonly SHOP_BUY: 47;
  readonly SHOP_BUY_RESULT: 48;
  readonly ACHIEVEMENT_INIT: 49;
  readonly ACHIEVEMENT_SELECT_TITLE: 50;
  readonly ACHIEVEMENT_UNLOCK: 51;
  readonly ACHIEVEMENT_PROGRESS: 52;
  readonly PLAYER_TITLE_UPDATE: 53;
  readonly PARTY_INVITE: 54;
  readonly PARTY_INVITE_RECEIVED: 55;
  readonly PARTY_ACCEPT: 56;
  readonly PARTY_DECLINE: 57;
  readonly PARTY_JOIN: 58;
  readonly PARTY_LEAVE: 59;
  readonly PARTY_KICK: 60;
  readonly PARTY_DISBAND: 61;
  readonly PARTY_UPDATE: 62;
  readonly PARTY_CHAT: 63;
  readonly PLAYER_INSPECT: 64;
  readonly PLAYER_INSPECT_RESULT: 65;
  readonly INVENTORY_INIT: 66;
  readonly INVENTORY_ADD: 67;
  readonly INVENTORY_REMOVE: 68;
  readonly INVENTORY_UPDATE: 69;
  readonly INVENTORY_USE: 70;
  readonly INVENTORY_EQUIP: 71;
  readonly INVENTORY_DROP: 72;
  readonly INVENTORY_SWAP: 73;
  readonly INVENTORY_PICKUP: 74;
  readonly ZONE_ENTER: 75;
  readonly ZONE_INFO: 76;
  readonly SHOP_SELL: 77;
  readonly SHOP_SELL_RESULT: 78;
  readonly LEADERBOARD_REQUEST: 79;
  readonly LEADERBOARD_RESPONSE: 80;
  readonly BOSS_KILL: 81;
  readonly KILL_STREAK: 82;
  readonly KILL_STREAK_ENDED: 83;
  readonly NEMESIS_POWER_UP: 84;
  readonly NEMESIS_KILLED: 85;
  readonly AUTH_FAIL: 86;
  readonly UNEQUIP_TO_INVENTORY: 87;

  // Skill messages
  readonly SKILL_USE: 88;
  readonly SKILL_EFFECT: 89;
  readonly SKILL_COOLDOWN: 90;
  readonly SKILL_UNLOCK: 91;
  readonly SKILL_INIT: 92;

  // Progression messages
  readonly PROGRESSION_INIT: 93;
  readonly PROGRESSION_ASCEND: 94;
  readonly PROGRESSION_UPDATE: 95;
  readonly ASCEND_REQUEST: 96;

  // Fracture Rift messages
  readonly RIFT_ENTER: 97;
  readonly RIFT_START: 98;
  readonly RIFT_PROGRESS: 99;
  readonly RIFT_ADVANCE: 100;
  readonly RIFT_END: 101;
  readonly RIFT_EXIT: 102;
  readonly RIFT_LEADERBOARD: 103;
  readonly RIFT_LEADERBOARD_REQ: 104;
}

/** All valid message type values */
export type MessageTypeValue = MessageTypes[keyof MessageTypes];

// ============================================================================
// Entity Types
// ============================================================================

export interface EntityTypes {
  // Player
  readonly WARRIOR: 1;

  // Mobs
  readonly RAT: 2;
  readonly SKELETON: 3;
  readonly GOBLIN: 4;
  readonly OGRE: 5;
  readonly SPECTRE: 6;
  readonly CRAB: 7;
  readonly BAT: 8;
  readonly WIZARD: 9;
  readonly EYE: 10;
  readonly SNAKE: 11;
  readonly SKELETON2: 12;
  readonly BOSS: 13;
  readonly DEATHKNIGHT: 14;
  readonly ZOMBIE: 15;
  readonly ZOMBIEGIRL: 16;
  readonly ZOMAGENT: 17;

  // Armors
  readonly FIREFOX: 20;
  readonly CLOTHARMOR: 21;
  readonly LEATHERARMOR: 22;
  readonly MAILARMOR: 23;
  readonly PLATEARMOR: 24;
  readonly REDARMOR: 25;
  readonly GOLDENARMOR: 26;

  // Objects
  readonly FLASK: 35;
  readonly BURGER: 36;
  readonly CHEST: 37;
  readonly FIREPOTION: 38;
  readonly CAKE: 39;

  // NPCs
  readonly GUARD: 40;
  readonly KING: 41;
  readonly OCTOCAT: 42;
  readonly VILLAGEGIRL: 43;
  readonly VILLAGER: 44;
  readonly PRIEST: 45;
  readonly SCIENTIST: 46;
  readonly AGENT: 47;
  readonly RICK: 48;
  readonly NYAN: 49;
  readonly SORCERER: 50;
  readonly BEACHNPC: 51;
  readonly FORESTNPC: 52;
  readonly DESERTNPC: 53;
  readonly LAVANPC: 54;
  readonly CODER: 55;

  // Weapons
  readonly SWORD1: 60;
  readonly SWORD2: 61;
  readonly REDSWORD: 62;
  readonly GOLDENSWORD: 63;
  readonly MORNINGSTAR: 64;
  readonly AXE: 65;
  readonly BLUESWORD: 66;

  // Zone-themed chests
  readonly CHEST_CRATE: 70;
  readonly CHEST_LOG: 71;
  readonly CHEST_STONE: 72;
  readonly CHEST_URN: 73;
  readonly CHEST_OBSIDIAN: 74;
  readonly CHEST_GLITCH: 75;

  // Dimension Weapons - Tech/Cyber
  readonly RAYGUN: 80;
  readonly LASERGUN: 81;
  readonly MP5: 82;
  readonly TEC9: 83;
  readonly PLASMAHELIX: 84;

  // Dimension Weapons - Cosmic/Void
  readonly TENTACLE: 85;
  readonly VOIDBLADE: 86;
  readonly CRYSTALSTAFF: 87;

  // Dimension Armor - Tech/Cyber
  readonly HAZMATSUIT: 90;
  readonly MECHARMOR: 91;
  readonly SHIELDBUBBLE: 92;

  // Dimension Armor - Cosmic/Void
  readonly VOIDCLOAK: 93;
  readonly CRYSTALSHELL: 94;

  // Equipment Set Items - Weapons
  readonly BERSERKER_BLADE: 100;
  readonly GUARDIAN_HAMMER: 101;
  readonly SHADOW_DAGGER: 102;
  readonly DRAGON_SWORD: 103;

  // Equipment Set Items - Armor
  readonly BERSERKER_MAIL: 110;
  readonly GUARDIAN_PLATE: 111;
  readonly SHADOW_CLOAK: 112;
  readonly DRAGON_SCALE: 113;

  // Legendary Items - Weapons
  readonly GREEDS_EDGE: 120;
  readonly DRAGONBONE_CLEAVER: 121;
  readonly VOIDHEART_BLADE: 122;
  readonly SOUL_HARVESTER: 123;

  // Legendary Items - Armor
  readonly CROWN_UNDYING: 130;
  readonly HELLFIRE_MANTLE: 131;

  // Special Objects
  readonly RIFT_PORTAL: 140;
}

/** All valid entity kind values */
export type EntityKind = EntityTypes[keyof EntityTypes];

// ============================================================================
// Orientation Types
// ============================================================================

export interface OrientationTypes {
  readonly UP: 1;
  readonly DOWN: 2;
  readonly LEFT: 3;
  readonly RIGHT: 4;
}

/** All valid orientation values */
export type Orientation = OrientationTypes[keyof OrientationTypes];

// ============================================================================
// Entity Category Types
// ============================================================================

export type EntityCategory = 'player' | 'mob' | 'npc' | 'weapon' | 'armor' | 'object';

/** Kind registry entry: [entityKind, category] */
export type KindEntry = readonly [number, EntityCategory];

/** Map of entity name to [kind, category] */
export type KindsRegistry = Record<string, KindEntry>;

// ============================================================================
// Zone Types
// ============================================================================

export type ZoneId = 'village' | 'beach' | 'forest' | 'cave' | 'desert' | 'lavaland' | 'boss';

// ============================================================================
// Types Object Interface
// ============================================================================

/**
 * GameTypes interface - the main Types object shape.
 *
 * Note: Helper functions accept `number` for backward compatibility
 * with untyped code. As more code is migrated, callers should use
 * EntityKind for type safety.
 */
export interface GameTypes {
  readonly Messages: MessageTypes;
  readonly Entities: EntityTypes;
  readonly Orientations: OrientationTypes;

  // Ranked arrays
  readonly rankedWeapons: readonly number[];
  readonly rankedArmors: readonly number[];

  // Helper functions - accept number for gradual migration
  getWeaponRank(weaponKind: number): number;
  getArmorRank(armorKind: number): number;
  isPlayer(kind: number): boolean;
  isMob(kind: number): boolean;
  isNpc(kind: number): boolean;
  isCharacter(kind: number): boolean;
  isArmor(kind: number): boolean;
  isWeapon(kind: number): boolean;
  isObject(kind: number): boolean;
  isChest(kind: number): boolean;
  isItem(kind: number): boolean;
  isHealingItem(kind: number): boolean;
  isExpendableItem(kind: number): boolean;
  getChestKindForZone(zone: ZoneId | string): number;
  getKindFromString(kind: string): number | undefined;
  getKindAsString(kind: number): string | undefined;
  forEachKind(callback: (kind: number, kindName: string) => void): void;
  forEachArmor(callback: (kind: number, kindName: string) => void): void;
  forEachMobOrNpcKind(callback: (kind: number, kindName: string) => void): void;
  forEachArmorKind(callback: (kind: number, kindName: string) => void): void;
  getOrientationAsString(orientation: number): string | undefined;
  getRandomItemKind(item?: unknown): number;
  getMessageTypeAsString(type: number): string;
}
