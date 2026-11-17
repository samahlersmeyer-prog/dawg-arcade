// Air Hockey: first to 7. Each player stays on their own half.
const RINK = [40, 70, 130], MID = [110, 40, 50];
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default {
  key: 'hockey', name: 'AIR HOCKEY', tag: 'VERSUS', color: [120, 200, 255],
  blurb: 'FIRST TO 7', solo: '1P VS CPU', duo: '2P VERSUS',
  init(g) {
    const { W, H, S } = g;
    g.rm = Math.max(2.5, 3.5 * S); g.rp = Math.max(1.6, 2.2 * S);
    g.mouth = Math.round(H * 0.38);
    g.goalTop = (H - g.mouth) / 2; g.goalBot = g.goalTop + g.mouth;
    g.score = [0, 0];
    g.m = g.players.map((p, i) => ({ x: i ? W - 10 * S : 10 * S, y: H / 2, vx: 0, vy: 0 }));
    g.cpuSpeed = g.demo ? 1 : 0.85;
    serve(g, g.rnd() < 0.5 ? 0 : 1);
  },
  update(g, dt, pads) {
    const { W, H, S } = g, sp = 78 * S;
    if (g.wait > 0) g.wait -= dt;
    g.players.forEach((p, i) => {
      const m = g.m[i];
      let tx, ty;
      if (p.cpu) [tx, ty] = cpu(g, i);
      const ox = m.x, oy = m.y;
      if (p.cpu) {
        const d = hyp(tx - m.x, ty - m.y), v = sp * g.cpuSpeed * dt;
        if (d > 0.01) { const k = Math.min(1, v / d); m.x += (tx - m.x) * k; m.y += (ty - m.y) * k; }
      } else {
        const pd = pads[i]; let dx = pd.x, dy = pd.y; const n = hyp(dx, dy) || 1;
        m.x += dx / n * sp * dt; m.y += dy / n * sp * dt;
      }
      const lo = i ? W / 2 + g.rm : 1 + g.rm, hi = i ? W - 1 - g.rm : W / 2 - g.rm;
      m.x = clamp(m.x, lo, hi); m.y = clamp(m.y, 1 + g.rm, H - 1 - g.rm);
      m.vx = (m.x - ox) / dt; m.vy = (m.y - oy) / dt;
    });
    if (g.wait > 0) return;
    // puck
    const P = g.p, steps = 4;
    for (let s = 0; s < steps; s++) {
      const h = dt / steps;
      P.x += P.vx * h; P.y += P.vy * h;
      if (P.y < 1 + g.rp) { P.y = 1 + g.rp; P.vy = Math.abs(P.vy); g.sfx('bounce'); }
      if (P.y > H - 1 - g.rp) { P.y = H - 1 - g.rp; P.vy = -Math.abs(P.vy); g.sfx('bounce'); }
      const inMouth = P.y > g.goalTop + 1 && P.y < g.goalBot - 1;
      if (!inMouth) {
        if (P.x < 1 + g.rp) { P.x = 1 + g.rp; P.vx = Math.abs(P.vx); g.sfx('bounce'); }
        if (P.x > W - 1 - g.rp) { P.x = W - 1 - g.rp; P.vx = -Math.abs(P.vx); g.sfx('bounce'); }
      }
      if (P.x < -g.rp) return goal(g, 1);
      if (P.x > W + g.rp) return goal(g, 0);
      g.m.forEach(m => {
        const dx = P.x - m.x, dy = P.y - m.y, d = hyp(dx, dy), min = g.rm + g.rp;
        if (d < min && d > 0) {
          const nx = dx / d, ny = dy / d;
          P.x = m.x + nx * min; P.y = m.y + ny * min;
          const rvx = P.vx - m.vx, rvy = P.vy - m.vy, dot = rvx * nx + rvy * ny;
          if (dot < 0) { P.vx -= 1.9 * dot * nx; P.vy -= 1.9 * dot * ny; P.vx += m.vx * 0.35; P.vy += m.vy * 0.35 + (g.rnd() - 0.5) * 40 * g.S; g.aim = null; g.sfx('hit'); }
        }
      });
    }
    const f = Math.exp(-0.35 * dt); P.vx *= f; P.vy *= f;
    const v = hyp(P.vx, P.vy), max = 170 * S; if (v > max) { P.vx *= max / v; P.vy *= max / v; }
    // nudge a dead puck so the game never stalls
    if (v < 3 * S) { g.still = (g.still || 0) + dt; if (g.still > 4) { P.vx = (P.x < W / 2 ? 1 : -1) * 20 * S; g.still = 0; } } else g.still = 0;
  },
  draw(g, f) {
    const { W, H } = g;
    f.frame(0, 0, W, H, RINK);
    g.players.forEach((p, i) => f.rect(i ? W - 1 : 0, g.goalTop, 1, g.mouth, p.color.map(c => c * 0.8)));
    for (let y = 2; y < H - 1; y += 2) f.set(W / 2, y, MID);
    f.ring(W / 2, H / 2, H * 0.18, MID);
    f.ring(0, H / 2, g.mouth * 0.62, RINK); f.ring(W - 1, H / 2, g.mouth * 0.62, RINK);
    const s = `${g.score[0]}  ${g.score[1]}`;
    f.center(String(g.score[0]), 3, g.players[0].color, 1, W / 2 - 16, W / 2 - 2);
    f.center(String(g.score[1]), 3, g.players[1].color, 1, W / 2 + 3, W / 2 + 17);
    g.m.forEach((m, i) => { f.disc(m.x, m.y, g.rm, g.players[i].color); f.disc(m.x, m.y, g.rm * 0.45, [255, 255, 255]); });
    const P = g.p;
    if (!(g.wait > 0) || (g.t * 6 | 0) % 2) f.disc(P.x, P.y, g.rp, [255, 255, 255]);
    if (g.flash > g.t) f.center('GOAL!', g.H / 2 - 4, g.players[g.lastGoal].color, f.fit('GOAL!', W / 2, 2) > 1 && g.H >= 48 ? 2 : 1);
  },
};

function serve(g, toward) {
  // puck starts on the side of the player who was scored on
  g.p = { x: toward ? g.W * 0.62 : g.W * 0.38, y: g.H / 2, vx: 0, vy: 0 };
  g.wait = 1;
}
function goal(g, who) {
  g.score[who]++; g.lastGoal = who; g.flash = g.t + 1.2; g.sfx('score');
  if (g.score[who] >= 7) {
    const p = g.players[who];
    g.over = { title: g.humans === 1 ? (p.human ? 'YOU WIN!' : 'CPU WINS') : `${p.name} WINS!`, color: p.color, sub: `${g.score[0]} - ${g.score[1]}`, sad: g.humans === 1 && !p.human };
    return;
  }
  serve(g, who ? 0 : 1);
}
function cpu(g, i) {
  const { W, H, S } = g, P = g.p, m = g.m[i];
  const mine = i ? P.x > W / 2 : P.x < W / 2;
  const homeX = i ? W - 9 * S : 9 * S;
  const oppGoalX = i ? -10 : W + 10;
  const coming = i ? P.vx > 5 : P.vx < -5;
  if (mine && !(g.wait > 0)) {
    // get behind the puck (relative to the other goal) and drive through it
    // pick a spot to shoot at: a corner of the goal, or a bank shot off the wall
    g.aim ||= [H / 2 + (g.rnd() - 0.5) * g.mouth * 0.8, g.rnd() < 0.3 ? (g.rnd() < 0.5 ? -H * 0.9 : H * 1.9) : null];
    const aimY = g.aim[1] ?? g.aim[0];
    const ax = P.x - oppGoalX, ay = P.y - aimY, d = hyp(ax, ay) || 1;
    const behind = (i ? P.x > m.x - 1 : P.x < m.x + 1);
    if (behind) return [homeX, P.y + (P.y < H / 2 ? 6 : -6) * S];     // puck got past: go around it, back toward goal
    return [P.x + ax / d * 2 * S + (g.rnd() - 0.5) * 2 * S, P.y + ay / d * 2 * S];
  }
  // defend: sit between puck and our goal
  const ty = H / 2 + (P.y - H / 2) * (coming ? 0.6 : 0.4) + Math.sin(g.t * 1.3 + i * 2) * 4 * S;
  return [homeX + (coming ? 0 : (i ? -6 : 6) * S), ty];
}
