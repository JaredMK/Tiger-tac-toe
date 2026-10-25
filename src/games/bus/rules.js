// Ride the Bus: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { CARD, cardDeck } from '../shared/cards.js';
import { tune } from '../../core/tune.js';

export function cardRank(c) { return CARD.ranks.indexOf(c[0]) + 2; }          // 2 lowest ... 14 the ace (Ride the Bus: ace high)
export function cardRed(c) { return c[1] === 'H' || c[1] === 'D'; }

// Ride the Bus: four rounds, each player on their own, each with their own deck. Round 1 red or black,
// round 2 higher or lower than card 1, round 3 inside or outside cards 1 and 2, round 4 the suit. A right
// guess keeps the card and goes straight on to the next round in the same turn; a wrong one discards it
// and ends the turn, with the cards already kept still kept. Every card is drawn from a freshly shuffled
// deck without the player's kept cards. The ace is high; a tie is wrong (an equal value in round 2, a
// value equal to either card in round 3; the admin's `ties` setting can make a tie right). Passing round 4
// takes the square.
export const BUS = { rounds: 4, guesses: [['red', 'black'], ['higher', 'lower'], ['inside', 'outside'], ['S', 'H', 'D', 'C']] };
export function busRight(kept, guess, card, tieOk) {
  const r = cardRank(card);
  switch (kept.length) {
    case 0: return (guess === 'red') === cardRed(card);
    case 1: { const a = cardRank(kept[0]); return (tieOk && r === a) || (guess === 'higher' ? r > a : r < a); }
    case 2: {
      const a = cardRank(kept[0]), b = cardRank(kept[1]), lo = Math.min(a, b), hi = Math.max(a, b);
      return (tieOk && (r === lo || r === hi)) || (guess === 'inside' ? r > lo && r < hi : r < lo || r > hi);
    }
    default: return card[1] === guess;
  }
}
// The cards still in a player's deck (everything but what they have kept).
export function busDeck(kept) { return cardDeck().filter(c => !kept.includes(c)); }
// The chance each guess for the next round is right, from the cards left in the deck.
export function busOdds(kept, tieOk) {
  const deck = busDeck(kept), r = Math.min(kept.length, BUS.rounds - 1);
  return BUS.guesses[r].map(g => ({ guess: g, p: deck.filter(c => busRight(kept, g, c, tieOk)).length / deck.length }));
}
export const busTies = mini => tune(mini).ties === 'right';   // (a tie: the admin's setting)
export function create(type, rng) {
  return { type, prog: { X: [], O: [] }, last: null };   // prog: each player's kept cards, one per round passed
}
export function apply(mini, p, m, rng, idx) {
  const kept = mini.prog[p], r = kept.length;
  if (r >= BUS.rounds || !BUS.guesses[r].includes(m)) return { ok: false, reason: 'bad' };
  const deck = busDeck(kept), card = deck[randInt(needRng(rng), deck.length)];
  const right = busRight(kept, m, card, busTies(mini));
  mini.last = { by: p, round: r, guess: m, card, right };
  if (!right) return { ok: true, outcome: 'continue', note: 'wrong' };   // the card is discarded; the turn ends
  kept.push(card);
  if (kept.length >= BUS.rounds) return { ok: true, outcome: 'win', note: 'right' };
  return { ok: true, outcome: 'continue', note: 'right', again: true };
}
export function publicView(mini) {
  return { type: 'bus', prog: { X: mini.prog.X.slice(), O: mini.prog.O.slice() } };
}
export const BUS_AVG = [0.5, 0.72, 0.6, 0.26];   // Ride the Bus: the usual chance of the best guess in each round
export function randomMove(mini, p, rng, from, empties) {
  return from(BUS.guesses[Math.min(mini.prog[p].length, BUS.rounds - 1)]);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.bus = { round: l.round, guess: l.guess, card: l.card, right: l.right, kept: mini.prog[p].slice() }; return;
}
export function flashMs(f, winLen, won) {
  return BUST.pre + BUST.draw + BUST.flip + BUST.mark + (f.bus && f.bus.right ? BUST.fly : 0) + (won ? 600 : 0);
}
export const BUST = { pre: 500, draw: 380, flip: 380, mark: 450, fly: 480 };
