/**
 * Entity Manager - Handles entity storage and lifecycle
 * Single Responsibility: Entity CRUD operations, iteration, and lookup
 */

import { Types } from '../../../shared/ts/gametypes.js';
import { Npc } from '../npc.js';
import { Chest } from '../chest.js';
import { Item } from '../item.js';
import { generateItem } from '../items/index.js';
import { getZoneAtPosition } from '../../../shared/ts/zones';

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

  /**
   * Add entity to the manager
   * @returns true if successfully added, false otherwise
   */
  addEntity(entity: Entity): boolean {
    try {
      if (!entity || entity.id === undefined) {
        console.error('[EntityManager] Cannot add invalid entity');
        return false;
      }
      this.entities[entity.id] = entity;
      this.groupContext?.handleEntityGroupMembership(entity);
      return true;
    } catch (error) {
      console.error(`[EntityManager] Failed to add entity ${entity?.id}:`, error);
      return false;
    }
  }

  /**
   * Remove entity from the manager
   * @returns true if successfully removed, false otherwise
   */
  removeEntity(entity: Entity): boolean {
    try {
      if (!entity || entity.id === undefined) {
        console.error('[EntityManager] Cannot remove invalid entity');
        return false;
      }

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
      return true;
    } catch (error) {
      console.error(`[EntityManager] Failed to remove entity ${entity?.id}:`, error);
      return false;
    }
  }

  // ========== Player Management ==========

  /**
   * Add player to the manager
   * @returns true if successfully added, false otherwise
   */
  addPlayer(player: Player): boolean {
    try {
      if (!this.addEntity(player)) {
        return false;
      }
      this.players[player.id] = player;
      this.broadcaster?.createQueue(player.id);
      return true;
    } catch (error) {
      console.error(`[EntityManager] Failed to add player ${player?.id}:`, error);
      return false;
    }
  }

  /**
   * Remove player from the manager
   * @returns true if successfully removed, false otherwise
   */
  removePlayer(player: Player): boolean {
    try {
      player.broadcast(player.despawn?.());
      if (!this.removeEntity(player)) {
        return false;
      }
      delete this.players[player.id];
      this.broadcaster?.removeQueue(player.id);
      return true;
    } catch (error) {
      console.error(`[EntityManager] Failed to remove player ${player?.id}:`, error);
      return false;
    }
  }

  // ========== Mob Management ==========

  /**
   * Add mob to the manager
   * @returns true if successfully added, false otherwise
   */
  addMob(mob: Mob): boolean {
    try {
      if (!this.addEntity(mob)) {
        return false;
      }
      this.mobs[mob.id] = mob;
      return true;
    } catch (error) {
      console.error(`[EntityManager] Failed to add mob ${mob?.id}:`, error);
      return false;
    }
  }

  // ========== NPC Management ==========

  addNpc(kind: number, x: number, y: number): Npc | null {
    try {
      const npc = new Npc('8' + x + '' + y, kind, x, y);
      this.addEntity(npc);
      this.npcs[npc.id] = npc;
      return npc;
    } catch (error) {
      console.error(`[EntityManager] Failed to add NPC kind=${kind} at (${x}, ${y}):`, error);
      return null;
    }
  }

  // ========== Item Management ==========

  addItem(item: Item): Item {
    try {
      this.addEntity(item);
      this.items[item.id] = item;
      return item;
    } catch (error) {
      console.error(`[EntityManager] Failed to add item ${item?.id}:`, error);
      return item; // Return item anyway, entity may still be usable
    }
  }

  createItem(kind: number, x: number, y: number): Item | Chest | null {
    try {
      const id = '9' + this.itemCount++;

      if (Types.isChest(kind)) {
        // Get zone-appropriate chest kind if generic CHEST was requested
        let chestKind = kind;
        if (kind === Types.Entities.CHEST) {
          const zone = getZoneAtPosition(x, y);
          chestKind = zone ? Types.getChestKindForZone(zone.id) : Types.Entities.CHEST;
        }
        return new Chest(id, x, y, chestKind);
      } else {
        return new Item(id, kind, x, y);
      }
    } catch (error) {
      console.error(`[EntityManager] Failed to create item kind=${kind} at (${x}, ${y}):`, error);
      return null;
    }
  }

  /**
   * Create an item with generated properties (rarity, stats, bonuses)
   * @param kind - Item type
   * @param x - X position
   * @param y - Y position
   * @param existingPropertiesOrZone - Optional pre-existing properties (for dropped items) or zone for rarity bonus
   */
  createItemWithProperties(kind: number, x: number, y: number, existingPropertiesOrZone?: any): Item | Chest | null {
    try {
      const id = '9' + this.itemCount++;

      if (Types.isChest(kind)) {
        // Get zone-appropriate chest kind if generic CHEST was requested
        let chestKind = kind;
        if (kind === Types.Entities.CHEST) {
          const zone = getZoneAtPosition(x, y);
          chestKind = zone ? Types.getChestKindForZone(zone.id) : Types.Entities.CHEST;
        }
        return new Chest(id, x, y, chestKind);
      } else {
        // Check if we got a zone (has rarityBonus) or existing properties
        let properties;
        if (existingPropertiesOrZone && typeof existingPropertiesOrZone.rarityBonus === 'number') {
          // It's a zone object - generate with rarity bonus
          properties = generateItem(kind, existingPropertiesOrZone.rarityBonus);
        } else if (existingPropertiesOrZone) {
          // It's existing properties - use directly
          properties = existingPropertiesOrZone;
        } else {
          // No properties or zone - generate default
          properties = generateItem(kind);
        }
        return new Item(id, kind, x, y, properties);
      }
    } catch (error) {
      console.error(`[EntityManager] Failed to create item with properties kind=${kind} at (${x}, ${y}):`, error);
      return null;
    }
  }

  createChest(x: number, y: number, items: number[], chestKind?: number): Chest | null {
    try {
      // Use zone-based chest type if not explicitly specified
      let kind = chestKind;
      if (!kind) {
        const zone = getZoneAtPosition(x, y);
        kind = zone ? Types.getChestKindForZone(zone.id) : Types.Entities.CHEST;
      }

      const chest = this.createItem(kind, x, y) as Chest;
      if (!chest) return null;
      chest.setItems(items);

      console.log(`[EntityManager] Created ${Types.getKindAsString(kind)} at (${x}, ${y})`);
      return chest;
    } catch (error) {
      console.error(`[EntityManager] Failed to create chest at (${x}, ${y}):`, error);
      return null;
    }
  }

  addStaticItem(item: Item): Item | null {
    try {
      item.isStatic = true;
      item.onRespawn(this.addStaticItem.bind(this, item));
      return this.addItem(item);
    } catch (error) {
      console.error(`[EntityManager] Failed to add static item ${item?.id}:`, error);
      return null;
    }
  }

  addItemFromChest(kind: number, x: number, y: number): Item | null {
    try {
      const item = this.createItem(kind, x, y) as Item;
      if (!item) return null;
      item.isFromChest = true;
      return this.addItem(item);
    } catch (error) {
      console.error(`[EntityManager] Failed to add item from chest kind=${kind} at (${x}, ${y}):`, error);
      return null;
    }
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
    }
    // Don't log - this is a normal lookup miss, especially for AIPlayers
    return undefined;
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
