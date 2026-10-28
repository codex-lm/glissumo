import { createGame, stepGame, COLS, ROWS, MATCH_MS, MAX_SPARKS } from './engine.js';

const PROTOCOL = 'duo.v1';
const ACTIONS = new Set(['up', 'down', 'left', 'right']);
const direction = value => value === null || ACTIONS.has(value);
const integer = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
const finite = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;

/** Guests render complete, bounded snapshots; they never simulate authority. */
export function validState(state) {
  return !!state && typeof state === 'object'
    && ['playing', 'finished'].includes(state.phase)
    && finite(state.timeLeft, 0, MATCH_MS) && finite(state.elapsed, 0, MATCH_MS)
    && Array.isArray(state.players) && state.players.length === 2
    && state.players.every(p => p && integer(p.x, 0, COLS - 1) && integer(p.y, 0, ROWS - 1)
      && integer(p.cargo, 0, 3) && integer(p.score, 0, 10000)
      && finite(p.cooldown, 0, 180) && finite(p.stealCooldown, 0, 900) && direction(p.lastAction))
    && Array.isArray(state.sparks) && state.sparks.length <= MAX_SPARKS
    && state.sparks.every(p => p && integer(p.id, 1, 100000) && integer(p.x, 0, COLS - 1) && integer(p.y, 0, ROWS - 1))
    && Array.isArray(state.effects) && state.effects.length <= 18
    && state.effects.every(p => p && integer(p.id, 1, 100000) && integer(p.player, -1, 1)
      && integer(p.x, 0, COLS - 1) && integer(p.y, 0, ROWS - 1) && finite(p.ttl, 0, 1000)
      && ['collect', 'bank', 'steal', 'bump', 'hop', 'shift', 'finish'].includes(p.type)
      && (p.amount === undefined || integer(p.amount, 0, 3))
      && (p.direction === undefined || p.direction === -1 || p.direction === 1));
}

function randomSeed() {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] || 1;
}

/**
 * Fixed host transport. poll(dt) takes milliseconds, normally every 20–40 ms.
 * Held intentions expire after 350 ms. Taps are resent until acknowledged, so
 * a lost press, release, start, result, or rematch packet is recoverable.
 */
export function createNetwork({ onState = () => {}, onStatus = () => {}, onRole = () => {},
  onEnded = () => {}, onReady = () => {}, connectLobby = () => globalThis.LOB7Rooms.connect(),
  seed = randomSeed } = {}) {
  let peer = null, controller = null, generation = 0, role = null, phase = 'idle';
  let state = null, round = 0, tick = 0, lastSnapshot = -1;
  let now = 0, lastSend = -Infinity, lastReceive = 0, lastInput = 0;
  let held = null, remoteHeld = null, localReady = false, remoteReady = false;
  let tapSequence = 0, acceptedTap = 0, acknowledgedTap = 0;
  let inputSequence = 0, receivedInput = -1;
  let taps = [], remoteTaps = [], beforeConnected = [];

  function announceReady() { onReady({ local: localReady, remote: remoteReady, phase, role }); }
  function resetInputs() {
    held = remoteHeld = null; taps = []; remoteTaps = [];
    tapSequence = acceptedTap = acknowledgedTap = 0;
    inputSequence = 0; receivedInput = -1;
    lastInput = now;
  }
  function end(reason = 'closed', notify = true) {
    generation++;
    if (controller) { controller.abort(); controller = null; }
    const old = peer; peer = null;
    if (old) old.close();
    role = null; phase = 'idle'; state = null; round = tick = 0; lastSnapshot = -1;
    localReady = remoteReady = false; beforeConnected = []; resetInputs();
    if (notify) { onStatus(reason); onEnded(reason); }
  }
  function send(packet) {
    if (!peer) return;
    try { peer.send({ protocol: PROTOCOL, ...packet }); }
    catch (error) { if (error?.code !== 'PEER_BUSY') end('closed'); }
  }
  function sendState() {
    if (state) send({ type: 'state', round, tick, ackTap: acknowledgedTap, hostReady: localReady, state });
  }
  function sendInput() { send({ type: 'input', round, seq: ++inputSequence, held, taps }); }
  function tryStart() {
    if (role !== 0 || !localReady || !remoteReady || !['lobby', 'finished'].includes(phase)) return;
    round++; tick = 0; state = createGame(seed()); phase = 'playing';
    localReady = remoteReady = false; resetInputs();
    onState(state); onStatus('playing'); announceReady(); sendState();
  }
  function receive(packet) {
    if (!packet || packet.protocol !== PROTOCOL) return;
    lastReceive = now;
    if (role === 0) {
      if (packet.type === 'ready' && packet.round === round + 1 && ['lobby', 'finished'].includes(phase)) {
        remoteReady = true; announceReady(); tryStart();
      } else if (packet.type === 'input' && packet.round === round && phase === 'playing'
        && integer(packet.seq, 1, 10000000) && packet.seq > receivedInput
        && direction(packet.held) && Array.isArray(packet.taps) && packet.taps.length <= 8
        && packet.taps.every(t => t && integer(t.id, 1, 1000000) && ACTIONS.has(t.action))) {
        remoteHeld = packet.held; lastInput = now; receivedInput = packet.seq;
        for (const tap of packet.taps) {
          if (tap.id === acceptedTap + 1 && remoteTaps.length < 8) {
            remoteTaps.push({ id: tap.id, action: tap.action }); acceptedTap = tap.id;
          }
        }
      }
      // A guest cannot submit state, scores, seeds, roles or authoritative time.
    } else if (role === 1) {
      if (packet.type === 'lobby' && packet.round === round && phase === 'lobby') {
        remoteReady = packet.hostReady === true; announceReady();
      } else if (packet.type === 'state' && integer(packet.round, 1, 1000000)
        && (packet.round === round || packet.round === round + 1)
        && integer(packet.tick, 0, 10000000) && integer(packet.ackTap, 0, 1000000)
        && validState(packet.state)) {
        if (packet.round === round && packet.tick < lastSnapshot) return;
        if (packet.round > round) {
          round = packet.round; lastSnapshot = -1; resetInputs(); localReady = remoteReady = false;
        }
        lastSnapshot = packet.tick;
        taps = taps.filter(t => t.id > packet.ackTap);
        const changed = phase !== packet.state.phase;
        const readinessChanged = remoteReady !== (packet.hostReady === true);
        remoteReady = packet.hostReady === true;
        state = packet.state; phase = state.phase; onState(state);
        if (changed) onStatus(phase);
        if (changed || readinessChanged) announceReady();
      }
    }
  }

  const api = {
    async connect() {
      end('closed', false);
      const run = generation; phase = 'connecting'; controller = new AbortController();
      onStatus('waiting');
      try {
        const lobby = await connectLobby();
        if (run !== generation) return;
        const connected = await lobby.connectPeer({ signal: controller.signal,
          onState(value) { if (run === generation && value === 'connecting') onStatus('connecting'); },
          onMessage(packet) {
            if (run !== generation) return;
            if (!peer) { if (beforeConnected.length < 8) beforeConnected.push(packet); }
            else receive(packet);
          },
          onClose() { if (run === generation) end('closed'); },
        });
        if (run !== generation) { connected.close(); return; }
        peer = connected; role = connected.role === 'host' ? 0 : 1; phase = 'lobby';
        now = 0; lastSend = -Infinity; lastReceive = 0; onRole(role); onStatus('lobby'); announceReady();
        const pending = beforeConnected; beforeConnected = []; pending.forEach(receive);
      } catch (error) {
        if (run !== generation) return;
        end('closed', false);
        onStatus('error', error); onEnded(error?.code || 'failed');
      }
    },
    ready() {
      if (!peer || !['lobby', 'finished'].includes(phase)) return;
      localReady = true; announceReady();
      if (role === 1) send({ type: 'ready', round: round + 1 });
      else tryStart();
    },
    setInput(action) {
      if (!direction(action) || phase !== 'playing') return;
      if (action !== null && action !== held && taps.length < 8) taps.push({ id: ++tapSequence, action });
      held = action;
      if (role === 1) sendInput();
    },
    poll(dt) {
      if (!peer || !Number.isFinite(dt) || dt < 0) return;
      const elapsed = Math.min(dt, 1000); now += elapsed;
      if (now - lastReceive > 10000) { end('closed'); return; }
      if (role === 0 && phase === 'playing') {
        if (now - lastInput > 350) { remoteHeld = null; remoteTaps = []; acknowledgedTap = acceptedTap; }
        const localTap = taps[0], remoteTap = remoteTaps[0];
        const consumeLocal = localTap && state.players[0].cooldown <= elapsed;
        const consumeRemote = remoteTap && state.players[1].cooldown <= elapsed;
        stepGame(state, elapsed, [localTap?.action || held, remoteTap?.action || remoteHeld]);
        if (consumeLocal) taps.shift();
        if (consumeRemote) { remoteTaps.shift(); acknowledgedTap = remoteTap.id; }
        tick++; onState(state);
        if (state.phase === 'finished') { phase = 'finished'; resetInputs(); onStatus('finished'); announceReady(); sendState(); }
      }
      if (now - lastSend >= 100) {
        lastSend = now;
        if (role === 0) {
          if (state) sendState();
          else send({ type: 'lobby', round, hostReady: localReady });
        } else {
          if (localReady) send({ type: 'ready', round: round + 1 });
          if (phase === 'playing') sendInput();
          else send({ type: 'heartbeat' });
        }
      }
    },
    leave() { end('closed'); },
    get connected() { return !!peer; },
    get role() { return role; },
    get phase() { return phase; },
    get waiting() { return localReady; },
    get state() { return state; },
  };
  return api;
}
