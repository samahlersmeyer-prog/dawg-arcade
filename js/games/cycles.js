// Light Cycles: 4 bikes, don't hit a wall or a trail. Last bike riding wins the round; first to 3 rounds.
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // right, down, left, up

export default {
  key: 'cycles', name: 'LIGHT CYCLES', tag: 'VERSUS', color: [90, 230, 255], slots: 4,
  blurb: 'LAST ONE RIDING', solo: '1P VS 3 CPU', duo: '2P + 2 CPU',
  init(g) {
    g.c = Math.max(1, Math.round(g.S * 2));
    g.gw = Math.floor(g.W / g.c); g.gh = Math.floor(g.H / g.c);
    g.wins = g.players.map(() => 0);
    newRound(g);
  },
  update(g, dt, pads) {
    if (g.pause > 0) { g.pause -= dt; if (g.pause <= 0 && g.roundOver) newRound(g); return; }
    g.players.forEach((p, i) => {
      const b = g.b[i]; if (!b.alive || p.cpu) return;
      const pd = pads[i];
      let want = null;
      if (pd.upP) want = 3; else if (pd.downP) want = 1; else if (pd.leftP) want = 2; else if (pd.rightP) want = 0;
      if (want != null) b.queue.push(want);
    });
    g.acc += dt;
    // once every person has crashed, fast-forward the CPU bikes
    const watching = !g.demo && !g.b.some((b, i) => b.alive && g.players[i].human);
    const tick = 1 / ((13 + g.ticks / 60) * (watching ? 4 : 1));
    while (g.acc >= tick && !g.roundOver) { g.acc -= tick; step(g); }
    g.boom = g.boom.filter(e => g.t - e.t < 0.8);
  },
  draw(g, f) {
    const { c } = g;
    for (let y = 0; y < g.gh; y += 4) for (let x = 0; x < g.gw; x += 4) f.set(x * c, y * c, [20, 30, 45]);
    f.frame(0, 0, g.gw * c, g.gh * c, [40, 60, 90]);
    for (let i = 0; i < g.grid.length; i++) {
      const o = g.grid[i]; if (!o) continue;
      const b = g.b[o - 1], col = g.players[o - 1].color, k = b.alive ? 0.7 : 0.25;
      f.rect((i % g.gw) * c, Math.floor(i / g.gw) * c, c, c, col.map(v => v * k));
    }
    g.b.forEach((b, i) => { if (b.alive) f.rect(b.x * c, b.y * c, c, c, [255, 255, 255]); });
    g.boom.forEach(e => { const r = (g.t - e.t) * 10 * g.S; f.ring(e.x * c, e.y * c, r, e.col); f.ring(e.x * c, e.y * c, r * 0.6, [255, 255, 200]); });
    if (g.roundOver && g.pause > 0) {
      f.dim(0.5);
      const w = g.roundWinner, msg = w == null ? 'NO WINNER' : `${who(g, w)} WINS ROUND`;
      f.center(msg, g.H / 2 - 12, w == null ? [200, 200, 200] : g.players[w].color);
      const n = g.players.length, cw = g.W / n;
      g.players.forEach((p, i) => f.center(String(g.wins[i]), g.H / 2 + 2, p.color, g.H >= 48 ? 2 : 1, i * cw, (i + 1) * cw));
    }
  },
};

const who = (g, i) => g.humans === 1 && g.players[i].human ? 'YOU' : g.players[i].human ? g.players[i].name : 'CPU';

function newRound(g) {
  const { gw, gh } = g;
  g.grid = new Uint8Array(gw * gh);
  const starts = [[0.15, 0.3, 0], [0.85, 0.7, 2], [0.5, 0.12, 1], [0.5, 0.88, 3]];
  g.b = g.players.map((p, i) => {
    const [fx, fy, d] = starts[i];
    const b = { x: Math.round(gw * fx), y: Math.round(gh * fy), d, alive: true, queue: [] };
    g.grid[b.y * gw + b.x] = i + 1;
    return b;
  });
  g.acc = 0; g.ticks = 0; g.roundOver = false; g.pause = 1.2; g.boom = [];
}

const free = (g, x, y) => x >= 0 && y >= 0 && x < g.gw && y < g.gh && !g.grid[y * g.gw + x];

function space(g, x, y, cap = 250) {
  // how many cells you can still reach from here (flood fill, capped)
  if (!free(g, x, y)) return 0;
  const seen = new Set([y * g.gw + x]), q = [[x, y]];
  while (q.length && seen.size < cap) {
    const [cx, cy] = q.pop();
    for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy, k = ny * g.gw + nx; if (!seen.has(k) && free(g, nx, ny)) { seen.add(k); q.push([nx, ny]); } }
  }
  return seen.size;
}

function think(g, i) {
  const b = g.b[i];
  let best = b.d, bestS = -1;
  for (const turn of [0, 1, 3]) {
    const d = (b.d + turn) % 4, [dx, dy] = DIRS[d];
    let s = space(g, b.x + dx, b.y + dy);
    if (s > 0) {
      // look a few cells ahead; prefer going straight, small random wiggle
      let run = 0; while (run < 6 && free(g, b.x + dx * (run + 1), b.y + dy * (run + 1))) run++;
      s += run * 3 + (turn === 0 ? 4 : 0) + g.rnd() * 6;
    }
    if (s > bestS) { bestS = s; best = d; }
  }
  b.d = best;
}

function step(g) {
  g.ticks++;
  const { gw } = g;
  g.b.forEach((b, i) => {
    if (!b.alive) return;
    if (g.players[i].cpu) think(g, i);
    else while (b.queue.length) { const d = b.queue.shift(); if (d !== b.d && (d + 2) % 4 !== b.d) { b.d = d; break; } }
  });
  // move everyone, then check crashes (so two bikes hitting the same cell both crash)
  const next = g.b.map(b => b.alive ? [b.x + DIRS[b.d][0], b.y + DIRS[b.d][1]] : null);
  const dead = g.b.map((b, i) => {
    if (!b.alive) return false;
    const [x, y] = next[i];
    if (!free(g, x, y)) return true;
    return next.some((n, j) => j !== i && n && n[0] === x && n[1] === y);
  });
  g.b.forEach((b, i) => {
    if (!b.alive) return;
    if (dead[i]) { b.alive = false; g.boom.push({ x: b.x, y: b.y, t: g.t, col: g.players[i].color }); g.sfx('boom'); return; }
    [b.x, b.y] = next[i]; g.grid[b.y * gw + b.x] = i + 1;
  });
  const alive = g.b.map((b, i) => b.alive ? i : -1).filter(i => i >= 0);
  // round ends when one bike is left, or (in a game with people) when every person has crashed
  if (alive.length <= 1) {
    g.roundOver = true; g.roundWinner = alive.length === 1 ? alive[0] : null;
    if (g.roundWinner != null) g.wins[g.roundWinner]++;
    const champ = g.wins.findIndex(w => w >= 3);
    if (champ >= 0) {
      const p = g.players[champ];
      g.over = { title: `${who(g, champ)} WIN${who(g, champ) === 'YOU' ? '' : 'S'}!`, color: p.color, sub: g.wins.join(' - '), sad: g.humans === 1 && !p.human };
    } else g.pause = 2.2;
  }
}
