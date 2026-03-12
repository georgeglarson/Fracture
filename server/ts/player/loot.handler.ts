/**
 * LootHandler - Handles LOOT (item pickup) messages
 *
 * Single Responsibility: Item pickup, consumable use, equipment routing
 * Extracted from message-router.ts to reduce its size.
 */

import { Types } from '../../../shared/ts/gametypes';
import { Messages } from '../message';
import * as InventoryHandler from './inventory.handler';
import { persistInventory } from './inventory.handler';
import type { Player } from '../player';

/**
 * LOOT - Pick up an item from the ground
 */
export function handleLoot(player: Player, msg: any[]): void {
  const world = player.getWorld();
  const item = world.getEntityById(msg[1]);

  if (item) {
    const kind = item.kind;

    if (Types.isItem(kind)) {
      // Equipment goes to inventory instead of auto-equipping
      if (Types.isArmor(kind) || Types.isWeapon(kind)) {
        InventoryHandler.handleInventoryPickup(player, item.id);
        persistInventory(player);
        return;
      }

      // Consumables are used immediately (original behavior)
      player.broadcast(item.despawn());
      world.removeEntity(item);

      if (kind === Types.Entities.FIREPOTION) {
        player.updateHitPoints();
        player.broadcast(player.equip(Types.Entities.FIREFOX));
        player.firepotionTimeout = setTimeout(() => {
          player.broadcast(player.equip(player.armor));
          player.firepotionTimeout = null;
        }, 15000);
        player.send(new Messages.HitPoints(player.maxHitPoints).serialize());
      } else if (Types.isHealingItem(kind)) {
        let amount = 0;
        switch (kind) {
          case Types.Entities.FLASK:
            amount = 40;
            break;
          case Types.Entities.BURGER:
            amount = 100;
            break;
        }

        if (!player.hasFullHealth()) {
          player.regenHealthBy(amount);
          world.pushToPlayer(player, player.health());
        }
      }
    }
  }
}
