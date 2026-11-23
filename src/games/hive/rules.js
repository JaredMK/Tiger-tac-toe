// Letter Hive: the rules (pure: no page, no clock; the server runs the same code).
// A hive of seven letters, one of them in the centre cell, from the game's own puzzles (puzzles.js, written by
// scripts/make-hive-puzzles.js from ENABLE: each puzzle its seven letters and its word list, which ships with the page).
// New letters every turn, hidden until the player taps Go! (`v: 2`, from 23 November 2026): a turn is two moves. Go!
// is the move HIVE_GO: a puzzle never yet dealt in this square is drawn by that move's rng (online the server's, at
// that moment: nothing of it exists before, so nobody can study the letters during the other player's turn), `pz` its
// number, `used` every puzzle this square has dealt, `go` the player whose burst is now owed on those letters; the turn
// is held to the square (`again`). The burst is the next move: the words entered in one burst of `secs` seconds played
// on the mover's phone, `{ w: [words...] }` in the order found (lower case, HIVE.cap at most), against the letters just
// drawn. A word is 4 letters or more, made of the hive's letters alone (a letter as often as wanted) and with the centre
// letter in it. Each word is checked here: one of this puzzle's list that nobody has found before in this square (the
// other player, an earlier burst on any letters, or earlier in this one) scores; anything else is dropped without a
// word (it scores nothing and the move is not refused for it). A word of 4 letters scores `four` (1), a longer one its
// length, and a word that uses all seven letters (a "full hive" word) `bonus` (7) more. Every word found stays found:
// `found` holds every word in the order found and `by` who found each (a letter a word); `last` is the last burst, with
// its letters (`pz`: public once played, the miniature's). The burst stops counting at the word that takes its finder
// to `target`: that player takes the square. An empty burst is a move too (no points). A timeout after Go! with no
// burst in: the burst goes in empty (timeoutClose: the turn passes, not a missed turn); before Go!: nothing (a missed
// turn). "Go again on success" on: a burst with a full-hive word in it plays another turn (Go! again: other letters).
// Should every puzzle ever be used up, Go! deals them round again (never the letters just played); should no puzzle have
// a word left to find (it cannot happen), the higher score takes the square and level scores draw.
// A square from before (no `v`: its puzzle dealt with it, on show from the start) plays on under these rules from its
// next move (hiveUp): its words and points kept, its puzzle counted as dealt, so its next Go! draws other letters.
// How many words a phone found in its time is the phone's word (the server cannot watch a burst), so the game is
// held out of Find Match (core/games.js FIND_MATCH_HOLD).
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
import { HIVE_PUZZLES } from './puzzles.js';

// cap: the words a burst may hold; max: a word's longest (the list's and the entry line's); the rest ms: someone
// else's burst as its result is laid out (pre: before the first word; beat: a word, shortened so that the words of a
// long burst fit in span; tail: the points' last count; hold: the result left on show); deal and pop: Go!'s letters
// coming into the hive (the centre letter first, then the six round it `deal` apart, each popping in over `pop`).
export const HIVE = { cap: 20, min: 4, max: 15, pre: 300, beat: 480, span: 2880, tail: 300, hold: 700, deal: 35, pop: 240 };
export const HIVE_GO = 'go';                                         // the move Go!: the letters drawn for the burst to come
export function hiveCfg(mini) {
  const t = tune(mini);
  return { target: t.target, secs: t.secs, four: t.four, bonus: t.bonus, rare: t.aiRare, ai: { easy: [t.aiMinEasy, t.aiMaxEasy, t.aiShortEasy, 0], normal: [t.aiMin, t.aiMax, t.aiShort, 0], hard: [t.aiMinHard, t.aiMaxHard, t.aiShortHard, t.aiFullHard] } };
}

// ---- the puzzles ----
const PZ = [];
const hiveNum = i => ((Math.floor(Number(i)) || 0) % HIVE_PUZZLES.length + HIVE_PUZZLES.length) % HIVE_PUZZLES.length;
// A puzzle, decoded on first use: { letters (seven, the centre first), centre, words (in order), set, full (the words
// that use all seven letters), plain (the everyday words: the ones the list marks with a capital) }.
export function hivePuzzle(i) {
  const k = hiveNum(i);
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
// A word of any puzzle's list that uses all seven of its letters (its puzzle's letters are seven different ones and
// the word is made of them alone, so seven different letters in it are all seven): the found lists span puzzles.
export const hiveFullWord = w => new Set(w).size >= 7;
// What a word of the list is worth.
export const hivePts = (c, pz, w) => (w.length <= HIVE.min ? c.four : w.length) + (hiveFull(pz.letters, w) ? c.bonus : 0);
// Why a typed word would not count (the view's reserved line), or '' when it would: the same checks the move gets.
export function hiveWhy(pz, found, w) {
  if (w.length < HIVE.min) return 'short';
  if (!w.includes(pz.centre)) return 'centre';
  if (!pz.set.has(w)) return 'word';
  return found.includes(w) ? 'found' : '';
}
// The square as these rules read it: the player whose burst is owed (Go! made, the burst not in yet), or null; the
// letters of the last burst played (public once played: the miniature's and a finished square's), or null before any.
export const hiveGo = mini => (mini && mini.v === 2 && (mini.go === 'X' || mini.go === 'O') ? mini.go : null);
export const hiveShown = mini => (mini && mini.last ? (mini.last.pz != null ? mini.last.pz : mini.pz != null ? mini.pz : null) : null);
// A square from before (v 1: its one puzzle dealt with it): these rules from its next move, its words and points kept,
// its puzzle counted as dealt.
export function hiveUp(mini) {
  if (mini.v === 2) return mini;
  mini.v = 2; mini.used = mini.pz != null ? [hiveNum(mini.pz)] : []; mini.go = null;
  if (mini.last && mini.last.pz == null && mini.pz != null) mini.last.pz = hiveNum(mini.pz);
  return mini;
}
// Go!'s letters: a puzzle this square has not dealt yet with a word in it still to find, at random by the move's rng;
// every one dealt here once: round again (never the letters just played); null: no puzzle has a word left to find.
function hiveDraw(mini, rng) {
  const found = new Set(mini.found), open = k => hivePuzzle(k).words.some(w => !found.has(w));
  for (const round of [false, true]) {
    const skip = new Set(round ? [mini.pz] : mini.used), pool = [];
    for (let k = 0; k < HIVE_PUZZLES.length; k++) if (!skip.has(k)) pool.push(k);
    while (pool.length) { const k = pool.splice(randInt(rng, pool.length), 1)[0]; if (open(k)) { if (round) mini.used = []; return k; } }
  }
  return null;
}
// Nothing left to find anywhere: the higher score takes the square, level scores draw.
function hiveOut(mini, p) {
  const o = p === 'X' ? 'O' : 'X';
  if (mini.pts.X === mini.pts.O) return { ok: true, outcome: 'draw', note: 'tie' };
  return mini.pts[p] > mini.pts[o] ? { ok: true, outcome: 'win', note: 'out' } : { ok: true, outcome: 'win', winner: o, note: 'out' };
}

export function create(type, rng) { needRng(rng); return { type, v: 2, pz: null, used: [], go: null, found: [], by: '', pts: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; }   // (no letters until a Go!)
export function apply(mini, p, m, rng, idx) {
  if (m === HIVE_GO) {                                              // Go!: the letters for this burst, drawn now
    if (hiveGo(mini) === p) return { ok: false, reason: 'bad' };    // (drawn already: their burst comes next)
    hiveUp(mini);
    const k = hiveDraw(mini, needRng(rng));
    if (k == null) return hiveOut(mini, p);                         // (no word left to find in any puzzle: it cannot happen, kept safe)
    mini.pz = k; mini.used.push(k); mini.go = p;
    return { ok: true, outcome: 'continue', note: 'go', again: true };   // the turn goes on: its burst on these letters
  }
  if (!m || typeof m !== 'object' || Array.isArray(m) || !Array.isArray(m.w) || m.w.length > HIVE.cap || m.w.some(w => typeof w !== 'string' || w.length > HIVE.max * 2)) return { ok: false, reason: 'bad' };
  if (hiveGo(mini) !== p) return { ok: false, reason: 'bad' };      // (a burst only on letters drawn for it: Go! first)
  const c = hiveCfg(mini), pz = hivePuzzle(mini.pz), from = mini.pts[p], got = [], pts = [];
  let full = 0;
  for (const w of m.w) {
    if (mini.pts[p] >= c.target) break;                             // (the burst stops counting at the word that reaches the target)
    if (!pz.set.has(w) || mini.found.includes(w)) continue;        // (not a word of these letters, or found before in this square: dropped)
    const v = hivePts(c, pz, w);
    mini.found.push(w); mini.by += p; mini.pts[p] += v; got.push(w); pts.push(v);
    if (hiveFull(pz.letters, w)) full++;
  }
  mini.n[p]++; mini.go = null;
  mini.last = { by: p, pz: mini.pz, w: got, pts, full, from, to: mini.pts[p] };
  if (mini.pts[p] >= c.target) return { ok: true, outcome: 'win', note: 'won' };
  if (full && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'full', again: true };
  return { ok: true, outcome: 'continue', note: full ? 'full' : got.length ? 'words' : 'none' };
}
// The turn's time run out: a burst owed on letters drawn goes in empty (the turn passes, not a missed turn); before Go!,
// nothing is played (a missed turn).
export function timeoutClose(mini, p) { return hiveGo(mini) === p ? { w: [] } : null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) {
  if (hiveGo(mini) !== p) return HIVE_GO;
  const r = needRng(rng), left = hivePuzzle(mini.pz).words.filter(w => !mini.found.includes(w)), w = [];
  for (let k = randInt(r, 4); k > 0 && left.length; k--) w.push(left.splice(randInt(r, left.length), 1)[0]);
  return { w };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  if (m === HIVE_GO) { flash.hv = { go: 1, by: p, pz: mini.pz }; return; }   // the letters drawn (the hive deals them in)
  flash.hv = JSON.parse(JSON.stringify(mini.last));
}
// Go!'s letters coming in: the centre letter's moment (k -1) and each of the six round it (k 0 to 5), and their end.
export const hiveDealAt = k => (k + 1) * HIVE.deal;
export const hiveDealMs = () => 6 * HIVE.deal + HIVE.pop;
// Someone else's burst, as its result is laid out: each word lands in its finder's list a beat after the one before.
export const hiveBeat = n => (n > 0 ? Math.min(HIVE.beat, HIVE.span / n) : 0);
export const hiveWordAt = (l, k) => HIVE.pre + k * hiveBeat(l.w.length);
export const hiveShowMs = l => HIVE.pre + l.w.length * hiveBeat(l.w.length) + HIVE.tail;
export function flashMs(f, winLen, won) { return f.hv ? (f.hv.go ? hiveDealMs() : hiveShowMs(f.hv) + HIVE.hold + (won ? 500 : 0)) : 0; }
