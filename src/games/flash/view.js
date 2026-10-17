// Flash: the screen, the miniature, the move's words and sounds, and the inputs.
import { FLASH, attMs } from '../shared/attention.js';
import { esc, mv, state } from '../../ui/app.js';
import { attStartAct, attTable } from '../../ui/attention.js';
import { fxAttr } from '../../ui/fx.js';
export { attentionMiniature as miniature } from '../../ui/attention.js';
export { attentionSounds as sounds } from '../../ui/attention.js';

// Flash's items: a shape in a colour.
const FL_COL = { blue: '#3b87c7', green: '#3f9b4f', purple: '#8d5bd8' };
const FL_SHAPE = { star: 'M20 3l5.2 10.6 11.7 1.7-8.5 8.2 2 11.6L20 29.6 9.6 35.1l2-11.6-8.5-8.2 11.7-1.7z', heart: 'M20 35S4 25 4 14a8 8 0 0 1 16-2.5A8 8 0 0 1 36 14c0 11-16 21-16 21z', bolt: 'M23 3L8 22h10l-3 15 17-21H21z' };
export const flArt = (s, c) => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${FL_SHAPE[s]}" fill="${FL_COL[c]}" stroke="#161210" stroke-width="2.6" stroke-linejoin="round"/></svg>`;
const flSay = o => (Array.isArray(o) ? `${o[1]} ${o[0]}` : String(o));
export function flashView(c) {
  const r = c.round, anim = c.playing || c.pre;
  const items = anim ? r.items.map(([s, col], i) => `<span class="fit" style="--t:${i * r.ms}ms;--on:${Math.round(r.ms * FLASH.on)}ms">${flArt(s, col)}</span>`).join('') : '';
  const stage = `<div class="flbox"${c.started ? fxAttr(c.startPerf) : ''} aria-label="The flashes">${items}</div>`;
  const opt = (o, k, cls) => `<button class="flopt${cls || ''}" data-act="move" ${mv(k)} aria-label="${esc(flSay(o))}"${c.answering && c.live && !cls ? '' : ' disabled'}>${Array.isArray(o) ? flArt(o[0], o[1]) : `<b>${o}</b>`}</button>`;
  const plain = c.answering ? r.opts.map((o, k) => opt(o, k)).join('') : r.opts.map(() => '<button class="flopt" disabled tabindex="-1" aria-hidden="true"></button>').join('');   // (the options only once the question is asked: nothing to go on before)
  const marked = c.shown ? r.opts.map((o, k) => opt(o, k, k === r.ans ? ' right' : k === c.shown.answer ? ' wrong' : '')).join('') : '';
  const input = c.shown ? (c.pre ? `<div class="flopts lay"><div class="tf" style="--f:${attMs('flash', r)}ms">${r.opts.map((o, k) => opt(o, k, k === c.shown.answer ? ' picked' : '')).join('')}</div><div class="tf" style="--f:${c.pre}ms">${marked}</div></div>` : `<div class="flopts">${marked}</div>`)
    : `<div class="flopts${c.answering ? '' : ' dim'}">${plain}</div>`;
  return { stage, input, watch: '', ask: r.q.text, say: () => flSay(r.opts[r.ans]) };
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = attTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.att ? `${who} ${f.att.correct ? 'got it right' : f.att.answer == null ? 'ran out of time' : 'got it wrong'}` : `${who} played a round`;
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'att-start': attStartAct };
