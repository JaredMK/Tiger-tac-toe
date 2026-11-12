// Headcount: the screen, the miniature, the move's words and sounds, and the inputs.
import { attMs } from '../shared/attention.js';
import { HEAD_KINDS, headAsk, headAxis, headKeys } from './rules.js';
import { SND } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { esc, state, zoomedType } from '../../ui/app.js';
import { ATT_KEY, ATT_T, attDraft, attSave, attStartAct, attTable } from '../../ui/attention.js';
import { fxAttr } from '../../ui/fx.js';
import { qMark, qPick } from '../../ui/quiz.js';
import { render } from '../../ui/render.js';
import { attentionMiniature } from '../../ui/attention.js';
export { attentionSounds as sounds, attentionWonAt as wonAt } from '../../ui/attention.js';

// The creatures, drawn facing right (bold ink outlines, flat colours).
const HC_ART = {
  beetle: c => `<ellipse cx="19" cy="20" rx="11" ry="9" fill="${c || '#4e9d3a'}"/><path d="M19 11v18" stroke="#161210" stroke-width="2"/><circle cx="32" cy="20" r="5" fill="#161210"/><path d="M10 12l-4-4M18 11l-1-5M26 12l3-5M10 28l-4 4M18 29l-1 5M26 28l3 5" stroke="#161210" stroke-width="2.4" stroke-linecap="round"/>`,
  ladybird: c => `<path d="M8 20a11 10 0 0 1 22 0a11 10 0 0 1-22 0z" fill="${c || '#e5432a'}"/><circle cx="32" cy="20" r="5" fill="#161210"/><path d="M19 10v20" stroke="#161210" stroke-width="2"/><circle cx="14" cy="15" r="2.3" fill="#161210"/><circle cx="24" cy="15" r="2.3" fill="#161210"/><circle cx="14" cy="25" r="2.3" fill="#161210"/><circle cx="24" cy="25" r="2.3" fill="#161210"/>`,
  mouse: c => `<path d="M7 24q-6 3-4 9" fill="none" stroke="#161210" stroke-width="2" stroke-linecap="round"/><ellipse cx="18" cy="23" rx="12" ry="8" fill="${c || '#a3a1ad'}"/><circle cx="27" cy="15" r="4.5" fill="#d7c2c8" stroke="#161210" stroke-width="2"/><path d="M28 18q8 2 9 6q-5 2-9 0z" fill="${c || '#a3a1ad'}"/><circle cx="31" cy="20" r="1.5" fill="#161210"/><circle cx="37" cy="24" r="1.6" fill="#161210"/>`,
  acorn: () => `<path d="M11 18h18q0 14-9 17q-9-3-9-17z" fill="#d6a35c"/><path d="M9 18q11-10 22 0z" fill="#7a4a22"/><path d="M20 9v-4" stroke="#161210" stroke-width="2.4" stroke-linecap="round"/>`,
  leaf: () => `<path d="M20 4q14 10 0 32q-14-22 0-32z" fill="#e08a2c"/><path d="M20 8v28" stroke="#161210" stroke-width="1.8"/>`,
};
const HC_LOOK = { gbeetle: ['beetle', '#4e9d3a'], bbeetle: ['beetle', '#3b87c7'], tbeetle: ['beetle', '#2b9fa8'], rladybird: ['ladybird', '#e5432a'], oladybird: ['ladybird', '#f39a2a'], gmouse: ['mouse', '#a3a1ad'], bmouse: ['mouse', '#a0703f'] };   // the look-alikes: one creature in two near colours
export const hcArt = k => { const [b, c] = HC_LOOK[k] || [k]; const a = HC_ART[b](c); return `<svg viewBox="0 0 40 40" aria-hidden="true"><g stroke="#161210" stroke-width="2.4" stroke-linejoin="round">${a}</g></svg>`; };
// The meadow the creatures cross: mown bands, tufts and a few pebbles in the grass's own greens (the scene alone: a
// creature is drawn over it exactly as it always was, the same size, colours and outline).
const HC_TUFTS = [[9, 14], [31, 8], [58, 17], [83, 11], [18, 39], [44, 33], [71, 43], [93, 36], [7, 63], [35, 58], [62, 68], [86, 61], [22, 86], [49, 91], [76, 84], [95, 90]];
const HC_TURF = `<svg class="hcturf" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-width="1"><path stroke="#93c568" d="${HC_TUFTS.map(([x, y]) => `M${x} ${y}l-1.8-3.2M${x} ${y}v-4.2M${x} ${y}l1.8-3.2`).join('')}"/><path stroke="#c2e49a" d="${HC_TUFTS.filter((_, i) => i % 3 === 0).map(([x, y]) => `M${x + 5} ${y + 6}l-1.4-2.6M${x + 5} ${y + 6}l1.4-2.6`).join('')}"/></g><g fill="#9ccb72"><ellipse cx="27" cy="23" rx="2.6" ry="1.5"/><ellipse cx="66" cy="55" rx="3" ry="1.7"/><ellipse cx="13" cy="78" rx="2.2" ry="1.3"/><ellipse cx="88" cy="74" rx="2.6" ry="1.5"/></g></svg>`;
// The miniature's picture: a patch of the meadow with a few of its creatures on their way (always these: never a round's).
const HC_MINI = `<div class="tatt hcm"><svg viewBox="0 0 44 44" aria-hidden="true"><rect x="2" y="2" width="40" height="40" rx="7" fill="#a9d47c" stroke="#161210" stroke-width="2.6"/><path d="M8 13l-1.2-2.4M8 13v-3M8 13l1.2-2.4M33 36l-1.2-2.4M33 36v-3M33 36l1.2-2.4M36 12l-1.2-2.4M36 12v-3M36 12l1.2-2.4" fill="none" stroke="#8fc061" stroke-width="1.2" stroke-linecap="round"/><g stroke="#161210" stroke-width="2.4" stroke-linejoin="round"><g transform="translate(5 5) scale(.5)">${HC_ART.ladybird('#e5432a')}</g><g transform="translate(20 13) scale(.5)">${HC_ART.beetle('#4e9d3a')}</g><g transform="translate(7 22) scale(.5)">${HC_ART.ladybird('#e5432a')}</g></g></svg></div>`;
export const miniature = (mini, final) => attentionMiniature(mini, final, HC_MINI);
// The play area of each game: { stage, input, watch (during the round), ask (the question), say (an answer in words) }.
export function headView(c) {
  const r = c.round, anim = c.playing || c.pre, len = attMs('headcount', r);   // the crossing: this phone's (from Start), or someone else's (from the move)
  // each creature's way: right, left, down or up at its own speed; one that stops and starts has its own key points (from the engine's)
  const way = it => (headAxis(it, r) === 'v' ? (it.dir > 0 ? 'dn' : 'up') : it.dir > 0 ? 'r' : 'l'), along = (it, u) => `translate${headAxis(it, r) === 'v' ? 'Y' : 'X'}(${+(it.dir > 0 ? -100 + u * 1009.1 : 909.1 - u * 1009.1).toFixed(1)}%)`;
  const frames = anim ? r.items.map((it, i) => (it.s ? `@keyframes hk${i} {${headKeys(it).map(([f, u]) => ` ${+(f * 100).toFixed(2)}% { transform: ${along(it, u)}; }`).join('')} }` : '')).join('') : '';
  const crit = anim ? r.items.map((it, i) => `<i class="hcr ${way(it)} k-${esc(it.k)}" style="--t:${it.t}ms;--d:${it.d}ms;--p:${10 + it.lane * 20 - 5.5}%;--hcanim:${it.s ? 'hk' + i : { r: 'hcr', l: 'hcl', dn: 'hcv', up: 'hcu' }[way(it)]}">${hcArt(it.k)}</i>`).join('') : '';
  const field = `<div class="hcfield${r.axis === 'v' ? ' fall' : ''}"${c.started ? fxAttr(c.startPerf, 'rt') : ''} aria-label="The field">${HC_TURF}${frames ? `<style>${frames}</style>` : ''}${crit}</div>`;
  // the number pad: the answer typed into the display (each digit pops in under the finger), OK sends it. The verdict
  // lands on the display T into the move (ui/attention.js): right, it turns green under a tick and the point flies from
  // it to the pip; wrong, it shakes under a cross, the answer struck through, the right count beside it. Someone else's
  // answer is typed in first, key by key (ATT_T), as they did.
  const entry = c.started && attDraft ? attDraft.entry : '', live = c.answering && c.live, s = c.shown, late = c.fresh, T = c.T;
  const ans = s ? (s.answer == null ? '–' : String(s.answer)) : entry, typeAt = i => len + ATT_T.type + i * ATT_T.step;
  const digits = s ? ans.split('').map((d, i) => `<b${c.pre ? ` class="appear" style="--t:${typeAt(i)}ms"` : ''}>${esc(d)}</b>`).join('')
    : entry.split('').map((d, i) => `<b${attDraft.keyNew && i === entry.length - 1 ? ' class="hcpop"' : ''}>${esc(d)}</b>`).join('');
  const body = s ? `<span class="hcans${s.correct ? '' : ' no'}">${digits}</span><span class="hcmk">${qMark(s.correct ? 'ok' : 'no', late)}</span>${s.correct ? '' : `<span class="hctruth${late ? ' appear' : ''}"${late ? ` style="--t:${T + 160}ms"` : ''}>${esc(String(s.truth))}</span>`}`
    : entry ? `<span class="hcans">${digits}</span><i class="hccar"></i>` : '<i>?</i>';
  const disp = `<div class="hcdisp${s ? (s.correct ? ' ok' : ' no') + (late ? ' late' : '') : ''}"${s ? (late ? ` style="--t:${T}ms"` : '') + (late && s.correct ? qPick() : '') : c.answering && attDraft.keyAt != null ? fxAttr(attDraft.keyAt) : ''} aria-label="Your answer">${body}</div>`;
  // (someone else's keys go down as they type: each digit's key, then OK; this phone's own OK is pressed in as the answer goes)
  const hits = {}; if (s && late && s.answer != null) { if (c.pre) ans.split('').forEach((d, i) => (hits[d] = hits[d] || []).push(typeAt(i))); hits.ok = [c.pre ? len + ATT_T.send : 0]; }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map(k => `<button class="hckey${k === 'ok' ? ' ok' : ''}${hits[k] ? ' hit' : ''}"${hits[k] ? ` style="--t:${hits[k][0]}ms${hits[k][1] != null ? `;--t2:${hits[k][1]}ms` : ''}"` : ''} data-act="hc-key" data-k="${k}" aria-label="${k === 'del' ? 'Delete' : k === 'ok' ? 'Done' : k}"${live && (k !== 'ok' || entry) ? '' : ' disabled'}>${k === 'del' ? '⌫' : k === 'ok' ? 'OK' : k}</button>`).join('');
  const pad = `<div class="hcpad${live || s ? '' : ' dim'}">${disp}${keys}</div>`;
  // one square box: the field while the creatures cross, then the number pad in its place (the question, the answer, the result)
  const stage = s && c.pre ? `<div class="hcbox"><div class="hcl tu" style="--u:${len}ms">${field}</div><div class="hcl hcin tf" style="--f:${len}ms">${pad}</div></div>`
    : `<div class="hcbox"><div class="hcl${c.answering ? ' hcin' : ''}"${c.answering ? fxAttr(c.startPerf + len, 'rt') : ''}>${c.answering || s ? pad : field}</div></div>`;
  // the prompt: what to count, its picture beside its name (before Start and while they cross), then the question, picture and all
  const many = HEAD_KINDS[r.t][1], ico = `<span class="hcico">${hcArt(r.t)}</span>`;
  return { stage, input: '', watch: `Count the ${many}`, ask: headAsk(r), watchHtml: `Count the ${ico}${many}`, askHtml: `How many ${ico}${many}?`, say: n => `${n} ${HEAD_KINDS[r.t][n === 1 ? 0 : 1]}` };
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = attTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, won: !!fresh }); return g;
}
export function moveText(f, who) {
  return f.att ? `${who} ${f.att.correct ? 'got it right' : f.att.answer == null ? 'ran out of time' : 'got it wrong'}` : `${who} played a round`;
}
// Headcount: the number pad (up to two digits); OK answers
export function hcKeyAct(el, e, act) {
  if (zoomedType() !== 'headcount' || !attDraft || state.flash || state.done || blocked()) return;
  const k = el.dataset.k;
  if (k === 'ok') { if (!attDraft.entry) return; const n = Number(attDraft.entry); clearTimeout(attDraft.timer); try { localStorage.removeItem(ATT_KEY); } catch (err) { /* no storage */ } attemptMove(n); return; }
  const was = attDraft.entry;
  attDraft.entry = k === 'del' ? attDraft.entry.slice(0, -1) : (attDraft.entry + k).replace(/^0(?=\d)/, '').slice(0, 2);
  attDraft.keyAt = performance.now(); attDraft.keyNew = k !== 'del' && attDraft.entry !== was;   // (the display's pop: the digit just typed, from this press)
  SND.play('key'); haptic('tap'); attSave(); render();
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'att-start': attStartAct, 'hc-key': hcKeyAct };
