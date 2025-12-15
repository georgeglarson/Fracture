import {Types} from '../../../shared/ts/gametypes';
import {Player} from '../entity/character/player/player';
import {EntityFactory} from '../entity/entityfactory';
import io from 'socket.io-client';
import * as _ from 'lodash';
import EventEmitter from 'eventemitter3';
import { ClientEvents } from './client-events';

/**
 * GameClient - WebSocket client for server communication
 * Extends EventEmitter for pub/sub event handling
 */
export class GameClient extends EventEmitter {

  connection = null;
  host;
  port;
  handlers = [];
  isListening;
  isTimeout;

  constructor(host, port) {
    super();

    this.host = host;
    this.port = port;

    this.handlers[Types.Messages.WELCOME] = this.receiveWelcome;
    this.handlers[Types.Messages.MOVE] = this.receiveMove;
    this.handlers[Types.Messages.LOOTMOVE] = this.receiveLootMove;
    this.handlers[Types.Messages.ATTACK] = this.receiveAttack;
    this.handlers[Types.Messages.SPAWN] = this.receiveSpawn;
    this.handlers[Types.Messages.DESPAWN] = this.receiveDespawn;
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
    this.handlers[Types.Messages.SHOP_SELL_RESULT] = this.receiveShopSellResult;

    // Achievement system handlers
    this.handlers[Types.Messages.ACHIEVEMENT_INIT] = this.receiveAchievementInit;
    this.handlers[Types.Messages.ACHIEVEMENT_UNLOCK] = this.receiveAchievementUnlock;
    this.handlers[Types.Messages.ACHIEVEMENT_PROGRESS] = this.receiveAchievementProgress;
    this.handlers[Types.Messages.PLAYER_TITLE_UPDATE] = this.receivePlayerTitleUpdate;

    // Party system handlers
    this.handlers[Types.Messages.PARTY_INVITE_RECEIVED] = this.receivePartyInviteReceived;
    this.handlers[Types.Messages.PARTY_JOIN] = this.receivePartyJoin;
    this.handlers[Types.Messages.PARTY_LEAVE] = this.receivePartyLeave;
    this.handlers[Types.Messages.PARTY_DISBAND] = this.receivePartyDisband;
    this.handlers[Types.Messages.PARTY_UPDATE] = this.receivePartyUpdate;
    this.handlers[Types.Messages.PARTY_CHAT] = this.receivePartyChat;

    // Player inspect handler
    this.handlers[Types.Messages.PLAYER_INSPECT_RESULT] = this.receivePlayerInspectResult;

    // Inventory system handlers
    this.handlers[Types.Messages.INVENTORY_INIT] = this.receiveInventoryInit;
    this.handlers[Types.Messages.INVENTORY_ADD] = this.receiveInventoryAdd;
    this.handlers[Types.Messages.INVENTORY_REMOVE] = this.receiveInventoryRemove;
    this.handlers[Types.Messages.INVENTORY_UPDATE] = this.receiveInventoryUpdate;

    // Zone system handlers
    this.handlers[Types.Messages.ZONE_ENTER] = this.receiveZoneEnter;
    this.handlers[Types.Messages.ZONE_INFO] = this.receiveZoneInfo;

    // Boss leaderboard handlers
    this.handlers[Types.Messages.LEADERBOARD_RESPONSE] = this.receiveLeaderboardResponse;
    this.handlers[Types.Messages.BOSS_KILL] = this.receiveBossKill;

    // Kill streak handlers
    this.handlers[Types.Messages.KILL_STREAK] = this.receiveKillStreak;
    this.handlers[Types.Messages.KILL_STREAK_ENDED] = this.receiveKillStreakEnded;

    // Nemesis system handlers
    this.handlers[Types.Messages.NEMESIS_POWER_UP] = this.receiveNemesisPowerUp;
    this.handlers[Types.Messages.NEMESIS_KILLED] = this.receiveNemesisKilled;

    // Authentication handlers
    this.handlers[Types.Messages.AUTH_FAIL] = this.receiveAuthFail;

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

    // Socket.IO client with reconnection settings
    this.connection = io(url, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.connection.on('connect', function () {
      console.info('Connected to server ' + url);
    });

    this.connection.on('message', function (data) {
      if (data === 'go') {
        self.emit(ClientEvents.CONNECTED);
        return;
      }
      if (data === 'timeout') {
        self.isTimeout = true;
        return;
      }

      self.receiveMessage(data);
    });

    // Reconnection events for UI feedback
    this.connection.on('reconnect_attempt', function (attemptNumber) {
      console.info('Reconnection attempt ' + attemptNumber);
      self.emit(ClientEvents.RECONNECTING, attemptNumber);
    });

    this.connection.on('reconnect', function (attemptNumber) {
      console.info('Reconnected after ' + attemptNumber + ' attempts');
      self.emit(ClientEvents.RECONNECTED);
    });

    this.connection.on('reconnect_failed', function () {
      console.error('Failed to reconnect after all attempts');
      self.emit(ClientEvents.DISCONNECTED, 'Unable to reconnect to PixelQuest. Please refresh the page.');
    });

    this.connection.on('disconnect', function (reason) {
      console.debug('Connection closed: ' + reason);
      if (self.isTimeout) {
        self.emit(ClientEvents.DISCONNECTED, 'You have been disconnected for being inactive for too long');
      } else if (reason === 'io server disconnect') {
        // Server disconnected us, won't auto-reconnect
        self.emit(ClientEvents.DISCONNECTED, 'You were disconnected by the server');
      }
      // Other disconnections will trigger reconnect attempts
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
          this.receiveActionBatch(message);
        } else {
          this.receiveAction(message);
        }
      }
    }
  }

  receiveAction(data) {
    var action = data[0];
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

  // ========== Receive Methods ==========

  receiveWelcome(data) {
    var id = data[1], name = data[2], x = data[3], y = data[4], hp = data[5];
    // Extended WELCOME includes: level, xp, xpToNext, gold
    var level = data[6] || 1, xp = data[7] || 0, xpToNext = data[8] || 100, gold = data[9] || 0;
    console.info('[WELCOME] Received: id=' + id + ' level=' + level + ' xp=' + xp + '/' + xpToNext + ' gold=' + gold);
    this.emit(ClientEvents.WELCOME, id, name, x, y, hp, level, xp, xpToNext, gold);
  }

  receiveMove(data) {
    var id = data[1], x = data[2], y = data[3];
    this.emit(ClientEvents.MOVE, id, x, y);
  }

  receiveLootMove(data) {
    var id = data[1], item = data[2];
    this.emit(ClientEvents.LOOT_MOVE, id, item);
  }

  receiveAttack(data) {
    var attacker = data[1], target = data[2];
    this.emit(ClientEvents.ATTACK, attacker, target);
  }

  receiveSpawn(data) {
    var id = data[1], kind = data[2], x = data[3], y = data[4];

    console.log('[SPAWN] Received spawn message: id=' + id + ' kind=' + kind + ' x=' + x + ' y=' + y);

    if (Types.isItem(kind)) {
      console.log('[SPAWN] Creating item entity for kind=' + kind);
      var item = EntityFactory.createEntity(kind, id);
      var properties = data[5];
      if (properties && item.setProperties) {
        console.log('[SPAWN] Setting item properties:', properties);
        item.setProperties(properties);
      }
      console.log('[SPAWN] Emitting spawnItem for item ' + id);
      this.emit(ClientEvents.SPAWN_ITEM, item, x, y);
    } else if (Types.isChest(kind)) {
      var chest = EntityFactory.createEntity(kind, id);
      this.emit(ClientEvents.SPAWN_CHEST, chest, x, y);
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

      this.emit(ClientEvents.SPAWN_CHARACTER, character, x, y, orientation, target);
    }
  }

  receiveDespawn(data) {
    var id = data[1];
    this.emit(ClientEvents.DESPAWN, id);
  }

  receiveHealth(data) {
    var points = data[1], isRegen = !!data[2];
    this.emit(ClientEvents.HEALTH, points, isRegen);
  }

  receiveChat(data) {
    var id = data[1], text = data[2];
    this.emit(ClientEvents.CHAT, id, text);
  }

  receiveEquipItem(data) {
    var id = data[1], itemKind = data[2];
    this.emit(ClientEvents.EQUIP, id, itemKind);
  }

  receiveDrop(data) {
    var mobId = data[1], id = data[2], kind = data[3],
      properties = data[4], playersInvolved = data[5];

    var item = EntityFactory.createEntity(kind, id);
    item.wasDropped = true;
    item.playersInvolved = playersInvolved;

    if (properties && item.setProperties) {
      item.setProperties(properties);
    }

    this.emit(ClientEvents.DROP, item, mobId);
  }

  receiveTeleport(data) {
    var id = data[1], x = data[2], y = data[3];
    this.emit(ClientEvents.TELEPORT, id, x, y);
  }

  receiveDamage(data) {
    var id = data[1], dmg = data[2];
    this.emit(ClientEvents.DAMAGE, id, dmg);
  }

  receivePopulation(data) {
    var worldPlayers = data[1], totalPlayers = data[2];
    this.emit(ClientEvents.POPULATION, worldPlayers, totalPlayers);
  }

  receiveKill(data) {
    var mobKind = data[1];
    this.emit(ClientEvents.KILL, mobKind);
  }

  receiveList(data) {
    data.shift();
    this.emit(ClientEvents.LIST, data);
  }

  receiveDestroy(data) {
    var id = data[1];
    this.emit(ClientEvents.DESTROY, id);
  }

  receiveHitPoints(data) {
    var maxHp = data[1];
    this.emit(ClientEvents.HP, maxHp);
  }

  receiveBlink(data) {
    var id = data[1];
    this.emit(ClientEvents.BLINK, id);
  }

  // Venice AI receive methods
  receiveNpcTalkResponse(data) {
    var npcKind = data[1], response = data[2], audioUrl = data[3] || '';
    console.log('[NpcTalk] Received response:', npcKind, response, audioUrl ? '(with audio)' : '');
    this.emit(ClientEvents.NPC_TALK, npcKind, response, audioUrl);
  }

  receiveCompanionHint(data) {
    var hint = data[1];
    this.emit(ClientEvents.COMPANION_HINT, hint);
  }

  receiveQuestOffer(data) {
    var quest = {
      type: data[1], target: data[2], count: data[3],
      progress: data[4], reward: data[5], xp: data[6], description: data[7]
    };
    this.emit(ClientEvents.QUEST_OFFER, quest);
  }

  receiveQuestStatus(data) {
    if (data[1] === null) {
      this.emit(ClientEvents.QUEST_STATUS, null);
      return;
    }
    var quest = { type: data[1], target: data[2], count: data[3], progress: data[4] };
    this.emit(ClientEvents.QUEST_STATUS, quest);
  }

  receiveQuestComplete(data) {
    var result = { reward: data[1], xp: data[2], description: data[3] };
    this.emit(ClientEvents.QUEST_COMPLETE, result);
  }

  receiveItemLore(data) {
    var itemKind = data[1], lore = data[2];
    this.emit(ClientEvents.ITEM_LORE, itemKind, lore);
  }

  receiveNarrator(data) {
    var text = data[1], style = data[2] || 'epic', audioUrl = data[3] || '';
    console.log('[Narrator] Received:', text, '(style:', style + ')', audioUrl ? '[with audio]' : '');
    this.emit(ClientEvents.NARRATOR, text, style, audioUrl);
  }

  receiveEntityThought(data) {
    console.log('[Client] Received entity thought:', data);
    var entityId = data[1], thought = data[2], state = data[3];
    this.emit(ClientEvents.ENTITY_THOUGHT, entityId, thought, state);
  }

  receiveWorldEvent(data) {
    var title = data[1], description = data[2], eventType = data[3];
    this.emit(ClientEvents.WORLD_EVENT, title, description, eventType);
  }

  receiveNewsResponse(data) {
    console.log('[TownCrier] receiveNewsResponse called with:', JSON.stringify(data));
    var headlines = data.slice(1);
    console.log('[TownCrier] Extracted headlines:', headlines);
    this.emit(ClientEvents.NEWS, headlines);
  }

  // Progression system receive methods
  receiveXpGain(data) {
    var amount = data[1], currentXp = data[2], xpToNext = data[3];
    console.log('[XP] Gained ' + amount + ' XP (' + currentXp + '/' + xpToNext + ')');
    this.emit(ClientEvents.XP_GAIN, amount, currentXp, xpToNext);
  }

  receiveLevelUp(data) {
    var newLevel = data[1], bonusHP = data[2], bonusDamage = data[3];
    console.log('[LevelUp] Reached level ' + newLevel + ' (+' + bonusHP + ' HP, +' + bonusDamage + ' dmg)');
    this.emit(ClientEvents.LEVEL_UP, newLevel, bonusHP, bonusDamage);
  }

  // Economy system receive methods
  receiveGoldGain(data) {
    var amount = data[1], totalGold = data[2];
    console.log('[Gold] Gained ' + amount + ' gold (total: ' + totalGold + ')');
    this.emit(ClientEvents.GOLD_GAIN, amount, totalGold);
  }

  receiveDailyReward(data) {
    var gold = data[1], xp = data[2], streak = data[3], isNewDay = data[4] === 1;
    console.log('[Daily] Reward received: ' + gold + ' gold, ' + xp + ' XP, streak: ' + streak + ', newDay: ' + isNewDay);
    this.emit(ClientEvents.DAILY_REWARD, gold, xp, streak, isNewDay);
  }

  // Shop system receive methods
  receiveShopOpen(data) {
    var npcKind = data[1], shopName = data[2], items = data[3];
    console.log('[Shop] Opening shop:', shopName, 'items:', items);
    this.emit(ClientEvents.SHOP_OPEN, npcKind, shopName, items);
  }

  receiveShopBuyResult(data) {
    var success = data[1] === 1, itemKind = data[2], newGold = data[3], message = data[4];
    console.log('[Shop] Purchase result:', success ? 'SUCCESS' : 'FAILED', message);
    this.emit(ClientEvents.SHOP_BUY_RESULT, success, itemKind, newGold, message);
  }

  receiveShopSellResult(data) {
    var success = data[1] === 1, goldGained = data[2], newGold = data[3], message = data[4];
    console.log('[Shop] Sell result:', success ? 'SUCCESS' : 'FAILED', message);
    this.emit(ClientEvents.SHOP_SELL_RESULT, success, goldGained, newGold, message);
  }

  // Achievement system receive methods
  receiveAchievementInit(data) {
    var unlockedIds = data[1] || [], progressMap = data[2] || {}, selectedTitle = data[3] || null;
    console.log('[Achievements] Init received:', unlockedIds.length, 'unlocked, title:', selectedTitle);
    this.emit(ClientEvents.ACHIEVEMENT_INIT, unlockedIds, progressMap, selectedTitle);
  }

  receiveAchievementUnlock(data) {
    var achievementId = data[1];
    console.log('[Achievements] Unlocked:', achievementId);
    this.emit(ClientEvents.ACHIEVEMENT_UNLOCK, achievementId);
  }

  receiveAchievementProgress(data) {
    var achievementId = data[1], current = data[2], target = data[3];
    console.log('[Achievements] Progress:', achievementId, current + '/' + target);
    this.emit(ClientEvents.ACHIEVEMENT_PROGRESS, achievementId, current, target);
  }

  receivePlayerTitleUpdate(data) {
    var playerId = data[1], title = data[2] || null;
    console.log('[Achievements] Player', playerId, 'title updated to:', title);
    this.emit(ClientEvents.PLAYER_TITLE_UPDATE, playerId, title);
  }

  // Party system receive methods
  receivePartyInviteReceived(data) {
    var inviterId = data[1], inviterName = data[2];
    console.log('[Party] Invite received from:', inviterName, '(id:', inviterId + ')');
    this.emit(ClientEvents.PARTY_INVITE_RECEIVED, inviterId, inviterName);
  }

  receivePartyJoin(data) {
    var partyId = data[1], members = data[2], leaderId = data[3];
    console.log('[Party] Joined party:', partyId, 'leader:', leaderId, 'members:', members);
    this.emit(ClientEvents.PARTY_JOIN, partyId, members, leaderId);
  }

  receivePartyLeave(data) {
    var playerId = data[1];
    console.log('[Party] Player left party:', playerId);
    this.emit(ClientEvents.PARTY_LEAVE, playerId);
  }

  receivePartyDisband(data) {
    console.log('[Party] Party disbanded');
    this.emit(ClientEvents.PARTY_DISBAND);
  }

  receivePartyUpdate(data) {
    var members = data[1];
    this.emit(ClientEvents.PARTY_UPDATE, members);
  }

  receivePartyChat(data) {
    var senderId = data[1], senderName = data[2], message = data[3];
    console.log('[Party Chat]', senderName + ':', message);
    this.emit(ClientEvents.PARTY_CHAT, senderId, senderName, message);
  }

  // Player inspect receive method
  receivePlayerInspectResult(data) {
    var playerId = data[1], name = data[2], title = data[3] || null,
      level = data[4], weapon = data[5], armor = data[6];
    console.log('[Inspect] Player:', name, 'level:', level, 'title:', title);
    this.emit(ClientEvents.PLAYER_INSPECT_RESULT, playerId, name, title, level, weapon, armor);
  }

  // Inventory system receive methods
  receiveInventoryInit(data) {
    var slots = data[1] || [];
    console.log('[Inventory] Init received:', slots.length, 'slots');
    this.emit(ClientEvents.INVENTORY_INIT, slots);
  }

  receiveInventoryAdd(data) {
    var slotIndex = data[1], kind = data[2], properties = data[3], count = data[4];
    console.log('[Inventory] Add to slot', slotIndex, 'kind:', kind, 'count:', count);
    this.emit(ClientEvents.INVENTORY_ADD, slotIndex, kind, properties, count);
  }

  receiveInventoryRemove(data) {
    var slotIndex = data[1];
    console.log('[Inventory] Remove slot', slotIndex);
    this.emit(ClientEvents.INVENTORY_REMOVE, slotIndex);
  }

  receiveInventoryUpdate(data) {
    var slotIndex = data[1], count = data[2];
    console.log('[Inventory] Update slot', slotIndex, 'count:', count);
    this.emit(ClientEvents.INVENTORY_UPDATE, slotIndex, count);
  }

  // Zone system receive methods
  receiveZoneEnter(data) {
    var zoneId = data[1], zoneName = data[2], minLevel = data[3], maxLevel = data[4], warning = data[5] || null;
    console.log('[Zone] Entered:', zoneName, '(Level', minLevel + '-' + maxLevel + ')', warning ? 'WARNING: ' + warning : '');
    this.emit(ClientEvents.ZONE_ENTER, zoneId, zoneName, minLevel, maxLevel, warning);
  }

  receiveZoneInfo(data) {
    var zoneId = data[1], rarityBonus = data[2], goldBonus = data[3], xpBonus = data[4];
    console.log('[Zone] Bonuses - Rarity: +' + rarityBonus + '%, Gold: +' + goldBonus + '%, XP: +' + xpBonus + '%');
    this.emit(ClientEvents.ZONE_INFO, zoneId, rarityBonus, goldBonus, xpBonus);
  }

  // Boss leaderboard receive methods
  receiveLeaderboardResponse(data) {
    var entries = data[1];
    console.log('[Leaderboard] Received', entries ? entries.length : 0, 'entries');
    this.emit(ClientEvents.LEADERBOARD_RESPONSE, entries);
  }

  receiveBossKill(data) {
    var bossName = data[1], killerName = data[2];
    console.log('[Boss] ' + killerName + ' has slain ' + bossName + '!');
    this.emit(ClientEvents.BOSS_KILL, bossName, killerName);
  }

  // Kill streak receive methods
  receiveKillStreak(data) {
    var playerId = data[1], playerName = data[2], streakCount = data[3], tierTitle = data[4], announcement = data[5];
    console.log('[KillStreak] ' + announcement);
    this.emit(ClientEvents.KILL_STREAK, playerId, playerName, streakCount, tierTitle, announcement);
  }

  receiveKillStreakEnded(data) {
    var playerId = data[1], playerName = data[2], streakCount = data[3], endedByName = data[4];
    console.log('[KillStreak] ' + playerName + '\'s ' + streakCount + ' kill streak ended!');
    this.emit(ClientEvents.KILL_STREAK_ENDED, playerId, playerName, streakCount, endedByName);
  }

  // Nemesis system receive methods
  receiveNemesisPowerUp(data) {
    var mobId = data[1], originalName = data[2], nemesisName = data[3], title = data[4],
        powerLevel = data[5], kills = data[6], victimName = data[7];
    console.log('[Nemesis] ' + nemesisName + ' ' + title + ' has grown stronger! (Power: ' + powerLevel + '%)');
    this.emit(ClientEvents.NEMESIS_POWER_UP, mobId, originalName, nemesisName, title, powerLevel, kills, victimName);
  }

  receiveNemesisKilled(data) {
    var mobId = data[1], nemesisName = data[2], title = data[3], kills = data[4],
        killerName = data[5], isRevenge = data[6] === 1;
    var revengeText = isRevenge ? ' REVENGE!' : '';
    console.log('[Nemesis] ' + killerName + ' has slain ' + nemesisName + ' ' + title + '!' + revengeText);
    this.emit(ClientEvents.NEMESIS_KILLED, mobId, nemesisName, title, kills, killerName, isRevenge);
  }

  // Authentication receive methods
  receiveAuthFail(data) {
    var reason = data[1];
    console.log('[Auth] Authentication failed:', reason);
    this.emit(ClientEvents.AUTH_FAIL, reason);
  }

  // ========== Send Methods ==========

  sendNewsRequest() {
    this.sendMessage([Types.Messages.NEWS_REQUEST]);
  }

  sendHello(player, gold: number = 0, password: string = '') {
    this.sendMessage([Types.Messages.HELLO,
      player.name,
      Types.getKindFromString(player.getSpriteName()),
      Types.getKindFromString(player.getWeaponName()),
      gold,
      password]);
  }

  sendMove(x, y) {
    this.sendMessage([Types.Messages.MOVE, x, y]);
  }

  sendLootMove(item, x, y) {
    this.sendMessage([Types.Messages.LOOTMOVE, x, y, item.id]);
  }

  sendAggro(mob) {
    this.sendMessage([Types.Messages.AGGRO, mob.id]);
  }

  sendAttack(mob) {
    this.sendMessage([Types.Messages.ATTACK, mob.id]);
  }

  sendHit(mob) {
    this.sendMessage([Types.Messages.HIT, mob.id]);
  }

  sendHurt(mob) {
    this.sendMessage([Types.Messages.HURT, mob.id]);
  }

  sendChat(text) {
    this.sendMessage([Types.Messages.CHAT, text]);
  }

  sendLoot(item) {
    this.sendMessage([Types.Messages.LOOT, item.id]);
  }

  sendTeleport(x, y) {
    this.sendMessage([Types.Messages.TELEPORT, x, y]);
  }

  sendWho(ids) {
    ids.unshift(Types.Messages.WHO);
    this.sendMessage(ids);
  }

  sendZone() {
    this.sendMessage([Types.Messages.ZONE]);
  }

  sendOpen(chest) {
    this.sendMessage([Types.Messages.OPEN, chest.id]);
  }

  sendCheck(id) {
    this.sendMessage([Types.Messages.CHECK, id]);
  }

  // Venice AI send methods
  sendNpcTalk(npcKind) {
    this.sendMessage([Types.Messages.NPCTALK, npcKind]);
  }

  sendRequestQuest(npcKind) {
    this.sendMessage([Types.Messages.REQUEST_QUEST, npcKind]);
  }

  sendDropItem(itemType: string) {
    this.sendMessage([Types.Messages.DROP_ITEM, itemType]);
  }

  sendDailyCheck(lastLoginDate: string, currentStreak: number) {
    this.sendMessage([Types.Messages.DAILY_CHECK, lastLoginDate, currentStreak]);
  }

  sendShopBuy(npcKind: number, itemKind: number) {
    this.sendMessage([Types.Messages.SHOP_BUY, npcKind, itemKind]);
  }

  sendShopSell(slotIndex: number) {
    this.sendMessage([Types.Messages.SHOP_SELL, slotIndex]);
  }

  sendSelectTitle(achievementId: string) {
    this.sendMessage([Types.Messages.ACHIEVEMENT_SELECT_TITLE, achievementId]);
  }

  sendPartyInvite(targetPlayerId: number) {
    this.sendMessage([Types.Messages.PARTY_INVITE, targetPlayerId]);
  }

  sendPartyAccept(inviterId: number) {
    this.sendMessage([Types.Messages.PARTY_ACCEPT, inviterId]);
  }

  sendPartyDecline(inviterId: number) {
    this.sendMessage([Types.Messages.PARTY_DECLINE, inviterId]);
  }

  sendPartyLeave() {
    this.sendMessage([Types.Messages.PARTY_LEAVE]);
  }

  sendPartyKick(targetId: number) {
    this.sendMessage([Types.Messages.PARTY_KICK, targetId]);
  }

  sendPartyChat(message: string) {
    this.sendMessage([Types.Messages.PARTY_CHAT, message]);
  }

  sendPlayerInspect(targetId: number) {
    this.sendMessage([Types.Messages.PLAYER_INSPECT, targetId]);
  }

  sendInventoryUse(slotIndex: number) {
    this.sendMessage([Types.Messages.INVENTORY_USE, slotIndex]);
  }

  sendInventoryEquip(slotIndex: number) {
    this.sendMessage([Types.Messages.INVENTORY_EQUIP, slotIndex]);
  }

  sendInventoryDrop(slotIndex: number) {
    this.sendMessage([Types.Messages.INVENTORY_DROP, slotIndex]);
  }

  sendInventorySwap(fromSlot: number, toSlot: number) {
    this.sendMessage([Types.Messages.INVENTORY_SWAP, fromSlot, toSlot]);
  }

  sendInventoryPickup(itemEntityId: number) {
    this.sendMessage([Types.Messages.INVENTORY_PICKUP, itemEntityId]);
  }
}
