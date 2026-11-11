// Thirty-One: the computer's play.
import { randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
import { t31Cfg, t31Score, t31Unseen, t31Won } from './rules.js';

// Everything the computer reckons with is public: its hand, its discard pile, and so the cards it has not seen (its
// hidden deck is those, in an order nobody knows; a draw is any of them, each as likely).
//  - Easy: Normal's play, but 40% of its choices at random (a take from either, any card let go but a winning one).
//  - Normal: takes the pile's top card when it raises its score, else draws; lets go of the card that leaves the
//    best score (between equals, at random).
//  - Hard: by expected value over the unseen cards. A 3-card hand is worth `win` if it wins, else its chance of
//    winning on the next take (a draw from the unseen, or its own discard back) plus a small share of the score it can
//    expect from there; the take compares the pile's top card (its best discard after) against a draw's average; the
//    discard keeps the 3 cards worth most.
export const T31_AI = { win: 1000, share: 0.01, easy: 40 };
const best3 = h => { let b = -1, k = 0; for (let i = 0; i < h.length; i++) { const s = t31Score(h.filter((_, j) => j !== i)); if (s > b) { b = s; k = i; } } return { k, score: b }; };
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
// The best discard of 4 cards for Hard: the 3 worth most.
function hardDrop(h4, unseen, target) {
  let best = -Infinity, k = 0;
  for (let i = 0; i < h4.length; i++) { const v = worth(h4.filter((_, j) => j !== i), unseen, target); if (v > best) { best = v; k = i; } }
  return { k, v: best };
}
export function needs(pm, p) {                                        // the turns still needed, about: the points to go at about 2.5 a turn (tests/sim/t31.sim.js)
  const target = t31Cfg(pm).target, s = t31Score(pm.hand[p].slice(0, 3));
  if (t31Won(s, target)) return 1;
  return Math.max(1, (target - s) / (goAgain(pm) ? 3.5 : 2.5));
}
export function best(pm, me, rng, style, ctx) {
  const lvl = ctx && ctx.level, target = t31Cfg(pm).target, h = pm.hand[me], held = pm.held && pm.held.by === me;
  const miss = tune(pm).miss;
  const top = pm.pile[me].length ? pm.pile[me][pm.pile[me].length - 1] : null;
  if (!held) {
    if ((lvl === 'easy' && rng() * 100 < T31_AI.easy) || (miss && rng() * 100 < miss)) return { move: top && rng() < 0.5 ? 'pile' : 'deck', q: 0 };
    const unseen = t31Unseen(pm, me);
    const pileBest = top ? best3(h.concat(top)).score : -1;
    const q = top && t31Won(pileBest, target) ? 1 : nextTake(h, unseen, target).p;
    if (top && t31Won(pileBest, target)) return { move: 'pile', q: 1 };
    if (lvl === 'hard') {
      const after = unseen.filter(c => c !== top), pileV = top ? hardDrop(h.concat(top), after, target).v : -Infinity;
      let deckV = 0;
      for (const c of unseen) deckV += hardDrop(h.concat(c), unseen.filter(x => x !== c).concat(top ? [] : []), target).v;
      deckV /= Math.max(1, unseen.length);
      return { move: pileV > deckV ? 'pile' : 'deck', q };
    }
    return { move: top && pileBest > t31Score(h) ? 'pile' : 'deck', q };
  }
  // a winning discard first, at every level
  for (let i = 0; i < h.length; i++) if (t31Won(t31Score(h.filter((_, j) => j !== i)), target)) return { move: 'd' + i, q: 1 };
  if ((lvl === 'easy' && rng() * 100 < T31_AI.easy) || (miss && rng() * 100 < miss)) return { move: 'd' + randInt(rng, h.length), q: 0 };   // (a slip: any card)
  if (lvl === 'hard') return { move: 'd' + hardDrop(h, t31Unseen(pm, me), target).k, q: 0 };
  let b = -1, ks = [];
  for (let i = 0; i < h.length; i++) { const s = t31Score(h.filter((_, j) => j !== i)); if (s > b) { b = s; ks = [i]; } else if (s === b) ks.push(i); }
  return { move: 'd' + ks[randInt(rng, ks.length)], q: 0 };
}
