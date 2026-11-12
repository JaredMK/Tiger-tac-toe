// Blackjack: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { BJT, bjNatural, bjPlan, bjTotal } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { toon } from '../../ui/art.js';
import { pcard } from '../../ui/cards.js';
import { cfAnchor } from '../../ui/cardfly.js';
import { lateAt } from '../../ui/progress.js';
import { pipRows, thumbArt, tinyCard } from '../../ui/thumbs.js';

// Blackjack: when each card comes in is bjPlan in the engine (the turn clock and the sounds use it too).
const BJ_RES = { bj: 'Natural 21! +1', push: 'Tie', bust: 'Bust', lose: 'Dealer wins' };
const bjResText = r => (r.res === 'win' ? 'Wins +1' : r.res === 'lose' && r.dealerBj ? 'Dealer natural 21' : BJ_RES[r.res]);
function bjTotalText(cards) {
  const t = bjTotal(cards);
  return t.total > 21 ? `Bust · ${t.total}` : bjNatural(cards) ? 'Natural 21' : `${t.soft && t.total < 21 ? 'Soft ' : ''}${t.total}`;
}
// A hand's total as its cards land: one pill per step, each showing from its moment (`at`, ms into the move; null:
// there from the start) until the next takes over, stacked in one place so the label never changes shape.
function bjTots(steps) {
  const st = steps.filter(x => x && x.txt);
  return `<span class="bjtots">${st.map((x, k) => {
    const next = st[k + 1], cls = `bjtot${x.cls ? ' ' + x.cls : ''}${x.at != null ? ' tin' : ''}${next ? ' tout' : ''}`;
    const style = [x.at != null ? `--f:${Math.round(x.at)}ms` : '', next ? `--u:${Math.round(next.at)}ms` : ''].filter(Boolean).join(';');
    return `<b class="${cls}"${style ? ` style="${style}"` : ''}>${x.txt}</b>`;
  }).join('')}</span>`;
}
const bjTotCls = cards => { const t = bjTotal(cards).total; return t > 21 ? 'over' : t === 21 ? 'top' : ''; };
const BJ_ICON = {   // the buttons' pictures: a card coming (Deal, Hit), a flat hand (Stand)
  deal: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><rect x="3.5" y="6" width="10" height="14" rx="2" transform="rotate(-12 8.5 13)"/><rect x="10.5" y="4" width="10" height="14" rx="2" fill="currentColor" fill-opacity=".25" transform="rotate(10 15.5 11)"/></svg>',
  hit: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><rect x="3.5" y="4" width="11" height="16" rx="2.2"/><path d="M19 8.5v7M15.8 12h6.4" stroke-width="3"/></svg>',
  stand: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><path d="M7 12V6.5a1.6 1.6 0 0 1 3.2 0V11m0-5.8a1.6 1.6 0 0 1 3.2 0V11m0-4.6a1.6 1.6 0 0 1 3.2 0V12m0-2.8a1.6 1.6 0 0 1 3.2 0V15c0 3.6-2.6 6-6.2 6-3 0-4.6-1.4-6-3.6L4.3 13.6a1.6 1.6 0 0 1 2.6-1.8L8.2 14"/></svg>',
};
function bjTable(mini, a, o) {
  const b = a && a.bj ? a.bj : null, h = mini.hand, l = mini.last, turn = o.turn;
  const plan = b ? bjPlan(b) : null;
  // The hands on the table: during a move, the one it played (and after a tie, the new hand dealt at
  // `swap`, when the tied one is swept off); otherwise the hand in play, or the last one played. A fresh
  // deal sweeps the hand before it off the felt as its first card leaves the shoe.
  const hands = [];
  if (b) {
    if (!b.from && !b.res && l && Array.isArray(l.cards)) hands.push({ hand: l, by: l.by, until: 0, old: true });
    hands.push({ hand: b, P: plan.P, D: plan.D, pEnd: plan.pEnd, end: plan.end, until: plan.swap, pushed: !!b.next, live: true });
    if (b.next) hands.push({ hand: b.next, P: plan.NP, D: plan.ND, pEnd: plan.nPEnd, end: plan.nEnd, from: plan.swap, live: true });
  } else if (h) hands.push({ hand: { cards: h.cards, dealer: [h.up], hole: true } });
  else if (l) hands.push({ hand: l });
  const by = b ? a.by : h ? h.by : l ? l.by : null;
  const layer = (H, inner, cls) => `<div class="bjset ${cls || ''}${H.until != null ? ' bjout' : ''}${H.from != null ? ' tf' : ''}"${H.until != null || H.from != null ? ` style="${H.until != null ? `--u:${H.until}ms;` : ''}${H.from != null ? `--f:${H.from}ms` : ''}"` : ''}>${inner}</div>`;
  const at = (arr, k) => (arr && arr[k]) || {};
  const up = (c, end) => (c.flipAt != null ? Math.min(c.flipAt + BJT.flip, end != null ? end : Infinity) : null);   // the moment a card is face up
  const resAt = H => (H.hand.res === 'bust' ? H.pEnd : H.end);   // a bust shows as its card lands; every other result once the dealer has played
  const dealerSet = H => {
    const x = H.hand, live = !!H.live;
    const cards = x.dealer.map((c, k) => pcard(c, { slide: at(H.D, k).slideAt, flip: at(H.D, k).flipAt, from: at(H.D, k).slideAt != null ? 'deck' : null })).join('') + (x.hole ? pcard(null, { down: true, slide: at(H.D, 1).slideAt, from: at(H.D, 1).slideAt != null ? 'deck' : null }) : '');
    // the dealer's total: what the up card shows while the other is down, then counted on as each card turns
    const steps = [], shows = `shows ${bjTotal([x.dealer[0]]).total}`;
    if (!live) steps.push({ txt: x.hole ? shows : bjTotalText(x.dealer), cls: x.hole ? '' : bjTotCls(x.dealer) });
    else {
      const d0 = at(H.D, 0);
      steps.push({ txt: shows, at: d0.slideAt != null ? up(d0) : null });
      if (!x.hole) for (let k = 1; k < x.dealer.length; k++) { const t = up(at(H.D, k), H.end); if (t != null) steps.push({ txt: bjTotalText(x.dealer.slice(0, k + 1)), cls: bjTotCls(x.dealer.slice(0, k + 1)), at: t }); }
      if (!x.hole && steps.length === 1) steps[0] = { txt: bjTotalText(x.dealer), cls: bjTotCls(x.dealer), at: steps[0].at };
    }
    const fx = live && x.res === 'win' && bjTotal(x.dealer).total > 21 ? ` shk" style="--t:${H.end}ms` : '';   // (the dealer goes over: its cards shake)
    return layer(H, `<span class="bjlab">Dealer ${bjTots(steps)}</span><div class="bjcards${fx}">${cards}</div>`);
  };
  const playerSet = H => {
    const x = H.hand, live = !!H.live, who = H.by || by;
    const cards = x.cards.map((c, k) => pcard(c, { slide: at(H.P, k).slideAt, flip: at(H.P, k).flipAt, from: at(H.P, k).slideAt != null ? 'deck' : null })).join('');
    // the player's total, counted on the moment each card is face up
    const steps = [], first = live ? x.cards.findIndex((c, k) => at(H.P, k).flipAt != null) : -1;
    if (first < 0) steps.push({ txt: bjTotalText(x.cards), cls: bjTotCls(x.cards) });
    else {
      if (first > 0) steps.push({ txt: bjTotalText(x.cards.slice(0, first)), cls: bjTotCls(x.cards.slice(0, first)) });
      for (let k = first; k < x.cards.length; k++) { const part = x.cards.slice(0, k + 1); steps.push({ txt: part.length === 1 ? String(bjTotal(part).total) : bjTotalText(part), cls: bjTotCls(part), at: up(at(H.P, k)) }); }
    }
    const fx = !live || !x.res ? '' : x.res === 'bust' ? ` shk" style="--t:${H.pEnd}ms` : x.res === 'win' || x.res === 'bj' ? ` hop" style="--t:${H.end}ms` : '';
    return layer(H, `<span class="bjlab"><b class="${who}">${N(who)}</b> ${bjTots(steps)}</span><div class="bjcards mine${fx}">${cards}</div>`);
  };
  const bannerSet = H => {
    const x = H.hand, who = H.by || by;
    const inner = x.res ? `<div ${lateAt(`bjres ${x.res} ${who}`, H.live ? resAt(H) : null)} role="status">${toon(who)}<span>${H.pushed ? 'Tie: a new hand' : bjResText(x)}</span></div>` : '<div class="bjres none">&nbsp;</div>';
    return layer(H, inner);
  };
  const ghost = `<div class="bjset"><span class="bjlab">&nbsp;</span><div class="bjcards">${pcard(null, { down: true, cls: 'ghost' })}${pcard(null, { down: true, cls: 'ghost' })}</div></div>`;
  // the tallies: a pip fills when its hand is won, as its result shows
  const won = b ? (b.next ? b.next : b) : null, wonAt = b ? (b.next ? plan.nEnd : plan.end) : null;
  const goal = tune(mini).goal, tally = p => {
    const w = Math.min(goal, mini.wins[p]), fresh = won && won.res && won.gain && a.by === p ? won.gain : 0;
    const pips = Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < w ? 'on' : '', k < w && k >= w - fresh ? wonAt : null, 'fillin')}></i>`).join('');
    return `<div class="ctal ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p} tnm">${N(p)}</b><span class="pips" aria-label="${mini.wins[p]} of ${goal} wins">${pips}</span></div>`;
  };
  // The buttons: Deal between hands, Hit and Stand in one. While a move plays out they stay as they were pressed
  // (the one pressed lit in its player's colour), and only then change: nothing swaps under a hand being played.
  const act = b ? b.act : null, who = b ? a.by : turn, mine = !!h && h.by === turn;
  const btn = (m, label, cls, off) => `<button class="big ${cls}${act === m ? ` chosen ${who}` : ''}" data-act="move" ${mv(m)}${off ? ' disabled' : ''}>${BJ_ICON[m]}<span>${label}</span></button>`;
  const btns = o.view ? '' : (b ? act === 'deal' : !h)
    ? `<div class="cbtns one bjbtns">${btn('deal', 'Deal', who, o.locked)}</div>`
    : `<div class="cbtns two bjbtns">${btn('hit', 'Hit', who, o.locked || !!b || !mine)}${btn('stand', 'Stand', 'bank', o.locked || !!b || !mine)}</div>`;
  const dealer = hands.length ? hands.map(dealerSet).join('') : ghost, player = hands.length ? hands.map(playerSet).join('') : ghost;
  const mid = hands.length ? hands.map(bannerSet).join('') : '<div class="bjset"><div class="bjres none">&nbsp;</div></div>';
  return `<div class="g-bj"><div class="ctals">${tally('X')}${tally('O')}</div>
    <div class="felt bjfelt"><span class="bjshoe"${cfAnchor('deck')} aria-hidden="true">${pcard(null, { down: true })}</span><div class="bjrow dealer bjstack">${dealer}</div><div class="bjstack bjmid">${mid}</div><div class="bjrow player bjstack">${player}</div></div>
    ${btns}</div>`;
}
// The miniature: the hand in play's cards fanned (the player's own, face up on the table; two backs before a deal;
// never the hole card or the deck), and each player's hands won as pips.
export function miniature(mini, final) {
  const h = mini.hand, goal = tune(mini).goal;
  const cards = h && Array.isArray(h.cards) && h.cards.length ? h.cards.slice(0, 3).map(c => tinyCard(c)).join('') : tinyCard(null) + tinyCard(null);
  return thumbArt(`<div class="tbj">${cards}</div>`, pipRows(mini.wins, goal), 'tcol', `21: X ${mini.wins.X}, O ${mini.wins.O} of ${goal} hands`);   // (the hand above the pips: room for cards whose ranks read at the board's text size)
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
  const result = (x, end, pEnd) => {                          // the result's sound as it shows (a bust: as its card lands), with its buzz (ui/haptics.js)
    if (x.res === 'bj') { add('chips', end); add('sparkle', end); }
    else if (x.res === 'win') { add('chips', end); add('point', end); }
    else if (x.res === 'push') add('push', end);
    else if (x.res === 'bust') add('bust', pEnd);
    else if (x.res === 'lose') { add('nopair', end); add('thud', end); }
  };
  result(b, pl.end, pl.pEnd);
  if (b.next) result(b.next, pl.nEnd, pl.nPEnd);              // after a push, the new hand (when a natural settles it at once)
  return;
}
