// Outlaw (Atari 1978): a western gunfight. Move with the D-pad, A shoots. Bullets ricochet off the top and bottom;
// a cactus and a covered wagon in the middle soak up shots (the cactus gets chewed up). First to 10 hits.
const SAND = [70, 50, 25], SAND2 = [62, 44, 22], CACTUS = [60, 160, 70], WAGON = [200, 190, 160];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAN = ['.HH.', 'HHHH', '.ff.', 'bbbb', '.bb.', '.ll.', '.l.l'];

export default {
  key: 'outlaw', name: 'OUTLAW', tag: 'VERSUS', color: [230, 180, 90],
  blurb: 'FIRST TO 10 HITS', solo: '1P VS CPU', duo: '2P VERSUS',
  init(g) {
    const { W, H, S } = g;
    g.sc = Math.max(1, Math.round(S * 1.5));
    g.top = 9;
    g.men = [0, 1].map(i => ({ x: i ? W - 10 * S : 6 * S, y: (g.top + H) / 2, cool: 0, hit: 0, ai: 0, my: 0 }));
    g.bul = []; g.score = [0, 0];
    // cactus is a set of little blocks that get shot away
    g.cactus = new Set();
    const cx = Math.round(W / 2), cy = Math.round(g.top + (H - g.top) * 0.3);
    for (let y = -6; y <= 8; y++) g.cactus.add(`${cx},${cy + y}`), g.cactus.add(`${cx + 1},${cy + y}`);
    for (let y = 0; y <= 3; y++) { g.cactus.add(`${cx - 3},${cy + y}`); g.cactus.add(`${cx + 4},${cy + y - 2}`); }
    for (let x = -3; x <= 4; x++) { g.cactus.add(`${cx + Math.min(x, 0)},${cy + 3}`); if (x > 1) g.cactus.add(`${cx + x},${cy + 1}`); }
    g.wagon = { x: W / 2 - 8 * S, y: g.top + (H - g.top) * 0.62, w: 16 * S, h: 8 * S, dy: 1 };
  },
  update(g, dt, pads) {
    const { W, H, S } = g, sp = 32 * S;
    // the wagon rolls up and down slowly
    const wg = g.wagon; wg.y += wg.dy * 8 * S * dt; if (wg.y < g.top + 2 || wg.y + wg.h > H - 2) wg.dy = -wg.dy;
    g.men.forEach((m, i) => {
      m.cool -= dt; if (m.hit > 0) { m.hit -= dt; return; }
      let mx, my, fire;
      if (g.players[i].cpu) [mx, my, fire] = cpu(g, i, dt); else { mx = pads[i].x; my = pads[i].y; fire = pads[i].aP; }
      m.x = clamp(m.x + mx * sp * dt, i ? W * 0.62 : 2, i ? W - 6 * g.sc : W * 0.38 - 4 * g.sc);
      m.y = clamp(m.y + my * sp * dt, g.top + 1, H - 7 * g.sc - 1);
      // aim: up/down held while shooting sends it at an angle
      if (fire && m.cool <= 0 && !g.bul.some(b => b.o === i)) {
        const dir = i ? -1 : 1, ang = my * 0.45;
        g.bul.push({ x: m.x + (i ? -1 : 4 * g.sc), y: m.y + 3 * g.sc, vx: dir * Math.cos(ang) * 95 * S, vy: Math.sin(ang) * 95 * S, o: i, life: 2.2 });
        m.cool = 0.35; g.sfx('shoot');
      }
    });
    for (const b of g.bul) {
      for (let s = 0; s < 3; s++) {
        const h = dt / 3; b.x += b.vx * h; b.y += b.vy * h; b.life -= h;
        if (b.y < g.top || b.y > H - 1) { b.vy = -b.vy; b.y = clamp(b.y, g.top, H - 1); g.sfx('bounce'); }
        const k = `${Math.round(b.x)},${Math.round(b.y)}`;
        if (g.cactus.has(k)) { g.cactus.delete(k); g.cactus.delete(`${Math.round(b.x) + 1},${Math.round(b.y)}`); b.life = 0; g.sfx('hit'); }
        if (b.x > wg.x && b.x < wg.x + wg.w && b.y > wg.y && b.y < wg.y + wg.h) { b.life = 0; g.sfx('bounce'); }
        g.men.forEach((m, i) => {
          if (i === b.o || m.hit > 0 || b.life <= 0) return;
          if (b.x > m.x - 1 && b.x < m.x + 4 * g.sc + 1 && b.y > m.y && b.y < m.y + 7 * g.sc) {
            b.life = 0; m.hit = 1.2; g.score[b.o]++; g.sfx('boom');
            if (g.score[b.o] >= 10) {
              const p = g.players[b.o];
              g.over = { title: g.humans === 1 ? (p.human ? 'YOU WIN!' : 'CPU WINS') : `${p.name} WINS!`, color: p.color, sub: `${g.score[0]} - ${g.score[1]}`, sad: g.humans === 1 && !p.human, keepRunning: true };
            }
          }
        });
        if (b.x < -2 || b.x > W + 2) b.life = 0;
      }
    }
    g.bul = g.bul.filter(b => b.life > 0);
  },
  draw(g, f) {
    const { W, H } = g;
    for (let y = g.top; y < H; y++) f.rect(0, y, W, 1, (y >> 2) % 2 ? SAND : SAND2);
    for (const k of g.cactus) { const [x, y] = k.split(',').map(Number); f.set(x, y, CACTUS); }
    const wg = g.wagon;
    f.rect(wg.x, wg.y + wg.h * 0.55, wg.w, wg.h * 0.25, [120, 80, 40]);
    for (let x = 0; x < wg.w; x++) { const arc = Math.sin(x / wg.w * Math.PI) * wg.h * 0.55; f.rect(wg.x + x, wg.y + wg.h * 0.55 - arc, 1, arc, WAGON); }
    f.disc(wg.x + wg.w * 0.2, wg.y + wg.h * 0.9, Math.max(1, wg.h * 0.15), [60, 40, 20]); f.disc(wg.x + wg.w * 0.8, wg.y + wg.h * 0.9, Math.max(1, wg.h * 0.15), [60, 40, 20]);
    g.men.forEach((m, i) => {
      const col = g.players[i].color;
      if (m.hit > 0) { f.sprite(['....', '....', '....', '....', '.HH.', 'bbbb', 'llll'], m.x, m.y, { H: col.map(v => v * 0.5), b: col.map(v => v * 0.6), l: [90, 70, 50] }, g.sc); return; }
      f.sprite(MAN, m.x, m.y, { H: [90, 60, 30], f: [240, 200, 160], b: col, l: [70, 60, 90] }, g.sc, !!i);
      f.rect(i ? m.x - g.sc : m.x + 4 * g.sc, m.y + 3 * g.sc, g.sc, g.sc, [180, 180, 190]);       // gun
    });
    g.bul.forEach(b => f.rect(b.x, b.y, 1, 1, [255, 255, 200]));
    f.center(String(g.score[0]), 1, g.players[0].color, 1, 0, W / 2);
    f.center(String(g.score[1]), 1, g.players[1].color, 1, W / 2, W);
  },
};

function cpu(g, i, dt) {
  const m = g.men[i], e = g.men[1 - i];
  // dodge bullets coming at us
  const threat = g.bul.find(b => b.o !== i && (i ? b.vx > 0 : b.vx < 0) && Math.abs(b.x - m.x) < 30 * g.S && Math.abs(b.y - (m.y + 3)) < 6 * g.S);
  if (threat) return [0, threat.y > m.y + 3 ? -1 : 1, false];
  m.ai -= dt;
  if (m.ai <= 0) { m.ai = 0.4 + Math.random() * 0.6; m.my = Math.sign(e.y - m.y + (Math.random() - 0.5) * 20 * g.S); m.mx = (Math.random() - 0.5) * 2; }
  const lined = Math.abs(e.y - m.y) < 3 * g.S;
  return [m.mx, lined ? 0 : m.my, lined && Math.random() < (g.demo ? 0.08 : 0.05)];
}
