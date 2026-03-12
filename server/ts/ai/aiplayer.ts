/**
 * AIPlayer - AI-controlled entities that appear indistinguishable from real players
 *
 * The Westworld feature: NPCs that walk, fight, chat, and behave like human players.
 * Other players cannot tell if they're interacting with AI or real people.
 */

import { Character } from '../character';
import { Mob } from '../mob';
import { Types } from '../../../shared/ts/gametypes';
import { Utils } from '../utils';
import { Messages } from '../message';
import { Properties } from '../properties';
import { Formulas } from '../formulas';
import { World } from '../world';
import { getVeniceService } from './venice.service';
import { getCombatTracker } from '../combat/combat-tracker';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('AIPlayer');

/**
 * Combat target interface
 */
interface CombatTarget {
  id: number | string;
  hitPoints: number;
  armorLevel: number;
  receiveDamage(damage: number, attackerId: number | string): void;
}

/**
 * Serializable message interface
 */
interface SerializableMessage {
  serialize(): unknown[];
}

// AI personality types affect behavior and chat style
type Personality = 'warrior' | 'explorer' | 'social' | 'hunter' | 'newbie';

// Behavior states
type BehaviorState = 'idle' | 'wandering' | 'fighting' | 'chatting' | 'fleeing' | 'following';

// Human-like names pool
const AI_NAMES = [
  'xXSlayerXx', 'DarkKnight99', 'NoobMaster', 'ProGamer2024', 'CoolDude42',
  'ShadowBlade', 'DragonSlayer', 'NightHawk', 'ThunderBolt', 'IronFist',
  'GhostRider', 'StormBreaker', 'FireStorm', 'IceQueen', 'DoomBringer',
  'LegendKiller', 'BeastMode', 'NinjaMaster', 'PixelWarrior', 'RetroHero',
  'CryptoKnight', 'MemeLord', 'EpicFail', 'RNGesus', 'AFK_King',
  'lol_what', 'SendHelp', 'WhyAmIHere', 'JustVibing', 'TouchGrass',
  'Bob', 'Alice', 'Steve', 'Dave', 'Max', 'Luna', 'Kai', 'Zoe'
];

// Chat messages that feel like real players
const CHAT_TEMPLATES: Record<string, string[]> = {
  idle: [
    'anyone know where the good loot is?',
    'this game is pretty cool',
    'brb getting food',
    'lol',
    'gg',
    '...',
    'hi',
    'sup',
    'where is everyone',
    'so bored rn',
    'anyone wanna party up?',
  ],
  combat: [
    'die!',
    'get rekt',
    'ez',
    'ow',
    'need help here!',
    'almost got him',
    'cmon cmon cmon',
    'yes!',
    'nooo',
  ],
  death: [
    'bruh',
    'ugh',
    'lame',
    'i hate this game',
    'lag',
    'totally lagged',
    'whatever',
    'rigged',
  ],
  greeting: [
    'hey',
    'hi',
    'yo',
    'sup',
    'hello',
    'hiii',
  ],
  victory: [
    'gg',
    'ez',
    'lets gooo',
    'yesss',
    'finally',
    'loot time',
  ],
  newbie: [
    'how do i attack?',
    'where do i go?',
    'im lost',
    'is this game good?',
    'first time playing',
    'what do i do',
  ],
};

let aiPlayerIdCounter = 100000; // Start high to avoid collision with real player IDs

export class AIPlayer extends Character {
  // Player-like properties (must match Player for getState())
  name: string;
  level: number = 1;   // Derived from equipment tier
  armor!: number;      // Initialized in constructor via setRandomEquipment()
  weapon!: number;     // Initialized in constructor via setRandomEquipment()
  armorLevel!: number; // Initialized in constructor via setRandomEquipment()
  weaponLevel!: number; // Initialized in constructor via setRandomEquipment()

  // AI-specific properties
  personality: Personality;
  behaviorState: BehaviorState = 'idle';
  world: World;

  // Behavior timers
  private lastChatTime: number = 0;
  private chatCooldown: number;
  private lastMoveTime: number = 0;
  private moveCooldown: number;
  private lastActionTime: number = 0;
  private actionCooldown: number;

  // Memory
  private nearbyPlayers: Set<number> = new Set();
  private lastGreetedPlayers: Set<number> = new Set();
  private killCount: number = 0;
  private deathCount: number = 0;

  // Patrol/wander destination
  private targetX: number | null = null;
  private targetY: number | null = null;

  // Damage processing - tracks when each attacker last hit us
  private lastDamageFromAttacker: Map<number | string, number> = new Map();
  private static readonly ATTACKER_HIT_COOLDOWN = 900; // ms between hits (matches game animation speed)

  // Respawn timer (stored for cleanup)
  respawnTimer: ReturnType<typeof setTimeout> | null = null;

  // Required Player-like properties
  hasEnteredGame = true;
  isDead = false;
  group: string | null = null;
  recentlyLeftGroups: string[] = [];

  constructor(world: World, usedNames?: Set<string>) {
    const id = aiPlayerIdCounter++;
    super(id.toString(), 'player', Types.Entities.WARRIOR, 0, 0);

    // Mark as AI to distinguish from human Player (both have type === 'player')
    this.isAI = true;

    this.world = world;
    this.name = this.generateName(usedNames);
    this.personality = this.generatePersonality();

    // Equip random gear (but not the best stuff - that would be suspicious)
    this.equipRandomGear();

    // Set HP based on armor
    this.updateHitPoints();

    // Random position
    this.setRandomPosition();

    // Behavior timing (with human-like variance)
    this.chatCooldown = 15000 + Math.random() * 45000; // 15-60 seconds
    this.moveCooldown = 300 + Math.random() * 200;     // 300-500ms per tile (fast like real players)
    this.actionCooldown = 800 + Math.random() * 400;   // 0.8-1.2 seconds between attacks

    log.debug({ name: this.name, personality: this.personality, x: this.x, y: this.y }, 'Created AI player');
  }

  private generateName(usedNames?: Set<string>): string {
    let name: string;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      // Sometimes use AI-generated looking names with numbers, sometimes pool names
      if (Math.random() < 0.3 || attempts > 10) {
        const base = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
        name = base + Math.floor(Math.random() * 1000);
      } else {
        name = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
      }
      attempts++;
    } while (usedNames && usedNames.has(name) && attempts < maxAttempts);

    return name;
  }

  private generatePersonality(): Personality {
    const roll = Math.random();
    if (roll < 0.25) return 'warrior';      // Aggressive, seeks combat
    if (roll < 0.45) return 'explorer';     // Wanders far, curious
    if (roll < 0.60) return 'social';       // Chats more, follows players
    if (roll < 0.80) return 'hunter';       // Seeks specific mobs
    return 'newbie';                          // Acts confused, asks questions
  }

  private equipRandomGear(): void {
    // Random armor (not the best - that would be suspicious for a "new" player)
    const armors: number[] = [
      Types.Entities.CLOTHARMOR,
      Types.Entities.LEATHERARMOR,
      Types.Entities.MAILARMOR,
    ];
    // Occasionally better gear
    if (Math.random() < 0.2) {
      armors.push(Types.Entities.PLATEARMOR);
    }

    const weapons: number[] = [
      Types.Entities.SWORD1,
      Types.Entities.SWORD2,
      Types.Entities.AXE,
    ];
    if (Math.random() < 0.2) {
      weapons.push(Types.Entities.MORNINGSTAR);
    }

    this.armor = armors[Math.floor(Math.random() * armors.length)];
    this.weapon = weapons[Math.floor(Math.random() * weapons.length)];
    this.armorLevel = Properties.getArmorLevel(this.armor) ?? 1;
    this.weaponLevel = Properties.getWeaponLevel(this.weapon) ?? 1;
    this.level = Math.max(this.armorLevel, this.weaponLevel);
  }

  private updateHitPoints(): void {
    this.resetHitPoints(Formulas.hp(this.armorLevel));
  }

  private setRandomPosition(): void {
    const map = this.world?.map as any;
    if (map) {
      // Use non-starting checkpoints to avoid cluttering the player spawn area
      const pos = map.getRandomNonStartingPosition
        ? map.getRandomNonStartingPosition()
        : map.getRandomStartingPosition();
      this.setPosition(pos.x, pos.y);
    }
  }

  // Must match Player.getState() exactly for client rendering
  getState(): any[] {
    const basestate = this._getBaseState();
    const state = [this.name, this.orientation, this.armor, this.weapon];

    if (this.target) {
      state.push(this.target);
    }

    return basestate.concat(state);
  }

  destroy(): void {
    // Cleanup
    this.nearbyPlayers.clear();
    this.lastGreetedPlayers.clear();
    this.lastDamageFromAttacker.clear();
  }

  // ============================================================================
  // BEHAVIOR LOOP - Called by World
  // ============================================================================

  tick(): void {
    if (this.isDead) return;

    const now = Date.now();

    // Update nearby players awareness
    this.updateNearbyPlayers();

    // State machine
    switch (this.behaviorState) {
      case 'idle':
        this.tickIdle(now);
        break;
      case 'wandering':
        this.tickWandering(now);
        break;
      case 'fighting':
        this.tickFighting(now);
        break;
      case 'fleeing':
        this.tickFleeing(now);
        break;
      case 'chatting':
        this.tickChatting(now);
        break;
    }

    // Process incoming damage from attackers (AI players don't have clients to send HURT)
    this.processDamageFromAttackers(now);

    // Random chance to chat (personality-based)
    if (now - this.lastChatTime > this.chatCooldown) {
      this.maybeChat();
      this.lastChatTime = now;
      this.chatCooldown = this.getNextChatCooldown();
    }
  }

  private updateNearbyPlayers(): void {
    // Get players in same group
    if (!this.group || !this.world.groups[this.group]) return;

    const group = this.world.groups[this.group];
    this.nearbyPlayers.clear();

    group.players.forEach((playerId) => {
      if (playerId !== this.id) {
        this.nearbyPlayers.add(playerId as number);
      }
    });
  }

  private tickIdle(now: number): void {
    // Occasionally greet nearby players
    this.nearbyPlayers.forEach(playerId => {
      if (!this.lastGreetedPlayers.has(playerId) && Math.random() < 0.3) {
        this.say(this.getRandomChat('greeting'));
        this.lastGreetedPlayers.add(playerId);
      }
    });

    // Decide what to do
    const roll = Math.random();

    if (this.personality === 'warrior' && roll < 0.4) {
      // Look for something to fight
      this.seekCombat();
    } else if (this.personality === 'social' && this.nearbyPlayers.size > 0 && roll < 0.3) {
      this.behaviorState = 'chatting';
    } else if (roll < 0.6) {
      this.startWandering();
    }
    // Else stay idle
  }

  private tickWandering(now: number): void {
    if (now - this.lastMoveTime < this.moveCooldown) return;

    // Move toward target or pick new destination
    if (this.targetX === null || this.targetY === null || this.reachedTarget()) {
      if (Math.random() < 0.3) {
        // Stop wandering
        this.behaviorState = 'idle';
        this.targetX = null;
        this.targetY = null;
        return;
      }
      this.pickNewWanderTarget();
    }

    // Move one step toward target
    this.moveTowardTarget();
    this.lastMoveTime = now;
  }

  private tickFighting(now: number): void {
    if (!this.target) {
      this.behaviorState = 'idle';
      return;
    }

    const target = this.world.getEntityById(this.target);
    if (!target || target.hitPoints <= 0) {
      this.clearTarget();
      this.behaviorState = 'idle';
      this.say(this.getRandomChat('victory'));
      this.killCount++;
      return;
    }

    // Check HP - flee if low
    if (this.hitPoints < this.maxHitPoints * 0.2) {
      this.behaviorState = 'fleeing';
      this.say('gotta run!');
      return;
    }

    // Attack!
    if (now - this.lastActionTime > this.actionCooldown) {
      this.performAttack(target);
      this.lastActionTime = now;
    }
  }

  private tickFleeing(now: number): void {
    // Run away from attackers
    if (now - this.lastMoveTime < this.moveCooldown) return;

    // Move away from danger
    this.moveAwayFromDanger();
    this.lastMoveTime = now;

    // Stop fleeing if safe
    if (this.hitPoints > this.maxHitPoints * 0.5 || Object.keys(this.attackers).length === 0) {
      this.behaviorState = 'idle';
    }
  }

  private tickChatting(now: number): void {
    // Social behavior - stay near players and chat
    if (this.nearbyPlayers.size === 0) {
      this.behaviorState = 'idle';
      return;
    }

    if (Math.random() < 0.1) {
      this.say(this.getRandomChat('idle'));
    }

    if (Math.random() < 0.2) {
      this.behaviorState = 'idle';
    }
  }

  /**
   * Process damage from attacking mobs.
   * AI players don't have clients to send HURT messages, so we process damage server-side.
   */
  private processDamageFromAttackers(now: number): void {
    // Get all mobs from CombatTracker (mobs that have aggro on this AI player)
    this.forEachHater((attacker: Mob) => {
      // Skip if attacker is dead
      if (!attacker || attacker.isDead || attacker.hitPoints <= 0) return;

      // Check if mob is adjacent (distance <= 1 tile = 16 pixels)
      // Utils.distanceTo returns Chebyshev distance in PIXELS
      const distance = Utils.distanceTo(this.x, this.y, attacker.x, attacker.y);
      if (distance > 16) return;

      // Check attack cooldown for this specific attacker
      const lastHit = this.lastDamageFromAttacker.get(attacker.id) || 0;
      if (now - lastHit < AIPlayer.ATTACKER_HIT_COOLDOWN) return;

      // Calculate and apply damage using the same formula as real players
      const mobWeaponLevel = attacker.weaponLevel || 1;
      const damage = Formulas.dmg(mobWeaponLevel, this.armorLevel);

      // Convert id to number if needed
      const attackerId = typeof attacker.id === 'string' ? parseInt(attacker.id, 10) : attacker.id;
      this.receiveDamage(damage, attackerId);
      this.lastDamageFromAttacker.set(attacker.id, now);

      // NOTE: AIPlayers do NOT broadcast health updates.
      // Unlike human players, AIPlayers don't have connected clients.
      // Broadcasting health() would confuse human players since HEALTH
      // messages don't include a player ID - they'd apply AIPlayer's HP
      // to their own health bar, causing erratic jumps.
    });
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  private startWandering(): void {
    this.behaviorState = 'wandering';
    this.pickNewWanderTarget();
  }

  private pickNewWanderTarget(): void {
    // Pick a random point within reasonable distance
    const range = this.personality === 'explorer' ? 20 : 10;
    this.targetX = this.x + Math.floor(Math.random() * range * 2) - range;
    this.targetY = this.y + Math.floor(Math.random() * range * 2) - range;

    // Clamp to valid positions
    const map = this.world?.map as any;
    if (map) {
      this.targetX = Math.max(0, Math.min(map.width - 1, this.targetX));
      this.targetY = Math.max(0, Math.min(map.height - 1, this.targetY));
    }
  }

  private reachedTarget(): boolean {
    return this.targetX !== null &&
           this.targetY !== null &&
           Math.abs(this.x - this.targetX) <= 1 &&
           Math.abs(this.y - this.targetY) <= 1;
  }

  private moveTowardTarget(): void {
    if (this.targetX === null || this.targetY === null) return;

    let newX = this.x;
    let newY = this.y;

    if (this.x < this.targetX) newX++;
    else if (this.x > this.targetX) newX--;

    if (this.y < this.targetY) newY++;
    else if (this.y > this.targetY) newY--;

    // Validate position
    if (this.world.isValidPosition(newX, newY)) {
      this.setPosition(newX, newY);
      this.broadcast(new Messages.Move(this));
      this.world.handleEntityGroupMembership(this);
    } else {
      // Obstacle - pick new target
      this.pickNewWanderTarget();
    }
  }

  private moveAwayFromDanger(): void {
    // Find direction away from mobs that have aggro on us
    let avgAttackerX = 0;
    let avgAttackerY = 0;
    let count = 0;

    this.forEachHater((attacker: Mob) => {
      avgAttackerX += attacker.x;
      avgAttackerY += attacker.y;
      count++;
    });

    if (count === 0) return;

    avgAttackerX /= count;
    avgAttackerY /= count;

    // Move opposite direction
    let newX = this.x;
    let newY = this.y;

    if (this.x < avgAttackerX) newX--;
    else if (this.x > avgAttackerX) newX++;

    if (this.y < avgAttackerY) newY--;
    else if (this.y > avgAttackerY) newY++;

    if (this.world.isValidPosition(newX, newY)) {
      this.setPosition(newX, newY);
      this.broadcast(new Messages.Move(this));
      this.world.handleEntityGroupMembership(this);
    }
  }

  private seekCombat(): void {
    // Look for mobs in the group
    if (!this.group || !this.world.groups[this.group]) return;

    const group = this.world.groups[this.group];

    // Find a mob to attack
    for (const entityId in group.entities) {
      const entity = group.entities[entityId];
      if (entity && entity.type === 'mob' && !entity.isDead) {
        this.setTarget(entity);
        this.behaviorState = 'fighting';
        this.broadcast(new Messages.Attack(this.id, this.target));
        return;
      }
    }

    // No mobs found, wander instead
    this.startWandering();
  }

  private performAttack(target: Mob): void {
    if (!target) return;

    // Broadcast attack animation so other players see us swing
    this.broadcast(new Messages.Attack(this.id, target.id));

    const dmg = Formulas.dmg(this.weaponLevel, target.armorLevel);

    if (dmg > 0) {
      target.receiveDamage(dmg, this.id as number);
      this.world.handleMobHate(target.id, this.id, dmg);
      this.world.handleHurtEntity(target, this, dmg);

      // Combat chat
      if (Math.random() < 0.1) {
        this.say(this.getRandomChat('combat'));
      }
    }
  }

  // ============================================================================
  // CHAT & COMMUNICATION
  // ============================================================================

  private maybeChat(): void {
    // Personality affects chat frequency
    let chatChance = 0.1;
    if (this.personality === 'social') chatChance = 0.3;
    if (this.personality === 'newbie') chatChance = 0.2;

    if (this.nearbyPlayers.size > 0) {
      chatChance *= 2; // More likely to chat when others are around
    }

    if (Math.random() < chatChance) {
      let category = 'idle';
      if (this.personality === 'newbie' && Math.random() < 0.5) {
        category = 'newbie';
      }
      this.say(this.getRandomChat(category));
    }
  }

  private getRandomChat(category: string): string {
    const templates = CHAT_TEMPLATES[category] || CHAT_TEMPLATES.idle;
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private getNextChatCooldown(): number {
    // Social personalities chat more frequently
    const base = this.personality === 'social' ? 10000 : 20000;
    const variance = this.personality === 'social' ? 20000 : 40000;
    return base + Math.random() * variance;
  }

  say(message: string): void {
    if (!message || message.trim() === '') return;

    // Broadcast to zone (same as real players)
    this.broadcastToZone(new Messages.Chat(this, message));
  }

  // ============================================================================
  // WORLD INTEGRATION
  // ============================================================================

  broadcast(message: any): void {
    if (this.group) {
      this.world.pushToAdjacentGroups(this.group, message, this.id);
    }
  }

  broadcastToZone(message: any): void {
    if (this.group) {
      this.world.pushToGroup(this.group, message, this.id);
    }
  }

  // Handle being attacked
  receiveDamage(damage: number, attackerId: number): void {
    if (this.isDead) return; // Already dead, ignore further damage
    this.hitPoints = Math.max(0, this.hitPoints - damage);

    if (this.hitPoints <= 0) {
      this.die();
    } else if (this.hitPoints < this.maxHitPoints * 0.2) {
      this.behaviorState = 'fleeing';
    } else if (this.behaviorState !== 'fighting') {
      // Fight back! Set the attacker as target and switch to fighting state
      this.target = attackerId;
      this.behaviorState = 'fighting';
      log.debug({ name: this.name, attackerId }, 'Fighting back against attacker');
    }
  }

  die(): void {
    this.isDead = true;
    this.deathCount++;
    this.say(this.getRandomChat('death'));

    // Clear all mob aggro using CombatTracker
    const tracker = getCombatTracker();
    tracker.clearPlayerAggro(this.id as number);

    // Clear attackers and redirect mobs to other targets
    this.attackers = {};

    // Broadcast despawn to nearby players
    if (this.group) {
      this.world.pushToGroup(this.group, new Messages.Despawn(this.id));
    }

    // Remove from world entities temporarily
    this.world.removeEntity(this);

    log.debug({ name: this.name, deathCount: this.deathCount }, 'AI player died');

    // Respawn after delay (store handle for cleanup)
    this.respawnTimer = setTimeout(() => {
      this.respawnTimer = null;
      this.respawn();
    }, 5000 + Math.random() * 10000); // 5-15 seconds
  }

  respawn(): void {
    this.isDead = false;
    this.setRandomPosition();
    this.updateHitPoints();
    this.behaviorState = 'idle';
    this.clearTarget();
    this.attackers = {};
    this.lastDamageFromAttacker.clear();

    // Re-add to world
    this.world.handleEntityGroupMembership(this);

    log.debug({ name: this.name, x: this.x, y: this.y }, 'AI player respawned');
  }

  /**
   * Add a mob to the player's haters list (mob has aggro on player)
   * Note: CombatTracker is the source of truth - this is called from combat-system
   */
  addHater(_mob: Mob): void {
    // No-op: CombatTracker tracks this via mob.increaseHateFor() -> addAggro()
    // Keeping method signature for interface compatibility
  }

  /**
   * Remove a mob from the player's haters list
   * Note: CombatTracker is the source of truth
   */
  removeHater(_mob: Mob): void {
    // No-op: CombatTracker tracks this via mob.forgetPlayer() -> removeAggro()
    // Keeping method signature for interface compatibility
  }

  /**
   * Iterate over all mobs that have aggro on this AI player
   * Queries CombatTracker directly - no local cache
   */
  forEachHater(callback: (mob: Mob) => void): void {
    const playerId = typeof this.id === 'string' ? parseInt(this.id, 10) : this.id;
    getCombatTracker().forEachMobAttackingWithEntity<Mob>(playerId, callback);
  }

  /**
   * Clear all aggro relationships when AI player dies/despawns
   */
  clearAllAggro(): void {
    const playerId = typeof this.id === 'string' ? parseInt(this.id, 10) : this.id;
    getCombatTracker().clearPlayerAggro(playerId);
  }

  // Equip display (for Messages.EquipItem)
  equip(item: number): SerializableMessage {
    return new Messages.EquipItem(this, item);
  }
}

// ============================================================================
// AI PLAYER MANAGER - Spawns and manages all AI players
// ============================================================================

export class AIPlayerManager {
  private world: World;
  private aiPlayers: Map<number, AIPlayer> = new Map();
  private maxAIPlayers: number = 5;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private usedNames: Set<string> = new Set();

  constructor(world: World, maxPlayers: number = 5) {
    this.world = world;
    this.maxAIPlayers = maxPlayers;
  }

  start(): void {
    log.info({ maxAIPlayers: this.maxAIPlayers }, 'Starting AI player manager');

    // Spawn initial AI players
    for (let i = 0; i < this.maxAIPlayers; i++) {
      setTimeout(() => {
        this.spawnAIPlayer();
      }, i * 2000); // Stagger spawns
    }

    // Behavior tick every 500ms
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 500);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Remove all AI players and clear their respawn timers
    this.aiPlayers.forEach((ai) => {
      if (ai.respawnTimer) {
        clearTimeout(ai.respawnTimer);
        ai.respawnTimer = null;
      }
      this.world.removeEntity(ai);
    });
    this.aiPlayers.clear();
    this.usedNames.clear();
  }

  private spawnAIPlayer(): void {
    const ai = new AIPlayer(this.world, this.usedNames);

    // Track the name to prevent duplicates
    this.usedNames.add(ai.name);

    // Add to world like a real player
    this.world.addEntity(ai);
    this.world.players[ai.id] = ai;

    // Create outgoing queue (empty - AI doesn't receive messages)
    this.world.broadcaster?.createQueue(ai.id);

    this.aiPlayers.set(ai.id, ai);

    log.debug({ name: ai.name }, 'Spawned AI player');
  }

  private tick(): void {
    this.aiPlayers.forEach((ai) => {
      ai.tick();
    });
  }

  getAIPlayer(id: number): AIPlayer | undefined {
    return this.aiPlayers.get(id);
  }

  isAIPlayer(id: number): boolean {
    return this.aiPlayers.has(id);
  }
}
