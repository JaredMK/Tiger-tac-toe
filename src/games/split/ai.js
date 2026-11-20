// Shape Split: the computer's play. It picks a direction for its line at random and aims for half and half, off by an
// error of its level's size (points of a percent of the shape, a normal spread: `aiErr` 6 at Normal, 3 at Hard, 10 at
// Easy): the line that leaves 50% plus that error on one side (rules.js splitAim).
import { gaussOf } from '../../core/random.js';
import { splitAim, splitCfg, splitShape } from './rules.js';

const inBand = (w, sd) => { const x = w / (sd * Math.SQRT2), t = 1 / (1 + 0.3275911 * x); return 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); };
// What a cut is worth on average at an error of sd, and the chance it makes `need` points or more.
function worth(c, sd) { let ev = 0, prev = 0; for (const [w, pts] of c.bands) { const pr = inBand(w, sd); ev += (pr - prev) * pts; prev = pr; } return ev; }
function reach(c, sd, need) { let pr = 0, prev = 0; for (const [w, pts] of c.bands) { const x = inBand(w, sd); if (pts >= need) pr += x - prev; prev = x; } return pr; }
export function needs(pm, p) { const c = splitCfg(pm), left = c.target - pm.score[p]; return left <= 0 ? 0 : Math.max(1, left / Math.max(0.2, worth(c, c.ai.normal))); }
export function best(pm, me, rng, style, ctx) {
  const c = splitCfg(pm), level = (ctx && ctx.level) || 'normal', sd = c.ai[level] || c.ai.normal;
  const share = Math.max(0.08, Math.min(0.92, 0.5 + gaussOf(rng) * sd / 100));
  return { move: splitAim(splitShape(pm, me), rng() * Math.PI, share), q: reach(c, sd, c.target - pm.score[me]) };
}
