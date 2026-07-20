/**
 * Tests for RoamingBoss / ZoneBossManager
 *
 * Covers gameplay-correctness fixes:
 *   1. bossId is set from config.id (gates legendary drops in world.getDroppedItem)
 *   2. Bosses fight/pay with config stats (weaponLevel/armorLevel/level), not sprite stats
 *   3. spawnBoss wires onMove so movement is broadcast to clients
 *   4. Loot multipliers are exposed for reward distribution
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// Quiet logger
vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

import { RoamingBoss, ZoneBossManager } from '../roaming-boss';
import { ZONE_BOSSES, ZoneBossConfig } from '../zone-boss-config';
import { ZONE_DATA } from '../../../shared/ts/zones/zone-data';
import { Properties } from '../properties';

const HARVESTER: ZoneBossConfig = ZONE_BOSSES.find((b) => b.id === 'the_harvester')!;

function createMockBossWorld() {
  return {
    // One player → dynamic difficulty stays at 1.0x (no HP rescale)
    players: { 1: { id: 1, name: 'TestPlayer', level: 10, x: 0, y: 0, isDead: false } },
    map: null,
    addMob: vi.fn(),
    handleMobHate: vi.fn(),
    pushToPlayer: vi.fn(),
    onMobMoveCallback: vi.fn(),
  };
}

describe('RoamingBoss', () => {
  describe('constructor stats', () => {
    it('sets bossId from config.id for legendary drop gating', () => {
      const boss = new RoamingBoss(200001, HARVESTER, 50, 280);
      expect(boss.bossId).toBe('the_harvester');
    });

    it('fights with config stats, not the base sprite kind stats', () => {
      const boss = new RoamingBoss(200001, HARVESTER, 50, 280);

      expect(boss.weaponLevel).toBe(HARVESTER.damage);
      expect(boss.armorLevel).toBe(HARVESTER.armor);

      // Sanity: these must differ from the raw sprite properties, proving the override
      const spriteWeapon = Properties.getWeaponLevel(HARVESTER.kind) ?? 1;
      const spriteArmor = Properties.getArmorLevel(HARVESTER.kind) ?? 1;
      expect(boss.weaponLevel).toBeGreaterThan(spriteWeapon);
      expect(boss.armorLevel).toBeGreaterThan(spriteArmor);
    });

    it('takes its level from the zone maxLevel (XP/damage scaling)', () => {
      const boss = new RoamingBoss(200001, HARVESTER, 50, 280);
      expect(boss.level).toBe(ZONE_DATA[HARVESTER.zoneId].maxLevel);
    });

    it('keeps config HP as max/hit points', () => {
      const boss = new RoamingBoss(200001, HARVESTER, 50, 280);
      expect(boss.maxHitPoints).toBe(HARVESTER.hp);
      expect(boss.hitPoints).toBe(HARVESTER.hp);
      expect(boss.baseMaxHp).toBe(HARVESTER.hp);
    });

    it('uses config aggro range', () => {
      const boss = new RoamingBoss(200001, HARVESTER, 50, 280);
      expect(boss.aggroRange).toBe(HARVESTER.aggroRange);
    });
  });

  describe('getLootMultipliers', () => {
    it('exposes xp/gold/dropBonus multipliers from config', () => {
      const boss = new RoamingBoss(200001, HARVESTER, 50, 280);
      expect(boss.getLootMultipliers()).toEqual({
        xp: HARVESTER.xpMultiplier,
        gold: HARVESTER.goldMultiplier,
        dropBonus: HARVESTER.dropBonus,
      });
    });
  });
});

describe('ZoneBossManager.spawnBoss', () => {
  let manager: ZoneBossManager;

  afterEach(() => {
    manager?.shutdown();
  });

  it('wires onMove so boss movement is broadcast to clients', () => {
    const world = createMockBossWorld();
    manager = new ZoneBossManager(world);

    manager.spawnBoss(HARVESTER);

    expect(world.addMob).toHaveBeenCalledTimes(1);
    const boss = world.addMob.mock.calls[0][0] as RoamingBoss;

    // The move callback must be registered (MobArea/SpawnManager do the same)
    expect(boss.moveCallback).toBeInstanceOf(Function);

    boss.move(boss.x + 1, boss.y);

    expect(world.onMobMoveCallback).toHaveBeenCalledWith(boss);
  });

  it('registers the spawned boss with its config-derived stats', () => {
    const world = createMockBossWorld();
    manager = new ZoneBossManager(world);

    manager.spawnBoss(HARVESTER);

    const boss = world.addMob.mock.calls[0][0] as RoamingBoss;
    expect(boss.bossId).toBe(HARVESTER.id);
    expect(boss.weaponLevel).toBe(HARVESTER.damage);
    expect(boss.armorLevel).toBe(HARVESTER.armor);
    expect(boss.maxHitPoints).toBe(HARVESTER.hp);
  });

  it('does not spawn a duplicate boss of the same type', () => {
    const world = createMockBossWorld();
    manager = new ZoneBossManager(world);

    manager.spawnBoss(HARVESTER);
    manager.spawnBoss(HARVESTER);

    expect(world.addMob).toHaveBeenCalledTimes(1);
  });
});
