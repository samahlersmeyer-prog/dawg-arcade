// Fetch Breakout: knock out the bricks. 2 players share the bottom, one paddle each, and share 3 lives.
import { hsv } from '../lib/pixel.js';
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LAYOUTS = [
  r => true,
  (r, c, n) => (r + c) % 2 === 0 || r === 0,
  (r, c, n) => Math.abs(c - (n - 1) / 2) <= r * 1.5 + 1,
  (r, c, n) => c % 4 !== 1 || r === 0,
];

export default {
  key: 'breakout', name: 'FETCH BREAKOUT', tag: 'CO-OP', color: [255, 140, 200], score: true,
  blurb: 'CLEAR THE WALL', solo: '1 PLAYER', duo: '2P CO-OP',
  init(g) {
    g.lives = 3; g.level = 0; g.points = 0;
    g.pw = Math.round((g.players.length > 1 ? 13 : 16) * g.S);
    g.ph = Math.max(1, Math.round(g.S * 1.5));
    g.py = g.H - g.ph - 1;
    g.pad = g.players.map((p, i) => ({ x: g.players.length > 1 ? g.W * (i ? 0.75 : 0.25) : g.W / 2, vx: 0 }));
    g.br = Math.max(1, g.S * 1.2);
    level(g);
  },
  update(g, dt, pads) {
    const { W, S } = g;
    const n = g.players.length;
    g.players.forEach((pl, i) => {
      const p = g.pad[i], ox = p.x;
      let mx;
      if (pl.cpu) { const tx = g.ball.held ? (n > 1 ? W * (i ? 0.75 : 0.25) : W / 2) : target(g, i); mx = Math.abs(tx - p.x) < 1 ? 0 : Math.sign(tx - p.x); }
      else mx = pads[i].x;
      p.x += mx * 85 * S * dt;
      const lo = n > 1 && i ? W / 2 : 0, hi = n > 1 && !i ? W / 2 : W;
      p.x = clamp(p.x, lo + g.pw / 2, hi - g.pw / 2);
      p.vx = (p.x - ox) / dt;
      if (g.ball.held && g.ball.held.i === i && (pl.cpu ? g.t - g.ball.held.t > 1 : pads[i].aP || pads[i].upP)) launch(g);
    });
    const b = g.ball;
    if (b.held) { b.x = g.pad[b.held.i].x; b.y = g.py - g.br - 1; return; }
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const h = dt / steps;
      b.x += b.vx * h;
      if (b.x < g.br || b.x > W - g.br) { b.vx = -b.vx; b.x = clamp(b.x, g.br, W - g.br); g.sfx('bounce'); }
      else if (hitBrick(g, b)) b.vx = -b.vx;
      b.y += b.vy * h;
      if (b.y < g.br + g.top) { b.vy = Math.abs(b.vy); g.sfx('bounce'); }
      else if (hitBrick(g, b)) b.vy = -b.vy;
      // paddles
      if (b.vy > 0 && b.y + g.br >= g.py && b.y - g.br <= g.py + g.ph) {
        g.pad.forEach((p, i) => {
          if (Math.abs(b.x - p.x) <= g.pw / 2 + g.br) {
            const off = clamp((b.x - p.x) / (g.pw / 2), -1, 1), sp = Math.min(hyp(b.vx, b.vy) * 1.02, g.maxV);
            const ang = clamp(off * 1.05 + p.vx * 0.002 / S + (g.t - (g.lastBrick || 0) > 6 ? (g.rnd() - 0.5) * 0.7 : 0), -1.15, 1.15);
            b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp; b.y = g.py - g.br; g.last = i; g.sfx('hit');
          }
        });
      }
      if (b.y > g.H + 2) {
        g.lives--; g.sfx('die');
        if (g.lives <= 0) { g.over = { title: 'GAME OVER', score: g.points, sub: `SCORE ${g.points}`, sad: true }; return; }
        g.ball = { held: { i: g.last ?? 0, t: g.t } };
        return;
      }
    }
    if (!g.bricks.some(k => k.hp > 0)) { g.level++; g.points += 100; g.sfx('score'); level(g); }
  },
  draw(g, f) {
    const { W } = g;
    g.bricks.forEach(k => { if (k.hp > 0) { f.rect(k.x, k.y, k.w, k.h, k.hp > 1 ? [230, 230, 240] : k.c); f.rect(k.x, k.y + k.h - 1, k.w, 1, k.c.map(v => v * 0.6)); } });
    g.pops = (g.pops || []).filter(p => g.t - p.t < 0.3);
    g.pops.forEach(p => f.frame(p.x - 1, p.y - 1, p.w + 2, p.h + 2, p.c.map(v => v * (1 - (g.t - p.t) / 0.3))));
    g.pad.forEach((p, i) => { f.rect(p.x - g.pw / 2, g.py, g.pw, g.ph, g.players[i].color); f.rect(p.x - g.pw / 2 + 1, g.py, g.pw - 2, 1, [255, 255, 255]); });
    const b = g.ball; f.disc(b.x, b.y, g.br, [255, 255, 255]);
    // top bar: score, level, lives (bones)
    f.text(String(g.points), 1, 1, [255, 220, 120]);
    f.text(`L${g.level + 1}`, W / 2 - 5, 1, [140, 140, 160]);
    for (let i = 0; i < g.lives; i++) f.rect(W - 4 - i * 5, 3, 3, 2, [240, 240, 240]);
    f.rect(0, g.top - 2, W, 1, [40, 40, 60]);
  },
};

function level(g) {
  const { W, S } = g;
  g.top = 10;
  const bw = Math.max(4, Math.round(8 * S)), bh = Math.max(2, Math.round(3 * S));
  const cols = Math.floor((W - 2) / bw), rows = g.H >= 48 ? 6 : 4, x0 = Math.floor((W - cols * bw) / 2);
  const lay = LAYOUTS[g.level % LAYOUTS.length];
  g.bricks = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (lay(r, c, cols))
    g.bricks.push({ x: x0 + c * bw, y: g.top + 2 + r * (bh + 1), w: bw - 1, h: bh, hp: g.level >= 2 && r === 0 ? 2 : 1, row: r, c: hsv(r / rows * 0.8, 0.75, 1) });
  g.maxV = (95 + g.level * 8) * S;
  g.ball = { held: { i: 0, t: g.t } };
}
function launch(g) {
  const sp = (55 + g.level * 5) * g.S, a = (g.rnd() - 0.5) * 0.8;
  g.ball = { x: g.ball.x, y: g.ball.y, vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp };
  g.sfx('blip');
}
function hitBrick(g, b) {
  for (const k of g.bricks) {
    if (k.hp <= 0) continue;
    if (b.x + g.br > k.x && b.x - g.br < k.x + k.w && b.y + g.br > k.y && b.y - g.br < k.y + k.h) {
      k.hp--; g.lastBrick = g.t; if (k.hp <= 0) { g.points += 10 * (6 - Math.min(5, k.row)); (g.pops ||= []).push({ ...k, t: g.t }); }
      g.sfx('hit'); return true;
    }
  }
  return false;
}
// CPU paddle: get under where the ball will come down
function target(g, i) {
  const b = g.ball, n = g.players.length;
  const mid = n > 1 ? g.W * (i ? 0.75 : 0.25) : g.W / 2;
  if (b.vy < 0) return mid + (b.x - mid) * 0.3;
  let x = b.x + b.vx * ((g.py - b.y) / b.vy);
  const W = g.W; for (let k = 0; k < 4; k++) { if (x < 0) x = -x; if (x > W) x = 2 * W - x; }
  return x + Math.sin(g.t * 2 + i) * g.pw * 0.3;
}
