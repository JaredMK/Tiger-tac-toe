// Heads or Tails: the computer's play. A fair coin: no call is better than the other, so every level calls at random.
import { headsCfg } from './rules.js';

export function needs(pm, p) { const left = headsCfg(pm).wins - pm.n[p]; return left <= 0 ? 0 : left * 2; }   // a right call every other turn
export function best(pm, me, rng, style, ctx) { return { move: rng() < 0.5 ? 'h' : 't', q: headsCfg(pm).wins - pm.n[me] === 1 ? 0.5 : 0 }; }
