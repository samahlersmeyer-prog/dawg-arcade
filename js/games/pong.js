// Pong: the original. First to 11. The ball speeds up each hit; where it hits the paddle sets the angle.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default {
  key: 'pong', name: 'PONG', tag: 'VERSUS', color: [255, 255, 255],
  blurb: 'FIRST TO 11', solo: '1P VS CPU', duo: '2P VERSUS',
  init(g) {
    const { W, H, S } = g;
    g.ph = Math.round(12 * S); g.pw = Math.max(1, Math.round(2 * S)); g.bs = Math.max(1, Math.round(2 * S));
    g.top = 9;
    g.pad = [{ y: (g.top + H) / 2 }, { y: (g.top + H) / 2 }];
    g.score = [0, 0];
    serve(g, Math.random() < 0.5 ? 0 : 1);
  },
  update(g, dt, pads) {
    const { W, H, S } = g, b = g.b;
    g.players.forEach((p, i) => {
      const pd = g.pad[i];
      let my;
      if (p.cpu) {
        // CPU follows where the ball will arrive, a bit late and a bit off
        const coming = i ? b.vx > 0 : b.vx < 0;
        let ty = (g.top + H) / 2;
        if (coming) { ty = predict(g, i ? W - 4 : 4) + (pd.err || 0); }
        my = Math.abs(ty - pd.y) < 1.5 ? 0 : Math.sign(ty - pd.y) * (g.demo ? 0.8 : 0.72);
      } else my = pads[i].y;
      pd.y = clamp(pd.y + my * 80 * S * dt, g.top + g.ph / 2, H - g.ph / 2);
    });
    if (g.wait > 0) { g.wait -= dt; return; }
    for (let s = 0; s < 3; s++) {
      const h = dt / 3;
      b.x += b.vx * h; b.y += b.vy * h;
      if (b.y < g.top) { b.y = g.top; b.vy = Math.abs(b.vy); g.sfx('bounce'); }
      if (b.y > H - g.bs) { b.y = H - g.bs; b.vy = -Math.abs(b.vy); g.sfx('bounce'); }
      [0, 1].forEach(i => {
        const px = i ? W - 3 - g.pw : 3, pd = g.pad[i];
        const toward = i ? b.vx > 0 : b.vx < 0;
        if (toward && b.x + g.bs > px && b.x < px + g.pw && b.y + g.bs > pd.y - g.ph / 2 && b.y < pd.y + g.ph / 2) {
          const off = clamp((b.y + g.bs / 2 - pd.y) / (g.ph / 2), -1, 1);
          const sp = Math.min(Math.hypot(b.vx, b.vy) * 1.06, 150 * S), ang = off * 1.0;
          b.vx = (i ? -1 : 1) * Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
          b.x = i ? px - g.bs : px + g.pw; g.sfx('hit');
          const other = g.pad[1 - i]; other.err = (Math.random() - 0.5) * g.ph * (Math.random() < 0.25 ? 1.6 : 0.6);
        }
      });
      if (b.x < -4) return point(g, 1);
      if (b.x > W + 4) return point(g, 0);
    }
  },
  draw(g, f) {
    const { W, H } = g;
    for (let y = g.top; y < H; y += 4) f.rect(W / 2 - 1, y, 1, 2, [120, 120, 120]);
    f.rect(0, g.top - 2, W, 1, [70, 70, 70]);
    f.center(String(g.score[0]), 0, g.players[0].color, 1, 0, W / 2);
    f.center(String(g.score[1]), 0, g.players[1].color, 1, W / 2, W);
    [0, 1].forEach(i => f.rect(i ? W - 3 - g.pw : 3, g.pad[i].y - g.ph / 2, g.pw, g.ph, i ? [255, 200, 170] : [190, 225, 255]));
    if (!(g.wait > 0) || (g.t * 6 | 0) % 2) f.rect(g.b.x, g.b.y, g.bs, g.bs, [255, 255, 255]);
  },
};

function serve(g, to) {
  const sp = 60 * g.S, a = (Math.random() - 0.5) * 0.9;
  g.b = { x: g.W / 2, y: (g.top + g.H) / 2, vx: (to ? 1 : -1) * Math.cos(a) * sp, vy: Math.sin(a) * sp };
  g.wait = 0.9;
}
function point(g, who) {
  g.score[who]++; g.sfx('score');
  if (g.score[who] >= 11) {
    const p = g.players[who];
    g.over = { title: g.humans === 1 ? (p.human ? 'YOU WIN!' : 'CPU WINS') : `${p.name} WINS!`, color: p.color, sub: `${g.score[0]} - ${g.score[1]}`, sad: g.humans === 1 && !p.human };
    return;
  }
  serve(g, who ? 0 : 1);
}
function predict(g, x) {
  let { x: bx, y, vx, vy } = g.b;
  if (!vx) return y;
  const t = (x - bx) / vx; y += vy * t;
  const lo = g.top, hi = g.H - g.bs, span = hi - lo;
  let m = ((y - lo) % (2 * span) + 2 * span) % (2 * span);
  return lo + (m > span ? 2 * span - m : m);
}
