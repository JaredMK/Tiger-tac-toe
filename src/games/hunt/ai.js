// Treasure Hunt: the computer's play.
import { huntBand, huntCandidates, huntDist, huntSize } from './rules.js';

export function needs(pm, p) {
  const n = huntCandidates(pm).length; return n <= 1 ? 1 : 1 + Math.log2(n) / 2.5;
}
export function best(pm, me, rng, style, ctx) {
  const cand = huntCandidates(pm);
  if (!cand.length) { const open = pm.dug.map((d, i) => (d ? -1 : i)).filter(i => i >= 0); return { move: open[0], q: 0, shared: true }; }
  if (cand.length === 1) return { move: cand[0], q: 1, shared: true };
  let best = cand[0], bestSplit = Infinity;        // the dig that, if it misses, leaves the fewest candidates on average (by the band it would show)
  const n = huntSize(pm);
  for (const c of cand) {
    const groups = new Map();
    for (const x of cand) if (x !== c) { const k = huntBand(huntDist(c, x, n)); groups.set(k, (groups.get(k) || 0) + 1); }
    let split = 0;
    for (const g of groups.values()) split += g * g;
    if (split < bestSplit) { bestSplit = split; best = c; }
  }
  return { move: best, q: 1 / cand.length, shared: true };
}
