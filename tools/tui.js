#!/usr/bin/env node
/**
 * Fracture Server TUI — nethack-style terminal dashboard
 *
 * Connects to the debug WebSocket server and renders a live view of:
 *   - Spatial map (group grid with entity indicators)
 *   - Entity inspector (selected entity details)
 *   - Aggro links (who is fighting whom)
 *   - Performance stats (tick rate, entity counts)
 *   - Log stream (real-time structured logs)
 *
 * Usage: node tools/tui.js [host:port]
 * Default: ws://localhost:8001
 *
 * Controls:
 *   Arrow keys / hjkl  Navigate map cursor
 *   Tab                 Cycle focus between panels
 *   q / Ctrl-C          Quit
 */

'use strict';

const blessed = require('blessed');
const WebSocket = require('ws');

// Connection
const endpoint = process.argv[2] || 'ws://localhost:8001';
let ws = null;
let reconnectTimer = null;
let lastSnapshot = null;

// Map cursor state
let cursorX = 3;
let cursorY = 13;
const MAP_COLS = 6;
const MAP_ROWS = 26;

// ─── Screen Setup ────────────────────────────────────────────

const screen = blessed.screen({
  smartCSR: true,
  title: 'Fracture Server TUI',
  fullUnicode: true,
});

// ─── Layout ──────────────────────────────────────────────────

const headerBox = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 1,
  content: '',
  style: { fg: 'black', bg: 'white', bold: true },
});

const mapBox = blessed.box({
  parent: screen,
  top: 1,
  left: 0,
  width: 32,
  height: MAP_ROWS + 2,
  border: { type: 'line' },
  label: ' {bold}World Map{/bold} ',
  tags: true,
  style: {
    border: { fg: 'cyan' },
    label: { fg: 'cyan', bold: true },
  },
});

const inspectorBox = blessed.box({
  parent: screen,
  top: 1,
  left: 32,
  width: '100%-32',
  height: 14,
  border: { type: 'line' },
  label: ' {bold}Inspector{/bold} ',
  tags: true,
  scrollable: true,
  style: {
    border: { fg: 'yellow' },
    label: { fg: 'yellow', bold: true },
  },
});

const aggroBox = blessed.box({
  parent: screen,
  top: 15,
  left: 32,
  width: '100%-32',
  height: 13,
  border: { type: 'line' },
  label: ' {bold}Aggro Links{/bold} ',
  tags: true,
  scrollable: true,
  style: {
    border: { fg: 'red' },
    label: { fg: 'red', bold: true },
  },
});

const statsBox = blessed.box({
  parent: screen,
  top: MAP_ROWS + 3,
  left: 0,
  width: 32,
  height: 5,
  border: { type: 'line' },
  label: ' {bold}Stats{/bold} ',
  tags: true,
  style: {
    border: { fg: 'green' },
    label: { fg: 'green', bold: true },
  },
});

const logBox = blessed.box({
  parent: screen,
  top: MAP_ROWS + 8,
  left: 0,
  width: '100%',
  height: '100%-' + (MAP_ROWS + 8),
  border: { type: 'line' },
  label: ' {bold}Log Stream{/bold} ',
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  scrollbar: { style: { bg: 'blue' } },
  mouse: true,
  style: {
    border: { fg: 'blue' },
    label: { fg: 'blue', bold: true },
  },
});

// ─── Rendering ───────────────────────────────────────────────

const LEVEL_COLORS = {
  trace: 'gray',
  debug: 'cyan',
  info: 'green',
  warn: 'yellow',
  error: 'red',
  fatal: 'red',
};

function renderHeader(snapshot) {
  const s = snapshot?.stats || {};
  const connStatus = ws?.readyState === WebSocket.OPEN ? '{green-fg}CONNECTED{/}' : '{red-fg}DISCONNECTED{/}';
  headerBox.setContent(
    `  FRACTURE TUI  │  ${connStatus}  │  Players: ${s.playerCount || 0}  │  Mobs: ${s.mobCount || 0}  │  Entities: ${s.entityCount || 0}  │  ${endpoint}`
  );
}

function renderMap(snapshot) {
  if (!snapshot) {
    mapBox.setContent('{center}Waiting for data...{/center}');
    return;
  }

  const groups = snapshot.groups || {};
  const lines = [];

  // Zone labels across top (6 columns)
  lines.push('  0  1  2  3  4  5 ');

  for (let y = 0; y < MAP_ROWS; y++) {
    let row = y.toString().padStart(2) ;
    for (let x = 0; x < MAP_COLS; x++) {
      const gid = `${x}-${y}`;
      const g = groups[gid];
      const isCursor = x === cursorX && y === cursorY;

      let cell;
      if (!g || (g.players === 0 && g.mobs === 0)) {
        cell = '{gray-fg}\u00b7{/}'; // middle dot
      } else if (g.players > 0 && g.mobs > 0) {
        cell = '{red-fg}!{/}'; // combat
      } else if (g.players > 0) {
        cell = '{cyan-fg}@{/}'; // player (nethack convention)
      } else if (g.mobs > 0) {
        if (g.mobs >= 5) cell = '{yellow-fg}M{/}'; // many mobs
        else cell = '{yellow-fg}m{/}'; // few mobs
      } else {
        cell = '{gray-fg}\u00b7{/}';
      }

      if (isCursor) {
        cell = '{white-bg}' + cell + '{/white-bg}';
      }

      row += ' ' + cell + ' ';
    }
    lines.push(row);
  }

  mapBox.setContent(lines.join('\n'));
}

function renderInspector(snapshot) {
  if (!snapshot) {
    inspectorBox.setContent('No data');
    return;
  }

  const gid = `${cursorX}-${cursorY}`;
  const lines = [];
  lines.push(`{bold}Group: ${gid}{/bold}`);
  lines.push('');

  // Find entities in this group
  const playersHere = (snapshot.players || []).filter(p => p.group === gid);
  const mobsHere = (snapshot.mobs || []).filter(m => m.group === gid && !m.isDead);
  const aggroHere = snapshot.aggro || [];

  if (playersHere.length === 0 && mobsHere.length === 0) {
    lines.push('{gray-fg}Empty zone{/}');
  }

  for (const p of playersHere) {
    const hpPct = p.maxHp > 0 ? Math.round((p.hp / p.maxHp) * 100) : 0;
    const hpColor = hpPct > 60 ? 'green' : hpPct > 25 ? 'yellow' : 'red';
    lines.push(`{cyan-fg}{bold}@ ${p.name}{/bold}{/} Lv${p.level}`);
    lines.push(`  HP: {${hpColor}-fg}${p.hp}/${p.maxHp}{/} (${hpPct}%)`);
    lines.push(`  Pos: (${p.x}, ${p.y})  Zone: ${p.zone}`);
    const attacking = aggroHere.filter(a => a.playerId === p.id);
    if (attacking.length > 0) {
      lines.push(`  {red-fg}Aggro: ${attacking.length} mob${attacking.length > 1 ? 's' : ''}{/}`);
    }
    if (p.target) {
      const targetMob = (snapshot.mobs || []).find(m => m.id === p.target);
      lines.push(`  Target: ${targetMob ? targetMob.kind + '#' + targetMob.id : '#' + p.target}`);
    }
    lines.push('');
  }

  for (const m of mobsHere.slice(0, 8)) {
    const hpPct = m.maxHp > 0 ? Math.round((m.hp / m.maxHp) * 100) : 0;
    const hpColor = hpPct > 60 ? 'green' : hpPct > 25 ? 'yellow' : 'red';
    const aggroCount = aggroHere.filter(a => a.mobId === m.id).length;
    const aggroStr = aggroCount > 0 ? ` {red-fg}[${aggroCount} aggro]{/}` : '';
    lines.push(`{yellow-fg}${m.kind}{/}#${m.id} Lv${m.level}${aggroStr}`);
    lines.push(`  HP: {${hpColor}-fg}${m.hp}/${m.maxHp}{/}  Pos: (${m.x}, ${m.y})`);
  }
  if (mobsHere.length > 8) {
    lines.push(`  {gray-fg}... and ${mobsHere.length - 8} more{/}`);
  }

  inspectorBox.setContent(lines.join('\n'));
}

function renderAggro(snapshot) {
  if (!snapshot || !snapshot.aggro || snapshot.aggro.length === 0) {
    aggroBox.setContent('{gray-fg}No active aggro{/}');
    return;
  }

  const sorted = snapshot.aggro.slice().sort((a, b) => b.hate - a.hate);
  const lines = sorted.slice(0, 15).map(a => {
    const hateBar = '\u2588'.repeat(Math.min(Math.ceil(a.hate / 10), 20));
    return `{yellow-fg}${a.mobKind}{/}#${a.mobId} {red-fg}\u2192{/} {cyan-fg}${a.playerName}{/} hate:${a.hate} {red-fg}${hateBar}{/}`;
  });

  if (sorted.length > 15) {
    lines.push(`{gray-fg}... ${sorted.length - 15} more links{/}`);
  }

  aggroBox.setContent(lines.join('\n'));
}

function renderStats(snapshot) {
  if (!snapshot) {
    statsBox.setContent('No data');
    return;
  }

  const s = snapshot.stats || {};
  const gid = `${cursorX}-${cursorY}`;
  const g = (snapshot.groups || {})[gid];

  const lines = [
    `UPS: ${s.ups || 50}  Entities: ${s.entityCount || 0}`,
    `Players: {cyan-fg}${s.playerCount || 0}{/}  Mobs: {yellow-fg}${s.mobCount || 0}{/}`,
    `Cursor: {white-fg}${gid}{/} (${g ? g.players + 'P ' + g.mobs + 'M' : 'empty'})`,
  ];

  statsBox.setContent(lines.join('\n'));
}

const MAX_LOG_LINES = 200;
const logLines = [];

function addLogLine(entry) {
  const time = new Date(entry.time).toISOString().slice(11, 19);
  const color = LEVEL_COLORS[entry.level] || 'white';
  const mod = entry.module ? `[${entry.module}]` : '';
  const dataStr = Object.keys(entry.data || {}).length > 0
    ? ' ' + JSON.stringify(entry.data).slice(0, 60)
    : '';
  const line = `{gray-fg}${time}{/} {${color}-fg}${(entry.level || '').toUpperCase().padEnd(5)}{/} {magenta-fg}${mod.padEnd(16)}{/} ${entry.msg}${dataStr}`;
  logLines.push(line);
  if (logLines.length > MAX_LOG_LINES) logLines.shift();
}

function renderLogs() {
  logBox.setContent(logLines.join('\n'));
  logBox.setScrollPerc(100);
}

function renderAll() {
  renderHeader(lastSnapshot);
  renderMap(lastSnapshot);
  renderInspector(lastSnapshot);
  renderAggro(lastSnapshot);
  renderStats(lastSnapshot);
  renderLogs();
  screen.render();
}

// ─── WebSocket Connection ────────────────────────────────────

function connect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  ws = new WebSocket(endpoint);

  ws.on('open', () => {
    renderAll();
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'snapshot') {
        lastSnapshot = msg.data;
        // Load initial logs from snapshot
        if (msg.data.recentLogs && logLines.length === 0) {
          for (const entry of msg.data.recentLogs) {
            addLogLine(entry);
          }
        }
        renderAll();
      } else if (msg.type === 'log') {
        addLogLine(msg.data);
        renderLogs();
        screen.render();
      } else if (msg.type === 'result') {
        showCommandResult(msg.data);
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  ws.on('close', () => {
    renderHeader(lastSnapshot);
    screen.render();
    reconnectTimer = setTimeout(connect, 2000);
  });

  ws.on('error', () => {
    // Will trigger close
  });
}

// ─── Command Bar ─────────────────────────────────────────────

const cmdBox = blessed.textbox({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  style: { fg: 'white', bg: 'black' },
  inputOnFocus: true,
});

const cmdPrompt = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 1,
  content: ' {gray-fg}Press {:} to enter commands, q to quit, arrows/hjkl to navigate{/}',
  tags: true,
  style: { fg: 'gray', bg: 'black' },
});

let commandMode = false;
let cmdHistory = [];
let cmdHistoryIdx = -1;

function enterCommandMode() {
  commandMode = true;
  cmdPrompt.hide();
  cmdBox.show();
  cmdBox.setValue('');
  cmdBox.focus();
  screen.render();
}

function exitCommandMode() {
  commandMode = false;
  cmdBox.hide();
  cmdPrompt.show();
  screen.render();
}

function sendCommand(input) {
  if (!input || !ws || ws.readyState !== WebSocket.OPEN) return;
  cmdHistory.push(input);
  if (cmdHistory.length > 50) cmdHistory.shift();
  cmdHistoryIdx = cmdHistory.length;
  ws.send(JSON.stringify({ type: 'command', command: input }));
}

function showCommandResult(result) {
  const color = result.ok ? 'green' : 'red';
  const prefix = result.ok ? 'OK' : 'ERR';
  const lines = (result.msg || '').split('\n');
  for (const line of lines) {
    addLogLine({
      time: Date.now(),
      level: result.ok ? 'info' : 'error',
      module: 'CMD',
      msg: `[${prefix}] ${line}`,
      data: {},
    });
  }
  renderLogs();
  screen.render();
}

cmdBox.on('submit', (value) => {
  exitCommandMode();
  sendCommand(value);
});

cmdBox.on('cancel', () => {
  exitCommandMode();
});

// ─── Key Bindings ────────────────────────────────────────────

screen.key(['q', 'C-c'], () => {
  if (commandMode) return;
  if (ws) ws.close();
  process.exit(0);
});

screen.key(':', () => {
  if (!commandMode) enterCommandMode();
});

// Arrow keys + vim keys for map navigation (only when not in command mode)
screen.key(['up', 'k'], () => {
  if (commandMode) return;
  cursorY = Math.max(0, cursorY - 1);
  renderAll();
});
screen.key(['down', 'j'], () => {
  if (commandMode) return;
  cursorY = Math.min(MAP_ROWS - 1, cursorY + 1);
  renderAll();
});
screen.key(['left', 'h'], () => {
  if (commandMode) return;
  cursorX = Math.max(0, cursorX - 1);
  renderAll();
});
screen.key(['right', 'l'], () => {
  if (commandMode) return;
  cursorX = Math.min(MAP_COLS - 1, cursorX + 1);
  renderAll();
});

// Quick shortcuts
screen.key('?', () => {
  if (commandMode) return;
  sendCommand('help');
});

screen.key('/', () => {
  if (commandMode) return;
  enterCommandMode();
  cmdBox.setValue('find ');
  screen.render();
});

screen.key('i', () => {
  if (commandMode) return;
  // Inspect first entity in selected group
  if (!lastSnapshot) return;
  const gid = `${cursorX}-${cursorY}`;
  const player = (lastSnapshot.players || []).find(p => p.group === gid);
  const mob = (lastSnapshot.mobs || []).find(m => m.group === gid && !m.isDead);
  const id = player?.id || mob?.id;
  if (id) sendCommand(`inspect ${id}`);
});

// ─── Start ───────────────────────────────────────────────────

cmdBox.hide();
renderAll();
connect();
