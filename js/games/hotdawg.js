// Hot Dawg: hot potato in bumper cars. Whoever has the sizzling hot dog when the timer runs out is out.
// Bump someone to hand it off. Last car left wins the round; first to 3 rounds.
import { makeCars, drive, bumps, walls, toward, sparks, drawCar, drawSparks, hyp, label, winTitle } from './bumper-core.js';

const FLOOR = [28, 22, 18], FLOOR2 = [34, 27, 22], WALL = [150, 90, 40];

export default {
  key: 'hotdawg', name: 'HOT DAWG', tag: 'VERSUS', slots: 4, color: [255, 150, 60],
  blurb: "DON'T GET CAUGHT", solo: '1P VS 3 CPU', duo: '2P + 2 CPU',
  init(g) { g.wins = [0, 0, 0, 0]; round(g); },
  update(g, dt, pads) {
    if (g.pause > 0) { g.pause -= dt; if (g.pause <= 0 && g.roundOver) round(g); return; }
    const { W, H } = g, b = g.b;
    const speed = !g.demo && !g.cars.some((c, i) => g.players[i].human && !c.out) ? 3 : 1;   // all people out: fast-forward
    g.fuse -= dt * speed; g.pass -= dt;
    g.cars.forEach((c, i) => {
      if (c.out) return;
      let mx, my, turbo;
      if (g.players[i].cpu) [mx, my, turbo] = cpu(g, c); else { mx = pads[i].x; my = pads[i].y; turbo = pads[i].aP; }
      drive(g, c, mx, my, turbo, dt);
      walls(g, c, b, b + 8, W - b, H - b);
      g.posts.forEach(p => { const dx = c.x - p.x, dy = c.y - p.y, d = hyp(dx, dy), min = g.cr + p.r; if (d < min && d > 0) { c.x = p.x + dx / d * min; c.y = p.y + dy / d * min; const vn = c.vx * dx / d + c.vy * dy / d; if (vn < 0) { c.vx -= 1.6 * vn * dx / d; c.vy -= 1.6 * vn * dy / d; } } });
    });
    bumps(g, (A, B) => {
      // pass the hot dog on contact (with a short no-pass-back time)
      if (g.pass > 0) return;
      if (g.holder === A.i) { g.holder = B.i; g.pass = 0.6; g.sfx('eat'); }
      else if (g.holder === B.i) { g.holder = A.i; g.pass = 0.6; g.sfx('eat'); }
    });
    if (g.fuse <= 0) {
      const c = g.cars[g.holder]; c.out = true; g.sfx('boom');
      for (let k = 0; k < 24; k++) (g.sparks ||= []).push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 90 * g.S, vy: (Math.random() - 0.5) * 90 * g.S, l: 0.8 });
      const alive = g.cars.filter(o => !o.out);
      if (alive.length <= 1) {
        g.roundOver = true; g.pause = 2.4; g.roundWinner = alive[0]?.i ?? null;
        if (alive[0]) g.wins[alive[0].i]++;
        const champ = g.wins.findIndex(x => x >= 3);
        if (champ >= 0) { const p = g.players[champ]; g.over = { title: winTitle(g, champ), color: p.color, sub: g.wins.join(' - '), sad: g.humans === 1 && !p.human }; }
      } else newFuse(g);
    }
    sparks(g, dt);
  },
  draw(g, f) {
    const { W, H } = g, b = g.b;
    for (let y = b + 8; y < H - b; y++) for (let x = b; x < W - b; x++) f.set(x, y, ((x >> 3) + (y >> 3)) % 2 ? FLOOR : FLOOR2);
    f.frame(b - 1, b + 7, W - 2 * b + 2, H - 2 * b - 6, WALL);
    g.posts.forEach(p => { f.disc(p.x, p.y, p.r, [200, 60, 60]); f.disc(p.x, p.y, p.r * 0.5, [255, 240, 240]); });
    g.cars.forEach((c, i) => drawCar(g, f, c, g.players[i].color));
    // the hot dog rides on top of whoever has it, sizzling faster as the fuse runs out
    const h = g.cars[g.holder];
    if (h && !h.out && !g.roundOver) {
      const flash = g.fuse < 2 ? (g.t * 12 | 0) % 2 : g.fuse < 4 ? (g.t * 6 | 0) % 2 : 0;
      const y = h.y - g.cr - 3, x = h.x - 3;
      f.rect(x, y, 7, 2, flash ? [255, 255, 255] : [200, 130, 70]);           // bun
      f.rect(x + 1, y - 1, 5, 1, flash ? [255, 80, 80] : [200, 60, 50]);      // dog
      f.set(x + 3, y - 2, [255, 220, 40]);                                     // mustard
      if ((g.t * 10 | 0) % 3 === 0) f.add(x + 1 + Math.random() * 5, y - 3 - Math.random() * 2, [120, 60, 0]);
    }
    drawSparks(g, f);
    // top bar: round wins and the fuse
    g.players.forEach((p, i) => { f.rect(1 + i * 9, 0 + 2, 2, 3, p.color); f.text(String(g.wins[i]), 4 + i * 9, 0, [230, 230, 230]); });
    const fw = Math.max(0, Math.round((W - 40) * g.fuse / g.fuseMax));
    if (!g.roundOver) f.rect(38, 2, fw, 3, g.fuse < 3 ? [255, 60, 40] : [255, 180, 60]);
    if (g.roundOver && g.pause > 0 && !g.over) {
      const w = g.roundWinner;
      f.center(w == null ? 'NO WINNER' : `${label(g, w)} WINS ROUND`, H / 2 - 4, w == null ? [200, 200, 200] : g.players[w].color);
    }
  },
};

function round(g) {
  const { W, H, S } = g;
  g.b = Math.max(1, Math.round(S));
  makeCars(g, [[W * 0.15, H * 0.35, 0], [W * 0.85, H * 0.75, 3.14], [W * 0.85, H * 0.35, 3.14], [W * 0.15, H * 0.75, 0]]);
  g.posts = [{ x: W * 0.33, y: H * 0.55, r: 2.5 * S }, { x: W * 0.67, y: H * 0.55, r: 2.5 * S }];
  g.roundOver = false; g.pause = 1; g.sparks = [];
  newFuse(g);
}
function newFuse(g) {
  const alive = g.cars.filter(c => !c.out);
  g.holder = alive[Math.floor(Math.random() * alive.length)].i;
  g.fuseMax = g.fuse = 9 + Math.random() * 6; g.pass = 1;
}
function cpu(g, c) {
  const others = g.cars.filter(o => o !== c && !o.out);
  if (!others.length) return [0, 0, false];
  if (g.holder === c.i) {
    // got it: chase the closest car, turbo when lined up
    others.sort((a, b) => hyp(a.x - c.x, a.y - c.y) - hyp(b.x - c.x, b.y - c.y));
    const t = others[0], d = hyp(t.x - c.x, t.y - c.y);
    const lead = d / (70 * g.S);
    const [mx, my] = toward(c, t.x + t.vx * lead, t.y + t.vy * lead);
    return [mx, my, d < 20 * g.S && g.fuse < 6 && Math.random() < 0.1];
  }
  // run away from the hot dog, but stay off the walls
  const h = g.cars[g.holder];
  let mx = c.x - h.x, my = c.y - h.y; const n = hyp(mx, my) || 1; mx /= n; my /= n;
  const cx = g.W / 2 - c.x, cy = (g.H + 8) / 2 - c.y;
  const wall = Math.min(c.x, g.W - c.x, c.y - 8, g.H - c.y) < 10 * g.S;
  if (wall) { mx += cx / g.W * 4; my += cy / g.H * 4; }
  // sidestep if it's coming straight at us
  if (n < 22 * g.S) { mx += -my * 0.8; my += mx * 0.8; }
  const close = n < 10 * g.S && g.pass <= 0;
  return [mx, my, close && Math.random() < 0.15];
}
