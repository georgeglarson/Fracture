import {Messages} from './message';
import {Types} from '../../shared/ts/gametypes';
import {Chest} from './chest';
import {Item} from './item';
import {Properties} from './properties';
import {Mob} from './mob';
import {Utils, isMob} from './utils';
import {Map} from './map';
import {getVeniceService} from './ai/venice.service';
import {AIPlayerManager} from './ai/aiplayer';
import {MessageBroadcaster} from './messaging/message-broadcaster';
import {CombatSystem} from './combat/combat-system';
import {getCombatTracker, CombatTracker} from './combat/combat-tracker';
import {nemesisService} from './combat/nemesis.service';
import {EntityManager} from './entities/entity-manager';
import {SpatialManager, Group} from './world/spatial-manager';
import {SpawnManager} from './world/spawn-manager';
import {GameLoop} from './world/game-loop';
import {getZoneManager, ZoneManager} from './zones';
import {ZoneBossManager} from './roaming-boss';
import {getLegendariesForBoss} from '../../shared/ts/items/legendary-data';
import {Rarity} from '../../shared/ts/items/item-types';
import {IStorageService} from './storage/storage.interface';
import {getStorageService} from './storage/sqlite.service';
import {Server} from './ws';
import {Entity} from './entity';
import {Character} from './character';
import {MobArea} from './mobarea';
import {ChestArea} from './chestarea';
import {evaluateAggro} from './combat/aggro-policy';
import {getLeashDistance} from './combat/combat-constants';
import type {Player} from './player'; // Type-only import to avoid circular dep
import { createModuleLogger } from './utils/logger.js';
import { trace } from '@opentelemetry/api';

const log = createModuleLogger('World');

// Message type for push methods - can be an object with serialize() or a raw array
type MessagePayload = { serialize(): unknown[] } | unknown[];

export class World {

  id: string | number;
  maxPlayers: number;
  server: Server;
  ups = 50;

  map: Map | null = null;

  // Entity manager (initialized in run() after map is ready)
  entityManager: EntityManager | null = null;

  // Accessors for backward compatibility - delegate to entityManager
  get entities() { return this.entityManager?.entities ?? {}; }
  get players() { return this.entityManager?.players ?? {}; }
  get mobs() { return this.entityManager?.mobs ?? {}; }
  get items() { return this.entityManager?.items ?? {}; }
  get npcs() { return this.entityManager?.npcs ?? {}; }
  get itemCount() { return this.entityManager?.itemCount ?? 0; }

  attackers: Record<number | string, Character> = {};
  equipping: Record<number | string, Player> = {};

  // Zone manager for zone-based loot and notifications
  zoneManager: ZoneManager;
  hurt: Record<number | string, Character> = {};

  // Spatial manager (initialized in run() after map is ready)
  spatialManager: SpatialManager | null = null;

  // Spawn manager (initialized in run() after map is ready)
  spawnManager: SpawnManager | null = null;

  // Game loop (initialized in run() after map is ready)
  gameLoop: GameLoop | null = null;

  // Accessors for backward compatibility - delegate to spatialManager
  get groups() { return this.spatialManager?.groups ?? {}; }
  get zoneGroupsReady() { return this.spatialManager?.zoneGroupsReady ?? false; }

  // Accessors for backward compatibility - delegate to spawnManager
  get mobAreas() { return this.spawnManager?.mobAreas ?? []; }
  get chestAreas() { return this.spawnManager?.chestAreas ?? []; }

  // Message broadcaster (initialized in run() after map is ready)
  broadcaster: MessageBroadcaster | null = null;

  // Combat system (initialized in run() after map is ready)
  combatSystem: CombatSystem | null = null;

  playerCount = 0;

  removedCallback: (() => void) | null = null;
  addedCallback: (() => void) | null = null;
  regenCallback: (() => void) | null = null;
  thoughtCallback: (() => void) | null = null;
  aggroCallback: (() => void) | null = null;
  init_callback: (() => void) | null = null;
  connectCallback: ((player: Player) => void) | null = null;
  enterCallback: ((player: Player) => void) | null = null;
  attack_callback: ((attacker: Character) => void) | null = null;

  // AI Players (Westworld feature)
  aiPlayerManager: AIPlayerManager | null = null;

  // Zone Boss Manager (Thunderdome feature)
  roamingBossManager: ZoneBossManager | null = null;

  // Startup timeouts (stored for cleanup)
  private startupTimers: ReturnType<typeof setTimeout>[] = [];

  // Periodic save interval (60-second auto-save for all connected players)
  private periodicSaveInterval: ReturnType<typeof setInterval> | null = null;

  // Storage service for player persistence
  private storageService: IStorageService | null = null;

  constructor(id: string | number, maxPlayers: number, websocketServer: Server) {
    this.id = id;
    this.maxPlayers = maxPlayers;
    this.server = websocketServer;
    this.zoneManager = getZoneManager();


    this.onPlayerConnect((player: Player) => {
      player.onRequestPosition(() => {
        if (player.lastCheckpoint) {
          return player.lastCheckpoint.getRandomPosition();
        } else {
          return this.map?.getRandomStartingPosition() ?? { x: 0, y: 0 };
        }
      });
    });

    this.onPlayerEnter((player: Player) => {
      log.info({ playerName: player.name, worldId: this.id }, 'Player joined world');

      if (!player.hasEnteredGame) {
        this.incrementPlayerCount();
      }

      // Record world event for Town Crier
      const venice = getVeniceService();
      if (venice) {
        venice.recordWorldEvent('join', player.name, {});
      }

      // Number of players in this world
      this.pushToPlayer(player, new Messages.Population(this.playerCount));
      this.pushRelevantEntityListTo(player);

      const move_callback = (x: number, y: number) => {
        log.trace({ playerName: player.name, x, y }, 'Player moving');

        player.forEachAttacker((attacker) => {
          // Use type guard to ensure attacker is a Mob before using Mob-specific methods
          if (!isMob(attacker)) return;
          const mob = attacker as Mob;
          if (!mob.target) return;
          const target = this.getEntityById(mob.target);
          if (target) {
            const pos = this.findPositionNextTo(mob, target);
            // Leash: mob gives up if next position is too far from spawn
            const leashDist = getLeashDistance(mob.aggroRange);
            if (mob.distanceToSpawningPoint(pos.x, pos.y) > leashDist) {
              mob.clearTarget();
              mob.forgetEveryone();
              player.removeAttacker(mob);
              // Return to spawn and broadcast MOVE so client removes exclamation
              mob.resetPosition();
              this.onMobMoveCallback(mob);
            } else {
              mob.move(pos.x, pos.y);
            }
          } else {
            // Target disappeared (disconnect, death, etc.) — clean up aggro links
            mob.clearTarget();
            mob.forgetEveryone();
            player.removeAttacker(mob);
            // Return to spawn and broadcast MOVE so client removes exclamation
            mob.resetPosition();
            this.onMobMoveCallback(mob);
          }
        });
      };

      player.onMove(move_callback);
      player.onLootMove(move_callback);

      player.onZone(() => {
        const hasChangedGroups = this.handleEntityGroupMembership(player);

        if (hasChangedGroups) {
          this.pushToPreviousGroups(player, new Messages.Destroy(player));
          this.pushRelevantEntityListTo(player);
        }
      });

      player.onBroadcast((message, ignoreSelf: boolean) => {
        this.pushToAdjacentGroups(player.group!, message, ignoreSelf ? player.id : null);
      });

      player.onBroadcastToZone((message, ignoreSelf: boolean) => {
        this.pushToGroup(player.group!, message, ignoreSelf ? player.id : null);
      });

      player.onExit(() => {
        log.info({ playerName: player.name }, 'Player left the game');

        // Save player data to database before removing
        if (this.storageService && player.characterId) {
          try {
            player.saveToStorage(this.storageService);
            log.info({ playerName: player.name, characterId: player.characterId }, 'Saved player on exit');
          } catch (e) {
            log.error({ err: e, playerName: player.name }, 'Failed to save player on exit');
          }
        }

        this.removePlayer(player);
        this.decrementPlayerCount();

        if (this.removedCallback) {
          this.removedCallback();
        }
      });

      if (this.addedCallback) {
        this.addedCallback();
      }
    });

    // Called when an entity is attacked by another entity
    this.onEntityAttack((attacker: Character) => {
      if (!attacker.target) return;
      const target = this.getEntityById(attacker.target);
      if (target && attacker.type === 'mob') {
        const pos = this.findPositionNextTo(attacker, target);
        (attacker as Mob).move(pos.x, pos.y);
      }
    });

    this.onRegenTick(() => {
      this.forEachCharacter((character: Character) => {
        if (!character.hasFullHealth()) {
          character.regenHealthBy(Math.floor(character.maxHitPoints / 25));

          if (character.type === 'player') {
            this.pushToPlayer(character as Player, character.regen());
          }
        }
      });
    });

    // AI Thought Bubbles - The "Ant Farm" Feature
    this.onThoughtTick(() => {
      log.trace('Thoughts tick fired');
      const venice = getVeniceService();
      if (!venice) {
        log.trace('Thoughts tick: no venice service');
        return;
      }

      let groupsWithPlayers = 0;
      let totalEntities = 0;

      // For each group with players, generate thoughts for nearby mobs/npcs
      Object.entries(this.groups).forEach(([groupId, group]: [string, Group]) => {
        if (!group.players || group.players.length === 0) return;
        groupsWithPlayers++;

        // Get all mobs and NPCs in this group
        // group.entities is an object: { entityId: entity }
        const entities: Entity[] = [];
        Object.entries(group.entities).forEach(([entityId, entity]: [string, Entity]) => {
          if (entity && (entity.type === 'mob' || entity.type === 'npc')) {
            entities.push(entity);
          }
        });
        totalEntities += entities.length;

        // Only process a random subset to avoid spam (max 3 per group per tick)
        const shuffled = [...entities].sort(() => Math.random() - 0.5);
        const toProcess = shuffled.slice(0, Math.min(3, entities.length));

        toProcess.forEach((entity: Entity) => {
          // Determine state
          let state: 'idle' | 'combat' | 'playerNearby' = 'idle';
          const charEntity = entity as Character;
          if (charEntity.target) {
            state = 'combat';
          } else if (group.players && group.players.length > 0) {
            state = 'playerNearby';
          }

          // Get entity type name
          const typeName = Types.getKindAsString(entity.kind);
          if (!typeName) return;

          // Generate thought
          const thoughtResult = venice.getEntityThought(typeName, state);
          log.debug({ entityType: typeName, entityId: entity.id, thought: thoughtResult.thought }, 'Entity thought');

          // Broadcast to all players in adjacent groups
          // Use groupId (the key) not group.id (which doesn't exist)
          const message = new Messages.EntityThought(
            entity.id,
            thoughtResult.thought,
            thoughtResult.state
          );
          this.pushToAdjacentGroups(groupId, message);
        });
      });

      log.debug({ groupsWithPlayers, totalEntities }, 'Thoughts tick processed');
    });

    // Mob Proximity Aggro — zone-aware aggro with density capping
    // Uses AggroPolicy for per-mob decisions based on zone, level, and density.
    // Also enforces leash: mobs drop aggro when target is too far from spawn.
    this.onAggroTick(() => {
      const combatTracker = getCombatTracker();
      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        activeSpan.setAttribute('mob_count', Object.keys(this.entityManager?.mobs ?? {}).length);
      }

      this.forEachMob((mob: Mob) => {
        if (mob.isDead || !mob.aggroRange || mob.aggroRange <= 0) return;

        // Skip stunned mobs (War Cry effect)
        if (mob.isStunned()) return;

        const leashDistance = getLeashDistance(mob.aggroRange);

        // Leash check: if mob already has a target, verify it's still in chase range
        if (mob.hasTarget()) {
          const target = this.getEntityById(mob.target!);
          if (!target || (target as Character).isDead) {
            // Remove mob from target's attacker list before clearing
            if (target) (target as Character).removeAttacker(mob);
            mob.clearTarget();
            mob.forgetEveryone();
            return;
          }
          // Leash based on mob's own position (consistent with move_callback leash)
          const mobDist = mob.distanceToSpawningPoint(mob.x, mob.y);
          if (mobDist > leashDistance) {
            // Remove mob from target's attacker list before leashing
            (target as Character).removeAttacker(mob);
            mob.clearTarget();
            mob.forgetEveryone();
            // Return to spawn and broadcast MOVE so client removes exclamation
            mob.resetPosition();
            this.onMobMoveCallback(mob);
            return;
          }
          // Re-broadcast attack every aggro tick — keeps client combat state synchronized
          // during chase (mob already has valid target; leash/dead checks above handle invalid states)
          if (mob.group) {
            this.pushToAdjacentGroups(mob.group, mob.attack());
          }
          return;
        }

        // No target — scan for nearby players using spatial query + AggroPolicy
        // Only check players in mob's group + adjacent groups (O(M*Padj) vs O(M*P))
        let closestPlayer: Player | null = null;
        let closestDistance = mob.aggroRange; // tiles
        let closestDecision: { hateModifier: number } | null = null;

        const nearbyPlayers = mob.group ? this.getPlayersNearGroup(mob.group) : [];
        for (const player of nearbyPlayers) {
          if (!player || player.isDead) continue;

          // Spawn protection (first 10 seconds after entering)
          if (player.spawnProtectionUntil && Date.now() < player.spawnProtectionUntil) continue;

          // Phase Shift invisibility
          if (player.isPhased && player.isPhased()) continue;

          const distance = Utils.distanceTo(mob.x, mob.y, player.x, player.y);

          // AggroPolicy evaluates zone, transition, level, and density
          const decision = evaluateAggro({
            mobX: mob.x,
            mobY: mob.y,
            mobSpawnX: mob.spawningX,
            mobSpawnY: mob.spawningY,
            mobLevel: mob.level,
            mobAggroRange: mob.aggroRange,
            mobZoneId: mob.zoneId,
            playerX: player.x,
            playerY: player.y,
            playerLevel: player.level ?? 1,
            distance,
            currentAggroOnPlayer: combatTracker.getPlayerAggroCount(player.id),
          });

          if (decision.shouldAggro && distance < closestDistance) {
            closestDistance = distance;
            closestPlayer = player;
            closestDecision = decision;
          }
        }

        if (closestPlayer && closestDecision) {
          const hateBase = Math.max(1, Math.floor((mob.aggroRange - closestDistance) * 10));
          const hatePoints = Math.max(1, Math.round(hateBase * closestDecision.hateModifier));
          this.handleMobHate(mob.id, closestPlayer.id, hatePoints);

          const mobName = Types.getKindAsString(mob.kind);
          log.trace({ mobName, aggroRange: mob.aggroRange, zoneId: mob.zoneId, targetPlayer: closestPlayer.name, distance: +closestDistance.toFixed(1) }, 'Mob aggro targeting');
        }
      });
    });
  }

  run(mapFilePath: string) {
    this.map = new Map(mapFilePath);

    this.map.ready(() => {
      const map = this.map!; // We know map exists inside ready()

      // Initialize spatial manager for zone groups
      this.spatialManager = new SpatialManager();
      this.spatialManager.setMap(map);
      this.spatialManager.initZoneGroups();

      // Initialize entity manager
      this.entityManager = new EntityManager();
      this.entityManager.setGroupContext({
        handleEntityGroupMembership: (entity: Entity) => this.handleEntityGroupMembership(entity),
        removeFromGroups: (entity: Entity) => this.removeFromGroups(entity)
      });

      // Initialize message broadcaster now that groups exist
      this.broadcaster = new MessageBroadcaster(
        this.server,
        this.groups,
        map,
        { getEntityById: (id: number) => this.getEntityById(id) }
      );

      // Wire spatial manager to broadcaster
      this.spatialManager.setBroadcaster({
        pushToGroup: (groupId: string, message: { serialize(): unknown[] }, ignoredPlayerId?: string | number) => this.pushToGroup(groupId, message, ignoredPlayerId)
      });

      // Initialize combat system
      this.combatSystem = new CombatSystem({
        getEntityById: (id) => this.getEntityById(id as number),
        pushToPlayer: (player, message) => this.pushToPlayer(player as unknown as Player, message),
        pushToAdjacentGroups: (groupId, message, ignoredPlayer) => this.pushToAdjacentGroups(groupId, message, ignoredPlayer),
        pushBroadcast: (message) => this.pushBroadcast(message),
        getDroppedItem: (mob) => this.getDroppedItem(mob as unknown as Mob) as unknown as { id: string | number; type: string; kind: number; hitPoints: number; } | null,
        handleItemDespawn: (item) => this.handleItemDespawn(item as unknown as Item),
        removeEntity: (entity) => this.removeEntity(entity as unknown as Entity),
        handleEntityGroupMembership: (entity) => this.handleEntityGroupMembership(entity as unknown as Entity)
      });

      // Wire entity manager dependencies
      this.entityManager.setBroadcaster(this.broadcaster);
      this.entityManager.setCombatSystem(this.combatSystem);

      // Initialize CombatTracker with entity lookup
      const combatTracker = getCombatTracker();
      combatTracker.setEntityLookup((id: number) => this.getEntityById(id));

      // Initialize nemesis service context
      nemesisService.setContext({
        pushBroadcast: (message: { serialize(): unknown[] }) => this.pushBroadcast(message),
        getMobName: (kind: number) => Types.getKindAsString(kind),
        getMob: (mobId: number) => this.entityManager?.mobs[mobId],
        getPlayer: (playerId: number) => this.entityManager?.players[playerId],
      });

      map.generateCollisionGrid();

      // Initialize spawn manager
      this.spawnManager = new SpawnManager();
      this.spawnManager.setMap(map);
      this.spawnManager.setEntityManager({
        addNpc: (kind: number, x: number, y: number) => this.addNpc(kind, x, y),
        addMob: (mob: Mob) => this.addMob(mob),
        addItem: (item: Item) => this.addItem(item),
        addStaticItem: (item: Item) => this.addStaticItem(item),
        addItemFromChest: (kind: number, x: number, y: number) => this.addItemFromChest(kind, x, y),
        createItem: (kind: number, x: number, y: number) => this.createItem(kind, x, y),
        createChest: (x: number, y: number, items: number[]) => this.createChest(x, y, items),
        removeEntity: (entity: Entity) => this.removeEntity(entity)
      });
      this.spawnManager.setBroadcaster({
        pushToAdjacentGroups: (groupId: string, message: { serialize(): unknown[] }) => this.pushToAdjacentGroups(groupId, message)
      });
      this.spawnManager.setWorldContext(this);

      // Initialize all spawn areas and entities
      this.spawnManager.initializeAreas();

      // Initialize game loop
      this.gameLoop = new GameLoop(this.ups);
      this.gameLoop.setSpatialContext({
        processGroups: () => this.processGroups()
      });
      this.gameLoop.setBroadcasterContext({
        processQueues: () => this.processQueues()
      });
      this.gameLoop.onRegen(() => {
        if (this.regenCallback) {
          this.regenCallback();
        }
      });
      this.gameLoop.onThought(() => {
        if (this.thoughtCallback) {
          this.thoughtCallback();
        }
      });
      this.gameLoop.onAggro(() => {
        if (this.aggroCallback) {
          this.aggroCallback();
        }
      });
      this.gameLoop.start();

      // Periodic save: every 60 seconds, save all connected players
      // Fixes level persistence bug: saves were only happening on disconnect
      this.periodicSaveInterval = setInterval(() => {
        const storage = this.getStorageService();
        let savedCount = 0;
        let failCount = 0;

        this.forEachPlayer((player: Player) => {
          if (player.characterId) {
            try {
              player.saveToStorage(storage);
              savedCount++;
            } catch (e) {
              failCount++;
              log.error({ err: e, playerName: player.name, characterId: player.characterId }, 'Periodic save failed for player');
            }
          }
        });

        if (savedCount > 0 || failCount > 0) {
          log.info({ event: 'periodic_save', playerCount: savedCount, failures: failCount }, 'Periodic save completed');
        }
      }, 60_000);
    });

    log.info({ worldId: this.id, capacity: this.maxPlayers }, 'World created');

    // Start AI Players (Westworld feature) - after a delay to let the world settle
    this.startupTimers.push(setTimeout(() => {
      this.aiPlayerManager = new AIPlayerManager(this, 5); // 5 AI players
      this.aiPlayerManager.start();
    }, 3000));

    // Start Roaming Bosses (Thunderdome feature) - after world is settled
    this.startupTimers.push(setTimeout(() => {
      this.roamingBossManager = new ZoneBossManager(this);
      this.roamingBossManager.init();
    }, 5000));
  }

  setUpdatesPerSecond(ups: number) {
    this.ups = ups;
  }

  /**
   * Get the storage service for player persistence
   */
  getStorageService(): IStorageService {
    if (!this.storageService) {
      this.storageService = getStorageService();
    }
    return this.storageService;
  }

  onInit(callback: () => void) {
    this.init_callback = callback;
  }

  onPlayerConnect(callback: (player: Player) => void) {
    this.connectCallback = callback;
  }

  onPlayerEnter(callback: (player: Player) => void) {
    this.enterCallback = callback;
  }

  onPlayerAdded(callback: () => void) {
    this.addedCallback = callback;
  }

  onPlayerRemoved(callback: () => void) {
    this.removedCallback = callback;
  }

  onRegenTick(callback: () => void) {
    this.regenCallback = callback;
  }

  onThoughtTick(callback: () => void) {
    this.thoughtCallback = callback;
  }

  onAggroTick(callback: () => void) {
    this.aggroCallback = callback;
  }

  pushRelevantEntityListTo(player: Player) {
    if (player && (player.group! in this.groups)) {
      const entities = Object.keys(this.groups[player.group!].entities)
        .filter(id => id !== String(player.id))
        .map(id => parseInt(id));
      if (entities.length > 0) {
        this.pushToPlayer(player, new Messages.List(entities));
      }
    }
  }

  pushSpawnsToPlayer(player: Player, ids: number[]) {
    // Sort IDs so players (including AIPlayers with id >= 100000) are sent first
    // This ensures mobs' targets are known before the mobs spawn
    const sortedIds = [...ids].sort((a, b) => {
      const aIsPlayer = a >= 100000 || Types.isPlayer(this.getEntityById(a)?.kind ?? 0);
      const bIsPlayer = b >= 100000 || Types.isPlayer(this.getEntityById(b)?.kind ?? 0);
      if (aIsPlayer && !bIsPlayer) return -1;
      if (!aIsPlayer && bIsPlayer) return 1;
      return 0;
    });

    sortedIds.forEach((id: number) => {
      const entity = this.getEntityById(id);
      if (entity) {
        this.pushToPlayer(player, new Messages.Spawn(entity));
      }
    });

    log.trace({ count: sortedIds.length, playerId: player.id }, 'Pushed spawns to player');
  }

  pushToPlayer(player: Player, message: { serialize(): unknown[] }) {
    this.broadcaster?.pushToPlayer(player, message);
  }

  pushToGroup(groupId: string, message: MessagePayload, ignoredPlayer?: string | number) {
    this.broadcaster?.pushToGroup(groupId, message as { serialize(): unknown[] }, ignoredPlayer);
  }

  pushToAdjacentGroups(groupId: string, message: MessagePayload, ignoredPlayer?: string | number | null) {
    this.broadcaster?.pushToAdjacentGroups(groupId, message as { serialize(): unknown[] }, ignoredPlayer ?? undefined);
  }

  pushToPreviousGroups(player: Player, message: MessagePayload) {
    this.broadcaster?.pushToPreviousGroups(player, message as { serialize(): unknown[] });
  }

  pushBroadcast(message: { serialize(): unknown[] }, ignoredPlayer?: string | number) {
    this.broadcaster?.pushBroadcast(message, ignoredPlayer);
  }

  processQueues() {
    this.broadcaster?.processQueues();
  }

  addEntity(entity: Entity) {
    this.entityManager?.addEntity(entity);
  }

  removeEntity(entity: Entity) {
    this.entityManager?.removeEntity(entity);
  }

  addPlayer(player: Player) {
    this.entityManager?.addPlayer(player);
  }

  removePlayer(player: Player) {
    this.entityManager?.removePlayer(player);
  }

  addMob(mob: Mob) {
    this.entityManager?.addMob(mob);
  }

  addNpc(kind: number, x: number, y: number) {
    return this.entityManager?.addNpc(kind, x, y);
  }

  addItem(item: Item) {
    return this.entityManager?.addItem(item);
  }

  createItem(kind: number, x: number, y: number) {
    return this.entityManager?.createItem(kind, x, y);
  }

  createItemWithProperties(kind: number, x: number, y: number, existingProperties?: unknown) {
    return this.entityManager?.createItemWithProperties(kind, x, y, existingProperties);
  }

  createChest(x: number, y: number, items: number[]) {
    return this.entityManager?.createChest(x, y, items);
  }

  addStaticItem(item: Item) {
    return this.entityManager?.addStaticItem(item);
  }

  addItemFromChest(kind: number, x: number, y: number) {
    return this.entityManager?.addItemFromChest(kind, x, y);
  }

  /**
   * The mob will no longer be registered as an attacker of its current target.
   */
  clearMobAggroLink(mob: Mob) {
    this.combatSystem?.clearMobAggroLink(mob);
  }

  clearMobHateLinks(mob: Mob) {
    this.combatSystem?.clearMobHateLinks(mob);
  }

  forEachEntity(callback: (entity: Entity) => void) {
    this.entityManager?.forEachEntity(callback);
  }

  forEachPlayer(callback: (player: Player) => void) {
    this.entityManager?.forEachPlayer(callback);
  }

  forEachMob(callback: (mob: Mob) => void) {
    this.entityManager?.forEachMob(callback);
  }

  forEachCharacter(callback: (character: Character) => void) {
    this.entityManager?.forEachCharacter(callback);
  }

  handleMobHate(mobId: number, playerId: number, hatePoints: number) {
    this.combatSystem?.handleMobHate(mobId, playerId, hatePoints);
  }

  chooseMobTarget(mob: Mob, hateRank?: number) {
    this.combatSystem?.chooseMobTarget(mob, hateRank);
  }

  onEntityAttack(callback: (character: Character) => void) {
    this.attack_callback = callback;
    // Cast to combat-system's expected Entity type
    this.combatSystem?.onEntityAttack(callback as (character: { id: string | number; type: string; kind: number; }) => void);
  }

  getEntityById(id: number) {
    return this.entityManager?.getEntityById(id);
  }

  getPlayerCount() {
    return this.entityManager?.getPlayerCount() ?? 0;
  }

  broadcastAttacker(character: Character) {
    this.combatSystem?.broadcastAttacker(character);
  }

  handleHurtEntity(entity: Character, attacker?: Character, damage?: number) {
    this.combatSystem?.handleHurtEntity(entity, attacker, damage);
  }

  despawn(entity: Entity) {
    if (entity.group) {
      this.pushToAdjacentGroups(entity.group, entity.despawn());
    }

    if (entity.id in this.entities) {
      this.removeEntity(entity);
    }
  }

  // spawnStaticEntities() moved to SpawnManager

  isValidPosition(x: number, y: number) {
    if (this.map && typeof x === 'number' && typeof y === 'number' && !this.map.isOutOfBounds(x, y) && !this.map.isColliding(x, y)) {
      return true;
    }
    return false;
  }

  handlePlayerVanish(player: Player) {
    this.combatSystem?.handlePlayerVanish(player);
  }

  setPlayerCount(count: number) {
    this.playerCount = count;
  }

  incrementPlayerCount() {
    this.setPlayerCount(this.playerCount + 1);
  }

  decrementPlayerCount() {
    if (this.playerCount > 0) {
      this.setPlayerCount(this.playerCount - 1);
    }
  }

  getDroppedItem(mob: Mob) {
    const kind = Types.getKindAsString(mob.kind) as string,
      baseDrops = ((Properties as unknown) as Record<string, { drops: Record<string, number> }>)[kind].drops,
      v = Utils.random(100);
    let p = 0,
      item: Item | null = null;

    // Get zone at mob position for loot bonuses
    const zone = this.zoneManager.getZoneAt(mob.x, mob.y);

    // Check for zone boss legendary drops
    if ('bossId' in mob && mob.bossId) {
      const bossId = mob.bossId as string;
      const legendaries = getLegendariesForBoss(bossId);

      for (const legendary of legendaries) {
        if (Math.random() < legendary.dropChance) {
          // Legendary dropped! Create with legendary rarity
          log.info({ legendaryName: legendary.name, legendaryId: legendary.id, bossId }, 'Legendary item dropped');
          const legendaryItem = this.createItemWithProperties(legendary.kind, mob.x, mob.y, zone);
          if (legendaryItem && legendaryItem.properties) {
            // Force legendary rarity and add legendary flags
            legendaryItem.properties.rarity = Rarity.LEGENDARY;
            legendaryItem.properties.isLegendary = true;
            legendaryItem.properties.legendaryId = legendary.id;
            item = this.addItem(legendaryItem);

            // Server-wide broadcast for legendary drop
            this.broadcastLegendaryDrop(legendary.name, bossId);
            return item;
          }
        }
      }
    }

    // Apply zone modifiers to drop table (increased armor/weapon chances)
    const drops = this.zoneManager.modifyDropTable(baseDrops, zone);

    for (const itemName in drops) {
      const percentage = drops[itemName];

      p += percentage;
      if (v <= p) {
        // Use createItemWithProperties to generate items with random stats
        // Pass zone for rarity bonus
        item = this.addItem(this.createItemWithProperties(Types.getKindFromString(itemName), mob.x, mob.y, zone));
        break;
      }
    }

    return item;
  }

  /**
   * Broadcast legendary drop to all players
   */
  private broadcastLegendaryDrop(itemName: string, bossId: string): void {
    const message = `A legendary ${itemName} has dropped from ${bossId.replace(/_/g, ' ')}!`;
    log.info({ message, bossId }, 'Legendary drop broadcast');
    // Use chat broadcast for now - could add a dedicated message type later
    this.pushBroadcast(new Messages.Chat({ id: 0, name: 'World' } as { id: number; name: string }, `[LEGENDARY] ${message}`));
  }

  onMobMoveCallback(mob: Mob) {
    this.pushToAdjacentGroups(mob.group!, new Messages.Move(mob));
    this.handleEntityGroupMembership(mob);
  }

  findPositionNextTo(entity: Entity, target: Entity) {
    let valid = false;
    let pos: { x: number; y: number };

    while (!valid) {
      pos = entity.getPositionNextTo(target)!;
      valid = this.isValidPosition(pos.x, pos.y);
    }
    return pos!;
  }

  // Spatial group methods - delegate to SpatialManager

  removeFromGroups(entity: Entity) {
    return this.spatialManager?.removeFromGroups(entity) ?? [];
  }

  addAsIncomingToGroup(entity: Entity, groupId: string) {
    this.spatialManager?.addAsIncomingToGroup(entity, groupId);
  }

  addToGroup(entity: Entity, groupId: string) {
    return this.spatialManager?.addToGroup(entity, groupId) ?? [];
  }

  logGroupPlayers(groupId: string) {
    this.spatialManager?.logGroupPlayers(groupId);
  }

  handleEntityGroupMembership(entity: Entity) {
    return this.spatialManager?.handleEntityGroupMembership(entity) ?? false;
  }

  processGroups() {
    this.spatialManager?.processGroups();
  }

  getPlayersNearGroup(groupId: string) {
    return this.spatialManager?.getPlayersNearGroup(groupId) ?? [];
  }

  moveEntity(entity: Entity, x: number, y: number) {
    if (entity) {
      entity.setPosition(x, y);
      this.handleEntityGroupMembership(entity);
    }
  }

  // Spawn methods - delegate to SpawnManager

  handleItemDespawn(item: Item) {
    this.spawnManager?.handleItemDespawn(item);
  }

  handleEmptyMobArea(area: MobArea) {
    this.spawnManager?.handleEmptyMobArea(area);
  }

  handleEmptyChestArea(area: ChestArea) {
    this.spawnManager?.handleEmptyChestArea(area);
  }

  handleChestDespawn(chest: Chest) {
    this.spawnManager?.handleChestDespawn(chest);
  }

  handleOpenedChest(chest: Chest, player: Player) {
    this.spawnManager?.handleOpenedChest(chest, player);
  }

  tryAddingMobToChestArea(mob: Mob) {
    this.spawnManager?.tryAddingMobToChestArea(mob);
  }

  updatePopulation(totalPlayers?: number) {
    this.pushBroadcast(new Messages.Population(this.playerCount, totalPlayers ? totalPlayers : this.playerCount));
  }

  /**
   * Clean shutdown: stop timers, save all players, tear down subsystems
   */
  shutdown(): void {
    log.info({ worldId: this.id }, 'World shutting down');

    // Clear startup timers
    for (const timer of this.startupTimers) {
      clearTimeout(timer);
    }
    this.startupTimers = [];

    // Clear periodic save interval
    if (this.periodicSaveInterval) {
      clearInterval(this.periodicSaveInterval);
      this.periodicSaveInterval = null;
    }

    // Stop game loop
    this.gameLoop?.stop();

    // Stop AI players
    this.aiPlayerManager?.stop();

    // Save all connected players
    const storage = this.getStorageService();
    this.forEachPlayer((player: Player) => {
      if (player.characterId) {
        try {
          player.saveToStorage(storage);
        } catch (e) {
          log.error({ err: e, playerName: player.name }, 'Failed to save player during shutdown');
        }
      }
    });

    // Clear combat tracker
    CombatTracker.reset();

    log.info({ worldId: this.id }, 'World shutdown complete');
  }
}
