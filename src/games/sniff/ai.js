// Sniff: the computer's play.
import { sniffCands, sniffDist, sniffPick } from './rules.js';

export function needs(pm, p) {
  const c = sniffCands(pm), d = c.length ? Math.min(...c.map(x => sniffDist(pm.dog, x))) : 1; return Math.max(1, d + Math.log2(Math.max(1, c.length)) * 0.8);
}
export function best(pm, me, rng, style, ctx) {
  const b = sniffPick(pm, rng); return { move: b.move, q: b.q, shared: true };
}
