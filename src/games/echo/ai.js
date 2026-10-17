// Echo: the computer's play.
import { ECHO } from './rules.js';

export function needs(pm, p) {
  let n = 0; for (let l = pm.level[p]; l < ECHO.lengths.length; l++) n += 1 / ECHO.aiPass[l]; return Math.max(1, n);
}
export function best(pm, me, rng, style, ctx) {   // it beats a pattern as often as its length allows (its taps come from the pattern itself: see cpuEcho)
  const q = ECHO.aiPass[Math.min(pm.level[me], ECHO.aiPass.length - 1)];
  return { move: { echo: rng() < q ? 'pass' : 'fail', at: rng() }, q };
}
