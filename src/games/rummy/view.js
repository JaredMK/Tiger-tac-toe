// Rummy Lite: the screen, the miniature, the move's words and sounds, and the inputs (November 2026).
import { RMYT, rmyCfg, rmyMelds, rmySort, rmyTimes } from './rules.js';
import { N, REDUCED, mv, waitLine } from '../../ui/app.js';
import { pcard } from '../../ui/cards.js';
import { cardName } from '../shared/cards.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG, pipRows, thumbArt, tinyCard } from '../../ui/thumbs.js';

// The table of the player on the move (or whose move is playing): their deck (face down, how many left) and their pile
// (its top card face up) on the felt, Take by a tap on either; their hand below, sorted by suit and rank, every meld
// in it ringed in their colour; a tap on a card of the seven throws it. Above, the other player's hand small, its
// melds tinted. A take slides the card from the pile or the deck into the hand; a throw slides it onto the pile, and
// a meld made lights after it. Every row has its room from the start: nothing moves.
const W = p => `<b class="${p}">${N(p)}</b>`;
const meldSets = hand => rmyMelds(hand).melds;
function handRow(hand, p, o, s, can) {
  const melds = meldSets(hand), inMeld = new Map();
  melds.forEach((m, k) => m.forEach(c => inMeld.set(c, k)));
  const fresh = s && s.kind === 'take' ? s.c : null, lit = s && s.kind === 'discard' && s.n && !REDUCED ? RMYT.slide : null;
  // the melds first (each its own group, ringed), then the cards left, all in the hand's order
  const order = melds.flat().concat(hand.filter(c => !inMeld.has(c)));
  const cards = order.map((c, i) => {
    const k = inMeld.has(c) ? inMeld.get(c) : -1, first = k >= 0 && melds[k][0] === c, last = k >= 0 && melds[k][2] === c;
    const cls = `rmyc${k >= 0 ? ` rmym m${k}${first ? ' mf' : ''}${last ? ' ml' : ''}` : ''}${c === fresh ? ' new' : ''}`;
    const card = pcard(c, c === fresh && !REDUCED ? { slide: 0 } : {});
    return can ? `<button class="${cls}" data-act="move" ${mv({ d: c })} aria-label="Throw the ${cardName(c)}"${lit != null && k >= 0 ? ` style="--t:${lit}ms"` : ''}>${card}</button>`
      : `<span class="${cls}"${lit != null && k >= 0 ? ` style="--t:${lit}ms"` : ''}>${card}</span>`;
  }).join('');
  return `<div class="rmyhand ${p}${lit != null ? ' lit' : ''}" style="--n:${hand.length}">${cards}</div>`;
}
function rummyTable(mini, a, o) {
  const s = a && a.rummy ? a.rummy : null, turn = o.turn, by = s ? a.by : mini.held ? mini.held.by : turn, other = by === 'X' ? 'O' : 'X';
  const need = rmyCfg(mini).melds, held = mini.held && mini.held.by === by ? mini.held : null;
  const mine = !o.view && !o.locked && by === turn;
  const tal = p => {
    const n = Math.min(need, rmyMelds(mini.hand[p]).n), lit = s && s.kind === 'discard' && a.by === p && s.n && !REDUCED ? rmyTimes(s).light : null;
    return arcTally(p, o, `<span class="pips" aria-label="${n} of ${need} melds">${Array.from({ length: need }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', k < n && lit != null ? lit : null, 'fillin')}></i>`).join('')}</span>`);
  };
  const pile = mini.pile[by] || [], top = pile[pile.length - 1] || null, left = mini.left ? mini.left[by] : 0;
  const canTake = mine && !held, canThrow = mine && !!held;
  const thrown = s && s.kind === 'discard' && !REDUCED ? { slide: 0 } : {};
  const deckBtn = `<button class="rmydeck" data-act="move" ${mv('deck')}${canTake ? '' : ' disabled tabindex="-1"'} aria-label="Take from your deck (${left} left)">${pcard(null, { down: true })}<span class="rmyn">${left}</span></button>`;
  const pileBtn = `<button class="rmypile" data-act="move" ${mv('pile')}${canTake && top ? '' : ' disabled tabindex="-1"'} aria-label="${top ? 'Take the top of your pile' : 'Your pile is empty'}">${top ? pcard(top, thrown) : pcard(null, { cls: 'ghost' })}</button>`;
  const opp = `<div class="rmyopp ${other}"><svg class="rmymk" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(other, 6)}</svg><div class="rmyoh">${(() => { const h = mini.hand[other], mm = meldSets(h), inM = new Set(mm.flat()); return mm.flat().concat(h.filter(c => !inM.has(c))).map(c => tinyCard(c, inM.has(c) ? 'rmyti ' + other : '')).join(''); })()}</div></div>`;
  let line;
  if (s && s.kind === 'take') line = `<p class="arcres" role="status">${W(a.by)} took ${s.from === 'pile' ? 'the pile\'s card' : 'from the deck'}${s.reshuf ? ' · deck shuffled' : ''}</p>`;
  else if (s && s.kind === 'discard') line = `<p ${lateAt('arcres' + (s.n ? ' ok' : ''), s.n && !REDUCED ? rmyTimes(s).light : null)} role="status">${s.n ? `${s.n} meld${s.n === 1 ? '' : 's'}` : 'Thrown'}</p>`;
  else if (o.view) line = '<p class="arcnote"></p>';
  else if (mine) line = `<p class="arcres">${held ? 'Throw a card' : 'Take a card'}</p>`;
  else line = `<p class="arcnote">${o.locked || by !== turn ? waitLine(by) : ''}</p>`;
  return `<div class="g-arc rmy"><div class="ctals">${tal('X')}${tal('O')}</div>${opp}<div class="cfelt rmyfelt"><span class="rmywho">${W(by)}</span>${deckBtn}${pileBtn}</div>${handRow(mini.hand[by], by, o, s && a.by === by ? s : null, canThrow)}${line}</div>`;
}
// The miniature: each player's hand as tiny cards in a row, their melds first and tinted in their colour, with the
// melds made beside as pips.
export function miniature(mini, final) {
  const need = rmyCfg(mini).melds, row = p => { const h = mini.hand[p], mm = meldSets(h), inM = new Set(mm.flat()); return `<div class="trmyh">${mm.flat().concat(rmySort(h.filter(c => !inM.has(c)))).map(c => tinyCard(c, inM.has(c) ? 'trmym ' + p : '', true)).join('')}</div>`; };
  const n = p => Math.min(need, rmyMelds(mini.hand[p]).n);
  return thumbArt(`<div class="trmy">${row('X')}${row('O')}</div>`, pipRows({ X: n('X'), O: n('O') }, need), 'trmyw', `Rummy Lite: X ${n('X')}, O ${n('O')} of ${need} melds`);
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
