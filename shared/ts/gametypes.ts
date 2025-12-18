import * as _ from 'lodash';

export const Types: any = {
  Messages: {
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

    // Venice AI Integration
    NPCTALK: 27,
    NPCTALK_RESPONSE: 28,
    COMPANION_HINT: 29,
    QUEST_OFFER: 30,
    QUEST_STATUS: 31,
    QUEST_COMPLETE: 32,
    ITEM_LORE: 33,
    REQUEST_QUEST: 34,
    NARRATOR: 35,  // Dynamic AI narrator commentary
    ENTITY_THOUGHT: 36,  // AI thought bubbles above entities
    WORLD_EVENT: 37,  // Faction director announcements
    NEWS_REQUEST: 38,  // Player requests town crier newspaper
    NEWS_RESPONSE: 39,  // Server sends newspaper headlines
    DROP_ITEM: 40,  // Player drops currently equipped item
    XP_GAIN: 41,    // Player gains XP [41, amount, currentXP, xpToNext]
    LEVEL_UP: 42,   // Player levels up [42, newLevel, bonusHP, bonusDamage]
    GOLD_GAIN: 43,  // Player gains gold [43, amount, totalGold]
    DAILY_CHECK: 44,   // Client sends lastLoginDate to check daily [44, lastLoginDate]
    DAILY_REWARD: 45,  // Server sends daily reward [45, gold, xp, streak, isNewDay]

    // Shop system
    SHOP_OPEN: 46,     // Server sends shop inventory [46, npcKind, shopName, items[{itemKind, price, stock}]]
    SHOP_BUY: 47,      // Client requests purchase [47, npcKind, itemKind]
    SHOP_BUY_RESULT: 48, // Server confirms purchase [48, success, itemKind, newGold, message]

    // Achievement system
    ACHIEVEMENT_INIT: 49,         // Server sends achievement state on connect [49, unlocked[], progress{}, selectedTitle]
    ACHIEVEMENT_SELECT_TITLE: 50, // Client selects title [50, achievementId or null]
    ACHIEVEMENT_UNLOCK: 51,       // Server notifies achievement unlocked [51, achievementId]
    ACHIEVEMENT_PROGRESS: 52,     // Server sends progress update [52, achievementId, current, target]
    PLAYER_TITLE_UPDATE: 53,      // Server broadcasts title change [53, playerId, title or null]

    // Party system
    PARTY_INVITE: 54,             // Client: [54, targetPlayerId]
    PARTY_INVITE_RECEIVED: 55,    // Server: [55, inviterId, inviterName]
    PARTY_ACCEPT: 56,             // Client: [56, inviterId]
    PARTY_DECLINE: 57,            // Client: [57, inviterId]
    PARTY_JOIN: 58,               // Server: [58, partyId, members[], leaderId]
    PARTY_LEAVE: 59,              // Client: [59] / Server: [59, playerId]
    PARTY_KICK: 60,               // Client: [60, targetId]
    PARTY_DISBAND: 61,            // Server: [61]
    PARTY_UPDATE: 62,             // Server: [62, members[]]
    PARTY_CHAT: 63,               // Client: [63, msg] / Server: [63, senderId, name, msg]

    // Player inspect
    PLAYER_INSPECT: 64,           // Client: [64, targetId]
    PLAYER_INSPECT_RESULT: 65,    // Server: [65, id, name, title, level, weapon, armor]

    // Inventory system
    INVENTORY_INIT: 66,           // Server: [66, slots[]]
    INVENTORY_ADD: 67,            // Server: [67, slotIndex, kind, properties, count]
    INVENTORY_REMOVE: 68,         // Server: [68, slotIndex]
    INVENTORY_UPDATE: 69,         // Server: [69, slotIndex, count]
    INVENTORY_USE: 70,            // Client: [70, slotIndex]
    INVENTORY_EQUIP: 71,          // Client: [71, slotIndex]
    INVENTORY_DROP: 72,           // Client: [72, slotIndex]
    INVENTORY_SWAP: 73,           // Client: [73, fromSlot, toSlot]
    INVENTORY_PICKUP: 74,         // Client: [74, itemEntityId]

    // Zone system
    ZONE_ENTER: 75,               // Server: [75, zoneId, zoneName, minLevel, maxLevel, warning?]
    ZONE_INFO: 76,                // Server: [76, zoneId, rarityBonus, goldBonus, xpBonus]

    // Shop sell system
    SHOP_SELL: 77,                // Client: [77, inventorySlot]
    SHOP_SELL_RESULT: 78,         // Server: [78, success, goldGained, newGold, message]

    // Boss leaderboard system
    LEADERBOARD_REQUEST: 79,      // Client: [79]
    LEADERBOARD_RESPONSE: 80,     // Server: [80, entries[{rank, name, kills}]]
    BOSS_KILL: 81,                // Server: [81, bossName, killerName] - broadcast

    // Kill streak system
    KILL_STREAK: 82,              // Server: [82, playerId, playerName, streakCount, tierTitle, announcement]
    KILL_STREAK_ENDED: 83,        // Server: [83, playerId, playerName, streakCount, endedByName]

    // Nemesis system
    NEMESIS_POWER_UP: 84,         // Server: [84, mobId, originalName, nemesisName, title, powerLevel, kills, victimName]
    NEMESIS_KILLED: 85,           // Server: [85, mobId, nemesisName, title, kills, killerName, isRevenge]

    // Authentication
    AUTH_FAIL: 86,                // Server: [86, reason] - "wrong_password" | "name_taken"

    // Unequip to inventory
    UNEQUIP_TO_INVENTORY: 87      // Client: [87, slot] - slot is "weapon" or "armor"
  },

  Entities: {
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
    CHEST_CRATE: 70,    // Village - wooden crate
    CHEST_LOG: 71,      // Forest - hollow log
    CHEST_STONE: 72,    // Cave - stone coffer
    CHEST_URN: 73,      // Desert - clay urn
    CHEST_OBSIDIAN: 74, // Lavaland - obsidian chest
    CHEST_GLITCH: 75,   // Boss - reality-glitched container

    // Dimension Weapons - Tech/Cyber (from fractured realities)
    RAYGUN: 80,         // Tech dimension - energy pistol
    LASERGUN: 81,       // Tech dimension - laser rifle
    MP5: 82,            // Modern dimension - submachine gun
    TEC9: 83,           // Modern dimension - machine pistol
    PLASMAHELIX: 84,    // Energy dimension - plasma weapon

    // Dimension Weapons - Cosmic/Void
    TENTACLE: 85,       // Void dimension - eldritch appendage
    VOIDBLADE: 86,      // Void dimension - darkness-infused blade
    CRYSTALSTAFF: 87,   // Mystic dimension - arcane focus

    // Dimension Armor - Tech/Cyber
    HAZMATSUIT: 90,     // Tech dimension - hazardous material protection
    MECHARMOR: 91,      // Tech dimension - mechanical exosuit
    SHIELDBUBBLE: 92,   // Energy dimension - force field generator

    // Dimension Armor - Cosmic/Void
    VOIDCLOAK: 93,      // Void dimension - shadow wrappings
    CRYSTALSHELL: 94    // Mystic dimension - crystalline carapace
  },

  Orientations: {
    UP: 1,
    DOWN: 2,
    LEFT: 3,
    RIGHT: 4
  }
};

var kinds: Record<string, any[]> = {
  warrior: [Types.Entities.WARRIOR, 'player'],

  rat: [Types.Entities.RAT, 'mob'],
  skeleton: [Types.Entities.SKELETON, 'mob'],
  goblin: [Types.Entities.GOBLIN, 'mob'],
  ogre: [Types.Entities.OGRE, 'mob'],
  spectre: [Types.Entities.SPECTRE, 'mob'],
  deathknight: [Types.Entities.DEATHKNIGHT, 'mob'],
  crab: [Types.Entities.CRAB, 'mob'],
  snake: [Types.Entities.SNAKE, 'mob'],
  bat: [Types.Entities.BAT, 'mob'],
  wizard: [Types.Entities.WIZARD, 'mob'],
  eye: [Types.Entities.EYE, 'mob'],
  skeleton2: [Types.Entities.SKELETON2, 'mob'],
  boss: [Types.Entities.BOSS, 'mob'],
  zombie: [Types.Entities.ZOMBIE, 'mob'],
  zombiegirl: [Types.Entities.ZOMBIEGIRL, 'mob'],
  zomagent: [Types.Entities.ZOMAGENT, 'mob'],

  sword1: [Types.Entities.SWORD1, 'weapon'],
  sword2: [Types.Entities.SWORD2, 'weapon'],
  axe: [Types.Entities.AXE, 'weapon'],
  redsword: [Types.Entities.REDSWORD, 'weapon'],
  bluesword: [Types.Entities.BLUESWORD, 'weapon'],
  goldensword: [Types.Entities.GOLDENSWORD, 'weapon'],
  morningstar: [Types.Entities.MORNINGSTAR, 'weapon'],

  // Dimension weapons - tech/cyber
  raygun: [Types.Entities.RAYGUN, 'weapon'],
  lasergun: [Types.Entities.LASERGUN, 'weapon'],
  mp5: [Types.Entities.MP5, 'weapon'],
  tec9: [Types.Entities.TEC9, 'weapon'],
  plasmahelix: [Types.Entities.PLASMAHELIX, 'weapon'],

  // Dimension weapons - cosmic/void
  tentacle: [Types.Entities.TENTACLE, 'weapon'],
  voidblade: [Types.Entities.VOIDBLADE, 'weapon'],
  crystalstaff: [Types.Entities.CRYSTALSTAFF, 'weapon'],

  firefox: [Types.Entities.FIREFOX, 'armor'],
  clotharmor: [Types.Entities.CLOTHARMOR, 'armor'],
  leatherarmor: [Types.Entities.LEATHERARMOR, 'armor'],
  mailarmor: [Types.Entities.MAILARMOR, 'armor'],
  platearmor: [Types.Entities.PLATEARMOR, 'armor'],
  redarmor: [Types.Entities.REDARMOR, 'armor'],
  goldenarmor: [Types.Entities.GOLDENARMOR, 'armor'],

  // Dimension armor - tech/cyber
  hazmatsuit: [Types.Entities.HAZMATSUIT, 'armor'],
  mecharmor: [Types.Entities.MECHARMOR, 'armor'],
  shieldbubble: [Types.Entities.SHIELDBUBBLE, 'armor'],

  // Dimension armor - cosmic/void
  voidcloak: [Types.Entities.VOIDCLOAK, 'armor'],
  crystalshell: [Types.Entities.CRYSTALSHELL, 'armor'],

  flask: [Types.Entities.FLASK, 'object'],
  cake: [Types.Entities.CAKE, 'object'],
  burger: [Types.Entities.BURGER, 'object'],
  chest: [Types.Entities.CHEST, 'object'],
  firepotion: [Types.Entities.FIREPOTION, 'object'],

  // Zone-themed chests
  chestcrate: [Types.Entities.CHEST_CRATE, 'object'],
  chestlog: [Types.Entities.CHEST_LOG, 'object'],
  cheststone: [Types.Entities.CHEST_STONE, 'object'],
  chesturn: [Types.Entities.CHEST_URN, 'object'],
  chestobsidian: [Types.Entities.CHEST_OBSIDIAN, 'object'],
  chestglitch: [Types.Entities.CHEST_GLITCH, 'object'],

  guard: [Types.Entities.GUARD, 'npc'],
  villagegirl: [Types.Entities.VILLAGEGIRL, 'npc'],
  villager: [Types.Entities.VILLAGER, 'npc'],
  coder: [Types.Entities.CODER, 'npc'],
  scientist: [Types.Entities.SCIENTIST, 'npc'],
  priest: [Types.Entities.PRIEST, 'npc'],
  king: [Types.Entities.KING, 'npc'],
  rick: [Types.Entities.RICK, 'npc'],
  nyan: [Types.Entities.NYAN, 'npc'],
  sorcerer: [Types.Entities.SORCERER, 'npc'],
  agent: [Types.Entities.AGENT, 'npc'],
  octocat: [Types.Entities.OCTOCAT, 'npc'],
  beachnpc: [Types.Entities.BEACHNPC, 'npc'],
  forestnpc: [Types.Entities.FORESTNPC, 'npc'],
  desertnpc: [Types.Entities.DESERTNPC, 'npc'],
  lavanpc: [Types.Entities.LAVANPC, 'npc']
};

// Helper function to get entity type from kind
function getTypeFromKind(kind: number): string | undefined {
  const kindStr = Types.getKindAsString(kind);
  return kindStr && kinds[kindStr] ? kinds[kindStr][1] : undefined;
}

// Weapons ranked by power tier (fantasy → dimension)
// Tier 1-3: Fantasy basics
// Tier 4-5: Mid-tier (fantasy + early dimension)
// Tier 6-8: High-tier (dimension weapons)
Types.rankedWeapons = [
  Types.Entities.SWORD1,        // Tier 1: Starter
  Types.Entities.SWORD2,        // Tier 2: Basic upgrade
  Types.Entities.AXE,           // Tier 3: Early mid
  Types.Entities.TEC9,          // Tier 3.5: Modern dimension entry
  Types.Entities.MORNINGSTAR,   // Tier 4: Mid-tier fantasy
  Types.Entities.MP5,           // Tier 4.5: Modern dimension mid
  Types.Entities.RAYGUN,        // Tier 5: Tech dimension entry
  Types.Entities.BLUESWORD,     // Tier 5: Mid-high fantasy
  Types.Entities.TENTACLE,      // Tier 5.5: Void dimension
  Types.Entities.LASERGUN,      // Tier 6: Tech dimension high
  Types.Entities.REDSWORD,      // Tier 6: High fantasy
  Types.Entities.CRYSTALSTAFF,  // Tier 6.5: Mystic dimension
  Types.Entities.VOIDBLADE,     // Tier 7: Void dimension high
  Types.Entities.PLASMAHELIX,   // Tier 7.5: Energy dimension
  Types.Entities.GOLDENSWORD    // Tier 8: Legendary
];

// Armor ranked by defense tier
Types.rankedArmors = [
  Types.Entities.CLOTHARMOR,    // Tier 1: Starter
  Types.Entities.LEATHERARMOR,  // Tier 2: Basic
  Types.Entities.HAZMATSUIT,    // Tier 3: Tech dimension entry
  Types.Entities.MAILARMOR,     // Tier 3: Mid fantasy
  Types.Entities.VOIDCLOAK,     // Tier 4: Void dimension
  Types.Entities.PLATEARMOR,    // Tier 4: Mid-high fantasy
  Types.Entities.SHIELDBUBBLE,  // Tier 5: Energy dimension
  Types.Entities.REDARMOR,      // Tier 5: High fantasy
  Types.Entities.CRYSTALSHELL,  // Tier 6: Mystic dimension
  Types.Entities.MECHARMOR,     // Tier 6.5: Tech dimension high
  Types.Entities.GOLDENARMOR    // Tier 7: Legendary
];

Types.getWeaponRank = function (weaponKind: number): number {
  return _.indexOf(Types.rankedWeapons, weaponKind);
};

Types.getArmorRank = function (armorKind: number): number {
  return _.indexOf(Types.rankedArmors, armorKind);
};

Types.isPlayer = function (kind: number): boolean {
  return getTypeFromKind(kind) === 'player';
};

Types.isMob = function (kind: number): boolean {
  return getTypeFromKind(kind) === 'mob';
};

Types.isNpc = function (kind: number): boolean {
  return getTypeFromKind(kind) === 'npc';
};

Types.isCharacter = function (kind: number): boolean {
  return Types.isMob(kind) || Types.isNpc(kind) || Types.isPlayer(kind);
};

Types.isArmor = function (kind: number): boolean {
  return getTypeFromKind(kind) === 'armor';
};

Types.isWeapon = function (kind: number): boolean {
  return getTypeFromKind(kind) === 'weapon';
};

Types.isObject = function (kind: number): boolean {
  return getTypeFromKind(kind) === 'object';
};

Types.isChest = function (kind: number): boolean {
  return kind === Types.Entities.CHEST
    || kind === Types.Entities.CHEST_CRATE
    || kind === Types.Entities.CHEST_LOG
    || kind === Types.Entities.CHEST_STONE
    || kind === Types.Entities.CHEST_URN
    || kind === Types.Entities.CHEST_OBSIDIAN
    || kind === Types.Entities.CHEST_GLITCH;
};

// Map zone IDs to chest types
Types.getChestKindForZone = function (zone: string): number {
  const zoneChests: Record<string, number> = {
    'village': Types.Entities.CHEST_CRATE,
    'beach': Types.Entities.CHEST,        // Keep gold chest for beach (transitional)
    'forest': Types.Entities.CHEST_LOG,
    'cave': Types.Entities.CHEST_STONE,
    'desert': Types.Entities.CHEST_URN,
    'lavaland': Types.Entities.CHEST_OBSIDIAN,
    'boss': Types.Entities.CHEST_GLITCH
  };
  return zoneChests[zone] || Types.Entities.CHEST;
};

Types.isItem = function (kind: number): boolean {
  return Types.isWeapon(kind)
    || Types.isArmor(kind)
    || (Types.isObject(kind) && !Types.isChest(kind));
};

Types.isHealingItem = function (kind: number): boolean {
  return kind === Types.Entities.FLASK
    || kind === Types.Entities.BURGER;
};

Types.isExpendableItem = function (kind: number): boolean {
  return Types.isHealingItem(kind)
    || kind === Types.Entities.FIREPOTION
    || kind === Types.Entities.CAKE;
};

Types.getKindFromString = function (kind: string): number | undefined {
  if (kind in kinds) {
    return kinds[kind][0];
  }
  return undefined;
};

Types.getKindAsString = function (kind: number): string | undefined {
  for (var k in kinds) {
    if (kinds[k][0] === kind) {
      return k;
    }
  }
  return undefined;
};

Types.forEachKind = function (callback: (kind: number, kindName: string) => void): void {
  for (var k in kinds) {
    callback(kinds[k][0], k);
  }
};

Types.forEachArmor = function (callback: (kind: number, kindName: string) => void): void {
  Types.forEachKind(function (kind: number, kindName: string) {
    if (Types.isArmor(kind)) {
      callback(kind, kindName);
    }
  });
};

Types.forEachMobOrNpcKind = function (callback: (kind: number, kindName: string) => void): void {
  Types.forEachKind(function (kind: number, kindName: string) {
    if (Types.isMob(kind) || Types.isNpc(kind)) {
      callback(kind, kindName);
    }
  });
};

Types.forEachArmorKind = function (callback: (kind: number, kindName: string) => void): void {
  Types.forEachKind(function (kind: number, kindName: string) {
    if (Types.isArmor(kind)) {
      callback(kind, kindName);
    }
  });
};

Types.getOrientationAsString = function (orientation: number): string | undefined {
  let normalized: string | undefined;
  switch (orientation) {
    case Types.Orientations.LEFT:
      normalized = 'left';
      break;
    case Types.Orientations.RIGHT:
      normalized = 'right';
      break;
    case Types.Orientations.UP:
      normalized = 'up';
      break;
    case Types.Orientations.DOWN:
      normalized = 'down';
      break;
  }

  return normalized;
};

Types.getRandomItemKind = function (item: any): number {
  var all = _.union(Types.rankedWeapons, Types.rankedArmors),
    forbidden = [Types.Entities.SWORD1, Types.Entities.CLOTHARMOR],
    itemKinds = _.difference(all, forbidden),
    i = Math.floor(Math.random() * _.size(itemKinds));

  return itemKinds[i];
};

Types.getMessageTypeAsString = function (type: number): string {
  var typeName: string | undefined;
  for (const name of Object.keys(Types.Messages)) {
    if ((Types.Messages as Record<string, number>)[name] === type) {
      typeName = name;
      break;
    }
  }
  if (!typeName) {
    typeName = 'UNKNOWN';
  }
  return typeName;
};
