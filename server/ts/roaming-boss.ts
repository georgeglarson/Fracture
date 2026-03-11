/**
 * RoamingBoss - Aggressive zone boss that hunts players
 *
 * Unlike regular mobs, roaming bosses:
 * - Patrol within their zone boundaries
 * - Have proximity aggro (attack players within range)
 * - Announce their presence when spawning
 * - Track kills for leaderboard
 * - Use config-driven stats and behavior
 */

import { Mob } from './mob';
import { Utils } from './utils';
import { getServerEventBus } from '../../shared/ts/events/index';
import {
  ZoneBossConfig,
  getAllBossConfigs,
  getZoneSpawnPosition
} from './zone-boss-config';
import { ZONE_DATA } from '../../shared/ts/zones/zone-data';
import { evaluateAggro } from './combat/aggro-policy';
import { getCombatTracker } from './combat/combat-tracker';
import type { Player } from './player';

// Minimal World interface for RoamingBoss needs
interface BossWorld {
  players: Record<string | number, PlayerLike>;
  map: { width: number; height: number; isColliding(x: number, y: number): boolean } | null;
  addMob(mob: Mob): void;
  handleMobHate(mobId: number, playerId: number, hate: number): void;
  pushToPlayer(player: PlayerLike, message: unknown): void;
}

// Minimal Player interface for proximity detection
interface PlayerLike {
  id: number;
  name: string;
  x: number;
  y: number;
  isDead: boolean;
}

export class RoamingBoss extends Mob {
  // Config reference
  config: ZoneBossConfig;

  // Behavior intervals
  roamInterval: NodeJS.Timeout | null = null;
  aggroInterval: NodeJS.Timeout | null = null;
  difficultyInterval: NodeJS.Timeout | null = null;

  // World reference for player detection
  world: BossWorld | null = null;

  // Zone boundaries for roaming (from config)
  zoneAreas: Array<{ x: number; y: number; w: number; h: number }> = [];

  // Dynamic difficulty scaling
  baseMaxHp: number = 0;
  currentDifficultyMultiplier: number = 1.0;
  damageMultiplier: number = 1.0;

  constructor(id: number, config: ZoneBossConfig, x: number, y: number) {
    super(id, config.kind, x, y);

    this.config = config;

    // Load zone boundaries
    const zone = ZONE_DATA[config.zoneId];
    if (zone) {
      this.zoneAreas = zone.areas;
    }

    // Set stats from config
    this.maxHitPoints = config.hp;
    this.hitPoints = config.hp;
    this.baseMaxHp = config.hp;

    // Override aggro range from config
    this.aggroRange = config.aggroRange;
  }

  /**
   * Get boss display name
   */
  get bossName(): string {
    return this.config.name;
  }

  /**
   * Set world reference for player detection
   */
  setWorld(world: BossWorld) {
    this.world = world;
  }

  /**
   * Start roaming and aggro detection loops
   */
  startBehavior() {
    // Roam every 3-5 seconds if not chasing anyone
    const roamDelay = Math.floor(3000 / this.config.roamSpeed);
    this.roamInterval = setInterval(() => {
      if (!this.hasTarget() && !this.isDead) {
        this.roamWithinZone();
      }
    }, roamDelay + Math.random() * 2000);

    // Check for nearby players every 500ms
    this.aggroInterval = setInterval(() => {
      if (!this.isDead) {
        this.checkProximityAggro();
      }
    }, 500);

    // Update difficulty based on player count every 30 seconds
    this.difficultyInterval = setInterval(() => {
      if (!this.isDead) {
        this.updateDynamicDifficulty();
      }
    }, 30000);

    // Initial difficulty update
    this.updateDynamicDifficulty();
  }

  /**
   * Calculate and apply dynamic difficulty based on player population
   * More players = stronger boss (for group content)
   */
  updateDynamicDifficulty() {
    if (!this.world) return;

    const playerCount = Object.keys(this.world.players).length;

    // Scale difficulty:
    // 1 player: 1.0x (base)
    // 2 players: 1.2x HP, 1.1x damage
    // 5 players: 1.8x HP, 1.4x damage
    // 10+ players: 3.0x HP, 2.0x damage (cap)

    const hpMultiplier = Math.min(3.0, 1.0 + (playerCount - 1) * 0.2);
    const dmgMultiplier = Math.min(2.0, 1.0 + (playerCount - 1) * 0.1);

    // Only update if significantly changed (avoid constant updates)
    if (Math.abs(hpMultiplier - this.currentDifficultyMultiplier) > 0.1) {
      const hpPercent = this.hitPoints / this.maxHitPoints;

      this.currentDifficultyMultiplier = hpMultiplier;
      this.damageMultiplier = dmgMultiplier;
      this.maxHitPoints = Math.floor(this.baseMaxHp * hpMultiplier);

      // Scale current HP proportionally
      this.hitPoints = Math.floor(this.maxHitPoints * hpPercent);

      console.debug(`[${this.config.id}] Dynamic difficulty: ${playerCount} players → ${Math.round(hpMultiplier * 100)}% HP, ${Math.round(dmgMultiplier * 100)}% damage`);
    }
  }

  /**
   * Get damage multiplier for combat calculations
   */
  getDamageMultiplier(): number {
    return this.damageMultiplier;
  }

  /**
   * Get base damage from config
   */
  getBaseDamage(): number {
    return this.config.damage;
  }

  /**
   * Get armor from config
   */
  getArmor(): number {
    return this.config.armor;
  }

  /**
   * Get loot multipliers for drops
   */
  getLootMultipliers(): { xp: number; gold: number; dropBonus: number } {
    return {
      xp: this.config.xpMultiplier,
      gold: this.config.goldMultiplier,
      dropBonus: this.config.dropBonus
    };
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
    if (this.difficultyInterval) {
      clearInterval(this.difficultyInterval);
      this.difficultyInterval = null;
    }
  }

  /**
   * Move to a random position within the boss's zone
   */
  roamWithinZone() {
    if (this.zoneAreas.length === 0) {
      // Fallback to global roaming if no zone defined
      this.roamToRandomPosition();
      return;
    }

    // Pick a random area within the zone
    const area = this.zoneAreas[Math.floor(Math.random() * this.zoneAreas.length)];

    // Pick a random position within that area (with margin)
    const margin = 2;
    let newX = area.x + margin + Math.floor(Math.random() * Math.max(1, area.w - margin * 2));
    let newY = area.y + margin + Math.floor(Math.random() * Math.max(1, area.h - margin * 2));

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
   * Fallback: Move to a random position on the map (legacy behavior)
   */
  roamToRandomPosition() {
    const angle = Math.random() * 2 * Math.PI;
    const distance = 5 + Math.random() * 10;

    let newX = Math.floor(this.x + Math.cos(angle) * distance);
    let newY = Math.floor(this.y + Math.sin(angle) * distance);

    // Clamp to map boundaries (with margin)
    if (this.world && this.world.map) {
      newX = Math.max(10, Math.min(this.world.map.width - 10, newX));
      newY = Math.max(10, Math.min(this.world.map.height - 10, newY));

      if (!this.world.map.isColliding(newX, newY)) {
        this.move(newX, newY);
      }
    } else {
      this.move(newX, newY);
    }
  }

  /**
   * Check for players within aggro range and attack closest one.
   * Uses evaluateAggro() to respect density cap and zone-aware policy.
   */
  checkProximityAggro() {
    if (!this.world || this.hasTarget()) return;

    let closestPlayer: PlayerLike | null = null;
    let closestDistance = this.aggroRange; // tiles
    const combatTracker = getCombatTracker();

    // Check all players
    const players = this.world.players;
    for (const playerId in players) {
      const player = players[playerId];
      if (!player || player.isDead) continue;

      const distance = Utils.distanceTo(this.x, this.y, player.x, player.y);

      // Use AggroPolicy to evaluate (respects density cap, zone rules, level scaling)
      const decision = evaluateAggro({
        mobX: this.x,
        mobY: this.y,
        mobSpawnX: this.spawningX,
        mobSpawnY: this.spawningY,
        mobLevel: this.level,
        mobAggroRange: this.aggroRange,
        mobZoneId: this.zoneId,
        playerX: player.x,
        playerY: player.y,
        playerLevel: (player as any).level ?? 1,
        distance,
        currentAggroOnPlayer: combatTracker.getPlayerAggroCount(player.id),
      });

      if (decision.shouldAggro && distance < closestDistance) {
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
  aggroPlayer(player: PlayerLike) {
    // Add player to hatelist
    this.increaseHateFor(player.id, 100);

    // Set target and notify combat system
    if (this.world) {
      this.world.handleMobHate(this.id, player.id, 100);
    }

    console.debug(`[${this.config.id}] ${this.bossName} is hunting ${player.name}!`);
  }

  /**
   * Override destroy to stop behavior and track for respawn
   */
  destroy() {
    this.stopBehavior();
    super.destroy();
  }

  // getState() removed - inherits Mob.getState() which includes HP/level for client health bars
}

/**
 * ZoneBossManager - Handles spawning and tracking all zone bosses
 */
export class ZoneBossManager {
  private world: BossWorld;
  private bosses: Map<number, RoamingBoss> = new Map();
  private bossIdCounter = 200000; // Reserved ID range for zone bosses
  private respawnTimers: Map<string, NodeJS.Timeout> = new Map();
  private spawnTimers: NodeJS.Timeout[] = [];

  // Leaderboard: bossId -> Map<playerId, {name, kills}>
  private bossKills: Map<string, Map<number, { name: string; kills: number }>> = new Map();

  // Global leaderboard (all bosses combined)
  private globalKills: Map<number, { name: string; kills: number }> = new Map();

  constructor(world: BossWorld) {
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
      // Check if this was one of our zone bosses
      const bossId = typeof data.mobId === 'number' ? data.mobId : parseInt(data.mobId, 10);
      if (this.bosses.has(bossId)) {
        const boss = this.bosses.get(bossId)!;

        // Record the kill
        this.recordKill(boss.config.id, data.killerId, data.killerName);

        // Broadcast boss kill to all players
        this.announceBossKill(boss.bossName, data.killerName);

        // Handle respawn
        this.handleBossDeath(bossId, boss.config);
      }
    });

    // Spawn initial bosses after 10 seconds (staggered)
    const configs = getAllBossConfigs();
    configs.forEach((config, index) => {
      const timer = setTimeout(() => {
        this.spawnBoss(config);
      }, 10000 + index * 5000); // Stagger spawns by 5 seconds each
      this.spawnTimers.push(timer);
    });

    console.log(`[ZoneBossManager] Initialized - ${configs.length} zone bosses configured!`);
  }

  /**
   * Spawn a boss from configuration
   */
  spawnBoss(config: ZoneBossConfig) {
    // Check if boss of this type already exists
    for (const boss of this.bosses.values()) {
      if (boss.config.id === config.id) {
        console.log(`[ZoneBossManager] ${config.name} already spawned, skipping`);
        return;
      }
    }

    // Get spawn position within zone
    const pos = getZoneSpawnPosition(config.zoneId);
    if (!pos) {
      console.error(`[ZoneBossManager] Failed to get spawn position for ${config.name} in ${config.zoneId}`);
      return;
    }

    const bossId = ++this.bossIdCounter;
    const boss = new RoamingBoss(bossId, config, pos.x, pos.y);

    boss.setWorld(this.world);
    boss.startBehavior();

    // Register with world
    this.world.addMob(boss);
    this.bosses.set(bossId, boss);

    // Announce spawn to all players
    this.announceSpawn(boss);

    // Set up death handler
    boss.onRespawn(() => {
      this.handleBossDeath(bossId, config);
    });

    console.log(`[ZoneBossManager] Spawned ${boss.bossName} (ID: ${bossId}) in ${config.zoneId} at (${pos.x}, ${pos.y})`);
  }

  /**
   * Handle boss death - track kill and schedule respawn
   */
  handleBossDeath(bossId: number, config: ZoneBossConfig) {
    const boss = this.bosses.get(bossId);
    if (!boss) return;

    // Clean up
    boss.stopBehavior();
    this.bosses.delete(bossId);

    // Clear any existing respawn timer for this boss type
    const existingTimer = this.respawnTimers.get(config.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule respawn
    const timer = setTimeout(() => {
      this.spawnBoss(config);
      this.respawnTimers.delete(config.id);
    }, config.respawnTime);

    this.respawnTimers.set(config.id, timer);

    console.log(`[ZoneBossManager] ${config.name} died, respawning in ${config.respawnTime / 1000}s`);
  }

  /**
   * Record a boss kill for leaderboard
   */
  recordKill(bossConfigId: string, playerId: number, playerName: string) {
    // Per-boss leaderboard
    if (!this.bossKills.has(bossConfigId)) {
      this.bossKills.set(bossConfigId, new Map());
    }
    const bossBoard = this.bossKills.get(bossConfigId)!;
    const existing = bossBoard.get(playerId);
    if (existing) {
      existing.kills++;
      existing.name = playerName;
    } else {
      bossBoard.set(playerId, { name: playerName, kills: 1 });
    }

    // Global leaderboard
    const globalExisting = this.globalKills.get(playerId);
    if (globalExisting) {
      globalExisting.kills++;
      globalExisting.name = playerName;
    } else {
      this.globalKills.set(playerId, { name: playerName, kills: 1 });
    }

    console.log(`[Leaderboard] ${playerName} now has ${this.globalKills.get(playerId)?.kills} total boss kills`);
  }

  /**
   * Get global leaderboard sorted by kills
   */
  getLeaderboard(): Array<{ rank: number; name: string; kills: number }> {
    const sorted = Array.from(this.globalKills.entries())
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
   * Get leaderboard for a specific boss
   */
  getBossLeaderboard(bossConfigId: string): Array<{ rank: number; name: string; kills: number }> {
    const bossBoard = this.bossKills.get(bossConfigId);
    if (!bossBoard) return [];

    return Array.from(bossBoard.entries())
      .sort((a, b) => b[1].kills - a[1].kills)
      .slice(0, 10)
      .map(([id, data], index) => ({
        rank: index + 1,
        name: data.name,
        kills: data.kills
      }));
  }

  /**
   * Announce boss spawn to all players
   */
  private announceSpawn(boss: RoamingBoss) {
    const { Messages } = require('./message');
    const message = new Messages.WorldEvent(
      boss.config.spawnTitle,
      boss.config.spawnMessage,
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

    console.log(`[ZoneBossManager] ${killerName} has slain ${bossName}!`);
  }

  /**
   * Get currently spawned bosses
   */
  getActiveBosses(): RoamingBoss[] {
    return Array.from(this.bosses.values());
  }

  /**
   * Check if a specific boss type is currently alive
   */
  isBossAlive(bossConfigId: string): boolean {
    for (const boss of this.bosses.values()) {
      if (boss.config.id === bossConfigId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clean up on shutdown
   */
  shutdown() {
    // Clear all respawn timers
    for (const timer of this.respawnTimers.values()) {
      clearTimeout(timer);
    }
    this.respawnTimers.clear();

    // Stop all boss behaviors
    for (const boss of this.bosses.values()) {
      boss.stopBehavior();
    }

    this.bosses.clear();
  }
}

// Legacy export for backward compatibility
export const RoamingBossManager = ZoneBossManager;
