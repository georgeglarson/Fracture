/**
 * Tests for Player.grantXP rested-XP write-back
 *
 * ProgressionHandler.applyXpGain burns rested XP on a context COPY —
 * Player.grantXP must write the mutated value back onto the player or the
 * rested bonus never depletes.
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

import { Player } from '../player';
import type { Connection } from '../ws';
import type { World } from '../world';

function createMockConnection(id = 1) {
  return {
    id,
    listen: vi.fn(),
    onClose: vi.fn(),
    sendUTF8: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    clientIp: '127.0.0.1',
  };
}

function createPlayer(): Player {
  // The world is not touched by grantXP — a bare object suffices
  return new Player(
    createMockConnection() as unknown as Connection,
    {} as unknown as World,
  );
}

describe('Player.grantXP', () => {
  it('writes the rested XP burn back to the player', () => {
    const player = createPlayer();
    player.restedXp = 20;

    player.grantXP(50);

    // RESTED_BURN_RATE is 1 per XP gain
    expect(player.restedXp).toBe(19);
  });

  it('depletes rested XP across successive gains', () => {
    const player = createPlayer();
    player.restedXp = 3;

    player.grantXP(10);
    player.grantXP(10);
    player.grantXP(10);

    expect(player.restedXp).toBe(0);
  });

  it('applies the rested multiplier to the granted XP', () => {
    const player = createPlayer();
    player.restedXp = 20; // +20% XP while rested

    player.grantXP(50);

    // efficiency 1.0 (fresh session) * (1 + 0.2 rested) = 60
    expect(player.xp).toBe(60);
  });

  it('does not drive rested XP below zero', () => {
    const player = createPlayer();
    player.restedXp = 0.5;

    player.grantXP(50);

    expect(player.restedXp).toBe(0);
  });
});

describe('Player.handleRiftDisconnect', () => {
  it('restores the rift entry position so the exit save persists it, not the arena', () => {
    const player = createPlayer();
    player.riftSavedPosition = { x: 100, y: 200 };
    player.setPosition(20, 20); // standing in the rift arena

    player.handleRiftDisconnect();

    expect(player.x).toBe(100);
    expect(player.y).toBe(200);
    expect(player.riftSavedPosition).toBeNull();
  });

  it('is a no-op without a saved rift position', () => {
    const player = createPlayer();
    player.setPosition(50, 60);

    expect(() => player.handleRiftDisconnect()).not.toThrow();
    expect(player.x).toBe(50);
    expect(player.y).toBe(60);
  });
});
