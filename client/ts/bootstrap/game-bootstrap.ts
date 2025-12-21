/**
 * GameBootstrap - Initializes all game managers and systems
 *
 * Single Responsibility: Wire up game subsystems during startup
 * Extracted from Game.run() to reduce Game.ts size
 */

import { GridManager } from '../world/grid-manager';
import { EntityManager } from '../entities/entity-manager';
import { InputManager } from '../input/input-manager';
import { UIManager } from '../ui/ui-manager';
import { ItemTooltip } from '../ui/item-tooltip';
import { ZoningManager } from '../world/zoning-manager';
import { UnifiedZoneManager } from '../world/unified-zone-manager';
import { PlayerController } from '../player/player-controller';
import { InteractionController } from '../player/interaction-controller';
import { QuestController } from '../quest/quest-controller';
import { QuestUI, initQuestUI } from '../ui/quest-ui';
import { Pathfinder } from '../utils/pathfinder';

/**
 * Context passed to bootstrap containing game references
 */
export interface BootstrapContext {
  // Core systems
  map: any;
  renderer: any;
  camera: any;
  storage: any;
  audioManager: any;
  bubbleManager: any;
  sprites: any;
  cursors: any;
  currentTime: number;

  // State
  player: any;
  playerId: number;
  started: boolean;
  client: any;
  fractureAtmosphere: any;

  // Callbacks
  notification_callback: ((msg: string) => void) | null;

  // Methods from Game that managers need
  isMobAt: (x: number, y: number) => boolean;
  isItemAt: (x: number, y: number) => boolean;
  isNpcAt: (x: number, y: number) => boolean;
  isChestAt: (x: number, y: number) => boolean;
  getEntityAt: (x: number, y: number) => any;
  forEachMob: (cb: (mob: any) => void) => void;
  forEachEntity: (cb: (entity: any) => void) => void;
  forEachVisibleEntityByDepth: (cb: (entity: any) => void) => void;
  findPath: (entity: any, x: number, y: number, ignored: any[]) => any[];
  getItemAt: (x: number, y: number) => any;
  isZoningTile: (x: number, y: number) => boolean;
  isZoning: () => boolean;
  getMouseGridPosition: () => { x: number; y: number };
  makeCharacterGoTo: (c: any, x: number, y: number) => void;

  // Grid operations
  registerEntityPosition: (e: any) => void;
  unregisterEntityPosition: (e: any) => void;
  registerEntityDualPosition: (e: any) => void;
  removeFromRenderingGrid: (e: any, x: number, y: number) => void;
  removeEntity: (e: any) => void;
  checkOtherDirtyRects: (r: any, e: any, x: number, y: number) => void;

  // Zone operations
  enqueueZoningFrom: (x: number, y: number) => void;
  endZoning: () => void;
  resetZone: () => void;
  updatePlateauMode: () => void;
  updatePlayerCheckpoint: () => void;
  checkUndergroundAchievement: () => void;
  initAnimatedTiles: () => void;

  // UI operations
  assignBubbleTo: (e: any) => void;
  makeNpcTalk: (npc: any) => void;
  pickupItemToInventory: (item: any) => void;
  showNotification: (message: string) => void;
  showBubbleFor: (entity: any, message: string) => void;

  // Achievement operations
  tryUnlockingAchievement: (id: string) => void;

  // Callbacks
  playerdeath_callback?: () => void;
  equipment_callback?: () => void;
  invincible_callback?: () => void;

  // Player accessors
  hoveringCollidingTile: boolean;
  hoveringPlateauTile: boolean;
  previousClickPosition: { x: number; y: number };
  currentNpcTalk: any;
}

/**
 * Result of bootstrap initialization
 */
export interface BootstrapResult {
  gridManager: GridManager;
  entityManager: EntityManager;
  inputManager: InputManager;
  uiManager: UIManager;
  itemTooltip: ItemTooltip;
  zoningManager: ZoningManager;
  unifiedZoneManager: UnifiedZoneManager;
  playerController: PlayerController;
  interactionController: InteractionController;
  questController: QuestController;
  questUI: QuestUI;
  pathfinder: Pathfinder;
}

/**
 * Initialize all game managers
 */
export function initializeManagers(ctx: BootstrapContext): BootstrapResult {
  // Initialize grid manager
  const gridManager = new GridManager(ctx.map);

  // Initialize entity manager
  const entityManager = new EntityManager();
  entityManager.setGridManager({
    addToRenderingGrid: (e, x, y) => gridManager.addToRenderingGrid(e, x, y),
    removeFromRenderingGrid: (e, x, y) => gridManager.removeFromRenderingGrid(e, x, y),
    removeFromEntityGrid: (e, x, y) => gridManager.removeFromEntityGrid(e, x, y),
    removeFromItemGrid: (e, x, y) => gridManager.removeFromItemGrid(e, x, y),
    removeFromPathingGrid: (x, y) => gridManager.removeFromPathingGrid(x, y),
    registerEntityPosition: (e) => gridManager.registerEntityPosition(e),
    unregisterEntityPosition: (e) => gridManager.unregisterEntityPosition(e)
  } as any);
  entityManager.setRenderer(ctx.renderer);
  entityManager.setCamera(ctx.camera);
  entityManager.setCurrentTimeProvider(() => ctx.currentTime);
  entityManager.setDirtyRectCallback((rect, entity, x, y) => {
    ctx.checkOtherDirtyRects(rect, entity, x, y);
  });

  // Initialize input manager
  const inputManager = new InputManager();
  inputManager.setRenderer(ctx.renderer);
  inputManager.setMap(ctx.map);
  inputManager.setEntityQuery({
    isMobAt: ctx.isMobAt,
    isItemAt: ctx.isItemAt,
    isNpcAt: ctx.isNpcAt,
    isChestAt: ctx.isChestAt,
    getEntityAt: ctx.getEntityAt
  });
  inputManager.setPlayerProvider(() => ctx.player);
  inputManager.setGameStartedProvider(() => ctx.started);
  inputManager.setCursors(ctx.cursors);

  // Initialize UI manager
  const uiManager = new UIManager();
  uiManager.setNotificationCallback((msg) => {
    if (ctx.notification_callback) {
      ctx.notification_callback(msg);
    }
  });
  uiManager.setNewsRequestCallback(() => {
    if (ctx.client) {
      ctx.client.sendNewsRequest();
    }
  });

  // Initialize item tooltip
  const itemTooltip = new ItemTooltip();

  // Initialize zoning manager
  const zoningManager = new ZoningManager();
  zoningManager.setContext({
    camera: ctx.camera,
    renderer: ctx.renderer,
    bubbleManager: ctx.bubbleManager,
    client: { sendZone: () => ctx.client?.sendZone() },
    initAnimatedTiles: ctx.initAnimatedTiles,
    forEachVisibleEntityByDepth: ctx.forEachVisibleEntityByDepth
  });

  // Initialize unified zone manager (handles both outdoor zones and interiors)
  const unifiedZoneManager = new UnifiedZoneManager();
  unifiedZoneManager.setContext({
    camera: ctx.camera,
    renderer: ctx.renderer,
    // Provide collision check for dynamic room bounds calculation
    isColliding: (x: number, y: number) => ctx.map?.isColliding(x, y) ?? true
  });

  // Initialize player controller with dependencies
  const playerController = new PlayerController({
    client: {
      sendMove: (...args) => ctx.client?.sendMove(...args),
      sendAggro: (...args) => ctx.client?.sendAggro(...args),
      sendTeleport: (...args) => ctx.client?.sendTeleport(...args),
      sendOpen: (...args) => ctx.client?.sendOpen(...args),
      disable: () => ctx.client?.disable()
    },
    renderer: ctx.renderer,
    camera: ctx.camera,
    map: ctx.map,
    audioManager: ctx.audioManager,
    storage: ctx.storage,
    unifiedZoneManager: unifiedZoneManager,

    getSprites: () => ctx.sprites,
    getPlayerId: () => ctx.playerId,

    forEachMob: ctx.forEachMob,
    getEntityAt: ctx.getEntityAt,
    isItemAt: ctx.isItemAt,
    getItemAt: ctx.getItemAt,
    isZoningTile: ctx.isZoningTile,
    findPath: ctx.findPath,

    registerEntityPosition: ctx.registerEntityPosition,
    unregisterEntityPosition: ctx.unregisterEntityPosition,
    registerEntityDualPosition: ctx.registerEntityDualPosition,
    removeFromRenderingGrid: ctx.removeFromRenderingGrid,
    removeEntity: ctx.removeEntity,
    checkOtherDirtyRects: ctx.checkOtherDirtyRects,

    enqueueZoningFrom: ctx.enqueueZoningFrom,
    endZoning: ctx.endZoning,
    resetZone: ctx.resetZone,
    updatePlateauMode: ctx.updatePlateauMode,
    updatePlayerCheckpoint: ctx.updatePlayerCheckpoint,
    checkUndergroundAchievement: ctx.checkUndergroundAchievement,

    assignBubbleTo: ctx.assignBubbleTo,
    makeNpcTalk: ctx.makeNpcTalk,
    pickupItemToInventory: ctx.pickupItemToInventory,

    tryUnlockingAchievement: ctx.tryUnlockingAchievement,

    onPlayerDeath: () => ctx.playerdeath_callback?.(),
    onEquipmentChange: () => ctx.equipment_callback?.(),
    onInvincible: () => ctx.invincible_callback?.(),

    fractureAtmosphere: ctx.fractureAtmosphere
  });

  // Initialize interaction controller
  const interactionController = new InteractionController({
    getClient: () => ctx.client,
    map: ctx.map,
    audioManager: ctx.audioManager,
    getPlayer: () => ctx.player,
    getPlayerId: () => ctx.playerId,
    isStarted: () => ctx.started,
    isZoning: ctx.isZoning,
    isZoningTile: ctx.isZoningTile,
    getEntityAt: ctx.getEntityAt,
    getMouseGridPosition: ctx.getMouseGridPosition,
    makeCharacterGoTo: ctx.makeCharacterGoTo,
    hoveringCollidingTile: () => ctx.hoveringCollidingTile,
    hoveringPlateauTile: () => ctx.hoveringPlateauTile,
    showBubbleFor: ctx.showBubbleFor,
    tryUnlockingAchievement: ctx.tryUnlockingAchievement,
    getPreviousClickPosition: () => ctx.previousClickPosition,
    setPreviousClickPosition: (pos) => { ctx.previousClickPosition = pos; },
    setCurrentNpcTalk: (npc) => { ctx.currentNpcTalk = npc; },
    getCurrentNpcTalk: () => ctx.currentNpcTalk
  });

  // Initialize quest controller
  const questController = new QuestController({
    sendRequestQuest: (npcKind: number) => ctx.client?.sendRequestQuest(npcKind),
    showNotification: ctx.showNotification,
    showNarratorText: (text: string, style: string) => uiManager?.showNarratorText(text, style as any),
    playSound: (soundName: string) => ctx.audioManager?.playSound(soundName)
  });

  // Initialize quest UI
  const questUI = initQuestUI(questController);

  // Initialize pathfinder
  const pathfinder = new Pathfinder(ctx.map.width, ctx.map.height);

  return {
    gridManager,
    entityManager,
    inputManager,
    uiManager,
    itemTooltip,
    zoningManager,
    unifiedZoneManager,
    playerController,
    interactionController,
    questController,
    questUI,
    pathfinder
  };
}
