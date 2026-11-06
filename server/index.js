import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { replay, TICKS_PER_SECOND } from '../shared/game.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3000);
const store = new Store(process.env.DATA_FILE || path.join(root, 'data/sky-stack.json'));
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,capacitor://localhost,http://localhost').split(',').map(x => x.trim()));
const buckets = new Map();

function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}

function limit(ip, route, max) {
  const key = `${ip}:${route}`;
  const now = Date.now();
  const record = buckets.get(key) || { start: now, count: 0 };
  if (now - record.start > 60_000) { record.start = now; record.count = 0; }
  record.count++;
  buckets.set(key, record);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.start > 60_000) buckets.delete(k);
  return record.count <= max;
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8192) throw new Error('Request too large');
  }
  return JSON.parse(raw);
}

function safeName(value) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 16 || !/^[\p{L}\p{N}_ ]+$/u.test(name)) return null;
  return name;
}

function handleApi(req, res, url) {
  const ip = req.socket.remoteAddress || 'unknown';
  if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });
  if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
    if (!limit(ip, 'leaderboard', 60)) return send(res, 429, { error: 'Too many requests' });
    return send(res, 200, { entries: store.leaderboard() });
  }
  if (url.pathname === '/api/runs' && req.method === 'POST') {
    if (!limit(ip, 'start', 20)) return send(res, 429, { error: 'Too many starts' });
    const id = crypto.randomUUID();
    const seed = crypto.randomInt(0, 2 ** 31);
    const issuedAt = Date.now();
    store.createSession(id, seed, issuedAt);
    return send(res, 201, { id, seed, issuedAt });
  }
  if (url.pathname === '/api/scores' && req.method === 'POST') {
    if (!limit(ip, 'score', 25)) return send(res, 429, { error: 'Too many submissions' });
    return body(req).then(payload => {
      const name = safeName(payload?.name);
      const session = typeof payload?.id === 'string' ? store.getSession(payload.id) : null;
      if (!name || !session || session.used) return send(res, 400, { error: 'Invalid or used run' });
      const age = Date.now() - session.issuedAt;
      if (age < 0 || age > 30 * 60_000) return send(res, 400, { error: 'Run expired' });
      let state;
      try { state = replay(session.seed, payload.ticks); }
      catch { return send(res, 400, { error: 'Invalid replay' }); }
      const minimumMs = payload.ticks.reduce((a, b) => a + b, 0) / TICKS_PER_SECOND * 1000;
      if (age + 1800 < minimumMs) return send(res, 400, { error: 'Run completed too quickly' });
      const entry = { name, score: state.score, floors: state.floor,
        perfects: state.perfects, createdAt: Date.now() };
      if (!store.finishSession(payload.id, entry)) return send(res, 409, { error: 'Run already submitted' });
      return send(res, 201, { entry, entries: store.leaderboard() });
    }).catch(() => send(res, 400, { error: 'Invalid request body' }));
  }
  return send(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
  const dist = path.join(root, 'dist');
  let target = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
  if (!target.startsWith(dist + path.sep) && target !== dist) return send(res, 403, { error: 'Forbidden' });
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(dist, 'index.html');
  if (!fs.existsSync(target)) return send(res, 404, { error: 'Build the web app first: npm run build' });
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
  res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    res.setHeader('access-control-allow-headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch { return send(res, 400, { error: 'Bad request' }); }
});

server.listen(port, () => console.log(`SKY STACK listening on http://localhost:${port}`));

