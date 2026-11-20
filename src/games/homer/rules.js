// Home Run Heroes: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own count of home runs. A move is one at-bat: `pitches` pitches, each in the air for its own time
// (drawn per pitch between the fastest and the slowest from the square's public seed, the player and the at-bat's
// number: `homerPitches`, so every phone shows the same pitches); the player taps to swing, and the move is the swings,
// `{ s: [ms from the perfect moment, or null for no swing] }`. Within `hrMs` either side of perfect is a home run,
// within `hitMs` a hit (it counts for nothing), anything else a miss. The first to `goal` home runs takes the square;
// the at-bat stops on the home run that does. The server takes the phone's moments as said (as it takes Bullseye's
// stops: it cannot time a tap), so the game is held out of Find Match (core/games.js FIND_MATCH_HOLD).
import { makeRng, needRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export const HOMER = { wind: 700, show: 760, late: 320, swing: 150, early: 0.35, max: 2500 };   // ms: the wind-up before a pitch, a result on show, how long after the plate a swing still counts, a swing's length; the part of the wind-up a tap is ignored in; the furthest a swing may be from perfect
export function homerCfg(mini) {
  const t = tune(mini), fast = Math.min(t.fastMs, t.slowMs), slow = Math.max(t.fastMs, t.slowMs);
  return { goal: t.goal, pitches: t.pitches, fast, slow, hr: t.hrMs, hit: Math.max(t.hrMs, t.hitMs), ai: { easy: t.aiMsEasy, normal: t.aiMs, hard: t.aiMsHard } };
}
export function create(type, rng) { return { type, seed: randInt(needRng(rng), 1e9), hr: { X: 0, O: 0 }, ab: { X: 0, O: 0 }, last: null }; }
// The pitches of p's next at-bat (or of at-bat n): each { f: ms in the air, x: where it crosses the plate, -1 to 1 }.
export function homerPitches(mini, p, n) {
  const c = homerCfg(mini), r = makeRng(`homer:${mini.seed}:${p}:${n == null ? mini.ab[p] : n}`);
  return Array.from({ length: c.pitches }, () => ({ f: Math.round(c.fast + r() * (c.slow - c.fast)), x: Math.round((r() * 2 - 1) * 100) / 100 }));
}
// An at-bat's timeline from its pitches: for each, when it starts (the wind-up), when it is thrown, when it crosses
// the plate (the perfect moment) and when the next begins; `end` the whole at-bat.
export function homerPlan(pitches) {
  let t = 0; const at = pitches.map(q => { const o = { s: t, go: t + HOMER.wind, c: t + HOMER.wind + q.f, e: t + HOMER.wind + q.f + HOMER.show }; t = o.e; return o; });
  return { at, end: t };
}
export const homerJudge = (c, dt) => (dt == null ? 'take' : Math.abs(dt) <= c.hr ? 'hr' : Math.abs(dt) <= c.hit ? 'hit' : 'miss');
export function apply(mini, p, m, rng, idx) {
  const c = homerCfg(mini);
  if (!m || typeof m !== 'object' || !Array.isArray(m.s) || m.s.length > c.pitches) return { ok: false, reason: 'bad' };
  if (!m.s.every(v => v === null || (Number.isInteger(v) && Math.abs(v) <= HOMER.max))) return { ok: false, reason: 'bad' };
  const from = mini.hr[p], s = [], res = [];
  for (let i = 0; i < c.pitches && mini.hr[p] < c.goal; i++) {
    const dt = i < m.s.length ? m.s[i] : null, r = homerJudge(c, dt);
    s.push(dt); res.push(r);
    if (r === 'hr') mini.hr[p]++;
  }
  mini.last = { by: p, n: mini.ab[p], s, res, from, to: mini.hr[p] };
  mini.ab[p]++;
  if (mini.hr[p] >= c.goal) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: mini.hr[p] > from ? 'hr' : 'out' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) {
  return { type: 'homer', seed: mini.seed, hr: { X: mini.hr.X, O: mini.hr.O }, ab: { X: mini.ab.X, O: mini.ab.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in: swings up to a tenth of a second off)
  const c = homerCfg(mini); return { s: Array.from({ length: c.pitches }, () => Math.round((needRng(rng)() * 2 - 1) * 100)) };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.hr = JSON.parse(JSON.stringify(mini.last)); flash.hr.pitches = homerPitches(mini, p, mini.last.n).slice(0, mini.last.s.length); }
// The at-bat as played (its pitches up to the last one thrown), then a moment on its result.
export function flashMs(f, winLen, won) { return (f.hr ? homerPlan(f.hr.pitches).end : 0) + 300 + (won ? 500 : 0); }
