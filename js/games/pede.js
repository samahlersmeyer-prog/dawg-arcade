// Dawgipede: Centipede-style. Shoot the bug as it snakes down through the mushrooms.
// 2 players share the bottom zone and 3 lives. Hold A to keep firing.
const SHROOM = [[200, 60, 60], [150, 50, 50], [100, 40, 40]];
const SEG = [120, 230, 90], HEAD = [255, 230, 80];

export default {
  key: 'pede', name: 'DAWGIPEDE', tag: 'CO-OP', color: [140, 240, 90], score: true,
  blurb: 'BLAST THE BUG', solo: '1 PLAYER', duo: '2P CO-OP',
  init(g) {
    g.c = Math.max(2, Math.round(3 * g.S));
    g.gw = Math.floor(g.W / g.c); g.gh = Math.floor(g.H / g.c);
    g.top = 3;                                       // rows kept for the score bar
    g.zone = g.gh - 5;                               // players live in the bottom rows
    g.mush = new Map();
    for (let n = 0; n < g.gw * g.gh * 0.05; n++) addShroom(g);
    g.lives = 3; g.points = 0; g.wave = 0;
    g.ships = g.players.map((p, i) => ({ x: g.W * (g.players.length > 1 ? (i ? 0.65 : 0.35) : 0.5), y: g.H - g.c * 1.5, cool: 0, dead: 0 }));
    g.shots = []; g.sparks = [];
    wave(g);
  },
  update(g, dt, pads) {
    const { c, S } = g;
    g.ships.forEach((s, i) => {
      if (s.dead > 0) { s.dead -= dt; return; }
      let mx, my, fire;
      if (g.players[i].cpu) [mx, my, fire] = cpu(g, i); else { mx = pads[i].x; my = pads[i].y; fire = pads[i].a; }
      const n = Math.hypot(mx, my) || 1, sp = 55 * S;
      const nx = s.x + mx / n * sp * dt, ny = s.y + my / n * sp * dt;
      if (!g.mush.has(key(g, Math.floor(nx / c), Math.floor(s.y / c)))) s.x = Math.max(c / 2, Math.min(g.W - c / 2, nx));
      if (!g.mush.has(key(g, Math.floor(s.x / c), Math.floor(ny / c)))) s.y = Math.max(g.zone * c + c / 2, Math.min(g.gh * c - c / 2, ny));
      s.cool -= dt;
      if (fire && s.cool <= 0 && !g.shots.some(t => t.o === i)) { g.shots.push({ x: s.x, y: s.y - c / 2, o: i }); s.cool = 0.06; g.sfx('shoot'); }
    });
    // bullets
    for (const t of g.shots) {
      t.y -= 190 * S * dt;
      const gx = Math.floor(t.x / c), gy = Math.floor(t.y / c);
      const segI = g.segs.findIndex(q => q.x === gx && q.y === gy);
      if (segI >= 0) {
        const q = g.segs[segI]; g.segs.splice(segI, 1); t.dead = true;
        g.points += q.head ? 100 : 10; g.mush.set(key(g, q.x, q.y), 0); g.sfx('boom');
        // the segment behind it becomes a new head
        const nb = g.segs.find(o => o.x === q.x - q.dx && o.y === q.y); if (nb) nb.head = true;
        for (let k = 0; k < 6; k++) g.sparks.push({ x: t.x, y: t.y, vx: (g.rnd() - 0.5) * 50 * S, vy: (g.rnd() - 0.5) * 50 * S, l: 0.4 });
        continue;
      }
      const mk = key(g, gx, gy);
      if (g.mush.has(mk)) { const hp = g.mush.get(mk) + 1; if (hp >= 3) { g.mush.delete(mk); g.points += 1; } else g.mush.set(mk, hp); t.dead = true; g.sfx('hit'); }
      if (t.y < g.top * c) t.dead = true;
    }
    g.shots = g.shots.filter(t => !t.dead);
    // bug
    g.acc += dt;
    const tick = 1 / (9 + g.wave * 1.5);
    while (g.acc > tick) { g.acc -= tick; crawl(g); }
    // bug touches a player
    g.ships.forEach((s, i) => {
      if (s.dead > 0) return;
      if (g.segs.some(q => Math.abs((q.x + 0.5) * c - s.x) < c * 0.9 && Math.abs((q.y + 0.5) * c - s.y) < c * 0.9)) {
        s.dead = 2; g.lives--; g.sfx('die');
        for (let k = 0; k < 16; k++) g.sparks.push({ x: s.x, y: s.y, vx: (g.rnd() - 0.5) * 70 * S, vy: (g.rnd() - 0.5) * 70 * S, l: 0.7 });
        if (g.lives <= 0) { g.over = { title: 'GAME OVER', score: g.points, sub: `SCORE ${g.points}`, sad: true }; return; }
        if (g.ships.every(o => o.dead > 0)) { g.segs = []; g.restart = 2; }
      }
    });
    if (g.restart > 0) { g.restart -= dt; if (g.restart <= 0) { g.wave--; wave(g); } }
    else if (!g.segs.length) { g.points += 50; wave(g); g.sfx('score'); }
    for (const p of g.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }
    g.sparks = g.sparks.filter(p => p.l > 0);
  },
  draw(g, f) {
    const { c, W } = g;
    f.rect(0, g.zone * c - 1, W, 1, [25, 25, 40]);
    for (const [k, hp] of g.mush) { const x = (k % g.gw) * c, y = Math.floor(k / g.gw) * c, col = SHROOM[hp];
      f.rect(x, y, c, Math.ceil(c / 2), col); f.rect(x + Math.floor(c / 3), y + Math.ceil(c / 2), Math.max(1, Math.round(c / 3)), Math.floor(c / 2), [220, 200, 170]); }
    g.segs.forEach(q => { const x = q.x * c, y = q.y * c; f.rect(x, y, c, c, q.head ? HEAD : SEG); if (q.head && c > 2) f.set(x + (q.dx > 0 ? c - 1 : 0), y + 1, [0, 0, 0]); });
    g.shots.forEach(t => f.rect(t.x, t.y, 1, Math.max(2, c - 1), [255, 255, 255]));
    g.ships.forEach((s, i) => {
      if (s.dead > 0) return;
      const col = g.players[i].color;
      f.rect(s.x - c / 2, s.y - c / 2 + 1, c, c - 1, col); f.rect(s.x, s.y - c / 2 - 1, 1, 2, [255, 255, 255]);
    });
    g.sparks.forEach(p => f.set(p.x, p.y, p.l > 0.3 ? [255, 240, 150] : [200, 90, 40]));
    f.text(String(g.points), 1, 1, [255, 220, 120]);
    for (let i = 0; i < g.lives; i++) f.rect(W - 4 - i * 5, 3, 3, 2, [240, 240, 240]);
  },
};

const key = (g, x, y) => y * g.gw + x;
function addShroom(g) {
  const x = Math.floor(g.rnd() * g.gw), y = g.top + 1 + Math.floor(g.rnd() * (g.zone - g.top - 2));
  g.mush.set(key(g, x, y), 0);
}
function wave(g) {
  g.wave++;
  const len = Math.min(16, 8 + g.wave * 2);
  g.segs = Array.from({ length: len }, (_, i) => ({ x: Math.floor(g.gw / 2) - i, y: g.top, dx: 1, down: 1, head: i === 0 }));
  g.acc = 0;
  for (let n = 0; n < 3; n++) addShroom(g);
}
function crawl(g) {
  for (const q of g.segs) {
    const nx = q.x + q.dx;
    const blocked = nx < 0 || nx >= g.gw || g.mush.has(key(g, nx, q.y));
    if (blocked) {
      // drop a row and turn around; bounce back up inside the player zone
      if (q.y + q.down >= g.gh || (q.down < 0 && q.y + q.down < g.zone)) q.down = -q.down;
      q.y += q.down; q.dx = -q.dx;
    } else q.x = nx;
  }
}
function cpu(g, i) {
  const s = g.ships[i], c = g.c;
  // chase the lowest segment's column, stay near the bottom, always firing
  let t = null; for (const q of g.segs) if (!t || q.y > t.y) t = q;
  const n = g.players.length, tx = t ? (t.x + 0.5) * c + (n > 1 ? (i ? 3 : -3) : 0) : g.W / 2;
  const danger = g.segs.some(q => Math.abs((q.x + 0.5) * c - s.x) < c * 2.5 && Math.abs((q.y + 0.5) * c - s.y) < c * 2.5);
  const ty = danger ? g.H - c : g.H - c * 2;
  const mx = Math.abs(tx - s.x) < 1 ? 0 : Math.sign(tx - s.x);
  return [danger && Math.abs(tx - s.x) < c * 2 ? -mx : mx, Math.abs(ty - s.y) < 1 ? 0 : Math.sign(ty - s.y), true];
}
