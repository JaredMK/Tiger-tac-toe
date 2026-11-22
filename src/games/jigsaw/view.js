// Puzzle Build: the screen, the miniature, the move's words and sounds, this phone's piece timer and its placing.
// The board shows only the pieces in place (an empty cell is a dashed slot); the whole picture is never on show before
// the square is decided. Under it the tray: the pile (how many pieces are left), the piece on show, large, and its
// timer, a bar that empties in real time whatever the Animation setting. "Draw a piece" (the move 'draw') stands in
// the tray on the mover's turn; the piece slides out of the pile (JIG.out) and from that moment its timer runs on the
// mover's phone alone (kept through a reload); at zero the phone sends 'out'. Every empty cell is then a target: a
// tap places the piece there, or the piece is dragged from the tray onto a cell. The piece travels to the cell chosen
// (JIG.fly; one dropped there is there already): its own cell, and it clicks in with a shine, its layer's mark in the
// corner and the point on the tally; any other, and it shakes and flies back to the pile. The square decided: the
// pieces left in the pile drop into place one after another and the cuts fade, so the whole picture shows (the game's
// own winning moment; the claim is the board's). Someone else's turn plays from its two moves: Draw a piece pressed
// and the piece coming out, then that piece travelling to the cell they chose and what came of it (replay.synth).
// What animates comes from the move being played (a: its flash), never from the square's last result.
import { JIG, JIG_DRAW, JIG_OUT, jigCells, jigEnd, jigGot, jigLeft, jigNeed, jigOffer, jigSize, jigTimes } from './rules.js';
import { PIC, jigPicture, jigPieceBox, jigPiecePath } from './picture.js';
import { tune } from '../../core/tune.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, app, state, waitLine } from '../../ui/app.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';
import { fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { rep } from '../../ui/replay.js';
import { markSvgG, pipRows, thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.jig && f.jig.draw ? 0 : null);          // the draw: the piece can be placed the moment it is on the tray
export const replay = { synth: move => (move === JIG_DRAW ? [[0, 'jig-draw', null]] : []) };   // the committed steps only: Draw a piece pressed; the placement plays from the move
const seedOf = mini => (Number.isFinite(Number(mini && mini.seed)) ? Math.abs(Math.floor(Number(mini.seed))) : 0);   // (digits alone ever reach the markup)

// ---- the pieces ----
// A piece of the picture: the sheet clipped to the piece's outline (the sheet itself is drawn once a screen, in the
// defs at its top, and used here), its outline in ink, and a white flash over it for the moment it clicks in.
function pieceSvg(sd, n, i) {
  const b = jigPieceBox(n, i).map(v => Math.round(v * 10) / 10), d = jigPiecePath(sd, n, i), id = `jgc${sd}-${n}-${i}`;
  return `<svg class="jgp" viewBox="${b.join(' ')}" aria-hidden="true"><clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})"><use href="#jgs${sd}"/></g><path class="jgpo" d="${d}"/><path class="jgpf" d="${d}"/></svg>`;
}
const sheet = sd => `<svg class="jgdefs" width="0" height="0" aria-hidden="true"><defs><g id="jgs${sd}">${jigPicture(sd)}</g></defs></svg>`;
const badge = v => `<i class="jgby ${v}"><svg viewBox="-10 -10 20 20">${markSvgG(v, 5.4)}</svg></i>`;
// The pile: a little heap of blank pieces (no picture on them: the pile gives nothing away) and how many are left.
const BLANK = 'M4 9h7c-2-5 0-8 4-8s6 3 4 8h7v7c5-2 8 0 8 4s-3 6-8 4v7H4v-7c-5 2-7 0-7-4s2-6 7-4z';
const heap = n => `<svg class="jgheap" viewBox="-6 -4 46 46" aria-hidden="true">${n > 2 ? `<path class="jgh c" d="${BLANK}" transform="translate(7 -2) rotate(14 15 20)"/>` : ''}${n > 1 ? `<path class="jgh b" d="${BLANK}" transform="translate(-3 2) rotate(-12 15 20)"/>` : ''}${n > 0 ? `<path class="jgh a" d="${BLANK}" transform="translate(2 5)"/>` : ''}</svg>`;

// ---- this phone's piece timer (real time, from the moment the piece is on the tray; a reload carries it on) ----
const JIG_KEY = 'ttt-jig-piece';
let clock = null;                                                   // { id, sq, at (Date.now() when the piece showed), secs, timer, ticks }
let pend = null;                                                    // this phone's placement on its way: { sq, k, c, by, drop }
let drag = null, hooked = false;
const idOf = (sq, p, mini) => `${state.online ? state.online.matchId || state.online.game || state.online.code || 'on' : state.id || 'local'}:${seedOf(mini)}:${sq}:${p}:${mini.k | 0}:${jigOffer(mini)}`;   // (the square's own seed in it: a piece of another square, or another match, never takes this one's clock)
function clockStop() { if (clock) { clearTimeout(clock.timer); for (const t of clock.ticks || []) clearTimeout(t); } clock = null; }
function clockArm() {
  if (!clock || typeof setTimeout !== 'function') return;
  clearTimeout(clock.timer);
  const id = clock.id;
  clock.timer = setTimeout(function out() {
    if (!clock || clock.id !== id) return;
    const sq = state.squares && state.squares[clock.sq], m = sq && sq.mini;
    if (!m || m.type !== 'jigsaw' || sq.owner || state.screen !== 'mini' || state.zoom !== clock.sq || jigOffer(m) == null || idOf(clock.sq, state.turn, m) !== id) { clockStop(); return; }   // (the turn has moved on some other way)
    if (state.flash || state.done || blocked() || !(app && typeof app.querySelector === 'function' && app.querySelector('.jgtime.on'))) { clock.timer = setTimeout(out, 400); return; }   // (a placement on its way: its answer first; and never while the bar is not on this page: the timer is what the player is shown)
    dragEnd(null, true); clockStop(); attemptMove(JIG_OUT);
  }, Math.max(0, clock.at + clock.secs * 1000 - Date.now()));
  for (const t of clock.ticks || []) clearTimeout(t);
  clock.ticks = [3, 2, 1].map(k => {                                 // its last three seconds tick, on this phone alone
    const ms = clock.at + (clock.secs - k) * 1000 - Date.now();
    return ms > 0 ? setTimeout(() => { if (clock && clock.id === id && !state.flash && !pend && state.screen === 'mini' && state.zoom === clock.sq) SND.play('jgTick', { rate: 1 + (3 - k) * 0.12 }); }, ms) : null;
  });
  for (const t of [clock.timer, ...clock.ticks]) if (t && typeof t.unref === 'function') t.unref();   // (a test's process is never kept waiting on a clock)
}
function clockFor(sq, p, mini) {                                    // the timer of the piece on show here: the one running, one kept from before a reload, or a new one from now
  const id = idOf(sq, p, mini);
  if (clock && clock.id === id) return clock;
  clockStop();
  let at = null;
  try { const v = JSON.parse(localStorage.getItem(JIG_KEY) || 'null'); if (v && v.id === id && Number.isFinite(v.at) && v.at <= Date.now()) at = v.at; } catch (e) { /* none kept */ }
  if (at == null) { at = Date.now(); try { localStorage.setItem(JIG_KEY, JSON.stringify({ id, at })); } catch (e) { /* no storage */ } }
  clock = { id, sq, at, secs: Math.max(1, Number(tune(mini).secs) || 8), timer: null, ticks: [] };
  clockArm();
  return clock;
}

// ---- this phone's inputs ----
const live = () => {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  return m && m.type === 'jigsaw' && !sq.owner && state.screen === 'mini' && !state.flash && !state.done && !blocked() && !rep ? m : null;
};
function drawAct() {
  const m = live(); if (!m || jigOffer(m) != null) return;
  haptic('tap'); attemptMove(JIG_DRAW);
}
function place(c, drop) {
  const m = live(); if (!m || jigOffer(m) == null || !(c >= 0) || jigCells(m)[c] !== '.') return false;
  pend = { sq: state.zoom, k: m.k | 0, c, by: state.turn, drop: !!drop };
  haptic('tap');
  attemptMove({ c });
  return true;
}
export const actions = {
  'jig-draw': () => { ownPress(); drawAct(); },
  'jig-cell': el => { ownPress(); place(Number(el.dataset.c), false); },
};
// The drag: the piece on the tray follows the finger (written straight onto the page: no redraw), the cell under it
// lights, and letting go over an empty cell places it there; anywhere else it goes back to the tray.
function dragEnd(e, cancel) {
  const dr = drag; drag = null;
  if (!dr) return;
  const el = app.querySelector('.jgslot .jgfl'), over = app.querySelector('.jgcell.over');
  if (over) over.classList.remove('over');
  const c = !cancel && over ? Number(over.dataset.c) : -1;
  if (c >= 0 && dr.moved && place(c, true)) return;
  if (el) { el.classList.remove('drag'); el.style.transform = ''; }
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    const slot = e.target.closest && e.target.closest('.jgslot.live');
    if (!slot || drag || !live()) return;
    const el = slot.querySelector('.jgfl'), cell = app.querySelector('.jggrid .jgcell');
    if (!el || !cell) return;
    const a = el.getBoundingClientRect(), b = cell.getBoundingClientRect();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, k: a.width > 0 ? (b.width * 1.52) / a.width : 1, moved: false };
    ownPress(); e.preventDefault();
  }, { passive: false });
  app.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const el = app.querySelector('.jgslot .jgfl'); if (!el) { drag = null; return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; el.classList.add('drag'); SND.play('jgLift'); }
    el.style.transform = `translate(${dx.toFixed(1)}px, ${(dy - 14).toFixed(1)}px) scale(${drag.k.toFixed(3)})`;
    const under = document.elementFromPoint(e.clientX, e.clientY - 14), cell = under && under.closest ? under.closest('.jgcell.open') : null, was = app.querySelector('.jgcell.over');
    if (was && was !== cell) was.classList.remove('over');
    if (cell) cell.classList.add('over');
  });
  const end = cancel => e => { if (drag && e.pointerId === drag.id) dragEnd(e, cancel); };
  app.addEventListener('pointerup', end(false));
  app.addEventListener('pointercancel', end(true));
}

// ---- the screen ----
const WORDS = { ok: 'Fits!', no: 'Not there', out: 'Too slow' };
const kindOf = l => (l.ok ? 'ok' : l.at < 0 ? 'out' : 'no');
export function heldSub(mini, turn, f, a) {                         // the header's line while the turn is held to the square
  if (a && a.jig) return '';
  return jigOffer(mini) != null ? `<b class="${turn}">${N(turn)}</b>'s piece` : `<b class="${turn}">${N(turn)}</b> draws again`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const n = jigSize(mini), sd = seedOf(mini), cells = jigCells(mini), need = jigNeed(mini), got = jigGot(mini), o = { view, locked, turn };
  const fb = a && a.jig ? a.jig : null, s = fb && !fb.draw ? fb : null, dr = fb && fb.draw ? fb : null, T = s ? jigTimes(s) : null;   // the move playing: a placement (s) or a draw (dr)
  const offer = dr ? dr.c : jigOffer(mini), ended = jigEnd(mini), here = !!(state.squares && state.squares[state.zoom] && state.squares[state.zoom].mini === mini && state.screen === 'mini');
  const mine = here && !view && !locked && !fb && !d && !rep;        // this phone's step to make
  const placing = mine && offer != null;                            // ...the piece on show to place
  if (pend && (pend.sq !== state.zoom || pend.k !== (mini.k | 0) || (!fb && (offer == null || !blocked())))) pend = null;
  const own = !!(s && pend && pend.c === s.at && pend.by === a.by), dropped = own && pend.drop;   // this phone's own placement playing; one dropped there by hand (no flight: it is there)
  const ck = placing ? clockFor(state.zoom, turn, mini) : null;
  if (!placing && !(here && pend) && clock && here) clockStop();
  // the tallies: each player's pieces as pips to the number that takes the square (a number on a big grid)
  const tal = p => {
    const now = got[p], was = s && s.ok && a.by === p ? s.was[p] : now, moved = now !== was;
    return need <= 6 ? arcTally(p, o, pips(p, now, need, moved, moved ? T.land : null)) : ptsTally(p, o, need, now, moved ? was : null, moved ? T.land : 0);
  };
  // the board
  const by = fb ? a.by : turn, whole = !!ended && (view || !!d || !!s), fillFrom = s && s.end ? T.fill : null;
  let fills = 0;
  const cell = (v, i) => {
    const box = `<i class="jgbx"${cfAnchor('jgcell:' + i)}></i>`;
    if (whole && !s) return `<div class="jgcell on">${box}</div>`;   // the whole picture lies over the grid: no piece is drawn under it
    if (v !== '.') {
      const fresh = s && s.ok && s.c === i, fly = fresh && !dropped ? cfFrom('jgoffer', 0, { d: JIG.fly }) : '';
      return `<div class="jgcell on${v === 'C' ? '' : ' by' + v}">${box}<span class="jgpw${fresh ? ' ok' : ''}"${fresh ? ` style="--t:${T.land}ms"` : ''}><span class="jgfl"${fly}>${pieceSvg(sd, n, i)}</span></span>${v === 'C' ? '' : fresh ? `<span ${lateAt('jgbd', T.land)}>${badge(v)}</span>` : `<span class="jgbd">${badge(v)}</span>`}</div>`;
    }
    const miss = s && !s.ok && s.at === i ? `<span class="jgpw no" style="--t:${T.land}ms;--b:${T.back}ms"><span class="jgfl"${dropped ? '' : cfFrom('jgoffer', 0, { d: JIG.fly })}>${pieceSvg(sd, n, s.c)}</span></span>` : '';
    const hover = !fb && pend && pend.c === i && offer != null ? `<span class="jgpw wait"><span class="jgfl">${pieceSvg(sd, n, offer)}</span></span>` : '';
    if (hover) pend.drop = true;                                    // (shown in its cell while the answer is on its way: it does not fly there again)
    const fill = fillFrom != null ? `<span class="jgpw fill" style="--t:${fillFrom + (fills++) * JIG.fill}ms"><span class="jgfl">${pieceSvg(sd, n, i)}</span></span>` : '';   // the square decided: the pile's pieces drop in
    const label = `Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`;
    return placing && !pend ? `<button class="jgcell open" data-act="jig-cell" data-c="${i}" aria-label="${label}">${box}</button>` : `<div class="jgcell${fill ? ' on' : ''}" aria-label="${label}">${box}${miss}${hover}${fill}</div>`;
  };
  const grid = cells.map(cell).join('');
  const full = whole ? `<svg class="jgwhole${s ? ' late' : ''}" viewBox="0 0 ${PIC.size} ${PIC.size}"${s ? ` style="--t:${T.whole}ms;--d:${JIG.whole}ms"` : ''} aria-hidden="true"><use href="#jgs${sd}"/></svg>` : '';
  const marks = whole && view ? `<div class="jgmarks" aria-hidden="true">${cells.map(v => `<span>${v === 'X' || v === 'O' ? `<span class="jgbd">${badge(v)}</span>` : ''}</span>`).join('')}</div>` : '';   // a finished square looked at again: who laid which piece, over the whole picture
  const board = `<div class="jgbox"><div class="jgboard${whole ? ' done' : ''}${s && s.end ? ' ending' : ''}${placing && !pend ? ' aim' : ''}" style="--n:${n}${s && s.end ? `;--tw:${T.whole}ms;--dw:${JIG.whole}ms` : ''}" role="group" aria-label="The puzzle: ${cells.filter(v => v !== '.').length} of ${n * n} pieces in place"><div class="jggrid">${grid}</div>${full}${marks}</div></div>`;
  // the tray: the pile, the piece on show (or Draw a piece), its timer
  const pileN = whole && !s ? 0 : Math.max(0, jigLeft(mini) - (jigOffer(mini) != null ? 1 : 0));   // (a piece on show is out of the pile)
  const count = s && !s.ok ? `<b class="jgleft cnt" data-from="${pileN - 1}" data-delay="${T.home}" data-ms="1" aria-label="${pileN} pieces in the pile">${pileN}</b>`   // (a piece on its way back counts once it is home)
    : s && s.end ? `<b class="jgleft cnt" data-from="${pileN}" data-to="0" data-delay="${T.fill}" data-ms="${Math.max(1, (s.fill || 0) * JIG.fill)}" aria-label="No pieces in the pile">0</b>`
    : `<b class="jgleft" aria-label="${pileN} pieces in the pile">${pileN}</b>`;
  const homing = s && !s.ok ? `<span class="jgpw home"><span class="jgfl"${cfFrom(s.at < 0 ? 'jgoffer' : 'jgcell:' + s.at, T.back, { go: true, d: JIG.back })}>${pieceSvg(sd, n, s.c)}</span></span>` : '';
  const pile = `<div class="jgpile${whole && !s ? ' gone' : ''}${s && s.end ? ' empties' : ''}"${s && s.end ? ` style="--t:${T.fill + (s.fill || 0) * JIG.fill}ms"` : ''}><span class="jgpl">${heap(s && !s.ok ? pileN - 1 : pileN)}<i class="jgbx"${cfAnchor('jgpile')}></i>${homing}</span>${count}</div>`;
  const shown = dr ? `<span class="jgpw"><span class="jgfl"${cfFrom('jgpile', 0, { d: JIG.out })}>${pieceSvg(sd, n, dr.c)}</span></span>`
    : s && s.at < 0 ? `<span class="jgpw slow" style="--b:${T.back}ms"><span class="jgfl">${pieceSvg(sd, n, s.c)}</span></span>`
    : !fb && offer != null && !pend && !view ? `<span class="jgpw"><span class="jgfl">${pieceSvg(sd, n, offer)}</span></span>` : '';
  const canDraw = mine && offer == null && !ended, showDraw = !view && !fb && offer == null && !ended && !d;
  const btn = showDraw ? `<button class="big ${turn} jgdraw" data-act="jig-draw"${canDraw || (rep && !locked) ? '' : ' disabled'}>Draw a piece</button>` : '';
  const bar = ck ? `<div class="jgtime on"${fxAttr(performance.now() - (Date.now() - ck.at), 'rt')} style="--d:${ck.secs * 1000}ms" role="timer" aria-label="${ck.secs} seconds to place the piece"><i></i></div>` : '<div class="jgtime"></div>';
  const tray = `<div class="jgtray">${pile}<div class="jgstage"><span class="jgslot${placing && !pend ? ' live' : ''}"><i class="jgbx"${cfAnchor('jgoffer')}></i>${shown}</span>${btn}</div>${bar}</div>`;   // (the bar's room is always kept)
  // the line: the verdict, timed to the piece's landing; else who is awaited
  const l = s || ((view || d) && mini.last ? mini.last : null), k = l ? kindOf(l) : '';
  const line = s ? `<p ${lateAt('jgline ' + k, T.land)} role="status">${WORDS[k]}</p>` : l && !view ? `<p class="jgline ${k}">${WORDS[k]}</p>` : `<p class="jgline wait">${view || fb ? '' : locked && !d ? waitLine(turn) : ''}</p>`;
  return `<div class="g-jig pc-${by === 'O' ? 'O' : 'X'}${view ? ' look' : ''}" style="--n:${n}">${sheet(sd)}<div class="ctals two">${tal('X')}${tal('O')}</div>${board}${view ? '' : tray + line}</div>`;   // (a square only looked at: the board alone, no tray)
}
export function moveText(f, who) {
  const s = f.jig;
  if (!s) return `${who} played`;
  if (s.draw) return `${who} drew a piece`;
  return s.ok ? `${who} fitted a piece` : s.at < 0 ? `${who} was too slow` : `${who} missed the place`;
}
// A draw: the piece scrapes out of the pile and pats down on the tray. A placement: the piece slides over (not one
// this phone dropped there by hand), then clicks in with a little chime, or knocks twice and slides back to the pile;
// out of time, a falling pair of notes and the slide back. The square decided: each piece left ticks in, a note higher
// each time, and the picture comes whole with a shimmer.
export function sounds(f, add, won, mini, last) {
  const s = f.jig; if (!s) return;
  if (s.draw) { add('jgDraw', 0); add('jgSet', JIG.out - 40); return; }
  const T = jigTimes(s), dropped = !!(pend && pend.drop && pend.c === s.at && pend.by === f.by);
  if (s.at < 0) add('jgSlow', 0); else if (!dropped) add('jgSlide', 0);
  if (s.ok) { add('jgSnap', T.land); add('jgShine', T.land + 70); } else { if (s.at >= 0) add('jgNope', T.land); add('jgSlide', T.back, 0.82); }
  if (s.end) { for (let k = 0; k < (s.fill || 0); k++) add('jgSet', T.fill + k * JIG.fill, 1.1 + k * 0.07); add('jgWhole', T.whole); }
}
export const wonAt = (f, total) => (f.jig && f.jig.end ? jigTimes(f.jig).whole + 180 : total - 600);   // the square's chime as the picture comes whole
// The miniature: the board as it stands, cut as the puzzle is cut: a piece in place is tinted by whoever laid it (the
// centre piece, laid by nobody, plain), an empty cell a dashed slot; beside it each player's pieces as pips to the
// number that takes the square. Public information only: the picture itself is never drawn here.
export function miniature(mini, final) {
  const n = jigSize(mini), sd = seedOf(mini), cells = jigCells(mini), need = jigNeed(mini), got = jigGot(mini), s = PIC.size / n;
  const slots = cells.map((v, i) => (v === '.' ? `<rect class="tjgs" x="${Math.round((i % n) * s + s * 0.14)}" y="${Math.round(Math.floor(i / n) * s + s * 0.14)}" width="${Math.round(s * 0.72)}" height="${Math.round(s * 0.72)}" rx="${Math.round(s * 0.12)}"/>` : '')).join('');
  const laid = cells.map((v, i) => (v === '.' ? '' : `<path class="tjgp ${v === 'C' ? 'N' : v}" d="${jigPiecePath(sd, n, i)}"/>`)).join('');
  const art = `<svg class="tjg" viewBox="-30 -30 360 360">${slots}${laid}</svg>`;
  return thumbArt(art, need <= 6 ? pipRows(got, need) : barRows(got, need), 'tjgw', `Puzzle Build: X ${got.X}, O ${got.O} of ${need} pieces to win`);
}
