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
import {ClientEvents} from './network/client-events';
import {Mobs} from './entity/character/mob/mobs';
import {Exceptions} from './exceptions';
import _ from 'lodash';
import {Entity} from './entity/entity';
import {Renderer} from './renderer/renderer';
import {GridManager} from './world/grid-manager';
import {EntityManager} from './entities/entity-manager';
import {InputManager} from './input/input-manager';
import {UIManager} from './ui/ui-manager';
import {ItemTooltip} from './ui/item-tooltip';
import {PartyUI, PartyMember} from './ui/party-ui';
import {PlayerInspect} from './ui/player-inspect';
import {ContextMenu} from './ui/context-menu';
import {InventoryUI} from './ui/inventory-ui';
import {ShopUI} from './ui/shop-ui';
import {MinimapUI} from './ui/minimap-ui';
import {AchievementUI} from './ui/achievement-ui';
import {InventoryManager} from './inventory/inventory-manager';
import {deserializeInventory, InventorySlot, SerializedInventorySlot} from '../../shared/ts/inventory/inventory-types';
import {setupNetworkHandlers} from './network/message-handlers';
import {ZoningManager} from './world/zoning-manager';
import {SpriteLoader} from './assets/sprite-loader';
import {getAchievementById} from '../../shared/ts/achievements/achievement-data';
import {FractureAtmosphere} from './ui/fracture-atmosphere';
import * as AchievementHandler from './handlers/achievement.handler';
import * as ShopHandler from './handlers/shop.handler';
import * as PartyHandler from './handlers/party.handler';
import * as InventoryHandler from './handlers/inventory.handler';
import * as GameEventHandler from './handlers/game-event.handler';
import * as NetworkConnectionHandler from './handlers/network-connection.handler';

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
  uiManager: UIManager | null = null;
  itemTooltip: ItemTooltip | null = null;
  partyUI: PartyUI | null = null;
  playerInspect: PlayerInspect | null = null;
  contextMenu: ContextMenu | null = null;
  inventoryManager: InventoryManager | null = null;
  inventoryUI: InventoryUI | null = null;
  shopUI: ShopUI | null = null;
  minimapUI: MinimapUI | null = null;
  achievementUI: AchievementUI | null = null;
  zoningManager: ZoningManager | null = null;
  spriteLoader: SpriteLoader | null = null;
  fractureAtmosphere: FractureAtmosphere | null = null;

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
  password;
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

  // Achievement system
  achievementunlock_callback;
  achievementprogress_callback;
  playertitleupdate_callback;
  unlockedAchievements: string[] = [];
  achievementProgress: Record<string, { current: number; target: number }> = {};
  selectedTitle: string | null = null;
  playerTitles: Record<number, string | null> = {};

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

  setServerOptions(host, port, username, password = '') {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
  }

  loadAudio() {
    this.audioManager = new AudioManager(this);
    this.fractureAtmosphere = new FractureAtmosphere();
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

        // Initialize party UI (context menu, party panel, inspect popup)
        self.initPartyUI();

        // Initialize inventory system
        self.initInventory();

        // Initialize shop UI
        self.initShop();

        // Initialize minimap
        self.initMinimap();

        // Initialize achievements panel UI
        self.initAchievementsUI();

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

      // Update minimap
      this.minimapUI?.update();
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

    // Network connection handlers - delegated to NetworkConnectionHandler
    NetworkConnectionHandler.setupConnectionHandlers(this, this.client);

    this.client.on(ClientEvents.LIST, function (list: number[]) {
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

    this.client.on(ClientEvents.WELCOME, function (id: number, name: string, x: number, y: number, hp: number, level: number, xp: number, xpToNext: number, gold: number) {
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

      // ALWAYS use server-provided progression/gold (Phase 2 persistence)
      self.playerLevel = level;
      self.playerXp = xp;
      self.playerXpToNext = xpToNext;
      self.playerGold = gold;
      console.info('[Progression] Loaded from SERVER: Level ' + self.playerLevel + ', XP ' + self.playerXp + '/' + self.playerXpToNext + ', Gold ' + self.playerGold);

      // Sync localStorage with server data (for UI caching)
      self.storage.saveProgression(level, xp, xpToNext);
      self.storage.saveGold(gold);

      if (!self.storage.hasAlreadyPlayed()) {
        self.storage.initPlayer(self.player.name);
        self.storage.savePlayer(self.renderer.getPlayerImage(),
          self.player.getSpriteName(),
          self.player.getWeaponName());
        self.showNotification('Welcome to Fracture!');
        // First-time player hints
        self.showFirstTimeHints();
        // Auto-show minimap for new players
        self.initMinimap();
      } else {
        self.showNotification('Welcome back to Fracture!');
        self.storage.setPlayerName(name);
      }

      // Update UI with server progression
      if (self.playerxp_callback) {
        self.playerxp_callback(self.playerXp, self.playerXpToNext, self.playerLevel);
      }
      if (self.playergold_callback) {
        self.playergold_callback(self.playerGold);
      }

      // Send daily check to server (still uses localStorage for streak continuity)
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

          // Send pickup request to server - item goes to inventory
          self.pickupItemToInventory(item);
          self.audioManager.playSound('loot');
        }

        if (!self.player.hasTarget() && self.map.isDoor(x, y)) {
          var dest = self.map.getDoorDestination(x, y);

          self.player.setGridPosition(dest.x, dest.y);
          self.player.nextGridX = dest.x;
          self.player.nextGridY = dest.y;
          self.player.turnTo(dest.orientation);
          self.client.sendTeleport(dest.x, dest.y);

          // Determine if entering or exiting a building interior
          // Doors with cameraX/cameraY are entry points to interiors
          var enteringInterior = dest.cameraX !== undefined && dest.cameraY !== undefined;
          var modeChanged = self.camera.indoorMode !== enteringInterior;
          self.camera.setIndoorMode(enteringInterior);

          // Clear all canvases when switching between indoor/outdoor mode
          if (modeChanged) {
            self.renderer.clearScreen(self.renderer.context);
            self.renderer.clearScreen(self.renderer.background);
            self.renderer.clearScreen(self.renderer.foreground);
          }

          if (enteringInterior) {
            // Use explicit camera position from door definition
            self.camera.setGridPosition(dest.cameraX, dest.cameraY);
          } else {
            if (dest.portal) {
              self.assignBubbleTo(self.player);
            } else {
              // Center camera on player
              self.camera.lookAt(self.player);
            }
          }

          // Always reset zone after door transition to redraw static canvases
          self.resetZone();

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

        // Trigger fracture death effects
        if (self.fractureAtmosphere) {
          self.fractureAtmosphere.onPlayerDeath();
        }
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
    this.client.sendHello(player || this.player, gold, this.password || '');
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
   * Move player one tile in a direction (for WASD/Arrow key controls)
   * @param dx Direction on X axis (-1 = left, 1 = right, 0 = none)
   * @param dy Direction on Y axis (-1 = up, 1 = down, 0 = none)
   */
  movePlayerInDirection(dx: number, dy: number) {
    if (!this.player || this.player.isDead) return;

    // Block movement during zone transition to prevent camera desync
    if (this.zoningManager?.isZoning()) return;

    const targetX = this.player.gridX + dx;
    const targetY = this.player.gridY + dy;

    // Check for entity at target position and interact if present
    const entity = this.getEntityAt(targetX, targetY);
    if (entity) {
      // Interact with entity instead of moving
      if (entity instanceof Mob) {
        this.makePlayerAttack(entity);
        return;
      }
      else if (entity instanceof Chest) {
        this.client.sendOpen(entity);
        this.audioManager.playSound('chest');
        return;
      }
      else if (entity instanceof Item) {
        this.makePlayerGoToItem(entity);
        return;
      }
      else if (entity instanceof Npc) {
        this.makeNpcTalk(entity);
        return;
      }
      else if (entity instanceof Player && entity.id !== this.playerId) {
        // Another player - request inspect data from server
        this.client.sendPlayerInspect(entity.id);
        return;
      }
      // Other entities block movement
      return;
    }

    // Check if target is walkable
    if (this.map && this.map.isColliding(targetX, targetY)) {
      return; // Can't walk into walls
    }

    // Check plateau restrictions
    if (this.map) {
      const playerOnPlateau = this.player.isOnPlateau;
      const targetOnPlateau = this.map.isPlateau(targetX, targetY);
      if (playerOnPlateau !== targetOnPlateau) {
        return; // Can't cross plateau boundary directly
      }
    }

    this.makePlayerGoTo(targetX, targetY);
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
    // Don't attack dying/dead mobs (prevents immortal mob bug)
    if (mob.isDying || mob.isDead) {
      return;
    }
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
      this.showBubbleFor(npc, '...');

      // Request AI-generated dialogue from server
      this.client.sendNpcTalk(npc.kind);

      // Fallback: if no response in 5 seconds, use static dialogue
      setTimeout(function() {
        if (self.currentNpcTalk === npc) {
          self.currentNpcTalk = null;
          var msg = npc.talk();
          if (msg) {
            self.showBubbleFor(npc, msg);
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
    return this.gridManager?.getEntityAt(x, y) ?? null;
  }

  getMobAt(x, y) {
    return this.gridManager?.getMobAt(x, y) ?? null;
  }

  getNpcAt(x, y) {
    return this.gridManager?.getNpcAt(x, y) ?? null;
  }

  getChestAt(x, y) {
    return this.gridManager?.getChestAt(x, y) ?? null;
  }

  getItemAt(x, y) {
    return this.gridManager?.getItemAt(x, y) ?? null;
  }

  /**
   * Returns true if an entity is located at the given position on the world grid.
   */
  isEntityAt(x, y) {
    return this.gridManager?.isEntityAt(x, y) ?? false;
  }

  isMobAt(x, y) {
    return this.gridManager?.isMobAt(x, y) ?? false;
  }

  isItemAt(x, y) {
    return this.gridManager?.isItemAt(x, y) ?? false;
  }

  isNpcAt(x, y) {
    return this.gridManager?.isNpcAt(x, y) ?? false;
  }

  isChestAt(x, y) {
    return this.gridManager?.isChestAt(x, y) ?? false;
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
            // Don't send HIT for dying/dead targets
            if (character.target && !character.target.isDying && !character.target.isDead) {
              this.client.sendHit(character.target);
            } else if (character.target && (character.target.isDying || character.target.isDead)) {
              // Target died, disengage
              character.disengage();
            }
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

  /**
   * Creates a speech bubble for a character and positions it correctly.
   * Consolidates the common createBubble + assignBubbleTo pattern.
   */
  showBubbleFor(character, message) {
    this.createBubble(character.id, message);
    this.assignBubbleTo(character);
  }

  assignBubbleTo(character) {
    var bubble = this.bubbleManager.getBubbleById(character.id);

    if (bubble) {
      // Check if character is visible on screen - hide bubble if not
      if (!this.camera.isVisible(character)) {
        bubble.element.css('display', 'none');
        return;
      }

      var s = this.renderer.scale,
        t = 16 * s, // tile size in canvas buffer pixels
        // Calculate position in canvas buffer coordinates
        bufferX = ((character.x - this.camera.x) * s),
        bufferY = ((character.y - this.camera.y) * s),
        w = parseInt(bubble.element.css('width')) + 24,
        offset = (w / 2) - (t / 2),
        offsetY;

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

      // Apply vertical offset for bubble placement above character head
      bufferY = bufferY - (t * 1.25) - offsetY;

      // Scale from canvas buffer coordinates to viewport coordinates
      // Canvas is stretched from buffer size to viewport size via CSS
      const canvasWidth = this.renderer.canvas.width;
      const canvasHeight = this.renderer.canvas.height;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const scaleX = viewportWidth / canvasWidth;
      const scaleY = viewportHeight / canvasHeight;

      const x = (bufferX - offset) * scaleX;
      const y = bufferY * scaleY;

      // Bounds check - ensure bubble stays within viewport
      if (y < -50 || y > viewportHeight) {
        bubble.element.css('display', 'none');
        return;
      }

      // Show bubble and position it
      bubble.element.css('display', 'block');
      bubble.element.css('left', x + 'px');
      bubble.element.css('top', y + 'px');
    }
  }

  restart() {
    console.debug('Beginning restart');

    // Reset camera to outdoor mode (fixes viewport stuck small after dying in building)
    this.camera.setIndoorMode(false);
    this.camera.rescale();

    // Clear all bubbles
    this.bubbleManager.clean();

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

    // Clear screen on all devices for clean restart
    this.renderer.clearScreen(this.renderer.context);

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

  // Achievement system callbacks
  onAchievementUnlockNotify(callback) {
    this.achievementunlock_callback = callback;
  }

  onAchievementProgress(callback) {
    this.achievementprogress_callback = callback;
  }

  onPlayerTitleChange(callback) {
    this.playertitleupdate_callback = callback;
  }

  // Achievement handlers - Delegated to AchievementHandler
  handleAchievementInit(unlockedIds: string[], progressMap: Record<string, { current: number; target: number }>, selectedTitle: string | null) {
    AchievementHandler.handleAchievementInit(this, unlockedIds, progressMap, selectedTitle);
  }

  handleAchievementUnlock(achievementId: string) {
    AchievementHandler.handleAchievementUnlock(this, achievementId);
  }

  handleAchievementProgress(achievementId: string, current: number, target: number) {
    AchievementHandler.handleAchievementProgress(this, achievementId, current, target);
  }

  handlePlayerTitleUpdate(playerId: number, title: string | null) {
    AchievementHandler.handlePlayerTitleUpdate(this, playerId, title);
  }

  selectTitle(achievementId: string) {
    if (this.client) {
      this.client.sendSelectTitle(achievementId);
    }
  }

  getPlayerTitle(playerId: number): string | null {
    return AchievementHandler.getPlayerTitle(this, playerId);
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

  /**
   * Show first-time player hints with delays
   */
  showFirstTimeHints() {
    const hints = [
      { delay: 2000, message: 'Click anywhere to move' },
      { delay: 5000, message: 'Press I for inventory' },
      { delay: 8000, message: 'Press Q for quick heal' },
      { delay: 11000, message: 'Press ? for all controls' }
    ];

    hints.forEach(hint => {
      setTimeout(() => {
        this.showNotification(hint.message);
      }, hint.delay);
    });
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

  // Shop system - Delegated to ShopHandler
  initShop() {
    this.shopUI = ShopHandler.initShop(this);
  }

  showShop(npcKind: number, shopName: string, items: Array<{ itemKind: number; price: number; stock: number }>) {
    ShopHandler.showShop(this, npcKind, shopName, items);
  }

  hideShop() {
    ShopHandler.hideShop(this);
  }

  handleShopBuyResult(success: boolean, itemKind: number, newGold: number, message: string) {
    ShopHandler.handleShopBuyResult(this, success, itemKind, newGold, message);
  }

  handleShopSellResult(success: boolean, goldGained: number, newGold: number, message: string) {
    ShopHandler.handleShopSellResult(this, success, goldGained, newGold, message);
  }

  // Party System - Delegated to PartyHandler
  initPartyUI() {
    const result = PartyHandler.initPartyUI(this);
    this.partyUI = result.partyUI;
    this.playerInspect = result.playerInspect;
    this.contextMenu = result.contextMenu;
  }

  handlePartyInvite(inviterId: number, inviterName: string) {
    PartyHandler.handlePartyInvite(this, inviterId, inviterName);
  }

  handlePartyJoin(partyId: string, members: PartyMember[], leaderId: number) {
    PartyHandler.handlePartyJoin(this, partyId, members, leaderId);
  }

  handlePartyLeave(playerId: number) {
    PartyHandler.handlePartyLeave(this, playerId);
  }

  handlePartyDisband() {
    PartyHandler.handlePartyDisband(this);
  }

  handlePartyUpdate(members: PartyMember[]) {
    PartyHandler.handlePartyUpdate(this, members);
  }

  handlePartyChat(senderId: number, senderName: string, message: string) {
    PartyHandler.handlePartyChat(this, senderId, senderName, message);
  }

  handlePlayerInspectResult(playerId: number, name: string, title: string | null, level: number, weapon: number, armor: number) {
    PartyHandler.handlePlayerInspectResult(this, playerId, name, title, level, weapon, armor);
  }

  showPlayerContextMenu(playerId: number, playerName: string, screenX: number, screenY: number) {
    PartyHandler.showPlayerContextMenu(this, playerId, playerName, screenX, screenY);
  }

  rightClick(screenX: number, screenY: number): boolean {
    return PartyHandler.rightClick(this, screenX, screenY);
  }

  // Inventory System - Delegated to InventoryHandler
  initInventory() {
    const result = InventoryHandler.initInventory(this);
    this.inventoryManager = result.manager;
    this.inventoryUI = result.ui;
  }

  toggleInventory() {
    if (!this.inventoryUI) {
      this.initInventory();
    }
    InventoryHandler.toggleInventory(this);
  }

  useInventorySlot(slotIndex: number) {
    InventoryHandler.useInventorySlot(this, slotIndex);
  }

  useFirstConsumable() {
    InventoryHandler.useFirstConsumable(this);
  }

  initMinimap() {
    if (this.minimapUI) return;

    this.minimapUI = new MinimapUI();
    this.minimapUI.setCallbacks({
      getMap: () => this.map,
      getPlayer: () => this.player,
      getCamera: () => this.camera,
      forEachEntity: (callback) => this.forEachEntity(callback),
      onClickPosition: (gridX, gridY) => {
        if (this.player && this.started) {
          this.makePlayerGoTo(gridX, gridY);
        }
      }
    });

    console.info('[Minimap] Initialized with click-to-walk');
  }

  toggleMinimap() {
    if (!this.minimapUI) {
      this.initMinimap();
    }
    this.minimapUI?.toggle();
  }

  handleInventoryInit(serializedSlots: (SerializedInventorySlot | null)[]) {
    InventoryHandler.handleInventoryInit(this, serializedSlots);
  }

  handleInventoryAdd(slotIndex: number, kind: number, properties: Record<string, unknown> | null, count: number) {
    InventoryHandler.handleInventoryAdd(this, slotIndex, kind, properties, count);
  }

  handleInventoryRemove(slotIndex: number) {
    InventoryHandler.handleInventoryRemove(this, slotIndex);
  }

  handleInventoryUpdate(slotIndex: number, count: number) {
    InventoryHandler.handleInventoryUpdate(this, slotIndex, count);
  }

  pickupItemToInventory(item: Item) {
    InventoryHandler.pickupItemToInventory(this, item?.id);
  }

  // ============================================================================
  // ZONE SYSTEM HANDLERS
  // ============================================================================

  // Current zone tracking
  currentZone: { id: string; name: string; minLevel: number; maxLevel: number } | null = null;

  // Zone System - Delegated to GameEventHandler
  handleZoneEnter(zoneId: string, zoneName: string, minLevel: number, maxLevel: number, warning: string | null) {
    this.currentZone = GameEventHandler.handleZoneEnter(this, zoneId, zoneName, minLevel, maxLevel, warning);
  }

  handleZoneInfo(zoneId: string, rarityBonus: number, goldBonus: number, xpBonus: number) {
    GameEventHandler.handleZoneInfo(this, zoneId, rarityBonus, goldBonus, xpBonus);
  }

  // Boss/Kill Events - Delegated to GameEventHandler
  handleLeaderboardResponse(entries: Array<{ rank: number; name: string; kills: number }>) {
    GameEventHandler.handleLeaderboardResponse(this, entries);
  }

  handleBossKill(bossName: string, killerName: string) {
    GameEventHandler.handleBossKill(this, bossName, killerName);
  }

  handleKillStreak(playerId: number, playerName: string, streakCount: number, tierTitle: string, announcement: string) {
    GameEventHandler.handleKillStreak(this, playerId, playerName, streakCount, tierTitle, announcement);
  }

  handleKillStreakEnded(playerId: number, playerName: string, streakCount: number, endedByName: string) {
    GameEventHandler.handleKillStreakEnded(this, playerId, playerName, streakCount, endedByName);
  }

  handleNemesisPowerUp(mobId: number, originalName: string, nemesisName: string, title: string, powerLevel: number, kills: number, victimName: string) {
    GameEventHandler.handleNemesisPowerUp(this, mobId, originalName, nemesisName, title, powerLevel, kills, victimName);
  }

  handleNemesisKilled(mobId: number, nemesisName: string, title: string, kills: number, killerName: string, isRevenge: boolean) {
    GameEventHandler.handleNemesisKilled(this, mobId, nemesisName, title, kills, killerName, isRevenge);
  }

  // Achievement Panel UI
  initAchievementsUI() {
    if (this.achievementUI) return;

    this.achievementUI = new AchievementUI();
    this.achievementUI.setOnSelectTitle((achievementId: string | null) => {
      // Send title selection to server
      if (this.client) {
        this.client.sendSelectTitle(achievementId);
      }
    });

    console.info('[Achievements] Panel UI initialized');
  }

  toggleAchievements() {
    if (!this.achievementUI) {
      this.initAchievementsUI();
    }
    this.achievementUI?.toggle();
  }
}
