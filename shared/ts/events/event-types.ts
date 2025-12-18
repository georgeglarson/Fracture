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

export interface PlayerStreakEvent {
  playerId: number;
  playerName: string;
  streak: number;
  tier: string;
  announcement?: string;
}

export interface PlayerStreakEndedEvent {
  playerId: number;
  streak: number;
  endedById?: number;
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

// ============ Inventory UI Events ============

/** User clicked "use" on inventory slot */
export interface InventoryUseEvent {
  slotIndex: number;
}

/** User clicked "equip" on inventory slot */
export interface InventoryEquipEvent {
  slotIndex: number;
}

/** User clicked "drop" on inventory slot */
export interface InventoryDropEvent {
  slotIndex: number;
}

/** User clicked "sell" on inventory slot (shop open) */
export interface InventorySellEvent {
  slotIndex: number;
}

/** User clicked "unequip" on equipment slot */
export interface InventoryUnequipEvent {
  slot: 'weapon' | 'armor';
  toInventory: boolean;
}

/** Inventory visibility toggled */
export interface InventoryToggleEvent {
  visible: boolean;
}

/** Inventory state updated (from network or local change) */
export interface InventoryStateEvent {
  slots: any[]; // InventorySlot[]
}

/** Equipment state updated */
export interface EquipmentStateEvent {
  weapon: number | null;
  armor: number | null;
  weaponProps?: any;
  armorProps?: any;
}

// ============ Shop UI Events ============

/** User clicked buy in shop */
export interface ShopBuyEvent {
  npcKind: number;
  itemKind: number;
}

/** User clicked sell in shop */
export interface ShopSellEvent {
  slotIndex: number;
}

/** Shop opened */
export interface ShopOpenEvent {
  npcKind: number;
  shopName: string;
  items: any[];
}

/** Shop closed */
export interface ShopCloseEvent {}

/** Gold amount changed */
export interface GoldChangedEvent {
  gold: number;
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
  'player:streak': PlayerStreakEvent;
  'player:streakEnded': PlayerStreakEndedEvent;

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

  // Inventory UI
  'ui:inventory:use': InventoryUseEvent;
  'ui:inventory:equip': InventoryEquipEvent;
  'ui:inventory:drop': InventoryDropEvent;
  'ui:inventory:sell': InventorySellEvent;
  'ui:inventory:unequip': InventoryUnequipEvent;
  'ui:inventory:toggle': InventoryToggleEvent;

  // Inventory State
  'state:inventory': InventoryStateEvent;
  'state:equipment': EquipmentStateEvent;
  'state:gold': GoldChangedEvent;

  // Shop UI
  'ui:shop:buy': ShopBuyEvent;
  'ui:shop:sell': ShopSellEvent;
  'ui:shop:open': ShopOpenEvent;
  'ui:shop:close': ShopCloseEvent;
}

/** All possible event names */
export type GameEventName = keyof GameEventMap;

/** Get the payload type for a given event name */
export type GameEventPayload<T extends GameEventName> = GameEventMap[T];
