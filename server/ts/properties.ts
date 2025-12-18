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
    weapon: 1,
    aggro: 3            // Weak - only attacks very close players
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
    weapon: 1,
    aggro: 4            // Slightly aggressive
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
    weapon: 1,
    aggro: 4            // Slightly aggressive
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
    weapon: 1,
    aggro: 5            // More aggressive - territorial
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
      firepotion: 5,
      // Void dimension items (fractured reality)
      tentacle: 4,      // Rare void weapon
      voidcloak: 3      // Rare void armor
    },
    hp: 110,
    armor: 2,
    weapon: 2,
    aggro: 5            // Undead sense the living
  },

  wizard: {
    drops: {
      flask: 30,
      burger: 5,
      morningstar: 12,
      mailarmor: 15,
      bluesword: 8,     // Rare early bluesword
      firepotion: 8,    // Wizards drop more potions
      // Mystic dimension items (fractured reality)
      crystalstaff: 5,  // Wizards can drop arcane weapons
      crystalshell: 3   // Rare mystic armor
    },
    hp: 100,
    armor: 2,
    weapon: 6,
    aggro: 6            // Wizards attack from distance
  },

  snake: {
    drops: {
      flask: 35,
      morningstar: 12,
      mailarmor: 12,
      platearmor: 8,    // Rare plate drop
      firepotion: 6,
      // Tech dimension items (fractured reality)
      raygun: 4,        // Desert snakes guard tech relics
      mp5: 5            // More common tech weapon
    },
    hp: 150,
    armor: 3,
    weapon: 2,
    aggro: 4            // Snakes are sneaky but patient
  },

  // ============================================
  // TIER 3.5 - Zombie Zone (Haunted graveyard)
  // ============================================
  zombie: {
    drops: {
      flask: 40,
      burger: 15,       // Brains... er, burgers
      morningstar: 12,
      mailarmor: 15,
      firepotion: 5
    },
    hp: 130,
    armor: 2,
    weapon: 2,
    aggro: 5            // Zombies shamble toward the living
  },

  zombiegirl: {
    drops: {
      flask: 35,
      burger: 12,
      morningstar: 15,
      mailarmor: 18,
      platearmor: 8,    // Slightly better drops
      firepotion: 6
    },
    hp: 150,
    armor: 2,
    weapon: 2,
    aggro: 5            // Just as relentless
  },

  zomagent: {
    drops: {
      flask: 30,
      burger: 10,
      morningstar: 10,
      platearmor: 15,   // Leader drops plate
      bluesword: 12,    // Rare bluesword
      firepotion: 8
    },
    hp: 180,
    armor: 3,
    weapon: 3,
    aggro: 6            // The leader - more dangerous
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
      firepotion: 6,
      // Tech/Modern dimension items (fractured reality)
      mp5: 8,           // Tech weapons from fractured dimension
      raygun: 6,
      mecharmor: 4      // Rare tech armor
    },
    hp: 200,
    armor: 3,
    weapon: 2,
    aggro: 6            // Ogres are big and angry
  },

  skeleton2: {
    drops: {
      flask: 28,
      platearmor: 18,
      bluesword: 20,    // Primary bluesword source
      redsword: 6,      // Rare red drop
      firepotion: 6,
      // Void dimension items (fractured reality)
      tentacle: 8,      // Elite undead embrace the void
      voidblade: 5,     // Rare void weapon
      voidcloak: 6      // Void armor
    },
    hp: 200,
    armor: 3,
    weapon: 3,
    aggro: 6            // Elite undead - aggressive
  },

  eye: {
    drops: {
      flask: 25,
      platearmor: 15,
      bluesword: 15,
      redarmor: 10,     // Rare red armor
      redsword: 8,      // Rare red sword
      firepotion: 7,
      // Energy dimension items (fractured reality)
      plasmahelix: 6,   // Energy beings carry plasma
      shieldbubble: 8   // Force field armor
    },
    hp: 200,
    armor: 3,
    weapon: 3,
    aggro: 7            // All-seeing eye - spots you from afar
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
      firepotion: 10,
      // Void + Energy dimension items (spectres span dimensions)
      voidblade: 10,    // Void blade primary source
      plasmahelix: 8,   // Energy weapons
      voidcloak: 12,    // Primary voidcloak source
      shieldbubble: 6   // Force field armor
    },
    hp: 250,
    armor: 2,
    weapon: 4,
    aggro: 7            // Spectres hunt the living
  },

  deathknight: {
    drops: {
      flask: 15,
      burger: 5,
      redarmor: 22,     // Good red armor chance
      redsword: 25,     // Best red sword source
      goldenarmor: 8,   // Rare golden armor
      goldensword: 6,   // Rare golden sword
      firepotion: 12,
      // All dimensions - deathknights command fractured reality
      voidblade: 12,    // Best voidblade source
      plasmahelix: 10,  // Best plasma source
      crystalstaff: 8,  // Mystic weapons
      mecharmor: 10,    // Best mecharmor source
      crystalshell: 8   // Best crystal armor source
    },
    hp: 250,
    armor: 3,
    weapon: 3,
    aggro: 8            // Elite hunter - maximum aggro range
  },

  // ============================================
  // TIER 6 - Boss (Unique encounter)
  // ============================================
  boss: {
    drops: {
      goldensword: 100, // Guaranteed golden sword
      goldenarmor: 80,  // High chance golden armor
      firepotion: 50,   // Bonus potion
      burger: 100,      // Victory feast!
      // Guaranteed dimension loot from boss!
      plasmahelix: 60,  // High chance plasma
      voidblade: 50,    // Good voidblade chance
      mecharmor: 40,    // Rare mech armor
      crystalshell: 35  // Rare crystal armor
    },
    hp: 700,
    armor: 6,
    weapon: 7,
    aggro: 8            // Boss has maximum aggro range
  },
  getArmorLevel: (kind: number): number | undefined => {
    try {
      if (Types.isMob(kind)) {
        return (Properties as Record<string, any>)[Types.getKindAsString(kind) as string].armor;
      } else {
        return Types.getArmorRank(kind) + 1;
      }
    } catch (e) {
      console.error('No level found for armor: ' + Types.getKindAsString(kind));
      return undefined;
    }
  },
  getWeaponLevel: (kind: number): number | undefined => {
    try {
      if (Types.isMob(kind)) {
        return (Properties as Record<string, any>)[Types.getKindAsString(kind) as string].weapon;
      } else {
        return Types.getWeaponRank(kind) + 1;
      }
    } catch (e) {
      console.error('No level found for weapon: ' + Types.getKindAsString(kind));
      return undefined;
    }
  },
  getHitPoints: (kind: number): number => {
    return (Properties as Record<string, any>)[Types.getKindAsString(kind) as string].hp;
  },
  getAggroRange: (kind: number): number => {
    const props = (Properties as Record<string, any>)[Types.getKindAsString(kind) as string];
    return props?.aggro || 0; // Default to 0 (no aggro) if not defined
  }
};

