import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, placeBlock, positionAt, replay, speedForFloor } from '../shared/game.js';

function closestTick(state) {
  let best = 18, distance = Infinity;
  for (let tick = 18; tick <= 600; tick++) {
    const difference = Math.abs(positionAt(state.floor, state.width, tick, state.seed) - state.x);
    if (difference < distance) { distance = difference; best = tick; }
  }
  return best;
}

test('perfect placement preserves width, increases combo and score', () => {
  const start = initialState(42);
  const next = placeBlock(start, closestTick(start));
  assert.equal(next.floor, 1);
  assert.equal(next.width, start.width);
  assert.equal(next.combo, 1);
  assert.equal(next.score, 125);
  assert.equal(next.perfects, 1);
});

test('crane accelerates and speed is capped', () => {
  assert.ok(speedForFloor(20) > speedForFloor(0));
  assert.equal(speedForFloor(100), 4.8);
});

test('replay rejects unfinished and forged ticks', () => {
  assert.throws(() => replay(42, [18]), /Invalid replay length/);
  assert.throws(() => replay(42, [18, 601]), /Invalid placement/);
});

test('replay reproduces a finished run', () => {
  let state = initialState(100);
  const ticks = [];
  for (let i = 0; i < 20 && state.status === 'playing'; i++) {
    let chosen = 18, minOverlap = Infinity;
    for (let tick = 18; tick <= 600; tick++) {
      const x = positionAt(state.floor, state.width, tick, state.seed);
      const overlap = Math.max(0, Math.min(x + state.width, state.x + state.width) - Math.max(x, state.x));
      if (overlap < minOverlap) { minOverlap = overlap; chosen = tick; }
    }
    ticks.push(chosen);
    state = placeBlock(state, chosen);
  }
  assert.equal(state.status, 'gameover');
  assert.ok(state.floor >= 1);
  assert.equal(replay(100, ticks).score, state.score);
});

