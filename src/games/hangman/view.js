// Hangman: the screen, the miniature, the move's words and sounds, and the inputs.
import { playerName } from '../../core/match.js';
import { isRace, raceFlashHide, raceShape } from '../../core/race.js';
import { N, esc, state, viewer } from '../../ui/app.js';
import { toon } from '../../ui/art.js';
import { keyboard } from '../../ui/keyboard.js';
import { hangLen, hangLetters, hangPart } from './rules.js';

// Race mode (core/race.js): the square this view gets holds this phone's own part alone (its letters and its own revealed
// pattern) and both players' shapes (the blanks each has filled, their wrong letters); the other side's move arrives
// redacted (`a.race`: their shape after it, the blanks it filled as `at`).
const shapeOf = (mini, p) => raceShape(mini, p) || (mini.shape && mini.shape[p]) || {};
const gotOf = (mini, p) => { const sh = shapeOf(mini, p); return Array.isArray(sh.got) ? sh.got : new Array(hangLen(mini)).fill(false); };
const wrongOf = (mini, p) => { const sh = shapeOf(mini, p); return Number.isInteger(sh.wrong) ? sh.wrong : 0; };
const wrongWords = n => `${n} wrong`;
// The miniature: the word's blanks with the letters found so far, and the last five wrong letters crossed out as in the
// full view (all of them in the label), each letter as large as the board's other text. A race (shapes alone): each
// player's blanks, the ones they have filled darkened without their letters, and their wrong count.
export function miniature(mini, final) {
  if (mini.race && !final) {
    return `<div class="thg trace" aria-label="Race: ${['X', 'O'].map(p => `${p} ${gotOf(mini, p).filter(Boolean).length} of ${hangLen(mini)} letters, ${wrongWords(wrongOf(mini, p))}`).join(', ')}">${['X', 'O'].map(p => `<div class="thq"><b class="${p}">${p}</b><div class="hw" style="--n:${hangLen(mini)}">${gotOf(mini, p).map(on => `<i class="${on ? 'on' : ''}"></i>`).join('')}</div><em class="thwr">${wrongOf(mini, p)}✗</em></div>`).join('')}</div>`;
  }
  const letters = mini.race ? [].concat(hangLetters(mini, 'X'), hangLetters(mini, 'O')) : mini.letters;   // (a finished race square: both players' letters)
  const got = new Set(letters.filter(x => x.hit).map(x => x.l));
  const wrong = letters.filter(x => !x.hit).map(x => x.l);
  return `<div class="thg"><div class="hw" style="--n:${mini.word.length}">${mini.word.split('').map(ch => `<i class="${got.has(ch) ? 'on' : ''}">${got.has(ch) ? esc(ch) : ''}</i>`).join('')}</div>${wrong.length ? `<div class="hmx" aria-label="Wrong letters: ${esc(wrong.join(', '))}">${wrong.slice(-5).map(l => `<i>${esc(l)}</i>`).join('')}</div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const race = !!mini.race, me = race ? (viewer() || turn) : null, them = me === 'X' ? 'O' : 'X';
  const theirs = race && a && a.race && a.by !== me ? a : race && d && d.race && d.by !== me ? d : null;   // the other side's move, as its shape (held in `d` once its result has played)
  const part = race ? (hangPart(mini, me) || { letters: [], pattern: new Array(hangLen(mini)).fill(null) }) : mini;   // (a race: this side's own letters and pattern)
  const got = {};
  for (const x of part.letters) got[x.l] = x.hit ? 'hit' : 'miss';
  const justL = a && !theirs ? (a.own || a.letter || null) : null;   // (a race: this side's own letter rides as `own`)
  let kk = 0;
  const word = mini.word.split(''), at = new Set(theirs && a && Array.isArray(theirs.race.at) ? theirs.race.at : []);   // (the blanks their letter filled turn once, with the move)
  const tiles = word.map((ch, i) => {
    const own = race ? (view ? ch : part.pattern[i]) : (got[ch] || view ? ch : null);   // the letter this side may see here (a race: its own pattern; a finished square: the word)
    const on = !!own, flip = on && ch === justL;
    return `<i class="ht${on ? ' on' : ''}${flip ? ' flipin' : ''}"${flip ? ` style="--k:${kk++}"` : ''}>${on ? esc(own) : ''}</i>`;
  }).join('');
  let opp = '';
  if (race && !view) {                                                                       // the other player's blanks, the ones they have filled darkened (no letters), and their wrong count: a reserved row
    const g2 = gotOf(mini, them), said = theirs ? `${esc(playerName(state, them))} ${theirs.race.hit ? 'found a letter' : 'missed'} · ${wrongWords(theirs.race.wrong || 0)}` : `${esc(playerName(state, them))}: ${g2.filter(Boolean).length} of ${g2.length} letters · ${wrongWords(wrongOf(mini, them))}`;   // (plain text: never N in an attribute)
    opp = `<div class="hopp${theirs && a ? ' fresh' : ''}" aria-label="${said}"><span class="hoby ${them}">${toon(them)}</span><span class="hob" style="--n:${g2.length}">${g2.map((on, i) => `<i class="${on ? 'on' : ''}${at.has(i) ? ' flipin' : ''}"${at.has(i) ? ` style="--k:${[...at].indexOf(i)}"` : ''}></i>`).join('')}</span><em class="hown">${wrongWords(theirs ? theirs.race.wrong || 0 : wrongOf(mini, them))}</em></div>`;
  }
  const wrongs = p => hangLetters(mini, p).filter(x => !x.hit).map(x => `<i${x.l === justL ? ' class="new"' : ''}>${esc(x.l)}</i>`).join(' ');
  const wrong = race ? wrongs(me) : mini.letters.filter(x => !x.hit).map(x => `<i${x.l === justL ? ' class="new"' : ''}>${esc(x.l)}</i>`).join(' ');
  const miss = race && view ? ['X', 'O'].map(p => `<span class="hwl"><b class="${p}">${N(p)}</b> ${wrongs(p) ? `<b>${wrongs(p)}</b>` : 'none wrong'}</span>`).join('<br>')   // (a finished race square: both players' wrong letters)
    : wrong ? `Wrong: <b>${wrong}</b>` : race ? 'Your letters are yours alone' : 'No wrong letters yet';
  g = `<div class="g-hang${race ? ' race' : ''}"><div class="hword">${tiles}</div>${opp}
        <div class="hmiss">${miss}</div>
        ${keyboard(k => (got[k] || '') + (k === justL && got[k] === 'miss' ? ' shake' : ''), k => locked || !!got[k])}</div>`;
  return g;
}
// The other side's move in a race square, as this phone may say it: the header's line gets the move as made (ui/turnbar.js
// flashLine reads state.flash itself), so a flash not yet redacted is redacted here from the square (core/race.js).
function seen(f) {
  if (f.race || f.letter === undefined || f.by === viewer()) return f;
  const sq = state.squares && state.squares[f.square];
  return sq && isRace(sq.mini) && sq.mini.type === 'hangman' ? raceFlashHide(f, sq.mini) : f;
}
export function moveText(f, who) {
  f = seen(f);
  if (f.race && f.letter === undefined) return f.race.hit ? `${who} found a letter` : `${who} missed · ${wrongWords(f.race.wrong || 0)}`;   // the other side's letter in a race: its shape alone
  return `No ${esc(f.letter)}`;
}
export function sounds(f, add, won, mini, last) {
  add(f.kind === 'again' ? 'ding' : 'thud', 260); if (won) add('solve', 600); return;
}
