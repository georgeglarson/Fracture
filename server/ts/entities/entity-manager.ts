/**
 * Entity Manager - Handles entity storage and lifecycle
 * Single Responsibility: Entity CRUD operations, iteration, and lookup
 */

import { Types } from '../../../shared/ts/gametypes.js';
import { Npc } from '../npc.js';
import { Chest } from '../chest.js';
import { Item } from '../item.js';
import { generateItem } from '../items/index.js';

// Using 'any' for entities to avoid type conflicts with various entity classes
// The actual entity classes (Player, Mob, Item, Npc) have different interfaces
export type Entity = any;
export type Player = any;
export type Mob = any;

export interface CombatSystemContext {
  clearMobAggroLink(mob: any): void;
  clearMobHateLinks(mob: any): void;
}

export interface BroadcasterContext {
  createQueue(playerId: string | number): void;
  removeQueue(playerId: string | number): void;
}

export interface GroupContext {
  handleEntityGroupMembership(entity: Entity): boolean;
  removeFromGroups(entity: Entity): void;
}

export class EntityManager {
  // Entity storage
  entities: Record<string | number, Entity> = {};
  players: Record<string | number, Player> = {};
  mobs: Record<string | number, Mob> = {};
  items: Record<string | number, Item> = {};
  npcs: Record<string | number, Npc> = {};

  // ID generation
  itemCount = 0;

  // Dependencies
  private combatSystem: CombatSystemContext | null = null;
  private broadcaster: BroadcasterContext | null = null;
  private groupContext: GroupContext | null = null;

  constructor() {}

  /**
   * Set the combat system context for aggro/hate clearing
   */
  setCombatSystem(combatSystem: CombatSystemContext): void {
    this.combatSystem = combatSystem;
  }

  /**
   * Set the broadcaster context for queue management
   */
  setBroadcaster(broadcaster: BroadcasterContext): void {
    this.broadcaster = broadcaster;
  }

  /**
   * Set the group context for zone group management
   */
  setGroupContext(groupContext: GroupContext): void {
    this.groupContext = groupContext;
  }

  // ========== Entity CRUD ==========

  addEntity(entity: Entity): void {
    this.entities[entity.id] = entity;
    this.groupContext?.handleEntityGroupMembership(entity);
  }

  removeEntity(entity: Entity): void {
    if (entity.id in this.entities) {
      delete this.entities[entity.id];
    }
    if (entity.id in this.mobs) {
      delete this.mobs[entity.id];
    }
    if (entity.id in this.items) {
      delete this.items[entity.id];
    }

    if (entity.type === 'mob') {
      this.combatSystem?.clearMobAggroLink(entity);
      this.combatSystem?.clearMobHateLinks(entity);
    }

    entity.destroy();
    this.groupContext?.removeFromGroups(entity);
    console.debug('Removed ' + Types.getKindAsString(entity.kind) + ' : ' + entity.id);
  }

  // ========== Player Management ==========

  addPlayer(player: Player): void {
    this.addEntity(player);
    this.players[player.id] = player;
    this.broadcaster?.createQueue(player.id);
  }

  removePlayer(player: Player): void {
    player.broadcast(player.despawn?.());
    this.removeEntity(player);
    delete this.players[player.id];
    this.broadcaster?.removeQueue(player.id);
  }

  // ========== Mob Management ==========

  addMob(mob: Mob): void {
    this.addEntity(mob);
    this.mobs[mob.id] = mob;
  }

  // ========== NPC Management ==========

  addNpc(kind: number, x: number, y: number): Npc {
    const npc = new Npc('8' + x + '' + y, kind, x, y);
    this.addEntity(npc);
    this.npcs[npc.id] = npc;
    return npc;
  }

  // ========== Item Management ==========

  addItem(item: Item): Item {
    this.addEntity(item);
    this.items[item.id] = item;
    return item;
  }

  createItem(kind: number, x: number, y: number): Item | Chest {
    const id = '9' + this.itemCount++;

    if (kind === Types.Entities.CHEST) {
      return new Chest(id, x, y);
    } else {
      return new Item(id, kind, x, y);
    }
  }

  /**
   * Create an item with generated properties (rarity, stats, bonuses)
   */
  createItemWithProperties(kind: number, x: number, y: number): Item | Chest {
    const id = '9' + this.itemCount++;

    if (kind === Types.Entities.CHEST) {
      return new Chest(id, x, y);
    } else {
      // Generate item with random properties
      const generated = generateItem(kind);
      return new Item(id, kind, x, y, generated);
    }
  }

  createChest(x: number, y: number, items: number[]): Chest {
    const chest = this.createItem(Types.Entities.CHEST, x, y) as Chest;
    chest.setItems(items);
    return chest;
  }

  addStaticItem(item: Item): Item {
    item.isStatic = true;
    item.onRespawn(this.addStaticItem.bind(this, item));
    return this.addItem(item);
  }

  addItemFromChest(kind: number, x: number, y: number): Item {
    const item = this.createItem(kind, x, y) as Item;
    item.isFromChest = true;
    return this.addItem(item);
  }

  // ========== Entity Iteration ==========

  forEachEntity(callback: (entity: Entity) => void): void {
    for (const id in this.entities) {
      callback(this.entities[id]);
    }
  }

  forEachPlayer(callback: (player: Player) => void): void {
    for (const id in this.players) {
      callback(this.players[id]);
    }
  }

  forEachMob(callback: (mob: Mob) => void): void {
    for (const id in this.mobs) {
      callback(this.mobs[id]);
    }
  }

  forEachCharacter(callback: (character: Entity) => void): void {
    this.forEachPlayer(callback);
    this.forEachMob(callback);
  }

  // ========== Entity Lookup ==========

  getEntityById(id: string | number): Entity | undefined {
    if (id in this.entities) {
      return this.entities[id];
    } else {
      console.error('Unknown entity : ' + id);
      return undefined;
    }
  }

  getPlayerCount(): number {
    let count = 0;
    for (const p in this.players) {
      if (this.players.hasOwnProperty(p)) {
        count += 1;
      }
    }
    return count;
  }

  /**
   * Check if entity exists
   */
  entityExists(id: string | number): boolean {
    return id in this.entities;
  }
}
