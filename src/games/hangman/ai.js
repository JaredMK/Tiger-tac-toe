// Hangman: the computer's play.
import { hangmanCandidates } from './rules.js';

export function needs(pm, p) {
  const n = hangmanCandidates(pm).length; const missing = pm.pattern.filter(ch => !ch).length; return n <= 1 ? 1 : 1 + Math.min(missing, 1 + Math.log(n)) / 2;
}
export function best(pm, me, rng, style, ctx) {
  const cand = hangmanCandidates(pm), tried = new Set(pm.letters.map(x => x.l));
  const count = {};
  for (const w of cand) for (const ch of new Set(w)) if (!tried.has(ch)) count[ch] = (count[ch] || 0) + 1;
  let best = null, top = 0;
  for (const ch of 'ETAOINSRHLDCUMFPGWYBVKXJQZ') { const n = count[ch] || 0; if (n > top) { top = n; best = ch; } }
  if (!best) for (const ch of 'ETAOINSRHLDCUMFPGWYBVKXJQZ') if (!tried.has(ch)) { best = ch; break; }
  return { move: best, q: cand.length === 1 ? 1 : cand.length ? 1 / cand.length : 0, shared: true };
}
