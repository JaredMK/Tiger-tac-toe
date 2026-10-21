// Blackjack: the computer's play.
import { tune } from '../../core/tune.js';
import { bjStrategy, bjValue } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (tune(pm).goal - pm.wins[p]) / 0.43);      // about 0.43 a hand won (naturals included), pushes replayed
}
export function best(pm, me, rng, style, ctx) {
  // Deal, then basic strategy (hit or stand: no doubling). Hard: hit or stand by the chance of winning the
  // hand (bjHard), with the deck as it shows and the square's own dealer.
  const h = pm.hand && pm.hand.by === me ? pm.hand : null, need = tune(pm).goal - pm.wins[me];
  if (!h) return { move: 'deal', q: need <= 1 ? 0.43 : need === 2 ? 0.05 : 0 };
  if (ctx && ctx.level === 'hard') { const v = bjHard(h.cards, h.up, tune(pm).stand); return { move: v.hit > v.stand ? 'hit' : 'stand', q: need <= 1 ? Math.max(v.hit, v.stand) : 0 }; }
  return { move: bjStrategy(h.cards, h.up), q: 0 };
}

// ---- Hard: the hand's worth, enumerated ----
// A hand is worth its chance of winning, a push worth a fresh hand (dealt again in the same turn: PUSH_W, the
// fresh hand's own worth, from the same reckoning over a full deck). Every draw, the player's and the dealer's,
// comes from the deck as it shows (the 52 less the hand and the up card; the hole card is one of them), its
// make-up held fixed through the draws (as good as the exact count to a few thousandths, and a thousand times
// quicker). The dealer's finishing totals: [bust, 15..21, a natural]; its stand is the square's.
const VAL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], FULL = [4, 4, 4, 4, 4, 4, 4, 4, 4, 16];
const rankIx = c => (c[0] === 'A' ? 0 : 'TJQK'.includes(c[0]) ? 9 : bjValue(c) - 1);
const high = (total, aces) => (aces && total + 10 <= 21 ? total + 10 : total);
function dealerDist(pr, total, aces, n, stand, memo) {
  const t = high(total, aces);
  if (t > 21) { const d = new Float64Array(9); d[0] = 1; return d; }
  if (t >= stand) { const d = new Float64Array(9); d[n === 2 && t === 21 ? 8 : t - 14] = 1; return d; }
  const key = total * 2 + (aces ? 1 : 0) + (n === 1 ? 64 : 0);
  if (memo[key]) return memo[key];
  const d = new Float64Array(9);
  for (let r = 0; r < 10; r++) { if (!pr[r]) continue; const s = dealerDist(pr, total + VAL[r], aces || r === 0, n + 1, stand, memo); for (let k = 0; k < 9; k++) d[k] += pr[r] * s[k]; }
  return (memo[key] = d);
}
function standValue(dist, t, w) { let win = dist[0], push = 0; for (let k = 1; k < 8; k++) { const dt = k + 14; if (dt < t) win += dist[k]; else if (dt === t) push += dist[k]; } return win + w * push; }
function handValue(pr, dist, total, aces, w, memo) {   // the best of standing and hitting from here (21 stands itself)
  const t = high(total, aces);
  if (t > 21) return 0;
  const key = total * 2 + (aces ? 1 : 0);
  if (memo[key] !== undefined) return memo[key];
  let v = standValue(dist, t, w);
  if (t < 21) { let hv = 0; for (let r = 0; r < 10; r++) if (pr[r]) hv += pr[r] * handValue(pr, dist, total + VAL[r], aces || r === 0, w, memo); if (hv > v) v = hv; }
  return (memo[key] = v);
}
// { stand, hit }: each one's worth for the hand against the up card, the dealer standing at `stand`.
export function bjHard(cards, up, stand) {
  stand = stand || 17;
  const C = FULL.slice();
  for (const c of cards) C[rankIx(c)]--;
  C[rankIx(up)]--;
  const N = C.reduce((a, b) => a + b, 0), pr = C.map(x => Math.max(0, x) / N), upR = rankIx(up), w = pushWorth(stand);
  let total = 0, aces = false;
  for (const c of cards) { total += bjValue(c); if (c[0] === 'A') aces = true; }
  const dist = dealerDist(pr, VAL[upR], upR === 0, 1, stand, []), t = high(total, aces), memo = [];
  let hit = 0;
  if (t < 21) for (let r = 0; r < 10; r++) if (pr[r]) hit += pr[r] * handValue(pr, dist, total + VAL[r], aces || r === 0, w, memo);
  return { stand: standValue(dist, t, w), hit };
}
// A fresh hand's worth for a dealer's stand (kept): over every deal from a full deck, played at its best,
// a push worth the same again (the fixed point of w = win + push * w, a few rounds).
const PUSH_W = {};
export function pushWorth(stand) {
  if (PUSH_W[stand]) return PUSH_W[stand];
  const pr = FULL.map(x => x / 52);
  let w = 0.43;
  for (let it = 0; it < 6; it++) {
    let v = 0;
    for (let u = 0; u < 10; u++) {
      const dist = dealerDist(pr, VAL[u], u === 0, 1, stand, []), memo = [];
      for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
        const p = pr[a] * pr[b] * pr[u], total = VAL[a] + VAL[b], aces = a === 0 || b === 0;
        v += p * (high(total, aces) === 21 ? 1 - dist[8] + w * dist[8] : handValue(pr, dist, total, aces, w, memo));   // (a natural wins unless the dealer's pushes it)
      }
    }
    w = v;
  }
  return (PUSH_W[stand] = w);
}
