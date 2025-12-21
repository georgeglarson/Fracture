import {Types} from '../../shared/ts/gametypes';
import {Formulas} from './formulas';

/**
 * Mob Properties with Level-Based Scaling
 *
 * Each mob now has an explicit level that determines its stats via formulas:
 * - HP: Formulas.mobHP(level)
 * - Weapon: Formulas.mobWeaponLevel(level)
 * - Armor: Formulas.mobArmorLevel(level)
 *
 * Level tiers roughly correspond to:
 * - Levels 1-5: Starter zone (rats, crabs)
 * - Levels 6-10: Early zone (bats, goblins)
 * - Levels 11-20: Mid zone (skeletons, zombies, wizards)
 * - Levels 21-30: Late zone (ogres, skeleton2, eye)
 * - Levels 31-45: Endgame zone (spectres, deathknights)
 * - Level 50: Boss
 *
 * Drop rates are percentages. Multiple items can drop.
 * Zone modifiers in zone-manager.ts add rarity bonuses.
 */

export const Properties: Record<string, any> = {
  // ============================================
  // TIER 1 - Starter Area (Village outskirts)
  // Level 1-2
  // ============================================
  rat: {
    level: 1,
    drops: {
      flask: 60,        // Common healing
      burger: 15,       // Food drop
      sword2: 3,        // Rare upgrade from starter
      leatherarmor: 2   // Very rare armor
    },
    aggro: 3            // Weak - only attacks very close players
  },

  // ============================================
  // TIER 2 - Early Areas (Beach, Forest edge)
  // Level 3-6
  // ============================================
  crab: {
    level: 3,
    drops: {
      flask: 45,
      burger: 12,
      axe: 15,          // Good axe source
      leatherarmor: 10,
      firepotion: 4
    },
    aggro: 4            // Slightly aggressive
  },

  bat: {
    level: 4,
    drops: {
      flask: 50,
      burger: 10,
      axe: 12,          // Axe drops here
      leatherarmor: 8,
      firepotion: 3
    },
    aggro: 4            // Slightly aggressive
  },

  goblin: {
    level: 6,
    drops: {
      flask: 40,
      burger: 8,
      axe: 18,          // Goblins love axes
      leatherarmor: 15,
      morningstar: 5,   // Rare upgrade
      firepotion: 4
    },
    aggro: 5            // More aggressive - territorial
  },

  // ============================================
  // TIER 3 - Mid Areas (Graveyard, Desert edge)
  // Level 10-18
  // ============================================
  skeleton: {
    level: 10,
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
    aggro: 5            // Undead sense the living
  },

  zombie: {
    level: 11,
    drops: {
      flask: 40,
      burger: 15,       // Brains... er, burgers
      morningstar: 12,
      mailarmor: 15,
      firepotion: 5
    },
    aggro: 5            // Zombies shamble toward the living
  },

  zombiegirl: {
    level: 12,
    drops: {
      flask: 35,
      burger: 12,
      morningstar: 15,
      mailarmor: 18,
      platearmor: 8,    // Slightly better drops
      firepotion: 6
    },
    aggro: 5            // Just as relentless
  },

  zomagent: {
    level: 14,
    drops: {
      flask: 30,
      burger: 10,
      morningstar: 10,
      platearmor: 15,   // Leader drops plate
      bluesword: 12,    // Rare bluesword
      firepotion: 8
    },
    aggro: 6            // The leader - more dangerous
  },

  wizard: {
    level: 15,
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
    aggro: 6            // Wizards attack from distance
  },

  snake: {
    level: 18,
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
    aggro: 4            // Snakes are sneaky but patient
  },

  // ============================================
  // TIER 4 - Late Areas (Deep caves, Lava edge)
  // Level 22-28
  // ============================================
  ogre: {
    level: 22,
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
    aggro: 6            // Ogres are big and angry
  },

  skeleton2: {
    level: 25,
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
    aggro: 6            // Elite undead - aggressive
  },

  eye: {
    level: 28,
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
    aggro: 7            // All-seeing eye - spots you from afar
  },

  // ============================================
  // TIER 5 - Endgame Areas (Lava, Death zones)
  // Level 35-40
  // ============================================
  spectre: {
    level: 35,
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
    aggro: 7            // Spectres hunt the living
  },

  deathknight: {
    level: 40,
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
    aggro: 8            // Elite hunter - maximum aggro range
  },

  // ============================================
  // TIER 6 - Boss (Unique encounter)
  // Level 50
  // ============================================
  boss: {
    level: 50,
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
    aggro: 8            // Boss has maximum aggro range
  },

  // ============================================
  // GETTER FUNCTIONS - Now use Formulas
  // ============================================

  /**
   * Get mob's level (or 1 if not defined)
   */
  getMobLevel: (kind: number): number => {
    const kindStr = Types.getKindAsString(kind);
    if (!kindStr) return 1;
    const props = Properties[kindStr];
    return props?.level || 1;
  },

  /**
   * Get armor level - for mobs, derived from level via formula
   */
  getArmorLevel: (kind: number): number | undefined => {
    try {
      if (Types.isMob(kind)) {
        const mobLevel = Properties.getMobLevel(kind);
        return Formulas.mobArmorLevel(mobLevel);
      } else {
        return Types.getArmorRank(kind) + 1;
      }
    } catch (e) {
      console.error('No level found for armor: ' + Types.getKindAsString(kind));
      return undefined;
    }
  },

  /**
   * Get weapon level - for mobs, derived from level via formula
   */
  getWeaponLevel: (kind: number): number | undefined => {
    try {
      if (Types.isMob(kind)) {
        const mobLevel = Properties.getMobLevel(kind);
        return Formulas.mobWeaponLevel(mobLevel);
      } else {
        return Types.getWeaponRank(kind) + 1;
      }
    } catch (e) {
      console.error('No level found for weapon: ' + Types.getKindAsString(kind));
      return undefined;
    }
  },

  /**
   * Get hit points - for mobs, derived from level via formula
   */
  getHitPoints: (kind: number): number => {
    const mobLevel = Properties.getMobLevel(kind);
    return Formulas.mobHP(mobLevel);
  },

  /**
   * Get aggro range (unchanged - still hand-tuned per mob)
   */
  getAggroRange: (kind: number): number => {
    const kindStr = Types.getKindAsString(kind);
    if (!kindStr) return 0;
    const props = Properties[kindStr];
    return props?.aggro || 0;
  }
};
