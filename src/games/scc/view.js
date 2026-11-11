// Ship, Captain & Crew: the screen, the miniature, the move's words and sounds, and the inputs.
import { SCC, sccCfg, sccSum, sccTimes } from './rules.js';
import { N, REDUCED, mv, state } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';

// The table: each player's cargo toward the target (a tally with a bar); the deck's three places, the ship (6), the
// captain (5) and the crew (4), each filling in its turn; the tray of dice on the table (five places, the dice rolled
// in the middle ones); a line with the rolls left and the cargo; the result line; Roll and Keep. A roll tumbles the
// dice in the tray, then each die set aside flies up out of the tray and lands in its place on the deck, one after
// another; once all three are in, the two dice left glow as the cargo. Keep (or the last roll) counts the cargo into
// the total. Everything is timed from the move (rules.js sccTimes) and drawn from the move's own flash.
const ROLE = ['ship', 'captain', 'crew'];
const FIG = {
  ship: '<path d="M6 30h36l-6 9H12z"/><path d="M24 6v24" class="mast"/><path d="M24 8l12 17H24z" class="sail"/>',
  captain: '<path d="M7 27c4-12 30-12 34 0z"/><path d="M5 27h38v4H5z"/><circle cx="24" cy="19" r="3.2" class="badge"/>',
  crew: '<circle cx="24" cy="14" r="7"/><path d="M11 40c1-11 25-11 26 0z"/><path d="M15 11h18l-2-5H17z" class="cap"/>',
};
const FLICK = [3, 1, 4, 2, 5];
const tumble = n => FLICK.map((k, j) => `<span class="rface fl f${j}" aria-hidden="true">${dieFace(((n - 1 + k) % 6) + 1)}</span>`).join('') + `<span class="rface fin">${dieFace(n)}</span>`;
const W = p => `<b class="${p}">${N(p)}</b>`;
function sccTable(mini, a, o) {
  const s = a && a.scc ? a.scc : null, cf = sccCfg(mini), T = cf.target, turn = o.turn, tm = s && !REDUCED ? sccTimes(s) : null;
  const t = mini.turn;
  // the tallies: the cargo so far, the move's points counting in as they land
  const tal = p => {
    const now = mini.score[p], gain = s && s.by === p && (s.kind === 'keep' || s.end) && s.pts > 0, was = gain ? s.from : now;
    const at = tm && tm.score != null ? tm.score : 0;
    const bar = `<i class="sccbar ${p}"><b class="${gain && tm ? 'grow' : ''}" style="width:${(now / T * 100).toFixed(1)}%;--w0:${(was / T * 100).toFixed(1)}%;--t:${at}ms"></b></i>`;
    const num = gain && tm ? `<b class="cnt" data-from="${was}" data-delay="${at}" data-ms="450">${now}</b>` : `<b>${now}</b>`;
    return arcTally(p, o, `<span class="sccs">${bar}<small>${num} / ${T}</small></span>`);
  };
  // what the table shows: the move being played (its flash), else the turn under way, else nothing yet
  let lv0 = 0, lv = 0, dice = [], took = [], cargo = null, roll = false, by = null;
  if (s) {
    by = s.by; lv0 = s.kind === 'roll' ? s.lv0 : s.lv; lv = s.lv; cargo = s.cargo;
    if (s.kind === 'roll') { roll = true; dice = s.rolled.slice(); took = s.took.slice(); }
    else dice = s.cargo ? s.cargo.slice() : [];
  } else if (t) { by = t.by; lv0 = lv = t.lv; dice = t.dice.slice(); cargo = t.cargo; }
  const nAside = took.length;
  const asideAt = k => (tm ? tm.aside + k * SCC.take : null);       // the k-th die set aside this roll lands on the deck
  const slot = (k, role) => {
    const filled = k < lv, fresh = filled && k >= lv0, at = fresh ? asideAt(k - lv0) : null;
    const die = filled ? `<span ${lateAt('sccsd', at)}>${dieFace(6 - k)}</span>` : `<span class="sccsd e">${dieFace(6 - k)}</span>`;
    return `<div class="sccslot ${role}${filled ? ' on' : ''}${fresh ? ' fresh' : ''}"${fresh && at != null ? ` style="--t:${at}ms"` : ''} aria-label="The ${role} (${6 - k})${filled ? ': in' : ''}"><svg viewBox="0 0 48 44" aria-hidden="true">${FIG[role]}</svg>${die}</div>`;
  };
  const deck = `<div class="sccdeck">${ROLE.map((r, k) => slot(k, r)).join('')}</div>`;
  // the tray: five places, the dice in the middle ones
  const off = Math.floor((SCC.dice - dice.length) / 2), cargoAt = tm ? tm.cargo : null, isCargo = lv >= 3;
  const cells = Array.from({ length: SCC.dice }, (_, c) => {
    const j = c - off, v = j >= 0 && j < dice.length ? dice[j] : null;
    if (v == null) return '<span class="sccd none"></span>';
    const ti = took.indexOf(j), goes = ti >= 0;
    const crg = isCargo && !goes;
    const st = [];
    if (goes && tm) st.push(`--t2:${asideAt(ti) - 120}ms`);
    if (crg && tm) st.push(`--t3:${cargoAt}ms`);
    const cls = `sccd${roll && tm ? ' die roll rr' : ''}${goes ? ' go' : ''}${goes && !tm ? ' gone' : ''}${crg ? (tm ? ' crg late' : ' crg') : ''}${!isCargo && s && s.end ? ' dull' : ''}`;
    return `<span class="${cls}"${st.length ? ` style="${st.join(';')}"` : ''} aria-label="${v}">${roll && tm ? tumble(v) : dieFace(v)}</span>`;
  }).join('');
  const tray = `<div class="scctray${!s && !t ? ' idle' : ''}" aria-label="The dice">${dice.length ? cells : Array.from({ length: SCC.dice }, () => '<span class="sccd blank"></span>').join('')}</div>`;
  // the line under the tray: the rolls left (dots) and the cargo once there is one
  const used = s ? s.n : t ? t.n : 0, rollsLeft = Math.max(0, cf.rolls - used);
  const dots = `<span class="sccrl" aria-label="${rollsLeft} roll${rollsLeft === 1 ? '' : 's'} left">${Array.from({ length: cf.rolls }, (_, k) => `<i class="${k < used ? 'used' : ''}"></i>`).join('')}</span>`;
  const cv = isCargo && cargo ? sccSum(cargo) : null;
  const cline = `<span class="scccg">${cv != null ? `<span ${lateAt('', cargoAt)}>Cargo <b>${cv}</b></span>` : ''}</span>`;
  const info = `<div class="sccinfo">${dots}${cline}</div>`;
  // the result line
  let res;
  if (s) {
    const at = tm ? (s.kind === 'keep' || s.end ? tm.score : tm.cargo) : null;
    const say = s.kind === 'keep' || s.end
      ? (s.pts > 0 ? `${W(s.by)} scored ${s.pts}!` : s.lv >= 3 ? 'No cargo' : `No ${ROLE[s.lv]}: nothing scored`)
      : lv > lv0 ? (lv >= 3 ? (lv0 === 0 ? 'Ship, captain and crew!' : 'Crew aboard!') : lv === 1 ? 'Ship!' : lv0 === 0 ? 'Ship and captain!' : 'Captain!')
      : lv0 >= 3 ? `New cargo: ${sccSum(s.cargo)}` : `No ${ROLE[lv0]} yet`;
    const ok = s.kind === 'keep' || s.end ? s.pts > 0 : lv > lv0 || lv0 >= 3;
    res = `<p ${lateAt('arcres ' + (ok ? 'ok' : 'no'), at)} role="status">${say}</p>`;
  } else res = `<p class="arcnote">${o.view ? '' : t && t.by === turn ? `${W(turn)}: ${t.lv >= 3 ? `cargo ${sccSum(t.cargo)}` : ['no ship yet', 'the ship is in', 'ship and captain in'][t.lv]}` : `${W(turn)}'s turn`}</p>`;
  // the buttons: Roll (again, or the cargo) and Keep; while a move plays, as they were before it
  const mine = t && t.by === turn ? t : null, busy = !!s;
  const pre = busy ? (s.kind === 'roll' && s.n > 1 ? { lv: s.lv0 } : null) : mine;
  const rollLabel = pre && pre.lv >= 3 ? 'Reroll' : pre ? 'Roll again' : 'Roll';
  const canRoll = !o.locked && !busy && (!mine || mine.n < cf.rolls), canKeep = !o.locked && !busy && !!(mine && mine.lv >= 3);
  const btn = o.view ? '' : `<div class="cbtns two"><button class="big ${turn}" data-act="move" ${mv('roll')}${canRoll ? '' : ' disabled'}>${rollLabel}</button><button class="big bank" data-act="move" ${mv('keep')}${canKeep ? '' : ' disabled'}>Keep</button></div>`;
  return `<div class="g-arc g-scc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="scc${nAside ? ' moving' : ''}">${deck}${tray}${info}${res}</div>${btn}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = sccTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
// The miniature: two little ships on the water, X's on the left, O's on the right, each with its mark on the sail and
// its hold filling with cargo toward the target.
// The miniature: each player's ship on the water, the mast standing on the deck and the sail over the hull's right half
// (beside the cargo hold, which fills toward the target).
export function miniature(mini, final) {
  const T = sccCfg(mini).target;
  const ship = (p, x) => {
    const f = Math.max(0, Math.min(1, mini.score[p] / T)), hh = 13 * f;
    return `<g class="tsccs ${p}" transform="translate(${x} 0)"><path class="tsccm" d="M26 5v39"/><path class="tsccsl" d="M26 7l14 31H26z"/><g transform="translate(30.8 29)">${markSvgG(p, 3.4)}</g>`
      + `<rect class="tscch" x="6" y="31" width="13" height="13" rx="1.5"/><rect class="tsccf" x="6" y="${(44 - hh).toFixed(2)}" width="13" height="${hh.toFixed(2)}" rx="1.5"/>`
      + `<path class="tsccb" d="M2 44h40l-6 9H8z"/></g>`;
  };
  return `<div class="tscc" aria-label="Ship, Captain and Crew: X ${mini.score.X}, O ${mini.score.O} of ${T}"><svg viewBox="0 0 96 60" aria-hidden="true"><path class="tsccw" d="M0 54q6-3 12 0t12 0 12 0 12 0 12 0 12 0 12 0 12 0V60H0z"/>${ship('X', 2)}${ship('O', 50)}</svg></div>`;
}
// The line under the game's name while the turn is held to the square (ui/mini.js heldSub): the turn under way, or
// (with "Go again on success" on) a score that keeps the turn.
export function heldSub(mini, turn, f, a) {
  const who = `<b class="${turn}">${N(turn)}</b>`;
  return mini.turn && mini.turn.by === turn ? `${who}'s turn in progress` : f ? '' : `${who} scored · goes again`;
}
export function moveText(f, who) {
  const s = f.scc;
  if (!s) return `${who} rolled`;
  if (s.kind === 'keep' || s.end) return s.pts > 0 ? `${who} scored ${s.pts} cargo` : `${who} scored nothing`;
  return s.lv > s.lv0 ? `${who} set aside the ${ROLE[s.lv - 1]}` : `${who} rolled`;
}
// A roll: the rattle and the dice landing; a clack as each die set aside lands on the deck; the cargo's chime once all
// three are in; a turn's end: a ding as the cargo counts in, a thud for nothing.
export function sounds(f, add, won, mini, last) {
  const s = f.scc;
  if (!s) return;
  const tm = sccTimes(s);
  if (s.kind === 'roll') { add('rattle', 0); add('thunk', SCC.land - 150); s.took.forEach((_, k) => add('clack', tm.aside + k * SCC.take)); if (s.lv >= 3 && !s.end) add('point', tm.cargo); }
  if (s.kind === 'keep' || s.end) add(s.pts > 0 ? 'ding' : 'thud', tm.score);
}
