/**
 * RoamingBoss - Aggressive boss that hunts players
 *
 * Unlike regular mobs, roaming bosses:
 * - Patrol the map freely (not confined to spawn areas)
 * - Have proximity aggro (attack players within range)
 * - Announce their presence when spawning
 * - Track kills for leaderboard
 */

import { Mob } from './mob';
import { Types } from '../../shared/ts/gametypes';
import { Properties } from './properties';
import { Utils } from './utils';
import { getServerEventBus } from '../../shared/ts/events/index';

export class RoamingBoss extends Mob {
  // Aggro range in tiles
  aggroRange = 8;

  // Roaming parameters
  roamInterval: NodeJS.Timeout | null = null;
  aggroInterval: NodeJS.Timeout | null = null;

  // World reference for player detection
  world: any = null;

  // Map boundaries for roaming
  mapWidth: number;
  mapHeight: number;

  // Boss name for announcements
  bossName: string;

  constructor(id: number, x: number, y: number, mapWidth: number, mapHeight: number) {
    // Use the BOSS entity kind
    super(id, Types.Entities.BOSS, x, y);

    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.bossName = 'Skeleton King';

    // Bosses are tougher
    this.updateHitPoints();
  }

  /**
   * Set world reference for player detection
   */
  setWorld(world: any) {
    this.world = world;
  }

  /**
   * Start roaming and aggro detection loops
   */
  startBehavior() {
    // Roam every 3-5 seconds if not chasing anyone
    this.roamInterval = setInterval(() => {
      if (!this.hasTarget() && !this.isDead) {
        this.roamToRandomPosition();
      }
    }, 3000 + Math.random() * 2000);

    // Check for nearby players every 500ms
    this.aggroInterval = setInterval(() => {
      if (!this.isDead) {
        this.checkProximityAggro();
      }
    }, 500);
  }

  /**
   * Stop behavior loops
   */
  stopBehavior() {
    if (this.roamInterval) {
      clearInterval(this.roamInterval);
      this.roamInterval = null;
    }
    if (this.aggroInterval) {
      clearInterval(this.aggroInterval);
      this.aggroInterval = null;
    }
  }

  /**
   * Move to a random position on the map
   */
  roamToRandomPosition() {
    // Pick a random direction and distance
    const angle = Math.random() * 2 * Math.PI;
    const distance = 5 + Math.random() * 10; // 5-15 tiles

    let newX = Math.floor(this.x + Math.cos(angle) * distance);
    let newY = Math.floor(this.y + Math.sin(angle) * distance);

    // Clamp to map boundaries (with margin)
    newX = Math.max(10, Math.min(this.mapWidth - 10, newX));
    newY = Math.max(10, Math.min(this.mapHeight - 10, newY));

    // Check if position is valid (not blocked)
    if (this.world && this.world.map) {
      if (!this.world.map.isColliding(newX, newY)) {
        this.move(newX, newY);
      }
    } else {
      this.move(newX, newY);
    }
  }

  /**
   * Check for players within aggro range and attack closest one
   */
  checkProximityAggro() {
    if (!this.world || this.hasTarget()) return;

    let closestPlayer: any = null;
    let closestDistance = this.aggroRange;

    // Check all players
    const players = this.world.players;
    for (const playerId in players) {
      const player = players[playerId];
      if (!player || player.isDead) continue;

      const distance = Utils.distanceTo(this.x, this.y, player.x, player.y);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    }

    // Aggro closest player
    if (closestPlayer) {
      this.aggroPlayer(closestPlayer);
    }
  }

  /**
   * Initiate aggro on a player
   */
  aggroPlayer(player: any) {
    // Add player to hatelist
    this.increaseHateFor(player.id, 100);

    // Set target and notify combat system
    if (this.world) {
      this.world.handleMobHate(this.id, player.id, 100);
    }

    console.log(`[RoamingBoss] ${this.bossName} is hunting ${player.name}!`);
  }

  /**
   * Override destroy to stop behavior and track for respawn
   */
  destroy() {
    this.stopBehavior();
    super.destroy();
  }

  /**
   * Get state for client (same as regular mob)
   */
  getState() {
    return [
      this.id,
      this.kind,
      this.x,
      this.y
    ];
  }
}

/**
 * RoamingBossManager - Handles spawning and tracking roaming bosses
 */
export class RoamingBossManager {
  private world: any;
  private bosses: Map<number, RoamingBoss> = new Map();
  private bossIdCounter = 200000; // Reserved ID range for roaming bosses
  private respawnTimer: NodeJS.Timeout | null = null;

  // Leaderboard: playerId -> kill count
  private bossKills: Map<number, { name: string; kills: number }> = new Map();

  // Config
  private maxBosses = 1;
  private respawnDelay = 60000; // 1 minute respawn

  constructor(world: any) {
    this.world = world;
  }

  /**
   * Initialize boss spawning and event listeners
   */
  init() {
    // Subscribe to mob:killed events to track boss kills
    const eventBus = getServerEventBus();
    eventBus.on('mob:killed', (data: {
      mobId: number | string;
      mobType: number;
      mobName: string;
      killerId: number;
      killerName: string;
    }) => {
      // Check if this was one of our roaming bosses
      const bossId = typeof data.mobId === 'number' ? data.mobId : parseInt(data.mobId, 10);
      if (this.bosses.has(bossId)) {
        // Record the kill
        this.recordKill(data.killerId, data.killerName);

        // Get boss reference before it's cleaned up
        const boss = this.bosses.get(bossId);
        const bossName = boss?.bossName || 'Wasteland Ravager';

        // Broadcast boss kill to all players
        this.announceBossKill(bossName, data.killerName);

        // Handle respawn
        this.handleBossDeath(bossId);
      }
    });

    // Spawn initial boss after 10 seconds
    setTimeout(() => {
      this.spawnBoss();
    }, 10000);

    console.log('[RoamingBossManager] Initialized - Skeleton Kings will rise!');
  }

  /**
   * Spawn a new roaming boss at a random location
   */
  spawnBoss() {
    if (this.bosses.size >= this.maxBosses) return;

    const map = this.world.map;
    if (!map) return;

    // Get random spawn position
    const pos = map.getRandomStartingPosition();
    const bossId = ++this.bossIdCounter;

    const boss = new RoamingBoss(
      bossId,
      pos.x,
      pos.y,
      map.width,
      map.height
    );

    boss.setWorld(this.world);
    boss.startBehavior();

    // Register with world
    this.world.addMob(boss);
    this.bosses.set(bossId, boss);

    // Announce spawn to all players
    this.announceSpawn(boss);

    // Set up death handler
    boss.onRespawn(() => {
      this.handleBossDeath(bossId);
    });

    console.log(`[RoamingBossManager] Spawned ${boss.bossName} (ID: ${bossId}) at (${pos.x}, ${pos.y})`);
  }

  /**
   * Handle boss death - track kill and schedule respawn
   */
  handleBossDeath(bossId: number) {
    const boss = this.bosses.get(bossId);
    if (!boss) return;

    // Clean up
    boss.stopBehavior();
    this.bosses.delete(bossId);

    // Schedule respawn
    this.respawnTimer = setTimeout(() => {
      this.spawnBoss();
    }, this.respawnDelay);

    console.log(`[RoamingBossManager] Boss died, respawning in ${this.respawnDelay / 1000}s`);
  }

  /**
   * Record a boss kill for leaderboard
   */
  recordKill(playerId: number, playerName: string) {
    const existing = this.bossKills.get(playerId);
    if (existing) {
      existing.kills++;
      existing.name = playerName; // Update name in case it changed
    } else {
      this.bossKills.set(playerId, { name: playerName, kills: 1 });
    }

    console.log(`[Leaderboard] ${playerName} now has ${this.bossKills.get(playerId)?.kills} boss kills`);
  }

  /**
   * Get leaderboard sorted by kills
   */
  getLeaderboard(): Array<{ rank: number; name: string; kills: number }> {
    const sorted = Array.from(this.bossKills.entries())
      .sort((a, b) => b[1].kills - a[1].kills)
      .slice(0, 10) // Top 10
      .map(([id, data], index) => ({
        rank: index + 1,
        name: data.name,
        kills: data.kills
      }));

    return sorted;
  }

  /**
   * Announce boss spawn to all players
   */
  private announceSpawn(boss: RoamingBoss) {
    // Use existing WorldEvent message
    const { Messages } = require('./message');
    const message = new Messages.WorldEvent(
      'The Skeleton King Has Risen!',
      'A powerful undead lord roams the land, hunting all who cross its path.',
      'boss'
    );

    // Broadcast to all players
    for (const playerId in this.world.players) {
      this.world.pushToPlayer(this.world.players[playerId], message);
    }
  }

  /**
   * Announce boss kill to all players
   */
  private announceBossKill(bossName: string, killerName: string) {
    const { Messages } = require('./message');
    const message = new Messages.BossKill(bossName, killerName);

    // Broadcast to all players
    for (const playerId in this.world.players) {
      this.world.pushToPlayer(this.world.players[playerId], message);
    }

    console.log(`[RoamingBossManager] ${killerName} has slain ${bossName}!`);
  }

  /**
   * Clean up on shutdown
   */
  shutdown() {
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
    }

    for (const boss of this.bosses.values()) {
      boss.stopBehavior();
    }

    this.bosses.clear();
  }
}
