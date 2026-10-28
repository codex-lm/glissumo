/** Duo: deterministic shared-row duel. No browser, network or wall-clock dependencies. */
export const COLS = 7;
export const ROWS = 5;
export const MATCH_MS = 120000;
export const MOVE_MS = 180;
export const CAPACITY = 3;
export const MAX_SPARKS = 11;
export const STEAL_MS = 900;
export const constants = Object.freeze({ COLS, ROWS, MATCH_MS, MOVE_MS, CAPACITY, MAX_SPARKS, STEAL_MS });

const ACTIONS = new Set(['up', 'down', 'left', 'right']);
const wrap = x => (x + COLS) % COLS;
const distanceX = (a, b) => Math.min(Math.abs(a - b), COLS - Math.abs(a - b));

function seedNumber(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 1;
  let value = 2166136261;
  for (const character of String(seed)) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return (value >>> 0) || 1;
}

function random(state) {
  let value = state.rng;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rng = value >>> 0;
  return state.rng / 4294967296;
}

function effect(state, type, player, x, y, extra = {}) {
  state.effects.push({ id: state.nextEffect++, type, player, x, y, ttl: 700, ...extra });
  // A snapshot stays small even if callers submit a burst of actions.
  if (state.effects.length > 18) state.effects.splice(0, state.effects.length - 18);
}

function spawnSpark(state) {
  if (state.sparks.length >= MAX_SPARKS) return;
  const choices = [];
  // New sparks appear between the banks. Existing sparks can travel onto a bank.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (!state.sparks.some(spark => spark.x === x && spark.y === y)
        && !state.players.some(player => player.x === x && player.y === y)) choices.push({ x, y });
    }
  }
  if (!choices.length) return;
  const cell = choices[Math.floor(random(state) * choices.length)];
  state.sparks.push({ id: state.nextSpark++, ...cell });
}

export function createGame(seed = 1) {
  const normalized = seedNumber(seed);
  const state = {
    seed: normalized, rng: normalized, phase: 'playing', elapsed: 0, timeLeft: MATCH_MS,
    players: [
      { x: 0, y: 3, cargo: 0, score: 0, cooldown: 0, stealCooldown: 0, lastAction: null, lastMoveAt: null },
      { x: 6, y: 1, cargo: 0, score: 0, cooldown: 0, stealCooldown: 0, lastAction: null, lastMoveAt: null },
    ],
    sparks: [], effects: [], nextSpark: 1, nextEffect: 1, spawnClock: 0, turn: 0,
  };
  for (let i = 0; i < MAX_SPARKS; i++) spawnSpark(state);
  return state;
}

function settlePlayers(state) {
  for (let index = 0; index < 2; index++) {
    const player = state.players[index];
    const sparkIndex = state.sparks.findIndex(spark => spark.x === player.x && spark.y === player.y);
    if (sparkIndex >= 0 && player.cargo < CAPACITY) {
      state.sparks.splice(sparkIndex, 1);
      player.cargo++;
      effect(state, 'collect', index, player.x, player.y, { amount: 1 });
    }
    if (player.x === (index === 0 ? 0 : COLS - 1) && player.cargo > 0) {
      const amount = player.cargo;
      player.score += amount;
      player.cargo = 0;
      effect(state, 'bank', index, player.x, player.y, { amount });
    }
  }
}

function movePlayer(state, index, action) {
  const player = state.players[index];
  if (player.cooldown > 0 || !ACTIONS.has(action)) return false;
  if (action === 'up' || action === 'down') {
    const nextY = player.y + (action === 'up' ? -1 : 1);
    if (nextY < 0 || nextY >= ROWS) return false;
    const otherIndex = 1 - index;
    const other = state.players[otherIndex];
    if (other.x === player.x && other.y === nextY) {
      other.y = player.y;
      if (player.stealCooldown <= 0 && other.stealCooldown <= 0 && other.cargo > 0 && player.cargo < CAPACITY) {
        player.cargo++;
        other.cargo--;
        player.stealCooldown = STEAL_MS;
        other.stealCooldown = STEAL_MS;
        effect(state, 'steal', index, player.x, nextY, { amount: 1 });
      } else {
        effect(state, 'bump', index, player.x, nextY);
      }
    }
    player.y = nextY;
    effect(state, 'hop', index, player.x, player.y);
  } else {
    const direction = action === 'left' ? -1 : 1;
    for (const spark of state.sparks) if (spark.y === player.y) spark.x = wrap(spark.x + direction);
    // Capture the row before shifting either actor. Both riders travel together.
    const row = player.y;
    for (const rider of state.players) if (rider.y === row) rider.x = wrap(rider.x + direction);
    effect(state, 'shift', index, player.x, row, { direction });
  }
  player.cooldown = MOVE_MS;
  player.lastAction = action;
  player.lastMoveAt = state.elapsed;
  settlePlayers(state);
  return true;
}

/**
 * Advance authoritative game time and consume at most one intent per player.
 * Mutates/returns state. Call at a fixed tick (for example 20 ms); send complete
 * snapshots to guests. Intents are directions, never positions or scores.
 */
export function stepGame(state, dt, intents = [null, null]) {
  if (!state || state.phase !== 'playing') return state;
  const delta = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 1000)) : 0;
  const elapsed = Math.min(delta, state.timeLeft);
  state.elapsed += elapsed;
  state.timeLeft = Math.max(0, state.timeLeft - elapsed);
  for (const player of state.players) {
    player.cooldown = Math.max(0, player.cooldown - elapsed);
    player.stealCooldown = Math.max(0, player.stealCooldown - elapsed);
  }
  state.effects = state.effects.map(item => ({ ...item, ttl: item.ttl - elapsed })).filter(item => item.ttl > 0);
  if (state.timeLeft <= 0) {
    state.phase = 'finished';
    effect(state, 'finish', -1, 3, 2);
    return state;
  }
  // Alternate simultaneous priority; neither seat wins every contested tick.
  const first = state.turn % 2;
  movePlayer(state, first, intents[first]);
  movePlayer(state, 1 - first, intents[1 - first]);
  state.turn++;
  state.spawnClock += elapsed;
  while (state.spawnClock >= 650) {
    state.spawnClock -= 650;
    spawnSpark(state);
  }
  return state;
}

function horizontalDirection(from, to) {
  if (from === to) return null;
  return (to - from + COLS) % COLS <= (from - to + COLS) % COLS ? 'right' : 'left';
}

/** Read-only, deterministic opponent. No hidden information or privileged speed. */
export function chooseBotAction(state, index = 1, difficulty = 'normal') {
  if (state.phase !== 'playing' || (index !== 0 && index !== 1)) return null;
  const player = state.players[index];
  const other = state.players[1 - index];
  if (player.cooldown > 0) return null;
  const period = difficulty === 'easy' ? 1000 : difficulty === 'hard' ? 380 : 620;
  // A human-like pause between actions, deterministic even with variable ticks.
  const clock = state.elapsed + index * period / 2;
  if (player.lastMoveAt === null ? state.elapsed < index * period / 2 : state.elapsed - player.lastMoveAt < period) return null;
  const home = index === 0 ? 0 : COLS - 1;
  if (difficulty !== 'easy' && player.x === other.x && Math.abs(player.y - other.y) === 1
    && other.cargo > 0 && player.cargo < CAPACITY && player.stealCooldown <= 0 && other.stealCooldown <= 0) {
    return other.y < player.y ? 'up' : 'down';
  }
  const adjacent = state.sparks.filter(spark => spark.x === player.x && Math.abs(spark.y - player.y) === 1);
  if (player.cargo < CAPACITY && adjacent.length && (player.cargo < 2 || distanceX(player.x, home) > 1)) {
    return adjacent[0].y < player.y ? 'up' : 'down';
  }
  // Reconsider a moving target periodically. Two riders may otherwise chase
  // each other's moving sparks in a stable left/right oscillation.
  if (!player.cargo && Math.floor(clock / period) % 13 === 0) {
    if (player.y === 0) return 'down';
    if (player.y === ROWS - 1) return 'up';
    return (Math.floor(clock / period / 13) + index) % 2 ? 'up' : 'down';
  }
  if (player.cargo > 0) {
    const homeDirection = horizontalDirection(player.x, home);
    if (player.y === other.y && other.lastAction === (homeDirection === 'left' ? 'right' : 'left')) {
      return index === 0 ? (player.y < ROWS - 1 ? 'down' : 'up') : (player.y > 0 ? 'up' : 'down');
    }
    return homeDirection;
  }
  // Empty opponents pulling the same belt in opposite directions can cancel
  // forever. Change lanes to contest a fresh pickup instead of deadlocking.
  if (player.y === other.y) {
    return index === 0 ? (player.y < ROWS - 1 ? 'down' : 'up') : (player.y > 0 ? 'up' : 'down');
  }

  // Align in the current row, then hop into a spark's row. A spark travelling
  // in our own row cannot be caught horizontally, so leave and approach it.
  let target = null;
  let bestCost = Infinity;
  const nearby = state.sparks.filter(spark => Math.abs(spark.y - player.y) === 1);
  const candidates = nearby.length ? nearby : state.sparks.filter(spark => spark.y !== player.y);
  for (const spark of candidates) {
    const cost = distanceX(player.x, spark.x) + Math.abs(player.y - spark.y)
      + (player.y === spark.y ? 2 : 0) + distanceX(spark.x, home) * 0.12;
    if (cost < bestCost) { target = spark; bestCost = cost; }
  }
  if (!target) return player.y > 0 ? 'up' : 'down';
  if (Math.abs(target.y - player.y) > 1) {
    const nextY = player.y + Math.sign(target.y - player.y);
    // First reach a neighbouring harvest row. Detour around a blocking rider;
    // aligning to the distant spark first can trap two bots in repeated swaps.
    if (other.x === player.x && other.y === nextY) return index === 0 ? 'right' : 'left';
    return target.y < player.y ? 'up' : 'down';
  }
  if (target.x !== player.x) return horizontalDirection(player.x, target.x);
  return target.y < player.y ? 'up' : 'down';
}
