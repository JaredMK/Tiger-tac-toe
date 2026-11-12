// Rock Paper Scissors: the computer's play. The house throws at random, each as likely, so every throw is as good as
// another: at every level the computer throws at random. A turn decides one throw (a tie throws again): won half the time.
import { randInt } from '../../core/random.js';
import { goAgain } from '../../core/tune.js';
import { RPS, rpsCfg } from './rules.js';

export const RPS_WIN = 0.5;                                       // a turn's chance of a win: 1/3 against 1/3, ties thrown again
export function rpsPick(pm, me, rng, level) { return RPS.kinds[randInt(rng, 3)]; }
// The turns p still needs: each turn wins its throw half the time.
export function needs(pm, p) {
  const k = Math.max(0, rpsCfg(pm).goal - pm.score[p]);
  if (!k) return 1;
  return Math.max(1, goAgain(pm) ? 1 + (k - RPS_WIN) * (1 - RPS_WIN) / RPS_WIN : k / RPS_WIN);
}
export function best(pm, me, rng, style, ctx) {
  const move = rpsPick(pm, me, rng), k = Math.max(1, rpsCfg(pm).goal - pm.score[me]);
  return { move, q: k <= 1 ? RPS_WIN : goAgain(pm) ? RPS_WIN ** k : 0 };   // q: the chance this turn takes the square
}
