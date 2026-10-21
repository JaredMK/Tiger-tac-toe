// Echo: the computer's play.
import { tune } from '../../core/tune.js';
import { ECHO } from './rules.js';

// How often it beats each pattern (the admin's settings, in %; ECHO's without a type).
const aiPass = pm => { const t = tune(pm); return t.ai1 ? [t.ai1, t.ai2, t.ai3, t.ai4].map(x => x / 100) : ECHO.aiPass; };
export function needs(pm, p) {
  const q = aiPass(pm); let n = 0; for (let l = pm.level[p]; l < ECHO.lengths.length; l++) n += 1 / q[l]; return Math.max(1, n);
}
export function best(pm, me, rng, style, ctx) {   // it beats a pattern as often as its length allows (its taps come from the pattern itself: see cpuEcho)
  const a = aiPass(pm), q = a[Math.min(pm.level[me], a.length - 1)];
  return { move: { echo: rng() < q ? 'pass' : 'fail', at: rng() }, q };
}
