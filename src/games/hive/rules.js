// Letter Hive: the rules (pure: no page, no clock; the server runs the same code).
// A hive of seven letters, one of them in the centre cell, dealt from the game's own puzzles (puzzles.js, written by
// scripts/make-hive-puzzles.js from ENABLE: `pz` the puzzle's number; the letters and the centre are on show, and so
// is the whole word list, which ships with the page: nothing is hidden). A word is 4 letters or more, made of the hive's letters alone (a letter as often as wanted) and
// with the centre letter in it. A move is one burst of `secs` seconds played on the mover's phone: the words entered
// in it, `{ w: [words...] }` in the order found (lower case, HIVE.cap at most). Each word is checked here: one of
// this puzzle's list that nobody has found before (the other player, an earlier burst, or earlier in this one)
// scores; anything else is dropped without a word (it scores nothing and the move is not refused for it). A word of
// 4 letters scores `four` (1), a longer one its length, and a word that uses all seven letters (a "full hive" word)
// `bonus` (7) more. A word found is gone for both players: `found` holds every word in the order found and `by` who
// found each (a letter a word). The burst stops counting at the word that takes its finder to `target`: that player
// takes the square. An empty burst is a move too (no points). Should the list ever run out, the higher score takes
// the square and level scores draw. "Go again on success" on: a burst with a full-hive word in it plays another.
// How many words a phone found in its time is the phone's word (the server cannot watch a burst), so the game is
// held out of Find Match (core/games.js FIND_MATCH_HOLD).
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
import { HIVE_PUZZLES } from './puzzles.js';

// cap: the words a burst may hold; max: a word's longest (the list's and the entry line's); the rest ms: someone
// else's burst as its result is laid out (pre: before the first word; beat: a word, shortened so that the words of a
// long burst fit in span; tail: the points' last count; hold: the result left on show)
export const HIVE = { cap: 20, min: 4, max: 15, pre: 300, beat: 480, span: 2880, tail: 300, hold: 700 };
export function hiveCfg(mini) {
  const t = tune(mini);
  return { target: t.target, secs: t.secs, four: t.four, bonus: t.bonus, rare: t.aiRare, ai: { easy: [t.aiMinEasy, t.aiMaxEasy, t.aiShortEasy, 0], normal: [t.aiMin, t.aiMax, t.aiShort, 0], hard: [t.aiMinHard, t.aiMaxHard, t.aiShortHard, t.aiFullHard] } };
}

// ---- the puzzles ----
const PZ = [];
// A puzzle, decoded on first use: { letters (seven, the centre first), centre, words (in order), set, full (the words
// that use all seven letters), plain (the everyday words: the ones the list marks with a capital) }.
export function hivePuzzle(i) {
  const k = ((Math.floor(Number(i)) || 0) % HIVE_PUZZLES.length + HIVE_PUZZLES.length) % HIVE_PUZZLES.length;
  if (PZ[k]) return PZ[k];
  const s = HIVE_PUZZLES[k], cut = s.indexOf(':'), letters = s.slice(0, cut), words = [], plain = new Set();
  let prev = '', at = cut + 1;
  while (at < s.length) {
    const n = s.charCodeAt(at) - 48; at++;
    let j = at; while (j < s.length && (s.charCodeAt(j) < 48 || s.charCodeAt(j) > 57)) j++;
    const rest = s.slice(at, j);
    prev = prev.slice(0, n) + rest.toLowerCase(); at = j; words.push(prev);
    if (rest !== rest.toLowerCase()) plain.add(prev);
  }
  return (PZ[k] = { letters, centre: letters[0], words, set: new Set(words), full: words.filter(w => hiveFull(letters, w)), plain });
}
export const hiveCount = () => HIVE_PUZZLES.length;
export const hiveFull = (letters, w) => [...letters].every(ch => w.includes(ch));
// What a word of the list is worth.
export const hivePts = (c, pz, w) => (w.length <= HIVE.min ? c.four : w.length) + (hiveFull(pz.letters, w) ? c.bonus : 0);
// Why a typed word would not count (the view's reserved line), or '' when it would: the same checks the move gets.
export function hiveWhy(pz, found, w) {
  if (w.length < HIVE.min) return 'short';
  if (!w.includes(pz.centre)) return 'centre';
  if (!pz.set.has(w)) return 'word';
  return found.includes(w) ? 'found' : '';
}

export function create(type, rng) { return { type, pz: randInt(needRng(rng), HIVE_PUZZLES.length), found: [], by: '', pts: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; }
export function apply(mini, p, m, rng, idx) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || !Array.isArray(m.w) || m.w.length > HIVE.cap || m.w.some(w => typeof w !== 'string' || w.length > HIVE.max * 2)) return { ok: false, reason: 'bad' };
  const c = hiveCfg(mini), pz = hivePuzzle(mini.pz), o = p === 'X' ? 'O' : 'X', from = mini.pts[p], got = [], pts = [];
  let full = 0;
  for (const w of m.w) {
    if (mini.pts[p] >= c.target) break;                             // (the burst stops counting at the word that reaches the target)
    if (!pz.set.has(w) || mini.found.includes(w)) continue;        // (not a word of this hive, or found before: dropped)
    const v = hivePts(c, pz, w);
    mini.found.push(w); mini.by += p; mini.pts[p] += v; got.push(w); pts.push(v);
    if (hiveFull(pz.letters, w)) full++;
  }
  mini.n[p]++;
  mini.last = { by: p, w: got, pts, full, from, to: mini.pts[p] };
  if (mini.pts[p] >= c.target) return { ok: true, outcome: 'win', note: 'won' };
  if (mini.found.length >= pz.words.length) {                      // (every word found: it should never happen with these lists)
    if (mini.pts.X === mini.pts.O) return { ok: true, outcome: 'draw', note: 'tie' };
    return mini.pts[p] > mini.pts[o] ? { ok: true, outcome: 'win', note: 'out' } : { ok: true, outcome: 'win', winner: o, note: 'out' };
  }
  if (full && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'full', again: true };
  return { ok: true, outcome: 'continue', note: full ? 'full' : got.length ? 'words' : 'none' };
}
export function timeoutClose(mini, p) { return null; }              // (a burst under way lives on its phone alone: nothing is played for a player out of time)
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) {
  const r = needRng(rng), left = hivePuzzle(mini.pz).words.filter(w => !mini.found.includes(w)), w = [];
  for (let k = randInt(r, 4); k > 0 && left.length; k--) w.push(left.splice(randInt(r, left.length), 1)[0]);
  return { w };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.hv = JSON.parse(JSON.stringify(mini.last)); }
// Someone else's burst, as its result is laid out: each word lands in its finder's list a beat after the one before.
export const hiveBeat = n => (n > 0 ? Math.min(HIVE.beat, HIVE.span / n) : 0);
export const hiveWordAt = (l, k) => HIVE.pre + k * hiveBeat(l.w.length);
export const hiveShowMs = l => HIVE.pre + l.w.length * hiveBeat(l.w.length) + HIVE.tail;
export function flashMs(f, winLen, won) { return f.hv ? hiveShowMs(f.hv) + HIVE.hold + (won ? 500 : 0) : 0; }
