import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
}));

const mockSetAttribute = vi.fn();
const mockEnd = vi.fn();
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: () => ({
      startSpan: () => ({
        setAttribute: mockSetAttribute,
        setStatus: vi.fn(),
        end: mockEnd,
      }),
    }),
  },
}));

import { GameLoop } from '../world/game-loop';

describe('GameLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ─── Construction ──────────────────────────────────────────────

  describe('construction', () => {
    it('defaults to 50 UPS', () => {
      const loop = new GameLoop();
      expect(loop.getUpdatesPerSecond()).toBe(50);
    });

    it('accepts a custom UPS via constructor', () => {
      const loop = new GameLoop(30);
      expect(loop.getUpdatesPerSecond()).toBe(30);
    });

    it('sets regenCount to ups * 2 (fires after ~2 seconds)', () => {
      // UPS=10 => regenCount=20 => fires on tick 21
      const loop = new GameLoop(10);
      const regen = vi.fn();
      loop.onRegen(regen);
      loop.start();

      // 20 ticks = 2000ms => regen should NOT have fired yet
      vi.advanceTimersByTime(2000);
      expect(regen).not.toHaveBeenCalled();

      // Tick 21 (100ms more) => regen fires
      vi.advanceTimersByTime(100);
      expect(regen).toHaveBeenCalledTimes(1);

      loop.stop();
    });

    it('sets thoughtCount to ups * 15 (fires after ~15 seconds)', () => {
      // Use UPS=2 => thoughtCount=30 => fires on tick 31
      const loop = new GameLoop(2);
      const thought = vi.fn();
      loop.onThought(thought);
      loop.start();

      // 30 ticks = 15000ms => thought NOT fired
      vi.advanceTimersByTime(15000);
      expect(thought).not.toHaveBeenCalled();

      // Tick 31 => 500ms more
      vi.advanceTimersByTime(500);
      expect(thought).toHaveBeenCalledTimes(1);

      loop.stop();
    });

    it('sets aggroCount to floor(ups / 2) (fires after ~0.5 seconds)', () => {
      // UPS=10 => aggroCount=5 => fires on tick 6
      const loop = new GameLoop(10);
      const aggro = vi.fn();
      loop.onAggro(aggro);
      loop.start();

      // 5 ticks = 500ms => aggro NOT fired
      vi.advanceTimersByTime(500);
      expect(aggro).not.toHaveBeenCalled();

      // Tick 6 => 100ms more
      vi.advanceTimersByTime(100);
      expect(aggro).toHaveBeenCalledTimes(1);

      loop.stop();
    });
  });

  // ─── setUpdatesPerSecond ───────────────────────────────────────

  describe('setUpdatesPerSecond', () => {
    it('recalculates all counters', () => {
      const loop = new GameLoop(10);
      loop.setUpdatesPerSecond(20);
      expect(loop.getUpdatesPerSecond()).toBe(20);

      // Verify by checking that regen now fires after ups*2+1 = 41 ticks
      const regen = vi.fn();
      loop.onRegen(regen);
      loop.start();

      // 40 ticks at 20 UPS = 2000ms
      vi.advanceTimersByTime(2000);
      expect(regen).not.toHaveBeenCalled();

      // Tick 41 = 50ms more
      vi.advanceTimersByTime(50);
      expect(regen).toHaveBeenCalledTimes(1);

      loop.stop();
    });

    it('getUpdatesPerSecond returns the updated value', () => {
      const loop = new GameLoop(10);
      loop.setUpdatesPerSecond(60);
      expect(loop.getUpdatesPerSecond()).toBe(60);
    });
  });

  // ─── Dependency Injection ─────────────────────────────────────

  describe('dependency injection', () => {
    it('setSpatialContext stores reference (tick calls processGroups)', () => {
      const loop = new GameLoop(10);
      const spatial = { processGroups: vi.fn() };
      loop.setSpatialContext(spatial);
      loop.start();

      vi.advanceTimersByTime(100); // 1 tick
      expect(spatial.processGroups).toHaveBeenCalled();

      loop.stop();
    });

    it('setBroadcasterContext stores reference (tick calls processQueues)', () => {
      const loop = new GameLoop(10);
      const broadcaster = { processQueues: vi.fn() };
      loop.setBroadcasterContext(broadcaster);
      loop.start();

      vi.advanceTimersByTime(100); // 1 tick
      expect(broadcaster.processQueues).toHaveBeenCalled();

      loop.stop();
    });
  });

  // ─── Callbacks ─────────────────────────────────────────────────

  describe('callbacks', () => {
    it('onRegen sets the regen callback', () => {
      const loop = new GameLoop(10);
      const regen = vi.fn();
      loop.onRegen(regen);
      loop.start();

      // Advance enough for regen to fire (21 ticks)
      vi.advanceTimersByTime(2100);
      expect(regen).toHaveBeenCalled();

      loop.stop();
    });

    it('onThought sets the thought callback', () => {
      const loop = new GameLoop(2);
      const thought = vi.fn();
      loop.onThought(thought);
      loop.start();

      // UPS=2 => thoughtCount=30 => fires on tick 31 => 15500ms
      vi.advanceTimersByTime(15500);
      expect(thought).toHaveBeenCalled();

      loop.stop();
    });

    it('onAggro sets the aggro callback', () => {
      const loop = new GameLoop(10);
      const aggro = vi.fn();
      loop.onAggro(aggro);
      loop.start();

      // aggroCount=5 => fires on tick 6 => 600ms
      vi.advanceTimersByTime(600);
      expect(aggro).toHaveBeenCalled();

      loop.stop();
    });
  });

  // ─── start / stop ─────────────────────────────────────────────

  describe('start / stop', () => {
    it('start creates interval and isRunning returns true', () => {
      const loop = new GameLoop(10);
      expect(loop.isRunning()).toBe(false);

      loop.start();
      expect(loop.isRunning()).toBe(true);

      loop.stop();
    });

    it('calling start twice is a no-op (does not create a second interval)', () => {
      const loop = new GameLoop(10);
      const spatial = { processGroups: vi.fn() };
      loop.setSpatialContext(spatial);

      loop.start();
      loop.start(); // should warn and return

      // Advance 1 tick
      vi.advanceTimersByTime(100);
      // Only one interval should be ticking, so processGroups called once per tick
      expect(spatial.processGroups).toHaveBeenCalledTimes(1);

      loop.stop();
    });

    it('stop clears interval and isRunning returns false', () => {
      const loop = new GameLoop(10);
      loop.start();
      expect(loop.isRunning()).toBe(true);

      loop.stop();
      expect(loop.isRunning()).toBe(false);
    });

    it('stop when not running is safe (no error)', () => {
      const loop = new GameLoop(10);
      expect(() => loop.stop()).not.toThrow();
    });
  });

  // ─── Tick behavior ─────────────────────────────────────────────

  describe('tick behavior', () => {
    it('each tick calls spatialContext.processGroups()', () => {
      const loop = new GameLoop(10);
      const spatial = { processGroups: vi.fn() };
      loop.setSpatialContext(spatial);
      loop.start();

      vi.advanceTimersByTime(500); // 5 ticks
      expect(spatial.processGroups).toHaveBeenCalledTimes(5);

      loop.stop();
    });

    it('each tick calls broadcasterContext.processQueues()', () => {
      const loop = new GameLoop(10);
      const broadcaster = { processQueues: vi.fn() };
      loop.setBroadcasterContext(broadcaster);
      loop.start();

      vi.advanceTimersByTime(500); // 5 ticks
      expect(broadcaster.processQueues).toHaveBeenCalledTimes(5);

      loop.stop();
    });

    it('regen callback fires after ups*2+1 ticks', () => {
      // UPS=10 => regenCount=20 => fires on tick 21
      const loop = new GameLoop(10);
      const regen = vi.fn();
      loop.onRegen(regen);
      loop.start();

      // 20 ticks
      vi.advanceTimersByTime(2000);
      expect(regen).toHaveBeenCalledTimes(0);

      // 21st tick
      vi.advanceTimersByTime(100);
      expect(regen).toHaveBeenCalledTimes(1);

      loop.stop();
    });

    it('aggro callback fires after floor(ups/2)+1 ticks', () => {
      // UPS=10 => aggroCount=5 => fires on tick 6
      const loop = new GameLoop(10);
      const aggro = vi.fn();
      loop.onAggro(aggro);
      loop.start();

      // 5 ticks
      vi.advanceTimersByTime(500);
      expect(aggro).toHaveBeenCalledTimes(0);

      // 6th tick
      vi.advanceTimersByTime(100);
      expect(aggro).toHaveBeenCalledTimes(1);

      loop.stop();
    });

    it('thought callback fires after ups*15+1 ticks', () => {
      // UPS=2 => thoughtCount=30 => fires on tick 31
      const loop = new GameLoop(2);
      const thought = vi.fn();
      loop.onThought(thought);
      loop.start();

      // 30 ticks = 15000ms
      vi.advanceTimersByTime(15000);
      expect(thought).toHaveBeenCalledTimes(0);

      // 31st tick = 500ms more
      vi.advanceTimersByTime(500);
      expect(thought).toHaveBeenCalledTimes(1);

      loop.stop();
    });

    it('regen fires repeatedly (second cycle)', () => {
      // UPS=10 => regenCount=20 => fires on ticks 21, 42, ...
      const loop = new GameLoop(10);
      const regen = vi.fn();
      loop.onRegen(regen);
      loop.start();

      // First fire at tick 21 = 2100ms
      vi.advanceTimersByTime(2100);
      expect(regen).toHaveBeenCalledTimes(1);

      // Second fire at tick 42 = another 2100ms
      vi.advanceTimersByTime(2100);
      expect(regen).toHaveBeenCalledTimes(2);

      loop.stop();
    });

    it('aggro fires repeatedly (second cycle)', () => {
      // UPS=10 => aggroCount=5 => fires on ticks 6, 12, ...
      const loop = new GameLoop(10);
      const aggro = vi.fn();
      loop.onAggro(aggro);
      loop.start();

      // First fire at tick 6 = 600ms
      vi.advanceTimersByTime(600);
      expect(aggro).toHaveBeenCalledTimes(1);

      // Second fire at tick 12 = another 600ms
      vi.advanceTimersByTime(600);
      expect(aggro).toHaveBeenCalledTimes(2);

      loop.stop();
    });
  });

  // ─── Error isolation ───────────────────────────────────────────

  describe('error isolation', () => {
    it('if processGroups throws, processQueues still runs', () => {
      const loop = new GameLoop(10);
      const spatial = { processGroups: vi.fn(() => { throw new Error('spatial boom'); }) };
      const broadcaster = { processQueues: vi.fn() };
      loop.setSpatialContext(spatial);
      loop.setBroadcasterContext(broadcaster);
      loop.start();

      vi.advanceTimersByTime(100); // 1 tick
      expect(spatial.processGroups).toHaveBeenCalled();
      expect(broadcaster.processQueues).toHaveBeenCalled();

      loop.stop();
    });

    it('if processQueues throws, callbacks still run', () => {
      // UPS=10 => aggroCount=5 => fires on tick 6
      const loop = new GameLoop(10);
      const broadcaster = { processQueues: vi.fn(() => { throw new Error('broadcaster boom'); }) };
      const aggro = vi.fn();
      loop.setBroadcasterContext(broadcaster);
      loop.onAggro(aggro);
      loop.start();

      // Advance past aggro threshold
      vi.advanceTimersByTime(600); // 6 ticks
      expect(broadcaster.processQueues).toHaveBeenCalled();
      expect(aggro).toHaveBeenCalledTimes(1);

      loop.stop();
    });

    it('if regen callback throws, loop continues (no crash)', () => {
      const loop = new GameLoop(10);
      const regen = vi.fn(() => { throw new Error('regen boom'); });
      const spatial = { processGroups: vi.fn() };
      loop.onRegen(regen);
      loop.setSpatialContext(spatial);
      loop.start();

      // Trigger regen (tick 21)
      vi.advanceTimersByTime(2100);
      expect(regen).toHaveBeenCalledTimes(1);

      // Loop still ticking after the throw
      const countBefore = spatial.processGroups.mock.calls.length;
      vi.advanceTimersByTime(100);
      expect(spatial.processGroups.mock.calls.length).toBe(countBefore + 1);

      loop.stop();
    });

    it('if aggro callback throws, loop continues (no crash)', () => {
      const loop = new GameLoop(10);
      const aggro = vi.fn(() => { throw new Error('aggro boom'); });
      const spatial = { processGroups: vi.fn() };
      loop.onAggro(aggro);
      loop.setSpatialContext(spatial);
      loop.start();

      // Trigger aggro (tick 6)
      vi.advanceTimersByTime(600);
      expect(aggro).toHaveBeenCalledTimes(1);

      // Loop still ticking
      const countBefore = spatial.processGroups.mock.calls.length;
      vi.advanceTimersByTime(100);
      expect(spatial.processGroups.mock.calls.length).toBe(countBefore + 1);

      loop.stop();
    });
  });

  // ─── No callbacks / contexts set ──────────────────────────────

  describe('no callbacks or contexts set', () => {
    it('tick completes without errors when no callbacks are registered', () => {
      const loop = new GameLoop(10);
      const spatial = { processGroups: vi.fn() };
      loop.setSpatialContext(spatial);
      loop.start();

      // Advance past all thresholds without any callbacks
      expect(() => vi.advanceTimersByTime(20000)).not.toThrow();
      expect(spatial.processGroups).toHaveBeenCalled();

      loop.stop();
    });

    it('tick completes without errors when no contexts are set', () => {
      const loop = new GameLoop(10);
      loop.start();

      // No spatial, no broadcaster, no callbacks
      expect(() => vi.advanceTimersByTime(20000)).not.toThrow();

      loop.stop();
    });
  });
});
