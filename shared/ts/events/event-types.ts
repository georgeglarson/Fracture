/**
 * Game Event Type Definitions
 *
 * Strongly-typed events for the EventBus system.
 * All game events should be defined here for type safety.
 */

// ============ Entity Events ============

export interface EntitySpawnedEvent {
  entityId: number;
  entityType: number;
  x: number;
  y: number;
  name?: string;
}

export interface EntityDespawnedEvent {
  entityId: number;
  entityType: number;
}

export interface EntityMovedEvent {
  entityId: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// ============ Combat Events ============

export interface MobKilledEvent {
  mobId: number;
  mobType: number;
  mobName: string;
  killerId: number;
  killerName: string;
  x: number;
  y: number;
  /** Total kills of this mob type by this player */
  killCount?: number;
}

export interface PlayerDamagedEvent {
  playerId: number;
  playerName: string;
  damage: number;
  currentHp: number;
  maxHp: number;
  attackerId?: number;
  attackerType?: number;
}

export interface PlayerDiedEvent {
  playerId: number;
  playerName: string;
  killerId?: number;
  killerType?: number;
  x: number;
  y: number;
}

export interface MobAggroEvent {
  mobId: number;
  mobType: number;
  targetId: number;
  targetName: string;
}

// ============ Player Events ============

export interface PlayerConnectedEvent {
  playerId: number;
  playerName: string;
  x: number;
  y: number;
}

export interface PlayerDisconnectedEvent {
  playerId: number;
  playerName: string;
}

export interface PlayerLevelUpEvent {
  playerId: number;
  playerName: string;
  newLevel: number;
  armor: number;
  weapon: number;
}

export interface PlayerEquipEvent {
  playerId: number;
  playerName: string;
  itemType: number;
  itemName: string;
  slot: 'armor' | 'weapon';
}

export interface PlayerZoneChangeEvent {
  playerId: number;
  playerName: string;
  fromZone?: string;
  toZone: string;
}

// ============ Item Events ============

export interface ItemLootedEvent {
  playerId: number;
  playerName: string;
  itemId: number;
  itemType: number;
  itemName: string;
  x: number;
  y: number;
}

export interface ItemDroppedEvent {
  itemId: number;
  itemType: number;
  x: number;
  y: number;
  droppedBy?: number;
}

export interface ChestOpenedEvent {
  playerId: number;
  playerName: string;
  chestId: number;
  x: number;
  y: number;
}

// ============ NPC Events ============

export interface NpcTalkEvent {
  playerId: number;
  playerName: string;
  npcId: number;
  npcType: number;
  npcName: string;
}

export interface QuestAcceptedEvent {
  playerId: number;
  playerName: string;
  questId: string;
  questType: string;
  target: string;
  targetCount: number;
  givenBy: string;
}

export interface QuestProgressEvent {
  playerId: number;
  playerName: string;
  questId: string;
  currentProgress: number;
  targetCount: number;
}

export interface QuestCompletedEvent {
  playerId: number;
  playerName: string;
  questId: string;
  questType: string;
  reward?: string;
}

// ============ Achievement Events ============

export interface AchievementUnlockedEvent {
  playerId: number;
  playerName: string;
  achievementId: number;
  achievementName: string;
  achievementDesc: string;
}

// ============ World Events ============

export interface WorldTickEvent {
  tick: number;
  timestamp: number;
}

export interface AreaPopulationEvent {
  area: string;
  playerCount: number;
  mobCount: number;
}

// ============ UI Events (Client-side) ============

export interface NarratorShowEvent {
  text: string;
  style: 'epic' | 'humor' | 'ominous' | 'info';
}

export interface NotificationShowEvent {
  message: string;
}

export interface NewspaperShowEvent {
  headlines: string[];
}

// ============ Event Map ============

/**
 * Master map of all event types.
 * This enables full type inference for emit/on calls.
 */
export interface GameEventMap {
  // Entity
  'entity:spawned': EntitySpawnedEvent;
  'entity:despawned': EntityDespawnedEvent;
  'entity:moved': EntityMovedEvent;

  // Combat
  'mob:killed': MobKilledEvent;
  'player:damaged': PlayerDamagedEvent;
  'player:died': PlayerDiedEvent;
  'mob:aggro': MobAggroEvent;

  // Player
  'player:connected': PlayerConnectedEvent;
  'player:disconnected': PlayerDisconnectedEvent;
  'player:levelup': PlayerLevelUpEvent;
  'player:equip': PlayerEquipEvent;
  'player:zonechange': PlayerZoneChangeEvent;

  // Items
  'item:looted': ItemLootedEvent;
  'item:dropped': ItemDroppedEvent;
  'chest:opened': ChestOpenedEvent;

  // NPCs & Quests
  'npc:talk': NpcTalkEvent;
  'quest:accepted': QuestAcceptedEvent;
  'quest:progress': QuestProgressEvent;
  'quest:completed': QuestCompletedEvent;

  // Achievements
  'achievement:unlocked': AchievementUnlockedEvent;

  // World
  'world:tick': WorldTickEvent;
  'area:population': AreaPopulationEvent;

  // UI (Client-side)
  'ui:narrator': NarratorShowEvent;
  'ui:notification': NotificationShowEvent;
  'ui:newspaper': NewspaperShowEvent;
}

/** All possible event names */
export type GameEventName = keyof GameEventMap;

/** Get the payload type for a given event name */
export type GameEventPayload<T extends GameEventName> = GameEventMap[T];
