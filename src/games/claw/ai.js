// Claw Machine: the computer's play. It aims at a prize with a hand of its own (an aim error by its level: `aiAim`,
// `aiAimHard`, `aiAimEasy`, case units); Hard picks the prize it is likeliest to win (the grip and the slip weighed over
// its own aim error), Normal the widest prize (the easiest to land on), Easy any prize.
import { randInt } from '../../core/random.js';
import { goAgain } from '../../core/tune.js';
import { CLAW, clawCfg, clawTarget, clawWin } from './rules.js';

const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// Gauss-Hermite-like fixed points (weights of a normal): the chance of winning a prize aimed at its centre with error sd.
const NODES = [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4], WTS = NODES.map(z => Math.exp(-z * z / 2)), WSUM = WTS.reduce((a, b) => a + b, 0);
export function clawOdds(cs, i, sd, c) {
  let s = 0;
  for (let k = 0; k < NODES.length; k++) {
    const x = cs[i].x + NODES[k] * sd, tg = clawTarget(cs, x);
    if (tg) s += WTS[k] * clawWin(c, tg.u, cs[tg.i].k);
  }
  return s / WSUM;
}
export const clawSd = (c, level) => (level === 'hard' ? c.aiAimHard : level === 'easy' ? c.aiAimEasy : c.aiAim);
export function clawPick(pm, me, rng, level) {
  const c = clawCfg(pm), cs = pm.case[me], sd = clawSd(c, level);
  if (!cs.length) return { i: -1, q: 0 };
  if (level === 'easy') { const i = randInt(rng, cs.length); return { i, q: clawOdds(cs, i, sd, c) }; }
  let best = 0, bv = -1;
  cs.forEach((p, i) => { const v = level === 'hard' ? clawOdds(cs, i, sd, c) : p.w + rng() * 0.01; if (v > bv) { bv = v; best = i; } });
  return { i: best, q: clawOdds(cs, best, sd, c) };
}
// The turns p still needs: the prizes left to win over the chance a grab wins one (Normal's hand on its best prize).
export function needs(pm, p) {
  const c = clawCfg(pm), k = Math.max(0, c.goal - pm.won[p]);
  if (!k) return 1;
  const cs = pm.case[p], sd = c.aiAim;
  const q = cs.length ? Math.max(0.05, Math.max(...cs.map((_, i) => clawOdds(cs, i, sd, c)))) : 0.5;
  return Math.max(1, goAgain(pm) ? 1 + (k - q) * (1 - q) / q : k / q);
}
export function best(pm, me, rng, style, ctx) {
  const level = ctx && ctx.level ? ctx.level : 'normal', c = clawCfg(pm), pk = clawPick(pm, me, rng, level), cs = pm.case[me];
  const aim = pk.i >= 0 ? cs[pk.i].x : (CLAW.lo + CLAW.hi) / 2;
  const x = Math.round(Math.max(0, Math.min(CLAW.W, aim + gauss(rng) * clawSd(c, level))) * 10) / 10;
  const k = Math.max(1, c.goal - pm.won[me]);
  return { move: { x }, q: k <= 1 ? pk.q : goAgain(pm) ? pk.q ** k : 0 };   // q: the chance this turn takes the square
}
