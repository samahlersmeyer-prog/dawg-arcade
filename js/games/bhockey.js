// Bumper Hockey: 2 on 2 in bumper cars with a big puck. First team to 5.
// 2 players: P1 + a CPU teammate vs P2 + a CPU teammate.  1 player: you + a CPU teammate vs 2 CPUs.
import { makeCars, drive, bumps, walls, toward, sparks, drawCar, drawSparks, hyp, clamp } from './bumper-core.js';

const ICE = [24, 34, 52], LINE = [60, 80, 120], RED = [120, 40, 50];

export default {
  key: 'bhockey', name: 'BUMPER HOCKEY', tag: 'VERSUS', slots: 4, color: [120, 220, 255],
  blurb: '2 ON 2  FIRST TO 5', solo: 'YOU + CPU VS 2 CPU', duo: 'P1+CPU VS P2+CPU',
  init(g) {
    const { W, H, S } = g;
    g.top = 8; g.mouth = Math.round((H - g.top) * 0.42);
    g.gy0 = g.top + (H - g.top - g.mouth) / 2; g.gy1 = g.gy0 + g.mouth;
    g.score = [0, 0];
    g.pr = Math.max(2, 2.8 * S);
    // teams: car 0 (P1) + car 2 on the left; car 1 (P2 or CPU) + car 3 on the right
    g.players.forEach((p, i) => p.team = i % 2);
    // teammates share a color family: blues on the left, oranges on the right
    g.players = g.players.map((p, i) => i === 2 ? { ...p, color: [150, 225, 255] } : i === 3 ? { ...p, color: [255, 200, 100] } : p);
    faceoff(g);
  },
  update(g, dt, pads) {
    const { W, H, S } = g;
    if (g.wait > 0) { g.wait -= dt; return; }
    g.cars.forEach((c, i) => {
      let mx, my, turbo;
      if (g.players[i].cpu) [mx, my, turbo] = cpu(g, c); else { mx = pads[i].x; my = pads[i].y; turbo = pads[i].aP; }
      drive(g, c, mx, my, turbo, dt);
      walls(g, c, 1, g.top, W - 1, H - 1);
    });
    bumps(g);
    const P = g.p;
    for (let s = 0; s < 3; s++) {
      const h = dt / 3;
      P.x += P.vx * h; P.y += P.vy * h;
      if (P.y < g.top + g.pr) { P.y = g.top + g.pr; P.vy = Math.abs(P.vy) * 0.9; }
      if (P.y > H - 1 - g.pr) { P.y = H - 1 - g.pr; P.vy = -Math.abs(P.vy) * 0.9; }
      const mouth = P.y > g.gy0 + 1 && P.y < g.gy1 - 1;
      if (!mouth && P.x < 1 + g.pr) { P.x = 1 + g.pr; P.vx = Math.abs(P.vx) * 0.9; }
      if (!mouth && P.x > W - 1 - g.pr) { P.x = W - 1 - g.pr; P.vx = -Math.abs(P.vx) * 0.9; }
      if (P.x < -g.pr) return goal(g, 1);
      if (P.x > W + g.pr) return goal(g, 0);
      g.cars.forEach(c => {
        const dx = P.x - c.x, dy = P.y - c.y, d = hyp(dx, dy), min = g.cr + g.pr;
        if (d < min && d > 0) {
          const nx = dx / d, ny = dy / d; P.x = c.x + nx * min; P.y = c.y + ny * min;
          const rv = (P.vx - c.vx) * nx + (P.vy - c.vy) * ny;
          if (rv < 0) { P.vx -= 1.8 * rv * nx; P.vy -= 1.8 * rv * ny; g.sfx('hit'); g.touch = c.i; }
        }
      });
    }
    // never let a car shove the puck through the boards
    P.y = clamp(P.y, g.top + g.pr, H - 1 - g.pr);
    if (!(P.y > g.gy0 + 1 && P.y < g.gy1 - 1)) P.x = clamp(P.x, 1 + g.pr, W - 1 - g.pr);
    // puck stuck in a corner for a while: the ref drops it back in the middle
    const nearX = P.x < 7 * S || P.x > W - 7 * S, nearY = P.y < g.top + 6 * S || P.y > H - 6 * S;
    if ((nearX && nearY) || hyp(P.vx, P.vy) < 6 * S) { g.still = (g.still || 0) + dt; if (g.still > 3) { g.still = 0; g.flash = 0; faceoff(g); return; } } else g.still = 0;
    const fr = Math.exp(-0.5 * dt); P.vx *= fr; P.vy *= fr;
    const v = hyp(P.vx, P.vy), max = 150 * S; if (v > max) { P.vx *= max / v; P.vy *= max / v; }
    sparks(g, dt);
  },
  draw(g, f) {
    const { W, H } = g;
    f.rect(0, g.top, W, H - g.top, ICE);
    f.frame(0, g.top - 1, W, H - g.top + 1, LINE);
    for (let y = g.top; y < H; y += 2) f.set(W / 2, y, RED);
    f.ring(W / 2, (g.top + H) / 2, (H - g.top) * 0.2, RED);
    [0, 1].forEach(t => f.rect(t ? W - 1 : 0, g.gy0, 1, g.mouth, teamCol(g, t)));
    g.cars.forEach((c, i) => drawCar(g, f, c, g.players[i].color));
    f.disc(g.p.x, g.p.y, g.pr, [20, 20, 20]); f.ring(g.p.x, g.p.y, g.pr, [230, 230, 230]);
    drawSparks(g, f);
    // score: team colors are the colors of each team's person (or first car)
    f.center(String(g.score[0]), 0, teamCol(g, 0), 1, 0, W / 2);
    f.center(String(g.score[1]), 0, teamCol(g, 1), 1, W / 2, W);
    f.center('-', 0, [120, 120, 120]);
    if (g.flash > g.t) f.center('GOAL!', H / 2 - 3, teamCol(g, g.last));
  },
};

const teamCol = (g, t) => g.players[t].color;
function faceoff(g) {
  const { W, H } = g, my = (g.top + H) / 2;
  makeCars(g, [[W * 0.3, my - 8 * g.S, 0], [W * 0.7, my - 8 * g.S, 3.14], [W * 0.12, my + 6 * g.S, 0], [W * 0.88, my + 6 * g.S, 3.14]]);
  g.p = { x: W / 2, y: my, vx: 0, vy: (Math.random() - 0.5) * 20 * g.S };
  g.wait = 1.2;
}
function goal(g, team) {
  g.score[team]++; g.last = team; g.flash = g.t + 1.4; g.sfx('score');
  if (g.score[team] >= 5) {
    // who's on the winning team?
    const people = g.players.filter(p => p.human && p.team === team);
    const title = g.humans === 1 ? (people.length ? 'YOU WIN!' : 'CPU WINS') : people.length ? `${people[0].name} WINS!` : 'CPU WINS';
    g.over = { title, color: teamCol(g, team), sub: `${g.score[0]} - ${g.score[1]}`, sad: g.humans >= 1 && !people.length && g.humans === 1 };
    return;
  }
  faceoff(g);
}
function cpu(g, c) {
  const { W, H, S } = g, P = g.p, team = c.i % 2;
  const ownX = team ? W - 1 : 1, oppX = team ? -10 : W + 10;
  // car 0/1 attack, car 2/3 defend; the defender attacks too when the puck is deep in our end
  const deep = team ? P.x > W * 0.7 : P.x < W * 0.3;
  const role = c.i >= 2 && !deep ? 'D' : 'A';
  if (role === 'D') {
    const gy = clamp(P.y, g.gy0, g.gy1);
    return [...toward(c, ownX + (team ? -10 : 10) * S, gy), false];
  }
  // get behind the puck (on the side away from the goal we're shooting at), then drive through it
  const ax = P.x - oppX, ay = P.y - (g.gy0 + g.gy1) / 2, d = hyp(ax, ay) || 1;
  const bx = P.x + ax / d * (g.cr + g.pr + 2), by = P.y + ay / d * (g.cr + g.pr + 2);
  const behind = team ? c.x > P.x : c.x < P.x;
  if (!behind) return [...toward(c, bx, by + (c.y < P.y ? -6 : 6) * S), false];
  const lined = hyp(c.x - bx, c.y - by) < g.cr * 1.5;
  const [mx, my] = lined ? toward(c, P.x, P.y) : toward(c, bx, by);
  return [mx, my, lined && Math.random() < 0.06];
}
