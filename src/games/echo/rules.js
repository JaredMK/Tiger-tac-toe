// Echo: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

// Echo: four pads; each player has their own four patterns, of 4, 8, 11 and 14 steps, drawn when the
// square is dealt and never redrawn (a pattern failed plays again next attempt). A move is one attempt:
// the pads tapped back, in order; 'auto' (a timeout) is a failed attempt.
// One 10-step pattern per square, the same for both players: each level is its first 4, 6, 8 or 10 steps.
// (A square dealt before that keeps a pattern of its own for each player: seqs.)
export const ECHO = { pads: 4, lengths: [4, 6, 8, 10], step: 450, flash: 300, gap: 500, tap: 360, aiPass: [0.95, 0.85, 0.7, 0.55] };   // a step every 450 ms, its pad lit 300 ms of it (a repeat flashes twice)
export const echoSeqs = rng => ECHO.lengths.map(n => Array.from({ length: n }, () => randInt(rng, ECHO.pads)));
// The four lengths (the admin's settings: the first pattern's steps and the steps added each pattern; 4 and 2: ECHO's).
export const echoLens = t => ECHO.lengths.map((n, k) => (t && t.start ? t.start + k * t.add : n));
export const echoBase = (rng, lens = ECHO.lengths) => Array.from({ length: lens[lens.length - 1] }, () => randInt(rng, ECHO.pads));
export function echoSeq(mini, p, lvl) {
  const l = Math.min(lvl, ECHO.lengths.length - 1);
  return mini.base ? mini.base.slice(0, echoLens(tune(mini))[l]) : ((mini.seqs && mini.seqs[p] && mini.seqs[p][l]) || []).slice();
}
export function create(type, rng) {
  return { type, level: { X: 0, O: 0 }, base: echoBase(needRng(rng), echoLens(tuneLive(type))), last: null };
}
export function apply(mini, p, m, rng, idx) {
  const lvl = mini.level[p];
  if (lvl >= ECHO.lengths.length) return { ok: false, reason: 'done' };
  const seq = echoSeq(mini, p, lvl);
  let taps;
  if (m === 'auto') taps = [];
  else if (Array.isArray(m) && m.length <= seq.length && m.every(k => Number.isInteger(k) && k >= 0 && k < ECHO.pads)) taps = m.slice();
  else return { ok: false, reason: 'bad' };
  let failAt = -1;
  for (let k = 0; k < seq.length; k++) if (taps[k] !== seq[k]) { failAt = k; break; }
  const pass = failAt < 0;
  if (pass) mini.level[p] += 1;
  mini.last = { by: p, level: lvl, taps, pass, failAt, len: seq.length, seq };
  if (mini.level[p] >= ECHO.lengths.length) return { ok: true, outcome: 'win', note: 'pass' };
  return { ok: true, outcome: 'continue', note: pass ? 'pass' : 'fail' };
}
export function publicView(mini) {
  return { type: 'echo', level: { X: mini.level.X, O: mini.level.O } };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                                        // a failed attempt
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last, st = tune(mini).step; flash.echo = { level: l.level, len: l.len, pass: l.pass, failAt: l.failAt, taps: l.taps.slice(), seq: (l.seq || []).slice(), levels: { X: mini.level.X, O: mini.level.O } };
  if (st && st !== ECHO.step) flash.echo.step = st;                // (the admin's settings: the pattern's pace, for the replay)
  return;
}
export function flashMs(f, winLen, won) {
  return (f.echo && !f.timeout ? echoAim(f.echo).end : 0) + ECHO.result + (won ? 600 : 0);   // (the phone that tapped skips the replay: it has just played it)
}
ECHO.result = 650;
// Echo: someone else's attempt, as their screen showed it: the pattern step by step, a beat, then their taps
// one by one (up to the slip); then the result. ms from the move: tap(k) when tap k lands, end when the result shows.
export function echoAim(e) {
  const S = e.step || ECHO.step, n = (e.seq || []).length, t0 = n * S + ECHO.gap, k = (e.taps || []).length;
  return { play: n * S, t0, tap: i => t0 + i * ECHO.tap, end: k ? t0 + (k - 1) * ECHO.tap + ECHO.gap : n ? n * S : 0 };
}
