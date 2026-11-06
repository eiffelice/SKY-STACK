import './style.css';
import { GAME_WIDTH, initialState, placeBlock, positionAt, speedForFloor } from '../shared/game.js';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const app = document.querySelector('#app');
app.innerHTML = `
  <div class="shell">
    <header><div class="brand"><span class="brand-mark">▥</span><span>SKY <b>STACK</b><small>CONSTRUCTION</small></span></div><span class="edition">CRANE EDITION · MVP</span></header>
    <main>
      <section class="game-panel">
        <div class="hud"><div><small>FLOOR</small><strong id="floor">00</strong></div><div><small>SCORE</small><strong id="score">0</strong></div><div><small>COMBO</small><strong id="combo">×0</strong></div></div>
        <div class="canvas-wrap"><canvas id="game" width="400" height="600" aria-label="พื้นที่เล่นเกม"></canvas>
          <div class="overlay" id="overlay"><div class="overlay-card"><div class="eyebrow">BUILD ABOVE THE CLOUDS</div><h1>SKY STACK</h1><p>แตะเพื่อปล่อยชั้นตึกจากเครน วางให้ตรงเพื่อรับ Perfect และต่อ Combo ให้สูงที่สุด</p><button id="action" class="primary">เริ่มก่อสร้าง <span>→</span></button><p class="hint">แตะหน้าจอ หรือกด Space เพื่อวางชั้นตึก</p></div></div>
          <div class="toast" id="toast"></div>
        </div>
        <div class="controls"><button id="drop" disabled>ปล่อยชั้นตึก <span>↓</span></button><div class="difficulty">ความเร็วเครน <span id="speed">1.65</span></div></div>
      </section>
      <aside><div class="side-title"><div><span class="eyebrow">GLOBAL RANKINGS</span><h2>Leaderboard</h2></div><button id="refresh" aria-label="รีเฟรชอันดับ">↻</button></div><div class="rank-head"><span>RANK / PLAYER</span><span>POINTS</span></div><ol id="leaders"></ol><div class="rules"><span class="eyebrow">HOW TO PLAY</span><p><b>01</b> แตะเพื่อปล่อยชั้นตึก</p><p><b>02</b> วางชิดขอบเดิมเพื่อรักษาความกว้าง</p><p><b>03</b> วางตรงเป๊ะ รับ Perfect + Combo</p><p><b>04</b> ตกพื้นเมื่อไร จบเกมทันที</p></div></aside>
    </main><footer>SKY STACK · BUILD HIGHER EVERY RUN <span>เว็บ · Android · iOS</span></footer>
  </div>`;

const $ = selector => document.querySelector(selector);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
let state = null, run = null, ticks = [], phaseStart = 0, busy = false;
let mode = 'intro';

function setHud() {
  $('#floor').textContent = String(state?.floor || 0).padStart(2, '0');
  $('#score').textContent = (state?.score || 0).toLocaleString();
  $('#combo').textContent = `×${state?.combo || 0}`;
  $('#speed').textContent = speedForFloor(state?.floor || 0).toFixed(2);
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
    state = initialState(run.seed); ticks = []; drop.previousScore = 0; phaseStart = performance.now();
    mode = 'playing'; $('#overlay').classList.add('hidden'); $('#drop').disabled = false; setHud();
  } catch (error) { $('#action').disabled = false; $('#action').textContent = 'ลองอีกครั้ง →'; showToast(error.message); }
  busy = false;
}

function drop() {
  if (mode !== 'playing' || !state || busy) return;
  const tick = Math.min(600, Math.floor((performance.now() - phaseStart) / (1000 / 60)));
  if (tick < 18) return;
  ticks.push(tick);
  state = placeBlock(state, tick);
  setHud();
  if (state.last.perfect) showToast(`PERFECT! ×${state.combo}`);
  else if (state.status === 'playing') showToast(`+${state.score - (drop.previousScore || 0)} POINTS`);
  drop.previousScore = state.score;
  phaseStart = performance.now();
  if (state.status !== 'playing') endRun();
}

function endRun() {
  mode = 'ended'; $('#drop').disabled = true;
  const eligible = state.floor > 0;
  const card = $('#overlay .overlay-card');
  card.replaceChildren();
  const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = state.status === 'complete' ? 'SUMMIT REACHED' : 'CONSTRUCTION COMPLETE';
  const title = document.createElement('h1'); title.textContent = state.status === 'complete' ? 'สุดยอด!' : 'GAME OVER';
  const summary = document.createElement('p'); summary.textContent = `${state.floor} ชั้น · ${state.score.toLocaleString()} คะแนน · ${state.perfects} Perfect`;
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
    await request('/api/scores', { method: 'POST', body: JSON.stringify({ id: run.id, name, ticks }) });
    localStorage.setItem('sky-stack-name', name);
    button.textContent = 'บันทึกแล้ว ✓'; await loadLeaders();
  } catch (error) { button.disabled = false; button.textContent = 'ลองบันทึกอีกครั้ง →'; showToast(error.message); }
  busy = false;
}

function roundedRect(x, y, w, h, radius, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}

function draw(t) {
  const w = 400, h = 600;
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#143e61'); sky.addColorStop(.58, '#1d5674'); sky.addColorStop(1, '#2e7790');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for (let i = 0; i < 24; i++) { const x = (i * 97 + 35) % w, y = (i * 137 + 41) % 520; ctx.fillRect(x, y, 2, 2); }
  for (let i = 0; i < 5; i++) { const x = ((i * 146 - t * .006) % 580 + 580) % 580 - 90; roundedRect(x, 140 + i * 92, 120, 15, 8, 'rgba(214,242,249,.08)'); }
  ctx.fillStyle = '#16475d'; ctx.fillRect(0, 560, w, 40);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#205b70' : '#194e65'; ctx.fillRect(i * 56, 515 + (i % 3) * 12, 44, 45); }
  const current = state || initialState(12);
  const floor = current.floor;
  for (const block of current.blocks.slice(-12)) {
    const y = 510 - (block.floor - (floor - 1)) * 44;
    if (y < -44 || y > 600) continue;
    roundedRect(block.x, y, block.width, 42, 3, block.floor % 2 ? '#f3af59' : '#e79a4e');
    ctx.fillStyle = '#ffe0a1'; ctx.fillRect(block.x + 4, y + 4, Math.max(0, block.width - 8), 3);
    ctx.fillStyle = '#825a47'; for (let x = block.x + 16; x < block.x + block.width - 10; x += 28) ctx.fillRect(x, y + 14, 12, 15);
  }
  if (mode === 'playing') {
    const tick = Math.min(600, Math.floor((t - phaseStart) / (1000 / 60)));
    if (tick >= 600) queueMicrotask(drop);
    const x = positionAt(current.floor, current.width, tick, current.seed);
    const y = 466;
    ctx.strokeStyle = '#b8d9df'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + current.width / 2, 0); ctx.lineTo(x + current.width / 2, y); ctx.stroke();
    roundedRect(x, y, current.width, 42, 3, '#ffcb72');
    ctx.fillStyle = '#ffe8ad'; ctx.fillRect(x + 4, y + 4, Math.max(0, current.width - 8), 3);
    ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fillRect(current.x, y + 44, current.width, 2);
  }
  requestAnimationFrame(draw);
}

$('#action').addEventListener('click', start);
$('#drop').addEventListener('click', drop);
canvas.addEventListener('pointerdown', event => { event.preventDefault(); drop(); });
window.addEventListener('keydown', event => { if (event.code === 'Space' && event.target.tagName !== 'INPUT') { event.preventDefault(); drop(); } });
$('#refresh').addEventListener('click', loadLeaders);
setHud(); loadLeaders(); requestAnimationFrame(draw);

