// Dominoes: the screen, the miniature, the move's words and sounds, and the inputs.
import { DOMT, domCount, domEnds, domFits, domHand, domPile, domTile, domTimes, isDouble } from './rules.js';
import { N, mv, state, zoomedType, waitLine } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { thumbArt } from '../../ui/thumbs.js';
import { attemptMove } from '../../net/moves.js';
import { mySide } from '../../net/room.js';
import { render } from '../../ui/render.js';

// The screen: both players' tallies up top (name, the tiles in their hand as a small face-down stack and their count),
// the table (an SVG: the line of played tiles laid as on a real table, end to end, doubles crosswise, snaking down the
// felt in rows; the first tile stays where it was laid and the line grows both ways from it, so no tile ever moves;
// each tile's divider carries a dot in its placer's colour), the row under it (the boneyard, a face-down stack with its
// count, which is the Draw button when nothing in the hand fits, or Pass once the boneyard is empty; the result line in
// its own reserved room) and the viewer's own hand (tappable tiles, the ones that fit lit; the other player's tiles are
// never drawn face up, only counted). A tap on a tile that fits one end (or starts the line) plays it; one that fits both
// ends shows a ghost of it at each end to tap. What animates comes from the move being replayed (a: its recorded flash),
// never from the square's last result.
// Table geometry, in tile units (a tile 2 long and 1 wide). A row's run is x in [0, run]; the corner columns [-1, 0]
// and [run, run + 1] take the tiles that turn; the first tile lies on the anchor row (y = 0) from `anchor`, and the line
// snakes down from its right end and up from its left (domLayout). The felt is always TABLE.w wide and holds whole rows:
// three rows about the anchor to begin with (TABLE.minH), then, as the line reaches a row past them, a row more or the
// felt moved down (or up) a row to keep the line on it, so the tiles are drawn as large as the room allows and change
// size only at the move that adds a row the room cannot take.
export const DOML = { run: 10, anchor: 4, margin: 0.5 };
export const TABLE = { x: -1, w: DOML.run + 2, minH: 6 };
const deg = (dx, dy) => Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
// The line laid out as real players lay it: every tile touching the one before end to end (the matching halves side by
// side, no gap, no overlap), a double crosswise to the line, and the line turning at the edge of the run with the tile
// that would cross it (down on the right side of the first tile, up on its left): that tile lies along the turn beside
// the row's last half, and the next tile runs back along the row below (or above) from under it. A double at a corner
// lies as the corner tile would (crosswise to the row it ends) and the line continues from its end. Pure: the line
// (line[k] = [a, b, by], a facing the left end), the count of tiles left of the first (left) and the run's length.
// Returns each tile's centre (x, y), rotation (rot: the glyph's a half turned to its side of the line), whether it is a
// double (dbl), its two contact points (l, r: the midpoints of the edges it shares with its neighbours, towards the line's
// left and right ends) and its halves' centres with their values (ha, hb), plus the felt (box) that holds them all.
export function domLayout(line, left = 0, run = DOML.run) {
  const n = line.length, tiles = new Array(n), T = TABLE, m = DOML.margin;
  if (!n) return { tiles, box: { x: T.x, y: -T.minH / 2, w: T.w, h: T.minH }, span: null };
  const l0 = Math.max(0, Math.min(n - 1, left | 0)), ax = DOML.anchor;
  walk(line.slice(l0), ax, 0, 1, 1, true, run, (p, k) => { tiles[l0 + k] = p; });            // the first tile and the line's right part: rightward from the anchor, turning down
  walk(line.slice(0, l0).reverse(), ax, 0, -1, -1, false, run, (p, k) => { tiles[l0 - 1 - k] = p; });   // the left part: leftward from the first tile's left end, turning up
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of tiles) { const hw = p.rot % 180 ? 0.5 : 1, hh = p.rot % 180 ? 1 : 0.5; x0 = Math.min(x0, p.x - hw); x1 = Math.max(x1, p.x + hw); y0 = Math.min(y0, p.y - hh); y1 = Math.max(y1, p.y + hh); }
  // the felt: whole units from the line's top to its bottom (a margin each side), at least minH tall and as centred on the anchor row as that allows
  const top = Math.floor(y0 - m), bot = Math.ceil(y1 + m), h = Math.max(T.minH, bot - top);
  const y = Math.min(top, Math.max(bot - h, -h / 2));
  const box = { x: T.x, y, w: T.w, h };
  return { tiles, box, span: { x0, y0, x1, y1 } };
}
// One part of the line, tile by tile away from the first tile: from the contact point (x, y) along a row running dir
// (+1 right, -1 left), turning sv (+1 down, -1 up) at the run's edge; aIn: the tile's a value faces the first tile.
function walk(seq, x, y, dir, sv, aIn, run, put) {
  let corner = null;   // the corner tile just laid: the column it went along and its row
  seq.forEach((t, k) => {
    const dbl = isDouble(t);
    let c, rot, inP, outP, inH, outH;
    if (corner) {                                                  // the tile after a corner: its in half under the corner tile's end, running back along the new row
      const nd = -dir, ny = corner.y + 2 * sv, cx = corner.cx;
      dir = nd; y = ny;
      inH = [cx, ny]; outH = [cx + nd, ny]; inP = [cx, ny - 0.5 * sv]; outP = [cx + 1.5 * nd, ny];
      c = [cx + 0.5 * nd, ny]; rot = dbl ? 0 : aIn ? deg(nd, 0) : deg(-nd, 0);
      x = cx + 1.5 * nd; corner = null;
    } else if (dbl && (dir > 0 ? x + 1 <= run : x - 1 >= 0)) {   // a double in the run: crosswise, one unit along the row
      c = [x + 0.5 * dir, y]; rot = 90; inP = [x, y]; outP = [x + dir, y]; inH = [x + 0.5 * dir, y - 0.5]; outH = [x + 0.5 * dir, y + 0.5];
      x += dir;
    } else if (!dbl && (dir > 0 ? x + 2 <= run : x - 2 >= 0)) {  // a tile in the run: end to end
      c = [x + dir, y]; rot = aIn ? deg(dir, 0) : deg(-dir, 0); inP = [x, y]; outP = [x + 2 * dir, y]; inH = [x + 0.5 * dir, y]; outH = [x + 1.5 * dir, y];
      x += 2 * dir;
    } else {                                                       // the tile that would cross the edge turns: along the turn, its in half beside the row's last half
      const cx = x + 0.5 * dir;
      c = [cx, y + 0.5 * sv]; rot = dbl ? 90 : aIn ? deg(0, sv) : deg(0, -sv); inP = [x, y]; outP = [cx, y + 1.5 * sv]; inH = [cx, y]; outH = [cx, y + sv];
      corner = { cx, y };
    }
    const toLeft = aIn ? inP : outP, toRight = aIn ? outP : inP;   // the contacts by the line's ends (the right part's in is towards the left end)
    put({ x: c[0], y: c[1], rot: ((rot % 360) + 360) % 360, dbl, l: toLeft, r: toRight, ha: aIn ? inH : outH, hb: aIn ? outH : inH, a: t[0], b: t[1] }, k);
  });
}
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
// A tile on the table at its place in the layout (p), turned the way it lies.
function placed(t, p, by, cls, style) {
  return `<g class="dslot${cls ? ' ' + cls : ''}"${style ? ` style="${style}"` : ''}><g transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.rot})">${tileG(t, by)}</g></g>`;
}
// The ghost of the selected tile at an end (as it would lie there, from the layout of the line with it on), and where
// its button goes (percentages of the felt as it is now).
function ghostAt(mini, k, e, box) {
  const t = domTile(mini, k), ends = domEnds(mini), left = mini.left || 0;
  const lay = !ends ? t : e === 'L' ? (t[1] === ends[0] ? t : [t[1], t[0]]) : (t[0] === ends[1] ? t : [t[1], t[0]]);
  const line = e === 'L' && ends ? [lay, ...mini.line] : [...mini.line, lay];
  const L = domLayout(line, e === 'L' && ends ? left + 1 : left), p = L.tiles[e === 'L' && ends ? 0 : line.length - 1];
  const across = p.rot % 180 !== 0, bw = across ? 1 : 2, bh = across ? 2 : 1;
  return { p, lay, box: { l: (100 * (p.x - bw / 2 - 0.15 - box.x) / box.w).toFixed(2), t: (100 * (p.y - bh / 2 - 0.15 - box.y) / box.h).toFixed(2), w: (100 * (bw + 0.3) / box.w).toFixed(2), h: (100 * (bh + 0.3) / box.h).toFixed(2) } };
}
// A count that ticks through its values at the given moments (ms into the move): each value appears over the last as
// its tile lands (the move's event: the animations are anchored to it, never to a redraw).
const tick = (vals, times, cls) => `<b class="dtick${cls ? ' ' + cls : ''}">${vals.map((v, k) => { const last = k === vals.length - 1, c = `${k ? 'dtv' : ''}${!last ? (k ? ' ' : '') + 'dtvo' : ''}`, st = `${k ? `--t:${Math.round(times[k - 1])}ms` : ''}${!last ? `${k ? ';' : ''}--t2:${Math.round(times[k])}ms` : ''}`; return `<span${c ? ` class="${c}"` : ''}${st ? ` style="${st}"` : ''}>${v}</span>`; }).join('')}</b>`;
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
  // the table: every tile where the layout puts it, the one just placed sliding in from its player's side
  const L = domLayout(mini.line, left), box = L.box;
  const tiles = mini.line.map((tl, k) => {
    const pos = k - left, byT = tl[2] === 'X' || tl[2] === 'O' ? tl[2] : null, isNew = dm && dm.kind === 'play' && dm.pos === pos;
    return placed(tl, L.tiles[k], isNew ? dm.by : byT, isNew ? 'dslide' : '', isNew ? `--dy:${dm.by === me ? box.h.toFixed(2) : (-box.h).toFixed(2)}px;--t:0ms;--d:${DOMT.slide}ms` : '');
  }).join('');
  let ghosts = '', endBtns = '';
  if (domDraft && domDraft.sq === state.zoom && !view) {
    const fits = domFits(mini, domDraft.t);
    for (const e of fits) {
      const gh = ghostAt(mini, domDraft.t, e, box);
      ghosts += placed(gh.lay, gh.p, null, 'dghost');
      endBtns += `<button class="domend" data-act="move" data-e="${e}" ${mv({ t: domDraft.t, e })} style="left:${gh.box.l}%;top:${gh.box.t}%;width:${gh.box.w}%;height:${gh.box.h}%" aria-label="Place ${say(domTile(mini, domDraft.t))} on the ${e === 'L' ? 'left' : 'right'} end"${mine && domDraft.by === me ? '' : ' disabled'}></button>`;
    }
  }
  const vb = `${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}`;
  const table = `<div class="domtable"><div class="dombox" style="--ar:${(box.w / box.h).toFixed(4)}"><svg class="domsvg" viewBox="${vb}" aria-label="${mini.line.length ? `The line: ${mini.line.map(say).join(', ')}` : 'An empty table'}"><rect class="dfelt" x="${box.x.toFixed(2)}" y="${box.y.toFixed(2)}" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" rx=".4"/>${tiles}${ghosts}</svg>${endBtns}</div></div>`;
  // each player's tally: a face-down stack and the count (a drawn tile slides onto the stack as it lands, the count ticking up with each; a placed tile's count takes its new value as the tile lands)
  const lands = dm && dm.kind === 'draw' ? t.lands : null, dsl = lands ? Math.min(DOMT.drawSlide, lands[0]) : DOMT.drawSlide;   // each drawn tile's slide (shorter when a long draw comes faster than a slide)
  const tal = p => {
    const now = domCount(mini, p), was = dm && dm.by === p ? (dm.kind === 'play' ? now + 1 - (dm.open ? 1 : 0) : dm.kind === 'draw' ? now - dm.drew : now) : now, moved = was !== now;
    const times = dm && moved ? (dm.kind === 'draw' ? lands : dm.open ? [t.land, t.land + 300] : [t.land]) : [];
    const stk = Array.from({ length: Math.min(now, 8) }, (_, k) => `<i${moved && k >= Math.min(was, 8) ? (dm.kind === 'draw' ? ` class="dmin" style="--t:${Math.round(lands[Math.min(lands.length - 1, k - Math.min(was, 8))] - dsl)}ms;--d:${dsl}ms"` : ` class="dmnew" style="--t:${Math.round(t.land + (k - Math.min(was, 8)) * 80)}ms"`) : ''}></i>`).join('');
    const vals = moved ? (dm.kind === 'draw' ? Array.from({ length: dm.drew + 1 }, (_, k) => was + k) : dm.open ? [was, was - 1, now] : [was, now]) : [now];
    return arcTally(p, o, `<span class="domct" aria-label="${now} tile${now === 1 ? '' : 's'} in hand"><span class="dstk" aria-hidden="true">${stk}</span>${tick(vals, times)}</span>`);
  };
  // the row under the table: the boneyard (Draw, or Pass once it is empty, when nothing in the hand fits) and the result line
  const pile = domPile(mini), canPlay = (domHand(mini, me) || []).some(k => domFits(mini, k).length > 0);
  const pileWas = dm && dm.kind === 'draw' ? pile + dm.drew : dm && dm.kind === 'play' && dm.open ? pile + 1 : pile;
  const act = mine && !canPlay ? (pile > 0 ? 'draw' : 'pass') : null;
  const pileTimes = pileWas !== pile ? (dm.kind === 'draw' ? lands.map(l => l - dsl) : [t.land + 220]) : [];   // each tile leaves the boneyard as its slide begins
  const pileStk = Array.from({ length: Math.min(pileWas, 5) }, (_, k) => `<i${k >= Math.min(pile, 5) ? ` class="dmout" style="--t:${Math.round(pileTimes[Math.min(pileTimes.length - 1, k - Math.min(pile, 5))])}ms"` : ''}></i>`).join('');
  const pileBtn = `<button class="dompile${act ? ' go ' + act : ''}" data-act="move" ${mv(act || 'draw')} aria-label="${pile} tile${pile === 1 ? '' : 's'} in the boneyard${act ? (act === 'draw' ? ': draw' : ': pass') : ''}"${act ? '' : ' disabled'}><span class="dpstk" aria-hidden="true">${pileStk}</span>${tick(pileWas !== pile ? Array.from({ length: pileWas - pile + 1 }, (_, k) => pileWas - k) : [pile], pileTimes)}<small>${act === 'pass' ? 'Pass' : act === 'draw' ? 'Draw' : ''}</small></button>`;
  const l = mini.last;
  const res = dm ? `<p ${lateAt('domres', t.count)} role="status"><span>${words(dm, true)}</span></p>`   // (one inline box in the flex row: the space after the name stays)
    : (view || d) && l ? `<p class="domres"><span><b class="${l.by}">${N(l.by)}</b>: ${words(l, false)}</span></p>`
    : `<p class="domres"><span>${view || !locked ? '' : waitLine(turn)}</span></p>`;
  // the viewer's hand (both hands, once the square is done); a draw's tiles slide in from the boneyard one by one
  const hands = view ? ['X', 'O'] : [me];
  const handHtml = hands.map(p => {
    const hand = domHand(mini, p) || [], own = p === me && !view;
    const drawing = dm && (dm.kind === 'draw' || dm.open) && dm.by === p;
    if (!seen || seen.sq !== state.zoom || seen.p !== p) seen = { sq: state.zoom, p, ids: hand.slice() };
    const fresh = drawing ? hand.filter(k => !seen.ids.includes(k)) : [];
    if (!drawing) seen.ids = hand.slice();
    const cols = Math.max(6, Math.ceil(hand.length / 2));
    const tilesH = hand.map(k => {
      const tl = domTile(mini, k), fits = own && mine && domFits(mini, k).length > 0, nk = fresh.indexOf(k);
      const at = nk < 0 ? 0 : dm.kind === 'draw' ? lands[Math.min(lands.length - 1, nk)] - dsl : t.land + 220;
      const cls = `domtile${domDraft && domDraft.t === k && domDraft.by === p ? ' sel' : ''}${own && mine && !fits ? ' dim' : ''}${nk >= 0 ? ' dmin' : ''}`;
      return `<button class="${cls}" data-act="domtile" data-i="${k}"${nk >= 0 ? ` style="--t:${Math.round(at)}ms;--d:${dsl}ms"` : ''} aria-label="${say(tl)}${fits ? '' : own && mine ? ' (does not fit)' : ''}"${own && mine && fits ? '' : ' disabled'}>${tileSvg(tl)}</button>`;
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
// A placed tile clicks down on the table as it lands; a draw's tiles slide off the boneyard one by one (domDrawTimes); a pass knocks on
// the table; a blocked end knocks twice, then rings for the fewer pips; the last tile out sparkles.
export function sounds(f, add, won, mini, last) {
  const dm = f.dom || {}, t = domTimes(dm);
  if (dm.kind === 'draw') { const dsl = Math.min(DOMT.drawSlide, t.lands[0]); for (const l of t.lands) add('cardSlide', l - dsl); add(dm.fits ? 'domClick' : 'knock', t.land + 60); }   // each tile slides off the boneyard as it comes; the last one's landing clicks (a fit) or knocks (none)
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
