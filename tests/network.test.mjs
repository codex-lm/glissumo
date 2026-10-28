import test from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, validState } from '../network.js';
import { createGame, chooseBotAction } from '../engine.js';

async function pair({ delay = 0, drop = () => false } = {}) {
  const handlers = [], packets = [], output = [[], []];
  let clock = 0;
  const sessions = [0, 1].map(index => createNetwork({
    seed: () => 4711,
    onState: state => { output[index].push(structuredClone(state)); if (output[index].length > 2) output[index].shift(); },
    connectLobby: async () => ({ connectPeer: async callbacks => {
      handlers[index] = callbacks;
      return { role: index === 0 ? 'host' : 'guest',
        send: packet => {
          const copy = structuredClone(packet);
          assert.ok(new TextEncoder().encode(JSON.stringify(copy)).length <= 8192, 'SDK message size');
          if (!drop(copy, index)) packets.push({ at: clock + delay, to: 1 - index, packet: copy });
        }, close: () => {},
      };
    } }),
  }));
  await Promise.all(sessions.map(s => s.connect()));
  function deliver() {
    for (let i = packets.length - 1; i >= 0; i--) {
      if (packets[i].at <= clock) { const item = packets.splice(i, 1)[0]; handlers[item.to].onMessage(item.packet); }
    }
  }
  function advance(milliseconds, bots = false) {
    for (let t = 0; t < milliseconds; t += 20) {
      clock += 20; deliver();
      if (bots && sessions[0].state?.phase === 'playing') sessions.forEach((s, i) => s.setInput(chooseBotAction(sessions[0].state, i)));
      sessions.forEach(s => s.poll(20)); deliver();
    }
  }
  return { host: sessions[0], guest: sessions[1], advance, handlers, packets, output };
}

test('both players must ready; lost start snapshot is repaired by the next complete snapshot', async () => {
  let lost = false;
  const p = await pair({ drop: packet => {
    if (packet.type === 'state' && !lost) { lost = true; return true; }
    return false;
  } });
  p.host.ready(); p.advance(200);
  assert.equal(p.host.phase, 'lobby');
  p.guest.ready(); p.advance(250);
  assert.equal(p.host.phase, 'playing'); assert.equal(p.guest.phase, 'playing');
  assert.equal(p.host.state.seed, p.guest.state.seed);
});

test('lost short tap is retried and executed once, even after release', async () => {
  let lost = false;
  const p = await pair({ drop: packet => {
    if (packet.type === 'input' && packet.taps.length && !lost) { lost = true; return true; }
    return false;
  } });
  p.host.ready(); p.guest.ready(); p.advance(200);
  const initialY = p.host.state.players[1].y;
  p.guest.setInput('up'); p.guest.setInput(null); p.advance(800);
  assert.equal(p.host.state.players[1].y, initialY - 1);
  p.advance(600);
  assert.equal(p.host.state.players[1].y, initialY - 1);
});

test('missing release cannot leave a guest moving forever; held intent expires', async () => {
  let cut = false;
  const p = await pair({ drop: (packet, sender) => cut && sender === 1 && packet.type === 'input' });
  p.host.ready(); p.guest.ready(); p.advance(200);
  p.guest.setInput('left'); p.advance(80); cut = true;
  p.guest.setInput(null); p.advance(500);
  const x = p.host.state.players[1].x;
  p.advance(800); assert.equal(p.host.state.players[1].x, x);
});

test('two full minutes with 140 ms transport delay converge to final result and allow one-click rematch per player', async () => {
  const p = await pair({ delay: 140 });
  p.host.ready(); p.guest.ready(); p.advance(122000, true);
  assert.equal(p.host.phase, 'finished'); assert.equal(p.guest.phase, 'finished');
  assert.equal(p.host.state.timeLeft, 0);
  assert.deepEqual(p.guest.state.players.map(p => p.score), p.host.state.players.map(p => p.score));
  assert.ok(p.host.state.players.some(p => p.score > 0));
  p.host.ready(); p.guest.ready(); p.advance(500);
  assert.equal(p.host.phase, 'playing'); assert.equal(p.guest.phase, 'playing');
  assert.ok(p.host.state.timeLeft > 119000);
});

test('guest-forged state and invalid inputs cannot modify authoritative scores or coordinates', async () => {
  const p = await pair(); p.host.ready(); p.guest.ready(); p.advance(200);
  const state = structuredClone(p.host.state);
  p.handlers[0].onMessage({ protocol: 'duo.v1', type: 'state', round: 1, tick: 9, state: { ...state, timeLeft: 0 } });
  p.handlers[0].onMessage({ protocol: 'duo.v1', type: 'input', round: 1, seq: 900, held: 'teleport', taps: [] });
  p.advance(100);
  assert.deepEqual(p.host.state.players, state.players);
  assert.ok(p.host.state.timeLeft > 0);
});

test('old round snapshots cannot overwrite a rematch; invalid numeric payloads are rejected', async () => {
  const p = await pair(); p.host.ready(); p.guest.ready(); p.advance(120300);
  const old = structuredClone(p.guest.state);
  p.host.ready(); p.guest.ready(); p.advance(200);
  p.handlers[1].onMessage({ protocol: 'duo.v1', type: 'state', round: 1, tick: 999999, ackTap: 0, state: old });
  assert.equal(p.guest.phase, 'playing');
  const invalid = createGame(1); invalid.players[1].x = Infinity;
  assert.equal(validState(invalid), false);
});

test('guest sees the host ready for a rematch while the completed result remains displayed', async () => {
  const statuses = [];
  let hostMessages, guestMessages;
  const host = createNetwork({ connectLobby: async () => ({ connectPeer: async handlers => {
    hostMessages = handlers; return { role: 'host', send: p => guestMessages?.onMessage(structuredClone(p)), close() {} };
  } }) });
  const guest = createNetwork({ onReady: status => statuses.push(status), connectLobby: async () => ({ connectPeer: async handlers => {
    guestMessages = handlers; return { role: 'guest', send: p => hostMessages.onMessage(structuredClone(p)), close() {} };
  } }) });
  await host.connect(); await guest.connect(); host.ready(); guest.ready();
  for (let t = 0; t < 120100; t += 20) { host.poll(20); guest.poll(20); }
  assert.equal(guest.phase, 'finished'); host.ready(); host.poll(100); guest.poll(100);
  assert.equal(statuses.at(-1).remote, true); assert.equal(guest.phase, 'finished');
});

test('closing a peer terminates the match and a cancelled connect cannot revive it', async () => {
  const p = await pair(); p.host.ready(); p.guest.ready(); p.advance(200);
  p.handlers[1].onClose(); assert.equal(p.guest.connected, false); assert.equal(p.guest.phase, 'idle');
  let resolve; let closed = false;
  const pending = createNetwork({ connectLobby: async () => ({ connectPeer: () => new Promise(r => { resolve = r; }) }) });
  const connecting = pending.connect(); await new Promise(r => setImmediate(r));
  pending.leave(); resolve({ role: 'host', close: () => { closed = true; } }); await connecting;
  assert.equal(pending.connected, false); assert.equal(closed, true);
});
