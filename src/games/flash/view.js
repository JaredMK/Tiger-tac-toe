// Flash: the screen, the miniature, the move's words and sounds, and the inputs.
import { FLASH, attMs } from '../shared/attention.js';
import { esc, mv, state } from '../../ui/app.js';
import { ATT_T, attStartAct, attTable } from '../../ui/attention.js';
import { fxAttr } from '../../ui/fx.js';
import { qMark, qPick } from '../../ui/quiz.js';
import { attentionMiniature } from '../../ui/attention.js';
export { attentionSounds as sounds, attentionWonAt as wonAt } from '../../ui/attention.js';

// Flash's items: a shape in a colour.
const FL_COL = { blue: '#3b87c7', green: '#3f9b4f', purple: '#8d5bd8' };
const FL_SHAPE = { star: 'M20 3l5.2 10.6 11.7 1.7-8.5 8.2 2 11.6L20 29.6 9.6 35.1l2-11.6-8.5-8.2 11.7-1.7z', heart: 'M20 35S4 25 4 14a8 8 0 0 1 16-2.5A8 8 0 0 1 36 14c0 11-16 21-16 21z', bolt: 'M23 3L8 22h10l-3 15 17-21H21z' };
export const flArt = (s, c) => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${FL_SHAPE[s]}" fill="${FL_COL[c]}" stroke="#161210" stroke-width="2.6" stroke-linejoin="round"/></svg>`;
const flG = (s, c, tf) => `<g transform="${tf}"><path d="${FL_SHAPE[s]}" fill="${FL_COL[c]}" stroke="#161210" stroke-width="3.4" stroke-linejoin="round"/></g>`;
// The miniature's picture: its cards fanned, a shape on each (always these: never a round's).
const FLASH_ART = () => `<div class="tatt fl"><svg viewBox="0 0 48 44" aria-hidden="true"><g stroke="#161210" stroke-width="2.4" stroke-linejoin="round"><rect x="4" y="9" width="22" height="28" rx="4" fill="#fffaf0" transform="rotate(-14 15 23)"/><rect x="22" y="9" width="22" height="28" rx="4" fill="#fffaf0" transform="rotate(14 33 23)"/><rect x="12" y="5" width="24" height="31" rx="4.5" fill="#fffaf0"/></g>${flG('heart', 'purple', 'translate(3.5 18) rotate(-14) scale(.3)')}${flG('bolt', 'green', 'translate(33 14.5) rotate(14) scale(.3)')}${flG('star', 'blue', 'translate(14.5 11) scale(.48)')}</svg></div>`;
// The card's back (before Start, and once the cards have flashed: the answer's turn): the table's blue, never a player's; a disc with the game's bolt, or the question's mark in the mover's colour.
const FL_BOLT = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M23 3L8 22h10l-3 15 17-21H21z" fill="#8d5bd8" stroke="#161210" stroke-width="3" stroke-linejoin="round"/></svg>';
let flashArt = null;
export const miniature = (mini, final) => attentionMiniature(mini, final, flashArt || (flashArt = FLASH_ART()));
const flSay = o => (Array.isArray(o) ? `${o[1]} ${o[0]}` : String(o));
// The stage is a card: face down before Start; its face while the round flashes on it (untouched: the same items, the
// same size, for the same times); face down again for the question; and the verdict lands on its face T into the move
// (ui/attention.js), a tick or a cross. The picked option is pressed in at once (someone else's: ATT_T.pick after their
// round), then right (it lifts and glows under a tick, its point flying to the pip) or wrong (it shakes under a cross,
// and the right one lights up).
export function flashView(c) {
  const r = c.round, anim = c.playing || c.pre, len = attMs('flash', r), s = c.shown, late = c.fresh, T = c.T;
  const items = anim ? r.items.map(([sh, col], i) => `<span class="fit" style="--t:${i * r.ms}ms;--on:${Math.round(r.ms * FLASH.on)}ms">${flArt(sh, col)}</span>`).join('') : '';
  const back = (ask, cls, st) => `<div class="flback${ask ? ' ask' : ''}${cls || ''}"${st || ''}><span>${ask ? '?' : FL_BOLT}</span></div>`;
  const cover = s ? (late ? (c.pre ? back(true, ' tf tu2', ` style="--f:${len}ms;--u:${T}ms"`) : back(true, ' tu', ` style="--u:${T}ms"`)) : '') : c.playing ? '' : back(c.answering, '', c.answering ? ` style="--f:${len}ms"` : '');   // (the answer's turn: it comes back as the last card goes, from the round's own clock)
  const verdict = s ? `<span class="flver"${late ? ` style="--t:${T}ms"` : ''}>${qMark(s.correct ? 'ok' : 'no', late)}</span>` : '';
  const stage = `<div class="flbox"${c.started ? fxAttr(c.startPerf, 'rt') : ''} aria-label="The flashes">${items}${verdict}${cover}</div>`;
  const opt = (o, k, cls, st, extra) => `<button class="flopt${cls || ''}"${st || ''} data-act="move" ${mv(k)} aria-label="${esc(flSay(o))}"${c.answering && c.live && !cls ? '' : ' disabled'}${extra || ''}>${Array.isArray(o) ? flArt(o[0], o[1]) : `<b>${esc(o)}</b>`}`;
  const ghosts = r.opts.map(() => '<button class="flopt" disabled tabindex="-1" aria-hidden="true"></button>').join('');
  const plain = c.answering ? r.opts.map((o, k) => opt(o, k) + '</button>').join('') : ghosts;   // (the options only once the question is asked: nothing to go on before)
  const marked = s ? r.opts.map((o, k) => {
    const right = k === r.ans, mine = k === s.answer;
    const st = late ? ` style="--t:${T}ms${c.pre && mine ? `;--p:${len + ATT_T.pick}ms` : ''}"` : '';
    if (!right && !mine) return opt(o, k, ' off' + (late ? ' late' : ''), st) + '</button>';
    return opt(o, k, (right ? ' right' : ' wrong') + (mine ? ' pick' : '') + (late ? ' late' : ''), st, late && right && s.correct ? qPick() : '') + qMark(right ? 'ok' : 'no', late) + '</button>';
  }).join('') : '';
  const input = s ? (c.pre ? `<div class="flopts lay"><div class="tu fldim" style="--u:${len}ms">${ghosts}</div><div class="tf fldeal" style="--f:${len}ms">${marked}</div></div>` : `<div class="flopts">${marked}</div>`)
    : `<div class="flopts${c.answering ? ' fldeal' : ' dim'}"${c.answering ? fxAttr(c.startPerf + len, 'rt') : ''}>${plain}</div>`;
  return { stage, input, watch: '', ask: r.q.text, say: () => flSay(r.opts[r.ans]) };
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = attTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, won: !!fresh }); return g;
}
export function moveText(f, who) {
  return f.att ? `${who} ${f.att.correct ? 'got it right' : f.att.answer == null ? 'ran out of time' : 'got it wrong'}` : `${who} played a round`;
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'att-start': attStartAct };
