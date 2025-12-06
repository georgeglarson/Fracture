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
import {Transition} from './utils/transition';
import {Mobs} from './entity/character/mob/mobs';
import {Exceptions} from './exceptions';
import _ from 'lodash';
import {Entity} from './entity/entity';
import {Renderer} from './renderer/renderer';
import {GridManager} from './world/grid-manager';
import {EntityManager} from './entities/entity-manager';

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

  // Entity accessors (delegate to entityManager)
  get entities() { return this.entityManager?.entities ?? {}; }
  get deathpositions() { return this.entityManager?.deathpositions ?? {}; }

  // Grid accessors (delegate to gridManager)
  get entityGrid() { return this.gridManager?.entityGrid ?? null; }
  get pathingGrid() { return this.gridManager?.pathingGrid ?? null; }
  get renderingGrid() { return this.gridManager?.renderingGrid ?? null; }
  get itemGrid() { return this.gridManager?.itemGrid ?? null; }
  currentCursor = null;
  currentCursorOrientation;
  mouse = {x: 0, y: 0};
  zoningQueue = [];
  previousClickPosition: any = {};

  selectedX = 0;
  selectedY = 0;
  selectedCellVisible = false;
  targetColor = 'rgba(255, 255, 255, 0.5)';
  targetCellVisible = true;
  hoveringTarget = false;
  hoveringMob = false;
  hoveringItem = false;
  hoveringCollidingTile = false;


  currentZoning = null;

  cursors = {};

  sprites = {};

  // tile animation
  animatedTiles = null;

  // debug
  debugPathing = false;

  // sprites
  spriteNames = ['hand', 'sword', 'loot', 'target', 'talk', 'sparks', 'shadow16', 'rat', 'skeleton', 'skeleton2', 'spectre', 'boss', 'deathknight',
    'ogre', 'crab', 'snake', 'eye', 'bat', 'goblin', 'wizard', 'guard', 'king', 'villagegirl', 'villager', 'coder', 'agent', 'rick', 'scientist', 'nyan', 'priest',
    'sorcerer', 'octocat', 'beachnpc', 'forestnpc', 'desertnpc', 'lavanpc', 'clotharmor', 'leatherarmor', 'mailarmor',
    'platearmor', 'redarmor', 'goldenarmor', 'firefox', 'death', 'sword1', 'axe', 'chest',
    'sword2', 'redsword', 'bluesword', 'goldensword', 'item-sword2', 'item-axe', 'item-redsword', 'item-bluesword', 'item-goldensword', 'item-leatherarmor', 'item-mailarmor',
    'item-platearmor', 'item-redarmor', 'item-goldenarmor', 'item-flask', 'item-cake', 'item-burger', 'morningstar', 'item-morningstar', 'item-firepotion'];

  map;
  targetAnimation: Animation;
  sparksAnimation: Animation;
  storage: Storage;
  shadows;
  achievements;
  spritesets;
  currentTime;

  hoveringNpc;
  hoveringChest;
  lastHovered;
  hoveringPlateauTile;
  camera: Camera;

  host;
  port;
  username;
  isStopped;
  drawTarget;
  client;
  playerId;
  clearTarget;
  zoningOrientation;

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
    this.shadows = {};
    this.shadows['small'] = this.sprites['shadow16'];
  }

  initCursors() {
    this.cursors['hand'] = this.sprites['hand'];
    this.cursors['sword'] = this.sprites['sword'];
    this.cursors['loot'] = this.sprites['loot'];
    this.cursors['target'] = this.sprites['target'];
    this.cursors['arrow'] = this.sprites['arrow'];
    this.cursors['talk'] = this.sprites['talk'];
  }

  initAnimations() {
    this.targetAnimation = new Animation('idle_down', 4, 0, 16, 16);
    this.targetAnimation.setSpeed(50);

    this.sparksAnimation = new Animation('idle_down', 6, 0, 16, 16);
    this.sparksAnimation.setSpeed(120);
  }

  initHurtSprites() {
    var self = this;

    Types.forEachArmorKind(function (kind, kindName) {
      self.sprites[kindName].createHurtSprite();
    });
  }

  initSilhouettes() {
    var self = this;

    Types.forEachMobOrNpcKind(function (kind, kindName) {
      self.sprites[kindName].createSilhouette();
    });
    self.sprites['chest'].createSilhouette();
    self.sprites['item-cake'].createSilhouette();
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

  loadSprite(name) {
    if (this.renderer.upscaledRendering) {
      this.spritesets[0][name] = new Sprite(name, 1);
    } else {
      this.spritesets[1][name] = new Sprite(name, 2);
      if (!this.renderer.mobile && !this.renderer.tablet) {
        this.spritesets[2][name] = new Sprite(name, 3);
      }
    }
  }

  setSpriteScale(scale) {
    var self = this;

    if (this.renderer.upscaledRendering) {
      this.sprites = this.spritesets[0];
    } else {
      this.sprites = this.spritesets[scale - 1];

      _.each(this.entities, function (entity: Entity) {
        entity.sprite = null;
        entity.setSprite(self.sprites[entity.getSpriteName()]);
      });
      this.initHurtSprites();
      this.initShadows();
      this.initCursors();
    }
  }

  loadSprites() {
    console.info('Loading sprites...');
    this.spritesets = [];
    this.spritesets[0] = {};
    this.spritesets[1] = {};
    this.spritesets[2] = {};
    _.map(this.spriteNames, this.loadSprite, this);
  }

  spritesLoaded() {
    if (_.any(this.sprites, function (sprite: Sprite) {
        return !sprite.isLoaded;
      })) {
      return false;
    }
    return true;
  }

  setCursor(name, orientation?) {
    if (name in this.cursors) {
      this.currentCursor = this.cursors[name];
      this.currentCursorOrientation = orientation;
    } else {
      console.error('Unknown cursor name :' + name);
    }
  }

  updateCursorLogic() {
    if (this.hoveringCollidingTile && this.started) {
      this.targetColor = 'rgba(255, 50, 50, 0.5)';
    }
    else {
      this.targetColor = 'rgba(255, 255, 255, 0.5)';
    }

    if (this.hoveringMob && this.started) {
      this.setCursor('sword');
      this.hoveringTarget = false;
      this.targetCellVisible = false;
    }
    else if (this.hoveringNpc && this.started) {
      this.setCursor('talk');
      this.hoveringTarget = false;
      this.targetCellVisible = false;
    }
    else if ((this.hoveringItem || this.hoveringChest) && this.started) {
      this.setCursor('loot');
      this.hoveringTarget = false;
      this.targetCellVisible = true;
    }
    else {
      this.setCursor('hand');
      this.hoveringTarget = false;
      this.targetCellVisible = true;
    }
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

        self.setPathfinder(new Pathfinder(self.map.width, self.map.height));

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
      }

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

      self.client.onSpawnItem(function (item, x, y) {
        console.info('Spawned ' + Types.getKindAsString(item.kind) + ' (' + item.id + ') at ' + x + ', ' + y);
        self.addItem(item, x, y);
      });

      self.client.onSpawnChest(function (chest, x, y) {
        console.info('Spawned chest (' + chest.id + ') at ' + x + ', ' + y);
        chest.setSprite(self.sprites[chest.getSpriteName()]);
        chest.setGridPosition(x, y);
        chest.setAnimation('idle_down', 150);
        self.addEntity(chest);

        chest.onOpen(function () {
          // Immediately unblock the path so items can be picked up
          // The chest animation continues but doesn't block pathing
          self.removeFromPathingGrid(chest.gridX, chest.gridY);

          chest.stopBlinking();
          chest.setSprite(self.sprites['death']);
          chest.setAnimation('death', 120, 1, function () {
            console.info(chest.id + ' was removed');
            self.removeEntity(chest);
            self.removeFromRenderingGrid(chest, chest.gridX, chest.gridY);
            self.previousClickPosition = {};
          });
        });
      });

      self.client.onSpawnCharacter(function (entity, x, y, orientation, targetId) {
        if (!self.entityIdExists(entity.id)) {
          try {
            if (entity.id !== self.playerId) {
              entity.setSprite(self.sprites[entity.getSpriteName()]);
              entity.setGridPosition(x, y);
              entity.setOrientation(orientation);
              entity.idle();

              self.addEntity(entity);

              console.debug('Spawned ' + Types.getKindAsString(entity.kind) + ' (' + entity.id + ') at ' + entity.gridX + ', ' + entity.gridY);

              if (entity instanceof Character) {
                entity.onBeforeStep(function () {
                  self.unregisterEntityPosition(entity);
                });

                entity.onStep(function () {
                  if (!entity.isDying) {
                    self.registerEntityDualPosition(entity);

                    entity.forEachAttacker(function (attacker) {
                      if (attacker.isAdjacent(attacker.target)) {
                        attacker.lookAtTarget();
                      } else {
                        attacker.follow(entity);
                      }
                    });
                  }
                });

                entity.onStopPathing(function (x, y) {
                  if (!entity.isDying) {
                    if (entity.hasTarget() && entity.isAdjacent(entity.target)) {
                      entity.lookAtTarget();
                    }

                    if (entity instanceof Player) {
                      var gridX = entity.destination.gridX,
                        gridY = entity.destination.gridY;

                      if (self.map.isDoor(gridX, gridY)) {
                        var dest = self.map.getDoorDestination(gridX, gridY);
                        entity.setGridPosition(dest.x, dest.y);
                      }
                    }

                    entity.forEachAttacker(function (attacker) {
                      if (!attacker.isAdjacentNonDiagonal(entity) && attacker.id !== self.playerId) {
                        attacker.follow(entity);
                      }
                    });

                    self.unregisterEntityPosition(entity);
                    self.registerEntityPosition(entity);
                  }
                });

                entity.onRequestPath(function (x, y) {
                  var ignored = [entity], // Always ignore self
                    ignoreTarget = function (target) {
                      ignored.push(target);

                      // also ignore other attackers of the target entity
                      target.forEachAttacker(function (attacker) {
                        ignored.push(attacker);
                      });
                    };

                  if (entity.hasTarget()) {
                    ignoreTarget(entity.target);
                  } else if (entity.previousTarget) {
                    // If repositioning before attacking again, ignore previous target
                    // See: tryMovingToADifferentTile()
                    ignoreTarget(entity.previousTarget);
                  }

                  return self.findPath(entity, x, y, ignored);
                });

                entity.onDeath(function () {
                  console.info(entity.id + ' is dead');

                  if (entity instanceof Mob) {
                    // Keep track of where mobs die in order to spawn their dropped items
                    // at the right position later.
                    self.entityManager?.recordDeathPosition(entity.id, entity.gridX, entity.gridY);
                  }

                  entity.isDying = true;
                  entity.setSprite(self.sprites[entity instanceof Mobs.Rat ? 'rat' : 'death']);
                  entity.animate('death', 120, 1, function () {
                    console.info(entity.id + ' was removed');

                    self.removeEntity(entity);
                    self.removeFromRenderingGrid(entity, entity.gridX, entity.gridY);
                  });

                  entity.forEachAttacker(function (attacker) {
                    attacker.disengage();
                  });

                  if (self.player.target && self.player.target.id === entity.id) {
                    self.player.disengage();
                  }

                  // Upon death, this entity is removed from both grids, allowing the player
                  // to click very fast in order to loot the dropped item and not be blocked.
                  // The entity is completely removed only after the death animation has ended.
                  self.removeFromEntityGrid(entity, entity.gridX, entity.gridY);
                  self.removeFromPathingGrid(entity.gridX, entity.gridY);

                  if (self.camera.isVisible(entity)) {
                    self.audioManager.playSound('kill' + Math.floor(Math.random() * 2 + 1));
                  }

                  self.updateCursor();
                });

                entity.onHasMoved(function (entity) {
                  self.assignBubbleTo(entity); // Make chat bubbles follow moving entities
                });

                if (entity instanceof Mob) {
                  if (targetId) {
                    var player = self.getEntityById(targetId);
                    if (player) {
                      self.createAttackLink(entity, player);
                    }
                  }
                }
              }
            }
          }
          catch (e) {
            console.error(e);
          }
        } else {
          console.debug('Character ' + entity.id + ' already exists. Dont respawn.');
        }
      });

      self.client.onDespawnEntity(function (entityId) {
        var entity = self.getEntityById(entityId);

        if (entity) {
          console.info('Despawning ' + Types.getKindAsString(entity.kind) + ' (' + entity.id + ')');

          if (entity.gridX === self.previousClickPosition.x
            && entity.gridY === self.previousClickPosition.y) {
            self.previousClickPosition = {};
          }

          if (entity instanceof Item) {
            self.removeItem(entity);
          } else if (entity instanceof Character) {
            entity.forEachAttacker(function (attacker) {
              if (attacker.canReachTarget()) {
                attacker.hit();
              }
            });
            entity.die();
          } else if (entity instanceof Chest) {
            entity.open();
          }

          entity.clean();
        }
      });

      self.client.onItemBlink(function (id) {
        var item = self.getEntityById(id);

        if (item) {
          item.blink(150);
        }
      });

      self.client.onEntityMove(function (id, x, y) {
        var entity = null;

        if (id !== self.playerId) {
          entity = self.getEntityById(id);

          if (entity) {
            if (self.player.isAttackedBy(entity)) {
              self.tryUnlockingAchievement('COWARD');
            }
            entity.disengage();
            entity.idle();
            self.makeCharacterGoTo(entity, x, y);
          }
        }
      });

      self.client.onEntityDestroy(function (id) {
        var entity = self.getEntityById(id);
        if (entity) {
          if (entity instanceof Item) {
            self.removeItem(entity);
          } else {
            self.removeEntity(entity);
          }
          console.debug('Entity was destroyed: ' + entity.id);
        }
      });

      self.client.onPlayerMoveToItem(function (playerId, itemId) {
        var player, item;

        if (playerId !== self.playerId) {
          player = self.getEntityById(playerId);
          item = self.getEntityById(itemId);

          if (player && item) {
            self.makeCharacterGoTo(player, item.gridX, item.gridY);
          }
        }
      });

      self.client.onEntityAttack(function (attackerId, targetId) {
        var attacker = self.getEntityById(attackerId),
          target = self.getEntityById(targetId);

        if (attacker && target && attacker.id !== self.playerId) {
          console.debug(attacker.id + ' attacks ' + target.id);

          if (attacker && target instanceof Player && target.id !== self.playerId && target.target && target.target.id === attacker.id && attacker.getDistanceToEntity(target) < 3) {
            setTimeout(function () {
              self.createAttackLink(attacker, target);
            }, 200); // delay to prevent other players attacking mobs from ending up on the same tile as they walk towards each other.
          } else {
            self.createAttackLink(attacker, target);
          }
        }
      });

      self.client.onPlayerDamageMob(function (mobId, points) {
        var mob = self.getEntityById(mobId);
        if (mob && points) {
          self.infoManager.addDamageInfo(points, mob.x, mob.y - 15, 'inflicted');
        }
      });

      self.client.onPlayerKillMob(function (kind) {
        var mobName = Types.getKindAsString(kind);

        if (mobName === 'skeleton2') {
          mobName = 'greater skeleton';
        }

        if (mobName === 'eye') {
          mobName = 'evil eye';
        }

        if (mobName === 'deathknight') {
          mobName = 'death knight';
        }

        if (mobName === 'boss') {
          self.showNotification('You killed the skeleton king');
        } else {
          if (_.include(['a', 'e', 'i', 'o', 'u'], mobName[0])) {
            self.showNotification('You killed an ' + mobName);
          } else {
            self.showNotification('You killed a ' + mobName);
          }
        }

        self.storage.incrementTotalKills();
        self.tryUnlockingAchievement('HUNTER');

        if (kind === Types.Entities.RAT) {
          self.storage.incrementRatCount();
          self.tryUnlockingAchievement('ANGRY_RATS');
        }

        if (kind === Types.Entities.SKELETON || kind === Types.Entities.SKELETON2) {
          self.storage.incrementSkeletonCount();
          self.tryUnlockingAchievement('SKULL_COLLECTOR');
        }

        if (kind === Types.Entities.BOSS) {
          self.tryUnlockingAchievement('HERO');
        }
      });

      self.client.onPlayerChangeHealth(function (points, isRegen) {
        var player = self.player,
          diff,
          isHurt;

        if (player && !player.isDead && !player.invincible) {
          isHurt = points <= player.hitPoints;
          diff = points - player.hitPoints;
          player.hitPoints = points;

          if (player.hitPoints <= 0) {
            player.die();
          }
          if (isHurt) {
            player.hurt();
            self.infoManager.addDamageInfo(diff, player.x, player.y - 15, 'received');
            self.audioManager.playSound('hurt');
            self.storage.addDamage(-diff);
            self.tryUnlockingAchievement('MEATSHIELD');
            if (self.playerhurt_callback) {
              self.playerhurt_callback();
            }
          } else if (!isRegen) {
            self.infoManager.addDamageInfo('+' + diff, player.x, player.y - 15, 'healed');
          }
          self.updateBars();
        }
      });

      self.client.onPlayerChangeMaxHitPoints(function (hp) {
        self.player.maxHitPoints = hp;
        self.player.hitPoints = hp;
        self.updateBars();
      });

      self.client.onPlayerEquipItem(function (playerId, itemKind) {
        var player = self.getEntityById(playerId),
          itemName = Types.getKindAsString(itemKind);

        if (player) {
          if (Types.isArmor(itemKind)) {
            player.setSprite(self.sprites[itemName]);
          } else if (Types.isWeapon(itemKind)) {
            player.setWeaponName(itemName);
          }
        }
      });

      self.client.onPlayerTeleport(function (id, x, y) {
        var entity = null,
          currentOrientation;

        if (id !== self.playerId) {
          entity = self.getEntityById(id);

          if (entity) {
            currentOrientation = entity.orientation;

            self.makeCharacterTeleportTo(entity, x, y);
            entity.setOrientation(currentOrientation);

            entity.forEachAttacker(function (attacker) {
              attacker.disengage();
              attacker.idle();
              attacker.stop();
            });
          }
        }
      });

      self.client.onDropItem(function (item, mobId) {
        var pos = self.getDeadMobPosition(mobId);

        if (pos) {
          self.addItem(item, pos.x, pos.y);
          self.updateCursor();
        }
      });

      self.client.onChatMessage(function (entityId, message) {
        var entity = self.getEntityById(entityId);
        self.createBubble(entityId, message);
        self.assignBubbleTo(entity);
        self.audioManager.playSound('chat');
      });

      self.client.onPopulationChange(function (worldPlayers, totalPlayers) {
        if (self.nbplayers_callback) {
          self.nbplayers_callback(worldPlayers, totalPlayers);
        }
      });

      // Venice AI: NPC dialogue response
      self.client.onNpcTalkResponse(function (npcKind, response) {
        if (self.currentNpcTalk) {
          var npc = self.currentNpcTalk;
          self.currentNpcTalk = null;
          if (response) {
            self.createBubble(npc.id, response);
            self.assignBubbleTo(npc);
            self.audioManager.playSound('npc');
          }
        }
      });

      // Venice AI: Companion hints
      self.client.onCompanionHint(function (hint) {
        if (hint && self.player) {
          // Show as a speech bubble from the player (like a fairy companion)
          self.createBubble(self.player.id, '\u2728 ' + hint);
          self.assignBubbleTo(self.player);
        }
      });

      // Venice AI: Quest offers
      self.client.onQuestOffer(function (quest) {
        if (quest && self.notification_callback) {
          self.notification_callback('Quest: ' + quest.description);
          self.currentQuest = quest;
        }
      });

      // Venice AI: Quest completion
      self.client.onQuestComplete(function (result) {
        if (result && self.notification_callback) {
          self.notification_callback('Quest Complete! Reward: ' + result.reward);
          self.currentQuest = null;
        }
      });

      // Venice AI: Item lore on pickup
      self.client.onItemLore(function (itemKind, lore) {
        if (lore && self.notification_callback) {
          var itemName = Types.getKindAsString(itemKind);
          self.notification_callback(itemName + ': ' + lore);
        }
      });

      // Venice AI: Dynamic World Narrator
      self.client.onNarrator(function (text, style) {
        if (text) {
          self.showNarratorText(text, style);
        }
      });

      // Venice AI: Entity Thought Bubbles ("Ant Farm" feature)
      self.client.onEntityThought(function (entityId, thought, state) {
        console.log('[Thought] Received for entity', entityId, ':', thought);
        var entity = self.getEntityById(entityId);
        if (entity) {
          // Store the thought on the entity for rendering
          entity.currentThought = thought;
          entity.thoughtState = state;
          entity.thoughtTime = Date.now();

          console.log('[Thought] Set on', entity.kind, '(id:', entityId, '):', thought);
        } else {
          console.warn('[Thought] Entity not found:', entityId, '- thought discarded');
        }
      });

      // Town Crier: Newspaper response
      self.client.onNewsResponse(function (headlines) {
        console.log('[TownCrier] Showing newspaper with', headlines.length, 'headlines');
        self.showNewspaper(headlines);
      });

      self.client.onDisconnected(function (message) {
        if (self.player) {
          self.player.die();
        }
        if (self.disconnect_callback) {
          self.disconnect_callback(message);
        }
      });

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
    this.client.sendHello(player || this.player);
  }

  /**
   * Converts the current mouse position on the screen to world grid coordinates.
   * @returns {Object} An object containing x and y properties.
   */
  getMouseGridPosition() {
    var mx = this.mouse.x,
      my = this.mouse.y,
      c = this.renderer.camera,
      s = this.renderer.scale,
      ts = this.renderer.tilesize,
      offsetX = mx % (ts * s),
      offsetY = my % (ts * s),
      x = ((mx - offsetX) / (ts * s)) + c.gridX,
      y = ((my - offsetY) / (ts * s)) + c.gridY;

    return {x: x, y: y};
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
      this.previousClickPosition = {};
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
   * @returns {Entity} the entity located at (x, y) or null if there is none.
   */
  getEntityAt(x, y) {
    if (this.map.isOutOfBounds(x, y) || !this.entityGrid) {
      return null;
    }

    var entities = this.entityGrid[y][x],
      entity = null;
    if (_.size(entities) > 0) {
      entity = entities[_.keys(entities)[0]];
    } else {
      entity = this.getItemAt(x, y);
    }
    return entity;
  }

  getMobAt(x, y) {
    var entity = this.getEntityAt(x, y);
    if (entity && (entity instanceof Mob)) {
      return entity;
    }
    return null;
  }

  getNpcAt(x, y) {
    var entity = this.getEntityAt(x, y);
    if (entity && (entity instanceof Npc)) {
      return entity;
    }
    return null;
  }

  getChestAt(x, y) {
    var entity = this.getEntityAt(x, y);
    if (entity && (entity instanceof Chest)) {
      return entity;
    }
    return null;
  }

  getItemAt(x, y) {
    if (this.map.isOutOfBounds(x, y) || !this.itemGrid) {
      return null;
    }
    var items = this.itemGrid[y][x],
      item = null;

    if (_.size(items) > 0) {
      // If there are potions/burgers stacked with equipment items on the same tile, always get expendable items first.
      _.each(items, function (i) {
        if (Types.isExpendableItem(i.kind)) {
          item = i;
        }
        ;
      });

      // Else, get the first item of the stack
      if (!item) {
        item = items[_.keys(items)[0]];
      }
    }
    return item;
  }

  /**
   * Returns true if an entity is located at the given position on the world grid.
   * @returns {Boolean} Whether an entity is at (x, y).
   */
  isEntityAt(x, y) {
    return !_.isNull(this.getEntityAt(x, y));
  }

  isMobAt(x, y) {
    return !_.isNull(this.getMobAt(x, y));
  }

  isItemAt(x, y) {
    return !_.isNull(this.getItemAt(x, y));
  }

  isNpcAt(x, y) {
    return !_.isNull(this.getNpcAt(x, y));
  }

  isChestAt(x, y) {
    return !_.isNull(this.getChestAt(x, y));
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
   *
   */
  movecursor() {
    var mouse = this.getMouseGridPosition(),
      x = mouse.x,
      y = mouse.y;

    if (this.player && !this.renderer.mobile && !this.renderer.tablet) {
      this.hoveringCollidingTile = this.map.isColliding(x, y);
      this.hoveringPlateauTile = this.player.isOnPlateau ? !this.map.isPlateau(x, y) : this.map.isPlateau(x, y);
      this.hoveringMob = this.isMobAt(x, y);
      this.hoveringItem = this.isItemAt(x, y);
      this.hoveringNpc = this.isNpcAt(x, y);
      this.hoveringChest = this.isChestAt(x, y);

      if (this.hoveringMob || this.hoveringNpc || this.hoveringChest) {
        var entity = this.getEntityAt(x, y);

        if (!entity.isHighlighted && this.renderer.supportsSilhouettes) {
          if (this.lastHovered) {
            this.lastHovered.setHighlight(false);
          }
          this.lastHovered = entity;
          entity.setHighlight(true);
        }
      }
      else if (this.lastHovered) {
        this.lastHovered.setHighlight(false);
        this.lastHovered = null;
      }
    }
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

  /**
   *
   */
  isZoningTile(x, y) {
    var c = this.camera;

    x = x - c.gridX;
    y = y - c.gridY;

    if (x === 0 || y === 0 || x === c.gridW - 1 || y === c.gridH - 1) {
      return true;
    }
    return false;
  }

  /**
   *
   */
  getZoningOrientation(x, y) {
    var orientation = '',
      c = this.camera;

    x = x - c.gridX;
    y = y - c.gridY;

    if (x === 0) {
      orientation = Types.Orientations.LEFT;
    }
    else if (y === 0) {
      orientation = Types.Orientations.UP;
    }
    else if (x === c.gridW - 1) {
      orientation = Types.Orientations.RIGHT;
    }
    else if (y === c.gridH - 1) {
      orientation = Types.Orientations.DOWN;
    }

    return orientation;
  }

  startZoningFrom(x, y) {
    this.zoningOrientation = this.getZoningOrientation(x, y);

    if (this.renderer.mobile || this.renderer.tablet) {
      var z = this.zoningOrientation,
        c = this.camera,
        ts = this.renderer.tilesize,
        x = c.x,
        y = c.y,
        xoffset = (c.gridW - 2) * ts,
        yoffset = (c.gridH - 2) * ts;

      if (z === Types.Orientations.LEFT || z === Types.Orientations.RIGHT) {
        x = (z === Types.Orientations.LEFT) ? c.x - xoffset : c.x + xoffset;
      } else if (z === Types.Orientations.UP || z === Types.Orientations.DOWN) {
        y = (z === Types.Orientations.UP) ? c.y - yoffset : c.y + yoffset;
      }
      c.setPosition(x, y);

      this.renderer.clearScreen(this.renderer.context);
      this.endZoning();

      // Force immediate drawing of all visible entities in the new zone
      this.forEachVisibleEntityByDepth(function (entity) {
        entity.setDirty();
      });
    }
    else {
      this.currentZoning = new Transition();
    }
    this.bubbleManager.clean();
    this.client.sendZone();
  }

  enqueueZoningFrom(x, y) {
    this.zoningQueue.push({x: x, y: y});

    if (this.zoningQueue.length === 1) {
      this.startZoningFrom(x, y);
    }
  }

  endZoning() {
    this.currentZoning = null;
    this.resetZone();
    this.zoningQueue.shift();

    if (this.zoningQueue.length > 0) {
      var pos = this.zoningQueue[0];
      this.startZoningFrom(pos.x, pos.y);
    }
  }

  isZoning() {
    return !_.isNull(this.currentZoning);
  }

  resetZone() {
    this.bubbleManager.clean();
    this.initAnimatedTiles();
    this.renderer.renderStaticCanvases();
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

  showNotification(message) {
    if (this.notification_callback) {
      this.notification_callback(message);
    }
  }

  /**
   * Shows narrator text prominently at the top of the screen
   * with dramatic styling based on the style parameter
   */
  showNarratorText(text: string, style: string = 'epic') {
    // Create or get narrator container
    let narratorEl = document.getElementById('narrator-text');
    if (!narratorEl) {
      narratorEl = document.createElement('div');
      narratorEl.id = 'narrator-text';
      narratorEl.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 80%;
        padding: 15px 30px;
        font-family: 'Georgia', serif;
        font-size: 18px;
        text-align: center;
        border-radius: 5px;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        pointer-events: none;
      `;
      document.body.appendChild(narratorEl);
    }

    // Style based on narrator style
    switch (style) {
      case 'epic':
        narratorEl.style.background = 'linear-gradient(to right, rgba(139, 69, 19, 0.9), rgba(101, 67, 33, 0.9))';
        narratorEl.style.color = '#ffd700';
        narratorEl.style.border = '2px solid #ffd700';
        break;
      case 'humor':
        narratorEl.style.background = 'linear-gradient(to right, rgba(75, 0, 130, 0.9), rgba(138, 43, 226, 0.9))';
        narratorEl.style.color = '#fff';
        narratorEl.style.border = '2px solid #da70d6';
        break;
      case 'ominous':
        narratorEl.style.background = 'linear-gradient(to right, rgba(40, 0, 0, 0.95), rgba(80, 0, 0, 0.95))';
        narratorEl.style.color = '#ff4444';
        narratorEl.style.border = '2px solid #8b0000';
        break;
      case 'info':
        narratorEl.style.background = 'linear-gradient(to right, rgba(0, 50, 80, 0.9), rgba(0, 80, 100, 0.9))';
        narratorEl.style.color = '#87ceeb';
        narratorEl.style.border = '2px solid #4682b4';
        break;
      default:
        narratorEl.style.background = 'rgba(0, 0, 0, 0.8)';
        narratorEl.style.color = '#fff';
        narratorEl.style.border = '2px solid #666';
    }

    // Set text with dramatic quotes
    narratorEl.innerHTML = `<em>"${text}"</em>`;

    // Fade in
    narratorEl.style.opacity = '1';

    // Fade out after delay (based on text length)
    const displayTime = Math.max(4000, text.length * 60);
    setTimeout(() => {
      narratorEl.style.opacity = '0';
    }, displayTime);

    console.log('[Narrator]', style + ':', text);
  }

  /**
   * Town Crier - Shows newspaper overlay with headlines
   */
  showNewspaper(headlines: string[]) {
    // Create or get newspaper container
    let newsEl = document.getElementById('newspaper-overlay');
    if (!newsEl) {
      newsEl = document.createElement('div');
      newsEl.id = 'newspaper-overlay';
      newsEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        max-width: 90%;
        max-height: 80vh;
        padding: 20px 30px;
        font-family: 'Georgia', serif;
        background: linear-gradient(to bottom, #f4e4bc, #e8d5a3);
        color: #2a2a2a;
        border-radius: 5px;
        border: 3px solid #8b4513;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        z-index: 10000;
        overflow-y: auto;
      `;
      document.body.appendChild(newsEl);
    }

    // Build newspaper content
    let html = `
      <div style="text-align: center; border-bottom: 2px solid #8b4513; padding-bottom: 10px; margin-bottom: 15px;">
        <h2 style="margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
          Town Crier
        </h2>
        <div style="font-size: 12px; color: #666; margin-top: 5px;">
          All the news that's fit to proclaim!
        </div>
      </div>
      <div style="font-size: 14px; line-height: 1.6;">
    `;

    if (headlines.length === 0) {
      html += '<p style="text-align: center; font-style: italic;">No news today... The realm is quiet.</p>';
    } else {
      headlines.forEach(headline => {
        html += `<p style="margin: 10px 0; padding-left: 10px; border-left: 3px solid #8b4513;">
          ${headline}
        </p>`;
      });
    }

    html += `
      </div>
      <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc;">
        <button id="close-newspaper" style="
          padding: 8px 20px;
          font-family: Georgia, serif;
          font-size: 14px;
          background: #8b4513;
          color: #fff;
          border: none;
          border-radius: 3px;
          cursor: pointer;
        ">Close</button>
        <div style="font-size: 10px; color: #888; margin-top: 8px;">Press N to toggle</div>
      </div>
    `;

    newsEl.innerHTML = html;
    newsEl.style.display = 'block';

    // Add close button handler
    const closeBtn = document.getElementById('close-newspaper');
    if (closeBtn) {
      closeBtn.onclick = () => this.hideNewspaper();
    }

    console.log('[TownCrier] Displayed newspaper with', headlines.length, 'headlines');
  }

  hideNewspaper() {
    const newsEl = document.getElementById('newspaper-overlay');
    if (newsEl) {
      newsEl.style.display = 'none';
    }
  }

  toggleNewspaper() {
    const newsEl = document.getElementById('newspaper-overlay');
    if (newsEl && newsEl.style.display !== 'none') {
      this.hideNewspaper();
    } else {
      this.requestNews();
    }
  }

  requestNews() {
    if (this.client) {
      console.log('[TownCrier] Requesting news from server...');
      this.client.sendNewsRequest();
    }
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
}
