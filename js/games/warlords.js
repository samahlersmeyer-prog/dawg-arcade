// Warlords (Atari 1981): four castles in the corners, a king inside each. Guard yours with your shield,
// bounce the fireball into everyone else's walls. Last king standing wins the round; first to 3 rounds.
// Push the D-pad the way you want your shield to slide along your wall.
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default {
  key: 'warlords', name: 'WARLORDS', tag: 'VERSUS', slots: 4, color: [255, 120, 80],
  blurb: 'LAST KING STANDING', solo: '1P VS 3 CPU', duo: '2P + 2 CPU',
  init(g) { g.wins = [0, 0, 0, 0]; round(g); },
  update(g, dt, pads) {
    if (g.pause > 0) { g.pause -= dt; if (g.pause <= 0 && g.roundOver) round(g); return; }
    const { W, H, S } = g;
    g.k.forEach((k, i) => {
      if (k.dead) return;
      let dir = 0;
      if (g.players[i].cpu) dir = cpu(g, i);
      else {
        // which way along the arc does the D-pad point?
        const p = pads[i], [tx, ty] = tangent(g, i, k.t);
        const d = p.x * tx + p.y * ty; dir = Math.abs(d) > 0.2 ? Math.sign(d) : 0;
      }
      k.t = clamp(k.t + dir * 1.6 * dt, 0, 1);
    });
    const speedUp = !g.demo && !g.k.some((k, i) => g.players[i].human && !k.dead) ? 2.5 : 1;
    for (const b of g.balls) {
      const steps = 6;
      for (let s = 0; s < steps; s++) {
        const h = dt * speedUp / steps, ox = b.x, oy = b.y;
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < 0 || b.x > W - 1) { b.vx = -b.vx; b.x = clamp(b.x, 0, W - 1); }
        if (b.y < 0 || b.y > H - 1) { b.vy = -b.vy; b.y = clamp(b.y, 0, H - 1); }
        // shields: a short arc at radius R from each corner
        g.k.forEach((k, i) => {
          if (k.dead) return;
          const [cx, cy] = g.corner[i], dx = b.x - cx, dy = b.y - cy, d = hyp(dx, dy);
          if (Math.abs(d - g.R) > 1.6) return;
          const a = angleOf(g, i, dx, dy);
          if (Math.abs(a - k.t) * g.arcLen > g.sh / 2 + 1) return;
          const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
          if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; b.vx += (a - k.t) * 30 * S; g.sfx('hit'); b.last = i; }
        });
        // bricks
        const gx = Math.floor(b.x / g.c), gy = Math.floor(b.y / g.c), key = gy * g.gw + gx;
        if (g.bricks.has(key)) {
          const owner = g.bricks.get(key); g.bricks.delete(key); g.sfx('bounce');
          const ogx = Math.floor(ox / g.c), ogy = Math.floor(oy / g.c);
          if (ogx !== gx) b.vx = -b.vx; if (ogy !== gy) b.vy = -b.vy; if (ogx === gx && ogy === gy) { b.vx = -b.vx; b.vy = -b.vy; }
          b.x = ox; b.y = oy;
          for (let n = 0; n < 3; n++) (g.dust ||= []).push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 30 * S, vy: (Math.random() - 0.5) * 30 * S, l: 0.4, c: g.players[owner].color });
        }
        // kings
        g.k.forEach((k, i) => {
          if (k.dead) return;
          const [kx, ky] = g.king[i];
          if (hyp(b.x - kx, b.y - ky) < g.kr + 1) {
            k.dead = true; g.sfx('boom');
            for (const [key, o] of g.bricks) if (o === i) g.bricks.delete(key);
            for (let n = 0; n < 20; n++) (g.dust ||= []).push({ x: kx, y: ky, vx: (Math.random() - 0.5) * 70 * S, vy: (Math.random() - 0.5) * 70 * S, l: 0.8, c: g.players[i].color });
            b.vx = -b.vx; b.vy = -b.vy;
          }
        });
      }
      // speed creeps up over the round
      const v = hyp(b.vx, b.vy), want = Math.min(110, 55 + g.rt * 2) * S;
      b.vx *= want / v; b.vy *= want / v;
    }
    g.rt += dt;
    if (g.balls.length < Math.min(5, 2 + Math.floor(g.rt / 20))) g.balls.push(newBall(g));     // more fireballs join as the round goes on
    for (const p of g.dust || []) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }
    g.dust = (g.dust || []).filter(p => p.l > 0);
    const alive = g.k.map((k, i) => k.dead ? -1 : i).filter(i => i >= 0);
    if (alive.length <= 1) {
      g.roundOver = true; g.pause = 2.4; g.roundWinner = alive[0] ?? null;
      if (alive.length) g.wins[alive[0]]++;
      const champ = g.wins.findIndex(w => w >= 3);
      if (champ >= 0) {
        const p = g.players[champ], who = g.humans === 1 && p.human ? 'YOU' : p.human ? p.name : 'CPU';
        g.over = { title: who === 'YOU' ? 'YOU WIN!' : `${who} WINS!`, color: p.color, sub: g.wins.join(' - '), sad: g.humans === 1 && !p.human };
      }
    }
  },
  draw(g, f) {
    const { W, H } = g;
    for (const [key, o] of g.bricks) { const x = (key % g.gw) * g.c, y = Math.floor(key / g.gw) * g.c, col = g.players[o].color; f.rect(x, y, g.c, g.c, ((x + y) / g.c) % 2 ? col : col.map(v => v * 0.7)); }
    g.k.forEach((k, i) => {
      const col = g.players[i].color;
      if (!k.dead) {
        const [kx, ky] = g.king[i];
        f.disc(kx, ky, g.kr, col.map(v => v * 0.5)); f.rect(kx - 1, ky - 1, 3, 2, [255, 220, 60]); f.set(kx, ky - 2, [255, 220, 60]); // crowned king
        // shield
        for (let s = -g.sh / 2; s <= g.sh / 2; s += 0.5) { const [x, y] = arcPoint(g, i, k.t + s / g.arcLen); f.set(x, y, [255, 255, 255]); }
      }
    });
    for (const p of g.dust || []) f.set(p.x, p.y, p.c);
    for (const b of g.balls) { f.disc(b.x, b.y, 1.2 * g.S, [255, 160, 40]); f.set(b.x, b.y, [255, 255, 200]); }
    if (g.roundOver && g.pause > 0 && !g.over) {
      const w = g.roundWinner, who = w == null ? '' : g.humans === 1 && g.players[w].human ? 'YOU' : g.players[w].human ? g.players[w].name : 'CPU';
      f.center(w == null ? 'NO WINNER' : `${who} WINS ROUND`, H / 2 - 12, w == null ? [200, 200, 200] : g.players[w].color);
      g.players.forEach((p, i) => f.center(String(g.wins[i]), H / 2 + 2, p.color, 1, i * W / 4, (i + 1) * W / 4));
    }
  },
};

function round(g) {
  const { W, H, S } = g;
  g.c = Math.max(1, Math.round(2 * S));
  g.gw = Math.ceil(W / g.c);
  g.corner = [[0, 0], [W - 1, H - 1], [W - 1, 0], [0, H - 1]];
  const Rin = H * 0.19, Rout = H * 0.28;
  g.R = H * 0.36; g.kr = Math.max(2, 3 * S); g.sh = Math.max(5, 7 * S);
  g.arcLen = g.R * Math.PI / 2;
  g.king = g.corner.map(([x, y]) => [x + (x ? -1 : 1) * H * 0.09, y + (y ? -1 : 1) * H * 0.09]);
  g.bricks = new Map();
  g.corner.forEach(([cx, cy], i) => {
    for (let y = 0; y < H; y += g.c) for (let x = 0; x < W; x += g.c) {
      const d = hyp(x + g.c / 2 - cx, y + g.c / 2 - cy);
      if (d > Rin && d < Rout) g.bricks.set((y / g.c) * g.gw + x / g.c, i);
    }
  });
  g.k = g.players.map(() => ({ t: 0.5, dead: false }));
  g.balls = [newBall(g), newBall(g)];
  g.rt = 0; g.roundOver = false; g.pause = 1.2; g.dust = [];
}
function newBall(g) {
  const a = Math.random() * Math.PI * 2, sp = 50 * g.S;
  return { x: g.W / 2, y: g.H / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp };
}
// t in 0..1 runs along a castle's arc from its horizontal side to its vertical side
function arcPoint(g, i, t) {
  const [cx, cy] = g.corner[i], a = clamp(t, 0, 1) * Math.PI / 2;
  const sx = cx ? -1 : 1, sy = cy ? -1 : 1;
  return [cx + sx * Math.cos(a) * g.R, cy + sy * Math.sin(a) * g.R];
}
function angleOf(g, i, dx, dy) { return Math.atan2(Math.abs(dy), Math.abs(dx)) / (Math.PI / 2); }
function tangent(g, i, t) {
  const [x0, y0] = arcPoint(g, i, t - 0.01), [x1, y1] = arcPoint(g, i, t + 0.01), n = hyp(x1 - x0, y1 - y0) || 1;
  return [(x1 - x0) / n, (y1 - y0) / n];
}
function cpu(g, i) {
  const k = g.k[i], [cx, cy] = g.corner[i];
  // guard against the closest fireball heading our way
  let best = null, bd = 1e9;
  for (const b of g.balls) { const d = hyp(b.x - cx, b.y - cy); const coming = (b.x - cx) * b.vx + (b.y - cy) * b.vy < 0; if (coming && d < bd) { bd = d; best = b; } }
  let target = 0.5;
  if (best) {
    // where will it cross our shield circle? step it forward
    let { x, y, vx, vy } = best;
    for (let n = 0; n < 200; n++) { x += vx / 120; y += vy / 120; if (x < 0 || x > g.W) vx = -vx; if (y < 0 || y > g.H) vy = -vy; if (hyp(x - cx, y - cy) <= g.R) break; }
    target = angleOf(g, i, x - cx, y - cy) + (k.err || 0);
    if (!k.errFor || k.errFor !== best) { k.errFor = best; k.err = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.2) : (Math.random() - 0.5) * 0.12; }
  }
  return Math.abs(target - k.t) < 0.02 ? 0 : Math.sign(target - k.t) * 0.6;
}
