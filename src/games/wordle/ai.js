// Wordle: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { wordleCandidates, wordleMarks } from './rules.js';
import { WORDS5 } from './words.js';

export function needs(pm, p) {
  const n = wordleCandidates(pm).length; return n <= 1 ? 1 : Math.min((n + 1) / 2, 1 + Math.log(n) / Math.log(6));
}
export function best(pm, me, rng, style, ctx) {
  const cand = wordleCandidates(pm);
  if (!cand.length) return { move: WORDS5[randInt(rng, WORDS5.length)].toUpperCase(), q: 0, shared: true };
  if (cand.length === 1) return { move: cand[0], q: 1, shared: true };
  const miss = tune(pm).miss;
  if (miss && rng() * 100 < miss) { const w = WORDS5[randInt(rng, WORDS5.length)].toUpperCase(); return { move: w, q: cand.includes(w) ? 1 / cand.length : 0, shared: true }; }   // a slip: a word at random, clues ignored
  let best = cand[0];
  if (cand.length > 24) {                                      // many left: the guess with the most common letters
    const freq = {};
    for (const w of cand) for (const ch of new Set(w)) freq[ch] = (freq[ch] || 0) + 1;
    let top = -1;
    for (const w of cand) { let sc = 0; for (const ch of new Set(w)) sc += freq[ch]; if (sc > top) { top = sc; best = w; } }
  } else {                                                     // few left: the guess that splits them best
    let bestSplit = Infinity;
    for (const g of cand) {
      const groups = new Map();
      for (const w of cand) if (w !== g) { const k = wordleMarks(g, w).join(''); groups.set(k, (groups.get(k) || 0) + 1); }
      let split = 0;
      for (const n of groups.values()) split += n * n;
      if (split < bestSplit) { bestSplit = split; best = g; }
    }
  }
  return { move: best, q: 1 / cand.length, shared: true };
}
