import * as _ from 'lodash';
import {Messages} from './message';
import {Types} from '../../shared/ts/gametypes';
import {Chest} from './chest';
import {Item} from './item';
import {Properties} from './properties';
import {Mob} from './mob';
import {Utils} from './utils';
import {Map} from './map';
import {getVeniceService} from './ai/venice.service';
import {AIPlayerManager} from './ai/aiplayer';
import {MessageBroadcaster} from './messaging/message-broadcaster';
import {CombatSystem} from './combat/combat-system';
import {EntityManager} from './entities/entity-manager';
import {SpatialManager} from './world/spatial-manager';
import {SpawnManager} from './world/spawn-manager';
import {GameLoop} from './world/game-loop';
import {getZoneManager, ZoneManager} from './zones';

export class World {

  id;
  maxPlayers;
  server;
  ups = 50;

  map = null;

  // Entity manager (initialized in run() after map is ready)
  entityManager: EntityManager | null = null;

  // Accessors for backward compatibility - delegate to entityManager
  get entities() { return this.entityManager?.entities ?? {}; }
  get players() { return this.entityManager?.players ?? {}; }
  get mobs() { return this.entityManager?.mobs ?? {}; }
  get items() { return this.entityManager?.items ?? {}; }
  get npcs() { return this.entityManager?.npcs ?? {}; }
  get itemCount() { return this.entityManager?.itemCount ?? 0; }

  attackers = {};
  equipping = {};

  // Zone manager for zone-based loot and notifications
  zoneManager: ZoneManager;
  hurt = {};

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

  removed_callback;
  added_callback;
  regen_callback;
  thought_callback;
  init_callback;
  connect_callback;
  enter_callback;
  attack_callback;

  // AI Players (Westworld feature)
  aiPlayerManager: AIPlayerManager | null = null;

  constructor(id, maxPlayers, websocketServer) {
    var self = this;

    this.id = id;
    this.maxPlayers = maxPlayers;
    this.server = websocketServer;
    this.zoneManager = getZoneManager();


    this.onPlayerConnect(function (player) {
      player.onRequestPosition(function () {
        if (player.lastCheckpoint) {
          return player.lastCheckpoint.getRandomPosition();
        } else {
          return self.map.getRandomStartingPosition();
        }
      });
    });

    this.onPlayerEnter(function (player) {
      console.info(player.name + ' has joined ' + self.id);

      if (!player.hasEnteredGame) {
        self.incrementPlayerCount();
      }

      // Record world event for Town Crier
      const venice = getVeniceService();
      if (venice) {
        venice.recordWorldEvent('join', player.name, {});
      }

      // Number of players in this world
      self.pushToPlayer(player, new Messages.Population(self.playerCount));
      self.pushRelevantEntityListTo(player);

      const move_callback = function (x, y) {
        console.debug(player.name + ' is moving to (' + x + ', ' + y + ').');

        player.forEachAttacker(function (mob: Mob) {
          var target = self.getEntityById(mob.target);
          if (target) {
            var pos = self.findPositionNextTo(mob, target);
            if (mob.distanceToSpawningPoint(pos.x, pos.y) > 50) {
              mob.clearTarget();
              mob.forgetEveryone();
              player.removeAttacker(mob);
            } else {
              self.moveEntity(mob, pos.x, pos.y);
            }
          }
        });
      };

      player.onMove(move_callback);
      player.onLootMove(move_callback);

      player.onZone(function () {
        var hasChangedGroups = self.handleEntityGroupMembership(player);

        if (hasChangedGroups) {
          self.pushToPreviousGroups(player, new Messages.Destroy(player));
          self.pushRelevantEntityListTo(player);
        }
      });

      player.onBroadcast(function (message, ignoreSelf) {
        self.pushToAdjacentGroups(player.group, message, ignoreSelf ? player.id : null);
      });

      player.onBroadcastToZone(function (message, ignoreSelf) {
        self.pushToGroup(player.group, message, ignoreSelf ? player.id : null);
      });

      player.onExit(function () {
        console.info(player.name + ' has left the game.');
        self.removePlayer(player);
        self.decrementPlayerCount();

        if (self.removed_callback) {
          self.removed_callback();
        }
      });

      if (self.added_callback) {
        self.added_callback();
      }
    });

    // Called when an entity is attacked by another entity
    this.onEntityAttack(function (attacker) {
      var target = self.getEntityById(attacker.target);
      if (target && attacker.type === 'mob') {
        var pos = self.findPositionNextTo(attacker, target);
        self.moveEntity(attacker, pos.x, pos.y);
      }
    });

    this.onRegenTick(function () {
      self.forEachCharacter(function (character) {
        if (!character.hasFullHealth()) {
          character.regenHealthBy(Math.floor(character.maxHitPoints / 25));

          if (character.type === 'player') {
            self.pushToPlayer(character, character.regen());
          }
        }
      });
    });

    // AI Thought Bubbles - The "Ant Farm" Feature
    this.onThoughtTick(function () {
      console.log('[Thoughts] Tick fired');
      const venice = getVeniceService();
      if (!venice) {
        console.log('[Thoughts] No venice service');
        return;
      }

      let groupsWithPlayers = 0;
      let totalEntities = 0;

      // For each group with players, generate thoughts for nearby mobs/npcs
      _.each(self.groups, function (group: any, groupId: string) {
        if (!group.players || group.players.length === 0) return;
        groupsWithPlayers++;

        // Get all mobs and NPCs in this group
        // group.entities is an object: { entityId: entity }
        const entities: any[] = [];
        _.each(group.entities, function (entity: any, entityId: string) {
          if (entity && (entity.type === 'mob' || entity.type === 'npc')) {
            entities.push(entity);
          }
        });
        totalEntities += entities.length;

        // Only process a random subset to avoid spam (max 3 per group per tick)
        // lodash 3.x uses _.sample(collection, n) instead of _.sampleSize
        const toProcess = _.sample(entities, Math.min(3, entities.length)) as any[];

        _.each(toProcess, function (entity: any) {
          // Determine state
          let state: 'idle' | 'combat' | 'playerNearby' = 'idle';
          if (entity.target) {
            state = 'combat';
          } else if (group.players && group.players.length > 0) {
            state = 'playerNearby';
          }

          // Get entity type name
          const typeName = Types.getKindAsString(entity.kind);
          if (!typeName) return;

          // Generate thought
          const thoughtResult = venice.getEntityThought(typeName, state);
          console.log('[Thoughts]', typeName, '(id:', entity.id, '):', thoughtResult.thought);

          // Broadcast to all players in adjacent groups
          // Use groupId (the key) not group.id (which doesn't exist)
          const message = new Messages.EntityThought(
            entity.id,
            thoughtResult.thought,
            thoughtResult.state
          );
          self.pushToAdjacentGroups(groupId, message);
        });
      });

      console.log('[Thoughts] Processed', groupsWithPlayers, 'groups,', totalEntities, 'entities');
    });
  }

  run(mapFilePath) {
    var self = this;

    this.map = new Map(mapFilePath);

    this.map.ready(function () {
      // Initialize spatial manager for zone groups
      self.spatialManager = new SpatialManager();
      self.spatialManager.setMap(self.map);
      self.spatialManager.initZoneGroups();

      // Initialize entity manager
      self.entityManager = new EntityManager();
      self.entityManager.setGroupContext({
        handleEntityGroupMembership: (entity) => self.handleEntityGroupMembership(entity),
        removeFromGroups: (entity) => self.removeFromGroups(entity)
      });

      // Initialize message broadcaster now that groups exist
      self.broadcaster = new MessageBroadcaster(
        self.server,
        self.groups,
        self.map,
        { getEntityById: (id) => self.getEntityById(id) }
      );

      // Wire spatial manager to broadcaster
      self.spatialManager!.setBroadcaster({
        pushToGroup: (groupId, message, ignoredPlayer) => self.pushToGroup(groupId, message, ignoredPlayer)
      });

      // Initialize combat system
      self.combatSystem = new CombatSystem({
        getEntityById: (id) => self.getEntityById(id),
        pushToPlayer: (player, message) => self.pushToPlayer(player, message),
        pushToAdjacentGroups: (groupId, message, ignoredPlayer) => self.pushToAdjacentGroups(groupId, message, ignoredPlayer),
        getDroppedItem: (mob) => self.getDroppedItem(mob),
        handleItemDespawn: (item) => self.handleItemDespawn(item),
        removeEntity: (entity) => self.removeEntity(entity),
        handleEntityGroupMembership: (entity) => self.handleEntityGroupMembership(entity)
      });

      // Wire entity manager dependencies
      self.entityManager!.setBroadcaster(self.broadcaster!);
      self.entityManager!.setCombatSystem(self.combatSystem!);

      self.map.generateCollisionGrid();

      // Initialize spawn manager
      self.spawnManager = new SpawnManager();
      self.spawnManager.setMap(self.map);
      self.spawnManager.setEntityManager({
        addNpc: (kind, x, y) => self.addNpc(kind, x, y),
        addMob: (mob) => self.addMob(mob),
        addItem: (item) => self.addItem(item),
        addStaticItem: (item) => self.addStaticItem(item),
        addItemFromChest: (kind, x, y) => self.addItemFromChest(kind, x, y),
        createItem: (kind, x, y) => self.createItem(kind, x, y),
        createChest: (x, y, items) => self.createChest(x, y, items),
        removeEntity: (entity) => self.removeEntity(entity)
      });
      self.spawnManager.setBroadcaster({
        pushToAdjacentGroups: (groupId, message) => self.pushToAdjacentGroups(groupId, message)
      });
      self.spawnManager.setWorldContext(self);

      // Initialize all spawn areas and entities
      self.spawnManager.initializeAreas();

      // Initialize game loop
      self.gameLoop = new GameLoop(self.ups);
      self.gameLoop.setSpatialContext({
        processGroups: () => self.processGroups()
      });
      self.gameLoop.setBroadcasterContext({
        processQueues: () => self.processQueues()
      });
      self.gameLoop.onRegen(() => {
        if (self.regen_callback) {
          self.regen_callback();
        }
      });
      self.gameLoop.onThought(() => {
        if (self.thought_callback) {
          self.thought_callback();
        }
      });
      self.gameLoop.start();
    });

    console.info('' + this.id + ' created (capacity: ' + this.maxPlayers + ' players).');

    // Start AI Players (Westworld feature) - after a delay to let the world settle
    setTimeout(() => {
      this.aiPlayerManager = new AIPlayerManager(this, 5); // 5 AI players
      this.aiPlayerManager.start();
    }, 3000);
  }

  setUpdatesPerSecond(ups) {
    this.ups = ups;
  }

  onInit(callback) {
    this.init_callback = callback;
  }

  onPlayerConnect(callback) {
    this.connect_callback = callback;
  }

  onPlayerEnter(callback) {
    this.enter_callback = callback;
  }

  onPlayerAdded(callback) {
    this.added_callback = callback;
  }

  onPlayerRemoved(callback) {
    this.removed_callback = callback;
  }

  onRegenTick(callback) {
    this.regen_callback = callback;
  }

  onThoughtTick(callback) {
    this.thought_callback = callback;
  }

  pushRelevantEntityListTo(player) {
    var entities;

    if (player && (player.group in this.groups)) {
      entities = _.keys(this.groups[player.group].entities);
      entities = _.reject(entities, function (id) {
        return id == player.id;
      });
      entities = _.map(entities, function (id: any) {
        return parseInt(id);
      });
      if (entities) {
        this.pushToPlayer(player, new Messages.List(entities));
      }
    }
  }

  pushSpawnsToPlayer(player, ids) {
    var self = this;

    _.each(ids, function (id) {
      var entity = self.getEntityById(id);
      if (entity) {
        self.pushToPlayer(player, new Messages.Spawn(entity));
      }
    });

    console.debug('Pushed ' + _.size(ids) + ' new spawns to ' + player.id);
  }

  pushToPlayer(player, message) {
    this.broadcaster?.pushToPlayer(player, message);
  }

  pushToGroup(groupId, message, ignoredPlayer?) {
    this.broadcaster?.pushToGroup(groupId, message, ignoredPlayer);
  }

  pushToAdjacentGroups(groupId, message, ignoredPlayer?) {
    this.broadcaster?.pushToAdjacentGroups(groupId, message, ignoredPlayer);
  }

  pushToPreviousGroups(player, message) {
    this.broadcaster?.pushToPreviousGroups(player, message);
  }

  pushBroadcast(message, ignoredPlayer?) {
    this.broadcaster?.pushBroadcast(message, ignoredPlayer);
  }

  processQueues() {
    this.broadcaster?.processQueues();
  }

  addEntity(entity) {
    this.entityManager?.addEntity(entity);
  }

  removeEntity(entity) {
    this.entityManager?.removeEntity(entity);
  }

  addPlayer(player) {
    this.entityManager?.addPlayer(player);
  }

  removePlayer(player) {
    this.entityManager?.removePlayer(player);
  }

  addMob(mob) {
    this.entityManager?.addMob(mob);
  }

  addNpc(kind, x, y) {
    return this.entityManager?.addNpc(kind, x, y);
  }

  addItem(item) {
    return this.entityManager?.addItem(item);
  }

  createItem(kind, x, y) {
    return this.entityManager?.createItem(kind, x, y);
  }

  createItemWithProperties(kind, x, y, existingProperties?) {
    return this.entityManager?.createItemWithProperties(kind, x, y, existingProperties);
  }

  createChest(x, y, items) {
    return this.entityManager?.createChest(x, y, items);
  }

  addStaticItem(item) {
    return this.entityManager?.addStaticItem(item);
  }

  addItemFromChest(kind, x, y) {
    return this.entityManager?.addItemFromChest(kind, x, y);
  }

  /**
   * The mob will no longer be registered as an attacker of its current target.
   */
  clearMobAggroLink(mob) {
    this.combatSystem?.clearMobAggroLink(mob);
  }

  clearMobHateLinks(mob) {
    this.combatSystem?.clearMobHateLinks(mob);
  }

  forEachEntity(callback) {
    this.entityManager?.forEachEntity(callback);
  }

  forEachPlayer(callback) {
    this.entityManager?.forEachPlayer(callback);
  }

  forEachMob(callback) {
    this.entityManager?.forEachMob(callback);
  }

  forEachCharacter(callback) {
    this.entityManager?.forEachCharacter(callback);
  }

  handleMobHate(mobId, playerId, hatePoints) {
    this.combatSystem?.handleMobHate(mobId, playerId, hatePoints);
  }

  chooseMobTarget(mob, hateRank?) {
    this.combatSystem?.chooseMobTarget(mob, hateRank);
  }

  onEntityAttack(callback) {
    this.attack_callback = callback;
    this.combatSystem?.onEntityAttack(callback);
  }

  getEntityById(id) {
    return this.entityManager?.getEntityById(id);
  }

  getPlayerCount() {
    return this.entityManager?.getPlayerCount() ?? 0;
  }

  broadcastAttacker(character) {
    this.combatSystem?.broadcastAttacker(character);
  }

  handleHurtEntity(entity, attacker?, damage?) {
    this.combatSystem?.handleHurtEntity(entity, attacker, damage);
  }

  despawn(entity) {
    this.pushToAdjacentGroups(entity.group, entity.despawn());

    if (entity.id in this.entities) {
      this.removeEntity(entity);
    }
  }

  // spawnStaticEntities() moved to SpawnManager

  isValidPosition(x, y) {
    if (this.map && _.isNumber(x) && _.isNumber(y) && !this.map.isOutOfBounds(x, y) && !this.map.isColliding(x, y)) {
      return true;
    }
    return false;
  }

  handlePlayerVanish(player) {
    this.combatSystem?.handlePlayerVanish(player);
  }

  setPlayerCount(count) {
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

  getDroppedItem(mob) {
    var kind = Types.getKindAsString(mob.kind),
      baseDrops = Properties[kind].drops,
      v = Utils.random(100),
      p = 0,
      item = null;

    // Get zone at mob position for loot bonuses
    const zone = this.zoneManager.getZoneAt(mob.x, mob.y);

    // Apply zone modifiers to drop table (increased armor/weapon chances)
    const drops = this.zoneManager.modifyDropTable(baseDrops, zone);

    for (var itemName in drops) {
      var percentage = drops[itemName];

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

  onMobMoveCallback(mob) {
    this.pushToAdjacentGroups(mob.group, new Messages.Move(mob));
    this.handleEntityGroupMembership(mob);
  }

  findPositionNextTo(entity, target) {
    var valid = false,
      pos;

    while (!valid) {
      pos = entity.getPositionNextTo(target);
      valid = this.isValidPosition(pos.x, pos.y);
    }
    return pos;
  }

  // Spatial group methods - delegate to SpatialManager

  removeFromGroups(entity) {
    return this.spatialManager?.removeFromGroups(entity) ?? [];
  }

  addAsIncomingToGroup(entity, groupId) {
    this.spatialManager?.addAsIncomingToGroup(entity, groupId);
  }

  addToGroup(entity, groupId) {
    return this.spatialManager?.addToGroup(entity, groupId) ?? [];
  }

  logGroupPlayers(groupId) {
    this.spatialManager?.logGroupPlayers(groupId);
  }

  handleEntityGroupMembership(entity) {
    return this.spatialManager?.handleEntityGroupMembership(entity) ?? false;
  }

  processGroups() {
    this.spatialManager?.processGroups();
  }

  moveEntity(entity, x, y) {
    if (entity) {
      entity.setPosition(x, y);
      this.handleEntityGroupMembership(entity);
    }
  }

  // Spawn methods - delegate to SpawnManager

  handleItemDespawn(item) {
    this.spawnManager?.handleItemDespawn(item);
  }

  handleEmptyMobArea(area) {
    this.spawnManager?.handleEmptyMobArea(area);
  }

  handleEmptyChestArea(area) {
    this.spawnManager?.handleEmptyChestArea(area);
  }

  handleChestDespawn(chest) {
    this.spawnManager?.handleChestDespawn(chest);
  }

  handleOpenedChest(chest, player) {
    this.spawnManager?.handleOpenedChest(chest, player);
  }

  tryAddingMobToChestArea(mob) {
    this.spawnManager?.tryAddingMobToChestArea(mob);
  }

  updatePopulation(totalPlayers) {
    this.pushBroadcast(new Messages.Population(this.playerCount, totalPlayers ? totalPlayers : this.playerCount));
  }
}
