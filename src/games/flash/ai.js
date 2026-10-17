// Flash: the computer's play.
import { ATT, attOk } from '../shared/attention.js';
export { attentionBest as best } from '../shared/attention.js';

export function needs(pm, p) {
  let n = 0; for (let f = pm.right[p]; f < ATT.goal; f++) n += 1 / attOk(pm.type, f); return Math.max(1, n);
}
