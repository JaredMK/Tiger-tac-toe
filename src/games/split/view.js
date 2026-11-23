// Shape Split: the screen, the miniature, the move's words and sounds, and the drag that draws the cut.
// The mover's shape sits on a cutting mat (an SVG, 100 by 100). A drag anywhere on the mat draws the line as the finger
// moves (written straight onto the page: no redraw); letting go makes the cut, a line too short is dropped. The cut:
// the line strikes across (SPLIT.line), the two parts slide apart (SPLIT.part) and each shows its share of the shape,
// the words give the split and the points (SPLIT.say). No share is shown before the cut is made.
import { SPLIT, splitCfg, splitCut, splitShape } from './rules.js';
import { ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { app, state } from '../../ui/app.js';
import { lateAt } from '../../ui/progress.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is its line: drawn from the flash, never pressed in
const pts = poly => poly.map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
const mid = poly => { let x = 0, y = 0; for (const q of poly) { x += q[0]; y += q[1]; } return [x / Math.max(1, poly.length), y / Math.max(1, poly.length)]; };
// A cut on show: its two parts pushed apart along the line's normal, each with its share, and the line itself.
function cutSvg(shape, l, by, anim) {
  const cut = splitCut(shape, l.a, l.b), dx = l.b[0] - l.a[0], dy = l.b[1] - l.a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const ext = 160 / len, x1 = l.a[0] - dx * ext, y1 = l.a[1] - dy * ext, x2 = l.b[0] + dx * ext, y2 = l.b[1] + dy * ext, share = [l.pct, Math.round((100 - l.pct) * 10) / 10];
  const part = k => {
    const poly = cut.parts[k]; if (poly.length < 3) return '';
    const s = k ? -1 : 1, [cx, cy] = mid(poly);
    return `<g class="sppart k${k}${anim ? ' go' : ''}" style="--dx:${(nx * s * 3).toFixed(2)}px;--dy:${(ny * s * 3).toFixed(2)}px"><polygon class="spshape ${by}" points="${pts(poly)}"/><text class="sppct${anim ? ' late' : ''}" x="${cx.toFixed(1)}" y="${(cy + 3).toFixed(1)}" text-anchor="middle">${Math.round(share[k])}%</text></g>`;
  };
  return `${part(0)}${part(1)}<line class="spcut${anim ? ' go' : ''}" pathLength="1" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
}
const words = (c, l) => (l.miss ? 'Missed the shape' : `${Math.round(l.pct)} / ${100 - Math.round(l.pct)}${l.pts ? ` · +${l.pts}` : ' · no points'}`);
let src = null, drag = null, hooked = false;
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = splitCfg(mini), s = a && a.sp ? a.sp : null, o = { view, locked, turn };
  const l = s || ((view || d) && mini.last ? mini.last : null), by = l ? l.by : turn, mine = !view && !locked && !s && !d;
  const tal = p => ptsTally(p, o, c.target, mini.score[p], s && a.by === p ? s.from : null, SPLIT.say);
  const shape = splitShape(mini, by, l ? l.n : null);
  const body = l ? cutSvg(shape, l, by, !!s) : `<polygon class="spshape ${by}" points="${pts(shape)}"/>`;
  const line = l ? `<p ${s ? lateAt('spline ' + (l.pts ? 'ok' : 'no'), SPLIT.say) : `class="spline ${l.pts ? 'ok' : 'no'}"`} role="status">${words(c, l)}</p>` : '<p class="spline"></p>';
  // The scoring bands' key (the owner's ask, December 2026): one chip a band that scores, from the square's own settings;
  // the band a cut just earned lights up in the cutter's colour as its figures land (SPLIT.say), and stays lit in review.
  const hitBand = l && !l.miss && l.pts ? l.band : -1;
  const key = c.bands.map((bd, i) => (bd[1] > 0 ? `<span ${i === hitBand ? (s ? lateAt('spk', SPLIT.say, 'hit late') : 'class="spk hit"') : 'class="spk"'}><b>±${bd[0]}%</b> = ${bd[1]} ${bd[1] === 1 ? 'pt' : 'pts'}</span>` : '')).join('');
  src = { mine, sq: state.zoom };
  return `<div class="g-sp pc-${by}" style="--tl:${SPLIT.line}ms;--tp:${SPLIT.part}ms;--ts:${SPLIT.say}ms"><div class="ctals two">${tal('X')}${tal('O')}</div>
    <div class="spbox"><svg class="spsvg${mine ? ' live' : ''}" viewBox="0 0 100 100" data-sp="pad" role="img" aria-label="The shape to cut"><defs><pattern id="spgrid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="rgba(22,18,16,.09)" stroke-width=".6"/></pattern></defs><rect width="100" height="100" fill="url(#spgrid)"/>${body}<line class="spdraw ${turn}" data-sp="line" x1="0" y1="0" x2="0" y2="0"/></svg></div><div class="splegend" aria-label="Scoring: how near half and half each cut must be">${key}</div>${line}</div>`;
}
// ---- the drag ----
function at(e, pad) { const r = pad.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1000) / 10, Math.round((e.clientY - r.top) / r.height * 1000) / 10]; }
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    const pad = e.target.closest && e.target.closest('.spsvg.live[data-sp="pad"]');
    if (!pad || !src || !src.mine || state.flash || state.done || blocked()) return;
    drag = { id: e.pointerId, a: at(e, pad), b: null };
    e.preventDefault();
  }, { passive: false });
  app.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const pad = app.querySelector('.spsvg.live[data-sp="pad"]'), ln = pad && pad.querySelector('[data-sp="line"]');
    if (!pad || !ln) { drag = null; return; }
    drag.b = at(e, pad);
    ln.setAttribute('x1', drag.a[0]); ln.setAttribute('y1', drag.a[1]); ln.setAttribute('x2', drag.b[0]); ln.setAttribute('y2', drag.b[1]); ln.classList.add('on');
  });
  const end = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dr = drag; drag = null;
    const ln = app.querySelector('.spsvg [data-sp="line"]'); if (ln) ln.classList.remove('on');
    if (cancel || !dr.b || Math.hypot(dr.a[0] - dr.b[0], dr.a[1] - dr.b[1]) < SPLIT.min * 2 || !src || !src.mine || state.zoom !== src.sq || blocked()) return;
    ownPress(); attemptMove({ a: dr.a, b: dr.b });
  };
  app.addEventListener('pointerup', e => end(e, false));
  app.addEventListener('pointercancel', e => end(e, true));
}
// The miniature: a shape on its mat with a cut marked across it, over each player's points as a bar.
export function miniature(mini, final) {
  const c = splitCfg(mini), shape = splitShape(mini, 'X', 0);
  const art = `<svg class="tsp" viewBox="0 0 100 100"><polygon class="tspshape" points="${pts(shape)}"/><path class="tspcut" d="M6 78 94 22"/></svg>`;
  return thumbArt(art, barRows(mini.score, c.target), 'tspw col', `Shape Split: X ${mini.score.X}, O ${mini.score.O} of ${c.target} points`);
}
export function moveText(f, who) { const l = f.sp; return !l ? `${who} cut` : l.miss ? `${who} missed the shape` : `${who} cut ${Math.round(l.pct)} / ${100 - Math.round(l.pct)} for ${l.pts}`; }
// The blade across, the parts popping apart, then the verdict: a ding (with a sparkle for the best band), a thud for no points.
export function sounds(f, add, won, mini, last) {
  const l = f.sp; if (!l) return;
  add('spSlice', 0); add('pop', SPLIT.line);
  if (!l.pts) add('thud', SPLIT.say); else { add('ding', SPLIT.say); if (l.band === 0) add('sparkle', SPLIT.say + 130); }
}
