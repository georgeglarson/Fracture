import {App} from './app';
import {Warrior} from './entity/character/player/classes/warrior';
import {BubbleManager} from './interface/bubble.manager';
import {Types} from '../../shared/ts/gametypes';
import {Animation} from './animation';
import {Sprite} from './renderer/sprite';
import Map from './map/map';
import {AnimatedTile} from './map/animatedtile';
import {Player} from './entity/character/player/player';
import {Character} from './entity/character/character';
import {Chest} from './entity/objects/chest';
import {Item} from './entity/objects/item';
import {Updater} from './renderer/updater';
import {Camera} from './renderer/camera';
import {Pathfinder} from './utils/pathfinder';
import {Mob} from './entity/character/mob/mob';
import {Npc} from './entity/character/npc/npc';
import {AudioManager} from './audio';
import {InfoManager} from './interface/info.manager';
import {GameClient} from './network/gameclient';
import {Mobs} from './entity/character/mob/mobs';
import {Exceptions} from './exceptions';
import _ from 'lodash';
import {Entity} from './entity/entity';
import {Renderer} from './renderer/renderer';
import {GridManager} from './world/grid-manager';
import {MapQueryService} from './world/map-query';
import {EntityManager} from './entities/entity-manager';
import {InputManager} from './input/input-manager';
import {UIManager} from './ui/ui-manager';
import {ItemTooltip} from './ui/item-tooltip';
import {setupNetworkHandlers} from './network/message-handlers';
import {ZoningManager} from './world/zoning-manager';
import {SpriteLoader} from './assets/sprite-loader';

export class Game {

  app: App;
  ready = false;
  started = false;
  hasNeverStarted = true;

  renderer: Renderer = null;
  updater: Updater = null;
  pathfinder: Pathfinder = null;
  chatinput = null;
  bubbleManager: BubbleManager = null;
  audioManager: AudioManager = null;
  infoManager = new InfoManager(this);
  // Player
  player: Player;

  // Game state
  entityManager: EntityManager | null = null;
  gridManager: GridManager | null = null;
  inputManager: InputManager | null = null;
  mapQueryService: MapQueryService | null = null;
  uiManager: UIManager | null = null;
  itemTooltip: ItemTooltip | null = null;
  zoningManager: ZoningManager | null = null;
  spriteLoader: SpriteLoader | null = null;

  // Entity accessors (delegate to entityManager)
  get entities() { return this.entityManager?.entities ?? {}; }
  get deathpositions() { return this.entityManager?.deathpositions ?? {}; }

  // Grid accessors (delegate to gridManager)
  get entityGrid() { return this.gridManager?.entityGrid ?? null; }
  get pathingGrid() { return this.gridManager?.pathingGrid ?? null; }
  get renderingGrid() { return this.gridManager?.renderingGrid ?? null; }
  get itemGrid() { return this.gridManager?.itemGrid ?? null; }

  // Input accessors (delegate to inputManager)
  get currentCursor() { return this.inputManager?.currentCursor ?? null; }
  get currentCursorOrientation() { return this.inputManager?.currentCursorOrientation; }
  get mouse() { return this.inputManager?.mouse ?? { x: 0, y: 0 }; }
  get previousClickPosition() { return this.inputManager?.previousClickPosition ?? { x: -1, y: -1 }; }
  set previousClickPosition(pos) { if (this.inputManager) this.inputManager.previousClickPosition = pos; }
  get selectedX() { return this.inputManager?.selectedX ?? 0; }
  set selectedX(val) { if (this.inputManager) this.inputManager.selectedX = val; }
  get selectedY() { return this.inputManager?.selectedY ?? 0; }
  set selectedY(val) { if (this.inputManager) this.inputManager.selectedY = val; }
  get selectedCellVisible() { return this.inputManager?.selectedCellVisible ?? false; }
  set selectedCellVisible(val) { if (this.inputManager) this.inputManager.selectedCellVisible = val; }
  get targetColor() { return this.inputManager?.targetColor ?? 'rgba(255, 255, 255, 0.5)'; }
  get targetCellVisible() { return this.inputManager?.targetCellVisible ?? true; }
  get hoveringTarget() { return this.inputManager?.hoveringTarget ?? false; }
  get hoveringMob() { return this.inputManager?.hoveringMob ?? false; }
  get hoveringItem() { return this.inputManager?.hoveringItem ?? false; }
  get hoveringCollidingTile() { return this.inputManager?.hoveringCollidingTile ?? false; }
  get hoveringNpc() { return this.inputManager?.hoveringNpc ?? false; }
  get hoveringChest() { return this.inputManager?.hoveringChest ?? false; }
  get hoveringPlateauTile() { return this.inputManager?.hoveringPlateauTile ?? false; }
  get lastHovered() { return this.inputManager?.lastHovered ?? null; }

  // Zoning accessors (delegate to zoningManager)
  get currentZoning() { return this.zoningManager?.getCurrentZoning() ?? null; }
  get zoningOrientation() { return this.zoningManager?.orientation ?? null; }

  cursors = {};

  sprites = {};

  // tile animation
  animatedTiles = null;

  // debug
  debugPathing = false;

  map;
  targetAnimation: Animation;
  sparksAnimation: Animation;
  storage: Storage;
  shadows;
  achievements;
  currentTime;

  camera: Camera;

  host;
  port;
  username;
  isStopped;
  drawTarget;
  client;
  playerId;
  clearTarget;

  // obsoleteEntities accessor (delegate to entityManager)
  get obsoleteEntities() { return this.entityManager?.obsoleteEntities ?? null; }

  playerdeath_callback;
  equipment_callback;
  invincible_callback;
  playerhurt_callback;
  nbplayers_callback;
  disconnect_callback;
  gamestart_callback;
  notification_callback;
  playerhp_callback;
  unlock_callback;

  // Progression system
  playerxp_callback;
  levelup_callback;
  playerLevel: number = 1;
  playerXp: number = 0;
  playerXpToNext: number = 100;

  // Economy system
  playergold_callback;
  playerGold: number = 0;

  constructor(app: App) {
    this.app = app;
    this.player = new Warrior('player', '');
  }

  setup($bubbleContainer, canvas, background, foreground, input) {
    this.setBubbleManager(new BubbleManager($bubbleContainer));
    this.setRenderer(new Renderer(this, canvas, background, foreground));
    this.setChatInput(input);
  }

  supportsWebGL() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl && gl instanceof WebGLRenderingContext;
  }

  setStorage(storage) {
    this.storage = storage;
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  setUpdater(updater) {
    this.updater = updater;
  }

  setPathfinder(pathfinder) {
    this.pathfinder = pathfinder;
  }

  setChatInput(element) {
    this.chatinput = element;
  }

  setBubbleManager(bubbleManager) {
    this.bubbleManager = bubbleManager;
  }

  loadMap() {
    var self = this;

    this.map = new Map(!this.renderer.upscaledRendering, this);


    this.map.ready(function () {
      console.info('Map loaded.');
      var tilesetIndex = self.renderer.upscaledRendering ? 0 : self.renderer.scale - 1;
      self.renderer.setTileset(self.map.tilesets[tilesetIndex]);
    });
  }

  initPlayer() {
    if (this.storage.hasAlreadyPlayed()) {
      this.player.setSpriteName(this.storage.data.player.armor);
      this.player.setWeaponName(this.storage.data.player.weapon);
    }

    this.player.setSprite(this.sprites[this.player.getSpriteName()]);
    this.player.idle();

    console.debug('Finished initPlayer');
  }

  initShadows() {
    this.shadows = this.spriteLoader?.initShadows() ?? {};
  }

  initCursors() {
    this.cursors = this.spriteLoader?.initCursors() ?? {};
  }

  initAnimations() {
    this.targetAnimation = new Animation('idle_down', 4, 0, 16, 16);
    this.targetAnimation.setSpeed(50);

    this.sparksAnimation = new Animation('idle_down', 6, 0, 16, 16);
    this.sparksAnimation.setSpeed(120);
  }

  initHurtSprites() {
    this.spriteLoader?.initHurtSprites();
  }

  initSilhouettes() {
    this.spriteLoader?.initSilhouettes();
  }

  initAchievements() {
    var self = this;

    this.achievements = {};

    _.each(this.achievements, function (obj) {
      if (!obj.isCompleted) {
        obj.isCompleted = function () {
          return true;
        }
      }
      if (!obj.hidden) {
        obj.hidden = false;
      }
    });

    this.app.initAchievementList(this.achievements);

    if (this.storage.hasAlreadyPlayed()) {
      this.app.initUnlockedAchievements(this.storage.data.achievements.unlocked);
    }
  }

  getAchievementById(id) {
    var found = null;
    _.each(this.achievements, function (achievement, key) {
      if (achievement.id === parseInt(id)) {
        found = achievement;
      }
    });
    return found;
  }

  setSpriteScale(scale) {
    if (!this.spriteLoader) return;
    this.spriteLoader.setSpriteScale(scale);
    this.sprites = this.spriteLoader.getSprites();
    this.initHurtSprites();
    this.initShadows();
    this.initCursors();
  }

  loadSprites() {
    if (!this.spriteLoader) return;
    this.spriteLoader.loadSprites();
  }

  spritesLoaded() {
    return this.spriteLoader?.spritesLoaded() ?? false;
  }

  setCursor(name, orientation?) {
    this.inputManager?.setCursor(name, orientation);
  }

  updateCursorLogic() {
    this.inputManager?.updateCursorLogic();
  }

  focusPlayer() {
    this.renderer.camera.lookAt(this.player);
  }

  addEntity(entity) {
    this.entityManager?.addEntity(entity);
  }

  removeEntity(entity) {
    this.entityManager?.removeEntity(entity);
  }

  addItem(item, x, y) {
    // Idempotent check: skip if item already exists (prevents duplicate spawn issues)
    if (this.entityIdExists(item.id)) {
      console.warn('[addItem] Item already exists, skipping duplicate:', item.id);
      return;
    }
    console.log('[addItem] Adding item ' + item.id + ' at ' + x + ', ' + y);
    item.setSprite(this.sprites[item.getSpriteName()]);
    item.setGridPosition(x, y);
    item.setAnimation('idle', 150);
    this.addEntity(item);
    console.log('[addItem] Item ' + item.id + ' added to entities. itemGrid entry exists:', !!this.itemGrid[y][x][item.id]);
  }

  removeItem(item) {
    this.entityManager?.removeItem(item);
  }

  initPathingGrid() {
    this.gridManager?.initPathingGrid();
  }

  initEntityGrid() {
    this.gridManager?.initEntityGrid();
  }

  initRenderingGrid() {
    this.gridManager?.initRenderingGrid();
  }

  initItemGrid() {
    this.gridManager?.initItemGrid();
  }

  /**
   *
   */
  initAnimatedTiles() {
    var self = this,
      m = this.map;

    this.animatedTiles = [];
    this.forEachVisibleTile(function (id, index) {
      if (m.isAnimatedTile(id)) {
        var tile = new AnimatedTile(id, m.getTileAnimationLength(id), m.getTileAnimationDelay(id), index),
          pos = self.map.tileIndexToGridPosition(tile.index);

        tile.x = pos.x;
        tile.y = pos.y;
        self.animatedTiles.push(tile);
      }
    }, 1);
    //console.info("Initialized animated tiles.");
  }

  addToRenderingGrid(entity, x, y) {
    this.gridManager?.addToRenderingGrid(entity, x, y);
  }

  removeFromRenderingGrid(entity, x, y) {
    this.gridManager?.removeFromRenderingGrid(entity, x, y);
  }

  removeFromEntityGrid(entity, x, y) {
    this.gridManager?.removeFromEntityGrid(entity, x, y);
  }

  removeFromItemGrid(item, x, y) {
    this.gridManager?.removeFromItemGrid(item, x, y);
  }

  removeFromPathingGrid(x, y) {
    this.gridManager?.removeFromPathingGrid(x, y);
  }

  /**
   * Registers the entity at two adjacent positions on the grid at the same time.
   * This situation is temporary and should only occur when the entity is moving.
   * This is useful for the hit testing algorithm used when hovering entities with the mouse cursor.
   *
   * @param {Entity} entity The moving entity
   */
  registerEntityDualPosition(entity) {
    this.gridManager?.registerEntityDualPosition(entity);
  }

  /**
   * Clears the position(s) of this entity in the entity grid.
   *
   * @param {Entity} entity The moving entity
   */
  unregisterEntityPosition(entity) {
    this.gridManager?.unregisterEntityPosition(entity);
  }

  registerEntityPosition(entity) {
    this.gridManager?.registerEntityPosition(entity);
  }

  setServerOptions(host, port, username) {
    this.host = host;
    this.port = port;
    this.username = username;
  }

  loadAudio() {
    this.audioManager = new AudioManager(this);
  }

  initMusicAreas() {
    var self = this;
    _.each(this.map.musicAreas, function (area) {
      self.audioManager.addArea(area.x, area.y, area.w, area.h, area.id);
    });
  }

  run(started_callback) {
    var self = this;

    // Initialize sprite loader
    this.spriteLoader = new SpriteLoader();
    this.spriteLoader.setContext({
      renderer: this.renderer,
      entities: this.entities
    });

    this.loadSprites();
    this.setUpdater(new Updater(this));
    this.camera = this.renderer.camera;

    this.setSpriteScale(this.renderer.scale);

    var wait = setInterval(function () {
      if (self.map.isLoaded && self.spritesLoaded()) {
        self.ready = true;
        console.debug('All sprites loaded.');

        self.loadAudio();

        self.initMusicAreas();
        self.initAchievements();
        self.initCursors();
        self.initAnimations();
        self.initShadows();
        self.initHurtSprites();

        if (!self.renderer.mobile
          && !self.renderer.tablet
          && self.renderer.upscaledRendering) {
          self.initSilhouettes();
        }

        // Initialize grid manager
        self.gridManager = new GridManager(self.map);
        self.initEntityGrid();
        self.initItemGrid();
        self.initPathingGrid();
        self.initRenderingGrid();

        // Initialize entity manager
        self.entityManager = new EntityManager();
        self.entityManager.setGridManager(self);
        self.entityManager.setRenderer(self.renderer);
        self.entityManager.setCamera(self.camera);
        self.entityManager.setCurrentTimeProvider(() => self.currentTime);
        self.entityManager.setDirtyRectCallback((rect, entity, x, y) => {
          self.checkOtherDirtyRects(rect, entity, x, y);
        });

        // Initialize map query service
        self.mapQueryService = new MapQueryService();
        self.mapQueryService.setMap(self.map);
        self.mapQueryService.setGridProvider(() => ({
          entityGrid: self.entityGrid,
          itemGrid: self.itemGrid
        }));

        // Initialize input manager
        self.inputManager = new InputManager();
        self.inputManager.setRenderer(self.renderer);
        self.inputManager.setMap(self.map);
        self.inputManager.setEntityQuery({
          isMobAt: (x, y) => self.isMobAt(x, y),
          isItemAt: (x, y) => self.isItemAt(x, y),
          isNpcAt: (x, y) => self.isNpcAt(x, y),
          isChestAt: (x, y) => self.isChestAt(x, y),
          getEntityAt: (x, y) => self.getEntityAt(x, y)
        });
        self.inputManager.setPlayerProvider(() => self.player);
        self.inputManager.setGameStartedProvider(() => self.started);
        self.inputManager.setCursors(self.cursors);

        // Initialize UI manager
        self.uiManager = new UIManager();
        self.uiManager.setNotificationCallback((msg) => {
          if (self.notification_callback) {
            self.notification_callback(msg);
          }
        });
        self.uiManager.setNewsRequestCallback(() => {
          if (self.client) {
            self.client.sendNewsRequest();
          }
        });

        // Initialize item tooltip
        self.itemTooltip = new ItemTooltip();

        // Initialize zoning manager
        self.zoningManager = new ZoningManager();
        self.zoningManager.setContext({
          camera: self.camera,
          renderer: self.renderer,
          bubbleManager: self.bubbleManager,
          // Use closure - client is created later in connect()
          client: { sendZone: () => self.client?.sendZone() },
          initAnimatedTiles: () => self.initAnimatedTiles(),
          forEachVisibleEntityByDepth: (cb) => self.forEachVisibleEntityByDepth(cb)
        });

        self.setPathfinder(new Pathfinder(self.map.width, self.map.height));

        // Set camera map bounds to prevent rendering outside the map
        self.camera.setMapSize(self.map.width, self.map.height);

        self.initPlayer();
        self.setCursor('hand');

        self.connect(started_callback);

        clearInterval(wait);
      }
    }, 100);
  }

  tick() {
    this.currentTime = new Date().getTime();

    if (this.started) {
      this.updateCursorLogic();
      this.updater.update();
      this.renderer.renderFrame();
    }

    if (!this.isStopped) {
      window.requestAnimFrame(this.tick.bind(this));
    }
  }

  start() {
    this.tick();
    this.hasNeverStarted = false;
    console.info('Game loop started.');
  }

  stop() {
    console.info('Game stopped.');
    this.isStopped = true;
  }

  entityIdExists(id) {
    return this.entityManager?.entityIdExists(id) ?? false;
  }

  getEntityById(id) {
    return this.entityManager?.getEntityById(id);
  }

  connect(started_callback) {
    var self = this,
      connecting = false; // always in dispatcher mode in the build version

    this.client = new GameClient(this.host, this.port);

    //>>excludeStart("prodHost", pragmas.prodHost);
    var config = this.app.config.local;
    if (config) {
      this.client.connect(); // false if the client connects directly to a game server
      connecting = true;
    }
    //>>excludeEnd("prodHost");

    //>>includeStart("prodHost", pragmas.prodHost);
    if (!connecting) {
      this.client.connect(true); // always use the dispatcher in production
    }
    //>>includeEnd("prodHost");

    this.client.onDispatched(function (host, port) {
      console.debug('Dispatched to game server ' + host + ':' + port);

      self.client.host = host;
      self.client.port = port;
      self.client.connect(); // connect to actual game server
    });

    this.client.onConnected(function () {
      console.info('Starting client/server handshake');

      self.player.name = self.username;
      self.started = true;

      self.sendHello(self.player);
    });

    this.client.onEntityList(function (list) {
      var entityIds = _.pluck(self.entities, 'id'),
        knownIds = _.intersection(entityIds, list),
        newIds = _.difference(list, knownIds);

      self.entityManager?.setObsoleteEntities(_.reject(self.entities, function (entity: Entity) {
        return _.include(knownIds, entity.id) || entity.id === self.player.id;
      }) as Entity[]);

      // Destroy entities outside of the player's zone group
      self.removeObsoleteEntities();

      // Ask the server for spawn information about unknown entities
      if (_.size(newIds) > 0) {
        self.client.sendWho(newIds);
      }
    });

    this.client.onWelcome(function (id, name, x, y, hp) {
      console.info('Received player ID from server : ' + id);
      self.player.id = id;
      self.playerId = id;
      // Always accept name received from the server which will
      // sanitize and shorten names exceeding the allowed length.
      self.player.name = name;
      self.player.setGridPosition(x, y);
      self.player.setMaxHitPoints(hp);

      self.updateBars();
      self.resetCamera();
      self.updatePlateauMode();
      self.audioManager.updateMusic();

      self.addEntity(self.player);
      self.player.dirtyRect = self.renderer.getEntityBoundingRect(self.player);

      setTimeout(function () {
        self.tryUnlockingAchievement('STILL_ALIVE');
      }, 1500);

      if (!self.storage.hasAlreadyPlayed()) {
        self.storage.initPlayer(self.player.name);
        self.storage.savePlayer(self.renderer.getPlayerImage(),
          self.player.getSpriteName(),
          self.player.getWeaponName());
        self.showNotification('Welcome to BrowserQuest!');
      } else {
        self.showNotification('Welcome back to BrowserQuest!');
        self.storage.setPlayerName(name);

        // Load saved progression from localStorage
        var savedProgression = self.storage.getProgression();
        self.playerLevel = savedProgression.level;
        self.playerXp = savedProgression.xp;
        self.playerXpToNext = savedProgression.xpToNext;
        console.info('[Progression] Loaded from storage: Level ' + self.playerLevel + ', XP ' + self.playerXp + '/' + self.playerXpToNext);

        // Update UI with saved progression
        if (self.playerxp_callback) {
          self.playerxp_callback(self.playerXp, self.playerXpToNext, self.playerLevel);
        }
      }

      // Send daily check to server
      var dailyData = self.storage.getDailyData();
      self.client.sendDailyCheck(dailyData.lastLoginDate || '', dailyData.currentStreak);

      self.player.onStartPathing(function (path) {
        var i = path.length - 1,
          x = path[i][0],
          y = path[i][1];

        if (self.player.isMovingToLoot()) {
          self.player.isLootMoving = false;
        }
        else if (!self.player.isAttacking()) {
          self.client.sendMove(x, y);
        }

        // Target cursor position
        self.selectedX = x;
        self.selectedY = y;
        self.selectedCellVisible = true;

        if (self.renderer.mobile || self.renderer.tablet) {
          self.drawTarget = true;
          self.clearTarget = true;
          self.renderer.targetRect = self.renderer.getTargetBoundingRect();
          self.checkOtherDirtyRects(self.renderer.targetRect, null, self.selectedX, self.selectedY);
        }
      });

      self.player.onCheckAggro(function () {
        self.forEachMob(function (mob) {
          if (mob.isAggressive && !mob.isAttacking() && self.player.isNear(mob, mob.aggroRange)) {
            self.player.aggro(mob);
          }
        });
      });

      self.player.onAggro(function (mob) {
        if (!mob.isWaitingToAttack(self.player) && !self.player.isAttackedBy(mob)) {
          self.player.log_info('Aggroed by ' + mob.id + ' at (' + self.player.gridX + ', ' + self.player.gridY + ')');
          self.client.sendAggro(mob);
          mob.waitToAttack(self.player);
        }
      });

      self.player.onBeforeStep(function () {
        var blockingEntity = self.getEntityAt(self.player.nextGridX, self.player.nextGridY);
        if (blockingEntity && blockingEntity.id !== self.playerId) {
          console.debug('Blocked by ' + blockingEntity.id);
        }
        self.unregisterEntityPosition(self.player);
      });

      self.player.onStep(function () {
        if (self.player.hasNextStep()) {
          self.registerEntityDualPosition(self.player);
        }

        if (self.isZoningTile(self.player.gridX, self.player.gridY)) {
          self.enqueueZoningFrom(self.player.gridX, self.player.gridY);
        }

        self.player.forEachAttacker(function (attacker) {
          if (attacker.isAdjacent(attacker.target)) {
            attacker.lookAtTarget();
          } else {
            attacker.follow(self.player);
          }
        });

        if ((self.player.gridX <= 85 && self.player.gridY <= 179 && self.player.gridY > 178) || (self.player.gridX <= 85 && self.player.gridY <= 266 && self.player.gridY > 265)) {
          self.tryUnlockingAchievement('INTO_THE_WILD');
        }

        if (self.player.gridX <= 85 && self.player.gridY <= 293 && self.player.gridY > 292) {
          self.tryUnlockingAchievement('AT_WORLDS_END');
        }

        if (self.player.gridX <= 85 && self.player.gridY <= 100 && self.player.gridY > 99) {
          self.tryUnlockingAchievement('NO_MANS_LAND');
        }

        if (self.player.gridX <= 85 && self.player.gridY <= 51 && self.player.gridY > 50) {
          self.tryUnlockingAchievement('HOT_SPOT');
        }

        if (self.player.gridX <= 27 && self.player.gridY <= 123 && self.player.gridY > 112) {
          self.tryUnlockingAchievement('TOMB_RAIDER');
        }

        self.updatePlayerCheckpoint();

        if (!self.player.isDead) {
          self.audioManager.updateMusic();
        }
      });

      self.player.onStopPathing(function (x, y) {
        if (self.player.hasTarget()) {
          self.player.lookAtTarget();
        }

        self.selectedCellVisible = false;

        if (self.isItemAt(x, y)) {
          var item = self.getItemAt(x, y);

          try {
            self.player.loot(item);
            self.client.sendLoot(item); // Notify the server that this item has been looted
            self.removeItem(item);
            self.showNotification(item.getLootMessage());

            if (item.type === 'armor') {
              self.tryUnlockingAchievement('FAT_LOOT');
            }

            if (item.type === 'weapon') {
              self.tryUnlockingAchievement('A_TRUE_WARRIOR');
            }

            if (item.kind === Types.Entities.CAKE) {
              self.tryUnlockingAchievement('FOR_SCIENCE');
            }

            if (item.kind === Types.Entities.FIREPOTION) {
              self.tryUnlockingAchievement('FOXY');
              self.audioManager.playSound('firefox');
            }

            if (Types.isHealingItem(item.kind)) {
              self.audioManager.playSound('heal');
            } else {
              self.audioManager.playSound('loot');
            }

            if (item.wasDropped && !_(item.playersInvolved).include(self.playerId)) {
              self.tryUnlockingAchievement('NINJA_LOOT');
            }
          } catch (e) {
            if (e instanceof Exceptions.LootException) {
              self.showNotification(e.message);
              self.audioManager.playSound('noloot');
            } else {
              throw e;
            }
          }
        }

        if (!self.player.hasTarget() && self.map.isDoor(x, y)) {
          var dest = self.map.getDoorDestination(x, y);

          self.player.setGridPosition(dest.x, dest.y);
          self.player.nextGridX = dest.x;
          self.player.nextGridY = dest.y;
          self.player.turnTo(dest.orientation);
          self.client.sendTeleport(dest.x, dest.y);

          if (self.renderer.mobile && dest.cameraX && dest.cameraY) {
            self.camera.setGridPosition(dest.cameraX, dest.cameraY);
            self.resetZone();
          } else {
            if (dest.portal) {
              self.assignBubbleTo(self.player);
            } else {
              self.camera.focusEntity(self.player);
              self.resetZone();
            }
          }

          if (_.size(self.player.attackers) > 0) {
            setTimeout(function () {
              self.tryUnlockingAchievement('COWARD');
            }, 500);
          }
          self.player.forEachAttacker(function (attacker) {
            attacker.disengage();
            attacker.idle();
          });

          self.updatePlateauMode();

          self.checkUndergroundAchievement();

          if (self.renderer.mobile || self.renderer.tablet) {
            // When rendering with dirty rects, clear the whole screen when entering a door.
            self.renderer.clearScreen(self.renderer.context);
          }

          if (dest.portal) {
            self.audioManager.playSound('teleport');
          }

          if (!self.player.isDead) {
            self.audioManager.updateMusic();
          }
        }

        if (self.player.target instanceof Npc) {
          self.makeNpcTalk(self.player.target);
        } else if (self.player.target instanceof Chest) {
          self.client.sendOpen(self.player.target);
          self.audioManager.playSound('chest');
        }

        self.player.forEachAttacker(function (attacker) {
          if (!attacker.isAdjacentNonDiagonal(self.player)) {
            attacker.follow(self.player);
          }
        });

        self.unregisterEntityPosition(self.player);
        self.registerEntityPosition(self.player);
      });

      self.player.onRequestPath(function (x, y) {
        var ignored = [self.player]; // Always ignore self

        if (self.player.hasTarget()) {
          ignored.push(self.player.target);
        }
        return self.findPath(self.player, x, y, ignored);
      });

      self.player.onDeath(function () {
        console.info(self.playerId + ' is dead');

        self.player.stopBlinking();
        self.player.setSprite(self.sprites['death']);
        self.player.animate('death', 120, 1, function () {
          console.info(self.playerId + ' was removed');

          self.removeEntity(self.player);
          self.removeFromRenderingGrid(self.player, self.player.gridX, self.player.gridY);

          self.player = null;
          self.client.disable();

          setTimeout(function () {
            self.playerdeath_callback();
          }, 1000);
        });

        self.player.forEachAttacker(function (attacker) {
          attacker.disengage();
          attacker.idle();
        });

        self.audioManager.fadeOutCurrentMusic();
        self.audioManager.playSound('death');
      });

      self.player.onHasMoved(function (player) {
        self.assignBubbleTo(player);
      });

      self.player.onArmorLoot(function (armorName) {
        self.player.switchArmor(self.sprites[armorName]);
      });

      self.player.onSwitchItem(function () {
        self.storage.savePlayer(self.renderer.getPlayerImage(),
          self.player.getArmorName(),
          self.player.getWeaponName());
        if (self.equipment_callback) {
          self.equipment_callback();
        }
      });

      self.player.onInvincible(function () {
        self.invincible_callback();
        self.player.switchArmor(self.sprites['firefox']);
      });

      // Setup all network message handlers (extracted to network/message-handlers.ts)
      setupNetworkHandlers(self, self.client);


      self.gamestart_callback();

      if (self.hasNeverStarted) {
        self.start();
        started_callback();
      }
    });
  }

  /**
   * Links two entities in an attacker<-->target relationship.
   * This is just a utility method to wrap a set of instructions.
   *
   * @param {Entity} attacker The attacker entity
   * @param {Entity} target The target entity
   */
  createAttackLink(attacker, target) {
    if (attacker.hasTarget()) {
      attacker.removeTarget();
    }
    attacker.engage(target);

    if (attacker.id !== this.playerId) {
      target.addAttacker(attacker);
    }
  }

  /**
   * Sends a "hello" message to the server, as a way of initiating the player connection handshake.
   * @see GameClient.sendHello
   */
  sendHello(player?) {
    const gold = this.storage.getGold();
    this.client.sendHello(player || this.player, gold);
  }

  /**
   * Converts the current mouse position on the screen to world grid coordinates.
   * @returns {Object} An object containing x and y properties.
   */
  getMouseGridPosition() {
    return this.inputManager?.getMouseGridPosition() ?? { x: 0, y: 0 };
  }

  /**
   * Moves a character to a given location on the world grid.
   *
   * @param {Number} x The x coordinate of the target location.
   * @param {Number} y The y coordinate of the target location.
   */
  makeCharacterGoTo(character, x, y) {
    if (!this.map.isOutOfBounds(x, y)) {
      character.go(x, y);
    }
  }

  /**
   *
   */
  makeCharacterTeleportTo(character, x, y) {
    if (!this.map.isOutOfBounds(x, y)) {
      this.unregisterEntityPosition(character);

      character.setGridPosition(x, y);

      this.registerEntityPosition(character);
      this.assignBubbleTo(character);
    } else {
      console.debug('Teleport out of bounds: ' + x + ', ' + y);
    }
  }

  /**
   * Moves the current player to a given target location.
   * @see makeCharacterGoTo
   */
  makePlayerGoTo(x, y) {
    this.makeCharacterGoTo(this.player, x, y);
  }

  /**
   * Moves the current player towards a specific item.
   * @see makeCharacterGoTo
   */
  makePlayerGoToItem(item) {
    if (item) {
      this.player.isLootMoving = true;
      this.makePlayerGoTo(item.gridX, item.gridY);
      this.client.sendLootMove(item, item.gridX, item.gridY);
    }
  }

  /**
   *
   */
  makePlayerTalkTo(npc) {
    if (npc) {
      this.player.setTarget(npc);
      this.player.follow(npc);
    }
  }

  makePlayerOpenChest(chest) {
    if (chest) {
      this.player.setTarget(chest);
      this.player.follow(chest);
    }
  }

  /**
   *
   */
  makePlayerAttack(mob) {
    this.createAttackLink(this.player, mob);
    this.client.sendAttack(mob);
  }

  /**
   *
   */
  makeNpcTalk(npc) {
    var self = this;

    if (npc) {
      this.previousClickPosition = { x: -1, y: -1 };
      this.tryUnlockingAchievement('SMALL_TALK');

      if (npc.kind === Types.Entities.RICK) {
        this.tryUnlockingAchievement('RICKROLLD');
      }

      // Store current NPC for when response arrives
      this.currentNpcTalk = npc;

      // Show thinking indicator
      this.createBubble(npc.id, '...');
      this.assignBubbleTo(npc);

      // Request AI-generated dialogue from server
      this.client.sendNpcTalk(npc.kind);

      // Fallback: if no response in 5 seconds, use static dialogue
      setTimeout(function() {
        if (self.currentNpcTalk === npc) {
          self.currentNpcTalk = null;
          var msg = npc.talk();
          if (msg) {
            self.createBubble(npc.id, msg);
            self.assignBubbleTo(npc);
          }
          self.audioManager.playSound('npc');
        }
      }, 5000);
    }
  }

  // Current NPC being talked to (for Venice AI response handling)
  currentNpcTalk = null;

  // Current quest (for tracking)
  currentQuest = null;

  /**
   * Loops through all the entities currently present in the game.
   * @param {Function} callback The function to call back (must accept one entity argument).
   */
  forEachEntity(callback) {
    this.entityManager?.forEachEntity(callback);
  }

  /**
   * Same as forEachEntity but only for instances of the Mob subclass.
   * @see forEachEntity
   */
  forEachMob(callback) {
    this.entityManager?.forEachMob(callback);
  }

  /**
   * Loops through all entities visible by the camera and sorted by depth :
   * Lower 'y' value means higher depth.
   * Note: This is used by the Renderer to know in which order to render entities.
   */
  forEachVisibleEntityByDepth(callback) {
    var self = this,
      m = this.map;

    this.camera.forEachVisiblePosition(function (x, y) {
      if (!m.isOutOfBounds(x, y)) {
        if (self.renderingGrid[y][x]) {
          _.each(self.renderingGrid[y][x], function (entity) {
            callback(entity);
          });
        }
      }
    }, this.renderer.mobile ? 0 : 2);
  }

  /**
   *
   */
  forEachVisibleTileIndex(callback, extra) {
    var m = this.map;

    this.camera.forEachVisiblePosition(function (x, y) {
      if (!m.isOutOfBounds(x, y)) {
        callback(m.GridPositionToTileIndex(x, y) - 1);
      }
    }, extra);
  }

  /**
   *
   */
  forEachVisibleTile(callback, extra) {
    var self = this,
      m = this.map;

    if (m.isLoaded) {
      this.forEachVisibleTileIndex(function (tileIndex) {
        if (_.isArray(m.data[tileIndex])) {
          _.each(m.data[tileIndex], function (id: number) {
            callback(id - 1, tileIndex);
          });
        }
        else {
          if (_.isNaN(m.data[tileIndex] - 1)) {
            //throw Error("Tile number for index:"+tileIndex+" is NaN");
          } else {
            callback(m.data[tileIndex] - 1, tileIndex);
          }
        }
      }, extra);
    }
  }

  /**
   *
   */
  forEachAnimatedTile(callback) {
    if (this.animatedTiles) {
      _.each(this.animatedTiles, function (tile) {
        callback(tile);
      });
    }
  }

  /**
   * Returns the entity located at the given position on the world grid.
   */
  getEntityAt(x, y) {
    return this.mapQueryService?.getEntityAt(x, y) ?? null;
  }

  getMobAt(x, y) {
    return this.mapQueryService?.getMobAt(x, y) ?? null;
  }

  getNpcAt(x, y) {
    return this.mapQueryService?.getNpcAt(x, y) ?? null;
  }

  getChestAt(x, y) {
    return this.mapQueryService?.getChestAt(x, y) ?? null;
  }

  getItemAt(x, y) {
    return this.mapQueryService?.getItemAt(x, y) ?? null;
  }

  /**
   * Returns true if an entity is located at the given position on the world grid.
   */
  isEntityAt(x, y) {
    return this.mapQueryService?.isEntityAt(x, y) ?? false;
  }

  isMobAt(x, y) {
    return this.mapQueryService?.isMobAt(x, y) ?? false;
  }

  isItemAt(x, y) {
    return this.mapQueryService?.isItemAt(x, y) ?? false;
  }

  isNpcAt(x, y) {
    return this.mapQueryService?.isNpcAt(x, y) ?? false;
  }

  isChestAt(x, y) {
    return this.mapQueryService?.isChestAt(x, y) ?? false;
  }

  /**
   * Finds a path to a grid position for the specified character.
   * The path will pass through any entity present in the ignore list.
   */
  findPath(character, x, y, ignoreList) {
    var self = this,
      grid = this.pathingGrid;
    let path = [],
      isPlayer = (character === this.player);

    if (this.map.isColliding(x, y)) {
      return path;
    }

    if (this.pathfinder && character) {
      if (ignoreList) {
        _.each(ignoreList, function (entity) {
          self.pathfinder.ignoreEntity(entity);
        });
      }

      path = this.pathfinder.findPath(grid, character, x, y, false);

      if (ignoreList) {
        this.pathfinder.clearIgnoreList();
      }
    } else {
      console.error('Error while finding the path to ' + x + ', ' + y + ' for ' + character.id);
    }
    return path;
  }

  /**
   * Toggles the visibility of the pathing grid for debugging purposes.
   */
  togglePathingGrid() {
    if (this.debugPathing) {
      this.debugPathing = false;
    } else {
      this.debugPathing = true;
    }
  }

  /**
   * Toggles the visibility of the FPS counter and other debugging info.
   */
  toggleDebugInfo() {
    if (this.renderer && this.renderer.isDebugInfoVisible) {
      this.renderer.isDebugInfoVisible = false;
    } else {
      this.renderer.isDebugInfoVisible = true;
    }
  }

  /**
   * Updates hover state based on current mouse position.
   */
  movecursor() {
    this.inputManager?.updateHoverState();
    this.updateItemTooltip();
  }

  /**
   * Update item tooltip based on hover state
   */
  updateItemTooltip() {
    if (!this.itemTooltip || !this.inputManager || !this.gridManager) return;

    if (this.hoveringItem) {
      const pos = this.inputManager.getMouseGridPosition();
      const item = this.gridManager.getItemAt(pos.x, pos.y);

      if (item && item.properties) {
        const equippedWeaponKind = this.player
          ? Types.getKindFromString(this.player.getWeaponName())
          : null;
        this.itemTooltip.show(
          item,
          equippedWeaponKind,
          this.mouse.x,
          this.mouse.y
        );
        return;
      }
    }

    this.itemTooltip.hide();
  }

  /**
   * Processes game logic when the user triggers a click/touch event during the game.
   */
  click() {
    var pos = this.getMouseGridPosition(),
      entity;

    if (pos.x === this.previousClickPosition.x
      && pos.y === this.previousClickPosition.y) {
      return;
    } else {
      this.previousClickPosition = pos;
    }

    if (this.started
      && this.player
      && !this.isZoning()
      && !this.isZoningTile(this.player.nextGridX, this.player.nextGridY)
      && !this.player.isDead
      && !this.hoveringCollidingTile
      && !this.hoveringPlateauTile) {
      entity = this.getEntityAt(pos.x, pos.y);
      console.log('[Click Debug] Position:', pos.x, pos.y, 'Entity:', entity ? entity.kind : null, 'isChest:', entity instanceof Chest, 'constructor:', entity ? entity.constructor.name : null);

      if (entity instanceof Mob) {
        this.makePlayerAttack(entity);
      }
      else if (entity instanceof Chest) {
        // Check Chest BEFORE Item since Chest extends Item
        const isAdjacent = this.player.isAdjacentNonDiagonal(entity);
        console.log('[Chest Debug] Player at:', this.player.gridX, this.player.gridY, 'Chest at:', entity.gridX, entity.gridY, 'Adjacent:', isAdjacent);
        if (isAdjacent === false) {
          this.makePlayerOpenChest(entity);
        } else {
          console.log('[Chest Debug] Sending OPEN to server for chest:', entity.id);
          this.client.sendOpen(entity);
          this.audioManager.playSound('chest');
        }
      }
      else if (entity instanceof Item) {
        this.makePlayerGoToItem(entity);
      }
      else if (entity instanceof Npc) {
        if (this.player.isAdjacentNonDiagonal(entity) === false) {
          this.makePlayerTalkTo(entity);
        } else {
          this.makeNpcTalk(entity);
        }
      }
      else {
        this.makePlayerGoTo(pos.x, pos.y);
      }
    }
  }

  isMobOnSameTile(mob, x?, y?) {
    return this.gridManager?.isMobOnSameTile(mob, x, y) ?? false;
  }

  getFreeAdjacentNonDiagonalPosition(entity) {
    var self = this,
      result = null;

    entity.forEachAdjacentNonDiagonalPosition(function (x, y, orientation) {
      if (!result && !self.map.isColliding(x, y) && !self.isMobAt(x, y)) {
        result = {x: x, y: y, o: orientation};
      }
    });
    return result;
  }

  tryMovingToADifferentTile(character) {
    var attacker = character,
      target = character.target;

    if (attacker && target && target instanceof Player) {
      if (!target.isMoving() && attacker.getDistanceToEntity(target) === 0) {
        var pos;

        switch (target.orientation) {
          case Types.Orientations.UP:
            pos = {x: target.gridX, y: target.gridY - 1, o: target.orientation};
            break;
          case Types.Orientations.DOWN:
            pos = {x: target.gridX, y: target.gridY + 1, o: target.orientation};
            break;
          case Types.Orientations.LEFT:
            pos = {x: target.gridX - 1, y: target.gridY, o: target.orientation};
            break;
          case Types.Orientations.RIGHT:
            pos = {x: target.gridX + 1, y: target.gridY, o: target.orientation};
            break;
        }

        if (pos) {
          attacker.previousTarget = target;
          attacker.disengage();
          attacker.idle();
          this.makeCharacterGoTo(attacker, pos.x, pos.y);
          target.adjacentTiles[pos.o] = true;

          return true;
        }
      }

      if (!target.isMoving() && attacker.isAdjacentNonDiagonal(target) && this.isMobOnSameTile(attacker)) {
        var pos = this.getFreeAdjacentNonDiagonalPosition(target);

        // avoid stacking mobs on the same tile next to a player
        // by making them go to adjacent tiles if they are available
        if (pos && !target.adjacentTiles[pos.o]) {
          if (this.player.target && attacker.id === this.player.target.id) {
            return false; // never unstack the player's target
          }

          attacker.previousTarget = target;
          attacker.disengage();
          attacker.idle();
          this.makeCharacterGoTo(attacker, pos.x, pos.y);
          target.adjacentTiles[pos.o] = true;

          return true;
        }
      }
    }
    return false;
  }

  /**
   *
   */
  onCharacterUpdate(character) {
    var time = this.currentTime,
      self = this;

    // If mob has finished moving to a different tile in order to avoid stacking, attack again from the new position.
    if (character.previousTarget && !character.isMoving() && character instanceof Mob) {
      var t = character.previousTarget;

      if (this.getEntityById(t.id)) { // does it still exist?
        character.previousTarget = null;
        this.createAttackLink(character, t);
        return;
      }
    }

    if (character.isAttacking() && !character.previousTarget) {
      var isMoving = this.tryMovingToADifferentTile(character); // Don't let multiple mobs stack on the same tile when attacking a player.

      if (character.canAttack(time)) {
        if (!isMoving) { // don't hit target if moving to a different tile.
          if (character.hasTarget() && character.getOrientationTo(character.target) !== character.orientation) {
            character.lookAtTarget();
          }

          character.hit();

          if (character.id === this.playerId) {
            this.client.sendHit(character.target);
          }

          if (character instanceof Player && this.camera.isVisible(character)) {
            this.audioManager.playSound('hit' + Math.floor(Math.random() * 2 + 1));
            // Small screen shake on hit for punch feedback
            if (character.id === this.playerId) {
              this.renderer.camera.shake(2, 50);
              // Spawn hit particles at target position
              if (character.target) {
                this.renderer.particles.spawnHitParticles(
                  character.target.x,
                  character.target.y - 8,
                  4,
                  '#ff6644'
                );
              }
            }
          }

          if (character.hasTarget() && character.target.id === this.playerId && this.player && !this.player.invincible) {
            this.client.sendHurt(character);
          }
        }
      } else {
        if (character.hasTarget()
          && character.isDiagonallyAdjacent(character.target)
          && character.target instanceof Player
          && !character.target.isMoving()) {
          character.follow(character.target);
        }
      }
    }
  }

  // Zoning methods - delegate to zoningManager
  isZoningTile(x, y) {
    return this.zoningManager?.isZoningTile(x, y) ?? false;
  }

  enqueueZoningFrom(x, y) {
    this.zoningManager?.enqueueZoningFrom(x, y);
  }

  endZoning() {
    this.zoningManager?.endZoning();
  }

  isZoning() {
    return this.zoningManager?.isZoning() ?? false;
  }

  resetZone() {
    this.zoningManager?.resetZone();
  }

  resetCamera() {
    this.camera.focusEntity(this.player);
    this.resetZone();
  }

  say(message) {
    this.client.sendChat(message);
  }

  createBubble(id, message) {
    this.bubbleManager.create(id, message, this.currentTime);
  }

  destroyBubble(id) {
    this.bubbleManager.destroyBubble(id);
  }

  assignBubbleTo(character) {
    var bubble = this.bubbleManager.getBubbleById(character.id);

    if (bubble) {
      var s = this.renderer.scale,
        t = 16 * s, // tile size
        x = ((character.x - this.camera.x) * s),
        w = parseInt(bubble.element.css('width')) + 24,
        offset = (w / 2) - (t / 2),
        offsetY,
        y;

      if (character instanceof Npc) {
        offsetY = 0;
      } else {
        if (s === 2) {
          if (this.renderer.mobile) {
            offsetY = 0;
          } else {
            offsetY = 15;
          }
        } else {
          offsetY = 12;
        }
      }

      y = ((character.y - this.camera.y) * s) - (t * 2) - offsetY;

      bubble.element.css('left', x - offset + 'px');
      bubble.element.css('top', y + 'px');
    }
  }

  restart() {
    console.debug('Beginning restart');

    this.entityManager?.clearAll();
    this.initEntityGrid();
    this.initPathingGrid();
    this.initRenderingGrid();

    this.player = new Warrior('player', this.username);
    this.initPlayer();

    this.started = true;
    this.client.enable();
    this.sendHello();

    this.storage.incrementRevives();

    if (this.renderer.mobile || this.renderer.tablet) {
      this.renderer.clearScreen(this.renderer.context);
    }

    console.debug('Finished restart');
  }

  onGameStart(callback) {
    this.gamestart_callback = callback;
  }

  onDisconnect(callback) {
    this.disconnect_callback = callback;
  }

  onPlayerDeath(callback) {
    this.playerdeath_callback = callback;
  }

  onPlayerHealthChange(callback) {
    this.playerhp_callback = callback;
  }

  onPlayerHurt(callback) {
    this.playerhurt_callback = callback;
  }

  onPlayerEquipmentChange(callback) {
    this.equipment_callback = callback;
  }

  onNbPlayersChange(callback) {
    this.nbplayers_callback = callback;
  }

  onNotification(callback) {
    this.notification_callback = callback;
  }

  onPlayerInvincible(callback) {
    this.invincible_callback = callback
  }

  onPlayerXpChange(callback) {
    this.playerxp_callback = callback;
  }

  onPlayerLevelUp(callback) {
    this.levelup_callback = callback;
  }

  onPlayerGoldChange(callback) {
    this.playergold_callback = callback;
  }

  resize() {
    var x = this.camera.x,
      y = this.camera.y,
      currentScale = this.renderer.scale,
      newScale = this.renderer.getScaleFactor();

    this.renderer.rescale(newScale);
    this.camera = this.renderer.camera;
    this.camera.setPosition(x, y);

    this.renderer.renderStaticCanvases();
  }

  updateBars() {
    if (this.player && this.playerhp_callback) {
      this.playerhp_callback(this.player.hitPoints, this.player.maxHitPoints);
    }
  }

  getDeadMobPosition(mobId) {
    return this.entityManager?.getDeadMobPosition(mobId);
  }

  onAchievementUnlock(callback) {
    this.unlock_callback = callback;
  }

  tryUnlockingAchievement(name) {
    var achievement = null;
    if (name in this.achievements) {
      achievement = this.achievements[name];

      if (achievement.isCompleted() && this.storage.unlockAchievement(achievement.id)) {
        if (this.unlock_callback) {
          this.unlock_callback(achievement.id, achievement.name, achievement.desc);
          this.audioManager.playSound('achievement');
        }
      }
    }
  }

  showNotification(message: string) {
    this.uiManager?.showNotification(message);
  }

  showNarratorText(text: string, style: string = 'epic') {
    this.uiManager?.showNarratorText(text, style as any);
  }

  showNewspaper(headlines: string[]) {
    this.uiManager?.showNewspaper(headlines);
  }

  hideNewspaper() {
    this.uiManager?.hideNewspaper();
  }

  toggleNewspaper() {
    this.uiManager?.toggleNewspaper();
  }

  dropCurrentWeapon() {
    console.log('[Drop] dropCurrentWeapon called, player:', this.player ? this.player.getWeaponName() : 'no player');
    if (this.player && this.player.getWeaponName() !== 'sword1') {
      console.log('[Drop] Sending DROP_ITEM message for weapon');
      this.client.sendDropItem('weapon');
      this.showNotification('Dropped weapon');
    } else {
      console.log('[Drop] Cannot drop - either no player or weapon is default sword1');
    }
  }

  requestNews() {
    this.uiManager?.requestNews();
  }

  removeObsoleteEntities() {
    this.entityManager?.removeObsoleteEntities(this.player.id);
  }

  /**
   * Fake a mouse move event in order to update the cursor.
   *
   * For instance, to get rid of the sword cursor in case the mouse is still hovering over a dying mob.
   * Also useful when the mouse is hovering a tile where an item is appearing.
   */
  updateCursor() {
    this.movecursor();
    this.updateCursorLogic();
  }

  /**
   * Change player plateau mode when necessary
   */
  updatePlateauMode() {
    if (this.map.isPlateau(this.player.gridX, this.player.gridY)) {
      this.player.isOnPlateau = true;
    } else {
      this.player.isOnPlateau = false;
    }
  }

  updatePlayerCheckpoint() {
    var checkpoint = this.map.getCurrentCheckpoint(this.player);

    if (checkpoint) {
      var lastCheckpoint = this.player.lastCheckpoint;
      if (!lastCheckpoint || (lastCheckpoint && lastCheckpoint.id !== checkpoint.id)) {
        this.player.lastCheckpoint = checkpoint;
        this.client.sendCheck(checkpoint.id);
      }
    }
  }

  checkUndergroundAchievement() {
    var music = this.audioManager.getSurroundingMusic(this.player);

    if (music) {
      if (music.name === 'cave') {
        this.tryUnlockingAchievement('UNDERGROUND');
      }
    }
  }

  forEachEntityAround(x, y, r, callback) {
    this.gridManager?.forEachEntityAround(x, y, r, callback);
  }

  checkOtherDirtyRects(r1, source, x, y) {
    var r = this.renderer;

    this.forEachEntityAround(x, y, 2, function (e2) {
      if (source && source.id && e2.id === source.id) {
        return;
      }
      if (!e2.isDirty) {
        var r2 = r.getEntityBoundingRect(e2);
        if (r.isIntersecting(r1, r2)) {
          e2.setDirty();
        }
      }
    });

    if (source && !(source.hasOwnProperty('index'))) {
      this.forEachAnimatedTile(function (tile) {
        if (!tile.isDirty) {
          var r2 = r.getTileBoundingRect(tile);
          if (r.isIntersecting(r1, r2)) {
            tile.isDirty = true;
          }
        }
      });
    }

    if (!this.drawTarget && this.selectedCellVisible) {
      var targetRect = r.getTargetBoundingRect();
      if (r.isIntersecting(r1, targetRect)) {
        this.drawTarget = true;
        this.renderer.targetRect = targetRect;
      }
    }
  }

  /**
   * Shows the daily reward popup with streak flames
   */
  showDailyRewardPopup(gold: number, xp: number, streak: number) {
    const popup = document.getElementById('daily-reward-popup');
    if (!popup) return;

    // Update the popup content
    const streakEl = document.getElementById('daily-streak');
    const goldEl = document.getElementById('daily-gold-amount');
    const xpEl = document.getElementById('daily-xp-amount');
    const flamesEl = document.getElementById('streak-flames');

    if (streakEl) streakEl.textContent = streak.toString();
    if (goldEl) goldEl.textContent = gold.toString();
    if (xpEl) xpEl.textContent = xp.toString();

    // Add flames based on streak (cap at 7)
    if (flamesEl) {
      const flameCount = Math.min(streak, 7);
      flamesEl.innerHTML = Array(flameCount).fill('🔥').join('');
    }

    // Show the popup
    popup.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
      popup.classList.remove('show');
    }, 3000);

    console.info('[Daily] Reward popup shown: +' + gold + 'g, +' + xp + ' XP, streak: ' + streak);
  }

  // Shop system
  currentShopNpcKind: number | null = null;
  currentShopItems: Array<{ itemKind: number; price: number; stock: number }> = [];

  showShop(npcKind: number, shopName: string, items: Array<{ itemKind: number; price: number; stock: number }>) {
    const popup = document.getElementById('shop-popup');
    if (!popup) return;

    this.currentShopNpcKind = npcKind;
    this.currentShopItems = items;

    // Update shop name
    const nameEl = document.getElementById('shop-name');
    if (nameEl) nameEl.textContent = shopName;

    // Update player gold
    const goldEl = document.getElementById('shop-player-gold');
    if (goldEl) goldEl.textContent = this.playerGold.toString();

    // Populate items
    const itemsList = document.getElementById('shop-items-list');
    if (itemsList) {
      itemsList.innerHTML = '';

      items.forEach(item => {
        const itemName = Types.getKindAsString(item.itemKind);
        const displayName = this.getItemDisplayName(item.itemKind);
        const canAfford = this.playerGold >= item.price;
        const inStock = item.stock !== 0;

        const itemEl = document.createElement('div');
        itemEl.className = 'shop-item';
        itemEl.innerHTML = `
          <div class="shop-item-icon" style="background-image: url('img/2/item-${itemName}.png')"></div>
          <div class="shop-item-info">
            <div class="shop-item-name">${displayName}</div>
            <div class="shop-item-stock ${item.stock !== -1 && item.stock <= 2 ? 'limited' : ''}">
              ${item.stock === -1 ? 'In Stock' : item.stock === 0 ? 'Out of Stock' : `${item.stock} left`}
            </div>
          </div>
          <div class="shop-item-price">${item.price}g</div>
          <button class="shop-buy-btn" data-item="${item.itemKind}" ${!canAfford || !inStock ? 'disabled' : ''}>
            ${!inStock ? 'Sold' : !canAfford ? 'Need Gold' : 'Buy'}
          </button>
        `;
        itemsList.appendChild(itemEl);
      });

      // Add click handlers for buy buttons
      itemsList.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const target = e.target as HTMLButtonElement;
          const itemKind = parseInt(target.dataset.item || '0', 10);
          if (itemKind && this.currentShopNpcKind !== null) {
            this.client.sendShopBuy(this.currentShopNpcKind, itemKind);
          }
        });
      });
    }

    // Clear message
    const msgEl = document.getElementById('shop-message');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.className = '';
    }

    // Show popup
    popup.classList.add('active');

    // Add close button handler
    const closeBtn = popup.querySelector('.shop-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideShop(), { once: true });
    }

    // Close on clicking outside
    popup.addEventListener('click', (e) => {
      if (e.target === popup) this.hideShop();
    }, { once: true });

    console.info('[Shop] Opened:', shopName, 'with', items.length, 'items');
  }

  hideShop() {
    const popup = document.getElementById('shop-popup');
    if (popup) {
      popup.classList.remove('active');
    }
    this.currentShopNpcKind = null;
    this.currentShopItems = [];
  }

  handleShopBuyResult(success: boolean, itemKind: number, newGold: number, message: string) {
    try {
      const msgEl = document.getElementById('shop-message');
      if (msgEl) {
        msgEl.textContent = message;
        msgEl.className = success ? '' : 'error';
      }

      if (success) {
        // Update gold
        this.playerGold = newGold;
        if (this.playergold_callback) {
          this.playergold_callback(newGold);
        }
        this.storage.saveGold(newGold);

        // Update gold display in shop
        const goldEl = document.getElementById('shop-player-gold');
        if (goldEl) goldEl.textContent = newGold.toString();

        // Refresh shop to update button states and stock
        if (this.currentShopNpcKind !== null) {
          // Update local stock
          const item = this.currentShopItems.find(i => i.itemKind === itemKind);
          if (item && item.stock > 0) {
            item.stock--;
          }

          // Re-render buttons
          this.updateShopButtons();
        }

        // Play sound
        if (this.audioManager) {
          this.audioManager.playSound('loot');
        }
      }
    } catch (e) {
      console.error('[Shop] Error handling buy result:', e);
    }
  }

  updateShopButtons() {
    const itemsList = document.getElementById('shop-items-list');
    if (!itemsList) return;

    itemsList.querySelectorAll('.shop-item').forEach((itemEl, index) => {
      const item = this.currentShopItems[index];
      if (!item) return;

      const btn = itemEl.querySelector('.shop-buy-btn') as HTMLButtonElement;
      const stockEl = itemEl.querySelector('.shop-item-stock');

      if (btn) {
        const canAfford = this.playerGold >= item.price;
        const inStock = item.stock !== 0;
        btn.disabled = !canAfford || !inStock;
        btn.textContent = !inStock ? 'Sold' : !canAfford ? 'Need Gold' : 'Buy';
      }

      if (stockEl) {
        stockEl.textContent = item.stock === -1 ? 'In Stock' : item.stock === 0 ? 'Out of Stock' : `${item.stock} left`;
        stockEl.className = 'shop-item-stock' + (item.stock !== -1 && item.stock <= 2 ? ' limited' : '');
      }
    });
  }

  getItemDisplayName(itemKind: number): string {
    const kindString = Types.getKindAsString(itemKind);
    // Convert camelCase/lowercase to Title Case
    const words = kindString.replace(/([A-Z])/g, ' $1').toLowerCase().split(/[\s_-]+/);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
