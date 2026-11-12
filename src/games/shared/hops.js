// The race tracks' hops (Snakes and Ladders, Candy Race, Bump): the timings the rules (flashMs), the views (the
// sounds) and the page's animation (ui/track.js) share. Pure: no page, no clock.
import { PLAY } from '../../core/timer.js';

// A piece hops space by space: the first `even` hops at the usual pace (PLAY.hop each), each one after that
// shorter than the one before (`quick` of it, never under `min`), so a long move speeds up and is never slow.
// land: the squash as the piece comes down on its last space; win: the piece's jump for joy on the last space.
export const HOPS = { even: 4, quick: 0.86, min: 70, land: 170, win: 650 };
// The moment (ms from its first hop's start) the piece comes down from its k-th hop; hopAt(0) is 0.
export function hopAt(k) {
  let t = 0, d = PLAY.hop;
  for (let i = 0; i < k; i++) { if (i >= HOPS.even) d = Math.max(HOPS.min, d * HOPS.quick); t += d; }
  return Math.round(t);
}
