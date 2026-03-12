/**
 * AuthHandler - Handles HELLO (initial handshake / authentication) messages
 *
 * Single Responsibility: Player authentication, character creation/loading, game entry
 * Extracted from message-router.ts to reduce its size.
 */

import { Types } from '../../../shared/ts/gametypes';
import { createModuleLogger } from '../utils/logger.js';
import * as AchievementHandler from './achievement.handler';
import * as VeniceHandler from './venice.handler';
import * as InventoryHandler from './inventory.handler';
import * as SkillHandler from './skill.handler';
import type { Player } from '../player';

const log = createModuleLogger('AuthHandler');

/**
 * HELLO - Initial handshake: authenticate, create/load character, enter game
 */
export async function handleHello(player: Player, msg: any[], Utils: any, Formulas: any): Promise<void> {
  const name = Utils.sanitize(msg[1]);
  const password = msg[5] || ''; // Password is now at index 5
  player.name = (name === '') ? 'lorem ipsum' : name.substr(0, 15);
  player.kind = Types.Entities.WARRIOR;

  const world = player.getWorld();
  const storage = world.getStorageService();
  const characterExists = storage.characterExists(player.name);

  if (characterExists) {
    // Existing character - verify password
    if (!storage.verifyPassword(player.name, password)) {
      log.warn({ playerName: player.name }, 'Wrong password');
      player.send([Types.Messages.AUTH_FAIL, 'wrong_password']);
      return; // Don't proceed - client should disconnect
    }

    // Password correct - load character
    const loaded = player.loadFromStorage(storage);
    if (loaded) {
      log.info({ playerName: player.name }, 'Loaded returning player');
    }
  } else {
    // New character - password is required
    if (!password || password.length < 3) {
      log.warn({ playerName: player.name }, 'Password too short for new character');
      player.send([Types.Messages.AUTH_FAIL, 'password_required']);
      return;
    }

    // Create new character with password
    const newChar = storage.createCharacter(player.name, password);
    player.characterId = newChar.id;

    // Apply starting equipment (ignore client-provided values — enforce defaults)
    player.equipArmor(Types.Entities.CLOTHARMOR);
    player.equipWeapon(Types.Entities.SWORD1);
    player.setGold(0);
    log.info({ playerName: player.name, characterId: player.characterId }, 'Created new character');
  }

  player.orientation = Utils.randomOrientation();
  player.updateHitPoints();
  player.updatePosition();

  // Set spawn protection BEFORE adding to world so aggro tick can't target us
  player.isDead = false;
  player.spawnProtectionUntil = Date.now() + 10000; // 10 second aggro immunity on spawn

  world.addPlayer(player);
  world.enterCallback(player);

  // Send expanded WELCOME with full player state
  // [WELCOME, id, name, x, y, hp, maxHp, level, xp, xpToNext, gold]
  player.send([
    Types.Messages.WELCOME,
    player.id,
    player.name,
    player.x,
    player.y,
    player.hitPoints,
    player.maxHitPoints,
    player.level || 1,
    player.xp || 0,
    Formulas.xpToNextLevel(player.level || 1),
    player.gold || 0
  ]);
  player.hasEnteredGame = true;

  AchievementHandler.initAchievements(player);
  await VeniceHandler.triggerNarration(player, 'join');

  // Send inventory state to client
  InventoryHandler.sendInventoryInit(player);

  // Send skill state to client
  SkillHandler.sendSkillInit(player);

  // Initialize progression system (efficiency, rested XP, ascension)
  player.initProgressionSystem();

  // Send current equipment to client (so UI can display it)
  if (player.weapon) {
    player.send([Types.Messages.EQUIP, player.id, player.weapon]);
  }
  if (player.armor) {
    player.send([Types.Messages.EQUIP, player.id, player.armor]);
  }
}
