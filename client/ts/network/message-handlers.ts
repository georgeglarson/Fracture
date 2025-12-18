/**
 * Network Message Handlers
 * Handles all incoming server messages and routes them to game actions
 * Uses EventEmitter pattern for clean pub/sub communication
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
import { ClientEvents } from './client-events';

// Kill notification batching system
const killBuffer: Map<string, number> = new Map();
let killBufferTimeout: ReturnType<typeof setTimeout> | null = null;

function addKillToBuffer(mobName: string, game: Game) {
  const current = killBuffer.get(mobName) || 0;
  killBuffer.set(mobName, current + 1);

  // Clear existing timeout and set a new one
  if (killBufferTimeout) {
    clearTimeout(killBufferTimeout);
  }

  // Flush after 1 second of no kills
  killBufferTimeout = setTimeout(() => {
    flushKillBuffer(game);
  }, 1000);
}

function flushKillBuffer(game: Game) {
  if (killBuffer.size === 0) return;

  // Build combined message
  const messages: string[] = [];
  killBuffer.forEach((count, mobName) => {
    if (count === 1) {
      const article = ['a', 'e', 'i', 'o', 'u'].includes(mobName[0]) ? 'an' : 'a';
      messages.push(`${article} ${mobName}`);
    } else {
      messages.push(`${count} ${mobName}s`);
    }
  });

  if (messages.length === 1) {
    game.showNotification(`You killed ${messages[0]}`);
  } else {
    game.showNotification(`You killed ${messages.join(', ')}`);
  }

  killBuffer.clear();
  killBufferTimeout = null;
}

/**
 * Sets up all network message handlers for the game client
 */
export function setupNetworkHandlers(game: Game, client: GameClient): void {
  setupSpawnHandlers(game, client);
  setupEntityHandlers(game, client);
  setupPlayerHandlers(game, client);
  setupCombatHandlers(game, client);
  setupAIHandlers(game, client);
  setupProgressionHandlers(game, client);
  setupMiscHandlers(game, client);
  setupShopHandlers(game, client);
  setupAchievementHandlers(game, client);
  setupPartyHandlers(game, client);
  setupInventoryHandlers(game, client);
  setupZoneHandlers(game, client);
  setupBossHandlers(game, client);
}

function setupSpawnHandlers(game: Game, client: GameClient): void {
  client.on(ClientEvents.SPAWN_ITEM, function (item, x, y) {
    console.info('Spawned ' + Types.getKindAsString(item.kind) + ' (' + item.id + ') at ' + x + ', ' + y);
    game.addItem(item, x, y);
  });

  client.on(ClientEvents.SPAWN_CHEST, function (chest, x, y) {
    console.info('Spawned chest (' + chest.id + ') at ' + x + ', ' + y);
    const chestSprite = game.sprites[chest.getSpriteName()];
    if (chestSprite) {
      chest.setSprite(chestSprite);
    } else {
      console.error('[Spawn] Missing sprite for chest:', chest.getSpriteName());
    }
    chest.setGridPosition(x, y);
    chest.setAnimation('idle_down', 150);
    game.addEntity(chest);

    chest.onOpen(function () {
      game.removeFromEntityGrid(chest, chest.gridX, chest.gridY);
      game.removeFromPathingGrid(chest.gridX, chest.gridY);
      chest.stopBlinking();
      const deathSprite = game.sprites['death'];
      if (deathSprite) {
        chest.setSprite(deathSprite);
      }
      chest.setAnimation('death', 120, 1, function () {
        console.info(chest.id + ' was removed');
        game.removeEntity(chest);
        game.removeFromRenderingGrid(chest, chest.gridX, chest.gridY);
        game.previousClickPosition = { x: -1, y: -1 };
      });
    });
  });

  client.on(ClientEvents.SPAWN_CHARACTER, function (entity, x, y, orientation, targetId) {
    if (!game.entityIdExists(entity.id)) {
      try {
        if (entity.id !== game.playerId) {
          const entitySprite = game.sprites[entity.getSpriteName()];
          if (entitySprite) {
            entity.setSprite(entitySprite);
          } else {
            console.error('[Spawn] Missing sprite for entity:', entity.getSpriteName());
          }
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
      game.renderer.particles.spawnDeathParticles(entity.x, entity.y - 8);
      game.renderer.camera.shake(4, 100);
    }

    entity.isDying = true;
    const deathSpriteName = entity instanceof Mobs.Rat ? 'rat' : 'death';
    const deathSprite = game.sprites[deathSpriteName];
    if (deathSprite) {
      entity.setSprite(deathSprite);
    }
    entity.animate('death', 120, 1, function () {
      console.info(entity.id + ' was removed');
      game.removeEntity(entity);
      game.removeFromRenderingGrid(entity, entity.gridX, entity.gridY);
    });

    entity.forEachAttacker(function (attacker) {
      attacker.disengage();
    });

    if (game.player && game.player.target && game.player.target.id === entity.id) {
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
  client.on(ClientEvents.DESPAWN, function (entityId) {
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

  client.on(ClientEvents.BLINK, function (id) {
    var item = game.getEntityById(id);
    if (item) {
      item.blink(150);
    }
  });

  client.on(ClientEvents.MOVE, function (id, x, y) {
    if (id !== game.playerId) {
      var entity = game.getEntityById(id);

      if (entity) {
        if (game.player && game.player.isAttackedBy(entity)) {
          game.tryUnlockingAchievement('COWARD');
        }
        entity.disengage();
        entity.idle();
        game.makeCharacterGoTo(entity, x, y);
      }
    }
  });

  client.on(ClientEvents.DESTROY, function (id) {
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

  client.on(ClientEvents.LOOT_MOVE, function (playerId, itemId) {
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
  client.on(ClientEvents.HEALTH, function (points, isRegen) {
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
        const shakeIntensity = Math.min(6, 3 + Math.floor(-diff / 10));
        game.renderer.camera.shake(shakeIntensity, 120);
        game.renderer.particles.spawnHitParticles(player.x, player.y - 8, 6, '#ff2222');
        // Trigger fracture damage effects
        if (game.fractureAtmosphere) {
          game.fractureAtmosphere.onPlayerDamage();
        }
        // Low health warning (below 25%)
        const healthPercent = points / player.maxHitPoints;
        if (healthPercent <= 0.25 && healthPercent > 0) {
          game.audioManager.playSound('glitch1');
          game.showNotification('Health critical!');
        }
        if (game.playerhurt_callback) {
          game.playerhurt_callback();
        }
      } else if (!isRegen) {
        game.infoManager.addDamageInfo('+' + diff, player.x, player.y - 15, 'healed');
      }
      game.updateBars();
    }
  });

  client.on(ClientEvents.HP, function (hp) {
    if (!game.player) return;
    game.player.maxHitPoints = hp;
    game.player.hitPoints = hp;
    game.updateBars();
  });

  client.on(ClientEvents.EQUIP, function (playerId, itemKind) {
    var player = game.getEntityById(playerId);
    var itemName = Types.getKindAsString(itemKind);

    if (player) {
      if (Types.isArmor(itemKind)) {
        var sprite = game.sprites[itemName];
        if (sprite) {
          player.setSprite(sprite);
          // Also update spriteName so getSpriteName() returns the correct armor
          if (typeof player.setSpriteName === 'function') {
            player.setSpriteName(itemName);
          }
        } else {
          console.error('[Equip] Missing sprite for armor:', itemName);
        }
      } else if (Types.isWeapon(itemKind)) {
        player.setWeaponName(itemName);
      }

      // For local player, update equipment display and play sound
      if (playerId === game.playerId) {
        game.audioManager.playSound('equip');
        game.updateEquippedDisplay();
      }
    }
  });

  client.on(ClientEvents.TELEPORT, function (id, x, y) {
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

  client.on(ClientEvents.DROP, function (item, mobId) {
    var pos = game.getDeadMobPosition(mobId);
    if (pos) {
      game.addItem(item, pos.x, pos.y);
      game.updateCursor();
    }
  });

  client.on(ClientEvents.POPULATION, function (worldPlayers, totalPlayers) {
    if (game.nbplayers_callback) {
      game.nbplayers_callback(worldPlayers, totalPlayers);
    }
  });

  client.on(ClientEvents.DISCONNECTED, function (message) {
    if (game.player) {
      game.player.die();
    }
    if (game.disconnect_callback) {
      game.disconnect_callback(message);
    }
  });
}

function setupCombatHandlers(game: Game, client: GameClient): void {
  client.on(ClientEvents.ATTACK, function (attackerId, targetId) {
    var attacker = game.getEntityById(attackerId);
    var target = game.getEntityById(targetId);

    // Trigger combat music if player is involved
    if (attackerId === game.playerId || targetId === game.playerId) {
      game.audioManager.enterCombat();
    }

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

  client.on(ClientEvents.DAMAGE, function (mobId, points, hp, maxHp) {
    var mob = game.getEntityById(mobId);
    if (mob && points) {
      game.infoManager.addDamageInfo(points, mob.x, mob.y - 15, 'inflicted');
      // Update mob health for health bar display
      if (hp !== undefined && maxHp !== undefined) {
        mob.hitPoints = hp;
        mob.maxHitPoints = maxHp;

        // If mob HP reaches 0, mark as dying immediately to prevent targeting
        // before DESPAWN message arrives (fixes "immortal mob" race condition)
        if (hp <= 0 && !mob.isDying) {
          mob.isDying = true;
          // If player is targeting this mob, disengage
          if (game.player && game.player.target && game.player.target.id === mob.id) {
            game.player.disengage();
          }
        }
      }
      // Refresh combat timer when dealing damage
      game.audioManager.refreshCombat();
    }
  });

  client.on(ClientEvents.KILL, function (kind) {
    var mobName = Types.getKindAsString(kind);

    if (mobName === 'skeleton2') mobName = 'greater skeleton';
    if (mobName === 'eye') mobName = 'evil eye';
    if (mobName === 'deathknight') mobName = 'death knight';

    // Boss kills always show immediately
    if (mobName === 'boss') {
      game.showNotification('You killed the skeleton king');
    } else {
      // Batch regular kills to reduce spam
      addKillToBuffer(mobName, game);
    }

    // Start fading out combat music after kill
    game.audioManager.exitCombat();

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
  client.on(ClientEvents.NPC_TALK, function (npcKind, response, audioUrl) {
    if (game.currentNpcTalk) {
      var npc = game.currentNpcTalk;
      game.currentNpcTalk = null;
      if (response) {
        game.showBubbleFor(npc, response);
        // Play TTS audio if available, otherwise fall back to sound effect
        if (audioUrl && audioUrl.length > 0) {
          game.audioManager.playNpcVoice(audioUrl);
        } else {
          game.audioManager.playSound('npc');
        }
      }
    }
  });

  client.on(ClientEvents.COMPANION_HINT, function (hint) {
    if (hint && game.player) {
      game.showBubbleFor(game.player, '\u2728 ' + hint);
    }
  });

  client.on(ClientEvents.QUEST_OFFER, function (quest) {
    if (quest && game.notification_callback) {
      game.notification_callback('Quest: ' + quest.description);
      game.currentQuest = quest;
    }
  });

  client.on(ClientEvents.QUEST_COMPLETE, function (result) {
    if (result && game.notification_callback) {
      game.notification_callback('Quest Complete! Reward: ' + result.reward);
      game.currentQuest = null;
    }
  });

  client.on(ClientEvents.ITEM_LORE, function (itemKind, lore) {
    if (lore && game.notification_callback) {
      var itemName = Types.getKindAsString(itemKind);
      game.notification_callback(itemName + ': ' + lore);
    }
  });

  client.on(ClientEvents.NARRATOR, function (text, style, audioUrl) {
    if (text) {
      game.showNarratorText(text, style);
      // Play narrator TTS audio if available
      if (audioUrl && game.audioManager) {
        console.log('[Narrator] Playing TTS audio:', audioUrl);
        game.audioManager.playNpcVoice(audioUrl);
      }
    }
  });

  client.on(ClientEvents.ENTITY_THOUGHT, function (entityId, thought, state) {
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

  client.on(ClientEvents.NEWS, function (headlines) {
    console.log('[TownCrier] Showing newspaper with', headlines.length, 'headlines');
    game.showNewspaper(headlines);
  });

  client.on(ClientEvents.CHAT, function (entityId, message) {
    // System messages should be shown as notifications, not chat bubbles
    const systemMessages = [
      'Inventory full',
      'Cannot sell',
      'Not enough gold'
    ];

    const isSystemMessage = systemMessages.some(prefix => message.startsWith(prefix));

    if (isSystemMessage) {
      // Show as toast notification instead of chat bubble
      game.showNotification(message);
      game.audioManager.playSound('noloot');
      return;
    }

    var entity = game.getEntityById(entityId);
    if (entity) {
      game.showBubbleFor(entity, message);
    }
    game.audioManager.playSound('chat');
  });
}

function setupProgressionHandlers(game: Game, client: GameClient): void {
  client.on(ClientEvents.XP_GAIN, function (amount, currentXp, xpToNext) {
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

  client.on(ClientEvents.LEVEL_UP, function (newLevel, bonusHP, bonusDamage) {
    game.playerLevel = newLevel;
    game.playerXp = 0;

    game.storage.saveProgression(newLevel, game.playerXp, game.playerXpToNext);

    if (game.notification_callback) {
      game.notification_callback('Level Up! You are now level ' + newLevel + ' (+' + bonusHP + ' HP, +' + bonusDamage + ' damage)');
    }

    game.audioManager.playSound('levelup');

    if (game.playerxp_callback) {
      game.playerxp_callback(game.playerXp, game.playerXpToNext, newLevel);
    }

    if (game.levelup_callback) {
      game.levelup_callback(newLevel, bonusHP, bonusDamage);
    }

    // Show "Hire Me" banner for 5 seconds on level up
    const hireMe = document.getElementById('hire-me');
    if (hireMe) {
      hireMe.classList.add('visible');
      setTimeout(() => hireMe.classList.remove('visible'), 5000);
    }
  });

  client.on(ClientEvents.GOLD_GAIN, function (amount, totalGold) {
    game.playerGold = totalGold;

    game.storage.saveGold(totalGold);

    if (game.player) {
      game.infoManager.addDamageInfo('+' + amount + 'g', game.player.x, game.player.y - 25, 'gold');
    }

    game.audioManager.playSound('gold');

    if (game.playergold_callback) {
      game.playergold_callback(totalGold);
    }
  });

  client.on(ClientEvents.DAILY_REWARD, function (gold, xp, streak, isNewDay) {
    if (!isNewDay) {
      console.log('[Daily] Already claimed today');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    game.storage.saveDailyLogin(today, streak);
    game.showDailyRewardPopup(gold, xp, streak);
  });
}

function setupMiscHandlers(game: Game, client: GameClient): void {
  // Additional handlers can be added here
}

function setupShopHandlers(game: Game, client: GameClient): void {
  client.on(ClientEvents.SHOP_OPEN, function (npcKind, shopName, items) {
    game.showShop(npcKind, shopName, items);
  });

  client.on(ClientEvents.SHOP_BUY_RESULT, function (success, itemKind, newGold, message) {
    game.handleShopBuyResult(success, itemKind, newGold, message);
  });

  client.on(ClientEvents.SHOP_SELL_RESULT, function (success, goldGained, newGold, message) {
    game.handleShopSellResult(success, goldGained, newGold, message);
  });
}

function setupAchievementHandlers(game: Game, client: GameClient): void {
  client.on(ClientEvents.ACHIEVEMENT_INIT, function (unlocked, progress, selectedTitle) {
    game.handleAchievementInit(unlocked, progress, selectedTitle);
  });

  client.on(ClientEvents.ACHIEVEMENT_UNLOCK, function (achievementId) {
    game.handleAchievementUnlock(achievementId);
    game.audioManager.playSound('quest');
  });

  client.on(ClientEvents.ACHIEVEMENT_PROGRESS, function (achievementId, current, target) {
    game.handleAchievementProgress(achievementId, current, target);
  });

  client.on(ClientEvents.PLAYER_TITLE_UPDATE, function (playerId, title) {
    game.handlePlayerTitleUpdate(playerId, title);
  });
}

function setupPartyHandlers(game: Game, client: GameClient): void {
  client.on(ClientEvents.PARTY_INVITE_RECEIVED, function (inviterId, inviterName) {
    game.handlePartyInvite(inviterId, inviterName);
  });

  client.on(ClientEvents.PARTY_JOIN, function (partyId, members, leaderId) {
    game.handlePartyJoin(partyId, members, leaderId);
  });

  client.on(ClientEvents.PARTY_LEAVE, function (playerId) {
    game.handlePartyLeave(playerId);
  });

  client.on(ClientEvents.PARTY_DISBAND, function () {
    game.handlePartyDisband();
  });

  client.on(ClientEvents.PARTY_UPDATE, function (members) {
    game.handlePartyUpdate(members);
  });

  client.on(ClientEvents.PARTY_CHAT, function (senderId, senderName, message) {
    game.handlePartyChat(senderId, senderName, message);
  });

  client.on(ClientEvents.PLAYER_INSPECT_RESULT, function (playerId, name, title, level, weapon, armor) {
    game.handlePlayerInspectResult(playerId, name, title, level, weapon, armor);
  });
}

function setupInventoryHandlers(game: Game, client: GameClient): void {
  client.on(ClientEvents.INVENTORY_INIT, function (slots) {
    game.handleInventoryInit(slots);
  });

  client.on(ClientEvents.INVENTORY_ADD, function (slotIndex, kind, properties, count) {
    game.handleInventoryAdd(slotIndex, kind, properties, count);
    // Play loot sound when server confirms item was picked up
    game.audioManager?.playSound('loot');
  });

  client.on(ClientEvents.INVENTORY_REMOVE, function (slotIndex) {
    game.handleInventoryRemove(slotIndex);
  });

  client.on(ClientEvents.INVENTORY_UPDATE, function (slotIndex, count) {
    game.handleInventoryUpdate(slotIndex, count);
  });
}

function setupZoneHandlers(game: Game, client: GameClient): void {
  // Zone enter notification - show zone name and level range
  client.on(ClientEvents.ZONE_ENTER, function (zoneId, zoneName, minLevel, maxLevel, warning) {
    game.handleZoneEnter(zoneId, zoneName, minLevel, maxLevel, warning);
  });

  // Zone info - update UI with bonus percentages
  client.on(ClientEvents.ZONE_INFO, function (zoneId, rarityBonus, goldBonus, xpBonus) {
    game.handleZoneInfo(zoneId, rarityBonus, goldBonus, xpBonus);
  });
}

function setupBossHandlers(game: Game, client: GameClient): void {
  // Leaderboard response - show boss kill rankings
  client.on(ClientEvents.LEADERBOARD_RESPONSE, function (entries) {
    game.handleLeaderboardResponse(entries);
  });

  // Boss kill announcement - show notification when boss is killed
  client.on(ClientEvents.BOSS_KILL, function (bossName, killerName) {
    game.handleBossKill(bossName, killerName);
  });

  // Kill streak announcement - show when player reaches a new tier
  client.on(ClientEvents.KILL_STREAK, function (playerId, playerName, streakCount, tierTitle, announcement) {
    game.handleKillStreak(playerId, playerName, streakCount, tierTitle, announcement);
  });

  // Kill streak ended - show when a player's streak is broken
  client.on(ClientEvents.KILL_STREAK_ENDED, function (playerId, playerName, streakCount, endedByName) {
    game.handleKillStreakEnded(playerId, playerName, streakCount, endedByName);
  });

  // Nemesis power up - show when a mob becomes more powerful after killing players
  client.on(ClientEvents.NEMESIS_POWER_UP, function (mobId, originalName, nemesisName, title, powerLevel, kills, victimName) {
    game.handleNemesisPowerUp(mobId, originalName, nemesisName, title, powerLevel, kills, victimName);
  });

  // Nemesis killed - show when a nemesis is slain (possibly revenge)
  client.on(ClientEvents.NEMESIS_KILLED, function (mobId, nemesisName, title, kills, killerName, isRevenge) {
    game.handleNemesisKilled(mobId, nemesisName, title, kills, killerName, isRevenge);
  });
}
