// Hangman: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';
import { WORDS_HANG } from './words.js';

export function create(type, rng) {
  const c = tuneLive(type), lo = Math.min(c.minLen, c.maxLen), hi = Math.max(c.minLen, c.maxLen);   // (the admin's settings: the word lengths dealt)
  const fit = WORDS_HANG.filter(w => w.length >= lo && w.length <= hi), list = fit.length ? fit : WORDS_HANG;
  return { type, word: list[randInt(rng, list.length)].toUpperCase(), letters: [] };
}
export function apply(mini, p, m, rng, idx) {
  const l = typeof m === 'string' ? m.toUpperCase() : '';
  if (!/^[A-Z]$/.test(l)) return { ok: false, reason: 'bad' };
  if (mini.letters.some(x => x.l === l)) return { ok: false, reason: 'taken' };
  const hit = mini.word.includes(l);
  mini.letters.push({ l, by: p, hit });
  if (!hit) return { ok: true, outcome: 'continue', note: 'miss' };
  const done = mini.word.split('').every(ch => mini.letters.some(x => x.l === ch));
  if (done) return { ok: true, outcome: 'win' };
  return { ok: true, outcome: 'continue', note: 'hit', again: true };
}
export function publicView(mini) {
  const hits = new Set(mini.letters.filter(x => x.hit).map(x => x.l));
  return { type: 'hangman', pattern: mini.word.split('').map(ch => (hits.has(ch) ? ch : null)), letters: mini.letters.map(x => ({ l: x.l, hit: x.hit })) };
}
export function hangmanCandidates(pm) {
  const wrong = pm.letters.filter(x => !x.hit).map(x => x.l), hits = pm.letters.filter(x => x.hit).map(x => x.l);
  const out = [];
  for (const w of WORDS_HANG) {
    const W = w.toUpperCase();
    if (W.length !== pm.pattern.length) continue;
    let ok = true;
    for (let i = 0; i < W.length && ok; i++) {
      const ch = W[i];
      ok = pm.pattern[i] ? pm.pattern[i] === ch : !hits.includes(ch) && !wrong.includes(ch);   // a found letter shows all its copies
    }
    if (ok) out.push(W);
  }
  return out;
}
export function randomMove(mini, p, rng, from, empties) {
  return from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !mini.letters.some(x => x.l === l)));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.letter = m.toUpperCase(); return;
}
export function secret(mini) {
  return { word: mini.word };
}
export function hide(m, k, st) {
  const hits = new Set(m.letters.filter(x => x.hit).map(x => x.l)); m.word = m.word.split('').map(ch => (hits.has(ch) ? ch : '_')).join(''); return;
}
export function flashMs(f, winLen, won) {
  return f && f.kind === 'again' ? 300 : 650;   // (a right letter: the next guess almost at once)
}
// Super Chaos: one shared word. Each player's move is the normal one (guessing on while right), seeing only
// the letters known before the round and their own. At the round's end every guess joins the word; a player
// whose own view completed it wins it, and a word completed only by the two together resets the square.
export function scMerge(m, c) {
  const n = c.base.letters.length, seen = new Set(c.base.letters.map(x => x.l));
  m.letters = c.base.letters.slice();
  for (const p of c.played) for (const x of c.forks[p].letters.slice(n)) if (!seen.has(x.l)) { seen.add(x.l); m.letters.push(x); }
  const done = m.word.split('').every(ch => seen.has(ch));
  if (done && !c.wins.X && !c.wins.O) return { reset: true, note: 'merged' };
}
