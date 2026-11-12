// Hangman: the screen, the miniature, the move's words and sounds, and the inputs.
import { esc } from '../../ui/app.js';
import { keyboard } from '../../ui/keyboard.js';
import { raceBoards, raceMe, raceThem, raceThumb } from '../../ui/race.js';
import { hangLen, hangPart, hangTarget } from './rules.js';

// Race mode (core/race.js, `rv: 2`): each player their own word; both players' letters are open, so the square is two
// boards (ui/race.js): this phone's own word, its wrong letters and the keyboard, large; the other player's word with the
// letters they have revealed and their wrong letters, smaller under it, their letter landing there as they play it.
const blankPart = mini => ({ letters: [], pattern: new Array(hangLen(mini)).fill(null) });
// The picture: a field where every wrong letter draws the next part of a scarecrow (post, crossbar, head, hat, shirt,
// sleeves, face, trousers, patches), then crows that come to sit on it. Original art, drawn in ink strokes and flat
// fills; it only counts the wrong letters (the game has no limit on them), so it carries on past the last part unchanged.
// Every shape has pathLength 1, so the newest part draws itself along its strokes (.hp.new); a crow flies in (.hp.fly).
const S = (cls, d) => `<path class="${cls}" pathLength="1" d="${d}"/>`;
const C = (cls, x, y, r) => `<circle class="${cls}" pathLength="1" cx="${x}" cy="${y}" r="${r}"/>`;
const crow = (x, y, flip) => `<g transform="translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}">${S('th', 'M-1-3v3M3-3v3')}${S('cr', 'M-6-3q-2-9 6-10 8 0 8 8l6 3-7 1q-3 3-8 2z')}${S('bk', 'M-5-11.5l-6 2.6 6 1.6z')}${C('ey', -1.6, -9.6, 1.3)}</g>`;
const PARTS = [   // in the order they are drawn, one a wrong letter; `z`: its place in the stack (the shirt lies over the post, the trousers under the shirt)
  { z: 1, g: S('wo', 'M60 124V31') + S('wi', 'M60 124V31') },                                                   // the post
  { z: 2, g: S('wo', 'M27 65H93') + S('wi', 'M27 65H93') },                                                     // the crossbar
  { z: 5, g: C('pp', 60, 45, 14) + S('th', 'M51 58q9 4 18 0M60 60l-3 6M60 60l4 5') },                           // the sack head, tied at the neck
  { z: 7, g: S('hat', 'M49 32l2-14q9-4 18 0l2 14z') + S('brim', 'M39 33q21-7 42 0') },                          // the hat
  { z: 4, g: S('sh', 'M47 61q13 5 26 0l5 31q-18 6-36 0z') },                                                    // the shirt
  { z: 4, g: S('sh', 'M48 61L27 60v11l19 3z') + S('th', 'M27 62l-8-3M27 65.5h-9M27 69l-8 3') },                // the left sleeve, straw at the cuff
  { z: 4, g: S('sh', 'M72 61L93 60v11l-19 3z') + S('th', 'M93 62l8-3M93 65.5h9M93 69l8 3') },                  // the right sleeve
  { z: 6, g: C('fi', 54.5, 43, 2.1) + S('th', 'M63 41l4 4M67 41l-4 4M53 50q7 5 14 0M56.5 50.6v3M60 51.6v3M63.5 50.6v3') },   // the face: a button eye, a stitched one, a stitched smile
  { z: 3, g: S('tr', 'M43 91q17 6 34 0l3 22-12 2-8-15-8 15-12-2z') + S('th', 'M44 115l-2 6M48 116v6M52 116l2 5M68 116l-2 5M72 116v6M76 115l2 6') },   // the trousers, straw at the ankles
  { z: 6, g: S('pa', 'M50 76l8-1 1 8-8 1z') + S('th', 'M52 79.5l5-.6') + C('fi', 66, 72, 1.6) + C('fi', 67, 81, 1.6) + S('pa', 'M66 99l6 1-1 6-6-1z') },   // patches and buttons
  { z: 8, fly: 1, g: crow(84, 60) },                                                                            // a crow on its arm
  { z: 8, fly: 1, g: crow(63, 16, true) },                                                                      // one on its hat
  { z: 8, fly: 1, g: crow(27, 123) },                                                                           // one in the field
];
export const HANG_PARTS = PARTS.length;
const ORDER = PARTS.map((p, i) => i).sort((a, b) => PARTS[a].z - PARTS[b].z || a - b);
const FIELD = S('gr', 'M5 125c12-3 22-3 34-1s27 3 41 0 22-2 35 0') + S('gs', 'M12 124l-3-7M16 124v-9M20 124l3-7M97 123l-3-7M101 123l1-9M106 123l3-7');
// n: the wrong letters so far; fresh: the last of them was just played (its part draws itself, timed from the move).
export const scarecrow = (n, fresh) => `<svg class="hsc" viewBox="0 0 120 130" role="img" aria-label="${n} wrong letter${n === 1 ? '' : 's'}">${FIELD}${ORDER.filter(i => i < n).map(i =>
  `<g class="hp${fresh && i === n - 1 ? (PARTS[i].fly ? ' fly' : ' new') : ''}">${PARTS[i].g}</g>`).join('')}</svg>`;
const patOf = (mini, p) => { const part = hangPart(mini, p); return part && Array.isArray(part.pattern) ? part.pattern : blankPart(mini).pattern; };
// The miniature: the word's blanks with the letters found so far, and under it the scarecrow as far as it is drawn
// beside the last five wrong letters crossed out (all of them in the label), each letter as large as the board's other text. A race: each player's word as
// blanks, the ones they have revealed filled in their colour (letters against length), side by side.
const TICK = '<svg class="hgk" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5.4l2 2L8 2.8"/></svg>';
// The race miniature: a row each, X over O, each word on one line of blanks, filled in its player's colour as revealed.
export function miniature(mini, final) {
  if (mini.race) {
    const n = hangLen(mini) || 5;
    const them = raceThem();                                     // (the other player's solved blanks carry a small tick as well as the fill)
    return raceThumb(p => `<span class="hgm" style="--n:${n}">${patOf(mini, p).map(ch => (ch ? `<i class="on">${p === them ? TICK : ''}</i>` : '<i></i>')).join('')}</span>`, 'thg2',
      `Race: ${['X', 'O'].map(p => `${p} ${patOf(mini, p).filter(Boolean).length} of ${n} letters`).join(', ')}`);
  }
  const letters = mini.letters;
  const got = new Set(letters.filter(x => x.hit).map(x => x.l));
  const wrong = letters.filter(x => !x.hit).map(x => x.l);
  return `<div class="thg"><div class="hw" style="--n:${mini.word.length}">${mini.word.split('').map(ch => `<i class="${got.has(ch) ? 'on' : ''}">${got.has(ch) ? esc(ch) : ''}</i>`).join('')}</div><div class="thb">${scarecrow(wrong.length, false)}${wrong.length ? `<div class="hmx" aria-label="Wrong letters: ${esc(wrong.join(', '))}">${wrong.slice(-5).map(l => `<i>${esc(l)}</i>`).join('')}</div>` : ''}</div></div>`;
}
// A word's tiles: each letter shown where `shown(ch, i)` says (its own pattern, or the word in a finished square), the
// letter just played turning in; `muted(i)`: a letter shown only because the square is over (never found).
// by(ch): who found the letter (its blank's line takes their colour); win: the word was just completed (its letters hop along it).
function tiles(len, shown, justL, muted, by, win) {
  let kk = 0;
  return Array.from({ length: len }, (_, i) => {
    const own = shown(i), on = !!own, flip = on && own === justL && !muted(i), who = on && !muted(i) ? by(own) : null;
    return `<i class="ht${on ? ' on' : ''}${muted(i) ? ' late' : ''}${who ? ' b' + who : ''}${flip ? ' flipin' : ''}${win ? ' hwin' : ''}"${flip || win ? ` style="${flip ? `--k:${kk++};` : ''}${win ? `--i:${i}` : ''}"` : ''}>${on ? `<b>${esc(own)}</b>` : ''}</i>`;
  }).join('');
}
const SIDE = p => (p === 'X' || p === 'O' ? p : '');
const byOf = letters => { const m = {}; for (const x of letters) if (x.hit && SIDE(x.by)) m[x.l] = x.by; return ch => m[ch] || null; };
// The wrong letters, each a struck chip in its guesser's colour, the newest dropping onto the end of the row.
const wrongList = (letters, justL) => letters.filter(x => !x.hit).map(x => `<i class="hx${SIDE(x.by) ? ' b' + x.by : ''}${x.l === justL ? ' new' : ''}">${esc(x.l)}</i>`).join('');
const missRow = (letters, justL) => { const w = letters.filter(x => !x.hit); return `<div class="hmiss"${w.length ? ` aria-label="Wrong letters: ${esc(w.map(x => x.l).join(', '))}"` : ''}>${w.length ? wrongList(letters, justL) : '<span class="hnone">No wrong letters yet</span>'}</div>`; };
// A key once played: right or wrong, in its guesser's colour, the one just missed shaking.
const keyCls = (letters, justL) => { const got = {}; for (const x of letters) got[x.l] = (x.hit ? 'hit' : 'miss') + (SIDE(x.by) ? ' b' + x.by : ''); return k => (got[k] || '') + (k === justL && got[k] && got[k].startsWith('miss') ? ' shake' : ''); };
const nWrong = letters => letters.filter(x => !x.hit).length;
const missed = (letters, justL) => !!justL && letters.some(x => x.l === justL && !x.hit);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (!mini.race) {
    const got = {};
    for (const x of mini.letters) got[x.l] = x.hit ? 'hit' : 'miss';
    const justL = a ? a.letter || null : null, word = mini.word.split('');
    return `<div class="g-hang"><div class="hstage"><div class="hscene">${scarecrow(nWrong(mini.letters), missed(mini.letters, justL))}</div>
        <div class="hword">${tiles(word.length, i => (got[word[i]] === 'hit' || view ? word[i] : null), justL, i => !!view && got[word[i]] !== 'hit', byOf(mini.letters), !!fresh)}</div></div>
        ${missRow(mini.letters, justL)}
        ${keyboard(keyCls(mini.letters, justL), k => locked || !!got[k])}</div>`;
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
  const wonSide = !!fresh && a ? a.winner || a.by : null;                               // (the word just completed: its letters hop, on the board of the side that found it)
  const mine = `<div class="g-hang race"><div class="hstage"><div class="hscene">${scarecrow(nWrong(part.letters), missed(part.letters, justL))}</div>
        <div class="hword">${tiles(len, shownBy(part.pattern, myWord), justL, lateBy(part.pattern, myWord), () => me, wonSide === me)}</div></div>
        ${missRow(part.letters, justL)}
        ${keyboard(keyCls(part.letters, justL), k => locked || !!got[k])}</div>`;
  const theirs = `<div class="hgo" style="--n:${len}"><div class="hscene">${scarecrow(nWrong(opp.letters), missed(opp.letters, theirL))}</div><div class="hgw"><div class="hword">${tiles(len, shownBy(opp.pattern, theirWord), theirL, lateBy(opp.pattern, theirWord), () => them, wonSide === them)}</div>`
    + `${missRow(opp.letters, theirL)}</div></div>`;
  const nw = nWrong(opp.letters);
  return raceBoards(mine, theirs, `${opp.pattern.filter(Boolean).length} of ${len} · ${nw} wrong`, { cls: 'rb-hang' });
}
// The move's timings (ms; the stylesheet's .ht.flipin, .hp.new, .hx.new and .hwin use the same): a right letter drops
// into its blanks `step` apart and lands at `land`; a wrong one: the pencil at `pen`, the chip down at `chip`; a word
// completed: its letters hop from `dance`.
export const HT = { land: 200, step: 60, pen: 60, chip: 330, dance: 480 };
export function moveText(f, who) {
  if (f.letter === undefined) return `${who} guessed`;          // (a redacted move from before the race rework: nothing to say)
  return f.note === 'miss' ? `No ${esc(f.letter)}` : `${who} found ${esc(f.letter)}`;   // (a right letter that ends the turn: "Go again on success" off)
}
export function sounds(f, add, won, mini, last) {
  if (f.note === 'miss') { add('mark', HT.pen); add('thud', HT.chip); return; }   // a wrong letter: the pencil's stroke, then the letter thumps onto the wrong row
  const part = mini ? hangPart(mini, f.by) : null, word = mini ? (mini.race ? part && part.pattern : typeof mini.word === 'string' ? mini.word.split('') : null) : null;
  const n = Math.max(1, Math.min(4, Array.isArray(word) ? word.filter(ch => ch === f.letter).length : 1));   // a right letter: a chime for each blank it drops into, rising
  for (let k = 0; k < n; k++) add('ding', HT.land + k * HT.step, [1, 1.122, 1.26, 1.335][k]);
  if (won) add('solve', HT.dance); return;
}
