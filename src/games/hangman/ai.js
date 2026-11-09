// Hangman: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { hangLen, hangLetters, hangPart, hangmanCandidates } from './rules.js';
import { WORDS_HANG } from './words.js';

// Race mode (core/race.js, `rv: 2`): each player their own word: the computer reads its own letters and pattern alone
// (hangmanCandidates(pm, me): its own part), and the other side's own pattern, open to it, says how near they are (needs).
function raceEst(pm, p) {                                        // [words still possible to p, blanks they still have to fill]
  const part = hangPart(pm, p);
  if (part && Array.isArray(part.pattern)) return [hangmanCandidates(pm, p).length, part.pattern.filter(ch => !ch).length];
  return [WORDS_HANG.filter(w => w.length === hangLen(pm)).length, hangLen(pm)];   // (a part this copy has not got: a fresh word)
}
export function needs(pm, p) {
  const [n, missing] = pm.race ? raceEst(pm, p) : [hangmanCandidates(pm).length, pm.pattern.filter(ch => !ch).length];
  return n <= 1 ? 1 : 1 + Math.min(missing, 1 + Math.log(n)) / 2;
}
export function best(pm, me, rng, style, ctx) {
  const cand = hangmanCandidates(pm, me), tried = new Set(hangLetters(pm, me).map(x => x.l)), shared = !pm.race;   // (a race: its own letters alone, and a letter found tells the other side nothing)
  const miss = tune(pm).miss;
  if (miss && rng() * 100 < miss) {                            // a slip: any letter not tried yet
    const left = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !tried.has(l));
    if (left.length) return { move: left[randInt(rng, left.length)], q: 0, shared };
  }
  if (ctx && ctx.level === 'hard' && cand.length > 1 && tried.size < 26) return pm.race ? hangSolo(cand, tried, ctx) : hangHard(pm, cand, tried, ctx);
  const count = {};
  for (const w of cand) for (const ch of new Set(w)) if (!tried.has(ch)) count[ch] = (count[ch] || 0) + 1;
  let best = null, top = 0;
  for (const ch of 'ETAOINSRHLDCUMFPGWYBVKXJQZ') { const n = count[ch] || 0; if (n > top) { top = n; best = ch; } }
  if (!best) for (const ch of 'ETAOINSRHLDCUMFPGWYBVKXJQZ') if (!tried.has(ch)) { best = ch; break; }
  return { move: best, q: cand.length === 1 ? 1 : cand.length ? 1 / cand.length : 0, shared };
}

// ---- Hard, Race mode: the word alone ----
// Nothing the computer learns reaches the other side, and a right letter is a free go, so what a race costs is its
// misses: each one hands the turn over. The letter taken is the one with the fewest misses expected until the word is
// known (a word alone left: its letters, all hits), over the candidates: a letter splits them by where it sits, the words
// without it costing a miss; E(S) = min over letters of P(miss) (1 + E(misses)) + the sum of P(group) E(group). Solved
// in a memo, deeper as the budget allows (iterative deepening; past the depth a set of m words is worth HS.leaf log2 m,
// what the solved sets show), kept to ctx.until (a check every few sets), else to HS.work. Letters in every candidate at
// the same places, or in none, tell nothing and are skipped.
const HS = { leaf: 0.33, depth: 8, work: 3e5 };
function hangSolo(cand, triedSet, ctx) {
  const n = cand.length, until = ctx && ctx.until;
  const pos = cand.map(w => { const a = new Uint8Array(26); for (let i = 0; i < w.length; i++) a[w.charCodeAt(i) - 65] |= 1 << i; return a; });
  const memo = new Map();
  let work = 0, sets = 0, stop = false;
  const split = (S, l) => {                                      // [the words without l, the groups by where l sits] (null: l tells nothing)
    const gr = new Map(), miss = [];
    for (const c of S) { const p = pos[c][l]; if (!p) miss.push(c); else { let g = gr.get(p); if (!g) gr.set(p, (g = [])); g.push(c); } }
    return miss.length === S.length || (!miss.length && gr.size === 1) ? null : [miss, gr];
  };
  const worth = (S, sp, d) => {                                  // a letter's expected misses from S
    const [miss, gr] = sp, m = S.length;
    let v = miss.length ? miss.length / m * (1 + E(miss, d)) : 0;
    for (const g of gr.values()) v += g.length / m * E(g, d);
    return v;
  };
  const E = (S, d) => {
    const m = S.length;
    if (m <= 1) return 0;
    if (d <= 0 || stop) return HS.leaf * Math.log2(m);
    const key = S.join(','), hit = memo.get(key);
    if (hit && hit.d >= d) return hit.v;
    if (until ? (++sets & 15) === 0 && until() <= 0 : (work += m * 26) > HS.work) { stop = true; return HS.leaf * Math.log2(m); }
    let top = Infinity;
    for (let l = 0; l < 26; l++) { const sp = split(S, l); if (!sp) continue; const v = worth(S, sp, d - 1); if (v < top) top = v; }
    if (top === Infinity) top = 0;
    if (!stop) memo.set(key, { d, v: top });
    return top;
  };
  const C = cand.map((_, i) => i);
  let move = -1;
  for (let d = 1; d <= HS.depth && !stop; d++) {                 // deeper and deeper, the best letter of the last depth finished kept
    let best = Infinity, pick = -1, hits = -1;
    for (let l = 0; l < 26; l++) {
      if (triedSet.has(String.fromCharCode(65 + l))) continue;
      const sp = split(C, l); if (!sp) continue;
      const v = worth(C, sp, d - 1); if (stop) break;
      const h = n - sp[0].length;
      if (v < best - 1e-9 || (v < best + 1e-9 && h > hits)) { best = v; pick = l; hits = h; }
    }
    if (stop && move >= 0) break;
    move = pick;
  }
  let letter = move >= 0 ? String.fromCharCode(65 + move) : null;
  if (!letter) for (const l of 'ETAOINSRHLDCUMFPGWYBVKXJQZ') if (!triedSet.has(l)) { letter = l; break; }
  let q = 0;                                                     // the chance this turn ends it: a letter that leaves one word
  const one = new Map(); for (const w of cand) { let k = 0; for (let i = 0; i < w.length; i++) if (w[i] === letter) k |= 1 << i; if (k) one.set(k, (one.get(k) || 0) + 1); } for (const c of one.values()) if (c === 1) q += 1 / n;
  return { move: letter, q, shared: false };
}

// ---- Hard: the race for the word ----
// The word is shared and every letter found shows both players, so what counts is not the likeliest letter
// (Normal) but who reveals the last one. The value of a set of candidate words for the side to move, with
// the letters tried: for each letter, the words that hold it, grouped by where it sits (the side goes again
// from that group; a group of one word is a win, the rest of its letters sure), and the words that do not
// (the other side moves from those). Solved over the untried letters, every set met kept in a memo, deeper
// as the budget allows (iterative deepening; a set of 4 or fewer to the end). A bigger set out of reach is
// worth the side to move about 0.5 + 0.2 x its best letter's chance of a hit (what the solved sets show: a
// hit's extra go is a real edge). Never a letter in no candidate (a pass, and it never paid).
const HH = { exact: 4, work: 8e4, depth: 14, edge: 0.3 };
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
    if (m > HH.exact && d <= 0) return leaf(S, t);
    if (stop) return 0.5;
    const key = t + ':' + S.join(','), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * 26) > HH.work) { stop = true; return 0.5; }
    let top = 0;
    for (let l = 0; l < 26; l++) { if (t & (1 << l)) continue; const v = letter(S, t, l, d - 1); if (stop) return 0.5; if (v > top) top = v; }
    memo.set(key, { d, v: top, full: m <= HH.exact });
    return top;
  };
  const leaf = (S, t) => {                                       // out of reach: the best letter's chance of a hit, as an edge
    let top = 0;
    work += S.length * 26;
    for (let l = 0; l < 26; l++) { if (t & (1 << l)) continue; let c = 0; for (const w of S) if (pos[w * 26 + l]) c++; if (c > top) top = c; }
    return 0.5 + HH.edge * top / S.length;
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
  let move = -1;
  for (let d = 1; d <= HH.depth && !stop; d++) {
    let best = -1, pick = -1;
    for (let l = 0; l < 26; l++) {
      if (tried & (1 << l)) continue;
      const v = letter(C, tried, l, d - 1); if (stop) break;
      if (v > best) { best = v; pick = l; }
    }
    if (stop) break;
    move = pick;
    if (n <= HH.exact) break;
  }
  if (move < 0) { for (let l = 0; l < 26 && move < 0; l++) if (!(tried & (1 << l))) move = l; }
  let q = 0;                                                     // the chance this turn ends it: a letter that leaves one word
  const one = []; for (const c of C) if (pos[c * 26 + move]) (one[pos[c * 26 + move]] || (one[pos[c * 26 + move]] = [])).push(c); for (const g of one) if (g && g.length === 1) q += 1 / n;
  return { move: String.fromCharCode(65 + move), q, shared: true };
}
