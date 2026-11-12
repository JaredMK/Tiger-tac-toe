// Rummy Lite: the screen, the miniature, the move's words and sounds, and the inputs (November 2026).
import { RMYT, rmyCfg, rmyMelds, rmySort, rmyTimes } from './rules.js';
import { N, REDUCED, mv, state, waitLine } from '../../ui/app.js';
import { pcard, cardShort } from '../../ui/cards.js';
import { cfAnchor } from '../../ui/cardfly.js';
import { cardName } from '../shared/cards.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG, pipRows, thumbArt, tinyCard } from '../../ui/thumbs.js';
import { mySide } from '../../net/room.js';

// The table (v 2: one deck and one pile for both; the polish sweep: Thirty-One's sibling): one felt with the other
// player's hand at the top (card backs: it is theirs alone; a card they took off the pile was on show and is face up
// while it is the one in hand), the shared deck (face down, its count on it) and the shared pile (its top card up, the
// one under it peeking out: the pile is open) in the middle, each a tap to take, the move's line, and this phone's own
// hand at the bottom (its own side alone: online from its side's node, net/room.js; against the computer the
// player's): the melds first, each ringed in the player's colour, then the cards left; a tap on a card of the seven
// throws it. A take flies the card into the taker's hand (a deck card of one's own turning up as it lands; the other
// side's a back, unless it came off the pile), the hand making room; a throw flies it onto the pile, the hand closing
// up, and a new meld lights as it lands (the tally's pip filling with it). A square won: both hands are on the record
// and the other one is turned up. The cards are one size whatever the hand holds (a hand of seven's): nothing moves.
const W = p => `<b class="${p}">${N(p)}</b>`;
const other = p => (p === 'X' ? 'O' : 'X');
const pileOf = mini => (Array.isArray(mini.pile) ? mini.pile : []);
const handN = (mini, p) => (mini.hn && Number.isInteger(mini.hn[p]) ? mini.hn[p] : Array.isArray(mini.hand && mini.hand[p]) ? mini.hand[p].length : rmyCfg(mini).hand);
// p's hand as this page holds it, in step with the public record (the side's own node can be a moment behind it: a card
// just thrown is gone, a card just taken off the pile is there); null: not this page's to see.
export function rmyHand(mini, p) {
  if (!mini.hand || !Array.isArray(mini.hand[p])) return null;
  let h = mini.hand[p].slice();
  const n = handN(mini, p), l = mini.last, held = mini.held;
  if (h.length === n + 1 && l && l.kind === 'discard' && l.by === p && h.includes(l.d)) h.splice(h.indexOf(l.d), 1);
  if (h.length === n - 1 && held && held.by === p && held.c && !h.includes(held.c)) h = rmySort(h.concat(held.c));
  return h;
}
// A hand laid out: its melds first (each a group), then the cards left, in the hand's order.
function laid(hand) {
  const melds = rmyMelds(hand).melds, at = new Map();
  melds.forEach((m, k) => m.forEach(c => at.set(c, k)));
  return { melds, at, order: melds.flat().concat(hand.filter(c => !at.has(c))) };
}
// Did this throw make a meld (the move's note: 'meld' a new one, 'melds' the last one needed)?
const madeMeld = a => !!a && (a.note === 'meld' || a.note === 'melds');
let kept = null;                                                   // { key, hand }: this side's hand as last drawn on this square (see below)
function rummyTable(sq, mini, a, o) {
  const s = a && a.rummy ? a.rummy : null, turn = o.turn, cfg = rmyCfg(mini), need = cfg.melds, anim = !!s && !REDUCED;
  const held = mini.held, by = s ? a.by : held ? held.by : turn;
  const me = mySide() || by, opp = other(me), open = o.view || !!(sq && sq.owner);   // (open: a square won, or looked back at: both hands are on the record)
  const mine = !o.view && !o.locked && by === turn && by === me, canTake = mine && !held, canThrow = mine && !!held && held.by === me;
  const hand = { [me]: rmyHand(mini, me), [opp]: open ? rmyHand(mini, opp) : null };
  // (online, the other side's move replays on the square as it was before it, which is the public record alone: this
  // side's hand, unchanged by their move, is the one last drawn here, so its cards never turn to backs meanwhile)
  const key = `${state.online ? state.online.game || state.online.code || '' : ''}:${state.zoom}:${me}`;
  if (hand[me]) kept = { key, hand: hand[me].slice() };
  else if (state.online && kept && kept.key === key && kept.hand.length === handN(mini, me)) hand[me] = kept.hand.slice();
  const tim = rmyTimes(s, a ? a.note : null), takeNow = anim && s.kind === 'take', throwNow = anim && s.kind === 'discard', up = s && s.kind === 'discard' && madeMeld(a);
  const takeAt = takeNow ? tim.at : 0;
  // the tallies: the melds each hand holds, as pips (public: how many, never which); a new one fills as the throw lands
  const mc = p => Math.min(need, mini.mc && Number.isInteger(mini.mc[p]) ? mini.mc[p] : hand[p] ? rmyMelds(hand[p]).n : 0);
  const tal = p => {
    const n = mc(p), lit = up && a.by === p && anim ? tim.light : null;
    return arcTally(p, o, `<span class="pips" aria-label="${n} of ${need} melds">${Array.from({ length: need }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', k === n - 1 && lit != null ? lit : null, 'fillin')}></i>`).join('')}</span>`);
  };
  // the deck and the pile: one of each, for both
  const pile = pileOf(mini), top = pile.length ? pile[pile.length - 1] : null, under = pile.length > 1 ? pile[pile.length - 2] : null, left = Number.isInteger(mini.left) ? mini.left : 0;
  // a deck run out: the pile but its top gathered into the deck first (a few backs flying across), then the take
  const gather = takeNow && s.reshuf ? `<span class="cfgath" aria-hidden="true">${[0, 1, 2].map(j => pcard(null, { down: true, from: 'pile', at: j * RMYT.gap, go: true, d: RMYT.fly })).join('')}</span>` : '';
  const deckBtn = `<button class="rmydeck${canTake ? ' can' : ''}"${cfAnchor('deck')} data-act="move" ${mv('deck')}${canTake ? '' : ' disabled tabindex="-1"'} aria-label="Take from the deck (${left} left)"><span class="rmystk" aria-hidden="true"></span>${pcard(null, { down: true })}${gather}<span class="rmyn">${left}</span></button>`;
  const thrown = throwNow ? { slide: 0, cls: a.by === me ? 'rmyin' : 'rmyod', from: a.by === me ? 'card:' + top : 'opp' } : {};   // (thrown from its place in this phone's hand, or from the other one's backs)
  const pileBtn = `<button class="rmypile${canTake && top ? ' can' : ''}"${cfAnchor('pile')} data-act="move" ${mv('pile')}${canTake && top ? '' : ' disabled tabindex="-1"'} aria-label="${top ? 'Take the top of the pile' : 'The pile is empty'}">${under ? `<span class="rmyun" aria-hidden="true">${pcard(under)}</span>` : ''}${top ? pcard(top, thrown) : '<span class="rmyslot rmye" aria-hidden="true"></span>'}</button>`;
  // this phone's hand: the melds ringed, the card just taken marked; a take makes room for it, a throw closes up
  const mineRow = () => {
    const h = hand[me] || [], n = handN(mini, me), L = laid(h);
    const myMove = anim && a.by === me, myTake = takeNow && a.by === me;
    const fresh = held && held.by === me && held.c && h.includes(held.c) ? held.c : null;
    // (a card taken that completes a meld: its meld hops as it lands; a throw that leaves a new meld: the melds hop)
    const tookMeld = myTake && fresh && L.at.has(fresh) && rmyMelds(h.filter(c => c !== fresh)).n < L.melds.length ? L.at.get(fresh) : -1;
    const hopAt = tookMeld >= 0 ? tim.land : up && myMove ? tim.light : null;
    const cardEl = c => {
      const k = L.at.has(c) ? L.at.get(c) : -1, isNew = c === fresh;
      const card = pcard(c, isNew && myTake ? (s.from === 'deck' ? { slide: takeAt, flip: takeAt + RMYT.slide, cls: 'rmydk', from: 'deck', at: takeAt } : { slide: 0, cls: 'rmypk', from: 'pile' }) : myMove ? { from: 'card:' + c, wait: true } : {});   // (the rest make room, or close up)
      const hop = hopAt != null && k >= 0 && (tookMeld < 0 || k === tookMeld);
      const cls = `rmyc${k >= 0 ? ' rmym' : ''}${isNew ? ' new' : ''}${isNew && myTake ? ' tk' : ''}${canThrow ? ' can' : ''}${hop ? ' hop' : ''}`;
      const st = hop || (isNew && myTake) ? ` style="${hop ? `--t:${Math.round(hopAt + L.melds[k].indexOf(c) * 50)}ms;` : ''}${isNew && myTake ? `--nt:${Math.round(tim.land)}ms` : ''}"` : '';
      return canThrow ? `<button class="${cls}"${st}${cfAnchor('card:' + c)} data-act="move" ${mv({ d: c })} aria-label="Throw the ${cardName(c)}">${card}</button>`
        : `<span class="${cls}"${st}${cfAnchor('card:' + c)}>${card}</span>`;
    };
    const groups = L.melds.map(m => `<span class="rmygrp">${m.map(cardEl).join('')}</span>`).join('') + L.order.slice(L.melds.length * 3).map(cardEl).join('');
    // (a card of its own the page does not hold yet, its node a moment behind the record: a back, flying in as the card will)
    const waits = Array.from({ length: Math.max(0, n - h.length) }, (_, j) => `<span class="rmyc rmyw">${pcard(null, Object.assign({ down: true }, myTake && j === n - h.length - 1 ? { slide: takeAt, from: s.from, at: takeAt } : {}))}</span>`).join('');
    return `<div class="rmyhand ${me}" aria-label="Your hand">${groups}${waits}</div>`;
  };
  // the other hand: backs (a card off the pile was on show: face up while it is the one in hand); a square won: turned up
  const oppRow = () => {
    const n = handN(mini, opp), h = hand[opp], L = h ? laid(h) : null, slots = cfg.hand + 1;
    const oppTake = takeNow && a.by === opp, shown = !h && held && held.by === opp && held.from === 'pile' && held.c ? held.c : null;
    const turnUp = h && anim && sq && sq.owner && !o.view;            // (the winning throw: their hand turns up as it lands)
    const cards = Array.from({ length: slots }, (_, k) => {
      if (k >= n) return `<span class="rmyslot"${k === n ? cfAnchor('opp') : ''} aria-hidden="true"></span>`;
      const last = k === n - 1 && n > cfg.hand, fly = oppTake && last ? { slide: takeAt, from: s.from, at: takeAt } : {};
      const c = h ? L.order[k] : last ? shown : null;
      const card = c ? pcard(c, turnUp ? { flip: tim.light + k * 50 } : fly) : pcard(null, Object.assign({ down: true }, fly));
      return `<span class="rmyo${L && L.at.has(c) ? ' rmym' : ''}">${card}</span>`;
    }).join('');
    return `<div class="rmyopp ${opp}"><svg class="rmymk ${opp}" viewBox="-10 -10 20 20" aria-label="${opp}'s hand">${markSvgG(opp, 5.5)}</svg><div class="rmyoh">${cards}</div></div>`;
  };
  // the line: what the move did, else whose turn it waits for
  let line;
  const shuf = s && s.reshuf ? '<small class="rmysh">Deck shuffled</small>' : '';
  if (s && s.kind === 'take') {
    const fresh = a.by === me && held && held.by === me && held.c ? held.c : null;
    line = `<p ${lateAt('arcres', anim ? tim.land : null)} role="status">${fresh ? `Took ${cardShort(fresh)}` : s.c ? `${W(a.by)} took ${cardShort(s.c)}` : `${W(a.by)} drew a card`}${shuf}</p>`;
  } else if (s && s.kind === 'discard') {
    line = up ? `<p ${lateAt('arcres ok', anim ? tim.light : null)} role="status">${a.note === 'melds' ? `${s.n} melds!` : 'Meld!'}</p>`
      : `<p ${lateAt('arcres', anim ? tim.land : null)} role="status">${W(a.by)} threw ${s.d ? cardShort(s.d) : 'a card'}</p>`;
  } else line = `<p class="arcnote">${o.view ? '' : o.locked || by !== turn || by !== me ? waitLine(by) : ''}</p>`;
  return `<div class="g-arc rmy"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="rmyfelt${throwNow ? ' cfup' : ''}">${oppRow()}<div class="rmytop">${deckBtn}${pileBtn}</div>${line}${mineRow()}</div></div>`;
}
// The miniature (public alone: the hands are each side's own): the felt with the deck and the pile's top card (the one
// face on the board), and the melds each player holds as pips.
export function miniature(mini, final) {
  const need = rmyCfg(mini).melds, n = p => Math.min(need, mini.mc && Number.isInteger(mini.mc[p]) ? mini.mc[p] : 0);
  const pile = pileOf(mini), top = pile.length ? pile[pile.length - 1] : null;
  const art = `<div class="trmyf"><i class="tcd cdb"></i>${top ? tinyCard(top, 'trmyp') : '<i class="tcd trmye"></i>'}</div>`;
  return thumbArt(art, pipRows({ X: n('X'), O: n('O') }, need), 'trmyw', `Rummy Lite: X ${n('X')}, O ${n('O')} of ${need} melds`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = rummyTable(sq, mini, a, { view, locked, turn, done: !!d }); return g;
}
export function moveText(f, who) {
  const r = f.rummy;
  if (!r) return `${who} played`;
  if (r.kind === 'take') return `${who} took ${r.from === 'pile' ? 'from the pile' : 'from the deck'}`;
  return r.n ? `${who} threw a card · ${r.n} meld${r.n === 1 ? '' : 's'}` : `${who} threw a card`;
}
// A take: the card sliding in (a turn as a deck card of one's own shows; a shuffle first when the deck ran out); a
// throw: the slide and the card's snap onto the pile, then a ding as a new meld lights (a sparkle for the last one).
export function sounds(f, add, won, mini, last) {
  const r = f.rummy;
  if (!r) return;
  const t = rmyTimes(r, f.note);
  if (r.kind === 'take') {
    if (r.reshuf) { add('cardSlide', 0, 1.2); add('cardSlide', RMYT.gap, 1.3); add('cardSlide', 2 * RMYT.gap, 1.4); }
    add('cardSlide', t.at);
    if (r.from === 'deck' && f.by === (mySide() || f.by)) add('cardFlip', t.land);
    return;
  }
  add('cardSlide', 0); add('cardFlip', t.land);
  if (won || f.note === 'melds') add('sparkle', t.light);
  else if (f.note === 'meld') add('ding', t.light);
}
// The square's line while the turn is held to it (ui/mini.js heldSub): a card taken, one to throw; or, with "Go again
// on success" on, a meld made and another take.
export function heldSub(mini, turn, f) {
  if (f) return '';
  return mini.held && mini.held.by === turn ? `${W(turn)}: throw a card` : `${W(turn)} made a meld · goes again`;
}
