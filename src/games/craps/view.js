// Craps: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { CRAPS, crapsTimes } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { CROSS, TICK, dieFace } from '../../ui/art.js';
import { DIE_BOUNCE, die3d } from '../../ui/dice.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { pipRows } from '../../ui/thumbs.js';

// Krabs: one tap of Roll a move, and the dice keep rolling until the round is won or lost (rolled where the move is
// made: the server online). The page plays the round back roll by roll, all of it timed from the move:
//   the strip: the totals 2 to 12, the ones that win this roll green with a tick, the ones that are out dark with a
//     cross (the first roll: 7 and 11 win, 2, 3 and 12 are out; once a number is set: that number wins, 7 is out and
//     the rest do nothing, dimmed), a ring on the total just rolled;
//   the marker: a puck in the roller's colour that flies from the dice onto the number to roll again;
//   the felt: each roll's two dice thrown in (the shared 3-D die), their total popping beside them as they land, in
//     the colour of what it did; the round's last pair hops (won) or dims (out) and the felt glows with it;
//   under it the round's totals in a row (a fixed height: the latest on show) and the line for the result.
// One button, always there, so nothing moves. KRABS_T: a quick roll's shorter tumble, the result's pip after its words.
export const KRABS_T = { quickLand: 420, pip: 180, swap: 260 };
const TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const landOf = k => (k < CRAPS.quickAfter ? CRAPS.land : KRABS_T.quickLand);   // roll k's tumble: the die lands this long after it is thrown
const landAt = (tim, k) => tim.at[k] + landOf(k);
function crapsSay(r) {                                          // the line under the felt for a round
  if (!r) return '';
  if (r.kind === 'stop') return `Stopped on point ${r.point}`;   // (from before)
  if (r.roll) { const n = r.sum; return r.result === 'win' ? (r.was == null ? `${n} on the first roll: a winner!` : `Point ${r.was} made!`) : r.result === 'lose' ? (r.was == null ? `${n}: out!` : 'Seven out') : `Point ${r.point}`; }   // (a single roll, from before)
  const rolls = r.rolls || [], first = rolls.length ? rolls[0][0] + rolls[0][1] : 0;
  if (r.point == null) return r.result === 'win' ? `${first} on the first roll: a winner!` : `${first}: out!`;
  return r.result === 'win' ? `Point ${r.point} made!` : 'Seven out';
}
// The strip's cells for a roll with no number set yet (point null), or with one.
function cells(point, cls, st) {
  const kind = n => (point == null ? (n === 7 || n === 11 ? 'w' : n === 2 || n === 3 || n === 12 ? 'o' : '') : n === point ? 'w' : n === 7 ? 'o' : 'x');
  return `<div class="kcells${cls || ''}"${st ? ` style="${st}"` : ''}>${TOTALS.map(n => { const k = kind(n); return `<i class="${k}">${n}${k === 'w' ? TICK : k === 'o' ? CROSS : ''}</i>`; }).join('')}</div>`;
}
const at12 = n => ((n - 2 + 0.5) / 11 * 100).toFixed(2);       // a total's place along the strip (%)
function crapsTable(mini, a, o) {
  const c = a && a.craps && a.craps.rolls && !a.craps.roll && a.craps.kind !== 'stop' ? a.craps : null, l = mini.last, turn = o.turn;
  const play = !!c, tim = c ? crapsTimes(c.rolls, c.point, c.was) : null;   // (reduced motion: the stylesheet plays none of it and hides the pairs and rings a later roll replaces)
  const still = !c && l && l.rolls && l.rolls.length && (o.done || o.view) ? l : null;   // the last round as it ended, on show (the move just made, a finished square)
  const shown = c || still, n = shown ? shown.rolls.length : 0, by = c ? a.by : still ? still.by : turn;
  const tRes = play ? landAt(tim, n - 1) : 0;                       // the round's result: as its last pair lands
  const wins = c && c.wins ? c.wins : mini.wins;                   // (a round playing: the rounds won as its move left them, the mover's pip filling in)
  const tal = p => arcTally(p, o, pips(p, Math.min(tune(mini).goal, wins[p]), tune(mini).goal, !!(c && c.result === 'win' && a.by === p), tRes + KRABS_T.pip));
  // the strip: the first roll's colours, then (a number set) that number's, swapped as the marker lands on it
  const setNow = c && c.point != null && c.was == null, swap = setNow && play ? tim.puck + KRABS_T.swap : null;
  const pt = shown ? (shown.point != null ? shown.point : null) : mini.point != null ? mini.point : null;
  const strip = swap != null ? cells(null, ' tu', `--u:${swap}ms`) + cells(pt, ' tf', `--f:${swap}ms`) : cells(pt);
  const hits = shown ? shown.rolls.map((d, k) => {
    if (!play && k < n - 1) return '';
    const t0 = play ? landAt(tim, k) : null, t1 = play && k < n - 1 ? landAt(tim, k + 1) : null;
    return `<b class="khit ${by}${t0 != null ? ' late' : ''}${t1 != null ? ' gone' : ''}" style="left:${at12(d[0] + d[1])}%;${t0 != null ? `--t:${t0}ms;` : ''}${t1 != null ? `--t2:${t1}ms` : ''}"></b>`;
  }).join('') : '';
  const puck = pt != null ? `<b class="kpuck ${by}${setNow && play ? ' fly' : ''}" style="left:${at12(pt)}%;--to:${at12(pt)}%${setNow && play ? `;--t:${tim.puck}ms;--d:${CRAPS.puck}ms` : ''}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.6l2.8 6 6.5.8-4.8 4.5 1.3 6.5L12 17.2l-5.8 3.2 1.3-6.5L2.7 9.4l6.5-.8z"/></svg></b>` : '';
  const what = pt == null ? 'First roll: 7 or 11 wins; 2, 3 or 12 is out' : `${pt} wins, 7 is out`;
  const top = `<div class="kstrip" role="img" aria-label="${what}"><div class="kzrow">${strip}${hits}</div><div class="krail">${puck}</div></div>`;
  // the dice: each roll's pair in its turn with its total, the last one staying; nothing rolled on show: the dice as they lie (the last round's, or two not rolled yet)
  const totKind = k => (k === n - 1 && shown.result === 'win' ? 'w' : k === n - 1 && shown.result === 'lose' ? 'o' : k === 0 && shown.point != null && shown.was == null ? 'p ' + by : 'x');
  let dice;
  if (shown) {
    dice = shown.rolls.map((d, k) => {
      if (!play && k < n - 1) return '';
      const t0 = play ? tim.at[k] : null, t1 = play && k < n - 1 ? tim.at[k + 1] : null, last = k === n - 1;
      const end = last && (shown.result === 'win' || shown.result === 'lose') ? (shown.result === 'win' ? ' cheer' : ' sad') : '';   // the round's last pair: won, they hop; out, they dim (once landed)
      return `<div class="kpair${t1 != null ? ' gone' : ''}${end}" style="${t1 != null ? `--t2:${t1}ms;` : ''}${play && end ? `--d:${landAt(tim, k)}ms` : ''}" aria-hidden="${!last}"><div class="kdice"><span class="kd">${die3d(d[0], { roll: play ? landOf(k) : 0, t: t0, v: 0 })}</span><span class="kd b">${die3d(d[1], { roll: play ? landOf(k) : 0, t: t0, v: 1 })}</span></div><b ${lateAt('ktot ' + totKind(k), play ? landAt(tim, k) : null)}>${d[0] + d[1]}</b></div>`;
    }).join('');
  } else {
    const d = l ? l.roll || (l.rolls || [])[(l.rolls || []).length - 1] : null;
    dice = `<div class="kpair idle" aria-hidden="true"><div class="kdice"><span class="kd">${die3d(d ? d[0] : null, { v: 0 })}</span><span class="kd b">${die3d(d ? d[1] : null, { v: 1 })}</span></div></div>`;
  }
  const glow = shown && (shown.result === 'win' || shown.result === 'lose') ? ` ${shown.result}${play ? ' late' : ''}` : '';
  // the round's rolls in a row, each as it lands (one row, a fixed height: a long round shows its latest)
  const all = shown ? shown.rolls : [];
  const log = `<div class="crolls${all.length > 8 ? ' long' : ''}" aria-label="The round's rolls">${all.map((d, k) => `<span ${lateAt(k === n - 1 && shown.result === 'win' ? 'w' : k === n - 1 && shown.result === 'lose' ? 'o' : k === 0 && shown.point != null && shown.was == null ? 'p' : '', play ? landAt(tim, k) : null)}>${d[0] + d[1]}</span>`).join('')}</div>`;
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const res = c ? `<p ${lateAt('arcres ' + (c.result === 'win' ? 'ok' : 'no'), play ? tRes : null)} role="status">${crapsSay(c)}</p>`
    : l && (o.done || o.view || (o.held && l.by === turn)) ? `<p class="arcres ${l.result === 'win' ? 'ok' : l.result === 'lose' ? 'no' : ''}">${W(l.by)}: ${crapsSay(l)}</p>`
    : o.view ? '<p class="arcnote"></p>'
    : mini.point != null ? `<p class="arcnote">${W(turn)} · point ${mini.point} is on</p>`
    : `<p class="arcnote">${W(turn)}'s turn</p>`;
  const again = !c && o.held && l && l.by === turn && l.result === 'win';   // a round won with the turn kept (Go again on success)
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('roll')}${o.locked ? ' disabled' : ''}>${again ? 'Roll again' : 'Roll'}</button></div>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="krabs">${top}<div class="kfelt${glow}"${glow && play ? ` style="--d:${tRes}ms"` : ''}>${dice}</div>${log}${res}</div>${btn}</div>`;
}
// The miniature: the felt with the two dice (the last roll's faces, ringed green when it won its round and greyed
// when it lost; blank before a roll), and each player's rounds won as pips under it.
export function miniature(mini, final) {
  const l = mini.last, d = l ? l.roll || (l.rolls || [])[(l.rolls || []).length - 1] : null, goal = tune(mini).goal;
  const dice = `<div class="tcdice${d && l.result === 'win' ? ' w' : d && l.result === 'lose' ? ' l' : ''}"><span>${d ? dieFace(d[0]) : ''}</span><span>${d ? dieFace(d[1]) : ''}</span></div>`;
  return `<div class="tcr" aria-label="Krabs: X ${mini.wins.X}, O ${mini.wins.O} of ${goal} rounds"><div class="tfelt" aria-hidden="true">${dice}</div><div class="tpip">${pipRows(mini.wins, goal)}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = crapsTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, held: state.lock != null && state.lock === state.zoom }); return g;
}
// A round won with the turn kept (Go again on success): the header's line, once the result has played.
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> goes again`; }
export function moveText(f, who) {
  return !f.craps ? `${who} rolled` : f.craps.kind === 'stop' ? `${who} stopped on point ${f.craps.point}` : f.craps.result === 'win' ? `${who} won the round` : `${who} lost the round`;
}
export function sounds(f, add, won, mini, last) {   // each roll: the rattle, the dice's first touch of the felt and their landing; the marker landing on its number; the round's result as the last pair lands
  const c = f.craps;
  if (!c) return;
  if (c.kind === 'stop') { add('toggle', 0); return; }
  if (c.roll) { add('rattle', 0); add('thunk', 500); if (c.result === 'win') add('ding', 700); else if (c.result === 'lose') add('thud', 700); return; }   // (a single roll, from before)
  const tim = crapsTimes(c.rolls, c.point, c.was), n = c.rolls.length;
  c.rolls.forEach((d, k) => { add('rattle', tim.at[k]); add('diceTap', tim.at[k] + Math.round(landOf(k) * DIE_BOUNCE)); add('thunk', landAt(tim, k)); });
  if (tim.puck != null) add('clack', tim.puck + CRAPS.puck);
  add(c.result === 'win' ? 'diceWin' : 'diceLose', landAt(tim, n - 1));   // (as the dice hop or dim)
}
