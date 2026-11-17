// Snake: eat the bones, don't hit the walls or a tail.
// 1 player: classic, go for a high score.  2 players: duel, last snake alive wins the round, first to 3.
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const BONE = [245, 240, 225];

export default {
  key: 'snake', name: 'SNAKE', tag: 'VERSUS', alone: true, color: [120, 255, 140], score: true,
  blurb: 'EAT THE BONES', solo: '1 PLAYER', duo: '2P DUEL',
  init(g) {
    g.c = Math.max(2, Math.round(2 * g.S));
    g.top = 5;
    g.gw = Math.floor(g.W / g.c); g.gh = Math.floor((g.H - g.top) / g.c);
    g.wins = [0, 0]; g.points = 0;
    round(g);
  },
  update(g, dt, pads) {
    if (g.pause > 0) { g.pause -= dt; if (g.pause <= 0 && g.roundOver) round(g); return; }
    g.players.forEach((p, i) => {
      const s = g.s[i]; if (!s.alive || p.cpu) return;
      const pd = pads[i];
      if (pd.upP) s.q.push(3); else if (pd.downP) s.q.push(1); else if (pd.leftP) s.q.push(2); else if (pd.rightP) s.q.push(0);
    });
    g.acc += dt;
    const solo = g.players.length === 1;
    const rate = solo ? 9 + Math.min(10, g.s[0].body.length / 5) : 11;
    while (g.acc > 1 / rate && !g.roundOver) { g.acc -= 1 / rate; tick(g); }
  },
  draw(g, f) {
    const { c, top, W } = g;
    f.frame(0, top - 1, g.gw * c, g.gh * c + 1, [40, 60, 50]);
    g.food.forEach(([x, y]) => { f.rect(x * c, top + y * c, c, c, BONE); });
    g.s.forEach((s, i) => {
      const col = g.players[i].color;
      s.body.forEach(([x, y], k) => f.rect(x * c, top + y * c, c, c, k === 0 ? [255, 255, 255] : col.map(v => v * (s.alive ? (k % 2 ? 0.75 : 0.9) : 0.3))));
    });
    if (g.players.length === 1) { f.text(String(g.points), 1, 0, [255, 220, 120]); f.text(`LEN ${g.s[0].body.length}`, W - 34, 0, [140, 160, 140]); }
    else {
      f.center(String(g.wins[0]), 0, g.players[0].color, 1, 0, W / 2);
      f.center(String(g.wins[1]), 0, g.players[1].color, 1, W / 2, W);
      if (g.roundOver && g.pause > 0) {
        f.dim(0.5);
        const w = g.roundWinner;
        f.center(w == null ? 'DRAW' : `${g.humans === 1 && g.players[w].human ? 'YOU' : g.players[w].human ? g.players[w].name : 'CPU'} WINS ROUND`, g.H / 2 - 4, w == null ? [200, 200, 200] : g.players[w].color);
      }
    }
  },
};

function round(g) {
  const { gw, gh } = g, n = g.players.length;
  g.s = g.players.map((p, i) => {
    const y = n === 1 ? Math.floor(gh / 2) : Math.floor(gh * (i ? 0.7 : 0.3)), x = i ? gw - 6 : 5, d = i ? 2 : 0;
    return { body: [[x, y], [x - DIRS[d][0], y], [x - 2 * DIRS[d][0], y]], d, q: [], grow: 0, alive: true };
  });
  g.food = []; for (let k = 0; k < (n === 1 ? 1 : 3); k++) food(g);
  g.acc = 0; g.roundOver = false; g.pause = n === 1 ? 0.4 : 1;
}
function occupied(g, x, y) { return x < 0 || y < 0 || x >= g.gw || y >= g.gh || g.s.some(s => s.alive && s.body.some(([a, b], k) => a === x && b === y && k < s.body.length - (s.grow ? 0 : 1))); }
function food(g) {
  for (let t = 0; t < 200; t++) {
    const x = 1 + Math.floor(g.rnd() * (g.gw - 2)), y = 1 + Math.floor(g.rnd() * (g.gh - 2));
    if (!occupied(g, x, y) && !g.food.some(([a, b]) => a === x && b === y)) { g.food.push([x, y]); return; }
  }
}
function think(g, i) {
  const s = g.s[i], [hx, hy] = s.body[0];
  // BFS to the closest bone; if none reachable, take the roomiest move
  const seen = new Map([[hy * g.gw + hx, null]]), q = [[hx, hy]];
  let goal = null;
  while (q.length && !goal) {
    const [x, y] = q.shift();
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1], k = ny * g.gw + nx;
      if (seen.has(k) || occupied(g, nx, ny)) continue;
      seen.set(k, [x, y, d]); q.push([nx, ny]);
      if (g.food.some(([a, b]) => a === nx && b === ny)) { goal = [nx, ny]; break; }
    }
  }
  if (goal) {
    let cur = goal, d = null;
    while (true) { const prev = seen.get(cur[1] * g.gw + cur[0]); if (!prev) break; d = prev[2]; if (prev[0] === hx && prev[1] === hy) break; cur = [prev[0], prev[1]]; }
    if (d != null && room(g, hx + DIRS[d][0], hy + DIRS[d][1]) > s.body.length) { s.d = d; return; }
  }
  let best = s.d, bs = -1;
  for (let d = 0; d < 4; d++) { if ((d + 2) % 4 === s.d) continue; const r = room(g, hx + DIRS[d][0], hy + DIRS[d][1]); if (r > bs) { bs = r; best = d; } }
  s.d = best;
}
function room(g, x, y, cap = 150) {
  if (occupied(g, x, y)) return 0;
  const seen = new Set([y * g.gw + x]), q = [[x, y]];
  while (q.length && seen.size < cap) { const [cx, cy] = q.pop(); for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy, k = ny * g.gw + nx; if (!seen.has(k) && !occupied(g, nx, ny)) { seen.add(k); q.push([nx, ny]); } } }
  return seen.size;
}
function tick(g) {
  g.s.forEach((s, i) => {
    if (!s.alive) return;
    if (g.players[i].cpu) think(g, i);
    else while (s.q.length) { const d = s.q.shift(); if (d !== s.d && (d + 2) % 4 !== s.d) { s.d = d; break; } }
  });
  const heads = g.s.map(s => s.alive ? [s.body[0][0] + DIRS[s.d][0], s.body[0][1] + DIRS[s.d][1]] : null);
  const dead = g.s.map((s, i) => s.alive && (occupied(g, ...heads[i]) || heads.some((h, j) => j !== i && h && h[0] === heads[i][0] && h[1] === heads[i][1])));
  g.s.forEach((s, i) => {
    if (!s.alive) return;
    if (dead[i]) { s.alive = false; g.sfx('die'); return; }
    s.body.unshift(heads[i]);
    const fi = g.food.findIndex(([a, b]) => a === heads[i][0] && b === heads[i][1]);
    if (fi >= 0) { g.food.splice(fi, 1); s.grow += 3; g.points += 10; g.sfx('eat'); food(g); }
    if (s.grow > 0) s.grow--; else s.body.pop();
  });
  const alive = g.s.map((s, i) => s.alive ? i : -1).filter(i => i >= 0);
  if (g.players.length === 1) {
    if (!alive.length) g.over = { title: 'GAME OVER', score: g.points, sub: `SCORE ${g.points}`, sad: true };
    return;
  }
  if (alive.length <= 1) {
    g.roundOver = true; g.roundWinner = alive.length ? alive[0] : null;
    if (g.roundWinner != null) g.wins[g.roundWinner]++;
    const champ = g.wins.findIndex(w => w >= 3);
    if (champ >= 0) { const p = g.players[champ]; g.over = { title: g.humans === 1 ? (p.human ? 'YOU WIN!' : 'CPU WINS') : `${p.name} WINS!`, color: p.color, sub: g.wins.join(' - '), sad: g.humans === 1 && !p.human }; }
    else g.pause = 1.8;
  }
}
