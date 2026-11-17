// Controllers and keyboard -> two players.
//   Controllers: first one plugged in is Player 1, second is Player 2. D-pad or left stick, A (or X) = action, B = second action,
//   Start = pause, Select + Start = home menu.
//   Keyboard:  Player 1 = W A S D + F (action) / G      Player 2 = arrow keys + Enter (action) / Right Shift
//              P = pause, Esc or Home = home menu.
// In a 1-player game every controller and both sets of keys drive Player 1.

const KEYS = {
  KeyW: [0, 'up'], KeyS: [0, 'down'], KeyA: [0, 'left'], KeyD: [0, 'right'], KeyF: [0, 'a'], KeyG: [0, 'b'], Space: [0, 'a'],
  ArrowUp: [1, 'up'], ArrowDown: [1, 'down'], ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'],
  Enter: [1, 'a'], NumpadEnter: [1, 'a'], ShiftRight: [1, 'b'], Slash: [1, 'a'], Period: [1, 'b'],
  KeyP: [0, 'start'], Escape: [0, 'home'], Home: [0, 'home'],
};
const BTN = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'home'];
const blank = () => Object.fromEntries(BTN.map(b => [b, false]));

export class Input {
  constructor() {
    this.kb = [blank(), blank()];
    this.tap = [blank(), blank()];   // a quick tap that started and ended between two frames still counts
    this.prev = [blank(), blank()];
    this.cur = [blank(), blank()];
    this.any = blank(); this.anyPrev = blank();
    this.pads = 0;
    if (typeof addEventListener === 'function') {
      addEventListener('keydown', e => { const k = KEYS[e.code]; if (k) { this.kb[k[0]][k[1]] = true; this.tap[k[0]][k[1]] = true; e.preventDefault(); } });
      addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) this.kb[k[0]][k[1]] = false; });
      addEventListener('blur', () => { this.kb = [blank(), blank()]; });
    }
  }
  // Call once per frame. players = 1 or 2 (how many humans are in the game).
  poll(players = 2) {
    this.prev = this.cur; this.anyPrev = this.any;
    const p = [0, 1].map(i => Object.fromEntries(BTN.map(b => [b, this.kb[i][b] || this.tap[i][b]])));
    // a tap shows as "down" for one frame, then must show "up" for one frame so the next tap is a new press
    if (this.tapUp) { for (const i of [0, 1]) for (const b of BTN) if (this.tapUp[i][b] && !this.kb[i][b]) p[i][b] = false; }
    this.tapUp = this.tap.map((t, i) => Object.fromEntries(BTN.map(b => [b, t[b] && !this.kb[i][b]])));
    this.tap = [blank(), blank()];
    const gps = (typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean);
    this.pads = gps.length;
    gps.slice(0, 2).forEach((gp, i) => {
      const b = n => !!gp.buttons[n]?.pressed, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, s = p[i];
      s.up ||= b(12) || ay < -0.5; s.down ||= b(13) || ay > 0.5; s.left ||= b(14) || ax < -0.5; s.right ||= b(15) || ax > 0.5;
      s.a ||= b(0) || b(2); s.b ||= b(1) || b(3);
      if (b(8) && b(9)) s.home = true; else s.start ||= b(9);
    });
    // Keyboard "P" and "Esc" belong to whoever: copy to both
    for (const k of ['start', 'home']) if (p[0][k]) p[1][k] = true;
    if (players === 1) for (const k of BTN) p[0][k] = p[0][k] || p[1][k];
    this.cur = p;
    this.any = Object.fromEntries(BTN.map(k => [k, p[0][k] || p[1][k]]));
  }
  // Player i's controls: x/y = -1..1, held flags, and *P = pressed this frame
  pad(i) {
    const c = this.cur[i], o = this.prev[i];
    return {
      x: (c.right ? 1 : 0) - (c.left ? 1 : 0), y: (c.down ? 1 : 0) - (c.up ? 1 : 0),
      up: c.up, down: c.down, left: c.left, right: c.right, a: c.a, b: c.b,
      aP: c.a && !o.a, bP: c.b && !o.b, upP: c.up && !o.up, downP: c.down && !o.down, leftP: c.left && !o.left, rightP: c.right && !o.right,
    };
  }
  pressed(k) { return this.any[k] && !this.anyPrev[k]; }
}
