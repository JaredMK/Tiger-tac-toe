// Number Target: the rules (pure: no page, no clock; the server runs the same code).
// One puzzle for both players at a time (`pz`: the numbers and the target, on show to both): make the target from
// the numbers with + - x and ÷, each number used once at most, every result a whole number above zero. A move is one
// attempt, `{ steps: [[i, op, j]...] }`: each step takes two numbers not yet used (by their place: the puzzle's own
// first, then each step's result in turn) and puts their result in play. The attempt's last result equal to the
// target takes the square: the first exact hit wins, near misses count for nothing. Every puzzle can be solved (it is
// dealt by working a target out from its own numbers, in two or three steps, never one a single step makes). After `attempts` attempts each without
// a hit (or twice that by one player alone) a new puzzle is dealt (the move's rng: the server's online).
// The attempt's seconds are kept on the mover's phone (the turn's own time is the server's).
import { needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const NUMS = { pre: 250, step: 480, hold: 750, maxSteps: 8, bigs: [10, 15, 20, 25, 50], ops: ['+', '-', '*', '/'] };
export function numbersCfg(mini) { const t = tune(mini); return { secs: t.secs, attempts: t.attempts, ai: { easy: t.aiPctEasy, normal: t.aiPct, hard: t.aiPctHard } }; }
export const numbersOp = (a, op, b) => (op === '+' ? a + b : op === '*' ? a * b : op === '-' ? (a > b ? a - b : null) : op === '/' ? (b > 1 && a % b === 0 ? a / b : null) : null);
const oneStep = (nums, target) => nums.some((a, i) => nums.some((b, j) => i !== j && NUMS.ops.some(op => numbersOp(a, op, b) === target)));
// A puzzle: two bigger numbers and the rest from 1 to 9, and a target worked out from three or four of them (never
// one that two of the numbers make in a single step).
export function numbersDeal(t, rng) {
  const r = needRng(rng), n = t.numbers, lo = Math.min(t.tmin, t.tmax), hi = Math.max(t.tmin, t.tmax);
  for (let tries = 0; tries < 40; tries++) {
    const nums = [], bigs = NUMS.bigs.slice();
    for (let k = 0; k < Math.min(2, n - 2); k++) nums.push(bigs.splice(Math.floor(r() * bigs.length), 1)[0]);
    while (nums.length < n) { const v = 1 + Math.floor(r() * 9); if (nums.filter(x => x === v).length < 2) nums.push(v); }
    for (let k = nums.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [nums[k], nums[j]] = [nums[j], nums[k]]; }
    for (let w = 0; w < 60; w++) {
      const order = nums.map((v, i) => i); for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
      const used = 3 + (r() < 0.5 ? 1 : 0); let acc = nums[order[0]], ok = true;
      for (let k = 1; k < Math.min(used, n) && ok; k++) { const b = nums[order[k]], opts = ['+', '*', '*'].concat(acc > b ? ['-'] : [], b > 1 && acc % b === 0 ? ['/'] : []), v = numbersOp(acc, opts[Math.floor(r() * opts.length)], b); if (v == null || v > 5000) ok = false; else acc = v; }
      if (ok && acc >= lo && acc <= hi && !nums.includes(acc) && !oneStep(nums, acc)) return { nums, target: acc };
    }
  }
  return { nums: [2, 3, 5, 7, 10, 25].slice(0, Math.max(3, n)), target: Math.max(lo, Math.min(hi, 31)) };   // (never reached with a sensible range: 2 x 3 + 25 = 31)
}
export function create(type, rng) { const t = tuneLive(type); return { type, pz: numbersDeal(t, rng), pn: 1, tries: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; }
// An attempt worked through: { ok, out: [[a, op, b, result]...], value (its last result), hit }.
export function numbersEval(pz, steps) {
  if (!Array.isArray(steps) || steps.length > Math.min(NUMS.maxSteps, pz.nums.length - 1)) return { ok: false };
  const work = pz.nums.slice(), used = new Set(), out = [];
  for (const s of steps) {
    if (!Array.isArray(s) || s.length !== 3 || !Number.isInteger(s[0]) || !Number.isInteger(s[2]) || s[0] === s[2] || s[0] < 0 || s[2] < 0 || s[0] >= work.length || s[2] >= work.length || used.has(s[0]) || used.has(s[2]) || !NUMS.ops.includes(s[1])) return { ok: false };
    const v = numbersOp(work[s[0]], s[1], work[s[2]]); if (v == null) return { ok: false };
    used.add(s[0]); used.add(s[2]); out.push([work[s[0]], s[1], work[s[2]], v]); work.push(v);
  }
  const value = out.length ? out[out.length - 1][3] : null;
  return { ok: true, out, value, hit: value === pz.target };
}
// A way to the target in at most `depth` steps, as an attempt's steps, or null (the computer's, the tests').
export function numbersSolve(pz, depth = 3) {
  const work = pz.nums.slice(), used = work.map(() => false), steps = [];
  const go = d => {
    for (let i = 0; i < work.length; i++) if (!used[i]) for (let j = 0; j < work.length; j++) if (j !== i && !used[j]) for (const op of NUMS.ops) {
      if ((op === '+' || op === '*') && j < i) continue;
      const v = numbersOp(work[i], op, work[j]); if (v == null) continue;
      used[i] = used[j] = true; work.push(v); used.push(false); steps.push([i, op, j]);
      if (v === pz.target || (d > 1 && go(d - 1))) return true;
      steps.pop(); used.pop(); work.pop(); used[i] = used[j] = false;
    }
    return false;
  };
  return go(depth) ? steps.slice() : null;
}
export function apply(mini, p, m, rng, idx) {
  const c = numbersCfg(mini), pz = mini.pz, ev = m && typeof m === 'object' ? numbersEval(pz, m.steps) : { ok: false };
  if (!ev.ok) return { ok: false, reason: 'bad' };
  mini.tries[p]++; mini.n[p]++;
  mini.last = { by: p, steps: ev.out, value: ev.value, hit: ev.hit, target: pz.target, nums: pz.nums.slice(), tries: mini.tries[p], fresh: false };
  if (ev.hit) return { ok: true, outcome: 'win', note: 'won' };
  if ((mini.tries.X >= c.attempts && mini.tries.O >= c.attempts) || mini.tries[p] >= c.attempts * 2) { mini.pz = numbersDeal(tune(mini), rng); mini.pn++; mini.tries = { X: 0, O: 0 }; mini.last.fresh = true; }
  return { ok: true, outcome: 'continue', note: mini.last.fresh ? 'fresh' : 'miss' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { const r = needRng(rng); return r() < 0.3 ? { steps: numbersSolve(mini.pz) || [] } : { steps: [[0, '+', 1]] }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.nt = JSON.parse(JSON.stringify(mini.last)); }
export const numbersShowMs = l => NUMS.pre + Math.max(1, l.steps.length) * NUMS.step;
export function flashMs(f, winLen, won) { return f.nt ? numbersShowMs(f.nt) + NUMS.hold + (won ? 500 : 0) : 0; }
