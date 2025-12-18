import {Types} from '../../../../shared/ts/gametypes';
import {Item} from './item';


export const Items = {

  Sword1: class Sword1 extends Item {
    constructor(id) {
      super(id, Types.Entities.SWORD1, 'weapon');
      this.lootMessage = 'You pick up a basic sword';
    }
  },

  Sword2: class Sword2 extends Item {
    constructor(id) {
      super(id, Types.Entities.SWORD2, 'weapon');
      this.lootMessage = 'You pick up a steel sword';
    }
  },

  Axe: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.AXE, 'weapon');
      this.lootMessage = 'You pick up an axe';
    }
  },

  RedSword: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.REDSWORD, 'weapon');
      this.lootMessage = 'You pick up a blazing sword';
    }
  },

  BlueSword: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.BLUESWORD, 'weapon');
      this.lootMessage = 'You pick up a magic sword';
    }
  },

  GoldenSword: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.GOLDENSWORD, 'weapon');
      this.lootMessage = 'You pick up the ultimate sword';
    }
  },

  MorningStar: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.MORNINGSTAR, 'weapon');
      this.lootMessage = 'You pick up a morning star';
    }
  },

  LeatherArmor: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.LEATHERARMOR, 'armor');
      this.lootMessage = 'You equip a leather armor';
    }
  },

  MailArmor: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.MAILARMOR, 'armor');
      this.lootMessage = 'You equip a mail armor';
    }
  },

  PlateArmor: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.PLATEARMOR, 'armor');
      this.lootMessage = 'You equip a plate armor';
    }
  },

  RedArmor: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.REDARMOR, 'armor');
      this.lootMessage = 'You equip a ruby armor';
    }
  },

  GoldenArmor: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.GOLDENARMOR, 'armor');
      this.lootMessage = 'You equip a golden armor';
    }
  },

  Flask: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.FLASK, 'object');
      this.lootMessage = 'You drink a health potion';
    }
  },

  Cake: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.CAKE, 'object');
      this.lootMessage = 'You eat a cake';
    }
  },

  Burger: class Sowrd2 extends Item {
    constructor(id) {
      super(id, Types.Entities.BURGER, 'object');
      this.lootMessage = 'You can haz rat burger';
    }
  },

  FirePotion: class FirePotion extends Item {
    constructor(id) {
      super(id, Types.Entities.FIREPOTION, 'object');
      this.lootMessage = 'You feel the power of Firefox!';
    }

    onLoot(player) {
      player.startInvincibility();
    }
  },

  // New weapons
  Raygun: class Raygun extends Item {
    constructor(id) {
      super(id, Types.Entities.RAYGUN, 'weapon');
      this.lootMessage = 'You pick up a raygun';
    }
  },

  Lasergun: class Lasergun extends Item {
    constructor(id) {
      super(id, Types.Entities.LASERGUN, 'weapon');
      this.lootMessage = 'You pick up a lasergun';
    }
  },

  MP5: class MP5 extends Item {
    constructor(id) {
      super(id, Types.Entities.MP5, 'weapon');
      this.lootMessage = 'You pick up an MP5';
    }
  },

  Tec9: class Tec9 extends Item {
    constructor(id) {
      super(id, Types.Entities.TEC9, 'weapon');
      this.lootMessage = 'You pick up a Tec-9';
    }
  },

  PlasmaHelix: class PlasmaHelix extends Item {
    constructor(id) {
      super(id, Types.Entities.PLASMAHELIX, 'weapon');
      this.lootMessage = 'You pick up a plasma helix';
    }
  },

  Tentacle: class Tentacle extends Item {
    constructor(id) {
      super(id, Types.Entities.TENTACLE, 'weapon');
      this.lootMessage = 'You pick up a tentacle';
    }
  },

  VoidBlade: class VoidBlade extends Item {
    constructor(id) {
      super(id, Types.Entities.VOIDBLADE, 'weapon');
      this.lootMessage = 'You pick up a void blade';
    }
  },

  CrystalStaff: class CrystalStaff extends Item {
    constructor(id) {
      super(id, Types.Entities.CRYSTALSTAFF, 'weapon');
      this.lootMessage = 'You pick up a crystal staff';
    }
  },

  // New armors
  MechArmor: class MechArmor extends Item {
    constructor(id) {
      super(id, Types.Entities.MECHARMOR, 'armor');
      this.lootMessage = 'You equip mech armor';
    }
  },

  VoidCloak: class VoidCloak extends Item {
    constructor(id) {
      super(id, Types.Entities.VOIDCLOAK, 'armor');
      this.lootMessage = 'You equip a void cloak';
    }
  },

  CrystalShell: class CrystalShell extends Item {
    constructor(id) {
      super(id, Types.Entities.CRYSTALSHELL, 'armor');
      this.lootMessage = 'You equip a crystal shell';
    }
  },

  ShieldBubble: class ShieldBubble extends Item {
    constructor(id) {
      super(id, Types.Entities.SHIELDBUBBLE, 'armor');
      this.lootMessage = 'You equip a shield bubble';
    }
  },
};
