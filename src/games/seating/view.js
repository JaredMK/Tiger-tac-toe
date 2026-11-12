// Seating: the screen, the miniature, the move's words and sounds, and the inputs (reworked November 2026).
import { SEATT, seatFree, seatScore, seatTable, seatTimes } from './rules.js';
import { N, REDUCED, esc, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG, thumbArt } from '../../ui/thumbs.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';

// The restaurant: tables for two, each seat a colour. A tap on a seat of a table nobody is at is the move: the mover
// sits (a pop); the customer at the door (their colour always on show) walks in and sits in a seat of their colour:
// across from a player, that player's +1 pops over the table; at an empty table, a second customer follows them in and
// takes the other seat; with no seat of their colour, they walk through and out. Then the next customer steps up to the
// door. Everything is timed from the move (rules.js seatTimes) and played from its flash, never the square's last.
export const SEAT_COL = ['#3d7fe0', '#86c440', '#8d5bd8', '#f06aa8', '#1fb5a8', '#a0703c', '#5b6573', '#b98cf0'];
export const SEAT_NAMES = ['blue', 'green', 'purple', 'pink', 'teal', 'brown', 'grey', 'lilac'];
const col = c => SEAT_COL[c % SEAT_COL.length], cname = c => SEAT_NAMES[c % SEAT_NAMES.length];
const GUEST = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6.4" r="3.6"/><path d="M3.4 18.2c0-4.4 2.9-7 6.6-7s6.6 2.6 6.6 7z"/></svg>';
const guest = (c, attr = '') => `<span class="sguest" style="--gc:${col(c)}"${attr}>${GUEST}</span>`;
function seatingTable(mini, a, o) {
  const s = a && a.seat ? a.seat : null, turn = o.turn === 'O' ? 'O' : 'X', who = mini.who, t = seatTimes(s);
  const score = seatScore(mini), free = new Set(seatFree(who)), rows = Math.ceil(who.length / 6);
  const was = p => (s && s.scorer === p ? score[p] - 1 : score[p]);
  // each player's points by their name: the chip their token leaves from, counting on (and bumping) as a +1 lands
  const tal = p => arcTally(p, o, `<span class="sscore${s && s.scorer === p ? ' bump' : ''}"${s && s.scorer === p ? ` style="--t:${t.pop}ms"` : ''}${cfAnchor('stal:' + p)} aria-label="${score[p]} seated across">${s && s.scorer === p ? `<b class="cnt" data-from="${was(p)}" data-delay="${t.pop}">${score[p]}</b>` : `<b>${score[p]}</b>`}</span>`);
  const last = !s && !o.view && mini.last ? mini.last : null;       // the seat taken last and where its customer sat, ringed (a finished square shows the room alone)
  const seat = i => {
    const w = who[i], c = mini.color[i], tbl = seatTable(i), open = free.has(tbl);
    let cls = 'sts' + (w ? ' ' + w : ''), st = `--sc:${col(c)}`, inner = '';
    const can = !w && open && !o.locked && !o.view;
    if (w === 'Z') {                                                // a customer: walking in from the door when this move brought them
      const walks = s && (i === s.z || i === s.z2), at = walks ? (i === s.z ? t.walk : t.walk + SEATT.pair) : 0;
      if (walks) { cls += ' walk'; st += `;--t:${at}ms`; }
      inner = guest(c, walks ? cfFrom('sdoor', at, { d: SEATT.walkMs }) : '');
    } else if (w) {                                                 // a player: their token, from their name's chip when this move sat them
      const sits = s && i === s.seat;
      if (sits) cls += ' pop';
      inner = `<b${sits ? cfFrom('stal:' + w, 0) : ''}>${markSvg(w)}</b>`;
    } else if (can) inner = `<i class="sgh ${turn}">${markSvg(turn)}</i>`;   // (what a tap here would seat: the mover's token, shown under the finger)
    if (last && (i === last.seat || i === last.z || i === last.z2)) cls += ' last';
    if (!w && !open && !o.view) cls += ' wait';                                // the seat across from a player, kept for a customer of its colour
    const label = `Table ${tbl + 1}, ${i % 2 ? 'right' : 'left'} seat, ${cname(c)}${w === 'Z' ? ', a customer' : w ? ', ' + esc(N(w)) : ''}`;
    return `<button class="${cls}" style="${st}" data-act="move" ${mv(i)} aria-label="${label}"${can ? '' : ' disabled'}>${inner}</button>`;
  };
  const winner = s && o.fresh && score.X !== score.O ? (score.X > score.O ? 'X' : 'O') : null;
  let wonN = 0;
  const tables = Array.from({ length: who.length / 2 }, (_, k) => {
    const l = who[2 * k], r = who[2 * k + 1], pl = [l, r].find(x => x === 'X' || x === 'O'), full = !!(l && r);
    const scored = full && pl ? pl : '', pair = full && !pl, isFree = free.has(k), waits = !full && pl ? pl : '';
    const now = !!(s && s.scorer && seatTable(s.z) === k), came = !!(s && s.z != null && seatTable(s.z) === k);
    const pop = now ? `<span class="spop ${s.scorer}" style="--t:${t.pop}ms">+1</span>` : '';
    const wins = winner && scored === winner;                      // the square just won: the winner's tables hop, one after the other
    const st = (now ? `--t:${t.pop}ms;` : came && pair ? `--t:${t.landed}ms;` : '') + (wins ? `--w:${t.end + (wonN++) * 45}ms` : '');
    return `<div class="stbl${scored ? ' sc ' + scored : ''}${pair ? ' pair' : ''}${isFree ? ' free' : ''}${waits ? ' w' + waits : ''}${now ? ' got' : ''}${came ? ' mv' : ''}${wins ? ' won' : ''}"${st ? ` style="${st}"` : ''}>${seat(2 * k)}<span class="stop"></span>${seat(2 * k + 1)}${pop}</div>`;
  }).join('');
  // the door: the customer coming in next stands in it, their colour named beside it; during a move the one who was
  // there walks off to their seat (the flight starts from here) and the next steps up as they sit
  const inDoor = c => (c == null ? '' : guest(c)), named = c => (c == null ? '<span class="snone">Nobody</span>' : `<b>${cname(c)}</b>`);
  const next = s
    ? `<span class="sdw"${cfAnchor('sdoor')}><span class="sgo" style="--t:${t.walk}ms">${inDoor(s.c)}</span><span ${lateAt('snew', t.door)}>${inDoor(mini.next)}</span></span><span class="sgwrap"><span class="sgo" style="--t:${t.walk}ms">${named(s.c)}</span><span ${lateAt('snew', t.door)}>${named(mini.next)}</span></span>`
    : `<span class="sdw"${cfAnchor('sdoor')}><span>${inDoor(mini.next)}</span></span><span class="sgwrap"><span>${named(mini.next)}</span></span>`;
  const sayAt = s ? (s.scorer ? t.pop : t.landed) : 0;
  const res = s ? `<p ${lateAt('arcres ' + (s.scorer ? 'ok' : ''), sayAt)} role="status">${s.scorer ? `+1 for <b class="${s.scorer}">${N(s.scorer)}</b>!` : s.z2 != null ? 'A pair took an empty table' : s.left ? `No ${cname(s.c)} seat: they left` : `A ${cname(s.c)} customer sat down`}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  const leave = s && s.left && s.c != null && !REDUCED ? `<span class="sleave" style="--t:${t.walk}ms">${guest(s.c)}</span>` : '';   // no seat of their colour: in at the door, a look round the room, and out again
  return `<div class="g-arc g-seat t${turn}${o.locked || o.view ? '' : ' open'}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="seating" style="--rows:${rows}"><div class="sdoor"><span class="snext"><span class="snl">Next customer:</span>${next}</span></div><div class="stbls" style="--n:${who.length / 2}">${tables}${leave}</div>${res}</div></div>`;
}
const markSvg = p => `<svg class="smk ${p}" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(p, 6)}</svg>`;
// The miniature: the room's floor with the tables as a little floor plan (a seat a dot: the players' in their colours, a customer grey, an
// empty seat its own colour, faint; a table where a player scored ringed in their colour), each player's score beside it.
export function miniature(mini, final) {
  const who = mini.who, n = who.length / 2, cols = 3, rows = Math.ceil(n / cols), W = cols * 22, H = rows * 12, sc = seatScore(mini);
  const tbl = Array.from({ length: n }, (_, k) => {
    const x = (k % cols) * 22 + 2, y = Math.floor(k / cols) * 12 + 2, l = who[2 * k], r = who[2 * k + 1], pl = [l, r].find(v => v === 'X' || v === 'O'), full = !!(l && r);
    const dot = (i, cx) => { const w = who[i]; return `<circle class="tsd${w ? ' ' + w : ''}" cx="${cx}" cy="${y + 4}" r="3.2"${w ? '' : ` style="--sc:${col(mini.color[i])}"`}/>`; };
    return `<rect class="tst${full && pl ? ' ' + pl : ''}" x="${x + 5.5}" y="${y + 1}" width="7" height="6" rx="1.5"/>${dot(2 * k, x + 2.5)}${dot(2 * k + 1, x + 15.5)}`;
  }).join('');
  const rowsHtml = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span class="tsn">${sc[p]}</span></div>`).join('');
  return thumbArt(`<svg class="tseat2" viewBox="-3 -3 ${W + 6} ${H + 4}" aria-hidden="true"><rect class="tsf" x="-2" y="-2" width="${W + 4}" height="${H + 2}" rx="4"/>${tbl}</svg>`, rowsHtml, 'tseatw', `Seating: X ${sc.X}, O ${sc.O}`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = seatingTable(mini, a, { view, locked, turn, fresh: !!fresh, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  const s = f.seat;
  if (!s) return `${who} took a seat`;
  return s.scorer ? `${who} took a seat; ${s.scorer === f.by ? 'a customer sat across: +1' : 'the customer sat across from the other side'}` : `${who} took a seat`;
}
// The mover's seat (a mark, their token's cushion as it lands); the customer's steps across the room and their cushion
// as they sit (a second one behind them at an empty table); a point's ding; a customer with no seat walking out.
const STEPS = [0.12, 0.34, 0.56, 0.78];                             // a walk's footfalls, as parts of it
export function sounds(f, add, won, mini, last) {
  const s = f.seat; if (!s) return;
  const t = seatTimes(s), steps = from => STEPS.forEach((k, n) => add('hop', Math.round(from + k * SEATT.walkMs), n % 2 ? 0.84 : 0.76));
  add('mark', 0); add('cushion', 250, 1.15);
  if (s.z != null) { steps(t.walk); add('cushion', t.walk + SEATT.walkMs - 60); }
  if (s.z2 != null) add('cushion', t.walk + SEATT.walkMs + SEATT.pair - 60, 0.92);
  if (s.scorer) add('ding', t.pop);
  if (s.left) { steps(t.walk); add('whoosh', t.walk + SEATT.walkMs - 200); }
}
