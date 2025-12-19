/**
 * EquipmentHandler - Handles all equipment operations for players
 *
 * Single Responsibility: Equip, unequip, drop items, HP updates
 * Extracted from Player.ts to reduce its size.
 */

import { Types } from '../../../shared/ts/gametypes';
import { Messages } from '../message';
import { Formulas } from '../formulas';
import { EquipmentManager } from '../equipment/equipment-manager';
import { EquipmentSlot } from '../../../shared/ts/equipment/equipment-types';

/**
 * Item with equipment kind
 */
interface EquippableItem {
  kind: number;
}

/**
 * Message interface for network messages
 */
interface SerializableMessage {
  serialize(): unknown[];
}

/**
 * Player context for equipment operations
 */
export interface EquipmentPlayerContext {
  id: number;
  name: string;
  x: number;
  y: number;
  level: number;
  maxHitPoints: number;

  // Methods
  send: (message: any) => void;
  broadcast: (message: any, ignoreSelf?: boolean) => void;
  resetHitPoints: (hp: number) => void;

  // Equipment access
  getEquipment: () => EquipmentManager;

  // World access for dropping items
  getWorld: () => {
    createItemWithProperties: (kind: number, x: number, y: number, properties?: any) => any;
    addItem: (item: any) => void;
  };
}

/**
 * Equip armor to a player
 */
export function equipArmor(ctx: EquipmentPlayerContext, kind: number, properties?: any): void {
  ctx.getEquipment().equipToSlot('armor', kind, properties);
}

/**
 * Equip weapon to a player
 */
export function equipWeapon(ctx: EquipmentPlayerContext, kind: number, properties?: any): void {
  ctx.getEquipment().equipToSlot('weapon', kind, properties);
}

/**
 * Equip an item (auto-detect slot)
 */
export function equipItem(ctx: EquipmentPlayerContext, item: EquippableItem | null): void {
  if (!item) return;

  console.debug(`${ctx.name} equips ${Types.getKindAsString(item.kind)}`);

  const equipment = ctx.getEquipment();
  // Pass item properties to equipment manager
  const slot = equipment.equip(item.kind, (item as any).properties || null);

  if (slot && slot === 'armor') {
    updateHitPoints(ctx);
    ctx.send(new Messages.HitPoints(ctx.maxHitPoints).serialize());
  }
}

/**
 * Update player's hit points based on armor, level, and set bonuses
 */
export function updateHitPoints(ctx: EquipmentPlayerContext): void {
  const equipment = ctx.getEquipment();
  const setBonus = equipment.getSetBonus();
  ctx.resetHitPoints(Formulas.hp(equipment.armorLevel, ctx.level, setBonus));
}

/**
 * Create equip message for broadcasting
 */
export function createEquipMessage(ctx: EquipmentPlayerContext, itemKind: number): SerializableMessage {
  // Messages.EquipItem expects a player-like object with id property
  return new Messages.EquipItem(ctx, itemKind);
}

/**
 * Handle dropping currently equipped item
 */
export function handleDropItem(ctx: EquipmentPlayerContext, itemType: string): void {
  const slot = itemType as EquipmentSlot;
  const equipment = ctx.getEquipment();
  console.log(`[Drop] ${ctx.name} dropping ${slot}`);

  // Use unified drop - handles default check internally
  // Returns { kind, properties } or null if can't drop
  const dropped = equipment.drop(slot);
  if (!dropped) {
    console.log(`[Drop] Cannot drop default ${slot}`);
    return;
  }

  // Create item at player's position with its original properties
  const world = ctx.getWorld();
  const item = world.createItemWithProperties(dropped.kind, ctx.x, ctx.y, dropped.properties);
  if (item) {
    world.addItem(item);
    ctx.broadcast(new Messages.Spawn(item), false);
    console.log(`[Drop] Created item ${Types.getKindAsString(dropped.kind)} at (${ctx.x}, ${ctx.y})`);
  }

  // Get the new default item that was auto-equipped
  const newKind = equipment.getEquipped(slot);

  // Tell the player and others about the equipment change
  ctx.send(createEquipMessage(ctx, newKind).serialize());
  ctx.broadcast(createEquipMessage(ctx, newKind));

  // Update HP if armor changed
  if (slot === 'armor') {
    updateHitPoints(ctx);
    ctx.send(new Messages.HitPoints(ctx.maxHitPoints).serialize());
  }
}

/**
 * Get weapon kind
 */
export function getWeapon(ctx: EquipmentPlayerContext): number {
  return ctx.getEquipment().weapon;
}

/**
 * Get armor kind
 */
export function getArmor(ctx: EquipmentPlayerContext): number {
  return ctx.getEquipment().armor;
}

/**
 * Get weapon level for damage calculations
 */
export function getWeaponLevel(ctx: EquipmentPlayerContext): number {
  return ctx.getEquipment().weaponLevel;
}

/**
 * Get armor level for HP calculations
 */
export function getArmorLevel(ctx: EquipmentPlayerContext): number {
  return ctx.getEquipment().armorLevel;
}
