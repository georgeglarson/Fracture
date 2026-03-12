/**
 * Tests for LootHandler
 * Covers: handleLoot (equipment pickup, consumable use, healing)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from '../../../shared/ts/gametypes';

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

// Mock inventory handler
vi.mock('../player/inventory.handler', () => ({
  handleInventoryPickup: vi.fn(),
  persistInventory: vi.fn(),
}));

// Mock message module
vi.mock('../message', () => ({
  Messages: {
    HitPoints: vi.fn(function (this: any, hp: number) {
      this.serialize = () => [23, hp];
    }),
  },
}));

import { handleLoot } from '../player/loot.handler';
import * as InventoryHandler from '../player/inventory.handler';
import { persistInventory } from '../player/inventory.handler';
import type { Player } from '../player';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockWorld() {
  return {
    getEntityById: vi.fn(() => null),
    removeEntity: vi.fn(),
    pushToPlayer: vi.fn(),
  };
}

function createMockPlayer(overrides: Record<string, any> = {}): Player {
  const world = createMockWorld();
  return {
    id: 1,
    name: 'TestPlayer',
    x: 50,
    y: 50,
    hitPoints: 80,
    maxHitPoints: 100,
    armor: Types.Entities.CLOTHARMOR,

    getWorld: vi.fn(() => world),

    send: vi.fn(),
    broadcast: vi.fn(),
    updateHitPoints: vi.fn(),
    hasFullHealth: vi.fn(() => false),
    regenHealthBy: vi.fn(),
    health: vi.fn(() => ({ serialize: () => [] })),
    equip: vi.fn(() => ({ serialize: () => [] })),
    firepotionTimeout: null,

    ...overrides,
  } as unknown as Player;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LootHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleLoot', () => {
    it('should route armor pickup to inventory handler', () => {
      const player = createMockPlayer();
      const world = player.getWorld() as ReturnType<typeof createMockWorld>;
      const item = { id: 55, kind: Types.Entities.LEATHERARMOR, despawn: vi.fn() };
      world.getEntityById = vi.fn(() => item);

      handleLoot(player, [12, 55]);

      expect(InventoryHandler.handleInventoryPickup).toHaveBeenCalledWith(player, 55);
      expect(persistInventory).toHaveBeenCalledWith(player);
    });

    it('should route weapon pickup to inventory handler', () => {
      const player = createMockPlayer();
      const world = player.getWorld() as ReturnType<typeof createMockWorld>;
      const item = { id: 55, kind: Types.Entities.SWORD2, despawn: vi.fn() };
      world.getEntityById = vi.fn(() => item);

      handleLoot(player, [12, 55]);

      expect(InventoryHandler.handleInventoryPickup).toHaveBeenCalledWith(player, 55);
      expect(persistInventory).toHaveBeenCalledWith(player);
    });

    it('should heal player with flask', () => {
      const player = createMockPlayer();
      const world = player.getWorld() as ReturnType<typeof createMockWorld>;
      const item = { id: 55, kind: Types.Entities.FLASK, despawn: vi.fn(() => 'despawned') };
      world.getEntityById = vi.fn(() => item);

      handleLoot(player, [12, 55]);

      expect(player.broadcast).toHaveBeenCalledWith('despawned');
      expect(world.removeEntity).toHaveBeenCalledWith(item);
      expect(player.regenHealthBy).toHaveBeenCalledWith(40);
    });

    it('should heal player with burger', () => {
      const player = createMockPlayer();
      const world = player.getWorld() as ReturnType<typeof createMockWorld>;
      const item = { id: 55, kind: Types.Entities.BURGER, despawn: vi.fn(() => 'despawned') };
      world.getEntityById = vi.fn(() => item);

      handleLoot(player, [12, 55]);

      expect(player.regenHealthBy).toHaveBeenCalledWith(100);
    });

    it('should not heal player at full health', () => {
      const player = createMockPlayer();
      (player.hasFullHealth as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const world = player.getWorld() as ReturnType<typeof createMockWorld>;
      const item = { id: 55, kind: Types.Entities.FLASK, despawn: vi.fn(() => 'despawned') };
      world.getEntityById = vi.fn(() => item);

      handleLoot(player, [12, 55]);

      expect(player.regenHealthBy).not.toHaveBeenCalled();
    });

    it('should apply firepotion effect', () => {
      vi.useFakeTimers();
      const player = createMockPlayer();
      const world = player.getWorld() as ReturnType<typeof createMockWorld>;
      const item = { id: 55, kind: Types.Entities.FIREPOTION, despawn: vi.fn(() => 'despawned') };
      world.getEntityById = vi.fn(() => item);

      handleLoot(player, [12, 55]);

      expect(player.updateHitPoints).toHaveBeenCalled();
      expect(player.equip).toHaveBeenCalledWith(Types.Entities.FIREFOX);
      expect(player.firepotionTimeout).not.toBeNull();

      vi.useRealTimers();
    });

    it('should do nothing for non-existent item', () => {
      const player = createMockPlayer();

      handleLoot(player, [12, 999]);

      expect(player.broadcast).not.toHaveBeenCalled();
    });
  });
});
