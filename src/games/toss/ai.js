// Bin Shot: the computer's play. It aims at the bin, off to the side by what the fan will carry the paper back, and
// is off by an error of its level's size (floor units, a normal spread each way: `aiErr`), on top of the room's own
// spread. Easy also misjudges the fan (it allows for 60% of it).
import { gaussOf } from '../../core/random.js';
import { TOSS, tossCfg, tossFlickAt } from './rules.js';

const chance = (c, bin, level) => { const sd = Math.hypot(c.ai[level] == null ? c.ai.normal : c.ai[level], c.spread); return 1 - Math.exp(-(bin * bin) / (2 * sd * sd)); };
export function needs(pm, p) { const c = tossCfg(pm), left = c.goal - pm.in[p]; return left <= 0 ? 0 : Math.max(1, left / Math.max(0.1, chance(c, pm.bin, 'normal'))); }
export function best(pm, me, rng, style, ctx) {
  const c = tossCfg(pm), level = (ctx && ctx.level) || 'normal', err = c.ai[level] == null ? c.ai.normal : c.ai[level], w = pm.wind[me] * (level === 'easy' ? 0.6 : 1);
  return { move: tossFlickAt(TOSS.w / 2 - w + gaussOf(rng) * err, pm.dist + gaussOf(rng) * err), q: c.goal - pm.in[me] === 1 ? chance(c, pm.bin, level) : 0 };
}
