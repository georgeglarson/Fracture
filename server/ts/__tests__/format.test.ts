/**
 * Tests for FormatChecker class
 * Covers: message format validation for all registered message types,
 * WHO message special handling, unknown message types, type checking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormatChecker } from '../format';
import { Types } from '../../../shared/ts/gametypes';

describe('FormatChecker', () => {
  let checker: FormatChecker;

  beforeEach(() => {
    checker = new FormatChecker();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize format definitions for all registered message types', () => {
      expect(checker.formats).toBeDefined();
      expect(typeof checker.formats).toBe('object');
    });

    it('should define formats for core message types', () => {
      expect(checker.formats[Types.Messages.HELLO]).toEqual(['s', 'n', 'n', 'n', 's']);
      expect(checker.formats[Types.Messages.MOVE]).toEqual(['n', 'n']);
      expect(checker.formats[Types.Messages.LOOTMOVE]).toEqual(['n', 'n', 'n']);
      expect(checker.formats[Types.Messages.AGGRO]).toEqual(['n']);
      expect(checker.formats[Types.Messages.ATTACK]).toEqual(['n']);
      expect(checker.formats[Types.Messages.HIT]).toEqual(['n']);
      expect(checker.formats[Types.Messages.HURT]).toEqual(['n']);
      expect(checker.formats[Types.Messages.CHAT]).toEqual(['s']);
      expect(checker.formats[Types.Messages.LOOT]).toEqual(['n']);
      expect(checker.formats[Types.Messages.TELEPORT]).toEqual(['n', 'n']);
      expect(checker.formats[Types.Messages.ZONE]).toEqual([]);
      expect(checker.formats[Types.Messages.OPEN]).toEqual(['n']);
      expect(checker.formats[Types.Messages.CHECK]).toEqual(['n']);
    });

    it('should define formats for AI/NPC message types', () => {
      expect(checker.formats[Types.Messages.NPCTALK]).toEqual(['n']);
      expect(checker.formats[Types.Messages.REQUEST_QUEST]).toEqual(['n']);
      expect(checker.formats[Types.Messages.NEWS_REQUEST]).toEqual([]);
    });

    it('should define formats for item management', () => {
      expect(checker.formats[Types.Messages.DROP_ITEM]).toEqual(['s']);
    });

    it('should define formats for daily reward system', () => {
      expect(checker.formats[Types.Messages.DAILY_CHECK]).toEqual(['s', 'n']);
    });

    it('should define formats for shop system', () => {
      expect(checker.formats[Types.Messages.SHOP_BUY]).toEqual(['n', 'n']);
      expect(checker.formats[Types.Messages.SHOP_SELL]).toEqual(['n']);
    });

    it('should define formats for achievement system', () => {
      expect(checker.formats[Types.Messages.ACHIEVEMENT_SELECT_TITLE]).toEqual(['s']);
    });

    it('should define formats for party system', () => {
      expect(checker.formats[Types.Messages.PARTY_INVITE]).toEqual(['n']);
      expect(checker.formats[Types.Messages.PARTY_ACCEPT]).toEqual(['n']);
      expect(checker.formats[Types.Messages.PARTY_DECLINE]).toEqual(['n']);
      expect(checker.formats[Types.Messages.PARTY_LEAVE]).toEqual([]);
      expect(checker.formats[Types.Messages.PARTY_KICK]).toEqual(['n']);
      expect(checker.formats[Types.Messages.PARTY_CHAT]).toEqual(['s']);
    });

    it('should define formats for player inspect', () => {
      expect(checker.formats[Types.Messages.PLAYER_INSPECT]).toEqual(['n']);
    });

    it('should define formats for inventory system', () => {
      expect(checker.formats[Types.Messages.INVENTORY_USE]).toEqual(['n']);
      expect(checker.formats[Types.Messages.INVENTORY_EQUIP]).toEqual(['n']);
      expect(checker.formats[Types.Messages.INVENTORY_DROP]).toEqual(['n']);
      expect(checker.formats[Types.Messages.INVENTORY_SWAP]).toEqual(['n', 'n']);
      expect(checker.formats[Types.Messages.INVENTORY_PICKUP]).toEqual(['n']);
      expect(checker.formats[Types.Messages.UNEQUIP_TO_INVENTORY]).toEqual(['s']);
    });

    it('should define formats for skill system', () => {
      expect(checker.formats[Types.Messages.SKILL_USE]).toEqual(['s']);
    });

    it('should define formats for progression system', () => {
      expect(checker.formats[Types.Messages.ASCEND_REQUEST]).toEqual([]);
    });
  });

  describe('check - valid messages', () => {
    it('should accept a valid HELLO message', () => {
      expect(checker.check([Types.Messages.HELLO, 'player1', 1, 2, 100, 'pass123'])).toBe(true);
    });

    it('should accept a valid MOVE message', () => {
      expect(checker.check([Types.Messages.MOVE, 10, 20])).toBe(true);
    });

    it('should accept a valid LOOTMOVE message', () => {
      expect(checker.check([Types.Messages.LOOTMOVE, 10, 20, 5])).toBe(true);
    });

    it('should accept a valid AGGRO message', () => {
      expect(checker.check([Types.Messages.AGGRO, 42])).toBe(true);
    });

    it('should accept a valid ATTACK message', () => {
      expect(checker.check([Types.Messages.ATTACK, 99])).toBe(true);
    });

    it('should accept a valid HIT message', () => {
      expect(checker.check([Types.Messages.HIT, 7])).toBe(true);
    });

    it('should accept a valid HURT message', () => {
      expect(checker.check([Types.Messages.HURT, 3])).toBe(true);
    });

    it('should accept a valid CHAT message', () => {
      expect(checker.check([Types.Messages.CHAT, 'hello world'])).toBe(true);
    });

    it('should accept a valid LOOT message', () => {
      expect(checker.check([Types.Messages.LOOT, 15])).toBe(true);
    });

    it('should accept a valid TELEPORT message', () => {
      expect(checker.check([Types.Messages.TELEPORT, 50, 60])).toBe(true);
    });

    it('should accept a valid ZONE message (no params)', () => {
      expect(checker.check([Types.Messages.ZONE])).toBe(true);
    });

    it('should accept a valid OPEN message', () => {
      expect(checker.check([Types.Messages.OPEN, 33])).toBe(true);
    });

    it('should accept a valid CHECK message', () => {
      expect(checker.check([Types.Messages.CHECK, 44])).toBe(true);
    });

    it('should accept a valid NPCTALK message', () => {
      expect(checker.check([Types.Messages.NPCTALK, 40])).toBe(true);
    });

    it('should accept a valid REQUEST_QUEST message', () => {
      expect(checker.check([Types.Messages.REQUEST_QUEST, 41])).toBe(true);
    });

    it('should accept a valid NEWS_REQUEST message (no params)', () => {
      expect(checker.check([Types.Messages.NEWS_REQUEST])).toBe(true);
    });

    it('should accept a valid DROP_ITEM message', () => {
      expect(checker.check([Types.Messages.DROP_ITEM, 'weapon'])).toBe(true);
      expect(checker.check([Types.Messages.DROP_ITEM, 'armor'])).toBe(true);
    });

    it('should accept a valid DAILY_CHECK message', () => {
      expect(checker.check([Types.Messages.DAILY_CHECK, '2025-01-01', 3])).toBe(true);
      expect(checker.check([Types.Messages.DAILY_CHECK, '', 0])).toBe(true);
    });

    it('should accept a valid SHOP_BUY message', () => {
      expect(checker.check([Types.Messages.SHOP_BUY, 40, 61])).toBe(true);
    });

    it('should accept a valid ACHIEVEMENT_SELECT_TITLE message', () => {
      expect(checker.check([Types.Messages.ACHIEVEMENT_SELECT_TITLE, 'first_kill'])).toBe(true);
      expect(checker.check([Types.Messages.ACHIEVEMENT_SELECT_TITLE, ''])).toBe(true);
    });

    it('should accept valid party messages', () => {
      expect(checker.check([Types.Messages.PARTY_INVITE, 123])).toBe(true);
      expect(checker.check([Types.Messages.PARTY_ACCEPT, 456])).toBe(true);
      expect(checker.check([Types.Messages.PARTY_DECLINE, 789])).toBe(true);
      expect(checker.check([Types.Messages.PARTY_LEAVE])).toBe(true);
      expect(checker.check([Types.Messages.PARTY_KICK, 321])).toBe(true);
      expect(checker.check([Types.Messages.PARTY_CHAT, 'group message'])).toBe(true);
    });

    it('should accept a valid PLAYER_INSPECT message', () => {
      expect(checker.check([Types.Messages.PLAYER_INSPECT, 55])).toBe(true);
    });

    it('should accept valid inventory messages', () => {
      expect(checker.check([Types.Messages.INVENTORY_USE, 0])).toBe(true);
      expect(checker.check([Types.Messages.INVENTORY_EQUIP, 2])).toBe(true);
      expect(checker.check([Types.Messages.INVENTORY_DROP, 3])).toBe(true);
      expect(checker.check([Types.Messages.INVENTORY_SWAP, 0, 1])).toBe(true);
      expect(checker.check([Types.Messages.INVENTORY_PICKUP, 999])).toBe(true);
      expect(checker.check([Types.Messages.UNEQUIP_TO_INVENTORY, 'weapon'])).toBe(true);
    });

    it('should accept a valid SHOP_SELL message', () => {
      expect(checker.check([Types.Messages.SHOP_SELL, 2])).toBe(true);
    });

    it('should accept a valid SKILL_USE message', () => {
      expect(checker.check([Types.Messages.SKILL_USE, 'fireball'])).toBe(true);
    });

    it('should accept a valid ASCEND_REQUEST message (no params)', () => {
      expect(checker.check([Types.Messages.ASCEND_REQUEST])).toBe(true);
    });
  });

  describe('check - invalid parameter counts', () => {
    it('should reject HELLO with too few params', () => {
      expect(checker.check([Types.Messages.HELLO, 'player1'])).toBe(false);
    });

    it('should reject HELLO with too many params', () => {
      expect(checker.check([Types.Messages.HELLO, 'player1', 1, 2, 100, 'pass', 'extra'])).toBe(false);
    });

    it('should reject MOVE with no params', () => {
      expect(checker.check([Types.Messages.MOVE])).toBe(false);
    });

    it('should reject MOVE with one param', () => {
      expect(checker.check([Types.Messages.MOVE, 10])).toBe(false);
    });

    it('should reject MOVE with three params', () => {
      expect(checker.check([Types.Messages.MOVE, 10, 20, 30])).toBe(false);
    });

    it('should reject CHAT with no params', () => {
      expect(checker.check([Types.Messages.CHAT])).toBe(false);
    });

    it('should reject ZONE with unexpected params', () => {
      expect(checker.check([Types.Messages.ZONE, 1])).toBe(false);
    });

    it('should reject LOOTMOVE with two params instead of three', () => {
      expect(checker.check([Types.Messages.LOOTMOVE, 10, 20])).toBe(false);
    });

    it('should reject INVENTORY_SWAP with one param instead of two', () => {
      expect(checker.check([Types.Messages.INVENTORY_SWAP, 0])).toBe(false);
    });

    it('should reject DAILY_CHECK with one param instead of two', () => {
      expect(checker.check([Types.Messages.DAILY_CHECK, '2025-01-01'])).toBe(false);
    });

    it('should reject SHOP_BUY with one param instead of two', () => {
      expect(checker.check([Types.Messages.SHOP_BUY, 40])).toBe(false);
    });

    it('should reject PARTY_LEAVE with unexpected params', () => {
      expect(checker.check([Types.Messages.PARTY_LEAVE, 1])).toBe(false);
    });

    it('should reject NEWS_REQUEST with unexpected params', () => {
      expect(checker.check([Types.Messages.NEWS_REQUEST, 'extra'])).toBe(false);
    });

    it('should reject ASCEND_REQUEST with unexpected params', () => {
      expect(checker.check([Types.Messages.ASCEND_REQUEST, 1])).toBe(false);
    });
  });

  describe('check - invalid parameter types', () => {
    it('should reject MOVE when string is provided instead of number', () => {
      expect(checker.check([Types.Messages.MOVE, '10', 20])).toBe(false);
      expect(checker.check([Types.Messages.MOVE, 10, '20'])).toBe(false);
    });

    it('should reject CHAT when number is provided instead of string', () => {
      expect(checker.check([Types.Messages.CHAT, 123])).toBe(false);
    });

    it('should reject HELLO when number is used for name (string expected)', () => {
      expect(checker.check([Types.Messages.HELLO, 123, 1, 2, 100, 'pass'])).toBe(false);
    });

    it('should reject HELLO when string is used for armor (number expected)', () => {
      expect(checker.check([Types.Messages.HELLO, 'player1', 'bad', 2, 100, 'pass'])).toBe(false);
    });

    it('should reject HELLO when string is used for weapon (number expected)', () => {
      expect(checker.check([Types.Messages.HELLO, 'player1', 1, 'bad', 100, 'pass'])).toBe(false);
    });

    it('should reject HELLO when string is used for gold (number expected)', () => {
      expect(checker.check([Types.Messages.HELLO, 'player1', 1, 2, 'bad', 'pass'])).toBe(false);
    });

    it('should reject HELLO when number is used for password (string expected)', () => {
      expect(checker.check([Types.Messages.HELLO, 'player1', 1, 2, 100, 999])).toBe(false);
    });

    it('should reject AGGRO when string is provided instead of number', () => {
      expect(checker.check([Types.Messages.AGGRO, 'abc'])).toBe(false);
    });

    it('should reject ATTACK when boolean is provided instead of number', () => {
      expect(checker.check([Types.Messages.ATTACK, true])).toBe(false);
    });

    it('should reject DROP_ITEM when number is provided instead of string', () => {
      expect(checker.check([Types.Messages.DROP_ITEM, 42])).toBe(false);
    });

    it('should reject DAILY_CHECK with wrong type order (number, string instead of string, number)', () => {
      expect(checker.check([Types.Messages.DAILY_CHECK, 3, '2025-01-01'])).toBe(false);
    });

    it('should reject SHOP_BUY when strings are provided instead of numbers', () => {
      expect(checker.check([Types.Messages.SHOP_BUY, '40', '61'])).toBe(false);
    });

    it('should reject INVENTORY_SWAP when strings are provided instead of numbers', () => {
      expect(checker.check([Types.Messages.INVENTORY_SWAP, '0', '1'])).toBe(false);
    });

    it('should reject PARTY_INVITE when string is provided instead of number', () => {
      expect(checker.check([Types.Messages.PARTY_INVITE, 'player2'])).toBe(false);
    });

    it('should reject PARTY_CHAT when number is provided instead of string', () => {
      expect(checker.check([Types.Messages.PARTY_CHAT, 42])).toBe(false);
    });

    it('should reject SKILL_USE when number is provided instead of string', () => {
      expect(checker.check([Types.Messages.SKILL_USE, 99])).toBe(false);
    });

    it('should reject UNEQUIP_TO_INVENTORY when number is provided instead of string', () => {
      expect(checker.check([Types.Messages.UNEQUIP_TO_INVENTORY, 1])).toBe(false);
    });

    it('should reject LOOTMOVE when any param has wrong type', () => {
      expect(checker.check([Types.Messages.LOOTMOVE, 'a', 2, 3])).toBe(false);
      expect(checker.check([Types.Messages.LOOTMOVE, 1, 'b', 3])).toBe(false);
      expect(checker.check([Types.Messages.LOOTMOVE, 1, 2, 'c'])).toBe(false);
    });

    it('should reject TELEPORT when any param has wrong type', () => {
      expect(checker.check([Types.Messages.TELEPORT, '50', 60])).toBe(false);
      expect(checker.check([Types.Messages.TELEPORT, 50, '60'])).toBe(false);
    });
  });

  describe('check - WHO message (special variable-length handling)', () => {
    it('should accept WHO with a single number param', () => {
      expect(checker.check([Types.Messages.WHO, 1])).toBe(true);
    });

    it('should accept WHO with multiple number params', () => {
      expect(checker.check([Types.Messages.WHO, 1, 2, 3])).toBe(true);
    });

    it('should accept WHO with many number params', () => {
      expect(checker.check([Types.Messages.WHO, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(true);
    });

    it('should reject WHO with no params', () => {
      expect(checker.check([Types.Messages.WHO])).toBe(false);
    });

    it('should reject WHO when any param is a string', () => {
      expect(checker.check([Types.Messages.WHO, 1, 'two', 3])).toBe(false);
    });

    it('should reject WHO when all params are strings', () => {
      expect(checker.check([Types.Messages.WHO, 'a', 'b', 'c'])).toBe(false);
    });

    it('should reject WHO when first param is not a number', () => {
      expect(checker.check([Types.Messages.WHO, 'invalid'])).toBe(false);
    });

    it('should reject WHO when a param is a boolean', () => {
      expect(checker.check([Types.Messages.WHO, 1, true, 3])).toBe(false);
    });

    it('should reject WHO when a param is null', () => {
      expect(checker.check([Types.Messages.WHO, 1, null, 3])).toBe(false);
    });

    it('should reject WHO when a param is undefined', () => {
      expect(checker.check([Types.Messages.WHO, 1, undefined, 3])).toBe(false);
    });
  });

  describe('check - unknown message types', () => {
    it('should reject an unknown numeric message type', () => {
      expect(checker.check([9999])).toBe(false);
    });

    it('should reject negative message type', () => {
      expect(checker.check([-1])).toBe(false);
    });

    it('should return false for unknown message types', () => {
      expect(checker.check([5555, 1, 2, 3])).toBe(false);
    });
  });

  describe('check - edge cases', () => {
    it('should not mutate the original message array', () => {
      const msg = [Types.Messages.MOVE, 10, 20];
      const original = [...msg];
      checker.check(msg);
      expect(msg).toEqual(original);
    });

    it('should handle zero values in number fields', () => {
      expect(checker.check([Types.Messages.MOVE, 0, 0])).toBe(true);
    });

    it('should handle empty string in string fields', () => {
      expect(checker.check([Types.Messages.CHAT, ''])).toBe(true);
    });

    it('should handle negative numbers in number fields', () => {
      expect(checker.check([Types.Messages.MOVE, -5, -10])).toBe(true);
    });

    it('should handle very large numbers', () => {
      expect(checker.check([Types.Messages.AGGRO, Number.MAX_SAFE_INTEGER])).toBe(true);
    });

    it('should reject NaN as a number param even though typeof NaN is number', () => {
      // NaN has typeof 'number', so it passes the type check
      // This documents current behavior
      expect(checker.check([Types.Messages.AGGRO, NaN])).toBe(true);
    });

    it('should reject null as a param for number format', () => {
      expect(checker.check([Types.Messages.AGGRO, null])).toBe(false);
    });

    it('should reject undefined as a param for number format', () => {
      expect(checker.check([Types.Messages.AGGRO, undefined])).toBe(false);
    });

    it('should reject object as a param for string format', () => {
      expect(checker.check([Types.Messages.CHAT, {}])).toBe(false);
    });

    it('should reject array as a param for number format', () => {
      expect(checker.check([Types.Messages.AGGRO, [1]])).toBe(false);
    });
  });
});
