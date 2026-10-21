// Hangman: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { hangmanCandidates } from './rules.js';
import { WORDS_HANG } from './words.js';

export function needs(pm, p) {
  const n = hangmanCandidates(pm).length; const missing = pm.pattern.filter(ch => !ch).length; return n <= 1 ? 1 : 1 + Math.min(missing, 1 + Math.log(n)) / 2;
}
export function best(pm, me, rng, style, ctx) {
  const cand = hangmanCandidates(pm), tried = new Set(pm.letters.map(x => x.l));
  const miss = tune(pm).miss;
  if (miss && rng() * 100 < miss) {                            // a slip: any letter not tried yet
    const left = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !tried.has(l));
    if (left.length) return { move: left[randInt(rng, left.length)], q: 0, shared: true };
  }
  if (ctx && ctx.level === 'hard' && cand.length > 1 && tried.size < 26) return hangHard(pm, cand, tried, ctx);
  const count = {};
  for (const w of cand) for (const ch of new Set(w)) if (!tried.has(ch)) count[ch] = (count[ch] || 0) + 1;
  let best = null, top = 0;
  for (const ch of 'ETAOINSRHLDCUMFPGWYBVKXJQZ') { const n = count[ch] || 0; if (n > top) { top = n; best = ch; } }
  if (!best) for (const ch of 'ETAOINSRHLDCUMFPGWYBVKXJQZ') if (!tried.has(ch)) { best = ch; break; }
  return { move: best, q: cand.length === 1 ? 1 : cand.length ? 1 / cand.length : 0, shared: true };
}

// ---- Hard: the race for the word ----
// The word is shared and every letter found shows both players, so what counts is not the likeliest letter
// (Normal) but who reveals the last one. The value of a set of candidate words for the side to move, with
// the letters tried: for each letter, the words that hold it, grouped by where it sits (the side goes again
// from that group; a group of one word is a win, the rest of its letters sure), and the words that do not
// (the other side moves from those). Solved over the untried letters, every set met kept in a memo, deeper
// as the budget allows (iterative deepening; a set of 8 or fewer to the end, a bigger one out of reach
// worth 0.5). A letter in no candidate is a pass (the other side faces the same words): taken only when it
// beats the best letter clearly.
const HH = { exact: 8, work: 1.2e5, depth: 14, margin: 0.05 };
const HT = {};                                                  // per word length: its words, and where each letter sits in each (a bit per position)
function hangTable(len) {
  if (HT[len]) return HT[len];
  const words = [], at = new Map();
  for (const w of WORDS_HANG) if (w.length === len) { const W = w.toUpperCase(); if (!at.has(W)) { at.set(W, words.length); words.push(W); } }
  const pos = new Uint8Array(words.length * 26);
  words.forEach((w, i) => { for (let k = 0; k < len; k++) pos[i * 26 + w.charCodeAt(k) - 65] |= 1 << k; });
  return (HT[len] = { words, pos, at });
}
function hangHard(pm, cand, triedSet, ctx) {
  const T = hangTable(pm.pattern.length), pos = T.pos, words = T.words;
  const C = cand.map(w => T.at.get(w)).filter(i => i != null).sort((a, b) => a - b), n = C.length;
  let tried = 0;
  for (const l of triedSet) tried |= 1 << (l.charCodeAt(0) - 65);
  const until = ctx.until, memo = new Map();
  let nodes = 0, work = 0, stop = false;
  const V = (S, t, d) => {                                       // the side to move's chance from the words S with the letters t tried, d plies deep
    const m = S.length;
    if (m <= 1) return 1;
    if (m > HH.exact && d <= 0) return 0.5;
    if (stop) return 0.5;
    const key = t + ':' + S.join(','), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * 26) > HH.work) { stop = true; return 0.5; }
    let top = 0;
    for (let l = 0; l < 26; l++) { if (t & (1 << l)) continue; const v = letter(S, t, l, d - 1); if (stop) return 0.5; if (v > top) top = v; }
    memo.set(key, { d, v: top, full: m <= HH.exact });
    return top;
  };
  const letter = (S, t, l, d) => {                               // a letter's worth (-1: in no candidate)
    const m = S.length, gr = [], miss = [];
    for (const c of S) { const p = pos[c * 26 + l]; if (p) (gr[p] || (gr[p] = [])).push(c); else miss.push(c); }
    if (miss.length === m) return -1;
    const t2 = t | (1 << l);
    let v = 0;
    for (const grp of gr) if (grp) { v += grp.length / m * V(grp, t2, d); if (stop) return 0; }
    if (miss.length) v += miss.length / m * (1 - V(miss, t2, d));
    return v;
  };
  let move = -1, top = 0, stall = -1;
  for (let d = 1; d <= HH.depth && !stop; d++) {
    let best = -1, pick = -1;
    for (let l = 0; l < 26; l++) {
      if (tried & (1 << l)) continue;
      const v = letter(C, tried, l, d - 1); if (stop) break;
      if (v < 0) { if (stall < 0) stall = l; continue; }
      if (v > best) { best = v; pick = l; }
    }
    if (stop) break;
    move = pick; top = best;
    if (n <= HH.exact) break;
  }
  if (move < 0) { for (let l = 0; l < 26 && move < 0; l++) if (!(tried & (1 << l))) move = l; }
  if (stall >= 0 && 1 - top > top + HH.margin) move = stall;
  let q = 0;                                                     // the chance this turn ends it: a letter that leaves one word
  if (move !== stall) { const one = []; for (const c of C) if (pos[c * 26 + move]) (one[pos[c * 26 + move]] || (one[pos[c * 26 + move]] = [])).push(c); for (const g of one) if (g && g.length === 1) q += 1 / n; }
  return { move: String.fromCharCode(65 + move), q, shared: true };
}
