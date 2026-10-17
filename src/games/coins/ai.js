// Coin Flip: the computer's play.
import { other } from '../../core/util.js';
import { COINS, COIN_NEEDS, coinMarksFor } from './rules.js';

export function needs(pm, p) {
  return COIN_NEEDS[pm.coins.filter(c => c !== p).length];
}
export function best(pm, me, rng, style, ctx) {
  // Every coin that isn't mine gets flipped when there are three or fewer: each must land mine.
  // With none of my own showing, the flip could also land them all the other side's way.
  // With the coins already marked, the chances are exact: the rest must already all show one side.
  const theirs = pm.coins.filter(c => c !== me).length, flips = Math.min(theirs, COINS.max);
  const marked = coinMarksFor(pm, me);
  if (marked) {
    const rest = pm.coins.filter((c, k) => !marked.includes(k)), pw = Math.pow(0.5, marked.length);
    return { move: 'flip', q: rest.every(c => c === me) ? pw : 0, qLose: rest.every(c => c === other(me)) ? pw : 0 };
  }
  const q = theirs <= COINS.max ? Math.pow(0.5, theirs) : 0;
  const qLose = theirs === pm.coins.length && pm.coins.includes(COINS.mystery) ? flips / theirs * Math.pow(0.5, flips) : 0;
  return { move: 'flip', q, qLose };
}
