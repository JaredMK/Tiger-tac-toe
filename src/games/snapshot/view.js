// Snapshot: the screen, the miniature, the move's words and sounds, and the inputs.
import { SND } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { state, zoomedType } from '../../ui/app.js';
import { hash01 } from '../../ui/art.js';
import { ATT_KEY, attCellAt, attDraft, attSave, attStartAct, attTable } from '../../ui/attention.js';
import { fxAttr } from '../../ui/fx.js';
import { qMark, qPick } from '../../ui/quiz.js';
import { render } from '../../ui/render.js';
import { attentionMiniature } from '../../ui/attention.js';
const SNAP_ART = `<div class="tsnap">${Array.from({ length: 9 }, (_, k) => `<i class="${[1, 3, 8].includes(k) ? 'on' : ''}"></i>`).join('')}</div>`;   // the emblem: its tray, a grid with a few cells filled (a fixed pattern, never a round's)
export const miniature = (mini, final) => attentionMiniature(mini, final, SNAP_ART);
export { attentionSounds as sounds, attentionWonAt as wonAt } from '../../ui/attention.js';

// The blank grid's few words while the pattern is to be remembered: one of these, the round's own (the same
// at every redraw, and on both phones).
const SNAP_MSGS = ['Remember what you saw…', 'Don\'t forget!', 'Hold that thought…'];
export const snapMsg = r => SNAP_MSGS[Math.min(SNAP_MSGS.length - 1, Math.floor(hash01(r.cells.reduce((s, c) => (s * 31 + c + 1) % 9973, r.level + 7)) * SNAP_MSGS.length))];
// The grid sits in a tray (the scene alone: the cells, their size and the pattern's colours are as they were). A tapped
// cell pops under the finger; Submit sends them. The verdict lands T into the move (ui/attention.js): each picked cell
// turns right (green, a pop, one after the other) or wrong (red, crossed), a missed one shows where it was, and a tick
// or a cross lands on the tray's corner (a right one's point flies from it to the pip; a wrong grid shakes). Someone
// else's cells are picked first, one after the other (attCellAt), as they did.
export function snapView(c) {
  const r = c.round, cellsN = r.c * r.r, orig = new Set(r.cells), s = c.shown, late = c.fresh, T = c.T;
  const grid = (cls, act, o = {}) => `<div class="sngrid${o.cls || ''}" style="grid-template-columns:repeat(${r.c}, 1fr);--c:${r.c};--r:${r.r}${o.st || ''}"${o.attr || ''}>${Array.from({ length: cellsN }, (_, i) => `<button class="snc${cls(i)}"${o.cell ? o.cell(i) : ''}${act ? ` data-act="snap-cell" data-i="${i}" aria-label="Cell ${i + 1}${cls(i).includes(' sel') ? ', picked' : ''}"` : ' tabindex="-1" aria-hidden="true"'}${act && c.answering && c.live ? '' : ' disabled'}></button>`).join('')}${o.more || ''}</div>`;
  const picked = s ? s.answer || [] : c.started && attDraft ? attDraft.entry : [], pick = new Set(picked);
  const res = i => (orig.has(i) && pick.has(i) ? ' hit' : orig.has(i) ? ' miss' : pick.has(i) ? ' extra' : '');
  const show = r.show, wait = r.wait || 0, len = show + wait, secs = Math.ceil(wait / 1000), blank = () => '';
  // the result: the cells as picked until the verdict (someone else's: picked one after the other from the round's end), then each to what it was
  const order = i => picked.indexOf(i), hitK = i => r.cells.indexOf(i);
  const mark = s ? `<span class="snmk"${late ? ` style="--t:${T}ms"` : ''}${late && s.correct ? qPick() : ''}>${qMark(s.correct ? 'ok' : 'no', late)}</span>` : '';
  const final = () => grid(i => res(i) + (late && res(i) ? ' late' + (pick.has(i) ? (c.pre ? ' pk' : ' sel0') : '') : ''), false, {
    cls: (s.correct ? ' v-ok' : ' v-no') + (late ? ' late' : ''), st: late ? `;--t:${T}ms` : '', more: mark,
    cell: i => (late && res(i) ? ` style="--k:${Math.max(0, hitK(i))}${c.pre && pick.has(i) ? `;--p:${len + attCellAt(order(i), picked.length)}ms` : ''}"` : ''),
  });
  // the pattern for its seconds, then the grid blank for the countdown's, then (this phone's round) the grid to tap
  let stage, count = '';
  const msg = wait ? snapMsg(r) : '';
  if (s && c.pre) stage = `<div class="snstack"><div class="tu" style="--u:${show}ms">${grid(i => (orig.has(i) ? ' on' : ''))}</div><div class="tf tu2" style="--f:${show}ms;--u:${len}ms">${grid(blank)}</div>${msg ? `<div class="snmsg tu2" style="--f:${show}ms;--u:${len}ms"><span>${msg}</span></div>` : ''}<div class="tf" style="--f:${len}ms">${final()}</div></div>`;
  else if (s) stage = final();
  else if (c.playing) stage = `<div class="snstack"${fxAttr(c.startPerf, 'rt')}><div>${grid(blank)}</div><div class="tu" style="--u:${show}ms">${grid(i => (orig.has(i) ? ' on' : ''))}</div>${msg ? `<div class="snmsg tf" style="--f:${show}ms"><span>${msg}</span></div>` : ''}</div>`;
  else stage = grid(i => (c.answering && pick.has(i) ? ' sel' + (attDraft.tapI === i ? ' snpop' : '') : ''), true, { attr: c.answering && attDraft.tapAt != null ? fxAttr(attDraft.tapAt) : '' });
  // the time left: a bar while the pattern shows; then the countdown, in seconds and a bar of its own
  if (c.playing || (s && c.pre)) count = `<div class="sncount${c.playing ? '' : ' tu'}"${c.playing ? fxAttr(c.startPerf, 'rt') : ` style="--u:${len}ms"`}><span class="sndig">${Array.from({ length: secs }, (_, k) => `<b class="tf tu" style="--f:${show + k * 1000}ms;--u:${show + (k + 1) * 1000}ms">${secs - k}</b>`).join('')}</span><span class="snbars"><span class="obar tu" style="--u:${show}ms"><i style="--d:${show}ms"></i></span>${wait ? `<span class="obar tf" style="--f:${show}ms"><i style="--d:${wait}ms;animation-delay:${show}ms"></i></span>` : ''}</span></div>`;
  const input = `<div class="snin">${count}</div>`;
  return { stage, input, watch: '', ask: `Which ${r.cells.length} cells were filled?`, say: () => `${r.cells.length} cells` };
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = attTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, won: !!fresh }); return g;
}
export function moveText(f, who) {
  return f.att ? `${who} ${f.att.correct ? 'got it right' : f.att.answer == null ? 'ran out of time' : 'got it wrong'}` : `${who} played a round`;
}
// Snapshot: a cell picked or unpicked
export function snapCellAct(el, e, act) {
  if (zoomedType() !== 'snapshot' || !attDraft || state.flash || state.done || blocked()) return;
  const i = Number(el.dataset.i), at = attDraft.entry.indexOf(i);
  if (at >= 0) attDraft.entry.splice(at, 1); else attDraft.entry.push(i);
  attDraft.tapAt = performance.now(); attDraft.tapI = at >= 0 ? null : i;   // (the picked cell's pop: from this tap)
  SND.play(at >= 0 ? 'deselect' : 'mark'); haptic('tap'); attSave(); render();
}
// Snapshot: the picked cells go in
export function snapSubmitAct(el, e, act) {
  if (zoomedType() !== 'snapshot' || !attDraft || state.flash || state.done || blocked()) return;
  const cells = attDraft.entry.slice().sort((x, y) => x - y); clearTimeout(attDraft.timer);
  try { localStorage.removeItem(ATT_KEY); } catch (err) { /* no storage */ }
  attemptMove(cells);
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'att-start': attStartAct, 'snap-cell': snapCellAct, 'snap-submit': snapSubmitAct };
