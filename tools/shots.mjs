// Menu + gameplay snapshots for every game at a given size: node tools/shots.mjs [WxH]
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
import { mkdirSync } from 'node:fs';
import { png } from './png.mjs';
const { Arcade } = await import('../js/engine.js');
const games = (await import('../js/games/index.js')).default;
const [W, H] = (process.argv[2] || '128x64').split('x').map(Number);
mkdirSync('/tmp/shots', { recursive: true });
games.forEach((def, n) => {
  const a = new Arcade(games, { W, H }); a.sel = n;
  for (let i = 0; i < 60 * 8; i++) a.step(1 / 60);
  png(a.draw(), `/tmp/shots/${W}x${H}_${n}_${def.key}_menu.png`, 4);
  a.mode = 1; a.start();
  for (let i = 0; i < 60 * 1; i++) a.step(1 / 60);
  png(a.draw(), `/tmp/shots/${W}x${H}_${n}_${def.key}_ready.png`, 4);
});
// raw gameplay (CPU demo, no menu on top)
games.forEach((def, n) => {
  const a = new Arcade(games, { W, H }); a.sel = n;
  for (let i = 0; i < 60 * 14; i++) { a.step(1 / 60); a.demoT = 0; }
  const { Frame } = a.frame.constructor === Object ? {} : { Frame: a.frame.constructor };
  const f = new Frame(W, H); a.demo.def.draw(a.demo, f);
  png(f, `/tmp/shots/${W}x${H}_${n}_${def.key}_play.png`, 4);
});
