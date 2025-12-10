
import {Types} from '../../shared/ts/gametypes';
import * as _ from 'lodash';

export class FormatChecker {
  formats = [];

  constructor() {

    this.formats[Types.Messages.HELLO] = ['s', 'n', 'n', 'n']; // name, armor, weapon, gold
    this.formats[Types.Messages.MOVE] = ['n', 'n'];
    this.formats[Types.Messages.LOOTMOVE] = ['n', 'n', 'n'];
    this.formats[Types.Messages.AGGRO] = ['n'];
    this.formats[Types.Messages.ATTACK] = ['n'];
    this.formats[Types.Messages.HIT] = ['n'];
    this.formats[Types.Messages.HURT] = ['n'];
    this.formats[Types.Messages.CHAT] = ['s'];
    this.formats[Types.Messages.LOOT] = ['n'];
    this.formats[Types.Messages.TELEPORT] = ['n', 'n'];
    this.formats[Types.Messages.ZONE] = [];
    this.formats[Types.Messages.OPEN] = ['n'];
    this.formats[Types.Messages.CHECK] = ['n'];

    // Venice AI message formats
    this.formats[Types.Messages.NPCTALK] = ['n']; // npcKind
    this.formats[Types.Messages.REQUEST_QUEST] = ['n']; // npcKind
    this.formats[Types.Messages.NEWS_REQUEST] = []; // no params - just request newspaper

    // Item management
    this.formats[Types.Messages.DROP_ITEM] = ['s']; // itemType: 'weapon' or 'armor'

    // Daily reward system
    this.formats[Types.Messages.DAILY_CHECK] = ['s', 'n']; // lastLoginDate (ISO string or ""), currentStreak

    // Shop system
    this.formats[Types.Messages.SHOP_BUY] = ['n', 'n']; // npcKind, itemKind

    // Achievement system
    this.formats[Types.Messages.ACHIEVEMENT_SELECT_TITLE] = ['s']; // achievementId (can be empty string for clear)

    // Party system
    this.formats[Types.Messages.PARTY_INVITE] = ['n']; // targetPlayerId
    this.formats[Types.Messages.PARTY_ACCEPT] = ['n']; // inviterId
    this.formats[Types.Messages.PARTY_DECLINE] = ['n']; // inviterId
    this.formats[Types.Messages.PARTY_LEAVE] = []; // no params
    this.formats[Types.Messages.PARTY_KICK] = ['n']; // targetId
    this.formats[Types.Messages.PARTY_CHAT] = ['s']; // message

    // Player inspect
    this.formats[Types.Messages.PLAYER_INSPECT] = ['n']; // targetId
  }

  check(msg) {
    var message = msg.slice(0),
      type = message[0],
      format = this.formats[type];

    message.shift();

    if (format) {
      if (message.length !== format.length) {
        return false;
      }
      for (var i = 0, n = message.length; i < n; i += 1) {
        if (format[i] === 'n' && !_.isNumber(message[i])) {
          return false;
        }
        if (format[i] === 's' && !_.isString(message[i])) {
          return false;
        }
      }
      return true;
    }
    else if (type === Types.Messages.WHO) {
      // WHO messages have a variable amount of params, all of which must be numbers.
      return message.length > 0 && _.all(message, function (param) {
        return _.isNumber(param)
      });
    }
    else {
      console.error('Unknown message type: ' + type);
      return false;
    }
  }
}
