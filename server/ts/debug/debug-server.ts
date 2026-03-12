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
import { getVeniceClient } from '../ai';

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
    humanCount: number;
    aiCount: number;
    mobCount: number;
    entityCount: number;
    ups: number;
  };
  venice: {
    successRate: number | null;
    totalCalls: number;
    failureCount: number;
    avgLatencyMs: number;
    circuitState: string;
    lastError: string | null;
    lastErrorCategory: string | null;
  } | null;
  recentLogs: DebugLogEntry[];
}

interface DebugPlayer {
  id: number;
  name: string;
  isAI: boolean;
  isDead: boolean;
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
      isAI: player.isAI === true,
      isDead: player.isDead === true,
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

  // Venice AI metrics (null if not initialized)
  const veniceClient = getVeniceClient();
  const veniceMetrics = veniceClient ? veniceClient.getMetrics() : null;

  return {
    timestamp: Date.now(),
    players,
    mobs,
    aggro,
    groups,
    stats: {
      playerCount: players.length,
      humanCount: players.filter(p => !p.isAI).length,
      aiCount: players.filter(p => p.isAI).length,
      mobCount: mobs.length,
      entityCount: Object.keys(world.entities || {}).length,
      ups: world.ups || 50,
    },
    venice: veniceMetrics ? {
      successRate: veniceMetrics.totalCalls > 0
        ? Math.round((veniceMetrics.successCount / veniceMetrics.totalCalls) * 100) : null,
      totalCalls: veniceMetrics.totalCalls,
      failureCount: veniceMetrics.failureCount,
      avgLatencyMs: veniceMetrics.avgLatencyMs,
      circuitState: veniceMetrics.circuitState,
      lastError: veniceMetrics.lastError,
      lastErrorCategory: veniceMetrics.lastErrorCategory,
    } : null,
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

    // Handle commands from TUI
    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'command') {
          const result = await handleCommand(world, msg.command);
          ws.send(JSON.stringify({ type: 'result', data: result }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: 'result', data: { ok: false, msg: String(e) } }));
      }
    });

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

// ─── Command Handler ──────────────────────────────────────────

interface CommandResult {
  ok: boolean;
  msg: string;
}

async function handleCommand(world: any, input: string): Promise<CommandResult> {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);
  const tracker = getCombatTracker();

  try {
    switch (cmd) {
      // ── Entity inspection ──
      case 'inspect': {
        const id = parseInt(args[0]);
        if (isNaN(id)) return { ok: false, msg: 'Usage: inspect <entityId>' };
        const entity: any = world.getEntityById(id);
        if (!entity) return { ok: false, msg: `Entity #${id} not found` };
        const kind = Types.getKindAsString(entity.kind) || entity.kind;
        const info: string[] = [
          `ID: ${entity.id}  Kind: ${kind}  Type: ${entity.type}`,
          `Pos: (${entity.x}, ${entity.y})  Group: ${entity.group || '?'}`,
          `HP: ${entity.hitPoints ?? '?'}/${entity.maxHitPoints ?? '?'}`,
        ];
        if (entity.name) {
          const aiTag = entity.isAI ? ' [AI]' : '';
          info.push(`Name: ${entity.name}${aiTag}  Level: ${entity.level ?? '?'}`);
        }
        if (entity.target) info.push(`Target: #${entity.target}`);
        if (entity.characterId) info.push(`CharID: ${entity.characterId}`);
        if (entity.isDead) info.push('STATUS: DEAD');
        const aggroCount = tracker.getPlayerAggroCount(entity.id) || tracker.getMobAggroCount(entity.id);
        if (aggroCount > 0) info.push(`Aggro links: ${aggroCount}`);
        return { ok: true, msg: info.join('\n') };
      }

      case 'dump': {
        const id = parseInt(args[0]);
        if (isNaN(id)) return { ok: false, msg: 'Usage: dump <entityId>' };
        const ent: any = world.getEntityById(id);
        if (!ent) return { ok: false, msg: `Entity #${id} not found` };
        const own = Object.getOwnPropertyNames(ent);
        const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(ent));
        const proto2 = Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(ent)));
        const proto3 = Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(ent))));
        const levelDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ent), 'level');
        const levelOwn = Object.getOwnPropertyDescriptor(ent, 'level');
        const info: string[] = [
          `Constructor: ${ent.constructor?.name}`,
          `Own props: ${own.join(', ')}`,
          `Proto1 (${Object.getPrototypeOf(ent).constructor?.name}): ${proto.join(', ')}`,
          `Proto2 (${Object.getPrototypeOf(Object.getPrototypeOf(ent)).constructor?.name}): ${proto2.join(', ')}`,
          `Proto3: ${proto3.join(', ')}`,
          `level own descriptor: ${JSON.stringify(levelOwn)}`,
          `level proto descriptor: ${JSON.stringify(levelDesc ? { get: !!levelDesc.get, set: !!levelDesc.set } : null)}`,
          `entity.level = ${JSON.stringify(ent.level)}`,
          `typeof entity.level = ${typeof ent.level}`,
          `entity.progression = ${JSON.stringify(ent.progression ? { level: ent.progression.level, xp: ent.progression.xp } : null)}`,
        ];
        return { ok: true, msg: info.join('\n') };
      }

      case 'find': {
        if (!args[0]) return { ok: false, msg: 'Usage: find <name|kind>' };
        const query = args.join(' ').toLowerCase();
        const results: string[] = [];
        world.forEachPlayer((p: any) => {
          if (p.name?.toLowerCase().includes(query)) {
            results.push(`Player @${p.name} #${p.id} (${p.x},${p.y}) Lv${p.level ?? '?'}`);
          }
        });
        world.forEachMob((m: any) => {
          const kn = Types.getKindAsString(m.kind) || '';
          if (kn.toLowerCase().includes(query)) {
            results.push(`Mob ${kn} #${m.id} (${m.x},${m.y}) HP:${m.hitPoints}/${m.maxHitPoints}`);
          }
        });
        return results.length > 0
          ? { ok: true, msg: results.slice(0, 20).join('\n') + (results.length > 20 ? `\n... ${results.length - 20} more` : '') }
          : { ok: false, msg: `No entities matching "${query}"` };
      }

      // ── Combat ──
      case 'kill': {
        const id = parseInt(args[0]);
        if (isNaN(id)) return { ok: false, msg: 'Usage: kill <mobId>' };
        const mob: any = world.getEntityById(id);
        if (!mob) return { ok: false, msg: `Entity #${id} not found` };
        if (typeof mob.destroy !== 'function') return { ok: false, msg: `#${id} is not a mob` };
        const kind = Types.getKindAsString(mob.kind) || mob.kind;
        mob.receiveDamage(mob.hitPoints, 0);
        mob.destroy();
        world.despawn(mob);
        return { ok: true, msg: `Killed ${kind} #${id}` };
      }

      case 'heal': {
        const id = parseInt(args[0]);
        if (isNaN(id)) return { ok: false, msg: 'Usage: heal <entityId>' };
        const entity: any = world.getEntityById(id);
        if (!entity) return { ok: false, msg: `Entity #${id} not found` };
        if (entity.maxHitPoints === undefined) return { ok: false, msg: `#${id} has no HP` };
        entity.hitPoints = entity.maxHitPoints;
        entity.isDead = false;
        return { ok: true, msg: `Healed #${id} to ${entity.maxHitPoints} HP` };
      }

      case 'aggro': {
        const sub = args[0]?.toLowerCase();
        const id = parseInt(args[1]);
        if (sub === 'clear' && !isNaN(id)) {
          tracker.clearMobAggro(id);
          tracker.clearPlayerAggro(id);
          return { ok: true, msg: `Cleared all aggro for #${id}` };
        }
        return { ok: false, msg: 'Usage: aggro clear <entityId>' };
      }

      // ── Player commands ──
      case 'save': {
        const target = args[0]?.toLowerCase();
        const storage = world.getStorageService?.();
        if (!storage) return { ok: false, msg: 'Storage service unavailable' };
        let count = 0;
        world.forEachPlayer((p: any) => {
          if (!target || target === 'all' || p.name?.toLowerCase() === target) {
            if (p.characterId && typeof p.saveToStorage === 'function') {
              p.saveToStorage(storage);
              count++;
            }
          }
        });
        return count > 0
          ? { ok: true, msg: `Saved ${count} player${count > 1 ? 's' : ''}` }
          : { ok: false, msg: target ? `Player "${target}" not found` : 'No players to save' };
      }

      case 'kick': {
        if (!args[0]) return { ok: false, msg: 'Usage: kick <playerName>' };
        const name = args.join(' ').toLowerCase();
        let kicked = false;
        world.forEachPlayer((p: any) => {
          if (p.name?.toLowerCase() === name && p.connection) {
            p.connection.close('Kicked via debug TUI');
            kicked = true;
          }
        });
        return kicked ? { ok: true, msg: `Kicked ${name}` } : { ok: false, msg: `Player "${name}" not found` };
      }

      case 'xp': {
        const name = args[0]?.toLowerCase();
        const amount = parseInt(args[1]);
        if (!name || isNaN(amount)) return { ok: false, msg: 'Usage: xp <playerName> <amount>' };
        let granted = false;
        world.forEachPlayer((p: any) => {
          if (p.name?.toLowerCase() === name && typeof p.grantXP === 'function') {
            p.grantXP(amount);
            granted = true;
          }
        });
        return granted ? { ok: true, msg: `Granted ${amount} XP to ${name}` } : { ok: false, msg: `Player "${name}" not found` };
      }

      case 'gold': {
        const name = args[0]?.toLowerCase();
        const amount = parseInt(args[1]);
        if (!name || isNaN(amount)) return { ok: false, msg: 'Usage: gold <playerName> <amount>' };
        let granted = false;
        world.forEachPlayer((p: any) => {
          if (p.name?.toLowerCase() === name && typeof p.grantGold === 'function') {
            p.grantGold(amount);
            granted = true;
          }
        });
        return granted ? { ok: true, msg: `Granted ${amount} gold to ${name}` } : { ok: false, msg: `Player "${name}" not found` };
      }

      case 'level': {
        const name = args[0]?.toLowerCase();
        const level = parseInt(args[1]);
        if (!name || isNaN(level) || level < 1 || level > 50) return { ok: false, msg: 'Usage: level <playerName> <1-50>' };
        let set = false;
        world.forEachPlayer((p: any) => {
          if (p.name?.toLowerCase() === name && typeof p.setLevel === 'function') {
            p.setLevel(level);
            set = true;
          }
        });
        return set ? { ok: true, msg: `Set ${name} to level ${level}` } : { ok: false, msg: `Player "${name}" not found` };
      }

      // ── Server control ──
      case 'pause': {
        if (!world.gameLoop) return { ok: false, msg: 'Game loop not initialized' };
        if (!world.gameLoop.isRunning()) return { ok: false, msg: 'Already paused' };
        world.gameLoop.stop();
        return { ok: true, msg: 'Game loop paused' };
      }

      case 'resume': {
        if (!world.gameLoop) return { ok: false, msg: 'Game loop not initialized' };
        if (world.gameLoop.isRunning()) return { ok: false, msg: 'Already running' };
        world.gameLoop.start();
        return { ok: true, msg: 'Game loop resumed' };
      }

      case 'ups': {
        const rate = parseInt(args[0]);
        if (isNaN(rate) || rate < 1 || rate > 100) return { ok: false, msg: 'Usage: ups <1-100>' };
        if (!world.gameLoop) return { ok: false, msg: 'Game loop not initialized' };
        world.gameLoop.setUpdatesPerSecond(rate);
        return { ok: true, msg: `Tick rate set to ${rate} UPS` };
      }

      // ── Venice AI diagnostics ──
      case 'venice': {
        const sub = args[0]?.toLowerCase();
        const client = getVeniceClient();
        if (!client) return { ok: false, msg: 'Venice client not initialized (no API key?)' };

        if (sub === 'health') {
          const result = await client.healthCheck();
          const lines = [
            `Status: ${result.ok ? 'OK' : 'FAILED'}`,
            `Latency: ${result.latencyMs}ms`,
            `Model: ${result.model}`,
            `Circuit: ${result.circuitState}`,
          ];
          if (result.error) lines.push(`Error: ${result.error}`);
          if (result.errorCategory) lines.push(`Category: ${result.errorCategory}`);
          return { ok: result.ok, msg: lines.join('\n') };
        }

        // Default: show metrics
        const m = client.getMetrics();
        const uptime = Math.round((Date.now() - m.startTime) / 1000);
        const successRate = m.totalCalls > 0 ? Math.round((m.successCount / m.totalCalls) * 100) : 0;
        const lines = [
          `Venice AI Metrics (uptime: ${uptime}s)`,
          `─────────────────────────────────`,
          `Calls: ${m.totalCalls} total, ${m.successCount} ok, ${m.failureCount} failed (${successRate}% success)`,
          `Retries: ${m.retryCount}`,
          ``,
          `Errors by type:`,
          `  timeout:    ${m.timeoutCount}`,
          `  auth:       ${m.authErrorCount}`,
          `  rate_limit: ${m.rateLimitCount}`,
          `  server:     ${m.serverErrorCount}`,
          `  network:    ${m.networkErrorCount}`,
          `  unknown:    ${m.unknownErrorCount}`,
          ``,
          `Latency: avg=${m.avgLatencyMs}ms  p95=${m.p95LatencyMs}ms  max=${m.maxLatencyMs}ms`,
          `Circuit breaker: ${m.circuitState} (tripped ${m.circuitBreakerTrips}x, rejected ${m.circuitBreakerRejects} calls)`,
          ``,
          `Last success: ${m.lastSuccessTime ? new Date(m.lastSuccessTime).toISOString() : 'never'}`,
          `Last failure: ${m.lastFailureTime ? new Date(m.lastFailureTime).toISOString() : 'never'}`,
        ];
        if (m.lastError) {
          lines.push(`Last error: [${m.lastErrorCategory}] ${m.lastError}`);
        }
        return { ok: true, msg: lines.join('\n') };
      }

      case 'help':
        return {
          ok: true,
          msg: [
            'inspect <id>       Show entity details',
            'find <name|kind>   Search entities',
            'kill <mobId>       Kill a mob',
            'heal <id>          Restore full HP',
            'aggro clear <id>   Clear all aggro',
            'save [name|all]    Force-save player(s)',
            'kick <name>        Disconnect player',
            'xp <name> <amt>    Grant XP',
            'gold <name> <amt>  Grant gold',
            'level <name> <n>   Set level (1-50)',
            'pause              Pause game loop',
            'resume             Resume game loop',
            'ups <rate>         Set tick rate (1-100)',
            'venice             Venice AI metrics',
            'venice health      Live API connectivity test',
          ].join('\n'),
        };

      default:
        return { ok: false, msg: `Unknown command: ${cmd}. Type "help" for commands.` };
    }
  } catch (e) {
    return { ok: false, msg: `Error: ${e}` };
  }
}
