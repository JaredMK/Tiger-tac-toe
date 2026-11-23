// Barrel Launch: the computer's play. It waits a moment, finds the next time its barrel's swing passes the line to the
// barrel above (rules.js barrelAim, barrelTarget) and taps then, early or late by a timing error of its level's size
// (ms, a normal spread: `aiMs` at Normal, `aiMsHard`, `aiMsEasy`): a stand-in for a finger, never a perfect tap.
import { gaussOf } from '../../core/random.js';
import { barrelCfg, barrelPeriod, barrelTarget } from './rules.js';

const DEG = Math.PI / 180;
// The chance a normal error of spread sd lands within w either way (Abramowitz and Stegun's erf, 7.1.26).
function within(w, sd) {
  if (sd <= 0) return 1;
  const x = w / (sd * Math.SQRT2), k = 1 / (1 + 0.3275911 * x);
  return 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
}
// A shot's chance from barrel i with a timing error of spread sd: the catch's half width in ms at the crossing.
export function barrelOdds(pm, c, i, sd) {
  const g = barrelTarget(pm, c, i), half = Math.asin(Math.min(1, c.win / g.dist)) / DEG, w = 2 * Math.PI / barrelPeriod(c, i) * Math.sqrt(Math.max(1e-6, c.amp * c.amp - g.phi * g.phi));
  return within(half / w, sd);
}
export function needs(pm, p) {
  const c = barrelCfg(pm), left = c.top - pm.at[p]; if (left <= 0) return 0;
  return left / Math.max(0.05, barrelOdds(pm, c, Math.min(pm.at[p], c.top - 1), c.ai.normal));
}
// The first moment, from `after` ms on, that barrel i's aim crosses phi (ms after the column's clock stood at `clock`).
export function barrelCross(pm, c, i, phi, clock, after) {
  const P = barrelPeriod(c, i), ph = pm.ph[i] || 0, s = Math.asin(Math.max(-1, Math.min(1, phi / c.amp))) / (2 * Math.PI), u0 = (clock + after) / P + ph;
  let best = Infinity;
  for (const a of [s, 0.5 - s]) { let u = Math.floor(u0) + ((a % 1) + 1) % 1; if (u < u0) u += 1; best = Math.min(best, u); }
  return (best - ph) * P - clock;
}
export function best(pm, me, rng, style, ctx) {
  const c = barrelCfg(pm), level = (ctx && ctx.level) || 'normal', sd = c.ai[level] == null ? c.ai.normal : c.ai[level], i = Math.min(pm.at[me], c.top - 1);
  const g = barrelTarget(pm, c, i), t0 = barrelCross(pm, c, i, g.phi, pm.c[me], 350 + rng() * 500);
  const t = Math.max(0, Math.round(t0 + gaussOf(rng) * sd));
  return { move: { t }, q: c.top - pm.at[me] === 1 ? barrelOdds(pm, c, i, sd) : 0 };
}
