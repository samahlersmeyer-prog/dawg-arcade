// Dawg Volley: slime-style volleyball. Move with the D-pad, A (or Up) jumps. Don't let it land on your side. First to 7.
const SAND = [120, 95, 55], NET = [220, 220, 220], SKY = [10, 18, 40];
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default {
  key: 'volley', name: 'DAWG VOLLEY', tag: 'VERSUS', color: [255, 210, 90],
  blurb: 'FIRST TO 7', solo: '1P VS CPU', duo: '2P VERSUS',
  init(g) {
    const { W, H, S } = g;
    g.G = H - Math.max(3, Math.round(4 * S));      // ground line
    g.R = 7 * S; g.br = Math.max(1.8, 2.4 * S);
    g.netH = Math.round(H * 0.3); g.netW = Math.max(2, Math.round(2 * S));
    g.grav = 230 * S; g.bgrav = 120 * S;
    g.score = [0, 0];
    g.p = g.players.map((pl, i) => ({ x: i ? W * 0.75 : W * 0.25, y: g.G, vx: 0, vy: 0 }));
    serve(g, g.rnd() < 0.5 ? 0 : 1);
  },
  update(g, dt, pads) {
    const { W, S } = g;
    if (g.wait > 0) { g.wait -= dt; }
    g.players.forEach((pl, i) => {
      const p = g.p[i];
      let mx, jump;
      if (pl.cpu) [mx, jump] = cpu(g, i); else { mx = pads[i].x; jump = pads[i].a || pads[i].up; }
      p.vx = mx * 62 * S;
      const onGround = p.y >= g.G - 0.01;
      if (jump && onGround) p.vy = -100 * S;
      p.vy += g.grav * dt; p.y += p.vy * dt; p.x += p.vx * dt;
      if (p.y > g.G) { p.y = g.G; p.vy = 0; }
      const lo = i ? W / 2 + g.netW / 2 + g.R : g.R, hi = i ? W - g.R : W / 2 - g.netW / 2 - g.R;
      p.x = clamp(p.x, lo, hi);
    });
    if (g.wait > 0) return;
    const b = g.b, steps = 4;
    for (let s = 0; s < steps; s++) {
      const h = dt / steps;
      b.vy += g.bgrav * h; b.x += b.vx * h; b.y += b.vy * h;
      if (b.x < g.br) { b.x = g.br; b.vx = Math.abs(b.vx); }
      if (b.x > W - g.br) { b.x = W - g.br; b.vx = -Math.abs(b.vx); }
      if (b.y < -g.H) b.vy = Math.abs(b.vy);
      // net
      const nl = W / 2 - g.netW / 2 - g.br, nr = W / 2 + g.netW / 2 + g.br, top = g.G - g.netH;
      if (b.x > nl && b.x < nr && b.y > top - g.br) {
        if (b.y < top + 1 && b.vy > 0) { b.y = top - g.br; b.vy = -Math.max(30 * S, Math.abs(b.vy) * 0.7); if (Math.abs(b.vx) < 15 * S) b.vx = (b.x < W / 2 ? -1 : 1) * 20 * S; }
        else { b.x = b.x < W / 2 ? nl : nr; b.vx = (b.x < W / 2 ? -1 : 1) * Math.abs(b.vx) * 0.8; }
      }
      // dogs (half circles sitting on the ground)
      g.p.forEach((p, i) => {
        const dx = b.x - p.x, dy = b.y - p.y, d = hyp(dx, dy), min = g.R + g.br;
        if (d < min && dy < 1 && d > 0) {
          const nx = dx / d, ny = dy / d;
          b.x = p.x + nx * min; b.y = p.y + ny * min;
          const rvx = b.vx - p.vx, rvy = b.vy - p.vy, dot = rvx * nx + rvy * ny;
          if (dot < 0) {
            b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; b.vx += p.vx * 0.3; b.vy += Math.min(0, p.vy) * 0.3;
            const v = hyp(b.vx, b.vy), lo = 70 * S, hi = 135 * S;
            const k = v < lo ? lo / v : v > hi ? hi / v : 1; b.vx *= k; b.vy *= k;
            g.touch = i; g.sfx('hit');
          }
        }
      });
      if (b.y > g.G - g.br) return point(g, b.x < W / 2 ? 1 : 0);
    }
  },
  draw(g, f) {
    const { W, H } = g;
    for (let y = 0; y < g.G; y += 1) { const k = y / g.G; f.rect(0, y, W, 1, [SKY[0] + 20 * k, SKY[1] + 30 * k, SKY[2] + 45 * k]); }
    f.rect(0, g.G + 1, W, H - g.G, SAND);
    f.rect(W / 2 - g.netW / 2, g.G - g.netH, g.netW, g.netH + 1, NET);
    g.p.forEach((p, i) => {
      const col = g.players[i].color;
      for (let y = 0; y <= g.R; y++) { const hw = Math.sqrt(g.R * g.R - y * y); f.rect(p.x - hw, p.y - y, hw * 2 + 1, 1, col); }
      // eye looking at the ball, and ears
      const ex = p.x + (i ? -1 : 1) * g.R * 0.45, ey = p.y - g.R * 0.55;
      const lx = clamp(g.b.x - ex, -1, 1), ly = clamp(g.b.y - ey, -1, 1);
      f.disc(ex, ey, Math.max(1, g.R * 0.2), [255, 255, 255]); f.set(ex + lx, ey + ly, [0, 0, 0]);
      f.rect(p.x + (i ? 1 : -1) * g.R * 0.5 - 1, p.y - g.R - 1, 2, 2, col.map(v => v * 0.6));
    });
    const b = g.b;
    if (!(g.wait > 0) || (g.t * 6 | 0) % 2) f.disc(b.x, b.y, g.br, [255, 255, 255]);
    if (b.y < 0) f.rect(b.x - 1, 0, 3, 1, [255, 255, 255]);   // ball above the screen: little marker
    f.center(String(g.score[0]), 3, g.players[0].color, 1, 0, W / 2);
    f.center(String(g.score[1]), 3, g.players[1].color, 1, W / 2, W);
  },
};

function serve(g, who) {
  g.b = { x: who ? g.W * 0.75 : g.W * 0.25, y: g.G - g.H * 0.55, vx: 0, vy: 0 };
  g.wait = 1; g.server = who;
}
function point(g, who) {
  g.score[who]++; g.sfx('score');
  if (g.score[who] >= 7) {
    const p = g.players[who];
    g.over = { title: g.humans === 1 ? (p.human ? 'YOU WIN!' : 'CPU WINS') : `${p.name} WINS!`, color: p.color, sub: `${g.score[0]} - ${g.score[1]}`, sad: g.humans === 1 && !p.human };
    return;
  }
  serve(g, who);
}
// where will the ball come down to height y? (ignores walls and the net)
function landX(g, y) {
  let { x, y: by, vx, vy } = g.b;
  for (let t = 0; t < 3; t += 1 / 60) {
    vy += g.bgrav / 60; x += vx / 60; by += vy / 60;
    if (x < 0) { x = -x; vx = -vx; } if (x > g.W) { x = 2 * g.W - x; vx = -vx; }
    if (by > y && vy > 0) return x;
  }
  return x;
}
function cpu(g, i) {
  const { W, R } = g, p = g.p[i], b = g.b, side = i ? 1 : -1;
  const mySide = i ? b.x > W / 2 : b.x < W / 2;
  const lx = landX(g, g.G - R * 0.9);
  // each time the ball comes over, the CPU misjudges it a little (sometimes a lot)
  if (mySide !== p.wasMine) { p.wasMine = mySide; p.err = g.rnd() < (g.demo ? 0.2 : 0.16) ? (g.rnd() < 0.5 ? -1 : 1) * R * (1.7 + g.rnd() * 0.6) : (g.rnd() - 0.5) * R * 0.8; }
  const landsMine = i ? lx > W / 2 : lx < W / 2;
  let tx = i ? W * 0.72 : W * 0.28;
  // stand a bit behind where it lands, so the bump sends it over the net
  if (landsMine || mySide) tx = lx + side * R * 0.4 + (p.err || 0);
  const dx = tx - p.x, mx = Math.abs(dx) < 1.2 ? 0 : Math.sign(dx);
  const near = Math.abs(b.x - p.x) < R * 1.3 && b.y > g.G - R * 3.2 && b.y < g.G - R * 1.4 && b.vy > 0;
  return [mx, mySide && near && Math.abs(b.x - W / 2) > R * 0.6];
}
