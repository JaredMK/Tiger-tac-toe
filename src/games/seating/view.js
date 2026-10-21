// Seating: the screen, the miniature, the move's words and sounds, and the inputs.
import { PLACE_MS } from '../shared/placement.js';
import { seatCfg, seatTable, seatTables } from './rules.js';
import { N, REDUCED, mv, state } from '../../ui/app.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';

// Seating: ten tables of two seats, each seat a colour. A tap on an empty seat is the move: the mover sits
// (a pop), then the customer walks in to a seat of their colour (any seat when none is left); the next
// customer waits at the door, their colour always on show. Both seats of a table make it yours.
const SEAT_COL = ['#3d7fe0', '#86c440', '#8d5bd8', '#f06aa8'];
const SEAT_NAMES = ['blue', 'green', 'purple', 'pink'];
const SEAT_GUEST = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6.4" r="3.6"/><path d="M3.4 18.2c0-4.4 2.9-7 6.6-7s6.6 2.6 6.6 7z"/></svg>';
function seatingTable(mini, a, o) {
  const s = a && a.seat ? a.seat : null, turn = o.turn, who = mini.who;
  const tAt = PLACE_MS.mark, zAt = PLACE_MS.mark, zEnd = PLACE_MS.mark + PLACE_MS.walk;
  const goal = seatCfg(mini).goal, nT = who.length / 2;
  const tal = p => arcTally(p, o, pips(p, Math.min(goal, seatTables(who, p)), goal, !!(s && s.table != null && a.by === p), tAt));
  const seat = i => {
    const w = who[i], col = SEAT_COL[mini.color[i]], side = i % 2 ? 'right' : 'left';
    let cls = 'sts' + (w ? ' ' + w : ''), st = `--sc:${col}`;
    if (s && i === s.seat) cls += ' pop';
    else if (s && i === s.z) { cls += ' walk'; st += `;--t:${zAt}ms`; }
    const label = `Table ${seatTable(i) + 1}, ${side} seat, ${SEAT_NAMES[mini.color[i]]}${w === 'Z' ? ', a customer' : w ? ', ' + w : ''}`;
    const inner = w === 'Z' ? `<span class="sguest">${SEAT_GUEST}</span>` : w ? `<b>${w}</b>` : '';
    return `<button class="${cls}" style="${st}" data-act="move" ${mv(i)} aria-label="${label}"${w || o.locked ? ' disabled' : ''}>${inner}</button>`;
  };
  const tables = Array.from({ length: nT }, (_, t) => {
    const l = who[2 * t], r = who[2 * t + 1], own = l && l === r && l !== 'Z' ? l : '';
    const fresh = s && s.table === t;
    return `<div class="stbl${own ? ' own ' + own : ''}${fresh ? ' got' : ''}"${fresh ? ` style="--t:${tAt}ms"` : ''}>${seat(2 * t)}<span class="stop">${own ? `<b>${own}</b>` : t + 1}</span>${seat(2 * t + 1)}</div>`;
  }).join('');
  const full = !who.includes(null);
  const door = c => `<i class="sgdot" style="background:${SEAT_COL[c]}"></i><b>${SEAT_NAMES[c]}</b>`;
  // the door: the customer who just sat leaves it as the move is made, the next one arrives once they are seated
  const next = full ? '<span class="snext">The room is full</span>'
    : s && (s.z != null || s.left) ? `<span class="snext">Next customer: <span class="sgwrap"><span class="sgo" style="--t:${zAt}ms">${door(s.zColor)}</span><span ${lateAt('snew', zEnd)}>${door(mini.next)}</span></span></span>`
    : `<span class="snext">Next customer: <span>${door(mini.next)}</span></span>`;
  const res = s ? `<p ${lateAt('arcres ' + (s.table != null ? 'ok' : ''), s.table != null ? tAt : zEnd)} role="status">${s.table != null ? `Table ${s.table + 1} is ${N(a.by)}'s!` : s.z != null ? `A ${SEAT_NAMES[s.zColor]} customer sat down` : s.left ? `No ${SEAT_NAMES[s.zColor]} seat: the customer left` : 'Seated'}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  const leave = s && s.left && !REDUCED ? `<span class="sleave" style="--t:${zAt}ms;--sc:${SEAT_COL[s.zColor]}"><span class="sguest">${SEAT_GUEST}</span></span>` : '';   // no seat of their colour: in at the door, across the room and out
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="seating"><div class="sdoor">${next}</div><div class="stbls">${tables}${leave}</div>${res}</div></div>`;
}
export function miniature(mini, final) {
  return `<div class="tseat">${Array.from({ length: mini.who.length / 2 }, (_, t) => { const l = mini.who[2 * t], r = mini.who[2 * t + 1], own = l && l === r && l !== 'Z' ? ' own ' + l : ''; return `<span class="${own}">${[2 * t, 2 * t + 1].map(i => `<i class="${mini.who[i] || ''}" style="--sc:${SEAT_COL[mini.color[i]]}"></i>`).join('')}</span>`; }).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = seatingTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.seat && f.seat.table != null ? `${who} took table ${f.seat.table + 1}` : f.seat && f.seat.left ? `${who} took the last ${SEAT_NAMES[f.seat.zColor]} seat: the customer left` : `${who} took a seat`;
}
export function sounds(f, add, won, mini, last) {
  if (f.seat) { add('mark', 0); if (f.seat.table != null) add('ding', PLACE_MS.mark); if (f.seat.z != null) { add('hop', PLACE_MS.mark + 150); add('cushion', PLACE_MS.mark + PLACE_MS.walk - 120); } else if (f.seat.left) { add('hop', PLACE_MS.mark + 150); add('whoosh', PLACE_MS.mark + PLACE_MS.walk - 300); } } return;   // a customer with no seat: in, and off out the side
}
