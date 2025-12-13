import {Types} from '../../shared/ts/gametypes';
import * as _ from 'lodash';
import { serializeProperties } from '../../shared/ts/items/index.js';
export const Messages = {
  Spawn: class {
    constructor(private entity) {
    }

    serialize() {
      return [Types.Messages.SPAWN].concat(this.entity.getState());
    }
  },
  Despawn: class {
    constructor(private entityId) {
    }

    serialize() {
      return [Types.Messages.DESPAWN, this.entityId];
    }
  },
  Move: class {
    constructor(private entity) {
    }

    serialize() {
      return [Types.Messages.MOVE,
        this.entity.id,
        this.entity.x,
        this.entity.y];
    }
  },
  LootMove: class {
    constructor(private entity, private item) {
    }

    serialize() {
      return [Types.Messages.LOOTMOVE,
        this.entity.id,
        this.item.id];
    }
  },
  Attack: class {
    constructor(private attackerId, private targetId) {
    }

    serialize() {
      return [Types.Messages.ATTACK,
        this.attackerId,
        this.targetId];
    }
  },
  Health: class {
    constructor(private points, private isRegen = false) {
    }

    serialize() {
      var health = [Types.Messages.HEALTH,
        this.points];

      if (this.isRegen) {
        health.push(1);
      }
      return health;
    }
  },
  HitPoints: class {
    constructor(private maxHitPoints) {
    }

    serialize() {
      return [Types.Messages.HP, this.maxHitPoints];
    }
  },
  EquipItem: class {
    playerId;
    constructor(private player, private itemKind) {
      this.playerId = player.id;
    }

    serialize() {
      return [Types.Messages.EQUIP,
        this.playerId,
        this.itemKind];
    }
  },
  Drop: class {
    constructor(private mob, private item) {
    }

    serialize() {
      // Include item properties if available
      const properties = this.item.properties
        ? serializeProperties(this.item.properties)
        : null;

      var drop = [Types.Messages.DROP,
        this.mob.id,
        this.item.id,
        this.item.kind,
        properties,
        _.pluck(this.mob.hatelist, 'id')];

      return drop;
    }
  },
  Chat: class {
    playerId;

    constructor(player, private message) {
      this.playerId = player.id;
    }

    serialize() {
      return [Types.Messages.CHAT,
        this.playerId,
        this.message];
    }
  },
  Teleport: class {
    constructor(private entity) {
    }

    serialize() {
      return [Types.Messages.TELEPORT,
        this.entity.id,
        this.entity.x,
        this.entity.y];
    }
  },

  Damage: class {
    constructor(private entity, private points) {
    }

    serialize() {
      return [Types.Messages.DAMAGE,
        this.entity.id,
        this.points];
    }
  },

  Population: class {
    constructor(private world, private total?) {
    }

    serialize() {
      // Hacked this
      // Made total prop optional
      // Added condition to fallbac to world count
      return [Types.Messages.POPULATION,
        this.world,
        this.total || this.world];
    }
  },

  Kill: class {
    constructor(private mob) {
    }

    serialize() {
      return [Types.Messages.KILL,
        this.mob.kind];
    }
  },

  List: class {
    constructor(private ids) {
    }

    serialize() {
      var list = this.ids;

      list.unshift(Types.Messages.LIST);
      return list;
    }
  },

  Destroy: class {
    constructor(private entity) {
    }

    serialize() {
      return [Types.Messages.DESTROY,
        this.entity.id];
    }
  },

  Blink: class {
    constructor(private item) {
    }

    serialize() {
      return [Types.Messages.BLINK,
        this.item.id];
    }
  },

  // Venice AI Messages
  NpcTalkResponse: class {
    constructor(private npcKind: number, private response: string) {
    }

    serialize() {
      return [Types.Messages.NPCTALK_RESPONSE,
        this.npcKind,
        this.response];
    }
  },

  CompanionHint: class {
    constructor(private hint: string) {
    }

    serialize() {
      return [Types.Messages.COMPANION_HINT,
        this.hint];
    }
  },

  QuestOffer: class {
    constructor(private quest: {
      type: string;
      target: string;
      count: number;
      progress: number;
      reward: string;
      xp: number;
      description: string;
    }) {
    }

    serialize() {
      return [Types.Messages.QUEST_OFFER,
        this.quest.type,
        this.quest.target,
        this.quest.count,
        this.quest.progress,
        this.quest.reward,
        this.quest.xp,
        this.quest.description];
    }
  },

  QuestStatus: class {
    constructor(private quest: {
      type: string;
      target: string;
      count: number;
      progress: number;
    } | null) {
    }

    serialize() {
      if (!this.quest) {
        return [Types.Messages.QUEST_STATUS, null];
      }
      return [Types.Messages.QUEST_STATUS,
        this.quest.type,
        this.quest.target,
        this.quest.count,
        this.quest.progress];
    }
  },

  QuestComplete: class {
    constructor(private result: {
      reward: string;
      xp: number;
      description: string;
    }) {
    }

    serialize() {
      return [Types.Messages.QUEST_COMPLETE,
        this.result.reward,
        this.result.xp,
        this.result.description];
    }
  },

  ItemLore: class {
    constructor(private itemKind: number, private lore: string) {
    }

    serialize() {
      return [Types.Messages.ITEM_LORE,
        this.itemKind,
        this.lore];
    }
  },

  // AI Narrator - dynamic commentary on player actions
  Narrator: class {
    constructor(private text: string, private style?: string) {
      // style: 'epic' | 'humor' | 'ominous' | 'info'
    }

    serialize() {
      return [Types.Messages.NARRATOR,
        this.text,
        this.style || 'epic'];
    }
  },

  // AI Thought Bubble - visible entity thoughts
  EntityThought: class {
    constructor(
      private entityId: number,
      private thought: string,
      private state: string  // 'idle' | 'combat' | 'flee' | 'special'
    ) {}

    serialize() {
      return [Types.Messages.ENTITY_THOUGHT,
        this.entityId,
        this.thought,
        this.state];
    }
  },

  // World Event - faction director announcements
  WorldEvent: class {
    constructor(
      private title: string,
      private description: string,
      private eventType: string  // 'horde' | 'village' | 'boss' | 'special'
    ) {}

    serialize() {
      return [Types.Messages.WORLD_EVENT,
        this.title,
        this.description,
        this.eventType];
    }
  },

  // Town Crier - newspaper headlines
  NewsResponse: class {
    constructor(private headlines: string[]) {}

    serialize() {
      return [Types.Messages.NEWS_RESPONSE, ...this.headlines];
    }
  },

  // Progression System - XP gain notification
  XpGain: class {
    constructor(
      private amount: number,
      private currentXp: number,
      private xpToNext: number
    ) {}

    serialize() {
      return [Types.Messages.XP_GAIN,
        this.amount,
        this.currentXp,
        this.xpToNext];
    }
  },

  // Progression System - Level up notification
  LevelUp: class {
    constructor(
      private newLevel: number,
      private bonusHP: number,
      private bonusDamage: number
    ) {}

    serialize() {
      return [Types.Messages.LEVEL_UP,
        this.newLevel,
        this.bonusHP,
        this.bonusDamage];
    }
  },

  // Economy System - Gold gain notification
  GoldGain: class {
    constructor(
      private amount: number,
      private totalGold: number
    ) {}

    serialize() {
      return [Types.Messages.GOLD_GAIN,
        this.amount,
        this.totalGold];
    }
  },

  // Daily Reward System - daily login reward notification
  DailyReward: class {
    constructor(
      private gold: number,
      private xp: number,
      private streak: number,
      private isNewDay: boolean
    ) {}

    serialize() {
      return [Types.Messages.DAILY_REWARD,
        this.gold,
        this.xp,
        this.streak,
        this.isNewDay ? 1 : 0];
    }
  },

  // Shop System - send shop inventory to player
  ShopOpen: class {
    constructor(
      private npcKind: number,
      private shopName: string,
      private items: Array<{ itemKind: number; price: number; stock: number }>
    ) {}

    serialize() {
      return [Types.Messages.SHOP_OPEN,
        this.npcKind,
        this.shopName,
        this.items];
    }
  },

  // Shop System - result of purchase attempt
  ShopBuyResult: class {
    constructor(
      private success: boolean,
      private itemKind: number,
      private newGold: number,
      private message: string
    ) {}

    serialize() {
      return [Types.Messages.SHOP_BUY_RESULT,
        this.success ? 1 : 0,
        this.itemKind,
        this.newGold,
        this.message];
    }
  },

  // Shop System - result of sell attempt
  ShopSellResult: class {
    constructor(
      private success: boolean,
      private goldGained: number,
      private newGold: number,
      private message: string
    ) {}

    serialize() {
      return [Types.Messages.SHOP_SELL_RESULT,
        this.success ? 1 : 0,
        this.goldGained,
        this.newGold,
        this.message];
    }
  },

  // Achievement System - broadcast title change to all players
  PlayerTitleUpdate: class {
    constructor(
      private playerId: number,
      private title: string | null
    ) {}

    serialize() {
      return [Types.Messages.PLAYER_TITLE_UPDATE,
        this.playerId,
        this.title || ''];
    }
  },

  // Party System - invite received notification
  PartyInviteReceived: class {
    constructor(
      private inviterId: number,
      private inviterName: string
    ) {}

    serialize() {
      return [Types.Messages.PARTY_INVITE_RECEIVED,
        this.inviterId,
        this.inviterName];
    }
  },

  // Party System - player joined party
  PartyJoin: class {
    constructor(
      private partyId: string,
      private members: Array<{ id: number; name: string; level: number; hp: number; maxHp: number }>,
      private leaderId: number
    ) {}

    serialize() {
      return [Types.Messages.PARTY_JOIN,
        this.partyId,
        this.members,
        this.leaderId];
    }
  },

  // Party System - player left party
  PartyLeave: class {
    constructor(
      private playerId: number
    ) {}

    serialize() {
      return [Types.Messages.PARTY_LEAVE,
        this.playerId];
    }
  },

  // Party System - party disbanded
  PartyDisband: class {
    serialize() {
      return [Types.Messages.PARTY_DISBAND];
    }
  },

  // Party System - party member update (HP, position)
  PartyUpdate: class {
    constructor(
      private members: Array<{ id: number; name: string; level: number; hp: number; maxHp: number }>
    ) {}

    serialize() {
      return [Types.Messages.PARTY_UPDATE,
        this.members];
    }
  },

  // Party System - party chat message
  PartyChat: class {
    constructor(
      private senderId: number,
      private senderName: string,
      private message: string
    ) {}

    serialize() {
      return [Types.Messages.PARTY_CHAT,
        this.senderId,
        this.senderName,
        this.message];
    }
  },

  // Player Inspect - result of inspecting another player
  PlayerInspectResult: class {
    constructor(
      private playerId: number,
      private name: string,
      private title: string | null,
      private level: number,
      private weapon: number,
      private armor: number
    ) {}

    serialize() {
      return [Types.Messages.PLAYER_INSPECT_RESULT,
        this.playerId,
        this.name,
        this.title || '',
        this.level,
        this.weapon,
        this.armor];
    }
  }
};



