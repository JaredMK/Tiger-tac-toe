// Fruit Reels: the computer's play. There is nothing to choose (a spin is a spin), so every level spins; `needs` is the
// points still needed over a spin's worth, counted exactly from the weights (each line's chance of three alike).
import { LINES, reelsCfg } from './rules.js';

export function spinWorth(c) {   // { ev: points a spin is worth on average, win: the chance a spin wins outright (a line of stars) }
  const sum = c.w[0] + c.w[1] + c.w[2] + c.w[3], p = c.w.map(x => x / sum);
  const line3 = p.map(x => x * x * x), ev = LINES.length * line3.reduce((x, q, k) => x + q * (k === 3 && c.stars ? 0 : c.tri[k]), 0);
  return { ev, win: c.stars ? 1 - Math.pow(1 - line3[3], LINES.length) : 0 };
}
export function needs(pm, p) {
  const c = reelsCfg(pm), need = c.target - pm.score[p];
  if (need <= 0) return 0;
  const { ev } = spinWorth(c);
  return Math.max(1, need / Math.max(0.2, ev));
}
export function best(pm, me, rng, style, ctx) { const c = reelsCfg(pm); return { move: 'spin', q: spinWorth(c).win }; }
