// Wordle: the screen, the miniature, the move's words and sounds, and the inputs.
import { noticeSeq } from '../../net/moves.js';
import { esc, state } from '../../ui/app.js';
import { fxAt, fxAttr } from '../../ui/fx.js';
import { keyboard } from '../../ui/keyboard.js';

export function miniature(mini, final) {
  const last = mini.guesses.slice(-4);
  const rows = last.length
    ? last.map(g => `<div class="twr">${g.word.split('').map((ch, k) => `<i class="${g.marks[k]}">${ch}</i>`).join('')}</div>`).join('')
    : `<div class="twr">${'<i></i>'.repeat(5)}</div><div class="twr">${'<i></i>'.repeat(5)}</div>`;
  const more = mini.guesses.length - last.length;
  return `<div class="tw">${rows}${more > 0 ? `<small>+${more} earlier</small>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const n = mini.guesses.length;
  const rows = mini.guesses.map((gs, r) => `<div class="wrow">${gs.word.split('').map((ch, k) =>
        `<i class="wt ${gs.marks[k]}${a && r === n - 1 ? ' reveal' : ''}"${a && r === n - 1 ? ` style="--k:${k}"` : ''}>${ch}</i>`).join('')}</div>`).join('');
  const dr = state.draft || '';
  const cur = Array.from({ length: 5 }, (_, k) => `<i class="wt${dr[k] ? ' typed' : ''}">${dr[k] || ''}</i>`).join('');
  const rank = { x: 1, y: 2, g: 3 };
  const bestOf = list => { const b = {}; for (const gs of list) gs.word.split('').forEach((ch, k) => { if ((rank[gs.marks[k]] || 0) > (rank[b[ch]] || 0)) b[ch] = gs.marks[k]; }); return b; };
  const best = bestOf(mini.guesses), before = a ? bestOf(mini.guesses.slice(0, -1)) : best;   // keys recolour once the tiles have flipped
  g = `<div class="g-wordle"><div class="wlist" id="wlist">${rows || `<div class="empty">${view ? 'No guesses were made.' : 'No guesses yet'}</div>`}</div>
        ${state.notice ? `<div class="notice" role="alert"${fxAttr(fxAt('notice', noticeSeq))}>${esc(state.notice)}</div>` : ''}
        ${view ? '' : `<div class="wrow cur${state.notice ? ' shake' : ''}" aria-label="Your guess"${state.notice ? fxAttr(fxAt('notice', noticeSeq)) : ''}>${cur}</div>`}
        ${keyboard(k => (best[k] || '') + (best[k] && best[k] !== before[k] ? ' kc' : ''), () => locked || dr.length >= 5, { enter: locked || dr.length !== 5, bksp: locked || !dr.length })}</div>`;
  return g;
}
export function moveText(f, who) {
  return `${who} tried ${f.word}`;
}
export function sounds(f, add, won, mini, last) {
  if (last) last.marks.forEach((m, k) => add(m === 'g' ? 'tileG' : m === 'y' ? 'tileY' : 'tileX', 200 + k * 180)); if (won) add('solve', 1100); return;
}
