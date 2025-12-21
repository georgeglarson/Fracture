/**
 * Message Broadcaster - Handles all message queue management and broadcasting
 * Single Responsibility: Queue and deliver messages to players
 */


export interface Message {
  serialize(): any[];
}

export interface Player {
  id: string | number;
  group?: string;
  recentlyLeftGroups?: string[];
}

export interface Group {
  entities: Record<string, any>;
  players: (string | number)[];
  incoming: any[];
}

export interface ServerConnection {
  send(data: any[]): void;
}

export interface Server {
  getConnection(id: string | number): ServerConnection | null;
}

export interface MapProvider {
  forEachAdjacentGroup(groupId: string, callback: (id: string) => void): void;
}

export interface EntityProvider {
  getEntityById(id: string | number): Player | undefined;
}

export class MessageBroadcaster {
  private outgoingQueues: Record<string | number, any[]> = {};
  private server: Server;
  private groups: Record<string, Group>;
  private map: MapProvider;
  private entityProvider: EntityProvider;

  constructor(
    server: Server,
    groups: Record<string, Group>,
    map: MapProvider,
    entityProvider: EntityProvider
  ) {
    this.server = server;
    this.groups = groups;
    this.map = map;
    this.entityProvider = entityProvider;
  }

  /**
   * Create a message queue for a player
   */
  createQueue(playerId: string | number): void {
    this.outgoingQueues[playerId] = [];
  }

  /**
   * Remove a player's message queue
   */
  removeQueue(playerId: string | number): void {
    delete this.outgoingQueues[playerId];
  }

  /**
   * Check if a player has a queue
   */
  hasQueue(playerId: string | number): boolean {
    return playerId in this.outgoingQueues;
  }

  /**
   * Push a message to a specific player's queue
   */
  pushToPlayer(player: Player | undefined, message: Message): void {
    try {
      if (player && player.id in this.outgoingQueues) {
        this.outgoingQueues[player.id].push(message.serialize());
      }
      // AIPlayers don't have queues - this is expected, no need to log
    } catch (error) {
      console.error(`[Broadcaster] Failed to push to player ${player?.id}:`, error);
    }
  }

  /**
   * Push a message to all players in a specific group
   */
  pushToGroup(groupId: string, message: Message, ignoredPlayer?: string | number): void {
    try {
      const group = this.groups[groupId];

      if (group) {
        group.players.forEach((playerId) => {
          if (playerId != ignoredPlayer) {
            const player = this.entityProvider.getEntityById(playerId);
            this.pushToPlayer(player, message);
          }
        });
      } else {
        console.debug('[Broadcaster] groupId: ' + groupId + ' is not a valid group');
      }
    } catch (error) {
      console.error(`[Broadcaster] Failed to push to group ${groupId}:`, error);
    }
  }

  /**
   * Push a message to all players in adjacent groups
   */
  pushToAdjacentGroups(groupId: string, message: Message, ignoredPlayer?: string | number): void {
    try {
      this.map.forEachAdjacentGroup(groupId, (id) => {
        this.pushToGroup(id, message, ignoredPlayer);
      });
    } catch (error) {
      console.error(`[Broadcaster] Failed to push to adjacent groups of ${groupId}:`, error);
    }
  }

  /**
   * Push a message to groups the player recently left
   */
  pushToPreviousGroups(player: Player, message: Message): void {
    try {
      if (player.recentlyLeftGroups) {
        player.recentlyLeftGroups.forEach((id) => {
          this.pushToGroup(id, message);
        });
        player.recentlyLeftGroups = [];
      }
    } catch (error) {
      console.error(`[Broadcaster] Failed to push to previous groups for player ${player?.id}:`, error);
    }
  }

  /**
   * Push a message to ALL players (global broadcast)
   */
  pushBroadcast(message: Message, ignoredPlayer?: string | number): void {
    try {
      const serialized = message.serialize();
      for (const id in this.outgoingQueues) {
        if (id != ignoredPlayer) {
          this.outgoingQueues[id].push(serialized);
        }
      }
    } catch (error) {
      console.error('[Broadcaster] Failed to push broadcast:', error);
    }
  }

  /**
   * Flush all queues - send messages to their respective connections
   */
  processQueues(): void {
    for (const id in this.outgoingQueues) {
      try {
        if (this.outgoingQueues[id].length > 0) {
          const connection = this.server.getConnection(id);
          // Skip AI players that don't have real connections
          if (connection) {
            connection.send(this.outgoingQueues[id]);
          }
          this.outgoingQueues[id] = [];
        }
      } catch (error) {
        console.error(`[Broadcaster] Failed to process queue for ${id}:`, error);
        // Clear the queue even on error to prevent memory buildup
        this.outgoingQueues[id] = [];
      }
    }
  }

  /**
   * Get the current queue size for a player (for debugging)
   */
  getQueueSize(playerId: string | number): number {
    return this.outgoingQueues[playerId]?.length ?? 0;
  }

  /**
   * Get total queued messages across all players (for debugging)
   */
  getTotalQueuedMessages(): number {
    let total = 0;
    for (const id in this.outgoingQueues) {
      total += this.outgoingQueues[id].length;
    }
    return total;
  }
}
