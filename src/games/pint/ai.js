// Split It: the computer's play. It knows how long a hold brings the level to its mark (rules.js pintTime) and lets
// go early or late by a timing error of its level's size (ms, a normal spread: `aiMs` at Normal, `aiMsHard`,
// `aiMsEasy`), so where the drink stops is off by that time at the drink's speed: a stand-in for a finger, never a
// perfect release.
import { gaussOf } from '../../core/random.js';
import { goAgain } from '../../core/tune.js';
import { pintCfg, pintLevel, pintSpeed, pintTime } from './rules.js';

// The chance a normal error of spread sd lands within w either way (Abramowitz and Stegun's erf, 7.1.26).
function within(w, sd) {
  if (sd <= 0) return 1;
  const x = w / (sd * Math.SQRT2), k = 1 / (1 + 0.3275911 * x);
  return 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
}
// A Normal hand's chances at a mark: a split or better, and a perfect one.
function odds(c, mark) { const sd = c.ai.normal * pintSpeed(c, pintTime(c, mark)) / 1000; return { split: within(c.tol, sd), perfect: within(c.perfect, sd) }; }
export function needs(pm, p) {
  const c = pintCfg(pm), left = c.goal - pm.pts[p]; if (left <= 0) return 0;
  const o = odds(c, (c.lo + c.hi) / 2), per = Math.max(0.05, o.split + o.perfect) * (goAgain(pm) ? 1 / Math.max(0.2, 1 - o.split) : 1);
  return Math.max(1, left / per);
}
export function best(pm, me, rng, style, ctx) {
  const c = pintCfg(pm), level = (ctx && ctx.level) || 'normal', sd = c.ai[level] == null ? c.ai.normal : c.ai[level];
  const t = Math.max(0, pintTime(c, pm.mark[me]) + gaussOf(rng) * sd), left = c.goal - pm.pts[me], o = odds(c, pm.mark[me]);
  return { move: { lv: Math.round(pintLevel(c, t) * 1000) / 1000 }, q: left <= 1 ? o.split : left === 2 ? o.perfect : 0 };
}
