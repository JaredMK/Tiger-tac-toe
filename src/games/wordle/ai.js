// Wordle: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { wordleCandidates, wordleLeft, wordleMarks } from './rules.js';
import { WORDS5 } from './words.js';

// Never scripted: the opening is drawn from strong starting words, and later guesses from the best few,
// weighted toward the best (WVARY.weights, best first).
export const WVARY = { open: 'SLATE CRANE TRACE CRATE SLANT STARE ROAST RAISE ARISE IRATE LATER ALERT SAINT STALE SNARE SHARE CARET PARSE TRAIN LEAST TEARS STEAL SAUCE HEART PLATE GRATE AROSE SOARE CRONE SALET STORE STONE'.split(' '), weights: [0.5, 0.25, 0.15, 0.1] };
// one of the best few of a list sorted best first (a weighted draw)
export function wordleTop(sorted, rng) {
  const k = Math.min(sorted.length, WVARY.weights.length);
  let tot = 0; for (let i = 0; i < k; i++) tot += WVARY.weights[i];
  let r = rng() * tot;
  for (let i = 0; i < k; i++) { r -= WVARY.weights[i]; if (r < 0) return sorted[i]; }
  return sorted[0];
}
export function needs(pm, p) {
  const c = wordleCandidates(pm).length, n = c <= 1 ? 1 : Math.min((c + 1) / 2, 1 + Math.log(c) / Math.log(6)), left = wordleLeft(pm, p);
  return n > left + 0.001 ? Math.max(n, left + 2) : n;   // more than its guesses left: a long shot
}
// With guesses each (the square's limit), the last one is always a candidate (a word that could be it), and a miss
// with it hands the square over (qLose).
export function best(pm, me, rng, style, ctx) {
  const r = bestWord(pm, me, rng, style, ctx), left = wordleLeft(pm, me);
  if (left === 1) { const cand = wordleCandidates(pm); if (cand.length && !cand.includes(r.move)) r.move = cand[0]; r.q = cand.length ? 1 / cand.length : 0; r.qLose = 1 - r.q; }
  return r;
}
function bestWord(pm, me, rng, style, ctx) {
  const cand = wordleCandidates(pm);
  if (!cand.length) return { move: WORDS5[randInt(rng, WORDS5.length)].toUpperCase(), q: 0, shared: true };
  if (cand.length === 1) return { move: cand[0], q: 1, shared: true };
  const miss = tune(pm).miss;
  if (miss && rng() * 100 < miss) { const w = WORDS5[randInt(rng, WORDS5.length)].toUpperCase(); return { move: w, q: cand.includes(w) ? 1 / cand.length : 0, shared: true }; }   // a slip: a word at random, clues ignored
  if (!pm.guesses.length) { const w = WVARY.open[randInt(rng, WVARY.open.length)]; return { move: w, q: cand.includes(w) ? 1 / cand.length : 0, shared: true }; }   // the opening
  if (ctx && ctx.level === 'hard') return wordleHard(pm, cand, ctx, rng);
  let scored;
  if (cand.length > 24) {                                      // many left: the guesses with the most common letters
    const freq = {};
    for (const w of cand) for (const ch of new Set(w)) freq[ch] = (freq[ch] || 0) + 1;
    scored = cand.map(w => { let sc = 0; for (const ch of new Set(w)) sc += freq[ch]; return { w, v: sc }; });
  } else {                                                     // few left: the guesses that split them best
    scored = cand.map(g => {
      const groups = new Map();
      for (const w of cand) if (w !== g) { const k = wordleMarks(g, w).join(''); groups.set(k, (groups.get(k) || 0) + 1); }
      let split = 0;
      for (const n of groups.values()) split += n * n;
      return { w: g, v: -split };
    });
  }
  scored.sort((a, b) => b.v - a.v);
  return { move: wordleTop(scored, rng).w, q: 1 / cand.length, shared: true };
}

// ---- Hard: the race for the word ----
// The word is shared and every guess's colours show both players, so what counts is not how much a guess
// tells but who finds the word first. The value of a set of candidates for the side to move: the chance its
// guess is the word (1/n), else, for each colouring the rest could give, what is left of the other side's
// chances from the group it leaves. Solved over the candidates as guesses (their colourings tabled once per
// move), every set met kept in a memo, deeper as the budget allows (iterative deepening; a set of 10 or fewer
// to the end, a bigger one out of reach worth 0.5). At the root with few left every answer word is weighed
// too: one outside the candidates can leave the other side a set it cannot do much with (one that tells
// nothing is a pass: the other side faces the same set), taken when it beats the best candidate clearly, and
// never twice running (two sides passing would never end). With too many left to table (over 80), the candidate with the fewest common letters: the word that gives
// least away.
const WH = { exact: 10, rootAll: 12, table: 80, work: 1.2e5, depth: 12, margin: 0.02, near: 0.04 };   // near: how far below the best a guess may be and still be drawn
const LEFT = new Uint8Array(26);
function markCode(g, w) {                                        // wordleMarks as a number, base 3 (x 0, y 1, g 2), without the arrays
  LEFT.fill(0);
  for (let i = 0; i < 5; i++) if (g.charCodeAt(i) !== w.charCodeAt(i)) LEFT[w.charCodeAt(i) - 65]++;
  let k = 0;
  for (let i = 0; i < 5; i++) { const c = g.charCodeAt(i); k = k * 3 + (c === w.charCodeAt(i) ? 2 : LEFT[c - 65] > 0 ? (LEFT[c - 65]--, 1) : 0); }
  return k;
}
function wordleHard(pm, cand, ctx, rng) {
  const n = cand.length;
  if (n > WH.table) {
    const freq = {};
    for (const w of cand) for (const ch of new Set(w)) freq[ch] = (freq[ch] || 0) + 1;
    const scored = cand.map(w => { let sc = 0; for (const ch of new Set(w)) sc += freq[ch]; return { w, v: -sc }; }).sort((a, b) => b.v - a.v);
    return { move: wordleTop(scored, rng).w, q: 1 / n, shared: true };
  }
  const mk = new Uint8Array(n * n);                              // the colouring of candidate j guessed as i
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) mk[i * n + j] = i === j ? 242 : markCode(cand[i], cand[j]);
  const until = ctx.until, memo = new Map();
  let nodes = 0, work = 0, stop = false;
  const V = (S, d) => {                                          // the side to move's chance from the set S (indices), d plies deep
    const m = S.length;
    if (m <= 1) return 1;
    if (m > WH.exact && d <= 0) return 0.5;
    if (stop) return 0.5;
    const key = S.join(','), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * (m + 8)) > WH.work) { stop = true; return 0.5; }
    let top = 0;
    for (const g of S) { const v = split(S, c => mk[g * n + c], d - 1, true); if (stop) return 0.5; if (v > top) top = v; }
    memo.set(key, { d, v: top, full: m <= WH.exact });
    return top;
  };
  const split = (S, markOf, d, inS) => {                         // a guess's worth: the groups each colouring leaves the other side
    const m = S.length, gr = [];
    let own = 0;
    for (const c of S) { const k = markOf(c); if (k === 242) { own++; continue; } (gr[k] || (gr[k] = [])).push(c); }
    let v = own / m, parts = 0;
    for (const grp of gr) if (grp) { parts++; v += grp.length / m * (1 - V(grp, d)); if (stop) return 0; }
    return !inS && parts === 1 && !own && gr.find(x => x).length === m ? -1 : v;   // (-1: a guess that tells nothing)
  };
  const C = cand.map((_, i) => i);
  let move = cand[0], top = 0, depth = 0;
  for (let d = 1; d <= WH.depth && !stop; d++) {                 // the candidates as guesses, deeper and deeper
    const vals = [];
    for (const g of C) { const v = split(C, c => mk[g * n + c], d - 1, true); if (stop) break; vals.push({ w: cand[g], v }); }
    if (stop) break;
    vals.sort((a, b) => b.v - a.v);
    top = vals[0].v; move = wordleTop(vals.filter(x => x.v >= top - WH.near), rng).w; depth = d;   // one of the best few (near the top)
    if (n <= WH.exact) break;
  }
  if (n <= WH.rootAll && depth) {                                // every other answer word, at the depth reached
    stop = false; work = 0;
    const told = !pm.guesses.length || wordleCandidates({ guesses: pm.guesses.slice(0, -1) }).length > n;
    for (const w of WORDS5) { const W = w.toUpperCase(); if (cand.includes(W)) continue; let v = split(C, c => markCode(W, cand[c]), depth - 1, false); if (stop) break; if (v < 0) { if (!told) continue; v = 1 - top; } if (v > top + WH.margin) { top = v; move = W; } }
  }
  return { move, q: cand.includes(move) ? 1 / n : 0, shared: true };
}
