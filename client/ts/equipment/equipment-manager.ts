/**
 * ClientEquipmentManager - Client-side equipment handling
 * Single Responsibility: Manage equipment state and visual switching animations
 *
 * This unifies the previously separate switchWeapon and switchArmor logic
 * into a single implementation that works for any equipment slot.
 */

import { EquipmentSlot, SLOT_CONFIG, slotIsSpriteBased } from '../../../shared/ts/equipment/equipment-types';
import { Sprite } from '../renderer/sprite';

export interface SwitchCallbacks {
  onSwitchComplete?: () => void;
  onVisibilityChange?: (visible: boolean) => void;
}

export interface EquipmentVisuals {
  setWeaponName: (name: string | null) => void;
  setSprite: (sprite: Sprite) => void;
  setSpriteName: (name: string) => void;
  setVisible: (visible: boolean) => void;
  getSprite: () => Sprite | null;
}

export class ClientEquipmentManager {
  private equipped: Map<EquipmentSlot, string> = new Map();
  private switching: Map<EquipmentSlot, boolean> = new Map();
  private switchIntervals: Map<EquipmentSlot, NodeJS.Timeout | number> = new Map();

  // Visual update callbacks - set by player
  private visuals: EquipmentVisuals | null = null;
  private onSwitchComplete: (() => void) | null = null;

  constructor() {
    // Initialize with default equipment names
    this.equipped.set('weapon', 'sword1');
    this.equipped.set('armor', 'clotharmor');
  }

  /**
   * Set the visual update callbacks
   */
  setVisuals(visuals: EquipmentVisuals): void {
    this.visuals = visuals;
  }

  /**
   * Set callback for when any switch completes
   */
  onSwitch(callback: () => void): void {
    this.onSwitchComplete = callback;
  }

  /**
   * Get equipped item name for a slot
   */
  getEquipped(slot: EquipmentSlot): string | null {
    return this.equipped.get(slot) || null;
  }

  /**
   * Check if currently switching equipment in a slot
   */
  isSwitching(slot: EquipmentSlot): boolean {
    return this.switching.get(slot) || false;
  }

  /**
   * Check if currently switching any equipment
   */
  isAnySwitching(): boolean {
    return this.switching.get('weapon') || this.switching.get('armor') || false;
  }

  /**
   * Unified switch animation - works for any equipment slot
   * This replaces the duplicate switchWeapon and switchArmor methods
   */
  switchEquipment(
    slot: EquipmentSlot,
    newItemName: string,
    newSprite?: Sprite
  ): void {
    if (!this.visuals) return;

    const currentName = this.equipped.get(slot);
    if (newItemName === currentName) return;

    // Cancel any in-progress switch for this slot
    if (this.switching.get(slot)) {
      const interval = this.switchIntervals.get(slot);
      if (interval) {
        clearInterval(interval as number);
      }
    }

    this.switching.set(slot, true);

    // For sprite-based slots (armor), update sprite immediately
    if (slotIsSpriteBased(slot) && newSprite) {
      this.visuals.setSprite(newSprite);
      this.visuals.setSpriteName(newItemName);
    }

    // Blinking animation (same for all equipment types)
    let count = 14;
    let visible = true;

    const interval = setInterval(() => {
      visible = !visible;

      if (slotIsSpriteBased(slot)) {
        // Armor: toggle visibility
        this.visuals?.setVisible(visible);
      } else {
        // Weapon: toggle name (null = hidden)
        this.visuals?.setWeaponName(visible ? newItemName : null);
      }

      count--;
      if (count === 1) {
        clearInterval(interval);
        this.switching.set(slot, false);
        this.switchIntervals.delete(slot);

        // Ensure final state is correct
        this.equipped.set(slot, newItemName);
        if (!slotIsSpriteBased(slot)) {
          this.visuals?.setWeaponName(newItemName);
        } else {
          this.visuals?.setVisible(true);
        }

        if (this.onSwitchComplete) {
          this.onSwitchComplete();
        }
      }
    }, 90);

    this.switchIntervals.set(slot, interval);
  }

  /**
   * Set equipped item directly (no animation)
   */
  setEquipped(slot: EquipmentSlot, name: string): void {
    this.equipped.set(slot, name);
  }

  /**
   * Legacy method - switch weapon with animation
   */
  switchWeapon(newWeaponName: string): void {
    this.switchEquipment('weapon', newWeaponName);
  }

  /**
   * Legacy method - switch armor with animation
   */
  switchArmor(newArmorName: string, newArmorSprite: Sprite): void {
    this.switchEquipment('armor', newArmorName, newArmorSprite);
  }

  // Legacy accessors for backward compatibility
  get weaponName(): string | null {
    return this.getEquipped('weapon');
  }

  get armorName(): string | null {
    return this.getEquipped('armor');
  }

  get isSwitchingWeapon(): boolean {
    return this.isSwitching('weapon');
  }

  get isSwitchingArmor(): boolean {
    return this.isSwitching('armor');
  }
}
