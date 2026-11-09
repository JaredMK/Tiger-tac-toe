// Hangman: the screen, the miniature, the move's words and sounds, and the inputs.
import { esc } from '../../ui/app.js';
import { keyboard } from '../../ui/keyboard.js';
import { raceBoards, raceMe, raceThumb } from '../../ui/race.js';
import { hangLen, hangPart, hangTarget } from './rules.js';

// Race mode (core/race.js, `rv: 2`): each player their own word; both players' letters are open, so the square is two
// boards (ui/race.js): this phone's own word, its wrong letters and the keyboard, large; the other player's word with the
// letters they have revealed and their wrong letters, smaller under it, their letter landing there as they play it.
const blankPart = mini => ({ letters: [], pattern: new Array(hangLen(mini)).fill(null) });
const patOf = (mini, p) => { const part = hangPart(mini, p); return part && Array.isArray(part.pattern) ? part.pattern : blankPart(mini).pattern; };
// The miniature: the word's blanks with the letters found so far, and the last five wrong letters crossed out as in the
// full view (all of them in the label), each letter as large as the board's other text. A race: each player's word as
// blanks, the ones they have revealed filled in their colour (letters against length), side by side.
export function miniature(mini, final) {
  if (mini.race) {
    const n = hangLen(mini) || 5;
    return raceThumb(p => `<span class="hgm" style="--n:${n};--c:${Math.ceil(n / 2)}">${patOf(mini, p).map(ch => `<i${ch ? ' class="on"' : ''}></i>`).join('')}</span>`, 'thg2',
      `Race: ${['X', 'O'].map(p => `${p} ${patOf(mini, p).filter(Boolean).length} of ${n} letters`).join(', ')}`);
  }
  const letters = mini.letters;
  const got = new Set(letters.filter(x => x.hit).map(x => x.l));
  const wrong = letters.filter(x => !x.hit).map(x => x.l);
  return `<div class="thg"><div class="hw" style="--n:${mini.word.length}">${mini.word.split('').map(ch => `<i class="${got.has(ch) ? 'on' : ''}">${got.has(ch) ? esc(ch) : ''}</i>`).join('')}</div>${wrong.length ? `<div class="hmx" aria-label="Wrong letters: ${esc(wrong.join(', '))}">${wrong.slice(-5).map(l => `<i>${esc(l)}</i>`).join('')}</div>` : ''}</div>`;
}
// A word's tiles: each letter shown where `shown(ch, i)` says (its own pattern, or the word in a finished square), the
// letter just played turning in; `muted(i)`: a letter shown only because the square is over (never found).
function tiles(len, shown, justL, muted) {
  let kk = 0;
  return Array.from({ length: len }, (_, i) => {
    const own = shown(i), on = !!own, flip = on && own === justL && !muted(i);
    return `<i class="ht${on ? ' on' : ''}${muted(i) ? ' late' : ''}${flip ? ' flipin' : ''}"${flip ? ` style="--k:${kk++}"` : ''}>${on ? esc(own) : ''}</i>`;
  }).join('');
}
const wrongList = (letters, justL) => letters.filter(x => !x.hit).map(x => `<i${x.l === justL ? ' class="new"' : ''}>${esc(x.l)}</i>`).join(' ');
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (!mini.race) {
    const got = {};
    for (const x of mini.letters) got[x.l] = x.hit ? 'hit' : 'miss';
    const justL = a ? a.letter || null : null, word = mini.word.split('');
    const wrong = wrongList(mini.letters, justL);
    return `<div class="g-hang"><div class="hword">${tiles(word.length, i => (got[word[i]] || view ? word[i] : null), justL, () => false)}</div>
        <div class="hmiss">${wrong ? `Wrong: <b>${wrong}</b>` : 'No wrong letters yet'}</div>
        ${keyboard(k => (got[k] || '') + (k === justL && got[k] === 'miss' ? ' shake' : ''), k => locked || !!got[k])}</div>`;
  }
  const me = raceMe(), them = me === 'X' ? 'O' : 'X', len = hangLen(mini);
  const part = hangPart(mini, me) || blankPart(mini), opp = hangPart(mini, them) || blankPart(mini);   // (both parts open; a square from before the rework: what this copy has)
  const mineA = a && a.by === me ? a : null, theirA = a && a.by === them ? a : null;      // the move to animate, on the board of the side that made it
  const got = {};
  for (const x of part.letters) got[x.l] = x.hit ? 'hit' : 'miss';
  const justL = mineA ? mineA.letter || null : null, theirL = theirA ? theirA.letter || null : null;
  const myWord = view ? hangTarget(mini, me) : null, theirWord = view ? hangTarget(mini, them) : null;   // (a finished square: the words revealed, the letters never found muted)
  const shownBy = (pat, w) => i => (pat[i] || (typeof w === 'string' ? w[i] : null));
  const lateBy = (pat, w) => i => !pat[i] && typeof w === 'string';
  const wrong = wrongList(part.letters, justL), wrong2 = wrongList(opp.letters, theirL);
  const mine = `<div class="g-hang race"><div class="hword">${tiles(len, shownBy(part.pattern, myWord), justL, lateBy(part.pattern, myWord))}</div>
        <div class="hmiss">${wrong ? `Wrong: <b>${wrong}</b>` : 'No wrong letters yet'}</div>
        ${keyboard(k => (got[k] || '') + (k === justL && got[k] === 'miss' ? ' shake' : ''), k => locked || !!got[k])}</div>`;
  const theirs = `<div class="hgo" style="--n:${len}"><div class="hword">${tiles(len, shownBy(opp.pattern, theirWord), theirL, lateBy(opp.pattern, theirWord))}</div>`
    + `<div class="hmiss">${wrong2 ? `Wrong: <b>${wrong2}</b>` : 'No wrong letters yet'}</div></div>`;
  const nw = opp.letters.filter(x => !x.hit).length;
  return raceBoards(mine, theirs, `${opp.pattern.filter(Boolean).length} of ${len} · ${nw} wrong`, { cls: 'rb-hang' });
}
export function moveText(f, who) {
  if (f.letter === undefined) return `${who} guessed`;          // (a redacted move from before the race rework: nothing to say)
  return `No ${esc(f.letter)}`;
}
export function sounds(f, add, won, mini, last) {
  add(f.kind === 'again' ? 'ding' : 'thud', 260); if (won) add('solve', 600); return;
}
