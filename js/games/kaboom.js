// Kaboom! (Activision 1981): the Mad Bomber runs along the top dropping bombs. Catch them in your water buckets.
// Miss one and every bomb on screen goes off and you lose a bucket. 2 players: a bucket stack each, shared buckets.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default {
  key: 'kaboom', name: 'KABOOM!', tag: 'CO-OP', color: [255, 90, 70], score: true,
  blurb: 'CATCH THE BOMBS', solo: '1 PLAYER', duo: '2P CO-OP',
  init(g) {
    const { W, S } = g;
    g.buckets = 3; g.points = 0; g.wave = 1; g.dropped = 0;
    g.bw = Math.round(12 * S); g.bh = Math.max(2, Math.round(2.5 * S));
    g.top = 8; g.wallY = g.top + Math.round(7 * S);
    g.bomber = { x: W / 2, vx: 30 * S, t: 0 };
    g.pl = g.players.map((p, i) => ({ x: g.players.length > 1 ? W * (i ? 0.7 : 0.3) : W / 2 }));
    g.bombs = []; g.booms = []; g.pause = 1.2;
  },
  update(g, dt, pads) {
    const { W, H, S } = g;
    g.pl.forEach((p, i) => {
      let mx;
      if (g.players[i].cpu) {
        // go for the lowest bomb on our side
        const n = g.players.length, mine = g.bombs.filter(b => n < 2 || (b.x < W / 2) === (i === 0));
        const t = (mine.length ? mine : g.bombs).reduce((a, b) => (!a || b.y > a.y ? b : a), null);
        const tx = t ? t.x : (n > 1 ? W * (i ? 0.75 : 0.25) : W / 2);
        mx = Math.abs(tx - p.x) < 1 ? 0 : Math.sign(tx - p.x) * Math.min(1, Math.abs(tx - p.x) / 4);
      } else mx = pads[i].x;
      p.x = clamp(p.x + mx * 95 * S * dt, g.bw / 2, W - g.bw / 2);
    });
    for (const e of g.booms) e.l -= dt; g.booms = g.booms.filter(e => e.l > 0);
    if (g.pause > 0) { g.pause -= dt; return; }
    // bomber zig-zags, faster each wave, and changes direction at random
    const B = g.bomber, sp = (30 + g.wave * 9) * S;
    B.x += Math.sign(B.vx) * sp * dt;
    if (B.x < 6 || B.x > W - 6 || Math.random() < dt * (0.8 + g.wave * 0.2)) B.vx = B.x < 6 ? 1 : B.x > W - 6 ? -1 : -B.vx;
    B.t -= dt;
    const perWave = 10 + g.wave * 5;
    if (B.t <= 0 && g.dropped < perWave) { B.t = Math.max(0.18, 0.75 - g.wave * 0.07); g.bombs.push({ x: B.x, y: g.wallY }); g.dropped++; g.sfx('blip'); }
    const fall = (22 + g.wave * 6) * S;
    const stack = n => g.buckets > n;   // buckets left in each stack
    for (const b of g.bombs) {
      b.y += fall * dt;
      // catch: any bucket in either stack
      for (let i = 0; i < g.pl.length && !b.caught; i++) for (let k = 0; k < g.buckets; k++) {
        const by = H - 3 - k * (g.bh + 2) - g.bh;
        if (Math.abs(b.x - g.pl[i].x) < g.bw / 2 + 1 && b.y > by - 1 && b.y < by + g.bh) { b.caught = true; g.points += g.wave; g.sfx('eat'); break; }
      }
      if (!b.caught && b.y > H) b.miss = true;
    }
    if (g.bombs.some(b => b.miss)) {
      // every bomb goes off, lose a bucket
      g.bombs.forEach(b => g.booms.push({ x: b.x, y: Math.min(b.y, H - 4), l: 0.5 }));
      g.bombs = []; g.buckets--; g.sfx('boom'); g.pause = 1.5;
      g.dropped = Math.max(0, g.dropped - 4);
      if (g.buckets <= 0) { g.over = { title: 'GAME OVER', score: g.points, sub: `SCORE ${g.points}`, sad: true }; return; }
    }
    g.bombs = g.bombs.filter(b => !b.caught);
    if (g.dropped >= perWave && !g.bombs.length) { g.wave++; g.dropped = 0; g.pause = 1.2; g.sfx('score'); }
  },
  draw(g, f) {
    const { W, H } = g;
    f.rect(0, 0, W, g.wallY, [30, 30, 60]);
    for (let x = 0; x < W; x += 4) f.rect(x, g.wallY - 2, 3, 2, [140, 70, 50]);
    // the bomber: striped shirt, frown
    const B = g.bomber, bx = Math.round(B.x);
    f.rect(bx - 2, g.top - 1, 5, 3, [240, 200, 170]); f.rect(bx - 2, g.top - 2, 5, 1, [40, 40, 40]);
    for (let y = 0; y < 4; y++) f.rect(bx - 3, g.top + 2 + y, 7, 1, y % 2 ? [40, 40, 40] : [230, 230, 230]);
    g.bombs.forEach(b => { f.disc(b.x, b.y, 1.5 * g.S, [20, 20, 20]); f.ring(b.x, b.y, 1.5 * g.S, [120, 120, 130]); f.set(b.x + 1, b.y - 2 * g.S, (g.t * 12 | 0) % 2 ? [255, 220, 60] : [255, 80, 20]); });
    g.pl.forEach((p, i) => { for (let k = 0; k < g.buckets; k++) { const by = H - 3 - k * (g.bh + 2) - g.bh; f.rect(p.x - g.bw / 2, by, g.bw, g.bh, g.players[i].color); f.rect(p.x - g.bw / 2 + 1, by, g.bw - 2, 1, [140, 200, 255]); } });
    g.booms.forEach(e => f.disc(e.x, e.y, (0.5 - e.l) * 10 * g.S + 1, (g.t * 20 | 0) % 2 ? [255, 220, 80] : [255, 90, 30]));
    f.text(String(g.points), 1, 0, [255, 220, 120]);
    f.text(`W${g.wave}`, W - 16, 0, [150, 150, 170]);
  },
};
