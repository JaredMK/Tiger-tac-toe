// Word Tiles: the computer's play.
import { randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
import { wtCfg, wtMoves } from './rules.js';

// Every legal word on the shared board from its own rack is found (rules.js wtMoves: a small board, a full search in a
// few tens of ms), then:
//  each level plays the best of the words a person would see: a share of them (Hard `aiSeeHard`, Normal `aiSee`, Easy
//  `aiSeeEasy`, %), drawn at random (100: always the best-scoring word); Easy also keeps to words of up to `aiLenEasy`
//  letters (a person's eye takes in the short ones). None seen: any word it has.
// No word at all: swap the rack. The same search whatever ctx.until (a fixed amount of work).
// The points a turn brings, about (the main board's choice of square: tests/sim/wtiles.sim.js, Normal).
export const WT_GAIN = 17;
export function needs(pm, p) {
  const c = wtCfg(pm), left = Math.max(0, c.target - pm.score[p]);
  return left <= 0 ? 0 : Math.max(1, left / WT_GAIN);
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', c = wtCfg(pm), t = tune(pm);
  const rack = pm.rack && pm.rack[me];
  if (!Array.isArray(rack)) return { move: 'swap', q: 0 };          // (its own rack is in its view: publicView with its side; never the other's)
  const ms = wtMoves(pm.board, rack, c);
  if (!ms.length) return { move: 'swap', q: 0 };
  ms.sort((a, b) => b.score - a.score || (a.w < b.w ? -1 : 1));
  const sfx = level === 'hard' ? 'Hard' : level === 'easy' ? 'Easy' : '', see = t['aiSee' + sfx] != null ? t['aiSee' + sfx] : level === 'hard' ? 100 : 3;
  const cap = level === 'easy' ? Number(t.aiLenEasy) || 0 : 0, pool = cap ? ms.filter(m => String(m.w || '').length <= cap) : ms, from = pool.length ? pool : ms;
  const share = Math.max(1, Math.min(100, see)) / 100;
  const seen = share >= 1 ? from : from.filter(() => rng() < share);
  const pick = seen.length ? seen[0] : from[randInt(rng, from.length)];
  const win = pm.score[me] + pick.score >= c.target;
  return { move: pick.t, q: win ? 1 : goAgain(pm) ? 0.05 : 0 };
}
