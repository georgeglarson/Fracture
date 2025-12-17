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
export function equipArmor(ctx: EquipmentPlayerContext, kind: number): void {
  ctx.getEquipment().equipToSlot('armor', kind);
}

/**
 * Equip weapon to a player
 */
export function equipWeapon(ctx: EquipmentPlayerContext, kind: number): void {
  ctx.getEquipment().equipToSlot('weapon', kind);
}

/**
 * Equip an item (auto-detect slot)
 */
export function equipItem(ctx: EquipmentPlayerContext, item: any): void {
  if (!item) return;

  console.debug(`${ctx.name} equips ${Types.getKindAsString(item.kind)}`);

  const equipment = ctx.getEquipment();
  const slot = equipment.equip(item.kind);

  if (slot && slot === 'armor') {
    updateHitPoints(ctx);
    ctx.send(new Messages.HitPoints(ctx.maxHitPoints).serialize());
  }
}

/**
 * Update player's hit points based on armor and level
 */
export function updateHitPoints(ctx: EquipmentPlayerContext): void {
  const equipment = ctx.getEquipment();
  ctx.resetHitPoints(Formulas.hp(equipment.armorLevel, ctx.level));
}

/**
 * Create equip message for broadcasting
 */
export function createEquipMessage(ctx: EquipmentPlayerContext, itemKind: number): any {
  return new Messages.EquipItem(ctx as any, itemKind);
}

/**
 * Handle dropping currently equipped item
 */
export function handleDropItem(ctx: EquipmentPlayerContext, itemType: string): void {
  const slot = itemType as EquipmentSlot;
  const equipment = ctx.getEquipment();
  console.log(`[Drop] ${ctx.name} dropping ${slot}`);

  // Use unified drop - handles default check internally
  const droppedKind = equipment.drop(slot);
  if (!droppedKind) {
    console.log(`[Drop] Cannot drop default ${slot}`);
    return;
  }

  // Create item at player's position
  const world = ctx.getWorld();
  const item = world.createItemWithProperties(droppedKind, ctx.x, ctx.y);
  if (item) {
    world.addItem(item);
    ctx.broadcast(new Messages.Spawn(item), false);
    console.log(`[Drop] Created item ${Types.getKindAsString(droppedKind)} at (${ctx.x}, ${ctx.y})`);
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
