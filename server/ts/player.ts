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
import {Properties} from './properties';
import {Chest} from './chest';
import {EquipmentManager} from './equipment/equipment-manager';
import {EquipmentSlot} from '../../shared/ts/equipment/equipment-types';
import {PlayerAchievements} from '../../shared/ts/achievements';
import {Inventory} from './inventory/inventory';
import {SerializedInventorySlot} from '../../shared/ts/inventory/inventory-types';
import {MessageRouter} from './player/message-router';
import {getDailyRewardService} from './player/daily-reward.service';
import {ProgressionService, createProgressionService} from './player/progression.service';
import {IStorageService, CharacterData, DailyData, PlayerSaveState} from './storage/storage.interface';
import * as VeniceHandler from './player/venice.handler';
import * as PartyHandler from './player/party.handler';
import * as InventoryHandler from './player/inventory.handler';
import * as AchievementHandler from './player/achievement.handler';
import * as ShopHandler from './player/shop.handler';
import * as PersistenceHandler from './player/persistence.handler';

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
  haters: Record<number | string, any> = {};
  lastCheckpoint: any = null;
  disconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  formatChecker: FormatChecker;
  name!: string;
  firepotionTimeout: ReturnType<typeof setTimeout> | null = null;

  // Equipment management (unified handling of all equipment slots)
  private equipment: EquipmentManager = new EquipmentManager();

  // Inventory management
  private inventory: Inventory = new Inventory();

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

  zone_callback: ((zoneId: number) => void) | null = null;
  move_callback: ((x: number, y: number) => void) | null = null;
  lootmove_callback: ((x: number, y: number) => void) | null = null;
  message_callback: ((message: any[]) => void) | null = null;
  exit_callback: (() => void) | null = null;
  broadcast_callback: ((message: any, ignoreSelf: boolean) => void) | null = null;
  broadcastzone_callback: ((message: any, ignoreSelf: boolean) => void) | null = null;
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

    this.connection.listen(async function (message: any[]) {
      var action = parseInt(message[0]);

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
      const handled = await Player.getMessageRouter().route(self as any, message);

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

  send(message: any) {
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

  getProgression() {
    return this.progression;
  }

  broadcast(message: any, ignoreSelf?: boolean) {
    if (this.broadcast_callback) {
      this.broadcast_callback(message, ignoreSelf === undefined ? true : ignoreSelf);
    }
  }

  broadcastToZone(message: any, ignoreSelf?: boolean) {
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

  onMessage(callback: (message: any[]) => void) {
    this.message_callback = callback;
  }

  onBroadcast(callback: (message: any, ignoreSelf: boolean) => void) {
    this.broadcast_callback = callback;
  }

  onBroadcastToZone(callback: (message: any, ignoreSelf: boolean) => void) {
    this.broadcastzone_callback = callback;
  }

  equip(item: number) {
    return new Messages.EquipItem(this, item);
  }

  addHater(mob: any) {
    if (mob) {
      if (!(mob.id in this.haters)) {
        this.haters[mob.id] = mob;
      }
    }
  }

  removeHater(mob: any) {
    if (mob && mob.id in this.haters) {
      delete this.haters[mob.id];
    }
  }

  forEachHater(callback: (mob: any) => void) {
    _.each(this.haters, function (mob) {
      callback(mob);
    });
  }

  equipArmor(kind: number) {
    this.equipment.equipToSlot('armor', kind);
  }

  equipWeapon(kind: number) {
    this.equipment.equipToSlot('weapon', kind);
  }

  equipItem(item: any) {
    if (item) {
      console.debug(this.name + ' equips ' + Types.getKindAsString(item.kind));

      const slot = this.equipment.equip(item.kind);
      if (slot && slot === 'armor') {
        this.updateHitPoints();
        this.send(new Messages.HitPoints(this.maxHitPoints).serialize());
      }
    }
  }

  updateHitPoints() {
    this.resetHitPoints(Formulas.hp(this.armorLevel, this.level));
  }

  updatePosition() {
    if (this.requestpos_callback) {
      var pos = this.requestpos_callback();
      this.setPosition(pos.x, pos.y);
    }
  }

  // ============================================================================
  // ZONE SYSTEM
  // ============================================================================

  /**
   * Check if player entered a new zone and send notification
   */
  checkZoneChange(x: number, y: number) {
    const result = this.world.zoneManager.updatePlayerZone(String(this.id), x, y, this.level);
    if (result.changed && result.zone) {
      // Send zone enter notification
      this.send(this.world.zoneManager.createZoneEnterMessage(result.zone, result.warning));
      // Send zone info (bonus percentages)
      this.send(this.world.zoneManager.createZoneInfoMessage(result.zone));
      console.log(`[Zone] ${this.name} entered ${result.zone.name} (Level ${result.zone.minLevel}-${result.zone.maxLevel})`);
    }
  }

  // ============================================================================
  // PROGRESSION & ECONOMY (delegated to ProgressionService)
  // ============================================================================

  /**
   * Grant XP to the player, handling level ups
   */
  grantXP(amount: number): void {
    this.progression.grantXP(amount);
  }

  /**
   * Set player level directly (for restoring from save)
   */
  setLevel(level: number, xp: number = 0): void {
    this.progression.setLevel(level, xp);
  }

  /**
   * Grant gold to the player
   */
  grantGold(amount: number): void {
    this.progression.grantGold(amount);
  }

  /**
   * Set player gold directly (for restoring from save)
   */
  setGold(gold: number): void {
    this.progression.setGold(gold);
  }

  // ============================================================================
  // DAILY REWARD SYSTEM - Delegated to DailyRewardService
  // ============================================================================

  /**
   * Handle daily reward check from client
   */
  handleDailyCheck(lastLoginDate: string | null, clientStreak: number) {
    const dailyService = getDailyRewardService();
    const result = dailyService.checkDailyReward(lastLoginDate, clientStreak);

    if (result.isNewDay) {
      console.log(`[Daily] Granting ${this.name} day ${result.streak} reward: +${result.gold} gold, +${result.xp} XP`);
      this.grantGold(result.gold);
      this.grantXP(result.xp);
      this.checkStreakAchievements(result.streak);
    } else {
      console.log(`[Daily] ${this.name} already claimed today`);
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

  // Handle dropping currently equipped item (unified for all slots)
  handleDropItem(itemType: string) {
    const slot = itemType as EquipmentSlot;
    console.log(`[Drop] ${this.name} dropping ${slot}`);

    // Use unified drop - handles default check internally
    const droppedKind = this.equipment.drop(slot);
    if (!droppedKind) {
      console.log(`[Drop] Cannot drop default ${slot}`);
      return;
    }

    // Create item at player's position
    const item = this.world.createItemWithProperties(droppedKind, this.x, this.y);
    if (item) {
      this.world.addItem(item);
      this.broadcast(new Messages.Spawn(item), false);
      console.log(`[Drop] Created item ${Types.getKindAsString(droppedKind)} at (${this.x}, ${this.y})`);
    }

    // Get the new default item that was auto-equipped
    const newKind = this.equipment.getEquipped(slot);

    // Tell the player and others about the equipment change
    this.send(this.equip(newKind).serialize());
    this.broadcast(this.equip(newKind));

    // Update HP if armor changed
    if (slot === 'armor') {
      this.updateHitPoints();
      this.send(new Messages.HitPoints(this.maxHitPoints).serialize());
    }
  }

  // ============================================================================
  // AI NARRATOR - Delegated to VeniceHandler
  // ============================================================================

  async triggerNarration(event: string, details?: Record<string, any>) {
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
  }

  handleInventoryUse(slotIndex: number) {
    InventoryHandler.handleInventoryUse(this, slotIndex);
  }

  handleInventoryEquip(slotIndex: number) {
    InventoryHandler.handleInventoryEquip(this, slotIndex);
  }

  handleInventoryDrop(slotIndex: number) {
    InventoryHandler.handleInventoryDrop(this, slotIndex);
  }

  handleInventorySwap(fromSlot: number, toSlot: number) {
    InventoryHandler.handleInventorySwap(this, fromSlot, toSlot);
  }

  getInventoryState(): (SerializedInventorySlot | null)[] {
    return InventoryHandler.getInventoryState(this);
  }

  loadInventory(data: (SerializedInventorySlot | null)[]) {
    InventoryHandler.loadInventory(this, data);
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
