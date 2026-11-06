import './style.css';
import { BALANCE_LIMIT, initialState, placeBlock, positionAt, speedForFloor, windForFloor } from '../shared/game.js';
import { drawBackdrop, drawCrane, drawTowerBlock, themeForFloor } from './art.js';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const app = document.querySelector('#app');
app.innerHTML = `
  <div class="shell">
    <header><div class="brand"><span class="brand-mark">▥</span><span>SKY <b>STACK</b><small>CONSTRUCTION</small></span></div><span class="edition">CRANE EDITION · MVP</span></header>
    <main>
      <section class="game-panel">
        <div class="hud"><div><small>FLOOR</small><strong id="floor">00</strong></div><div><small>SCORE</small><strong id="score">0</strong></div><div><small>COMBO</small><strong id="combo">×0</strong></div></div>
        <div class="weather"><div><small>แรงลมชั้นนี้</small><strong id="wind">→ 0</strong><small id="building-style">แบบอาคาร</small></div><div class="balance"><small>สมดุลโครงสร้าง <span id="balance-number">0 / 80</span></small><div class="balance-track"><i id="balance-pointer"></i></div></div></div>
        <div class="canvas-wrap"><canvas id="game" width="400" height="600" aria-label="พื้นที่เล่นเกม"></canvas>
          <div class="overlay" id="overlay"><div class="overlay-card"><div class="eyebrow">BUILD AGAINST THE WIND</div><h1>SKY STACK</h1><p>วางชั้นตึกให้สูง พร้อมรักษาสมดุลต้านลม วาง Perfect เพื่อรับค้ำยันเพิ่ม</p><button id="action" class="primary">เริ่มก่อสร้าง <span>→</span></button><p class="hint">แตะหรือกด Space เพื่อวาง · กด B เพื่อเลือกค้ำยัน</p></div></div>
          <div class="toast" id="toast"></div>
        </div>
        <div class="controls"><button id="drop" disabled>ปล่อยชั้นตึก <span>↓</span></button><button id="brace" disabled>ค้ำยัน 1/2</button><div class="difficulty">ความเร็วเครน <span id="speed">1.65</span></div></div>
      </section>
      <aside><div class="side-title"><div><span class="eyebrow">GLOBAL RANKINGS</span><h2>Leaderboard</h2></div><button id="refresh" aria-label="รีเฟรชอันดับ">↻</button></div><div class="rank-head"><span>RANK / PLAYER</span><span>POINTS</span></div><ol id="leaders"></ol><div class="rules"><span class="eyebrow">HOW TO PLAY</span><p><b>01</b> ดูทิศลมก่อนปล่อยชั้นตึก</p><p><b>02</b> วางเยื้องเพื่อต้านลมและแก้สมดุล</p><p><b>03</b> กดค้ำยันก่อนวางเพื่อลดแรงโยก</p><p><b>04</b> Perfect 3 ครั้ง รับค้ำยันเพิ่ม</p><p><b>05</b> สมดุลถึง ±80 = ตึกถล่ม</p></div></aside>
    </main><footer>SKY STACK · BUILD HIGHER EVERY RUN <span>เว็บ · Android · iOS</span></footer>
  </div>`;

const $ = selector => document.querySelector(selector);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
let state = null, run = null, ticks = [], bracesUsed = [], braceQueued = false, phaseStart = 0, busy = false;
let mode = 'intro';

function setHud() {
  $('#floor').textContent = String(state?.floor || 0).padStart(2, '0');
  $('#score').textContent = (state?.score || 0).toLocaleString();
  $('#combo').textContent = `×${state?.combo || 0}`;
  $('#speed').textContent = speedForFloor(state?.floor || 0).toFixed(2);
  const wind = windForFloor(state?.seed || 0, state?.floor || 0);
  $('#wind').textContent = `${wind < 0 ? '←' : wind > 0 ? '→' : '·'} ${Math.abs(wind)}`;
  $('#building-style').textContent = themeForFloor(state?.seed || 0, (state?.floor || 0) + 1).name;
  $('#balance-number').textContent = `${Math.round(state?.balance || 0)} / ${BALANCE_LIMIT}`;
  $('#balance-pointer').style.left = `${50 + Math.max(-50, Math.min(50, (state?.balance || 0) / BALANCE_LIMIT * 50))}%`;
  const brace = $('#brace'); brace.textContent = `ค้ำยัน ${state?.braces || 0}/2${braceQueued ? ' ✓' : ''}`;
  brace.disabled = mode !== 'playing' || !state?.braces;
  brace.classList.toggle('selected', braceQueued);
}

function showToast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.remove('show'), 850);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'เชื่อมต่อไม่สำเร็จ');
  return data;
}

async function loadLeaders() {
  const list = $('#leaders');
  try {
    const { entries } = await request('/api/leaderboard');
    list.replaceChildren();
    if (!entries.length) { const item = document.createElement('li'); item.className = 'empty'; item.textContent = 'ยังไม่มีคะแนน — ขึ้นตึกเป็นคนแรก!'; list.append(item); }
    for (const [index, entry] of entries.entries()) {
      const item = document.createElement('li');
      const person = document.createElement('span'); person.className = 'person';
      const rank = document.createElement('b'); rank.className = `rank rank-${index + 1}`; rank.textContent = String(index + 1).padStart(2, '0');
      const info = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = entry.name;
      const meta = document.createElement('small'); meta.textContent = `${entry.floors} ชั้น · ${entry.perfects} Perfect`;
      info.append(name, meta); person.append(rank, info);
      const score = document.createElement('b'); score.className = 'points'; score.textContent = entry.score.toLocaleString();
      item.append(person, score); list.append(item);
    }
  } catch { list.textContent = 'โหลดอันดับไม่ได้ ลองกดรีเฟรช'; }
}

async function start() {
  if (busy) return; busy = true;
  $('#action').disabled = true; $('#action').textContent = 'กำลังเชื่อมต่อ...';
  try {
    run = await request('/api/runs', { method: 'POST', body: '{}' });
    state = initialState(run.seed); ticks = []; bracesUsed = []; braceQueued = false; drop.previousScore = 0; phaseStart = performance.now();
    mode = 'playing'; $('#overlay').classList.add('hidden'); $('#drop').disabled = false; setHud();
  } catch (error) { $('#action').disabled = false; $('#action').textContent = 'ลองอีกครั้ง →'; showToast(error.message); }
  busy = false;
}

function drop() {
  if (mode !== 'playing' || !state || busy) return;
  const tick = Math.min(600, Math.floor((performance.now() - phaseStart) / (1000 / 60)));
  if (tick < 18) return;
  if (braceQueued) bracesUsed.push(ticks.length);
  ticks.push(tick);
  state = placeBlock(state, tick, braceQueued);
  braceQueued = false;
  setHud();
  if (state.status === 'gameover' && state.last.cause === 'collapse') showToast('ตึกเสียสมดุล!');
  else if (state.last.perfect) showToast(`PERFECT! ×${state.combo}`);
  else if (state.status === 'playing') showToast(`+${state.score - (drop.previousScore || 0)} POINTS`);
  drop.previousScore = state.score;
  phaseStart = performance.now();
  if (navigator.vibrate) navigator.vibrate(state.status === 'gameover' ? [70, 40, 90] : state.last.perfect ? 35 : 15);
  if (state.status !== 'playing') endRun();
}

function endRun() {
  mode = 'ended'; $('#drop').disabled = true;
  const eligible = state.floor > 0;
  const card = $('#overlay .overlay-card');
  card.replaceChildren();
  const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = state.status === 'complete' ? 'SUMMIT REACHED' : 'CONSTRUCTION COMPLETE';
  const title = document.createElement('h1'); title.textContent = state.status === 'complete' ? 'สุดยอด!' : 'GAME OVER';
  const summary = document.createElement('p'); summary.textContent = `${state.floor} ชั้น · ${state.score.toLocaleString()} คะแนน · ${state.perfects} Perfect${state.last?.cause === 'collapse' ? ' · ตึกเสียสมดุล' : ''}`;
  card.append(eyebrow, title, summary);
  if (eligible) {
    const form = document.createElement('form'); form.id = 'score-form';
    const input = document.createElement('input'); input.name = 'name'; input.maxLength = 16; input.minLength = 2; input.required = true; input.placeholder = 'ชื่อบน Leaderboard'; input.autocomplete = 'nickname'; input.value = localStorage.getItem('sky-stack-name') || '';
    const submit = document.createElement('button'); submit.className = 'primary'; submit.textContent = 'บันทึกคะแนน →';
    form.append(input, submit); form.addEventListener('submit', submitScore); card.append(form);
  }
  const again = document.createElement('button'); again.className = 'again'; again.textContent = 'เล่นใหม่'; again.addEventListener('click', start);
  card.append(again); $('#overlay').classList.remove('hidden');
}

async function submitScore(event) {
  event.preventDefault(); if (busy) return;
  const input = event.currentTarget.elements.name;
  const button = event.currentTarget.querySelector('button');
  busy = true; button.disabled = true; button.textContent = 'กำลังบันทึก...';
  try {
    const name = input.value.trim();
    await request('/api/scores', { method: 'POST', body: JSON.stringify({ id: run.id, name, ticks, braces: bracesUsed }) });
    localStorage.setItem('sky-stack-name', name);
    button.textContent = 'บันทึกแล้ว ✓'; await loadLeaders();
  } catch (error) { button.disabled = false; button.textContent = 'ลองบันทึกอีกครั้ง →'; showToast(error.message); }
  busy = false;
}

function draw(t) {
  const bounds = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width * dpr));
  const height = Math.max(1, Math.round(bounds.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#123d53'; ctx.fillRect(0, 0, width, height);
  const scale = bounds.width < 500 ? bounds.width / 400 : Math.min(bounds.width / 400, bounds.height / 500);
  const offsetX = (bounds.width - 400 * scale) / 2;
  const cropTop = Math.max(0, 600 - bounds.height / scale);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, -dpr * scale * cropTop);
  const current = state || initialState(12);
  drawBackdrop(ctx, t, current.balance);
  const floor = current.floor;
  for (const block of current.blocks.slice(-12)) {
    const y = 510 - (block.floor - (floor - 1)) * 44;
    if (y < -44 || y > 600) continue;
    drawTowerBlock(ctx, { ...block, y }, current.seed);
  }
  if (mode === 'playing') {
    const tick = Math.min(600, Math.floor((t - phaseStart) / (1000 / 60)));
    if (tick >= 600) queueMicrotask(drop);
    const x = positionAt(current.floor, current.width, tick, current.seed);
    const y = 466;
    drawCrane(ctx, x + current.width / 2, y, Math.max(150, cropTop + 32));
    drawTowerBlock(ctx, { x, y, width: current.width, floor: current.floor + 1 }, current.seed, true);
    ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fillRect(current.x, y + 44, current.width, 2);
  }
  requestAnimationFrame(draw);
}

$('#action').addEventListener('click', start);
$('#drop').addEventListener('click', drop);
$('#brace').addEventListener('click', () => { if (mode === 'playing' && state?.braces) { braceQueued = !braceQueued; setHud(); } });
canvas.addEventListener('pointerdown', event => { event.preventDefault(); drop(); });
window.addEventListener('keydown', event => {
  if (event.target.tagName === 'INPUT') return;
  if (event.code === 'Space') { event.preventDefault(); drop(); }
  if (event.code === 'KeyB' && mode === 'playing' && state?.braces) { braceQueued = !braceQueued; setHud(); }
});
$('#refresh').addEventListener('click', loadLeaders);
setHud(); loadLeaders(); requestAnimationFrame(draw);

