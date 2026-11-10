// Trivia: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { TRIVIA, triviaCrossed } from './rules.js';

// Race mode (core/race.js, `rv: 2`): the computer plays its own questions: its own cross-outs, its own score to the goal.
// It knows its own question's answer as in Shared (publicMini's `answer`, the right place of the side it plays for;
// else, where the view has none, from the question bank by the question's id), and plays to the same rate.
const optsOf = pm => {
  if (pm.race) { const a = pm.side && (pm.side.X || pm.side.O); const n = a && a.ask ? (Array.isArray(a.ask.opts) ? a.ask.opts.length : a.ask.n) : 0; if (n) return n; }
  return pm.ask && Number.isInteger(pm.ask.opts) ? pm.ask.opts : tune(pm).opts;
};
const askOf = (pm, p) => (pm.side && pm.side[p] && pm.side[p].ask) || null;
// Expected moves to answer a question with `left` options standing, right this often on a free pick (`know`), else a
// guess among those standing; never one already crossed out.
function oneQ(know, left) {
  let e = 0, reach = 1;
  for (let l = Math.max(1, left); l >= 1; l--) {
    const r = l <= 1 ? 1 : know + (1 - know) / l;
    e += reach * r * (left - l + 1); reach *= 1 - r;
    if (reach <= 0) break;
  }
  return e;
}
export function needs(pm, p) {
  const t = tune(pm);
  if (pm.race) {                                                 // its own ladder: what is left of this question, then a whole question for each point still to go
    const know = t.know / 100, n = optsOf(pm), left = Math.max(1, n - triviaCrossed(pm, p).length), to = Math.max(0, t.goal - (pm.right[p] || 0));
    return to ? Math.max(1, oneQ(know, left) + (to - 1) * oneQ(know, n)) : 0;
  }
  const r = t.know === 53 && t.opts === TRIVIA.options ? TRIVIA.aiRight : t.know / 100 + (1 - t.know / 100) / t.opts;   // (its settings, TUNE: the right rate they make)
  return Math.max(1, (t.goal - pm.right[p]) / r);
}
// The right place of its own race question: the view's (its own side's), else the bank's (the question's own answer).
function raceRight(pm, me) {
  if (Number.isInteger(pm.answer)) return pm.answer;
  const a = askOf(pm, me), bank = TRIVIA.bank;
  if (!a || !a.id || !Array.isArray(a.opts) || !bank) return null;
  const q = bank.questions.find(x => x.id === a.id);
  const k = q ? a.opts.indexOf(q.a) : -1;
  return k >= 0 ? k : null;
}
export function best(pm, me, rng, style, ctx) {   // it knows it about half the time, else guesses among the options still standing (never one crossed out; a race: on its own question)
  const t = tune(pm), know = t.know / 100, n = pm.race ? ((a => (a && Array.isArray(a.opts) ? a.opts.length : a && a.n) || optsOf(pm))(askOf(pm, me))) : optsOf(pm), crossed = pm.race ? triviaCrossed(pm, me) : pm.crossed || [];
  const right = pm.race ? raceRight(pm, me) : pm.answer;
  const left = Array.from({ length: n }, (_, k) => k).filter(k => !crossed.includes(k));
  if (!Number.isInteger(right)) {                                // (its answer unknown here: a guess among those standing)
    if (!pm.race || !left.length) return { move: 'auto', q: 0 };
    return { move: left[randInt(rng, left.length)], q: (pm.right[me] || 0) >= t.goal - 1 ? 1 / left.length : 0 };
  }
  const hard = ctx && ctx.level === 'hard', last = (pm.right[me] || 0) >= t.goal - 1;
  const rate = know + (1 - know) / Math.max(1, left.length), q = (!pm.race && !hard) || last ? rate : 0;   // (q: the chance this move takes the square: only the last point does; Easy and Normal on a shared question still report every right answer, as they always have)
  if (left.length <= 1 || rng() < know) return { move: right, q };
  return { move: left[randInt(rng, left.length)], q };
}
