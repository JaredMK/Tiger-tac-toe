// Wordle: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { VALID5, WORDS5 } from './words.js';

// Standard Wordle feedback: g = right spot, y = in the word elsewhere, x = not in the word (duplicates handled).
export function wordleMarks(guess, word) {
  const marks = new Array(5).fill('x');
  const left = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === word[i]) marks[i] = 'g';
    else left[word[i]] = (left[word[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (marks[i] === 'g') continue;
    if (left[guess[i]] > 0) { marks[i] = 'y'; left[guess[i]]--; }
  }
  return marks;
}
// Each player has a set number of guesses in a square (5; the admin's setting, dealt into the square): a player
// whose last guess misses loses the square to the other. (A square from before: no limit.)
export const wordleLimit = mini => (mini && Number.isInteger(mini.limit) ? mini.limit : 0);   // 0: no limit
export const wordleLeft = (mini, p) => (wordleLimit(mini) ? Math.max(0, wordleLimit(mini) - mini.guesses.filter(g => g.by === p).length) : Infinity);
export function create(type, rng) {
  return { type, word: WORDS5[randInt(rng, WORDS5.length)].toUpperCase(), guesses: [], limit: tuneLive(type).limit };
}
export function apply(mini, p, m, rng, idx) {
  const g = typeof m === 'string' ? m.toUpperCase() : '';
  if (!/^[A-Z]{5}$/.test(g)) return { ok: false, reason: 'bad' };
  if (!VALID5.has(g)) return { ok: false, reason: 'notword' };     // a non-word costs nothing
  if (wordleLeft(mini, p) <= 0) return { ok: false, reason: 'out' };
  mini.guesses.push({ by: p, word: g, marks: wordleMarks(g, mini.word) });
  if (g === mini.word) return { ok: true, outcome: 'win' };
  if (wordleLeft(mini, p) <= 0) return { ok: true, outcome: 'win', winner: other(p), note: 'out' };   // the last guess missed: the square goes to the other player
  return { ok: true, outcome: 'continue', note: 'guess' };
}
export function publicView(mini) {
  return { type: 'wordle', limit: wordleLimit(mini), guesses: mini.guesses.map(g => ({ by: g.by, word: g.word, marks: g.marks.slice() })) };
}

// ---- what is still possible, from public information ----
export function wordleCandidates(pm) {
  const out = [];
  for (const w of WORDS5) {
    const W = w.toUpperCase();
    if (pm.guesses.every(g => wordleMarks(g.word, W).join('') === g.marks.join(''))) out.push(W);
  }
  return out;
}
// A random legal move in a mini-game, for a player who ran out of time.
export let VALID5_LIST = null;
export function randomMove(mini, p, rng, from, empties) {
  if (!VALID5_LIST) VALID5_LIST = [...VALID5]; return from(VALID5_LIST);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.word = m.toUpperCase(); flash.left = wordleLimit(mini) ? wordleLeft(mini, p) : null; return;
}
export function secret(mini) {
  return { word: mini.word };
}
export function hide(m, k, st) {
  delete m.word; return;
}
export function flashMs(f, winLen, won) {
  return 1200;
}
// Super Chaos: both players may guess in the same round; both guesses go into the shared history. (Each player's
// guesses count their own: a last one that misses gives the square away, as ever.)
export function scMerge(m, c) {
  const n = c.base.guesses.length;
  m.guesses = c.base.guesses.concat(...c.played.map(p => c.forks[p].guesses.slice(n)));
}
