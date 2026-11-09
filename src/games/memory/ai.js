// Find the Pair: the computer's play.
import { randInt, shuffle } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { memoryKnown, memoryPair } from './rules.js';

// Race mode (core/race.js, `rv: 2`): the computer flips its own layout and reads the cards it has turned itself (its part,
// pm.side[me]: memoryKnown); the other layout is another shuffle and tells it nothing of where its cards lie, and its own
// flips help the other side nothing (shared: false). Hard: the fewest flips expected (memorySolo). Each side's needs come
// from its own part (both are open), with no limit.
export function needs(pm, p) {
  const v = memoryKnown(pm, p);
  if (!v) return 1 + 9 / 2;                                      // (a part this copy has not got: nothing seen)
  const known = v.seen.filter(i => v.cards[i]); return memoryPair(v, known) ? 1 : 1 + (9 - v.seen.length) / 2;
}
export function best(pm, me, rng, style, ctx) {
  const shared = !pm.race, v = memoryKnown(pm, me) || { seen: [], cards: [] };
  let known = v.seen.filter(i => v.cards[i]);
  const mem = tune(pm).mem, forgot = [];
  if (mem < 100) known = known.filter(i => rng() * 100 < mem || !forgot.push(i));   // its memory (TUNE): a card seen may be forgotten, as good as unseen
  const pair = memoryPair(v, known);
  if (pair) return { move: pair, q: 1, shared };
  const unseen = [];
  for (let i = 0; i < 9; i++) if (!v.seen.includes(i)) unseen.push(i);
  unseen.push(...forgot);
  if (ctx && ctx.level === 'hard' && unseen.length) return Object.assign(shared ? memoryHard(pm, known, unseen, rng) : memorySolo(pm, known, unseen, rng), { shared });
  if (unseen.length >= 2) { shuffle(unseen, rng); return { move: [unseen[0], unseen[1]], q: 2 / (unseen.length * (unseen.length - 1)), shared }; }
  if (unseen.length === 1) return { move: [unseen[0], known[randInt(rng, known.length)]], q: 1 / known.length, shared }; 
  return { move: [known[0], known[1]], q: 0, shared };
}

// ---- Hard: the race for the pair ----
// Every card seen is remembered (Normal too, at its full memory); what is left to decide is what to turn when
// no pair is known: two unseen cards (Normal), or one unseen beside a card already seen. The odds come from
// how the deck is made (memoryDeck: pairs among 9 - pairs designs, so a design seen once is twice as likely
// to be a pair's as one not seen yet): over how many of the seen designs still have a twin face down, two
// unseen cards are the pair as often as an unseen card is the twin of a seen one, and the second shows the
// other side one card less. The value for the side to move with k designs seen: the better of the two,
// each its chance now, else the other side's chances from what it then sees (a twin turned up beside
// another seen design: theirs at once).
const MH = { memo: {} };
function comb(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
// The two ways' chances with m pairs in the deck and k designs seen: { A, B }, each { win, next, v } (win: the pair
// now; next: the other side faces k + 2 or k + 1 seen; v: the way's worth), and the better's worth.
function memoryOdds(m, k) {
  const key = m + ':' + k;
  if (MH.memo[key]) return MH.memo[key];
  const nd = 9 - m, u = 9 - k, out = { A: null, B: null, v: 0.5 };
  if (u > 0) {
    const P = [];                                                // the odds on a: seen designs whose twin is face down
    let z = 0;
    for (let a = 0; a <= Math.min(k, m); a++) { P[a] = comb(k, a) * comb(nd - k, m - a) * 2 ** a; z += P[a]; }
    let Ea = 0, none = 0;
    for (let a = 0; a < P.length; a++) { P[a] /= z; Ea += a * P[a]; none += P[a] * comb(u - a, 2); }
    if (k) { const B = { win: Ea / (k * u), next: 1 - Ea / u }; B.v = B.win + B.next * (1 - memoryOdds(m, k + 1).v); out.B = B; }
    if (u >= 2) { const pairs = comb(u, 2), A = { win: (m - Ea) / pairs }; A.next = none / pairs - A.win; A.v = A.win + A.next * (1 - memoryOdds(m, k + 2).v); out.A = A; }
    out.v = Math.max(out.A ? out.A.v : 0, out.B ? out.B.v : 0);
  }
  return (MH.memo[key] = out);
}
function memoryHard(pm, known, unseen, rng) {
  const o = memoryOdds(Math.max(1, Math.min(3, tune(pm).pairs || 1)), known.length);
  const two = o.A && (!o.B || o.A.v > o.B.v + 1e-9);
  shuffle(unseen, rng);
  if (two) return { move: [unseen[0], unseen[1]], q: o.A.win, shared: true };
  if (o.B) return { move: [unseen[0], known[randInt(rng, known.length)]], q: o.B.win, shared: true };
  return { move: [unseen[0], unseen[1]], q: 0, shared: true };
}

// ---- Hard in a race: the fewest flips (its own layout) ----
// The same odds (memoryOdds: two unseen cards, A, or an unseen card beside a seen one, B), weighed for the flips still
// expected alone: the flip, then nothing if it is the pair, one more if it shows a twin of a card seen (the pair known),
// else the expectation with k + 2 (A) or k + 1 (B) seen.
function soloFlips(m, k) {
  const key = 's' + m + ':' + k;
  if (MH.memo[key] != null) return MH.memo[key];
  const o = memoryOdds(m, k);
  const way = w => (w ? 1 + (1 - w.win - w.next) + w.next * (w === o.A ? (k + 2 <= 9 ? soloFlips(m, k + 2) : 1) : soloFlips(m, k + 1)) : Infinity);
  const v = 9 - k <= 0 ? 1 : Math.min(way(o.A), way(o.B));
  return (MH.memo[key] = Number.isFinite(v) ? v : 1);
}
function memorySolo(pm, known, unseen, rng) {
  const m = Math.max(1, Math.min(3, tune(pm).pairs || 1)), k = known.length, o = memoryOdds(m, k);
  const cost = w => (w ? 1 + (1 - w.win - w.next) + w.next * (w === o.A ? soloFlips(m, k + 2) : soloFlips(m, k + 1)) : Infinity);
  shuffle(unseen, rng);
  const two = o.A && unseen.length >= 2 && (!o.B || !known.length || cost(o.A) <= cost(o.B) + 1e-9);
  if (two) return { move: [unseen[0], unseen[1]], q: o.A.win };
  if (o.B && known.length) return { move: [unseen[0], known[randInt(rng, known.length)]], q: o.B.win };
  return { move: unseen.length >= 2 ? [unseen[0], unseen[1]] : [unseen[0], known[0]], q: 0 };
}
