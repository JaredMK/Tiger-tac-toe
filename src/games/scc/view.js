// Ship, Captain & Crew: the screen, the miniature, the move's words and sounds, and the inputs.
import { SCC, sccCfg, sccSum, sccTimes } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';
import { DIE_BOUNCE, die3d } from '../../ui/dice.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';

// The table: each player's cargo toward the target (a bar across their tally); the deck's three places, the ship (6),
// the captain (5) and the crew (4), each with its picture, its name and the die it waits for, the next one wanted
// marked; the tray where the dice are thrown (the shared 3-D die); a row with the rolls left (a pip each) and the
// cargo's crate; the result line; Roll and Keep. A roll throws the dice into the tray, landing one after the other;
// each die set aside is ringed as it lands, then flies to its place on the deck (ui/cardfly.js: from its own die in
// the tray), one after another in order, a bell each, each higher than the last; the dice left close up; once all
// three are in, the two dice left are ringed in gold as the cargo and their total pops in the crate. Keep (or the last
// roll) sends the cargo from the crate to the player's tally, which counts on as its bar fills; a turn that ends
// without all three greys the dice, marks the places still empty and puts a struck 0 in the crate.
// Everything is timed from the move (rules.js sccTimes) and drawn from the move's own flash (or, once it has played,
// from the move still on show); nothing moves when a line or a die comes or goes.
const ROLE = ['ship', 'captain', 'crew'], NAME = ['Ship', 'Captain', 'Crew'];
const FIG = {
  ship: '<path d="M6 30h36l-6 9H12z"/><path d="M24 6v24" class="mast"/><path d="M24 8l12 17H24z" class="sail"/>',
  captain: '<path d="M7 27c4-12 30-12 34 0z"/><path d="M5 27h38v4H5z"/><circle cx="24" cy="19" r="3.2" class="badge"/>',
  crew: '<circle cx="24" cy="14" r="7"/><path d="M11 40c1-11 25-11 26 0z"/><path d="M15 11h18l-2-5H17z" class="cap"/>',
};
export const SCC_BELL = [0.84, 1, 1.19];                          // the bell's pitch for the ship, the captain, the crew (shipBell's playback rate)
const W = p => `<b class="${p}">${N(p)}</b>`;
// When die k of n thrown together lands (ms into the move): the last at SCC.land, each one before it a little sooner.
export const sccLand = (k, n) => SCC.land - (n - 1 - k) * SCC.stag;
function sccTable(mini, a, o) {
  const s = a && a.scc ? a.scc : null, held = !s && o.done && o.done.type === 'scc' && o.done.scc ? o.done.scc : null;   // the move playing; else the move made here, still on show
  const m = s || held, cf = sccCfg(mini), T = cf.target, turn = o.turn, tm = s ? sccTimes(s) : null;   // (tm: a move is playing; reduced motion: the stylesheet plays none of it and hides what only a flight takes away)
  const t = mini.turn, ends = !!(m && (m.kind === 'keep' || m.end)), roll = !!(m && m.kind === 'roll');
  // the tallies: the cargo so far on a bar; a move's points fly in from the crate and count on as they land
  const tal = p => {
    const now = mini.score[p], gain = !!(s && s.by === p && ends && s.pts > 0), was = gain ? s.from : now;
    const at = tm && tm.count != null ? tm.count : 0;
    const bar = `<i class="sccbar ${p}"><b class="${gain && tm ? 'grow' : ''}" style="width:${(now / T * 100).toFixed(1)}%;--w0:${(was / T * 100).toFixed(1)}%;--t:${at}ms"></b></i>`;
    const num = gain && tm ? `<b class="cnt" data-from="${was}" data-delay="${at}" data-ms="${SCC.score - 100}">${now}</b>` : `<b>${now}</b>`;
    const chip = gain && tm ? `<b class="sccplus"${cfFrom('scccrate', tm.score, { go: true, d: SCC.fly })} aria-hidden="true">+${s.pts}</b>` : '';
    return arcTally(p, o, `<span class="sccs">${bar}<small>${num} / ${T}</small>${chip}</span>`);
  };
  // what the table shows: the move on show (its flash), else the turn under way, else nothing yet
  let lv0 = 0, lv = 0, dice = null, took = [], cargo = null, by = null;
  if (m) {
    by = m.by; lv0 = roll ? m.lv0 : m.lv; lv = m.lv; cargo = m.cargo;
    if (roll) { dice = m.rolled.slice(); took = m.took.slice(); } else dice = m.cargo ? m.cargo.slice() : [];
  } else if (t) { by = t.by; lv0 = lv = t.lv; dice = t.dice.slice(); cargo = t.cargo; }
  const pc = by || turn, isCargo = lv >= 3, sunk = ends && !isCargo;
  const asideAt = k => (tm ? tm.aside + k * SCC.take : null);       // the k-th die set aside this roll reaches its place
  // the deck: a place fills as its die lands in it; the next one wanted is marked; a turn ended short marks the empty ones
  const slot = (k, role) => {
    const filled = k < lv, fresh = filled && roll && k >= lv0, at = fresh ? asideAt(k - lv0) : null;
    const die = filled ? `<span class="sccsd"${at != null ? cfFrom('sccd:' + took[k - lv0], at - SCC.fly, { d: SCC.fly }) : ''}>${dieFace(6 - k)}</span>` : `<span class="sccsd e">${dieFace(6 - k)}</span>`;
    const miss = sunk && !filled, st = `--k:${k}` + (at != null ? `;--t:${at}ms` : miss && tm ? `;--t:${tm.score}ms` : '');
    return `<div class="sccslot ${role}${filled ? ' on' : ''}${at != null ? ' fresh' : ''}${!filled && k === lv && !ends && !o.view && !(tm && lv > lv0) ? ' next' : ''}${miss ? ` miss${tm ? ' late' : ''}` : ''}" style="${st}" role="img" aria-label="The ${role} (a ${6 - k})${filled ? ': aboard' : ''}"><svg viewBox="0 0 48 44" aria-hidden="true">${FIG[role]}</svg><b class="sccnm" aria-hidden="true">${NAME[k]}</b>${die}</div>`;
  };
  const cheer = o.won && tm && tm.count != null;                   // (the square won: the three hop as the last points are in)
  const deck = `<div class="sccdeck${cheer ? ' cheer' : ''}"${cheer ? ` style="--tw:${tm.count + SCC.score - 150}ms"` : ''}>${ROLE.map((r, k) => slot(k, r)).join('')}</div>`;
  // the tray: the dice in a row about its middle; a roll's dice are thrown in, the ones set aside leave for the deck and the rest close up
  const n = dice ? dice.length : SCC.dice, left = n - took.length;
  let rest = 0;
  const cells = Array.from({ length: n }, (_, j) => {
    const v = dice ? dice[j] : null, ti = took.indexOf(j), goes = ti >= 0, r = goes ? -1 : rest++;
    if (goes && !tm) return '';                                     // (not playing: it is on the deck already)
    const crg = isCargo && !goes, st = [], cls = ['sccd'];
    if (roll && tm) st.push(`--tl:${sccLand(j, n)}ms`);
    if (goes) { cls.push('go'); st.push(`--tg:${asideAt(ti) - SCC.fly}ms`); }
    else if (roll && tm && took.length) { cls.push('gather'); st.push(`--dx:${((r - (left - 1) / 2) - (j - (n - 1) / 2)).toFixed(2)}`, `--ta:${tm.cargo - SCC.shown}ms`); }
    if (crg) { cls.push('crg'); if (roll && tm && lv0 < 3) { cls.push('late'); st.push(`--tc:${tm.cargo}ms`); } }
    if (sunk) { cls.push('dull'); if (tm) { cls.push('late'); st.push(`--tz:${tm.score}ms`); } }
    return `<span class="${cls.join(' ')}"${st.length ? ` style="${st.join(';')}"` : ''}${goes ? cfAnchor('sccd:' + j) : ''} role="img" aria-label="${v == null ? 'A die' : v}">${die3d(v, { roll: roll && tm ? sccLand(j, n) : 0, v: j })}</span>`;
  }).join('');
  const tray = `<div class="scctray${dice ? '' : ' idle'}" aria-label="The dice"><div class="sccrow">${cells}</div></div>`;
  // the row under the tray: the rolls left (a pip each, spent as the roll is made) and the cargo's crate
  const used = m ? m.n : t ? t.n : 0, rollsLeft = ends ? 0 : Math.max(0, cf.rolls - used);
  const dots = `<span class="sccrl" role="img" aria-label="${rollsLeft} roll${rollsLeft === 1 ? '' : 's'} left"><small aria-hidden="true">Rolls</small>${Array.from({ length: cf.rolls }, (_, k) => `<i class="${k < rollsLeft ? 'on' : ''}"></i>`).join('')}</span>`;
  const cv = isCargo && cargo ? sccSum(cargo) : null, scored = ends && isCargo;
  // (the crate's number: a first cargo pops in as the dice close up; a reroll's shows as its dice land; a turn ended short: a struck 0)
  const cAt = !tm || !roll ? null : sunk ? tm.score : lv0 < 3 ? tm.cargo : tm.land;
  const cnum = sunk ? '0' : cv != null ? String(cv) : '';
  const comes = cAt != null && (sunk || lv0 < 3);                   // (the crate itself turns with its first number)
  const cst = [comes ? `--tc:${cAt}ms` : '', scored && tm ? `--ts:${tm.score}ms` : ''].filter(Boolean).join(';');
  const crate = `<span class="scccrate${cv != null ? ' full' : ''}${sunk ? ' zero' : ''}${comes ? ' in' : ''}${scored ? ` spent${tm ? ' late' : ''}` : ''}"${cst ? ` style="${cst}"` : ''}${cfAnchor('scccrate')} role="img" aria-label="Cargo: ${cnum || 'none yet'}"><b ${lateAt('', cAt, 'pop')}>${cnum}</b></span>`;
  const info = `<div class="sccinfo">${dots}<span class="scccg"><small aria-hidden="true">Cargo</small>${crate}</span></div>`;
  // the result line
  let res;
  if (m) {
    const at = tm ? (ends ? (m.pts > 0 ? tm.count : tm.score) : took.length ? tm.cargo : tm.land) : null;
    const say = ends
      ? (m.pts > 0 ? `${W(m.by)} scored ${m.pts}!` : m.lv >= 3 ? 'No cargo' : `No ${ROLE[m.lv]}: nothing scored`)
      : lv > lv0 ? (lv >= 3 ? (lv0 === 0 ? 'Ship, captain and crew!' : 'Crew aboard!') : lv === 1 ? 'Ship!' : lv0 === 0 ? 'Ship and captain!' : 'Captain!')
      : lv0 >= 3 ? `New cargo: ${sccSum(m.cargo)}` : `No ${ROLE[lv0]} yet`;
    const ok = ends ? m.pts > 0 : lv > lv0 || lv0 >= 3;
    res = `<p ${lateAt('arcres ' + (ok ? 'ok' : 'no'), at)} role="status">${say}</p>`;
  } else res = `<p class="arcnote">${o.view ? '' : t && t.by === turn ? `${W(turn)}: ${t.lv >= 3 ? `cargo ${sccSum(t.cargo)}` : ['no ship yet', 'the ship is in', 'ship and captain in'][t.lv]}` : `${W(turn)}'s turn`}</p>`;
  // the buttons: Roll (again, or the cargo) and Keep (what it scores); while a move plays, as they were before it
  const mine = t && t.by === turn ? t : null, busy = !!m;
  const pre = busy ? (roll && m.n > 1 ? { lv: m.lv0 } : !roll ? { lv: 3, cargo: m.cargo } : null) : mine;
  const rollLabel = pre && pre.lv >= 3 ? 'Reroll' : pre ? 'Roll again' : 'Roll';
  const keepN = pre && pre.lv >= 3 && pre.cargo ? ` <b>${sccSum(pre.cargo)}</b>` : '';
  const canRoll = !o.locked && !busy && (!mine || mine.n < cf.rolls), canKeep = !o.locked && !busy && !!(mine && mine.lv >= 3);
  const btn = o.view ? '' : `<div class="cbtns two"><button class="big ${turn}" data-act="move" ${mv('roll')}${canRoll ? '' : ' disabled'}>${rollLabel}</button><button class="big bank" data-act="move" ${mv('keep')}${canKeep ? '' : ' disabled'}>Keep${keepN}</button></div>`;
  return `<div class="g-arc g-scc pc-${pc}" style="--land:${SCC.land}ms"><div class="ctals">${tal('X')}${tal('O')}</div><div class="scc">${deck}${tray}${info}${res}</div>${btn}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = sccTable(mini, a, { view, locked, turn, zoom: state.zoom, done: a ? null : d, won: !!fresh }); return g;
}
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
  return mini.turn && mini.turn.by === turn ? `${who}: turn in progress` : f ? '' : `${who} scored · goes again`;
}
export function moveText(f, who) {
  const s = f.scc;
  if (!s) return `${who} rolled`;
  if (s.kind === 'keep' || s.end) return s.pts > 0 ? `${who} scored ${s.pts} cargo` : `${who} scored nothing`;
  return s.lv > s.lv0 ? `${who} set aside the ${ROLE[s.lv - 1]}` : `${who} rolled`;
}
// A roll: the rattle, a light click as the first dice touch down and the thunk of the last; the ship's bell as each die
// set aside reaches its place, higher for the captain and higher again for the crew; the cargo's chime as it shows; a
// turn's end: a ding as the cargo counts in, a thud for nothing.
export function sounds(f, add, won, mini, last) {
  const s = f.scc;
  if (!s) return;
  const tm = sccTimes(s);
  if (s.kind === 'roll') {
    const n = s.rolled.length;
    add('rattle', 0); add('diceTap', Math.round(sccLand(0, n) * DIE_BOUNCE)); if (n > 2) add('diceTap', sccLand(Math.floor(n / 2) - 1, n)); add('thunk', SCC.land);
    s.took.forEach((_, k) => add('shipBell', tm.aside + k * SCC.take, SCC_BELL[Math.min(2, s.lv0 + k)]));
    if (s.lv >= 3 && !s.end) add('point', s.lv0 < 3 ? tm.cargo : tm.land + 80);
  }
  if (s.kind === 'keep' || s.end) add(s.pts > 0 ? 'ding' : 'thud', tm.count);
}
