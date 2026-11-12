// Thirty-One: the screen, the miniature, the move's words and sounds, and the inputs (November 2026; one deck, one pile
// and private hands from the rework, v 2).
import { T31, t31Best, t31Cfg, t31Score, t31Times } from './rules.js';
import { N, REDUCED, mv, waitLine } from '../../ui/app.js';
import { pcard, cardShort } from '../../ui/cards.js';
import { cfAnchor } from '../../ui/cardfly.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG, thumbArt, tinyCard } from '../../ui/thumbs.js';
import { mySide } from '../../net/room.js';
export const T31G = { gap: 60, fly: 220, deal: 180 };   // a reshuffle's gather (card motion): three backs from the pile into the deck, `gap` apart, then the take after `deal`

// The table: the felt with the other player's hand at the top (card backs: it is theirs alone), the shared deck (face
// down, its count on it) and the shared pile (its top card up, the one under it peeking out) in the middle, each a tap to
// take, and this phone's own hand at the bottom (its own side alone: online from its side's node, net/room.js; against
// the computer the player's), the best suit's cards lit, each card a tap to let go once a card is taken. The tallies:
// this side's score against the target, counted on as a card lands; the other side's is theirs alone ("?") until the
// square is won, when both hands are open. A take slides the card into the taker's hand (a deck card of one's own
// turning up as it lands; the other side's a back, unless it came off the pile); a discard slides it onto the pile.
// Every row has its room from the start (a hand of 4 at most): nothing moves.
const W = p => `<b class="${p}">${N(p)}</b>`;
const other = p => (p === 'X' ? 'O' : 'X');
const SUIT = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
const pileOf = mini => (Array.isArray(mini.pile) ? mini.pile : []);
const handN = (mini, p) => (mini.hn && Number.isInteger(mini.hn[p]) ? mini.hn[p] : Array.isArray(mini.hand && mini.hand[p]) ? mini.hand[p].length : T31.hand);
// p's hand as this page holds it, in step with the public record (the side's own node can be a moment behind it: a card
// just thrown is gone, a card just taken off the pile is there); null: not this page's to see.
export function t31Hand(mini, p) {
  if (!mini.hand || !Array.isArray(mini.hand[p])) return null;
  const h = mini.hand[p].slice(), n = handN(mini, p), l = mini.last, held = mini.held;
  if (h.length === n + 1 && l && l.kind === 'drop' && l.by === p && h[l.k] === l.card) h.splice(l.k, 1);
  if (h.length === n - 1 && held && held.by === p && held.card && !h.includes(held.card)) h.push(held.card);
  return h;
}
// The hand as it was before p's discard `s` (the card back in its place): four cards, the taken one last.
const before4 = (hand, s) => { const h = hand.slice(); h.splice(Math.min(h.length, s.k), 0, s.card); return h; };
// What the tally shows for a hand, step by step through a move of its player's (pure): { now, was, at }: `now` the hand's
// score (a hand of four: its best three), `was` the figure it counts on from at `at` ms into the move (null: no change).
export function t31Tally(hand, s, mine) {
  const now = t31Score(hand);
  if (!s || !mine) return { now, was: null, at: null };
  if (s.kind === 'take') { const was = t31Score(hand.slice(0, T31.hand)); return { now, was: hand.length > T31.hand && was !== now ? was : null, at: T31.slide + (s.from === 'deck' ? T31.flip : 0) }; }
  const was = t31Score(before4(hand, s));
  return { now, was: was !== now ? was : null, at: T31.land };
}
function t31Table(sq, mini, a, o) {
  const s = a && a.t31 ? a.t31 : null, turn = o.turn, target = t31Cfg(mini).target, anim = !!s && !REDUCED;
  const held = mini.held, by = s ? a.by : held ? held.by : turn;
  const me = mySide() || by, opp = other(me), open = o.view || !!(sq && sq.owner);   // (open: a square won, or looked back at: both hands are on the record)
  const mine = !o.view && !o.locked && by === turn && by === me, canTake = mine && !held, canDrop = mine && !!held && held.by === me;
  const hand = { [me]: t31Hand(mini, me), [opp]: open ? t31Hand(mini, opp) : null };
  const tim = t31Times(s);
  // the tallies: a hand this page holds as its score (counted on as the card lands); a hand it does not: "?"
  const tal = p => {
    const h = hand[p];
    if (!h) return arcTally(p, o, `<span class="t31sc hid" aria-label="Score hidden, ${target} to win"><b>?</b><small>/${target}</small></span>`);
    const t = t31Tally(h, s && a.by === p ? s : null, !!a && a.by === p), late = anim && s.won && p !== me;   // (late: the other hand, turned up as the winning card lands: its score with it)
    const num = t.was != null && anim && !late ? `<b class="cnt" data-from="${t.was}" data-delay="${t.at}">${t.now}</b>` : `<b${late ? ` ${lateAt('', T31.land)}` : ''}>${t.now}</b>`;
    return arcTally(p, o, `<span class="t31sc${t31Best(h).score >= target || t.now === 31 ? ' top' : ''}" aria-label="${t.now} of ${target}">${num}<small>/${target}</small></span>`);
  };
  // the deck and the pile: one of each, for both
  const pile = pileOf(mini), top = pile.length ? pile[pile.length - 1] : null, under = pile.length > 1 ? pile[pile.length - 2] : null, left = Number.isInteger(mini.left) ? mini.left : 0;
  const takeNow = s && s.kind === 'take' && anim, dropNow = s && s.kind === 'drop' && anim;
  // a deck run out: the pile but its top gathered into the deck first (a few backs flying across), then the take
  const gather = takeNow && s.from === 'deck' && s.reshuf ? `<span class="cfgath" aria-hidden="true">${[0, 1, 2].map(j => pcard(null, { down: true, from: 'pile', at: j * T31G.gap, go: true, d: T31G.fly })).join('')}</span>` : '';
  const takeAt = takeNow && s.reshuf ? T31G.deal : 0;
  const deckBtn = `<button class="t31deck${canTake ? ' can' : ''}"${cfAnchor('deck')} data-act="move" ${mv('deck')} aria-label="Draw from the deck, ${left} cards"${canTake ? '' : ' disabled tabindex="-1"'}><span class="t31stk" aria-hidden="true"></span>${pcard(null, { down: true })}${gather}<span class="t31n">${left}</span></button>`;
  const dropFrom = dropNow ? (a.by === me ? 'card:' + s.card : 'opp:' + s.k) : null;
  const pileCard = top ? pcard(top, dropFrom ? { slide: 0, cls: a.by === me ? 't31in' : 't31od', from: dropFrom } : {}) : '<span class="t31slot t31e" aria-hidden="true"></span>';
  const pileBtn = `<button class="t31pile${canTake && top ? ' can' : ''}"${cfAnchor('pile')} data-act="move" ${mv('pile')} aria-label="${top ? 'Take the top of the discard pile' : 'The discard pile is empty'}"${canTake && top ? '' : ' disabled tabindex="-1"'}>${under ? `<span class="t31un" aria-hidden="true">${pcard(under)}</span>` : ''}${pileCard}</button>`;
  // this phone's hand: the best suit's cards lit; the card just taken sliding in; the cards after one let go closing up
  const mineRow = () => {
    const h = hand[me] || [], lit = new Set(t31Best(h).cards), n = handN(mini, me);
    const myTake = takeNow && a.by === me, myDrop = dropNow && a.by === me;
    const cards = Array.from({ length: T31.hand + 1 }, (_, k) => {
      const c = h[k];
      if (!c) return k < n ? `<span class="t31c t31w">${pcard(null, { down: true })}</span>` : '<span class="t31slot" aria-hidden="true"></span>';   // (a card of its own the page does not hold yet: a back)
      const fresh = myTake && k === h.length - 1 && k === T31.hand;
      const shift = myDrop && k >= s.k;                              // (a card after the one let go closes the gap)
      const card = pcard(c, fresh ? (s.from === 'deck' ? { slide: takeAt, flip: takeAt + T31.slide, cls: 't31dk', from: 'deck', at: takeAt } : { slide: 0, cls: 't31pk', from: 'pile' }) : shift ? { from: 'card:' + c, wait: true } : {});
      const cls = `t31c${lit.has(c) ? ' best' : ''}${held && held.by === me && k === T31.hand ? ' new' : ''}${fresh ? ' tk' : ''}${canDrop ? ' can' : ''}`;
      const litAt = fresh || (lit.has(c) && anim && a.by === me) ? ` style="--t:${t31Tally(h, s, true).at}ms${fresh ? `;--nt:${takeAt + T31.slide}ms` : ''}"` : '';   // (--t: the best suit's hop as the score lands; --nt: the taken card's dot as it arrives)
      const act = by === me ? ` data-act="move" ${mv('d' + k)}` : '';   // (the other side's turn: no move of this hand's to press, so their 'd2' replayed never lands on this hand's card)
      return `<button class="${cls}"${litAt}${cfAnchor('card:' + c)}${act} aria-label="Let go of this card"${canDrop ? '' : ' disabled tabindex="-1"'}>${card}</button>`;
    }).join('');
    return `<div class="t31hand ${me}${anim && a.by === me ? ' lit' : ''}"><svg class="t31mk ${me}" viewBox="-10 -10 20 20" aria-label="${me}'s hand">${markSvgG(me, 6.5)}</svg><div class="t31row">${cards}</div></div>`;
  };
  // the other hand: backs (a card off the pile was on show: face up while it is the one in hand); a square won: turned up
  const oppRow = () => {
    const n = handN(mini, opp), h = hand[opp], lit = h ? new Set(t31Best(h).cards) : null;
    const oppTake = takeNow && a.by === opp, shownCard = held && held.by === opp && held.from === 'pile' ? held.card : null;
    const cards = Array.from({ length: T31.hand + 1 }, (_, k) => {
      if (k >= n) return `<span class="t31slot"${cfAnchor('opp:' + k)} aria-hidden="true"></span>`;
      const last = k === n - 1 && n > T31.hand, fly = oppTake && last ? { slide: takeAt, from: s.from, at: takeAt } : {};
      const c = h ? h[k] : last ? shownCard : null;
      const card = c ? pcard(c, h && anim && s.won ? { flip: T31.land + k * 60 } : fly) : pcard(null, Object.assign({ down: true }, fly));
      return `<span class="t31o${lit && lit.has(c) ? ' best' : ''}"${cfAnchor('opp:' + k)}>${card}</span>`;
    }).join('');
    return `<div class="t31opp ${opp}"><svg class="t31mk ${opp}" viewBox="-10 -10 20 20" aria-label="${opp}'s hand">${markSvgG(opp, 5.5)}</svg><div class="t31orow">${cards}</div></div>`;
  };
  // the line: what the move did (a score only where the page holds the hand), else whose turn it waits for
  let line;
  const shuf = s && s.reshuf ? '<small class="t31sh">Deck shuffled</small>' : '';
  if (s && s.kind === 'take') line = `<p ${lateAt('arcres', anim ? tim.land : null)} role="status">${a.by === me && hand[me] && hand[me].length > T31.hand ? `Took ${cardShort(hand[me][hand[me].length - 1])}` : s.card ? `${W(a.by)} took ${cardShort(s.card)}` : `${W(a.by)} drew a card`}${shuf}</p>`;
  else if (s && s.kind === 'drop') {
    const h = hand[a.by], b = h ? t31Best(h) : null, up = b && b.score > t31Score(before4(h, s).slice(0, T31.hand));
    line = `<p ${lateAt('arcres' + (up || (b && s.won) ? ' ok' : ''), anim ? T31.land : null)} role="status">${b ? (b.score === 31 ? '31!' : `${b.score} in ${SUIT[b.suit] || 'one suit'}`) : `${W(a.by)} threw ${cardShort(s.card)}`}</p>`;
  } else line = `<p class="arcnote">${o.view ? '' : o.locked || by !== turn || by !== me ? waitLine(by) : ''}</p>`;
  return `<div class="g-arc t31"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="t31felt pc-${by}${dropNow ? ' cfup' : ''}">${oppRow()}<div class="t31top">${deckBtn}${pileBtn}</div>${line}${mineRow()}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = t31Table(sq, mini, a, { view, locked, turn, done: !!d }); return g;
}
// The miniature (public alone: the hands and their scores are each side's own): the felt with the deck and the pile's
// top card, and each player's hand as card backs beside their mark (four while a card is taken).
export function miniature(mini, final) {
  const pile = pileOf(mini), top = pile.length ? pile[pile.length - 1] : null;
  const art = `<div class="tt31f"><i class="tcd cdb"></i>${top ? tinyCard(top, 'tt31p') : '<i class="tcd tt31e"></i>'}</div>`;
  const rows = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span class="tt31h">${Array.from({ length: Math.min(4, handN(mini, p)) }, () => tinyCard(null, 'tt31b ' + p)).join('')}</span></div>`).join('');
  return thumbArt(art, rows, 'tt31w', `Thirty-One: X holds ${handN(mini, 'X')} cards, O ${handN(mini, 'O')}; ${t31Cfg(mini).target} in one suit wins`);
}
export function moveText(f, who) {
  const s = f.t31;
  if (!s) return `${who} played`;
  if (s.kind === 'take') return `${who} ${s.from === 'deck' ? 'drew a card' : 'took from the pile'}`;
  return s.auto ? `${who} ran out of time` : s.won ? `${who}: ${s.won.score} in one suit` : `${who} threw a card`;
}
// A take: the card sliding in (a turn as a deck card of one's own shows; a shuffle first when the deck ran out); a
// discard: the slide and the card's snap onto the pile, then, for a hand this page holds, a ding as the score rises (a
// sparkle at a win) or a soft no-pair when it falls.
export function sounds(f, add, won, mini, last) {
  const s = f.t31;
  if (!s) return;
  const me = mySide() || f.by, h = mini && f.by === me ? t31Hand(mini, me) : null;
  if (s.kind === 'take') {
    const at = s.reshuf ? T31G.deal : 0;
    if (s.reshuf) { add('cardSlide', 0, 1.2); add('cardSlide', T31G.gap, 1.3); add('cardSlide', 2 * T31G.gap, 1.4); }
    add('cardSlide', at); if (s.from === 'deck' && h) add('cardFlip', at + T31.slide);
    return;
  }
  add('cardSlide', 0); add('cardFlip', T31.slide);
  if (won || s.won) { add('sparkle', T31.land); return; }
  if (!h) return;
  const now = t31Score(h), was = t31Score(before4(h, s).slice(0, T31.hand));
  if (now > was) add('ding', T31.land); else if (now < was) add('nopair', T31.land);
}
// The square's line while the turn is held to it (ui/mini.js): a card taken, one to let go; or, with "Go again on success"
// on, a raised score taking again.
export function heldSub(mini, turn, f) {
  if (f) return '';
  return mini.held && mini.held.by === turn ? `${W(turn)}: a card taken` : `${W(turn)} raised the score · goes again`;
}
