// Shape Split: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own score and their own shapes: an irregular many-cornered shape for each cut (`splitShape`: from
// the square's public seed, the player and the cut's number, so every phone and the server have the same one; in a box
// of 100 by 100). A move is one straight line, `{ a: [x, y], b: [x, y] }` (any two points: the cut runs on through
// them from edge to edge). The shape's area either side is worked out exactly (`splitCut`); how far the split is from
// 50/50, in points of a percent, picks the band and its points (within 1: 3, within 3: 2, within 6: 1; a line that
// misses the shape scores nothing). First to the target wins. Nothing is hidden and nothing drawn by chance: the
// server works the same cut out from the same line.
import { makeRng, needRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export const SPLIT = { line: 260, part: 420, say: 520, hold: 700, min: 4, lo: -100, hi: 200 };   // ms: the line drawn, the halves parting, the figures; the shortest line that counts (units); the furthest a point may lie
export function splitCfg(mini) {
  const t = tune(mini), bands = [[t.band1, t.pts1], [t.band2, t.pts2], [t.band3, t.pts3]].sort((x, y) => x[0] - y[0]);
  return { target: t.target, bands, corners: t.corners, ai: { easy: t.aiErrEasy, normal: t.aiErr, hard: t.aiErrHard } };
}
export function create(type, rng) { return { type, seed: randInt(needRng(rng), 1e9), score: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; }
const r1 = v => Math.round(v * 10) / 10;
// The shape of p's next cut (or cut n): its corners in order, [[x, y], ...], each to a tenth, inside 8..92.
export function splitShape(mini, p, n) {
  const k = splitCfg(mini).corners, r = makeRng(`split:${mini.seed}:${p}:${n == null ? mini.n[p] : n}`), off = r() * Math.PI * 2, raw = [];
  for (let i = 0; i < k; i++) { const a = off + (i + (r() - 0.5) * 0.7) * 2 * Math.PI / k, d = 0.4 + 0.6 * r(); raw.push([Math.cos(a) * d, Math.sin(a) * d]); }
  const xs = raw.map(q => q[0]), ys = raw.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), s = 84 / Math.max(x1 - x0, y1 - y0);
  return raw.map(([x, y]) => [r1(50 + (x - (x0 + x1) / 2) * s), r1(50 + (y - (y0 + y1) / 2) * s)]);
}
export function splitArea(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; s += x0 * y1 - x1 * y0; } return Math.abs(s) / 2; }
const side = (a, b, q) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
function clip(poly, a, b, sign) {                                // the part of the shape on one side of the line through a and b
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], dp = side(a, b, p) * sign, dq = side(a, b, q) * sign;
    if (dp >= 0) out.push(p);
    if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
// A cut: the two parts and each one's share of the shape, in percent (pct: the first part's, to a tenth).
export function splitCut(poly, a, b) {
  const L = clip(poly, a, b, 1), R = clip(poly, a, b, -1), al = L.length > 2 ? splitArea(L) : 0, ar = R.length > 2 ? splitArea(R) : 0, sum = al + ar;
  return { parts: [L, R], pct: sum > 0 ? r1(100 * al / sum) : 0, miss: !(al > 1e-6 && ar > 1e-6) };
}
// What a cut scores: { pts, err (points of a percent from 50/50), band (0 the best, -1 none) }.
export function splitScore(c, cut) {
  if (cut.miss) return { pts: 0, err: 50, band: -1 };
  const err = r1(Math.abs(50 - cut.pct)), band = c.bands.findIndex(x => err <= x[0] + 1e-9);
  return { pts: band < 0 ? 0 : c.bands[band][1], err, band };
}
const pt = q => Array.isArray(q) && q.length === 2 && q.every(v => typeof v === 'number' && Number.isFinite(v) && v >= SPLIT.lo && v <= SPLIT.hi);
export function apply(mini, p, m, rng, idx) {
  if (!m || typeof m !== 'object' || !pt(m.a) || !pt(m.b) || Math.hypot(m.a[0] - m.b[0], m.a[1] - m.b[1]) < SPLIT.min) return { ok: false, reason: 'bad' };
  const c = splitCfg(mini), a = m.a.map(r1), b = m.b.map(r1), cut = splitCut(splitShape(mini, p), a, b), s = splitScore(c, cut), from = mini.score[p];
  mini.score[p] = Math.min(c.target, from + s.pts);
  mini.last = { by: p, n: mini.n[p], a, b, pct: cut.pct, miss: cut.miss, pts: s.pts, band: s.band, from, to: mini.score[p] };
  mini.n[p]++;
  if (mini.score[p] >= c.target) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: s.pts ? 'cut' : 'off' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) {
  return { type: 'split', seed: mini.seed, score: { X: mini.score.X, O: mini.score.O }, n: { X: mini.n.X, O: mini.n.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
// The line at a given angle that leaves `share` (0..1) of the shape on its first side: { a, b } (the computer's cut; the tests').
export function splitAim(poly, angle, share) {
  const u = [Math.cos(angle), Math.sin(angle)], n = [-u[1], u[0]], pr = poly.map(q => q[0] * n[0] + q[1] * n[1]);
  let lo = Math.min(...pr), hi = Math.max(...pr);
  const mid0 = 50 * u[0] + 50 * u[1];                              // the line's middle: level with the box's centre
  const line = d => ({ a: [r1(n[0] * d + u[0] * (mid0 - 75)), r1(n[1] * d + u[1] * (mid0 - 75))], b: [r1(n[0] * d + u[0] * (mid0 + 75)), r1(n[1] * d + u[1] * (mid0 + 75))] });
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2, l = line(mid), got = splitCut(poly, l.a, l.b).pct / 100; if (got > share) lo = mid; else hi = mid; }
  return line((lo + hi) / 2);
}
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in: a cut somewhere between 35% and 65%)
  const r = needRng(rng); return splitAim(splitShape(mini, p), r() * Math.PI, 0.35 + r() * 0.3);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.sp = JSON.parse(JSON.stringify(mini.last)); }
export function flashMs(f, winLen, won) { return SPLIT.say + SPLIT.hold + (won ? 500 : 0); }
