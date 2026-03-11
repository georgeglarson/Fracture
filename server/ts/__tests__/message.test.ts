/**
 * Tests for Messages classes
 * Covers: every Message class constructor, serialize() output, and edge cases
 */

import { describe, it, expect } from 'vitest';
import { Messages } from '../message';
import { Types } from '../../../shared/ts/gametypes';
import { Rarity } from '../../../shared/ts/items/index';
import type { ItemProperties } from '../../../shared/ts/items/index';

// ---------------------------------------------------------------------------
// Helpers: minimal stub objects matching the interfaces used by Messages
// ---------------------------------------------------------------------------

function makeEntity(state: unknown[]) {
  return { getState: () => state };
}

function makePositionEntity(id: number, x: number, y: number) {
  return { id, x, y };
}

function makeHitPointsEntity(
  id: number,
  hitPoints?: number,
  maxHitPoints?: number,
) {
  return { id, hitPoints, maxHitPoints };
}

function makeMob(
  id: number,
  kind: number,
  hatelist?: Array<{ id: number }>,
) {
  return { id, kind, hatelist };
}

function makeItem(
  id: number,
  kind: number,
  properties?: ItemProperties | null,
) {
  return { id, kind, properties };
}

function makePlayer(id: number | string) {
  return { id };
}

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

describe('Messages.Spawn', () => {
  it('should serialize with SPAWN type followed by entity state', () => {
    const state = [42, 'warrior', 10, 20];
    const msg = new Messages.Spawn(makeEntity(state));
    expect(msg.serialize()).toEqual([Types.Messages.SPAWN, 42, 'warrior', 10, 20]);
  });

  it('should handle empty entity state', () => {
    const msg = new Messages.Spawn(makeEntity([]));
    expect(msg.serialize()).toEqual([Types.Messages.SPAWN]);
  });

  it('should handle single-element entity state', () => {
    const msg = new Messages.Spawn(makeEntity([99]));
    expect(msg.serialize()).toEqual([Types.Messages.SPAWN, 99]);
  });
});

// ---------------------------------------------------------------------------
// Despawn
// ---------------------------------------------------------------------------

describe('Messages.Despawn', () => {
  it('should serialize with DESPAWN type and entity id', () => {
    const msg = new Messages.Despawn(7);
    expect(msg.serialize()).toEqual([Types.Messages.DESPAWN, 7]);
  });

  it('should handle id of 0', () => {
    const msg = new Messages.Despawn(0);
    expect(msg.serialize()).toEqual([Types.Messages.DESPAWN, 0]);
  });
});

// ---------------------------------------------------------------------------
// Move
// ---------------------------------------------------------------------------

describe('Messages.Move', () => {
  it('should serialize with MOVE type, id, x, y', () => {
    const msg = new Messages.Move(makePositionEntity(5, 100, 200));
    expect(msg.serialize()).toEqual([Types.Messages.MOVE, 5, 100, 200]);
  });

  it('should handle zero coordinates', () => {
    const msg = new Messages.Move(makePositionEntity(1, 0, 0));
    expect(msg.serialize()).toEqual([Types.Messages.MOVE, 1, 0, 0]);
  });

  it('should handle negative coordinates', () => {
    const msg = new Messages.Move(makePositionEntity(3, -10, -20));
    expect(msg.serialize()).toEqual([Types.Messages.MOVE, 3, -10, -20]);
  });
});

// ---------------------------------------------------------------------------
// LootMove
// ---------------------------------------------------------------------------

describe('Messages.LootMove', () => {
  it('should serialize with LOOTMOVE type, entity id, item id', () => {
    const msg = new Messages.LootMove(makePlayer(10), makePlayer(20));
    expect(msg.serialize()).toEqual([Types.Messages.LOOTMOVE, 10, 20]);
  });

  it('should handle string ids', () => {
    const msg = new Messages.LootMove({ id: 'abc' }, { id: 'xyz' });
    expect(msg.serialize()).toEqual([Types.Messages.LOOTMOVE, 'abc', 'xyz']);
  });
});

// ---------------------------------------------------------------------------
// Attack
// ---------------------------------------------------------------------------

describe('Messages.Attack', () => {
  it('should serialize with ATTACK type, attacker id, target id', () => {
    const msg = new Messages.Attack(1, 2);
    expect(msg.serialize()).toEqual([Types.Messages.ATTACK, 1, 2]);
  });

  it('should handle null target', () => {
    const msg = new Messages.Attack(5, null);
    expect(msg.serialize()).toEqual([Types.Messages.ATTACK, 5, null]);
  });

  it('should handle zero ids', () => {
    const msg = new Messages.Attack(0, 0);
    expect(msg.serialize()).toEqual([Types.Messages.ATTACK, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

describe('Messages.Health', () => {
  it('should serialize without regen flag when not regenerating', () => {
    const msg = new Messages.Health(50);
    expect(msg.serialize()).toEqual([Types.Messages.HEALTH, 50]);
  });

  it('should serialize without regen flag when isRegen is false', () => {
    const msg = new Messages.Health(30, false);
    expect(msg.serialize()).toEqual([Types.Messages.HEALTH, 30]);
  });

  it('should append 1 when isRegen is true', () => {
    const msg = new Messages.Health(75, true);
    expect(msg.serialize()).toEqual([Types.Messages.HEALTH, 75, 1]);
  });

  it('should handle zero points', () => {
    const msg = new Messages.Health(0);
    expect(msg.serialize()).toEqual([Types.Messages.HEALTH, 0]);
  });

  it('should handle zero points with regen', () => {
    const msg = new Messages.Health(0, true);
    expect(msg.serialize()).toEqual([Types.Messages.HEALTH, 0, 1]);
  });
});

// ---------------------------------------------------------------------------
// HitPoints
// ---------------------------------------------------------------------------

describe('Messages.HitPoints', () => {
  it('should serialize with HP type and maxHitPoints', () => {
    const msg = new Messages.HitPoints(200);
    expect(msg.serialize()).toEqual([Types.Messages.HP, 200]);
  });

  it('should handle zero max hit points', () => {
    const msg = new Messages.HitPoints(0);
    expect(msg.serialize()).toEqual([Types.Messages.HP, 0]);
  });
});

// ---------------------------------------------------------------------------
// EquipItem
// ---------------------------------------------------------------------------

describe('Messages.EquipItem', () => {
  it('should serialize with EQUIP type, player id, item kind', () => {
    const msg = new Messages.EquipItem(makePlayer(3), Types.Entities.SWORD2);
    expect(msg.serialize()).toEqual([Types.Messages.EQUIP, 3, Types.Entities.SWORD2]);
  });

  it('should expose playerId from constructor', () => {
    const msg = new Messages.EquipItem(makePlayer(42), Types.Entities.AXE);
    expect(msg.playerId).toBe(42);
  });

  it('should handle string player id', () => {
    const msg = new Messages.EquipItem(makePlayer('p-99'), Types.Entities.GOLDENARMOR);
    expect(msg.serialize()).toEqual([Types.Messages.EQUIP, 'p-99', Types.Entities.GOLDENARMOR]);
    expect(msg.playerId).toBe('p-99');
  });
});

// ---------------------------------------------------------------------------
// Drop
// ---------------------------------------------------------------------------

describe('Messages.Drop', () => {
  it('should serialize drop without properties and with empty hatelist', () => {
    const mob = makeMob(10, Types.Entities.RAT);
    const item = makeItem(20, Types.Entities.FLASK);
    const msg = new Messages.Drop(mob, item);
    const result = msg.serialize();

    expect(result[0]).toBe(Types.Messages.DROP);
    expect(result[1]).toBe(10);     // mob id
    expect(result[2]).toBe(20);     // item id
    expect(result[3]).toBe(Types.Entities.FLASK); // item kind
    expect(result[4]).toBeNull();   // no properties
    expect(result[5]).toEqual([]);  // no hatelist
  });

  it('should serialize drop with null properties explicitly', () => {
    const mob = makeMob(1, Types.Entities.GOBLIN, []);
    const item = makeItem(2, Types.Entities.SWORD1, null);
    const msg = new Messages.Drop(mob, item);
    const result = msg.serialize();

    expect(result[4]).toBeNull();
  });

  it('should serialize item properties when present', () => {
    const props: ItemProperties = {
      rarity: Rarity.RARE,
      level: 5,
      category: 'weapon',
      damageMin: 10,
      damageMax: 20,
    };
    const mob = makeMob(10, Types.Entities.SKELETON, [{ id: 1 }, { id: 2 }]);
    const item = makeItem(30, Types.Entities.SWORD2, props);
    const msg = new Messages.Drop(mob, item);
    const result = msg.serialize();

    // properties should be serialized (compact form)
    expect(result[4]).toEqual({
      r: Rarity.RARE,
      l: 5,
      c: 'weapon',
      dMin: 10,
      dMax: 20,
    });
  });

  it('should serialize hatelist ids', () => {
    const mob = makeMob(10, Types.Entities.OGRE, [{ id: 100 }, { id: 200 }, { id: 300 }]);
    const item = makeItem(50, Types.Entities.FLASK);
    const msg = new Messages.Drop(mob, item);
    const result = msg.serialize();

    expect(result[5]).toEqual([100, 200, 300]);
  });

  it('should handle undefined hatelist gracefully', () => {
    const mob = makeMob(10, Types.Entities.BAT);
    const item = makeItem(50, Types.Entities.BURGER);
    const msg = new Messages.Drop(mob, item);
    const result = msg.serialize();

    expect(result[5]).toEqual([]);
  });

  it('should include all bonus stats in serialized properties', () => {
    const props: ItemProperties = {
      rarity: Rarity.EPIC,
      level: 8,
      category: 'armor',
      defense: 15,
      bonusHealth: 30,
      bonusStrength: 5,
      bonusCritChance: 10,
      setId: 'berserker',
    };
    const mob = makeMob(1, Types.Entities.BOSS, []);
    const item = makeItem(2, Types.Entities.REDARMOR, props);
    const msg = new Messages.Drop(mob, item);
    const result = msg.serialize();

    expect(result[4]).toEqual({
      r: Rarity.EPIC,
      l: 8,
      c: 'armor',
      def: 15,
      bHp: 30,
      bStr: 5,
      bCrit: 10,
      set: 'berserker',
    });
  });
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

describe('Messages.Chat', () => {
  it('should serialize with CHAT type, player id, message', () => {
    const msg = new Messages.Chat(makePlayer(5), 'Hello world');
    expect(msg.serialize()).toEqual([Types.Messages.CHAT, 5, 'Hello world']);
  });

  it('should expose playerId from constructor', () => {
    const msg = new Messages.Chat(makePlayer(42), 'test');
    expect(msg.playerId).toBe(42);
  });

  it('should handle empty message string', () => {
    const msg = new Messages.Chat(makePlayer(1), '');
    expect(msg.serialize()).toEqual([Types.Messages.CHAT, 1, '']);
  });

  it('should handle string player id', () => {
    const msg = new Messages.Chat(makePlayer('player-abc'), 'hi');
    expect(msg.serialize()).toEqual([Types.Messages.CHAT, 'player-abc', 'hi']);
  });
});

// ---------------------------------------------------------------------------
// Teleport
// ---------------------------------------------------------------------------

describe('Messages.Teleport', () => {
  it('should serialize with TELEPORT type, id, x, y', () => {
    const msg = new Messages.Teleport(makePositionEntity(8, 50, 75));
    expect(msg.serialize()).toEqual([Types.Messages.TELEPORT, 8, 50, 75]);
  });
});

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

describe('Messages.Damage', () => {
  it('should serialize with DAMAGE type, entity id, points, hp, maxHp', () => {
    const entity = makeHitPointsEntity(5, 80, 100);
    const msg = new Messages.Damage(entity, 20);
    expect(msg.serialize()).toEqual([Types.Messages.DAMAGE, 5, 20, 80, 100]);
  });

  it('should default hitPoints to 0 when undefined', () => {
    const entity = makeHitPointsEntity(5, undefined, 100);
    const msg = new Messages.Damage(entity, 10);
    expect(msg.serialize()).toEqual([Types.Messages.DAMAGE, 5, 10, 0, 100]);
  });

  it('should default maxHitPoints to 0 when undefined', () => {
    const entity = makeHitPointsEntity(5, 50, undefined);
    const msg = new Messages.Damage(entity, 10);
    expect(msg.serialize()).toEqual([Types.Messages.DAMAGE, 5, 10, 50, 0]);
  });

  it('should default both hitPoints and maxHitPoints to 0 when undefined', () => {
    const entity = makeHitPointsEntity(5);
    const msg = new Messages.Damage(entity, 15);
    expect(msg.serialize()).toEqual([Types.Messages.DAMAGE, 5, 15, 0, 0]);
  });

  it('should handle zero damage', () => {
    const entity = makeHitPointsEntity(1, 100, 100);
    const msg = new Messages.Damage(entity, 0);
    expect(msg.serialize()).toEqual([Types.Messages.DAMAGE, 1, 0, 100, 100]);
  });
});

// ---------------------------------------------------------------------------
// Population
// ---------------------------------------------------------------------------

describe('Messages.Population', () => {
  it('should serialize with both world and total', () => {
    const msg = new Messages.Population(10, 50);
    expect(msg.serialize()).toEqual([Types.Messages.POPULATION, 10, 50]);
  });

  it('should fall back total to world count when total is omitted', () => {
    const msg = new Messages.Population(15);
    expect(msg.serialize()).toEqual([Types.Messages.POPULATION, 15, 15]);
  });

  it('should fall back total to world count when total is 0 (falsy)', () => {
    const msg = new Messages.Population(5, 0);
    // Because of `this.total || this.world`, total=0 is falsy, falls back to world
    expect(msg.serialize()).toEqual([Types.Messages.POPULATION, 5, 5]);
  });

  it('should handle world count of 0', () => {
    const msg = new Messages.Population(0, 10);
    expect(msg.serialize()).toEqual([Types.Messages.POPULATION, 0, 10]);
  });

  it('should handle both zero (edge)', () => {
    const msg = new Messages.Population(0, 0);
    // total=0 is falsy, world=0, so fallback is 0
    expect(msg.serialize()).toEqual([Types.Messages.POPULATION, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// Kill
// ---------------------------------------------------------------------------

describe('Messages.Kill', () => {
  it('should serialize with KILL type and mob kind', () => {
    const msg = new Messages.Kill({ kind: Types.Entities.BOSS });
    expect(msg.serialize()).toEqual([Types.Messages.KILL, Types.Entities.BOSS]);
  });

  it('should handle different mob kinds', () => {
    const msg = new Messages.Kill({ kind: Types.Entities.RAT });
    expect(msg.serialize()).toEqual([Types.Messages.KILL, Types.Entities.RAT]);
  });
});

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

describe('Messages.List', () => {
  it('should serialize with LIST type followed by all ids', () => {
    const msg = new Messages.List([1, 2, 3]);
    expect(msg.serialize()).toEqual([Types.Messages.LIST, 1, 2, 3]);
  });

  it('should handle empty ids array', () => {
    const msg = new Messages.List([]);
    expect(msg.serialize()).toEqual([Types.Messages.LIST]);
  });

  it('should handle single id', () => {
    const msg = new Messages.List([42]);
    expect(msg.serialize()).toEqual([Types.Messages.LIST, 42]);
  });

  it('should not mutate the original ids array', () => {
    const ids = [10, 20, 30];
    const msg = new Messages.List(ids);
    msg.serialize();
    expect(ids).toEqual([10, 20, 30]);
  });
});

// ---------------------------------------------------------------------------
// Destroy
// ---------------------------------------------------------------------------

describe('Messages.Destroy', () => {
  it('should serialize with DESTROY type and entity id', () => {
    const msg = new Messages.Destroy(makePlayer(99));
    expect(msg.serialize()).toEqual([Types.Messages.DESTROY, 99]);
  });

  it('should handle string entity id', () => {
    const msg = new Messages.Destroy({ id: 'e-123' });
    expect(msg.serialize()).toEqual([Types.Messages.DESTROY, 'e-123']);
  });
});

// ---------------------------------------------------------------------------
// Blink
// ---------------------------------------------------------------------------

describe('Messages.Blink', () => {
  it('should serialize with BLINK type and item id', () => {
    const msg = new Messages.Blink(makePlayer(15));
    expect(msg.serialize()).toEqual([Types.Messages.BLINK, 15]);
  });
});

// ---------------------------------------------------------------------------
// NpcTalkResponse
// ---------------------------------------------------------------------------

describe('Messages.NpcTalkResponse', () => {
  it('should serialize with npc kind, response text, and audio url', () => {
    const msg = new Messages.NpcTalkResponse(Types.Entities.KING, 'Welcome!', 'http://audio.mp3');
    expect(msg.serialize()).toEqual([
      Types.Messages.NPCTALK_RESPONSE,
      Types.Entities.KING,
      'Welcome!',
      'http://audio.mp3',
    ]);
  });

  it('should default audioUrl to empty string when null', () => {
    const msg = new Messages.NpcTalkResponse(Types.Entities.PRIEST, 'Greetings', null);
    expect(msg.serialize()).toEqual([
      Types.Messages.NPCTALK_RESPONSE,
      Types.Entities.PRIEST,
      'Greetings',
      '',
    ]);
  });

  it('should default audioUrl to empty string when omitted', () => {
    const msg = new Messages.NpcTalkResponse(Types.Entities.GUARD, 'Halt!');
    expect(msg.serialize()).toEqual([
      Types.Messages.NPCTALK_RESPONSE,
      Types.Entities.GUARD,
      'Halt!',
      '',
    ]);
  });
});

// ---------------------------------------------------------------------------
// CompanionHint
// ---------------------------------------------------------------------------

describe('Messages.CompanionHint', () => {
  it('should serialize with COMPANION_HINT type and hint text', () => {
    const msg = new Messages.CompanionHint('Watch out for skeletons!');
    expect(msg.serialize()).toEqual([Types.Messages.COMPANION_HINT, 'Watch out for skeletons!']);
  });

  it('should handle empty hint', () => {
    const msg = new Messages.CompanionHint('');
    expect(msg.serialize()).toEqual([Types.Messages.COMPANION_HINT, '']);
  });
});

// ---------------------------------------------------------------------------
// QuestOffer
// ---------------------------------------------------------------------------

describe('Messages.QuestOffer', () => {
  it('should serialize all quest fields in order', () => {
    const quest = {
      type: 'kill',
      target: 'skeleton',
      count: 10,
      progress: 3,
      reward: 'sword2',
      xp: 500,
      description: 'Slay 10 skeletons in the graveyard',
    };
    const msg = new Messages.QuestOffer(quest);
    expect(msg.serialize()).toEqual([
      Types.Messages.QUEST_OFFER,
      'kill',
      'skeleton',
      10,
      3,
      'sword2',
      500,
      'Slay 10 skeletons in the graveyard',
    ]);
  });

  it('should handle zero progress and count', () => {
    const quest = {
      type: 'collect',
      target: 'flask',
      count: 0,
      progress: 0,
      reward: 'flask',
      xp: 0,
      description: '',
    };
    const msg = new Messages.QuestOffer(quest);
    expect(msg.serialize()).toEqual([
      Types.Messages.QUEST_OFFER,
      'collect',
      'flask',
      0,
      0,
      'flask',
      0,
      '',
    ]);
  });
});

// ---------------------------------------------------------------------------
// QuestStatus
// ---------------------------------------------------------------------------

describe('Messages.QuestStatus', () => {
  it('should serialize quest progress fields when quest is active', () => {
    const quest = { type: 'kill', target: 'rat', count: 5, progress: 2 };
    const msg = new Messages.QuestStatus(quest);
    expect(msg.serialize()).toEqual([
      Types.Messages.QUEST_STATUS,
      'kill',
      'rat',
      5,
      2,
    ]);
  });

  it('should serialize [QUEST_STATUS, null] when quest is null', () => {
    const msg = new Messages.QuestStatus(null);
    expect(msg.serialize()).toEqual([Types.Messages.QUEST_STATUS, null]);
  });
});

// ---------------------------------------------------------------------------
// QuestComplete
// ---------------------------------------------------------------------------

describe('Messages.QuestComplete', () => {
  it('should serialize quest completion result', () => {
    const result = { reward: 'goldensword', xp: 1000, description: 'Quest completed!' };
    const msg = new Messages.QuestComplete(result);
    expect(msg.serialize()).toEqual([
      Types.Messages.QUEST_COMPLETE,
      'goldensword',
      1000,
      'Quest completed!',
    ]);
  });
});

// ---------------------------------------------------------------------------
// ItemLore
// ---------------------------------------------------------------------------

describe('Messages.ItemLore', () => {
  it('should serialize with ITEM_LORE type, item kind, lore text', () => {
    const msg = new Messages.ItemLore(Types.Entities.GOLDENSWORD, 'A blade forged in fire');
    expect(msg.serialize()).toEqual([
      Types.Messages.ITEM_LORE,
      Types.Entities.GOLDENSWORD,
      'A blade forged in fire',
    ]);
  });

  it('should handle empty lore string', () => {
    const msg = new Messages.ItemLore(Types.Entities.FLASK, '');
    expect(msg.serialize()).toEqual([Types.Messages.ITEM_LORE, Types.Entities.FLASK, '']);
  });
});

// ---------------------------------------------------------------------------
// Narrator
// ---------------------------------------------------------------------------

describe('Messages.Narrator', () => {
  it('should serialize with text, style, and audio url', () => {
    const msg = new Messages.Narrator('The hero enters!', 'epic', 'http://narration.mp3');
    expect(msg.serialize()).toEqual([
      Types.Messages.NARRATOR,
      'The hero enters!',
      'epic',
      'http://narration.mp3',
    ]);
  });

  it('should default style to epic when omitted', () => {
    const msg = new Messages.Narrator('A shadow falls.');
    expect(msg.serialize()).toEqual([
      Types.Messages.NARRATOR,
      'A shadow falls.',
      'epic',
      '',
    ]);
  });

  it('should default audioUrl to empty string when omitted', () => {
    const msg = new Messages.Narrator('Danger ahead!', 'ominous');
    expect(msg.serialize()).toEqual([
      Types.Messages.NARRATOR,
      'Danger ahead!',
      'ominous',
      '',
    ]);
  });

  it('should pass through all styles', () => {
    for (const style of ['epic', 'humor', 'ominous', 'info']) {
      const msg = new Messages.Narrator('text', style);
      expect(msg.serialize()[2]).toBe(style);
    }
  });
});

// ---------------------------------------------------------------------------
// EntityThought
// ---------------------------------------------------------------------------

describe('Messages.EntityThought', () => {
  it('should serialize entity id, thought, and state', () => {
    const msg = new Messages.EntityThought(42, 'I sense danger...', 'combat');
    expect(msg.serialize()).toEqual([
      Types.Messages.ENTITY_THOUGHT,
      42,
      'I sense danger...',
      'combat',
    ]);
  });

  it('should handle all state types', () => {
    for (const state of ['idle', 'combat', 'flee', 'special']) {
      const msg = new Messages.EntityThought(1, 'thought', state);
      expect(msg.serialize()[3]).toBe(state);
    }
  });
});

// ---------------------------------------------------------------------------
// WorldEvent
// ---------------------------------------------------------------------------

describe('Messages.WorldEvent', () => {
  it('should serialize title, description, eventType', () => {
    const msg = new Messages.WorldEvent('Horde Incoming', 'Skeletons march!', 'horde');
    expect(msg.serialize()).toEqual([
      Types.Messages.WORLD_EVENT,
      'Horde Incoming',
      'Skeletons march!',
      'horde',
    ]);
  });

  it('should handle all event types', () => {
    for (const eventType of ['horde', 'village', 'boss', 'special']) {
      const msg = new Messages.WorldEvent('Title', 'Desc', eventType);
      expect(msg.serialize()[3]).toBe(eventType);
    }
  });
});

// ---------------------------------------------------------------------------
// NewsResponse
// ---------------------------------------------------------------------------

describe('Messages.NewsResponse', () => {
  it('should serialize NEWS_RESPONSE followed by spread headlines', () => {
    const headlines = ['Breaking news!', 'Market crash!', 'Hero rises!'];
    const msg = new Messages.NewsResponse(headlines);
    expect(msg.serialize()).toEqual([
      Types.Messages.NEWS_RESPONSE,
      'Breaking news!',
      'Market crash!',
      'Hero rises!',
    ]);
  });

  it('should handle empty headlines', () => {
    const msg = new Messages.NewsResponse([]);
    expect(msg.serialize()).toEqual([Types.Messages.NEWS_RESPONSE]);
  });

  it('should handle single headline', () => {
    const msg = new Messages.NewsResponse(['Only one story']);
    expect(msg.serialize()).toEqual([Types.Messages.NEWS_RESPONSE, 'Only one story']);
  });
});

// ---------------------------------------------------------------------------
// XpGain
// ---------------------------------------------------------------------------

describe('Messages.XpGain', () => {
  it('should serialize amount, currentXp, xpToNext', () => {
    const msg = new Messages.XpGain(100, 500, 1000);
    expect(msg.serialize()).toEqual([Types.Messages.XP_GAIN, 100, 500, 1000]);
  });

  it('should handle zero values', () => {
    const msg = new Messages.XpGain(0, 0, 0);
    expect(msg.serialize()).toEqual([Types.Messages.XP_GAIN, 0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// LevelUp
// ---------------------------------------------------------------------------

describe('Messages.LevelUp', () => {
  it('should serialize newLevel, bonusHP, bonusDamage', () => {
    const msg = new Messages.LevelUp(5, 20, 3);
    expect(msg.serialize()).toEqual([Types.Messages.LEVEL_UP, 5, 20, 3]);
  });

  it('should handle level 1 with zero bonuses', () => {
    const msg = new Messages.LevelUp(1, 0, 0);
    expect(msg.serialize()).toEqual([Types.Messages.LEVEL_UP, 1, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// GoldGain
// ---------------------------------------------------------------------------

describe('Messages.GoldGain', () => {
  it('should serialize amount and totalGold', () => {
    const msg = new Messages.GoldGain(50, 1200);
    expect(msg.serialize()).toEqual([Types.Messages.GOLD_GAIN, 50, 1200]);
  });

  it('should handle zero gold', () => {
    const msg = new Messages.GoldGain(0, 0);
    expect(msg.serialize()).toEqual([Types.Messages.GOLD_GAIN, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// DailyReward
// ---------------------------------------------------------------------------

describe('Messages.DailyReward', () => {
  it('should serialize with isNewDay as 1 when true', () => {
    const msg = new Messages.DailyReward(100, 200, 3, true);
    expect(msg.serialize()).toEqual([Types.Messages.DAILY_REWARD, 100, 200, 3, 1]);
  });

  it('should serialize with isNewDay as 0 when false', () => {
    const msg = new Messages.DailyReward(100, 200, 3, false);
    expect(msg.serialize()).toEqual([Types.Messages.DAILY_REWARD, 100, 200, 3, 0]);
  });

  it('should handle streak of 1 (first day)', () => {
    const msg = new Messages.DailyReward(10, 50, 1, true);
    expect(msg.serialize()).toEqual([Types.Messages.DAILY_REWARD, 10, 50, 1, 1]);
  });
});

// ---------------------------------------------------------------------------
// ShopOpen
// ---------------------------------------------------------------------------

describe('Messages.ShopOpen', () => {
  it('should serialize npc kind, shop name, and items array', () => {
    const items = [
      { itemKind: Types.Entities.SWORD2, price: 100, stock: 5 },
      { itemKind: Types.Entities.FLASK, price: 20, stock: 10 },
    ];
    const msg = new Messages.ShopOpen(Types.Entities.VILLAGER, 'General Store', items);
    expect(msg.serialize()).toEqual([
      Types.Messages.SHOP_OPEN,
      Types.Entities.VILLAGER,
      'General Store',
      items,
    ]);
  });

  it('should handle empty items array', () => {
    const msg = new Messages.ShopOpen(Types.Entities.GUARD, 'Empty Shop', []);
    expect(msg.serialize()).toEqual([
      Types.Messages.SHOP_OPEN,
      Types.Entities.GUARD,
      'Empty Shop',
      [],
    ]);
  });
});

// ---------------------------------------------------------------------------
// ShopBuyResult
// ---------------------------------------------------------------------------

describe('Messages.ShopBuyResult', () => {
  it('should serialize success as 1 when true', () => {
    const msg = new Messages.ShopBuyResult(true, Types.Entities.SWORD2, 900, 'Purchase successful');
    expect(msg.serialize()).toEqual([
      Types.Messages.SHOP_BUY_RESULT,
      1,
      Types.Entities.SWORD2,
      900,
      'Purchase successful',
    ]);
  });

  it('should serialize success as 0 when false', () => {
    const msg = new Messages.ShopBuyResult(false, Types.Entities.SWORD2, 50, 'Not enough gold');
    expect(msg.serialize()).toEqual([
      Types.Messages.SHOP_BUY_RESULT,
      0,
      Types.Entities.SWORD2,
      50,
      'Not enough gold',
    ]);
  });
});

// ---------------------------------------------------------------------------
// ShopSellResult
// ---------------------------------------------------------------------------

describe('Messages.ShopSellResult', () => {
  it('should serialize success as 1 when true', () => {
    const msg = new Messages.ShopSellResult(true, 50, 1050, 'Sold!');
    expect(msg.serialize()).toEqual([
      Types.Messages.SHOP_SELL_RESULT,
      1,
      50,
      1050,
      'Sold!',
    ]);
  });

  it('should serialize success as 0 when false', () => {
    const msg = new Messages.ShopSellResult(false, 0, 500, 'Cannot sell that');
    expect(msg.serialize()).toEqual([
      Types.Messages.SHOP_SELL_RESULT,
      0,
      0,
      500,
      'Cannot sell that',
    ]);
  });
});

// ---------------------------------------------------------------------------
// PlayerTitleUpdate
// ---------------------------------------------------------------------------

describe('Messages.PlayerTitleUpdate', () => {
  it('should serialize with title string', () => {
    const msg = new Messages.PlayerTitleUpdate(7, 'Dragon Slayer');
    expect(msg.serialize()).toEqual([
      Types.Messages.PLAYER_TITLE_UPDATE,
      7,
      'Dragon Slayer',
    ]);
  });

  it('should serialize null title as empty string', () => {
    const msg = new Messages.PlayerTitleUpdate(7, null);
    expect(msg.serialize()).toEqual([
      Types.Messages.PLAYER_TITLE_UPDATE,
      7,
      '',
    ]);
  });
});

// ---------------------------------------------------------------------------
// PartyInviteReceived
// ---------------------------------------------------------------------------

describe('Messages.PartyInviteReceived', () => {
  it('should serialize inviter id and name', () => {
    const msg = new Messages.PartyInviteReceived(5, 'HeroPlayer');
    expect(msg.serialize()).toEqual([
      Types.Messages.PARTY_INVITE_RECEIVED,
      5,
      'HeroPlayer',
    ]);
  });
});

// ---------------------------------------------------------------------------
// PartyJoin
// ---------------------------------------------------------------------------

describe('Messages.PartyJoin', () => {
  it('should serialize party id, members array, and leader id', () => {
    const members = [
      { id: 1, name: 'Alpha', level: 5, hp: 100, maxHp: 100 },
      { id: 2, name: 'Beta', level: 3, hp: 50, maxHp: 80 },
    ];
    const msg = new Messages.PartyJoin('party-abc', members, 1);
    expect(msg.serialize()).toEqual([
      Types.Messages.PARTY_JOIN,
      'party-abc',
      members,
      1,
    ]);
  });

  it('should handle empty members array', () => {
    const msg = new Messages.PartyJoin('party-empty', [], 0);
    expect(msg.serialize()).toEqual([
      Types.Messages.PARTY_JOIN,
      'party-empty',
      [],
      0,
    ]);
  });
});

// ---------------------------------------------------------------------------
// PartyLeave
// ---------------------------------------------------------------------------

describe('Messages.PartyLeave', () => {
  it('should serialize player id', () => {
    const msg = new Messages.PartyLeave(42);
    expect(msg.serialize()).toEqual([Types.Messages.PARTY_LEAVE, 42]);
  });
});

// ---------------------------------------------------------------------------
// PartyDisband
// ---------------------------------------------------------------------------

describe('Messages.PartyDisband', () => {
  it('should serialize with only PARTY_DISBAND type', () => {
    const msg = new Messages.PartyDisband();
    expect(msg.serialize()).toEqual([Types.Messages.PARTY_DISBAND]);
  });

  it('should return array of length 1', () => {
    const msg = new Messages.PartyDisband();
    expect(msg.serialize()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// PartyUpdate
// ---------------------------------------------------------------------------

describe('Messages.PartyUpdate', () => {
  it('should serialize with PARTY_UPDATE type and members array', () => {
    const members = [
      { id: 1, name: 'Alpha', level: 10, hp: 200, maxHp: 200 },
    ];
    const msg = new Messages.PartyUpdate(members);
    expect(msg.serialize()).toEqual([Types.Messages.PARTY_UPDATE, members]);
  });

  it('should handle empty members', () => {
    const msg = new Messages.PartyUpdate([]);
    expect(msg.serialize()).toEqual([Types.Messages.PARTY_UPDATE, []]);
  });
});

// ---------------------------------------------------------------------------
// PartyChat
// ---------------------------------------------------------------------------

describe('Messages.PartyChat', () => {
  it('should serialize sender id, name, and message', () => {
    const msg = new Messages.PartyChat(3, 'Warrior', 'Lets go!');
    expect(msg.serialize()).toEqual([
      Types.Messages.PARTY_CHAT,
      3,
      'Warrior',
      'Lets go!',
    ]);
  });
});

// ---------------------------------------------------------------------------
// PlayerInspectResult
// ---------------------------------------------------------------------------

describe('Messages.PlayerInspectResult', () => {
  it('should serialize all fields', () => {
    const msg = new Messages.PlayerInspectResult(
      7, 'TestPlayer', 'Champion', 15, Types.Entities.GOLDENSWORD, Types.Entities.GOLDENARMOR,
    );
    expect(msg.serialize()).toEqual([
      Types.Messages.PLAYER_INSPECT_RESULT,
      7,
      'TestPlayer',
      'Champion',
      15,
      Types.Entities.GOLDENSWORD,
      Types.Entities.GOLDENARMOR,
    ]);
  });

  it('should serialize null title as empty string', () => {
    const msg = new Messages.PlayerInspectResult(
      1, 'Noob', null, 1, Types.Entities.SWORD1, Types.Entities.CLOTHARMOR,
    );
    expect(msg.serialize()).toEqual([
      Types.Messages.PLAYER_INSPECT_RESULT,
      1,
      'Noob',
      '',
      1,
      Types.Entities.SWORD1,
      Types.Entities.CLOTHARMOR,
    ]);
  });
});

// ---------------------------------------------------------------------------
// LeaderboardResponse
// ---------------------------------------------------------------------------

describe('Messages.LeaderboardResponse', () => {
  it('should serialize with entries array', () => {
    const entries = [
      { rank: 1, name: 'Best', kills: 100 },
      { rank: 2, name: 'Second', kills: 50 },
    ];
    const msg = new Messages.LeaderboardResponse(entries);
    expect(msg.serialize()).toEqual([Types.Messages.LEADERBOARD_RESPONSE, entries]);
  });

  it('should handle empty entries', () => {
    const msg = new Messages.LeaderboardResponse([]);
    expect(msg.serialize()).toEqual([Types.Messages.LEADERBOARD_RESPONSE, []]);
  });
});

// ---------------------------------------------------------------------------
// BossKill
// ---------------------------------------------------------------------------

describe('Messages.BossKill', () => {
  it('should serialize boss name and killer name', () => {
    const msg = new Messages.BossKill('Skeleton King', 'HeroPlayer');
    expect(msg.serialize()).toEqual([
      Types.Messages.BOSS_KILL,
      'Skeleton King',
      'HeroPlayer',
    ]);
  });
});

// ---------------------------------------------------------------------------
// KillStreak
// ---------------------------------------------------------------------------

describe('Messages.KillStreak', () => {
  it('should serialize all kill streak fields', () => {
    const msg = new Messages.KillStreak(5, 'Warrior', 10, 'Unstoppable', 'Warrior is unstoppable!');
    expect(msg.serialize()).toEqual([
      Types.Messages.KILL_STREAK,
      5,
      'Warrior',
      10,
      'Unstoppable',
      'Warrior is unstoppable!',
    ]);
  });
});

// ---------------------------------------------------------------------------
// KillStreakEnded
// ---------------------------------------------------------------------------

describe('Messages.KillStreakEnded', () => {
  it('should serialize with endedByName when present', () => {
    const msg = new Messages.KillStreakEnded(5, 'Warrior', 10, 'Goblin');
    expect(msg.serialize()).toEqual([
      Types.Messages.KILL_STREAK_ENDED,
      5,
      'Warrior',
      10,
      'Goblin',
    ]);
  });

  it('should serialize null endedByName as empty string', () => {
    const msg = new Messages.KillStreakEnded(5, 'Warrior', 10, null);
    expect(msg.serialize()).toEqual([
      Types.Messages.KILL_STREAK_ENDED,
      5,
      'Warrior',
      10,
      '',
    ]);
  });
});

// ---------------------------------------------------------------------------
// NemesisPowerUp
// ---------------------------------------------------------------------------

describe('Messages.NemesisPowerUp', () => {
  it('should serialize all nemesis power up fields', () => {
    const msg = new Messages.NemesisPowerUp(
      100, 'Skeleton', 'Bonecrusher', 'The Relentless', 3, 5, 'HeroPlayer',
    );
    expect(msg.serialize()).toEqual([
      Types.Messages.NEMESIS_POWER_UP,
      100,
      'Skeleton',
      'Bonecrusher',
      'The Relentless',
      3,
      5,
      'HeroPlayer',
    ]);
  });
});

// ---------------------------------------------------------------------------
// NemesisKilled
// ---------------------------------------------------------------------------

describe('Messages.NemesisKilled', () => {
  it('should serialize with isRevenge as 1 when true', () => {
    const msg = new Messages.NemesisKilled(
      100, 'Bonecrusher', 'The Relentless', 5, 'HeroPlayer', true,
    );
    expect(msg.serialize()).toEqual([
      Types.Messages.NEMESIS_KILLED,
      100,
      'Bonecrusher',
      'The Relentless',
      5,
      'HeroPlayer',
      1,
    ]);
  });

  it('should serialize with isRevenge as 0 when false', () => {
    const msg = new Messages.NemesisKilled(
      100, 'Bonecrusher', 'The Relentless', 5, 'HeroPlayer', false,
    );
    expect(msg.serialize()).toEqual([
      Types.Messages.NEMESIS_KILLED,
      100,
      'Bonecrusher',
      'The Relentless',
      5,
      'HeroPlayer',
      0,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: every message's first element is the correct type constant
// ---------------------------------------------------------------------------

describe('Messages - type code consistency', () => {
  it('every serialize() output should have correct message type as first element', () => {
    // Build one instance of each message class and verify the leading type code
    const cases: Array<{ name: string; msg: { serialize(): unknown[] }; expectedType: number }> = [
      { name: 'Spawn', msg: new Messages.Spawn(makeEntity([1])), expectedType: Types.Messages.SPAWN },
      { name: 'Despawn', msg: new Messages.Despawn(1), expectedType: Types.Messages.DESPAWN },
      { name: 'Move', msg: new Messages.Move(makePositionEntity(1, 0, 0)), expectedType: Types.Messages.MOVE },
      { name: 'LootMove', msg: new Messages.LootMove(makePlayer(1), makePlayer(2)), expectedType: Types.Messages.LOOTMOVE },
      { name: 'Attack', msg: new Messages.Attack(1, 2), expectedType: Types.Messages.ATTACK },
      { name: 'Health', msg: new Messages.Health(1), expectedType: Types.Messages.HEALTH },
      { name: 'HitPoints', msg: new Messages.HitPoints(1), expectedType: Types.Messages.HP },
      { name: 'EquipItem', msg: new Messages.EquipItem(makePlayer(1), 60), expectedType: Types.Messages.EQUIP },
      { name: 'Drop', msg: new Messages.Drop(makeMob(1, 2), makeItem(3, 4)), expectedType: Types.Messages.DROP },
      { name: 'Chat', msg: new Messages.Chat(makePlayer(1), 'hi'), expectedType: Types.Messages.CHAT },
      { name: 'Teleport', msg: new Messages.Teleport(makePositionEntity(1, 0, 0)), expectedType: Types.Messages.TELEPORT },
      { name: 'Damage', msg: new Messages.Damage(makeHitPointsEntity(1), 5), expectedType: Types.Messages.DAMAGE },
      { name: 'Population', msg: new Messages.Population(1), expectedType: Types.Messages.POPULATION },
      { name: 'Kill', msg: new Messages.Kill({ kind: 2 }), expectedType: Types.Messages.KILL },
      { name: 'List', msg: new Messages.List([1]), expectedType: Types.Messages.LIST },
      { name: 'Destroy', msg: new Messages.Destroy(makePlayer(1)), expectedType: Types.Messages.DESTROY },
      { name: 'Blink', msg: new Messages.Blink(makePlayer(1)), expectedType: Types.Messages.BLINK },
      { name: 'NpcTalkResponse', msg: new Messages.NpcTalkResponse(40, 'hi'), expectedType: Types.Messages.NPCTALK_RESPONSE },
      { name: 'CompanionHint', msg: new Messages.CompanionHint('hint'), expectedType: Types.Messages.COMPANION_HINT },
      { name: 'QuestOffer', msg: new Messages.QuestOffer({ type: 'k', target: 't', count: 1, progress: 0, reward: 'r', xp: 0, description: 'd' }), expectedType: Types.Messages.QUEST_OFFER },
      { name: 'QuestStatus', msg: new Messages.QuestStatus(null), expectedType: Types.Messages.QUEST_STATUS },
      { name: 'QuestComplete', msg: new Messages.QuestComplete({ reward: 'r', xp: 0, description: 'd' }), expectedType: Types.Messages.QUEST_COMPLETE },
      { name: 'ItemLore', msg: new Messages.ItemLore(60, 'lore'), expectedType: Types.Messages.ITEM_LORE },
      { name: 'Narrator', msg: new Messages.Narrator('text'), expectedType: Types.Messages.NARRATOR },
      { name: 'EntityThought', msg: new Messages.EntityThought(1, 't', 'idle'), expectedType: Types.Messages.ENTITY_THOUGHT },
      { name: 'WorldEvent', msg: new Messages.WorldEvent('t', 'd', 'horde'), expectedType: Types.Messages.WORLD_EVENT },
      { name: 'NewsResponse', msg: new Messages.NewsResponse([]), expectedType: Types.Messages.NEWS_RESPONSE },
      { name: 'XpGain', msg: new Messages.XpGain(1, 2, 3), expectedType: Types.Messages.XP_GAIN },
      { name: 'LevelUp', msg: new Messages.LevelUp(2, 10, 1), expectedType: Types.Messages.LEVEL_UP },
      { name: 'GoldGain', msg: new Messages.GoldGain(1, 2), expectedType: Types.Messages.GOLD_GAIN },
      { name: 'DailyReward', msg: new Messages.DailyReward(1, 2, 3, true), expectedType: Types.Messages.DAILY_REWARD },
      { name: 'ShopOpen', msg: new Messages.ShopOpen(44, 'Shop', []), expectedType: Types.Messages.SHOP_OPEN },
      { name: 'ShopBuyResult', msg: new Messages.ShopBuyResult(true, 60, 100, 'ok'), expectedType: Types.Messages.SHOP_BUY_RESULT },
      { name: 'ShopSellResult', msg: new Messages.ShopSellResult(true, 10, 110, 'ok'), expectedType: Types.Messages.SHOP_SELL_RESULT },
      { name: 'PlayerTitleUpdate', msg: new Messages.PlayerTitleUpdate(1, 'Title'), expectedType: Types.Messages.PLAYER_TITLE_UPDATE },
      { name: 'PartyInviteReceived', msg: new Messages.PartyInviteReceived(1, 'Name'), expectedType: Types.Messages.PARTY_INVITE_RECEIVED },
      { name: 'PartyJoin', msg: new Messages.PartyJoin('id', [], 1), expectedType: Types.Messages.PARTY_JOIN },
      { name: 'PartyLeave', msg: new Messages.PartyLeave(1), expectedType: Types.Messages.PARTY_LEAVE },
      { name: 'PartyDisband', msg: new Messages.PartyDisband(), expectedType: Types.Messages.PARTY_DISBAND },
      { name: 'PartyUpdate', msg: new Messages.PartyUpdate([]), expectedType: Types.Messages.PARTY_UPDATE },
      { name: 'PartyChat', msg: new Messages.PartyChat(1, 'N', 'msg'), expectedType: Types.Messages.PARTY_CHAT },
      { name: 'PlayerInspectResult', msg: new Messages.PlayerInspectResult(1, 'N', null, 1, 60, 21), expectedType: Types.Messages.PLAYER_INSPECT_RESULT },
      { name: 'LeaderboardResponse', msg: new Messages.LeaderboardResponse([]), expectedType: Types.Messages.LEADERBOARD_RESPONSE },
      { name: 'BossKill', msg: new Messages.BossKill('Boss', 'Player'), expectedType: Types.Messages.BOSS_KILL },
      { name: 'KillStreak', msg: new Messages.KillStreak(1, 'N', 5, 'T', 'A'), expectedType: Types.Messages.KILL_STREAK },
      { name: 'KillStreakEnded', msg: new Messages.KillStreakEnded(1, 'N', 5, null), expectedType: Types.Messages.KILL_STREAK_ENDED },
      { name: 'NemesisPowerUp', msg: new Messages.NemesisPowerUp(1, 'o', 'n', 't', 1, 1, 'v'), expectedType: Types.Messages.NEMESIS_POWER_UP },
      { name: 'NemesisKilled', msg: new Messages.NemesisKilled(1, 'n', 't', 1, 'k', false), expectedType: Types.Messages.NEMESIS_KILLED },
    ];

    for (const { name, msg, expectedType } of cases) {
      const serialized = msg.serialize();
      expect(serialized[0], `${name} should start with type ${expectedType}`).toBe(expectedType);
      expect(Array.isArray(serialized), `${name}.serialize() should return an array`).toBe(true);
    }
  });
});
