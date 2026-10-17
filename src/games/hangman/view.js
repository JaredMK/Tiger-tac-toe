// Hangman: the screen, the miniature, the move's words and sounds, and the inputs.
import { keyboard } from '../../ui/keyboard.js';

export function miniature(mini, final) {
  const got = new Set(mini.letters.filter(x => x.hit).map(x => x.l));
  const wrong = mini.letters.filter(x => !x.hit).map(x => x.l);   // the wrong letters themselves, crossed out as in the full view
  return `<div class="thg"><div class="hw" style="--n:${mini.word.length}">${mini.word.split('').map(ch => `<i class="${got.has(ch) ? 'on' : ''}">${got.has(ch) ? ch : ''}</i>`).join('')}</div>${wrong.length ? `<div class="hmx${wrong.length > 16 ? ' many' : wrong.length > 10 ? ' mid' : ''}" aria-label="Wrong letters: ${wrong.join(', ')}">${wrong.map(l => `<i>${l}</i>`).join('')}</div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const got = {};
  for (const x of mini.letters) got[x.l] = x.hit ? 'hit' : 'miss';
  const justL = a ? a.letter : null;
  let kk = 0;
  const tiles = mini.word.split('').map(ch => {
    const on = got[ch] || view, flip = on && ch === justL;
    return `<i class="ht${on ? ' on' : ''}${flip ? ' flipin' : ''}"${flip ? ` style="--k:${kk++}"` : ''}>${on ? ch : ''}</i>`;
  }).join('');
  const wrong = mini.letters.filter(x => !x.hit).map(x => `<i${x.l === justL ? ' class="new"' : ''}>${x.l}</i>`).join(' ');
  g = `<div class="g-hang"><div class="hword">${tiles}</div>
        <div class="hmiss">${wrong ? `Wrong: <b>${wrong}</b>` : 'No wrong letters yet'}</div>
        ${keyboard(k => (got[k] || '') + (k === justL && got[k] === 'miss' ? ' shake' : ''), k => locked || !!got[k])}</div>`;
  return g;
}
export function moveText(f, who) {
  return `No ${f.letter}`;
}
export function sounds(f, add, won, mini, last) {
  add(f.kind === 'again' ? 'ding' : 'thud', 260); if (won) add('solve', 600); return;
}
