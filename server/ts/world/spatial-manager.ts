/**
 * Spatial Manager - Handles zone groups, entity grouping, and adjacent calculations
 * Single Responsibility: Spatial partitioning for entity visibility and messaging
 */

import { Chest } from '../chest.js';
import { Item } from '../item.js';
import { Messages } from '../message.js';

export interface Group {
  entities: Record<string | number, any>;
  players: (string | number)[];
  incoming: any[];
}

export interface MapContext {
  forEachGroup(callback: (id: string) => void): void;
  forEachAdjacentGroup(groupId: string, callback: (id: string) => void): void;
  getGroupIdFromPosition(x: number, y: number): string;
}

export interface BroadcasterContext {
  pushToGroup(groupId: string, message: any, ignoredPlayerId?: string | number): void;
}

export class SpatialManager {
  // Group storage: zone-based partitioning for entity visibility
  groups: Record<string, Group> = {};
  zoneGroupsReady = false;

  // Dependencies
  private map: MapContext | null = null;
  private broadcaster: BroadcasterContext | null = null;

  constructor() {}

  /**
   * Set map context for group calculations
   */
  setMap(map: MapContext): void {
    this.map = map;
  }

  /**
   * Set broadcaster for sending spawn messages
   */
  setBroadcaster(broadcaster: BroadcasterContext): void {
    this.broadcaster = broadcaster;
  }

  // ========== Group Initialization ==========

  /**
   * Initialize zone groups from map data
   */
  initZoneGroups(): void {
    const self = this;

    this.map?.forEachGroup(function(id) {
      self.groups[id] = {
        entities: {},
        players: [],
        incoming: []
      };
    });
    this.zoneGroupsReady = true;
  }

  // ========== Group Membership ==========

  /**
   * Remove entity from all adjacent groups
   * Returns the list of groups the entity was removed from
   */
  removeFromGroups(entity: any): string[] {
    const self = this;
    const oldGroups: string[] = [];

    if (entity && entity.group) {
      const group = this.groups[entity.group];

      // Check type instead of instanceof to support AIPlayer
      if (entity.type === 'player') {
        group.players = group.players.filter(function(id) {
          return id !== entity.id;
        });
      }

      this.map?.forEachAdjacentGroup(entity.group, function(id) {
        if (entity.id in self.groups[id].entities) {
          delete self.groups[id].entities[entity.id];
          oldGroups.push(id);
        }
      });
      entity.group = null;
    }
    return oldGroups;
  }

  /**
   * Registers an entity as "incoming" into several groups, meaning that it just entered them.
   * All players inside these groups will receive a Spawn message when processGroups is called.
   */
  addAsIncomingToGroup(entity: any, groupId: string): void {
    const self = this;
    const isChest = entity && entity instanceof Chest;
    const isItem = entity && entity instanceof Item;
    const isDroppedItem = entity && isItem && !entity.isStatic && !entity.isFromChest;

    if (entity && groupId) {
      this.map?.forEachAdjacentGroup(groupId, function(id) {
        const group = self.groups[id];

        if (group) {
          if (!(entity.id in group.entities)
            // Items dropped off of mobs are handled differently via DROP messages. See handleHurtEntity.
            && (!isItem || isChest || (isItem && !isDroppedItem))) {
            group.incoming.push(entity);
          }
        }
      });
    }
  }

  /**
   * Add entity to adjacent groups
   * Returns the list of new groups the entity was added to
   */
  addToGroup(entity: any, groupId: string): string[] {
    const self = this;
    const newGroups: string[] = [];

    if (entity && groupId && (groupId in this.groups)) {
      this.map?.forEachAdjacentGroup(groupId, function(id) {
        self.groups[id].entities[entity.id] = entity;
        newGroups.push(id);
      });
      entity.group = groupId;

      // Check type instead of instanceof to support AIPlayer
      if (entity.type === 'player') {
        this.groups[groupId].players.push(entity.id);
      }
    }
    return newGroups;
  }

  /**
   * Debug utility to log players in a group
   */
  logGroupPlayers(groupId: string): void {
    console.debug('Players inside group ' + groupId + ':');
    this.groups[groupId].players.forEach(function(id) {
      console.debug('- player ' + id);
    });
  }

  /**
   * Handle entity zone transitions
   * Returns true if the entity changed groups
   */
  handleEntityGroupMembership(entity: any): boolean {
    let hasChangedGroups = false;

    if (entity && this.map) {
      const groupId = this.map.getGroupIdFromPosition(entity.x, entity.y);

      if (!entity.group || (entity.group && entity.group !== groupId)) {
        hasChangedGroups = true;
        this.addAsIncomingToGroup(entity, groupId);
        const oldGroups = this.removeFromGroups(entity);
        const newGroups = this.addToGroup(entity, groupId);

        if (oldGroups.length > 0) {
          entity.recentlyLeftGroups = oldGroups.filter(g => !newGroups.includes(g));
          console.debug('group diff: ' + entity.recentlyLeftGroups);
        }
      }
    }
    return hasChangedGroups;
  }

  // ========== Group Processing ==========

  /**
   * Process incoming entity queue for each group
   * Sends Spawn messages to players in the group
   */
  processGroups(): void {
    const self = this;

    if (this.zoneGroupsReady && this.map && this.broadcaster) {
      this.map.forEachGroup(function(id) {
        if (self.groups[id].incoming.length > 0) {
          self.groups[id].incoming.forEach(function(entity) {
            // Check type instead of instanceof to support AIPlayer
            if (entity.type === 'player') {
              self.broadcaster!.pushToGroup(id, new Messages.Spawn(entity), entity.id);
            } else {
              self.broadcaster!.pushToGroup(id, new Messages.Spawn(entity));
            }
          });
          self.groups[id].incoming = [];
        }
      });
    }
  }

  // ========== Group Queries ==========

  /**
   * Get group by ID
   */
  getGroup(groupId: string): Group | undefined {
    return this.groups[groupId];
  }

  /**
   * Check if a group exists
   */
  groupExists(groupId: string): boolean {
    return groupId in this.groups;
  }

  /**
   * Get players in a specific group
   */
  getPlayersInGroup(groupId: string): (string | number)[] {
    return this.groups[groupId]?.players ?? [];
  }
}
