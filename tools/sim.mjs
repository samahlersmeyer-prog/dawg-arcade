// Headless check: runs games with CPU players (and random "humans"), reports results, saves PNG snapshots.
// Usage: node tools/sim.mjs <game|all> [seconds] [WxH]
import { mkdirSync, readdirSync } from 'node:fs';
import { png } from './png.mjs';
import { Frame } from '../js/lib/pixel.js';
import { Arcade } from '../js/engine.js';

globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const [, , which = 'all', secs = '120', size = '128x64'] = process.argv;
const [W, H] = size.split('x').map(Number);
const out = '/tmp/arcade'; mkdirSync(out, { recursive: true });


const keys = which === 'all' ? readdirSync(new URL('../js/games/', import.meta.url)).filter(f => f !== 'index.js' && f !== 'bumper-core.js').map(f => f.replace('.js', '')) : [which];
for (const k of keys) {
  const def = (await import(`../js/games/${k}.js`)).default;
  // 1) demo: all CPU, several games back to back
  const a = new Arcade([def], { W, H });
  let results = [], dt = 1 / 60, snaps = 0;
  for (let n = 0, t = 0; t < Number(secs); t += dt, n++) {
    a.step(dt); a.demoT = 0;
    if (a.demo?.over) { results.push(a.demo.over.title + (a.demo.over.sub ? ' ' + a.demo.over.sub : '') + (a.demo.over.score != null ? ' ' + a.demo.over.score : '') + ` @${a.demo.t.toFixed(0)}s`); }
    if (n % 600 === 300 && snaps < 4) png(a.draw(), `${out}/${k}_${W}x${H}_demo${snaps++}.png`);
    else if (n % 3 === 0) a.draw();
  }
  // 2) "humans" mashing random buttons in 1P and 2P, through the real menu path
  const rnd = () => Math.random() < 0.5;
  for (const mode of [1, 2]) {
    const b = new Arcade([def], { W, H }); b.mode = mode; b.start();
    let held = [{}, {}];
    b.input.poll = function () { this.prev = this.cur; this.anyPrev = this.any;
      if (Math.random() < 0.08) held = [0, 1].map(() => ({ up: rnd() && rnd(), down: rnd() && rnd(), left: rnd() && rnd(), right: rnd() && rnd(), a: rnd(), b: false, start: false, home: false }));
      this.cur = held; this.any = { ...held[0] }; };
    let over = null;
    for (let t = 0; t < 90 && !over; t += dt) { b.step(dt); if (b.screen === 'over') over = b.g.over; if ((t * 60 | 0) % 900 === 450) png(b.draw(), `${out}/${k}_${W}x${H}_p${mode}.png`); else b.draw(); }
    results.push(`[${mode}P random] ` + (over ? over.title + ' ' + (over.sub || over.score || '') : 'still playing after 90s'));
  }
  console.log(k.padEnd(8), results.length, results.slice(0, 8).join(' | '));
}
