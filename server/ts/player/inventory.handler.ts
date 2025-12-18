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
  equipWeapon: (kind: number) => void;
  equipArmor: (kind: number) => void;
  updateHitPoints: () => void;
  hasFullHealth: () => boolean;
  regenHealthBy: (amount: number) => void;
  health: () => any;

  // Inventory instance
  getInventory: () => Inventory;

  // Equipment management
  getEquipment: () => {
    getEquipped: (slot: EquipmentSlot) => number;
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
    console.log(`[Inventory] Invalid item ${itemId} for pickup`);
    return;
  }

  // Check if inventory has room
  const slots = inventory.getSlots();
  const occupiedCount = slots.filter(s => s !== null).length;
  console.log(`[Inventory] ${ctx.name} pickup check: ${occupiedCount}/${slots.length} slots occupied`);

  if (!inventory.hasRoom(item.kind)) {
    console.log(`[Inventory] ${ctx.name}'s inventory is full - hasRoom returned false`);
    console.log(`[Inventory] Slots:`, slots.map((s, i) => s ? `${i}:${s.kind}` : null).filter(Boolean));
    // Send rejection message to client so they get feedback
    ctx.send([Types.Messages.CHAT, 'Inventory full! Drop or sell items first.']);
    return;
  }

  // Get item properties if it's equipment
  const properties = item.properties || null;

  // Add to inventory
  const slotIndex = inventory.addItem(item.kind, properties, 1);
  if (slotIndex === -1) {
    console.log(`[Inventory] Failed to add item to inventory`);
    return;
  }

  // Despawn item from world
  ctx.broadcast(item.despawn(), false);
  world.removeEntity(item);

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

  console.log(`[Inventory] ${ctx.name} picked up ${Types.getKindAsString(item.kind)} to slot ${slotIndex}`);
}

/**
 * Handle use consumable from inventory
 */
export function handleInventoryUse(ctx: InventoryPlayerContext, slotIndex: number): void {
  const inventory = ctx.getInventory();
  const world = ctx.getWorld();
  const slot = inventory.getSlot(slotIndex);

  if (!slot) {
    console.log(`[Inventory] Slot ${slotIndex} is empty`);
    return;
  }

  if (!inventory.isSlotConsumable(slotIndex)) {
    console.log(`[Inventory] Slot ${slotIndex} is not consumable`);
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
    }
    inventory.removeItem(slotIndex, 1);
  }

  // Send update or remove based on remaining count
  const updatedSlot = inventory.getSlot(slotIndex);
  if (updatedSlot) {
    ctx.send([Types.Messages.INVENTORY_UPDATE, slotIndex, updatedSlot.count]);
  } else {
    ctx.send([Types.Messages.INVENTORY_REMOVE, slotIndex]);
  }

  console.log(`[Inventory] ${ctx.name} used ${Types.getKindAsString(kind)}`);
}

/**
 * Handle equip from inventory
 */
export function handleInventoryEquip(ctx: InventoryPlayerContext, slotIndex: number): void {
  const inventory = ctx.getInventory();
  const slot = inventory.getSlot(slotIndex);

  if (!slot) {
    console.log(`[Inventory] Slot ${slotIndex} is empty`);
    return;
  }

  if (!inventory.isSlotEquipment(slotIndex)) {
    console.log(`[Inventory] Slot ${slotIndex} is not equipment`);
    return;
  }

  const newItemKind = slot.kind;
  const isWeapon = Types.isWeapon(newItemKind);
  const isArmor = Types.isArmor(newItemKind);

  // Get currently equipped item
  const currentKind = isWeapon ? ctx.weapon : ctx.armor;
  const isDefaultItem = (isWeapon && currentKind === Types.Entities.SWORD1) ||
                        (isArmor && currentKind === Types.Entities.CLOTHARMOR);

  // Remove new item from inventory
  inventory.removeItem(slotIndex, 1);

  // Put old equipped item in inventory (if not default)
  if (!isDefaultItem) {
    inventory.setSlot(slotIndex, {
      kind: currentKind,
      properties: null,
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

  // Equip new item
  if (isWeapon) {
    ctx.equipWeapon(newItemKind);
  } else {
    ctx.equipArmor(newItemKind);
    ctx.updateHitPoints();
    ctx.send(new Messages.HitPoints(ctx.maxHitPoints).serialize());
  }

  // Broadcast equipment change to other players
  ctx.broadcast(ctx.equip(newItemKind), true);
  // Also send directly to self (broadcast may not reach self reliably)
  ctx.send(ctx.equip(newItemKind).serialize());

  console.log(`[Inventory] ${ctx.name} equipped ${Types.getKindAsString(newItemKind)}`);
}

/**
 * Handle drop from inventory
 */
export function handleInventoryDrop(ctx: InventoryPlayerContext, slotIndex: number): void {
  const inventory = ctx.getInventory();
  const world = ctx.getWorld();
  const slot = inventory.getSlot(slotIndex);

  if (!slot) {
    console.log(`[Inventory] Slot ${slotIndex} is empty`);
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
    console.log(`[Inventory] ${ctx.name} dropped ${Types.getKindAsString(kind)} at (${ctx.x}, ${ctx.y})`);
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
    console.log(`[Inventory] ${ctx.name} swapped slots ${fromSlot} <-> ${toSlot}`);
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
    console.log(`[Inventory] Invalid slot type: ${slot}`);
    return;
  }

  // Get currently equipped item
  const currentKind = slot === 'weapon' ? ctx.weapon : ctx.armor;
  const defaultKind = slot === 'weapon' ? Types.Entities.SWORD1 : Types.Entities.CLOTHARMOR;

  // Cannot unequip default items
  if (currentKind === defaultKind) {
    console.log(`[Inventory] Cannot unequip default ${slot}`);
    return;
  }

  // Check if inventory has room
  if (!inventory.hasRoom(currentKind)) {
    console.log(`[Inventory] ${ctx.name}'s inventory is full - cannot unequip ${slot}`);
    return;
  }

  // Add to inventory
  const slotIndex = inventory.addItem(currentKind, null, 1);
  if (slotIndex === -1) {
    console.log(`[Inventory] Failed to add ${slot} to inventory`);
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

  console.log(`[Inventory] ${ctx.name} unequipped ${Types.getKindAsString(currentKind)} to inventory slot ${slotIndex}`);
}
