// Odd One Out: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { ODD_DEFAULTS } from './meta.js';
import { tune, tuneLive } from '../../core/tune.js';

// Odd One Out: a grid of tiles of one colour, one of them a different shade (a little lighter or
// darker, and a touch off in hue, so it is fair with colours hard to tell apart). A player's grid grows
// with their finds: 3x3, then 4x4, then 5x5, the difference smaller each time. The difference is set in
// perceptual units (CIEDE2000, ΔE: about 1 is the smallest difference most people can see side by side),
// the same on every base colour (a step of lightness looks bigger on some hues than others): the admin's
// values (config/oddone), level by level. The odd tile's place is kept apart from the public state
// online; the tiles' colours are what the page draws. The grid waits greyed until the player taps
// Reveal; then they have secs seconds to pick ('auto': no pick, wrong). Someone else's pick replays as
// their screen showed it: the grey grid, the shades (show), a pause, the pick.
export const ODD = { goal: 3, sizes: [3, 4, 5], hueRatio: 0.375, aiFind: [0.75, 0.6, 0.45], reveal: 700, secs: 5, show: 350, pause: 1000 };   // aiFind: the computer finds it as often as a typical player is meant to (misses about 25%, 40%, 55%)
export const ODD_LIMITS = { d1: [0.5, 25], d2: [0.5, 25], d3: [0.5, 25] };
export const ODD_CFG = { cfg: null };
export function oddNorm(raw) {
  const out = {};
  for (const k of Object.keys(ODD_DEFAULTS)) { const [lo, hi] = ODD_LIMITS[k], x = raw && raw[k] != null ? Number(raw[k]) : NaN; out[k] = Number.isFinite(x) && x >= lo && x <= hi ? Math.round(x * 10) / 10 : ODD_DEFAULTS[k]; }
  return out;
}
export function setOddConfig(raw) { ODD_CFG.cfg = raw && typeof raw === 'object' ? oddNorm(raw) : null; }
export const oddConfig = () => Object.assign({}, ODD_CFG.cfg || ODD_DEFAULTS);
// Colour arithmetic: HSL to sRGB (0-255, as a screen shows it), to CIELAB (D65), and the CIEDE2000 difference.
export function hslRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
}
export function rgbLab(rgb) {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047, y = r * 0.2126729 + g * 0.7151522 + b * 0.072175, z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
export function deltaE00(l1, l2) {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2, rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (b, a) => { if (!a && !b) return 0; const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1p = hp(b1, a1p), h2p = hp(b2, a2p), dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0; if (C1p * C2p) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2), Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1p + h2p; if (C1p * C2p) { if (Math.abs(h1p - h2p) > 180) hm += h1p + h2p < 360 ? 360 : -360; hm /= 2; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTh = 30 * Math.exp(-Math.pow((hm - 275) / 25, 2)), RC = 2 * Math.sqrt(Math.pow(Cmp, 7) / (Math.pow(Cmp, 7) + Math.pow(25, 7)));
  const SL = 1 + 0.015 * Math.pow(Lm - 50, 2) / Math.sqrt(20 + Math.pow(Lm - 50, 2)), SC = 1 + 0.045 * Cmp, SH = 1 + 0.015 * Cmp * T, RT = -Math.sin(2 * dTh * rad) * RC;
  return Math.sqrt(Math.pow(dLp / SL, 2) + Math.pow(dCp / SC, 2) + Math.pow(dHp / SH, 2) + RT * (dCp / SC) * (dHp / SH));
}
export const oddDelta = (base, odd) => deltaE00(rgbLab(hslRgb(...base)), rgbLab(hslRgb(...odd)));
export const oddSizes = t => [t.n1, t.n2, t.n3];                    // the grid at each level (the square's settings)
// The computer's chance of a find at a level (the square's settings).
export const oddAi = (t, level) => [t.ai1, t.ai2, t.ai3][Math.min(level, 2)] / 100;
export function oddGrid(level, rng, cfg, sizes) {
  cfg = cfg || oddConfig(); sizes = sizes || ODD.sizes;
  const k = Math.min(level, sizes.length - 1), n = sizes[k], want = cfg['d' + (k + 1)];
  const h = randInt(rng, 360), sat = 50 + randInt(rng, 25), l = 42 + randInt(rng, 20);
  const up = l < 52 ? 1 : -1, hd = rng() < 0.5 ? -1 : 1;           // the odd tile leans toward the middle lightness (always visible), its hue a touch either way
  const at = dl => [(h + hd * dl * ODD.hueRatio + 360) % 360, sat, l + up * dl];
  let lo = 0, hi = 30;                                             // the lightness step that makes the difference wanted (bisection: the difference grows with the step)
  for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (oddDelta([h, sat, l], at(mid)) < want) lo = mid; else hi = mid; }
  const r1 = x => Math.round(x * 10) / 10;
  let o = null, err = Infinity;                                    // as drawn (to a tenth, then to the screen's 0-255): the nearest step to the difference wanted
  for (let dl = Math.max(0.1, hi - 1.5); dl <= hi + 1.5; dl += 0.1) { const c = at(dl).map(r1), e = Math.abs(oddDelta([h, sat, l], c) - want); if (e < err) { err = e; o = c; } }
  const base = `hsl(${h} ${sat}% ${l}%)`, odd = `hsl(${o[0]} ${sat}% ${o[2]}%)`;
  const pos = randInt(rng, n * n);
  return { grid: { n, base, odd, tiles: Array.from({ length: n * n }, (_, i) => (i === pos ? odd : base)) }, pos };
}
export function create(type, rng) {
  const sz = oddSizes(tuneLive(type)), gx = oddGrid(0, needRng(rng), null, sz), go = oddGrid(0, rng, null, sz);
  return { type, finds: { X: 0, O: 0 }, grid: { X: gx.grid, O: go.grid }, pos: { X: gx.pos, O: go.pos }, last: null };   // pos: the odd tile's place (hidden online)
}
export function apply(mini, p, m, rng, idx) {
  const grid = mini.grid[p], pos = mini.pos ? mini.pos[p] : null;
  if (!Number.isInteger(pos)) return { ok: false, reason: 'secret' };
  let picked;
  if (m === 'auto') picked = -1;
  else if (Number.isInteger(m) && m >= 0 && m < grid.n * grid.n) picked = m;
  else return { ok: false, reason: 'bad' };
  const correct = picked === pos;
  if (correct) mini.finds[p] += 1;
  mini.last = { by: p, n: grid.n, tiles: grid.tiles.slice(), pos, picked, correct };
  const t = tune(mini), next = oddGrid(mini.finds[p], needRng(rng), null, oddSizes(t));   // a new grid every move, at the player's level
  mini.grid[p] = next.grid; mini.pos[p] = next.pos;
  if (mini.finds[p] >= t.goal) return { ok: true, outcome: 'win', note: 'found' };
  return { ok: true, outcome: 'continue', note: correct ? 'found' : 'wrong' };
}
export function publicView(mini) {
  return { type: 'oddone', finds: { X: mini.finds.X, O: mini.finds.O }, n: { X: mini.grid.X.n, O: mini.grid.O.n }, pos: mini.pos ? { X: mini.pos.X, O: mini.pos.O } : { X: null, O: null } };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                                      // counts as wrong
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.odd = { n: l.n, tiles: l.tiles.slice(), pos: l.pos, picked: l.picked, correct: l.correct, finds: { X: mini.finds.X, O: mini.finds.O } }; return;
}
export function secret(mini) {
  return { pos: { X: mini.pos ? mini.pos.X : null, O: mini.pos ? mini.pos.O : null } };   // the odd tiles' places
}
export function hide(m, k, st) {
  delete m.pos; return;
}
export function flashMs(f, winLen, won) {
  return (f.odd && !f.timeout ? ODD.show + ODD.pause : 0) + ODD.reveal + (won ? 600 : 0);   // (the phone that picked skips the replay)
}
