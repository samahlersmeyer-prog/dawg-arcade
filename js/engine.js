// Dawg Arcade engine: game menu with attract demos, 1P / 2P select, ready-go, pause, game over, best scores.
// Runs at any screen size (W x H in LEDs). Games only see the `g` object and draw into a Frame.
import { Frame, mix } from './lib/pixel.js';
import { Input } from './input.js';

export const COLORS = [[70, 170, 255], [255, 110, 60], [90, 230, 110], [200, 110, 255]];
export const NAMES = ['P1', 'P2', 'CPU', 'CPU'];
const GOLD = [255, 205, 60], WHITE = [255, 255, 255], GRAY = [120, 120, 130];
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('dawgArcade:' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('dawgArcade:' + k, JSON.stringify(v)); } catch {} },
};

// ---- tiny sound effects ----
let actx = null;
export function sfx(kind) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const T = { blip: [660, 0.05, 'square', 0.05], hit: [440, 0.06, 'square', 0.07], bounce: [300, 0.04, 'triangle', 0.08],
      score: [880, 0.25, 'square', 0.06, 1320], shoot: [900, 0.06, 'sawtooth', 0.04, 300], boom: [120, 0.3, 'sawtooth', 0.1, 40],
      eat: [520, 0.08, 'square', 0.05, 780], die: [400, 0.5, 'square', 0.07, 60], start: [440, 0.3, 'square', 0.05, 880] }[kind];
    if (!T) return;
    const [f0, dur, type, vol, f1] = T, t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}

function newGame(def, W, H, humans, demo) {
  const n = def.slots || 2;
  const players = Array.from({ length: n }, (_, i) => ({
    i, color: COLORS[i], name: NAMES[i],
    human: !demo && i < humans, cpu: demo || i >= humans,
  }));
  // co-op games (and "alone" games like Snake) with 1 human just have that one player
  const alone = def.tag === 'CO-OP' || def.alone;
  const active = alone && !demo ? players.slice(0, humans) : players;
  const g = { W, H, S: H / 64, def, humans, demo, players: active, t: 0, over: null, sfx: demo ? () => {} : sfx, rnd: Math.random, store };
  def.init(g);
  return g;
}

export class Arcade {
  constructor(games, { W = 128, H = 64, onHome } = {}) {
    this.games = games; this.W = W; this.H = H; this.onHome = onHome || (() => {});
    this.input = new Input();
    this.frame = new Frame(W, H);
    this.sel = store.get('sel') || 0; this.sel %= games.length;
    this.mode = store.get('mode') || 1;
    this.screen = 'menu'; this.t = 0; this.idle = 0;
    this.demo = null; this.demoT = 0;
    this.pauseSel = 0;
  }
  get def() { return this.games[this.sel]; }

  start() {
    const def = this.def;
    store.set('sel', this.sel); store.set('mode', this.mode);
    this.g = newGame(def, this.W, this.H, this.mode, false);
    this.screen = 'ready'; this.readyT = 0; sfx('start');
  }

  step(dt) {
    this.t += dt;
    const humans = this.screen === 'play' || this.screen === 'ready' ? this.mode : 1;
    this.input.poll(humans);
    const I = this.input;
    if (I.pressed('home')) { this.onHome(); return; }
    if (this.screen === 'menu') return this.stepMenu(dt);
    if (this.screen === 'ready') { this.readyT += dt; if (this.readyT > 1.6) this.screen = 'play'; return; }
    if (this.screen === 'pause') return this.stepPause();
    if (this.screen === 'play') {
      if (I.pressed('start')) { this.screen = 'pause'; this.pauseSel = 0; return; }
      const g = this.g, pads = [I.pad(0), I.pad(1)];
      g.t += dt; this.g.def.update(g, dt, pads);
      if (g.over) { this.screen = 'over'; this.overT = 0; this.finish(); }
      return;
    }
    if (this.screen === 'over') {
      this.overT += dt; const g = this.g; g.t += dt;
      if (g.def.update && g.over.keepRunning) g.def.update(g, dt, [I.pad(0), I.pad(1)]);
      if (this.overT > 1.2) {
        if (I.pressed('a') || I.pressed('start')) this.start();
        else if (I.pressed('b') || this.overT > 45) { this.screen = 'menu'; this.demo = null; }
      }
    }
  }

  finish() {
    const g = this.g, def = g.def;
    if (def.score && this.mode === 1 && typeof g.over.score === 'number') {
      const k = 'best:' + def.key, best = store.get(k) || 0;
      g.over.best = Math.max(best, g.over.score); g.over.newBest = g.over.score > best && g.over.score > 0;
      if (g.over.newBest) store.set(k, g.over.score);
    }
    sfx(g.over.sad ? 'die' : 'score');
  }

  stepMenu(dt) {
    const I = this.input, n = this.games.length;
    if (I.pressed('left')) { this.sel = (this.sel + n - 1) % n; this.demo = null; sfx('blip'); }
    if (I.pressed('right')) { this.sel = (this.sel + 1) % n; this.demo = null; sfx('blip'); }
    if (I.pressed('up') || I.pressed('down')) { this.mode = this.mode === 1 ? 2 : 1; sfx('blip'); }
    if (I.pressed('a') || I.pressed('start')) return this.start();
    // attract demo: the CPU plays the selected game behind the menu
    if (!this.demo || this.demo.over || this.demoT > 30) { this.demo = newGame(this.def, this.W, this.H, 0, true); this.demoT = 0; }
    this.demoT += dt; this.demo.t += dt;
    const none = { x: 0, y: 0 };
    this.demo.def.update(this.demo, dt, [none, none]);
  }

  stepPause() {
    const I = this.input;
    if (I.pressed('up')) this.pauseSel = (this.pauseSel + 2) % 3;
    if (I.pressed('down')) this.pauseSel = (this.pauseSel + 1) % 3;
    if (I.pressed('start') || I.pressed('b')) { this.screen = 'play'; return; }
    if (I.pressed('a')) {
      if (this.pauseSel === 0) this.screen = 'play';
      else if (this.pauseSel === 1) this.start();
      else { this.screen = 'menu'; this.demo = null; }
    }
  }

  draw() {
    const f = this.frame, { W, H } = this;
    f.clear();
    if (this.screen === 'menu') return this.drawMenu(f), f;
    const g = this.g;
    g.def.draw(g, f);
    if (this.screen === 'ready') {
      f.dim(0.45);
      const txt = this.readyT < 1.1 ? 'READY' : 'GO!';
      f.center(txt, H / 2 - 7, txt === 'GO!' ? [90, 255, 120] : GOLD, f.fit(txt, W - 8, 2));
      if (this.readyT < 1.1 && H >= 48) this.drawWho(f, H / 2 + 10);
    }
    if (this.screen === 'pause') {
      f.dim(0.3);
      const opts = ['RESUME', 'RESTART', 'QUIT'], y0 = Math.max(1, H / 2 - 16);
      if (H >= 48) f.center('PAUSED', y0 - 10, GOLD);
      opts.forEach((o, i) => this.choice(f, o, y0 + 2 + i * 10, i === this.pauseSel, WHITE));
    }
    if (this.screen === 'over') {
      const o = g.over, k = Math.min(1, this.overT * 2);
      f.dim(1 - 0.65 * k);
      if (this.overT > 0.3) {
        const title = o.title || 'GAME OVER', col = o.color || GOLD;
        let y = Math.max(1, H / 2 - 18);
        f.center(title, y, col, f.fit(title, W - 6, 2)); y += f.fit(title, W - 6, 2) * 8 + 3;
        if (o.sub) { f.center(o.sub, y, WHITE); y += 9; }
        if (typeof o.score === 'number' && this.mode === 1 && g.def.score) {
          f.center(o.newBest ? `NEW BEST ${o.score}` : `BEST ${o.best}`, y, o.newBest && (this.t * 4 | 0) % 2 ? GOLD : [200, 200, 120]); y += 9;
        }
        if (this.overT > 1.2 && H >= 40) f.center('A AGAIN  B MENU', H - 9, GRAY);
      }
    }
    return f;
  }

  // a menu choice; the selected one gets little arrows on both sides
  choice(f, label, y, on, col) {
    f.center(label, y, on ? col : [90, 90, 100]);
    if (!on) return;
    const w = f.textWidth(label), x0 = Math.round((this.W - w) / 2) - 5, x1 = Math.round((this.W + w) / 2) + 3;
    for (let i = 0; i < 3; i++) { f.rect(x0 + i, y + 1 + i, 1, 5 - i * 2, col); f.rect(x1 + 2 - i, y + 1 + i, 1, 5 - i * 2, col); }
  }

  drawWho(f, y) {
    const { W } = this, g = this.g;
    const shown = g.players.slice(0, 4);
    const w = W / shown.length;
    shown.forEach((p, i) => f.center(p.human ? (this.mode === 1 ? 'YOU' : p.name) : 'CPU', y, p.color, 1, i * w, (i + 1) * w));
  }

  drawMenu(f) {
    const { W, H } = this, def = this.def, small = H < 48;
    if (this.demo) { this.demo.def.draw(this.demo, f); f.dim(0.38); }
    if (!small) f.center('DAWG ARCADE', 2, (i => [GOLD, [255, 160, 60], [255, 110, 60]][(i + (this.t * 6 | 0)) % 3]), 1);
    const name = def.name, sc = f.fit(name, W - 18, 2), ny = small ? 3 : Math.round(H * 0.22);
    const nw = f.textWidth(name, sc);
    if (nw <= W - 14) f.center(name, ny, def.color || WHITE, sc);
    else { // too long for a small screen: scroll it
      const span = nw + 20, off = (this.t * 18) % span;
      f.text(name, W - 8 - off, ny, def.color || WHITE, sc); f.text(name, W - 8 - off + span, ny, def.color || WHITE, sc);
      f.rect(0, ny, 8, 8 * sc, [0, 0, 0]); f.rect(W - 8, ny, 8, 8 * sc, [0, 0, 0]);
    }
    // arrows
    const ay = ny + sc * 3, pulse = (this.t * 3 | 0) % 2 ? WHITE : GRAY;
    for (let i = 0; i < 4; i++) { f.rect(2 + i, ay - i, 1, i * 2 + 1, pulse); f.rect(W - 3 - i, ay - i, 1, i * 2 + 1, pulse); }
    let y = ny + sc * 7 + 4;
    const best = store.get('best:' + def.key), showBest = def.score && best && (this.t % 6) > 3;
    if (!small) f.center(showBest ? `BEST ${best}` : def.blurb, y, showBest ? [220, 210, 120] : [190, 190, 200]);
    // 1P / 2P choice
    const labels = [def.solo || '1 PLAYER', def.duo || '2 PLAYERS'];
    const cy = H - (small ? 9 : 19);
    labels.forEach((l, i) => {
      const on = this.mode === i + 1;
      if (small) { if (on) this.choice(f, l, cy, true, WHITE); return; }
      this.choice(f, l, cy + i * 9, on, i ? COLORS[1] : COLORS[0]);
    });
    // page dots
    if (!small) this.games.forEach((_, i) => f.set(W / 2 - this.games.length + i * 2 + 1, H - 1, i === this.sel ? GOLD : [60, 60, 70]));
  }
}
