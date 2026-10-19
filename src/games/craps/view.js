// Craps: the screen, the miniature, the move's words and sounds, and the inputs.
import { CRAPS, crapsTimes } from './rules.js';
import { N, REDUCED, mv, state } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';

// Craps: one tap of Roll a move, and the dice keep rolling until the round is won or lost (rolled where the
// move is made: the server online). The page plays the round back roll by roll: each pair tumbles in at its
// time, the puck goes on at the point, the rolls fill the row under the felt (a fixed height: the last
// eight on show), and the round's result comes at the end. One button, always there, so nothing moves.
const CRAPS_POINTS = [4, 5, 6, 8, 9, 10];
function crapsSay(r) {                                          // the line under the felt for a round
  if (!r) return '';
  if (r.kind === 'stop') return `Stopped on point ${r.point}`;   // (from before)
  if (r.roll) { const n = r.sum; return r.result === 'win' ? (r.was == null ? `${n} on the come-out: a winner!` : `Point ${r.was} made!`) : r.result === 'lose' ? (r.was == null ? `${n}: craps!` : 'Seven out') : `Point ${r.point}`; }   // (a single roll, from before)
  const rolls = r.rolls || [], first = rolls.length ? rolls[0][0] + rolls[0][1] : 0;
  if (r.point == null) return r.result === 'win' ? `${first} on the come-out: a winner!` : `${first}: craps!`;
  return r.result === 'win' ? `Point ${r.point} made!` : 'Seven out';
}
function crapsTable(mini, a, o) {
  const c = a && a.craps && a.craps.rolls && !a.craps.roll && a.craps.kind !== 'stop' ? a.craps : null, l = mini.last, turn = o.turn;
  const shown = c || (l && l.rolls ? l : null);
  const tim = c ? crapsTimes(c.rolls, c.point, c.was) : null, tEnd = c && !REDUCED ? tim.end : 0;
  const tal = p => arcTally(p, o, pips(p, Math.min(CRAPS.goal, mini.wins[p]), CRAPS.goal, !!(c && c.result === 'win' && a.by === p), tEnd));
  // the puck: OFF to begin with; on the point once the come-out sets one (on from the start for a point from before)
  const slot = n => (n == null ? 0 : CRAPS_POINTS.indexOf(n) + 1), pct = k => ((k + 0.5) / 7 * 100).toFixed(2);
  const pk = shown && shown.point != null ? slot(shown.point) : 0;
  const puckAt = c && c.point != null && c.was == null && !REDUCED ? tim.puck : null;
  const puck = `<div class="cpuck${pk ? ' on' : ''}${puckAt != null ? ' move' : ''}" style="left:${pct(pk)}%;--from:${pct(0)}%;--to:${pct(pk)}%${puckAt != null ? `;--t:${puckAt}ms` : ''}">${pk ? 'ON' : 'OFF'}</div>`;
  const strip = `<div class="cpts">${['', ...CRAPS_POINTS].map((n, k) => `<i class="${k === 0 ? 'off' : ''}${shown && shown.point === n ? ' pt' : ''}">${n}</i>`).join('')}${puck}</div>`;
  // the dice: each roll's pair in its turn, the last one staying
  let dice = '';
  if (shown && shown.rolls && shown.rolls.length) {
    const n = shown.rolls.length;
    dice = shown.rolls.map((d, k) => {
      if (!c && k < n - 1) return '';
      const t0 = c && !REDUCED ? tim.at[k] : null, t1 = c && !REDUCED && k < n - 1 ? tim.at[k + 1] : null;
      if (c && REDUCED && k < n - 1) return '';
      return `<div class="cpair${t0 != null ? ' tumble' : ''}${t1 != null ? ' gone' : ''}" style="${t0 != null ? `--t:${t0}ms;` : ''}${t1 != null ? `--t2:${t1}ms` : ''}" aria-hidden="${k < n - 1}"><span class="die cdie">${dieFace(d[0])}</span><span class="die cdie b">${dieFace(d[1])}</span></div>`;
    }).join('');
  }
  // the round's rolls in a row, each as it lands (one row, a fixed height: a long round shows its latest)
  const all = shown && shown.rolls ? shown.rolls : [];
  const log = `<div class="crolls${all.length > 8 ? ' long' : ''}" aria-label="The round's rolls">${all.map((d, k) => `<span ${c && !REDUCED ? lateAt('', tim.at[k] + CRAPS.land - 60) : ''}>${d[0] + d[1]}</span>`).join('')}</div>`;
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const res = c ? `<p ${lateAt('arcres ' + (c.result === 'win' ? 'ok' : 'no'), tEnd)} role="status">${crapsSay(c)}</p>`
    : l && (o.done || o.view) ? `<p class="arcres ${l.result === 'win' ? 'ok' : l.result === 'lose' ? 'no' : ''}">${W(l.by)}: ${crapsSay(l)}</p>`
    : o.view ? '<p class="arcnote"></p>'
    : mini.point != null ? `<p class="arcnote">${W(turn)} · point ${mini.point} is on</p>`
    : `<p class="arcnote">${W(turn)}'s turn</p>`;
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('roll')}${o.locked ? ' disabled' : ''}>Roll</button></div>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="craps">${strip}<div class="cfelt">${dice || '<p class="arcnote"></p>'}</div>${log}${res}</div>${btn}</div>`;
}
export function miniature(mini, final) {
  const d = mini.last ? mini.last.roll || (mini.last.rolls || [])[(mini.last.rolls || []).length - 1] : null; return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: CRAPS.goal }, (_, k) => `<i class="${k < mini.wins[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}${d ? `<div class="tcdice ${mini.last.result === 'win' ? 'w' : mini.last.result === 'lose' ? 'l' : ''}"><span>${dieFace(d[0])}</span><span>${dieFace(d[1])}</span></div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = crapsTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return !f.craps ? `${who} rolled` : f.craps.kind === 'stop' ? `${who} stopped on point ${f.craps.point}` : f.craps.result === 'win' ? `${who} won the round` : `${who} lost the round`;
}
export function sounds(f, add, won, mini, last) {   // each roll: the rattle and the dice landing; the puck going on; the round's result
  const c = f.craps;
  if (!c) return;
  if (c.kind === 'stop') { add('toggle', 0); return; }
  if (c.roll) { add('rattle', 0); add('thunk', 500); if (c.result === 'win') add('ding', 700); else if (c.result === 'lose') add('thud', 700); return; }   // (a single roll, from before)
  const tim = crapsTimes(c.rolls, c.point, c.was);
  c.rolls.forEach((d, k) => { add('rattle', tim.at[k]); add('thunk', tim.at[k] + 500); });
  if (tim.puck != null) add('clack', tim.puck);
  add(c.result === 'win' ? 'ding' : 'thud', tim.end - 100);
}
