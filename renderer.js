import { COLS, ROWS, CAPACITY } from './engine.js';

const WIDTH = 840;
const HEIGHT = 600;
const LEFT = 68;
const TOP = 60;
const CELL_W = 100.5;
const CELL_H = 96;
const MINT = '#6cf0ce';
const CORAL = '#ff806c';
const CREAM = '#fff2b4';
const COLORS = [MINT, CORAL];
const center = (x, y) => ({ x: LEFT + CELL_W * (x + 0.5), y: TOP + CELL_H * (y + 0.5) });

function rounded(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function arrow(ctx, x, y, direction, size = 7) {
  ctx.beginPath();
  ctx.moveTo(x - direction * size * 0.45, y - size);
  ctx.lineTo(x + direction * size * 0.55, y);
  ctx.lineTo(x - direction * size * 0.45, y + size);
  ctx.stroke();
}

function spark(ctx, x, y, radius, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4 - Math.PI / 2;
    const r = index % 2 ? radius * 0.37 : radius;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Canvas-only drawing. Draw accepts either mutable authority or fresh snapshots. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('A 2D canvas context is required');
  const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  let positions = new Map();
  let lastTime = 0;
  let lastSeed = null;
  let lastElapsed = -1;

  function smooth(key, x, y, now, reduce) {
    const target = center(x, y);
    let point = positions.get(key);
    if (!point || reduce) point = { ...target, targetX: target.x, targetY: target.y, seen: now };
    else {
      // Wrap at the seam, never interpolate a rider across all seven columns.
      if (Math.abs(target.x - point.targetX) > CELL_W * 2) {
        point.x = target.x + (target.x < point.targetX ? -CELL_W * 0.38 : CELL_W * 0.38);
      }
      point.targetX = target.x;
      point.targetY = target.y;
      const interpolation = 1 - Math.exp(-Math.min(Math.max(now - lastTime, 1), 70) / 42);
      point.x += (target.x - point.x) * interpolation;
      point.y += (target.y - point.y) * interpolation;
      point.seen = now;
    }
    positions.set(key, point);
    return point;
  }

  function draw(state, role = 0, timeNow = performance.now()) {
    const cssWidth = canvas.clientWidth || WIDTH;
    const cssHeight = canvas.clientHeight || cssWidth * HEIGHT / WIDTH;
    const density = Math.min(globalThis.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(cssWidth * density);
    const pixelHeight = Math.round(cssHeight * density);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#18283f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const backdrop = ctx.createRadialGradient(420, 170, 20, 420, 280, 490);
    backdrop.addColorStop(0, '#243b55');
    backdrop.addColorStop(1, '#15243a');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (!state) return;
    if (state.seed !== lastSeed || state.elapsed < lastElapsed) reset();
    lastSeed = state.seed;
    lastElapsed = state.elapsed;
    const reduce = reducedMotion.matches;
    const now = Number.isFinite(timeNow) ? timeNow : 0;

    // A pair of rails marks the fixed banks; moving belts sit between them.
    [0, 1].forEach(index => {
      const railX = index === 0 ? 30 : WIDTH - 38;
      ctx.fillStyle = index === role ? `${COLORS[index]}45` : `${COLORS[index]}20`;
      rounded(ctx, railX, 62, 8, 476, 4);
      ctx.fill();
      ctx.fillStyle = COLORS[index];
      ctx.globalAlpha = index === role ? 0.95 : 0.5;
      rounded(ctx, railX - 1, 62, 10, 36, 5);
      ctx.fill();
      rounded(ctx, railX - 1, 502, 10, 36, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    for (let y = 0; y < ROWS; y++) {
      const rowY = TOP + CELL_H * y;
      const shifts = (state.effects || []).filter(item => item.type === 'shift' && item.y === y && item.ttl > 300);
      const latest = shifts[shifts.length - 1];
      const pulse = latest && !reduce ? Math.min(1, (latest.ttl - 300) / 400) : 0;
      // Deep shadow and the narrow top lip keep the belts tactile at phone size.
      ctx.fillStyle = '#0c1728';
      rounded(ctx, LEFT - 12, rowY + 10, CELL_W * COLS + 24, CELL_H - 8, 20);
      ctx.fill();
      ctx.fillStyle = y % 2 ? '#23374e' : '#263b53';
      rounded(ctx, LEFT - 12, rowY, CELL_W * COLS + 24, CELL_H - 12, 20);
      ctx.fill();
      ctx.strokeStyle = '#39516a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(LEFT + 6, rowY + 1);
      ctx.lineTo(LEFT + CELL_W * COLS - 6, rowY + 1);
      ctx.stroke();
      if (pulse) {
        ctx.fillStyle = `${COLORS[latest.player]}${Math.round(pulse * 32).toString(16).padStart(2, '0')}`;
        rounded(ctx, LEFT - 12, rowY, CELL_W * COLS + 24, CELL_H - 12, 20);
        ctx.fill();
      }
      for (let x = 0; x < COLS; x++) {
        const cell = center(x, y);
        if (x === 0 || x === COLS - 1) {
          const index = x === 0 ? 0 : 1;
          ctx.fillStyle = index === role ? `${COLORS[index]}13` : `${COLORS[index]}09`;
          rounded(ctx, cell.x - 43, rowY + 8, 86, CELL_H - 28, 14);
          ctx.fill();
          ctx.strokeStyle = `${COLORS[index]}70`;
          ctx.lineWidth = 2.5;
          arrow(ctx, cell.x + (index ? 31 : -31), cell.y - 7, index ? 1 : -1, 6);
        }
        // Three little grip slots make horizontal travel readable without text.
        ctx.strokeStyle = '#3c5167';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let slot = -1; slot <= 1; slot++) {
          ctx.beginPath();
          ctx.moveTo(cell.x + slot * 7, rowY + CELL_H - 23);
          ctx.lineTo(cell.x + slot * 7 + 2, rowY + CELL_H - 23);
          ctx.stroke();
        }
        if (pulse > 0) {
          ctx.globalAlpha = pulse * 0.3;
          ctx.strokeStyle = COLORS[latest.player];
          ctx.lineWidth = 2;
          arrow(ctx, cell.x + 38, cell.y - 7, latest.direction, 5);
          ctx.globalAlpha = 1;
        }
      }
    }

    // Sparklight is drawn below riders and survives snapshot replacement by ID.
    for (const item of state.sparks || []) {
      const point = smooth(`s${item.id}`, item.x, item.y, now, reduce);
      const bob = reduce ? 0 : Math.sin(now / 550 + item.id * 2.1) * 2;
      ctx.fillStyle = '#0e2033';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + 11, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      const glow = ctx.createRadialGradient(point.x, point.y - 7, 2, point.x, point.y - 7, 30);
      glow.addColorStop(0, '#fff2b435');
      glow.addColorStop(1, '#fff2b400');
      ctx.fillStyle = glow;
      ctx.fillRect(point.x - 30, point.y - 37, 60, 60);
      ctx.fillStyle = '#d9aa57';
      spark(ctx, point.x, point.y - 3 + bob, 16);
      ctx.fillStyle = CREAM;
      spark(ctx, point.x, point.y - 6 + bob, 16);
      ctx.fillStyle = '#fffbea';
      spark(ctx, point.x - 2, point.y - 8 + bob, 5);
    }

    const riderPoints = state.players.map((player, index) => smooth(`p${index}`, player.x, player.y, now, reduce));
    state.players.forEach((player, index) => {
      const point = riderPoints[index];
      const color = COLORS[index];
      const faceY = point.y - 9;
      const shield = player.stealCooldown > 0;
      ctx.fillStyle = '#08162585';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + 19, 31, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      if (index === role) {
        ctx.strokeStyle = '#fff7de';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(point.x, faceY, 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (shield) {
        ctx.strokeStyle = `${color}80`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(point.x, faceY, 39, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = index === 0 ? '#2d9c8f' : '#b34c47';
      if (index === 0) { ctx.beginPath(); ctx.arc(point.x, faceY + 5, 28, 0, Math.PI * 2); }
      else rounded(ctx, point.x - 27, faceY - 22, 54, 54, 16);
      ctx.fill();
      ctx.fillStyle = color;
      if (index === 0) { ctx.beginPath(); ctx.arc(point.x, faceY, 28, 0, Math.PI * 2); }
      else rounded(ctx, point.x - 27, faceY - 27, 54, 54, 16);
      ctx.fill();
      ctx.fillStyle = '#ffffff40';
      rounded(ctx, point.x - 14, faceY - 21, 24, 5, 3);
      ctx.fill();
      // The two silhouettes and face marks remain distinct without color.
      ctx.fillStyle = '#18323d';
      for (const side of [-1, 1]) {
        rounded(ctx, point.x + side * 9 - 2.6, faceY - 5, 5.2, index ? 7 : 8, 2.6);
        ctx.fill();
      }
      ctx.strokeStyle = '#18323d';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(point.x, faceY + 5, 6, 0.25, Math.PI - 0.25);
      ctx.stroke();
      for (let cargo = 0; cargo < CAPACITY; cargo++) {
        const pipX = point.x + (cargo - 1) * 13;
        ctx.fillStyle = '#12283b';
        ctx.beginPath();
        ctx.arc(pipX, faceY + 35, 5.8, 0, Math.PI * 2);
        ctx.fill();
        if (cargo < player.cargo) {
          ctx.fillStyle = CREAM;
          spark(ctx, pipX, faceY + 35, 5);
        } else {
          ctx.strokeStyle = '#7f92a3';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(pipX, faceY + 35, 3.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });

    for (const item of state.effects || []) {
      const point = center(item.x, item.y);
      const life = Math.max(0, Math.min(1, item.ttl / 700));
      if (item.type === 'collect') {
        ctx.globalAlpha = life * 0.65;
        ctx.strokeStyle = CREAM;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y - 7, 18 + (reduce ? 0 : (1 - life) * 23), 0, Math.PI * 2);
        ctx.stroke();
      } else if (item.type === 'bank') {
        ctx.globalAlpha = Math.min(1, life * 2);
        ctx.fillStyle = COLORS[item.player];
        ctx.font = '800 29px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${item.amount}`, point.x, point.y - 36 - (reduce ? 0 : (1 - life) * 26));
      } else if (item.type === 'steal') {
        ctx.globalAlpha = life;
        ctx.strokeStyle = CREAM;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(riderPoints[0].x, riderPoints[0].y - 9);
        ctx.lineTo(riderPoints[1].x, riderPoints[1].y - 9);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }

    // Small edge stitches frame the playfield, rather than adding another HUD.
    ctx.fillStyle = '#52687e';
    [62, 778].forEach(x => [34, 567].forEach(y => {
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }));
    for (const [key, point] of positions) if (now - point.seen > 1500) positions.delete(key);
    lastTime = now;
  }

  function reset() {
    positions = new Map();
    lastTime = 0;
    lastSeed = null;
    lastElapsed = -1;
  }

  return { draw, reset };
}
