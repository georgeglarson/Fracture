#!/usr/bin/env node
/**
 * Fracture Debug CLI — non-interactive probe for AI-assisted diagnostics
 *
 * Connects to the debug WebSocket server, runs a query, prints results, exits.
 * Designed to be invoked by Claude Code's Bash tool during troubleshooting sessions.
 *
 * Usage:
 *   node tools/debug-cli.js snapshot          Full game state dump (JSON)
 *   node tools/debug-cli.js players           List all connected players
 *   node tools/debug-cli.js mobs              List all living mobs
 *   node tools/debug-cli.js aggro             List all active aggro links
 *   node tools/debug-cli.js groups            List populated spatial groups
 *   node tools/debug-cli.js logs [n]          Last n log entries (default 50)
 *   node tools/debug-cli.js stats             Server stats summary
 *   node tools/debug-cli.js cmd <command>     Run a debug command (inspect, find, kill, etc.)
 *   node tools/debug-cli.js watch [seconds]   Stream snapshots for N seconds (default 5)
 *   node tools/debug-cli.js health            Quick health check — flags anomalies
 *
 * Options:
 *   --host HOST   WebSocket host (default ws://localhost:8001)
 *   --json        Force JSON output (default for snapshot)
 *   --table       Force table output (default for players/mobs/aggro)
 *
 * Exit codes:
 *   0 = success, 1 = connection failed, 2 = bad usage, 3 = command error
 */

'use strict';

const WebSocket = require('ws');

// ─── Argument parsing ────────────────────────────────────────

const args = process.argv.slice(2);
let host = 'ws://localhost:8001';
let forceJson = false;
let forceTable = false;

// Extract flags
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--host' && args[i + 1]) { host = args[++i]; }
  else if (args[i] === '--json') { forceJson = true; }
  else if (args[i] === '--table') { forceTable = true; }
  else { positional.push(args[i]); }
}

const mode = positional[0] || 'help';
const modeArgs = positional.slice(1);

if (mode === 'help' || mode === '--help' || mode === '-h') {
  console.log(`Fracture Debug CLI — non-interactive probe

Usage: node tools/debug-cli.js <mode> [args] [--host ws://host:port]

Modes:
  snapshot          Full game state (JSON)
  players           Connected players table
  mobs              Living mobs table
  aggro             Active aggro links
  groups            Populated spatial groups
  logs [n]          Recent log entries (default 50)
  stats             Server stats summary
  cmd <command>     Run debug command (inspect, find, kill, heal, etc.)
  watch [seconds]   Stream state for N seconds (default 5)
  health            Anomaly detection — flags things that look wrong
  venice            Venice AI metrics and health

Options:
  --host <url>      WebSocket endpoint (default ws://localhost:8001)
  --json            Force JSON output
  --table           Force table output`);
  process.exit(0);
}

// ─── WebSocket helpers ───────────────────────────────────────

function connectAndDo(callback) {
  const ws = new WebSocket(host);
  const timeout = setTimeout(() => {
    console.error(`Connection timeout — is the server running with debug enabled?`);
    console.error(`Tried: ${host}`);
    ws.terminate();
    process.exit(1);
  }, 3000);

  ws.on('open', () => {
    clearTimeout(timeout);
    callback(ws);
  });

  ws.on('error', (err) => {
    clearTimeout(timeout);
    console.error(`Connection failed: ${err.message}`);
    console.error(`Tried: ${host}`);
    process.exit(1);
  });
}

function waitForSnapshot(ws) {
  return new Promise((resolve) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'snapshot') resolve(msg.data);
      } catch {}
    });
  });
}

function sendCommandAndWait(ws, command) {
  return new Promise((resolve) => {
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'result') {
          ws.removeListener('message', handler);
          resolve(msg.data);
        }
      } catch {}
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ type: 'command', command }));
  });
}

// ─── Formatters ──────────────────────────────────────────────

function pad(s, n) { return String(s).padEnd(n); }
function rpad(s, n) { return String(s).padStart(n); }

function formatPlayers(players) {
  if (!players.length) return 'No players connected.';
  const humans = players.filter(p => !p.isAI);
  const ais = players.filter(p => p.isAI);
  const header = `${pad('ID', 8)} ${pad('Type', 6)} ${pad('Name', 20)} ${rpad('Lv', 3)} ${rpad('HP', 12)} ${pad('Group', 8)} ${pad('Zone', 12)} ${pad('Pos', 12)} ${pad('Target', 8)}`;
  const sep = '-'.repeat(header.length);
  const formatRow = p => {
    const tag = p.isAI ? 'AI' : 'Human';
    return `${pad(p.id, 8)} ${pad(tag, 6)} ${pad(p.name, 20)} ${rpad(p.level, 3)} ${rpad(`${p.hp}/${p.maxHp}`, 12)} ${pad(p.group, 8)} ${pad(p.zone, 12)} ${pad(`(${p.x},${p.y})`, 12)} ${pad(p.target || '-', 8)}`;
  };
  const rows = [...humans, ...ais].map(formatRow);
  const summary = `Humans: ${humans.length}  AI: ${ais.length}  Total: ${players.length}`;
  return [summary, '', header, sep, ...rows].join('\n');
}

function formatMobs(mobs) {
  const living = mobs.filter(m => !m.isDead);
  if (!living.length) return 'No living mobs.';
  const header = `${pad('ID', 8)} ${pad('Kind', 16)} ${rpad('Lv', 3)} ${rpad('HP', 12)} ${pad('Group', 8)} ${pad('Zone', 8)} ${pad('Target', 8)}`;
  const sep = '-'.repeat(header.length);
  const rows = living.slice(0, 100).map(m =>
    `${pad(m.id, 8)} ${pad(m.kind, 16)} ${rpad(m.level, 3)} ${rpad(`${m.hp}/${m.maxHp}`, 12)} ${pad(m.group, 8)} ${pad(m.zone, 8)} ${pad(m.target || '-', 8)}`
  );
  const footer = living.length > 100 ? `\n... and ${living.length - 100} more` : '';
  return [header, sep, ...rows].join('\n') + footer;
}

function formatAggro(aggro) {
  if (!aggro.length) return 'No active aggro links.';
  const header = `${pad('Mob', 20)} ${pad('Player', 20)} ${rpad('Hate', 6)}`;
  const sep = '-'.repeat(header.length);
  const sorted = aggro.slice().sort((a, b) => b.hate - a.hate);
  const rows = sorted.slice(0, 50).map(a =>
    `${pad(`${a.mobKind}#${a.mobId}`, 20)} ${pad(a.playerName, 20)} ${rpad(a.hate, 6)}`
  );
  return [header, sep, ...rows].join('\n');
}

function formatGroups(groups) {
  const entries = Object.entries(groups).filter(([, g]) => g.players > 0 || g.mobs > 0);
  if (!entries.length) return 'No populated groups.';
  entries.sort((a, b) => (b[1].players + b[1].mobs) - (a[1].players + a[1].mobs));
  const header = `${pad('Group', 10)} ${rpad('Players', 8)} ${rpad('Mobs', 8)} ${rpad('Total', 8)}`;
  const sep = '-'.repeat(header.length);
  const rows = entries.map(([gid, g]) =>
    `${pad(gid, 10)} ${rpad(g.players, 8)} ${rpad(g.mobs, 8)} ${rpad(g.players + g.mobs, 8)}`
  );
  return [header, sep, ...rows].join('\n');
}

function formatLogs(logs) {
  if (!logs.length) return 'No log entries.';
  return logs.map(e => {
    const time = new Date(e.time).toISOString().slice(11, 23);
    const mod = e.module ? `[${e.module}]` : '';
    const data = Object.keys(e.data || {}).length > 0 ? ' ' + JSON.stringify(e.data) : '';
    return `${time} ${(e.level || 'info').toUpperCase().padEnd(5)} ${mod.padEnd(18)} ${e.msg}${data}`;
  }).join('\n');
}

function formatStats(snapshot) {
  const s = snapshot.stats || {};
  const aggroCount = (snapshot.aggro || []).length;
  const deadMobs = (snapshot.mobs || []).filter(m => m.isDead).length;
  const popGroups = Object.values(snapshot.groups || {}).filter(g => g.players > 0 || g.mobs > 0).length;
  const totalGroups = Object.keys(snapshot.groups || {}).length;
  return [
    `Server Stats`,
    `─────────────────────────────`,
    `Players:        ${s.playerCount || 0} (${s.humanCount || 0} human, ${s.aiCount || 0} AI)`,
    `Mobs (alive):   ${(s.mobCount || 0) - deadMobs}`,
    `Mobs (dead):    ${deadMobs}`,
    `Total entities: ${s.entityCount || 0}`,
    `Tick rate:      ${s.ups || 50} UPS`,
    `Aggro links:    ${aggroCount}`,
    `Active groups:  ${popGroups} / ${totalGroups}`,
    `Snapshot time:  ${new Date(snapshot.timestamp).toISOString()}`,
  ].join('\n');
}

// ─── Health check — flag anomalies ───────────────────────────

function runHealthCheck(snapshot) {
  const issues = [];
  const warnings = [];
  const ok = [];

  const s = snapshot.stats || {};
  const players = snapshot.players || [];
  const mobs = snapshot.mobs || [];
  const aggro = snapshot.aggro || [];
  const logs = snapshot.recentLogs || [];

  // Check 1: Server is ticking
  if (s.ups > 0) ok.push(`Tick rate: ${s.ups} UPS`);
  else issues.push('CRITICAL: Server tick rate is 0 — game loop may be paused or crashed');

  // Check 2: Dead mobs with aggro
  const deadMobs = mobs.filter(m => m.isDead);
  const deadWithAggro = deadMobs.filter(m => aggro.some(a => a.mobId === m.id));
  if (deadWithAggro.length > 0) {
    issues.push(`Dead mobs with active aggro links: ${deadWithAggro.map(m => `${m.kind}#${m.id}`).join(', ')}`);
  } else {
    ok.push('No dead mobs with stale aggro');
  }

  // Check 3: Players with 0 HP that aren't dead (dead AI players respawning are expected)
  const zeroHpAlive = players.filter(p => p.hp <= 0 && !p.isDead);
  if (zeroHpAlive.length > 0) {
    warnings.push(`Alive players with 0 HP: ${zeroHpAlive.map(p => `${p.name}(HP:${p.hp})`).join(', ')}`);
  }
  const deadAI = players.filter(p => p.isDead && p.isAI);
  if (deadAI.length > 0) {
    ok.push(`${deadAI.length} AI player${deadAI.length > 1 ? 's' : ''} respawning`);
  }

  // Check 4: Players targeting dead or nonexistent mobs
  for (const p of players) {
    if (p.target) {
      const target = mobs.find(m => m.id === p.target);
      if (!target) {
        warnings.push(`${p.name} targeting nonexistent entity #${p.target}`);
      } else if (target.isDead) {
        warnings.push(`${p.name} targeting dead ${target.kind}#${target.id}`);
      }
    }
  }

  // Check 5: Mobs with HP > maxHP
  const overHealedMobs = mobs.filter(m => m.hp > m.maxHp);
  if (overHealedMobs.length > 0) {
    issues.push(`Mobs with HP > maxHP: ${overHealedMobs.map(m => `${m.kind}#${m.id}(${m.hp}/${m.maxHp})`).join(', ')}`);
  }

  // Check 6: Players with HP > maxHP
  const overHealedPlayers = players.filter(p => p.hp > p.maxHp);
  if (overHealedPlayers.length > 0) {
    issues.push(`Players with HP > maxHP: ${overHealedPlayers.map(p => `${p.name}(${p.hp}/${p.maxHp})`).join(', ')}`);
  }

  // Check 7: Orphaned aggro (mob or player not in entity lists)
  const playerIds = new Set(players.map(p => p.id));
  const mobIds = new Set(mobs.map(m => m.id));
  const orphanedAggro = aggro.filter(a => !mobIds.has(a.mobId) || !playerIds.has(a.playerId));
  if (orphanedAggro.length > 0) {
    issues.push(`Orphaned aggro links (entity missing): ${orphanedAggro.length}`);
  } else if (aggro.length > 0) {
    ok.push(`All ${aggro.length} aggro links reference valid entities`);
  }

  // Check 8: Extreme aggro values (possible runaway hate)
  const extremeAggro = aggro.filter(a => a.hate > 10000);
  if (extremeAggro.length > 0) {
    warnings.push(`Extreme hate values (>10000): ${extremeAggro.map(a => `${a.mobKind}#${a.mobId}->${a.playerName}:${a.hate}`).join(', ')}`);
  }

  // Check 9: Recent error/fatal logs
  const recentErrors = logs.filter(l => l.level === 'error' || l.level === 'fatal');
  if (recentErrors.length > 0) {
    issues.push(`Recent error/fatal logs: ${recentErrors.length}`);
    for (const e of recentErrors.slice(-5)) {
      issues.push(`  [${e.module || '?'}] ${e.msg}`);
    }
  } else {
    ok.push('No recent errors in log buffer');
  }

  // Check 10: Spatial group consistency — skip dead players (removed from world during respawn)
  const noGroup = players.filter(p => (!p.group || p.group === '?') && !p.isDead);
  if (noGroup.length > 0) {
    warnings.push(`Alive players with no spatial group: ${noGroup.map(p => p.name).join(', ')}`);
  }

  // Check 11: Venice AI health
  const venice = snapshot.venice;
  if (venice) {
    if (venice.circuitState === 'open') {
      issues.push(`Venice AI circuit breaker OPEN — API calls blocked. Last error: [${venice.lastErrorCategory}] ${venice.lastError}`);
    } else if (venice.circuitState === 'half-open') {
      warnings.push('Venice AI circuit breaker half-open — recovering from failures');
    } else if (venice.failureCount > 0 && venice.successRate !== null && venice.successRate < 50) {
      warnings.push(`Venice AI degraded: ${venice.successRate}% success rate (${venice.failureCount} failures)`);
    } else if (venice.totalCalls > 0 && venice.successRate !== null) {
      ok.push(`Venice AI: ${venice.successRate}% success, ${venice.avgLatencyMs}ms avg latency, circuit ${venice.circuitState}`);
    } else {
      ok.push('Venice AI: no calls yet');
    }
  } else {
    warnings.push('Venice AI not initialized (no API key?)');
  }

  // Format output
  const lines = ['=== Fracture Health Check ===', ''];

  if (issues.length > 0) {
    lines.push(`ISSUES (${issues.length}):`);
    issues.forEach(i => lines.push(`  [!] ${i}`));
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push(`WARNINGS (${warnings.length}):`);
    warnings.forEach(w => lines.push(`  [~] ${w}`));
    lines.push('');
  }

  if (ok.length > 0) {
    lines.push(`OK (${ok.length}):`);
    ok.forEach(o => lines.push(`  [+] ${o}`));
    lines.push('');
  }

  const verdict = issues.length > 0 ? 'UNHEALTHY' : warnings.length > 0 ? 'DEGRADED' : 'HEALTHY';
  const humanCount = players.filter(p => !p.isAI).length;
  const aiCount = players.filter(p => p.isAI).length;
  lines.push(`Verdict: ${verdict}  (${humanCount} human + ${aiCount} AI / ${mobs.filter(m=>!m.isDead).length}M / ${aggro.length} aggro / ${s.ups} UPS)`);

  return lines.join('\n');
}

// ─── Mode dispatch ───────────────────────────────────────────

connectAndDo(async (ws) => {
  try {
    switch (mode) {
      case 'snapshot': {
        const snap = await waitForSnapshot(ws);
        console.log(JSON.stringify(snap, null, 2));
        break;
      }

      case 'players': {
        const snap = await waitForSnapshot(ws);
        if (forceJson) console.log(JSON.stringify(snap.players, null, 2));
        else console.log(formatPlayers(snap.players || []));
        break;
      }

      case 'mobs': {
        const snap = await waitForSnapshot(ws);
        if (forceJson) console.log(JSON.stringify(snap.mobs, null, 2));
        else console.log(formatMobs(snap.mobs || []));
        break;
      }

      case 'aggro': {
        const snap = await waitForSnapshot(ws);
        if (forceJson) console.log(JSON.stringify(snap.aggro, null, 2));
        else console.log(formatAggro(snap.aggro || []));
        break;
      }

      case 'groups': {
        const snap = await waitForSnapshot(ws);
        if (forceJson) console.log(JSON.stringify(snap.groups, null, 2));
        else console.log(formatGroups(snap.groups || {}));
        break;
      }

      case 'logs': {
        const n = parseInt(modeArgs[0]) || 50;
        const snap = await waitForSnapshot(ws);
        const logs = (snap.recentLogs || []).slice(-n);
        if (forceJson) console.log(JSON.stringify(logs, null, 2));
        else console.log(formatLogs(logs));
        break;
      }

      case 'stats': {
        const snap = await waitForSnapshot(ws);
        if (forceJson) console.log(JSON.stringify(snap.stats, null, 2));
        else console.log(formatStats(snap));
        break;
      }

      case 'cmd': {
        const command = modeArgs.join(' ');
        if (!command) {
          console.error('Usage: debug-cli.js cmd <command>');
          process.exit(2);
        }
        // Wait for initial snapshot to arrive first (server sends one on connect)
        await waitForSnapshot(ws);
        const result = await sendCommandAndWait(ws, command);
        if (forceJson) console.log(JSON.stringify(result, null, 2));
        else {
          console.log(result.ok ? result.msg : `ERROR: ${result.msg}`);
        }
        if (!result.ok) process.exitCode = 3;
        break;
      }

      case 'watch': {
        const seconds = parseInt(modeArgs[0]) || 5;
        let count = 0;
        const start = Date.now();
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'snapshot') {
              count++;
              const s = msg.data.stats || {};
              const aggroCount = (msg.data.aggro || []).length;
              const elapsed = ((Date.now() - start) / 1000).toFixed(1);
              console.log(
                `[${elapsed}s] P:${s.playerCount} M:${s.mobCount} E:${s.entityCount} UPS:${s.ups} Aggro:${aggroCount}`
              );
            } else if (msg.type === 'log') {
              const e = msg.data;
              const time = new Date(e.time).toISOString().slice(11, 23);
              const mod = e.module ? `[${e.module}]` : '';
              console.log(`  LOG ${time} ${(e.level||'').toUpperCase().padEnd(5)} ${mod} ${e.msg}`);
            }
          } catch {}
        });
        setTimeout(() => {
          console.log(`\nWatched for ${seconds}s — ${count} snapshots received`);
          ws.close();
          process.exit(0);
        }, seconds * 1000);
        return; // Don't close ws below
      }

      case 'health': {
        const snap = await waitForSnapshot(ws);
        console.log(runHealthCheck(snap));
        break;
      }

      case 'venice': {
        // Show metrics, and optionally run health check
        await waitForSnapshot(ws); // ensure connection is ready
        const metrics = await sendCommandAndWait(ws, 'venice');
        console.log(metrics.ok ? metrics.msg : `ERROR: ${metrics.msg}`);

        if (modeArgs[0] === 'health' || modeArgs[0] === 'check') {
          console.log('\n--- Live Health Check ---');
          const health = await sendCommandAndWait(ws, 'venice health');
          console.log(health.ok ? health.msg : `ERROR: ${health.msg}`);
        }
        break;
      }

      default:
        console.error(`Unknown mode: ${mode}. Run with --help for usage.`);
        process.exit(2);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  ws.close();
});
