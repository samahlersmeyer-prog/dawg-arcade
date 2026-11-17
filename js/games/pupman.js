// Pup-Man: eat every kibble in the maze while the cats chase you. Bones make the cats scared: chase them back!
// The middle row is a tunnel that wraps around. 2 players: two pups in the same maze, sharing 3 lives.
const LEFT = [
  '################',
  '#o..............',
  '#.###.##.######.',
  '#.#...#.........',
  '#.#.#.#.#.#.####',
  '#...#.....#.....',
  '###.####.##.###-',
  '   .........#GGG',
  '###.##.#.##.####',
  '#......#........',
  '#.###.###.#####.',
  '#.#.........#...',
  '#o....####......',
  '################',
];
const MAZE = LEFT.map(r => r + [...r].reverse().join(''));
const ROWS = MAZE.length, COLS = MAZE[0].length;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const CATS = [[255, 70, 70], [255, 150, 220], [80, 230, 255], [255, 170, 60]];

export default {
  key: 'pupman', name: 'PUP-MAN', tag: 'CO-OP', color: [255, 230, 60], score: true,
  blurb: 'EAT THE KIBBLE', solo: '1 PLAYER', duo: '2P CO-OP',
  init(g) {
    g.ts = Math.max(2, Math.min(Math.floor(g.W / COLS), Math.floor((g.H - 8) / ROWS)));
    g.ox = Math.floor((g.W - COLS * g.ts) / 2); g.oy = g.H - ROWS * g.ts;
    g.lives = 3; g.points = 0; g.level = 1;
    fill(g);
    g.pups = g.players.map((p, i) => pupStart(g, i));
    g.cats = CATS.map((c, k) => catStart(g, k));
    g.fright = 0; g.mode = 0; g.modeT = 0; g.ready = 1.5;
  },
  update(g, dt, pads) {
    if (g.ready > 0) { g.ready -= dt; return; }
    g.modeT += dt; g.fright -= dt;
    // chase / scatter rhythm: 20s chase, 6s scatter
    g.scatter = (g.modeT % 26) > 20;
    g.pups.forEach((p, i) => {
      if (p.gone) return;
      if (p.dead > 0) { p.dead -= dt; if (p.dead <= 0) { if (g.lives > 0) Object.assign(p, pupStart(g, i)); else p.gone = true; } return; }
      if (g.players[i].cpu) { if (atCenter(p)) p.want = pupBrain(g, p); }
      else { const pd = pads[i]; if (pd.up) p.want = 3; else if (pd.down) p.want = 1; else if (pd.left) p.want = 2; else if (pd.right) p.want = 0; }
      move(g, p, (6.2 + g.level * 0.2) * dt, false);
      // eat
      const tx = Math.round(p.x), ty = Math.round(p.y), k = ty * COLS + ((tx % COLS) + COLS) % COLS;
      const what = g.food.get(k);
      if (what) {
        g.food.delete(k);
        if (what === 'o') { g.points += 50; g.fright = Math.max(2.5, 7 - g.level); g.chain = 200; g.cats.forEach(c => { if (!c.eaten) { c.scared = true; c.dir = (c.dir + 2) % 4; } }); g.sfx('eat'); }
        else { g.points += 10; if ((g.t * 10 | 0) % 2) g.sfx('blip'); }
      }
    });
    if (g.fright <= 0) g.cats.forEach(c => c.scared = false);
    g.cats.forEach((c, k) => {
      if (c.wait > 0) { c.wait -= dt; return; }
      if (atCenter(c)) c.want = catBrain(g, c, k);
      const sp = c.eaten ? 12 : c.scared ? 3.2 : 5.4 + g.level * 0.25;
      move(g, c, sp * dt, true);
      if (c.eaten && Math.round(c.x) === 15 && Math.round(c.y) === 7) Object.assign(c, catStart(g, k), { wait: 1 });
    });
    // pups vs cats
    g.pups.forEach(p => {
      if (p.dead > 0 || p.gone) return;
      g.cats.forEach(c => {
        if (p.dead > 0) return;
        if (c.eaten || c.wait > 0) return;
        let dx = Math.abs(p.x - c.x); dx = Math.min(dx, COLS - dx);
        if (dx + Math.abs(p.y - c.y) > 0.7) return;
        if (c.scared) { c.eaten = true; c.scared = false; g.points += g.chain; g.chain *= 2; g.sfx('score'); }
        else { p.dead = 1.8; g.lives--; g.sfx('die'); }
      });
    });
    if (g.lives <= 0 && g.pups.every(p => p.gone || p.dead > 0)) { g.over = { title: 'GAME OVER', score: g.points, sub: `SCORE ${g.points}`, sad: true }; return; }
    if (!g.food.size) {
      g.level++; g.points += 500; fill(g); g.sfx('score');
      g.pups = g.players.map((p, i) => pupStart(g, i)); g.cats = CATS.map((c, k) => catStart(g, k)); g.ready = 1.5;
    }
  },
  draw(g, f) {
    const { ts, ox, oy } = g, wall = [40, 60, 200], edge = [90, 130, 255];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = MAZE[y][x];
      if (ch === '#') {
        const open = DIRS.some(([dx, dy]) => { const c = MAZE[y + dy]?.[x + dx]; return c && c !== '#'; });
        f.rect(ox + x * ts, oy + y * ts, ts, ts, open ? edge : wall.map(v => v * 0.35));
      } else if (ch === '-') f.rect(ox + x * ts, oy + y * ts + ts / 2, ts, 1, [255, 180, 220]);
    }
    for (const [k, v] of g.food) {
      const x = ox + (k % COLS) * ts + ts / 2 - 0.5, y = oy + Math.floor(k / COLS) * ts + ts / 2 - 0.5;
      if (v === 'o') { if ((g.t * 4 | 0) % 2) f.rect(x - 0.5, y - 0.5, 2, 2, [255, 255, 255]); }
      else f.set(x, y, [255, 200, 150]);
    }
    const P = e => [ox + e.x * ts + ts / 2 - 0.5, oy + e.y * ts + ts / 2 - 0.5];
    g.cats.forEach((c, k) => {
      const [x, y] = P(c);
      if (c.eaten) { f.set(x - 1, y, [255, 255, 255]); f.set(x + 1, y, [255, 255, 255]); return; }
      const col = c.scared ? (g.fright < 1.5 && (g.t * 8 | 0) % 2 ? [255, 255, 255] : [60, 60, 255]) : CATS[k];
      f.rect(x - 1, y - 1, 3, 3, col); f.set(x - 1, y - 2, col); f.set(x + 1, y - 2, col);
      f.set(x - 1, y - 0, [0, 0, 0]); f.set(x + 1, y - 0, [0, 0, 0]);
    });
    g.pups.forEach((p, i) => {
      if (p.gone) return;
      if (p.dead > 0) { if ((g.t * 8 | 0) % 2) { const [x, y] = P(p); f.set(x, y, g.players[i].color); } return; }
      const [x, y] = P(p), col = g.players[i].color, [dx, dy] = DIRS[p.face];
      f.disc(x, y, Math.max(1.2, ts * 0.45), col);
      if ((g.t * 8 | 0) % 2) { f.set(x + dx, y + dy, [0, 0, 0]); f.set(x + dx * 2, y + dy * 2, [0, 0, 0]); }   // chomp
      f.set(x - dy - dx, y - dx - dy, [0, 0, 0]);                                                                // eye
    });
    f.text(String(g.points), 1, 0, [255, 220, 120]);
    for (let i = 0; i < Math.max(0, g.lives); i++) f.disc(g.W - 4 - i * 6, 3, 1.6, [255, 230, 60]);
    if (g.ready > 0) f.center('READY!', oy + 9 * ts - 3, [255, 230, 60]);
  },
};

function fill(g) {
  g.food = new Map();
  MAZE.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.' || ch === 'o') g.food.set(y * COLS + x, ch); }));
}
function pupStart(g, i) { const n = g.players.length; return { x: n > 1 ? (i ? 18 : 13) : 15.5, y: 9, dir: i ? 0 : 2, want: i ? 0 : 2, face: i ? 0 : 2, dead: 0 }; }
function catStart(g, k) { return { x: [13, 15, 16, 18][k], y: 7, dir: 3, want: 3, scared: false, eaten: false, wait: k * 2, house: true }; }
const wrapX = x => ((x % COLS) + COLS) % COLS;
function open(x, y, cat) { const c = MAZE[y]?.[wrapX(x)]; return c !== undefined && c !== '#' && (cat || (c !== '-' && c !== 'G')); }
const atCenter = e => Math.abs(e.x - Math.round(e.x)) < 0.01 && Math.abs(e.y - Math.round(e.y)) < 0.01;
function move(g, e, d, cat) {
  for (let guard = 0; guard < 4 && d > 0; guard++) {
    if (atCenter(e)) {
      e.x = Math.round(e.x); e.y = Math.round(e.y);
      const [wx, wy] = DIRS[e.want];
      if (open(e.x + wx, e.y + wy, cat)) e.dir = e.want;
      const [dx, dy] = DIRS[e.dir];
      if (!open(e.x + dx, e.y + dy, cat)) return;
      e.face = e.dir;
    }
    const [dx, dy] = DIRS[e.dir];
    const fx = e.x - Math.floor(e.x), fy = e.y - Math.floor(e.y);
    const left = dx > 0 ? (fx ? 1 - fx : 1) : dx < 0 ? (fx ? fx : 1) : dy > 0 ? (fy ? 1 - fy : 1) : (fy ? fy : 1);
    const s = Math.min(d, left);
    e.x += dx * s; e.y += dy * s; d -= s;
    if (Math.abs(e.x - Math.round(e.x)) < 0.01) e.x = Math.round(e.x);
    if (Math.abs(e.y - Math.round(e.y)) < 0.01) e.y = Math.round(e.y);
    if (e.x < -0.5) e.x += COLS; if (e.x > COLS - 0.5) e.x -= COLS;
  }
}
function catBrain(g, c, k) {
  const x = Math.round(c.x), y = Math.round(c.y);
  let tx, ty;
  if (c.eaten) return pathStep(x, y, 15, 7);   // eyes take the shortest way home
  else if (MAZE[y][wrapX(x)] === 'G' || MAZE[y][wrapX(x)] === '-') { tx = 15; ty = 5; }        // leave the house
  else if (c.scared) { const opts = [0, 1, 2, 3].filter(d => d !== (c.dir + 2) % 4 && open(x + DIRS[d][0], y + DIRS[d][1], false)); return opts.length ? opts[Math.floor(Math.random() * opts.length)] : (c.dir + 2) % 4; }
  else if (g.scatter) { [tx, ty] = [[COLS - 2, 0], [1, 0], [COLS - 2, ROWS], [1, ROWS]][k]; }
  else {
    // each cat chases a little differently: straight at you, ahead of you, or wandering when close
    const live = g.pups.filter(p => p.dead <= 0);
    const p = live.length ? live.reduce((a, b) => Math.abs(b.x - x) + Math.abs(b.y - y) < Math.abs(a.x - x) + Math.abs(a.y - y) ? b : a) : { x: 15, y: 9, face: 0 };
    const [fx, fy] = DIRS[p.face ?? 0];
    if (k === 1) { tx = p.x + fx * 4; ty = p.y + fy * 4; }
    else if (k === 3 && Math.abs(p.x - x) + Math.abs(p.y - y) < 8) { tx = 1; ty = ROWS; }
    else if (k === 2) { tx = p.x + fx * 2 + (p.x - x) * 0.5; ty = p.y + fy * 2 + (p.y - y) * 0.5; }
    else { tx = p.x; ty = p.y; }
  }
  let best = c.dir, bd = 1e9;
  for (let d = 0; d < 4; d++) {
    if (d === (c.dir + 2) % 4 && !c.eaten) continue;
    const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
    if (!open(nx, ny, true)) continue;
    if (!c.eaten && MAZE[ny]?.[wrapX(nx)] === '-' && MAZE[y][wrapX(x)] !== 'G') continue;   // don't go back in
    const dd = (nx - tx) ** 2 + (ny - ty) ** 2 + Math.random() * 0.5;
    if (dd < bd) { bd = dd; best = d; }
  }
  return bd < 1e9 ? best : (c.dir + 2) % 4;     // dead end: turn around
}
function pathStep(sx, sy, tx, ty) {
  const key = (x, y) => y * COLS + wrapX(x), start = key(sx, sy), prev = new Map([[start, null]]), q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (let d = 0; d < 4; d++) { const nx = wrapX(x + DIRS[d][0]), ny = y + DIRS[d][1], k = key(nx, ny); if (!prev.has(k) && open(nx, ny, true)) { prev.set(k, [key(x, y), d]); q.push([nx, ny]); } }
  }
  let k = key(tx, ty), step = 0;
  if (!prev.has(k)) return 3;
  while (prev.get(k) && prev.get(k)[0] !== start) k = prev.get(k)[0];
  return prev.get(k) ? prev.get(k)[1] : 3;
}
// CPU pup: walk toward the nearest kibble, avoiding tiles near cats (unless they're scared)
function pupBrain(g, p) {
  const sx = Math.round(p.x), sy = Math.round(p.y);
  const danger = new Set();
  g.cats.forEach(c => { if (c.scared || c.eaten || c.wait > 0) return; const cx = Math.round(c.x), cy = Math.round(c.y); for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.abs(dx) + Math.abs(dy) <= 2) danger.add((cy + dy) * COLS + wrapX(cx + dx)); });
  const prey = g.cats.filter(c => c.scared && !c.eaten).map(c => Math.round(c.y) * COLS + wrapX(Math.round(c.x)));
  const start = sy * COLS + wrapX(sx), prev = new Map([[start, -1]]), q = [[sx, sy]];
  let goal = null;
  while (q.length) {
    const [x, y] = q.shift(), k = y * COLS + wrapX(x);
    if (k !== start && (g.food.has(k) || prey.includes(k))) { goal = k; break; }
    for (let d = 0; d < 4; d++) {
      const nx = wrapX(x + DIRS[d][0]), ny = y + DIRS[d][1], nk = ny * COLS + nx;
      if (prev.has(nk) || !open(nx, ny, false) || danger.has(nk)) continue;
      prev.set(nk, k); q.push([nx, ny]);
    }
  }
  if (goal == null) {
    // boxed in: pick the move that gets furthest from the closest cat
    let best = p.dir, bd = -1;
    for (let d = 0; d < 4; d++) { const nx = sx + DIRS[d][0], ny = sy + DIRS[d][1]; if (!open(nx, ny, false)) continue; const m = Math.min(...g.cats.filter(c => !c.eaten).map(c => Math.abs(c.x - nx) + Math.abs(c.y - ny))); if (m > bd) { bd = m; best = d; } }
    return best;
  }
  let k = goal; while (prev.get(k) !== start && prev.get(k) !== -1) k = prev.get(k);
  const gx = k % COLS, gy = Math.floor(k / COLS);
  for (let d = 0; d < 4; d++) if (wrapX(sx + DIRS[d][0]) === gx && sy + DIRS[d][1] === gy) return d;
  return p.dir;
}
