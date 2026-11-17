// Bomber Dawgs (Bomberman): A drops a bomb. Blasts go in a + shape, break crates, set off other bombs.
// Crates can hide power-ups: B = more bombs, F = bigger blast, S = speed. Last dog standing wins the round; first to 3.
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const HARD = 1, SOFT = 2;

export default {
  key: 'bomber', name: 'BOMBER DAWGS', tag: 'VERSUS', slots: 4, color: [255, 240, 120],
  blurb: 'BLAST YOUR WAY OUT', solo: '1P VS 3 CPU', duo: '2P + 2 CPU',
  init(g) { g.wins = [0, 0, 0, 0]; round(g); },
  update(g, dt, pads) {
    if (g.pause > 0) { g.pause -= dt; if (g.pause <= 0 && g.roundOver) round(g); return; }
    const fast = !g.demo && !g.dogs.some((d, i) => g.players[i].human && d.alive) ? 3 : 1;
    dt *= fast;
    g.rt += dt;
    g.dogs.forEach((d, i) => {
      if (!d.alive) return;
      let mx = 0, my = 0, drop = false;
      if (g.players[i].cpu) [mx, my, drop] = brain(g, d);
      else { const p = pads[i]; mx = p.x; my = mx ? 0 : p.y; drop = p.aP; }
      walk(g, d, mx, my, dt);
      if (drop) placeBomb(g, d, i);
      // leaving the bomb you're standing on
      d.pass = d.pass.filter(b => Math.abs(b.x - d.x) < 0.9 && Math.abs(b.y - d.y) < 0.9);
      // power-ups
      const k = cell(g, Math.round(d.x), Math.round(d.y)), pu = g.pu.get(k);
      if (pu) { g.pu.delete(k); if (pu === 'B') d.max++; if (pu === 'F') d.fire++; if (pu === 'S') d.speed = Math.min(6.5, d.speed + 0.7); g.sfx('eat'); }
    });
    for (const b of g.bombs) { b.t -= dt; if (b.t <= 0) explode(g, b); }
    g.bombs = g.bombs.filter(b => !b.done);
    for (const fl of g.flames) fl.t -= dt;
    g.flames = g.flames.filter(fl => fl.t > 0);
    g.dogs.forEach((d, i) => {
      if (!d.alive) return;
      if (g.flames.some(fl => fl.x === Math.round(d.x) && fl.y === Math.round(d.y))) { d.alive = false; d.deadT = g.t; g.sfx('die'); }
    });
    // hurry up: after 55s the arena closes in from the edges
    if (g.rt > 55) { g.hurry -= dt; if (g.hurry <= 0) { g.hurry = 0.2; closeIn(g); } }
    const alive = g.dogs.map((d, i) => d.alive ? i : -1).filter(i => i >= 0);
    if (alive.length <= 1 && !g.flames.length) {
      g.roundOver = true; g.pause = 2.4; g.roundWinner = alive[0] ?? null;
      if (alive.length) g.wins[alive[0]]++;
      const champ = g.wins.findIndex(w => w >= 3);
      if (champ >= 0) {
        const p = g.players[champ], who = g.humans === 1 && p.human ? 'YOU' : p.human ? p.name : 'CPU';
        g.over = { title: who === 'YOU' ? 'YOU WIN!' : `${who} WINS!`, color: p.color, sub: g.wins.join(' - '), sad: g.humans === 1 && !p.human };
      }
    }
  },
  draw(g, f) {
    const { tile: ts, ox, oy } = g, X = x => ox + x * ts, Y = y => oy + y * ts;
    f.rect(ox, oy, g.cols * ts, g.rows * ts, [30, 90, 40]);
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const c = g.map[cell(g, x, y)];
      if (c === HARD) { f.rect(X(x), Y(y), ts, ts, [120, 120, 135]); f.rect(X(x), Y(y), ts, 1, [170, 170, 185]); }
      else if (c === SOFT) { f.rect(X(x), Y(y), ts, ts, [170, 110, 50]); f.rect(X(x) + 1, Y(y) + 1, ts - 2, 1, [210, 150, 80]); f.set(X(x) + ts - 2, Y(y) + ts - 2, [110, 70, 30]); }
      else if ((x + y) % 2) f.rect(X(x), Y(y), ts, ts, [35, 100, 45]);
    }
    for (const [k, v] of g.pu) { const x = k % g.cols, y = Math.floor(k / g.cols); f.rect(X(x), Y(y), ts, ts, v === 'B' ? [60, 60, 200] : v === 'F' ? [220, 60, 40] : [60, 180, 220]); f.set(X(x) + ts / 2, Y(y) + ts / 2, [255, 255, 255]); }
    g.bombs.forEach(b => { const r = ts * 0.42 + (b.t < 0.6 && (g.t * 12 | 0) % 2 ? 0.5 : 0); f.disc(X(b.x) + ts / 2 - 0.5, Y(b.y) + ts / 2 - 0.5, r, [20, 20, 20]); f.set(X(b.x) + ts - 2, Y(b.y), (g.t * 10 | 0) % 2 ? [255, 220, 60] : [255, 80, 20]); });
    g.flames.forEach(fl => f.rect(X(fl.x), Y(fl.y), ts, ts, (g.t * 20 | 0) % 2 ? [255, 230, 120] : [255, 120, 30]));
    g.dogs.forEach((d, i) => {
      if (!d.alive) return;
      const col = g.players[i].color, x = X(d.x), y = Y(d.y);
      f.rect(x + 1, y + 1, ts - 2, ts - 1, col); f.set(x, y + 1, col); f.set(x + ts - 1, y + 1, col);   // ears
      f.set(x + 1, y + 2, [0, 0, 0]); f.set(x + ts - 2, y + 2, [0, 0, 0]);
    });
    g.players.forEach((p, i) => { f.rect(1 + i * 9, 2, 2, 3, p.color); f.text(String(g.wins[i]), 4 + i * 9, 0, [230, 230, 230]); });
    if (g.rt > 50 && g.rt < 55 && (g.t * 4 | 0) % 2) f.text('HURRY!', g.W - 36, 0, [255, 90, 60]);
    if (g.roundOver && g.pause > 0 && !g.over) {
      const w = g.roundWinner, who = w == null ? '' : g.humans === 1 && g.players[w].human ? 'YOU' : g.players[w].human ? g.players[w].name : 'CPU';
      f.dim(0.5); f.center(w == null ? 'DRAW' : `${who} WINS ROUND`, g.H / 2 - 4, w == null ? [200, 200, 200] : g.players[w].color);
    }
  },
};

const cell = (g, x, y) => y * g.cols + x;
function round(g) {
  const { W, H } = g;
  const t = Math.max(3, Math.floor((H - 8) / 11));
  g.tile = t; g.rows = 11; g.cols = Math.floor(W / t); if (g.cols % 2 === 0) g.cols--;
  g.ox = Math.floor((W - g.cols * t) / 2); g.oy = H - g.rows * t;
  g.map = new Uint8Array(g.cols * g.rows); g.pu = new Map();
  const corner = (x, y) => [[1, 1], [g.cols - 2, g.rows - 2], [g.cols - 2, 1], [1, g.rows - 2]].some(([cx, cy]) => Math.abs(cx - x) + Math.abs(cy - y) <= 2);
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    let v = 0;
    if (x === 0 || y === 0 || x === g.cols - 1 || y === g.rows - 1 || (x % 2 === 0 && y % 2 === 0)) v = HARD;
    else if (!corner(x, y) && Math.random() < 0.62) v = SOFT;
    g.map[cell(g, x, y)] = v;
  }
  const starts = [[1, 1], [g.cols - 2, g.rows - 2], [g.cols - 2, 1], [1, g.rows - 2]];
  g.dogs = g.players.map((p, i) => ({ x: starts[i][0], y: starts[i][1], alive: true, max: 1, fire: 2, speed: 3.6, pass: [], goal: null, cool: 0 }));
  g.bombs = []; g.flames = []; g.rt = 0; g.hurry = 0; g.shrink = 0; g.roundOver = false; g.pause = 1.2;
}
function blocked(g, x, y, d) {
  const c = g.map[cell(g, x, y)];
  if (c) return true;
  const b = g.bombs.find(b => b.x === x && b.y === y);
  return b && !d.pass.includes(b);
}
function walk(g, d, mx, my, dt) {
  const sp = d.speed * dt;
  if (mx) {
    const ry = Math.round(d.y);
    if (Math.abs(d.y - ry) > 0.05) { d.y += Math.sign(ry - d.y) * Math.min(sp, Math.abs(ry - d.y)); return; }   // slide into the lane
    d.y = ry;
    const nx = d.x + mx * sp, ahead = Math.round(nx + mx * 0.5);
    if (blocked(g, ahead, ry, d) && Math.round(d.x) !== ahead) { d.x += Math.sign(Math.round(d.x) - d.x) * Math.min(sp, Math.abs(Math.round(d.x) - d.x)); return; }
    d.x = nx;
  } else if (my) {
    const rx = Math.round(d.x);
    if (Math.abs(d.x - rx) > 0.05) { d.x += Math.sign(rx - d.x) * Math.min(sp, Math.abs(rx - d.x)); return; }
    d.x = rx;
    const ny = d.y + my * sp, ahead = Math.round(ny + my * 0.5);
    if (blocked(g, rx, ahead, d) && Math.round(d.y) !== ahead) { d.y += Math.sign(Math.round(d.y) - d.y) * Math.min(sp, Math.abs(Math.round(d.y) - d.y)); return; }
    d.y = ny;
  }
}
function placeBomb(g, d, i) {
  const x = Math.round(d.x), y = Math.round(d.y);
  if (g.bombs.filter(b => b.o === i).length >= d.max || g.bombs.some(b => b.x === x && b.y === y)) return;
  const b = { x, y, t: 2.2, r: d.fire, o: i };
  g.bombs.push(b); d.pass.push(b); g.sfx('blip');
}
function blastCells(g, b) {
  const out = [[b.x, b.y]];
  for (const [dx, dy] of DIRS) for (let k = 1; k <= b.r; k++) {
    const x = b.x + dx * k, y = b.y + dy * k, c = g.map[cell(g, x, y)];
    if (c === HARD) break;
    out.push([x, y]);
    if (c === SOFT) break;
  }
  return out;
}
function explode(g, b) {
  if (b.done) return;
  b.done = true; g.sfx('boom');
  for (const [x, y] of blastCells(g, b)) {
    const k = cell(g, x, y);
    if (g.map[k] === SOFT) { g.map[k] = 0; if (Math.random() < 0.3) g.pu.set(k, 'BFS'[Math.floor(Math.random() * 3)]); }
    else g.pu.delete(k);
    g.flames.push({ x, y, t: 0.5 });
    const other = g.bombs.find(o => !o.done && o.x === x && o.y === y);
    if (other) explode(g, other);
  }
}
function closeIn(g) {
  // turn the next empty edge cell (spiraling inward) into a hard block
  const n = g.shrink++, ring = 1 + Math.floor(n / ((g.cols + g.rows) * 2));
  const cells = [];
  for (let x = ring; x < g.cols - ring; x++) cells.push([x, ring]);
  for (let y = ring + 1; y < g.rows - ring; y++) cells.push([g.cols - 1 - ring, y]);
  for (let x = g.cols - 2 - ring; x >= ring; x--) cells.push([x, g.rows - 1 - ring]);
  for (let y = g.rows - 2 - ring; y > ring; y--) cells.push([ring, y]);
  const c = cells[n % cells.length]; if (!c) return;
  const k = cell(g, c[0], c[1]); g.map[k] = HARD; g.pu.delete(k);
  g.bombs = g.bombs.filter(b => !(b.x === c[0] && b.y === c[1]));
  g.dogs.forEach(d => { if (d.alive && Math.round(d.x) === c[0] && Math.round(d.y) === c[1]) { d.alive = false; g.sfx('die'); } });
}

// ---- CPU ----
function dangerMap(g, extra) {
  const m = new Map();
  const bombs = extra ? [...g.bombs, extra] : g.bombs;
  for (const b of bombs) for (const [x, y] of blastCells(g, b)) { const k = cell(g, x, y); m.set(k, Math.min(m.get(k) ?? 9, b.t)); }
  for (const fl of g.flames) m.set(cell(g, fl.x, fl.y), 0);
  return m;
}
function bfs(g, d, sx, sy, danger, goalFn, maxD = 40) {
  const start = cell(g, sx, sy), prev = new Map([[start, null]]), q = [[sx, sy, 0]];
  while (q.length) {
    const [x, y, n] = q.shift(), k = cell(g, x, y);
    if (k !== start && goalFn(x, y, k)) { let c = k; while (prev.get(c) !== start && prev.get(c) != null) c = prev.get(c); return { first: c, goal: k, dist: n }; }
    if (n >= maxD) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, nk = cell(g, nx, ny);
      if (prev.has(nk) || blocked(g, nx, ny, d)) continue;
      const dt = danger.get(nk);
      if (dt !== undefined && dt < (n + 1) / d.speed + 0.35) continue;   // would be standing in a blast
      prev.set(nk, k); q.push([nx, ny, n + 1]);
    }
  }
  return null;
}
function brain(g, d) {
  // finish the step we started before deciding anything new (keeps CPUs from dithering between two cells)
  if (d.goal != null) {
    const gx = d.goal % g.cols, gy = Math.floor(d.goal / g.cols);
    if ((Math.abs(gx - d.x) > 0.05 || Math.abs(gy - d.y) > 0.05) && !g.map[d.goal]) {
      const dx = gx - d.x, dy = gy - d.y;
      return Math.abs(dx) > 0.05 ? [Math.sign(dx), 0, false] : [0, Math.sign(dy), false];
    }
    d.x = Math.abs(gx - d.x) <= 0.05 ? gx : d.x; d.y = Math.abs(gy - d.y) <= 0.05 ? gy : d.y;
    d.goal = null;
  }
  const r = think(g, d);
  if (r.goal != null) { d.goal = r.goal; return brain(g, d).slice(0, 2).concat([false]); }
  return [0, 0, !!r.drop];
}
function think(g, d) {
  const x = Math.round(d.x), y = Math.round(d.y), here = cell(g, x, y);
  const danger = dangerMap(g);
  // 1) in danger: run to the closest safe cell
  if (danger.has(here)) {
    const r = bfs(g, d, x, y, new Map([...danger].filter(([k, t]) => t < 0.3)), (cx, cy, k) => !danger.has(k), 20);
    return r ? { goal: r.first } : {};
  }
  d.cool -= 1 / 60;
  // 2) good spot to drop a bomb (next to a crate or an enemy in line) and a way out afterwards?
  const enemies = g.dogs.filter(o => o !== d && o.alive);
  const nearCrate = DIRS.some(([dx, dy]) => g.map[cell(g, x + dx, y + dy)] === SOFT);
  const myBomb = { x, y, t: 2.2, r: d.fire };
  const hitsEnemy = enemies.some(o => blastCells(g, myBomb).some(([bx, by]) => bx === Math.round(o.x) && by === Math.round(o.y)));
  const canDrop = g.bombs.filter(b => b.o === g.dogs.indexOf(d)).length < d.max && !g.bombs.some(b => b.x === x && b.y === y);
  if ((nearCrate || hitsEnemy) && canDrop && d.cool <= 0 && Math.abs(d.x - x) < 0.1 && Math.abs(d.y - y) < 0.1) {
    const after = dangerMap(g, myBomb);
    const fake = { ...d, pass: [...d.pass, myBomb] };
    g.bombs.push(myBomb);
    const esc = bfs(g, fake, x, y, new Map([...after].filter(([k, t]) => t < 1)), (cx, cy, k) => !after.has(k), 8);
    g.bombs.pop();
    if (esc) { d.cool = 0.5; return { drop: true }; }
  }
  // 3) after the opening, hunt: go to a spot where a bomb would catch someone
  if (g.rt > 12 && enemies.length) {
    const r0 = bfs(g, d, x, y, danger, (cx, cy) => enemies.some(o => blastCells(g, { x: cx, y: cy, r: d.fire }).some(([bx, by]) => bx === Math.round(o.x) && by === Math.round(o.y))), 14);
    if (r0 && Math.random() < 0.85) return { goal: r0.first };
  }
  // 4) head for a power-up, a crate, or an enemy
  const r = bfs(g, d, x, y, danger, (cx, cy, k) => g.pu.has(k) || DIRS.some(([dx, dy]) => g.map[cell(g, cx + dx, cy + dy)] === SOFT) || enemies.some(o => Math.abs(Math.round(o.x) - cx) + Math.abs(Math.round(o.y) - cy) <= 1));
  if (r) return { goal: r.first };
  return {};
}
