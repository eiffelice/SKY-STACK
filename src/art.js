const THEMES = [
  { name: 'อิฐทองแดง', body: '#b85f49', light: '#e89766', shadow: '#763e3e', window: '#253f50', glow: '#ffc477' },
  { name: 'กระจกฟ้า', body: '#287b8e', light: '#6bd4d4', shadow: '#185164', window: '#143b59', glow: '#c2fbef' },
  { name: 'คอนกรีต', body: '#a4ac9e', light: '#e4d9b5', shadow: '#687981', window: '#345064', glow: '#fbdc8d' },
  { name: 'นีออน', body: '#394d80', light: '#7c82bc', shadow: '#273354', window: '#142a4e', glow: '#ffbe75' }
];

export function themeForFloor(seed, floor) {
  return THEMES[(Math.floor(floor / 4) + seed % THEMES.length) % THEMES.length];
}

function rounded(ctx, x, y, width, height, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

export function drawBackdrop(ctx, time, balance) {
  const sky = ctx.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, '#102c50'); sky.addColorStop(.58, '#28607d'); sky.addColorStop(1, '#447b83');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 400, 600);
  ctx.fillStyle = 'rgba(239,249,244,.36)';
  for (let i = 0; i < 22; i++) ctx.fillRect((i * 79 + 37) % 390, 50 + (i * 117) % 380, 1.5, 1.5);
  for (let i = 0; i < 5; i++) {
    const x = ((i * 153 - time * .007) % 550 + 550) % 550 - 100;
    rounded(ctx, x, 170 + i * 67, 135, 10, 5, 'rgba(217,244,246,.09)');
    rounded(ctx, x + 24, 161 + i * 67, 88, 10, 5, 'rgba(217,244,246,.07)');
  }
  // Small wind streaks give direction without hiding the moving block.
  ctx.strokeStyle = 'rgba(208,246,238,.17)'; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const x = ((i * 98 + time * .018) % 450 + 450) % 450 - 20;
    const y = 225 + i * 41;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20, y - 2); ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = i * 50 - 10, height = 55 + (i * 37) % 80;
    ctx.fillStyle = i % 2 ? '#205167' : '#19465f'; ctx.fillRect(x, 560 - height, 44, height);
    ctx.fillStyle = '#9cb5a568';
    for (let yy = 570 - height; yy < 540; yy += 17) for (let xx = x + 8; xx < x + 39; xx += 14) ctx.fillRect(xx, yy, 4, 5);
  }
  ctx.fillStyle = '#123d53'; ctx.fillRect(0, 560, 400, 40);
  if (Math.abs(balance) > 55) {
    ctx.fillStyle = `rgba(255,91,79,${Math.min(.12, (Math.abs(balance) - 55) / 250)})`;
    ctx.fillRect(0, 0, 400, 600);
  }
}

export function drawCrane(ctx, centerX, blockY, beamY = 150) {
  ctx.save();
  ctx.strokeStyle = '#bdc7b7'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(24, beamY); ctx.lineTo(376, beamY); ctx.moveTo(38, beamY - 15); ctx.lineTo(358, beamY - 15); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#8ca6a4';
  for (let x = 40; x < 355; x += 28) {
    ctx.beginPath(); ctx.moveTo(x, beamY - 14); ctx.lineTo(x + 28, beamY - 1); ctx.moveTo(x + 28, beamY - 14); ctx.lineTo(x, beamY - 1); ctx.stroke();
  }
  ctx.strokeStyle = '#d6e0d2'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(centerX, beamY + 1); ctx.lineTo(centerX, blockY - 8); ctx.stroke();
  rounded(ctx, centerX - 8, beamY - 2, 16, 12, 2, '#eab879');
  ctx.fillStyle = '#ffc77d'; ctx.fillRect(centerX - 4, blockY - 10, 8, 9);
  ctx.restore();
}

export function drawTowerBlock(ctx, block, seed, moving = false) {
  const { x, y, width, floor } = block;
  if (width <= 0) return;
  const theme = themeForFloor(seed, floor);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, width, 42, 3); ctx.clip();
  const facade = ctx.createLinearGradient(x, y, x + width, y + 42);
  facade.addColorStop(0, theme.light); facade.addColorStop(.22, theme.body); facade.addColorStop(1, theme.shadow);
  ctx.fillStyle = facade; ctx.fillRect(x, y, width, 42);
  ctx.fillStyle = 'rgba(255,250,216,.75)'; ctx.fillRect(x, y + 2, width, 3);
  ctx.fillStyle = theme.shadow; ctx.fillRect(x, y + 37, width, 5);
  if (floor % 4 === 0) {
    ctx.fillStyle = theme.light;
    ctx.fillRect(x, y + 8, width, 3); ctx.fillRect(x, y + 32, width, 2);
  }
  if (width > 28) {
    const spacing = floor % 4 === 2 ? 23 : 26;
    for (let wx = x + 11; wx + 10 < x + width - 4; wx += spacing) {
      ctx.fillStyle = theme.window; ctx.fillRect(wx, y + 12, 12, 17);
      ctx.fillStyle = theme.glow; ctx.globalAlpha = (Math.floor(wx + floor * 19) % 3 === 0) ? .85 : .35;
      ctx.fillRect(wx + 2, y + 14, 8, 11); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(wx + 5, y + 12, 1, 17);
    }
  }
  if (floor % 4 === 1) {
    ctx.strokeStyle = 'rgba(203,255,249,.36)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 9, y + 7); ctx.lineTo(x + 24, y + 34); ctx.stroke();
  } else if (floor % 4 === 2 && width > 45) {
    ctx.strokeStyle = theme.shadow; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 7); ctx.lineTo(x + 33, y + 35); ctx.moveTo(x + 33, y + 7); ctx.lineTo(x + 4, y + 35); ctx.stroke();
  } else if (floor % 4 === 3) {
    ctx.fillStyle = theme.glow; ctx.globalAlpha = .75;
    ctx.fillRect(x + 3, y + 7, Math.max(0, width - 6), 2); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 3, y + 7, 2, 28);
  ctx.restore();
  if (moving) {
    ctx.save(); ctx.strokeStyle = theme.glow; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, Math.max(0, width - 2), 40);
    ctx.restore();
  }
}

