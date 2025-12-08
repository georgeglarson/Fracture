/**
 * Network Message Handlers
 * Handles all incoming server messages and routes them to game actions
 */

import { Types } from '../../../shared/ts/gametypes';
import { Character } from '../entity/character/character';
import { Player } from '../entity/character/player/player';
import { Mob } from '../entity/character/mob/mob';
import { Mobs } from '../entity/character/mob/mobs';
import { Item } from '../entity/objects/item';
import { Chest } from '../entity/objects/chest';
import { Npc } from '../entity/character/npc/npc';
import _ from 'lodash';

import type { Game } from '../game';
import type { GameClient } from './gameclient';

/**
 * Sets up all network message handlers for the game client
 */
export function setupNetworkHandlers(game: Game, client: GameClient): void {
  // Spawning handlers
  setupSpawnHandlers(game, client);

  // Entity state handlers
  setupEntityHandlers(game, client);

  // Player-specific handlers
  setupPlayerHandlers(game, client);

  // Combat handlers
  setupCombatHandlers(game, client);

  // AI/Venice handlers
  setupAIHandlers(game, client);

  // Progression handlers
  setupProgressionHandlers(game, client);

  // Misc handlers
  setupMiscHandlers(game, client);
}

function setupSpawnHandlers(game: Game, client: GameClient): void {
  client.onSpawnItem(function (item, x, y) {
    console.info('Spawned ' + Types.getKindAsString(item.kind) + ' (' + item.id + ') at ' + x + ', ' + y);
    game.addItem(item, x, y);
  });

  client.onSpawnChest(function (chest, x, y) {
    console.info('Spawned chest (' + chest.id + ') at ' + x + ', ' + y);
    chest.setSprite(game.sprites[chest.getSpriteName()]);
    chest.setGridPosition(x, y);
    chest.setAnimation('idle_down', 150);
    game.addEntity(chest);

    chest.onOpen(function () {
      game.removeFromPathingGrid(chest.gridX, chest.gridY);
      chest.stopBlinking();
      chest.setSprite(game.sprites['death']);
      chest.setAnimation('death', 120, 1, function () {
        console.info(chest.id + ' was removed');
        game.removeEntity(chest);
        game.removeFromRenderingGrid(chest, chest.gridX, chest.gridY);
        game.previousClickPosition = { x: -1, y: -1 };
      });
    });
  });

  client.onSpawnCharacter(function (entity, x, y, orientation, targetId) {
    if (!game.entityIdExists(entity.id)) {
      try {
        if (entity.id !== game.playerId) {
          entity.setSprite(game.sprites[entity.getSpriteName()]);
          entity.setGridPosition(x, y);
          entity.setOrientation(orientation);
          entity.idle();

          game.addEntity(entity);

          console.debug('Spawned ' + Types.getKindAsString(entity.kind) + ' (' + entity.id + ') at ' + entity.gridX + ', ' + entity.gridY);

          if (entity instanceof Character) {
            setupCharacterCallbacks(game, entity);

            if (entity instanceof Mob) {
              if (targetId) {
                var player = game.getEntityById(targetId);
                if (player) {
                  game.createAttackLink(entity, player);
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
}

function setupCharacterCallbacks(game: Game, entity: Character): void {
  entity.onBeforeStep(function () {
    game.unregisterEntityPosition(entity);
  });

  entity.onStep(function () {
    if (!entity.isDying) {
      game.registerEntityDualPosition(entity);

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

        if (game.map.isDoor(gridX, gridY)) {
          var dest = game.map.getDoorDestination(gridX, gridY);
          entity.setGridPosition(dest.x, dest.y);
        }
      }

      entity.forEachAttacker(function (attacker) {
        if (!attacker.isAdjacentNonDiagonal(entity) && attacker.id !== game.playerId) {
          attacker.follow(entity);
        }
      });

      game.unregisterEntityPosition(entity);
      game.registerEntityPosition(entity);
    }
  });

  entity.onRequestPath(function (x, y) {
    var ignored = [entity],
      ignoreTarget = function (target) {
        ignored.push(target);
        target.forEachAttacker(function (attacker) {
          ignored.push(attacker);
        });
      };

    if (entity.hasTarget()) {
      ignoreTarget(entity.target);
    } else if (entity.previousTarget) {
      ignoreTarget(entity.previousTarget);
    }

    return game.findPath(entity, x, y, ignored);
  });

  entity.onDeath(function () {
    console.info(entity.id + ' is dead');

    if (entity instanceof Mob) {
      game.entityManager?.recordDeathPosition(entity.id, entity.gridX, entity.gridY);
    }

    entity.isDying = true;
    entity.setSprite(game.sprites[entity instanceof Mobs.Rat ? 'rat' : 'death']);
    entity.animate('death', 120, 1, function () {
      console.info(entity.id + ' was removed');
      game.removeEntity(entity);
      game.removeFromRenderingGrid(entity, entity.gridX, entity.gridY);
    });

    entity.forEachAttacker(function (attacker) {
      attacker.disengage();
    });

    if (game.player.target && game.player.target.id === entity.id) {
      game.player.disengage();
    }

    game.removeFromEntityGrid(entity, entity.gridX, entity.gridY);
    game.removeFromPathingGrid(entity.gridX, entity.gridY);

    if (game.camera.isVisible(entity)) {
      game.audioManager.playSound('kill' + Math.floor(Math.random() * 2 + 1));
    }

    game.updateCursor();
  });

  entity.onHasMoved(function (entity) {
    game.assignBubbleTo(entity);
  });
}

function setupEntityHandlers(game: Game, client: GameClient): void {
  client.onDespawnEntity(function (entityId) {
    var entity = game.getEntityById(entityId);

    if (entity) {
      console.info('Despawning ' + Types.getKindAsString(entity.kind) + ' (' + entity.id + ')');

      if (entity.gridX === game.previousClickPosition.x
        && entity.gridY === game.previousClickPosition.y) {
        game.previousClickPosition = { x: -1, y: -1 };
      }

      if (entity instanceof Item) {
        game.removeItem(entity);
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

  client.onItemBlink(function (id) {
    var item = game.getEntityById(id);
    if (item) {
      item.blink(150);
    }
  });

  client.onEntityMove(function (id, x, y) {
    if (id !== game.playerId) {
      var entity = game.getEntityById(id);

      if (entity) {
        if (game.player.isAttackedBy(entity)) {
          game.tryUnlockingAchievement('COWARD');
        }
        entity.disengage();
        entity.idle();
        game.makeCharacterGoTo(entity, x, y);
      }
    }
  });

  client.onEntityDestroy(function (id) {
    var entity = game.getEntityById(id);
    if (entity) {
      if (entity instanceof Item) {
        game.removeItem(entity);
      } else {
        game.removeEntity(entity);
      }
      console.debug('Entity was destroyed: ' + entity.id);
    }
  });

  client.onPlayerMoveToItem(function (playerId, itemId) {
    if (playerId !== game.playerId) {
      var player = game.getEntityById(playerId);
      var item = game.getEntityById(itemId);

      if (player && item) {
        game.makeCharacterGoTo(player, item.gridX, item.gridY);
      }
    }
  });
}

function setupPlayerHandlers(game: Game, client: GameClient): void {
  client.onPlayerChangeHealth(function (points, isRegen) {
    var player = game.player;

    if (player && !player.isDead && !player.invincible) {
      var isHurt = points <= player.hitPoints;
      var diff = points - player.hitPoints;
      player.hitPoints = points;

      if (player.hitPoints <= 0) {
        player.die();
      }
      if (isHurt) {
        player.hurt();
        game.infoManager.addDamageInfo(diff, player.x, player.y - 15, 'received');
        game.audioManager.playSound('hurt');
        game.storage.addDamage(-diff);
        game.tryUnlockingAchievement('MEATSHIELD');
        // Screen shake on damage - intensity scales with damage taken
        const shakeIntensity = Math.min(6, 3 + Math.floor(-diff / 10));
        game.renderer.camera.shake(shakeIntensity, 120);
        // Blood particles on player when hurt
        game.renderer.particles.spawnHitParticles(
          player.x,
          player.y - 8,
          6,
          '#ff2222'
        );
        if (game.playerhurt_callback) {
          game.playerhurt_callback();
        }
      } else if (!isRegen) {
        game.infoManager.addDamageInfo('+' + diff, player.x, player.y - 15, 'healed');
      }
      game.updateBars();
    }
  });

  client.onPlayerChangeMaxHitPoints(function (hp) {
    game.player.maxHitPoints = hp;
    game.player.hitPoints = hp;
    game.updateBars();
  });

  client.onPlayerEquipItem(function (playerId, itemKind) {
    var player = game.getEntityById(playerId);
    var itemName = Types.getKindAsString(itemKind);

    if (player) {
      if (Types.isArmor(itemKind)) {
        player.setSprite(game.sprites[itemName]);
      } else if (Types.isWeapon(itemKind)) {
        player.setWeaponName(itemName);
      }
    }
  });

  client.onPlayerTeleport(function (id, x, y) {
    if (id !== game.playerId) {
      var entity = game.getEntityById(id);

      if (entity) {
        var currentOrientation = entity.orientation;
        game.makeCharacterTeleportTo(entity, x, y);
        entity.setOrientation(currentOrientation);

        entity.forEachAttacker(function (attacker) {
          attacker.disengage();
          attacker.idle();
          attacker.stop();
        });
      }
    }
  });

  client.onDropItem(function (item, mobId) {
    var pos = game.getDeadMobPosition(mobId);
    if (pos) {
      game.addItem(item, pos.x, pos.y);
      game.updateCursor();
    }
  });

  client.onPopulationChange(function (worldPlayers, totalPlayers) {
    if (game.nbplayers_callback) {
      game.nbplayers_callback(worldPlayers, totalPlayers);
    }
  });

  client.onDisconnected(function (message) {
    if (game.player) {
      game.player.die();
    }
    if (game.disconnect_callback) {
      game.disconnect_callback(message);
    }
  });
}

function setupCombatHandlers(game: Game, client: GameClient): void {
  client.onEntityAttack(function (attackerId, targetId) {
    var attacker = game.getEntityById(attackerId);
    var target = game.getEntityById(targetId);

    if (attacker && target && attacker.id !== game.playerId) {
      console.debug(attacker.id + ' attacks ' + target.id);

      if (target instanceof Player && target.id !== game.playerId && target.target && target.target.id === attacker.id && attacker.getDistanceToEntity(target) < 3) {
        setTimeout(function () {
          game.createAttackLink(attacker, target);
        }, 200);
      } else {
        game.createAttackLink(attacker, target);
      }
    }
  });

  client.onPlayerDamageMob(function (mobId, points) {
    var mob = game.getEntityById(mobId);
    if (mob && points) {
      game.infoManager.addDamageInfo(points, mob.x, mob.y - 15, 'inflicted');
    }
  });

  client.onPlayerKillMob(function (kind) {
    var mobName = Types.getKindAsString(kind);

    if (mobName === 'skeleton2') mobName = 'greater skeleton';
    if (mobName === 'eye') mobName = 'evil eye';
    if (mobName === 'deathknight') mobName = 'death knight';

    if (mobName === 'boss') {
      game.showNotification('You killed the skeleton king');
    } else {
      if (_.include(['a', 'e', 'i', 'o', 'u'], mobName[0])) {
        game.showNotification('You killed an ' + mobName);
      } else {
        game.showNotification('You killed a ' + mobName);
      }
    }

    game.storage.incrementTotalKills();
    game.tryUnlockingAchievement('HUNTER');

    if (kind === Types.Entities.RAT) {
      game.storage.incrementRatCount();
      game.tryUnlockingAchievement('ANGRY_RATS');
    }

    if (kind === Types.Entities.SKELETON || kind === Types.Entities.SKELETON2) {
      game.storage.incrementSkeletonCount();
      game.tryUnlockingAchievement('SKULL_COLLECTOR');
    }

    if (kind === Types.Entities.BOSS) {
      game.tryUnlockingAchievement('HERO');
    }
  });
}

function setupAIHandlers(game: Game, client: GameClient): void {
  client.onNpcTalkResponse(function (npcKind, response) {
    if (game.currentNpcTalk) {
      var npc = game.currentNpcTalk;
      game.currentNpcTalk = null;
      if (response) {
        game.createBubble(npc.id, response);
        game.assignBubbleTo(npc);
        game.audioManager.playSound('npc');
      }
    }
  });

  client.onCompanionHint(function (hint) {
    if (hint && game.player) {
      game.createBubble(game.player.id, '\u2728 ' + hint);
      game.assignBubbleTo(game.player);
    }
  });

  client.onQuestOffer(function (quest) {
    if (quest && game.notification_callback) {
      game.notification_callback('Quest: ' + quest.description);
      game.currentQuest = quest;
    }
  });

  client.onQuestComplete(function (result) {
    if (result && game.notification_callback) {
      game.notification_callback('Quest Complete! Reward: ' + result.reward);
      game.currentQuest = null;
    }
  });

  client.onItemLore(function (itemKind, lore) {
    if (lore && game.notification_callback) {
      var itemName = Types.getKindAsString(itemKind);
      game.notification_callback(itemName + ': ' + lore);
    }
  });

  client.onNarrator(function (text, style) {
    if (text) {
      game.showNarratorText(text, style);
    }
  });

  client.onEntityThought(function (entityId, thought, state) {
    console.log('[Thought] Received for entity', entityId, ':', thought);
    var entity = game.getEntityById(entityId);
    if (entity) {
      entity.currentThought = thought;
      entity.thoughtState = state;
      entity.thoughtTime = Date.now();
      console.log('[Thought] Set on', entity.kind, '(id:', entityId, '):', thought);
    } else {
      console.warn('[Thought] Entity not found:', entityId, '- thought discarded');
    }
  });

  client.onNewsResponse(function (headlines) {
    console.log('[TownCrier] Showing newspaper with', headlines.length, 'headlines');
    game.showNewspaper(headlines);
  });

  client.onChatMessage(function (entityId, message) {
    var entity = game.getEntityById(entityId);
    game.createBubble(entityId, message);
    game.assignBubbleTo(entity);
    game.audioManager.playSound('chat');
  });
}

function setupProgressionHandlers(game: Game, client: GameClient): void {
  client.onXpGain(function (amount, currentXp, xpToNext) {
    game.playerXp = currentXp;
    game.playerXpToNext = xpToNext;

    game.storage.saveProgression(game.playerLevel, currentXp, xpToNext);

    if (game.player) {
      game.infoManager.addDamageInfo('+' + amount + ' XP', game.player.x, game.player.y - 15, 'xp');
    }

    if (game.playerxp_callback) {
      game.playerxp_callback(currentXp, xpToNext, game.playerLevel);
    }
  });

  client.onLevelUp(function (newLevel, bonusHP, bonusDamage) {
    game.playerLevel = newLevel;
    game.playerXp = 0;

    game.storage.saveProgression(newLevel, game.playerXp, game.playerXpToNext);

    if (game.notification_callback) {
      game.notification_callback('Level Up! You are now level ' + newLevel + ' (+' + bonusHP + ' HP, +' + bonusDamage + ' damage)');
    }

    game.audioManager.playSound('achievement');

    if (game.playerxp_callback) {
      game.playerxp_callback(game.playerXp, game.playerXpToNext, newLevel);
    }

    if (game.levelup_callback) {
      game.levelup_callback(newLevel, bonusHP, bonusDamage);
    }
  });
}

function setupMiscHandlers(game: Game, client: GameClient): void {
  // Any additional handlers can be added here
}
