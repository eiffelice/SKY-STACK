import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initialState, placeBlock, positionAt } from '../shared/game.js';

function finishedTicks(seed) {
  let state = initialState(seed);
  const ticks = [];
  for (let i = 0; i < 20 && state.status === 'playing'; i++) {
    let best = 18, minimum = Infinity;
    for (let tick = 18; tick <= 600; tick++) {
      const x = positionAt(state.floor, state.width, tick, seed);
      const overlap = Math.max(0, Math.min(x + state.width, state.x + state.width) - Math.max(x, state.x));
      if (overlap < minimum) { minimum = overlap; best = tick; }
    }
    ticks.push(best); state = placeBlock(state, best);
  }
  assert.equal(state.status, 'gameover');
  return { ticks, state };
}

test('API verifies replay, publishes score, and rejects reuse', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'sky-stack-'));
  const port = 32000 + Math.floor(Math.random() * 10000);
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, PORT: String(port), DATA_FILE: path.join(temp, 'scores.json') },
    stdio: 'ignore'
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch(`${base}/api/health`); ready = r.ok; if (ready) break; }
      catch { await new Promise(resolve => setTimeout(resolve, 75)); }
    }
    assert.ok(ready, 'server started');
    const start = await fetch(`${base}/api/runs`, { method: 'POST' });
    assert.equal(start.status, 201);
    const { id, seed, issuedAt } = await start.json();
    const { ticks, state } = finishedTicks(seed);
    const post = data => fetch(`${base}/api/scores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal((await post({ id, name: '<script>', ticks })).status, 400);
    const waitMs = Math.max(0, Math.ceil(ticks.reduce((a, b) => a + b, 0) / 60 * 1000 - (Date.now() - issuedAt) - 1500));
    if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
    const result = await post({ id, name: 'Builder', ticks });
    assert.equal(result.status, 201);
    assert.equal((await result.json()).entry.score, state.score);
    assert.equal((await post({ id, name: 'Builder', ticks })).status, 400);
    const leaders = await (await fetch(`${base}/api/leaderboard`)).json();
    assert.equal(leaders.entries.length, 1);
    assert.equal(leaders.entries[0].name, 'Builder');
  } finally {
    child.kill();
    rmSync(temp, { recursive: true, force: true });
  }
});

