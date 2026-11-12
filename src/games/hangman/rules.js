// Hangman: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { RACE_V, raceDealt, raceSide } from '../../core/race.js';
import { goAgain, tuneLive } from '../../core/tune.js';
import { WORDS_HANG } from './words.js';

// Race mode (core/race.js, `rv: 2`): each player their own word, of the same length and as near as the list allows in
// distinct letters (`mini.tg[p]`, hidden as a Shared square's word is: secret/hide); their own letters and revealed
// pattern (`mini.side[p]`: { letters: [{ l, by, hit }], pattern: [letter | null ...] }, open to both: a revealed letter is
// public, as in Shared). No wrong-letter limit (none in Shared either); a right letter still gives its guesser another go;
// the first to reveal their whole word takes the square.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
// Where p's letters live: the square itself (Shared), or p's own side (Race; null for a side this copy has not got).
export const hangPart = (mini, p) => (mini && mini.race ? raceSide(mini, p) : mini);
export const hangLen = mini => (mini && typeof mini.word === 'string' ? mini.word.length : Number.isInteger(mini && mini.len) ? mini.len : 0);
// The word p is after: the square's (Shared), or p's own (Race; undefined where this copy has not got it: the public state).
export const hangTarget = (mini, p) => (mini && mini.race ? (mini.tg ? mini.tg[p] : undefined) : mini && mini.word);
const distinct = w => new Set(w).size;
// p's letters, right and wrong, as this copy knows them (a race square's other side: none).
export const hangLetters = (mini, p) => { const part = hangPart(mini, p); return part && Array.isArray(part.letters) ? part.letters : []; };
export function create(type, rng, opts) {
  const c = tuneLive(type), lo = Math.min(c.minLen, c.maxLen), hi = Math.max(c.minLen, c.maxLen);   // (the admin's settings: the word lengths dealt)
  const fit = WORDS_HANG.filter(w => w.length >= lo && w.length <= hi), list = fit.length ? fit : WORDS_HANG;
  const word = list[randInt(rng, list.length)].toUpperCase();
  if (raceDealt(type, opts)) {                                   // a race: a second word as hard as the first: the same length, the nearest count of distinct letters, never the same word
    const same = [...new Set(WORDS_HANG.map(w => w.toUpperCase()))].filter(w => w.length === word.length && w !== word);
    const gap = w => Math.abs(distinct(w) - distinct(word)), near = same.length ? Math.min(...same.map(gap)) : 0, pool = same.filter(w => gap(w) === near);
    const two = pool.length ? pool[randInt(rng, pool.length)] : word;
    const first = rng() < 0.5, blank = () => ({ letters: [], pattern: new Array(word.length).fill(null) });   // (which word is whose: drawn)
    return { type, race: true, rv: RACE_V, len: word.length, side: { X: blank(), O: blank() }, tg: { X: first ? word : two, O: first ? two : word } };
  }
  return { type, word, letters: [] };
}
export function apply(mini, p, m, rng, idx, sc) {
  const part = hangPart(mini, p), word = hangTarget(mini, p);
  if (!part || typeof word !== 'string') return { ok: false, reason: 'bad' };
  const l = typeof m === 'string' ? m.toUpperCase() : '';
  if (!/^[A-Z]$/.test(l)) return { ok: false, reason: 'bad' };
  if (part.letters.some(x => x.l === l)) return { ok: false, reason: 'taken' };
  const hit = word.includes(l);
  part.letters.push({ l, by: p, hit });
  if (!hit) return { ok: true, outcome: 'continue', note: 'miss' };
  if (mini.race) word.split('').forEach((ch, i) => { if (ch === l) part.pattern[i] = l; });   // (a race: the letter goes into this side's own pattern alone)
  const done = word.split('').every(ch => part.letters.some(x => x.l === ch));
  if (done) return { ok: true, outcome: 'win' };
  return { ok: true, outcome: 'continue', note: 'hit', again: !!sc || goAgain(mini) };   // (a right letter keeps the turn only with "Go again on success" on; always in a Super Chaos round, scApply)
}
export function publicView(mini) {
  if (mini.race) return { type: 'hangman', race: true, len: hangLen(mini), side: JSON.parse(JSON.stringify(mini.side || {})) };   // (both parts are open, their revealed letters too; the words, mini.tg, never: core/minis.js publicMini)
  const hits = new Set(mini.letters.filter(x => x.hit).map(x => x.l));
  return { type: 'hangman', pattern: mini.word.split('').map(ch => (hits.has(ch) ? ch : null)), letters: mini.letters.map(x => ({ l: x.l, hit: x.hit })) };
}
// Race: p's progress as anyone may see it (all of it is open): letters tried, wrong ones, the blanks filled.
export function raceShape(mini, p) {
  const part = raceSide(mini, p);
  if (!part || !Array.isArray(part.pattern)) return {};
  return { n: part.letters.length, wrong: part.letters.filter(x => !x.hit).length, got: part.pattern.filter(Boolean).length };
}
// The words still possible, from what p knows: a race square's own part (pattern and letters), else the square's own.
export function hangmanCandidates(pm, p) {
  const part = pm.race ? (p ? raceSide(pm, p) : (pm.side ? Object.values(pm.side)[0] : null)) || { letters: [], pattern: new Array(hangLen(pm)).fill(null) } : pm;
  const wrong = part.letters.filter(x => !x.hit).map(x => x.l), hits = part.letters.filter(x => x.hit).map(x => x.l), pattern = part.pattern;
  const out = [];
  for (const w of WORDS_HANG) {
    const W = w.toUpperCase();
    if (W.length !== pattern.length) continue;
    let ok = true;
    for (let i = 0; i < W.length && ok; i++) {
      const ch = W[i];
      ok = pattern[i] ? pattern[i] === ch : !hits.includes(ch) && !wrong.includes(ch);   // a found letter shows all its copies
    }
    if (ok) out.push(W);
  }
  return out;
}
export function randomMove(mini, p, rng, from, empties) {
  const tried = hangLetters(mini, p);
  return from(ALPHABET.filter(l => !tried.some(x => x.l === l)));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.letter = m.toUpperCase(); return;                       // (a race too: the mover's letters are open to both)
}
export function secret(mini) {
  return mini.race ? { tg: mini.tg } : { word: mini.word };   // (a race: both words, top level, so a record's fullState puts them back whole)
}
export function hide(m, k, st) {
  if (m.race) { delete m.tg; if (typeof m.word === 'string') m.word = '_'.repeat(m.word.length); return; }   // (a race: the words go; each side's revealed letters stay in its open part)
  const hits = new Set(m.letters.filter(x => x.hit).map(x => x.l)); m.word = m.word.split('').map(ch => (hits.has(ch) ? ch : '_')).join(''); return;
}
export function flashMs(f, winLen, won) {
  return won ? 1300 : f && f.kind === 'again' ? 300 : 650;   // (a right letter: the next guess almost at once; the last one: the letter drops in and the word hops along its length, hangman/view.js HT)
}
// Super Chaos: one shared word. Each player's move is the normal one (guessing on while right), seeing only
// the letters known before the round and their own. At the round's end every guess joins the word; a player
// whose own view completed it wins it, and a word completed only by the two together resets the square.
// (A race square keeps each side's own: Super Chaos is off.)
export function scMerge(m, c) {
  if (m.race) { for (const p of c.played) m.side[p] = c.forks[p].side[p]; return; }
  const n = c.base.letters.length, seen = new Set(c.base.letters.map(x => x.l));
  m.letters = c.base.letters.slice();
  for (const p of c.played) for (const x of c.forks[p].letters.slice(n)) if (!seen.has(x.l)) { seen.add(x.l); m.letters.push(x); }
  const done = m.word.split('').every(ch => seen.has(ch));
  if (done && !c.wins.X && !c.wins.O) return { reset: true, note: 'merged' };
}

export function scApply(mini, p, m, rng, idx) { return apply(mini, p, m, rng, idx || (() => true), true); }   // Super Chaos: as a move, a right letter always guessing again (its rules: scExplainer)
