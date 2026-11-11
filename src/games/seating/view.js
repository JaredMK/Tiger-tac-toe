// Seating: the screen, the miniature, the move's words and sounds, and the inputs (reworked November 2026).
import { SEATT, seatFree, seatScore, seatTable, seatTimes } from './rules.js';
import { N, REDUCED, esc, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG, thumbArt } from '../../ui/thumbs.js';

// The restaurant: tables for two, each seat a colour. A tap on a seat of a table nobody is at is the move: the mover
// sits (a pop); the customer at the door (their colour always on show) walks in and sits in a seat of their colour:
// across from a player, that player's +1 pops over the table; at an empty table, a second customer follows them in and
// takes the other seat; with no seat of their colour, they walk through and out. Then the next customer steps up to the
// door. Everything is timed from the move (rules.js seatTimes) and played from its flash, never the square's last.
export const SEAT_COL = ['#3d7fe0', '#86c440', '#8d5bd8', '#f06aa8', '#1fb5a8', '#a0703c', '#5b6573', '#b98cf0'];
export const SEAT_NAMES = ['blue', 'green', 'purple', 'pink', 'teal', 'brown', 'grey', 'lilac'];
const col = c => SEAT_COL[c % SEAT_COL.length], cname = c => SEAT_NAMES[c % SEAT_NAMES.length];
const GUEST = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6.4" r="3.6"/><path d="M3.4 18.2c0-4.4 2.9-7 6.6-7s6.6 2.6 6.6 7z"/></svg>';
const guest = c => `<span class="sguest" style="--gc:${col(c)}">${GUEST}</span>`;
function seatingTable(mini, a, o) {
  const s = a && a.seat ? a.seat : null, turn = o.turn, who = mini.who, t = seatTimes(s);
  const score = seatScore(mini), free = new Set(seatFree(who));
  const was = p => (s && s.scorer === p ? score[p] - 1 : score[p]);
  const tal = p => arcTally(p, o, `<span class="sscore" aria-label="${score[p]} seated across">${s && s.scorer === p ? `<b class="cnt" data-from="${was(p)}" data-delay="${t.pop}">${score[p]}</b>` : `<b>${score[p]}</b>`}</span>`);
  const seat = i => {
    const w = who[i], c = mini.color[i], tbl = seatTable(i), open = free.has(tbl);
    let cls = 'sts' + (w ? ' ' + w : ''), st = `--sc:${col(c)}`;
    if (s && i === s.seat) cls += ' pop';
    else if (s && (i === s.z || i === s.z2)) { cls += ' walk'; st += `;--t:${i === s.z ? t.walk : t.walk + SEATT.pair}ms`; }
    const label = `Table ${tbl + 1}, ${i % 2 ? 'right' : 'left'} seat, ${cname(c)}${w === 'Z' ? ', a customer' : w ? ', ' + esc(N(w)) : ''}`;
    const inner = w === 'Z' ? guest(c) : w ? `<b>${markSvg(w)}</b>` : '';
    const can = !w && open && !o.locked && !o.view;
    return `<button class="${cls}" style="${st}" data-act="move" ${mv(i)} aria-label="${label}"${can ? '' : ' disabled'}>${inner}</button>`;
  };
  const tables = Array.from({ length: who.length / 2 }, (_, k) => {
    const l = who[2 * k], r = who[2 * k + 1], pl = [l, r].find(x => x === 'X' || x === 'O'), full = !!(l && r);
    const scored = full && pl ? pl : '', pair = full && !pl, isFree = free.has(k);
    const pop = s && s.scorer && seatTable(s.z) === k ? `<span class="spop ${s.scorer}" style="--t:${t.pop}ms">+1</span>` : '';
    const now = s && s.scorer && seatTable(s.z) === k;
    return `<div class="stbl${scored ? ' sc ' + scored : ''}${pair ? ' pair' : ''}${isFree ? ' free' : ''}${now ? ' got' : ''}"${now ? ` style="--t:${t.pop}ms"` : ''}>${seat(2 * k)}<span class="stop"></span>${seat(2 * k + 1)}${pop}</div>`;
  }).join('');
  const door = c => (c == null ? '<span class="snone">Nobody</span>' : `${guest(c)}<b>${cname(c)}</b>`);
  const next = s
    ? `<span class="snext">Next customer: <span class="sgwrap"><span class="sgo" style="--t:${t.walk}ms">${door(s.c)}</span><span ${lateAt('snew', t.door)}>${door(mini.next)}</span></span></span>`
    : `<span class="snext">Next customer: <span>${door(mini.next)}</span></span>`;
  const sayAt = s ? (s.scorer ? t.pop : t.landed) : 0;
  const res = s ? `<p ${lateAt('arcres ' + (s.scorer ? 'ok' : ''), sayAt)} role="status">${s.scorer ? `+1 for <b class="${s.scorer}">${N(s.scorer)}</b>!` : s.z2 != null ? 'A pair took an empty table' : s.left ? `No ${cname(s.c)} seat: they left` : `A ${cname(s.c)} customer sat down`}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  const leave = s && s.left && s.c != null && !REDUCED ? `<span class="sleave" style="--t:${t.walk}ms">${guest(s.c)}</span>` : '';   // no seat of their colour: in at the door, across the room and out
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="seating"><div class="sdoor">${next}</div><div class="stbls" style="--n:${who.length / 2}">${tables}${leave}</div>${res}</div></div>`;
}
const markSvg = p => `<svg class="smk ${p}" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(p, 6)}</svg>`;
// The miniature: the tables as a little floor plan (a seat a dot: the players' in their colours, a customer grey, an
// empty seat its own colour, faint; a table where a player scored ringed in their colour), each player's score beside it.
export function miniature(mini, final) {
  const who = mini.who, n = who.length / 2, cols = 3, rows = Math.ceil(n / cols), W = cols * 22, H = rows * 12, sc = seatScore(mini);
  const tbl = Array.from({ length: n }, (_, k) => {
    const x = (k % cols) * 22 + 2, y = Math.floor(k / cols) * 12 + 2, l = who[2 * k], r = who[2 * k + 1], pl = [l, r].find(v => v === 'X' || v === 'O'), full = !!(l && r);
    const dot = (i, cx) => { const w = who[i]; return `<circle class="tsd${w ? ' ' + w : ''}" cx="${cx}" cy="${y + 4}" r="3.2"${w ? '' : ` style="--sc:${col(mini.color[i])}"`}/>`; };
    return `<rect class="tst${full && pl ? ' ' + pl : ''}" x="${x + 5.5}" y="${y + 1}" width="7" height="6" rx="1.5"/>${dot(2 * k, x + 2.5)}${dot(2 * k + 1, x + 15.5)}`;
  }).join('');
  const rowsHtml = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span class="tsn">${sc[p]}</span></div>`).join('');
  return thumbArt(`<svg class="tseat2" viewBox="0 0 ${W} ${H}" aria-hidden="true">${tbl}</svg>`, rowsHtml, 'tseatw', `Seating: X ${sc.X}, O ${sc.O}`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = seatingTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  const s = f.seat;
  if (!s) return `${who} took a seat`;
  return s.scorer ? `${who} took a seat; ${s.scorer === f.by ? 'a customer sat across: +1' : 'the customer sat across from the other side'}` : `${who} took a seat`;
}
// The mover's seat (a mark); the customer's steps and their cushion as they sit (a second one behind them at an empty
// table); a point's ding; a customer with no seat walking out.
export function sounds(f, add, won, mini, last) {
  const s = f.seat; if (!s) return;
  const t = seatTimes(s);
  add('mark', 0);
  if (s.z != null) { add('hop', t.walk + 150); add('cushion', t.walk + SEATT.walkMs - 120); }
  if (s.z2 != null) add('cushion', t.walk + SEATT.walkMs + SEATT.pair - 120);
  if (s.scorer) add('ding', t.pop);
  if (s.left) { add('hop', t.walk + 150); add('whoosh', t.walk + SEATT.walkMs - 200); }
}
