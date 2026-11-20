// Target Practice: the computer's play. It picks one of its standing targets and aims at its middle, each slider off
// by an error of its level's size (field units, a normal spread: `aiErr` 7 at Normal, 4 at Hard, 11 at Easy), and stops
// the circle near its smallest (off by a share of the same error). Where the dart lands inside the circle is the
// throw's own chance.
import { gaussOf } from '../../core/random.js';
import { targetCfg } from './rules.js';

export function needs(pm, p) { const left = pm.tg[p].filter(t => t.on).length; return left <= 0 ? 0 : Math.max(1, left / 0.7); }
export function best(pm, me, rng, style, ctx) {
  const c = targetCfg(pm), level = (ctx && ctx.level) || 'normal', sd = c.ai[level] == null ? c.ai.normal : c.ai[level], live = pm.tg[me].filter(t => t.on);
  const t = live.length ? live[Math.floor(rng() * live.length)] : { x: 50, y: 50 }, cl = v => Math.max(0, Math.min(100, v));
  const r = Math.min(c.rmax, c.rmin + Math.abs(gaussOf(rng)) * sd * 0.6);
  return { move: { x: Math.round(cl(t.x + gaussOf(rng) * sd) * 10) / 10, y: Math.round(cl(t.y + gaussOf(rng) * sd) * 10) / 10, r: Math.round(r * 10) / 10 }, q: live.length === 1 ? 0.6 : 0 };
}
