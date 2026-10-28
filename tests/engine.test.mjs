import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, chooseBotAction, MATCH_MS, MOVE_MS, MAX_SPARKS, CAPACITY } from '../engine.js';

function bare(seed = 42) {
  const state = createGame(seed);
  state.sparks = [];
  return state;
}

test('seed determines a valid board with distinct interior sparks', () => {
  assert.deepEqual(createGame('garden'), createGame('garden'));
  assert.notDeepEqual(createGame(1).sparks, createGame(2).sparks);
  const game = createGame(99);
  assert.equal(game.sparks.length, MAX_SPARKS);
  assert.equal(new Set(game.sparks.map(s => `${s.x},${s.y}`)).size, MAX_SPARKS);
  assert.ok(game.sparks.every(s => s.x > 0 && s.x < 6 && s.y >= 0 && s.y < 5));
});

test('a row shift carries both players and its sparks around the seam', () => {
  const game = bare();
  game.players[0].y = game.players[1].y = 2;
  game.sparks = [{ id: 1, x: 5, y: 2 }, { id: 2, x: 3, y: 1 }];
  stepGame(game, 0, ['right', null]);
  assert.equal(game.players[0].x, 1);
  assert.equal(game.players[1].x, 0);
  assert.deepEqual(game.sparks.map(s => [s.x, s.y]), [[6, 2], [3, 1]]);
});

test('hopping collects; reaching the home edge banks the cargo exactly once', () => {
  const game = bare();
  game.players[0].x = 1;
  game.players[0].y = 2;
  game.sparks = [{ id: 1, x: 1, y: 1 }];
  stepGame(game, 0, ['up', null]);
  assert.equal(game.players[0].cargo, 1);
  assert.equal(game.sparks.length, 0);
  stepGame(game, MOVE_MS, ['left', null]);
  assert.equal(game.players[0].cargo, 0);
  assert.equal(game.players[0].score, 1);
  stepGame(game, MOVE_MS, [null, null]);
  assert.equal(game.players[0].score, 1);
});

test('shifting a shared row can bank the rival: both actors obey identical rules', () => {
  const game = bare();
  game.players[0].y = game.players[1].y = 2;
  game.players[1].x = 5;
  game.players[1].cargo = 3;
  stepGame(game, 0, ['right', null]);
  assert.equal(game.players[1].score, 3);
  assert.equal(game.players[1].cargo, 0);
});

test('vertical collision swaps riders and steals once, with a shared immunity period', () => {
  const game = bare();
  game.players[0].x = game.players[1].x = 3;
  game.players[0].y = 2;
  game.players[1].y = 1;
  game.players[1].cargo = 2;
  stepGame(game, 0, ['up', null]);
  assert.deepEqual(game.players.map(p => p.y), [1, 2]);
  assert.deepEqual(game.players.map(p => p.cargo), [1, 1]);
  stepGame(game, MOVE_MS, [null, 'up']);
  assert.deepEqual(game.players.map(p => p.y), [2, 1]);
  assert.deepEqual(game.players.map(p => p.cargo), [1, 1]);
});

test('move rate, boundaries, invalid directions and cargo capacity are enforced', () => {
  const game = bare();
  game.players[0].cargo = CAPACITY;
  game.players[0].x = 2;
  game.players[0].y = 2;
  game.sparks = [{ id: 1, x: 2, y: 1 }];
  stepGame(game, 0, ['up', 'teleport']);
  assert.equal(game.players[0].cargo, CAPACITY);
  assert.equal(game.sparks.length, 1);
  stepGame(game, 0, ['up', null]);
  assert.equal(game.players[0].y, 1);
  stepGame(game, MOVE_MS, ['up', null]);
  stepGame(game, MOVE_MS, ['up', null]);
  assert.equal(game.players[0].y, 0);
});

test('a complete deterministic bot match ends on time and produces scored play', () => {
  function match(seed) {
    const game = createGame(seed);
    for (let t = 0; t < MATCH_MS; t += 20) {
      stepGame(game, 20, [chooseBotAction(game, 0, 'normal'), chooseBotAction(game, 1, 'hard')]);
      assert.ok(game.sparks.length <= MAX_SPARKS);
      assert.ok(game.players.every(p => p.cargo >= 0 && p.cargo <= CAPACITY && p.x >= 0 && p.x < 7 && p.y >= 0 && p.y < 5));
      assert.notDeepEqual(game.players.map(p => [p.x, p.y])[0], game.players.map(p => [p.x, p.y])[1]);
    }
    return game;
  }
  const game = match(2026);
  assert.equal(game.phase, 'finished');
  assert.equal(game.timeLeft, 0);
  assert.ok(game.players.every(p => p.score >= 8), `Expected active bots, got ${game.players.map(p => p.score)}`);
  assert.deepEqual(game, match(2026));
  const frozen = structuredClone(game);
  stepGame(game, 1000, ['left', 'up']);
  assert.deepEqual(game, frozen);
});

test('bot decisions neither mutate authority nor invent input when the match ends', () => {
  const game = createGame(1);
  const copy = structuredClone(game);
  chooseBotAction(game, 1, 'hard');
  assert.deepEqual(game, copy);
  game.phase = 'finished';
  assert.equal(chooseBotAction(game, 1), null);
});

test('bots recover from shared-row, moving-target and collision pursuit loops', () => {
  // These seeds exposed three distinct stalls during initial self-play review.
  for (const seed of [1, 6, 13, 19, 25]) {
    const game = createGame(seed);
    for (let t = 0; t < MATCH_MS; t += 20) {
      stepGame(game, 20, [chooseBotAction(game, 0), chooseBotAction(game, 1)]);
    }
    assert.ok(game.players.every(player => player.score >= 40), `Bot stalled on seed ${seed}`);
  }
});

test('the solo opponent remains active when game ticks are not exactly 20ms', () => {
  const game = createGame(71);
  while (game.phase === 'playing') stepGame(game, 37, [null, chooseBotAction(game, 1)]);
  assert.ok(game.players[1].score >= 20);
});
