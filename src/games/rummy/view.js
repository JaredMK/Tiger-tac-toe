// Rummy Lite: the screen, the miniature, the move's words and sounds, and the inputs (November 2026).
import { RMYT, rmyCfg, rmyMelds, rmySort, rmyTimes } from './rules.js';
import { N, REDUCED, mv, waitLine } from '../../ui/app.js';
import { pcard } from '../../ui/cards.js';
import { cfAnchor } from '../../ui/cardfly.js';
const RMYG = { gap: 60, fly: 220 };   // a reshuffle's gather (card motion): three backs from the pile into the deck, `gap` apart
import { cardName } from '../shared/cards.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG, pipRows, thumbArt, tinyCard } from '../../ui/thumbs.js';
import { mySide } from '../../net/room.js';

// The table (v 2: one deck and one pile for both): the shared deck (face down, how many left) and the shared pile (its
// top card face up) on the felt, Take by a tap on either; this phone's hand below (its own side alone: online from its
// side's node, net/room.js; against the computer the player's), sorted, every meld ringed in its colour; a tap on a card
// of the seven throws it. Above, the other hand as card backs (its count; its melds made as pips in the tally). A take
// slides a card into the taker's hand; a throw slides it onto the pile, and a meld made lights after it. Every row has
// its room from the start: nothing moves.
const W = p => `<b class="${p}">${N(p)}</b>`;
const meldSets = hand => rmyMelds(hand).melds;
const backs = (n, from) => Array.from({ length: Math.max(0, n) }, (_, k) => `<span class="rmyc rmyb">${pcard(null, from && k === n - 1 ? { down: true, from, slide: 0 } : { down: true })}</span>`).join('');   // (from: the last back just taken, flying in from the deck or the pile)
function handRow(hand, p, o, s, can, fresh) {
  const melds = meldSets(hand), inMeld = new Map();
  melds.forEach((m, k) => m.forEach(c => inMeld.set(c, k)));
  const lit = s && s.kind === 'discard' && s.n && !REDUCED ? RMYT.slide : null;
  // the melds first (each its own group, ringed), then the cards left, all in the hand's order
  const order = melds.flat().concat(hand.filter(c => !inMeld.has(c)));
  const cards = order.map((c, i) => {
    const k = inMeld.has(c) ? inMeld.get(c) : -1, first = k >= 0 && melds[k][0] === c, last = k >= 0 && melds[k][2] === c;
    const cls = `rmyc${k >= 0 ? ` rmym m${k}${first ? ' mf' : ''}${last ? ' ml' : ''}` : ''}${c === fresh ? ' new' : ''}`;
    const card = pcard(c, c === fresh && !REDUCED ? { slide: 0, from: s && s.kind === 'take' ? s.from : null } : s ? { from: 'card:' + c, wait: true } : {});   // (the taken card from the deck or the pile; the rest close up or make room)
    return can ? `<button class="${cls}"${cfAnchor('card:' + c)} data-act="move" ${mv({ d: c })} aria-label="Throw the ${cardName(c)}"${lit != null && k >= 0 ? ` style="--t:${lit}ms"` : ''}>${card}</button>`
      : `<span class="${cls}"${cfAnchor('card:' + c)}${lit != null && k >= 0 ? ` style="--t:${lit}ms"` : ''}>${card}</span>`;
  }).join('');
  return `<div class="rmyhand ${p}${lit != null ? ' lit' : ''}" style="--n:${hand.length}">${cards}</div>`;
}
const handN = (mini, p) => (mini.hn && Number.isInteger(mini.hn[p]) ? mini.hn[p] : Array.isArray(mini.hand && mini.hand[p]) ? mini.hand[p].length : rmyCfg(mini).hand);
function rummyTable(mini, a, o) {
  const s = a && a.rummy ? a.rummy : null, turn = o.turn, by = s ? a.by : mini.held ? mini.held.by : turn;
  const need = rmyCfg(mini).melds, held = mini.held && mini.held.by === by ? mini.held : null;
  const me = mySide() || by, other = me === 'X' ? 'O' : 'X', myHand = Array.isArray(mini.hand && mini.hand[me]) ? mini.hand[me] : null;
  const mine = !o.view && !o.locked && by === turn && by === me;
  const mc = p => Math.min(need, mini.mc && Number.isInteger(mini.mc[p]) ? mini.mc[p] : Array.isArray(mini.hand && mini.hand[p]) ? rmyMelds(mini.hand[p]).n : 0);
  const tal = p => {
    const n = mc(p), lit = s && s.kind === 'discard' && a.by === p && s.n && !REDUCED ? rmyTimes(s).light : null;
    return arcTally(p, o, `<span class="pips" aria-label="${n} of ${need} melds">${Array.from({ length: need }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', k < n && lit != null ? lit : null, 'fillin')}></i>`).join('')}</span>`);
  };
  const pile = Array.isArray(mini.pile) ? mini.pile : [], top = pile[pile.length - 1] || null, left = Number.isInteger(mini.left) ? mini.left : 0;
  const canTake = mine && !held, canThrow = mine && !!held && !!myHand;
  const thrown = s && s.kind === 'discard' && !REDUCED ? { slide: 0, from: a.by === me ? 'card:' + top : 'opp' } : {};   // (thrown from this phone's hand, or from the other one's backs)
  const gather = s && s.kind === 'take' && s.reshuf && !REDUCED ? `<span class="cfgath" aria-hidden="true">${[0, 1, 2].map(j => pcard(null, { down: true, from: 'pile', at: j * RMYG.gap, go: true, d: RMYG.fly })).join('')}</span>` : '';   // the deck run out: the pile under its top gathered in
  const deckBtn = `<button class="rmydeck"${cfAnchor('deck')} data-act="move" ${mv('deck')}${canTake ? '' : ' disabled tabindex="-1"'} aria-label="Take from the deck (${left} left)">${pcard(null, { down: true })}${gather}<span class="rmyn">${left}</span></button>`;
  const pileBtn = `<button class="rmypile"${cfAnchor('pile')} data-act="move" ${mv('pile')}${canTake && top ? '' : ' disabled tabindex="-1"'} aria-label="${top ? 'Take the top of the pile' : 'The pile is empty'}">${top ? pcard(top, thrown) : pcard(null, { cls: 'ghost' })}</button>`;
  const opp = `<div class="rmyopp ${other}"><svg class="rmymk" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(other, 6)}</svg><div class="rmyoh"${cfAnchor('opp')}>${backs(handN(mini, other), s && s.kind === 'take' && a.by === other && !REDUCED ? s.from : null)}</div></div>`;
  const fresh = held && held.by === me ? held.c : null;
  let line;
  if (s && s.kind === 'take') line = `<p class="arcres" role="status">${W(a.by)} took ${s.from === 'pile' ? 'the pile\'s card' : 'from the deck'}${s.reshuf ? ' · deck shuffled' : ''}</p>`;
  else if (s && s.kind === 'discard') line = `<p ${lateAt('arcres' + (s.n ? ' ok' : ''), s.n && !REDUCED ? rmyTimes(s).light : null)} role="status">${s.n ? `${s.n} meld${s.n === 1 ? '' : 's'}` : 'Thrown'}</p>`;
  else if (o.view) line = '<p class="arcnote"></p>';
  else if (mine) line = `<p class="arcres">${held ? 'Throw a card' : 'Take a card'}</p>`;
  else line = `<p class="arcnote">${o.locked || by !== turn ? waitLine(by) : ''}</p>`;
  const hand = myHand ? handRow(myHand, me, o, s && a.by === me ? s : null, canThrow, fresh) : `<div class="rmyhand ${me}" style="--n:${handN(mini, me)}">${backs(handN(mini, me))}</div>`;
  return `<div class="g-arc rmy"><div class="ctals">${tal('X')}${tal('O')}</div>${opp}<div class="cfelt rmyfelt"><span class="rmywho">${W(by)}</span>${deckBtn}${pileBtn}</div>${hand}${line}</div>`;
}
// The miniature (public alone: the hands are each side's own): each player's hand as card backs in a row, the pile's top
// card between, and the melds made as pips.
export function miniature(mini, final) {
  const need = rmyCfg(mini).melds, n = p => Math.min(need, mini.mc && Number.isInteger(mini.mc[p]) ? mini.mc[p] : 0);
  const row = p => `<div class="trmyh">${Array.from({ length: Math.min(8, handN(mini, p)) }, () => tinyCard(null, 'trmyb ' + p)).join('')}</div>`;
  const top = Array.isArray(mini.pile) && mini.pile.length ? mini.pile[mini.pile.length - 1] : null;
  return thumbArt(`<div class="trmy">${row('X')}<div class="trmyp">${tinyCard(top, '', true)}</div>${row('O')}</div>`, pipRows({ X: n('X'), O: n('O') }, need), 'trmyw', `Rummy Lite: X ${n('X')}, O ${n('O')} of ${need} melds`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = rummyTable(mini, a, { view, locked, turn, done: !!d }); return g;
}
export function moveText(f, who) {
  const r = f.rummy;
  if (!r) return `${who} played`;
  if (r.kind === 'take') return `${who} took ${r.from === 'pile' ? 'from the pile' : 'from the deck'}`;
  return r.n ? `${who} threw a card · ${r.n} meld${r.n === 1 ? '' : 's'}` : `${who} threw a card`;
}
// A take: the card sliding in; a throw: the card sliding onto the pile, and a ding as a meld lights.
export function sounds(f, add, won, mini, last) {
  const r = f.rummy;
  if (!r) return;
  add('cardSlide', 0);
  if (r.kind === 'discard' && r.n) add('ding', rmyTimes(r).light);
}
// The square's line while the turn is held to it (ui/mini.js heldSub): a card taken, one to throw; or, with "Go again
// on success" on, a meld made and another take.
export function heldSub(mini, turn, f) {
  if (f) return '';
  return mini.held && mini.held.by === turn ? `${W(turn)}: throw a card` : `${W(turn)} made a meld · goes again`;
}
