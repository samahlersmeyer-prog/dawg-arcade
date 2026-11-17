// Frogger, starring a pup: hop across the road, then ride the logs and turtles across the river into the 5 dog houses.
// 1 player: high score.  2 players: both pups go at once and race to fill the houses; most points when you're both out wins.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CARS = [[255, 80, 80], [255, 220, 80], [120, 200, 255], [200, 120, 255], [255, 160, 60]];

export default {
  key: 'frogger', name: 'FROGGER', tag: 'VERSUS', alone: true, color: [120, 230, 90], score: true,
  blurb: 'HOP HOME', solo: '1 PLAYER', duo: '2P RACE',
  init(g) {
    const { W, H } = g;
    g.lh = Math.max(3, Math.floor((H - 8) / 13));
    g.oy = H - 13 * g.lh;                       // top of the home row
    g.level = 1; g.homes = [0, 0, 0, 0, 0].map(() => null);
    g.pups = g.players.map((p, i) => ({ lives: 3, points: 0, dead: 0, cool: 0, out: false }));
    g.pups.forEach((p, i) => reset(g, i));
    lanes(g);
  },
  update(g, dt, pads) {
    const { W } = g;
    g.lanes.forEach(l => { for (const o of l.objs) { o.x += l.sp * dt; const span = W + l.gap; if (l.sp > 0 && o.x > W + 2) o.x -= span + o.w; if (l.sp < 0 && o.x + o.w < -2) o.x += span + o.w; } if (l.turtles) l.phase += dt; });
    g.pups.forEach((p, i) => {
      if (p.out) return;
      if (p.dead > 0) { p.dead -= dt; if (p.dead <= 0) { if (p.lives <= 0) p.out = true; else reset(g, i); } return; }
      p.time -= dt; p.cool -= dt;
      let dx = 0, dy = 0;
      if (g.players[i].cpu) { if (p.cool <= 0) [dx, dy] = cpu(g, p); }
      else { const pd = pads[i]; if (pd.upP) dy = -1; else if (pd.downP) dy = 1; else if (pd.leftP) dx = -1; else if (pd.rightP) dx = 1; }
      if (dx || dy) {
        p.cool = 0.12;
        const nr = clamp(p.row - dy, 0, 12);
        if (nr > p.best) { p.best = nr; p.points += 10; }
        p.row = nr; p.x = clamp(p.x + dx * g.lh, 0, W - g.lh + 1); g.sfx('blip');
      }
      // riding a log/turtle
      const lane = g.lanes[p.row];
      if (lane && lane.river) {
        const on = ride(g, lane, p.x);
        if (on) p.x += lane.sp * dt; else return die(g, i);
        if (p.x < -1 || p.x > W - g.lh + 1) return die(g, i);
      }
      if (lane && lane.road && lane.objs.some(o => p.x + g.lh - 1 > o.x && p.x < o.x + o.w)) return die(g, i);
      if (p.time <= 0) return die(g, i);
      if (p.row === 12) {
        const slot = g.slotX.findIndex(sx => Math.abs(p.x + g.lh / 2 - sx) < g.lh * 0.9);
        if (slot < 0 || g.homes[slot] != null) return die(g, i);
        g.homes[slot] = i; p.points += 50 + Math.floor(p.time) * 2; g.sfx('score'); reset(g, i);
        if (g.homes.every(h => h != null)) { g.level++; g.homes = g.homes.map(() => null); g.pups.forEach(q => q.points += 100); lanes(g); }
      }
    });
    if (g.pups.every(p => p.out)) {
      if (g.players.length === 1) g.over = { title: 'GAME OVER', score: g.pups[0].points, sub: `SCORE ${g.pups[0].points}`, sad: true };
      else {
        const [a, b] = g.pups.map(p => p.points), w = a === b ? null : a > b ? 0 : 1, p = g.players[w ?? 0];
        g.over = { title: w == null ? 'TIE GAME' : g.humans === 1 ? (p.human ? 'YOU WIN!' : 'CPU WINS') : `${p.name} WINS!`, color: w == null ? [220, 220, 220] : p.color, sub: `${a} - ${b}`, sad: g.humans === 1 && w != null && !p.human };
      }
    }
  },
  draw(g, f) {
    const { W, lh } = g, Y = r => g.oy + (12 - r) * lh;
    f.rect(0, Y(12), W, lh, [20, 60, 30]);                                 // hedge with dog houses
    g.slotX.forEach((sx, k) => { f.rect(sx - lh / 2 - 1, Y(12), lh + 2, lh, [10, 20, 40]); if (g.homes[k] != null) pup(g, f, sx - lh / 2, Y(12), g.players[g.homes[k]].color); });
    for (let r = 7; r <= 11; r++) f.rect(0, Y(r), W, lh, [20, 40, 110]);   // river
    f.rect(0, Y(6), W, lh, [80, 50, 110]);                                 // median
    for (let r = 1; r <= 5; r++) f.rect(0, Y(r), W, lh, [25, 25, 28]);    // road
    for (let r = 1; r < 5; r++) for (let x = 0; x < W; x += 6) f.rect(x, Y(r) + lh - 1, 3, 1, [90, 90, 90]);
    f.rect(0, Y(0), W, lh, [80, 50, 110]);                                 // start
    g.lanes.forEach((l, r) => {
      if (!l) return;
      for (const o of l.objs) {
        if (l.road) { f.rect(o.x, Y(r) + 1, o.w, lh - 2, o.c); f.set(l.sp > 0 ? o.x + o.w - 1 : o.x, Y(r) + 1, [255, 255, 200]); }
        else if (l.turtles) { const under = dive(l, o); for (let k = 0; k < o.w; k += lh) f.disc(o.x + k + lh / 2, Y(r) + lh / 2, lh / 2 - 0.4, under ? [30, 70, 110] : [60, 170, 90]); }
        else { f.rect(o.x, Y(r) + 1, o.w, lh - 2, [140, 90, 40]); f.rect(o.x, Y(r) + 1, o.w, 1, [180, 120, 60]); }
      }
    });
    g.pups.forEach((p, i) => {
      if (p.out) return;
      if (p.dead > 0) { if ((g.t * 10 | 0) % 2) f.rect(p.x, Y(p.row), lh, lh, [255, 255, 255]); return; }
      pup(g, f, p.x, Y(p.row), g.players[i].color);
    });
    // scores, lives, time bar
    g.pups.forEach((p, i) => {
      const x = i ? W - 30 : 1;
      f.text(String(p.points), x, 0, g.players[i].color);
      for (let k = 0; k < p.lives; k++) f.rect(x + (i ? -5 - k * 3 : 26 + k * 3), 2, 2, 2, g.players[i].color);
    });
    const p0 = g.pups.find(p => !p.out && p.dead <= 0);
    if (p0) f.rect(W / 2 - 15, g.oy - 2, Math.max(0, p0.time / 30 * 30), 1, p0.time < 8 ? [255, 80, 60] : [120, 230, 90]);
  },
};

function pup(g, f, x, y, col) {
  const s = g.lh;
  f.rect(x, y + 1, s, s - 1, col); f.set(x, y, col); f.set(x + s - 1, y, col);    // ears
  f.set(x + 1, y + 1, [0, 0, 0]); if (s > 3) f.set(x + s - 2, y + 1, [0, 0, 0]);
}
function reset(g, i) {
  const p = g.pups[i], n = g.players.length;
  p.row = 0; p.best = 0; p.time = 30;
  p.x = Math.round((g.W * (n > 1 ? (i ? 0.62 : 0.38) : 0.5)) / g.lh) * g.lh;
}
function die(g, i) { const p = g.pups[i]; p.lives--; p.dead = 1.2; g.sfx('die'); }
function ride(g, l, x) {
  const c = x + g.lh / 2;
  return l.objs.some(o => c > o.x && c < o.x + o.w && !(l.turtles && dive(l, o)));
}
function dive(l, o) { return o.diver && ((l.phase + o.x * 0) % 6) > 4.6; }
function lanes(g) {
  const { W, lh, S } = g, k = 1 + (g.level - 1) * 0.15;
  g.slotX = [0.1, 0.3, 0.5, 0.7, 0.9].map(fx => Math.round(W * fx));
  const L = [];
  const mk = (sp, n, w, opt = {}) => {
    const gap = W / n, objs = [];
    for (let j = 0; j < n; j++) objs.push({ x: j * gap + Math.random() * gap * 0.3, w: w * lh, c: CARS[(n * 7 + j) % CARS.length], diver: opt.turtles && j === 0 });
    return { sp: sp * S * k, objs, gap: 0, ...opt, phase: Math.random() * 6 };
  };
  L[1] = mk(-14, 3, 2, { road: true }); L[2] = mk(18, 3, 1.5, { road: true }); L[3] = mk(-22, 2, 2, { road: true });
  L[4] = mk(28, 2, 1.5, { road: true }); L[5] = mk(-16, 2, 4, { road: true });
  L[7] = mk(-14, 3, 3, { river: true, turtles: true }); L[8] = mk(12, 3, 4, { river: true }); L[9] = mk(20, 2, 6, { river: true });
  L[10] = mk(-16, 3, 2, { river: true, turtles: true }); L[11] = mk(14, 3, 4, { river: true });
  g.lanes = L;
}
// CPU: look a moment ahead and only hop where it's safe; prefer forward
function cpu(g, p) {
  const ahead = 0.3, opts = [[0, -1, 3], [0, 0, 1], [-1, 0, 0.5], [1, 0, 0.5], [0, 1, -1]];
  let best = [0, 0], bs = -1e9;
  for (const [dx, dy, pref] of opts) {
    const r = clamp(p.row - dy, 0, 12), x = clamp(p.x + dx * g.lh, 0, g.W - g.lh);
    let s = pref + Math.random() * 0.5;
    if (!safe(g, r, x, 0.05) || !safe(g, r, x, ahead)) s -= 100;
    if (r === 12) { const slot = g.slotX.findIndex(sx => Math.abs(x + g.lh / 2 - sx) < g.lh * 0.9); s += slot >= 0 && g.homes[slot] == null ? 50 : -200; }
    if (r === 11 && dy === 0) { const free = g.slotX.filter((sx, k) => g.homes[k] == null); if (free.length) { const t = free.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a); s += -Math.abs(t - (x + g.lh / 2)) * 0.2; } }
    if (s > bs) { bs = s; best = [dx, dy]; }
  }
  return best;
}
function safe(g, r, x, t) {
  const l = g.lanes[r]; if (!l) return true;
  const shift = l.sp * t;
  if (l.road) return !l.objs.some(o => x + g.lh - 1 > o.x + shift - 1 && x < o.x + shift + o.w + 1);
  if (l.river) { const c = x + g.lh / 2 + shift; return c > 1 && c < g.W - 1 && l.objs.some(o => c > o.x + shift + 1 && c < o.x + shift + o.w - 1 && !(l.turtles && dive({ phase: l.phase + t }, o))); }
  return true;
}
