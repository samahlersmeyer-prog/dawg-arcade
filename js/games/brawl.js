// Bumper Brawl: 4 bumper cars on a floating platform with pits, saws and an ice patch.
// Knock everyone off. Last car on the platform wins the round; first to 3 rounds. The platform shrinks over time.
import { makeCars, drive, bumps, toward, sparks, drawCar, drawSparks, hyp, clamp, label, winTitle } from './bumper-core.js';

const DECK = [70, 60, 90], DECK2 = [55, 48, 72], EDGE = [255, 200, 60], ICE = [120, 200, 255], PIT = [0, 0, 0];

export default {
  key: 'brawl', name: 'BUMPER BRAWL', tag: 'VERSUS', slots: 4, color: [255, 120, 200],
  blurb: 'LAST CAR STANDING', solo: '1P VS 3 CPU', duo: '2P + 2 CPU',
  init(g) { g.wins = [0, 0, 0, 0]; round(g); },
  update(g, dt, pads) {
    if (g.pause > 0) { g.pause -= dt; if (g.pause <= 0 && g.roundOver) round(g); if (!g.roundOver) return; }
    if (g.roundOver) { g.cars.forEach(c => fallStep(g, c, dt)); sparks(g, dt); return; }
    g.rt += dt;
    // platform shrinks after 20 seconds, down to 55%
    const k = clamp(1 - (g.rt - 20) / 50, 0.55, 1);
    g.rx = g.rx0 * k; g.ry = g.ry0 * k;
    g.saws.forEach(s => { s.x = g.cx + Math.sin(g.rt * s.sp + s.ph) * g.rx * s.span; s.y = g.cy + s.oy * g.ry; });
    g.cars.forEach((c, i) => {
      if (c.out || c.fall > 0) return;
      let mx, my, turbo;
      if (g.players[i].cpu) [mx, my, turbo] = cpu(g, c, dt); else { mx = pads[i].x; my = pads[i].y; turbo = pads[i].aP; }
      c.ice = inIce(g, c.x, c.y);
      drive(g, c, mx, my, turbo, dt);
    });
    bumps(g);
    g.cars.forEach(c => {
      if (c.out || c.fall > 0) return;
      // saws knock you back hard
      g.saws.forEach(s => {
        const dx = c.x - s.x, dy = c.y - s.y, d = hyp(dx, dy);
        if (d < g.cr + s.r && d > 0) { c.vx += dx / d * 90 * g.S; c.vy += dy / d * 90 * g.S; c.spin = 0.5; g.sfx('hit'); }
      });
      if (offDeck(g, c.x, c.y)) { c.fall = 0.7; g.sfx('die'); }
    });
    g.cars.forEach(c => fallStep(g, c, dt));
    sparks(g, dt);
    const alive = g.cars.filter(c => !c.out && c.fall <= 0);
    if (alive.length <= 1 && g.cars.every(c => c.out || c.fall <= 0)) {
      g.roundOver = true; g.pause = 2.4;
      const w = alive[0]; g.roundWinner = w ? w.i : null;
      if (w) g.wins[w.i]++;
      const champ = g.wins.findIndex(x => x >= 3);
      if (champ >= 0) {
        const p = g.players[champ];
        g.over = { title: winTitle(g, champ), color: p.color, sub: g.wins.join(' - '), sad: g.humans === 1 && !p.human };
      }
    }
    // everyone with a person driving fell off: speed the CPUs up so you're not waiting
    g.fast = !g.demo && !g.cars.some((c, i) => g.players[i].human && !c.out && c.fall <= 0);
  },
  draw(g, f) {
    const { W, H } = g;
    // stars below the platform
    for (let n = 0; n < 40; n++) f.set((n * 37) % W, (n * 23 + 5) % H, [30, 30, 50]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = ell(g, x, y);
      if (e > 1) continue;
      if (g.pits.some(p => hyp(x - p.x, y - p.y) < p.r)) { f.set(x, y, PIT); continue; }
      f.set(x, y, e > 0.9 ? EDGE.map(v => v * ((x + y + (g.t * 8 | 0)) % 4 < 2 ? 1 : 0.5)) : inIce(g, x, y) ? ICE.map(v => v * 0.5) : ((x >> 2) + (y >> 2)) % 2 ? DECK : DECK2);
    }
    g.saws.forEach(s => { f.disc(s.x, s.y, s.r, [170, 170, 180]); for (let a = 0; a < 8; a++) { const ang = a * 0.785 + g.t * 12; f.set(s.x + Math.cos(ang) * (s.r + 1), s.y + Math.sin(ang) * (s.r + 1), [230, 230, 240]); } f.set(s.x, s.y, [60, 60, 60]); });
    g.cars.forEach((c, i) => { if (c.out) return; const k = c.fall > 0 ? c.fall / 0.7 : 1; drawCar(g, f, c, g.players[i].color.map(v => v * (0.4 + 0.6 * k)), k); });
    drawSparks(g, f);
    g.players.forEach((p, i) => { f.rect(1 + i * 9, 1 + 2, 2, 3, p.color); f.text(String(g.wins[i]), 4 + i * 9, 1, [230, 230, 230]); });
    if (g.roundOver && g.pause > 0 && !g.over) {
      const w = g.roundWinner;
      f.center(w == null ? 'NO WINNER' : `${label(g, w)} WINS ROUND`, H / 2 - 4, w == null ? [200, 200, 200] : g.players[w].color);
    }
  },
};

function round(g) {
  const { W, H, S } = g;
  g.cx = W / 2; g.cy = H / 2 + 1; g.rx0 = g.rx = W * 0.46; g.ry0 = g.ry = H * 0.44;
  const sp = [[W * 0.25, H * 0.3, 0.6], [W * 0.75, H * 0.7, 3.7], [W * 0.75, H * 0.3, 2.5], [W * 0.25, H * 0.7, -0.6]];
  makeCars(g, sp);
  g.pits = [{ x: W * 0.5, y: H * 0.3, r: 4.5 * S }, { x: W * 0.5, y: H * 0.72, r: 4.5 * S }];
  g.saws = [{ r: 2.5 * S, sp: 0.9, ph: 0, span: 0.55, oy: 0.05 }, { r: 2.5 * S, sp: 0.7, ph: 2, span: 0.3, oy: -0.62 }];
  g.ice = { x: W * 0.82, y: H * 0.5, rx: W * 0.1, ry: H * 0.22 };
  g.rt = 0; g.roundOver = false; g.pause = 1; g.sparks = [];
}
const ell = (g, x, y) => ((x - g.cx) / g.rx) ** 2 + ((y - g.cy) / g.ry) ** 2;
const inIce = (g, x, y) => ((x - g.ice.x) / g.ice.rx) ** 2 + ((y - g.ice.y) / g.ice.ry) ** 2 < 1 && ell(g, x, y) <= 1;
const offDeck = (g, x, y) => ell(g, x, y) > 1 || g.pits.some(p => hyp(x - p.x, y - p.y) < p.r);
function fallStep(g, c, dt) {
  if (c.fall > 0) { c.fall -= dt * (g.fast ? 3 : 1); c.x += c.vx * dt * 0.3; c.y += c.vy * dt * 0.3; c.a += dt * 8; if (c.fall <= 0) { c.out = true; c.fall = 0; } }
}

function cpu(g, c, dt) {
  const S = g.S;
  // danger first: near the edge or a pit -> head back to safe ground
  const e = ell(g, c.x, c.y);
  if (e > 0.62) return [...toward(c, g.cx, g.cy), false];
  for (const p of g.pits) if (hyp(c.x - p.x, c.y - p.y) < p.r + g.cr * 2.6) { const [a, b] = toward(c, p.x, p.y); return [-a, -b, false]; }
  for (const s of g.saws) if (hyp(c.x - s.x, c.y - s.y) < s.r + g.cr * 2.5) { const [a, b] = toward(c, s.x, s.y); return [-b * 0.5 - a, a * 0.5 - b, false]; }
  // pick a target now and then (closest car, a little random)
  c.ai.t -= dt;
  const others = g.cars.filter(o => o !== c && !o.out && o.fall <= 0);
  if (!others.length) return [0, 0, false];
  if (c.ai.t <= 0 || !others.includes(c.ai.target)) {
    c.ai.t = 1 + Math.random() * 1.5;
    others.sort((a, b) => hyp(a.x - c.x, a.y - c.y) - hyp(b.x - c.x, b.y - c.y));
    c.ai.target = others[Math.random() < 0.7 ? 0 : others.length - 1];
  }
  const t = c.ai.target;
  // come at them from the middle so the hit sends them toward the edge
  const ux = t.x - g.cx, uy = t.y - g.cy, un = hyp(ux, uy) || 1;
  const sideOK = (c.x - t.x) * ux + (c.y - t.y) * uy < 0;
  const [mx, my] = sideOK ? toward(c, t.x, t.y) : toward(c, t.x - ux / un * g.cr * 4, t.y - uy / un * g.cr * 4);
  const d = hyp(t.x - c.x, t.y - c.y), facing = Math.cos(Math.atan2(t.y - c.y, t.x - c.x) - c.a);
  return [mx, my, sideOK && d < 18 * S && facing > 0.9 && Math.random() < 0.08];
}
