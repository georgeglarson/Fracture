/**
 * Tests for EconomyService
 * Covers: consumable classification for purchases (CAKE / FIREPOTION must
 * take the consumable path — the phantom-purchase fix), purchase results.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

import { Types } from '../../../shared/ts/gametypes';
import { EconomyService } from '../player/economy.service';

describe('EconomyService', () => {
  const service = new EconomyService();

  describe('processPurchase — consumable classification', () => {
    it('treats CAKE as a consumable with its heal amount', () => {
      const result = service.processPurchase(Types.Entities.VILLAGEGIRL, Types.Entities.CAKE, 100);

      expect(result.success).toBe(true);
      expect(result.isConsumable).toBe(true);
      expect(result.healAmount).toBe(60);
      expect(result.isWeapon).toBe(false);
      expect(result.isArmor).toBe(false);
      expect(result.newGold).toBe(60); // 100 - 40 (cake price)
    });

    it('treats FIREPOTION as a consumable with no heal amount', () => {
      const result = service.processPurchase(Types.Entities.SCIENTIST, Types.Entities.FIREPOTION, 500);

      expect(result.success).toBe(true);
      expect(result.isConsumable).toBe(true);
      expect(result.healAmount).toBe(0); // special effect, not a heal
      expect(result.newGold).toBe(380); // 500 - 120 (scientist firepotion price)
    });

    it('still treats healing items as consumables', () => {
      const result = service.processPurchase(Types.Entities.VILLAGEGIRL, Types.Entities.FLASK, 100);

      expect(result.success).toBe(true);
      expect(result.isConsumable).toBe(true);
      expect(result.healAmount).toBe(40);
    });

    it('does not classify weapons or armor as consumable', () => {
      const weapon = service.processPurchase(Types.Entities.GUARD, Types.Entities.SWORD2, 500);
      expect(weapon.success).toBe(true);
      expect(weapon.isWeapon).toBe(true);
      expect(weapon.isConsumable).toBe(false);

      const armor = service.processPurchase(Types.Entities.VILLAGER, Types.Entities.LEATHERARMOR, 500);
      expect(armor.success).toBe(true);
      expect(armor.isArmor).toBe(true);
      expect(armor.isConsumable).toBe(false);
    });

    it('fails when the item is not sold by the NPC', () => {
      const result = service.processPurchase(Types.Entities.VILLAGEGIRL, Types.Entities.SWORD2, 500);

      expect(result.success).toBe(false);
      expect(result.newGold).toBe(500); // unchanged
    });

    it('fails when the player cannot afford the item', () => {
      const result = service.processPurchase(Types.Entities.VILLAGEGIRL, Types.Entities.CAKE, 10);

      expect(result.success).toBe(false);
      expect(result.newGold).toBe(10); // unchanged
    });
  });
});
