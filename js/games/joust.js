// Joust: tap A to flap, left/right to steer. When two riders collide, the one who's higher wins.
// Beaten buzzard riders drop an egg: grab it before it hatches. Don't fall in the lava. The screen wraps left-right.
// 2 players fly together and share 5 lives (and can bump each other).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LEDGE = [150, 110, 70], LAVA = [255, 80, 20];

export default {
  key: 'joust', name: 'JOUST', tag: 'CO-OP', color: [255, 220, 90], score: true,
  blurb: 'STAY ON TOP', solo: '1 PLAYER', duo: '2P CO-OP',
  init(g) {
    const { W, H, S } = g;
    g.lava = H - Math.round(3 * S);
    g.ledges = [[0.1, 0.33, 0.22], [0.68, 0.33, 0.22], [0.36, 0.55, 0.28], [0.0, 0.75, 0.18], [0.82, 0.75, 0.18], [0.3, 0.9, 0.4]]
      .map(([x, y, w]) => ({ x: Math.round(x * W), y: Math.round(y * H), w: Math.round(w * W) }));
    g.lives = 5; g.points = 0; g.wave = 0;
    g.knights = g.players.map((p, i) => spawn(g, i));
    g.eggs = []; g.feathers = [];
    wave(g);
  },
  update(g, dt, pads) {
    const { W, S } = g;
    g.knights.forEach((k, i) => {
      if (k.dead > 0) { k.dead -= dt; if (k.dead <= 0 && g.lives > 0) Object.assign(k, spawn(g, i)); return; }
      let mx, flap;
      if (g.players[i].cpu) [mx, flap] = brain(g, k, true); else { mx = pads[i].x; flap = pads[i].aP || pads[i].upP; }
      fly(g, k, mx, flap, dt);
      k.safe -= dt;
    });
    for (const e of g.foes) { if (e.dead) continue; const [mx, flap] = brain(g, e, false); fly(g, e, mx, flap, dt); }
    // jousts
    const riders = [...g.knights.filter(k => k.dead <= 0 && k.safe <= 0), ...g.foes.filter(e => !e.dead)];
    for (let a = 0; a < riders.length; a++) for (let b = a + 1; b < riders.length; b++) {
      const A = riders[a], B = riders[b];
      if (Math.abs(A.x - B.x) > 5 * S || Math.abs(A.y - B.y) > 5 * S) continue;
      if (A.foe && B.foe) { bounce(A, B); continue; }
      if (!A.foe && !B.foe) { bounce(A, B); continue; }                      // two players just bump
      const diff = A.y - B.y;
      if (Math.abs(diff) < 1.5) { bounce(A, B); g.sfx('bounce'); continue; }
      const [win, lose] = diff < 0 ? [A, B] : [B, A];
      if (lose.foe) { lose.dead = true; g.points += lose.kind * 250 + 250; g.eggs.push({ x: lose.x, y: lose.y, vy: 0, hatch: 6, kind: lose.kind }); }
      else { lose.dead = 2; g.lives--; }
      for (let n = 0; n < 6; n++) g.feathers.push({ x: lose.x, y: lose.y, vx: (Math.random() - 0.5) * 30 * S, vy: -Math.random() * 20 * S, l: 0.8 });
      g.sfx(lose.foe ? 'boom' : 'die'); win.vy = -30 * S;
    }
    // eggs fall, sit, then hatch into a tougher buzzard
    for (const egg of g.eggs) {
      egg.vy += 120 * S * dt; egg.y += egg.vy * dt;
      const l = g.ledges.find(l => egg.x >= l.x && egg.x <= l.x + l.w && egg.y >= l.y - 1 && egg.y <= l.y + 3);
      if (l && egg.vy > 0) { egg.y = l.y - 1; egg.vy = 0; }
      if (egg.y > g.lava) egg.gone = true;
      egg.hatch -= dt;
      g.knights.forEach(k => { if (k.dead <= 0 && Math.abs(k.x - egg.x) < 4 * S && Math.abs(k.y - egg.y) < 5 * S) { egg.gone = true; g.points += 250; g.sfx('eat'); } });
      if (!egg.gone && egg.hatch <= 0) { egg.gone = true; g.foes.push(foe(g, egg.x, egg.y - 3, Math.min(2, egg.kind + 1))); }
    }
    g.eggs = g.eggs.filter(e => !e.gone);
    g.foes = g.foes.filter(e => !e.dead);
    for (const p of g.feathers) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * S * dt; p.l -= dt; }
    g.feathers = g.feathers.filter(p => p.l > 0);
    if (g.lives <= 0 && g.knights.every(k => k.dead > 0)) { g.over = { title: 'GAME OVER', score: g.points, sub: `SCORE ${g.points}`, sad: true }; return; }
    if (!g.foes.length && !g.eggs.length) { g.points += 500; wave(g); g.sfx('score'); }
  },
  draw(g, f) {
    const { W, H, S } = g;
    f.rect(0, g.lava, W, H - g.lava, LAVA.map(v => v * (0.7 + 0.3 * Math.sin(g.t * 3))));
    for (let x = 0; x < W; x += 3) f.set(x + (g.t * 5 | 0) % 3, g.lava - 1, [255, 160, 40]);
    g.ledges.forEach(l => { f.rect(l.x, l.y, l.w, 2, LEDGE); f.rect(l.x, l.y + 2, l.w, 1, LEDGE.map(v => v * 0.6)); });
    g.eggs.forEach(e => { f.rect(e.x - 1, e.y - 2, 3, 3, e.hatch < 1.5 && (g.t * 8 | 0) % 2 ? [255, 255, 255] : [230, 220, 200]); });
    g.foes.forEach(e => rider(g, f, e, [[200, 60, 60], [150, 150, 170], [80, 120, 255]][e.kind], [120, 70, 40]));
    g.knights.forEach((k, i) => { if (k.dead > 0) return; if (k.safe > 0 && (g.t * 10 | 0) % 2) return; rider(g, f, k, g.players[i].color, [255, 220, 90]); });
    g.feathers.forEach(p => f.set(p.x, p.y, [230, 230, 230]));
    f.text(String(g.points), 1, 0, [255, 220, 120]);
    for (let i = 0; i < g.lives; i++) f.rect(W - 4 - i * 4, 2, 2, 3, [255, 220, 90]);
  },
};

function rider(g, f, k, col, bird) {
  const x = Math.round(k.x), y = Math.round(k.y), d = k.face;
  const wing = (k.flapT > 0) ? -2 : 0;
  f.rect(x - 2, y, 5, 2, bird);                       // bird body
  f.set(x + d * 3, y, bird); f.set(x + d * 3, y - 1, bird); // neck/head
  f.rect(x - d * 1 - 1, y - 1 + wing, 3, 1, bird.map(v => v * 0.8));   // wing
  f.rect(x - 1, y - 3, 2, 3, col);                    // rider
  f.set(x + d * 2, y - 3, [230, 230, 230]);           // lance
  f.set(x + d * 3, y - 3, [230, 230, 230]);
  f.set(x - 1, y + 2, bird.map(v => v * 0.7)); f.set(x + 1, y + 2, bird.map(v => v * 0.7));
}
function spawn(g, i) {
  const l = g.ledges[g.players.length > 1 ? (i ? 4 : 3) : 5];
  return { x: l.x + l.w / 2, y: l.y - 3, vx: 0, vy: 0, face: i ? -1 : 1, dead: 0, safe: 2, flapT: 0, foe: false };
}
function foe(g, x, y, kind) { return { x, y, vx: 0, vy: 0, face: 1, foe: true, kind, flapT: 0, think: 0, mx: 1 }; }
function wave(g) {
  g.wave++;
  g.foes = [];
  const n = Math.min(7, 2 + g.wave);
  for (let k = 0; k < n; k++) { const l = g.ledges[k % 3]; g.foes.push(foe(g, l.x + Math.random() * l.w, l.y - 3, g.wave > 3 && k % 3 === 0 ? 1 : 0)); }
}
function fly(g, k, mx, flap, dt) {
  const S = g.S;
  if (flap) { k.vy = Math.min(k.vy, 0) - 34 * S; k.flapT = 0.12; }
  k.flapT -= dt;
  k.vy = Math.max(k.vy + 70 * S * dt, -60 * S);
  if (mx) { k.vx += mx * 70 * S * dt; k.face = Math.sign(mx); }
  k.vx *= Math.exp(-(k.onLedge ? 4 : 0.6) * dt);
  k.vx = clamp(k.vx, -55 * S, 55 * S);
  k.x = ((k.x + k.vx * dt) % g.W + g.W) % g.W;
  const oy = k.y; k.y += k.vy * dt;
  k.onLedge = false;
  if (k.y < 4) { k.y = 4; k.vy = Math.abs(k.vy) * 0.3; }
  for (const l of g.ledges) {
    if (k.x < l.x - 1 || k.x > l.x + l.w + 1) continue;
    if (oy + 2 <= l.y && k.y + 2 >= l.y && k.vy >= 0) { k.y = l.y - 2; k.vy = 0; k.onLedge = true; }
    else if (oy - 3 >= l.y + 3 && k.y - 3 < l.y + 3 && k.vy < 0) { k.y = l.y + 6; k.vy = 5 * S; }
  }
  if (k.y > g.lava) { if (k.foe) k.dead = true; else if (!(k.dead > 0)) { k.dead = 2; g.lives--; g.sfx('die'); } }
}
function bounce(A, B) { const t = A.vx; A.vx = B.vx * 0.8 - Math.sign(B.x - A.x) * 10; B.vx = t * 0.8 + Math.sign(B.x - A.x) * 10; }
// buzzards wander and climb above the closest knight; CPU knights try to get above the closest buzzard
function brain(g, k, isKnight) {
  const S = g.S;
  const targets = isKnight ? g.foes.filter(e => !e.dead) : g.knights.filter(q => q.dead <= 0);
  if (isKnight && !targets.length && g.eggs.length) {
    const e = g.eggs[0]; return [Math.sign(e.x - k.x), k.y > e.y + 2 && Math.random() < 0.08];
  }
  let t = null, bd = 1e9;
  for (const q of targets) { const d = Math.abs(q.x - k.x) + Math.abs(q.y - k.y); if (d < bd) { bd = d; t = q; } }
  const skill = isKnight ? 0.9 : 0.35 + k.kind * 0.25;
  if (!t || Math.random() > skill) {
    k.think = (k.think || 0) - 1 / 60; if (k.think <= 0) { k.think = 1 + Math.random(); k.mx = Math.random() < 0.5 ? -1 : 1; }
    return [k.mx, k.y > g.H * 0.45 && Math.random() < 0.12];
  }
  const wantY = t.y - 5 * S;
  const flap = k.y > wantY && Math.random() < (k.vy > 0 ? 0.25 : 0.08) || k.y > g.lava - 10 * S;
  let dx = t.x - k.x; if (Math.abs(dx) > g.W / 2) dx -= Math.sign(dx) * g.W;
  return [Math.sign(dx), flap];
}
