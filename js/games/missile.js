// Missile Command: protect the 6 cities. Move your crosshair, A launches a counter-missile from the nearest base;
// its blast takes out anything that flies into it. 2 players: a crosshair each.
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default {
  key: 'missile', name: 'MISSILE COMMAND', tag: 'CO-OP', color: [255, 80, 80], score: true,
  blurb: 'SAVE THE CITIES', solo: '1 PLAYER', duo: '2P CO-OP',
  init(g) {
    const { W, H, S } = g;
    g.ground = H - Math.round(4 * S);
    g.bases = [0.06, 0.5, 0.94].map(fx => ({ x: W * fx, ammo: 10 }));
    g.cities = [0.18, 0.27, 0.36, 0.64, 0.73, 0.82].map(fx => ({ x: W * fx, alive: true }));
    g.cross = g.players.map((p, i) => ({ x: g.players.length > 1 ? W * (i ? 0.7 : 0.3) : W / 2, y: H * 0.45, cool: 0 }));
    g.inc = []; g.mine = []; g.blasts = []; g.points = 0; g.wave = 0;
    nextWave(g);
  },
  update(g, dt, pads) {
    const { W, H, S } = g;
    g.cross.forEach((c, i) => {
      c.cool -= dt;
      let mx, my, fire;
      if (g.players[i].cpu) [mx, my, fire] = cpu(g, i);
      else { mx = pads[i].x; my = pads[i].y; fire = pads[i].aP; }
      c.x = clamp(c.x + mx * 90 * S * dt, 1, W - 2); c.y = clamp(c.y + my * 90 * S * dt, 8, g.ground - 6 * S);
      if (fire && c.cool <= 0) {
        // nearest base with ammo fires
        const b = g.bases.filter(b => b.ammo > 0).sort((a, b2) => Math.abs(a.x - c.x) - Math.abs(b2.x - c.x))[0];
        if (b) { b.ammo--; c.cool = 0.15; g.mine.push({ x: b.x, y: g.ground - 2, tx: c.x, ty: c.y, sx: b.x, sy: g.ground - 2, col: g.players[i].color }); g.sfx('shoot'); }
      }
    });
    if (g.pause > 0) { g.pause -= dt; if (g.pause <= 0 && g.waveDone) nextWave(g); return; }
    // our missiles fly to the crosshair spot and blow up
    for (const m of g.mine) {
      const dx = m.tx - m.x, dy = m.ty - m.y, d = hyp(dx, dy), step = 120 * S * dt;
      if (d <= step) { m.done = true; g.blasts.push({ x: m.tx, y: m.ty, t: 0, max: 7 * S, col: m.col }); g.sfx('boom'); }
      else { m.x += dx / d * step; m.y += dy / d * step; }
    }
    g.mine = g.mine.filter(m => !m.done);
    // incoming missiles
    g.spawnT -= dt;
    if (g.spawnT <= 0 && g.toSpawn > 0) {
      g.spawnT = Math.max(0.35, 1.6 - g.wave * 0.12) * (0.5 + Math.random());
      const n = Math.min(g.toSpawn, 1 + (Math.random() < 0.3 ? 1 : 0)); g.toSpawn -= n;
      for (let k = 0; k < n; k++) launch(g, Math.random() * W, 8);
    }
    for (const m of g.inc) {
      const dx = m.tx - m.sx, dy = m.ty - m.sy, d = hyp(dx, dy);
      m.p += m.sp * dt / d; m.x = m.sx + dx * m.p; m.y = m.sy + dy * m.p;
      // splitters
      if (!m.split && g.wave >= 2 && m.y > H * 0.35 && Math.random() < 0.004) { m.split = true; launch(g, m.x, m.y); }
      if (m.p >= 1) {
        m.dead = true; g.blasts.push({ x: m.tx, y: m.ty, t: 0, max: 5 * S, col: [255, 120, 60], enemy: true }); g.sfx('die');
        const c = g.cities.find(c => c.alive && Math.abs(c.x - m.tx) < 4 * S); if (c) c.alive = false;
        const b = g.bases.find(b => Math.abs(b.x - m.tx) < 4 * S); if (b) b.ammo = 0;
      }
    }
    // blasts grow then shrink; anything inside them is destroyed
    for (const b of g.blasts) {
      b.t += dt; b.r = b.max * Math.sin(Math.min(1, b.t / 1.2) * Math.PI);
      if (!b.enemy || true) for (const m of g.inc) if (!m.dead && hyp(m.x - b.x, m.y - b.y) < b.r) { m.dead = true; g.points += 25; g.blasts.push({ x: m.x, y: m.y, t: 0, max: 4 * S, col: [255, 200, 80] }); }
    }
    g.blasts = g.blasts.filter(b => b.t < 1.2);
    g.inc = g.inc.filter(m => !m.dead);
    if (!g.cities.some(c => c.alive)) { g.over = { title: 'THE END', score: g.points, sub: `SCORE ${g.points}`, sad: true }; return; }
    if (g.toSpawn <= 0 && !g.inc.length && !g.blasts.length && !g.mine.length) {
      // bonus for cities and leftover ammo
      g.points += g.cities.filter(c => c.alive).length * 100 + g.bases.reduce((a, b) => a + b.ammo, 0) * 5;
      g.waveDone = true; g.pause = 2; g.sfx('score');
    }
  },
  draw(g, f) {
    const { W, H } = g;
    f.rect(0, g.ground, W, H - g.ground, [140, 110, 40]);
    g.bases.forEach(b => { for (let k = 0; k < 4; k++) f.rect(b.x - 4 + k, g.ground - 4 + k, 9 - 2 * k, 1, [170, 140, 60]); for (let a = 0; a < b.ammo; a++) f.set(b.x - 4 + (a % 5) * 2, g.ground + 1 + Math.floor(a / 5) * 2, [80, 160, 255]); });
    g.cities.forEach(c => { if (!c.alive) { f.rect(c.x - 3, g.ground - 1, 7, 1, [70, 50, 40]); return; } f.rect(c.x - 3, g.ground - 3, 2, 3, [80, 200, 255]); f.rect(c.x - 1, g.ground - 5, 2, 5, [60, 160, 230]); f.rect(c.x + 1, g.ground - 2, 3, 2, [100, 220, 255]); });
    g.inc.forEach(m => { f.line(m.sx, m.sy, m.x, m.y, [140, 30, 30]); f.set(m.x, m.y, [255, 255, 255]); });
    g.mine.forEach(m => { f.line(m.sx, m.sy, m.x, m.y, m.col.map(v => v * 0.45)); f.set(m.x, m.y, [255, 255, 255]); f.set(m.tx, m.ty, m.col); });
    g.blasts.forEach(b => f.disc(b.x, b.y, Math.max(0.5, b.r), (g.t * 20 | 0) % 2 ? [255, 255, 255] : b.col));
    g.cross.forEach((c, i) => { const col = g.players[i].color; f.rect(c.x - 2, c.y, 5, 1, col); f.rect(c.x, c.y - 2, 1, 5, col); });
    f.text(String(g.points), 1, 0, [255, 220, 120]);
    if (g.pause > 0 && g.waveDone) f.center(`WAVE ${g.wave + 1}`, H / 2 - 4, [255, 220, 120]);
  },
};

function nextWave(g) {
  g.wave++; g.waveDone = false; g.pause = 1;
  g.toSpawn = 6 + g.wave * 3; g.spawnT = 0.5;
  g.bases.forEach(b => b.ammo = 10);
}
function launch(g, x, y) {
  const targets = [...g.cities.filter(c => c.alive).map(c => c.x), ...g.bases.map(b => b.x)];
  const tx = targets[Math.floor(Math.random() * targets.length)];
  g.inc.push({ sx: x, sy: y, x, y, tx, ty: g.ground - 1, p: 0, sp: (7 + g.wave * 1.6) * g.S });
}
function cpu(g, i) {
  const c = g.cross[i], n = g.players.length;
  // aim ahead of the lowest incoming missile on our side, fire when the crosshair is there
  const pool = g.inc.filter(m => n < 2 || (m.x < g.W / 2) === (i === 0));
  const m = (pool.length ? pool : g.inc).reduce((a, b) => (!a || b.y > a.y ? b : a), null);
  if (!m) return [0, 0, false];
  const dx = m.tx - m.sx, dy = m.ty - m.sy, d = hyp(dx, dy);
  const ax = m.x + dx / d * 6 * g.S, ay = Math.min(m.y + dy / d * 6 * g.S, g.ground - 8 * g.S);
  const ex = ax - c.x, ey = ay - c.y, e = hyp(ex, ey);
  const busy = g.mine.some(q => hyp(q.tx - ax, q.ty - ay) < 6 * g.S) || g.blasts.some(b => hyp(b.x - m.x, b.y - m.y) < b.max);
  return [e > 1 ? ex / e : 0, e > 1 ? ey / e : 0, e < 3 && !busy];
}
