// Home Run Heroes: the computer's play. It swings at every pitch, off the perfect moment by a timing error of its
// level's size (`aiMs` 100 at Normal, `aiMsHard` 75, `aiMsEasy` 130: about 24%, 31% and 18% of swings a home run with
// the 30 ms window); Easy lets a pitch go by now and then (`aiSkipEasy`, 10%).
import { gaussOf } from '../../core/random.js';
import { homerCfg } from './rules.js';
import { tune } from '../../core/tune.js';

// The chance a swing with timing error sd lands within w of perfect (the normal curve's middle).
function within(w, sd) { const x = w / (sd * Math.SQRT2), t = 1 / (1 + 0.3275911 * x), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return y; }
// The turns a side still needs: the home runs to go over what an at-bat makes at Normal's timing.
export function needs(pm, p) {
  const c = homerCfg(pm), left = c.goal - pm.hr[p];
  return left <= 0 ? 0 : Math.max(1, left / Math.max(0.05, c.pitches * within(c.hr, c.ai.normal)));
}
export function best(pm, me, rng, style, ctx) {
  const c = homerCfg(pm), level = (ctx && ctx.level) || 'normal', sd = c.ai[level] || c.ai.normal, g = () => gaussOf(rng);
  const s = Array.from({ length: c.pitches }, () => (level === 'easy' && rng() < (Number(tune(pm).aiSkipEasy) || 0) / 100 ? null : Math.round(g() * sd)));
  const left = c.goal - pm.hr[me], pr = within(c.hr, sd);
  let q = 0;                                                      // the chance this at-bat makes the home runs still needed
  if (left <= c.pitches) { const n = c.pitches; const C = (a, b) => { let x = 1; for (let k = 0; k < b; k++) x = x * (a - k) / (k + 1); return x; }; for (let k = left; k <= n; k++) q += C(n, k) * pr ** k * (1 - pr) ** (n - k); }
  return { move: { s }, q };
}
