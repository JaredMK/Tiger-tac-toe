// Hook-a-Duck: the computer's play. Every duck looks the same from above, so there is nothing to choose: every level
// hooks a duck at random (Easy, Normal and Hard alike). What it does know is what is left in its pond (the mix less the
// values hooked from it, all public), which sizes `needs` and `q` for the main board's choice of square.
import { randInt } from '../../core/random.js';
import { goAgain } from '../../core/tune.js';
import { duckCfg, duckLeft, duckMix } from './rules.js';

// The values still in p's pond (a multiset, as a list), from the mix and what has been hooked out of this pond.
export function duckRest(pm, p) {
  const rest = duckMix(duckCfg(pm)), out = (pm.out && pm.out[p]) || [];
  for (const v of out) { const k = rest.indexOf(v); if (k >= 0) rest.splice(k, 1); }
  return rest;
}
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
// The turns p still needs: the points left over the pond's average per hook (the pond as it stands first, then fresh ones).
export function needs(pm, p) {
  const c = duckCfg(pm), k = Math.max(0, c.target - pm.score[p]);
  if (!k) return 1;
  const now = mean(duckRest(pm, p)) || mean(duckMix(c)), avg = Math.max(0.1, (now + mean(duckMix(c))) / 2);
  const hooks = k / avg;
  return Math.max(1, goAgain(pm) ? 1 + hooks * (duckRest(pm, p).filter(v => v === 0).length / Math.max(1, duckRest(pm, p).length)) : hooks);
}
export function best(pm, me, rng, style, ctx) {
  const left = duckLeft(pm, me);
  if (!left.length) return { move: null };
  const c = duckCfg(pm), need = c.target - pm.score[me], rest = duckRest(pm, me);
  const q = rest.length ? rest.filter(v => v >= need).length / rest.length : 0;   // q: the chance this hook takes the square
  return { move: left[randInt(rng, left.length)], q };
}
