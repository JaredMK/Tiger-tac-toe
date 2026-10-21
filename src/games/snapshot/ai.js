// Snapshot: the computer's play.
import { ATT, attOk } from '../shared/attention.js';
import { tune } from '../../core/tune.js';
export { attentionBest as best } from '../shared/attention.js';

export function needs(pm, p) {
  const t = tune(pm); let n = 0; for (let f = pm.right[p]; f < ATT.goal; f++) n += 1 / Math.max(0.01, attOk(pm.type, f, t)); return Math.max(1, n);
}
