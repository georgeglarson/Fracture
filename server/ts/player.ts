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

export class Player extends Character {


  hasEnteredGame = false;
  isDead = false;
  haters = {};
  lastCheckpoint = null;
  disconnectTimeout = null;
  formatChecker: FormatChecker;
  name;
  weapon;
  weaponLevel;
  armor;
  armorLevel;
  firepotionTimeout;

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
        self.orientation = Utils.randomOrientation();
        self.updateHitPoints();
        self.updatePosition();

        self.world.addPlayer(self);
        self.world.enter_callback(self);

        self.send([Types.Messages.WELCOME, self.id, self.name, self.x, self.y, self.hitPoints]);
        self.hasEnteredGame = true;
        self.isDead = false;

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
    this.armor = kind;
    this.armorLevel = Properties.getArmorLevel(kind);
  }

  equipWeapon(kind) {
    this.weapon = kind;
    this.weaponLevel = Properties.getWeaponLevel(kind);
  }

  equipItem(item) {
    if (item) {
      console.debug(this.name + ' equips ' + Types.getKindAsString(item.kind));

      if (Types.isArmor(item.kind)) {
        this.equipArmor(item.kind);
        this.updateHitPoints();
        this.send(new Messages.HitPoints(this.maxHitPoints).serialize());
      } else if (Types.isWeapon(item.kind)) {
        this.equipWeapon(item.kind);
      }
    }
  }

  updateHitPoints() {
    this.resetHitPoints(Formulas.hp(this.armorLevel));
  }

  updatePosition() {
    if (this.requestpos_callback) {
      var pos = this.requestpos_callback();
      this.setPosition(pos.x, pos.y);
    }
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

  // Handle dropping currently equipped item
  handleDropItem(itemType: string) {
    console.log(`[Drop] ${this.name} dropping ${itemType}`);

    if (itemType === 'weapon') {
      // Don't allow dropping the default weapon
      if (this.weapon === Types.Entities.SWORD1) {
        console.log('[Drop] Cannot drop default weapon');
        return;
      }

      const droppedKind = this.weapon;

      // Create item at player's position and add to world
      const item = this.world.createItemWithProperties(droppedKind, this.x, this.y);
      if (item) {
        this.world.addItem(item);
        // Broadcast the item spawn to all nearby players
        this.broadcast(new Messages.Spawn(item), false);
        console.log(`[Drop] Created item ${Types.getKindAsString(droppedKind)} at (${this.x}, ${this.y})`);
      }

      // Reset to default weapon
      this.equipWeapon(Types.Entities.SWORD1);
      // Tell the player themselves to switch weapons
      this.send(this.equip(Types.Entities.SWORD1).serialize());
      // Tell other players about the equipment change
      this.broadcast(this.equip(Types.Entities.SWORD1));

    } else if (itemType === 'armor') {
      // Don't allow dropping default armor
      if (this.armor === Types.Entities.CLOTHARMOR) {
        console.log('[Drop] Cannot drop default armor');
        return;
      }

      const droppedKind = this.armor;

      // Create item at player's position
      const item = this.world.createItemWithProperties(droppedKind, this.x, this.y);
      if (item) {
        this.world.addItem(item);
        this.broadcast(new Messages.Spawn(item), false);
        console.log(`[Drop] Created item ${Types.getKindAsString(droppedKind)} at (${this.x}, ${this.y})`);
      }

      // Reset to default armor
      this.equipArmor(Types.Entities.CLOTHARMOR);
      this.updateHitPoints();
      // Tell the player themselves to switch armor
      this.send(this.equip(Types.Entities.CLOTHARMOR).serialize());
      // Tell other players about the equipment change
      this.broadcast(this.equip(Types.Entities.CLOTHARMOR));
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
}
