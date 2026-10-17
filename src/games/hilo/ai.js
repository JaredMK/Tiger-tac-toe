// Higher/Lower: the computer's play.

export function needs(pm, p) {
  const r = pm.hi - pm.lo + 1; return r <= 1 ? 1 : Math.log2(r + 1);
}
export function best(pm, me, rng, style, ctx) {
  return { move: Math.floor((pm.lo + pm.hi) / 2), q: 1 / (pm.hi - pm.lo + 1), shared: true };
}
