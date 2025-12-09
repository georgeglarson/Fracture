import {Types} from '../../../shared/ts/gametypes';
import {Player} from '../entity/character/player/player';
import {EntityFactory} from '../entity/entityfactory';
import io from 'socket.io-client';
import * as _ from 'lodash';

export class GameClient {

  connection = null;
  host;
  port;
  connected_callback = null;
  spawn_callback = null;
  movement_callback = null;

  handlers = [];
  isListening;
  isTimeout;


  dispatched_callback;
  disconnected_callback;
  welcome_callback;
  move_callback;
  lootmove_callback;
  attack_callback;
  spawn_item_callback;
  spawn_chest_callback;
  spawn_character_callback;
  despawn_callback;
  health_callback;
  chat_callback;
  equip_callback;
  drop_callback;
  teleport_callback;
  dmg_callback;
  population_callback;
  kill_callback;
  list_callback;
  destroy_callback;
  hp_callback;
  blink_callback;

  // Venice AI callbacks
  npctalk_callback;
  companion_hint_callback;
  quest_offer_callback;
  quest_status_callback;
  quest_complete_callback;
  item_lore_callback;
  narrator_callback;
  entity_thought_callback;
  world_event_callback;
  news_callback;

  // Progression system callbacks
  xp_gain_callback;
  level_up_callback;

  // Economy system callbacks
  gold_gain_callback;

  // Daily reward callbacks
  daily_reward_callback;

  // Shop system callbacks
  shop_open_callback;
  shop_buy_result_callback;

  constructor(host, port) {

    this.host = host;
    this.port = port;

    this.handlers[Types.Messages.WELCOME] = this.receiveWelcome;
    this.handlers[Types.Messages.MOVE] = this.receiveMove;
    this.handlers[Types.Messages.LOOTMOVE] = this.receiveLootMove;
    this.handlers[Types.Messages.ATTACK] = this.receiveAttack;
    this.handlers[Types.Messages.SPAWN] = this.receiveSpawn;
    this.handlers[Types.Messages.DESPAWN] = this.receiveDespawn;
    // this.handlers[Types.Messages.SPAWN_BATCH] = this.receiveSpawnBatch;
    this.handlers[Types.Messages.HEALTH] = this.receiveHealth;
    this.handlers[Types.Messages.CHAT] = this.receiveChat;
    this.handlers[Types.Messages.EQUIP] = this.receiveEquipItem;
    this.handlers[Types.Messages.DROP] = this.receiveDrop;
    this.handlers[Types.Messages.TELEPORT] = this.receiveTeleport;
    this.handlers[Types.Messages.DAMAGE] = this.receiveDamage;
    this.handlers[Types.Messages.POPULATION] = this.receivePopulation;
    this.handlers[Types.Messages.LIST] = this.receiveList;
    this.handlers[Types.Messages.DESTROY] = this.receiveDestroy;
    this.handlers[Types.Messages.KILL] = this.receiveKill;
    this.handlers[Types.Messages.HP] = this.receiveHitPoints;
    this.handlers[Types.Messages.BLINK] = this.receiveBlink;

    // Venice AI handlers
    this.handlers[Types.Messages.NPCTALK_RESPONSE] = this.receiveNpcTalkResponse;
    this.handlers[Types.Messages.COMPANION_HINT] = this.receiveCompanionHint;
    this.handlers[Types.Messages.QUEST_OFFER] = this.receiveQuestOffer;
    this.handlers[Types.Messages.QUEST_STATUS] = this.receiveQuestStatus;
    this.handlers[Types.Messages.QUEST_COMPLETE] = this.receiveQuestComplete;
    this.handlers[Types.Messages.ITEM_LORE] = this.receiveItemLore;
    this.handlers[Types.Messages.NARRATOR] = this.receiveNarrator;
    this.handlers[Types.Messages.ENTITY_THOUGHT] = this.receiveEntityThought;
    this.handlers[Types.Messages.WORLD_EVENT] = this.receiveWorldEvent;
    this.handlers[Types.Messages.NEWS_RESPONSE] = this.receiveNewsResponse;

    // Progression system handlers
    this.handlers[Types.Messages.XP_GAIN] = this.receiveXpGain;
    this.handlers[Types.Messages.LEVEL_UP] = this.receiveLevelUp;

    // Economy system handlers
    this.handlers[Types.Messages.GOLD_GAIN] = this.receiveGoldGain;

    // Daily reward handlers
    this.handlers[Types.Messages.DAILY_REWARD] = this.receiveDailyReward;

    // Shop system handlers
    this.handlers[Types.Messages.SHOP_OPEN] = this.receiveShopOpen;
    this.handlers[Types.Messages.SHOP_BUY_RESULT] = this.receiveShopBuyResult;

    this.enable();
  }

  enable() {
    this.isListening = true;
  }

  disable() {
    this.isListening = false;
  }

  connect() {
    var protocol = this.port === 443 ? 'https://' : 'http://';
    var portSuffix = (this.port === 443 || this.port === 80) ? '' : ':' + this.port;
    var url = protocol + this.host + portSuffix + '/',
      self = this;

    console.info('Trying to connect to server : ' + url);


    this.connection = io(url);
    this.connection.on('connection', function (socket) {
      console.info('Connected to server ' + url);
    });

    this.connection.on('message', function (data) {

      if (data === 'go') {
        if (self.connected_callback) {
          self.connected_callback();
        }
        return;
      }
      if (data === 'timeout') {
        self.isTimeout = true;
        return;
      }

      self.receiveMessage(data);
    });

    this.connection.on('disconnect', function () {
      console.debug('Connection closed');
      // $('#container').addClass('error');

      if (self.disconnected_callback) {
        if (self.isTimeout) {
          self.disconnected_callback('You have been disconnected for being inactive for too long');
        } else {
          self.disconnected_callback('The connection to BrowserQuest has been lost');
        }
      }
    });
  }

  sendMessage(json) {
    if (this.connection.connected) {
      this.connection.emit('message', json);
    }
  }

  receiveMessage(message) {

    if (this.isListening) {

      console.debug('Received Message: ' + message);

      if (message instanceof Array) {
        if (message[0] instanceof Array) {
          // Multiple actions received
          this.receiveActionBatch(message);
        } else {
          // Only one action received
          this.receiveAction(message);
        }
      }
    }
  }

  receiveAction(data) {
    var action = data[0];
    // Debug: Log Venice AI message types (27-39)
    if (action >= 27 && action <= 39) {
      console.log('[Client] Venice AI message received, type:', action, 'data:', data);
    }
    if (this.handlers[action] && _.isFunction(this.handlers[action])) {
      this.handlers[action].call(this, data);
    }
    else {
      console.error('Unknown action : ' + action);
    }
  }

  receiveActionBatch(actions) {
    var self = this;

    _.each(actions, function (action) {
      self.receiveAction(action);
    });
  }

  receiveWelcome(data) {
    var id = data[1],
      name = data[2],
      x = data[3],
      y = data[4],
      hp = data[5];

    if (this.welcome_callback) {
      this.welcome_callback(id, name, x, y, hp);
    }
  }

  receiveMove(data) {
    var id = data[1],
      x = data[2],
      y = data[3];

    if (this.move_callback) {
      this.move_callback(id, x, y);
    }
  }

  receiveLootMove(data) {
    var id = data[1],
      item = data[2];

    if (this.lootmove_callback) {
      this.lootmove_callback(id, item);
    }
  }

  receiveAttack(data) {
    var attacker = data[1],
      target = data[2];

    if (this.attack_callback) {
      this.attack_callback(attacker, target);
    }
  }

  receiveSpawn(data) {
    var id = data[1],
      kind = data[2],
      x = data[3],
      y = data[4];

    console.log('[SPAWN] Received spawn message: id=' + id + ' kind=' + kind + ' x=' + x + ' y=' + y);

    if (Types.isItem(kind)) {
      console.log('[SPAWN] Creating item entity for kind=' + kind);
      var item = EntityFactory.createEntity(kind, id);

      // Check for item properties in data[5]
      var properties = data[5];
      if (properties && item.setProperties) {
        console.log('[SPAWN] Setting item properties:', properties);
        item.setProperties(properties);
      }

      if (this.spawn_item_callback) {
        console.log('[SPAWN] Calling spawn_item_callback for item ' + id);
        this.spawn_item_callback(item, x, y);
      }
    } else if (Types.isChest(kind)) {
      var item = EntityFactory.createEntity(kind, id);

      if (this.spawn_chest_callback) {
        this.spawn_chest_callback(item, x, y);
      }
    } else {
      var name, orientation, target, weapon, armor;

      if (Types.isPlayer(kind)) {
        name = data[5];
        orientation = data[6];
        armor = data[7];
        weapon = data[8];
        if (data.length > 9) {
          target = data[9];
        }
      }
      else if (Types.isMob(kind)) {
        orientation = data[5];
        if (data.length > 6) {
          target = data[6];
        }
      }

      var character = EntityFactory.createEntity(kind, id, name);

      if (character instanceof Player) {
        character.weaponName = Types.getKindAsString(weapon);
        character.spriteName = Types.getKindAsString(armor);
      }

      if (this.spawn_character_callback) {
        this.spawn_character_callback(character, x, y, orientation, target);
      }
    }
  }

  receiveDespawn(data) {
    var id = data[1];

    if (this.despawn_callback) {
      this.despawn_callback(id);
    }
  }

  receiveHealth(data) {
    var points = data[1],
      isRegen = false;

    if (data[2]) {
      isRegen = true;
    }

    if (this.health_callback) {
      this.health_callback(points, isRegen);
    }
  }

  receiveChat(data) {
    var id = data[1],
      text = data[2];

    if (this.chat_callback) {
      this.chat_callback(id, text);
    }
  }

  receiveEquipItem(data) {
    var id = data[1],
      itemKind = data[2];

    if (this.equip_callback) {
      this.equip_callback(id, itemKind);
    }
  }

  receiveDrop(data) {
    var mobId = data[1],
      id = data[2],
      kind = data[3],
      properties = data[4],  // Item properties (rarity, stats) - may be null
      playersInvolved = data[5];

    var item = EntityFactory.createEntity(kind, id);
    item.wasDropped = true;
    item.playersInvolved = playersInvolved;

    // Set item properties if available
    if (properties && item.setProperties) {
      item.setProperties(properties);
    }

    if (this.drop_callback) {
      this.drop_callback(item, mobId);
    }
  }

  receiveTeleport(data) {
    var id = data[1],
      x = data[2],
      y = data[3];

    if (this.teleport_callback) {
      this.teleport_callback(id, x, y);
    }
  }

  receiveDamage(data) {
    var id = data[1],
      dmg = data[2];

    if (this.dmg_callback) {
      this.dmg_callback(id, dmg);
    }
  }

  receivePopulation(data) {
    var worldPlayers = data[1],
      totalPlayers = data[2];

    if (this.population_callback) {
      this.population_callback(worldPlayers, totalPlayers);
    }
  }

  receiveKill(data) {
    var mobKind = data[1];

    if (this.kill_callback) {
      this.kill_callback(mobKind);
    }
  }

  receiveList(data) {
    data.shift();

    if (this.list_callback) {
      this.list_callback(data);
    }
  }

  receiveDestroy(data) {
    var id = data[1];

    if (this.destroy_callback) {
      this.destroy_callback(id);
    }
  }

  receiveHitPoints(data) {
    var maxHp = data[1];

    if (this.hp_callback) {
      this.hp_callback(maxHp);
    }
  }

  receiveBlink(data) {
    var id = data[1];

    if (this.blink_callback) {
      this.blink_callback(id);
    }
  }

  // Venice AI receive methods
  receiveNpcTalkResponse(data) {
    var npcKind = data[1],
      response = data[2];

    console.log('[NpcTalk] Received response:', npcKind, response);
    if (this.npctalk_callback) {
      console.log('[NpcTalk] Calling callback');
      this.npctalk_callback(npcKind, response);
    } else {
      console.log('[NpcTalk] No callback registered!');
    }
  }

  receiveCompanionHint(data) {
    var hint = data[1];

    if (this.companion_hint_callback) {
      this.companion_hint_callback(hint);
    }
  }

  receiveQuestOffer(data) {
    var quest = {
      type: data[1],
      target: data[2],
      count: data[3],
      progress: data[4],
      reward: data[5],
      xp: data[6],
      description: data[7]
    };

    if (this.quest_offer_callback) {
      this.quest_offer_callback(quest);
    }
  }

  receiveQuestStatus(data) {
    if (data[1] === null) {
      if (this.quest_status_callback) {
        this.quest_status_callback(null);
      }
      return;
    }

    var quest = {
      type: data[1],
      target: data[2],
      count: data[3],
      progress: data[4]
    };

    if (this.quest_status_callback) {
      this.quest_status_callback(quest);
    }
  }

  receiveQuestComplete(data) {
    var result = {
      reward: data[1],
      xp: data[2],
      description: data[3]
    };

    if (this.quest_complete_callback) {
      this.quest_complete_callback(result);
    }
  }

  receiveItemLore(data) {
    var itemKind = data[1],
      lore = data[2];

    if (this.item_lore_callback) {
      this.item_lore_callback(itemKind, lore);
    }
  }

  receiveNarrator(data) {
    var text = data[1],
      style = data[2] || 'epic';

    console.log('[Narrator] Received:', text, '(style:', style + ')');

    if (this.narrator_callback) {
      this.narrator_callback(text, style);
    }
  }

  onDispatched(callback) {
    this.dispatched_callback = callback;
  }

  onConnected(callback) {
    this.connected_callback = callback;
  }

  onDisconnected(callback) {
    this.disconnected_callback = callback;
  }

  onWelcome(callback) {
    this.welcome_callback = callback;
  }

  onSpawnCharacter(callback) {
    this.spawn_character_callback = callback;
  }

  onSpawnItem(callback) {
    this.spawn_item_callback = callback;
  }

  onSpawnChest(callback) {
    this.spawn_chest_callback = callback;
  }

  onDespawnEntity(callback) {
    this.despawn_callback = callback;
  }

  onEntityMove(callback) {
    this.move_callback = callback;
  }

  onEntityAttack(callback) {
    this.attack_callback = callback;
  }

  onPlayerChangeHealth(callback) {
    this.health_callback = callback;
  }

  onPlayerEquipItem(callback) {
    this.equip_callback = callback;
  }

  onPlayerMoveToItem(callback) {
    this.lootmove_callback = callback;
  }

  onPlayerTeleport(callback) {
    this.teleport_callback = callback;
  }

  onChatMessage(callback) {
    this.chat_callback = callback;
  }

  onDropItem(callback) {
    this.drop_callback = callback;
  }

  onPlayerDamageMob(callback) {
    this.dmg_callback = callback;
  }

  onPlayerKillMob(callback) {
    this.kill_callback = callback;
  }

  onPopulationChange(callback) {
    this.population_callback = callback;
  }

  onEntityList(callback) {
    this.list_callback = callback;
  }

  onEntityDestroy(callback) {
    this.destroy_callback = callback;
  }

  onPlayerChangeMaxHitPoints(callback) {
    this.hp_callback = callback;
  }

  onItemBlink(callback) {
    this.blink_callback = callback;
  }

  // Venice AI callback setters
  onNpcTalkResponse(callback) {
    this.npctalk_callback = callback;
  }

  onCompanionHint(callback) {
    this.companion_hint_callback = callback;
  }

  onQuestOffer(callback) {
    this.quest_offer_callback = callback;
  }

  onQuestStatus(callback) {
    this.quest_status_callback = callback;
  }

  onQuestComplete(callback) {
    this.quest_complete_callback = callback;
  }

  onItemLore(callback) {
    this.item_lore_callback = callback;
  }

  onNarrator(callback) {
    this.narrator_callback = callback;
  }

  // Entity Thought Bubble (Ant Farm feature)
  receiveEntityThought(data) {
    console.log('[Client] Received entity thought:', data);
    var entityId = data[1],
      thought = data[2],
      state = data[3];

    if (this.entity_thought_callback) {
      this.entity_thought_callback(entityId, thought, state);
    } else {
      console.warn('[Client] No entity_thought_callback registered');
    }
  }

  onEntityThought(callback) {
    this.entity_thought_callback = callback;
  }

  // World Event (Faction Director)
  receiveWorldEvent(data) {
    var title = data[1],
      description = data[2],
      eventType = data[3];

    if (this.world_event_callback) {
      this.world_event_callback(title, description, eventType);
    }
  }

  onWorldEvent(callback) {
    this.world_event_callback = callback;
  }

  // Town Crier - Newspaper
  receiveNewsResponse(data) {
    console.log('[TownCrier] receiveNewsResponse called with:', JSON.stringify(data));
    // data[0] is the message type, rest are headlines
    var headlines = data.slice(1);
    console.log('[TownCrier] Extracted headlines:', headlines);

    if (this.news_callback) {
      console.log('[TownCrier] Calling news_callback...');
      this.news_callback(headlines);
    } else {
      console.warn('[TownCrier] No news_callback registered!');
    }
  }

  onNewsResponse(callback) {
    this.news_callback = callback;
  }

  sendNewsRequest() {
    this.sendMessage([Types.Messages.NEWS_REQUEST]);
  }

  sendHello(player, gold: number = 0) {
    this.sendMessage([Types.Messages.HELLO,
      player.name,
      Types.getKindFromString(player.getSpriteName()),
      Types.getKindFromString(player.getWeaponName()),
      gold]);
  }

  sendMove(x, y) {
    this.sendMessage([Types.Messages.MOVE,
      x,
      y]);
  }

  sendLootMove(item, x, y) {
    this.sendMessage([Types.Messages.LOOTMOVE,
      x,
      y,
      item.id]);
  }

  sendAggro(mob) {
    this.sendMessage([Types.Messages.AGGRO,
      mob.id]);
  }

  sendAttack(mob) {
    this.sendMessage([Types.Messages.ATTACK,
      mob.id]);
  }

  sendHit(mob) {
    this.sendMessage([Types.Messages.HIT,
      mob.id]);
  }

  sendHurt(mob) {
    this.sendMessage([Types.Messages.HURT,
      mob.id]);
  }

  sendChat(text) {
    this.sendMessage([Types.Messages.CHAT,
      text]);
  }

  sendLoot(item) {
    this.sendMessage([Types.Messages.LOOT,
      item.id]);
  }

  sendTeleport(x, y) {
    this.sendMessage([Types.Messages.TELEPORT,
      x,
      y]);
  }

  sendWho(ids) {
    ids.unshift(Types.Messages.WHO);
    this.sendMessage(ids);
  }

  sendZone() {
    this.sendMessage([Types.Messages.ZONE]);
  }

  sendOpen(chest) {
    this.sendMessage([Types.Messages.OPEN,
      chest.id]);
  }

  sendCheck(id) {
    this.sendMessage([Types.Messages.CHECK,
      id]);
  }

  // Venice AI send methods
  sendNpcTalk(npcKind) {
    this.sendMessage([Types.Messages.NPCTALK,
      npcKind]);
  }

  sendRequestQuest(npcKind) {
    this.sendMessage([Types.Messages.REQUEST_QUEST,
      npcKind]);
  }

  sendDropItem(itemType: string) {
    this.sendMessage([Types.Messages.DROP_ITEM,
      itemType]);
  }

  // Progression system receive methods
  receiveXpGain(data) {
    var amount = data[1],
      currentXp = data[2],
      xpToNext = data[3];

    console.log('[XP] Gained ' + amount + ' XP (' + currentXp + '/' + xpToNext + ')');

    if (this.xp_gain_callback) {
      this.xp_gain_callback(amount, currentXp, xpToNext);
    }
  }

  receiveLevelUp(data) {
    var newLevel = data[1],
      bonusHP = data[2],
      bonusDamage = data[3];

    console.log('[LevelUp] Reached level ' + newLevel + ' (+' + bonusHP + ' HP, +' + bonusDamage + ' dmg)');

    if (this.level_up_callback) {
      this.level_up_callback(newLevel, bonusHP, bonusDamage);
    }
  }

  onXpGain(callback) {
    this.xp_gain_callback = callback;
  }

  onLevelUp(callback) {
    this.level_up_callback = callback;
  }

  // Economy system receive methods
  receiveGoldGain(data) {
    var amount = data[1],
      totalGold = data[2];

    console.log('[Gold] Gained ' + amount + ' gold (total: ' + totalGold + ')');

    if (this.gold_gain_callback) {
      this.gold_gain_callback(amount, totalGold);
    }
  }

  onGoldGain(callback) {
    this.gold_gain_callback = callback;
  }

  // Daily reward receive methods
  receiveDailyReward(data) {
    var gold = data[1],
      xp = data[2],
      streak = data[3],
      isNewDay = data[4] === 1;

    console.log('[Daily] Reward received: ' + gold + ' gold, ' + xp + ' XP, streak: ' + streak + ', newDay: ' + isNewDay);

    if (this.daily_reward_callback) {
      this.daily_reward_callback(gold, xp, streak, isNewDay);
    }
  }

  onDailyReward(callback) {
    this.daily_reward_callback = callback;
  }

  sendDailyCheck(lastLoginDate: string, currentStreak: number) {
    this.sendMessage([Types.Messages.DAILY_CHECK, lastLoginDate, currentStreak]);
  }

  // Shop system receive methods
  receiveShopOpen(data) {
    var npcKind = data[1],
      shopName = data[2],
      items = data[3]; // Array of {itemKind, price, stock}

    console.log('[Shop] Opening shop:', shopName, 'items:', items);

    if (this.shop_open_callback) {
      this.shop_open_callback(npcKind, shopName, items);
    }
  }

  receiveShopBuyResult(data) {
    var success = data[1] === 1,
      itemKind = data[2],
      newGold = data[3],
      message = data[4];

    console.log('[Shop] Purchase result:', success ? 'SUCCESS' : 'FAILED', message);

    if (this.shop_buy_result_callback) {
      this.shop_buy_result_callback(success, itemKind, newGold, message);
    }
  }

  onShopOpen(callback) {
    this.shop_open_callback = callback;
  }

  onShopBuyResult(callback) {
    this.shop_buy_result_callback = callback;
  }

  sendShopBuy(npcKind: number, itemKind: number) {
    this.sendMessage([Types.Messages.SHOP_BUY, npcKind, itemKind]);
  }
}
