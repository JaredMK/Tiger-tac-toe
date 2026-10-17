// Ride the Bus: the screen, the miniature, the move's words and sounds, and the inputs.
import { CARD } from '../shared/cards.js';
import { BUS, BUST, cardRed } from './rules.js';
import { N, app, cpuPlays, mv, state } from '../../ui/app.js';
import { CROSS, TICK } from '../../ui/art.js';
import { SUIT_PATH, cardShort, pcard, suitSvg } from '../../ui/cards.js';
import { lateAt } from '../../ui/progress.js';

// Ride the Bus: both players' four slots (the cards kept, or the round still to pass), the deck and the
// card just drawn (it slides off the deck, turns, and goes to its slot or is crossed out), the question
// for the player on the move and its answers.
const BUS_ICON = [
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="5" fill="#e5432a"/><circle cx="16" cy="12" r="5" fill="#161210"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6-6 6 6M6 15l6 6 6-6"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14M20 5v14M9 12h6"/></svg>',
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${SUIT_PATH.S}" transform="translate(1 1) scale(.45)"/><path d="${SUIT_PATH.H}" fill="#e5432a" transform="translate(12 1) scale(.45)"/><path d="${SUIT_PATH.D}" fill="#e5432a" transform="translate(1 12) scale(.45)"/><path d="${SUIT_PATH.C}" transform="translate(12 12) scale(.45)"/></svg>`,
];
const BUS_ROUND = ['Red or black', 'Higher or lower', 'Inside or outside', 'The suit'];
const BUS_SAY = { red: 'Red', black: 'Black', higher: 'Higher', lower: 'Lower', inside: 'Inside', outside: 'Outside', S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
function busQuestion(kept) {
  switch (kept.length) {
    case 0: return 'Red or black?';
    case 1: return `Higher or lower than ${cardShort(kept[0])}?`;
    case 2: return `Inside or outside ${cardShort(kept[0])} and ${cardShort(kept[1])}?`;
    default: return 'Which suit?';
  }
}
export function busPre(f) { return f && f.type === 'bus' && (f.timeout || (state.online ? f.by !== state.online.me : cpuPlays(f.by))) ? BUST.pre : 0; }
// The moments of a guess, ms into the move: the card leaves the deck, turns over (face up at `face`), the
// tick or cross shows (`mark`), and only then, if right, the card flies to its slot (`fly`), landing at `land`.
function busTimes(f) {
  const T = BUST, pre = busPre(f), face = pre + T.draw + T.flip;
  return { pre, flip: pre + T.draw, face, mark: face, fly: face + T.mark, land: face + T.mark + T.fly };
}
function busTable(mini, a, o) {
  const b = a && a.bus ? a.bus : null, turn = o.turn, tm = b ? busTimes(a) : null;
  const icon = k => `<span class="bsl-ico" aria-hidden="true">${BUS_ICON[k]}</span>`;
  // Each player's row. While a guess plays out, nothing here changes until the card has turned and the
  // result shows: a right card lands in its slot at `land`, and only then does the next round light up.
  const row = p => {
    const kept = mini.prog[p], gained = !!b && a.by === p && b.right, before = gained ? kept.slice(0, -1) : kept, k0 = before.length;
    const live = !o.view && p === turn;                            // the row of the player on the move
    const slots = Array.from({ length: BUS.rounds }, (_, k) => {
      if (k < k0) return `<span class="busslot"><span class="bsl got">${pcard(before[k])}</span></span>`;
      const plain = `<span class="bsl">${icon(k)}</span>`, lit = `<span class="bsl next">${icon(k)}</span>`;
      if (gained && k === k0) return `<span class="busslot" data-slot="${p}${k}"><span class="bsl next tu" style="--u:${tm.land}ms">${icon(k)}</span><span class="bsl got tf" style="--f:${tm.land}ms">${pcard(kept[k])}</span></span>`;
      if (gained && k === k0 + 1 && live && k0 + 1 < BUS.rounds) return `<span class="busslot"><span class="bsl tu" style="--u:${tm.land}ms">${icon(k)}</span><span class="bsl next tf" style="--f:${tm.land}ms">${icon(k)}</span></span>`;
      return `<span class="busslot" data-slot="${p}${k}">${live && k === k0 ? lit : plain}</span>`;
    }).join('');
    const label = n => (n >= BUS.rounds ? 'All four!' : `Round ${n + 1} of 4`);
    const sub = gained ? `<span class="tu" style="--u:${tm.land}ms">${label(k0)}</span><span class="tf" style="--f:${tm.land}ms">${label(kept.length)}</span>` : label(kept.length);
    return `<div class="busrow ${p}${live ? ' now' : ''}"><span class="busnm"><b class="${p}">${N(p)}</b><small class="bswap">${sub}</small></span><div class="busslots">${slots}</div></div>`;
  };
  // The stage: the deck, and only while a guess plays out, the card drawn for it. Afterwards only the kept
  // cards show: a wrong card has gone back into its player's deck.
  let drawn = '';
  if (b) {
    const fly = b.right ? ` data-fly="${a.by}${b.round}"` : '';
    drawn = `<span class="busdrawn${b.right ? ' right' : ' wrong'}" style="--t:${tm.mark}ms;--fl:${tm.fly}ms;--ld:${tm.land}ms"${fly}>${pcard(b.card, { slide: tm.pre, flip: tm.flip })}<b ${lateAt('busmark ' + (b.right ? 'ok' : 'no'), tm.mark)}>${b.right ? TICK : CROSS}</b></span>`;
  }
  // The question and its answers: the guess being played out (its answer lit in the guesser's colour),
  // or the question for the player on the move.
  let ask = '';
  const who = b ? a.by : turn, kept = b ? (b.right ? mini.prog[who].slice(0, -1) : mini.prog[who]) : mini.prog[turn], r = b ? b.round : kept.length;
  if ((b || !o.view) && r < BUS.rounds) {
    const dis = o.locked || b ? ' disabled' : '';
    const opt = (g, label, cls) => `<button class="big bus-${cls || g}${b && b.guess === g ? ` chosen ${who}` : ''}" data-act="move" ${mv(g)}${dis} aria-label="${BUS_SAY[g]}${b && b.guess === g ? ' (chosen)' : ''}">${label}</button>`;
    const btns = r === 0 ? opt('red', 'Red', 'red') + opt('black', 'Black', 'black')
      : r === 1 ? opt('higher', 'Higher ▲', 'up') + opt('lower', 'Lower ▼', 'down')
      : r === 2 ? opt('inside', 'Inside', 'in') + opt('outside', 'Outside', 'out')
      : CARD.suits.split('').map(s => opt(s, suitSvg(s), 'suit' + (cardRed('A' + s) ? ' red' : ''))).join('');
    ask = `<div class="busask${b ? ' playing' : ''}"><p><b class="${who}">${N(who)}</b>: ${busQuestion(kept)}</p><div class="cbtns ${r === 3 ? 'four' : 'two'}">${btns}</div></div>`;
  }
  return `<div class="g-bus"><div class="busrows">${row('X')}${row('O')}</div>
    <div class="busstage"><span class="busdeck">${pcard(null, { down: true })}${pcard(null, { down: true })}</span><span class="busspot">${drawn}</span></div>${ask}</div>`;
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
export function miniature(mini, final) {
  return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr bus ${p}"><b class="${p}">${p}</b>${Array.from({ length: BUS.rounds }, (_, k) => `<i class="${k < mini.prog[p].length ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = busTable(mini, a, { view, locked, turn }); return g;
}
export function moveText(f, who) {
  return f.bus ? `${who} said ${BUS_SAY[f.bus.guess]}: ${f.bus.right ? 'right' : 'wrong'}` : `${who} guessed`;
}
export function sounds(f, add, won, mini, last) {
  if (f.bus) { const tm = busTimes(f); add('cardSlide', tm.pre); add('cardFlip', tm.flip); add(f.bus.right ? 'ding' : 'thud', tm.mark); if (f.bus.right) add('cardSlide', tm.fly); } return;
}
