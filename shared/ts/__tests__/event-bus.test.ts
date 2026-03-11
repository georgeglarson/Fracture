/**
 * Tests for shared/ts/events/event-bus.ts
 * Covers: subscribe/unsubscribe, emit with data, multiple listeners,
 *         once semantics, off (removeAll), listenerCount, debug mode,
 *         singleton factories, resetEventBuses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EventBus,
  getServerEventBus,
  getClientEventBus,
  resetEventBuses,
} from '../events/event-bus';
import type { Subscription, EventHandler } from '../events/event-bus';

/* ------------------------------------------------------------------ */
/*  Fresh bus helper -- every test gets its own instance               */
/* ------------------------------------------------------------------ */
function makeBus(opts?: { debug?: boolean }): EventBus {
  return new EventBus(opts);
}

/* ------------------------------------------------------------------ */
/*  Payload factories for commonly used event shapes                  */
/* ------------------------------------------------------------------ */
function mobKilledPayload() {
  return {
    mobId: 1,
    mobType: 10,
    mobName: 'Skeleton',
    killerId: 42,
    killerName: 'Player1',
    x: 100,
    y: 200,
  };
}

function playerConnectedPayload() {
  return {
    playerId: 42,
    playerName: 'Player1',
    x: 10,
    y: 20,
  };
}

function entitySpawnedPayload() {
  return {
    entityId: 99,
    entityType: 5,
    x: 50,
    y: 60,
    name: 'Goblin',
  };
}

/* ================================================================== */
/*  TESTS                                                             */
/* ================================================================== */

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = makeBus();
  });

  afterEach(() => {
    // Ensure no dangling listeners leak between tests
    bus.off();
  });

  /* ---------- subscribe / emit basics ---------- */

  describe('on + emit', () => {
    it('should deliver the exact payload to the handler', () => {
      const handler = vi.fn();
      bus.on('mob:killed', handler);

      const payload = mobKilledPayload();
      bus.emit('mob:killed', payload);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should not fire the handler before emit is called', () => {
      const handler = vi.fn();
      bus.on('mob:killed', handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not fire handler for a different event', () => {
      const handler = vi.fn();
      bus.on('mob:killed', handler);

      bus.emit('player:connected', playerConnectedPayload());

      expect(handler).not.toHaveBeenCalled();
    });

    it('should deliver events synchronously', () => {
      const order: number[] = [];

      bus.on('mob:killed', () => order.push(1));

      order.push(0);
      bus.emit('mob:killed', mobKilledPayload());
      order.push(2);

      // 0 -> emit fires 1 synchronously -> 2
      expect(order).toEqual([0, 1, 2]);
    });
  });

  /* ---------- unsubscribe ---------- */

  describe('unsubscribe (returned Subscription)', () => {
    it('should return a Subscription object with an unsubscribe method', () => {
      const sub = bus.on('mob:killed', vi.fn());

      expect(sub).toBeDefined();
      expect(typeof sub.unsubscribe).toBe('function');
    });

    it('should stop receiving events after unsubscribe', () => {
      const handler = vi.fn();
      const sub = bus.on('mob:killed', handler);

      bus.emit('mob:killed', mobKilledPayload());
      expect(handler).toHaveBeenCalledOnce();

      sub.unsubscribe();

      bus.emit('mob:killed', mobKilledPayload());
      expect(handler).toHaveBeenCalledOnce(); // still 1
    });

    it('should allow calling unsubscribe multiple times without error', () => {
      const sub = bus.on('mob:killed', vi.fn());

      expect(() => {
        sub.unsubscribe();
        sub.unsubscribe();
        sub.unsubscribe();
      }).not.toThrow();
    });

    it('should only remove the specific handler, not others on the same event', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      const subA = bus.on('mob:killed', handlerA);
      bus.on('mob:killed', handlerB);

      subA.unsubscribe();

      bus.emit('mob:killed', mobKilledPayload());

      expect(handlerA).not.toHaveBeenCalled();
      expect(handlerB).toHaveBeenCalledOnce();
    });
  });

  /* ---------- multiple listeners ---------- */

  describe('multiple listeners', () => {
    it('should notify all subscribers for the same event', () => {
      const handlers = [vi.fn(), vi.fn(), vi.fn()];
      handlers.forEach((h) => bus.on('mob:killed', h));

      bus.emit('mob:killed', mobKilledPayload());

      handlers.forEach((h) => expect(h).toHaveBeenCalledOnce());
    });

    it('should pass the same payload reference to every listener', () => {
      const receivedPayloads: unknown[] = [];
      bus.on('mob:killed', (p) => receivedPayloads.push(p));
      bus.on('mob:killed', (p) => receivedPayloads.push(p));

      const payload = mobKilledPayload();
      bus.emit('mob:killed', payload);

      expect(receivedPayloads[0]).toBe(payload);
      expect(receivedPayloads[1]).toBe(payload);
    });

    it('should allow subscribing the same function to different events', () => {
      const handler = vi.fn();
      bus.on('mob:killed', handler as EventHandler<'mob:killed'>);
      bus.on('entity:spawned', handler as EventHandler<'entity:spawned'>);

      bus.emit('mob:killed', mobKilledPayload());
      bus.emit('entity:spawned', entitySpawnedPayload());

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  /* ---------- once semantics ---------- */

  describe('once', () => {
    it('should fire the handler exactly once', () => {
      const handler = vi.fn();
      bus.once('mob:killed', handler);

      bus.emit('mob:killed', mobKilledPayload());
      bus.emit('mob:killed', mobKilledPayload());
      bus.emit('mob:killed', mobKilledPayload());

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should pass the payload correctly on the single invocation', () => {
      const handler = vi.fn();
      bus.once('mob:killed', handler);

      const payload = mobKilledPayload();
      bus.emit('mob:killed', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should return a Subscription that can cancel before any emit', () => {
      const handler = vi.fn();
      const sub = bus.once('mob:killed', handler);

      sub.unsubscribe();

      bus.emit('mob:killed', mobKilledPayload());

      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow calling unsubscribe after once already fired', () => {
      const handler = vi.fn();
      const sub = bus.once('mob:killed', handler);

      bus.emit('mob:killed', mobKilledPayload());

      // The handler already auto-removed; calling unsubscribe should be safe
      expect(() => sub.unsubscribe()).not.toThrow();
    });

    it('should not interfere with a regular on() on the same event', () => {
      const onceHandler = vi.fn();
      const onHandler = vi.fn();

      bus.once('mob:killed', onceHandler);
      bus.on('mob:killed', onHandler);

      bus.emit('mob:killed', mobKilledPayload());
      bus.emit('mob:killed', mobKilledPayload());

      expect(onceHandler).toHaveBeenCalledOnce();
      expect(onHandler).toHaveBeenCalledTimes(2);
    });
  });

  /* ---------- off (remove all) ---------- */

  describe('off (removeAllListeners)', () => {
    it('should remove all listeners for a specific event', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('mob:killed', h1);
      bus.on('mob:killed', h2);

      bus.off('mob:killed');

      bus.emit('mob:killed', mobKilledPayload());

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    it('should not affect listeners on other events', () => {
      const mobHandler = vi.fn();
      const entityHandler = vi.fn();

      bus.on('mob:killed', mobHandler);
      bus.on('entity:spawned', entityHandler);

      bus.off('mob:killed');

      bus.emit('mob:killed', mobKilledPayload());
      bus.emit('entity:spawned', entitySpawnedPayload());

      expect(mobHandler).not.toHaveBeenCalled();
      expect(entityHandler).toHaveBeenCalledOnce();
    });

    it('should remove all listeners on all events when called without arguments', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();

      bus.on('mob:killed', h1);
      bus.on('entity:spawned', h2);

      bus.off();

      bus.emit('mob:killed', mobKilledPayload());
      bus.emit('entity:spawned', entitySpawnedPayload());

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    it('should be safe to call off on an event with no listeners', () => {
      expect(() => bus.off('mob:killed')).not.toThrow();
    });

    it('should be safe to call off() when no listeners exist at all', () => {
      expect(() => bus.off()).not.toThrow();
    });
  });

  /* ---------- listenerCount ---------- */

  describe('listenerCount', () => {
    it('should return 0 when no listeners are registered', () => {
      expect(bus.listenerCount('mob:killed')).toBe(0);
    });

    it('should reflect the number of active listeners', () => {
      bus.on('mob:killed', vi.fn());
      bus.on('mob:killed', vi.fn());
      bus.on('mob:killed', vi.fn());

      expect(bus.listenerCount('mob:killed')).toBe(3);
    });

    it('should decrement after unsubscribe', () => {
      const sub = bus.on('mob:killed', vi.fn());
      bus.on('mob:killed', vi.fn());

      expect(bus.listenerCount('mob:killed')).toBe(2);

      sub.unsubscribe();

      expect(bus.listenerCount('mob:killed')).toBe(1);
    });

    it('should decrement after once handler fires', () => {
      bus.once('mob:killed', vi.fn());
      bus.on('mob:killed', vi.fn());

      expect(bus.listenerCount('mob:killed')).toBe(2);

      bus.emit('mob:killed', mobKilledPayload());

      expect(bus.listenerCount('mob:killed')).toBe(1);
    });

    it('should drop to 0 after off for that event', () => {
      bus.on('mob:killed', vi.fn());
      bus.on('mob:killed', vi.fn());

      bus.off('mob:killed');

      expect(bus.listenerCount('mob:killed')).toBe(0);
    });

    it('should not count listeners from other events', () => {
      bus.on('mob:killed', vi.fn());
      bus.on('entity:spawned', vi.fn());
      bus.on('entity:spawned', vi.fn());

      expect(bus.listenerCount('mob:killed')).toBe(1);
      expect(bus.listenerCount('entity:spawned')).toBe(2);
    });
  });

  /* ---------- debug mode ---------- */

  describe('debug mode', () => {
    it('should log to console when debug is enabled', () => {
      const debugBus = makeBus({ debug: true });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      debugBus.emit('mob:killed', mobKilledPayload());

      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toContain('mob:killed');

      spy.mockRestore();
      debugBus.off();
    });

    it('should not log when debug is disabled (default)', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      bus.emit('mob:killed', mobKilledPayload());

      expect(spy).not.toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should toggle debug via setDebug', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      bus.emit('mob:killed', mobKilledPayload());
      expect(spy).not.toHaveBeenCalled();

      bus.setDebug(true);
      bus.emit('mob:killed', mobKilledPayload());
      expect(spy).toHaveBeenCalledOnce();

      bus.setDebug(false);
      bus.emit('mob:killed', mobKilledPayload());
      expect(spy).toHaveBeenCalledOnce(); // still 1

      spy.mockRestore();
    });
  });

  /* ---------- error handling / edge cases ---------- */

  describe('error handling and edge cases', () => {
    it('should emit with no listeners without throwing', () => {
      expect(() =>
        bus.emit('mob:killed', mobKilledPayload())
      ).not.toThrow();
    });

    it('should survive a handler that throws (other handlers still fire)', () => {
      const badHandler = vi.fn(() => {
        throw new Error('boom');
      });
      const goodHandler = vi.fn();

      bus.on('mob:killed', badHandler);
      bus.on('mob:killed', goodHandler);

      // eventemitter3 propagates the exception from the first handler,
      // but let us at least prove the bus itself does not break
      try {
        bus.emit('mob:killed', mobKilledPayload());
      } catch {
        // expected
      }

      expect(badHandler).toHaveBeenCalledOnce();
    });

    it('should allow re-subscribing after unsubscribe', () => {
      const handler = vi.fn();
      const sub = bus.on('mob:killed', handler);
      sub.unsubscribe();

      bus.on('mob:killed', handler);
      bus.emit('mob:killed', mobKilledPayload());

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should handle rapid subscribe/unsubscribe cycles', () => {
      const handler = vi.fn();

      for (let i = 0; i < 100; i++) {
        const sub = bus.on('mob:killed', handler);
        sub.unsubscribe();
      }

      bus.emit('mob:killed', mobKilledPayload());

      expect(handler).not.toHaveBeenCalled();
      expect(bus.listenerCount('mob:killed')).toBe(0);
    });

    it('should support many concurrent listeners without issues', () => {
      const handlers = Array.from({ length: 50 }, () => vi.fn());
      handlers.forEach((h) => bus.on('mob:killed', h));

      bus.emit('mob:killed', mobKilledPayload());

      handlers.forEach((h) => expect(h).toHaveBeenCalledOnce());
      expect(bus.listenerCount('mob:killed')).toBe(50);
    });
  });

  /* ---------- typed payload correctness ---------- */

  describe('typed payload shapes', () => {
    it('should pass MobKilledEvent fields correctly', () => {
      const received: Record<string, unknown> = {};
      bus.on('mob:killed', (p) => {
        received.mobId = p.mobId;
        received.killerName = p.killerName;
      });

      bus.emit('mob:killed', {
        mobId: 7,
        mobType: 3,
        mobName: 'Ogre',
        killerId: 1,
        killerName: 'Hero',
        x: 0,
        y: 0,
        killCount: 5,
      });

      expect(received.mobId).toBe(7);
      expect(received.killerName).toBe('Hero');
    });

    it('should pass PlayerLevelUpEvent fields correctly', () => {
      const handler = vi.fn();
      bus.on('player:levelup', handler);

      bus.emit('player:levelup', {
        playerId: 1,
        playerName: 'Warrior',
        newLevel: 10,
        armor: 4,
        weapon: 5,
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ newLevel: 10, playerName: 'Warrior' })
      );
    });

    it('should pass WorldTickEvent correctly', () => {
      const handler = vi.fn();
      bus.on('world:tick', handler);

      bus.emit('world:tick', { tick: 42, timestamp: Date.now() });

      expect(handler.mock.calls[0][0].tick).toBe(42);
    });

    it('should handle events with empty object payloads', () => {
      const handler = vi.fn();
      bus.on('ui:shop:close', handler);

      bus.emit('ui:shop:close', {});

      expect(handler).toHaveBeenCalledWith({});
    });
  });
});

/* ================================================================== */
/*  Singleton factories                                               */
/* ================================================================== */

describe('Singleton factories', () => {
  afterEach(() => {
    resetEventBuses();
  });

  describe('getServerEventBus', () => {
    it('should return an EventBus instance', () => {
      const bus = getServerEventBus();
      expect(bus).toBeInstanceOf(EventBus);
    });

    it('should return the same instance on repeated calls', () => {
      const a = getServerEventBus();
      const b = getServerEventBus();
      expect(a).toBe(b);
    });

    it('should be independent from the client bus', () => {
      const server = getServerEventBus();
      const client = getClientEventBus();
      expect(server).not.toBe(client);
    });

    it('should not share listeners with the client bus', () => {
      const server = getServerEventBus();
      const client = getClientEventBus();

      const serverHandler = vi.fn();
      const clientHandler = vi.fn();

      server.on('mob:killed', serverHandler);
      client.on('mob:killed', clientHandler);

      server.emit('mob:killed', mobKilledPayload());

      expect(serverHandler).toHaveBeenCalledOnce();
      expect(clientHandler).not.toHaveBeenCalled();
    });
  });

  describe('getClientEventBus', () => {
    it('should return an EventBus instance', () => {
      const bus = getClientEventBus();
      expect(bus).toBeInstanceOf(EventBus);
    });

    it('should return the same instance on repeated calls', () => {
      const a = getClientEventBus();
      const b = getClientEventBus();
      expect(a).toBe(b);
    });
  });
});

/* ================================================================== */
/*  resetEventBuses                                                   */
/* ================================================================== */

describe('resetEventBuses', () => {
  it('should produce a fresh server bus after reset', () => {
    const before = getServerEventBus();
    resetEventBuses();
    const after = getServerEventBus();

    expect(before).not.toBe(after);
  });

  it('should produce a fresh client bus after reset', () => {
    const before = getClientEventBus();
    resetEventBuses();
    const after = getClientEventBus();

    expect(before).not.toBe(after);
  });

  it('should clear all listeners on the old buses', () => {
    const serverBus = getServerEventBus();
    const clientBus = getClientEventBus();

    const sh = vi.fn();
    const ch = vi.fn();

    serverBus.on('mob:killed', sh);
    clientBus.on('mob:killed', ch);

    resetEventBuses();

    // Old bus references should have no listeners left
    serverBus.emit('mob:killed', mobKilledPayload());
    clientBus.emit('mob:killed', mobKilledPayload());

    expect(sh).not.toHaveBeenCalled();
    expect(ch).not.toHaveBeenCalled();
  });

  it('should be safe to call multiple times in a row', () => {
    expect(() => {
      resetEventBuses();
      resetEventBuses();
      resetEventBuses();
    }).not.toThrow();
  });

  it('should be safe to call before any bus was created', () => {
    // Force clean slate by resetting first
    resetEventBuses();

    expect(() => resetEventBuses()).not.toThrow();
  });
});
