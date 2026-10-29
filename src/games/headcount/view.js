// Headcount: the screen, the miniature, the move's words and sounds, and the inputs.
import { attMs } from '../shared/attention.js';
import { HEAD_KINDS, headAsk, headAxis, headKeys } from './rules.js';
import { SND } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { esc, state, zoomedType } from '../../ui/app.js';
import { ATT_KEY, attDraft, attSave, attStartAct, attTable } from '../../ui/attention.js';
import { fxAttr } from '../../ui/fx.js';
import { render } from '../../ui/render.js';
export { attentionMiniature as miniature } from '../../ui/attention.js';
export { attentionSounds as sounds } from '../../ui/attention.js';

// The creatures, drawn facing right (bold ink outlines, flat colours).
const HC_ART = {
  beetle: c => `<ellipse cx="19" cy="20" rx="11" ry="9" fill="${c || '#4e9d3a'}"/><path d="M19 11v18" stroke="#161210" stroke-width="2"/><circle cx="32" cy="20" r="5" fill="#161210"/><path d="M10 12l-4-4M18 11l-1-5M26 12l3-5M10 28l-4 4M18 29l-1 5M26 28l3 5" stroke="#161210" stroke-width="2.4" stroke-linecap="round"/>`,
  ladybird: c => `<path d="M8 20a11 10 0 0 1 22 0a11 10 0 0 1-22 0z" fill="${c || '#e5432a'}"/><circle cx="32" cy="20" r="5" fill="#161210"/><path d="M19 10v20" stroke="#161210" stroke-width="2"/><circle cx="14" cy="15" r="2.3" fill="#161210"/><circle cx="24" cy="15" r="2.3" fill="#161210"/><circle cx="14" cy="25" r="2.3" fill="#161210"/><circle cx="24" cy="25" r="2.3" fill="#161210"/>`,
  mouse: c => `<path d="M7 24q-6 3-4 9" fill="none" stroke="#161210" stroke-width="2" stroke-linecap="round"/><ellipse cx="18" cy="23" rx="12" ry="8" fill="${c || '#a3a1ad'}"/><circle cx="27" cy="15" r="4.5" fill="#d7c2c8" stroke="#161210" stroke-width="2"/><path d="M28 18q8 2 9 6q-5 2-9 0z" fill="${c || '#a3a1ad'}"/><circle cx="31" cy="20" r="1.5" fill="#161210"/><circle cx="37" cy="24" r="1.6" fill="#161210"/>`,
  acorn: () => `<path d="M11 18h18q0 14-9 17q-9-3-9-17z" fill="#d6a35c"/><path d="M9 18q11-10 22 0z" fill="#7a4a22"/><path d="M20 9v-4" stroke="#161210" stroke-width="2.4" stroke-linecap="round"/>`,
  leaf: () => `<path d="M20 4q14 10 0 32q-14-22 0-32z" fill="#e08a2c"/><path d="M20 8v28" stroke="#161210" stroke-width="1.8"/>`,
};
const HC_LOOK = { gbeetle: ['beetle', '#4e9d3a'], bbeetle: ['beetle', '#3b87c7'], tbeetle: ['beetle', '#2b9fa8'], rladybird: ['ladybird', '#e5432a'], oladybird: ['ladybird', '#f39a2a'], gmouse: ['mouse', '#a3a1ad'], bmouse: ['mouse', '#a0703f'] };   // the look-alikes: one creature in two near colours
const hcArt = k => { const [b, c] = HC_LOOK[k] || [k]; const a = HC_ART[b](c); return `<svg viewBox="0 0 40 40" aria-hidden="true"><g stroke="#161210" stroke-width="2.4" stroke-linejoin="round">${a}</g></svg>`; };
// The play area of each game: { stage, input, watch (during the round), ask (the question), say (an answer in words) }.
export function headView(c) {
  const r = c.round, anim = c.playing || c.pre, len = attMs('headcount', r);   // the crossing: this phone's (from Start), or someone else's (from the move)
  // each creature's way: right, left, down or up at its own speed; one that stops and starts has its own key points (from the engine's)
  const way = it => (headAxis(it, r) === 'v' ? (it.dir > 0 ? 'dn' : 'up') : it.dir > 0 ? 'r' : 'l'), along = (it, u) => `translate${headAxis(it, r) === 'v' ? 'Y' : 'X'}(${+(it.dir > 0 ? -100 + u * 1009.1 : 909.1 - u * 1009.1).toFixed(1)}%)`;
  const frames = anim ? r.items.map((it, i) => (it.s ? `@keyframes hk${i} {${headKeys(it).map(([f, u]) => ` ${+(f * 100).toFixed(2)}% { transform: ${along(it, u)}; }`).join('')} }` : '')).join('') : '';
  const crit = anim ? r.items.map((it, i) => `<i class="hcr ${way(it)} k-${esc(it.k)}" style="--t:${it.t}ms;--d:${it.d}ms;--p:${10 + it.lane * 20 - 5.5}%;--hcanim:${it.s ? 'hk' + i : { r: 'hcr', l: 'hcl', dn: 'hcv', up: 'hcu' }[way(it)]}">${hcArt(it.k)}</i>`).join('') : '';
  const field = `<div class="hcfield${r.axis === 'v' ? ' fall' : ''}"${c.started ? fxAttr(c.startPerf, 'rt') : ''} aria-label="The field">${frames ? `<style>${frames}</style>` : ''}${crit}</div>`;
  const entry = c.started && attDraft ? attDraft.entry : '', live = c.answering && c.live;
  const shownAns = c.shown ? (c.shown.answer == null ? '–' : String(c.shown.answer)) : entry || '';
  const disp = cls => `<div class="hcdisp${cls}" aria-label="Your answer">${c.shown ? esc(shownAns) : esc(shownAns) || '<i>?</i>'}</div>`;
  const mark = c.shown ? (c.shown.correct ? ' ok' : ' no') : '';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map(k => `<button class="hckey${k === 'ok' ? ' ok' : ''}" data-act="hc-key" data-k="${k}" aria-label="${k === 'del' ? 'Delete' : k === 'ok' ? 'Done' : k}"${live && (k !== 'ok' || entry) ? '' : ' disabled'}>${k === 'del' ? '⌫' : k === 'ok' ? 'OK' : k}</button>`).join('');
  const pad = `<div class="hcpad${live || c.shown ? '' : ' dim'}">${c.shown && c.pre ? `<div class="hcdst"><div class="tu" style="--u:${c.pre}ms">${disp('')}</div><div class="tf" style="--f:${c.pre}ms">${disp(mark)}</div></div>` : disp(mark)}${keys}</div>`;
  // one square box: the field while the creatures cross, then the number pad in its place (the question, the answer, the result)
  const stage = c.shown && c.pre ? `<div class="hcbox"><div class="hcl tu" style="--u:${len}ms">${field}</div><div class="hcl tf" style="--f:${len}ms">${pad}</div></div>`
    : `<div class="hcbox"><div class="hcl">${c.answering || c.shown ? pad : field}</div></div>`;
  // the prompt: what to count, its picture beside its name (before Start and while they cross), then the question, picture and all
  const many = HEAD_KINDS[r.t][1], ico = `<span class="hcico">${hcArt(r.t)}</span>`;
  return { stage, input: '', watch: `Count the ${many}`, ask: headAsk(r), watchHtml: `Count the ${ico}${many}`, askHtml: `How many ${ico}${many}?`, say: n => `${n} ${HEAD_KINDS[r.t][n === 1 ? 0 : 1]}` };
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = attTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.att ? `${who} ${f.att.correct ? 'got it right' : f.att.answer == null ? 'ran out of time' : 'got it wrong'}` : `${who} played a round`;
}
// Headcount: the number pad (up to two digits); OK answers
export function hcKeyAct(el, e, act) {
  if (zoomedType() !== 'headcount' || !attDraft || state.flash || state.done || blocked()) return;
  const k = el.dataset.k;
  if (k === 'ok') { if (!attDraft.entry) return; const n = Number(attDraft.entry); clearTimeout(attDraft.timer); try { localStorage.removeItem(ATT_KEY); } catch (err) { /* no storage */ } attemptMove(n); return; }
  attDraft.entry = k === 'del' ? attDraft.entry.slice(0, -1) : (attDraft.entry + k).replace(/^0(?=\d)/, '').slice(0, 2);
  SND.play('key'); attSave(); render();
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'att-start': attStartAct, 'hc-key': hcKeyAct };
