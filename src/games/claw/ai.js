// Claw Machine: the computer's play. The claw sweeps by itself, so the computer's only choice is the moment to tap
// Drop, and its hand is a timing error (one standard deviation in ms, by level: `aiMs`, `aiMsHard`, `aiMsEasy`). It
// picks a prize, finds the moments in the next full sweep when the swinging claw passes over that prize's centre
// (after a reaction, CLAW_AI.react), and taps at one of them, late or early by its error. Hard weighs every prize and
// every such moment by the chance of winning it (the grip and the slip, over its own timing error), Normal goes for
// the widest prize at the first good moment, Easy any prize.
import { randInt } from '../../core/random.js';
import { goAgain } from '../../core/tune.js';
import { CLAW, clawCase, clawCfg, clawPath, clawTarget, clawWin } from './rules.js';

export const CLAW_AI = { react: 0.7, look: 2 };                    // s before its first chance; how many full sweeps it looks ahead
const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const NODES = [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4], WTS = NODES.map(z => Math.exp(-z * z / 2)), WSUM = WTS.reduce((a, b) => a + b, 0);
export const clawSd = (c, level) => (level === 'hard' ? c.aiMsHard : level === 'easy' ? c.aiMsEasy : c.aiMs);
const period = c => (2 * (CLAW.sweepHi - CLAW.sweepLo)) / Math.max(1, c.speed);
// The chance of winning with a tap aimed at step k, the hand late or early by sd ms.
export function clawOddsAt(c, ph, cs, k, sd) {
  const xs = clawPath(c, ph, k + Math.ceil(3 * sd * CLAW.hz / 1000) + 2);
  let s = 0;
  for (let j = 0; j < NODES.length; j++) {
    const kk = Math.max(0, k + Math.round(NODES[j] * sd * CLAW.hz / 1000)), tg = clawTarget(cs, xs[kk]);
    if (tg) s += WTS[j] * clawWin(c, tg.u, cs[tg.i].k);
  }
  return s / WSUM;
}
// The moments the claw passes over x (its path crossing x) between steps a and b.
function crossings(xs, x, a, b) {
  const out = [];
  for (let k = a + 1; k <= b; k++) if ((xs[k - 1] - x) * (xs[k] - x) <= 0) out.push(Math.abs(xs[k - 1] - x) < Math.abs(xs[k] - x) ? k - 1 : k);
  return out;
}
export function clawPlan(pm, rng, level) {
  const c = clawCfg(pm), cs = clawCase(pm), ph = pm.ph || 0, sd = clawSd(c, level);
  const a = Math.round(CLAW_AI.react * CLAW.hz), b = a + Math.round(CLAW_AI.look * period(c) * CLAW.hz), xs = clawPath(c, ph, b + 2);
  if (!cs.length) return { k: a, q: 0 };
  const order = level === 'easy' ? [randInt(rng, cs.length)] : level === 'hard' ? cs.map((_, i) => i) : [cs.reduce((bi, p, i) => (p.w > cs[bi].w ? i : bi), 0)];
  let best = null;
  for (const i of order) {
    const ks = crossings(xs, cs[i].x, a, b);
    if (!ks.length) continue;
    if (level !== 'hard') { const k = ks[0]; best = { k, q: clawOddsAt(c, ph, cs, k, sd) }; break; }
    for (const k of ks) { const q = clawOddsAt(c, ph, cs, k, sd); if (!best || q > best.q) best = { k, q }; }
  }
  return best || { k: a, q: 0 };
}
// The turns p still needs: the prizes left to win over the chance a grab wins one (Normal's hand).
export function needs(pm, p) {
  const c = clawCfg(pm), k = Math.max(0, c.goal - pm.won[p]);
  if (!k) return 1;
  const q = Math.max(0.05, clawPlan(pm, () => 0.5, 'normal').q || 0.3);
  return Math.max(1, goAgain(pm) ? 1 + (k - q) * (1 - q) / q : k / q);
}
export function best(pm, me, rng, style, ctx) {
  const level = ctx && ctx.level ? ctx.level : 'normal', c = clawCfg(pm), pl = clawPlan(pm, rng, level);
  const k = Math.max(0, Math.min(CLAW.kMax, pl.k + Math.round(gauss(rng) * clawSd(c, level) * CLAW.hz / 1000)));
  const need = Math.max(1, c.goal - pm.won[me]);
  return { move: { k }, q: need <= 1 ? pl.q : goAgain(pm) ? pl.q ** need : 0 };   // q: the chance this turn takes the square
}
