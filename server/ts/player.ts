// BrowserQuest Ultra Player - with AI Narrator integration
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
import {getVeniceService} from './ai';
import {EquipmentManager} from './equipment/equipment-manager';
import {EquipmentSlot, getSlotForKind} from '../../shared/ts/equipment/equipment-types';
import {shopService, isMerchant, getShopInventory} from './shop/shop.service';
import {getAchievementService} from './achievements/achievement.service';
import {PlayerAchievements} from '../../shared/ts/achievements';
import {PartyService} from './party';

export class Player extends Character {


  hasEnteredGame = false;
  isDead = false;
  haters = {};
  lastCheckpoint = null;
  disconnectTimeout = null;
  formatChecker: FormatChecker;
  name;
  firepotionTimeout;

  // Equipment management (unified handling of all equipment slots)
  private equipment: EquipmentManager = new EquipmentManager();

  // Legacy accessors for backward compatibility
  get weapon(): number { return this.equipment.weapon; }
  get armor(): number { return this.equipment.armor; }
  get weaponLevel(): number { return this.equipment.weaponLevel; }
  get armorLevel(): number { return this.equipment.armorLevel; }

  // Progression system
  level: number = 1;
  xp: number = 0;
  xpToNext: number = 100;  // Formulas.xpToNextLevel(1)

  // Economy system
  gold: number = 0;

  // Achievement system
  title: string | null = null;

  // Daily reward tables (streak day 1-7)
  private static DAILY_GOLD = [10, 15, 20, 25, 35, 50, 100];
  private static DAILY_XP = [25, 35, 50, 65, 85, 100, 200];

  zone_callback;
  move_callback;
  lootmove_callback;
  message_callback;
  exit_callback;
  broadcast_callback;
  broadcastzone_callback;
  orient_callback;
  requestpos_callback;

  constructor(private connection: Connection, private world: World) {
    super(connection.id, 'player', Types.Entities.WARRIOR, 0, 0);

    var self = this;


    this.formatChecker = new FormatChecker();

    this.connection.listen(function (message) {
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

      if (action === Types.Messages.HELLO) {
        var name = Utils.sanitize(message[1]);

        // If name was cleared by the sanitizer, give a default name.
        // Always ensure that the name is not longer than a maximum length.
        // (also enforced by the maxlength attribute of the name input element).
        self.name = (name === '') ? 'lorem ipsum' : name.substr(0, 15);

        self.kind = Types.Entities.WARRIOR;
        self.equipArmor(message[2]);
        self.equipWeapon(message[3]);
        self.setGold(message[4] || 0);
        self.orientation = Utils.randomOrientation();
        self.updateHitPoints();
        self.updatePosition();

        self.world.addPlayer(self);
        self.world.enter_callback(self);

        self.send([Types.Messages.WELCOME, self.id, self.name, self.x, self.y, self.hitPoints]);
        self.hasEnteredGame = true;
        self.isDead = false;

        // Initialize achievement system
        self.initAchievements();

        // AI Narrator: Welcome the player
        self.triggerNarration('join');
      }
      else if (action === Types.Messages.WHO) {
        message.shift();
        self.world.pushSpawnsToPlayer(self, message);
      }
      else if (action === Types.Messages.ZONE) {
        self.zone_callback();
      }
      else if (action === Types.Messages.CHAT) {
        var msg = Utils.sanitize(message[1]);

        // Sanitized messages may become empty. No need to broadcast empty chat messages.
        if (msg && msg !== '') {
          msg = msg.substr(0, 60); // Enforce maxlength of chat input
          self.broadcastToZone(new Messages.Chat(self, msg), false);
        }
      }
      else if (action === Types.Messages.MOVE) {
        if (self.move_callback) {
          var x = message[1],
            y = message[2];

          if (self.world.isValidPosition(x, y)) {
            self.setPosition(x, y);
            self.clearTarget();

            self.broadcast(new Messages.Move(self));
            self.move_callback(self.x, self.y);
          }
        }
      }
      else if (action === Types.Messages.LOOTMOVE) {
        if (self.lootmove_callback) {
          self.setPosition(message[1], message[2]);

          var item = self.world.getEntityById(message[3]);
          if (item) {
            self.clearTarget();

            self.broadcast(new Messages.LootMove(self, item));
            self.lootmove_callback(self.x, self.y);
          }
        }
      }
      else if (action === Types.Messages.AGGRO) {
        if (self.move_callback) {
          self.world.handleMobHate(message[1], self.id, 5);
        }
      }
      else if (action === Types.Messages.ATTACK) {
        var mob = self.world.getEntityById(message[1]);

        if (mob) {
          self.setTarget(mob);
          self.world.broadcastAttacker(self);
        }
      }
      else if (action === Types.Messages.HIT) {
        var mob = self.world.getEntityById(message[1]);
        if (mob) {
          var dmg = Formulas.dmg(self.weaponLevel, mob.armorLevel);

          if (dmg > 0) {
            mob.receiveDamage(dmg, self.id);
            self.world.handleMobHate(mob.id, self.id, dmg);
            self.world.handleHurtEntity(mob, self, dmg);
          }
        }
      }
      else if (action === Types.Messages.HURT) {
        var mob = self.world.getEntityById(message[1]);
        if (mob && self.hitPoints > 0) {
          self.hitPoints -= Formulas.dmg(mob.weaponLevel, self.armorLevel);
          self.world.handleHurtEntity(self);

          if (self.hitPoints <= 0) {
            self.isDead = true;
            if (self.firepotionTimeout) {
              clearTimeout(self.firepotionTimeout);
            }
          }
        }
      }
      else if (action === Types.Messages.LOOT) {
        var item = self.world.getEntityById(message[1]);

        if (item) {
          var kind = item.kind;

          if (Types.isItem(kind)) {
            self.broadcast(item.despawn());
            self.world.removeEntity(item);

            if (kind === Types.Entities.FIREPOTION) {
              self.updateHitPoints();
              self.broadcast(self.equip(Types.Entities.FIREFOX));
              self.firepotionTimeout = setTimeout(function () {
                self.broadcast(self.equip(self.armor)); // return to normal after 15 sec
                self.firepotionTimeout = null;
              }, 15000);
              self.send(new Messages.HitPoints(self.maxHitPoints).serialize());
            } else if (Types.isHealingItem(kind)) {
              var amount;

              switch (kind) {
                case Types.Entities.FLASK:
                  amount = 40;
                  break;
                case Types.Entities.BURGER:
                  amount = 100;
                  break;
              }

              if (!self.hasFullHealth()) {
                self.regenHealthBy(amount);
                self.world.pushToPlayer(self, self.health());
              }
            } else if (Types.isArmor(kind) || Types.isWeapon(kind)) {
              self.equipItem(item);
              self.broadcast(self.equip(kind));
            }
          }
        }
      }
      else if (action === Types.Messages.TELEPORT) {
        var x = message[1],
          y = message[2];

        if (self.world.isValidPosition(x, y)) {
          self.setPosition(x, y);
          self.clearTarget();

          self.broadcast(new Messages.Teleport(self));

          self.world.handlePlayerVanish(self);
          self.world.pushRelevantEntityListTo(self);
        }
      }
      else if (action === Types.Messages.OPEN) {
        var chest = self.world.getEntityById(message[1]);
        if (chest && chest instanceof Chest) {
          self.world.handleOpenedChest(chest, self);
        }
      }
      else if (action === Types.Messages.CHECK) {
        var checkpoint = self.world.map.getCheckpoint(message[1]);
        if (checkpoint) {
          self.lastCheckpoint = checkpoint;
        }
      }
      // Venice AI: NPC Talk
      else if (action === Types.Messages.NPCTALK) {
        var npcKind = message[1];
        self.handleNpcTalk(npcKind);
      }
      // Venice AI: Request Quest
      else if (action === Types.Messages.REQUEST_QUEST) {
        var npcKind = message[1];
        self.handleRequestQuest(npcKind);
      }
      // Town Crier: Request Newspaper
      else if (action === Types.Messages.NEWS_REQUEST) {
        self.handleNewsRequest();
      }
      // Drop current item
      else if (action === Types.Messages.DROP_ITEM) {
        var itemType = message[1]; // 'weapon' or 'armor'
        self.handleDropItem(itemType);
      }
      // Daily reward check
      else if (action === Types.Messages.DAILY_CHECK) {
        var lastLoginDate = message[1] || null; // ISO date string or empty string (treat as null)
        var currentStreak = message[2] || 0;
        self.handleDailyCheck(lastLoginDate === '' ? null : lastLoginDate, currentStreak);
      }
      // Shop system - buy item
      else if (action === Types.Messages.SHOP_BUY) {
        var npcKind = message[1];
        var itemKind = message[2];
        self.handleShopBuy(npcKind, itemKind);
      }
      // Achievement system - select title
      else if (action === Types.Messages.ACHIEVEMENT_SELECT_TITLE) {
        var achievementId = message[1];
        self.handleSelectTitle(achievementId === '' ? null : achievementId);
      }
      // Party system - invite player
      else if (action === Types.Messages.PARTY_INVITE) {
        var targetId = message[1];
        self.handlePartyInvite(targetId);
      }
      // Party system - accept invite
      else if (action === Types.Messages.PARTY_ACCEPT) {
        var inviterId = message[1];
        self.handlePartyAccept(inviterId);
      }
      // Party system - decline invite
      else if (action === Types.Messages.PARTY_DECLINE) {
        var inviterId = message[1];
        self.handlePartyDecline(inviterId);
      }
      // Party system - leave party
      else if (action === Types.Messages.PARTY_LEAVE) {
        self.handlePartyLeave();
      }
      // Party system - kick member
      else if (action === Types.Messages.PARTY_KICK) {
        var targetId = message[1];
        self.handlePartyKick(targetId);
      }
      // Party system - party chat
      else if (action === Types.Messages.PARTY_CHAT) {
        var chatMsg = Utils.sanitize(message[1]);
        if (chatMsg && chatMsg !== '') {
          chatMsg = chatMsg.substr(0, 100); // Enforce maxlength
          self.handlePartyChat(chatMsg);
        }
      }
      // Player inspect
      else if (action === Types.Messages.PLAYER_INSPECT) {
        var targetId = message[1];
        self.handlePlayerInspect(targetId);
      }
      else {
        if (self.message_callback) {
          self.message_callback(message);
        }
      }
    });

    this.connection.onClose(function () {
      if (self.firepotionTimeout) {
        clearTimeout(self.firepotionTimeout);
      }
      clearTimeout(self.disconnectTimeout);
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

  send(message) {
    this.connection.send(message);
  }

  broadcast(message, ignoreSelf?) {
    if (this.broadcast_callback) {
      this.broadcast_callback(message, ignoreSelf === undefined ? true : ignoreSelf);
    }
  }

  broadcastToZone(message, ignoreSelf?) {
    if (this.broadcastzone_callback) {
      this.broadcastzone_callback(message, ignoreSelf === undefined ? true : ignoreSelf);
    }
  }

  onExit(callback) {
    this.exit_callback = callback;
  }

  onMove(callback) {
    this.move_callback = callback;
  }

  onLootMove(callback) {
    this.lootmove_callback = callback;
  }

  onZone(callback) {
    this.zone_callback = callback;
  }

  onOrient(callback) {
    this.orient_callback = callback;
  }

  onMessage(callback) {
    this.message_callback = callback;
  }

  onBroadcast(callback) {
    this.broadcast_callback = callback;
  }

  onBroadcastToZone(callback) {
    this.broadcastzone_callback = callback;
  }

  equip(item) {
    return new Messages.EquipItem(this, item);
  }

  addHater(mob) {
    if (mob) {
      if (!(mob.id in this.haters)) {
        this.haters[mob.id] = mob;
      }
    }
  }

  removeHater(mob) {
    if (mob && mob.id in this.haters) {
      delete this.haters[mob.id];
    }
  }

  forEachHater(callback) {
    _.each(this.haters, function (mob) {
      callback(mob);
    });
  }

  equipArmor(kind) {
    this.equipment.equipToSlot('armor', kind);
  }

  equipWeapon(kind) {
    this.equipment.equipToSlot('weapon', kind);
  }

  equipItem(item) {
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
  // PROGRESSION SYSTEM
  // ============================================================================

  /**
   * Grant XP to the player, handling level ups
   */
  grantXP(amount: number) {
    if (this.level >= Formulas.MAX_LEVEL) {
      return; // Already max level
    }

    this.xp += amount;
    console.log(`[XP] ${this.name} gained ${amount} XP (${this.xp}/${this.xpToNext})`);

    // Send XP gain message to player
    this.send(new Messages.XpGain(amount, this.xp, this.xpToNext).serialize());

    // Check for level up
    while (this.xp >= this.xpToNext && this.level < Formulas.MAX_LEVEL) {
      this.levelUp();
    }
  }

  /**
   * Level up the player
   */
  private levelUp() {
    this.xp -= this.xpToNext;
    this.level++;
    this.xpToNext = Formulas.xpToNextLevel(this.level);

    const bonusHP = Formulas.levelBonusHP(this.level);
    const bonusDamage = Formulas.levelBonusDamage(this.level);

    console.log(`[LevelUp] ${this.name} reached level ${this.level}! (+${bonusHP} HP, +${bonusDamage} dmg)`);

    // Update HP with new level bonus
    this.updateHitPoints();

    // Send level up message
    this.send(new Messages.LevelUp(this.level, bonusHP, bonusDamage).serialize());
    this.send(new Messages.HitPoints(this.maxHitPoints).serialize());

    // Check level achievements
    this.checkLevelAchievements(this.level);
  }

  /**
   * Set player level directly (for restoring from save)
   */
  setLevel(level: number, xp: number = 0) {
    this.level = Math.min(Math.max(1, level), Formulas.MAX_LEVEL);
    this.xp = xp;
    this.xpToNext = Formulas.xpToNextLevel(this.level);
    this.updateHitPoints();
  }

  // ============================================================================
  // ECONOMY SYSTEM
  // ============================================================================

  /**
   * Grant gold to the player
   */
  grantGold(amount: number) {
    this.gold += amount;
    console.log(`[Gold] ${this.name} gained ${amount} gold (total: ${this.gold})`);

    // Send gold gain message to player
    this.send(new Messages.GoldGain(amount, this.gold).serialize());

    // Check wealth achievements
    if (amount > 0) {
      this.checkGoldAchievements(amount);
    }
  }

  /**
   * Set player gold directly (for restoring from save)
   */
  setGold(gold: number) {
    this.gold = Math.max(0, gold);
  }

  // ============================================================================
  // DAILY REWARD SYSTEM
  // ============================================================================

  /**
   * Handle daily reward check from client
   */
  handleDailyCheck(lastLoginDate: string | null, clientStreak: number) {
    const today = this.getTodayUTC();

    // First time player - grant day 1 reward
    if (!lastLoginDate) {
      console.log(`[Daily] ${this.name} first login - granting day 1 reward`);
      this.grantDailyReward(1, true);
      return;
    }

    // Check if it's a new day
    if (lastLoginDate === today) {
      console.log(`[Daily] ${this.name} already claimed today`);
      // Send response with 0 rewards (not a new day)
      this.send(new Messages.DailyReward(0, 0, clientStreak, false).serialize());
      return;
    }

    // Calculate streak
    const yesterday = this.getYesterdayUTC();
    let newStreak: number;

    if (lastLoginDate === yesterday) {
      // Consecutive day - increment streak (max 7, then wrap to 1)
      newStreak = clientStreak >= 7 ? 1 : clientStreak + 1;
      console.log(`[Daily] ${this.name} consecutive login - streak: ${newStreak}`);
    } else {
      // Missed a day - reset to day 1
      newStreak = 1;
      console.log(`[Daily] ${this.name} missed day(s) - streak reset to 1`);
    }

    this.grantDailyReward(newStreak, true);
  }

  /**
   * Grant daily reward based on streak
   */
  private grantDailyReward(streak: number, isNewDay: boolean) {
    const index = Math.min(streak, 7) - 1; // 0-indexed
    const goldReward = Player.DAILY_GOLD[index];
    const xpReward = Player.DAILY_XP[index];

    console.log(`[Daily] Granting ${this.name} day ${streak} reward: +${goldReward} gold, +${xpReward} XP`);

    // Grant the rewards using existing systems
    this.grantGold(goldReward);
    this.grantXP(xpReward);

    // Send daily reward notification for popup
    this.send(new Messages.DailyReward(goldReward, xpReward, streak, isNewDay).serialize());

    // Check streak achievements
    this.checkStreakAchievements(streak);
  }

  /**
   * Get today's date in UTC as ISO string (YYYY-MM-DD)
   */
  private getTodayUTC(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get yesterday's date in UTC as ISO string (YYYY-MM-DD)
   */
  private getYesterdayUTC(): string {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  onRequestPosition(callback) {
    this.requestpos_callback = callback;
  }

  resetTimeout() {
    clearTimeout(this.disconnectTimeout);
    this.disconnectTimeout = setTimeout(this.timeout.bind(this), 1000 * 60 * 15); // 15 min.
  }

  timeout() {
    this.connection.sendUTF8('timeout');
    this.connection.close('Player was idle for too long');
  }

  // ============================================================================
  // VENICE AI HANDLERS
  // ============================================================================

  async handleNpcTalk(npcKind: number) {
    console.log(`[Venice] handleNpcTalk called with npcKind: ${npcKind}`);
    const venice = getVeniceService();
    const npcType = Types.getKindAsString(npcKind);
    console.log(`[Venice] npcType resolved to: ${npcType}, venice service: ${venice ? 'available' : 'null'}`);

    // Check if this NPC is a merchant - if so, send shop data too
    if (isMerchant(npcKind)) {
      const shop = getShopInventory(npcKind);
      if (shop) {
        console.log(`[Shop] Opening shop: ${shop.name}`);
        const items = shopService.getInventoryWithStock(npcKind);
        this.send(new Messages.ShopOpen(npcKind, shop.name, items || []).serialize());
      }
    }

    if (!venice || !npcType) {
      // Fallback: send empty response
      console.log('[Venice] Sending fallback response (no venice or npcType)');
      this.send(new Messages.NpcTalkResponse(npcKind, '...').serialize());
      return;
    }

    try {
      console.log(`[Venice] Generating dialogue for ${npcType}...`);
      const response = await venice.generateNpcDialogue(
        npcType,
        this.name,
        this.id.toString()
      );
      console.log(`[Venice] Got response: ${response}`);
      this.send(new Messages.NpcTalkResponse(npcKind, response).serialize());
    } catch (error) {
      console.error('Venice NPC talk error:', error);
      const fallback = venice.getFallback(npcType);
      this.send(new Messages.NpcTalkResponse(npcKind, fallback).serialize());
    }
  }

  async handleRequestQuest(npcKind: number) {
    const venice = getVeniceService();
    const npcType = Types.getKindAsString(npcKind);

    if (!venice || !npcType) {
      return;
    }

    try {
      const quest = await venice.generateQuest(this.id.toString(), npcType);
      this.send(new Messages.QuestOffer(quest).serialize());
    } catch (error) {
      console.error('Venice quest generation error:', error);
    }
  }

  // Called when player kills a mob - for quest tracking and narration
  handleKill(mobType: string) {
    const venice = getVeniceService();
    if (!venice) return;

    const profile = venice.getProfile(this.id.toString());
    const prevKills = profile.totalKills;

    const result = venice.recordKill(this.id.toString(), mobType);
    if (result && result.completed) {
      this.send(new Messages.QuestComplete(result).serialize());
    }

    // AI Narrator: Trigger narration for special kills
    const newKills = profile.totalKills;

    // First kill ever
    if (prevKills === 0 && newKills === 1) {
      this.triggerNarration('firstKill', { mobType });
    }
    // Kill milestones (10, 25, 50, 100, etc.)
    else if ([10, 25, 50, 100, 250, 500].includes(newKills)) {
      this.triggerNarration('killMilestone', { mobType, count: newKills });
    }
    // Boss kill
    else if (mobType.toLowerCase() === 'boss' || mobType.toLowerCase() === 'skeleton2') {
      this.triggerNarration('bossKill', { bossType: mobType });
    }
  }

  // Called when player enters a new area - for quest tracking, companion hints, and narration
  async handleAreaChange(area: string) {
    const venice = getVeniceService();
    if (!venice) return;

    const profile = venice.getProfile(this.id.toString());
    const isNewArea = !profile.areas.includes(area);

    const result = venice.recordArea(this.id.toString(), area);
    if (result && result.completed) {
      this.send(new Messages.QuestComplete(result).serialize());
    }

    // AI Narrator: Announce new area discovery
    if (isNewArea) {
      this.triggerNarration('newArea', { area });
    }

    // Send companion hint for new area
    const hint = await venice.getCompanionHint(this.id.toString(), 'newArea', { area });
    if (hint) {
      this.send(new Messages.CompanionHint(hint).serialize());
    }
  }

  // Called when player picks up an item - for lore generation
  async handleItemPickup(itemKind: number) {
    const venice = getVeniceService();
    if (!venice) return;

    const itemType = Types.getKindAsString(itemKind);
    if (itemType) {
      venice.recordItem(this.id.toString(), itemType);
      const lore = await venice.generateItemLore(itemType);
      this.send(new Messages.ItemLore(itemKind, lore).serialize());
    }
  }

  // Called when player health is low - for companion hints
  async handleLowHealth(healthPercent: number) {
    const venice = getVeniceService();
    if (!venice) return;

    const hint = await venice.getCompanionHint(
      this.id.toString(),
      'lowHealth',
      { percent: Math.round(healthPercent * 100) }
    );
    if (hint) {
      this.send(new Messages.CompanionHint(hint).serialize());
    }
  }

  // Called when player dies - for companion hints and narration
  async handleDeath(killerType: string) {
    const venice = getVeniceService();
    if (!venice) return;

    venice.recordDeath(this.id.toString());

    // AI Narrator: Dramatic death commentary
    this.triggerNarration('death', { killer: killerType });

    const hint = await venice.getCompanionHint(
      this.id.toString(),
      'death',
      { killer: killerType }
    );
    if (hint) {
      this.send(new Messages.CompanionHint(hint).serialize());
    }
  }

  // Cleanup Venice data when player disconnects
  cleanupVenice() {
    const venice = getVeniceService();
    if (venice) {
      venice.cleanupPlayer(this.id.toString());
    }
  }

  // ============================================================================
  // SHOP SYSTEM HANDLERS
  // ============================================================================

  /**
   * Handle a shop purchase request
   */
  handleShopBuy(npcKind: number, itemKind: number) {
    console.log(`[Shop] ${this.name} attempting to buy item ${itemKind} from NPC ${npcKind}`);

    const result = shopService.processPurchase(npcKind, itemKind, this.gold);

    if (result.success) {
      // Deduct gold
      this.gold -= result.cost;
      console.log(`[Shop] ${this.name} purchased item ${itemKind} for ${result.cost}g (new balance: ${this.gold}g)`);

      // Give item to player (equip it)
      if (Types.isWeapon(itemKind)) {
        this.equipWeapon(itemKind);
        this.broadcast(new Messages.EquipItem(this, itemKind).serialize());
      } else if (Types.isArmor(itemKind)) {
        this.equipArmor(itemKind);
        this.broadcast(new Messages.EquipItem(this, itemKind).serialize());
      } else if (Types.isHealingItem(itemKind)) {
        // Consumables heal immediately
        // Use ConsumableStats from item-tables
        const healAmount = this.getConsumableHealAmount(itemKind);
        if (healAmount > 0 && this.hitPoints < this.maxHitPoints) {
          this.regenHealthBy(healAmount);
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
   * Get heal amount for consumable items
   */
  private getConsumableHealAmount(itemKind: number): number {
    // Based on ConsumableStats in item-tables.ts
    const healAmounts: Record<number, number> = {
      [Types.Entities.FLASK]: 40,
      [Types.Entities.BURGER]: 100,
      [Types.Entities.CAKE]: 60,
      [Types.Entities.FIREPOTION]: 0 // Fire potion is special effect, not heal
    };
    return healAmounts[itemKind] || 0;
  }

  // Town Crier: Handle newspaper request
  async handleNewsRequest() {
    console.log('[TownCrier] handleNewsRequest called for player:', this.name);
    const venice = getVeniceService();
    if (!venice) {
      console.log('[TownCrier] No Venice service, sending empty response');
      this.send(new Messages.NewsResponse([]).serialize());
      return;
    }

    try {
      console.log('[TownCrier] Generating newspaper...');
      const newspaper = await venice.generateNewspaper();
      console.log('[TownCrier] Generated', newspaper.headlines.length, 'headlines');
      const response = new Messages.NewsResponse(newspaper.headlines).serialize();
      console.log('[TownCrier] Sending response:', JSON.stringify(response));
      this.send(response);
    } catch (error) {
      console.error('[TownCrier] Venice newspaper error:', error);
      this.send(new Messages.NewsResponse(['📰 No news today...']).serialize());
    }
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
  // AI NARRATOR - Triggers dramatic commentary on player actions
  // ============================================================================

  private lastNarrationTime: number = 0;
  private narrationCooldown: number = 5000; // 5 seconds between narrations

  async triggerNarration(event: string, details?: Record<string, any>) {
    const venice = getVeniceService();
    if (!venice) return;

    // Cooldown to prevent spam (except for important events)
    const importantEvents = ['join', 'death', 'bossKill'];
    const now = Date.now();
    if (!importantEvents.includes(event) && (now - this.lastNarrationTime) < this.narrationCooldown) {
      return;
    }

    console.log(`[Narrator] Triggering narration for event: ${event}`);

    try {
      // Try AI narration first
      const narration = await venice.generateNarration(
        event,
        this.name,
        this.id.toString(),
        details
      );

      if (narration) {
        console.log(`[Narrator] AI response: "${narration.text}"`);
        this.send(new Messages.Narrator(narration.text, narration.style).serialize());
        this.lastNarrationTime = now;
      } else {
        // Fallback to static narration
        const fallback = venice.getStaticNarration(event, this.name, details);
        console.log(`[Narrator] Using fallback: "${fallback.text}"`);
        this.send(new Messages.Narrator(fallback.text, fallback.style).serialize());
        this.lastNarrationTime = now;
      }
    } catch (error) {
      console.error('[Narrator] Error:', error);
      // Use static fallback on error
      const fallback = venice.getStaticNarration(event, this.name, details);
      this.send(new Messages.Narrator(fallback.text, fallback.style).serialize());
    }
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
  // PARTY SYSTEM
  // ============================================================================

  /**
   * Handle party invite request
   */
  handlePartyInvite(targetId: number) {
    const partyService = PartyService.getInstance();
    const targetPlayer = this.world.getEntityById(targetId) as Player;

    if (!targetPlayer || !(targetPlayer instanceof Player)) {
      console.log(`[Party] ${this.name} tried to invite invalid player ${targetId}`);
      return;
    }

    // Create player reference for PartyService (x/y are pixel coords, divide by 16 for grid)
    const inviterRef = {
      id: this.id,
      name: this.name,
      level: this.level,
      hitPoints: this.hitPoints,
      maxHitPoints: this.maxHitPoints,
      gridX: Math.floor(this.x / 16),
      gridY: Math.floor(this.y / 16),
      send: (msg: any[]) => this.send(msg)
    };

    const targetRef = {
      id: targetPlayer.id,
      name: targetPlayer.name,
      level: targetPlayer.level,
      hitPoints: targetPlayer.hitPoints,
      maxHitPoints: targetPlayer.maxHitPoints,
      gridX: Math.floor(targetPlayer.x / 16),
      gridY: Math.floor(targetPlayer.y / 16),
      send: (msg: any[]) => targetPlayer.send(msg)
    };

    const error = partyService.sendInvite(inviterRef, targetId, targetRef);
    if (error) {
      console.log(`[Party] Invite failed: ${error}`);
    }
  }

  /**
   * Handle accepting a party invite
   */
  handlePartyAccept(inviterId: number) {
    const partyService = PartyService.getInstance();
    const inviterPlayer = this.world.getEntityById(inviterId) as Player;

    const accepterRef = {
      id: this.id,
      name: this.name,
      level: this.level,
      hitPoints: this.hitPoints,
      maxHitPoints: this.maxHitPoints,
      gridX: Math.floor(this.x / 16),
      gridY: Math.floor(this.y / 16),
      send: (msg: any[]) => this.send(msg)
    };

    const inviterRef = inviterPlayer ? {
      id: inviterPlayer.id,
      name: inviterPlayer.name,
      level: inviterPlayer.level,
      hitPoints: inviterPlayer.hitPoints,
      maxHitPoints: inviterPlayer.maxHitPoints,
      gridX: Math.floor(inviterPlayer.x / 16),
      gridY: Math.floor(inviterPlayer.y / 16),
      send: (msg: any[]) => inviterPlayer.send(msg)
    } : undefined;

    const result = partyService.acceptInvite(accepterRef, inviterId, inviterRef);

    if (typeof result === 'string') {
      console.log(`[Party] Accept failed: ${result}`);
      return;
    }

    // Send PARTY_JOIN to all party members
    const members = result.getMemberData();
    for (const memberId of result.getMemberIds()) {
      const memberPlayer = this.world.getEntityById(memberId) as Player;
      if (memberPlayer) {
        memberPlayer.send(new Messages.PartyJoin(result.id, members, result.leaderId).serialize());
      }
    }
  }

  /**
   * Handle declining a party invite
   */
  handlePartyDecline(inviterId: number) {
    const partyService = PartyService.getInstance();
    partyService.declineInvite(this.id, inviterId);
  }

  /**
   * Handle leaving the party
   */
  handlePartyLeave() {
    const partyService = PartyService.getInstance();
    const result = partyService.leaveParty(this.id);

    if (!result) {
      return;
    }

    // Notify remaining party members
    const remainingMembers = result.party.getMemberIds();
    const memberData = result.party.getMemberData();

    if (result.disbanded) {
      // Notify all remaining members that party disbanded
      for (const memberId of remainingMembers) {
        const memberPlayer = this.world.getEntityById(memberId) as Player;
        if (memberPlayer) {
          memberPlayer.send(new Messages.PartyDisband().serialize());
        }
      }
    } else {
      // Notify remaining members
      for (const memberId of remainingMembers) {
        const memberPlayer = this.world.getEntityById(memberId) as Player;
        if (memberPlayer) {
          memberPlayer.send(new Messages.PartyLeave(this.id).serialize());
          if (result.newLeaderId) {
            // Leadership changed, send full update
            memberPlayer.send(new Messages.PartyUpdate(memberData).serialize());
          }
        }
      }
    }
  }

  /**
   * Handle kicking a member from the party
   */
  handlePartyKick(targetId: number) {
    const partyService = PartyService.getInstance();
    const result = partyService.kickMember(this.id, targetId);

    if (!result || !result.success) {
      console.log(`[Party] Kick failed: ${result?.message || 'Unknown error'}`);
      return;
    }

    // Notify the kicked player
    const kickedPlayer = this.world.getEntityById(targetId) as Player;
    if (kickedPlayer) {
      kickedPlayer.send(new Messages.PartyDisband().serialize());
    }

    // Notify remaining party members
    const memberData = result.party.getMemberData();
    for (const memberId of result.party.getMemberIds()) {
      const memberPlayer = this.world.getEntityById(memberId) as Player;
      if (memberPlayer) {
        memberPlayer.send(new Messages.PartyLeave(targetId).serialize());
        memberPlayer.send(new Messages.PartyUpdate(memberData).serialize());
      }
    }
  }

  /**
   * Handle party chat message
   */
  handlePartyChat(message: string) {
    const partyService = PartyService.getInstance();
    const party = partyService.getPlayerParty(this.id);

    if (!party) {
      return;
    }

    // Send chat to all party members
    for (const memberId of party.getMemberIds()) {
      const memberPlayer = this.world.getEntityById(memberId) as Player;
      if (memberPlayer) {
        memberPlayer.send(new Messages.PartyChat(this.id, this.name, message).serialize());
      }
    }
  }

  /**
   * Handle player inspect request
   */
  handlePlayerInspect(targetId: number) {
    const targetPlayer = this.world.getEntityById(targetId) as Player;

    if (!targetPlayer || !(targetPlayer instanceof Player)) {
      console.log(`[Inspect] ${this.name} tried to inspect invalid player ${targetId}`);
      return;
    }

    this.send(new Messages.PlayerInspectResult(
      targetPlayer.id,
      targetPlayer.name,
      targetPlayer.title,
      targetPlayer.level,
      targetPlayer.weapon,
      targetPlayer.armor
    ).serialize());
  }

  /**
   * Cleanup party data on disconnect
   */
  cleanupParty() {
    const partyService = PartyService.getInstance();
    const party = partyService.handlePlayerDisconnect(this.id);

    if (party) {
      // Notify remaining party members
      const remainingMembers = party.getMemberIds();
      const memberData = party.getMemberData();

      if (remainingMembers.length === 0) {
        return;
      }

      for (const memberId of remainingMembers) {
        const memberPlayer = this.world.getEntityById(memberId) as Player;
        if (memberPlayer) {
          memberPlayer.send(new Messages.PartyLeave(this.id).serialize());
          if (remainingMembers.length > 1) {
            memberPlayer.send(new Messages.PartyUpdate(memberData).serialize());
          } else {
            // Last member, disband
            memberPlayer.send(new Messages.PartyDisband().serialize());
          }
        }
      }
    }
  }

  /**
   * Update party position (for shared XP proximity checks)
   */
  updatePartyPosition() {
    const partyService = PartyService.getInstance();
    partyService.updateMemberPosition(this.id, Math.floor(this.x / 16), Math.floor(this.y / 16));
  }

  /**
   * Update party HP (for party UI)
   */
  updatePartyHp() {
    const partyService = PartyService.getInstance();
    const party = partyService.updateMemberHp(this.id, this.hitPoints, this.maxHitPoints);

    if (party) {
      // Broadcast HP update to all party members
      const memberData = party.getMemberData();
      for (const memberId of party.getMemberIds()) {
        const memberPlayer = this.world.getEntityById(memberId) as Player;
        if (memberPlayer && memberId !== this.id) {
          memberPlayer.send(new Messages.PartyUpdate(memberData).serialize());
        }
      }
    }
  }
}
