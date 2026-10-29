// Snapshot: the screen, the miniature, the move's words and sounds, and the inputs.
import { SND } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { state, zoomedType } from '../../ui/app.js';
import { hash01 } from '../../ui/art.js';
import { ATT_KEY, attDraft, attSave, attStartAct, attTable } from '../../ui/attention.js';
import { fxAttr } from '../../ui/fx.js';
import { render } from '../../ui/render.js';
export { attentionMiniature as miniature } from '../../ui/attention.js';
export { attentionSounds as sounds } from '../../ui/attention.js';

// The blank grid's few words while the pattern is to be remembered: one of these, the round's own (the same
// at every redraw, and on both phones).
const SNAP_MSGS = ['Remember what you saw…', 'Don\'t forget!', 'Hold that thought…'];
export const snapMsg = r => SNAP_MSGS[Math.min(SNAP_MSGS.length - 1, Math.floor(hash01(r.cells.reduce((s, c) => (s * 31 + c + 1) % 9973, r.level + 7)) * SNAP_MSGS.length))];
export function snapView(c) {
  const r = c.round, cellsN = r.c * r.r, orig = new Set(r.cells);
  const grid = (cls, act) => `<div class="sngrid" style="grid-template-columns:repeat(${r.c}, 1fr);--c:${r.c};--r:${r.r}">${Array.from({ length: cellsN }, (_, i) => `<button class="snc${cls(i)}"${act ? ` data-act="snap-cell" data-i="${i}" aria-label="Cell ${i + 1}${cls(i).includes(' sel') ? ', picked' : ''}"` : ' tabindex="-1" aria-hidden="true"'}${act && c.answering && c.live ? '' : ' disabled'}></button>`).join('')}</div>`;
  const pick = c.shown ? new Set(c.shown.answer || []) : new Set(c.started && attDraft ? attDraft.entry : []);
  const res = i => (orig.has(i) && pick.has(i) ? ' hit' : orig.has(i) ? ' miss' : pick.has(i) ? ' extra' : '');
  const show = r.show, wait = r.wait || 0, len = show + wait, secs = Math.ceil(wait / 1000), blank = () => '';
  // the pattern for its seconds, then the grid blank for the countdown's, then (this phone's round) the grid to tap
  let stage, count = '';
  const msg = wait ? snapMsg(r) : '';
  if (c.shown && c.pre) stage = `<div class="snstack"><div class="tu" style="--u:${show}ms">${grid(i => (orig.has(i) ? ' on' : ''))}</div><div class="tf tu2" style="--f:${show}ms;--u:${len}ms">${grid(blank)}</div>${msg ? `<div class="snmsg tu2" style="--f:${show}ms;--u:${len}ms"><span>${msg}</span></div>` : ''}<div class="tf tu2" style="--f:${len}ms;--u:${c.pre}ms">${grid(i => (pick.has(i) ? ' sel' : ''))}</div><div class="tf" style="--f:${c.pre}ms">${grid(res)}</div></div>`;
  else if (c.shown) stage = grid(res);
  else if (c.playing) stage = `<div class="snstack"${fxAttr(c.startPerf, 'rt')}><div>${grid(blank)}</div><div class="tu" style="--u:${show}ms">${grid(i => (orig.has(i) ? ' on' : ''))}</div>${msg ? `<div class="snmsg tf" style="--f:${show}ms"><span>${msg}</span></div>` : ''}</div>`;
  else stage = grid(i => (c.answering && pick.has(i) ? ' sel' : ''), true);
  // the time left: a bar while the pattern shows; then the countdown, in seconds and a bar of its own
  if (c.playing || (c.shown && c.pre)) count = `<div class="sncount"${c.playing ? fxAttr(c.startPerf, 'rt') : ''}><span class="sndig">${Array.from({ length: secs }, (_, k) => `<b class="tf tu" style="--f:${show + k * 1000}ms;--u:${show + (k + 1) * 1000}ms">${secs - k}</b>`).join('')}</span><span class="snbars"><span class="obar tu" style="--u:${show}ms"><i style="--d:${show}ms"></i></span>${wait ? `<span class="obar tf" style="--f:${show}ms"><i style="--d:${wait}ms;animation-delay:${show}ms"></i></span>` : ''}</span></div>`;
  const input = `<div class="snin">${count}</div>`;
  return { stage, input, watch: '', ask: `Which ${r.cells.length} cells were filled?`, say: () => `${r.cells.length} cells` };
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = attTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.att ? `${who} ${f.att.correct ? 'got it right' : f.att.answer == null ? 'ran out of time' : 'got it wrong'}` : `${who} played a round`;
}
// Snapshot: a cell picked or unpicked
export function snapCellAct(el, e, act) {
  if (zoomedType() !== 'snapshot' || !attDraft || state.flash || state.done || blocked()) return;
  const i = Number(el.dataset.i), at = attDraft.entry.indexOf(i);
  if (at >= 0) attDraft.entry.splice(at, 1); else attDraft.entry.push(i);
  SND.play(at >= 0 ? 'deselect' : 'mark'); attSave(); render();
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
