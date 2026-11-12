// Bowling: the computer's play. It rolls as a hand would: it picks a roll (an aim, a curve and a power), then stops
// each of the three sweeping meters at it, late or early by its timing error (TUNE aiMs, aiMsHard, aiMsEasy: ms on
// each tap), so where the meter stops is where its finger did. Its picks: every curve from a list, aimed by the hook's
// own law (rules.js bowlPath) so the ball comes into the pins at one of the pockets, at two powers, each played out in
// the real roll; Normal takes the best of them, Hard the best of the leaders over a dozen rolls with its own timing
// error (a roll that only strikes when it is perfect is not worth one that strikes on a near miss), Easy any of the
// better half.
import { gaussOf, makeRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { physRun } from '../shared/physics.js';
import { BOWLG, BOWL_PHASES, bowlMeter, bowlMeterU, bowlPath, bowlPeriods, bowlShot, bowlTarget } from './rules.js';

const RATE = 8;   // the pins the computer reckons on a roll (tests/sim/bowling.sim.js)
// The rolls p still needs, about: one for a roll that settles the square (an answer to a finished game, or the
// leader's roll that takes a square left unanswered: rules.js `final`), else the pins left over what a roll brings.
export function needs(pm, p) {
  if (pm.final) return 1;
  return Math.max(1, (bowlTarget(pm) - pm.pins[p]) / RATE);
}
// The chance of at least n pins on one roll, about, for the computer's own hand (tests/sim/bowling.sim.js).
const AT_LEAST = [1, 0.99, 0.98, 0.97, 0.96, 0.94, 0.9, 0.84, 0.66, 0.5, 0.26];

const CURVES = [-0.8, -0.5, -0.25, 0, 0.25, 0.5, 0.8], ENTRY = [47, 48.5, 51.5, 53], POWERS = [0.85, 1];
const hookOf = mini => { const h = tune(mini).hook; return Number.isFinite(h) ? h / 1000 : undefined; };
// Where a roll crosses the head pin's row (y 50), by the hook's law.
function entryX(aim, curve, hook) { const pts = bowlPath(aim, curve, hook); for (const [x, y] of pts) if (y <= 50) return x; return pts[pts.length - 1][0]; }
// The aim that brings a roll of this curve in at x on the head pin's row (bisection on the aim meter's range).
function aimFor(x, curve, hook) {
  let lo = -BOWLG.aimSweep, hi = BOWLG.aimSweep;
  for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (entryX(m, curve, hook) < x) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export function bowlCandidates(mini) {
  const hook = hookOf(mini), out = [];
  for (const curve of CURVES) for (const x of ENTRY) { const aim = aimFor(x, curve, hook); if (Math.abs(aim) < BOWLG.aimSweep - 0.002) for (const power of POWERS) out.push(bowlShot({ aim, curve, power })); }
  return out.filter(Boolean);
}
// The roll as the computer's finger stops the meters: each meter's place off by its timing error (a meter covers its
// whole range in half its period, so ms of lateness is 2 ms / period of the range).
export function bowlTimed(c, mini, ms, rng) {
  const per = bowlPeriods(tune(mini)), v = [c.aim, c.curve, c.power];
  const out = BOWL_PHASES.map((_, k) => bowlMeter(k, bowlMeterU(k, v[k]) + gaussOf(rng) * ms * 2 / per[k]));
  return bowlShot({ aim: out[0], curve: out[1], power: out[2] });
}
const pinsOf = (mini, p, c) => { const r = physRun(mini, p, c); return r ? r.result.knocked : 0; };
export function errMs(mini, level) { const t = tune(mini); return level === 'hard' ? t.aiMsHard : level === 'easy' ? t.aiMsEasy : t.aiMs; }
// The roll it means to make (before its timing error). Every roll is at a fresh rack, so what each pick does depends on
// the square's settings alone: worked out once for them and kept (PICKS). Hard: the leaders tried again with its own
// timing error, a dozen rolls each from a fixed seed, and the best on average kept.
const PICKS = new Map();
export function bowlPick(mini, p, rng, level) {
  const t = tune(mini), key = [t.vMax, t.hook, level === 'hard' ? [t.aiMsHard, t.aimMs, t.curveMs, t.powerMs].join() : ''].join('|');
  let o = PICKS.get(key);
  if (!o) {
    const tried = bowlCandidates(mini).map(c => ({ c, s: pinsOf(mini, p, c) })).sort((a, b) => b.s - a.s);
    if (!tried.length) tried.push({ c: bowlShot({ aim: 0, curve: 0, power: 0.85 }), s: 0 });
    o = { tried, hard: null };
    if (level === 'hard') {
      const ms = Math.max(10, errMs(mini, level) || 0), top = tried.slice(0, 6), r = makeRng('bowl-hard');
      for (const x of top) { let sum = 0; for (let k = 0; k < 12; k++) { const m = bowlTimed(x.c, mini, ms, r); sum += m ? pinsOf(mini, p, m) : 0; } x.sure = sum / 12; }
      o.hard = top.reduce((a, b) => (b.sure > a.sure ? b : a));
    }
    if (PICKS.size > 20) PICKS.clear();
    PICKS.set(key, o);
  }
  if (level === 'hard') return o.hard;
  if (level === 'easy') return o.tried[Math.floor(rng() * Math.max(1, Math.ceil(o.tried.length / 2)))];
  return o.tried[0];
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', pick = bowlPick(pm, me, rng, level);
  const move = bowlTimed(pick.c, pm, errMs(pm, level) || 0, rng) || pick.c, f = pm.final, left = bowlTarget(pm) - pm.pins[me];
  if (f && f.by === me) return { move, q: 1 };                                                   // any roll takes it
  if (f) { const need = pm.pins[f.by] - pm.pins[me] + 1; return { move, q: need > BOWLG.rack ? 0 : AT_LEAST[Math.max(0, need)] * 0.9 }; }   // the answer: more than the leader's total
  return { move, q: left > BOWLG.rack ? 0.02 : AT_LEAST[Math.max(0, left)] * 0.8 };   // the roll that reaches the target (it may yet be answered)
}
