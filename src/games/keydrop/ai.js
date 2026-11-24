// Key Drop: the computer's play. It picks a prize still on its shelf and lets go of each slide when the key should
// be level with that keyhole, early or late by a timing error of its level's size (ms, a normal spread: `aiMs` 70 at
// Normal, 50 at Hard, 95 at Easy), so where the key stops is off by that time at the key's speed: a stand-in for a
// finger, never a perfect release.
import { gaussOf } from '../../core/random.js';
import { KEYD, keydAt, keydCfg, keydHole, keydSpeed } from './rules.js';

export function needs(pm, p) { const c = keydCfg(pm), left = c.goal - pm.got[p]; return left <= 0 ? 0 : left * 3; }
export function best(pm, me, rng, style, ctx) {
  const c = keydCfg(pm), level = (ctx && ctx.level) || 'normal', sd = c.ai[level] == null ? c.ai.normal : c.ai[level], v = keydSpeed(c, pm.n[me]);
  const live = pm.wall[me].map((on, i) => (on ? i : -1)).filter(i => i >= 0), h = keydHole(pm, live.length ? live[Math.floor(rng() * live.length)] : 0);
  const stop = (from, to, sp) => Math.round(Math.max(from, keydAt(from, sp, (to - from) / sp * 1000 + gaussOf(rng) * sd)) * 10) / 10;
  return { move: { x: stop(KEYD.x0, h.x, v.x), y: stop(KEYD.y0, h.y, v.y) }, q: c.goal - pm.got[me] === 1 ? 0.33 : 0 };
}
