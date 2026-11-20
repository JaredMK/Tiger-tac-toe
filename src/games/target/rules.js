// Target Practice: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own targets on a field of 100 by 100 (`tg[p]`: { x, y, on }; the same places for both; all of one
// size, `tsize`). A move is one throw, `{ x, y, r }`: where the two sliders were stopped, and the aiming circle's size
// when it was stopped (between its smallest and largest). The dart lands at a point drawn at random inside that
// circle (the move's rng: the server's online): on one of the mover's standing targets, it is knocked out. The first
// to knock out all of theirs takes the square. The three stops are the phone's word (the server cannot time a tap, as
// with Bullseye's stops), so the game is held out of Find Match (core/games.js FIND_MATCH_HOLD).
import { needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const TARGET = { ax: 300, ay: 300, ac: 360, fly: 280, hold: 520, lo: 6, hi: 94 };   // ms of someone else's throw: each line run to its stop, the circle to its size, the dart's flight, the result; the sliders' travel on the field
export function targetCfg(mini) {
  const t = tune(mini), lo = Math.min(t.circleMin, t.circleMax), hi = Math.max(t.circleMin, t.circleMax);
  return { n: t.targets, size: t.size, sweep: t.sweepMs, rmin: lo, rmax: hi, pulse: t.pulseMs, ai: { easy: t.aiErrEasy, normal: t.aiErr, hard: t.aiErrHard } };
}
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), size = t.size, spots = [];
  for (let k = 0; k < 400 && spots.length < t.targets; k++) {       // places clear of the edges and of each other
    const x = Math.round(size + 4 + r() * (92 - 2 * size)), y = Math.round(size + 4 + r() * (92 - 2 * size));
    if (spots.every(s => Math.hypot(s.x - x, s.y - y) >= size * 2 + 3 - Math.floor(k / 80))) spots.push({ x, y });
  }
  const set = () => spots.map(s => ({ x: s.x, y: s.y, on: true }));
  return { type, v: 1, tsize: size, tg: { X: set(), O: set() }, hits: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null };
}
// The sliders and the circle as the clock has them: a line's place t ms after it set off (across and back), the
// circle's size t ms after it began (largest, down to smallest, back up).
const tri = u => { const f = u - Math.floor(u); return f < 0.5 ? f * 2 : 2 - f * 2; };
export const targetLine = (c, t) => TARGET.lo + (TARGET.hi - TARGET.lo) * tri(t / (2 * c.sweep));
export const targetRing = (c, t) => c.rmax - (c.rmax - c.rmin) * tri(t / (2 * c.pulse));
export function apply(mini, p, m, rng, idx) {
  const c = targetCfg(mini), num = v => typeof v === 'number' && Number.isFinite(v);
  if (!m || typeof m !== 'object' || !num(m.x) || !num(m.y) || !num(m.r) || m.x < 0 || m.x > 100 || m.y < 0 || m.y > 100 || m.r < c.rmin - 0.01 || m.r > c.rmax + 0.01) return { ok: false, reason: 'bad' };
  const r = needRng(rng), x = Math.round(m.x * 10) / 10, y = Math.round(m.y * 10) / 10, rr = Math.round(m.r * 10) / 10;
  const d = rr * Math.sqrt(r()), a = r() * Math.PI * 2, lx = Math.round((x + Math.cos(a) * d) * 10) / 10, ly = Math.round((y + Math.sin(a) * d) * 10) / 10;
  const hit = mini.tg[p].findIndex(t => t.on && Math.hypot(t.x - lx, t.y - ly) <= mini.tsize);
  if (hit >= 0) { mini.tg[p][hit].on = false; mini.hits[p]++; }
  mini.last = { by: p, n: mini.n[p], x, y, r: rr, lx, ly, hit };
  mini.n[p]++;
  if (mini.tg[p].every(t => !t.on)) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: hit >= 0 ? 'hit' : 'miss' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) {
  const cp = a => a.map(t => ({ x: t.x, y: t.y, on: t.on }));
  return { type: 'target', v: mini.v, tsize: mini.tsize, tg: { X: cp(mini.tg.X), O: cp(mini.tg.O) }, hits: { X: mini.hits.X, O: mini.hits.O }, n: { X: mini.n.X, O: mini.n.O }, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in: at a standing target, a little off, the circle small)
  const c = targetCfg(mini), live = mini.tg[p].filter(t => t.on), t = live.length ? from(live) : { x: 50, y: 50 }, r = needRng(rng);
  return { x: Math.max(0, Math.min(100, t.x + (r() - 0.5) * 12)), y: Math.max(0, Math.min(100, t.y + (r() - 0.5) * 12)), r: c.rmin + r() * 4 };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.tp = Object.assign({}, mini.last); }
export const targetMs = () => TARGET.ax + TARGET.ay + TARGET.ac + TARGET.fly;
export function flashMs(f, winLen, won) { return targetMs() + TARGET.hold + (won ? 400 : 0); }
