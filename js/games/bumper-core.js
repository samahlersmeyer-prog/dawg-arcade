// Shared bumper-car physics and drawing for Bumper Brawl, Bumper Hockey and Hot Dawg.
// Steering: push the D-pad the way you want to go; the car turns that way and drives. A = turbo bump (short cooldown).
export const hyp = Math.hypot;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makeCars(g, spots) {
  g.cr = Math.max(2.5, 3.6 * g.S);
  g.cars = g.players.map((p, i) => ({
    i, x: spots[i][0], y: spots[i][1], a: spots[i][2] ?? 0, vx: 0, vy: 0,
    boost: 0, cool: 0, out: false, fall: 0, spin: 0, ice: false, team: i % 2, ai: { t: 0, mx: 0, my: 0 },
  }));
}

// Drive one car from a wanted direction (mx,my in -1..1) and a turbo button.
export function drive(g, c, mx, my, turbo, dt) {
  const S = g.S;
  if (c.out) return;
  c.cool -= dt; c.boost -= dt;
  if (c.spin > 0) { c.spin -= dt; c.a += dt * 14; mx = my = 0; }
  const n = hyp(mx, my);
  if (n > 0.2) {
    // turn toward the stick, then push forward
    const want = Math.atan2(my, mx);
    let d = want - c.a; d = Math.atan2(Math.sin(d), Math.cos(d));
    c.a += clamp(d, -7 * dt, 7 * dt);
    const acc = 120 * S * Math.max(0, Math.cos(d) * 0.7 + 0.3);
    c.vx += Math.cos(c.a) * acc * dt; c.vy += Math.sin(c.a) * acc * dt;
  }
  if (turbo && c.cool <= 0) { c.boost = 0.35; c.cool = 2.2; c.vx += Math.cos(c.a) * 70 * S; c.vy += Math.sin(c.a) * 70 * S; g.sfx('shoot'); }
  const drag = Math.exp(-(c.ice ? 0.25 : 2.2) * dt);
  c.vx *= drag; c.vy *= drag;
  const v = hyp(c.vx, c.vy), max = (c.boost > 0 ? 110 : 62) * S;
  if (v > max) { c.vx *= max / v; c.vy *= max / v; }
  c.x += c.vx * dt; c.y += c.vy * dt;
}

// Car-on-car bumps. The car that hits harder (moving into the other) knocks it further.
export function bumps(g, onBump) {
  const cars = g.cars.filter(c => !c.out && c.fall <= 0);
  for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
    const A = cars[a], B = cars[b], dx = B.x - A.x, dy = B.y - A.y, d = hyp(dx, dy), min = g.cr * 2;
    if (d >= min || d === 0) continue;
    const nx = dx / d, ny = dy / d, push = (min - d) / 2;
    A.x -= nx * push; A.y -= ny * push; B.x += nx * push; B.y += ny * push;
    const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
    if (rv >= 0) continue;
    const aHit = Math.max(0, A.vx * nx + A.vy * ny), bHit = Math.max(0, -(B.vx * nx + B.vy * ny));
    const j = -rv * 0.95;
    // the hitter keeps a bit more, the one getting hit flies a bit more
    const kA = 1 + (bHit - aHit) / (aHit + bHit + 1) * 0.6, kB = 1 + (aHit - bHit) / (aHit + bHit + 1) * 0.6;
    A.vx -= nx * j * kA; A.vy -= ny * j * kA; B.vx += nx * j * kB; B.vy += ny * j * kB;
    if (A.boost > 0) { B.vx += nx * 40 * g.S; B.vy += ny * 40 * g.S; }
    if (B.boost > 0) { A.vx -= nx * 40 * g.S; A.vy -= ny * 40 * g.S; }
    g.sfx(-rv > 50 * g.S ? 'hit' : 'bounce');
    (g.sparks ||= []).push(...Array.from({ length: 5 }, () => ({ x: A.x + nx * g.cr, y: A.y + ny * g.cr, vx: (Math.random() - 0.5) * 50 * g.S, vy: (Math.random() - 0.5) * 50 * g.S, l: 0.35 })));
    if (onBump) onBump(A, B, -rv);
  }
}

// Keep cars inside a rectangle (walls bounce).
export function walls(g, c, x0, y0, x1, y1, bounce = 0.7) {
  const r = g.cr;
  if (c.x < x0 + r) { c.x = x0 + r; c.vx = Math.abs(c.vx) * bounce; }
  if (c.x > x1 - r) { c.x = x1 - r; c.vx = -Math.abs(c.vx) * bounce; }
  if (c.y < y0 + r) { c.y = y0 + r; c.vy = Math.abs(c.vy) * bounce; }
  if (c.y > y1 - r) { c.y = y1 - r; c.vy = -Math.abs(c.vy) * bounce; }
}

// Steer toward a point (used by CPU drivers); returns [mx, my].
export function toward(c, x, y) { const dx = x - c.x, dy = y - c.y, n = hyp(dx, dy) || 1; return [dx / n, dy / n]; }

export function sparks(g, dt) {
  for (const p of g.sparks || []) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }
  g.sparks = (g.sparks || []).filter(p => p.l > 0);
}

export function drawCar(g, f, c, col, scale = 1) {
  if (c.out) return;
  const r = g.cr * scale, dark = col.map(v => v * 0.45);
  f.disc(c.x, c.y, r, dark);                      // rubber bumper ring
  f.disc(c.x, c.y, r - Math.max(1, r * 0.3), col); // car body
  // driver (a dog head) sits toward the front
  const hx = c.x + Math.cos(c.a) * r * 0.35, hy = c.y + Math.sin(c.a) * r * 0.35;
  f.set(hx, hy, [255, 255, 255]);
  if (r > 3) { f.set(hx + Math.cos(c.a) * 1, hy + Math.sin(c.a) * 1, [255, 255, 255]); }
  // the pole on the back that touches the ceiling, like a real bumper car
  f.set(c.x - Math.cos(c.a) * r * 0.55, c.y - Math.sin(c.a) * r * 0.55, [255, 230, 120]);
  if (c.boost > 0) for (let k = 1; k <= 3; k++) f.add(c.x - Math.cos(c.a) * (r + k), c.y - Math.sin(c.a) * (r + k), [255, 140 - k * 30, 30]);
  if (c.cool <= 0 && !g.demo) f.set(c.x, c.y + r + 1, [80, 80, 90]); // turbo ready dot (subtle)
}

export function drawSparks(g, f) { for (const p of g.sparks || []) f.set(p.x, p.y, p.l > 0.2 ? [255, 240, 160] : [220, 120, 40]); }

export const label = (g, i) => g.humans === 1 && g.players[i].human ? 'YOU' : g.players[i].human ? g.players[i].name : 'CPU';
export const winTitle = (g, i) => { const n = label(g, i); return n === 'YOU' ? 'YOU WIN!' : `${n} WINS!`; };
