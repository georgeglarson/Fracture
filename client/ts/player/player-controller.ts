/**
 * PlayerController - Manages player behavior and callbacks
 *
 * Single Responsibility: Player movement, combat, interactions, death
 * Extracts all player callback logic from Game.ts for clean architecture.
 */

import { Player } from '../entity/character/player/player';
import { Npc } from '../entity/character/npc/npc';
import { Chest } from '../entity/objects/chest';
import _ from 'lodash';

/**
 * Dependencies injected into PlayerController
 */
export interface PlayerControllerDeps {
  // Core systems
  client: any;
  renderer: any;
  camera: any;
  map: any;
  audioManager: any;
  storage: any;

  // Game state accessors
  getSprites: () => Record<string, any>;
  getPlayerId: () => number;

  // Entity operations
  forEachMob: (callback: (mob: any) => void) => void;
  getEntityAt: (x: number, y: number) => any;
  isItemAt: (x: number, y: number) => boolean;
  getItemAt: (x: number, y: number) => any;
  isZoningTile: (x: number, y: number) => boolean;
  findPath: (entity: any, x: number, y: number, ignored: any[]) => any;

  // Grid operations
  registerEntityPosition: (entity: any) => void;
  unregisterEntityPosition: (entity: any) => void;
  registerEntityDualPosition: (entity: any) => void;
  removeFromRenderingGrid: (entity: any, x: number, y: number) => void;
  removeEntity: (entity: any) => void;
  checkOtherDirtyRects: (rect: any, entity: any, x: number, y: number) => void;

  // Zone operations
  enqueueZoningFrom: (x: number, y: number) => void;
  resetZone: () => void;
  updatePlateauMode: () => void;
  updatePlayerCheckpoint: () => void;
  checkUndergroundAchievement: () => void;

  // UI operations
  assignBubbleTo: (entity: any) => void;
  makeNpcTalk: (npc: any) => void;
  pickupItemToInventory: (item: any) => void;

  // Achievement operations
  tryUnlockingAchievement: (id: string) => void;

  // Callbacks
  onPlayerDeath: () => void;
  onEquipmentChange: () => void;
  onInvincible: () => void;

  // Atmosphere effects
  fractureAtmosphere: any;
}

/**
 * Achievement zone definitions for step-based triggers
 */
const ACHIEVEMENT_ZONES = [
  { id: 'INTO_THE_WILD', check: (x: number, y: number) =>
    (x <= 85 && y <= 179 && y > 178) || (x <= 85 && y <= 266 && y > 265) },
  { id: 'AT_WORLDS_END', check: (x: number, y: number) =>
    x <= 85 && y <= 293 && y > 292 },
  { id: 'NO_MANS_LAND', check: (x: number, y: number) =>
    x <= 85 && y <= 100 && y > 99 },
  { id: 'HOT_SPOT', check: (x: number, y: number) =>
    x <= 85 && y <= 51 && y > 50 },
  { id: 'TOMB_RAIDER', check: (x: number, y: number) =>
    x <= 27 && y <= 123 && y > 112 },
];

/**
 * PlayerController class - manages all player behavior callbacks
 */
export class PlayerController {
  private deps: PlayerControllerDeps;
  private player: Player | null = null;

  // Visual state for target cursor
  public selectedX = 0;
  public selectedY = 0;
  public selectedCellVisible = false;
  public drawTarget = false;
  public clearTarget = false;

  constructor(deps: PlayerControllerDeps) {
    this.deps = deps;
  }

  /**
   * Setup all player callbacks. Call this after player is initialized.
   */
  setupCallbacks(player: Player): void {
    this.player = player;

    player.onStartPathing(this.handleStartPathing.bind(this));
    player.onCheckAggro(this.handleCheckAggro.bind(this));
    player.onAggro(this.handleAggro.bind(this));
    player.onBeforeStep(this.handleBeforeStep.bind(this));
    player.onStep(this.handleStep.bind(this));
    player.onStopPathing(this.handleStopPathing.bind(this));
    player.onRequestPath(this.handleRequestPath.bind(this));
    player.onDeath(this.handleDeath.bind(this));
    player.onHasMoved(this.handleHasMoved.bind(this));
    player.onArmorLoot(this.handleArmorLoot.bind(this));
    player.onSwitchItem(this.handleSwitchItem.bind(this));
    player.onInvincible(this.handleInvincible.bind(this));

    console.info('[PlayerController] Callbacks initialized');
  }

  /**
   * Handle start of pathing - update target cursor and send move to server
   */
  private handleStartPathing(path: number[][]): void {
    if (!this.player) return;

    const i = path.length - 1;
    const x = path[i][0];
    const y = path[i][1];

    if (this.player.isMovingToLoot()) {
      this.player.isLootMoving = false;
    } else if (!this.player.isAttacking()) {
      this.deps.client.sendMove(x, y);
    }

    // Update target cursor position
    this.selectedX = x;
    this.selectedY = y;
    this.selectedCellVisible = true;

    // Mobile/tablet target rendering
    if (this.deps.renderer.mobile || this.deps.renderer.tablet) {
      this.drawTarget = true;
      this.clearTarget = true;
      this.deps.renderer.targetRect = this.deps.renderer.getTargetBoundingRect();
      this.deps.checkOtherDirtyRects(this.deps.renderer.targetRect, null, this.selectedX, this.selectedY);
    }
  }

  /**
   * Check for mob aggro when player moves
   */
  private handleCheckAggro(): void {
    if (!this.player) return;

    this.deps.forEachMob((mob: any) => {
      if (mob.isAggressive && !mob.isAttacking() && this.player!.isNear(mob, mob.aggroRange)) {
        this.player!.aggro(mob);
      }
    });
  }

  /**
   * Handle mob aggro notification
   */
  private handleAggro(mob: any): void {
    if (!this.player) return;

    if (!mob.isWaitingToAttack(this.player) && !this.player.isAttackedBy(mob)) {
      this.player.log_info(`Aggroed by ${mob.id} at (${this.player.gridX}, ${this.player.gridY})`);
      this.deps.client.sendAggro(mob);
      mob.waitToAttack(this.player);
    }
  }

  /**
   * Handle pre-step logic - unregister position
   */
  private handleBeforeStep(): void {
    if (!this.player) return;

    const blockingEntity = this.deps.getEntityAt(this.player.nextGridX, this.player.nextGridY);
    if (blockingEntity && blockingEntity.id !== this.deps.getPlayerId()) {
      console.debug('Blocked by ' + blockingEntity.id);
    }
    this.deps.unregisterEntityPosition(this.player);
  }

  /**
   * Handle step - zone detection, achievements, attacker updates
   */
  private handleStep(): void {
    if (!this.player) return;

    // Register dual position if moving
    if (this.player.hasNextStep()) {
      this.deps.registerEntityDualPosition(this.player);
    }

    // Check for zone transition
    if (this.deps.isZoningTile(this.player.gridX, this.player.gridY)) {
      this.deps.enqueueZoningFrom(this.player.gridX, this.player.gridY);
    }

    // Update attackers
    this.player.forEachAttacker((attacker: any) => {
      if (attacker.isAdjacent(attacker.target)) {
        attacker.lookAtTarget();
      } else {
        attacker.follow(this.player);
      }
    });

    // Check achievement zones
    for (const zone of ACHIEVEMENT_ZONES) {
      if (zone.check(this.player.gridX, this.player.gridY)) {
        this.deps.tryUnlockingAchievement(zone.id);
      }
    }

    this.deps.updatePlayerCheckpoint();

    if (!this.player.isDead) {
      this.deps.audioManager.updateMusic();
    }
  }

  /**
   * Handle stop pathing - item pickup, door handling, NPC interaction
   */
  private handleStopPathing(x: number, y: number): void {
    if (!this.player) return;

    if (this.player.hasTarget()) {
      this.player.lookAtTarget();
    }

    this.selectedCellVisible = false;

    // Item pickup
    if (this.deps.isItemAt(x, y)) {
      const item = this.deps.getItemAt(x, y);
      this.deps.pickupItemToInventory(item);
      this.deps.audioManager.playSound('loot');
    }

    // Door handling
    if (!this.player.hasTarget() && this.deps.map.isDoor(x, y)) {
      this.handleDoorTransition(x, y);
    }

    // NPC/Chest interaction
    if (this.player.target instanceof Npc) {
      this.deps.makeNpcTalk(this.player.target);
    } else if (this.player.target instanceof Chest) {
      this.deps.client.sendOpen(this.player.target);
      this.deps.audioManager.playSound('chest');
    }

    // Update attackers
    this.player.forEachAttacker((attacker: any) => {
      if (!attacker.isAdjacentNonDiagonal(this.player)) {
        attacker.follow(this.player);
      }
    });

    this.deps.unregisterEntityPosition(this.player);
    this.deps.registerEntityPosition(this.player);
  }

  /**
   * Handle door transition logic
   */
  private handleDoorTransition(x: number, y: number): void {
    if (!this.player) return;

    const dest = this.deps.map.getDoorDestination(x, y);

    this.player.setGridPosition(dest.x, dest.y);
    this.player.nextGridX = dest.x;
    this.player.nextGridY = dest.y;
    this.player.turnTo(dest.orientation);
    this.deps.client.sendTeleport(dest.x, dest.y);

    // Indoor/outdoor mode handling
    const enteringInterior = dest.cameraX !== undefined && dest.cameraY !== undefined;
    const modeChanged = this.deps.camera.indoorMode !== enteringInterior;
    this.deps.camera.setIndoorMode(enteringInterior);

    // Clear canvases on mode change
    if (modeChanged) {
      this.deps.renderer.clearScreen(this.deps.renderer.context);
      this.deps.renderer.clearScreen(this.deps.renderer.background);
      this.deps.renderer.clearScreen(this.deps.renderer.foreground);
    }

    // Camera positioning
    if (enteringInterior) {
      this.deps.camera.setGridPosition(dest.cameraX, dest.cameraY);
    } else {
      if (dest.portal) {
        this.deps.assignBubbleTo(this.player);
      } else {
        this.deps.camera.lookAt(this.player);
      }
    }

    this.deps.resetZone();

    // Coward achievement
    if (_.size(this.player.attackers) > 0) {
      setTimeout(() => this.deps.tryUnlockingAchievement('COWARD'), 500);
    }

    // Disengage attackers
    this.player.forEachAttacker((attacker: any) => {
      attacker.disengage();
      attacker.idle();
    });

    this.deps.updatePlateauMode();
    this.deps.checkUndergroundAchievement();

    // Mobile rendering cleanup
    if (this.deps.renderer.mobile || this.deps.renderer.tablet) {
      this.deps.renderer.clearScreen(this.deps.renderer.context);
    }

    // Sound effects
    if (dest.portal) {
      this.deps.audioManager.playSound('teleport');
    }

    if (!this.player.isDead) {
      this.deps.audioManager.updateMusic();
    }
  }

  /**
   * Handle pathfinding request
   */
  private handleRequestPath(x: number, y: number): any {
    if (!this.player) return null;

    const ignored = [this.player];
    if (this.player.hasTarget()) {
      ignored.push(this.player.target);
    }
    return this.deps.findPath(this.player, x, y, ignored);
  }

  /**
   * Handle player death
   */
  private handleDeath(): void {
    if (!this.player) return;

    console.info(this.deps.getPlayerId() + ' is dead');

    this.player.stopBlinking();
    this.player.setSprite(this.deps.getSprites()['death']);

    const playerId = this.deps.getPlayerId();
    const player = this.player;

    this.player.animate('death', 120, 1, () => {
      console.info(playerId + ' was removed');

      this.deps.removeEntity(player);
      this.deps.removeFromRenderingGrid(player, player.gridX, player.gridY);
      this.deps.client.disable();

      setTimeout(() => this.deps.onPlayerDeath(), 1000);
    });

    this.player.forEachAttacker((attacker: any) => {
      attacker.disengage();
      attacker.idle();
    });

    this.deps.audioManager.fadeOutCurrentMusic();
    this.deps.audioManager.playSound('death');

    if (this.deps.fractureAtmosphere) {
      this.deps.fractureAtmosphere.onPlayerDeath();
    }
  }

  /**
   * Handle player movement for bubble positioning
   */
  private handleHasMoved(player: any): void {
    this.deps.assignBubbleTo(player);
  }

  /**
   * Handle armor loot
   */
  private handleArmorLoot(armorName: string): void {
    if (!this.player) return;
    this.player.switchArmor(this.deps.getSprites()[armorName]);
  }

  /**
   * Handle item switch (save to storage, trigger callback)
   */
  private handleSwitchItem(): void {
    if (!this.player) return;

    this.deps.storage.savePlayer(
      this.deps.renderer.getPlayerImage(),
      this.player.getArmorName(),
      this.player.getWeaponName()
    );
    this.deps.onEquipmentChange();
  }

  /**
   * Handle invincibility
   */
  private handleInvincible(): void {
    if (!this.player) return;
    this.deps.onInvincible();
    this.player.switchArmor(this.deps.getSprites()['firefox']);
  }
}
