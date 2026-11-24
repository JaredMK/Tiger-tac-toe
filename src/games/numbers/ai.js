// Number Shuffle: the computer's play. The orders still possible are one run of the digits' orders in size order
// (rules.js nsRange). Hard guesses the middle one (halving what is left every guess), Normal any one of them, Easy
// too, but more often any order not yet guessed (its mistakes).
import { tune } from '../../core/tune.js';
import { nsPerms, nsRange } from './rules.js';

export function needs(pm, p) { const { left } = nsRange(pm, p); return Math.max(1, Math.log2(Math.max(1, left)) * 1.3 + 1); }
const LV = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const lvNum = (pm, key, level, D) => { const L = LV[level] ? level : 'normal', v = tune(pm)[key + LV[L]]; return v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : D[L]; };
// Each level's play is its settings (meta.js TUNE, Computer: Easy / Normal / Hard): how near the middle of what is left
// it guesses (`aiHalf<Level>`, %: 100 the middle, halving what is left every guess; 0 anywhere in it); its guesses of
// an order it could already rule out are its mistakes (`aiMiss<Level>`, `worse`).
export const HALF = { easy: 0, normal: 0, hard: 100 };
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', { lo, hi, left, all } = nsRange(pm, me), h = Math.max(0, Math.min(100, lvNum(pm, 'aiHalf', level, HALF))) / 100;
  if (!left) return { move: { o: all[Math.floor(rng() * all.length)].slice() }, q: 0 };
  const k = lo + Math.max(0, Math.min(hi - lo, Math.round((hi - lo) * (0.5 + (rng() - 0.5) * (1 - h)))));
  return { move: { o: all[k].slice() }, q: 1 / left };
}
// A weaker guess a person might make (the mistake rate, core/ai.js aiSlip): any order not yet guessed, its answers
// so far not heeded.
export function worse(pm, me, rng, ctx) {
  const { all } = nsRange(pm, me), tried = new Set(pm.g.filter(e => e.by === me).map(e => e.o.join(''))), free = all.filter(o => !tried.has(o.join('')));
  return free.length ? { o: free[Math.floor(rng() * free.length)].slice() } : null;
}
