// Five Letters: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { RACE_V, raceDealt, raceSide } from '../../core/race.js';
import { tuneLive } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { BAD5, VALID5, WORDS5 } from './words.js';

// Standard Five Letters feedback: g = right spot, y = in the word elsewhere, x = not in the word (duplicates handled).
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
// Race mode (core/race.js, `rv: 2`): each player their own word from the same answer list (`mini.tg[p]`, hidden as a
// Shared square's word is: secret/hide), their own guesses and colours (`mini.side[p]`: { guesses: [{ by, word, marks }] },
// open to both, letters and all), and no guess limit: the first to find their own word takes the square.
export const wordleLimit = mini => (mini && !mini.race && Number.isInteger(mini.limit) ? mini.limit : 0);   // 0: no limit (a race never has one)
// The word p is after: the square's (Shared), or p's own (Race; undefined where this copy has not got it: the public state).
export const wordleTarget = (mini, p) => (mini && mini.race ? (mini.tg ? mini.tg[p] : undefined) : mini && mini.word);
// Where p's guesses live: the square itself (Shared), or p's own side (Race; null for a side this copy has not got).
export const wordlePart = (mini, p) => (mini && mini.race ? raceSide(mini, p) : mini);
// p's own guesses: their rows of the shared list (Shared), or their part's (Race; none without the part).
export const wordleGuesses = (mini, p) => { const part = wordlePart(mini, p); return part && Array.isArray(part.guesses) ? (mini.race ? part.guesses : part.guesses.filter(g => g.by === p)) : []; };
export function wordleUsed(mini, p) {
  const part = wordlePart(mini, p);
  if (part && Array.isArray(part.guesses)) return wordleGuesses(mini, p).length;
  const sh = mini && mini.shape && mini.shape[p];              // (a v1 race square's other side: its shape alone)
  return sh && Number.isInteger(sh.n) ? sh.n : 0;
}
export const wordleLeft = (mini, p) => (wordleLimit(mini) ? Math.max(0, wordleLimit(mini) - wordleUsed(mini, p)) : Infinity);
export function create(type, rng, opts) {
  const draw = () => WORDS5[randInt(rng, WORDS5.length)].toUpperCase();
  if (raceDealt(type, opts)) {                                    // a race: two different words from the one answer list (as hard as each other), no limit
    const x = draw(); let o = draw();
    for (let k = 0; o === x && k < 50; k++) o = draw();
    if (o === x) o = WORDS5[(WORDS5.indexOf(x.toLowerCase()) + 1) % WORDS5.length].toUpperCase();
    return { type, race: true, rv: RACE_V, side: { X: { guesses: [] }, O: { guesses: [] } }, tg: { X: x, O: o } };
  }
  return { type, word: draw(), limit: tuneLive(type).limit, guesses: [] };
}
export function apply(mini, p, m, rng, idx) {
  const part = wordlePart(mini, p), word = wordleTarget(mini, p);
  if (!part || typeof word !== 'string') return { ok: false, reason: 'bad' };
  const g = typeof m === 'string' ? m.toUpperCase() : '';
  if (!/^[A-Z]{5}$/.test(g)) return { ok: false, reason: 'bad' };
  if (BAD5.has(g)) return { ok: false, reason: 'notallowed' };    // an offensive word: refused, no guess spent
  if (!VALID5.has(g)) return { ok: false, reason: 'notword' };     // a non-word costs nothing
  if (wordleLeft(mini, p) <= 0) return { ok: false, reason: 'out' };
  part.guesses.push({ by: p, word: g, marks: wordleMarks(g, word) });
  if (g === word) return { ok: true, outcome: 'win' };
  if (wordleLeft(mini, p) <= 0) return { ok: true, outcome: 'win', winner: other(p), note: 'out' };   // the last guess missed: the square goes to the other player
  return { ok: true, outcome: 'continue', note: 'guess' };
}
export function publicView(mini) {
  const v = { type: 'wordle', limit: wordleLimit(mini) };
  if (mini.race) return Object.assign(v, { race: true, side: JSON.parse(JSON.stringify(mini.side || {})) });   // (both parts are open; the words, mini.tg, never: core/minis.js publicMini)
  return Object.assign(v, { guesses: mini.guesses.map(g => ({ by: g.by, word: g.word, marks: g.marks.slice() })) });
}
// Race: p's progress as anyone may see it (all of it is open): guesses made, and their best row (most greens, then yellows).
export const wordleRank = marks => { let v = 0; for (const m of marks) v += m === 'g' ? 10 : m === 'y' ? 1 : 0; return v; };
export function wordleBest(mini, p) {
  let best = null;
  for (const g of wordleGuesses(mini, p)) if (!best || wordleRank(g.marks) > wordleRank(best.marks)) best = g;
  return best;
}
export function raceShape(mini, p) {
  const part = raceSide(mini, p), b = part ? wordleBest(mini, p) : null;
  return part ? { n: part.guesses.length, best: b ? b.marks.join('') : null } : {};
}

// ---- what is still possible, from public information ----
// pm: a square's view; p: whose guesses (a race square: their own part's; Shared: the whole list, everyone's).
export function wordleCandidates(pm, p) {
  const gs = pm.race ? (p ? wordleGuesses(pm, p) : (pm.side ? [].concat(...Object.values(pm.side).map(s => s.guesses || [])) : [])) : pm.guesses;
  const out = [];
  for (const w of WORDS5) {
    const W = w.toUpperCase();
    if (gs.every(g => wordleMarks(g.word, W).join('') === g.marks.join(''))) out.push(W);
  }
  return out;
}
// A random legal move in a mini-game, for a player who ran out of time.
export let VALID5_LIST = null;
export function randomMove(mini, p, rng, from, empties) {
  if (!VALID5_LIST) VALID5_LIST = [...VALID5].filter(w => !BAD5.has(w.toUpperCase())); return from(VALID5_LIST);   // (never a word the game refuses: the computer's careless move must be a move)
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.word = m.toUpperCase(); flash.left = wordleLimit(mini) ? wordleLeft(mini, p) : null; return;
}
export function secret(mini) {
  return mini.race ? { tg: mini.tg } : { word: mini.word };   // (a race: both words, top level, so a record's fullState puts them back whole)
}
export function hide(m, k, st) {
  delete m.word; delete m.tg; return;
}
export function flashMs(f, winLen, won) {
  return won && f && f.note !== 'out' ? 1900 : 1200;   // (the word found: the row turns, then hops along its length, wordle/view.js WT)
}
// Super Chaos: both players may guess in the same round; both guesses go into the shared history. (Each player's
// guesses count their own: a last one that misses gives the square away, as ever. A race square keeps each side's own.)
export function scMerge(m, c) {
  if (m.race) { for (const p of c.played) m.side[p] = c.forks[p].side[p]; return; }
  const n = c.base.guesses.length;
  m.guesses = c.base.guesses.concat(...c.played.map(p => c.forks[p].guesses.slice(n)));
}
