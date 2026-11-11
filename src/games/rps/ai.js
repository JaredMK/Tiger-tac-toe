// Rock Paper Scissors: the computer's play. The house's deck counts are public, so the odds of its next throw are known.
import { randInt } from '../../core/random.js';
import { goAgain } from '../../core/tune.js';
import { RPS, rpsBeater, rpsCfg, rpsFull, rpsLeft } from './rules.js';

const key = d => `${d.r},${d.p},${d.s}`;
// The chance of winning the move (the turn's one decided throw: a tie throws again, against the deck less that card)
// from deck d, throwing best each time: V(d) = max over throws t of P(house throws what t beats) + P(it throws t) x
// V(d less one t). A deck that empties turns over to the full one, so the full deck's value sits on both sides:
// found by iterating (it settles in a few rounds; the states are at most the deck's counts multiplied).
const SOLVED = new Map();
function solve(full) {
  const fk = key(full);
  if (SOLVED.has(fk)) return SOLVED.get(fk);
  const memo = new Map();
  let vFull = 0.5;
  const V = d => {
    const n = rpsLeft(d);
    if (!n) return vFull;                                         // (emptied: the full deck again, its value as last found)
    const k = key(d);
    if (memo.has(k)) return memo.get(k);
    let best = 0;
    for (const t of RPS.kinds) best = Math.max(best, winWith(d, t, n));
    memo.set(k, best);
    return best;
  };
  const winWith = (d, t, n) => {
    const lose = d[RPS.beats[t]] / n, tie = d[t] / n;
    if (!tie) return lose;
    const nd = Object.assign({}, d); nd[t] -= 1;
    return lose + tie * (rpsLeft(nd) ? V(nd) : vFull);
  };
  for (let it = 0; it < 40; it++) { memo.clear(); const v = V(full); if (Math.abs(v - vFull) < 1e-12) { vFull = v; break; } vFull = v; }
  memo.clear(); V(full);
  const out = { V, winWith: (d, t) => winWith(d, t, rpsLeft(d)), vFull };
  SOLVED.set(fk, out);
  return out;
}
const deckOf = (pm, p) => { const d = Object.assign({}, pm.deck[p]); return rpsLeft(d) ? d : rpsFull(pm); };
// Easy: any throw. Normal: the throw that beats the house's likeliest next throw (equally likely ones: any of them).
// Hard: the throw with the best chance of winning the move, ties thrown again (the exact value above).
export function rpsPick(pm, me, rng, level) {
  const d = deckOf(pm, me);
  if (level === 'easy') return RPS.kinds[randInt(rng, 3)];
  if (level === 'hard') {
    const S = solve(rpsFull(pm)); let best = [], bv = -1;
    for (const t of RPS.kinds) { const v = S.winWith(d, t); if (v > bv + 1e-12) { bv = v; best = [t]; } else if (Math.abs(v - bv) <= 1e-12) best.push(t); }
    return best[randInt(rng, best.length)];
  }
  const top = Math.max(d.r, d.p, d.s), likely = RPS.kinds.filter(k => d[k] === top);
  return rpsBeater(likely[randInt(rng, likely.length)]);
}
// The turns p still needs: each turn decides one throw, won about vFull of the time (the current deck's own chance first).
export function needs(pm, p) {
  const k = Math.max(0, rpsCfg(pm).goal - pm.score[p]);
  if (!k) return 1;
  const S = solve(rpsFull(pm)), now = S.V(deckOf(pm, p)), avg = S.vFull;
  return Math.max(1, goAgain(pm) ? 1 + (k - now) * (1 - avg) / avg : 1 + (k - now) / avg);
}
export function best(pm, me, rng, style, ctx) {
  const level = ctx && ctx.level ? ctx.level : 'normal', move = rpsPick(pm, me, rng, level);
  const S = solve(rpsFull(pm)), p = S.winWith(deckOf(pm, me), move), k = Math.max(1, rpsCfg(pm).goal - pm.score[me]);
  return { move, q: k <= 1 ? p : goAgain(pm) ? p * S.vFull ** (k - 1) : 0 };   // q: the chance this turn takes the square
}
export { solve as rpsSolve };
