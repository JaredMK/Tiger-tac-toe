// Bump: the computer's play.
import { BUMP } from './rules.js';

// The spins a piece still needs, exactly, the other piece on the track too: every spin of either lands 1, 2 or 3
// on, a piece landed on goes back Home, and the other piece is in the way until it is home itself. SPINS[a][b]: p's own
// spins from a with the other piece at b (the mean of p to spin and the other to spin; the other piece past the
// Finish is off the track). The chain loops through the knocks, so it is swept until it settles, once. There is one
// move (spin): nothing for any level to choose.
let SPINS = null;
function bumpSpins() {
  if (SPINS) return SPINS;
  const F = BUMP.n + 1, M = BUMP.max, at = (a, b, t) => (a * (F + 1) + b) * 2 + t;   // t 0: p to spin; 1: the other piece
  const N = new Float64Array((F + 1) * (F + 1) * 2);
  for (let it = 0; it < 5000; it++) {
    let moved = 0;
    for (let a = F - 1; a >= 0; a--) for (let b = F; b >= 0; b--) for (let t = 0; t < 2; t++) {
      let v = t === 0 ? 1 : 0;
      if (t === 1 && b >= F) v = N[at(a, b, 0)];                  // (the other piece is home: p spins on alone)
      else for (let s = 1; s <= M; s++) {
        if (t === 0) { const to = Math.min(F, a + s); if (to < F) v += N[at(to, b < F && b === to ? 0 : b, b >= F ? 0 : 1)] / M; }
        else { const to = Math.min(F, b + s); v += N[at(to < F && to === a ? 0 : a, to, 0)] / M; }
      }
      const d = Math.abs(v - N[at(a, b, t)]); if (d > moved) moved = d;
      N[at(a, b, t)] = v;
    }
    if (moved < 1e-10) break;
  }
  SPINS = []; for (let a = 0; a <= F; a++) { SPINS.push([]); for (let b = 0; b <= F; b++) SPINS[a].push(a >= F ? 0 : (N[at(a, b, 0)] + N[at(a, b, 1)]) / 2); }
  return SPINS;
}
export function needs(pm, p) {
  const F = BUMP.n + 1, a = Math.max(0, Math.min(F, pm.pos[p])), b = Math.max(0, Math.min(F, pm.pos[p === 'X' ? 'O' : 'X']));
  return Math.max(1, bumpSpins()[a][b]);
}
export function best(pm, me, rng, style, ctx) {
  const need = BUMP.n + 1 - pm.pos[me]; return { move: 'spin', q: need <= BUMP.max ? (BUMP.max + 1 - need) / BUMP.max : 0 };
}
