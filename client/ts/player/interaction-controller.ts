/**
 * InteractionController - Handles player-initiated interactions
 *
 * Single Responsibility: Movement, clicks, NPC talk, attacks, chests
 * Extracts all interaction logic from Game.ts for clean architecture.
 */

import { Types } from '../../../shared/ts/gametypes';
import { Player } from '../entity/character/player/player';
import { Mob } from '../entity/character/mob/mob';
import { Npc } from '../entity/character/npc/npc';
import { Chest } from '../entity/objects/chest';
import { Item } from '../entity/objects/item';

/**
 * Dependencies injected into InteractionController
 */
export interface InteractionControllerDeps {
  // Core systems - use getter for late binding (client created after bootstrap)
  getClient: () => any;
  map: any;
  audioManager: any;

  // Game state accessors
  getPlayer: () => Player | null;
  getPlayerId: () => number;
  isStarted: () => boolean;
  isZoning: () => boolean;
  isZoningTile: (x: number, y: number) => boolean;

  // Entity operations
  getEntityAt: (x: number, y: number) => any;
  getMouseGridPosition: () => { x: number; y: number };

  // Movement operations
  makeCharacterGoTo: (character: any, x: number, y: number) => void;

  // Grid checks
  hoveringCollidingTile: () => boolean;
  hoveringPlateauTile: () => boolean;

  // UI operations
  showBubbleFor: (entity: any, message: string) => void;
  tryUnlockingAchievement: (id: string) => void;

  // State management
  getPreviousClickPosition: () => { x: number; y: number };
  setPreviousClickPosition: (pos: { x: number; y: number }) => void;
  setCurrentNpcTalk: (npc: any) => void;
  getCurrentNpcTalk: () => any;
}

/**
 * InteractionController class - manages all player-initiated interactions
 */
export class InteractionController {
  private deps: InteractionControllerDeps;

  constructor(deps: InteractionControllerDeps) {
    this.deps = deps;
  }

  /**
   * Move player to a grid position
   */
  makePlayerGoTo(x: number, y: number): void {
    const player = this.deps.getPlayer();
    if (player) {
      this.deps.makeCharacterGoTo(player, x, y);
    }
  }

  /**
   * Move player one tile in a direction (for WASD/Arrow key controls)
   */
  movePlayerInDirection(dx: number, dy: number): void {
    const player = this.deps.getPlayer();
    if (!player || player.isDead) return;

    // Block movement during zone transition
    if (this.deps.isZoning()) return;

    // Use nextGrid position if moving, otherwise current grid position
    // This prevents U-turns when changing direction mid-move
    const baseX = player.isMoving() ? player.nextGridX : player.gridX;
    const baseY = player.isMoving() ? player.nextGridY : player.gridY;
    const targetX = baseX + dx;
    const targetY = baseY + dy;

    // Check for entity at target position
    const entity = this.deps.getEntityAt(targetX, targetY);
    const isPhased = (player as any).isPhased;

    // If phased, can walk through mobs - ignore them entirely
    if (entity && !(entity instanceof Mob && isPhased)) {
      if (entity instanceof Mob) {
        this.makePlayerAttack(entity);
        return;
      }
      else if (entity instanceof Chest) {
        this.deps.getClient()?.sendOpen(entity);
        this.deps.audioManager.playSound('chest');
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
      else if (entity instanceof Player && entity.id !== this.deps.getPlayerId()) {
        this.deps.getClient()?.sendPlayerInspect(entity.id);
        return;
      }
      return; // Other entities block movement
    }

    // Check if target is walkable
    if (this.deps.map && this.deps.map.isColliding(targetX, targetY)) {
      return;
    }

    // Check plateau restrictions
    if (this.deps.map) {
      const playerOnPlateau = player.isOnPlateau;
      const targetOnPlateau = this.deps.map.isPlateau(targetX, targetY);
      if (playerOnPlateau !== targetOnPlateau) {
        return;
      }
    }

    this.makePlayerGoTo(targetX, targetY);
  }

  /**
   * Move player towards an item for pickup
   */
  makePlayerGoToItem(item: any): void {
    const player = this.deps.getPlayer();
    if (item && player) {
      player.isLootMoving = true;
      this.makePlayerGoTo(item.gridX, item.gridY);
      this.deps.getClient()?.sendLootMove(item, item.gridX, item.gridY);
    }
  }

  /**
   * Set player to follow NPC for conversation
   */
  makePlayerTalkTo(npc: any): void {
    const player = this.deps.getPlayer();
    if (npc && player) {
      player.setTarget(npc);
      player.follow(npc);
    }
  }

  /**
   * Set player to follow chest for opening
   */
  makePlayerOpenChest(chest: any): void {
    const player = this.deps.getPlayer();
    if (chest && player) {
      player.setTarget(chest);
      player.follow(chest);
    }
  }

  /**
   * Initiate attack on a mob
   */
  makePlayerAttack(mob: any): void {
    const player = this.deps.getPlayer();
    if (!player) return;

    // Can't attack while phased (Phase Shift skill active)
    if ((player as any).isPhased) {
      console.log('[Combat] Cannot attack while phased');
      return;
    }

    // Don't attack dying/dead mobs
    if (mob.isDying || mob.isDead) {
      return;
    }

    // Create attack link
    if (player.hasTarget()) {
      player.removeTarget();
    }
    player.engage(mob);

    if (player.id !== this.deps.getPlayerId()) {
      mob.addAttacker(player);
    }

    this.deps.getClient()?.sendAttack(mob);
  }

  /**
   * Initiate NPC conversation with AI dialogue
   */
  makeNpcTalk(npc: any): void {
    const player = this.deps.getPlayer();
    if (!npc || !player) return;

    this.deps.setPreviousClickPosition({ x: -1, y: -1 });
    this.deps.tryUnlockingAchievement('SMALL_TALK');

    if (npc.kind === Types.Entities.RICK) {
      this.deps.tryUnlockingAchievement('RICKROLLD');
    }

    // Store current NPC for response handling
    this.deps.setCurrentNpcTalk(npc);

    // Show thinking indicator
    this.deps.showBubbleFor(npc, '...');

    // Request AI-generated dialogue from server
    this.deps.getClient()?.sendNpcTalk(npc.kind);

    // Fallback: if no response in 5 seconds, use static dialogue
    const currentNpc = npc;
    setTimeout(() => {
      if (this.deps.getCurrentNpcTalk() === currentNpc) {
        this.deps.setCurrentNpcTalk(null);
        const msg = currentNpc.talk();
        if (msg) {
          this.deps.showBubbleFor(currentNpc, msg);
        }
        this.deps.audioManager.playSound('npc');
      }
    }, 5000);
  }

  /**
   * Handle click/touch event on the game
   */
  click(): void {
    const player = this.deps.getPlayer();
    const pos = this.deps.getMouseGridPosition();
    const prevPos = this.deps.getPreviousClickPosition();

    // Ignore duplicate clicks on same position
    if (pos.x === prevPos.x && pos.y === prevPos.y) {
      return;
    }
    this.deps.setPreviousClickPosition(pos);

    // Check if click is valid
    if (!this.deps.isStarted() ||
        !player ||
        this.deps.isZoning() ||
        this.deps.isZoningTile(player.nextGridX, player.nextGridY) ||
        player.isDead ||
        this.deps.hoveringCollidingTile() ||
        this.deps.hoveringPlateauTile()) {
      return;
    }

    const entity = this.deps.getEntityAt(pos.x, pos.y);
    console.log('[Click Debug] Position:', pos.x, pos.y,
      'Entity:', entity ? entity.kind : null,
      'isChest:', entity instanceof Chest,
      'constructor:', entity ? entity.constructor.name : null);

    if (entity instanceof Mob) {
      // If phased, walk through mobs instead of attacking
      if ((player as any).isPhased) {
        this.makePlayerGoTo(pos.x, pos.y);
      } else {
        this.makePlayerAttack(entity);
      }
    }
    else if (entity instanceof Chest) {
      // Check Chest BEFORE Item since Chest extends Item
      const isAdjacent = player.isAdjacentNonDiagonal(entity);
      console.log('[Chest Debug] Player at:', player.gridX, player.gridY,
        'Chest at:', entity.gridX, entity.gridY, 'Adjacent:', isAdjacent);
      if (isAdjacent === false) {
        this.makePlayerOpenChest(entity);
      } else {
        console.log('[Chest Debug] Sending OPEN to server for chest:', entity.id);
        this.deps.getClient()?.sendOpen(entity);
        this.deps.audioManager.playSound('chest');
      }
    }
    else if (entity instanceof Item) {
      this.makePlayerGoToItem(entity);
    }
    else if (entity instanceof Npc) {
      if (player.isAdjacentNonDiagonal(entity) === false) {
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
