// Road Race: the rules (pure: no page, no clock; the server runs the same code).
// December 2026, `v: 2`: a closed circuit seen from straight above and a steering wheel (a square dealt before, a
// road winding up the screen followed by the finger, is dealt again as the record is read: `stale`).
// Each player their own laps. A square has ONE circuit for both players and every attempt (`rallyTrack`: from the
// square's public seed and the settings, the same wherever it is worked out): a smooth closed loop in a frame of
// `RALLY.W` by `RALLY.H`, a road of a fixed width round it, a start line. A move is one lap attempt on the mover's
// phone: the car starts on the line and drives itself forward at a steady speed; the driver only turns the steering
// wheel, a whole number from -`RALLY.lock` (full left) to `RALLY.lock` (full right), and the car's heading turns at a
// rate in proportion to it, relative to the car itself, as a real wheel. Off the road is a crash and the attempt is
// over; round to the line again, the whole way in order, is a lap. First to `laps` laps takes the square.
// The attempt is worked out in fixed steps (`RALLY.hz` a second) from its steering alone, so the move is the
// steering, `{ log: [[step, wheel]...], steps }` (the wheel from that step on, noted only when it changes; steps: how
// long it was driven), and the server drives it again (`rallyRun`) and takes its own result. Everything on that path
// is plain arithmetic (+, -, *, / and sqrt; sines by the series below, never Math.sin: the same to the last bit on
// every phone and the server; the heading is kept as a unit vector, so no angle is ever taken back from it). How
// fast the steps were played is the phone's word, so the game is held out of Find Match (core/games.js
// FIND_MATCH_HOLD).
import { makeRng, needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

// (lock: the wheel's notches either way; car: its half width, so the tyres just reach the kerb; edge: grass kept
// between the road and the frame; gap: grass kept between two stretches of road; sp: the centre line's spacing;
// grip: a corner is never tighter than this many of the car's sharpest turns; over: an attempt may last this many
// laps' worth of time; wait: before the car sets off, ms; end: a live attempt's ending on show; pre, hold: someone
// else's attempt before it sets off and after it ends)
export const RALLY = { hz: 60, W: 100, H: 110, lock: 12, car: 1.3, edge: 3.5, gap: 5, sp: 1, grip: 1.3, over: 1.6, tries: 60, keep: 5, ease: 8, maxLog: 2000, wait: 900, end: 800, pre: 400, hold: 650 };
// The track sets: how far the loop swings in and out of its oval (the most, of the oval's radius) and the tightest
// corner allowed (the centre line's radius).
const SETS = { gentle: { amp: [0.18, 0.3], rad: 20 }, twisty: { amp: [0.7, 0.85], rad: 12 }, mixed: { amp: [0.35, 0.85], rad: 13 } };
const TAU = 6.283185307179586, PI = 3.141592653589793;
// Sine and cosine by arithmetic alone (as Pinball's, shared/physics-sim.js, two terms longer): the angle brought
// within a quarter turn, then the series.
export const dsin = a0 => {
  let a = a0 - TAU * Math.floor((a0 + PI) / TAU);
  if (a > PI / 2) a = PI - a; else if (a < -PI / 2) a = -PI - a;
  const x = a * a;
  return a * (1 - x / 6 * (1 - x / 20 * (1 - x / 42 * (1 - x / 72 * (1 - x / 110 * (1 - x / 156 * (1 - x / 210 * (1 - x / 272 * (1 - x / 342)))))))));
};
export const dcos = a => dsin(a + 1.5707963267948966);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function rallyCfg(mini) {
  const t = tune(mini), L = RALLY.lock, num = (v, d) => (typeof v === 'number' && v > 0 ? v : d), speed = num(t.speed, 26), width = num(t.width, 12), turn = num(t.turn, 170) * PI / 180, rot = [];
  for (let w = -L; w <= L; w++) { const a = w / L * turn / RALLY.hz; rot.push([dsin(a), dcos(a)]); }   // (the heading's turn a step, for every notch of the wheel)
  return { laps: num(t.laps, 2), speed, turn, half: width / 2, set: SETS[t.tracks] ? t.tracks : 'mixed', travel: num(t.travel, 20), v: speed / RALLY.hz, rot, lim: Math.max(0.5, width / 2 - RALLY.car),
    fwd: Math.ceil(speed / RALLY.hz / RALLY.sp) + 4, back: 3, look: Math.max(4, Math.round(speed * 0.28 / RALLY.sp)), ai: { easy: t.aiLapseEasy, normal: t.aiLapse, hard: t.aiLapseHard } };
}
export function create(type, rng) { return { type, v: 2, seed: Math.floor(needRng(rng)() * 1e9), laps: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; }
export const stale = mini => mini.v !== 2;                         // (a road up the screen from before: dealt again, core/records.js)

// ---- the circuit ----
// A loop round the frame's middle whose distance from it swings in and out by a few waves (so it never crosses
// itself), stretched to fill the frame, then walked at an even spacing. Kept only if its tightest corner is gentle
// enough and no two stretches of it come too near; each try swings a little less, the last a plain oval.
const WAVE = { M: 360, s: null, c: null };                         // sin and cos of 1 to 6 times each of the loop's angles, worked out once
function waves() {
  if (!WAVE.s) { WAVE.s = []; WAVE.c = []; for (let k = 0; k <= 6; k++) { const s = [], c = []; for (let j = 0; j < WAVE.M; j++) { s.push(dsin(k * TAU * j / WAVE.M)); c.push(dcos(k * TAU * j / WAVE.M)); } WAVE.s.push(s); WAVE.c.push(c); } }
  return WAVE;
}
function loopOf(r, amp, half) {
  const { M, s: SN, c: CS } = waves(), a = [], ps = [], pc = [], px = [], py = [];
  let sum = 0;
  for (let k = 2; k <= 6; k++) { const u = r(), v = [0.5, 1, 1, 0.7, 0.4][k - 2] * (0.08 + 0.92 * u * u), ph = r() * TAU; a.push(v); sum += v; ps.push(dsin(ph)); pc.push(dcos(ph)); }
  for (let k = 0; k < 5; k++) a[k] *= amp / sum;                    // (the swings together never more than `amp` of the radius: the loop stays round its middle)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let j = 0; j < M; j++) {
    let rad = 1;
    for (let k = 0; k < 5; k++) rad += a[k] * (SN[k + 2][j] * pc[k] + CS[k + 2][j] * ps[k]);   // (the sine of k times the angle, plus its start)
    const x = rad * CS[1][j], y = rad * SN[1][j];
    px.push(x); py.push(y); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const m = half + RALLY.edge, sx = (RALLY.W - 2 * m) / (x1 - x0), sy = (RALLY.H - 2 * m) / (y1 - y0), cum = [0];
  for (let j = 0; j < M; j++) { px[j] = m + (px[j] - x0) * sx; py[j] = m + (py[j] - y0) * sy; }
  for (let j = 0; j < M; j++) { const q = (j + 1) % M, dx = px[q] - px[j], dy = py[q] - py[j]; cum.push(cum[j] + Math.sqrt(dx * dx + dy * dy)); }
  const total = cum[M], n = Math.round(total / RALLY.sp), step = total / n, x = [], y = [];
  for (let i = 0, j = 0; i < n; i++) {
    const at = i * step; while (cum[j + 1] < at) j++;
    const q = (j + 1) % M, f = (at - cum[j]) / (cum[j + 1] - cum[j] || 1);
    x.push(px[j] + (px[q] - px[j]) * f); y.push(py[j] + (py[q] - py[j]) * f);
  }
  return { n, x, y, len: total };
}
// The centre line's radius at point i (the circle through it and the points `d` either side).
export function rallyRadius(tr, i, d = 3) {
  const n = tr.n, a = (i - d + n) % n, c = (i + d) % n, ax = tr.x[a], ay = tr.y[a], bx = tr.x[i], by = tr.y[i], cx = tr.x[c], cy = tr.y[c];
  const area2 = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  if (area2 < 1e-9) return Infinity;
  return Math.sqrt(((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) * ((cx - bx) * (cx - bx) + (cy - by) * (cy - by)) * ((ax - cx) * (ax - cx) + (ay - cy) * (ay - cy))) / (2 * area2);
}
export function rallyBends(tr) { let b = 0; for (let i = 0; i < tr.n; i++) b += RALLY.sp / rallyRadius(tr, i); return b; }   // all its turning, left and right, added up (a plain oval: one whole turn)
export function rallyTightest(tr) { let m = Infinity; for (let i = 0; i < tr.n; i++) { const r = rallyRadius(tr, i); if (r < m) m = r; } return m; }
// The nearest two stretches of road come to each other (centre line to centre line), points close along the loop left out.
export function rallyApart(tr, D) {
  const n = tr.n, skip = Math.ceil(2 * D / RALLY.sp); let m = Infinity;
  for (let i = 0; i < n; i += 2) for (let j = i + skip; j < n; j += 2) {
    if (n - (j - i) < skip) break;
    const dx = tr.x[i] - tr.x[j], dy = tr.y[i] - tr.y[j], d = dx * dx + dy * dy; if (d < m) m = d;
  }
  return Math.sqrt(m);
}
const TRACKS = new Map();
export function rallyTrack(mini) {
  const c = rallyCfg(mini), S = SETS[c.set], need = Math.max(S.rad, RALLY.grip * c.speed / c.turn, c.half + 4), D = 2 * c.half + RALLY.gap, key = `${mini.seed}|${c.set}|${c.half}|${need}`;
  let tr = TRACKS.get(key); if (tr) return tr;
  const r = makeRng(`rally2:${mini.seed}`), amp = S.amp[0] + (S.amp[1] - S.amp[0]) * r(), ok = t => rallyTightest(t) >= need && rallyApart(t, D) >= D;
  let top = -1, found = 0; tr = null;
  for (let t = 0; t < RALLY.tries && found < RALLY.keep; t++) {     // of the first few loops that will do, the one with the most bends
    const cand = loopOf(r, amp, c.half); if (!ok(cand)) continue;
    const b = rallyBends(cand); found++; if (b > top) { top = b; tr = cand; }
  }
  for (let t = 1; !tr; t++) { const cand = loopOf(r, amp * (1 - t / RALLY.ease), c.half); if (t >= RALLY.ease || ok(cand)) tr = cand; }   // none: swing less and less, down to a plain oval
  if (r() < 0.5) { tr.x.reverse(); tr.y.reverse(); }               // round it one way or the other
  // the line goes where the road is straightest, a little more so just ahead of it
  const n = tr.n, bend = []; for (let i = 0; i < n; i++) bend.push(1 / rallyRadius(tr, i));
  let at = 0, low = Infinity;
  for (let i = 0; i < n; i += 2) { let s = 0; for (let j = -10; j <= 18; j += 2) s += bend[(i + j + n) % n]; if (s < low) { low = s; at = i; } }
  tr = { n, x: tr.x.slice(at).concat(tr.x.slice(0, at)), y: tr.y.slice(at).concat(tr.y.slice(0, at)), len: tr.len, half: c.half, key };
  if (TRACKS.size >= 40) TRACKS.delete(TRACKS.keys().next().value);
  TRACKS.set(key, tr);
  return tr;
}

// ---- the drive ----
export const rallySteps = (c, tr) => Math.ceil(RALLY.over * tr.len / c.speed * RALLY.hz);
export const rallyLogOk = (log, steps) => Array.isArray(log) && log.length <= RALLY.maxLog && Number.isInteger(steps) && steps >= 0 && steps <= 100000 && log.every((e, i) => Array.isArray(e) && e.length === 2 && Number.isInteger(e[0]) && e[0] >= 0 && (i === 0 || e[0] > log[i - 1][0]) && Number.isInteger(e[1]) && e[1] >= -RALLY.lock && e[1] <= RALLY.lock);
// The car on the line, pointing down the road: { x, y, hx, hy (its heading, a unit vector), i (the centre line's
// point nearest it), cum (points passed, in order: a lap is all of them), k (steps driven), end }.
export function rallyStart(tr) {
  const n = tr.n, dx = tr.x[1] - tr.x[n - 1], dy = tr.y[1] - tr.y[n - 1], d = Math.sqrt(dx * dx + dy * dy);
  return { x: tr.x[0], y: tr.y[0], hx: dx / d, hy: dy / d, i: 0, cum: 0, k: 0, end: null };
}
// One step with the wheel at `w`: the heading turns, the car moves on, its place along the road is found again (only
// ever a little on from where it was: a car that cut across to another stretch has left the road) and judged.
export function rallyStep(c, tr, S, w) {
  const r = c.rot[w + RALLY.lock], hx = S.hx * r[1] - S.hy * r[0], hy = S.hx * r[0] + S.hy * r[1], d = Math.sqrt(hx * hx + hy * hy), n = tr.n;
  S.hx = hx / d; S.hy = hy / d; S.x += S.hx * c.v; S.y += S.hy * c.v; S.k++;
  let best = 0, bd = Infinity;
  for (let j = -c.back; j <= c.fwd; j++) { const q = ((S.i + j) % n + n) % n, ex = tr.x[q] - S.x, ey = tr.y[q] - S.y, dd = ex * ex + ey * ey; if (dd < bd) { bd = dd; best = j; } }
  S.i = ((S.i + best) % n + n) % n; S.cum += best;
  if (bd > c.lim * c.lim) S.end = 'crash'; else if (S.cum >= n) S.end = 'lap';
  return S.end;
}
export const rallyPct = (tr, S) => clamp(Math.round(100 * S.cum / tr.n), 0, S.end === 'lap' ? 100 : 99);
// The attempt driven from its steering: { done, crash, step, pct, x, y, hx, hy }. `pick(S, w)` turns the wheel in
// place of a log (the computer's hand).
export function rallyRun(c, tr, log, steps, pick) {
  const S = rallyStart(tr), max = Math.min(steps == null ? Infinity : steps, rallySteps(c, tr));
  let w = 0, li = 0;
  while (S.k < max && !S.end) {
    if (pick) w = pick(S, w); else while (li < log.length && log[li][0] <= S.k) w = log[li++][1];
    rallyStep(c, tr, S, w);
  }
  return { done: S.end === 'lap', crash: S.end === 'crash', step: S.k, pct: rallyPct(tr, S), x: S.x, y: S.y, hx: S.hx, hy: S.hy };
}
export function apply(mini, p, m, rng, idx) {
  if (mini.v !== 2) return { ok: false, reason: 'stale' };
  if (!m || typeof m !== 'object' || !rallyLogOk(m.log, m.steps)) return { ok: false, reason: 'bad' };
  const c = rallyCfg(mini), run = rallyRun(c, rallyTrack(mini), m.log, m.steps), from = mini.laps[p], q = v => Math.round(v * 100) / 100 + 0;
  if (run.done) mini.laps[p]++;
  mini.n[p]++;
  mini.last = { by: p, done: run.done, crash: run.crash, pct: run.pct, from, to: mini.laps[p], at: [q(run.x), q(run.y), q(run.hx), q(run.hy)] };
  if (mini.laps[p] >= c.laps) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: run.done ? 'lap' : 'crash' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
// A hand on the wheel (the computer's, the tests'): it steers for a point of the centre line a little ahead (the
// turn that would carry the car through it), turning the wheel no faster than a hand does (`RALLY`-notches a step);
// `lapse` times a second on average it stops paying attention for a while and the wheel stays where it was.
export function rallyDrive(c, tr, rng, lapse) {
  const log = [], n = tr.n, L = RALLY.lock; let held = 0, last = 0;
  const run = rallyRun(c, tr, null, null, (S, w) => {
    let to = w;
    if (held > 0) held--; else if (rng() < lapse / RALLY.hz) held = 18 + Math.floor(rng() * 30);
    else {
      const q = (S.i + c.look) % n, dx = tr.x[q] - S.x, dy = tr.y[q] - S.y, want = Math.round(clamp(2 * (S.hx * dy - S.hy * dx) / (dx * dx + dy * dy) * c.speed / c.turn, -1, 1) * L) + 0;
      to = w + clamp(want - w, -2, 2);
    }
    if (to !== last) { log.push([S.k, to]); last = to; }
    return to;
  });
  return { log, steps: run.step, run };
}
export function randomMove(mini, p, rng, from, empties) { const c = rallyCfg(mini), d = rallyDrive(c, rallyTrack(mini), needRng(rng), 1.5); return { log: d.log, steps: d.steps }; }
// The flash carries the steering too: the other phone drives the attempt again from it and shows the car go round.
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.rr = mini.last ? Object.assign(JSON.parse(JSON.stringify(mini.last)), { log: m && Array.isArray(m.log) ? m.log.map(e => [e[0], e[1]]) : [], steps: (m && m.steps) || 0 }) : null; }
export const rallyShowMs = f => RALLY.pre + Math.round(((f && f.steps) || 0) * 1000 / RALLY.hz) + RALLY.end;   // someone else's attempt: the wait, the drive at its own speed, its ending
export function flashMs(f, winLen, won) { return f.rr ? rallyShowMs(f.rr) + RALLY.hold + (won ? 500 : 0) : 0; }
