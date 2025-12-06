/**
 * AIPlayer - AI-controlled entities that appear indistinguishable from real players
 *
 * The Westworld feature: NPCs that walk, fight, chat, and behave like human players.
 * Other players cannot tell if they're interacting with AI or real people.
 */

import * as _ from 'lodash';
import { Character } from '../character';
import { Types } from '../../../shared/ts/gametypes';
import { Utils } from '../utils';
import { Messages } from '../message';
import { Properties } from '../properties';
import { Formulas } from '../formulas';
import { World } from '../world';
import { getVeniceService } from './venice.service';

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
const CHAT_TEMPLATES = {
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
  armor: number;
  weapon: number;
  armorLevel: number;
  weaponLevel: number;

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

  // Haters list (mobs targeting this AI)
  haters = {};

  // Required Player-like properties
  hasEnteredGame = true;
  isDead = false;
  group: string | null = null;
  recentlyLeftGroups: string[] = [];

  constructor(world: World, usedNames?: Set<string>) {
    const id = aiPlayerIdCounter++;
    super(id.toString(), 'player', Types.Entities.WARRIOR, 0, 0);

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

    console.log(`[AIPlayer] Created "${this.name}" (${this.personality}) at (${this.x}, ${this.y})`);
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
    const armors = [
      Types.Entities.CLOTHARMOR,
      Types.Entities.LEATHERARMOR,
      Types.Entities.MAILARMOR,
    ];
    // Occasionally better gear
    if (Math.random() < 0.2) {
      armors.push(Types.Entities.PLATEARMOR);
    }

    const weapons = [
      Types.Entities.SWORD1,
      Types.Entities.SWORD2,
      Types.Entities.AXE,
    ];
    if (Math.random() < 0.2) {
      weapons.push(Types.Entities.MORNINGSTAR);
    }

    this.armor = armors[Math.floor(Math.random() * armors.length)];
    this.weapon = weapons[Math.floor(Math.random() * weapons.length)];
    this.armorLevel = Properties.getArmorLevel(this.armor);
    this.weaponLevel = Properties.getWeaponLevel(this.weapon);
  }

  private updateHitPoints(): void {
    this.resetHitPoints(Formulas.hp(this.armorLevel));
  }

  private setRandomPosition(): void {
    if (this.world && this.world.map) {
      const pos = this.world.map.getRandomStartingPosition();
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

    _.each(group.players, (playerId: number) => {
      if (playerId !== this.id) {
        this.nearbyPlayers.add(playerId);
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
    if (this.world.map) {
      this.targetX = Math.max(0, Math.min(this.world.map.width - 1, this.targetX));
      this.targetY = Math.max(0, Math.min(this.world.map.height - 1, this.targetY));
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
    // Find direction away from attackers
    let avgAttackerX = 0;
    let avgAttackerY = 0;
    let count = 0;

    this.forEachAttacker((attacker: any) => {
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

  private performAttack(target: any): void {
    if (!target) return;

    // Broadcast attack animation so other players see us swing
    this.broadcast(new Messages.Attack(this.id, target.id));

    const dmg = Formulas.dmg(this.weaponLevel, target.armorLevel);

    if (dmg > 0) {
      target.receiveDamage(dmg, this.id);
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
    this.hitPoints -= damage;

    if (this.hitPoints <= 0) {
      this.die();
    } else if (this.hitPoints < this.maxHitPoints * 0.2) {
      this.behaviorState = 'fleeing';
    }
  }

  die(): void {
    this.isDead = true;
    this.deathCount++;
    this.say(this.getRandomChat('death'));

    // Respawn after delay
    setTimeout(() => {
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

    // Re-add to world
    this.world.handleEntityGroupMembership(this);

    console.log(`[AIPlayer] ${this.name} respawned at (${this.x}, ${this.y})`);
  }

  // Hater management (same as Player)
  addHater(mob: any): void {
    if (mob && !(mob.id in this.haters)) {
      this.haters[mob.id] = mob;
    }
  }

  removeHater(mob: any): void {
    if (mob && mob.id in this.haters) {
      delete this.haters[mob.id];
    }
  }

  forEachHater(callback: (mob: any) => void): void {
    _.each(this.haters, callback);
  }

  // Equip display (for Messages.EquipItem)
  equip(item: number): any {
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
    console.log(`[AIPlayerManager] Starting with ${this.maxAIPlayers} AI players...`);

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

    // Remove all AI players
    this.aiPlayers.forEach((ai, id) => {
      this.world.removeEntity(ai);
    });
    this.aiPlayers.clear();
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

    console.log(`[AIPlayerManager] Spawned AI player: ${ai.name}`);
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
