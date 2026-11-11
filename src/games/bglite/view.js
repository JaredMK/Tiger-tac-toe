// Backgammon Lite: the screen, the miniature, the move's words and sounds, and the inputs.
import { BGL, BGLT, bglDice, bglHome, bglMoves, bglTimes, bglTo, bglV2 } from './rules.js';
import { N, REDUCED, mv, state, waitLine, zoomedType } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { markSvgG, pipRows, tokSvg } from '../../ui/thumbs.js';
import { render } from '../../ui/render.js';

// The board: the track's n points in a row, with a zone at each end: the left one holds X's pieces waiting to start
// (top) and O's pieces borne off (bottom), the right one O's waiting and X's off. X travels left to right, O right to
// left (the arrows under the board). Pieces stack up from the bottom of their point (one side to a point: a lone
// enemy is hit, two block). Every piece has a cell (column, slot of 6) worked out from the positions alone (bglCells),
// so a move is drawn as the change between the cells before and after it: the piece slides, a hit piece flies home
// after it lands, a piece borne off slides into its tray. The dice: tap one to choose it (the chosen one ringed; a
// used one faded); the pieces it can move glow, with a ring where each would land; a tap on either is the move.
const SLOTS = 6;
export let bglDraft = null;   // { sq, d }: the die chosen on this phone (or in a replay)
// Each piece's cell: { 'X0': [col, slot], ... } for positions pos on a track of n points.
export function bglCells(pos, n) {
  const out = {};
  for (const p of ['X', 'O']) {
    const groups = new Map();
    pos[p].forEach((a, k) => { if (!groups.has(a)) groups.set(a, []); groups.get(a).push(k); });
    for (const [a, ks] of groups) ks.forEach((k, i) => {
      let col, slot;
      if (a <= 0) { col = p === 'X' ? 0 : n + 1; slot = i; }                          // waiting at the start: the zone's top
      else if (a > n) { col = p === 'X' ? n + 1 : 0; slot = SLOTS - 1 - i; }          // borne off: the other zone's bottom
      else { col = p === 'X' ? a : n + 1 - a; slot = SLOTS - 1 - i; }                // on the track: up from the bottom
      out[p + k] = [col, slot];
    });
  }
  return out;
}
// Where a piece would land: [col, slot] (the next free slot up from the bottom of that point or tray).
function landing(mini, p, k, v) {
  const n = mini.n, to = bglTo(mini, p, mini.pos[p][k], v), col = to > n ? (p === 'X' ? n + 1 : 0) : (p === 'X' ? to : n + 1 - to);
  const there = mini.pos[p].filter((a, j) => j !== k && (to > n ? a > n : a === to)).length;
  return [col, SLOTS - 1 - there];
}
const cellStyle = (col, slot, c) => `left:${(col * 100 / c).toFixed(3)}%;top:${(slot * 100 / SLOTS).toFixed(3)}%;width:${(100 / c).toFixed(3)}%;height:${(100 / SLOTS).toFixed(3)}%`;
const piece = p => `<svg viewBox="-10 -10 20 20" aria-hidden="true"><circle r="8.6"/>${markSvgG(p, 3.6)}</svg>`;
// The dice to show: those in play for the player on the move, or (in a move's flash) the move's own.
function shownDice(mini, b, turn) {
  if (b) return { v: b.v, used: b.kind === 'roll' ? b.v.map((x, i) => !!b.one && i === 1) : b.used, by: b.by };
  const dc = bglDice(mini, turn);
  return dc ? { v: dc.v, used: dc.used, by: dc.by } : null;
}
function table(mini, a, o) {
  const b = a && a.bgl ? a.bgl : null, n = mini.n, c = n + 2, turn = o.turn, t = bglTimes(b);
  const me = o.view || o.locked ? null : turn;
  if (!bglDraft || bglDraft.sq !== o.zoom || o.view || o.f || o.d) bglDraft = null;
  const moves = me && !b ? bglMoves(mini, me) : [];
  // the die chosen: the draft's, if it still has a move; else the first with one
  let sel = null;
  if (moves.length) sel = bglDraft && moves.some(x => x.d === bglDraft.d) ? bglDraft.d : moves[0].d;
  if (sel == null && bglDraft && bglDraft.sq === o.zoom) sel = bglDraft.d;   // (a replay: the die the other side chose)
  if (b && b.kind === 'use') sel = b.d;
  const can = new Map(moves.filter(x => x.d === sel).map(x => [x.k, x]));
  // cells now, and (in a move's flash) before it
  const now = bglCells(mini.pos, n);
  let before = null;
  if (b && b.kind === 'use' && !REDUCED) {
    const pos = { X: mini.pos.X.slice(), O: mini.pos.O.slice() };
    pos[b.by][b.k] = b.from;
    if (b.hit) pos[b.by === 'X' ? 'O' : 'X'][b.hit.k] = b.hit.from;
    before = bglCells(pos, n);
  }
  const hitKey = b && b.hit ? (b.by === 'X' ? 'O' : 'X') + b.hit.k : null, movedKey = b && b.kind === 'use' ? b.by + b.k : null;
  const pieces = ['X', 'O'].flatMap(p => [0, 1, 2].map(k => {
    const key = p + k, [col, slot] = now[key];
    let cls = `bglp ${p}`, st = cellStyle(col, slot, c);
    if (before && (key === movedKey || key === hitKey)) {
      const [c0, s0] = before[key];
      if (c0 !== col || s0 !== slot) { cls += key === hitKey ? ' fly' : ' slide'; st += `;--dx:${(c0 - col) * 100}%;--dy:${(s0 - slot) * 100}%;--t:${key === hitKey ? t.hitAt : 0}ms`; }
    }
    if (p === me && can.has(k)) return `<button class="${cls} can" style="${st}" data-act="move" ${mv(can.get(k))} aria-label="Move this piece ${mini.dice.v[sel]}">${piece(p)}</button>`;
    return `<span class="${cls}" style="${st}">${piece(p)}</span>`;
  })).join('');
  // a ring where each piece the chosen die can move would land (a tap there is the same move)
  const seen = new Set();
  const ghosts = me && sel != null ? [...can.values()].map(x => {
    const [col, slot] = landing(mini, me, x.k, mini.dice.v[sel]), key = col + ':' + slot;
    if (seen.has(key)) return ''; seen.add(key);
    return `<button class="bglg ${me}" style="${cellStyle(col, slot, c)}" data-act="move" ${mv(x)} aria-label="Land here"><i></i></button>`;
  }).join('') : '';
  const pts = Array.from({ length: n }, (_, i) => `<i class="bglpt${i % 2 ? ' b' : ''}" style="left:${((i + 1) * 100 / c).toFixed(3)}%;width:${(100 / c).toFixed(3)}%"></i>`).join('');
  const zones = `<i class="bglz l" style="width:${(100 / c).toFixed(3)}%"></i><i class="bglz r" style="width:${(100 / c).toFixed(3)}%"></i>`
    + (bglV2(mini) ? ['X', 'O'].map(p => { const h = bglHome(mini), from = p === 'X' ? n - h + 1 : 1; return `<i class="bglhm ${p}" style="left:${(from * 100 / c).toFixed(3)}%;width:${(h * 100 / c).toFixed(3)}%"></i>`; }).join('') : '');   // each side's home zone: a band in its colour under its last points
  const board = `<div class="bglw"><div class="bglb" style="--c:${c}" role="img" aria-label="The track: ${n} points">${zones}${pts}${pieces}${ghosts}</div></div>`;
  const arrows = `<div class="bglar" aria-hidden="true"><svg class="X" viewBox="0 0 40 12"><path d="M2 6h33M29 1.5l6 4.5-6 4.5"/></svg><svg class="O" viewBox="0 0 40 12"><path d="M38 6H5M11 1.5L5 6l6 4.5"/></svg></div>`;
  // the dice
  const dd = shownDice(mini, b, turn);
  const rollNow = b && b.kind === 'roll' && !REDUCED;
  const dice = dd ? dd.v.map((v, d) => {
    if (!v) return '';
    const used = dd.used[d] && !(b && b.kind === 'use' && b.d === d), picked = sel === d && !(b && b.kind === 'roll');
    const cls = `die bgldie${used ? ' used' : ''}${picked ? ' sel' : ''}${rollNow ? ' roll' : ''}${b && b.kind === 'use' && b.d === d ? ' spend' : ''}`;
    const usable = me && moves.some(x => x.d === d);
    return usable ? `<button class="${cls}" data-act="bgldie" data-i="${d}" aria-label="Use the ${v}">${dieFace(v)}</button>` : `<span class="${cls}" aria-label="${v}${used ? ', used' : ''}">${dieFace(v)}</span>`;
  }).join('') : '';
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const offOf = p => mini.pos[p].filter(x => x > n).length;
  const tal = p => arcTally(p, o, pips(p, offOf(p), BGL.pieces, !!(b && b.kind === 'use' && b.off && b.by === p), b ? t.slid : null));
  let say = '', ok = '';
  if (b) {
    if (b.kind === 'roll') say = b.stuck ? 'No move: the turn passes' : b.one ? `Opening roll: ${b.v[0]}` : b.v.length === 4 ? `Double ${b.v[0]}: four moves` : `${W(b.by)} rolled ${b.v[0]} and ${b.v[1]}`;
    else if (b.hit) { say = `Hit! ${W(b.by === 'X' ? 'O' : 'X')} goes back to the start`; ok = 'ok'; }
    else if (b.off) { say = 'A piece off!'; ok = 'ok'; }
    else if (b.lost) say = b.v.length === 4 ? 'No move for the rest' : 'The other die has no move';
    if (b.again && !say) say = 'Roll again';
  }
  const sayAt = b ? (b.kind === 'roll' ? t.land : b.hit ? t.hitAt : t.slid) : null;
  const res = b && say ? `<p ${lateAt('arcres ' + ok, REDUCED ? null : sayAt)} role="status">${say}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  const inPlay = !!bglDice(mini, turn);
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('roll')}${o.locked || inPlay || b ? ' disabled' : ''}>Roll</button></div>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="bgl">${board}${arrows}<div class="bgldice">${dice}</div>${res}</div>${btn}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  return table(mini, a, { view, locked, turn, zoom: state.zoom, f: !!f, d: !!d });
}
// The miniature: the track as a strip of points with every piece on it (and those waiting in the end zones), and under
// it each player's pieces borne off as pips.
export function miniature(mini, final) {
  const n = mini.n, c = n + 2, cells = bglCells(mini.pos, n), W = c * 10, H = 30;
  const pts = Array.from({ length: n }, (_, i) => `<rect class="tbglpt${i % 2 ? ' b' : ''}" x="${(i + 1) * 10}" y="0" width="10" height="${H}"/>`).join('');
  const toks = ['X', 'O'].flatMap(p => [0, 1, 2].map(k => {
    const [col, slot] = cells[p + k], a = mini.pos[p][k];
    if (a > n) return '';                                         // (borne off: the pips)
    const y = a <= 0 ? 5 + slot * 10 : H - 5 - (SLOTS - 1 - slot) * 10;
    return tokSvg(p, col * 10 + 5, y, 4.4);
  })).join('');
  const art = `<svg class="tbgl" viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect class="tbglz" x="0" y="0" width="${W}" height="${H}" rx="3"/>${pts}${toks}</svg>`;
  const off = { X: mini.pos.X.filter(a => a > n).length, O: mini.pos.O.filter(a => a > n).length };
  return `<div class="tbglm" aria-label="Backgammon Lite: X has ${off.X} of 3 off, O has ${off.O} of 3 off">${art}<div class="tpip tbglp">${pipRows(off, BGL.pieces)}</div></div>`;
}
export function moveText(f, who) {
  const b = f.bgl;
  if (!b) return `${who} played`;
  const rolled = b.v.length === 4 ? `a double ${b.v[0]}` : b.v.filter(Boolean).join(' and ');
  if (b.kind === 'roll') return b.stuck ? `${who} rolled ${rolled}: no move` : `${who} rolled ${rolled}`;
  return `${who} moved ${b.v[b.d]}${b.hit ? ' and hit' : b.off ? ' and bore a piece off' : ''}`;
}
// The roll: the rattle, the dice landing (a thud for no move); a piece: its click as it lands, a hit's thump as the
// other piece flies home, a ding for a piece off.
export function sounds(f, add, won, mini, last) {
  const b = f.bgl;
  if (!b) return;
  if (b.kind === 'roll') { add('rattle', 0); add('thunk', 500); if (b.stuck) add('thud', BGLT.roll); return; }
  const t = bglTimes(b);
  add('clack', BGLT.slide - 60);
  if (b.hit) add('thud', t.hitAt + 40);
  if (b.off) add('ding', t.slid - 80);
}
// A die tapped: chosen (its pieces glow).
export function bgldieAct(el) {
  if (zoomedType() !== 'bglite' || state.screen !== 'mini' || state.flash || state.done) return;
  const d = Number(el.dataset.i);
  if (!(d >= 0 && d <= 3)) return;
  bglDraft = { sq: state.zoom, d };
  render();
}
// Someone else's move replayed (ui/replay.js): the die they chose, then the move.
function replayInput(act, val, r) {
  if (act === 'bgldie' && /^i=[0-3]$/.test(val || '')) { bglDraft = { sq: r.sq, d: Number(val.slice(2)) }; return false; }
  return false;
}
const replaySynth = (m, mini) => (m && typeof m === 'object' && Number.isInteger(m.d) ? [[0, 'bgldie', 'i=' + m.d], [450, 'move', 'm=' + JSON.stringify(m)]] : null);
export const replay = { input: replayInput, synth: replaySynth };
export const actions = { bgldie: bgldieAct };
// The title bar's line while the turn is held to the square (ui/mini.js heldSub): the turn under way (dice to use), or,
// with Go again on success on, a piece borne off and the next roll to come.
export function heldSub(mini, turn, f, a) {
  if (f) return '';
  const who = `<b class="${turn}">${N(turn)}</b>`;
  return bglDice(mini, turn) ? `${who}: dice to use` : `${who} moved a piece off · goes again`;
}
