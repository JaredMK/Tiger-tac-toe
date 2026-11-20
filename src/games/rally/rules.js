// Road Race: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own laps. A move is one lap attempt on the mover's phone: the road winds up the screen (100 wide)
// and the car drives up it at a steady speed; the driver steers by dragging: the car makes for the finger, as
// fast as it can turn. Off the road is a crash and the
// attempt is over; the end of the lap (`RALLY.len` along) is a lap done. First to `laps` laps takes the square.
// An attempt's road is the same wherever it is worked out (`rallyTrack`: from the square's public seed, the player
// and the number of their attempt, by the track set). The attempt is worked out in fixed steps (`RALLY.hz` a second)
// from its steering alone, so the move is the steering, `{ log: [[step, x]...], steps }` (x: where across the road the
// finger asked the car to be, 0 to 100, from that step on; steps: how long it was driven), and the server drives it again (`rallyRun`) and takes its own result. How
// fast the steps were played is the phone's word, so the game is held out of Find Match (core/games.js FIND_MATCH_HOLD).
import { makeRng, needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export const RALLY = { hz: 60, len: 540, w: 100, car: 3.4, ease: 55, maxLog: 600, wait: 700, end: 750, pre: 300, drive: 1300, hold: 650 };   // (car: its half width; ease: the straight at each end of a lap; wait: before the car sets off, ms; drive: someone else's attempt shown on the strip)
const SETS = { gentle: [15, 15], twisty: [25, 25], mixed: [14, 26] };
export function rallyCfg(mini) { const t = tune(mini); return { laps: t.laps, speed: t.speed, steer: t.steer, half: t.width / 2, set: SETS[t.tracks] ? t.tracks : 'mixed', ai: { easy: t.aiLapseEasy, normal: t.aiLapse, hard: t.aiLapseHard } }; }
export function create(type, rng) { return { type, seed: Math.floor(needRng(rng)() * 1e9), laps: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; }
// An attempt's road: three waves added together (their sizes, lengths and starts), straight at both ends of the lap.
export function rallyTrack(mini, p) {
  const c = rallyCfg(mini), r = makeRng(`rally:${mini.seed}:${p}:${mini.n[p]}`), [lo, hi] = SETS[c.set], A = Math.min(50 - c.half - 2, lo + (hi - lo) * r());
  return { a: [A * 0.62, A * 0.28, A * 0.1], l: [170 + r() * 60, 78 + r() * 26, 42 + r() * 14], ph: [r() * 6.283, r() * 6.283, r() * 6.283] };
}
export function rallyCentre(tr, s) {
  const k = Math.max(0, Math.min(1, s / RALLY.ease, (RALLY.len - s) / RALLY.ease));
  return 50 + k * (tr.a[0] * Math.sin(6.283185 * s / tr.l[0] + tr.ph[0]) + tr.a[1] * Math.sin(6.283185 * s / tr.l[1] + tr.ph[1]) + tr.a[2] * Math.sin(6.283185 * s / tr.l[2] + tr.ph[2]));
}
export const rallySteps = c => Math.ceil(RALLY.len / c.speed * RALLY.hz) + 2;
export const rallyLogOk = (log, steps) => Array.isArray(log) && log.length <= RALLY.maxLog && Number.isInteger(steps) && steps >= 0 && steps <= 100000 && log.every((e, i) => Array.isArray(e) && e.length === 2 && Number.isInteger(e[0]) && e[0] >= 0 && (i === 0 || e[0] >= log[i - 1][0]) && Number.isInteger(e[1]) && e[1] >= 0 && e[1] <= 100);
// The attempt driven from its steering: { done, s (how far), step, x, crash }. `pick(step, x, s)` steers in place of a log (the computer's hand).
export function rallyRun(c, tr, log, steps, pick) {
  let x = 50, to = 50, li = 0;
  const max = Math.min(steps == null ? Infinity : steps, rallySteps(c));
  for (let k = 0; k <= max; k++) {
    const s = k * c.speed / RALLY.hz;
    if (s >= RALLY.len) return { done: true, s: RALLY.len, step: k, x, crash: false };
    if (Math.abs(x - rallyCentre(tr, s)) > c.half - RALLY.car) return { done: false, s, step: k, x, crash: true };
    if (k === max) break;
    if (pick) to = pick(k, x, s, to); else while (li < log.length && log[li][0] <= k) to = log[li++][1];
    x += Math.max(-c.steer / RALLY.hz, Math.min(c.steer / RALLY.hz, to - x));
  }
  return { done: false, s: max * c.speed / RALLY.hz, step: max, x, crash: false };
}
export function apply(mini, p, m, rng, idx) {
  if (!m || typeof m !== 'object' || !rallyLogOk(m.log, m.steps)) return { ok: false, reason: 'bad' };
  const c = rallyCfg(mini), run = rallyRun(c, rallyTrack(mini, p), m.log, m.steps), from = mini.laps[p];
  if (run.done) mini.laps[p]++;
  mini.n[p]++;
  mini.last = { by: p, done: run.done, crash: run.crash, pct: Math.round(100 * run.s / RALLY.len), from, to: mini.laps[p] };
  if (mini.laps[p] >= c.laps) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: run.done ? 'lap' : 'crash' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
// A hand on the wheel (the computer's, the tests'): make for the middle of the road a little ahead; `lapse` times a
// second on average it stops paying attention for a while and leaves the finger where it was.
export function rallyDrive(c, tr, rng, lapse) {
  const log = [], look = c.speed * 0.2; let held = 0, last = 50;
  const run = rallyRun(c, tr, null, null, (k, x, s, to) => {
    let w = to;
    if (held > 0) held--; else if (rng() < lapse / RALLY.hz) held = 20 + Math.floor(rng() * 30);
    else w = Math.round(rallyCentre(tr, Math.min(RALLY.len, s + look)));
    if (w !== last) { log.push([k, w]); last = w; }
    return w;
  });
  return { log, steps: run.step, run };
}
export function randomMove(mini, p, rng, from, empties) { const c = rallyCfg(mini), d = rallyDrive(c, rallyTrack(mini, p), needRng(rng), 1.5); return { log: d.log, steps: d.steps }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.rr = JSON.parse(JSON.stringify(mini.last)); }
export const rallyShowMs = () => RALLY.pre + RALLY.drive + 250;   // someone else's attempt, as its result is shown
export function flashMs(f, winLen, won) { return f.rr ? rallyShowMs() + RALLY.hold + (won ? 500 : 0) : 0; }
