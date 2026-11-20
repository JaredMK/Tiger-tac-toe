// Bin Shot: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own count of baskets. The floor is 100 wide, seen from above: the thrower at the near end, the
// bin `dist` up the room, and a fan blowing across it. The fan's push for a player's next throw is on show before it
// (`wind[p]`: how far it carries a throw sideways by the time it reaches the bin, floor units, positive to the right)
// and is drawn again after each of their throws (the move's rng: the server's online). A move is one flick, `{ a, p }`
// (shared/flick.js): the paper is thrown `TOSS.near` to `TOSS.far` up the room by its power, along its angle, carried
// sideways by the fan in proportion to how far it flies, give or take the room's spread. In the bin: a basket. First
// to `goal` baskets takes the square.
import { gaussOf, needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';
import { flickOk } from '../shared/flick.js';

export const TOSS = { w: 100, near: 30, far: 125, fly: 760, drop: 260, hold: 420, rim: 3.5, r: 3.6 };   // (fly: the paper's flight, ms; rim: how far outside the bin still touches its rim)
export function tossCfg(mini) {
  const t = tune(mini), lo = Math.min(t.windMin, t.windMax), hi = Math.max(t.windMin, t.windMax);
  return { goal: t.goal, dist: t.dist, bin: t.bin, lo, hi, spread: t.spread, ai: { easy: t.aiErrEasy, normal: t.aiErr, hard: t.aiErrHard }, t };
}
const r1 = v => Math.round(v * 10) / 10 + 0;
const windOf = (lo, hi, r) => r1((lo + (hi - lo) * r()) * (r() < 0.5 ? -1 : 1));
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), lo = Math.min(t.windMin, t.windMax), hi = Math.max(t.windMin, t.windMax);
  return { type, dist: t.dist, bin: t.bin, in: { X: 0, O: 0 }, wind: { X: windOf(lo, hi, r), O: windOf(lo, hi, r) }, n: { X: 0, O: 0 }, last: null };
}
// Where a throw is aimed (no fan), and the flick that is aimed at a point (the computer's, the tests').
export const tossAim = m => { const d = TOSS.near + (TOSS.far - TOSS.near) * m.p; return [TOSS.w / 2 + Math.sin(m.a) * d, Math.cos(m.a) * d]; };
export function tossFlickAt(x, y) {
  const dx = x - TOSS.w / 2, r3 = v => Math.round(v * 1000) / 1000 + 0;
  return { a: r3(Math.max(-0.75, Math.min(0.75, Math.atan2(dx, Math.max(0.001, y))))), p: r3(Math.max(0, Math.min(1, (Math.hypot(dx, y) - TOSS.near) / (TOSS.far - TOSS.near)))) };
}
export function apply(mini, p, m, rng, idx) {
  if (!flickOk(m)) return { ok: false, reason: 'bad' };
  const c = tossCfg(mini), r = needRng(rng), [ax, ay] = tossAim(m), wind = mini.wind[p];
  const y = r1(ay + gaussOf(r) * c.spread), x = r1(ax + wind * Math.max(0, ay) / mini.dist + gaussOf(r) * c.spread);
  const off = Math.hypot(x - TOSS.w / 2, y - mini.dist), ok = off <= mini.bin, rim = !ok && off <= mini.bin + TOSS.rim, from = mini.in[p];
  if (ok) mini.in[p]++;
  mini.n[p]++;
  const next = windOf(c.lo, c.hi, r);
  mini.wind[p] = next;
  mini.last = { by: p, a: m.a, p: m.p, wind, ax: r1(ax), ay: r1(ay), x, y, in: ok, rim, from, to: mini.in[p], next };
  if (mini.in[p] >= c.goal) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: ok ? 'in' : 'miss' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { const r = needRng(rng); return tossFlickAt(TOSS.w / 2 - mini.wind[p] + (r() - 0.5) * 14, mini.dist + (r() - 0.5) * 14); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.ts = JSON.parse(JSON.stringify(mini.last)); }
export function flashMs(f, winLen, won) { return f.ts ? TOSS.fly + TOSS.drop + TOSS.hold + (won ? 500 : 0) : 0; }
