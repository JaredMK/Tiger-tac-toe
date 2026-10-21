// Mastermind: the computer's play.
import { tune } from '../../core/tune.js';
import { MM, mmAll, mmBestGuess, mmCandidates, mmCode, mmFeedback } from './rules.js';

export function needs(pm, p) {
  const n = mmCandidates(pm).length; return n <= 1 ? 1 : Math.min((n + 1) / 2, 1 + Math.log(n) / Math.log(5));
}
export function best(pm, me, rng, style, ctx) {
  const cand = mmCandidates(pm), t = tune(pm);
  if (!cand.length) return { move: mmCode(rng, t.colors), q: 0, shared: true };
  if (cand.length === 1) return { move: cand[0].slice(), q: 1, shared: true };
  if (t.miss && rng() * 100 < t.miss) { const g = mmCode(rng, t.colors), k = g.join(); return { move: g, q: cand.some(c => c.join() === k) ? 1 / cand.length : 0, shared: true }; }   // a slip: a code at random, clues ignored
  if (ctx && ctx.level === 'hard') return mmHard(pm, cand, t.colors, ctx);
  return { move: mmBestGuess(cand, t.colors), q: 1 / cand.length, shared: true };
}

// ---- Hard: the race for the code ----
// The code is shared and every guess's feedback shows both players, so what counts is not how much a guess
// tells but who cracks the code first: the best split (Normal) hands the other side a nearly solved code.
// The value of a set of candidates for the side to move: the chance its guess is the code (1/n), else, for
// each feedback the rest could give, what is left of the other side's chances from the group that feedback
// leaves. Solved over the candidates as guesses, every set met kept in a memo, deeper as the budget allows
// (iterative deepening; a set of 10 or fewer to the end, a bigger one out of reach worth 0.5). At the root
// with few left, every code is weighed too: one outside the candidates can leave the other side a set it
// cannot do much with (one that tells nothing is a pass: the other side faces the same set), taken when it
// beats the best candidate clearly, and never twice running (two sides passing would never end). The first
// guess is any (all the same).
const MMH = { exact: 10, rootAll: 12, work: 1.2e5, depth: 12, margin: 0.02 };
const MMT = {};                                                 // per colour count: every code, feedback between any two (fb[i * n + j]) and each code's index
function mmTable(colors) {
  if (MMT[colors]) return MMT[colors];
  const all = mmAll(colors), n = all.length, fb = new Uint8Array(n * n), at = new Map();
  for (let i = 0; i < n; i++) { at.set(all[i].join(''), i); for (let j = i; j < n; j++) { const f = mmFeedback(all[i], all[j]); fb[i * n + j] = fb[j * n + i] = f.solid * 5 + f.hollow; } }
  return (MMT[colors] = { all, n, fb, at });
}
function mmHard(pm, cand, colors, ctx) {
  const T = mmTable(colors), N = T.n, fb = T.fb, all = T.all;
  const C = cand.map(c => T.at.get(c.join(''))).sort((a, b) => a - b), n = C.length;
  if (n === N) return { move: all[0].slice(), q: 1 / n, shared: true };
  const until = ctx.until, memo = new Map();
  let nodes = 0, work = 0, stop = false;
  const V = (S, d) => {                                          // the side to move's chance from the set S, d plies deep
    const m = S.length;
    if (m <= 1) return 1;
    if (m > MMH.exact && d <= 0) return 0.5;
    if (stop) return 0.5;
    const key = S.join(','), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * (m + 8)) > MMH.work) { stop = true; return 0.5; }
    let top = 0;
    for (const g of S) { const v = split(S, g, d - 1, true); if (stop) return 0.5; if (v > top) top = v; }
    memo.set(key, { d, v: top, full: m <= MMH.exact });
    return top;
  };
  const split = (S, g, d, inS) => {                              // a guess's worth: the groups each feedback leaves the other side
    const m = S.length, gr = [];
    for (const c of S) if (c !== g) { const k = fb[g * N + c]; (gr[k] || (gr[k] = [])).push(c); }
    let v = inS ? 1 / m : 0, parts = 0;
    for (const grp of gr) if (grp) { parts++; v += grp.length / m * (1 - V(grp, d)); if (stop) return 0; }
    return !inS && parts === 1 && gr.find(x => x).length === m ? -1 : v;   // (-1: a guess that tells nothing)
  };
  let move = C[0], top = 0, depth = 0;
  for (let d = 1; d <= MMH.depth && !stop; d++) {                // the candidates as guesses, deeper and deeper
    let best = -1, pick = -1;
    for (const g of C) { const v = split(C, g, d - 1, true); if (stop) break; if (v > best) { best = v; pick = g; } }
    if (stop) break;
    move = pick; top = best; depth = d;
    if (n <= MMH.exact) break;
  }
  if (n <= MMH.rootAll && depth) {                               // every other code, at the depth reached
    stop = false; work = 0;
    const last = pm.guesses[pm.guesses.length - 1], told = !last || mmCandidates({ type: pm.type, tune: pm.tune, guesses: pm.guesses.slice(0, -1) }).length > n;
    for (let g = 0; g < N; g++) { if (C.includes(g)) continue; let v = split(C, g, depth - 1, false); if (stop) break; if (v < 0) { if (!told) continue; v = 1 - top; } if (v > top + MMH.margin) { top = v; move = g; } }
  }
  return { move: all[move].slice(), q: C.includes(move) ? 1 / n : 0, shared: true };
}
