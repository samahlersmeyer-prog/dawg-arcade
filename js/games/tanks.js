// Tank Duel: drive with the D-pad, A fires. Shells bounce off walls twice. First to 5 hits.
const TANK = ['..#..', '.###.', '##o##', '#####', '#...#'];
const DIR8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const WALL = [90, 70, 50], WALL2 = [130, 100, 70];

export default {
  key: 'tanks', name: 'TANK DUEL', tag: 'VERSUS', color: [150, 220, 90],
  blurb: 'FIRST TO 5 HITS', solo: '1P VS CPU', duo: '2P VERSUS',
  init(g) {
    const { W, H, S } = g;
    g.ts = Math.max(1, Math.round(S));            // sprite scale
    g.r = 2.5 * g.ts;                              // tank half-size
    const b = Math.max(2, Math.round(2 * S));
    // walls: border + a few blocks laid out in fractions of the screen
    const R = (x, y, w, h) => ({ x: Math.round(x * W), y: Math.round(y * H), w: Math.max(b, Math.round(w * W)), h: Math.max(b, Math.round(h * H)) });
    g.walls = [{ x: 0, y: 0, w: W, h: b }, { x: 0, y: H - b, w: W, h: b }, { x: 0, y: 0, w: b, h: H }, { x: W - b, y: 0, w: b, h: H },
      R(0.47, 0.3, 0.06, 0.4), R(0.22, 0.2, 0.04, 0.22), R(0.74, 0.58, 0.04, 0.22), R(0.22, 0.7, 0.14, 0.06), R(0.64, 0.24, 0.14, 0.06)];
    g.spawn = [[W * 0.1, H * 0.5, 0], [W * 0.9, H * 0.5, 4]];
    g.tanks = g.players.map((p, i) => ({ x: g.spawn[i][0], y: g.spawn[i][1], d: g.spawn[i][2], dead: 0, cool: 0, think: 0, mv: [0, 0] }));
    g.shells = []; g.score = [0, 0]; g.sparks = [];
  },
  update(g, dt, pads) {
    const { S } = g, sp = 30 * S;
    g.tanks.forEach((k, i) => {
      if (k.dead > 0) { k.dead -= dt; if (k.dead <= 0) { [k.x, k.y, k.d] = g.spawn[i]; k.safe = 1.2; } return; }
      if (k.safe > 0) k.safe -= dt;
      k.cool -= dt;
      let mx, my, fire;
      if (g.players[i].cpu) [mx, my, fire] = cpu(g, i, dt);
      else { const p = pads[i]; mx = p.x; my = p.y; fire = p.aP || (p.a && k.cool < -0.35); }
      if (mx || my) {
        k.d = DIR8.findIndex(([a, b]) => a === mx && b === my);
        const n = Math.hypot(mx, my);
        move(g, k, mx / n * sp * dt, 0); move(g, k, 0, my / n * sp * dt);
      }
      if (fire && k.cool <= 0 && g.shells.filter(s => s.o === i).length < 2) {
        const [dx, dy] = DIR8[k.d], n = Math.hypot(dx, dy);
        g.shells.push({ x: k.x + dx / n * (g.r + 1), y: k.y + dy / n * (g.r + 1), vx: dx / n * 85 * S, vy: dy / n * 85 * S, o: i, b: 0, life: 2.6 });
        k.cool = 0.45; g.sfx('shoot');
      }
    });
    for (const s of g.shells) {
      s.life -= dt;
      const steps = 3;
      for (let n = 0; n < steps && s.life > 0; n++) {
        const h = dt / steps;
        s.x += s.vx * h; if (solid(g, s.x, s.y)) { s.x -= s.vx * h; s.vx = -s.vx; s.b++; g.sfx('bounce'); }
        s.y += s.vy * h; if (solid(g, s.x, s.y)) { s.y -= s.vy * h; s.vy = -s.vy; s.b++; g.sfx('bounce'); }
        if (s.b > 2) s.life = 0;
        g.tanks.forEach((k, i) => {
          if (k.dead > 0 || k.safe > 0 || s.life <= 0 || (i === s.o && s.b === 0)) return;
          if (Math.abs(s.x - k.x) < g.r + 0.5 && Math.abs(s.y - k.y) < g.r + 0.5) {
            s.life = 0; k.dead = 1.6; g.sfx('boom');
            const scorer = i === s.o ? 1 - i : s.o; g.score[scorer]++;
            for (let q = 0; q < 14; q++) g.sparks.push({ x: k.x, y: k.y, vx: (g.rnd() - 0.5) * 60 * S, vy: (g.rnd() - 0.5) * 60 * S, t: 0.6 });
            if (g.score[scorer] >= 5) {
              const p = g.players[scorer];
              g.over = { title: g.humans === 1 ? (p.human ? 'YOU WIN!' : 'CPU WINS') : `${p.name} WINS!`, color: p.color, sub: `${g.score[0]} - ${g.score[1]}`, sad: g.humans === 1 && !p.human, keepRunning: true };
            }
          }
        });
      }
    }
    g.shells = g.shells.filter(s => s.life > 0);
    for (const p of g.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }
    g.sparks = g.sparks.filter(p => p.t > 0);
  },
  draw(g, f) {
    g.walls.forEach((w, n) => { f.rect(w.x, w.y, w.w, w.h, WALL); if (n > 3) f.rect(w.x, w.y, w.w, 1, WALL2); });
    g.tanks.forEach((k, i) => {
      if (k.dead > 0) return;
      if (k.safe > 0 && (g.t * 10 | 0) % 2) return;
      drawTank(f, g, k, g.players[i].color);
    });
    g.shells.forEach(s => f.disc(s.x, s.y, 0.6 * g.ts, [255, 240, 160]));
    g.sparks.forEach(p => f.set(p.x, p.y, p.t > 0.3 ? [255, 220, 120] : [200, 80, 40]));
    const W = g.W, by = Math.max(2, Math.round(2 * g.S));
    f.center(String(g.score[0]), by + 1, g.players[0].color, 1, W / 2 - 18, W / 2 - 4);
    f.center(String(g.score[1]), by + 1, g.players[1].color, 1, W / 2 + 4, W / 2 + 18);
  },
};

function drawTank(f, g, k, col) {
  const s = g.ts, [dx, dy] = DIR8[k.d], dark = col.map(v => v * 0.55);
  // body: a rounded square, treads darker; barrel sticks out the facing way
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
    if (Math.abs(x) === 2 && Math.abs(y) === 2) continue;
    const tread = (dy === 0 ? Math.abs(y) === 2 : dx === 0 ? Math.abs(x) === 2 : false);
    f.rect(k.x + x * s - s / 2, k.y + y * s - s / 2, s, s, tread ? dark : col);
  }
  f.rect(k.x - s / 2, k.y - s / 2, s, s, [255, 255, 255]);
  for (let n = 1; n <= 3; n++) f.rect(k.x + dx * n * s - s / 2, k.y + dy * n * s - s / 2, s, s, [230, 230, 230]);
}
function solid(g, x, y) { return g.walls.some(w => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h); }
function blocked(g, k) {
  const r = g.r;
  return g.walls.some(w => k.x + r > w.x && k.x - r < w.x + w.w && k.y + r > w.y && k.y - r < w.y + w.h);
}
function move(g, k, dx, dy) { k.x += dx; k.y += dy; if (blocked(g, k)) { k.x -= dx; k.y -= dy; return false; } return true; }

// clear straight shot along one of the 8 directions?
function lineOfFire(g, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, tol = g.r * 0.9;
  let d = -1;
  if (Math.abs(dy) < tol) d = dx > 0 ? 0 : 4;
  else if (Math.abs(dx) < tol) d = dy > 0 ? 2 : 6;
  else if (Math.abs(Math.abs(dx) - Math.abs(dy)) < tol * 1.4) d = DIR8.findIndex(([x, y]) => x === Math.sign(dx) && y === Math.sign(dy));
  if (d < 0) return -1;
  const n = Math.ceil(Math.hypot(dx, dy));
  for (let s = 0; s < n; s += 1) if (solid(g, a.x + dx * s / n, a.y + dy * s / n)) return -1;
  return d;
}
function cpu(g, i, dt) {
  const k = g.tanks[i], e = g.tanks[1 - i];
  if (e.dead > 0) return [0, 0, false];
  // dodge: a shell coming close? step sideways
  const lof = lineOfFire(g, k, e);
  if (lof >= 0) {
    k.d = lof;
    k.aimT = (k.aimT || 0) + dt;
    if (k.aimT > (g.demo ? 0.25 : 0.35)) { k.aimT = 0; return [0, 0, true]; }
    return [0, 0, false];
  }
  k.aimT = 0;
  k.think -= dt;
  if (k.think <= 0) {
    k.think = 0.35 + g.rnd() * 0.3;
    // head for a spot lined up with the enemy (same row or column), preferring a little distance
    const opts = [];
    for (const [mx, my] of DIR8) {
      const nx = k.x + mx * 6 * g.S, ny = k.y + my * 6 * g.S;
      if (solid(g, nx, ny)) continue;
      const ddx = Math.abs(e.x - nx), ddy = Math.abs(e.y - ny);
      const align = Math.min(ddx, ddy, Math.abs(ddx - ddy));
      const dist = Math.hypot(ddx, ddy);
      opts.push([align + Math.abs(dist - 30 * g.S) * 0.3 + g.rnd() * 8, mx, my]);
    }
    opts.sort((a, b) => a[0] - b[0]);
    k.mv = opts.length ? [opts[0][1], opts[0][2]] : [0, 0];
  }
  return [k.mv[0], k.mv[1], false];
}
