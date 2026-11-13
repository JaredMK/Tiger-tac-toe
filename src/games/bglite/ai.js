// Backgammon Lite: the computer's play.
import { makeRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { BGL, bglDice, bglOther, bglPips, bglPlayable, bglPoint, bglRollDice, bglStep } from './rules.js';

// A turn is planned whole: every order of the dice and every piece for each (bglPlans), each plan valued, and the
// best one played as the turn's one move ({ steps: [[d, k], ...] }: rules.js bglTurn).
// The value of a position for `me` (static): the race (the other side's points still to travel less mine: a hit is
// worth all the progress it sends back), less the risk of each lone piece of mine (the chance the other side can land
// on it next roll, from where its pieces stand, times what it would cost: the piece's progress and aiBlot), plus
// aiBlock for each point of mine holding 2 or more in front of the other side's pieces, plus aiHit for a hit made in
// the plan. A plan that bears the last piece off wins outright.
// Normal: the plan with the best static value. Hard: by expected value: each plan played out to the end of the square
// many times (BGL_AI.rollouts, every plan against the same dice) with both sides choosing by the static value, and the
// plan that wins most often taken (race against hitting, safety and blocks weighed by what they lead to); within
// ctx.until (at least minRollouts). Easy: any plan. A mistake (the `miss` setting): a random plan.
export const BGL_AI = { win: 1000, rollouts: 60, minRollouts: 6 };   // Hard: the rollouts per plan (fewer when its time runs out, never under minRollouts)
const ROLLS = (() => { const r = []; for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) r.push({ v: [a, b], w: (a === b ? 1 : 2) / 36 }); return r; })();
// The chance, in 36, that a roll lets a piece travel exactly t points (a die of t, or both dice summed; blocks ignored).
const SHOT = (() => { const s = new Array(25).fill(0); for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let t = 1; t <= 24; t++) if (a === t || b === t || a + b === t || (a === b && (3 * a === t || 4 * a === t))) s[t] += 1 / 36; return s; })();   // (a double: three and four of it too)
const lite = mini => ({ type: 'bglite', v: mini.v, tune: mini.tune, n: mini.n, rolled: true, pos: { X: mini.pos.X.slice(), O: mini.pos.O.slice() }, dice: mini.dice ? { by: mini.dice.by, v: mini.dice.v.slice(), used: mini.dice.used.slice(), off: mini.dice.off || 0 } : null });
// Every way p could play the dice left from here: [{ steps: [{ d, k }], end, hits }], each step one die.
export function bglPlans(mini, p) {
  const out = [];
  const walk = (m, steps, hits) => {
    const ms = bglPlayable(m, p);   // (the same engine as the server's: the dice used as fully as they can be)
    if (!ms.length || m.pos[p].every(a => a > m.n)) { out.push({ steps, end: m, hits }); return; }
    for (const s of ms) { const c = lite(m), r = bglStep(c, p, s.d, s.k); walk(c, steps.concat([s]), hits + (r.hit ? 1 : 0)); }
  };
  walk(lite(mini), [], 0);
  return out;
}
export function bglValue(m, me, c) {
  const o = bglOther(me), n = m.n;
  if (m.pos[me].every(a => a > n)) return BGL_AI.win;
  if (m.pos[o].every(a => a > n)) return -BGL_AI.win;
  let v = bglPips(m, o) - bglPips(m, me);
  const at = (q, b) => m.pos[q].filter(a => a >= 1 && a <= n && bglPoint(q, a, n) === b).length;
  for (let b = 1; b <= n; b++) {
    const mine = at(me, b);
    if (!mine) continue;
    const tO = bglPoint(o, b, n);                                   // (where an enemy piece would land, in its own count)
    if (mine === 1) {
      let miss = 1;
      const a = bglPoint(me, b, n);
      if (a === 1 && (m.v || 1) >= 2) continue;                       // (a lone piece on its own start point is never hit)
      for (const e of new Set(m.pos[o])) { const d = tO - e; if (d >= 1 && d <= 24) miss *= 1 - SHOT[d]; }   // (each enemy piece behind it: its chance of a shot)
      v -= (1 - miss) * (a - ((m.v || 1) >= 2 ? 1 : 0) + c.aiBlot);
    } else if (m.pos[o].some(a => a < tO)) v += c.aiBlock;
  }
  return v;
}
const cfgOf = pm => { const t = tune(pm); return { aiHit: t.aiHit != null ? t.aiHit : 6, aiBlot: t.aiBlot != null ? t.aiBlot : 4, aiBlock: t.aiBlock != null ? t.aiBlock : 2 }; };
const staticOf = (pl, me, c) => bglValue(pl.end, me, c) + c.aiHit * pl.hits;
// A game played out from a position, the other side to roll, both sides by the static choice: 1 if `me` wins.
function rollout(start, me, c, r) {
  const m = lite(start);
  let p = bglOther(me);
  for (let t = 0; t < 200; t++) {
    const v = bglRollDice(m, 1 + randInt(r, 6), 1 + randInt(r, 6));
    m.dice = { by: p, v, used: v.map(() => false), off: 0 };
    let bestP = null, bs = -Infinity;
    for (const pl of bglPlans(m, p)) { const s = staticOf(pl, p, c); if (s > bs) { bs = s; bestP = pl; } }
    if (bestP && bestP.steps.length) { m.pos = bestP.end.pos; }
    m.dice = null;
    if (m.pos[p].every(a => a > m.n)) return p === me ? 1 : 0;
    p = bglOther(p);
  }
  return 0.5;
}
export function bglChoose(pm, me, rng, level, until) {
  const plans = bglPlans(pm, me), c = cfgOf(pm);
  if (!plans.length || !plans[0].steps.length) return null;
  if (level === 'easy') return plans[randInt(rng, plans.length)];
  let scored = plans.map(pl => ({ pl, s: staticOf(pl, me, c) }));
  if (level === 'hard' && scored.length > 1) {
    const stop = typeof until === 'function' ? () => until() <= 0 : () => false;
    scored.sort((a, b) => b.s - a.s);
    const seed = 'bglr:' + Math.floor(rng() * 1e9), wins = scored.map(() => 0);
    let k = 0;
    for (; k < BGL_AI.rollouts; k++) {                             // round by round, every plan the same dice (seed + k): the comparison is fair
      if (k >= BGL_AI.minRollouts && stop()) break;
      scored.forEach((x, i) => { wins[i] += rollout(x.pl.end, me, c, makeRng(seed + ':' + k)); });
    }
    scored = scored.map((x, i) => ({ pl: x.pl, s: wins[i] / Math.max(1, k) + x.s * 1e-6 }));   // (its static value breaks a tie)
  }
  let top = -Infinity; for (const x of scored) top = Math.max(top, x.s);
  const best = scored.filter(x => x.s >= top - 1e-9);
  return best[randInt(rng, best.length)].pl;
}
// The turns p still needs, about: the points still to travel over what a turn gets done (7 on average, less the waste of
// a die past the end, the odd lost die and the hits taken: 5.5, from tests/sim/bglite.sim.js), at least 1.
export const BGL_PACE = 5.5;
export const needs = (pm, p) => Math.max(1, bglPips(pm, p) / BGL_PACE);
// The chance a roll now ends the square for me (every piece off this turn).
function rollWins(pm, me) {
  let q = 0;
  for (const r of ROLLS) { const m = lite(pm), v = bglRollDice(m, r.v[0], r.v[1]); m.dice = { by: me, v, used: v.map(() => false), off: 0 }; if (bglPlans(m, me).some(pl => pl.end.pos[me].every(a => a > m.n))) q += r.w; }
  return q;
}
export function best(pm, me, rng, style, ctx) {
  const level = ctx && ctx.level ? ctx.level : 'normal';
  if (!bglDice(pm, me)) return { move: 'roll', q: Math.min(1, rollWins(pm, me)) };
  const miss = tune(pm).miss;
  const whole = pl => ({ move: { steps: pl.steps.map(s => [s.d, s.k]) }, q: pl.end.pos[me].every(a => a > pl.end.n) ? 1 : 0 });
  if (miss && rng() * 100 < miss) { const ps = bglPlans(pm, me).filter(pl => pl.steps.length); if (ps.length) return Object.assign(whole(ps[randInt(rng, ps.length)]), { q: 0 }); }
  const pl = bglChoose(pm, me, rng, level, ctx && ctx.until);
  if (!pl) return { move: 'roll', q: 0 };
  return whole(pl);
}
export { BGL };
