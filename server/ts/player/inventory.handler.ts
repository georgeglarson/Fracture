/**
 * InventoryHandler - Handles all inventory operations for players
 *
 * Single Responsibility: Inventory pickup, use, equip, drop, swap
 * Extracted from Player.ts to reduce its size.
 */

import { Types } from '../../../shared/ts/gametypes';
import { Messages } from '../message';
import { Inventory } from '../inventory/inventory';
import { serializeSlot, SerializedInventorySlot } from '../../../shared/ts/inventory/inventory-types';
import { serializeProperties } from '../../../shared/ts/items/item-types';
import { EquipmentSlot } from '../../../shared/ts/equipment/equipment-types';
import { createModuleLogger } from '../utils/logger.js';

const log = createModuleLogger('Inventory');

/**
 * Persist inventory to storage (called after inventory mutations).
 * Accepts any player-like object with characterId, getWorld, and getInventory.
 */
export function persistInventory(player: any): void {
  if (!player.characterId) return;
  try {
    const storage = player.getWorld().getStorageService();
    const inventory = player.getInventory();
    storage.saveInventory(player.characterId, inventory.getSerializedSlots());
  } catch (e) {
    log.error({ err: e, playerId: player.id }, 'Failed to persist inventory');
  }
}

/**
 * Player context for inventory operations
 */
export interface InventoryPlayerContext {
  id: number;
  name: string;
  x: number;
  y: number;
  weapon: number;
  armor: number;
  maxHitPoints: number;

  // Methods
  send: (message: any) => void;
  broadcast: (message: any, ignoreSelf?: boolean) => void;
  equip: (kind: number) => any;
  equipWeapon: (kind: number, properties?: any) => void;
  equipArmor: (kind: number, properties?: any) => void;
  updateHitPoints: () => void;
  hasFullHealth: () => boolean;
  regenHealthBy: (amount: number) => void;
  health: () => any;

  // Inventory instance
  getInventory: () => Inventory;

  // Equipment management
  getEquipment: () => {
    getEquipped: (slot: EquipmentSlot) => number;
    getProperties: (slot: EquipmentSlot) => any;
  };

  // World access
  getWorld: () => {
    getEntityById: (id: number) => any;
    removeEntity: (entity: any) => void;
    createItemWithProperties: (kind: number, x: number, y: number, properties?: any) => any;
    addItem: (item: any) => void;
    pushToPlayer: (player: any, message: any) => void;
  };

  // Firepotion timeout
  firepotionTimeout: ReturnType<typeof setTimeout> | null;
  setFirepotionTimeout: (timeout: ReturnType<typeof setTimeout> | null) => void;
}

/**
 * Send inventory init to client
 */
export function sendInventoryInit(ctx: InventoryPlayerContext): void {
  const inventory = ctx.getInventory();
  const slots = inventory.getSerializedSlots();
  ctx.send([Types.Messages.INVENTORY_INIT, slots]);
}

/**
 * Handle pickup item to inventory
 */
export function handleInventoryPickup(ctx: InventoryPlayerContext, itemId: number): void {
  const world = ctx.getWorld();
  const inventory = ctx.getInventory();
  const item = world.getEntityById(itemId);

  if (!item || !Types.isItem(item.kind)) {
    return;
  }

  // Check if inventory has room
  if (!inventory.hasRoom(item.kind)) {
    ctx.send([Types.Messages.CHAT, 'Inventory full! Drop or sell items first.']);
    return;
  }

  // Get item properties if it's equipment
  const properties = item.properties || null;

  // REMOVE FROM WORLD FIRST to prevent duplication exploit (two pickups before removal)
  ctx.broadcast(item.despawn(), false);
  world.removeEntity(item);

  // Add to inventory
  const slotIndex = inventory.addItem(item.kind, properties, 1);
  if (slotIndex === -1) {
    // Extremely rare edge case - item already removed from world but inventory full
    ctx.send([Types.Messages.CHAT, 'Inventory full!']);
    return;
  }

  // Send inventory add message
  const slot = inventory.getSlot(slotIndex);
  const serializedProps = slot?.properties ? serializeProperties(slot.properties) : null;
  ctx.send([
    Types.Messages.INVENTORY_ADD,
    slotIndex,
    item.kind,
    serializedProps,
    slot?.count || 1
  ]);

  log.debug({ player: ctx.name, itemKind: Types.getKindAsString(item.kind), slotIndex }, 'Picked up item');
}

/**
 * Handle use consumable from inventory
 */
export function handleInventoryUse(ctx: InventoryPlayerContext, slotIndex: number): void {
  const inventory = ctx.getInventory();
  const world = ctx.getWorld();
  const slot = inventory.getSlot(slotIndex);

  if (!slot) {
    log.debug({ slotIndex }, 'Slot is empty');
    return;
  }

  if (!inventory.isSlotConsumable(slotIndex)) {
    log.debug({ slotIndex }, 'Slot is not consumable');
    return;
  }

  const kind = slot.kind;

  // Handle firepotion specially
  if (inventory.isFirePotion(kind)) {
    inventory.removeItem(slotIndex, 1);
    ctx.updateHitPoints();
    ctx.broadcast(ctx.equip(Types.Entities.FIREFOX));
    const timeout = setTimeout(() => {
      ctx.broadcast(ctx.equip(ctx.armor));
      ctx.setFirepotionTimeout(null);
    }, 15000);
    ctx.setFirepotionTimeout(timeout);
    ctx.send(new Messages.HitPoints(ctx.maxHitPoints).serialize());
  } else {
    // Healing item
    const healAmount = inventory.getConsumableHealAmount(kind);
    if (healAmount > 0 && !ctx.hasFullHealth()) {
      ctx.regenHealthBy(healAmount);
      world.pushToPlayer(ctx, ctx.health());
      inventory.removeItem(slotIndex, 1);
      log.debug({ player: ctx.name, healAmount }, 'Healed');
    } else if (ctx.hasFullHealth()) {
      // Don't consume if at full health - just notify
      ctx.send([Types.Messages.CHAT, 'You are already at full health']);
      log.debug({ player: ctx.name }, 'Tried to heal at full health');
      return; // Don't consume the item
    } else {
      // Unknown consumable with 0 heal amount
      inventory.removeItem(slotIndex, 1);
    }
  }

  // Send update or remove based on remaining count
  const updatedSlot = inventory.getSlot(slotIndex);
  if (updatedSlot) {
    ctx.send([Types.Messages.INVENTORY_UPDATE, slotIndex, updatedSlot.count]);
  } else {
    ctx.send([Types.Messages.INVENTORY_REMOVE, slotIndex]);
  }

  log.debug({ player: ctx.name, itemKind: Types.getKindAsString(kind) }, 'Used item');
}

/**
 * Handle equip from inventory
 */
export function handleInventoryEquip(ctx: InventoryPlayerContext, slotIndex: number): void {
  const inventory = ctx.getInventory();
  const slot = inventory.getSlot(slotIndex);

  if (!slot) {
    log.debug({ slotIndex }, 'Equip slot is empty');
    return;
  }

  if (!inventory.isSlotEquipment(slotIndex)) {
    log.debug({ slotIndex }, 'Slot is not equipment');
    return;
  }

  const newItemKind = slot.kind;
  const newItemProperties = slot.properties;
  const isWeapon = Types.isWeapon(newItemKind);
  const isArmor = Types.isArmor(newItemKind);

  // Get currently equipped item AND its properties
  const equipment = ctx.getEquipment();
  const equipSlot: EquipmentSlot = isWeapon ? 'weapon' : 'armor';
  const currentKind = isWeapon ? ctx.weapon : ctx.armor;
  const currentProperties = equipment.getProperties(equipSlot);
  const isDefaultItem = (isWeapon && currentKind === Types.Entities.SWORD1) ||
                        (isArmor && currentKind === Types.Entities.CLOTHARMOR);

  // Remove new item from inventory
  inventory.removeItem(slotIndex, 1);

  // Put old equipped item in inventory (if not default) - WITH its properties!
  if (!isDefaultItem) {
    inventory.setSlot(slotIndex, {
      kind: currentKind,
      properties: currentProperties,
      count: 1
    });
    const serializedOldSlot = serializeSlot(inventory.getSlot(slotIndex));
    ctx.send([
      Types.Messages.INVENTORY_ADD,
      slotIndex,
      currentKind,
      serializedOldSlot?.p || null,
      1
    ]);
  } else {
    ctx.send([Types.Messages.INVENTORY_REMOVE, slotIndex]);
  }

  // Equip new item WITH its properties
  if (isWeapon) {
    ctx.equipWeapon(newItemKind, newItemProperties);
  } else {
    ctx.equipArmor(newItemKind, newItemProperties);
    ctx.updateHitPoints();
    ctx.send(new Messages.HitPoints(ctx.maxHitPoints).serialize());
  }

  // Broadcast equipment change to other players
  ctx.broadcast(ctx.equip(newItemKind), true);
  // Also send directly to self (broadcast may not reach self reliably)
  ctx.send(ctx.equip(newItemKind).serialize());

  log.debug({ player: ctx.name, itemKind: Types.getKindAsString(newItemKind) }, 'Equipped item');
}

/**
 * Handle drop from inventory
 */
export function handleInventoryDrop(ctx: InventoryPlayerContext, slotIndex: number): void {
  const inventory = ctx.getInventory();
  const world = ctx.getWorld();
  const slot = inventory.getSlot(slotIndex);

  if (!slot) {
    log.debug({ slotIndex }, 'Drop slot is empty');
    return;
  }

  const kind = slot.kind;
  const properties = slot.properties;

  // Remove from inventory
  inventory.removeItem(slotIndex, 1);

  // Create item at player's position
  const item = world.createItemWithProperties(kind, ctx.x, ctx.y, properties);
  if (item) {
    world.addItem(item);
    ctx.broadcast(new Messages.Spawn(item), false);
    log.debug({ player: ctx.name, itemKind: Types.getKindAsString(kind), x: ctx.x, y: ctx.y }, 'Dropped item');
  }

  // Send inventory remove
  ctx.send([Types.Messages.INVENTORY_REMOVE, slotIndex]);
}

/**
 * Handle swap slots
 */
export function handleInventorySwap(ctx: InventoryPlayerContext, fromSlot: number, toSlot: number): void {
  const inventory = ctx.getInventory();
  if (inventory.swapSlots(fromSlot, toSlot)) {
    sendInventoryInit(ctx);
    log.debug({ player: ctx.name, fromSlot, toSlot }, 'Swapped slots');
  }
}

/**
 * Get serialized inventory for persistence
 */
export function getInventoryState(ctx: InventoryPlayerContext): (SerializedInventorySlot | null)[] {
  return ctx.getInventory().getSerializedSlots();
}

/**
 * Load inventory from saved data
 */
export function loadInventory(ctx: InventoryPlayerContext, data: (SerializedInventorySlot | null)[]): void {
  ctx.getInventory().loadFromData(data);
}

/**
 * Handle unequip equipment to inventory (instead of dropping to ground)
 */
export function handleUnequipToInventory(ctx: InventoryPlayerContext, slot: string): void {
  const inventory = ctx.getInventory();

  // Validate slot
  if (slot !== 'weapon' && slot !== 'armor') {
    log.debug({ slot }, 'Invalid slot type');
    return;
  }

  // Get currently equipped item
  const currentKind = slot === 'weapon' ? ctx.weapon : ctx.armor;
  const defaultKind = slot === 'weapon' ? Types.Entities.SWORD1 : Types.Entities.CLOTHARMOR;

  // Cannot unequip default items
  if (currentKind === defaultKind) {
    log.debug({ slot }, 'Cannot unequip default item');
    return;
  }

  // Check if inventory has room
  if (!inventory.hasRoom(currentKind)) {
    log.debug({ player: ctx.name, slot }, 'Inventory full, cannot unequip');
    return;
  }

  // Add to inventory
  const slotIndex = inventory.addItem(currentKind, null, 1);
  if (slotIndex === -1) {
    log.debug({ player: ctx.name, slot }, 'Failed to add to inventory (race condition?)');
    ctx.send([Types.Messages.CHAT, 'Inventory full! Drop or sell items first.']);
    return;
  }

  // Equip default item
  if (slot === 'weapon') {
    ctx.equipWeapon(defaultKind);
  } else {
    ctx.equipArmor(defaultKind);
    ctx.updateHitPoints();
    ctx.send(new Messages.HitPoints(ctx.maxHitPoints).serialize());
  }

  // Broadcast equipment change
  ctx.broadcast(ctx.equip(defaultKind));

  // Send inventory add message
  ctx.send([
    Types.Messages.INVENTORY_ADD,
    slotIndex,
    currentKind,
    null,
    1
  ]);

  log.debug({ player: ctx.name, itemKind: Types.getKindAsString(currentKind), slotIndex }, 'Unequipped to inventory');
}
