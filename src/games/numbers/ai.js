// Number Shuffle: the computer's play. The orders still possible are one run of the digits' orders in size order
// (rules.js nsRange). Hard guesses the middle one (halving what is left every guess), Normal any one of them, Easy
// one of them seven times in ten and any order not yet guessed otherwise.
import { nsPerms, nsRange } from './rules.js';

export function needs(pm, p) { const { left } = nsRange(pm, p); return Math.max(1, Math.log2(Math.max(1, left)) * 1.3 + 1); }
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', { lo, hi, left, all } = nsRange(pm, me);
  if (!left) return { move: { o: all[Math.floor(rng() * all.length)].slice() }, q: 0 };
  let k;
  if (level === 'hard') k = lo + Math.floor((hi - lo) / 2);
  else if (level === 'easy' && rng() < 0.3) { const tried = new Set(pm.g.filter(e => e.by === me).map(e => e.o.join(''))), free = nsPerms(pm.d).map((o, i) => i).filter(i => !tried.has(all[i].join(''))); k = free[Math.floor(rng() * free.length)]; }
  else k = lo + Math.floor(rng() * left);
  return { move: { o: all[k].slice() }, q: 1 / left };
}
