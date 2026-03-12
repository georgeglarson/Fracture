/**
 * Nemesis System - Shadow of Mordor-style enemy evolution
 *
 * When mobs kill players, they gain power and can become named "nemeses".
 * Players earn revenge bonus XP for killing their nemesis.
 * Creates emergent stories: "The Skeleton that killed me 3x is now level 15!"
 */

import { getServerEventBus } from '../../../shared/ts/events/index.js';
import { Types } from '../../../shared/ts/gametypes';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Nemesis');

// Nemesis name prefixes and suffixes for generating unique names
const NAME_PREFIXES = [
  'Grim', 'Dark', 'Vile', 'Cruel', 'Savage', 'Brutal', 'Vicious', 'Wicked',
  'Dread', 'Grim', 'Shadow', 'Blood', 'Iron', 'Stone', 'Bone', 'Rot',
];

const NAME_SUFFIXES = [
  'bane', 'slayer', 'crusher', 'render', 'ripper', 'claw', 'fang', 'maw',
  'skull', 'tooth', 'blade', 'fury', 'rage', 'doom', 'death', 'terror',
];

const TITLES = [
  'the Unbroken', 'the Relentless', 'the Merciless', 'the Unstoppable',
  'the Feared', 'the Devourer', 'the Destroyer', 'the Butcher',
  'of Many Kills', 'the Hunter', 'the Stalker', 'the Patient',
];

interface NemesisData {
  mobId: number;
  mobKind: number;
  originalName: string;
  nemesisName: string;
  title: string;
  powerLevel: number; // Bonus multiplier (1.0 = normal, 2.0 = double)
  playerKills: number;
  victims: Map<number, number>; // playerId -> kill count
  createdAt: number;
}

interface PlayerNemesisRecord {
  nemesisMobId: number;
  deathCount: number;
  lastDeath: number;
}

// Power scaling per player kill
const POWER_PER_KILL = 0.15; // 15% stronger per kill
const MAX_POWER_LEVEL = 3.0; // Cap at 3x power
const NEMESIS_THRESHOLD = 2; // Becomes nemesis after 2 player kills
const REVENGE_XP_MULTIPLIER = 2.5; // 2.5x XP for killing your nemesis
const REVENGE_GOLD_MULTIPLIER = 2.0; // 2x gold for killing your nemesis

export interface NemesisContext {
  pushBroadcast: (message: any) => void;
  getMobName: (kind: number) => string;
  getMob: (mobId: number) => any;
  getPlayer: (playerId: number) => any;
}

class NemesisService {
  private nemeses: Map<number, NemesisData> = new Map();
  private playerNemeses: Map<number, PlayerNemesisRecord[]> = new Map();
  private context: NemesisContext | null = null;

  constructor() {
    // Listen for player death events
    const eventBus = getServerEventBus();
    eventBus.on('player:died', (event) => {
      if (event.killerId && event.killerType !== undefined) {
        this.onPlayerKilledByMob(event.playerId, event.playerName, event.killerId);
      }
    });

    // Listen for mob death events to handle revenge
    eventBus.on('mob:killed', (event) => {
      this.onMobKilled(event.mobId, event.killerId, event.killerName);
    });

    log.info('Initialized - Enemies will remember you!');
  }

  setContext(context: NemesisContext) {
    this.context = context;
  }

  /**
   * Called when a player is killed by a mob
   */
  private onPlayerKilledByMob(playerId: number, playerName: string, mobId: number) {
    if (!this.context) return;

    const mob = this.context.getMob(mobId);
    if (!mob) return;

    // Get or create nemesis data
    let nemesis = this.nemeses.get(mobId);
    if (!nemesis) {
      nemesis = {
        mobId,
        mobKind: mob.kind,
        originalName: this.context.getMobName(mob.kind),
        nemesisName: '',
        title: '',
        powerLevel: 1.0,
        playerKills: 0,
        victims: new Map(),
        createdAt: Date.now(),
      };
      this.nemeses.set(mobId, nemesis);
    }

    // Increment kill counts
    nemesis.playerKills++;
    const victimKills = (nemesis.victims.get(playerId) || 0) + 1;
    nemesis.victims.set(playerId, victimKills);

    // Increase power level
    nemesis.powerLevel = Math.min(
      MAX_POWER_LEVEL,
      1.0 + (nemesis.playerKills * POWER_PER_KILL)
    );

    // Track this nemesis for the player
    this.recordNemesisForPlayer(playerId, mobId);

    // Check if mob should become a named nemesis
    const wasNemesis = !!nemesis.nemesisName;
    if (!wasNemesis && nemesis.playerKills >= NEMESIS_THRESHOLD) {
      this.promoteToNemesis(nemesis);
    }

    // Apply power boost to the mob (HP/damage)
    this.applyPowerBoost(mob, nemesis);

    // Broadcast nemesis events
    if (nemesis.nemesisName) {
      const announcement = wasNemesis
        ? `${nemesis.nemesisName} ${nemesis.title} has slain ${playerName}! (Power: ${Math.round(nemesis.powerLevel * 100)}%)`
        : `A ${nemesis.originalName} has become ${nemesis.nemesisName} ${nemesis.title} after killing ${playerName}!`;

      log.info({ mobId, nemesisName: nemesis.nemesisName, title: nemesis.title, powerLevel: nemesis.powerLevel, playerName }, announcement);
      this.broadcastNemesisEvent('NEMESIS_POWER_UP', mobId, nemesis, playerName);
    }
  }

  /**
   * Generate a unique nemesis name
   */
  private generateNemesisName(): { name: string; title: string } {
    const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
    const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
    const title = TITLES[Math.floor(Math.random() * TITLES.length)];
    return {
      name: `${prefix}${suffix}`,
      title,
    };
  }

  /**
   * Promote a mob to named nemesis status
   */
  private promoteToNemesis(nemesis: NemesisData) {
    const generated = this.generateNemesisName();
    nemesis.nemesisName = generated.name;
    nemesis.title = generated.title;
    log.info({ nemesisName: nemesis.nemesisName, title: nemesis.title, originalName: nemesis.originalName }, 'Nemesis created');
  }

  /**
   * Apply power boost to the mob's stats
   */
  private applyPowerBoost(mob: any, nemesis: NemesisData) {
    // Boost HP if mob has it
    if (mob.maxHitPoints && mob.originalMaxHp === undefined) {
      mob.originalMaxHp = mob.maxHitPoints;
    }
    if (mob.originalMaxHp) {
      mob.maxHitPoints = Math.floor(mob.originalMaxHp * nemesis.powerLevel);
      mob.hitPoints = Math.min(mob.hitPoints, mob.maxHitPoints);
    }

    // Store power level for damage calculations
    mob.nemesisPowerLevel = nemesis.powerLevel;
    mob.nemesisName = nemesis.nemesisName;
    mob.nemesisTitle = nemesis.title;
  }

  /**
   * Record a nemesis for a player's revenge list
   */
  private recordNemesisForPlayer(playerId: number, mobId: number) {
    let records = this.playerNemeses.get(playerId);
    if (!records) {
      records = [];
      this.playerNemeses.set(playerId, records);
    }

    const existing = records.find(r => r.nemesisMobId === mobId);
    if (existing) {
      existing.deathCount++;
      existing.lastDeath = Date.now();
    } else {
      records.push({
        nemesisMobId: mobId,
        deathCount: 1,
        lastDeath: Date.now(),
      });
    }

    // Keep only top 5 nemeses per player
    records.sort((a, b) => b.deathCount - a.deathCount);
    if (records.length > 5) {
      records.length = 5;
    }
  }

  /**
   * Called when a mob is killed - check for revenge bonus
   */
  private onMobKilled(mobId: number, killerId: number, killerName: string) {
    const nemesis = this.nemeses.get(mobId);
    if (!nemesis) return;

    const playerRecords = this.playerNemeses.get(killerId);
    const wasNemesisForPlayer = playerRecords?.some(r => r.nemesisMobId === mobId);

    if (nemesis.nemesisName) {
      const announcement = wasNemesisForPlayer
        ? `${killerName} has taken REVENGE on ${nemesis.nemesisName} ${nemesis.title}!`
        : `${killerName} has slain ${nemesis.nemesisName} ${nemesis.title}!`;

      log.info({ mobId, nemesisName: nemesis.nemesisName, title: nemesis.title, killerName, isRevenge: wasNemesisForPlayer }, announcement);
      this.broadcastNemesisEvent('NEMESIS_KILLED', mobId, nemesis, killerName, wasNemesisForPlayer);
    }

    // Clean up player records
    if (playerRecords) {
      const idx = playerRecords.findIndex(r => r.nemesisMobId === mobId);
      if (idx >= 0) {
        playerRecords.splice(idx, 1);
      }
    }

    // Remove nemesis data
    this.nemeses.delete(mobId);
  }

  /**
   * Check if a mob kill qualifies for revenge bonus
   */
  isRevengeKill(playerId: number, mobId: number): boolean {
    const records = this.playerNemeses.get(playerId);
    return records?.some(r => r.nemesisMobId === mobId) || false;
  }

  /**
   * Get revenge multipliers for XP/gold
   */
  getRevengeMultipliers(playerId: number, mobId: number): { xp: number; gold: number } {
    if (this.isRevengeKill(playerId, mobId)) {
      return {
        xp: REVENGE_XP_MULTIPLIER,
        gold: REVENGE_GOLD_MULTIPLIER,
      };
    }
    return { xp: 1.0, gold: 1.0 };
  }

  /**
   * Get nemesis info for a mob
   */
  getNemesisInfo(mobId: number): NemesisData | undefined {
    return this.nemeses.get(mobId);
  }

  /**
   * Get player's nemeses list
   */
  getPlayerNemeses(playerId: number): PlayerNemesisRecord[] {
    return this.playerNemeses.get(playerId) || [];
  }

  /**
   * Broadcast nemesis event to all players
   */
  private broadcastNemesisEvent(
    type: string,
    mobId: number,
    nemesis: NemesisData,
    playerName: string,
    isRevenge: boolean = false
  ) {
    if (!this.context) return;

    // Import Messages dynamically to avoid circular dependency
    const { Messages } = require('../message');

    if (type === 'NEMESIS_POWER_UP') {
      this.context.pushBroadcast(
        new Messages.NemesisPowerUp(
          mobId,
          nemesis.originalName,
          nemesis.nemesisName,
          nemesis.title,
          Math.round(nemesis.powerLevel * 100),
          nemesis.playerKills,
          playerName
        )
      );
    } else if (type === 'NEMESIS_KILLED') {
      this.context.pushBroadcast(
        new Messages.NemesisKilled(
          mobId,
          nemesis.nemesisName,
          nemesis.title,
          nemesis.playerKills,
          playerName,
          isRevenge
        )
      );
    }
  }

  /**
   * Clean up nemesis data for disconnected players
   */
  onPlayerDisconnect(playerId: number) {
    this.playerNemeses.delete(playerId);
  }
}

export const nemesisService = new NemesisService();
