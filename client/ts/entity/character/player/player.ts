import {Character} from '../character';
import {Types} from '../../../../../shared/ts/gametypes';
import {Exceptions} from '../../../exceptions';
import {ClientEquipmentManager} from '../../../equipment/equipment-manager';
import {Sprite} from '../../../renderer/sprite';
import {getSlotForKind, getRank} from '../../../../../shared/ts/equipment/equipment-types';

export class Player extends Character {
  MAX_LEVEL: 10;

  // Renderer
  nameOffsetY = -10;

  // sprites
  spriteName = 'clotharmor';
  weaponName = 'sword1';

  // modes
  isLootMoving = false;

  // Equipment management (unified handling)
  private equipment: ClientEquipmentManager = new ClientEquipmentManager();

  currentArmorSprite;
  invincible;
  switch_callback;
  armorloot_callback;
  invincible_callback;
  invincibleTimeout;
  lastCheckpoint;
  dirtyRect;
  isOnPlateau;

  constructor(id, name, kind) {
    super(id, kind);
    this.name = name;

    // Connect equipment manager to player visuals
    this.equipment.setVisuals({
      setWeaponName: (name) => { this.weaponName = name; },
      setSprite: (sprite) => { this.setSprite(sprite); },
      setSpriteName: (name) => { this.spriteName = name; },
      setVisible: (visible) => { this.setVisible(visible); },
      getSprite: () => this.sprite
    });

    this.equipment.onSwitch(() => {
      if (this.switch_callback) {
        this.switch_callback();
      }
    });
  }

  loot(item) {
    if (item) {
      var currentArmorName;

      if (this.currentArmorSprite) {
        currentArmorName = this.currentArmorSprite.name;
      } else {
        currentArmorName = this.spriteName;
      }

      // Use unified slot-based comparison
      const slot = getSlotForKind(item.kind);
      if (slot) {
        const newRank = getRank(slot, item.kind);
        let currentKind: number;
        let msg: string;

        if (slot === 'armor') {
          currentKind = Types.getKindFromString(currentArmorName);
          msg = 'You are wearing a better armor';
        } else if (slot === 'weapon') {
          currentKind = Types.getKindFromString(this.weaponName);
          msg = 'You are wielding a better weapon';
        }

        const currentRank = getRank(slot, currentKind);

        if (newRank >= 0 && currentRank >= 0) {
          if (newRank === currentRank) {
            throw new Exceptions.LootException('You already have this ' + slot);
          } else if (newRank < currentRank) {
            throw new Exceptions.LootException(msg);
          }
        }
      }

      console.info('Player ' + this.id + ' has looted ' + item.id);
      if (Types.isArmor(item.kind) && this.invincible) {
        this.stopInvincibility();
      }
      item.onLoot(this);
    }
  }

  /**
   * Returns true if the character is currently walking towards an item in order to loot it.
   */
  isMovingToLoot() {
    return this.isLootMoving;
  }

  getSpriteName() {
    return this.spriteName;
  }

  setSpriteName(name) {
    this.spriteName = name;
    this.equipment.setEquipped('armor', name);
  }

  getArmorName() {
    var sprite = this.getArmorSprite();
    return sprite.id;
  }

  getArmorSprite() {
    if (this.invincible) {
      return this.currentArmorSprite;
    } else {
      return this.sprite;
    }
  }

  getWeaponName() {
    return this.weaponName;
  }

  setWeaponName(name) {
    this.weaponName = name;
    if (name) {
      this.equipment.setEquipped('weapon', name);
    }
  }

  hasWeapon() {
    return this.weaponName !== null;
  }

  // Unified equipment switching - delegates to EquipmentManager
  switchWeapon(newWeaponName) {
    this.equipment.switchEquipment('weapon', newWeaponName);
  }

  switchArmor(newArmorSprite: Sprite) {
    if (newArmorSprite) {
      this.equipment.switchEquipment('armor', newArmorSprite.id, newArmorSprite);
    }
  }

  // Legacy compatibility getters
  get isSwitchingWeapon(): boolean {
    return this.equipment.isSwitching('weapon');
  }

  get isSwitchingArmor(): boolean {
    return this.equipment.isSwitching('armor');
  }

  onArmorLoot(callback) {
    this.armorloot_callback = callback;
  }

  onSwitchItem(callback) {
    this.switch_callback = callback;
  }

  onInvincible(callback) {
    this.invincible_callback = callback;
  }

  startInvincibility() {
    var self = this;

    if (!this.invincible) {
      this.currentArmorSprite = this.getSprite();
      this.invincible = true;
      this.invincible_callback();
    } else {
      // If the player already has invincibility, just reset its duration.
      if (this.invincibleTimeout) {
        clearTimeout(this.invincibleTimeout);
      }
    }

    this.invincibleTimeout = setTimeout(function () {
      self.stopInvincibility();
      self.idle();
    }, 15000);
  }

  stopInvincibility() {
    this.invincible_callback();
    this.invincible = false;

    if (this.currentArmorSprite) {
      this.setSprite(this.currentArmorSprite);
      this.setSpriteName(this.currentArmorSprite.id);
      this.currentArmorSprite = null;
    }
    if (this.invincibleTimeout) {
      clearTimeout(this.invincibleTimeout);
    }
  }
}
