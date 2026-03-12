// Fracture Player - with AI Narrator integration
import {FormatChecker} from './format';
import {Character} from './character';
import {Connection, Server} from './ws';
import {Types} from '../../shared/ts/gametypes';
import {Utils} from './utils';
import {World} from './world';
import {Messages} from './message';
import {Formulas} from './formulas';
import {getCombatTracker} from './combat/combat-tracker';
import type {Mob} from './mob';
import type {Checkpoint} from './checkpoint';
import type {Item} from './item';

// Minimal interface for serializable messages (avoid importing all message types)
// Can be an object with serialize() or a raw array (already serialized)
interface SerializableMessage {
  serialize(): unknown[];
}
type MessagePayload = SerializableMessage | unknown[];
import {Chest} from './chest';
import {EquipmentManager} from './equipment/equipment-manager';
import {PlayerAchievements} from '../../shared/ts/achievements';
import {Inventory} from './inventory/inventory';
import {SerializedInventorySlot} from '../../shared/ts/inventory/inventory-types';
import {MessageRouter} from './player/message-router';
import {getDailyRewardService} from './player/daily-reward.service';
import {ProgressionService, createProgressionService} from './player/progression.service';
import {IStorageService, PlayerSaveState} from './storage/storage.interface';
import * as VeniceHandler from './player/venice.handler';
import * as PartyHandler from './player/party.handler';
import * as InventoryHandler from './player/inventory.handler';
import * as AchievementHandler from './player/achievement.handler';
import * as PersistenceHandler from './player/persistence.handler';
import * as EquipmentHandler from './player/equipment.handler';
import * as ZoneHandler from './player/zone.handler';
import * as SkillHandler from './player/skill.handler';
import * as ProgressionHandler from './player/progression.handler';
import * as RiftHandler from './player/rift.handler';
import { PlayerSkillState, createInitialSkillState } from '../../shared/ts/skills';
import { createModuleLogger } from './utils/logger.js';

const log = createModuleLogger('Player');

export class Player extends Character {
  // Shared message router instance (singleton pattern)
  private static messageRouter: MessageRouter | null = null;

  private static getMessageRouter(): MessageRouter {
    if (!Player.messageRouter) {
      Player.messageRouter = new MessageRouter(Messages, Formulas, Utils, Chest);
    }
    return Player.messageRouter;
  }

  hasEnteredGame = false;
  spawnProtectionUntil = 0; // Timestamp until which player is immune to mob aggro
  lastCheckpoint: Checkpoint | null = null;
  disconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  formatChecker: FormatChecker;
  name!: string;
  firepotionTimeout: ReturnType<typeof setTimeout> | null = null;

  // Equipment management (unified handling of all equipment slots)
  private equipment: EquipmentManager = new EquipmentManager();

  // Inventory management
  private inventory: Inventory = new Inventory();

  // Skill system state
  private skillState: PlayerSkillState = createInitialSkillState();

  // Progression service (handles XP, leveling, gold)
  private progression!: ProgressionService;

  // Legacy accessors for backward compatibility
  get weapon(): number { return this.equipment.weapon; }
  get armor(): number { return this.equipment.armor; }
  get weaponLevel(): number { return this.equipment.weaponLevel; }
  get armorLevel(): number { return this.equipment.armorLevel; }

  // Client IP for rate limiting
  get clientIp(): string { return this.connection.clientIp; }

  // Progression accessors (delegate to service)
  get level(): number { return this.progression?.level ?? 1; }
  set level(value: number) { if (this.progression) this.progression.level = value; }
  get xp(): number { return this.progression?.xp ?? 0; }
  set xp(value: number) { if (this.progression) this.progression.xp = value; }
  get xpToNext(): number { return this.progression?.xpToNext ?? 100; }
  get gold(): number { return this.progression?.gold ?? 0; }
  set gold(value: number) { if (this.progression) this.progression.gold = value; }

  // Achievement system
  title: string | null = null;

  // Database character ID (for persistence)
  characterId: string | null = null;

  // Daily login data (loaded from SQLite)
  dailyData: PersistenceHandler.LoadedDailyData | null = null;

  // Progression efficiency system (loaded from SQLite)
  ascensionCount: number = 0;
  restedXp: number = 0;
  lastLogoutTime: number = 0;
  sessionStartTime: number = Date.now();

  zoneCallback: (() => void) | null = null;
  moveCallback: ((x: number, y: number) => void) | null = null;
  lootmoveCallback: ((x: number, y: number) => void) | null = null;
  messageCallback: ((message: unknown[]) => void) | null = null;
  exitCallback: (() => void) | null = null;
  broadcastCallback: ((message: MessagePayload, ignoreSelf: boolean) => void) | null = null;
  broadcastzoneCallback: ((message: MessagePayload, ignoreSelf: boolean) => void) | null = null;
  orientCallback: ((orientation: number) => void) | null = null;
  requestposCallback: (() => { x: number; y: number }) | null = null;

  constructor(private connection: Connection, private world: World) {
    super(connection.id, 'player', Types.Entities.WARRIOR, 0, 0);

    this.formatChecker = new FormatChecker();

    // Initialize progression service with callbacks
    this.progression = createProgressionService({
      send: (msg) => this.send(msg),
      updateHitPoints: () => this.updateHitPoints(),
      getMaxHitPoints: () => this.maxHitPoints,
      checkLevelAchievements: (level) => this.checkLevelAchievements(level),
      checkGoldAchievements: (amount) => this.checkGoldAchievements(amount),
      getName: () => this.name
    });

    this.connection.listen(async (message: unknown[]) => {
      try {
        const action = parseInt(String(message[0]));

        if (!this.formatChecker.check(message)) {
          this.connection.close('Invalid ' + Types.getMessageTypeAsString(action) + ' message format: ' + message);
          return;
        }

        if (!this.hasEnteredGame && action !== Types.Messages.HELLO) { // HELLO must be the first message
          this.connection.close('Invalid handshake message: ' + message);
          return;
        }
        if (this.hasEnteredGame && !this.isDead && action === Types.Messages.HELLO) { // HELLO can be sent only once
          this.connection.close('Cannot initiate handshake twice: ' + message);
          return;
        }

        this.resetTimeout();

        // Route message through MessageRouter - delegates to appropriate handler
        const handled = await Player.getMessageRouter().route(this, message);

        // If not handled by router, pass to message callback
        if (!handled && this.messageCallback) {
          this.messageCallback(message);
        }
      } catch (error) {
        log.error({ err: error, playerName: this.name }, 'Error handling message');
      }
    });

    this.connection.onClose(() => {
      if (this.firepotionTimeout) {
        clearTimeout(this.firepotionTimeout);
      }
      if (this.disconnectTimeout) {
        clearTimeout(this.disconnectTimeout);
      }
      if (this.exitCallback) {
        this.exitCallback();
      }
    });

    this.connection.sendUTF8('go'); // Notify client that the HELLO/WELCOME handshake can start
  }

  destroy() {
    this.forEachAttacker((mob) => {
      mob.clearTarget();
      // Tell each attacking mob to forget this player so it returns to spawn
      if ('forgetPlayer' in mob && typeof mob.forgetPlayer === 'function') {
        mob.forgetPlayer(this.id);
      }
    });
    this.attackers = {};

    // Tell each mob that has aggro on us to forget us
    this.forEachHater((mob) => {
      mob.forgetPlayer(this.id);
    });
    // CombatTracker is the single source of truth - clear all aggro for this player
    getCombatTracker().clearPlayerAggro(this.id as number);

    // Clear any active firepotion timeout
    if (this.firepotionTimeout) {
      clearTimeout(this.firepotionTimeout);
      this.firepotionTimeout = null;
    }

    this.cleanupParty();
  }

  getState() {
    const basestate = this._getBaseState(),
      state = [this.name, this.orientation, this.armor, this.weapon];

    if (this.target) {
      state.push(this.target);
    }

    return basestate.concat(state);
  }

  send(message: MessagePayload) {
    this.connection.send(message);
  }

  getWorld() {
    return this.world;
  }

  getCombatTracker() {
    return getCombatTracker();
  }

  getInventory() {
    return this.inventory;
  }

  setFirepotionTimeout(timeout: ReturnType<typeof setTimeout> | null) {
    this.firepotionTimeout = timeout;
  }

  setTitle(title: string | null) {
    this.title = title;
  }

  setCharacterId(id: string) {
    this.characterId = id;
  }

  setDailyData(data: PersistenceHandler.LoadedDailyData) {
    this.dailyData = data;
  }

  setProgressionData(data: { ascensionCount: number; restedXp: number; lastLogoutTime: number }) {
    this.ascensionCount = data.ascensionCount;
    this.restedXp = data.restedXp;
    this.lastLogoutTime = data.lastLogoutTime;
  }

  getProgression() {
    return this.progression;
  }

  getEquipment() {
    return this.equipment;
  }

  broadcast(message: MessagePayload, ignoreSelf?: boolean) {
    if (this.broadcastCallback) {
      this.broadcastCallback(message, ignoreSelf === undefined ? true : ignoreSelf);
    }
  }

  broadcastToZone(message: MessagePayload, ignoreSelf?: boolean) {
    if (this.broadcastzoneCallback) {
      this.broadcastzoneCallback(message, ignoreSelf === undefined ? true : ignoreSelf);
    }
  }

  onExit(callback: () => void) {
    this.exitCallback = callback;
  }

  onMove(callback: (x: number, y: number) => void) {
    this.moveCallback = callback;
  }

  onLootMove(callback: (x: number, y: number) => void) {
    this.lootmoveCallback = callback;
  }

  onZone(callback: () => void) {
    this.zoneCallback = callback;
  }

  onOrient(callback: (orientation: number) => void) {
    this.orientCallback = callback;
  }

  onMessage(callback: (message: unknown[]) => void) {
    this.messageCallback = callback;
  }

  onBroadcast(callback: (message: MessagePayload, ignoreSelf: boolean) => void) {
    this.broadcastCallback = callback;
  }

  onBroadcastToZone(callback: (message: MessagePayload, ignoreSelf: boolean) => void) {
    this.broadcastzoneCallback = callback;
  }

  equip(item: number) {
    return new Messages.EquipItem(this, item);
  }

  /**
   * Add a mob to the player's haters list (mob has aggro on player)
   * Note: CombatTracker is the source of truth - this is called from combat-system
   * when mob.increaseHateFor() establishes the aggro relationship
   */
  addHater(_mob: Mob) {
    // No-op: CombatTracker tracks this via mob.increaseHateFor() -> addAggro()
    // Keeping method signature for interface compatibility
  }

  /**
   * Remove a mob from the player's haters list
   * Note: CombatTracker is the source of truth - this is called when aggro is cleared
   */
  removeHater(_mob: Mob) {
    // No-op: CombatTracker tracks this via mob.forgetPlayer() -> removeAggro()
    // Keeping method signature for interface compatibility
  }

  /**
   * Iterate over all mobs that have aggro on this player
   * Queries CombatTracker directly - no local cache
   */
  forEachHater(callback: (mob: Mob) => void) {
    getCombatTracker().forEachMobAttackingWithEntity<Mob>(this.id as number, callback);
  }

  // ============================================================================
  // EQUIPMENT - Delegated to EquipmentHandler
  // ============================================================================

  equipArmor(kind: number, properties?: any) {
    EquipmentHandler.equipArmor(this, kind, properties);
  }

  equipWeapon(kind: number, properties?: any) {
    EquipmentHandler.equipWeapon(this, kind, properties);
  }

  equipItem(item: Item) {
    EquipmentHandler.equipItem(this, item);
  }

  updateHitPoints() {
    EquipmentHandler.updateHitPoints(this);
  }

  updatePosition() {
    if (this.requestposCallback) {
      const pos = this.requestposCallback();
      this.setPosition(pos.x, pos.y);
    }
  }

  // ============================================================================
  // ZONE SYSTEM - Delegated to ZoneHandler
  // ============================================================================

  checkZoneChange(x: number, y: number) {
    ZoneHandler.checkZoneChange(this, x, y);
  }

  // ============================================================================
  // PROGRESSION & ECONOMY (delegated to ProgressionService)
  // ============================================================================

  /**
   * Grant XP to the player, handling level ups
   * Applies efficiency and rested XP multipliers
   */
  grantXP(amount: number): void {
    // Apply progression multipliers (efficiency, rested, ascension)
    const result = ProgressionHandler.applyXpGain(this.getProgressionContext(), amount);
    this.progression.grantXP(result.finalXp);
  }

  /**
   * Set player level directly (for restoring from save)
   */
  setLevel(level: number, xp: number = 0): void {
    this.progression.setLevel(level, xp);
  }

  /**
   * Grant gold to the player
   * Applies session efficiency multiplier
   */
  grantGold(amount: number): void {
    // Apply efficiency multiplier (no rested bonus for gold)
    const finalGold = ProgressionHandler.applyGoldMultiplier(this.getProgressionContext(), amount);
    this.progression.grantGold(finalGold);
  }

  /**
   * Set player gold directly (for restoring from save)
   */
  setGold(gold: number): void {
    this.progression.setGold(gold);
  }

  /**
   * Get context object for progression handler functions
   */
  private getProgressionContext(): ProgressionHandler.ProgressionPlayerContext {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      xp: this.xp,
      ascensionCount: this.ascensionCount,
      restedXp: this.restedXp,
      lastLogoutTime: this.lastLogoutTime,
      sessionStartTime: this.sessionStartTime,
      send: (msg) => this.send(msg),
      setLevel: (lvl) => this.progression.setLevel(lvl),
      setXp: (xp) => { this.progression.xp = xp; },
      getMaxHitPoints: () => this.maxHitPoints
    };
  }

  /**
   * Initialize progression system on login
   */
  initProgressionSystem(): void {
    const ctx = this.getProgressionContext();
    ProgressionHandler.initProgression(ctx);
    // Update local state from context (rested XP may have increased)
    this.restedXp = ctx.restedXp;
    this.sessionStartTime = ctx.sessionStartTime;
  }

  /**
   * Handle ascension request from client
   */
  handleAscendRequest(): void {
    const ctx = this.getProgressionContext();
    ProgressionHandler.handleAscendRequest(ctx);
    // Update local state
    this.ascensionCount = ctx.ascensionCount;
  }

  // ============================================================================
  // FRACTURE RIFT SYSTEM - Delegated to RiftHandler
  // ============================================================================

  /**
   * Get rift handler context
   */
  private getRiftContext(): RiftHandler.RiftPlayerContext {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      hitPoints: this.hitPoints,
      maxHitPoints: this.maxHitPoints,
      send: (msg: unknown[]) => this.send(msg),
      broadcast: (msg: unknown[], ignoreSelf?: boolean) => this.broadcast(msg, ignoreSelf),
      addXP: (amount: number, _source: string) => this.grantXP(amount),
      addGold: (amount: number, _source: string) => this.grantGold(amount),
      setPosition: (x: number, y: number) => this.setPosition(x, y)
    };
  }

  /**
   * Handle rift enter request from client
   */
  handleRiftEnter(): void {
    RiftHandler.handleRiftEnter(this.getRiftContext());
  }

  /**
   * Handle rift exit request from client
   */
  handleRiftExit(): void {
    RiftHandler.handleRiftExit(this.getRiftContext());
  }

  /**
   * Handle rift leaderboard request from client
   */
  handleRiftLeaderboardRequest(): void {
    RiftHandler.handleRiftLeaderboardRequest(this.getRiftContext());
  }

  /**
   * Check if player is in a rift
   */
  isInRift(): boolean {
    return RiftHandler.isPlayerInRift(this.id);
  }

  // ============================================================================
  // DAILY REWARD SYSTEM - Delegated to DailyRewardService
  // ============================================================================

  /**
   * Handle daily reward check from client
   * Uses SQLite data as source of truth, ignores client-sent data
   */
  handleDailyCheck(_lastLoginDate: string | null, _clientStreak: number) {
    // Use SQLite data as source of truth (loaded via loadFromStorage)
    const storedLastLogin = this.dailyData?.lastLogin || null;
    const storedStreak = this.dailyData?.currentStreak || 0;

    const dailyService = getDailyRewardService();
    const result = dailyService.checkDailyReward(storedLastLogin, storedStreak);

    if (result.isNewDay) {
      log.info({ playerName: this.name, day: result.streak, gold: result.gold, xp: result.xp }, 'Granting daily reward');
      this.grantGold(result.gold);
      this.grantXP(result.xp);
      this.checkStreakAchievements(result.streak);

      // Update daily data for persistence
      const today = new Date().toISOString().split('T')[0];
      const longestStreak = Math.max(result.streak, this.dailyData?.longestStreak || 0);
      const totalLogins = (this.dailyData?.totalLogins || 0) + 1;
      this.dailyData = {
        lastLogin: today,
        currentStreak: result.streak,
        longestStreak,
        totalLogins
      };

      // Save to storage immediately
      const storage = this.world.getStorageService();
      if (storage && this.characterId) {
        storage.saveDailyData(this.characterId, this.dailyData);
      }
    } else {
      log.info({ playerName: this.name, streak: result.streak }, 'Already claimed daily reward today');
    }

    // Send daily reward notification for popup
    this.send(new Messages.DailyReward(result.gold, result.xp, result.streak, result.isNewDay).serialize());
  }

  onRequestPosition(callback: () => { x: number; y: number }) {
    this.requestposCallback = callback;
  }

  resetTimeout() {
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
    }
    this.disconnectTimeout = setTimeout(this.timeout.bind(this), 1000 * 60 * 15); // 15 min.
  }

  timeout() {
    this.connection.sendUTF8('timeout');
    this.connection.close('Player was idle for too long');
  }

  // ============================================================================
  // VENICE AI - External callers (combat-system, zone handler)
  // ============================================================================

  handleKill(mobType: string) {
    VeniceHandler.handleKill(this, mobType, (event, details) => VeniceHandler.triggerNarration(this, event, details));
  }

  async handleAreaChange(area: string) {
    await VeniceHandler.handleAreaChange(this, area, (event, details) => VeniceHandler.triggerNarration(this, event, details));
  }

  async handleItemPickup(itemKind: number) {
    await VeniceHandler.handleItemPickup(this, itemKind);
  }

  async handleLowHealth(healthPercent: number) {
    await VeniceHandler.handleLowHealth(this, healthPercent);
  }

  async handleDeath(killerType: string) {
    await VeniceHandler.handleDeath(this, killerType, (event, details) => VeniceHandler.triggerNarration(this, event, details));
  }

  cleanupVenice() {
    VeniceHandler.cleanupVenice(this.id.toString());
    VeniceHandler.cleanupNarration(this.id);
  }

  // ============================================================================
  // ACHIEVEMENT SYSTEM - External callers (combat-system, progression)
  // ============================================================================

  checkKillAchievements(mobKind: number) {
    AchievementHandler.checkKillAchievements(this, mobKind);
  }

  checkGoldAchievements(amount: number) {
    AchievementHandler.checkGoldAchievements(this, amount);
  }

  checkPurchaseAchievements(amount: number) {
    AchievementHandler.checkPurchaseAchievements(this, amount);
  }

  checkLevelAchievements(level: number) {
    AchievementHandler.checkLevelAchievements(this, level);
  }

  checkStreakAchievements(streak: number) {
    AchievementHandler.checkStreakAchievements(this, streak);
  }

  getAchievementState(): PlayerAchievements | null {
    return AchievementHandler.getAchievementState(this);
  }

  cleanupAchievements() {
    AchievementHandler.cleanupAchievements(this);
  }

  // ============================================================================
  // PARTY SYSTEM - Cleanup + external callers
  // ============================================================================

  cleanupParty() {
    PartyHandler.cleanupParty(this);
  }

  updatePartyPosition() {
    PartyHandler.updatePartyPosition(this);
  }

  updatePartyHp() {
    PartyHandler.updatePartyHp(this);
  }

  // ============================================================================
  // INVENTORY & PERSISTENCE - External callers (persistence handler)
  // ============================================================================

  getInventoryState(): (SerializedInventorySlot | null)[] {
    return InventoryHandler.getInventoryState(this);
  }

  loadInventory(data: (SerializedInventorySlot | null)[]) {
    InventoryHandler.loadInventory(this, data);
  }

  // ============================================================================
  // SKILL SYSTEM - External callers (combat-system, persistence)
  // ============================================================================

  getSkillState(): PlayerSkillState {
    return this.skillState;
  }

  /**
   * Called when player levels up to check for new skill unlocks
   */
  checkSkillUnlocks(oldLevel: number, newLevel: number) {
    SkillHandler.checkSkillUnlock(this, oldLevel, newLevel);
  }

  /**
   * Set power strike buff state (called by skill handler)
   */
  setPowerStrikeBuff(active: boolean, expires: number) {
    this.skillState.powerStrikeActive = active;
    this.skillState.powerStrikeExpires = expires;
  }

  /**
   * Set phase shift (invisibility) state
   */
  setPhaseShift(active: boolean, expires: number) {
    this.skillState.phaseShiftActive = active;
    this.skillState.phaseShiftExpires = expires;
  }

  /**
   * Check if player is currently phased (invisible)
   */
  isPhased(): boolean {
    return this.skillState.phaseShiftActive && Date.now() < this.skillState.phaseShiftExpires;
  }

  /**
   * Get weapon damage range for skill calculations
   */
  getWeaponDamage(): { min: number; max: number } {
    const weaponLevel = this.weaponLevel;
    // Base formula: level * 3 to level * 6
    return {
      min: weaponLevel * 3,
      max: weaponLevel * 6
    };
  }

  /**
   * Consume power strike buff on attack and return damage multiplier
   */
  consumePowerStrike(): number {
    return SkillHandler.consumePowerStrikeBuff(this);
  }

  // ============================================================================
  // PERSISTENCE - Delegated to PersistenceHandler
  // ============================================================================

  loadFromStorage(storage: IStorageService): boolean {
    return PersistenceHandler.loadFromStorage(this, storage);
  }

  saveToStorage(storage: IStorageService): void {
    PersistenceHandler.saveToStorage(this, storage);
  }

  getSaveState(): PlayerSaveState | null {
    return PersistenceHandler.getSaveState(this);
  }
}
