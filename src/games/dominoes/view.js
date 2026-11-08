// Dominoes: the screen, the miniature, the move's words and sounds, and the inputs.
import { DOMT, domCount, domEnds, domFits, domHand, domPile, domTile, domTimes, isDouble } from './rules.js';
import { N, mv, state, zoomedType } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { thumbArt } from '../../ui/thumbs.js';
import { attemptMove } from '../../net/moves.js';
import { mySide } from '../../net/room.js';
import { render } from '../../ui/render.js';

// The screen: both players' tallies up top (name, the tiles in their hand as a small face-down stack and their count),
// the table (an SVG: the line of played tiles snaking down the table in rows, the first tile kept where it was laid
// and the line growing both ways from it along the snake, so no tile ever moves; each tile's divider carries a dot in
// its placer's colour), the row under it (the boneyard, a face-down stack with its count, which is the Draw button when
// nothing in the hand fits, or Pass once the boneyard is empty; the result line in its own reserved room) and the
// viewer's own hand (tappable tiles, the ones that fit lit; the other player's tiles are never drawn face up, only
// counted). A tap on a tile that fits one end (or starts the line) plays it; one that fits both ends shows a ghost of
// it at each end to tap. What animates comes from the move being replayed (a: its recorded flash), never from the
// square's last result.
// Table geometry, in tile units (a tile 2 long and 1 wide, a 0.1 gap): COLS tiles a row, the rows ROWS deep (every
// tile of a double-six set fits the snake), a vertical connector tile at each turn; the first tile at slot ANCHOR.
const COLS = 5, ROWS = 5, PITCH = 2.4, W = COLS * 2.1 + 2.1, H = ROWS * PITCH - 0.4, ANCHOR = 14;
// Every slot of the snake in order: its centre and the direction the line runs through it ('R', 'L' or 'D').
const SLOTS = (() => {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    const y = 1 + r * PITCH, right = r % 2 === 0;
    for (let k = 0; k < COLS; k++) { const kk = right ? k : COLS - 1 - k; out.push({ x: 2.15 + kk * 2.1, y, d: right ? 'R' : 'L' }); }
    if (r < ROWS - 1) out.push({ x: right ? W - 0.5 : 0.5, y: y + PITCH / 2, d: 'D' });
  }
  return out;
})();
const slotOf = pos => SLOTS[Math.max(0, Math.min(SLOTS.length - 1, ANCHOR + pos))];
const ANGLE = { R: 0, L: 180, D: 90 };
// The pips of one half (a 1 x 1 square about the origin), in the usual patterns.
const S = 0.27;
const PIPS = [[], [[0, 0]], [[-S, -S], [S, S]], [[-S, -S], [0, 0], [S, S]], [[-S, -S], [S, -S], [-S, S], [S, S]], [[-S, -S], [S, -S], [0, 0], [-S, S], [S, S]], [[-S, -S], [S, -S], [-S, 0], [S, 0], [-S, S], [S, S]]];
const half = (v, cx, r) => PIPS[Math.max(0, Math.min(6, v))].map(([x, y]) => `<circle class="dpip" cx="${(cx + x).toFixed(2)}" cy="${y.toFixed(2)}" r="${r}"/>`).join('');
// A tile glyph, horizontal about the origin: its face, the divider, the pips of each half, and (by: who placed it) the
// divider's dot in their colour.
export const tileG = (t, by, cls) => `<g class="dtl${cls ? ' ' + cls : ''}"><rect class="dface" x="-1" y="-.5" width="2" height="1" rx=".16"/><path class="ddiv" d="M0 -.38V.38"/>${half(t[0], -0.5, 0.085)}${half(t[1], 0.5, 0.085)}${by ? `<circle class="dby ${by}" r=".09"/>` : ''}</g>`;
const BACK_G = '<g class="dtl back"><rect class="dback" x="-1" y="-.5" width="2" height="1" rx=".16"/><rect class="dbackin" x="-.82" y="-.32" width="1.64" height=".64" rx=".1"/></g>';
const tileSvg = (t, cls, label) => `<svg class="dtsvg${cls ? ' ' + cls : ''}" viewBox="-1.06 -.56 2.12 1.12"${label ? ` aria-label="${label}"` : ' aria-hidden="true"'}>${t ? tileG(t) : BACK_G}</svg>`;
const say = t => `${t[0]}-${t[1]}`;
// A tile on the table at its slot, turned the way the line runs (a double across it).
function placed(t, pos, by, cls, style) {
  const s = slotOf(pos), ang = ANGLE[s.d] + (isDouble(t) ? 90 : 0);
  return `<g class="dslot${cls ? ' ' + cls : ''}"${style ? ` style="${style}"` : ''}><g transform="translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) rotate(${ang})">${tileG(t, by)}</g></g>`;
}
// The ghost of the selected tile at an end (as it would lie there), and where its button goes (percentages of the table).
function ghostAt(mini, k, e) {
  const t = domTile(mini, k), ends = domEnds(mini), left = mini.left || 0;
  const pos = e === 'L' ? -left - 1 : mini.line.length - left;
  const lay = !ends ? t : e === 'L' ? (t[1] === ends[0] ? t : [t[1], t[0]]) : (t[0] === ends[1] ? t : [t[1], t[0]]);
  const s = slotOf(pos), across = s.d === 'D' ? !isDouble(t) : isDouble(t);   // (across the row: a vertical box)
  const bw = across ? 1 : 2, bh = across ? 2 : 1;
  return { pos, lay, box: { l: (100 * (s.x - bw / 2 - 0.15) / W).toFixed(2), t: (100 * (s.y - bh / 2 - 0.15) / H).toFixed(2), w: (100 * (bw + 0.3) / W).toFixed(2), h: (100 * (bh + 0.3) / H).toFixed(2) } };
}
export let domDraft = null;   // { sq, t, by }: the tile picked on this phone (or in a replay), its end still to choose
let seen = null;              // { sq, p, ids }: the viewer's hand as last drawn, so a draw's new tiles pop in
// The miniature: the last stretch of the line as tiny tiles (their pips as dots) and each player's tiles left, as a
// small face-down stack and its count.
export function miniature(mini, final) {
  const line = mini.line.slice(-6), n = line.length;   // the last six tiles, snaking down three rows of two (the picture one shape always)
  const at = k => { const r = Math.floor(k / 2), c = r % 2 ? 1 - (k % 2) : k % 2; return [1.15 + c * 2.1, 0.7 + r * 1.2]; };
  const art = `<svg class="tdom" viewBox="0 0 4.4 3.8" aria-hidden="true">${n ? line.map((t, k) => { const [x, y] = at(k); return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">${tileG(t)}</g>`; }).join('') : `<rect class="dempty" x="1.2" y="1.4" width="2" height="1" rx=".16"/>`}</svg>`;
  const rows = ['X', 'O'].map(p => { const c = domCount(mini, p); return `<div class="tr tdr ${p}"><b class="${p}">${p}</b><i class="tdstk" style="--n:${Math.min(c, 4)}"></i><small class="tdn">${c}</small></div>`; }).join('');
  return thumbArt(art, rows, 'tdoms', `Dominoes: ${mini.line.length} tile${mini.line.length === 1 ? '' : 's'} on the line, X has ${domCount(mini, 'X')} and O has ${domCount(mini, 'O')} in hand`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const dm = a && a.dom ? a.dom : null, t = dm ? domTimes(dm) : null, left = mini.left || 0, o = { view, locked, turn, zoom: state.zoom };
  const me = mySide() || turn;                                    // whose hand this phone shows face up (a match the computer plays both sides of, or two people on one phone: the player on the move)
  const mine = !view && !locked && state.turn === me;
  if (!domDraft || domDraft.sq !== state.zoom || view || f || d) domDraft = null;
  // the table: every tile at its slot, the one just placed sliding in from its player's side
  const tiles = mini.line.map((tl, k) => {
    const pos = k - left, byT = tl[2] === 'X' || tl[2] === 'O' ? tl[2] : null, isNew = dm && dm.kind === 'play' && dm.pos === pos;
    return placed(tl, pos, isNew ? dm.by : byT, isNew ? 'dslide' : '', isNew ? `--dy:${dm.by === me ? H : -H}px;--t:0ms;--d:${DOMT.slide}ms` : '');
  }).join('');
  let ghosts = '', endBtns = '';
  if (domDraft && domDraft.sq === state.zoom && !view) {
    const fits = domFits(mini, domDraft.t);
    for (const e of fits) {
      const gh = ghostAt(mini, domDraft.t, e);
      ghosts += placed(gh.lay, gh.pos, null, 'dghost');
      endBtns += `<button class="domend" data-act="move" ${mv({ t: domDraft.t, e })} style="left:${gh.box.l}%;top:${gh.box.t}%;width:${gh.box.w}%;height:${gh.box.h}%" aria-label="Place ${say(domTile(mini, domDraft.t))} on the ${e === 'L' ? 'left' : 'right'} end"${mine && domDraft.by === me ? '' : ' disabled'}></button>`;
    }
  }
  const table = `<div class="domtable"><div class="dombox" style="--ar:${(W / H).toFixed(4)}"><svg class="domsvg" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}" aria-label="${mini.line.length ? `The line: ${mini.line.map(say).join(', ')}` : 'An empty table'}"><rect class="dfelt" x="0" y="0" width="${W.toFixed(2)}" height="${H.toFixed(2)}" rx=".4"/>${tiles}${ghosts}</svg>${endBtns}</div></div>`;
  // each player's tally: a face-down stack and the count (the count takes its new value as the move lands)
  const tal = p => {
    const now = domCount(mini, p), was = dm && dm.by === p ? (dm.kind === 'play' ? now + 1 - (dm.open ? 1 : 0) : dm.kind === 'draw' ? now - dm.drew : now) : now, moved = was !== now;
    const stk = Array.from({ length: Math.min(now, 8) }, (_, k) => `<i${moved && k >= Math.min(was, 8) ? ` class="dmnew" style="--t:${t.land + (k - Math.min(was, 8)) * 80}ms"` : ''}></i>`).join('');
    return arcTally(p, o, `<span class="domct" aria-label="${now} tile${now === 1 ? '' : 's'} in hand"><span class="dstk" aria-hidden="true">${stk}</span><b class="${moved ? 'cnt' : ''}"${moved ? ` data-from="${was}" data-delay="${t.land}" data-ms="300"` : ''}>${now}</b></span>`);
  };
  // the row under the table: the boneyard (Draw, or Pass once it is empty, when nothing in the hand fits) and the result line
  const pile = domPile(mini), canPlay = (domHand(mini, me) || []).some(k => domFits(mini, k).length > 0);
  const pileWas = dm && dm.kind === 'draw' ? pile + dm.drew : pile;
  const act = mine && !canPlay ? (pile > 0 ? 'draw' : 'pass') : null;
  const pileBtn = `<button class="dompile${act ? ' go ' + act : ''}" data-act="move" ${mv(act || 'draw')} aria-label="${pile} tile${pile === 1 ? '' : 's'} in the boneyard${act ? (act === 'draw' ? ': draw' : ': pass') : ''}"${act ? '' : ' disabled'}><span class="dpstk" aria-hidden="true">${Array.from({ length: Math.min(pile, 5) }, () => '<i></i>').join('')}</span><b class="${pileWas !== pile ? 'cnt' : ''}"${pileWas !== pile ? ` data-from="${pileWas}" data-delay="${t.land}" data-ms="300"` : ''}>${pile}</b><small>${act === 'pass' ? 'Pass' : act === 'draw' ? 'Draw' : ''}</small></button>`;
  const l = mini.last;
  const res = dm ? `<p ${lateAt('domres', t.count)} role="status">${words(dm, true)}</p>`
    : (view || d) && l ? `<p class="domres"><b class="${l.by}">${N(l.by)}</b>: ${words(l, false)}</p>`
    : `<p class="domres">${view || !locked ? '' : `Waiting for <b class="${turn}">${N(turn)}</b>…`}</p>`;
  // the viewer's hand (both hands, once the square is done)
  const hands = view ? ['X', 'O'] : [me];
  const handHtml = hands.map(p => {
    const hand = domHand(mini, p) || [], own = p === me && !view;
    const drawing = dm && dm.kind === 'draw' && dm.by === p;
    if (!seen || seen.sq !== state.zoom || seen.p !== p) seen = { sq: state.zoom, p, ids: hand.slice() };
    const fresh = drawing ? hand.filter(k => !seen.ids.includes(k)) : [];
    if (!drawing) seen.ids = hand.slice();
    const cols = Math.max(6, Math.ceil(hand.length / 2));
    const tilesH = hand.map(k => {
      const tl = domTile(mini, k), fits = own && mine && domFits(mini, k).length > 0, nk = fresh.indexOf(k);
      const cls = `domtile${domDraft && domDraft.t === k && domDraft.by === p ? ' sel' : ''}${own && mine && !fits ? ' dim' : ''}${nk >= 0 ? ' dmnew' : ''}`;
      return `<button class="${cls}" data-act="domtile" data-i="${k}"${nk >= 0 ? ` style="--t:${t.land + nk * 120}ms"` : ''} aria-label="${say(tl)}${fits ? '' : own && mine ? ' (does not fit)' : ''}"${own && mine && fits ? '' : ' disabled'}>${tileSvg(tl)}</button>`;
    }).join('');
    return `<div class="domhand${view ? ' two' : ''}" style="--cols:${cols}" aria-label="${view ? `${p}'s tiles` : 'Your tiles'}">${view ? `<span class="dhn"><b class="${p}">${N(p)}</b></span>` : ''}${tilesH || '<span class="dhempty"></span>'}</div>`;
  }).join('');
  g = `<div class="g-dom"><div class="ctals">${tal('X')}${tal('O')}</div>${table}<div class="domrow">${pileBtn}${res}</div>${handHtml}</div>`;
  return g;
}
// The result line's words for a move (the header says who won the square; here the move alone).
function words(dm, live) {
  const who = `<b class="${dm.by}">${N(dm.by)}</b>`;
  if (dm.blocked) return `Blocked · <b class="X">${N('X')}</b> ${dm.pips.X} · <b class="O">${N('O')}</b> ${dm.pips.O} pips`;
  if (dm.kind === 'draw') return live ? `${who} drew ${dm.drew === 1 ? 'a tile' : dm.drew + ' tiles'}${dm.fits ? '' : ' · no fit'}` : `drew ${dm.drew === 1 ? 'a tile' : dm.drew + ' tiles'}`;
  if (dm.kind === 'pass') return live ? `${who} passed` : 'passed';
  const tl = dm.tile ? `${dm.tile[0]}·${dm.tile[1]}` : 'a tile';
  if (dm.left === 0) return live ? `${who} played ${tl} · last tile!` : `played ${tl} · last tile!`;
  return live ? `${who} played ${tl}${dm.open ? ' · drew 1' : ''}` : `played ${tl}`;
}
export function moveText(f, who) {
  const dm = f.dom || {};
  if (dm.blocked) return `Blocked: ${dm.pips.X} to ${dm.pips.O} pips`;
  if (dm.kind === 'draw') return `${who} drew ${dm.drew === 1 ? 'a tile' : dm.drew + ' tiles'}`;
  if (dm.kind === 'pass') return `${who} passed`;
  return `${who} played ${dm.tile ? dm.tile[0] + '-' + dm.tile[1] : 'a tile'}${dm.left === 0 ? ' · last tile!' : ''}`;
}
// A placed tile clicks down on the table as it lands; a draw's tiles slide off the boneyard one by one; a pass knocks on
// the table; a blocked end knocks twice, then rings for the fewer pips; the last tile out sparkles.
export function sounds(f, add, won, mini, last) {
  const dm = f.dom || {}, t = domTimes(dm);
  if (dm.kind === 'draw') { for (let k = 0; k < Math.min(dm.drew || 1, 6); k++) add('cardSlide', Math.max(0, t.land - 200 - k * 110)); add(dm.fits ? 'domClick' : 'knock', t.land); }
  else if (dm.kind === 'pass') add('knock', 60);
  else { add('domClick', t.land); if (dm.open) add('cardSlide', t.land + 220); if (won && !dm.blocked) add('sparkle', t.land + 260); }
  if (dm.blocked) { add('knock', t.pips || t.land + 300); add('knock', (t.pips || t.land + 300) + 260); if (won) add('ding', (t.pips || t.land + 300) + DOMT.count); else add('thud', (t.pips || t.land + 300) + DOMT.count); }
  return;
}
// A tile tapped in the hand: it goes down where it fits (the first tile, or the one end that takes it); fitting both
// ends, it waits for a tap on one (the ghosts on the table).
export function domtileAct(el, e, act) {
  if (zoomedType() !== 'dominoes' || state.screen !== 'mini') return;
  const sq = state.squares[state.zoom], mini = sq && sq.mini, k = Number(el.dataset.i), me = mySide() || state.turn;
  if (!mini || sq.owner || !Number.isInteger(k) || state.flash || state.done) return;
  const hand = domHand(mini, me) || [];
  if (!hand.includes(k)) return;
  const fits = domFits(mini, k), ends = domEnds(mini);
  if (!fits.length) return;
  if (domDraft && domDraft.t === k) { domDraft = null; render(); return; }
  if (!ends || fits.length === 1 || ends[0] === ends[1]) { domDraft = null; attemptMove({ t: k, e: !ends ? 'R' : fits.length === 1 ? fits[0] : (fits.includes('R') ? 'R' : 'L') }); return; }
  domDraft = { sq: state.zoom, t: k, by: me };
  render();
}
// Someone else's move replayed (ui/replay.js): their tile picked (its ghost at the end it fits, as on their screen), then the move.
function replayInput(act, val, r) {
  if (act === 'domtile' && /^i=\d+$/.test(val || '')) { domDraft = { sq: r.sq, t: Number(val.slice(2)), by: r.by }; return false; }
  return false;
}
const replaySynth = (m, mini) => (m && typeof m === 'object' && Number.isInteger(m.t) ? [[0, 'domtile', 'i=' + m.t], [560, 'move', 'm=' + JSON.stringify(m)]] : null);
export const replay = { input: replayInput, synth: replaySynth };
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { domtile: domtileAct };
