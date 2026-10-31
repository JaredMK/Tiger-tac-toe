// Blackjack: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { BJT, bjNatural, bjPlan, bjTotal } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { toon } from '../../ui/art.js';
import { pcard } from '../../ui/cards.js';
import { lateAt } from '../../ui/progress.js';

// Blackjack: when each card comes in is bjPlan in the engine (the turn clock and the sounds use it too).
const BJ_RES = { bj: 'Natural 21! +1', push: 'Tie', bust: 'Bust', lose: 'Dealer wins' };
const bjResText = r => (r.res === 'win' ? 'Wins +1' : r.res === 'lose' && r.dealerBj ? 'Dealer natural 21' : BJ_RES[r.res]);
function bjTotalText(cards) {
  const t = bjTotal(cards);
  return t.total > 21 ? `Bust · ${t.total}` : bjNatural(cards) ? 'Natural 21' : `${t.soft && t.total < 21 ? 'Soft ' : ''}${t.total}`;
}
function bjTable(mini, a, o) {
  const b = a && a.bj ? a.bj : null, h = mini.hand, l = mini.last, turn = o.turn;
  const plan = b ? bjPlan(b) : null;
  // The hands on the table: during a move, the one it played (and after a push, the new hand dealt at
  // `swap`, when the pushed one clears); otherwise the hand in play, or the last one played.
  const hands = [];
  if (b) {
    hands.push({ hand: b, P: plan.P, D: plan.D, pEnd: plan.pEnd, end: plan.end, until: plan.swap, pushed: !!b.next });
    if (b.next) hands.push({ hand: b.next, P: plan.NP, D: plan.ND, pEnd: plan.nPEnd, end: plan.nEnd, from: plan.swap });
  } else if (h) hands.push({ hand: { cards: h.cards, dealer: [h.up], hole: true } });
  else if (l) hands.push({ hand: l });
  const by = b ? a.by : h ? h.by : l ? l.by : null, anim = !!b;
  const layer = (H, inner, cls) => `<div class="bjset ${cls || ''}${H.until != null ? ' tu' : ''}${H.from != null ? ' tf' : ''}"${H.until != null || H.from != null ? ` style="${H.until != null ? `--u:${H.until}ms;` : ''}${H.from != null ? `--f:${H.from}ms` : ''}"` : ''}>${inner}</div>`;
  const at = (arr, k) => (arr && arr[k]) || {};
  const dealerSet = H => {
    const x = H.hand, cards = x.dealer.map((c, k) => pcard(c, { slide: at(H.D, k).slideAt, flip: at(H.D, k).flipAt })).join('') + (x.hole ? pcard(null, { down: true, slide: at(H.D, 1).slideAt }) : '');
    const txt = x.hole ? `shows ${bjTotal([x.dealer[0]]).total}` : bjTotalText(x.dealer);
    const shownAt = anim && x.hole && H.D && H.D[0] && H.D[0].flipAt != null ? H.D[0].flipAt + BJT.flip : anim && x.hole ? H.pEnd : null;   // (the up card's value as soon as it has turned)
    return layer(H, `<span class="bjlab">Dealer <b ${lateAt('bjtot', anim && !x.hole ? H.end : shownAt)}>${txt}</b></span><div class="bjcards">${cards}</div>`);
  };
  const playerSet = H => {
    const x = H.hand, cards = x.cards.map((c, k) => pcard(c, { slide: at(H.P, k).slideAt, flip: at(H.P, k).flipAt })).join('');
    const lastP = H.P && H.P.length ? H.P[H.P.length - 1] : null, totAt = anim ? (lastP && lastP.flipAt != null ? lastP.flipAt + BJT.flip : H.pEnd) : null;   // the total the moment the last card is face up
    return layer(H, `<span class="bjlab"><b class="${by}">${N(by)}</b> <b ${lateAt('bjtot', totAt)}>${bjTotalText(x.cards)}</b></span><div class="bjcards">${cards}</div>`);
  };
  const bannerSet = H => {
    const x = H.hand;
    const inner = x.res ? `<div ${lateAt('bjres ' + x.res, anim ? H.end : null)} role="status">${toon(by)}<span>${H.pushed ? 'Tie: a new hand' : bjResText(x)}</span></div>` : '<div class="bjres none">&nbsp;</div>';
    return layer(H, inner);
  };
  const ghost = `<div class="bjset"><span class="bjlab">&nbsp;</span><div class="bjcards">${pcard(null, { down: true, cls: 'ghost' })}</div></div>`;
  // the tallies: a pip fills when its hand is won, as its result shows
  const won = b ? (b.next ? b.next : b) : null, wonAt = b ? (b.next ? plan.nEnd : plan.end) : null;
  const goal = tune(mini).goal, tally = p => {
    const w = Math.min(goal, mini.wins[p]), fresh = won && won.res && won.gain && a.by === p ? won.gain : 0;
    const pips = Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < w ? 'on' : '', k < w && k >= w - fresh ? wonAt : null, 'fillin')}></i>`).join('');
    return `<div class="ctal ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p} tnm">${N(p)}</b><span class="pips" aria-label="${mini.wins[p]} of ${goal} wins">${pips}</span></div>`;
  };
  const mine = !!h && h.by === turn;
  const btns = o.view ? '' : !h
    ? `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('deal')}${o.locked ? ' disabled' : ''}>Deal</button></div>`
    : `<div class="cbtns two"><button class="big ${turn}" data-act="move" ${mv('hit')}${o.locked || !mine ? ' disabled' : ''}>Hit</button><button class="big bank" data-act="move" ${mv('stand')}${o.locked || !mine ? ' disabled' : ''}>Stand</button></div>`;
  const dealer = hands.length ? hands.map(dealerSet).join('') : ghost, player = hands.length ? hands.map(playerSet).join('') : ghost;
  const mid = hands.length ? hands.map(bannerSet).join('') : '<div class="bjset"><div class="bjres none">&nbsp;</div></div>';
  return `<div class="g-bj"><div class="ctals">${tally('X')}${tally('O')}</div>
    <div class="felt"><div class="bjrow dealer bjstack">${dealer}</div><div class="bjstack bjmid">${mid}</div><div class="bjrow player bjstack">${player}</div></div>
    ${btns}</div>`;
}
export function miniature(mini, final) {
  return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: tune(mini).goal }, (_, k) => `<i class="${k < mini.wins[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = bjTable(mini, a, { view, locked, turn }); return g;
}
export function moveText(f, who) {
  return f.bj && f.bj.next ? `${who}: push, a new hand` : f.bj && f.bj.res ? `${who}: ${bjResText(f.bj)}` : f.bj && f.bj.act === 'hit' ? `${who} hits` : `${who} is dealt a hand`;
}
export function sounds(f, add, won, mini, last) {   // every card slides and turns, as bjPlan has it; then the result
  const b = f.bj;
  if (!b) return;
  const pl = bjPlan(b);
  for (const c of pl.P.concat(pl.D, pl.NP || [], pl.ND || [])) { if (!c) continue; if (c.slideAt != null) add('cardSlide', c.slideAt); if (c.flipAt != null) add('cardFlip', c.flipAt); }
  const result = (x, end, pEnd) => {
    if (x.res === 'win' || x.res === 'bj') { add('chips', end); if (x.gain > 1) add('chips', end + 170); }
    else if (x.res === 'push') add('push', end);
    else if (x.res === 'bust') add('bust', pEnd);
    else if (x.res === 'lose') add('nopair', end);
  };
  result(b, pl.end, pl.pEnd);
  if (b.next) result(b.next, pl.nEnd, pl.nPEnd);              // after a push, the new hand (when a natural settles it at once)
  return;
}
