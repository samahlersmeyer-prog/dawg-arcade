// Galaga: bugs fly in, line up in formation, then peel off and dive at you. 2 players fly side by side and share 3 lives.
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BEE = ['.#.#.', '#####', '.###.', '#.#.#'], BOSS = ['#...#', '.###.', '#####', '.#.#.'];
const TYPES = [{ spr: BOSS, c: [80, 220, 120], c2: [255, 120, 220], pts: 150, hp: 2 }, { spr: BEE, c: [255, 80, 80], pts: 80, hp: 1 }, { spr: BEE, c: [90, 160, 255], pts: 50, hp: 1 }];

export default {
  key: 'galaga', name: 'GALAGA', tag: 'CO-OP', color: [120, 160, 255], score: true,
  blurb: 'BLAST THE SWARM', solo: '1 PLAYER', duo: '2P CO-OP',
  init(g) {
    g.lives = 3; g.points = 0; g.wave = 0;
    g.sy = g.H - 5;
    g.ships = g.players.map((p, i) => ({ x: g.W * (g.players.length > 1 ? (i ? 0.62 : 0.38) : 0.5), dead: 0, cool: 0 }));
    g.shots = []; g.bombs = []; g.pops = [];
    g.stars = Array.from({ length: 40 }, () => ({ x: Math.random() * g.W, y: Math.random() * g.H, s: 8 + Math.random() * 20 }));
    wave(g);
  },
  update(g, dt, pads) {
    const { W, H, S } = g;
    for (const s of g.stars) { s.y += s.s * S * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
    g.ships.forEach((s, i) => {
      if (s.dead > 0) { s.dead -= dt; return; }
      s.cool -= dt;
      let mx, fire;
      if (g.players[i].cpu) [mx, fire] = cpu(g, i); else { mx = pads[i].x; fire = pads[i].aP || (pads[i].a && s.cool < -0.2); }
      s.x = clamp(s.x + mx * 70 * S * dt, 3, W - 4);
      if (fire && s.cool <= 0 && g.shots.filter(t => t.o === i).length < 2) { g.shots.push({ x: s.x, y: g.sy - 3, o: i }); s.cool = 0.18; g.sfx('shoot'); }
    });
    // formation breathes side to side
    g.ft += dt;
    const fx = Math.sin(g.ft * 0.8) * 6 * S;
    const slot = e => [g.fx0 + e.c * g.fcw + fx, 10 + e.r * g.frh];
    g.diveT -= dt;
    const inForm = g.bugs.filter(e => e.state === 'form');
    if (g.diveT <= 0 && inForm.length) {
      g.diveT = Math.max(0.6, 2.4 - g.wave * 0.25) * (0.5 + Math.random());
      const e = inForm[Math.floor(Math.random() * inForm.length)];
      const alive = g.ships.filter(s => s.dead <= 0);
      const tgt = alive.length ? alive[Math.floor(Math.random() * alive.length)] : { x: W / 2 };
      e.state = 'dive'; e.t = 0; e.tx = tgt.x; e.sx = e.x; e.sy = e.y; e.side = e.x < W / 2 ? -1 : 1; g.sfx('blip');
    }
    for (const e of g.bugs) {
      if (e.state === 'enter') {
        // swoop in along a curve to the formation spot
        e.t += dt * 0.7; const [tx, ty] = slot(e), k = Math.min(1, e.t);
        e.x = e.ex + (tx - e.ex) * k + Math.sin(k * Math.PI) * e.loop * 20 * S; e.y = e.ey + (ty - e.ey) * k - Math.sin(k * Math.PI) * 6 * S;
        if (e.t >= 1) e.state = 'form';
      } else if (e.state === 'form') { [e.x, e.y] = slot(e); }
      else if (e.state === 'dive') {
        e.t += dt;
        const k = e.t * (0.55 + g.wave * 0.04);
        e.x = e.sx + (e.tx - e.sx) * Math.min(1, k) + Math.sin(k * 5) * 10 * S * e.side;
        e.y = e.sy + k * (H + 10 - e.sy);
        if (Math.random() < dt * 1.2 && e.y < g.sy - 10) g.bombs.push({ x: e.x, y: e.y + 3 });
        if (e.y > H + 4) { e.state = 'enter'; e.t = 0; e.ex = e.x; e.ey = -4; e.loop = 0; }
      }
    }
    for (const t of g.shots) {
      t.y -= 130 * S * dt;
      for (const e of g.bugs) if (!t.dead && !e.dead && Math.abs(t.x - e.x) < 3 && Math.abs(t.y - e.y) < 3) {
        t.dead = true; e.hp--;
        if (e.hp <= 0) { e.dead = true; g.points += TYPES[e.type].pts * (e.state === 'dive' ? 2 : 1); g.pops.push({ x: e.x, y: e.y, l: 0.3 }); g.sfx('boom'); }
        else g.sfx('hit');
      }
      if (t.y < 0) t.dead = true;
    }
    for (const b of g.bombs) {
      b.y += 50 * S * dt;
      g.ships.forEach(s => { if (!b.dead && s.dead <= 0 && Math.abs(b.x - s.x) < 3 && Math.abs(b.y - g.sy) < 3) { b.dead = true; hit(g, s); } });
      if (b.y > H) b.dead = true;
    }
    // divers ramming you
    for (const e of g.bugs) if (!e.dead && e.state === 'dive') g.ships.forEach(s => { if (s.dead <= 0 && Math.abs(e.x - s.x) < 4 && Math.abs(e.y - g.sy) < 3) { e.dead = true; hit(g, s); } });
    g.shots = g.shots.filter(t => !t.dead); g.bombs = g.bombs.filter(b => !b.dead); g.bugs = g.bugs.filter(e => !e.dead);
    for (const p of g.pops) p.l -= dt; g.pops = g.pops.filter(p => p.l > 0);
    if (g.lives <= 0) { g.over = { title: 'GAME OVER', score: g.points, sub: `SCORE ${g.points}`, sad: true }; return; }
    if (!g.bugs.length) { g.points += 300; wave(g); g.sfx('score'); }
  },
  draw(g, f) {
    const { W } = g;
    for (const s of g.stars) f.set(s.x, s.y, s.s > 20 ? [120, 120, 160] : [50, 50, 80]);
    for (const e of g.bugs) {
      const T = TYPES[e.type], col = e.type === 0 && e.hp === 1 ? T.c2 : T.c;
      const flap = (g.t * 4 | 0) % 2 && e.state === 'form';
      f.sprite(flap ? T.spr.map(r => r.replace(/^#/, '.').replace(/#$/, '.')) : T.spr, e.x - 2, e.y - 2, { '#': col });
    }
    g.pops.forEach(p => { for (let k = 0; k < 5; k++) f.set(p.x + (Math.random() - 0.5) * 6, p.y + (Math.random() - 0.5) * 6, [255, 255, 200]); });
    g.ships.forEach((s, i) => {
      if (s.dead > 0) { if ((g.t * 8 | 0) % 2) f.disc(s.x, g.sy, 2, [255, 120, 60]); return; }
      const col = g.players[i].color;
      f.set(s.x, g.sy - 2, [255, 255, 255]); f.rect(s.x - 1, g.sy - 1, 3, 2, col); f.rect(s.x - 2, g.sy + 1, 5, 1, col); f.set(s.x - 2, g.sy, [255, 80, 80]); f.set(s.x + 2, g.sy, [255, 80, 80]);
    });
    g.shots.forEach(t => f.rect(t.x, t.y, 1, 2, [255, 255, 120]));
    g.bombs.forEach(b => f.set(b.x, b.y, [255, 120, 120]));
    f.text(String(g.points), 1, 0, [255, 220, 120]);
    for (let i = 0; i < g.lives; i++) f.rect(W - 4 - i * 5, 2, 3, 2, [230, 230, 255]);
  },
};

function wave(g) {
  g.wave++;
  const { W, S } = g;
  const cols = Math.min(10, Math.floor(W * 0.7 / (7 * S))), rows = g.H >= 48 ? 4 : 2;
  g.fcw = 7 * S; g.frh = 6 * S; g.fx0 = W / 2 - (cols - 1) * g.fcw / 2;
  g.bugs = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (r === 0 && (c < 2 || c >= cols - 2)) continue;
    const type = r === 0 ? 0 : r === 1 ? 1 : 2, fromLeft = (r + c) % 2 === 0;
    g.bugs.push({ r, c, type, hp: TYPES[type].hp, state: 'enter', t: -(r * cols + c) * 0.06, x: fromLeft ? -6 : W + 6, y: g.H * 0.5, ex: fromLeft ? -6 : W + 6, ey: g.H * 0.55, loop: fromLeft ? 1 : -1 });
  }
  g.ft = 0; g.diveT = 3; g.shots = []; g.bombs = [];
}
function hit(g, s) { s.dead = 1.6; g.lives--; g.sfx('die'); g.bombs = []; }
function cpu(g, i) {
  const s = g.ships[i];
  const bomb = g.bombs.find(b => Math.abs(b.x - s.x) < 4 && b.y > g.H * 0.5);
  if (bomb) return [s.x > bomb.x ? 1 : -1, false];
  const n = g.players.length;
  const pool = g.bugs.filter(e => e.state !== 'enter' && (n < 2 || (e.x < g.W / 2) === (i === 0)));
  const all = pool.length ? pool : g.bugs.filter(e => e.state !== 'enter');
  if (!all.length) return [0, false];
  const t = all.reduce((a, b) => (b.state === 'dive' && a.state !== 'dive') || (b.state === a.state && b.y > a.y) ? b : a);
  return [Math.abs(t.x - s.x) < 1 ? 0 : Math.sign(t.x - s.x), Math.abs(t.x - s.x) < 3];
}
