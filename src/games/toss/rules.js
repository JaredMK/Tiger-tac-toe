// Bin Shot: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own count of baskets. The floor is 100 wide, seen from above: the thrower at the near end, the
// bin `dist` up the room, and a fan blowing across it. The fan's push for a player's next throw is on show before it
// (`wind[p]`: how far it carries a throw sideways by the time it reaches the bin, floor units, positive to the right)
// and is drawn again after each of their throws (the move's rng: the server's online). A move is one flick, `{ a, p }`
// (shared/flick.js): the paper is thrown `TOSS.near` to `TOSS.far` up the room by its power, along its angle, carried
// sideways by the fan in proportion to how far it flies, give or take the room's spread. In the bin: a basket. Just
// outside it, within `rim` of the bin's edge, it hits the rim (v 2, December 2026): it drops in `rimIn` per cent of the
// time (a basket: `kind` 'rimin'), else it bounces out ('rimout', `bx`/`by` where it ends up on the floor); further off it
// lands on the floor ('miss'). A square from before (no `v`) keeps its old rim (never in). First to `goal` baskets
// takes the square.
import { gaussOf, needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';
import { flickOk } from '../shared/flick.js';

export const TOSS = { w: 100, near: 30, far: 125, fly: 900, drop: 420, hold: 420, rim: 3.5, r: 3.6, binH: 16 };   // (fly: the paper's flight, ms; drop: after it lands, into the bin, off the rim or along the floor; rim: a square from before's rim; binH: the bin's height, floor units)
export function tossCfg(mini) {
  const t = tune(mini), lo = Math.min(t.windMin, t.windMax), hi = Math.max(t.windMin, t.windMax);
  return { goal: t.goal, dist: t.dist, bin: t.bin, lo, hi, spread: t.spread, ai: { easy: t.aiErrEasy, normal: t.aiErr, hard: t.aiErrHard }, t };
}
const r1 = v => Math.round(v * 10) / 10 + 0;
const windOf = (lo, hi, r) => r1((lo + (hi - lo) * r()) * (r() < 0.5 ? -1 : 1));
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), lo = Math.min(t.windMin, t.windMax), hi = Math.max(t.windMin, t.windMax);
  return { type, v: 2, dist: t.dist, bin: t.bin, rim: t.rim, rimIn: t.rimIn, in: { X: 0, O: 0 }, wind: { X: windOf(lo, hi, r), O: windOf(lo, hi, r) }, n: { X: 0, O: 0 }, last: null };
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
  const off = Math.hypot(x - TOSS.w / 2, y - mini.dist), rimW = mini.v === 2 ? mini.rim : TOSS.rim, from = mini.in[p];
  const clean = off <= mini.bin, rim = !clean && off <= mini.bin + rimW, rimIn = rim && mini.v === 2 && r() * 100 < mini.rimIn, ok = clean || rimIn;
  const kind = clean ? 'in' : rimIn ? 'rimin' : rim ? 'rimout' : 'miss';
  const out = kind === 'rimout' ? (() => { const k = (off + 9) / Math.max(0.01, off); return [r1(TOSS.w / 2 + (x - TOSS.w / 2) * k), r1(mini.dist + (y - mini.dist) * k)]; })() : null;   // a ball off the rim: out and on to the floor
  if (ok) mini.in[p]++;
  mini.n[p]++;
  const next = windOf(c.lo, c.hi, r);
  mini.wind[p] = next;
  mini.last = { by: p, a: m.a, p: m.p, wind, ax: r1(ax), ay: r1(ay), x, y, in: ok, rim, kind, bx: out ? out[0] : null, by2: out ? out[1] : null, from, to: mini.in[p], next };
  if (mini.in[p] >= c.goal) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: ok ? 'in' : 'miss' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { const r = needRng(rng); return tossFlickAt(TOSS.w / 2 - mini.wind[p] + (r() - 0.5) * 14, mini.dist + (r() - 0.5) * 14); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.ts = JSON.parse(JSON.stringify(mini.last)); }
export function flashMs(f, winLen, won) { return f.ts ? TOSS.fly + TOSS.drop + TOSS.hold + (won ? 500 : 0) : 0; }
