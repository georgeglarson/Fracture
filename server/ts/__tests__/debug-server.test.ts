/**
 * Tests for debug-server module
 * Covers: pushDebugLog (ring buffer), startDebugServer (WSS lifecycle),
 *         buildSnapshot (via connection), handleCommand (via WebSocket messages)
 *         for all 17+ commands including error paths.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted mock references (needed because vi.mock is hoisted) ─

const {
  mockSetDebugLogHook,
  mockClearMobAggro,
  mockClearPlayerAggro,
  mockGetPlayersHated,
  mockGetPlayerAggroCount,
  mockGetMobAggroCount,
  mockGetVeniceClient,
  wssState,
} = vi.hoisted(() => ({
  mockSetDebugLogHook: vi.fn(),
  mockClearMobAggro: vi.fn(),
  mockClearPlayerAggro: vi.fn(),
  mockGetPlayersHated: vi.fn().mockReturnValue([]),
  mockGetPlayerAggroCount: vi.fn().mockReturnValue(0),
  mockGetMobAggroCount: vi.fn().mockReturnValue(0),
  mockGetVeniceClient: vi.fn().mockReturnValue(null),
  wssState: {
    clients: new Set() as Set<any>,
    handlers: {} as Record<string, Function>,
    instance: null as any,
  },
}));

// ─── Mocks ────────────────────────────────────────────────────

vi.mock('../utils/logger.js', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }),
  setDebugLogHook: mockSetDebugLogHook,
}));

vi.mock('../combat/combat-tracker', () => ({
  getCombatTracker: () => ({
    getPlayersHated: mockGetPlayersHated,
    getPlayerAggroCount: mockGetPlayerAggroCount,
    getMobAggroCount: mockGetMobAggroCount,
    clearMobAggro: mockClearMobAggro,
    clearPlayerAggro: mockClearPlayerAggro,
  }),
}));

vi.mock('../../../shared/ts/gametypes', () => ({
  Types: {
    getKindAsString: vi.fn((kind: number) => {
      const map: Record<number, string> = { 1: 'rat', 2: 'skeleton', 3: 'ogre' };
      return map[kind] || undefined;
    }),
  },
}));

vi.mock('../ai', () => ({
  getVeniceClient: (...args: any[]) => mockGetVeniceClient(...args),
}));

vi.mock('ws', () => {
  return {
    WebSocketServer: vi.fn().mockImplementation(function (this: any) {
      wssState.clients = new Set();
      wssState.handlers = {};
      this.on = vi.fn((event: string, handler: Function) => { wssState.handlers[event] = handler; });
      this.clients = wssState.clients;
      wssState.instance = this;
    }),
    WebSocket: { OPEN: 1 },
  };
});

// ─── WebSocket Mock Helpers ──────────────────────────────────

interface MockWsClient {
  send: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  readyState: number;
  _handlers: Record<string, Function>;
}

function createMockWsClient(): MockWsClient {
  const handlers: Record<string, Function> = {};
  return {
    send: vi.fn(),
    on: vi.fn((event: string, handler: Function) => { handlers[event] = handler; }),
    readyState: 1, // WebSocket.OPEN
    _handlers: handlers,
  };
}

// ─── Import after mocks ──────────────────────────────────────

import { pushDebugLog, startDebugServer } from '../debug/debug-server';
import type { DebugLogEntry, DebugSnapshot } from '../debug/debug-server';

// ─── Helpers ─────────────────────────────────────────────────

function makeEntry(overrides: Partial<DebugLogEntry> = {}): DebugLogEntry {
  return {
    time: Date.now(),
    level: 'info',
    module: 'Test',
    msg: 'test log',
    data: {},
    ...overrides,
  };
}

function createMockWorld(opts: {
  players?: any[];
  mobs?: any[];
  entities?: Record<number, any>;
  gameLoop?: any;
  storageService?: any;
} = {}) {
  const players = opts.players || [];
  const mobs = opts.mobs || [];
  const entities = opts.entities || {};
  return {
    forEachPlayer: vi.fn((cb: Function) => players.forEach(cb)),
    forEachMob: vi.fn((cb: Function) => mobs.forEach(cb)),
    getEntityById: vi.fn((id: number) => entities[id] || null),
    despawn: vi.fn(),
    entities,
    ups: 50,
    spatialManager: { groups: {} },
    zoneManager: { getZoneAt: vi.fn().mockReturnValue({ id: 'village' }) },
    gameLoop: opts.gameLoop || null,
    getStorageService: vi.fn().mockReturnValue(opts.storageService || null),
  };
}

/** Start server, connect a mock client, return helpers */
function setupServerAndClient(world: any) {
  const wss = startDebugServer(world, 9999);

  // Extract the connection handler registered on the WSS
  const connectionCall = wssState.instance.on.mock.calls.find(
    (c: any[]) => c[0] === 'connection',
  );
  expect(connectionCall).toBeDefined();
  const connectionHandler = connectionCall[1] as Function;

  // Create a mock WebSocket client and trigger 'connection'
  const client = createMockWsClient();
  wssState.clients.add(client);
  connectionHandler(client);

  return { wss, client, connectionHandler };
}

/** Send a command through the mock client and return the parsed result */
async function sendCommand(client: MockWsClient, command: string) {
  const messageHandler = client._handlers['message'];
  expect(messageHandler).toBeDefined();
  await messageHandler(JSON.stringify({ type: 'command', command }));
  const lastSend = client.send.mock.calls[client.send.mock.calls.length - 1][0];
  return JSON.parse(lastSend);
}

// ─── Tests ───────────────────────────────────────────────────

describe('debug-server', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetVeniceClient.mockReturnValue(null);
    mockGetPlayersHated.mockReturnValue([]);
    mockGetPlayerAggroCount.mockReturnValue(0);
    mockGetMobAggroCount.mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── pushDebugLog ──────────────────────────────────────────

  describe('pushDebugLog', () => {
    it('should broadcast log entry to connected WebSocket clients', () => {
      const world = createMockWorld();
      const { client } = setupServerAndClient(world);
      client.send.mockClear();

      const entry = makeEntry({ msg: 'hello world' });
      pushDebugLog(entry);

      // The last send should be a 'log' message
      const sent = client.send.mock.calls.find((c: any[]) => {
        const parsed = JSON.parse(c[0]);
        return parsed.type === 'log';
      });
      expect(sent).toBeDefined();
      const parsed = JSON.parse(sent![0]);
      expect(parsed.type).toBe('log');
      expect(parsed.data.msg).toBe('hello world');
    });

    it('should not broadcast if no WSS is active (pre-start)', async () => {
      // pushDebugLog before startDebugServer is called should not throw.
      // Since we already called startDebugServer above, this tests
      // the broadcast path with no OPEN clients.
      wssState.clients.clear();
      expect(() => pushDebugLog(makeEntry())).not.toThrow();
    });

    it('should include recent logs in snapshot after push', () => {
      const world = createMockWorld();
      const { client } = setupServerAndClient(world);

      // Push a log entry
      pushDebugLog(makeEntry({ msg: 'snapshot-test-log' }));

      // Trigger snapshot interval
      client.send.mockClear();
      vi.advanceTimersByTime(500);

      // Find the snapshot send
      const snapshotSend = client.send.mock.calls.find((c: any[]) => {
        const parsed = JSON.parse(c[0]);
        return parsed.type === 'snapshot';
      });
      expect(snapshotSend).toBeDefined();
      const snapshot: DebugSnapshot = JSON.parse(snapshotSend![0]).data;
      const match = snapshot.recentLogs.find(l => l.msg === 'snapshot-test-log');
      expect(match).toBeDefined();
    });
  });

  // ─── startDebugServer ──────────────────────────────────────

  describe('startDebugServer', () => {
    it('should create a WebSocketServer and return it', () => {
      const world = createMockWorld();
      const wss = startDebugServer(world, 9999);
      expect(wss).toBeDefined();
      expect(wss.on).toBeDefined();
    });

    it('should send initial snapshot on connection', () => {
      const world = createMockWorld({
        players: [{ id: 1, name: 'Alice', x: 10, y: 20, hitPoints: 80, maxHitPoints: 100, level: 5, group: 'g1', isAI: false, isDead: false, target: null }],
        mobs: [{ id: 100, kind: 1, x: 30, y: 40, hitPoints: 50, maxHitPoints: 50, level: 3, isDead: false, target: null, group: 'g2' }],
      });

      const { client } = setupServerAndClient(world);

      // First send should be the initial snapshot
      expect(client.send).toHaveBeenCalled();
      const firstMsg = JSON.parse(client.send.mock.calls[0][0]);
      expect(firstMsg.type).toBe('snapshot');
      expect(firstMsg.data.players).toHaveLength(1);
      expect(firstMsg.data.players[0].name).toBe('Alice');
      expect(firstMsg.data.mobs).toHaveLength(1);
      expect(firstMsg.data.mobs[0].kind).toBe('rat');
    });

    it('should broadcast snapshots every 500ms', () => {
      const world = createMockWorld();
      const { client } = setupServerAndClient(world);
      client.send.mockClear();

      vi.advanceTimersByTime(500);
      expect(client.send).toHaveBeenCalled();
      const msg = JSON.parse(client.send.mock.calls[0][0]);
      expect(msg.type).toBe('snapshot');
    });

    it('should skip broadcast when no clients are connected', () => {
      const world = createMockWorld();
      setupServerAndClient(world);
      wssState.clients.clear();

      // Advancing should not throw even though forEachPlayer/Mob are available
      expect(() => vi.advanceTimersByTime(500)).not.toThrow();
    });

    it('should call setDebugLogHook', () => {
      const world = createMockWorld();
      startDebugServer(world, 9999);
      expect(mockSetDebugLogHook).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should build snapshot with aggro links', () => {
      const world = createMockWorld({
        mobs: [{ id: 100, kind: 1, x: 10, y: 10, hitPoints: 30, maxHitPoints: 30, level: 2, isDead: false, target: null, group: 'g1' }],
        entities: { 5: { name: 'Bob' } },
      });
      mockGetPlayersHated.mockReturnValue([{ entityId: 5, hate: 42 }]);

      const { client } = setupServerAndClient(world);
      const snapshot: DebugSnapshot = JSON.parse(client.send.mock.calls[0][0]).data;
      expect(snapshot.aggro).toHaveLength(1);
      expect(snapshot.aggro[0].mobId).toBe(100);
      expect(snapshot.aggro[0].playerName).toBe('Bob');
      expect(snapshot.aggro[0].hate).toBe(42);
    });

    it('should build snapshot with group summary', () => {
      const world = createMockWorld();
      world.spatialManager.groups = {
        'g1': { entities: { 1: { name: 'Alice' }, 2: { name: 'Bob' }, 3: {} } },
        'g2': { entities: { 4: {} } },
        'g3': { entities: {} },
      };

      const { client } = setupServerAndClient(world);
      const snapshot: DebugSnapshot = JSON.parse(client.send.mock.calls[0][0]).data;
      expect(snapshot.groups['g1']).toEqual({ players: 2, mobs: 1 });
      expect(snapshot.groups['g2']).toEqual({ players: 0, mobs: 1 });
      // g3 is empty, should not appear
      expect(snapshot.groups['g3']).toBeUndefined();
    });

    it('should include venice metrics when client is available', () => {
      mockGetVeniceClient.mockReturnValue({
        getMetrics: () => ({
          totalCalls: 100,
          successCount: 90,
          failureCount: 10,
          avgLatencyMs: 200,
          circuitState: 'closed',
          lastError: null,
          lastErrorCategory: null,
        }),
      });
      const world = createMockWorld();
      const { client } = setupServerAndClient(world);
      const snapshot: DebugSnapshot = JSON.parse(client.send.mock.calls[0][0]).data;
      expect(snapshot.venice).not.toBeNull();
      expect(snapshot.venice!.totalCalls).toBe(100);
      expect(snapshot.venice!.successRate).toBe(90);
    });

    it('should set venice to null when client is not available', () => {
      mockGetVeniceClient.mockReturnValue(null);
      const world = createMockWorld();
      const { client } = setupServerAndClient(world);
      const snapshot: DebugSnapshot = JSON.parse(client.send.mock.calls[0][0]).data;
      expect(snapshot.venice).toBeNull();
    });

    it('should include stats in snapshot', () => {
      const world = createMockWorld({
        players: [
          { id: 1, name: 'Alice', x: 0, y: 0, hitPoints: 100, maxHitPoints: 100, level: 1, isAI: false, isDead: false, group: 'g1', target: null },
          { id: 2, name: 'BotBob', x: 0, y: 0, hitPoints: 50, maxHitPoints: 50, level: 1, isAI: true, isDead: false, group: 'g1', target: null },
        ],
      });
      world.entities = { 1: {}, 2: {}, 100: {} };

      const { client } = setupServerAndClient(world);
      const snapshot: DebugSnapshot = JSON.parse(client.send.mock.calls[0][0]).data;
      expect(snapshot.stats.playerCount).toBe(2);
      expect(snapshot.stats.humanCount).toBe(1);
      expect(snapshot.stats.aiCount).toBe(1);
      expect(snapshot.stats.entityCount).toBe(3);
      expect(snapshot.stats.ups).toBe(50);
    });
  });

  // ─── Commands (via WebSocket message handler) ──────────────

  describe('commands', () => {
    let world: ReturnType<typeof createMockWorld>;
    let client: MockWsClient;

    beforeEach(() => {
      world = createMockWorld();
      ({ client } = setupServerAndClient(world));
      // Clear the initial snapshot send
      client.send.mockClear();
    });

    // ── help ──

    describe('help', () => {
      it('should return command list', async () => {
        const res = await sendCommand(client, 'help');
        expect(res.type).toBe('result');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('inspect');
        expect(res.data.msg).toContain('kill');
        expect(res.data.msg).toContain('venice');
      });
    });

    // ── unknown ──

    describe('unknown command', () => {
      it('should return error for unknown command', async () => {
        const res = await sendCommand(client, 'foobar');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Unknown command');
        expect(res.data.msg).toContain('foobar');
      });
    });

    // ── inspect ──

    describe('inspect', () => {
      it('should return entity details', async () => {
        const entity = {
          id: 42, kind: 1, type: 'mob', x: 10, y: 20, group: 'g1',
          hitPoints: 30, maxHitPoints: 50, name: 'TestRat', isAI: false,
          target: 5, characterId: 'char-123', isDead: false, level: 3,
        };
        world.getEntityById.mockReturnValue(entity);

        const res = await sendCommand(client, 'inspect 42');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('ID: 42');
        expect(res.data.msg).toContain('rat');
        expect(res.data.msg).toContain('HP: 30/50');
        expect(res.data.msg).toContain('Target: #5');
        expect(res.data.msg).toContain('CharID: char-123');
        expect(res.data.msg).toContain('Name: TestRat');
      });

      it('should show DEAD status when entity is dead', async () => {
        world.getEntityById.mockReturnValue({
          id: 1, kind: 1, type: 'mob', x: 0, y: 0, hitPoints: 0, maxHitPoints: 50, isDead: true,
        });

        const res = await sendCommand(client, 'inspect 1');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('STATUS: DEAD');
      });

      it('should show [AI] tag for AI entities', async () => {
        world.getEntityById.mockReturnValue({
          id: 1, kind: 1, type: 'player', x: 0, y: 0, hitPoints: 100, maxHitPoints: 100,
          name: 'AIBot', isAI: true, level: 5,
        });

        const res = await sendCommand(client, 'inspect 1');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('[AI]');
      });

      it('should show aggro count when present', async () => {
        world.getEntityById.mockReturnValue({
          id: 1, kind: 1, type: 'mob', x: 0, y: 0, hitPoints: 50, maxHitPoints: 50,
        });
        mockGetPlayerAggroCount.mockReturnValue(3);

        const res = await sendCommand(client, 'inspect 1');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Aggro links: 3');
      });

      it('should return error for NaN id', async () => {
        const res = await sendCommand(client, 'inspect abc');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error for entity not found', async () => {
        world.getEntityById.mockReturnValue(null);
        const res = await sendCommand(client, 'inspect 999');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not found');
      });
    });

    // ── dump ──

    describe('dump', () => {
      it('should return prototype chain info', async () => {
        class Base { }
        class Middle extends Base { }
        class Entity extends Middle {
          id = 10;
          level = 5;
          progression = { level: 5, xp: 200 };
        }
        const entity = new Entity();
        world.getEntityById.mockReturnValue(entity);

        const res = await sendCommand(client, 'dump 10');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Constructor: Entity');
        expect(res.data.msg).toContain('entity.level = 5');
        expect(res.data.msg).toContain('typeof entity.level = number');
      });

      it('should return error for NaN id', async () => {
        const res = await sendCommand(client, 'dump abc');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error for entity not found', async () => {
        world.getEntityById.mockReturnValue(null);
        const res = await sendCommand(client, 'dump 999');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not found');
      });
    });

    // ── find ──

    describe('find', () => {
      it('should find players by name (case-insensitive)', async () => {
        const players = [
          { name: 'Alice', id: 1, x: 10, y: 20, level: 5 },
          { name: 'Bob', id: 2, x: 30, y: 40, level: 10 },
        ];
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));

        const res = await sendCommand(client, 'find alice');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Alice');
        expect(res.data.msg).not.toContain('Bob');
      });

      it('should find mobs by kind name', async () => {
        const mobs = [
          { kind: 1, id: 100, x: 5, y: 5, hitPoints: 20, maxHitPoints: 20 },
          { kind: 2, id: 101, x: 6, y: 6, hitPoints: 30, maxHitPoints: 30 },
        ];
        world.forEachMob.mockImplementation((cb: Function) => mobs.forEach(cb));

        const res = await sendCommand(client, 'find rat');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('rat');
        expect(res.data.msg).toContain('#100');
        expect(res.data.msg).not.toContain('#101');
      });

      it('should limit results to 20 and show overflow', async () => {
        const players = Array.from({ length: 25 }, (_, i) => ({
          name: `Player${i}`, id: i, x: 0, y: 0, level: 1,
        }));
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));

        const res = await sendCommand(client, 'find player');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('5 more');
      });

      it('should return error when no matches', async () => {
        const res = await sendCommand(client, 'find nonexistent');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('No entities matching');
      });

      it('should return error for missing query', async () => {
        const res = await sendCommand(client, 'find');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });
    });

    // ── kill ──

    describe('kill', () => {
      it('should kill a mob', async () => {
        const mob = {
          id: 100, kind: 1, hitPoints: 30, maxHitPoints: 30,
          receiveDamage: vi.fn(), destroy: vi.fn(),
        };
        world.getEntityById.mockReturnValue(mob);

        const res = await sendCommand(client, 'kill 100');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Killed rat #100');
        expect(mob.receiveDamage).toHaveBeenCalledWith(30, 0);
        expect(mob.destroy).toHaveBeenCalled();
        expect(world.despawn).toHaveBeenCalledWith(mob);
      });

      it('should return error if entity has no destroy method', async () => {
        world.getEntityById.mockReturnValue({ id: 1, kind: 1 });
        const res = await sendCommand(client, 'kill 1');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not a mob');
      });

      it('should return error for NaN id', async () => {
        const res = await sendCommand(client, 'kill abc');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error for entity not found', async () => {
        world.getEntityById.mockReturnValue(null);
        const res = await sendCommand(client, 'kill 999');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not found');
      });
    });

    // ── heal ──

    describe('heal', () => {
      it('should restore full HP and clear dead status', async () => {
        const entity = { id: 5, hitPoints: 10, maxHitPoints: 100, isDead: true };
        world.getEntityById.mockReturnValue(entity);

        const res = await sendCommand(client, 'heal 5');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Healed #5 to 100 HP');
        expect(entity.hitPoints).toBe(100);
        expect(entity.isDead).toBe(false);
      });

      it('should return error if entity has no HP', async () => {
        world.getEntityById.mockReturnValue({ id: 5 });
        const res = await sendCommand(client, 'heal 5');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('has no HP');
      });

      it('should return error for NaN id', async () => {
        const res = await sendCommand(client, 'heal abc');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error for entity not found', async () => {
        world.getEntityById.mockReturnValue(null);
        const res = await sendCommand(client, 'heal 999');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not found');
      });
    });

    // ── aggro clear ──

    describe('aggro clear', () => {
      it('should clear mob and player aggro', async () => {
        const res = await sendCommand(client, 'aggro clear 42');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Cleared all aggro for #42');
        expect(mockClearMobAggro).toHaveBeenCalledWith(42);
        expect(mockClearPlayerAggro).toHaveBeenCalledWith(42);
      });

      it('should return error on bad syntax', async () => {
        const res = await sendCommand(client, 'aggro');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error if id is NaN', async () => {
        const res = await sendCommand(client, 'aggro clear abc');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });
    });

    // ── save ──

    describe('save', () => {
      it('should save a specific player by name', async () => {
        const mockSave = vi.fn();
        const players = [
          { name: 'Alice', characterId: 'c1', saveToStorage: mockSave },
          { name: 'Bob', characterId: 'c2', saveToStorage: vi.fn() },
        ];
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));
        const storage = {};
        world.getStorageService.mockReturnValue(storage);

        const res = await sendCommand(client, 'save alice');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Saved 1 player');
        expect(mockSave).toHaveBeenCalledWith(storage);
      });

      it('should save all players with "all"', async () => {
        const save1 = vi.fn();
        const save2 = vi.fn();
        const players = [
          { name: 'Alice', characterId: 'c1', saveToStorage: save1 },
          { name: 'Bob', characterId: 'c2', saveToStorage: save2 },
        ];
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));
        world.getStorageService.mockReturnValue({});

        const res = await sendCommand(client, 'save all');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Saved 2 players');
        expect(save1).toHaveBeenCalled();
        expect(save2).toHaveBeenCalled();
      });

      it('should save all when no target given', async () => {
        const save1 = vi.fn();
        const players = [{ name: 'Alice', characterId: 'c1', saveToStorage: save1 }];
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));
        world.getStorageService.mockReturnValue({});

        const res = await sendCommand(client, 'save');
        expect(res.data.ok).toBe(true);
        expect(save1).toHaveBeenCalled();
      });

      it('should return error if storage service unavailable', async () => {
        world.getStorageService.mockReturnValue(null);
        const res = await sendCommand(client, 'save all');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Storage service unavailable');
      });

      it('should return error if player not found', async () => {
        world.getStorageService.mockReturnValue({});
        const res = await sendCommand(client, 'save nonexistent');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not found');
      });
    });

    // ── kick ──

    describe('kick', () => {
      it('should disconnect a player by name', async () => {
        const closeFn = vi.fn();
        const players = [
          { name: 'Alice', connection: { close: closeFn } },
        ];
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));

        const res = await sendCommand(client, 'kick Alice');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Kicked alice');
        expect(closeFn).toHaveBeenCalledWith('Kicked via debug TUI');
      });

      it('should be case-insensitive', async () => {
        const closeFn = vi.fn();
        const players = [{ name: 'Alice', connection: { close: closeFn } }];
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));

        const res = await sendCommand(client, 'kick ALICE');
        expect(res.data.ok).toBe(true);
        expect(closeFn).toHaveBeenCalled();
      });

      it('should return error for missing name', async () => {
        const res = await sendCommand(client, 'kick');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error if player not found', async () => {
        const res = await sendCommand(client, 'kick nobody');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not found');
      });
    });

    // ── xp ──

    describe('xp', () => {
      it('should grant XP to a player', async () => {
        const grantXP = vi.fn();
        const players = [{ name: 'Alice', grantXP }];
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));

        const res = await sendCommand(client, 'xp alice 500');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Granted 500 XP to alice');
        expect(grantXP).toHaveBeenCalledWith(500);
      });

      it('should return error for missing arguments', async () => {
        const res = await sendCommand(client, 'xp');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error for missing amount', async () => {
        const res = await sendCommand(client, 'xp alice');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error if player not found', async () => {
        const res = await sendCommand(client, 'xp nobody 100');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not found');
      });
    });

    // ── gold ──

    describe('gold', () => {
      it('should grant gold to a player', async () => {
        const grantGold = vi.fn();
        const players = [{ name: 'Alice', grantGold }];
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));

        const res = await sendCommand(client, 'gold alice 1000');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Granted 1000 gold to alice');
        expect(grantGold).toHaveBeenCalledWith(1000);
      });

      it('should return error for missing arguments', async () => {
        const res = await sendCommand(client, 'gold');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error if player not found', async () => {
        const res = await sendCommand(client, 'gold nobody 100');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not found');
      });
    });

    // ── level ──

    describe('level', () => {
      it('should set player level', async () => {
        const setLevel = vi.fn();
        const players = [{ name: 'Alice', setLevel }];
        world.forEachPlayer.mockImplementation((cb: Function) => players.forEach(cb));

        const res = await sendCommand(client, 'level alice 25');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Set alice to level 25');
        expect(setLevel).toHaveBeenCalledWith(25);
      });

      it('should reject level below 1', async () => {
        const res = await sendCommand(client, 'level alice 0');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should reject level above 50', async () => {
        const res = await sendCommand(client, 'level alice 51');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error for missing arguments', async () => {
        const res = await sendCommand(client, 'level');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error if player not found', async () => {
        const res = await sendCommand(client, 'level nobody 10');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not found');
      });
    });

    // ── pause ──

    describe('pause', () => {
      it('should pause a running game loop', async () => {
        const stop = vi.fn();
        world.gameLoop = { isRunning: vi.fn().mockReturnValue(true), stop };

        const res = await sendCommand(client, 'pause');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Game loop paused');
        expect(stop).toHaveBeenCalled();
      });

      it('should return error if game loop not initialized', async () => {
        world.gameLoop = null;
        const res = await sendCommand(client, 'pause');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not initialized');
      });

      it('should return error if already paused', async () => {
        world.gameLoop = { isRunning: vi.fn().mockReturnValue(false), stop: vi.fn() };
        const res = await sendCommand(client, 'pause');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Already paused');
      });
    });

    // ── resume ──

    describe('resume', () => {
      it('should resume a paused game loop', async () => {
        const start = vi.fn();
        world.gameLoop = { isRunning: vi.fn().mockReturnValue(false), start };

        const res = await sendCommand(client, 'resume');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Game loop resumed');
        expect(start).toHaveBeenCalled();
      });

      it('should return error if game loop not initialized', async () => {
        world.gameLoop = null;
        const res = await sendCommand(client, 'resume');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not initialized');
      });

      it('should return error if already running', async () => {
        world.gameLoop = { isRunning: vi.fn().mockReturnValue(true), start: vi.fn() };
        const res = await sendCommand(client, 'resume');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Already running');
      });
    });

    // ── ups ──

    describe('ups', () => {
      it('should set tick rate', async () => {
        const setUpdatesPerSecond = vi.fn();
        world.gameLoop = { setUpdatesPerSecond };

        const res = await sendCommand(client, 'ups 60');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Tick rate set to 60 UPS');
        expect(setUpdatesPerSecond).toHaveBeenCalledWith(60);
      });

      it('should reject rate below 1', async () => {
        world.gameLoop = { setUpdatesPerSecond: vi.fn() };
        const res = await sendCommand(client, 'ups 0');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should reject rate above 100', async () => {
        world.gameLoop = { setUpdatesPerSecond: vi.fn() };
        const res = await sendCommand(client, 'ups 101');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Usage');
      });

      it('should return error if game loop not initialized', async () => {
        world.gameLoop = null;
        const res = await sendCommand(client, 'ups 50');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not initialized');
      });
    });

    // ── venice ──

    describe('venice', () => {
      it('should show metrics when client is available', async () => {
        mockGetVeniceClient.mockReturnValue({
          getMetrics: () => ({
            totalCalls: 50, successCount: 45, failureCount: 5,
            retryCount: 2, timeoutCount: 1, authErrorCount: 0,
            rateLimitCount: 1, serverErrorCount: 2, networkErrorCount: 1,
            unknownErrorCount: 0, avgLatencyMs: 150, p95LatencyMs: 300,
            maxLatencyMs: 500, circuitState: 'closed', circuitBreakerTrips: 0,
            circuitBreakerRejects: 0, lastSuccessTime: 1000, lastFailureTime: 900,
            lastError: 'timeout', lastErrorCategory: 'timeout', startTime: 0,
          }),
        });

        const res = await sendCommand(client, 'venice');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Venice AI Metrics');
        expect(res.data.msg).toContain('Calls: 50 total');
        expect(res.data.msg).toContain('timeout');
        expect(res.data.msg).toContain('avg=150ms');
      });

      it('should show last error details when present', async () => {
        mockGetVeniceClient.mockReturnValue({
          getMetrics: () => ({
            totalCalls: 10, successCount: 9, failureCount: 1,
            retryCount: 0, timeoutCount: 0, authErrorCount: 0,
            rateLimitCount: 0, serverErrorCount: 0, networkErrorCount: 0,
            unknownErrorCount: 1, avgLatencyMs: 100, p95LatencyMs: 200,
            maxLatencyMs: 250, circuitState: 'closed', circuitBreakerTrips: 0,
            circuitBreakerRejects: 0, lastSuccessTime: 1000, lastFailureTime: 500,
            lastError: 'Something broke', lastErrorCategory: 'unknown',
            startTime: 0,
          }),
        });

        const res = await sendCommand(client, 'venice');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('[unknown] Something broke');
      });

      it('should return error when client not initialized', async () => {
        mockGetVeniceClient.mockReturnValue(null);
        const res = await sendCommand(client, 'venice');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not initialized');
      });
    });

    // ── venice health ──

    describe('venice health', () => {
      it('should show healthy status', async () => {
        mockGetVeniceClient.mockReturnValue({
          healthCheck: vi.fn().mockResolvedValue({
            ok: true, latencyMs: 120, model: 'llama-3.3-70b', circuitState: 'closed',
          }),
        });

        const res = await sendCommand(client, 'venice health');
        expect(res.data.ok).toBe(true);
        expect(res.data.msg).toContain('Status: OK');
        expect(res.data.msg).toContain('Latency: 120ms');
        expect(res.data.msg).toContain('llama-3.3-70b');
      });

      it('should show failed status with error', async () => {
        mockGetVeniceClient.mockReturnValue({
          healthCheck: vi.fn().mockResolvedValue({
            ok: false, latencyMs: 5000, model: 'llama-3.3-70b', circuitState: 'open',
            error: 'Connection timeout', errorCategory: 'timeout',
          }),
        });

        const res = await sendCommand(client, 'venice health');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('Status: FAILED');
        expect(res.data.msg).toContain('Error: Connection timeout');
        expect(res.data.msg).toContain('Category: timeout');
      });

      it('should return error when client not initialized', async () => {
        mockGetVeniceClient.mockReturnValue(null);
        const res = await sendCommand(client, 'venice health');
        expect(res.data.ok).toBe(false);
        expect(res.data.msg).toContain('not initialized');
      });
    });

    // ── malformed messages ──

    describe('error handling', () => {
      it('should handle malformed JSON gracefully', async () => {
        const messageHandler = client._handlers['message'];
        await messageHandler('not-json{{{');
        const lastSend = client.send.mock.calls[client.send.mock.calls.length - 1][0];
        const res = JSON.parse(lastSend);
        expect(res.type).toBe('result');
        expect(res.data.ok).toBe(false);
      });

      it('should handle non-command message types by ignoring them', async () => {
        const sendsBefore = client.send.mock.calls.length;
        const messageHandler = client._handlers['message'];
        await messageHandler(JSON.stringify({ type: 'ping' }));
        // No result message should be sent for non-command types
        expect(client.send.mock.calls.length).toBe(sendsBefore);
      });
    });
  });
});
