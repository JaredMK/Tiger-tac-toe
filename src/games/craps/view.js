// Craps: the screen, the miniature, the move's words and sounds, and the inputs.
import { CRAPS } from './rules.js';
import { N, REDUCED, mv, state } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';

// Craps: one roll a move, rolled where the move is made (the server online). The dice tumble in from the
// move; the puck goes on at a new point (and off when a round ends); the round's rolls so far sit in a row
// under the felt (a fixed height: the last eight). With a point standing it is the roller's choice, Roll
// again or Stop: both buttons are always there (Stop greyed until it can be used), so nothing moves.
const CRAPS_POINTS = [4, 5, 6, 8, 9, 10];
function crapsSay(r, who) {                                     // the line under the felt for a roll (or a stop)
  if (!r) return '';
  if (r.kind === 'stop') return `${who ? who + ' stopped' : 'Stopped'}: point ${r.point} stays on for the next roll here`;
  if (!r.roll) return r.result === 'win' ? 'Round won' : 'Round lost';   // (a round from before)
  const n = r.sum;
  if (r.was == null) return r.result === 'win' ? `${n} on the come-out: a winner!` : r.result === 'lose' ? `${n}: craps!` : `Point ${n}: roll again or stop`;
  return r.result === 'win' ? `Point ${r.was} made!` : r.result === 'lose' ? 'Seven out' : `${n}: the point is still ${r.was}`;
}
function crapsTable(mini, a, o) {
  const c = a && a.craps ? a.craps : null, l = mini.last, turn = o.turn;
  const roll = c && c.kind === 'roll' && c.roll ? c : null, land = roll && !REDUCED ? CRAPS.land : 0;
  const tal = p => arcTally(p, o, pips(p, Math.min(CRAPS.goal, mini.wins[p]), CRAPS.goal, !!(roll && roll.result === 'win' && a.by === p), land));
  // the puck: on the point while a round has one, OFF otherwise; it moves when a roll sets or ends a point
  const slot = n => (n == null ? 0 : CRAPS_POINTS.indexOf(n) + 1), pct = k => ((k + 0.5) / 7 * 100).toFixed(2);
  const before = roll ? roll.was : null, after = mini.point == null ? null : mini.point;
  const moving = roll && !REDUCED && slot(before) !== slot(after);
  const pk = slot(after);
  const puck = `<div class="cpuck${pk ? ' on' : ''}${moving ? (pk ? ' move' : ' moveoff') : ''}" style="left:${pct(pk)}%;--from:${pct(slot(before))}%;--to:${pct(pk)}%${moving ? `;--t:${land}ms` : ''}">${pk ? 'ON' : 'OFF'}</div>`;
  const strip = `<div class="cpts">${['', ...CRAPS_POINTS].map((n, k) => `<i class="${k === 0 ? 'off' : ''}${after != null && after === n ? ' pt' : ''}">${n}</i>`).join('')}${puck}</div>`;
  // the dice: the roll just made tumbling in, else the last roll at rest
  const d = roll ? roll.roll : l && l.roll ? l.roll : l && l.rolls && l.rolls.length ? l.rolls[l.rolls.length - 1] : null;
  const dice = d ? `<div class="cpair${roll && !REDUCED ? ' tumble' : ''}"><span class="die cdie">${dieFace(d[0])}</span><span class="die cdie b">${dieFace(d[1])}</span></div>` : '';
  // the round's rolls so far (the one just made appearing as it lands); a round just over keeps its rolls on show
  const rolls = (roll ? roll.rolls : mini.rolls && mini.rolls.length ? mini.rolls : l && l.rolls ? l.rolls : []).slice(-8);
  const log = `<div class="crolls" aria-label="This round's rolls">${rolls.map((x, k) => `<span ${roll && k === rolls.length - 1 && !REDUCED ? lateAt('', land) : ''}>${x[0] + x[1]}</span>`).join('')}</div>`;
  const live = !o.view && mini.live === turn && mini.point != null;     // a point standing, the roller's choice
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const res = c ? `<p ${lateAt('arcres ' + (roll ? (roll.result === 'win' ? 'ok' : roll.result === 'lose' ? 'no' : '') : ''), land)} role="status">${crapsSay(c)}</p>`
    : l && (o.done || o.view) ? `<p class="arcres ${l.result === 'win' ? 'ok' : l.result === 'lose' ? 'no' : ''}">${W(l.by)}: ${crapsSay(l)}</p>`
    : o.view ? '<p class="arcnote"></p>'
    : live ? `<p class="arcnote">Point ${mini.point}</p>`
    : mini.point != null ? `<p class="arcnote">${W(turn)} · point ${mini.point} is on</p>`
    : `<p class="arcnote">${W(turn)}'s turn</p>`;
  const btn = o.view ? '' : `<div class="cbtns two"><button class="big ${turn}" data-act="move" ${mv('roll')}${o.locked ? ' disabled' : ''}>${live ? 'Roll again' : 'Roll'}</button><button class="big" data-act="move" ${mv('stop')}${o.locked || !live ? ' disabled' : ''}>Stop</button></div>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="craps">${strip}<div class="cfelt">${dice || '<p class="arcnote"></p>'}</div>${log}${res}</div>${btn}</div>`;
}
export function miniature(mini, final) {
  const d = mini.last ? mini.last.roll || (mini.last.rolls || [])[(mini.last.rolls || []).length - 1] : null; return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: CRAPS.goal }, (_, k) => `<i class="${k < mini.wins[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}${d ? `<div class="tcdice ${mini.last.result === 'win' ? 'w' : mini.last.result === 'lose' ? 'l' : ''}"><span>${dieFace(d[0])}</span><span>${dieFace(d[1])}</span></div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = crapsTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return !f.craps ? `${who} rolled` : f.craps.kind === 'stop' ? `${who} stopped on point ${f.craps.point}` : f.craps.result === 'win' ? `${who} won the round` : f.craps.result === 'lose' ? `${who} lost the round` : `${who} rolled ${f.craps.sum}`;
}
export function sounds(f, add, won, mini, last) {   // the roll: the rattle, the dice landing; the puck going on or off; a round's result
  if (!f.craps) return;
  if (f.craps.kind === 'stop') { add('toggle', 0); return; }
  add('rattle', 0); add('thunk', 500);
  if (f.craps.result === 'point' || (f.craps.was != null && f.craps.result !== 'stay')) add('clack', 600);
  if (f.craps.result === 'win') add('ding', 700); else if (f.craps.result === 'lose') add('thud', 700);
  return;
}
