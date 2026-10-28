import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../engine.js';

// Module integration with an intentionally small DOM. This verifies lifecycle,
// timers and input wiring, not browser rendering, touch hardware or LOB7 login.
function makeDOM() {
  class Classes {
    values = new Set();
    add(...items) { items.forEach(item => this.values.add(item)); }
    remove(...items) { items.forEach(item => this.values.delete(item)); }
    contains(item) { return this.values.has(item); }
    toggle(item, force = !this.contains(item)) { force ? this.add(item) : this.remove(item); return force; }
  }
  const context = new Proxy({}, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
  });
  class Element {
    constructor(id = '') {
      this.id = id; this.classList = new Classes(); this.style = {}; this.attributes = {};
      this.dataset = {}; this.listeners = new Map(); this.children = [];
      this.textContent = ''; this.innerHTML = ''; this.value = '';
      this.options = [{}, {}]; this.disabled = false;
      this.clientWidth = 840; this.clientHeight = 600; this.width = 840; this.height = 600;
    }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key]; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) || []), callback]); }
    dispatch(type, event = {}) {
      if (type === 'click' && this.disabled) return;
      for (const callback of this.listeners.get(type) || []) callback({ target: this, preventDefault() {}, ...event });
    }
    closest() { return null; }
    setPointerCapture() {}
    getContext() { return context; }
  }
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const actions = ['up', 'down', 'left', 'right'].map(action => { const node = get(action); node.dataset.action = action; return node; });
  get('difficulty').value = 'normal';
  const document = new Element('document');
  document.body = new Element('body'); document.documentElement = new Element('html'); document.hidden = false;
  document.getElementById = get;
  document.querySelectorAll = selector => selector === '[data-action]' ? actions : [];
  document.querySelector = selector => selector.includes('viewport') ? get('viewport') : actions.find(node => selector.includes(`"${node.dataset.action}"`));
  document.createTextNode = value => ({ textContent: value });
  document.createElement = tag => new Element(tag);
  const window = new Element('window');
  window.parent = window; window.screen = { width: 390, height: 844 };
  return { document, window, get, actions };
}

test('app supports a complete solo round, rematch, mobile viewport and clean network termination', async () => {
  const dom = makeDOM();
  let clock = 0;
  let interval;
  let frame;
  const storage = new Map();
  Object.assign(globalThis, {
    document: dom.document, window: dom.window,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    requestAnimationFrame: callback => { frame = callback; },
    setInterval: callback => { interval = callback; return 1; },
    matchMedia: () => ({ matches: true }),
  });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en', maxTouchPoints: 1 } });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock } });
  await import('../app.js');
  assert.equal(dom.document.documentElement.classList.contains('touch-phone'), true);
  assert.match(dom.get('viewport').content, /width=390/);
  assert.equal(dom.get('timer').textContent, '2:00');
  dom.get('connect').dispatch('click');
  assert.match(dom.get('status').textContent, /LOB7/);

  dom.get('solo').dispatch('click');
  assert.equal(dom.document.body.classList.contains('playing'), true);
  assert.equal(dom.get('right').disabled, true, 'Input locked during the visible countdown');
  function advance(milliseconds) {
    for (let duration = 0; duration < milliseconds; duration += 20) {
      clock += 20; interval(); frame(clock);
    }
  }
  advance(2300);
  assert.equal(dom.get('right').disabled, false);
  dom.window.dispatch('keydown', { code: 'ArrowRight' });
  assert.equal(dom.get('right').classList.contains('active'), true);
  advance(400);
  dom.window.dispatch('blur');
  assert.equal(dom.get('right').classList.contains('active'), false, 'Blur releases a held key');
  dom.document.hidden = true;
  const pausedTime = dom.get('timer').textContent;
  dom.document.dispatch('visibilitychange');
  advance(1000);
  assert.equal(dom.get('timer').textContent, pausedTime, 'Solo time pauses while hidden');
  dom.document.hidden = false;
  dom.document.dispatch('visibilitychange');
  advance(121000);
  assert.equal(dom.get('timer').textContent, '0:00');
  assert.equal(dom.get('rematch').classList.contains('hidden'), false);
  assert.ok(Number(dom.get('score1').textContent) > 0, 'The real engine bot scores during the round');
  dom.get('rematch').dispatch('click');
  assert.equal(dom.get('timer').textContent, '2:00');
  dom.get('leave').dispatch('click');
  assert.equal(dom.document.body.classList.contains('playing'), false);

  // A fake bridge exercises the same connection callbacks, never a real room.
  dom.window.parent = {};
  let callbacks;
  let bridgeRole = 'host';
  const sent = [];
  globalThis.LOB7Rooms = { connect: async () => ({ connectPeer: async next => {
    callbacks = next;
    return { role: bridgeRole, send(packet) { sent.push(structuredClone(packet)); }, close() {} };
  } }) };
  dom.get('connect').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(dom.get('ready').classList.contains('hidden'), false);
  dom.get('ready').dispatch('click');
  callbacks.onMessage({ protocol: 'duo.v1', type: 'ready', round: 1 });
  assert.equal(dom.document.body.classList.contains('playing'), true);
  assert.equal(dom.get('connect').disabled, true);
  callbacks.onClose();
  assert.equal(dom.document.body.classList.contains('playing'), false);
  assert.equal(dom.get('solo').classList.contains('hidden'), false);
  assert.equal(dom.get('connect').disabled, false);
  assert.match(dom.get('status').textContent, /connection ended/i);

  bridgeRole = 'guest';
  dom.get('connect').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.match(dom.get('identity-title').textContent, /coral/i);
  assert.match(dom.get('identity-goal').textContent, /right/i);
  callbacks.onMessage({ protocol: 'duo.v1', type: 'state', round: 1, tick: 1, ackTap: 0, state: createGame(77) });
  dom.get('up').dispatch('pointerdown', { pointerId: 1 });
  dom.get('up').dispatch('pointerup', { pointerId: 1 });
  const release = sent.filter(packet => packet.type === 'input').at(-1);
  assert.equal(release.held, null);
  assert.deepEqual(release.taps.map(item => item.action), ['up'], 'A pointer tap released before the next tick is retained for authority');
  callbacks.onClose();
});
