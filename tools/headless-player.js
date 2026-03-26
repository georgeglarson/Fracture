#!/usr/bin/env node
/**
 * Fracture Headless Player — AI-readable textual game client
 *
 * Connects via Socket.IO, plays the game through the message protocol,
 * and logs every state change in a human/AI-readable format. No browser needed.
 *
 * Usage:
 *   node tools/headless-player.js                    Auto-play: walk, fight, loot
 *   node tools/headless-player.js --observe           Just connect and log everything
 *   node tools/headless-player.js --name Bob --pass x Login as existing character
 *   node tools/headless-player.js --host url          Connect to remote server
 *   node tools/headless-player.js --duration 30       Run for N seconds (default 60)
 *
 * Exit codes: 0=clean, 1=connection failed, 2=auth failed, 3=runtime error
 */

'use strict';

const { io } = require('socket.io-client');

// ============================================================================
// Message type constants (mirrored from shared/ts/gametypes.ts)
// ============================================================================

const MSG = {
  HELLO: 0, WELCOME: 1, SPAWN: 2, DESPAWN: 3, MOVE: 4,
  LOOTMOVE: 5, AGGRO: 6, ATTACK: 7, HIT: 8, HURT: 9,
  HEALTH: 10, CHAT: 11, LOOT: 12, EQUIP: 13, DROP: 14,
  TELEPORT: 15, DAMAGE: 16, POPULATION: 17, KILL: 18,
  LIST: 19, WHO: 20, ZONE: 21, HP: 22, BLINK: 23, DESTROY: 24,
  NPCTALK: 27, NPCTALK_RESPONSE: 28, COMPANION_HINT: 29,
  ENTITY_THOUGHT: 36, XP_GAIN: 41, LEVEL_UP: 42, GOLD_GAIN: 43,
  INVENTORY_INIT: 66, INVENTORY_ADD: 67, INVENTORY_REMOVE: 68,
  INVENTORY_PICKUP: 74, AUTH_FAIL: 86, SKILL_INIT: 92,
};

const MSG_NAMES = {};
for (const [k, v] of Object.entries(MSG)) MSG_NAMES[v] = k;

// Entity kind constants
const KINDS = {
  WARRIOR: 1, RAT: 2, SKELETON: 3, GOBLIN: 4, OGRE: 5,
  CRAB: 7, BAT: 8, SNAKE: 11, SKELETON2: 24, DEATHKNIGHT: 26,
  CLOTHARMOR: 21, LEATHERARMOR: 22, MAILARMOR: 23, PLATEARMOR: 24,
  SWORD1: 60, SWORD2: 61, AXE: 65, FLASK: 35, BURGER: 36,
  FIREFOX: 20, CHEST: 37,
};

const KIND_NAMES = {};
for (const [k, v] of Object.entries(KINDS)) KIND_NAMES[v] = k;

function kindName(k) { return KIND_NAMES[k] || `kind:${k}`; }
function msgName(t) { return MSG_NAMES[t] || `msg:${t}`; }

// ============================================================================
// Args
// ============================================================================

const args = process.argv.slice(2);
function getArg(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const HOST = getArg('--host', 'http://localhost:8000');
const NAME = getArg('--name', '');
const PASS = getArg('--pass', '');
const DURATION = parseInt(getArg('--duration', '60'), 10);
const OBSERVE = args.includes('--observe');

// Guest credentials if none provided
const playerName = NAME || 'Bot_' + Math.random().toString(36).substring(2, 7);
const playerPass = PASS || Math.random().toString(36).substring(2, 10);

// ============================================================================
// State
// ============================================================================

const state = {
  id: null,
  name: playerName,
  x: 0, y: 0,
  hp: 0, maxHp: 0,
  level: 1, xp: 0, gold: 0,
  weapon: KINDS.SWORD1,
  armor: KINDS.CLOTHARMOR,
  isDead: false,

  // World knowledge
  entities: {},     // id -> {kind, x, y, name?, hp?, maxHp?, level?}
  nearbyMobs: [],   // ids of known mobs

  // Combat
  target: null,
  attacking: false,
  lastHitTime: 0,

  // Stats
  kills: 0,
  damageDealt: 0,
  damageTaken: 0,
  messagesIn: 0,
  messagesOut: 0,
};

// ============================================================================
// Logging
// ============================================================================

const T0 = Date.now();
function ts() { return '+' + ((Date.now() - T0) / 1000).toFixed(1) + 's'; }

function log(tag, msg, data) {
  const d = data ? ' ' + JSON.stringify(data) : '';
  console.log(`[${ts()}] [${tag}] ${msg}${d}`);
}

// ============================================================================
// Connection
// ============================================================================

log('CONN', `Connecting to ${HOST} as "${playerName}"...`);

const socket = io(HOST, {
  transports: ['websocket'],
  reconnection: false,
  timeout: 10000,
});

let gameLoopInterval = null;
let shutdownTimer = null;

socket.on('connect', () => {
  log('CONN', 'Connected, sending HELLO');
  send([MSG.HELLO, playerName, KINDS.CLOTHARMOR, KINDS.SWORD1, 0, playerPass]);
});

socket.on('connect_error', (err) => {
  log('ERR', `Connection failed: ${err.message}`);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  log('CONN', `Disconnected: ${reason}`);
  shutdown(0);
});

// ============================================================================
// Message handling
// ============================================================================

socket.on('message', (data) => {
  state.messagesIn++;

  // Handle string messages (e.g. 'go' handshake)
  if (typeof data === 'string') {
    if (data === 'go') log('HAND', 'Server ready for HELLO');
    return;
  }

  // Handle batched messages
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (const sub of data) handleMessage(sub);
    return;
  }

  handleMessage(data);
});

function handleMessage(msg) {
  if (!Array.isArray(msg) || msg.length === 0) return;
  const type = msg[0];

  switch (type) {
    case MSG.WELCOME: handleWelcome(msg); break;
    case MSG.AUTH_FAIL: handleAuthFail(msg); break;
    case MSG.SPAWN: handleSpawn(msg); break;
    case MSG.DESPAWN: handleDespawn(msg); break;
    case MSG.MOVE: handleMove(msg); break;
    case MSG.HEALTH: handleHealth(msg); break;
    case MSG.DAMAGE: handleDamage(msg); break;
    case MSG.KILL: handleKill(msg); break;
    case MSG.EQUIP: handleEquip(msg); break;
    case MSG.ATTACK: handleAttack(msg); break;
    case MSG.CHAT: handleChat(msg); break;
    case MSG.HP: handleMaxHp(msg); break;
    case MSG.XP_GAIN: handleXpGain(msg); break;
    case MSG.LEVEL_UP: handleLevelUp(msg); break;
    case MSG.GOLD_GAIN: handleGoldGain(msg); break;
    case MSG.DROP: handleDrop(msg); break;
    case MSG.POPULATION: handlePopulation(msg); break;
    case MSG.TELEPORT: handleTeleport(msg); break;
    case MSG.LIST: handleList(msg); break;
    case MSG.NPCTALK_RESPONSE: handleNpcTalk(msg); break;
    case MSG.ENTITY_THOUGHT: handleThought(msg); break;
    case MSG.COMPANION_HINT: handleHint(msg); break;
    case MSG.INVENTORY_INIT: log('INV', 'Inventory initialized'); break;
    case MSG.INVENTORY_ADD: log('INV', `Item added to slot ${msg[1]}`, { kind: kindName(msg[2]), count: msg[4] }); break;
    case MSG.SKILL_INIT: log('SKILL', 'Skills initialized'); break;
    default:
      // Log unknown but don't spam
      if (![MSG.DESTROY, MSG.BLINK, MSG.LOOTMOVE, MSG.ZONE, MSG.WHO, MSG.LIST].includes(type)) {
        log('MSG', msgName(type), msg.slice(1));
      }
  }
}

// ============================================================================
// Message handlers
// ============================================================================

function handleWelcome(msg) {
  state.id = msg[1];
  state.name = msg[2];
  state.x = msg[3];
  state.y = msg[4];
  state.hp = msg[5];
  state.maxHp = msg[6];
  state.level = msg[7] || 1;
  state.xp = msg[8] || 0;
  state.gold = msg[10] || 0;
  log('AUTH', `WELCOME! id=${state.id} pos=(${state.x},${state.y}) HP=${state.hp}/${state.maxHp} Lv${state.level} Gold:${state.gold}`);

  // Start game loop
  if (!OBSERVE) {
    gameLoopInterval = setInterval(gameLoop, 500);
  }
  shutdownTimer = setTimeout(() => shutdown(0), DURATION * 1000);
}

function handleAuthFail(msg) {
  log('AUTH', `FAILED: ${msg[1]}`);
  process.exit(2);
}

function handleSpawn(msg) {
  const id = msg[1], kind = msg[2], x = msg[3], y = msg[4];
  const isMob = kind >= 2 && kind <= 30 && kind !== 20;
  const isPlayer = kind === KINDS.WARRIOR;

  const entity = { kind, x, y };

  if (isPlayer) {
    // Player spawn: [SPAWN, id, kind, x, y, name, orientation, armor, weapon, target?]
    entity.name = msg[5];
    entity.armor = msg[7];
    entity.weapon = msg[8];
    log('SPAWN', `Player "${entity.name}" at (${x},${y})`, { id, armor: kindName(entity.armor), weapon: kindName(entity.weapon) });
  } else if (isMob) {
    // Mob spawn: [SPAWN, id, kind, x, y, orientation, hp, maxHp, level, target?]
    entity.hp = msg[6];
    entity.maxHp = msg[7];
    entity.level = msg[8];
    log('SPAWN', `${kindName(kind)} Lv${entity.level} at (${x},${y}) HP=${entity.hp}/${entity.maxHp}`, { id });
    if (!state.nearbyMobs.includes(id)) state.nearbyMobs.push(id);
  } else {
    log('SPAWN', `${kindName(kind)} at (${x},${y})`, { id });
  }

  state.entities[id] = entity;
}

function handleDespawn(msg) {
  const id = msg[1];
  const ent = state.entities[id];
  if (ent) {
    log('DESP', `${kindName(ent.kind)}${ent.name ? ' "' + ent.name + '"' : ''} despawned`, { id });
    delete state.entities[id];
    state.nearbyMobs = state.nearbyMobs.filter(m => m !== id);
    if (state.target === id) {
      state.target = null;
      state.attacking = false;
      log('COMBAT', 'Target gone, disengaging');
    }
  }
}

function handleMove(msg) {
  const id = msg[1], x = msg[2], y = msg[3];
  if (state.entities[id]) {
    state.entities[id].x = x;
    state.entities[id].y = y;
  }
  if (id === state.id) {
    state.x = x;
    state.y = y;
  }
}

function handleHealth(msg) {
  const newHp = msg[1];
  const diff = newHp - state.hp;
  state.hp = newHp;
  if (diff < 0) {
    state.damageTaken += Math.abs(diff);
    log('HP', `Took ${Math.abs(diff)} damage → HP=${state.hp}/${state.maxHp}`);
  } else if (diff > 0) {
    log('HP', `Healed ${diff} → HP=${state.hp}/${state.maxHp}`);
  }
  if (state.hp <= 0) {
    state.isDead = true;
    log('DEATH', `YOU DIED. Kills:${state.kills} DmgDealt:${state.damageDealt} DmgTaken:${state.damageTaken}`);
  }
}

function handleDamage(msg) {
  const mobId = msg[1], dmg = msg[2], hp = msg[3], maxHp = msg[4];
  const ent = state.entities[mobId];
  const name = ent ? kindName(ent.kind) : `#${mobId}`;
  state.damageDealt += dmg;
  if (ent) { ent.hp = hp; ent.maxHp = maxHp; }
  log('DMG', `Hit ${name} for ${dmg} → HP=${hp}/${maxHp}`, { id: mobId });
}

function handleKill(msg) {
  state.kills++;
  log('KILL', `Killed ${kindName(msg[1])}! Total kills: ${state.kills}`);
}

function handleEquip(msg) {
  const playerId = msg[1], itemKind = msg[2];
  if (playerId === state.id) {
    log('EQUIP', `Equipped ${kindName(itemKind)}`);
  }
}

function handleAttack(msg) {
  const attackerId = msg[1], targetId = msg[2];
  const attacker = state.entities[attackerId];
  const target = state.entities[targetId];
  const aName = attacker?.name || kindName(attacker?.kind) || `#${attackerId}`;
  const tName = target?.name || kindName(target?.kind) || `#${targetId}`;
  if (targetId === state.id) {
    log('COMBAT', `${aName} is attacking YOU`);
  }
}

function handleChat(msg) {
  const id = msg[1], text = msg[2];
  const ent = state.entities[id];
  const name = ent?.name || `#${id}`;
  log('CHAT', `${name}: ${text}`);
}

function handleMaxHp(msg) {
  state.maxHp = msg[1];
}

function handleXpGain(msg) {
  state.xp = msg[2];
  log('XP', `+${msg[1]} XP (${state.xp}/${msg[3]})`);
}

function handleLevelUp(msg) {
  state.level = msg[1];
  log('LEVEL', `LEVEL UP! Now level ${state.level}`);
}

function handleGoldGain(msg) {
  state.gold = msg[2];
  log('GOLD', `+${msg[1]} gold (total: ${state.gold})`);
}

function handleDrop(msg) {
  const mobId = msg[1], itemId = msg[2], kind = msg[3];
  const mob = state.entities[mobId];
  const x = mob?.x ?? '?', y = mob?.y ?? '?';
  state.entities[itemId] = { kind, x, y };
  log('DROP', `${kindName(kind)} dropped at (${x},${y})`, { itemId, fromMob: mobId });
}

function handlePopulation(msg) {
  log('POP', `Players: ${msg[1]} world, ${msg[2]} total`);
}

function handleTeleport(msg) {
  const id = msg[1], x = msg[2], y = msg[3];
  if (id === state.id) {
    state.x = x;
    state.y = y;
    log('TELE', `Teleported to (${x},${y})`);
  }
}

function handleList(msg) {
  // Server tells us which entities exist in our zone — request details for unknowns
  const ids = msg.slice(1);
  const unknown = ids.filter(id => !state.entities[id]);
  if (unknown.length > 0) {
    send([MSG.WHO, ...unknown]);
  }
}

function handleNpcTalk(msg) {
  log('NPC', `NPC says: "${msg[2]}"`);
}

function handleThought(msg) {
  const id = msg[1], text = msg[2];
  const ent = state.entities[id];
  log('THOUGHT', `${kindName(ent?.kind) || '#' + id} thinks: "${text}"`);
}

function handleHint(msg) {
  log('HINT', msg[1]);
}

// ============================================================================
// Send helper
// ============================================================================

function send(msg) {
  state.messagesOut++;
  socket.emit('message', msg);
}

// ============================================================================
// Game AI loop — finds mobs, walks to them, attacks
// ============================================================================

function gameLoop() {
  if (state.isDead || !state.id) return;

  // Currently attacking? Send HIT if cooldown elapsed
  if (state.attacking && state.target) {
    const mob = state.entities[state.target];
    if (!mob) {
      state.attacking = false;
      state.target = null;
      return;
    }
    const now = Date.now();
    if (now - state.lastHitTime >= 900) {
      const dist = chebyshev(state.x, state.y, mob.x, mob.y);
      if (dist <= 1) {
        send([MSG.HIT, state.target]);
        state.lastHitTime = now;
      } else if (dist <= 3) {
        // Walk closer
        walkToward(mob.x, mob.y);
      } else {
        // Lost target
        log('COMBAT', 'Target too far, disengaging');
        state.attacking = false;
        state.target = null;
      }
    }
    return;
  }

  // Find nearest mob to attack
  const nearestMob = findNearestMob();
  if (nearestMob) {
    const mob = state.entities[nearestMob];
    const dist = chebyshev(state.x, state.y, mob.x, mob.y);

    if (dist <= 1) {
      // Adjacent — attack!
      state.target = nearestMob;
      state.attacking = true;
      send([MSG.ATTACK, nearestMob]);
      send([MSG.HIT, nearestMob]);
      state.lastHitTime = Date.now();
      log('COMBAT', `Attacking ${kindName(mob.kind)} at (${mob.x},${mob.y})`, { dist, id: nearestMob });
    } else if (dist <= 8) {
      // Walk toward mob
      walkToward(mob.x, mob.y);
    } else {
      // Wander randomly
      wander();
    }
  } else {
    wander();
  }
}

function findNearestMob() {
  let nearest = null, bestDist = Infinity;
  for (const id of state.nearbyMobs) {
    const mob = state.entities[id];
    if (!mob) continue;
    const d = chebyshev(state.x, state.y, mob.x, mob.y);
    if (d < bestDist) {
      bestDist = d;
      nearest = id;
    }
  }
  return nearest;
}

function chebyshev(x1, y1, x2, y2) {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

function walkToward(tx, ty) {
  const dx = Math.sign(tx - state.x);
  const dy = Math.sign(ty - state.y);
  const newX = state.x + dx;
  const newY = state.y + dy;
  send([MSG.MOVE, newX, newY]);
  state.x = newX;
  state.y = newY;
}

function wander() {
  const dx = Math.floor(Math.random() * 3) - 1;
  const dy = Math.floor(Math.random() * 3) - 1;
  if (dx === 0 && dy === 0) return;
  const newX = state.x + dx;
  const newY = state.y + dy;
  send([MSG.MOVE, newX, newY]);
  state.x = newX;
  state.y = newY;
}

// ============================================================================
// Shutdown
// ============================================================================

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  if (shutdownTimer) clearTimeout(shutdownTimer);

  log('END', '=== SESSION SUMMARY ===');
  log('END', `Player: ${state.name} (id=${state.id})`);
  log('END', `Final pos: (${state.x},${state.y}) HP=${state.hp}/${state.maxHp} Lv${state.level}`);
  log('END', `Kills: ${state.kills} | Damage dealt: ${state.damageDealt} | Damage taken: ${state.damageTaken}`);
  log('END', `Gold: ${state.gold} | XP: ${state.xp}`);
  log('END', `Messages: ${state.messagesIn} in / ${state.messagesOut} out`);
  log('END', `Duration: ${((Date.now() - T0) / 1000).toFixed(1)}s`);
  log('END', `Dead: ${state.isDead}`);

  if (socket.connected) socket.disconnect();
  setTimeout(() => process.exit(code), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
