// Five Letters: the screen, the miniature, the move's words and sounds, and the inputs.
import { noticeSeq } from '../../net/moves.js';
import { N, esc, state } from '../../ui/app.js';
import { toon } from '../../ui/art.js';
import { fxAt, fxAttr } from '../../ui/fx.js';
import { keyboard } from '../../ui/keyboard.js';
import { wordleLeft, wordleLimit } from './rules.js';

// Each player's guesses left, as dots (filled: left; hollow: used), as Higher/Lower's. A square from before the limit: none.
const pips = (mini, p) => { const k = wordleLimit(mini), left = wordleLeft(mini, p); return `<i class="hpips ${p}" aria-label="${p}: ${left} guess${left === 1 ? '' : 'es'} left">${Array.from({ length: k }, (_, j) => `<i class="${j < left ? 'on' : ''}"></i>`).join('')}</i>`; };

export function miniature(mini, final) {
  const lim = wordleLimit(mini), last = mini.guesses.slice(lim ? -3 : -4);   // (with the dots: three rows)
  const rows = last.length
    ? last.map(g => `<div class="twr">${g.word.split('').map((ch, k) => `<i class="${g.marks[k]}">${esc(ch)}</i>`).join('')}</div>`).join('')
    : `<div class="twr">${'<i></i>'.repeat(5)}</div><div class="twr">${'<i></i>'.repeat(5)}</div>`;
  const more = mini.guesses.length - last.length;
  return `<div class="tw">${rows}${more > 0 ? `<small>+${more} earlier</small>` : ''}${lim ? `<span class="twp">${['X', 'O'].map(p => `<b class="${p}">${p}</b>${pips(mini, p)}`).join('')}</span>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const n = mini.guesses.length;
  const rows = mini.guesses.map((gs, r) => `<div class="wrow"><span class="wby ${gs.by}">${toon(gs.by)}</span>${gs.word.split('').map((ch, k) =>
        `<i class="wt ${gs.marks[k]}${a && r === n - 1 ? ' reveal' : ''}"${a && r === n - 1 ? ` style="--k:${k}"` : ''}>${esc(ch)}</i>`).join('')}</div>`).join('');
  const dr = state.draft || '';
  const cur = Array.from({ length: 5 }, (_, k) => `<i class="wt${dr[k] ? ' typed' : ''}">${esc(dr[k] || '')}</i>`).join('');
  const rank = { x: 1, y: 2, g: 3 };
  const bestOf = list => { const b = {}; for (const gs of list) gs.word.split('').forEach((ch, k) => { if ((rank[gs.marks[k]] || 0) > (rank[b[ch]] || 0)) b[ch] = gs.marks[k]; }); return b; };
  const best = bestOf(mini.guesses), before = a ? bestOf(mini.guesses.slice(0, -1)) : best;   // keys recolour once the tiles have flipped
  const left = wordleLimit(mini) ? `<div class="hleft">${['X', 'O'].map(p => `<span class="${p}"><b class="${p}">${N(p)}</b>${pips(mini, p)}</span>`).join('')}</div>` : '';   // each player's guesses left (always there: nothing moves)
  g = `<div class="g-wordle">${left}<div class="wlist" id="wlist">${rows || `<div class="empty">${view ? 'No guesses were made.' : 'No guesses yet'}</div>`}</div>
        ${state.notice ? `<div class="notice" role="alert"${fxAttr(fxAt('notice', noticeSeq))}>${esc(state.notice)}</div>` : ''}
        ${view ? '' : `<div class="wrow cur${state.notice ? ' shake' : ''}" aria-label="Your guess"${state.notice ? fxAttr(fxAt('notice', noticeSeq)) : ''}><span class="wby"></span>${cur}</div>`}
        ${keyboard(k => (best[k] || '') + (best[k] && best[k] !== before[k] ? ' kc' : ''), () => locked || dr.length >= 5, { enter: locked || dr.length !== 5, bksp: locked || !dr.length })}</div>`;
  return g;
}
export function moveText(f, who) {
  return f.note === 'out' ? `${who} tried ${esc(f.word)} · out of guesses` : `${who} tried ${esc(f.word)}`;
}
export function sounds(f, add, won, mini, last) {
  if (last) last.marks.forEach((m, k) => add(m === 'g' ? 'tileG' : m === 'y' ? 'tileY' : 'tileX', 200 + k * 180)); if (won && f.note !== 'out') add('solve', 1100); if (f.note === 'out') add('thud', 1100); return;   // the last guess gone: the square goes to the other player
}
// Someone else's guess replayed (ui/replay.js): the letters typed into the row as theirs were, then Enter.
function replayInput(act, val) {
  if (act === 'key' && /^k=[A-Z]$/.test(val || '')) { if ((state.draft || '').length < 5) state.draft = (state.draft || '') + val.slice(2); }
  else if (act === 'bksp') state.draft = (state.draft || '').slice(0, -1);
  return false;   // (the key's own sound plays)
}
const replaySynth = m => (typeof m === 'string' ? m.split('').map((ch, k) => [k * 300, 'key', 'k=' + ch]).concat([[m.length * 300 + 200, 'enter']]) : null);
export const replay = { input: replayInput, synth: replaySynth };
