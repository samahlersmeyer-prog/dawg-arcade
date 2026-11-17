// Asteroids: Left/Right turn, Up thrust, A fire, B hyperspace. Rocks split when shot. Everything wraps around.
// 2 players fly together and share 3 lives.
const hyp = Math.hypot;
const wrap = (v, m) => ((v % m) + m) % m;

export default {
  key: 'asteroids', name: 'ASTEROIDS', tag: 'CO-OP', color: [200, 200, 255], score: true,
  blurb: 'SPLIT THE ROCKS', solo: '1 PLAYER', duo: '2P CO-OP',
  init(g) {
    g.lives = 3; g.points = 0; g.wave = 0;
    g.ships = g.players.map((p, i) => spawnShip(g, i));
    g.shots = []; g.rocks = []; g.bits = [];
    nextWave(g);
  },
  update(g, dt, pads) {
    const { W, H, S } = g;
    g.ships.forEach((s, i) => {
      if (s.dead > 0) { s.dead -= dt; if (s.dead <= 0) { if (g.lives > 0) Object.assign(s, spawnShip(g, i)); else s.gone = true; } return; }
      if (s.gone) return;
      s.safe -= dt; s.cool -= dt;
      let turn, thrust, fire, hyper;
      if (g.players[i].cpu) [turn, thrust, fire] = cpu(g, s);
      else { const p = pads[i]; turn = p.x; thrust = p.up; fire = p.aP || (p.a && s.cool < -0.25); hyper = p.bP; }
      s.a += turn * 4.2 * dt;
      if (thrust) { s.vx += Math.cos(s.a) * 70 * S * dt; s.vy += Math.sin(s.a) * 70 * S * dt; }
      s.thrust = thrust;
      const dr = Math.exp(-0.6 * dt); s.vx *= dr; s.vy *= dr;
      const v = hyp(s.vx, s.vy), max = 70 * S; if (v > max) { s.vx *= max / v; s.vy *= max / v; }
      s.x = wrap(s.x + s.vx * dt, W); s.y = wrap(s.y + s.vy * dt, H);
      if (hyper) { s.x = Math.random() * W; s.y = Math.random() * H; s.vx = s.vy = 0; s.safe = 0.3; g.sfx('blip'); }
      if (fire && s.cool <= 0 && g.shots.filter(t => t.o === i).length < 4) {
        g.shots.push({ x: s.x + Math.cos(s.a) * 3 * S, y: s.y + Math.sin(s.a) * 3 * S, vx: s.vx + Math.cos(s.a) * 110 * S, vy: s.vy + Math.sin(s.a) * 110 * S, life: 0.75, o: i });
        s.cool = 0.12; g.sfx('shoot');
      }
    });
    for (const t of g.shots) { t.x = wrap(t.x + t.vx * dt, W); t.y = wrap(t.y + t.vy * dt, H); t.life -= dt; }
    for (const r of g.rocks) { r.x = wrap(r.x + r.vx * dt, W); r.y = wrap(r.y + r.vy * dt, H); r.a += r.spin * dt; }
    // shots vs rocks
    for (const t of g.shots) for (const r of g.rocks) {
      if (t.life <= 0 || r.dead) continue;
      if (wdist(g, t.x, t.y, r.x, r.y) < r.r) { t.life = 0; split(g, r); }
    }
    // rocks vs ships
    g.ships.forEach(s => {
      if (s.dead > 0 || s.gone || s.safe > 0) return;
      for (const r of g.rocks) if (!r.dead && wdist(g, s.x, s.y, r.x, r.y) < r.r + 1.5 * S) {
        s.dead = 2; g.lives--; g.sfx('die'); split(g, r);
        for (let k = 0; k < 14; k++) g.bits.push({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 60 * S, vy: (Math.random() - 0.5) * 60 * S, l: 1 });
        break;
      }
    });
    g.shots = g.shots.filter(t => t.life > 0);
    g.rocks = g.rocks.filter(r => !r.dead);
    for (const b of g.bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt; }
    g.bits = g.bits.filter(b => b.l > 0);
    if (g.lives <= 0 && g.ships.every(s => s.dead <= 0 || s.gone)) g.over = { title: 'GAME OVER', score: g.points, sub: `SCORE ${g.points}`, sad: true };
    if (!g.rocks.length) { g.pauseT = (g.pauseT || 0) + dt; if (g.pauseT > 1.5) { g.pauseT = 0; nextWave(g); } }
  },
  draw(g, f) {
    const { W, H } = g;
    for (let n = 0; n < 30; n++) f.set((n * 53) % W, (n * 29 + 7) % H, [25, 25, 40]);
    for (const r of g.rocks) {
      // lumpy outline
      const pts = 9;
      for (let k = 0; k < pts; k++) {
        const a0 = r.a + k / pts * 6.283, a1 = r.a + (k + 1) / pts * 6.283;
        const r0 = r.r * r.shape[k], r1 = r.r * r.shape[(k + 1) % pts];
        line(g, f, r.x + Math.cos(a0) * r0, r.y + Math.sin(a0) * r0, r.x + Math.cos(a1) * r1, r.y + Math.sin(a1) * r1, [190, 180, 170]);
      }
    }
    g.ships.forEach((s, i) => {
      if (s.dead > 0 || s.gone) return;
      if (s.safe > 0 && (g.t * 10 | 0) % 2) return;
      const S = g.S, col = g.players[i].color, a = s.a;
      const nose = [s.x + Math.cos(a) * 4 * S, s.y + Math.sin(a) * 4 * S];
      const l = [s.x + Math.cos(a + 2.5) * 3 * S, s.y + Math.sin(a + 2.5) * 3 * S], r = [s.x + Math.cos(a - 2.5) * 3 * S, s.y + Math.sin(a - 2.5) * 3 * S];
      line(g, f, ...nose, ...l, col); line(g, f, ...nose, ...r, col); line(g, f, ...l, ...r, col);
      if (s.thrust && (g.t * 20 | 0) % 2) f.set(s.x - Math.cos(a) * 3.5 * S, s.y - Math.sin(a) * 3.5 * S, [255, 160, 40]);
    });
    g.shots.forEach(t => f.set(t.x, t.y, [255, 255, 255]));
    g.bits.forEach(b => f.set(b.x, b.y, [255, 200, 120].map(v => v * b.l)));
    f.text(String(g.points), 1, 1, [255, 220, 120]);
    for (let i = 0; i < g.lives; i++) f.rect(W - 4 - i * 5, 2, 3, 3, [230, 230, 255]);
  },
};

function line(g, f, x0, y0, x1, y1, c) {
  // short lines; draw with wrap so rocks crossing the edge look right
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) f.set(wrap(x0 + (x1 - x0) * i / n, g.W), wrap(y0 + (y1 - y0) * i / n, g.H), c);
}
function wdist(g, x0, y0, x1, y1) { let dx = Math.abs(x0 - x1), dy = Math.abs(y0 - y1); dx = Math.min(dx, g.W - dx); dy = Math.min(dy, g.H - dy); return hyp(dx, dy); }
function spawnShip(g, i) {
  const n = g.players.length;
  return { x: g.W * (n > 1 ? (i ? 0.6 : 0.4) : 0.5), y: g.H / 2, a: -Math.PI / 2, vx: 0, vy: 0, cool: 0, dead: 0, safe: 2, gone: false };
}
function rock(g, x, y, size) {
  const sp = (12 + Math.random() * 14 + g.wave * 2) * g.S * (4 - size) * 0.6, a = Math.random() * 6.283;
  return { x, y, size, r: [0, 2.2, 4, 6.5][size] * g.S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: 0, spin: (Math.random() - 0.5) * 2, shape: Array.from({ length: 9 }, () => 0.75 + Math.random() * 0.35) };
}
function nextWave(g) {
  g.wave++;
  const n = Math.min(8, 2 + g.wave);
  for (let k = 0; k < n; k++) {
    // start along the edges, away from the ships
    const edge = Math.random() < 0.5;
    g.rocks.push(rock(g, edge ? Math.random() * g.W : 0, edge ? 0 : Math.random() * g.H, 3));
  }
}
function split(g, r) {
  r.dead = true;
  g.points += [0, 100, 50, 20][r.size]; g.sfx('boom');
  for (let k = 0; k < 6; k++) g.bits.push({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * 40 * g.S, vy: (Math.random() - 0.5) * 40 * g.S, l: 0.5 });
  if (r.size > 1) for (let k = 0; k < 2; k++) g.rocks.push(rock(g, r.x, r.y, r.size - 1));
}
function cpu(g, s) {
  // turn toward the nearest rock (leading it a little), shoot when roughly lined up, back off if it's close
  let best = null, bd = 1e9;
  for (const r of g.rocks) { const d = wdist(g, s.x, s.y, r.x, r.y); if (d < bd) { bd = d; best = r; } }
  if (!best) return [0, false, false];
  const lead = bd / (110 * g.S);
  let dx = best.x + best.vx * lead - s.x, dy = best.y + best.vy * lead - s.y;
  if (Math.abs(dx) > g.W / 2) dx -= Math.sign(dx) * g.W; if (Math.abs(dy) > g.H / 2) dy -= Math.sign(dy) * g.H;
  let d = Math.atan2(dy, dx) - s.a; d = Math.atan2(Math.sin(d), Math.cos(d));
  const turn = Math.abs(d) < 0.08 ? 0 : Math.sign(d);
  return [turn, bd > 35 * g.S && Math.abs(d) < 0.3 && Math.random() < 0.3, Math.abs(d) < 0.25 && bd < 60 * g.S];
}
