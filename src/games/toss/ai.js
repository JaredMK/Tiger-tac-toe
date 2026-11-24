import { tune } from '../../core/tune.js';
// Bin Shot: the computer's play. It aims at the bin, off to the side by what the fan will carry the paper back, and
// is off by an error of its level's size (floor units, a normal spread each way: `aiErr`), on top of the room's own
// spread. Each level allows for its share of the fan (`aiFan<Level>`: Easy 60%).
import { gaussOf } from '../../core/random.js';
import { TOSS, tossCfg, tossFlickAt } from './rules.js';

const chance = (c, bin, level) => { const sd = Math.hypot(c.ai[level] == null ? c.ai.normal : c.ai[level], c.spread); return 1 - Math.exp(-(bin * bin) / (2 * sd * sd)); };
// How much of the fan's push each level allows for (`aiFan<Level>`, %: Easy 60, Normal and Hard all of it).
const LV = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }, FAN = { easy: 60, normal: 100, hard: 100 };
export function fanShare(pm, level) { const L = LV[level] ? level : 'normal', v = tune(pm)['aiFan' + LV[L]]; return (v != null && Number.isFinite(Number(v)) ? Number(v) : FAN[L]) / 100; }
export function needs(pm, p) { const c = tossCfg(pm), left = c.goal - pm.in[p]; return left <= 0 ? 0 : Math.max(1, left / Math.max(0.1, chance(c, pm.bin, 'normal'))); }
export function best(pm, me, rng, style, ctx) {
  const c = tossCfg(pm), level = (ctx && ctx.level) || 'normal', err = c.ai[level] == null ? c.ai.normal : c.ai[level], w = pm.wind[me] * fanShare(pm, level);
  return { move: tossFlickAt(TOSS.w / 2 - w + gaussOf(rng) * err, pm.dist + gaussOf(rng) * err), q: c.goal - pm.in[me] === 1 ? chance(c, pm.bin, level) : 0 };
}
// A weaker throw a person might make (the mistake rate, core/ai.js aiSlip): the fan forgotten (aimed straight at the
// bin) or over-allowed for, with the level's aim error.
export function worse(pm, me, rng, ctx) {
  const c = tossCfg(pm), level = (ctx && (ctx.diff || ctx.level)) || 'normal', err = c.ai[level] == null ? c.ai.normal : c.ai[level], w = pm.wind[me] * (rng() < 0.5 ? 0 : 1.6);
  return tossFlickAt(TOSS.w / 2 - w + gaussOf(rng) * err, pm.dist + gaussOf(rng) * err);
}
