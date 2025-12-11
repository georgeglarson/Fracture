/**
 * GameClient Event Types
 * Type-safe event definitions for the EventEmitter-based GameClient
 */

import { Item } from '../entity/objects/item';
import { Chest } from '../entity/objects/chest';
import { Character } from '../entity/character/character';

// Event name constants - use these instead of magic strings
export const ClientEvents = {
  // Connection
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',

  // Core gameplay
  WELCOME: 'welcome',
  MOVE: 'move',
  LOOT_MOVE: 'lootMove',
  ATTACK: 'attack',
  SPAWN_ITEM: 'spawnItem',
  SPAWN_CHEST: 'spawnChest',
  SPAWN_CHARACTER: 'spawnCharacter',
  DESPAWN: 'despawn',
  HEALTH: 'health',
  CHAT: 'chat',
  EQUIP: 'equip',
  DROP: 'drop',
  TELEPORT: 'teleport',
  DAMAGE: 'damage',
  POPULATION: 'population',
  KILL: 'kill',
  LIST: 'list',
  DESTROY: 'destroy',
  HP: 'hp',
  BLINK: 'blink',

  // Venice AI
  NPC_TALK: 'npcTalk',
  COMPANION_HINT: 'companionHint',
  QUEST_OFFER: 'questOffer',
  QUEST_STATUS: 'questStatus',
  QUEST_COMPLETE: 'questComplete',
  ITEM_LORE: 'itemLore',
  NARRATOR: 'narrator',
  ENTITY_THOUGHT: 'entityThought',
  WORLD_EVENT: 'worldEvent',
  NEWS: 'news',

  // Progression
  XP_GAIN: 'xpGain',
  LEVEL_UP: 'levelUp',

  // Economy
  GOLD_GAIN: 'goldGain',
  DAILY_REWARD: 'dailyReward',

  // Shop
  SHOP_OPEN: 'shopOpen',
  SHOP_BUY_RESULT: 'shopBuyResult',

  // Achievements
  ACHIEVEMENT_INIT: 'achievementInit',
  ACHIEVEMENT_UNLOCK: 'achievementUnlock',
  ACHIEVEMENT_PROGRESS: 'achievementProgress',
  PLAYER_TITLE_UPDATE: 'playerTitleUpdate',

  // Party
  PARTY_INVITE_RECEIVED: 'partyInviteReceived',
  PARTY_JOIN: 'partyJoin',
  PARTY_LEAVE: 'partyLeave',
  PARTY_DISBAND: 'partyDisband',
  PARTY_UPDATE: 'partyUpdate',
  PARTY_CHAT: 'partyChat',

  // Inspect
  PLAYER_INSPECT_RESULT: 'playerInspectResult',

  // Inventory
  INVENTORY_INIT: 'inventoryInit',
  INVENTORY_ADD: 'inventoryAdd',
  INVENTORY_REMOVE: 'inventoryRemove',
  INVENTORY_UPDATE: 'inventoryUpdate',
} as const;

// Type for event names
export type ClientEventName = typeof ClientEvents[keyof typeof ClientEvents];

// Event payload interfaces
export interface ClientEventPayloads {
  // Connection
  [ClientEvents.CONNECTED]: [];
  [ClientEvents.DISCONNECTED]: [message: string];

  // Core gameplay
  [ClientEvents.WELCOME]: [id: number, name: string, x: number, y: number, hp: number];
  [ClientEvents.MOVE]: [id: number, x: number, y: number];
  [ClientEvents.LOOT_MOVE]: [id: number, item: number];
  [ClientEvents.ATTACK]: [attackerId: number, targetId: number];
  [ClientEvents.SPAWN_ITEM]: [item: Item, x: number, y: number];
  [ClientEvents.SPAWN_CHEST]: [chest: Chest, x: number, y: number];
  [ClientEvents.SPAWN_CHARACTER]: [entity: Character, x: number, y: number, orientation: number, targetId?: number];
  [ClientEvents.DESPAWN]: [id: number];
  [ClientEvents.HEALTH]: [points: number, isRegen: boolean];
  [ClientEvents.CHAT]: [id: number, message: string];
  [ClientEvents.EQUIP]: [id: number, itemKind: number];
  [ClientEvents.DROP]: [mobId: number, id: number, kind: number, x: number, y: number];
  [ClientEvents.TELEPORT]: [id: number, x: number, y: number];
  [ClientEvents.DAMAGE]: [id: number, damage: number, hp?: number, maxHp?: number];
  [ClientEvents.POPULATION]: [worldPlayers: number, totalPlayers: number];
  [ClientEvents.KILL]: [mobKind: number, xp: number, gold: number];
  [ClientEvents.LIST]: [ids: number[]];
  [ClientEvents.DESTROY]: [id: number];
  [ClientEvents.HP]: [maxHp: number];
  [ClientEvents.BLINK]: [id: number];

  // Venice AI
  [ClientEvents.NPC_TALK]: [npcId: number, response: string, options?: string[]];
  [ClientEvents.COMPANION_HINT]: [hint: string];
  [ClientEvents.QUEST_OFFER]: [questId: string, title: string, description: string, objectives: any[], rewards: any];
  [ClientEvents.QUEST_STATUS]: [questId: string, status: string, objectives: any[]];
  [ClientEvents.QUEST_COMPLETE]: [questId: string, rewards: any];
  [ClientEvents.ITEM_LORE]: [itemKind: number, lore: string];
  [ClientEvents.NARRATOR]: [title: string, message: string, style: string];
  [ClientEvents.ENTITY_THOUGHT]: [entityId: number, thought: string, state: string];
  [ClientEvents.WORLD_EVENT]: [title: string, description: string, eventType: string];
  [ClientEvents.NEWS]: [headlines: string[]];

  // Progression
  [ClientEvents.XP_GAIN]: [amount: number, total: number, level: number, xpToNextLevel: number];
  [ClientEvents.LEVEL_UP]: [level: number, hp: number];

  // Economy
  [ClientEvents.GOLD_GAIN]: [amount: number, total: number];
  [ClientEvents.DAILY_REWARD]: [gold: number, xp: number, streak: number];

  // Shop
  [ClientEvents.SHOP_OPEN]: [npcKind: number, shopName: string, items: Array<{itemKind: number, price: number, stock: number}>];
  [ClientEvents.SHOP_BUY_RESULT]: [success: boolean, itemKind: number, newGold: number, message: string];

  // Achievements
  [ClientEvents.ACHIEVEMENT_INIT]: [unlocked: string[], progress: Record<string, number>, selectedTitle: string | null];
  [ClientEvents.ACHIEVEMENT_UNLOCK]: [achievementId: string];
  [ClientEvents.ACHIEVEMENT_PROGRESS]: [achievementId: string, current: number, target: number];
  [ClientEvents.PLAYER_TITLE_UPDATE]: [playerId: number, title: string];

  // Party
  [ClientEvents.PARTY_INVITE_RECEIVED]: [inviterName: string, inviterId: number];
  [ClientEvents.PARTY_JOIN]: [partyId: number, members: any[]];
  [ClientEvents.PARTY_LEAVE]: [playerId: number];
  [ClientEvents.PARTY_DISBAND]: [];
  [ClientEvents.PARTY_UPDATE]: [members: any[]];
  [ClientEvents.PARTY_CHAT]: [senderName: string, message: string];

  // Inspect
  [ClientEvents.PLAYER_INSPECT_RESULT]: [playerId: number, data: any];

  // Inventory
  [ClientEvents.INVENTORY_INIT]: [slots: any[]];
  [ClientEvents.INVENTORY_ADD]: [slotIndex: number, kind: number, properties: any, count: number];
  [ClientEvents.INVENTORY_REMOVE]: [slotIndex: number];
  [ClientEvents.INVENTORY_UPDATE]: [slotIndex: number, count: number];
}

// Typed EventEmitter interface
export interface TypedEmitter {
  on<K extends ClientEventName>(event: K, listener: (...args: ClientEventPayloads[K]) => void): this;
  emit<K extends ClientEventName>(event: K, ...args: ClientEventPayloads[K]): boolean;
  off<K extends ClientEventName>(event: K, listener: (...args: ClientEventPayloads[K]) => void): this;
  once<K extends ClientEventName>(event: K, listener: (...args: ClientEventPayloads[K]) => void): this;
}
