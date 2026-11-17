// Space Invaders: the march comes down, faster as it shrinks. Hide behind the bunkers.
// 2 players each get a cannon and share 3 lives.
const A1 = ['..#..#..', '...##...', '..####..', '.##..##.', '########', '#.####.#', '#.#..#.#', '...##...'];
const A2 = ['..#..#..', '#..##..#', '#.####.#', '###..###', '########', '.######.', '..#..#..', '.#....#.'];
const ROWC = [[255, 90, 200], [120, 220, 255], [120, 255, 140], [255, 220, 90]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default {
  key: 'invaders', name: 'INVADERS', tag: 'CO-OP', color: [120, 255, 140], score: true,
  blurb: 'HOLD THE LINE', solo: '1 PLAYER', duo: '2P CO-OP',
  init(g) {
    g.lives = 3; g.points = 0; g.wave = 0;
    g.as = g.H >= 48 ? 1 : 0.5;          // alien sprite scale handled by skipping rows on tiny screens
    g.guns = g.players.map((p, i) => ({ x: g.W * (g.players.length > 1 ? (i ? 0.65 : 0.35) : 0.5), dead: 0, cool: 0 }));
    g.gy = g.H - 4;
    g.shots = []; g.bombs = []; g.boom = [];
    bunkers(g); wave(g);
  },
  update(g, dt, pads) {
    const { W, S } = g;
    g.guns.forEach((c, i) => {
      if (c.dead > 0) { c.dead -= dt; return; }
      c.cool -= dt;
      let mx, fire;
      if (g.players[i].cpu) [mx, fire] = cpu(g, i); else { mx = pads[i].x; fire = pads[i].a; }
      c.x = clamp(c.x + mx * 50 * S * dt, 4, W - 4);
      if (fire && c.cool <= 0 && !g.shots.some(t => t.o === i)) { g.shots.push({ x: c.x, y: g.gy - 3, o: i }); c.cool = 0.15; g.sfx('shoot'); }
    });
    // the march: step sideways, drop and turn at the edges; fewer aliens = faster
    const alive = g.al.filter(a => !a.dead);
    g.mt += dt;
    const step = Math.max(0.05, 0.6 * alive.length / g.al.length + 0.04 - g.wave * 0.02);
    if (g.mt > step) {
      g.mt = 0; g.frame ^= 1; g.sfx('blip');
      const minX = Math.min(...alive.map(a => g.ox + a.c * g.cw)), maxX = Math.max(...alive.map(a => g.ox + a.c * g.cw + g.aw));
      if ((g.dir > 0 && maxX + 2 >= W) || (g.dir < 0 && minX - 2 <= 0)) { g.dir = -g.dir; g.oy += 3 * S; } else g.ox += g.dir * 2 * S;
    }
    // bombs from the bottom alien of a random column
    g.bt -= dt;
    if (g.bt <= 0 && alive.length) {
      g.bt = Math.max(0.25, 1.2 - g.wave * 0.1) * (0.5 + Math.random());
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      const low = alive.filter(a => a.c === shooter.c).sort((a, b) => b.r - a.r)[0];
      g.bombs.push({ x: g.ox + low.c * g.cw + g.aw / 2, y: g.oy + low.r * g.rh + g.ah });
    }
    for (const t of g.shots) {
      t.y -= 120 * S * dt;
      if (hitBunker(g, t.x, t.y)) t.dead = true;
      for (const a of alive) {
        const ax = g.ox + a.c * g.cw, ay = g.oy + a.r * g.rh;
        if (!t.dead && t.x >= ax && t.x < ax + g.aw && t.y >= ay && t.y < ay + g.ah) { a.dead = true; t.dead = true; g.points += (4 - a.r) * 10; g.sfx('boom'); g.boom.push({ x: ax, y: ay, l: 0.25 }); }
      }
      if (g.ufo && !t.dead && Math.abs(t.x - g.ufo.x) < 4 * S && t.y < 9) { g.points += 100 + Math.floor(Math.random() * 3) * 50; g.boom.push({ x: g.ufo.x - 3, y: 3, l: 0.5 }); g.ufo = null; t.dead = true; g.sfx('score'); }
      if (t.y < 0) t.dead = true;
    }
    for (const b of g.bombs) {
      b.y += 45 * S * dt;
      if (hitBunker(g, b.x, b.y)) b.dead = true;
      g.guns.forEach(c => { if (!b.dead && c.dead <= 0 && Math.abs(b.x - c.x) < 3.5 * S && b.y > g.gy - 3 && b.y < g.gy + 3) { b.dead = true; kill(g, c); } });
      if (b.y > g.H) b.dead = true;
    }
    g.shots = g.shots.filter(t => !t.dead); g.bombs = g.bombs.filter(b => !b.dead);
    // mystery ship
    if (!g.ufo && Math.random() < dt / 18) g.ufo = { x: -6, d: 1 };
    if (g.ufo) { g.ufo.x += 25 * S * dt; if (g.ufo.x > W + 6) g.ufo = null; }
    for (const e of g.boom) e.l -= dt; g.boom = g.boom.filter(e => e.l > 0);
    // aliens reached the bottom = game over
    if (alive.some(a => g.oy + a.r * g.rh + g.ah >= g.gy - 3)) { g.lives = 0; g.guns.forEach(c => c.dead = 9); }
    if (g.lives <= 0) g.over = { title: 'GAME OVER', score: g.points, sub: `SCORE ${g.points}`, sad: true };
    else if (!alive.length) { g.points += 200; wave(g); g.sfx('score'); }
  },
  draw(g, f) {
    const { W, S } = g;
    for (const [k] of g.bunk) { const [x, y] = k.split(',').map(Number); f.set(x, y, [80, 220, 90]); }
    g.al.forEach(a => {
      if (a.dead) return;
      const x = g.ox + a.c * g.cw, y = g.oy + a.r * g.rh, spr = g.frame ? A2 : A1;
      const rows = g.ah < 8 ? spr.filter((_, j) => j % 2 === 0) : spr, cols = g.aw < 8;
      f.sprite(cols ? rows.map(r => r.split('').filter((_, j) => j % 2 === 0).join('')) : rows, x, y, { '#': ROWC[a.r % 4] });
    });
    if (g.ufo) { f.rect(g.ufo.x - 3, 3, 7, 2, [255, 60, 60]); f.rect(g.ufo.x - 1, 2, 3, 1, [255, 120, 120]); }
    g.boom.forEach(e => { for (let k = 0; k < 6; k++) f.set(e.x + Math.random() * g.aw, e.y + Math.random() * g.ah, [255, 255, 255]); });
    g.guns.forEach((c, i) => {
      if (c.dead > 0) { if ((g.t * 8 | 0) % 2) f.rect(c.x - 3, g.gy, 7, 2, [255, 120, 60]); return; }
      const col = g.players[i].color;
      f.rect(c.x - 3, g.gy, 7, 2, col); f.rect(c.x - 1, g.gy - 1, 3, 1, col); f.set(c.x, g.gy - 2, col);
    });
    g.shots.forEach(t => f.rect(t.x, t.y, 1, 2, [255, 255, 255]));
    g.bombs.forEach(b => { f.set(b.x, b.y, [255, 200, 80]); f.set(b.x + ((b.y | 0) % 2 ? 1 : -1), b.y - 1, [255, 200, 80]); });
    f.rect(0, g.H - 1, W, 1, [60, 160, 70]);
    f.text(String(g.points), 1, 0, [255, 220, 120]);
    for (let i = 0; i < g.lives; i++) f.rect(W - 4 - i * 5, 2, 3, 2, [230, 230, 230]);
  },
};

function wave(g) {
  g.wave++;
  const { W, H } = g;
  g.aw = H >= 48 ? 8 : 4; g.ah = H >= 48 ? 8 : 4;
  g.cw = g.aw + Math.max(2, Math.round(W / 64)); g.rh = g.ah + 2;
  const cols = Math.min(11, Math.floor((W * 0.7) / g.cw)), rows = H >= 48 ? 4 : 3;
  g.al = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.al.push({ r, c, dead: false });
  g.ox = Math.round((W - cols * g.cw) / 2); g.oy = 9 + Math.min(g.wave - 1, 4) * 2; g.dir = 1; g.mt = 0; g.frame = 0; g.bt = 1.5;
  g.shots = []; g.bombs = [];
}
function bunkers(g) {
  g.bunk = new Map();
  const n = 4, w = Math.round(10 * g.S), h = Math.round(5 * g.S), y = g.gy - 6 - h;
  for (let k = 0; k < n; k++) {
    const x0 = Math.round(g.W * (k + 0.5) / n - w / 2);
    for (let y1 = 0; y1 < h; y1++) for (let x1 = 0; x1 < w; x1++) {
      if (y1 === 0 && (x1 === 0 || x1 === w - 1)) continue;
      if (y1 >= h - 2 && x1 > w * 0.3 && x1 < w * 0.7) continue;    // the arch
      g.bunk.set(`${x0 + x1},${y + y1}`, 1);
    }
  }
}
function hitBunker(g, x, y) {
  const k = `${Math.round(x)},${Math.round(y)}`;
  if (!g.bunk.has(k)) return false;
  // chip a small chunk out
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (Math.random() < 0.6) g.bunk.delete(`${Math.round(x) + dx},${Math.round(y) + dy}`);
  g.bunk.delete(k); return true;
}
function kill(g, c) {
  c.dead = 1.6; g.lives--; g.sfx('die');
  g.bombs = [];
}
function cpu(g, i) {
  const c = g.guns[i];
  // dodge a bomb right above, otherwise line up under the lowest alien in our half and fire
  const bomb = g.bombs.find(b => Math.abs(b.x - c.x) < 5 * g.S && b.y > g.H * 0.45);
  if (bomb) return [c.x > bomb.x ? 1 : -1, false];
  const alive = g.al.filter(a => !a.dead);
  const n = g.players.length, mine = alive.filter(a => n < 2 || ((g.ox + a.c * g.cw) < g.W / 2) === (i === 0));
  const pool = mine.length ? mine : alive;
  if (!pool.length) return [0, false];
  const t = pool.reduce((a, b) => (b.r > a.r || (b.r === a.r && Math.abs(g.ox + b.c * g.cw - c.x) < Math.abs(g.ox + a.c * g.cw - c.x))) ? b : a);
  const tx = g.ox + t.c * g.cw + g.aw / 2 + g.dir * 3 * g.S;
  return [Math.abs(tx - c.x) < 1 ? 0 : Math.sign(tx - c.x), Math.abs(tx - c.x) < 3];
}
