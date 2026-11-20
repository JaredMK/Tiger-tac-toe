// Marble Toss: the computer's play. It aims at the middle of a hole and is off by an error of its level's size (table
// units, a normal spread each way: `aiErr`), on top of the table's own spread. Normal and Hard take the hole worth the
// most on average (its points, never more than are needed, times the chance of landing in it: 1 - exp(-r² / 2σ²));
// Easy any hole.
import { gaussOf } from '../../core/random.js';
import { marbleCfg, marbleFlickAt } from './rules.js';

const chance = (h, sd) => 1 - Math.exp(-(h.r * h.r) / (2 * sd * sd));
function pick(pm, me, level) {
  const c = marbleCfg(pm), sd = Math.hypot(c.ai[level] == null ? c.ai.normal : c.ai[level], c.spread), need = c.target - pm.score[me];
  return pm.holes.map(h => ({ h, pr: chance(h, sd), ev: chance(h, sd) * Math.min(need, h.v) })).sort((a, b) => b.ev - a.ev);
}
export function needs(pm, p) { const c = marbleCfg(pm), need = c.target - pm.score[p]; return need <= 0 ? 0 : Math.max(1, need / Math.max(0.2, pick(pm, p, 'normal')[0].ev * c.marbles)); }
export function best(pm, me, rng, style, ctx) {
  const c = marbleCfg(pm), level = (ctx && ctx.level) || 'normal', err = c.ai[level] == null ? c.ai.normal : c.ai[level], opts = pick(pm, me, level);
  const e = level === 'easy' ? opts[Math.floor(rng() * opts.length)] : opts[0];
  return { move: marbleFlickAt(e.h.x + gaussOf(rng) * err, e.h.y + gaussOf(rng) * err), q: e.h.v >= c.target - pm.score[me] ? e.pr : 0 };
}
