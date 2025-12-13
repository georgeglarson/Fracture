import {Types} from '../../shared/ts/gametypes';

/**
 * Drop Tables by Tier
 *
 * Tier 1 (rat): Starter zone - flasks, food, very rare starter gear
 * Tier 2 (bat, crab, goblin): Early zone - leather armor, axes
 * Tier 3 (skeleton, wizard, snake): Mid zone - mail armor, morningstars
 * Tier 4 (ogre, skeleton2, eye): Late zone - plate armor, blueswords
 * Tier 5 (spectre, deathknight): Endgame - red gear, firepotion
 * Tier 6 (boss): Boss - golden gear guaranteed
 *
 * Drop rates are percentages. Multiple items can drop.
 * Zone modifiers in zone-manager.ts add rarity bonuses.
 */

export const Properties = {
  // ============================================
  // TIER 1 - Starter Area (Village outskirts)
  // ============================================
  rat: {
    drops: {
      flask: 60,        // Common healing
      burger: 15,       // Food drop
      sword2: 3,        // Rare upgrade from starter
      leatherarmor: 2   // Very rare armor
    },
    hp: 25,
    armor: 1,
    weapon: 1
  },

  // ============================================
  // TIER 2 - Early Areas (Beach, Forest edge)
  // ============================================
  bat: {
    drops: {
      flask: 50,
      burger: 10,
      axe: 12,          // Axe drops here
      leatherarmor: 8,
      firepotion: 3
    },
    hp: 80,
    armor: 2,
    weapon: 1
  },

  crab: {
    drops: {
      flask: 45,
      burger: 12,
      axe: 15,          // Good axe source
      leatherarmor: 10,
      firepotion: 4
    },
    hp: 60,
    armor: 2,
    weapon: 1
  },

  goblin: {
    drops: {
      flask: 40,
      burger: 8,
      axe: 18,          // Goblins love axes
      leatherarmor: 15,
      morningstar: 5,   // Rare upgrade
      firepotion: 4
    },
    hp: 90,
    armor: 2,
    weapon: 1
  },

  // ============================================
  // TIER 3 - Mid Areas (Graveyard, Desert edge)
  // ============================================
  skeleton: {
    drops: {
      flask: 35,
      axe: 10,
      morningstar: 15,  // Primary morningstar source
      mailarmor: 18,    // Primary mail source
      firepotion: 5
    },
    hp: 110,
    armor: 2,
    weapon: 2
  },

  wizard: {
    drops: {
      flask: 30,
      burger: 5,
      morningstar: 12,
      mailarmor: 15,
      bluesword: 8,     // Rare early bluesword
      firepotion: 8     // Wizards drop more potions
    },
    hp: 100,
    armor: 2,
    weapon: 6
  },

  snake: {
    drops: {
      flask: 35,
      morningstar: 12,
      mailarmor: 12,
      platearmor: 8,    // Rare plate drop
      firepotion: 6
    },
    hp: 150,
    armor: 3,
    weapon: 2
  },

  // ============================================
  // TIER 4 - Late Areas (Deep caves, Lava edge)
  // ============================================
  ogre: {
    drops: {
      flask: 30,
      burger: 8,
      morningstar: 8,
      platearmor: 20,   // Primary plate source
      bluesword: 15,    // Good bluesword source
      firepotion: 6
    },
    hp: 200,
    armor: 3,
    weapon: 2
  },

  skeleton2: {
    drops: {
      flask: 28,
      platearmor: 18,
      bluesword: 20,    // Primary bluesword source
      redsword: 6,      // Rare red drop
      firepotion: 6
    },
    hp: 200,
    armor: 3,
    weapon: 3
  },

  eye: {
    drops: {
      flask: 25,
      platearmor: 15,
      bluesword: 15,
      redarmor: 10,     // Rare red armor
      redsword: 8,      // Rare red sword
      firepotion: 7
    },
    hp: 200,
    armor: 3,
    weapon: 3
  },

  // ============================================
  // TIER 5 - Endgame Areas (Lava, Death zones)
  // ============================================
  spectre: {
    drops: {
      flask: 20,
      bluesword: 10,
      redarmor: 25,     // Primary red armor source
      redsword: 20,     // Primary red sword source
      goldenarmor: 5,   // Rare golden drop
      firepotion: 10
    },
    hp: 250,
    armor: 2,
    weapon: 4
  },

  deathknight: {
    drops: {
      flask: 15,
      burger: 5,
      redarmor: 22,     // Good red armor chance
      redsword: 25,     // Best red sword source
      goldenarmor: 8,   // Rare golden armor
      goldensword: 6,   // Rare golden sword
      firepotion: 12
    },
    hp: 250,
    armor: 3,
    weapon: 3
  },

  // ============================================
  // TIER 6 - Boss (Unique encounter)
  // ============================================
  boss: {
    drops: {
      goldensword: 100, // Guaranteed golden sword
      goldenarmor: 80,  // High chance golden armor
      firepotion: 50,   // Bonus potion
      burger: 100       // Victory feast!
    },
    hp: 700,
    armor: 6,
    weapon: 7
  },
  getArmorLevel: kind => {
    try {
      if (Types.isMob(kind)) {
        return Properties[Types.getKindAsString(kind)].armor;
      } else {
        return Types.getArmorRank(kind) + 1;
      }
    } catch (e) {
      console.error('No level found for armor: ' + Types.getKindAsString(kind));
    }
  },
  getWeaponLevel: kind => {
    try {
      if (Types.isMob(kind)) {
        return Properties[Types.getKindAsString(kind)].weapon;
      } else {
        return Types.getWeaponRank(kind) + 1;
      }
    } catch (e) {
      console.error('No level found for weapon: ' + Types.getKindAsString(kind));
    }
  },
  getHitPoints: kind => {
    return Properties[Types.getKindAsString(kind)].hp;
  }
};

