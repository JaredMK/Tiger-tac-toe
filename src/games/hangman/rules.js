// Hangman: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { raceDealt, raceSide } from '../../core/race.js';
import { tuneLive } from '../../core/tune.js';
import { WORDS_HANG } from './words.js';

// Race mode (core/race.js): the same word for both, but each player's letters are their own (`mini.side[p]`:
// { letters: [{ l, hit }], pattern: [letter | null ...] (their own revealed letters, in place) }); the other side sees
// only which positions they have revealed, as filled blanks without the letters, and how many letters they got wrong
// (raceShape). A right letter still gives its guesser another go.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
// Where p's letters live: the square itself (Shared), or p's own side (Race; null for a side this copy has not got).
export const hangPart = (mini, p) => (mini && mini.race ? raceSide(mini, p) : mini);
export const hangLen = mini => (mini && typeof mini.word === 'string' ? mini.word.length : Number.isInteger(mini && mini.len) ? mini.len : 0);
// p's letters, right and wrong, as this copy knows them (a race square's other side: none).
export const hangLetters = (mini, p) => { const part = hangPart(mini, p); return part && Array.isArray(part.letters) ? part.letters : []; };
export function create(type, rng, opts) {
  const c = tuneLive(type), lo = Math.min(c.minLen, c.maxLen), hi = Math.max(c.minLen, c.maxLen);   // (the admin's settings: the word lengths dealt)
  const fit = WORDS_HANG.filter(w => w.length >= lo && w.length <= hi), list = fit.length ? fit : WORDS_HANG;
  const word = list[randInt(rng, list.length)].toUpperCase();
  if (raceDealt(type, opts)) { const blank = () => ({ letters: [], pattern: new Array(word.length).fill(null) }); return { type, word, race: true, side: { X: blank(), O: blank() } }; }
  return { type, word, letters: [] };
}
export function apply(mini, p, m, rng, idx) {
  const part = hangPart(mini, p);
  if (!part) return { ok: false, reason: 'bad' };
  const l = typeof m === 'string' ? m.toUpperCase() : '';
  if (!/^[A-Z]$/.test(l)) return { ok: false, reason: 'bad' };
  if (part.letters.some(x => x.l === l)) return { ok: false, reason: 'taken' };
  const hit = mini.word.includes(l);
  part.letters.push({ l, by: p, hit });
  if (!hit) return { ok: true, outcome: 'continue', note: 'miss' };
  if (mini.race) mini.word.split('').forEach((ch, i) => { if (ch === l) part.pattern[i] = l; });   // (a race: the letter goes into this side's own pattern alone)
  const done = mini.word.split('').every(ch => part.letters.some(x => x.l === ch));
  if (done) return { ok: true, outcome: 'win' };
  return { ok: true, outcome: 'continue', note: 'hit', again: true };
}
export function publicView(mini) {
  if (mini.race) return { type: 'hangman', race: true, len: hangLen(mini), side: mini.side };   // (core/minis.js publicMini keeps one side's own part alone and adds both shapes)
  const hits = new Set(mini.letters.filter(x => x.hit).map(x => x.l));
  return { type: 'hangman', pattern: mini.word.split('').map(ch => (hits.has(ch) ? ch : null)), letters: mini.letters.map(x => ({ l: x.l, hit: x.hit })) };
}
// Race: what anyone may see of p's progress: the positions they have revealed (true/false each, no letters), how many
// letters they have tried and how many were wrong.
export function raceShape(mini, p) {
  const part = raceSide(mini, p);
  if (!part) return {};
  return { n: part.letters.length, wrong: part.letters.filter(x => !x.hit).length, got: part.pattern.map(ch => !!ch) };
}
export function raceFlash(f, mini) {
  const part = raceSide(mini, f.by), last = part && part.letters.length ? part.letters[part.letters.length - 1] : null;
  return Object.assign({ by: f.by, hit: last ? !!last.hit : null, at: last && last.hit ? part.pattern.map((ch, i) => (ch === last.l ? i : -1)).filter(i => i >= 0) : [] }, raceShape(mini, f.by));   // (at: the blanks this letter filled)
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
  const l = m.toUpperCase();
  if (mini.race) {                                               // a race: a right letter rides the flash as `own` (the mover's phone alone keeps it: core/race.js FLASH_KEEP), so the header's "found" line, which reads the flash as made, names no letter to anyone
    const part = raceSide(mini, p), last = part && part.letters.length ? part.letters[part.letters.length - 1] : null;
    flash.own = l; flash.letter = last && last.hit ? '' : l; return;
  }
  flash.letter = l; return;
}
export function secret(mini) {
  return { word: mini.word };
}
export function hide(m, k, st) {
  if (m.race) { m.word = '_'.repeat(m.word.length); return; }   // (a race: every revealed letter is one side's own; the blanks alone are public)
  const hits = new Set(m.letters.filter(x => x.hit).map(x => x.l)); m.word = m.word.split('').map(ch => (hits.has(ch) ? ch : '_')).join(''); return;
}
export function flashMs(f, winLen, won) {
  return f && f.kind === 'again' ? 300 : 650;   // (a right letter: the next guess almost at once)
}
// Super Chaos: one shared word. Each player's move is the normal one (guessing on while right), seeing only
// the letters known before the round and their own. At the round's end every guess joins the word; a player
// whose own view completed it wins it, and a word completed only by the two together resets the square.
// (A race square keeps each side's own.)
export function scMerge(m, c) {
  if (m.race) { for (const p of c.played) m.side[p] = c.forks[p].side[p]; return; }
  const n = c.base.letters.length, seen = new Set(c.base.letters.map(x => x.l));
  m.letters = c.base.letters.slice();
  for (const p of c.played) for (const x of c.forks[p].letters.slice(n)) if (!seen.has(x.l)) { seen.add(x.l); m.letters.push(x); }
  const done = m.word.split('').every(ch => seen.has(ch));
  if (done && !c.wins.X && !c.wins.O) return { reset: true, note: 'merged' };
}
