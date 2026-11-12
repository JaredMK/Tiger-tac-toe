// Ride the Bus: the screen, the miniature, the move's words and sounds, and the inputs.
import { tinyCard } from '../../ui/thumbs.js';
import { CARD } from '../shared/cards.js';
import { BUS, BUST, cardRank, cardRed } from './rules.js';
import { N, app, cpuPlays, mv, state } from '../../ui/app.js';
import { CROSS, TICK } from '../../ui/art.js';
import { SUIT_PATH, cardShort, pcard, suitSvg } from '../../ui/cards.js';
import { lateAt } from '../../ui/progress.js';

// Ride the Bus: both players' four slots (the cards kept, or the round still to pass), the deck and the
// card just drawn (it slides off the deck, turns, and goes to its slot or is crossed out), the question
// for the player on the move and its answers.
// Each round's picture (its slot until the card is kept), and each answer's (its button): the same drawing in both
// places, so a round reads the same on the route and under the finger.
const SVG = (inner, attr) => `<svg class="bi" viewBox="0 0 24 24" aria-hidden="true"${attr || ' fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"'}>${inner}</svg>`;
const BARS = (a, b) => `<path d="M${a} 4.5v15M${b} 4.5v15"/>`, DOT = x => `<circle cx="${x}" cy="12" r="2.7" fill="currentColor" stroke="none"/>`;
const BUS_ICON = [
  SVG('<circle cx="8.2" cy="12" r="5.2" fill="#d6301e"/><circle cx="15.8" cy="12" r="5.2" fill="#161210"/>', ' '),
  SVG('<path d="m6.5 9.5 5.5-5.5 5.5 5.5M6.5 14.5l5.5 5.5 5.5-5.5"/>'),
  SVG(BARS(5.5, 18.5) + DOT(12)),
  SVG(`<path d="${SUIT_PATH.S}" transform="translate(1 1) scale(.45)"/><path d="${SUIT_PATH.H}" fill="#d6301e" transform="translate(12 1) scale(.45)"/><path d="${SUIT_PATH.D}" fill="#d6301e" transform="translate(1 12) scale(.45)"/><path d="${SUIT_PATH.C}" transform="translate(12 12) scale(.45)"/>`, ' fill="currentColor"'),
];
const pair = (a, b) => `<span class="bpair" aria-hidden="true">${suitSvg(a)}${suitSvg(b)}</span>`;
const BUS_BTN = {
  red: pair('H', 'D'), black: pair('S', 'C'),
  higher: SVG('<path d="M12 19.5v-14M5.5 11 12 4.5l6.5 6.5" stroke-width="3.6"/>'), lower: SVG('<path d="M12 4.5v14M5.5 13l6.5 6.5 6.5-6.5" stroke-width="3.6"/>'),
  inside: SVG(BARS(5.5, 18.5) + DOT(12)), outside: SVG(BARS(9, 15) + DOT(3.2) + DOT(20.8)),
};
// The bus that rides each player's route (their colour, an original drawing), and the flag at its end.
const BUS_ART = '<svg viewBox="0 0 30 18" aria-hidden="true"><rect class="bb" x="1.5" y="1.5" width="27" height="12" rx="3.2"/><path class="bw" d="M5 4.5h4.6v3.6H5zM11.6 4.5h4.6v3.6h-4.6zM18.2 4.5h6.3l1.4 3.6h-7.7z"/><circle class="bt" cx="8" cy="14.2" r="2.6"/><circle class="bt" cx="22" cy="14.2" r="2.6"/></svg>';
const FLAG_ART = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 16.5V2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path class="ff" d="M4.6 2.6h10.2l-2.6 3.3 2.6 3.3H4.6z"/></svg>';
const BUS_SAY = { red: 'Red', black: 'Black', higher: 'Higher', lower: 'Lower', inside: 'Inside', outside: 'Outside', S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
function busQuestion(kept) {
  switch (kept.length) {
    case 0: return 'Red or black?';
    case 1: return `Higher or lower than ${cardShort(kept[0])}?`;
    case 2: return `Inside or outside ${cardShort(kept[0])} and ${cardShort(kept[1])}?`;
    default: return 'Which suit?';
  }
}
// What the guess came to, for the stage's result line: a card level with a kept one says so (a tie counts as the
// square's setting has it, not as the eye might guess).
function busResult(b, kept) {
  const r = cardRank(b.card), level = (b.round === 1 && r === cardRank(kept[0])) || (b.round === 2 && (r === cardRank(kept[0]) || r === cardRank(kept[1])));
  return level ? `Same value: ${b.right ? 'right!' : 'wrong'}` : b.right ? (b.round === BUS.rounds - 1 ? 'All four!' : 'Right!') : 'Wrong';
}
export function busPre(f) { return f && f.type === 'bus' && (f.timeout || (state.online ? f.by !== state.online.me : cpuPlays(f.by))) ? BUST.pre : 0; }
// The moments of a guess, ms into the move: the card leaves the deck, turns over (face up at `face`), the
// tick or cross shows (`mark`), and only then, if right, the card flies to its slot (`fly`), landing at `land`
// (the bus rides to its next stop under it, arriving with it).
function busTimes(f) {
  const T = BUST, pre = busPre(f), face = pre + T.draw + T.flip;
  return { pre, flip: pre + T.draw, face, mark: face, fly: face + T.mark, land: face + T.mark + T.fly };
}
function busTable(mini, a, o) {
  const b = a && a.bus ? a.bus : null, turn = o.turn, tm = b ? busTimes(a) : null;
  const icon = k => `<span class="bsl-ico" aria-hidden="true">${BUS_ICON[k]}</span>`;
  // Each player's route: four stops (the card kept there, or the round still to pass) over a road, their bus under
  // the stop they are at and a flag at the end. While a guess plays out, nothing here changes until the card has
  // turned and the result shows: a right card flies to its stop and lands at `land`, the bus riding along under it,
  // and only then does the next round light up.
  const row = p => {
    const kept = mini.prog[p], gained = !!b && a.by === p && b.right, missed = !!b && a.by === p && !b.right, before = gained ? kept.slice(0, -1) : kept, k0 = before.length;
    const live = !o.view && p === turn, done = kept.length >= BUS.rounds;   // the row of the player on the move; all four passed
    const slots = Array.from({ length: BUS.rounds }, (_, k) => {
      const wave = done ? ` style="--i:${k}${gained ? `;--ld:${tm.land}ms` : ''}"` : '';
      if (k < k0) return `<span class="busslot"${wave}><span class="bsl got">${pcard(before[k])}</span></span>`;
      const plain = `<span class="bsl">${icon(k)}</span>`, lit = `<span class="bsl next">${icon(k)}</span>`;
      if (gained && k === k0) return `<span class="busslot" data-slot="${p}${k}"${wave}><span class="bsl next tu" style="--u:${tm.land}ms">${icon(k)}</span><span class="bsl got tf" style="--f:${tm.land}ms">${pcard(kept[k])}</span></span>`;
      if (gained && k === k0 + 1 && live && k0 + 1 < BUS.rounds) return `<span class="busslot"><span class="bsl tu" style="--u:${tm.land}ms">${icon(k)}</span><span class="bsl next tf" style="--f:${tm.land}ms">${icon(k)}</span></span>`;
      return `<span class="busslot" data-slot="${p}${k}">${live && k === k0 ? lit : plain}</span>`;
    }).join('');
    const label = n => (n >= BUS.rounds ? 'All four!' : `Round ${n + 1} of 4`);
    const sub = gained ? `<span class="tu" style="--u:${tm.land}ms">${label(k0)}</span><span class="tf" style="--f:${tm.land}ms">${label(kept.length)}</span>` : label(kept.length);
    const ride = gained ? ` go" style="--k:${kept.length};--fl:${tm.fly}ms` : missed ? ` jolt" style="--k:${kept.length};--t:${tm.mark}ms` : `" style="--k:${kept.length}`;
    const road = `<span class="busroad" aria-hidden="true"><i class="busflag${done ? ' on' : ''}${done && gained ? ` wave" style="--ld:${tm.land}ms` : ''}">${FLAG_ART}</i><i class="busbus ${p}${ride}">${BUS_ART}</i></span>`;
    return `<div class="busrow ${p}${live ? ' now' : ''}${done ? ' done' : ''}${done && gained ? ' fresh' : ''}"><span class="busnm"><b class="${p}">${N(p)}</b><small class="bswap">${sub}</small></span><div class="busway"><div class="busslots">${slots}</div>${road}</div></div>`;
  };
  // The stage: the deck, and only while a guess plays out, the card drawn for it and what it came to. Afterwards
  // only the kept cards show: a wrong card has gone back into its player's deck.
  const who = b ? a.by : turn, kept = b ? (b.right ? mini.prog[who].slice(0, -1) : mini.prog[who]) : mini.prog[turn], r = b ? b.round : kept.length;
  let drawn = '', res = '';
  if (b) {
    const fly = b.right ? ` data-fly="${a.by}${b.round}"` : '';
    drawn = `<span class="busdrawn${b.right ? ' right' : ' wrong'}" style="--t:${tm.mark}ms;--fl:${tm.fly}ms;--ld:${tm.land}ms"${fly}>${pcard(b.card, { slide: tm.pre, flip: tm.flip })}<b ${lateAt('busmark ' + (b.right ? 'ok' : 'no'), tm.mark)}>${b.right ? TICK : CROSS}</b></span>`;
    res = `<b ${lateAt('busres ' + (b.right ? 'ok' : 'no'), tm.mark)} role="status">${busResult(b, kept)}</b>`;
  }
  // The question and its answers: the guess being played out (its answer lit in the guesser's colour),
  // or the question for the player on the move.
  let ask = '';
  if ((b || !o.view) && r < BUS.rounds) {
    const dis = o.locked || b ? ' disabled' : '';
    const opt = (g, label, cls) => `<button class="big bus-${cls || g}${b && b.guess === g ? ` chosen ${who}` : ''}" data-act="move" ${mv(g)}${dis} aria-label="${BUS_SAY[g]}${b && b.guess === g ? ' (chosen)' : ''}">${label}</button>`;
    const txt = g => `${BUS_BTN[g]}<span>${BUS_SAY[g]}</span>`;
    const btns = r === 0 ? opt('red', txt('red'), 'red') + opt('black', txt('black'), 'black')
      : r === 1 ? opt('higher', txt('higher'), 'up') + opt('lower', txt('lower'), 'down')
      : r === 2 ? opt('inside', txt('inside'), 'in') + opt('outside', txt('outside'), 'out')
      : CARD.suits.split('').map(s => opt(s, suitSvg(s), 'suit' + (cardRed('A' + s) ? ' red' : ''))).join('');
    ask = `<div class="busask ${who}${b ? ' playing' : ''}"><p><b class="${who}">${N(who)}</b>: ${busQuestion(kept)}</p><div class="cbtns ${r === 3 ? 'four' : 'two'}">${btns}</div></div>`;
  }
  return `<div class="g-bus"><div class="busrows">${row('X')}${row('O')}</div>
    <div class="busstage"><div class="bustable"><span class="busdeck">${pcard(null, { down: true })}${pcard(null, { down: true })}${pcard(null, { down: true })}</span><span class="busspot">${drawn}</span></div><div class="busline">${res}</div></div>${ask}</div>`;
}
// A right card flies from the stage to its slot: where that is depends on the screen, so it is measured
// once the screen is drawn (the animation itself still counts from the move).
export function busFly() {
  const el = app.querySelector('.busdrawn[data-fly]');
  if (!el) return;
  const to = app.querySelector(`.busslot[data-slot="${el.dataset.fly}"]`), spot = el.parentElement;
  if (!to || !spot) return;
  const a = spot.getBoundingClientRect(), z = to.getBoundingClientRect();   // from where the card rests (its spot, which never moves), not the card itself: mid-slide or mid-flight it would be somewhere else
  if (!a.width || !z.width) return;
  el.style.setProperty('--fx', `${Math.round(z.left + z.width / 2 - (a.left + a.width / 2))}px`);
  el.style.setProperty('--fy', `${Math.round(z.top + z.height / 2 - (a.top + a.height / 2))}px`);
  el.style.setProperty('--fs', (z.width / a.width).toFixed(3));
}
// The miniature: each player's route of four stops: a kept card face up (its suit in its colour, public once kept;
// no rank: too small to read at this size), their bus at the stop they are on, the stops ahead dashed.
export function miniature(mini, final) {
  const row = p => { const n = mini.prog[p].length; return `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: BUS.rounds }, (_, k) => (mini.prog[p][k] ? tinyCard(mini.prog[p][k], '', true) : k === n ? `<i class="tcd tnil tbat ${p}">${BUS_ART}</i>` : '<i class="tcd tnil"></i>')).join('')}</div>`; };
  return `<div class="tbus" aria-label="Ride the Bus: X has ${mini.prog.X.length}, O ${mini.prog.O.length} of ${BUS.rounds} rounds">${row('X')}${row('O')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = busTable(mini, a, { view, locked, turn }); return g;
}
export function moveText(f, who) {
  return f.bus ? `${who} said ${BUS_SAY[f.bus.guess]}: ${f.bus.right ? 'right' : 'wrong'}` : `${who} guessed`;
}
export function sounds(f, add, won, mini, last) {   // the card off the deck, its turn, the result as its face shows; right: the card to its stop and the bus arriving (a note higher each round); wrong: the card back into the deck
  if (f.bus) {
    const tm = busTimes(f);
    add('cardSlide', tm.pre); add('cardFlip', tm.flip); add(f.bus.right ? 'ding' : 'thud', tm.mark); add('cardSlide', tm.fly);
    if (f.bus.right) add('point', tm.land, 1 + 0.14 * f.bus.round);
  }
  return;
}
