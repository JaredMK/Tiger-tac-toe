// Bowling: the computer's play.
import { physAi } from '../shared/physics.js';
import { BOWLG, bowlTarget } from './rules.js';

const RATE = 8;   // the pins the computer reckons on a roll (tests/sim/bowling.sim.js: about 8.4 for it)
// The rolls p still needs, about: one for a roll that settles the square (an answer to a finished game, or the
// leader's roll that takes a square left unanswered: rules.js `final`), else the pins left over what a roll brings.
export function needs(pm, p) {
  if (pm.final) return 1;
  return Math.max(1, (bowlTarget(pm) - pm.pins[p]) / RATE);
}
// The chance of at least n pins on one roll, about, for the computer's own hand (tests/sim/bowling.sim.js).
const AT_LEAST = [1, 0.99, 0.98, 0.97, 0.96, 0.94, 0.9, 0.84, 0.66, 0.5, 0.26];
export function best(pm, me, rng, style, ctx) {
  const r = physAi(pm, me, rng), f = pm.final, left = bowlTarget(pm) - pm.pins[me];
  if (f && f.by === me) return { move: r.move, q: 1 };                                           // any roll takes it
  if (f) { const need = pm.pins[f.by] - pm.pins[me] + 1; return { move: r.move, q: need > BOWLG.rack ? 0 : AT_LEAST[Math.max(0, need)] * 0.9 }; }   // the answer: more than the leader's total
  return { move: r.move, q: left > BOWLG.rack ? 0.02 : AT_LEAST[Math.max(0, left)] * 0.8 };   // the roll that reaches the target (it may yet be answered)
}
