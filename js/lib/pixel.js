// Pixel frame for the arcade. Same drawing calls as the Pixel Wall renderer, but any size,
// so the arcade fits however many LED panels the wall ends up with.
import { glyph, advance, GLYPH_W, GLYPH_H } from './font.js?v=5';

export function hex(c) {
  if (Array.isArray(c)) return c;
  const s = String(c || '#ffffff').replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map(x => x + x).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function hsv(h, s = 1, v = 1) {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  return [r * 255, g * 255, b * 255];
}
export const mix = (c, k) => c.map(v => v * k);
export const GLYPH = { w: GLYPH_W, h: GLYPH_H };

export class Frame {
  constructor(w = 128, h = 64) { this.w = w; this.h = h; this.buf = new Uint8ClampedArray(w * h * 3); }
  clear(c = [0, 0, 0]) { for (let i = 0; i < this.w * this.h; i++) this.buf.set(c, i * 3); }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2];
  }
  get(x, y) { const i = (Math.round(y) * this.w + Math.round(x)) * 3; return [this.buf[i], this.buf[i + 1], this.buf[i + 2]]; }
  add(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] += c[0]; this.buf[i + 1] += c[1]; this.buf[i + 2] += c[2];
  }
  rect(x, y, w, h, c) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  frame(x, y, w, h, c) { this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c); this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c); }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
  }
  disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5) this.set(x, y, c);
  }
  discAdd(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5) this.add(x, y, c);
  }
  ring(cx, cy, r, c) { for (let a = 0; a < 6.283; a += 0.5 / Math.max(r, 1)) this.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); }
  sprite(rows, x, y, palette, scale = 1, flip = false) {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = palette[r[flip ? r.length - 1 - i : i]]; if (c) this.rect(x + i * scale, y + j * scale, scale, scale, c); } });
  }
  dim(k) { for (let i = 0; i < this.buf.length; i++) this.buf[i] *= k; }
  textWidth(str, scale = 1) { let w = 0; for (const ch of String(str)) w += advance(ch) * scale; return Math.max(0, w - scale); }
  text(str, x, y, color, scale = 1) {
    let cx = Math.round(x), idx = 0;
    for (const ch of String(str)) {
      const g = glyph(ch), c = typeof color === 'function' ? color(idx) : hex(color);
      if (g) for (let row = 0; row < GLYPH_H; row++) for (let col = 0; col < GLYPH_W; col++)
        if (g[row][col] === '#') this.rect(cx + col * scale, y + row * scale, scale, scale, c);
      cx += advance(ch) * scale; idx++;
    }
    return cx;
  }
  center(str, y, color, scale = 1, x0 = 0, x1 = this.w) { this.text(str, Math.round(x0 + (x1 - x0 - this.textWidth(str, scale)) / 2), y, color, scale); }
  // biggest scale (max 3) that fits the width
  fit(str, maxW, max = 3) { for (let s = max; s > 1; s--) if (this.textWidth(str, s) <= maxW) return s; return 1; }
}
