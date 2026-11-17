// Shell Game: the computer's play: right as often as its level's setting says (TUNE ai1 to ai5), else a near miss
// (the cup the ball's last swapped with: rules.js shellWrong).
import { attGoal, attOk } from '../shared/attention.js';
import { tune } from '../../core/tune.js';
export { attentionBest as best } from '../shared/attention.js';

export function needs(pm, p) {
  const t = tune(pm), goal = attGoal(pm); let n = 0; for (let f = pm.right[p]; f < goal; f++) n += 1 / Math.max(0.01, attOk(pm.type, f, t)); return Math.max(1, n);
}
