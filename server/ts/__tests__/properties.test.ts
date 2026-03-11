/**
 * Tests for Properties module
 * Covers: mob data definitions, getter functions (getMobLevel, getArmorLevel,
 * getWeaponLevel, getHitPoints, getAggroRange), formula integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Properties } from '../properties';
import { Types } from '../../../shared/ts/gametypes';
import { Formulas } from '../formulas';

describe('Properties', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Mob Data Definitions
  // ============================================================================

  describe('mob data definitions', () => {
    const allMobs = [
      'rat', 'crab', 'bat', 'goblin', 'skeleton', 'zombie', 'zombiegirl',
      'zomagent', 'wizard', 'snake', 'ogre', 'skeleton2', 'eye',
      'spectre', 'deathknight', 'boss'
    ];

    it('should define data for all mob types', () => {
      for (const mob of allMobs) {
        expect(Properties[mob]).toBeDefined();
        expect(Properties[mob].level).toBeDefined();
        expect(Properties[mob].drops).toBeDefined();
        expect(Properties[mob].aggro).toBeDefined();
      }
    });

    it('should have positive integer levels for all mobs', () => {
      for (const mob of allMobs) {
        expect(Properties[mob].level).toBeGreaterThan(0);
        expect(Number.isInteger(Properties[mob].level)).toBe(true);
      }
    });

    it('should have positive aggro ranges for all mobs', () => {
      for (const mob of allMobs) {
        expect(Properties[mob].aggro).toBeGreaterThan(0);
      }
    });

    it('should have drop tables with percentage values between 0 and 100', () => {
      for (const mob of allMobs) {
        const drops = Properties[mob].drops;
        for (const [item, rate] of Object.entries(drops)) {
          expect(rate).toBeGreaterThan(0);
          expect(rate).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('tier 1 - starter mobs', () => {
    it('should define rat at level 1 with weak aggro', () => {
      expect(Properties.rat.level).toBe(1);
      expect(Properties.rat.aggro).toBe(3);
    });

    it('should give rat appropriate drops', () => {
      expect(Properties.rat.drops.flask).toBe(60);
      expect(Properties.rat.drops.burger).toBe(15);
      expect(Properties.rat.drops.sword2).toBe(3);
      expect(Properties.rat.drops.leatherarmor).toBe(2);
    });
  });

  describe('tier 2 - early mobs', () => {
    it('should define crab at level 3', () => {
      expect(Properties.crab.level).toBe(3);
      expect(Properties.crab.aggro).toBe(4);
    });

    it('should define bat at level 4', () => {
      expect(Properties.bat.level).toBe(4);
      expect(Properties.bat.aggro).toBe(4);
    });

    it('should define goblin at level 6 with higher aggro', () => {
      expect(Properties.goblin.level).toBe(6);
      expect(Properties.goblin.aggro).toBe(5);
    });
  });

  describe('tier 3 - mid mobs', () => {
    it('should define skeleton at level 10', () => {
      expect(Properties.skeleton.level).toBe(10);
    });

    it('should define zombie at level 11', () => {
      expect(Properties.zombie.level).toBe(11);
    });

    it('should define zombiegirl at level 12', () => {
      expect(Properties.zombiegirl.level).toBe(12);
    });

    it('should define zomagent at level 14', () => {
      expect(Properties.zomagent.level).toBe(14);
    });

    it('should define wizard at level 15', () => {
      expect(Properties.wizard.level).toBe(15);
    });

    it('should define snake at level 18', () => {
      expect(Properties.snake.level).toBe(18);
    });

    it('should give skeleton void dimension drops', () => {
      expect(Properties.skeleton.drops.tentacle).toBe(4);
      expect(Properties.skeleton.drops.voidcloak).toBe(3);
    });

    it('should give wizard mystic dimension drops', () => {
      expect(Properties.wizard.drops.crystalstaff).toBe(5);
      expect(Properties.wizard.drops.crystalshell).toBe(3);
    });

    it('should give snake tech dimension drops', () => {
      expect(Properties.snake.drops.raygun).toBe(4);
      expect(Properties.snake.drops.mp5).toBe(5);
    });
  });

  describe('tier 4 - late mobs', () => {
    it('should define ogre at level 22', () => {
      expect(Properties.ogre.level).toBe(22);
    });

    it('should define skeleton2 at level 25', () => {
      expect(Properties.skeleton2.level).toBe(25);
    });

    it('should define eye at level 28', () => {
      expect(Properties.eye.level).toBe(28);
    });
  });

  describe('tier 5 - endgame mobs', () => {
    it('should define spectre at level 35', () => {
      expect(Properties.spectre.level).toBe(35);
    });

    it('should define deathknight at level 40', () => {
      expect(Properties.deathknight.level).toBe(40);
    });

    it('should give deathknight drops from all dimensions', () => {
      expect(Properties.deathknight.drops.voidblade).toBeDefined();
      expect(Properties.deathknight.drops.plasmahelix).toBeDefined();
      expect(Properties.deathknight.drops.crystalstaff).toBeDefined();
      expect(Properties.deathknight.drops.mecharmor).toBeDefined();
      expect(Properties.deathknight.drops.crystalshell).toBeDefined();
    });
  });

  describe('tier 6 - boss', () => {
    it('should define boss at level 50', () => {
      expect(Properties.boss.level).toBe(50);
    });

    it('should guarantee golden sword drop from boss', () => {
      expect(Properties.boss.drops.goldensword).toBe(100);
    });

    it('should have high chance golden armor from boss', () => {
      expect(Properties.boss.drops.goldenarmor).toBe(80);
    });

    it('should have guaranteed burger (victory feast)', () => {
      expect(Properties.boss.drops.burger).toBe(100);
    });

    it('should have maximum aggro range', () => {
      expect(Properties.boss.aggro).toBe(8);
    });
  });

  describe('level ordering', () => {
    it('should have mobs ordered by increasing level within tiers', () => {
      // Tier 1
      expect(Properties.rat.level).toBeLessThan(Properties.crab.level);
      // Tier 2
      expect(Properties.crab.level).toBeLessThan(Properties.bat.level);
      expect(Properties.bat.level).toBeLessThan(Properties.goblin.level);
      // Tier 3
      expect(Properties.goblin.level).toBeLessThan(Properties.skeleton.level);
      expect(Properties.skeleton.level).toBeLessThan(Properties.zombie.level);
      expect(Properties.zombie.level).toBeLessThan(Properties.zombiegirl.level);
      expect(Properties.zombiegirl.level).toBeLessThan(Properties.zomagent.level);
      expect(Properties.zomagent.level).toBeLessThan(Properties.wizard.level);
      expect(Properties.wizard.level).toBeLessThan(Properties.snake.level);
      // Tier 4
      expect(Properties.snake.level).toBeLessThan(Properties.ogre.level);
      expect(Properties.ogre.level).toBeLessThan(Properties.skeleton2.level);
      expect(Properties.skeleton2.level).toBeLessThan(Properties.eye.level);
      // Tier 5
      expect(Properties.eye.level).toBeLessThan(Properties.spectre.level);
      expect(Properties.spectre.level).toBeLessThan(Properties.deathknight.level);
      // Boss
      expect(Properties.deathknight.level).toBeLessThan(Properties.boss.level);
    });
  });

  // ============================================================================
  // Getter Functions
  // ============================================================================

  describe('getMobLevel', () => {
    it('should return the level for a known mob kind', () => {
      const ratKind = Types.getKindFromString('rat')!;
      expect(Properties.getMobLevel(ratKind)).toBe(1);
    });

    it('should return correct level for boss', () => {
      const bossKind = Types.getKindFromString('boss')!;
      expect(Properties.getMobLevel(bossKind)).toBe(50);
    });

    it('should return correct level for mid-tier mob', () => {
      const skeletonKind = Types.getKindFromString('skeleton')!;
      expect(Properties.getMobLevel(skeletonKind)).toBe(10);
    });

    it('should return 1 for an unknown kind', () => {
      expect(Properties.getMobLevel(99999)).toBe(1);
    });

    it('should return 1 when getKindAsString returns undefined', () => {
      // A kind number not in the registry
      expect(Properties.getMobLevel(-1)).toBe(1);
    });
  });

  describe('getArmorLevel', () => {
    it('should return formula-based armor level for a mob', () => {
      const ratKind = Types.getKindFromString('rat')!;
      const ratLevel = Properties.rat.level;
      const expected = Formulas.mobArmorLevel(ratLevel);
      expect(Properties.getArmorLevel(ratKind)).toBe(expected);
    });

    it('should return formula-based armor level for boss', () => {
      const bossKind = Types.getKindFromString('boss')!;
      const bossLevel = Properties.boss.level;
      const expected = Formulas.mobArmorLevel(bossLevel);
      expect(Properties.getArmorLevel(bossKind)).toBe(expected);
    });

    it('should return rank+1 for armor items (non-mob)', () => {
      const leatherArmorKind = Types.getKindFromString('leatherarmor')!;
      const expectedRank = Types.getArmorRank(leatherArmorKind) + 1;
      expect(Properties.getArmorLevel(leatherArmorKind)).toBe(expectedRank);
    });

    it('should return rank+1 for golden armor', () => {
      const goldenArmorKind = Types.getKindFromString('goldenarmor')!;
      const expectedRank = Types.getArmorRank(goldenArmorKind) + 1;
      expect(Properties.getArmorLevel(goldenArmorKind)).toBe(expectedRank);
    });

    it('should return undefined when getArmorRank throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Weapon kind is not a mob but getArmorRank will return -1 (indexOf not found)
      // This actually won't throw, it returns 0 (rank -1 + 1).
      // To test the error path, we mock Types.getArmorRank to throw.
      vi.spyOn(Types, 'getArmorRank').mockImplementation(() => { throw new Error('test'); });
      vi.spyOn(Types, 'isMob').mockReturnValue(false);
      const result = Properties.getArmorLevel(99999);
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('getWeaponLevel', () => {
    it('should return formula-based weapon level for a mob', () => {
      const goblinKind = Types.getKindFromString('goblin')!;
      const goblinLevel = Properties.goblin.level;
      const expected = Formulas.mobWeaponLevel(goblinLevel);
      expect(Properties.getWeaponLevel(goblinKind)).toBe(expected);
    });

    it('should return formula-based weapon level for boss', () => {
      const bossKind = Types.getKindFromString('boss')!;
      const bossLevel = Properties.boss.level;
      const expected = Formulas.mobWeaponLevel(bossLevel);
      expect(Properties.getWeaponLevel(bossKind)).toBe(expected);
    });

    it('should return rank+1 for weapon items (non-mob)', () => {
      const sword2Kind = Types.getKindFromString('sword2')!;
      const expectedRank = Types.getWeaponRank(sword2Kind) + 1;
      expect(Properties.getWeaponLevel(sword2Kind)).toBe(expectedRank);
    });

    it('should return rank+1 for golden sword', () => {
      const goldenSwordKind = Types.getKindFromString('goldensword')!;
      const expectedRank = Types.getWeaponRank(goldenSwordKind) + 1;
      expect(Properties.getWeaponLevel(goldenSwordKind)).toBe(expectedRank);
    });

    it('should return undefined when getWeaponRank throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Types, 'getWeaponRank').mockImplementation(() => { throw new Error('test'); });
      vi.spyOn(Types, 'isMob').mockReturnValue(false);
      const result = Properties.getWeaponLevel(99999);
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('getHitPoints', () => {
    it('should return formula-based HP for rat (level 1)', () => {
      const ratKind = Types.getKindFromString('rat')!;
      const expected = Formulas.mobHP(1);
      expect(Properties.getHitPoints(ratKind)).toBe(expected);
    });

    it('should return formula-based HP for boss (level 50)', () => {
      const bossKind = Types.getKindFromString('boss')!;
      const expected = Formulas.mobHP(50);
      expect(Properties.getHitPoints(bossKind)).toBe(expected);
    });

    it('should return formula-based HP for deathknight (level 40)', () => {
      const dkKind = Types.getKindFromString('deathknight')!;
      const expected = Formulas.mobHP(40);
      expect(Properties.getHitPoints(dkKind)).toBe(expected);
    });

    it('should return HP based on level 1 for unknown kind', () => {
      // getMobLevel returns 1 for unknown kinds
      const expected = Formulas.mobHP(1);
      expect(Properties.getHitPoints(99999)).toBe(expected);
    });

    it('should return higher HP for higher level mobs', () => {
      const ratKind = Types.getKindFromString('rat')!;
      const bossKind = Types.getKindFromString('boss')!;
      expect(Properties.getHitPoints(bossKind)).toBeGreaterThan(Properties.getHitPoints(ratKind));
    });
  });

  describe('getAggroRange', () => {
    it('should return correct aggro for rat', () => {
      const ratKind = Types.getKindFromString('rat')!;
      expect(Properties.getAggroRange(ratKind)).toBe(3);
    });

    it('should return correct aggro for boss', () => {
      const bossKind = Types.getKindFromString('boss')!;
      expect(Properties.getAggroRange(bossKind)).toBe(8);
    });

    it('should return correct aggro for deathknight', () => {
      const dkKind = Types.getKindFromString('deathknight')!;
      expect(Properties.getAggroRange(dkKind)).toBe(8);
    });

    it('should return correct aggro for goblin', () => {
      const goblinKind = Types.getKindFromString('goblin')!;
      expect(Properties.getAggroRange(goblinKind)).toBe(5);
    });

    it('should return 0 for unknown kind', () => {
      expect(Properties.getAggroRange(99999)).toBe(0);
    });

    it('should return 0 for non-mob entities without aggro property', () => {
      // Armor items have no aggro
      const armorKind = Types.getKindFromString('leatherarmor')!;
      expect(Properties.getAggroRange(armorKind)).toBe(0);
    });

    it('should have increasing aggro for stronger mobs', () => {
      const ratKind = Types.getKindFromString('rat')!;
      const goblinKind = Types.getKindFromString('goblin')!;
      const bossKind = Types.getKindFromString('boss')!;

      const ratAggro = Properties.getAggroRange(ratKind);
      const goblinAggro = Properties.getAggroRange(goblinKind);
      const bossAggro = Properties.getAggroRange(bossKind);

      expect(goblinAggro).toBeGreaterThan(ratAggro);
      expect(bossAggro).toBeGreaterThan(goblinAggro);
    });
  });

  // ============================================================================
  // Integration: getters use Formulas correctly
  // ============================================================================

  describe('formula integration', () => {
    it('should use Formulas.mobHP in getHitPoints', () => {
      const spy = vi.spyOn(Formulas, 'mobHP');
      const ratKind = Types.getKindFromString('rat')!;
      Properties.getHitPoints(ratKind);
      expect(spy).toHaveBeenCalledWith(1); // rat is level 1
    });

    it('should use Formulas.mobWeaponLevel in getWeaponLevel for mobs', () => {
      const spy = vi.spyOn(Formulas, 'mobWeaponLevel');
      const goblinKind = Types.getKindFromString('goblin')!;
      Properties.getWeaponLevel(goblinKind);
      expect(spy).toHaveBeenCalledWith(6); // goblin is level 6
    });

    it('should use Formulas.mobArmorLevel in getArmorLevel for mobs', () => {
      const spy = vi.spyOn(Formulas, 'mobArmorLevel');
      const eyeKind = Types.getKindFromString('eye')!;
      Properties.getArmorLevel(eyeKind);
      expect(spy).toHaveBeenCalledWith(28); // eye is level 28
    });

    it('should not use mob formulas for non-mob armor kinds', () => {
      const spy = vi.spyOn(Formulas, 'mobArmorLevel');
      const plateKind = Types.getKindFromString('platearmor')!;
      Properties.getArmorLevel(plateKind);
      expect(spy).not.toHaveBeenCalled();
    });

    it('should not use mob formulas for non-mob weapon kinds', () => {
      const spy = vi.spyOn(Formulas, 'mobWeaponLevel');
      const swordKind = Types.getKindFromString('sword2')!;
      Properties.getWeaponLevel(swordKind);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
