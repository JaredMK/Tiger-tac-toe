// Bullseye: the computer's play.
import { BULLS, bullsAimAt, bullsScore } from './rules.js';
import { tune } from '../../core/tune.js';

const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// The computer's hand: it aims at the bullseye and lands off it by its error (aiErr: the admin's, wall units either
// way) on top of the square's scatter. Easy is a third looser, Hard four fifths as loose (sharper still, and Hard against Hard goes to the first mover too often: tests/sim/bullseye.sim.js).
export const bullsErr = (t, level) => t.aiErr * (level === 'easy' ? 1.35 : level === 'hard' ? 0.8 : 1);
// What such a throw scores: the chance of each number of points, by a fixed set of sample darts (the same every
// time: no rng, no clock), kept per board and hand.
const ODDS = new Map();
export function bullsOdds(cfg, t, err) {
  const key = [cfg.board, cfg.mid, cfg.bull, t.spread, t.bullPts, err].join(), had = ODDS.get(key);
  if (had) return had;
  let s = 12345;
  const rng = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296, sig = Math.hypot(err, t.spread), N = 600, p = {};
  let ev = 0;
  for (let k = 0; k < N; k++) { const pts = bullsScore(cfg, BULLS.at[0] + gauss(rng) * sig, BULLS.at[1] + gauss(rng) * sig, t.bullPts).pts; p[pts] = (p[pts] || 0) + 1 / N; ev += pts / N; }
  const out = { p, ev };
  if (ODDS.size > 60) ODDS.clear();
  ODDS.set(key, out);
  return out;
}
export function needs(pm, p) {
  const t = tune(pm), o = bullsOdds(pm.cfg, t, bullsErr(t, 'normal'));
  return Math.max(1, Math.ceil((t.goal - pm.pts[p]) / Math.max(0.2, o.ev) - 0.25));
}
export function best(pm, me, rng, style, ctx) {   // at the bullseye, off by its error; q: the chance this dart takes the square
  const t = tune(pm), level = ctx && ctx.level, err = bullsErr(t, level), o = bullsOdds(pm.cfg, t, err), need = t.goal - pm.pts[me];
  let q = 0;
  for (const k of Object.keys(o.p)) if (Number(k) >= need) q += o.p[k];
  return { move: bullsAimAt(BULLS.at[0] + gauss(rng) * err, BULLS.at[1] + gauss(rng) * err), q: Math.min(0.95, q) };
}
