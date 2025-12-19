// Fracture Player - with AI Narrator integration
import * as _ from 'lodash';
import {FormatChecker} from './format';
import {Character} from './character';
import {Connection, Server} from './ws';
import {Types} from '../../shared/ts/gametypes';
import {Utils} from './utils';
import {World} from './world';
import {Messages} from './message';
import {Formulas} from './formulas';
import type {Mob} from './mob';
import type {Checkpoint} from './checkpoint';
import type {Item} from './item';

// Minimal interface for serializable messages (avoid importing all message types)
// Can be an object with serialize() or a raw array (already serialized)
interface SerializableMessage {
  serialize(): unknown[];
}
type MessagePayload = SerializableMessage | unknown[];
import {Properties} from './properties';
import {Chest} from './chest';
import {EquipmentManager} from './equipment/equipment-manager';
import {PlayerAchievements} from '../../shared/ts/achievements';
import {Inventory} from './inventory/inventory';
import {SerializedInventorySlot} from '../../shared/ts/inventory/inventory-types';
import {MessageRouter, MessageHandlerContext} from './player/message-router';
import {getDailyRewardService} from './player/daily-reward.service';
import {ProgressionService, createProgressionService} from './player/progression.service';
import {IStorageService, CharacterData, DailyData, PlayerSaveState} from './storage/storage.interface';
import * as VeniceHandler from './player/venice.handler';
import * as PartyHandler from './player/party.handler';
import * as InventoryHandler from './player/inventory.handler';
import * as AchievementHandler from './player/achievement.handler';
import * as ShopHandler from './player/shop.handler';
import * as PersistenceHandler from './player/persistence.handler';
import * as EquipmentHandler from './player/equipment.handler';
import * as ZoneHandler from './player/zone.handler';
import * as SkillHandler from './player/skill.handler';
import * as ProgressionHandler from './player/progression.handler';
import { PlayerSkillState, createInitialSkillState, SkillId } from '../../shared/ts/skills';

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
  isDead = false;
  haters: Record<number | string, Mob> = {};
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

  zone_callback: ((zoneId: number) => void) | null = null;
  move_callback: ((x: number, y: number) => void) | null = null;
  lootmove_callback: ((x: number, y: number) => void) | null = null;
  message_callback: ((message: unknown[]) => void) | null = null;
  exit_callback: (() => void) | null = null;
  broadcast_callback: ((message: MessagePayload, ignoreSelf: boolean) => void) | null = null;
  broadcastzone_callback: ((message: MessagePayload, ignoreSelf: boolean) => void) | null = null;
  orient_callback: ((orientation: number) => void) | null = null;
  requestpos_callback: (() => { x: number; y: number }) | null = null;

  constructor(private connection: Connection, private world: World) {
    super(connection.id, 'player', Types.Entities.WARRIOR, 0, 0);

    var self = this;

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

    this.connection.listen(async function (message: unknown[]) {
      var action = parseInt(String(message[0]));

      console.debug('Received: ' + message);
      if (!self.formatChecker.check(message)) {
        self.connection.close('Invalid ' + Types.getMessageTypeAsString(action) + ' message format: ' + message);
        return;
      }

      if (!self.hasEnteredGame && action !== Types.Messages.HELLO) { // HELLO must be the first message
        self.connection.close('Invalid handshake message: ' + message);
        return;
      }
      if (self.hasEnteredGame && !self.isDead && action === Types.Messages.HELLO) { // HELLO can be sent only once
        self.connection.close('Cannot initiate handshake twice: ' + message);
        return;
      }

      self.resetTimeout();

      // Route message through MessageRouter - delegates to appropriate handler
      // Cast needed because Player has private world but MessageHandlerContext expects public
      const handled = await Player.getMessageRouter().route(self as unknown as MessageHandlerContext, message);

      // If not handled by router, pass to message callback
      if (!handled && self.message_callback) {
        self.message_callback(message);
      }
    });

    this.connection.onClose(function () {
      if (self.firepotionTimeout) {
        clearTimeout(self.firepotionTimeout);
      }
      if (self.disconnectTimeout) {
        clearTimeout(self.disconnectTimeout);
      }
      if (self.exit_callback) {
        self.exit_callback();
      }
    });

    this.connection.sendUTF8('go'); // Notify client that the HELLO/WELCOME handshake can start
  }

  destroy() {
    var self = this;

    this.forEachAttacker(function (mob) {
      mob.clearTarget();
    });
    this.attackers = {};

    this.forEachHater(function (mob) {
      mob.forgetPlayer(self.id);
    });
    this.haters = {};
  }

  getState() {
    var basestate = this._getBaseState(),
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
    if (this.broadcast_callback) {
      this.broadcast_callback(message, ignoreSelf === undefined ? true : ignoreSelf);
    }
  }

  broadcastToZone(message: MessagePayload, ignoreSelf?: boolean) {
    if (this.broadcastzone_callback) {
      this.broadcastzone_callback(message, ignoreSelf === undefined ? true : ignoreSelf);
    }
  }

  onExit(callback: () => void) {
    this.exit_callback = callback;
  }

  onMove(callback: (x: number, y: number) => void) {
    this.move_callback = callback;
  }

  onLootMove(callback: (x: number, y: number) => void) {
    this.lootmove_callback = callback;
  }

  onZone(callback: (zoneId: number) => void) {
    this.zone_callback = callback;
  }

  onOrient(callback: (orientation: number) => void) {
    this.orient_callback = callback;
  }

  onMessage(callback: (message: unknown[]) => void) {
    this.message_callback = callback;
  }

  onBroadcast(callback: (message: MessagePayload, ignoreSelf: boolean) => void) {
    this.broadcast_callback = callback;
  }

  onBroadcastToZone(callback: (message: MessagePayload, ignoreSelf: boolean) => void) {
    this.broadcastzone_callback = callback;
  }

  equip(item: number) {
    return new Messages.EquipItem(this, item);
  }

  addHater(mob: Mob) {
    if (mob) {
      if (!(mob.id in this.haters)) {
        this.haters[mob.id] = mob;
      }
    }
  }

  removeHater(mob: Mob) {
    if (mob && mob.id in this.haters) {
      delete this.haters[mob.id];
    }
  }

  forEachHater(callback: (mob: Mob) => void) {
    _.each(this.haters, function (mob) {
      callback(mob);
    });
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
    if (this.requestpos_callback) {
      var pos = this.requestpos_callback();
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
      console.log(`[Daily] Granting ${this.name} day ${result.streak} reward: +${result.gold} gold, +${result.xp} XP`);
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
      console.log(`[Daily] ${this.name} already claimed today (streak: ${result.streak})`);
    }

    // Send daily reward notification for popup
    this.send(new Messages.DailyReward(result.gold, result.xp, result.streak, result.isNewDay).serialize());
  }

  onRequestPosition(callback: () => { x: number; y: number }) {
    this.requestpos_callback = callback;
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
  // VENICE AI HANDLERS - Delegated to VeniceHandler
  // ============================================================================

  async handleNpcTalk(npcKind: number) {
    await VeniceHandler.handleNpcTalk(this, npcKind);
  }

  async handleRequestQuest(npcKind: number) {
    await VeniceHandler.handleRequestQuest(this, npcKind);
  }

  handleKill(mobType: string) {
    VeniceHandler.handleKill(this, mobType, (event, details) => this.triggerNarration(event, details));
  }

  async handleAreaChange(area: string) {
    await VeniceHandler.handleAreaChange(this, area, (event, details) => this.triggerNarration(event, details));
  }

  async handleItemPickup(itemKind: number) {
    await VeniceHandler.handleItemPickup(this, itemKind);
  }

  async handleLowHealth(healthPercent: number) {
    await VeniceHandler.handleLowHealth(this, healthPercent);
  }

  async handleDeath(killerType: string) {
    await VeniceHandler.handleDeath(this, killerType, (event, details) => this.triggerNarration(event, details));
  }

  cleanupVenice() {
    VeniceHandler.cleanupVenice(this.id.toString());
    VeniceHandler.cleanupNarration(this.id);
  }

  // ============================================================================
  // SHOP SYSTEM - Delegated to ShopHandler
  // ============================================================================

  handleShopBuy(npcKind: number, itemKind: number) {
    ShopHandler.handleShopBuy(this, npcKind, itemKind);
  }

  handleShopSell(slotIndex: number) {
    ShopHandler.handleShopSell(this, slotIndex);
  }

  // Town Crier: Handle newspaper request - delegated to VeniceHandler
  async handleNewsRequest() {
    await VeniceHandler.handleNewsRequest(this);
  }

  handleDropItem(itemType: string) {
    EquipmentHandler.handleDropItem(this, itemType);
  }

  // ============================================================================
  // AI NARRATOR - Delegated to VeniceHandler
  // ============================================================================

  async triggerNarration(event: string, details?: Record<string, unknown>) {
    await VeniceHandler.triggerNarration(this, event, details);
  }

  // ============================================================================
  // ACHIEVEMENT SYSTEM - Delegated to AchievementHandler
  // ============================================================================

  initAchievements(savedData?: PlayerAchievements) {
    AchievementHandler.initAchievements(this, savedData);
  }

  handleSelectTitle(achievementId: string | null) {
    AchievementHandler.handleSelectTitle(this, achievementId);
  }

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
  // PARTY SYSTEM - Delegated to PartyHandler
  // ============================================================================

  handlePartyInvite(targetId: number) {
    PartyHandler.handlePartyInvite(this, targetId);
  }

  handlePartyAccept(inviterId: number) {
    PartyHandler.handlePartyAccept(this, inviterId);
  }

  handlePartyDecline(inviterId: number) {
    PartyHandler.handlePartyDecline(this, inviterId);
  }

  handlePartyLeave() {
    PartyHandler.handlePartyLeave(this);
  }

  handlePartyKick(targetId: number) {
    PartyHandler.handlePartyKick(this, targetId);
  }

  handlePartyChat(message: string) {
    PartyHandler.handlePartyChat(this, message);
  }

  handlePlayerInspect(targetId: number) {
    PartyHandler.handlePlayerInspect(this, targetId);
  }

  handleLeaderboardRequest() {
    if (!this.world.roamingBossManager) {
      this.send(new Messages.LeaderboardResponse([]).serialize());
      return;
    }
    const leaderboard = this.world.roamingBossManager.getLeaderboard();
    this.send(new Messages.LeaderboardResponse(leaderboard).serialize());
  }

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
  // INVENTORY SYSTEM - Delegated to InventoryHandler
  // ============================================================================

  sendInventoryInit() {
    InventoryHandler.sendInventoryInit(this);
  }

  handleInventoryPickup(itemId: number) {
    InventoryHandler.handleInventoryPickup(this, itemId);
    this.persistInventory();
  }

  handleInventoryUse(slotIndex: number) {
    InventoryHandler.handleInventoryUse(this, slotIndex);
    this.persistInventory();
  }

  handleInventoryEquip(slotIndex: number) {
    InventoryHandler.handleInventoryEquip(this, slotIndex);
    this.persistInventory();
  }

  handleInventoryDrop(slotIndex: number) {
    InventoryHandler.handleInventoryDrop(this, slotIndex);
    this.persistInventory();
  }

  handleInventorySwap(fromSlot: number, toSlot: number) {
    InventoryHandler.handleInventorySwap(this, fromSlot, toSlot);
    this.persistInventory();
  }

  handleUnequipToInventory(slot: string) {
    InventoryHandler.handleUnequipToInventory(this, slot);
    this.persistInventory();
  }

  getInventoryState(): (SerializedInventorySlot | null)[] {
    return InventoryHandler.getInventoryState(this);
  }

  loadInventory(data: (SerializedInventorySlot | null)[]) {
    InventoryHandler.loadInventory(this, data);
  }

  /**
   * Persist inventory to storage immediately (prevents data loss on reload)
   */
  private persistInventory(): void {
    if (!this.characterId) return;
    try {
      const storage = this.world.getStorageService();
      storage.saveInventory(this.characterId, this.inventory.getSerializedSlots());
    } catch (e) {
      console.error(`[Inventory] Failed to persist inventory for ${this.name}:`, e);
    }
  }

  // ============================================================================
  // SKILL SYSTEM - Delegated to SkillHandler
  // ============================================================================

  sendSkillInit() {
    SkillHandler.sendSkillInit(this);
  }

  handleSkillUse(skillId: string) {
    SkillHandler.handleSkillUse(this, skillId);
  }

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
