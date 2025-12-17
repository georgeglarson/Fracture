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
import {getAchievementService} from './achievements/achievement.service';
import {PlayerAchievements} from '../../shared/ts/achievements';
import {Inventory} from './inventory/inventory';
import {serializeSlot, SerializedInventorySlot} from '../../shared/ts/inventory/inventory-types';
import {serializeProperties} from '../../shared/ts/items/item-types';
import {MessageRouter} from './player/message-router';
import {getDailyRewardService} from './player/daily-reward.service';
import {getEconomyService} from './player/economy.service';
import {ProgressionService, createProgressionService} from './player/progression.service';
import {IStorageService, CharacterData, DailyData, PlayerSaveState} from './storage/storage.interface';
import * as VeniceHandler from './player/venice.handler';
import * as PartyHandler from './player/party.handler';

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
  // SHOP SYSTEM HANDLERS
  // ============================================================================

  /**
   * Handle a shop purchase request
   */
  handleShopBuy(npcKind: number, itemKind: number) {
    console.log(`[Shop] ${this.name} attempting to buy item ${itemKind} from NPC ${npcKind}`);

    const economyService = getEconomyService();
    const result = economyService.processPurchase(npcKind, itemKind, this.gold);

    if (result.success) {
      // Deduct gold
      this.gold = result.newGold;
      console.log(`[Shop] ${this.name} purchased item ${itemKind} for ${result.cost}g (new balance: ${this.gold}g)`);

      // Give item to player (equip it)
      if (result.isWeapon) {
        this.equipWeapon(itemKind);
        this.broadcast(new Messages.EquipItem(this, itemKind).serialize());
      } else if (result.isArmor) {
        this.equipArmor(itemKind);
        this.broadcast(new Messages.EquipItem(this, itemKind).serialize());
      } else if (result.isConsumable && result.healAmount > 0) {
        // Consumables heal immediately
        if (this.hitPoints < this.maxHitPoints) {
          this.regenHealthBy(result.healAmount);
          this.broadcast(new Messages.Health(this.hitPoints).serialize(), false);
        }
      }

      // Send success response with new gold total
      this.send(new Messages.ShopBuyResult(true, itemKind, this.gold, result.message).serialize());

      // Also send gold update
      this.send(new Messages.GoldGain(0, this.gold).serialize());

      // Check purchase achievements
      this.checkPurchaseAchievements(result.cost);
    } else {
      // Send failure response
      console.log(`[Shop] ${this.name} failed to buy: ${result.message}`);
      this.send(new Messages.ShopBuyResult(false, itemKind, this.gold, result.message).serialize());
    }
  }

  /**
   * Handle selling an item from inventory
   */
  handleShopSell(slotIndex: number) {
    const slot = this.inventory.getSlot(slotIndex);

    if (!slot) {
      console.log(`[Shop] ${this.name} tried to sell empty slot ${slotIndex}`);
      this.send(new Messages.ShopSellResult(false, 0, this.gold, 'Nothing to sell').serialize());
      return;
    }

    const itemKind = slot.kind;
    const economyService = getEconomyService();
    const result = economyService.processSell(itemKind, this.gold);

    if (!result.success) {
      console.log(`[Shop] ${this.name} tried to sell unsellable item ${itemKind}`);
      this.send(new Messages.ShopSellResult(false, 0, this.gold, result.message).serialize());
      return;
    }

    // Remove one item from the slot (for stackables) or the whole slot
    this.inventory.removeItem(slotIndex, 1);

    // Grant gold
    this.gold = result.newGold;
    console.log(`[Shop] ${this.name} sold item ${itemKind} for ${result.sellPrice}g (new balance: ${this.gold}g)`);

    // Send updated inventory
    const updatedSlot = this.inventory.getSlot(slotIndex);
    if (updatedSlot) {
      // Still has items (was stackable)
      this.send([Types.Messages.INVENTORY_UPDATE, slotIndex, updatedSlot.count]);
    } else {
      // Slot is now empty
      this.send([Types.Messages.INVENTORY_REMOVE, slotIndex]);
    }

    // Send sell result
    this.send(new Messages.ShopSellResult(true, result.sellPrice, this.gold, result.message).serialize());

    // Also send gold update
    this.send(new Messages.GoldGain(result.sellPrice, this.gold).serialize());
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
  // ACHIEVEMENT SYSTEM
  // ============================================================================

  /**
   * Initialize achievements for this player
   */
  initAchievements(savedData?: PlayerAchievements) {
    const achievementService = getAchievementService();

    // Set up callback for sending messages to this player
    achievementService.setSendCallback((playerId, message) => {
      if (playerId === this.id.toString()) {
        this.send(message);
      }
    });

    // Initialize player achievements
    const achievements = achievementService.initPlayer(this.id.toString(), savedData);

    // Set title from saved data
    this.title = achievementService.getSelectedTitle(this.id.toString());

    // Send initial achievement state to client
    this.send([
      Types.Messages.ACHIEVEMENT_INIT,
      achievements.unlocked,
      JSON.stringify(achievements.progress),
      achievements.selectedTitle || ''
    ]);

    // Unlock "First Steps" achievement for new players
    if (!achievements.unlocked.includes('first_steps')) {
      const rewards = achievementService.recordFirstSteps(this.id.toString());
      if (rewards) {
        if (rewards.gold > 0) this.grantGold(rewards.gold);
        if (rewards.xp > 0) this.grantXP(rewards.xp);
      }
    }
  }

  /**
   * Handle title selection from client
   */
  handleSelectTitle(achievementId: string | null) {
    const achievementService = getAchievementService();
    const newTitle = achievementService.selectTitle(this.id.toString(), achievementId);
    this.title = newTitle;

    // Broadcast title change to all players
    this.broadcast(new Messages.PlayerTitleUpdate(this.id, newTitle));
  }

  /**
   * Called when player kills a mob - check kill achievements
   */
  checkKillAchievements(mobKind: number) {
    const achievementService = getAchievementService();
    const rewards = achievementService.recordKill(this.id.toString(), mobKind);
    if (rewards) {
      if (rewards.gold > 0) this.grantGold(rewards.gold);
      if (rewards.xp > 0) this.grantXP(rewards.xp);
    }
  }

  /**
   * Called when player earns gold - check wealth achievements
   */
  checkGoldAchievements(amount: number) {
    const achievementService = getAchievementService();
    const rewards = achievementService.recordGoldEarned(this.id.toString(), amount);
    if (rewards) {
      if (rewards.gold > 0) this.grantGold(rewards.gold);
      if (rewards.xp > 0) this.grantXP(rewards.xp);
    }
  }

  /**
   * Called when player spends gold - check first purchase achievement
   */
  checkPurchaseAchievements(amount: number) {
    const achievementService = getAchievementService();
    const rewards = achievementService.recordGoldSpent(this.id.toString(), amount);
    if (rewards) {
      if (rewards.gold > 0) this.grantGold(rewards.gold);
      if (rewards.xp > 0) this.grantXP(rewards.xp);
    }
  }

  /**
   * Called when player levels up - check level achievements
   */
  checkLevelAchievements(level: number) {
    const achievementService = getAchievementService();
    const rewards = achievementService.recordLevel(this.id.toString(), level);
    if (rewards) {
      if (rewards.gold > 0) this.grantGold(rewards.gold);
      if (rewards.xp > 0) this.grantXP(rewards.xp);
    }
  }

  /**
   * Called after daily reward streak - check streak achievements
   */
  checkStreakAchievements(streak: number) {
    const achievementService = getAchievementService();
    const rewards = achievementService.recordStreak(this.id.toString(), streak);
    if (rewards) {
      if (rewards.gold > 0) this.grantGold(rewards.gold);
      if (rewards.xp > 0) this.grantXP(rewards.xp);
    }
  }

  /**
   * Get serializable achievement state for persistence
   */
  getAchievementState(): PlayerAchievements | null {
    const achievementService = getAchievementService();
    return achievementService.getSerializableState(this.id.toString());
  }

  /**
   * Cleanup achievement data on disconnect
   */
  cleanupAchievements() {
    const achievementService = getAchievementService();
    achievementService.cleanupPlayer(this.id.toString());
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
  // INVENTORY SYSTEM
  // ============================================================================

  /**
   * Send inventory init to client
   */
  sendInventoryInit() {
    const slots = this.inventory.getSerializedSlots();
    this.send([Types.Messages.INVENTORY_INIT, slots]);
  }

  /**
   * Handle pickup item to inventory
   */
  handleInventoryPickup(itemId: number) {
    const item = this.world.getEntityById(itemId);

    if (!item || !Types.isItem(item.kind)) {
      console.log(`[Inventory] Invalid item ${itemId} for pickup`);
      return;
    }

    // Check if inventory has room
    if (!this.inventory.hasRoom(item.kind)) {
      console.log(`[Inventory] ${this.name}'s inventory is full`);
      // Could send notification to player here
      return;
    }

    // Get item properties if it's equipment
    const properties = item.properties || null;

    // Add to inventory
    const slotIndex = this.inventory.addItem(item.kind, properties, 1);
    if (slotIndex === -1) {
      console.log(`[Inventory] Failed to add item to inventory`);
      return;
    }

    // Despawn item from world (false = also send to self)
    this.broadcast(item.despawn(), false);
    this.world.removeEntity(item);

    // Send inventory add message
    const slot = this.inventory.getSlot(slotIndex);
    const serializedProps = slot?.properties ? serializeProperties(slot.properties) : null;
    this.send([
      Types.Messages.INVENTORY_ADD,
      slotIndex,
      item.kind,
      serializedProps,
      slot?.count || 1
    ]);

    console.log(`[Inventory] ${this.name} picked up ${Types.getKindAsString(item.kind)} to slot ${slotIndex}`);
  }

  /**
   * Handle use consumable from inventory
   */
  handleInventoryUse(slotIndex: number) {
    const slot = this.inventory.getSlot(slotIndex);

    if (!slot) {
      console.log(`[Inventory] Slot ${slotIndex} is empty`);
      return;
    }

    if (!this.inventory.isSlotConsumable(slotIndex)) {
      console.log(`[Inventory] Slot ${slotIndex} is not consumable`);
      return;
    }

    const kind = slot.kind;

    // Handle firepotion specially
    if (this.inventory.isFirePotion(kind)) {
      this.inventory.removeItem(slotIndex, 1);
      this.updateHitPoints();
      this.broadcast(this.equip(Types.Entities.FIREFOX));
      this.firepotionTimeout = setTimeout(() => {
        this.broadcast(this.equip(this.armor)); // return to normal after 15 sec
        this.firepotionTimeout = null;
      }, 15000);
      this.send(new Messages.HitPoints(this.maxHitPoints).serialize());
    } else {
      // Healing item
      const healAmount = this.inventory.getConsumableHealAmount(kind);
      if (healAmount > 0 && !this.hasFullHealth()) {
        this.regenHealthBy(healAmount);
        this.world.pushToPlayer(this, this.health());
      }
      this.inventory.removeItem(slotIndex, 1);
    }

    // Send update or remove based on remaining count
    const updatedSlot = this.inventory.getSlot(slotIndex);
    if (updatedSlot) {
      this.send([Types.Messages.INVENTORY_UPDATE, slotIndex, updatedSlot.count]);
    } else {
      this.send([Types.Messages.INVENTORY_REMOVE, slotIndex]);
    }

    console.log(`[Inventory] ${this.name} used ${Types.getKindAsString(kind)}`);
  }

  /**
   * Handle equip from inventory
   */
  handleInventoryEquip(slotIndex: number) {
    const slot = this.inventory.getSlot(slotIndex);

    if (!slot) {
      console.log(`[Inventory] Slot ${slotIndex} is empty`);
      return;
    }

    if (!this.inventory.isSlotEquipment(slotIndex)) {
      console.log(`[Inventory] Slot ${slotIndex} is not equipment`);
      return;
    }

    const newItemKind = slot.kind;
    const newItemProps = slot.properties;
    const isWeapon = Types.isWeapon(newItemKind);
    const isArmor = Types.isArmor(newItemKind);

    // Get currently equipped item
    const currentKind = isWeapon ? this.weapon : this.armor;
    const isDefaultItem = (isWeapon && currentKind === Types.Entities.SWORD1) ||
                          (isArmor && currentKind === Types.Entities.CLOTHARMOR);

    // Remove new item from inventory
    this.inventory.removeItem(slotIndex, 1);

    // Put old equipped item in inventory (if not default)
    if (!isDefaultItem) {
      // Note: old item doesn't have stored properties in current system
      // We'd need to track equipped item properties separately for full support
      this.inventory.setSlot(slotIndex, {
        kind: currentKind,
        properties: null, // TODO: track equipped item properties
        count: 1
      });
      const serializedOldSlot = serializeSlot(this.inventory.getSlot(slotIndex));
      this.send([
        Types.Messages.INVENTORY_ADD,
        slotIndex,
        currentKind,
        serializedOldSlot?.p || null,
        1
      ]);
    } else {
      // Default item - just remove slot
      this.send([Types.Messages.INVENTORY_REMOVE, slotIndex]);
    }

    // Equip new item
    if (isWeapon) {
      this.equipWeapon(newItemKind);
    } else {
      this.equipArmor(newItemKind);
      this.updateHitPoints();
      this.send(new Messages.HitPoints(this.maxHitPoints).serialize());
    }

    // Broadcast equipment change
    this.broadcast(this.equip(newItemKind));

    console.log(`[Inventory] ${this.name} equipped ${Types.getKindAsString(newItemKind)}`);
  }

  /**
   * Handle drop from inventory
   */
  handleInventoryDrop(slotIndex: number) {
    const slot = this.inventory.getSlot(slotIndex);

    if (!slot) {
      console.log(`[Inventory] Slot ${slotIndex} is empty`);
      return;
    }

    const kind = slot.kind;
    const properties = slot.properties;

    // Remove from inventory
    this.inventory.removeItem(slotIndex, 1);

    // Create item at player's position
    const item = this.world.createItemWithProperties(kind, this.x, this.y, properties);
    if (item) {
      this.world.addItem(item);
      this.broadcast(new Messages.Spawn(item), false);
      console.log(`[Inventory] ${this.name} dropped ${Types.getKindAsString(kind)} at (${this.x}, ${this.y})`);
    }

    // Send inventory remove
    this.send([Types.Messages.INVENTORY_REMOVE, slotIndex]);
  }

  /**
   * Handle swap slots
   */
  handleInventorySwap(fromSlot: number, toSlot: number) {
    if (this.inventory.swapSlots(fromSlot, toSlot)) {
      // Send full inventory update (could optimize to only send affected slots)
      this.sendInventoryInit();
      console.log(`[Inventory] ${this.name} swapped slots ${fromSlot} <-> ${toSlot}`);
    }
  }

  /**
   * Get serialized inventory for persistence
   */
  getInventoryState(): (SerializedInventorySlot | null)[] {
    return this.inventory.getSerializedSlots();
  }

  /**
   * Load inventory from saved data
   */
  loadInventory(data: (SerializedInventorySlot | null)[]) {
    this.inventory.loadFromData(data);
  }

  // ============ Persistence Methods ============

  /**
   * Load player state from storage
   * Returns true if character was found and loaded, false if new character
   */
  loadFromStorage(storage: IStorageService): boolean {
    const state = storage.loadPlayerState(this.name);
    if (!state) {
      return false;
    }

    // Set character ID
    this.characterId = state.character.id;

    // Restore progression (use service's loadState for consistency)
    this.progression.loadState({
      level: state.character.level,
      xp: state.character.xp,
      gold: state.character.gold
    });

    // Restore equipment (if any)
    if (state.character.armorKind) {
      this.equipArmor(state.character.armorKind);
    }
    if (state.character.weaponKind) {
      this.equipWeapon(state.character.weaponKind);
    }

    // Restore inventory
    this.inventory.loadFromData(state.inventory);

    // Restore achievements
    const achievementService = getAchievementService();
    achievementService.initPlayer(String(this.id), state.achievements);
    this.title = state.achievements.selectedTitle || null;

    console.log(`[Storage] Loaded character ${this.name} (${this.characterId}): Level ${this.level}, Gold ${this.gold}`);

    return true;
  }

  /**
   * Save player state to storage
   */
  saveToStorage(storage: IStorageService): void {
    if (!this.characterId) {
      console.warn(`[Storage] Cannot save player ${this.name}: No character ID`);
      return;
    }

    const achievementService = getAchievementService();
    const achievements = achievementService.getPlayerAchievements(String(this.id));

    const state: PlayerSaveState = {
      character: {
        id: this.characterId,
        name: this.name,
        level: this.level,
        xp: this.xp,
        gold: this.gold,
        armorKind: this.armor || null,
        weaponKind: this.weapon || null,
        x: this.x,
        y: this.y
      },
      inventory: this.inventory.getSerializedSlots(),
      achievements: achievements || { unlocked: [], progress: {}, selectedTitle: null },
      daily: {
        lastLogin: new Date().toISOString().split('T')[0],
        currentStreak: 0,
        longestStreak: 0,
        totalLogins: 0
      }
    };

    storage.savePlayerState(state);
    console.log(`[Storage] Saved character ${this.name} (${this.characterId})`);
  }

  /**
   * Get the full save state for this player
   */
  getSaveState(): PlayerSaveState | null {
    if (!this.characterId) {
      return null;
    }

    const achievementService = getAchievementService();
    const achievements = achievementService.getPlayerAchievements(String(this.id));

    return {
      character: {
        id: this.characterId,
        name: this.name,
        level: this.level,
        xp: this.xp,
        gold: this.gold,
        armorKind: this.armor || null,
        weaponKind: this.weapon || null,
        x: this.x,
        y: this.y
      },
      inventory: this.inventory.getSerializedSlots(),
      achievements: achievements || { unlocked: [], progress: {}, selectedTitle: null },
      daily: {
        lastLogin: new Date().toISOString().split('T')[0],
        currentStreak: 0,
        longestStreak: 0,
        totalLogins: 0
      }
    };
  }
}
