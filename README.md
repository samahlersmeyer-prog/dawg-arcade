# Dawg Arcade

Couch arcade games for the Pixel Wall. Every game is drawn in LED pixels (128×64 by default), and every game works for 1 player or 2 players.

**Play:** https://samahlersmeyer-prog.github.io/dawg-arcade/

## Controls
| | Player 1 | Player 2 |
|---|---|---|
| Controller | 1st controller plugged in | 2nd controller |
| Keyboard | W A S D, **F** = A, **G** = B | arrow keys, **Enter** = A, **Right Shift** = B |

- Menu: ◀ ▶ pick a game, ▲ ▼ pick 1P / 2P, A to start.
- **Start** or **P** pauses (Resume / Restart / Quit).
- **Select + Start**, **Esc** or **Home** goes back to the home menu.
- In a 1-player game, any controller or either set of keys works.

## Games
| Game | 1 player | 2 players |
|---|---|---|
| Light Cycles | you vs 3 CPU bikes | 2 people + 2 CPU bikes, first to 3 rounds |
| Air Hockey | vs CPU | versus, first to 7 |
| Tank Duel | vs CPU | versus, first to 5 hits (shells bounce twice) |
| Dawg Volley | vs CPU | versus, first to 7 |
| Snake | classic, high score | duel, last snake alive, first to 3 |
| Fetch Breakout | high score | co-op, one paddle each, shared lives |
| Dawgipede | high score | co-op, shared lives |

## Screen size
Default is 128×64 (2 panels). For a different wall add `?size=` once, e.g. `?size=192x64` (3 panels), `?size=128x128` (4 panels), `?size=64x32` (1 small panel). It's remembered after that; every game lays itself out to the size.

## Adding a game
Make `js/games/<name>.js` exporting `{ key, name, tag: 'VERSUS'|'CO-OP', blurb, solo, duo, init(g), update(g, dt, pads), draw(g, f) }`, list it in `js/games/index.js`, and give it CPU play (the menu uses CPU-vs-CPU as its attract demo). Check with `node tools/sim.mjs <name> 120` (runs CPU and random-button games headless) and `node tools/shots.mjs 128x64` (PNG snapshots in /tmp/shots).

`js/lib/font.js` is copied from the pixel-wall repo; `pixel.js` and `led-canvas.js` are size-flexible versions of the wall's renderer.

Big Dawg Daily is a separate app and is not touched by this repo.
