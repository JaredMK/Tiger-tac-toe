// Thirty-One: the computer's play.
import { randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
import { t31Best, t31Cfg, t31Deck, t31Score, t31Val, t31Won } from './rules.js';

// What it knows (publicView with its side): its own hand, the shared pile (open, every card of it), the cards the other
// side took off the pile and still holds (`seen`), and so the cards it has not seen (the deck's and the rest of the
// other hand, never which is where nor their order). The other hand is the other side's alone, never in its view.
//  - Easy: Normal's play, but 30% of its choices at random (a take from either, any card let go but a winning one).
//  - Normal: takes the pile's top card when it raises its score, else draws; lets go of the card that leaves the
//    best score (between equals, at random).
//  - Hard: by expected value over the cards it has not seen. A 3-card hand is worth `win` if it wins, else its chance
//    of winning on the next take (a draw from the unseen, each as likely) plus a small share of the score it can expect
//    from there; the take compares the pile's top card (its best discard after) against a draw's average; the discard
//    keeps the 3 cards worth most, less a guard (`guard`, by the card's points) on a card of a suit it has seen the
//    other side take off the pile: thrown, it lies on top for them.
export const T31_AI = { win: 1000, share: 0.01, easy: 30, guard: 0.12, needs: { start: 4.8, pair: 3, flush: 5.5, perPoint: 0.62, least: 2.4, perTurn: 0.5 } };
const other = p => (p === 'X' ? 'O' : 'X');
const best3 = h => { let b = -1, k = 0; for (let i = 0; i < h.length; i++) { const s = t31Score(h.filter((_, j) => j !== i)); if (s > b) { b = s; k = i; } } return { k, score: b }; };
// The cards `me` has not seen: the deck of 32 less its hand, the pile and what the other side took off the pile.
export function t31Unseen(pm, me) {
  const known = new Set([...((pm.hand && pm.hand[me]) || []), ...(pm.pile || []), ...((pm.seen && pm.seen[other(me)]) || [])]);
  return t31Deck().filter(c => !known.has(c));
}
// The chance a 3-card hand wins on its next take, and the score it can expect after it (the best 3 of 4).
function nextTake(h, unseen, target) {
  let win = 0, sum = 0;
  for (const c of unseen) { const s = best3(h.concat(c)).score; if (t31Won(s, target)) win++; sum += s; }
  return { p: unseen.length ? win / unseen.length : 0, e: unseen.length ? sum / unseen.length : t31Score(h) };
}
function worth(h, unseen, target) {
  const s = t31Score(h);
  if (t31Won(s, target)) return T31_AI.win;
  const n = nextTake(h, unseen, target);
  return n.p + T31_AI.share * n.e;
}
// The best discard of 4 cards for Hard: the 3 worth most (suits: the ones the other side is known to hold).
function hardDrop(h4, unseen, target, suits) {
  let best = -Infinity, k = 0;
  for (let i = 0; i < h4.length; i++) {
    const w = worth(h4.filter((_, j) => j !== i), unseen, target);
    const v = w >= T31_AI.win ? w : w - (suits && suits.has(h4[i][1]) ? T31_AI.guard * t31Val(h4[i]) / 11 : 0);
    if (v > best) { best = v; k = i; }
  }
  return { k, v: best };
}
// The turns still needed, about (tests/sim/t31.sim.js; a hand played alone by Normal, halved: two players feed one
// pile and the first to get there ends it): a hand with one or two cards of its best suit about 4.8 turns (two worth
// 20 or more: 3), three of a suit from 5.5 at 24 down to 2.4 at 29. The other side's hand is unseen: from public
// information alone, the turns a square takes less those it has taken, sooner once it has been seen to take two cards
// worth 20 of one suit off the pile.
export function needs(pm, p) {
  const target = t31Cfg(pm).target, k = goAgain(pm) ? 0.75 : 1, N = T31_AI.needs;
  const h = pm.hand && pm.hand[p];
  if (!Array.isArray(h)) {
    const known = t31Score((pm.seen && pm.seen[p]) || []), t = (pm.turns && pm.turns[p]) || 0;
    const blind = Math.max(N.least, N.start - N.perTurn * t);
    return k * (known >= 20 ? Math.min(blind, N.pair) : blind);
  }
  const b = t31Best(h);
  if (t31Won(b.score, target)) return 1;
  if (b.cards.length < 3) return k * (b.score >= 20 ? N.pair : N.start);
  return k * Math.max(N.least, Math.min(N.flush, N.flush - N.perPoint * (b.score - 24) + N.perPoint * Math.max(0, target - 30)));
}
export function best(pm, me, rng, style, ctx) {
  const lvl = ctx && ctx.level, target = t31Cfg(pm).target, h = pm.hand[me], held = pm.held && pm.held.by === me;
  const miss = tune(pm).miss, pile = pm.pile || [];
  const top = pile.length ? pile[pile.length - 1] : null;
  if (!held) {
    if ((lvl === 'easy' && rng() * 100 < T31_AI.easy) || (miss && rng() * 100 < miss)) return { move: top && rng() < 0.5 ? 'pile' : 'deck', q: 0 };
    const unseen = t31Unseen(pm, me);
    const pileBest = top ? best3(h.concat(top)).score : -1;
    if (top && t31Won(pileBest, target)) return { move: 'pile', q: 1 };
    const q = nextTake(h, unseen, target).p;
    if (lvl === 'hard') {
      const suits = new Set(((pm.seen && pm.seen[other(me)]) || []).map(c => c[1]));
      const pileV = top ? hardDrop(h.concat(top), unseen, target, suits).v : -Infinity;
      let deckV = 0;
      for (const c of unseen) deckV += Math.min(2, hardDrop(h.concat(c), unseen.filter(x => x !== c), target, suits).v);   // (a winning draw counts as a sure thing, no more)
      deckV /= Math.max(1, unseen.length);
      return { move: pileV > deckV ? 'pile' : 'deck', q };
    }
    return { move: top && pileBest > t31Score(h) ? 'pile' : 'deck', q };
  }
  // a winning discard first, at every level
  for (let i = 0; i < h.length; i++) if (t31Won(t31Score(h.filter((_, j) => j !== i)), target)) return { move: 'd' + i, q: 1 };
  if ((lvl === 'easy' && rng() * 100 < T31_AI.easy) || (miss && rng() * 100 < miss)) return { move: 'd' + randInt(rng, h.length), q: 0 };   // (a slip: any card)
  if (lvl === 'hard') { const suits = new Set(((pm.seen && pm.seen[other(me)]) || []).map(c => c[1])); return { move: 'd' + hardDrop(h, t31Unseen(pm, me), target, suits).k, q: 0 }; }
  let b = -1, ks = [];
  for (let i = 0; i < h.length; i++) { const s = t31Score(h.filter((_, j) => j !== i)); if (s > b) { b = s; ks = [i]; } else if (s === b) ks.push(i); }
  return { move: 'd' + ks[randInt(rng, ks.length)], q: 0 };
}
