import {Types} from '../../shared/ts/gametypes';
import * as _ from 'lodash';
import { serializeProperties, ItemProperties } from '../../shared/ts/items/index.js';

// Minimal interfaces for message serialization (avoid circular deps)
interface HasState { getState(): unknown[]; }
interface HasId { id: number | string; }
interface HasPosition extends HasId { x: number; y: number; }
interface HasHitPoints extends HasId { hitPoints?: number; maxHitPoints?: number; }
interface HasKind { kind: number; }
interface MobLike extends HasId, HasKind { hatelist?: Array<{ id: number }>; }
interface ItemLike extends HasId, HasKind { properties?: ItemProperties | null; }

export const Messages = {
  Spawn: class {
    constructor(private entity: HasState) {
    }

    serialize(): unknown[] {
      return [Types.Messages.SPAWN, ...(this.entity.getState() as unknown[])];
    }
  },
  Despawn: class {
    constructor(private entityId: number) {
    }

    serialize(): unknown[] {
      return [Types.Messages.DESPAWN, this.entityId];
    }
  },
  Move: class {
    constructor(private entity: HasPosition) {
    }

    serialize(): unknown[] {
      return [Types.Messages.MOVE,
        this.entity.id,
        this.entity.x,
        this.entity.y];
    }
  },
  LootMove: class {
    constructor(private entity: HasId, private item: HasId) {
    }

    serialize(): unknown[] {
      return [Types.Messages.LOOTMOVE,
        this.entity.id,
        this.item.id];
    }
  },
  Attack: class {
    constructor(private attackerId: number, private targetId: number | null) {
    }

    serialize(): unknown[] {
      return [Types.Messages.ATTACK,
        this.attackerId,
        this.targetId];
    }
  },
  Health: class {
    constructor(private points: number, private isRegen: boolean = false) {
    }

    serialize(): unknown[] {
      const health: unknown[] = [Types.Messages.HEALTH,
        this.points];

      if (this.isRegen) {
        health.push(1);
      }
      return health;
    }
  },
  HitPoints: class {
    constructor(private maxHitPoints: number) {
    }

    serialize(): unknown[] {
      return [Types.Messages.HP, this.maxHitPoints];
    }
  },
  EquipItem: class {
    playerId: number | string;
    constructor(private player: HasId, private itemKind: number) {
      this.playerId = player.id;
    }

    serialize(): unknown[] {
      return [Types.Messages.EQUIP,
        this.playerId,
        this.itemKind];
    }
  },
  Drop: class {
    constructor(private mob: MobLike, private item: ItemLike) {
    }

    serialize(): unknown[] {
      // Include item properties if available
      const properties = this.item.properties
        ? serializeProperties(this.item.properties)
        : null;

      const drop: unknown[] = [Types.Messages.DROP,
        this.mob.id,
        this.item.id,
        this.item.kind,
        properties,
        _.map(this.mob.hatelist, 'id')];

      return drop;
    }
  },
  Chat: class {
    playerId: number | string;

    constructor(player: HasId, private message: string) {
      this.playerId = player.id;
    }

    serialize(): unknown[] {
      return [Types.Messages.CHAT,
        this.playerId,
        this.message];
    }
  },
  Teleport: class {
    constructor(private entity: HasPosition) {
    }

    serialize(): unknown[] {
      return [Types.Messages.TELEPORT,
        this.entity.id,
        this.entity.x,
        this.entity.y];
    }
  },

  Damage: class {
    constructor(private entity: HasHitPoints, private points: number) {
    }

    serialize(): unknown[] {
      // Include mob HP for health bar display
      return [Types.Messages.DAMAGE,
        this.entity.id,
        this.points,
        this.entity.hitPoints || 0,
        this.entity.maxHitPoints || 0];
    }
  },

  Population: class {
    constructor(private world: number, private total?: number) {
    }

    serialize(): unknown[] {
      // Hacked this
      // Made total prop optional
      // Added condition to fallbac to world count
      return [Types.Messages.POPULATION,
        this.world,
        this.total || this.world];
    }
  },

  Kill: class {
    constructor(private mob: HasKind) {
    }

    serialize(): unknown[] {
      return [Types.Messages.KILL,
        this.mob.kind];
    }
  },

  List: class {
    constructor(private ids: number[]) {
    }

    serialize(): unknown[] {
      const list: unknown[] = [...this.ids];

      list.unshift(Types.Messages.LIST);
      return list;
    }
  },

  Destroy: class {
    constructor(private entity: HasId) {
    }

    serialize(): unknown[] {
      return [Types.Messages.DESTROY,
        this.entity.id];
    }
  },

  Blink: class {
    constructor(private item: HasId) {
    }

    serialize(): unknown[] {
      return [Types.Messages.BLINK,
        this.item.id];
    }
  },

  // Venice AI Messages
  NpcTalkResponse: class {
    constructor(private npcKind: number, private response: string, private audioUrl: string | null = null) {
    }

    serialize() {
      return [Types.Messages.NPCTALK_RESPONSE,
        this.npcKind,
        this.response,
        this.audioUrl || ''];
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
    constructor(private text: string, private style?: string, private audioUrl?: string) {
      // style: 'epic' | 'humor' | 'ominous' | 'info'
    }

    serialize() {
      return [Types.Messages.NARRATOR,
        this.text,
        this.style || 'epic',
        this.audioUrl || ''];
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
  },

  // Boss Leaderboard - send leaderboard to player
  LeaderboardResponse: class {
    constructor(
      private entries: Array<{ rank: number; name: string; kills: number }>
    ) {}

    serialize() {
      return [Types.Messages.LEADERBOARD_RESPONSE, this.entries];
    }
  },

  // Boss Kill - broadcast when a boss is killed
  BossKill: class {
    constructor(
      private bossName: string,
      private killerName: string
    ) {}

    serialize() {
      return [Types.Messages.BOSS_KILL, this.bossName, this.killerName];
    }
  },

  // Kill Streak - broadcast when player reaches a streak tier
  KillStreak: class {
    constructor(
      private playerId: number,
      private playerName: string,
      private streakCount: number,
      private tierTitle: string,
      private announcement: string
    ) {}

    serialize() {
      return [Types.Messages.KILL_STREAK,
        this.playerId,
        this.playerName,
        this.streakCount,
        this.tierTitle,
        this.announcement];
    }
  },

  // Kill Streak Ended - broadcast when a player's streak ends
  KillStreakEnded: class {
    constructor(
      private playerId: number,
      private playerName: string,
      private streakCount: number,
      private endedByName: string | null
    ) {}

    serialize() {
      return [Types.Messages.KILL_STREAK_ENDED,
        this.playerId,
        this.playerName,
        this.streakCount,
        this.endedByName || ''];
    }
  },

  // Nemesis system messages
  NemesisPowerUp: class {
    constructor(
      private mobId: number,
      private originalName: string,
      private nemesisName: string,
      private title: string,
      private powerLevel: number,
      private kills: number,
      private victimName: string
    ) {}

    serialize() {
      return [Types.Messages.NEMESIS_POWER_UP,
        this.mobId,
        this.originalName,
        this.nemesisName,
        this.title,
        this.powerLevel,
        this.kills,
        this.victimName];
    }
  },

  NemesisKilled: class {
    constructor(
      private mobId: number,
      private nemesisName: string,
      private title: string,
      private kills: number,
      private killerName: string,
      private isRevenge: boolean
    ) {}

    serialize() {
      return [Types.Messages.NEMESIS_KILLED,
        this.mobId,
        this.nemesisName,
        this.title,
        this.kills,
        this.killerName,
        this.isRevenge ? 1 : 0];
    }
  }
};



