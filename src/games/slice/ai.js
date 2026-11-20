// Fruit Slice: the computer's play. It stands in for a finger: each fruit of the round is sliced with its level's
// chance (`aiHit`), and each bomb that comes up is struck with its level's chance (`aiBomb`), which ends the round there.
import { sliceCfg, sliceRound } from './rules.js';

const per = (c, level) => { const [h, b] = c.ai[level] || c.ai.normal, pb = b / 100; let ev = 0, alive = 1; const share = c.fruits / Math.max(1, c.fruits + c.bombs); for (let i = 0; i < c.fruits + c.bombs; i++) { ev += alive * share * h / 100; alive *= 1 - (1 - share) * pb; } return Math.max(0.5, ev - (1 - alive) * c.cost); };
export function needs(pm, p) { const c = sliceCfg(pm), need = c.target - pm.score[p]; return need <= 0 ? 0 : Math.max(1, need / per(c, 'normal')); }
export function best(pm, me, rng, style, ctx) {
  const c = sliceCfg(pm), level = (ctx && ctx.level) || 'normal', [h, b] = c.ai[level] || c.ai.normal, hit = [];
  const items = sliceRound(pm, me);
  for (let i = 0; i < items.length; i++) { if (items[i].k < 0) { if (rng() < b / 100) { hit.push(i); break; } } else if (rng() < h / 100) hit.push(i); }
  return { move: { hit }, q: c.target - pm.score[me] <= per(c, level) ? 0.5 : 0 };
}
