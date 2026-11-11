// Word Tiles: the computer's play.
import { randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
import { wtCfg, wtMoves } from './rules.js';

// Every legal word is found (rules.js wtMoves: a small board, a full search in a few tens of ms), then:
//  - Hard: the best-scoring word;
//  - Normal: the best of the words a person would see (a share of them, `aiSee`, drawn at random), so it scores well
//    but not always the most;
//  - Easy: a word from the lower half by score.
// No word at all: swap the rack. The same search whatever ctx.until (a fixed amount of work).
// The points a turn brings, about (the main board's choice of square: tests/sim/wtiles.sim.js, Normal).
export const WT_GAIN = 17;
export function needs(pm, p) {
  const c = wtCfg(pm), left = Math.max(0, c.target - pm.score[p]);
  return left <= 0 ? 0 : Math.max(1, left / WT_GAIN);
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', c = wtCfg(pm), t = tune(pm);
  const ms = wtMoves(pm.board[me], pm.rack[me], c);
  if (!ms.length) return { move: 'swap', q: 0 };
  ms.sort((a, b) => b.score - a.score || (a.w < b.w ? -1 : 1));
  let pick;
  if (level === 'hard') pick = ms[0];
  else if (level === 'easy') { const low = ms.slice(Math.floor(ms.length / 2)); pick = low[randInt(rng, low.length)]; }
  else {
    const share = Math.max(1, Math.min(100, t.aiSee != null ? t.aiSee : 3)) / 100;
    const seen = ms.filter(() => rng() < share);
    pick = seen.length ? seen[0] : ms[randInt(rng, ms.length)];
  }
  const win = pm.score[me] + pick.score >= c.target;
  return { move: pick.t, q: win ? 1 : goAgain(pm) ? 0.05 : 0 };
}
