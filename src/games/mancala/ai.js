// Mancala Race: the computer's play. Easy sows any pit. Normal takes the pit that banks most this turn, a go-again
// counted as worth a little more, then the one that leaves the other side least to capture. Hard searches: whole
// turns for each side (go-agains played on), a few turns deep, by the difference in banks (and who gets there first).
import { mancCfg, mancMoves, mancSow } from './rules.js';

const other = p => (p === 'X' ? 'O' : 'X');
function search(pits, bank, p, me, c, depth) {
  if (bank[me] >= c.target) return 1000 + depth; if (bank[other(me)] >= c.target) return -1000 - depth;
  const moves = pits[p].map((v, i) => (v > 0 ? i : -1)).filter(i => i >= 0);
  if (!moves.length) return bank[me] === bank[other(me)] ? 0 : bank[me] > bank[other(me)] ? 500 : -500;
  if (depth <= 0) return bank[me] - bank[other(me)];
  let best = p === me ? -Infinity : Infinity;
  for (const i of moves) { const r = mancSow(pits, bank, p, i, c), v = search(r.pits, r.bank, r.again ? p : other(p), me, c, r.again ? depth : depth - 1); best = p === me ? Math.max(best, v) : Math.min(best, v); }
  return best;
}
export function needs(pm, p) { const c = mancCfg(pm), left = c.target - pm.bank[p]; return left <= 0 ? 0 : Math.max(1, left / 2); }
export function best(pm, me, rng, style, ctx) {
  const c = mancCfg(pm), level = (ctx && ctx.level) || 'normal', moves = mancMoves(pm, me), pick = a => a[Math.floor(rng() * a.length)];
  if (!moves.length) return { move: 'end', q: 0 };
  const q = c.target - pm.bank[me] <= 3 ? 0.4 : 0.05;
  if (level === 'easy') return { move: pick(moves), q };
  const scored = moves.map(i => {
    const r = mancSow(pm.pits, pm.bank, me, i, c);
    if (level === 'hard') return { i, v: search(r.pits, r.bank, r.again ? me : other(me), me, c, r.again ? 3 : 2) };
    // Normal: what it banks now, a go-again a little more, less the most the other side could bank with one sowing after
    let reply = 0; if (!r.again) for (const j of r.pits[other(me)].map((v, k) => (v > 0 ? k : -1)).filter(k => k >= 0)) { const s = mancSow(r.pits, r.bank, other(me), j, c); reply = Math.max(reply, s.bank[other(me)] - r.bank[other(me)] + (s.again ? 0.5 : 0)); }
    return { i, v: (r.bank[me] >= c.target ? 100 : 0) + r.bank[me] - pm.bank[me] + (r.again ? 0.8 : 0) - reply * 0.5 };
  });
  const top = Math.max(...scored.map(s => s.v));
  return { move: pick(scored.filter(s => s.v >= top - 1e-9)).i, q };
}
