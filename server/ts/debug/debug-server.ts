/**
 * Debug WebSocket Server
 *
 * Streams game state snapshots and logs to connected TUI clients.
 * Runs on a separate port (default 8001) from the game server.
 *
 * Start: automatically started with the game server (disable with NO_DEBUG=1)
 * Connect: tools/tui.js connects here for the live terminal dashboard
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createModuleLogger, setDebugLogHook } from '../utils/logger';
import { getCombatTracker } from '../combat/combat-tracker';
import { Types } from '../../../shared/ts/gametypes';

const log = createModuleLogger('DebugServer');

// Ring buffer for recent log events
const LOG_BUFFER_SIZE = 200;
const logBuffer: DebugLogEntry[] = [];

export interface DebugLogEntry {
  time: number;
  level: string;
  module: string;
  msg: string;
  data: Record<string, unknown>;
}

export interface DebugSnapshot {
  timestamp: number;
  players: DebugPlayer[];
  mobs: DebugMob[];
  aggro: DebugAggroLink[];
  groups: Record<string, { players: number; mobs: number }>;
  stats: {
    playerCount: number;
    mobCount: number;
    entityCount: number;
    ups: number;
  };
  recentLogs: DebugLogEntry[];
}

interface DebugPlayer {
  id: number;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  group: string;
  target: number | null;
  zone: string;
}

interface DebugMob {
  id: number;
  kind: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  isDead: boolean;
  target: number | null;
  group: string;
  zone: string;
}

interface DebugAggroLink {
  mobId: number;
  mobKind: string;
  playerId: number;
  playerName: string;
  hate: number;
}

/**
 * Push a log entry into the ring buffer.
 * Called by the debug pino transport.
 */
export function pushDebugLog(entry: DebugLogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
  // Broadcast to connected clients immediately
  broadcastLog(entry);
}

let wss: WebSocketServer | null = null;

function broadcastLog(entry: DebugLogEntry): void {
  if (!wss) return;
  const msg = JSON.stringify({ type: 'log', data: entry });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function getZoneName(x: number, y: number, zoneManager: any): string {
  if (!zoneManager) return '?';
  try {
    const zone = zoneManager.getZoneAt(x, y);
    return zone?.id || '?';
  } catch {
    return '?';
  }
}

function buildSnapshot(world: any): DebugSnapshot {
  const players: DebugPlayer[] = [];
  const mobs: DebugMob[] = [];
  const aggro: DebugAggroLink[] = [];
  const groups: Record<string, { players: number; mobs: number }> = {};
  const tracker = getCombatTracker();
  const zm = world.zoneManager;

  // Players
  world.forEachPlayer((player: any) => {
    players.push({
      id: player.id,
      name: player.name || `Player#${player.id}`,
      x: player.x,
      y: player.y,
      hp: player.hitPoints ?? 0,
      maxHp: player.maxHitPoints ?? 0,
      level: player.level ?? 1,
      group: player.group || '?',
      target: player.target ?? null,
      zone: getZoneName(player.x, player.y, zm),
    });
  });

  // Mobs
  world.forEachMob((mob: any) => {
    const kindName = Types.getKindAsString(mob.kind) || `mob#${mob.kind}`;
    mobs.push({
      id: mob.id,
      kind: kindName,
      x: mob.x,
      y: mob.y,
      hp: mob.hitPoints ?? 0,
      maxHp: mob.maxHitPoints ?? 0,
      level: mob.level ?? 1,
      isDead: mob.isDead ?? false,
      target: mob.target ?? null,
      group: mob.group || '?',
      zone: getZoneName(mob.x, mob.y, zm),
    });

    // Aggro links for this mob
    const hated = tracker.getPlayersHated(mob.id);
    for (const entry of hated) {
      const player = world.getEntityById(entry.entityId);
      aggro.push({
        mobId: mob.id,
        mobKind: kindName,
        playerId: entry.entityId,
        playerName: player?.name || `#${entry.entityId}`,
        hate: entry.hate,
      });
    }
  });

  // Group summary
  if (world.spatialManager) {
    const allGroups = world.spatialManager.groups || {};
    for (const [gid, group] of Object.entries(allGroups)) {
      const g = group as any;
      const entities = g.entities ? Object.values(g.entities) : [];
      let pc = 0;
      let mc = 0;
      for (const e of entities) {
        if ((e as any).name !== undefined) pc++;
        else mc++;
      }
      if (pc > 0 || mc > 0) {
        groups[gid] = { players: pc, mobs: mc };
      }
    }
  }

  return {
    timestamp: Date.now(),
    players,
    mobs,
    aggro,
    groups,
    stats: {
      playerCount: players.length,
      mobCount: mobs.length,
      entityCount: Object.keys(world.entities || {}).length,
      ups: world.ups || 50,
    },
    recentLogs: logBuffer.slice(-20),
  };
}

export function startDebugServer(world: any, port = 8001): WebSocketServer {
  wss = new WebSocketServer({ port });

  let snapshotInterval: ReturnType<typeof setInterval> | null = null;

  wss.on('connection', (ws) => {
    log.info({ port, clients: wss!.clients.size }, 'Debug client connected');

    // Send initial snapshot immediately
    try {
      const snapshot = buildSnapshot(world);
      ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }));
    } catch (e) {
      log.error({ err: e }, 'Failed to build initial snapshot');
    }

    ws.on('close', () => {
      log.info({ clients: wss!.clients.size }, 'Debug client disconnected');
    });
  });

  // Broadcast snapshots every 500ms to all connected clients
  snapshotInterval = setInterval(() => {
    if (!wss || wss.clients.size === 0) return;
    try {
      const snapshot = buildSnapshot(world);
      const msg = JSON.stringify({ type: 'snapshot', data: snapshot });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
    } catch (e) {
      // Don't crash the game server for debug failures
    }
  }, 500);

  wss.on('close', () => {
    if (snapshotInterval) clearInterval(snapshotInterval);
  });

  // Wire up log forwarding from pino to debug clients
  setDebugLogHook((entry: DebugLogEntry) => {
    pushDebugLog(entry);
  });

  log.info({ port }, 'Debug WebSocket server started');
  return wss;
}
