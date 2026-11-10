// Codebreaker: the computer's play.
import { tune } from '../../core/tune.js';
import { MM, mmAll, mmBestGuess, mmCandidates, mmCode, mmFeedback } from './rules.js';

// Race mode (core/race.js, `rv: 2`): the computer cracks its own code from its own guesses (pm.side[me]); the other
// side's guesses are open too (their needs from their own candidates), and its guesses tell nothing of their code, so
// Hard plays for the fewest guesses to its code (mmHardRace), not the race for a shared one. No guess limit.
const fromRows = n => (n <= 1 ? 1 : Math.min((n + 1) / 2, 1 + Math.log(n) / Math.log(5)));
export function needs(pm, p) {
  if (pm.race && !(pm.side && pm.side[p])) {                       // (a race square from before the rework: the other side from their markers)
    const sh = (pm.shape && pm.shape[p]) || {}, rows = sh.rows || [], T = mmTable(tune(pm).colors);
    if (rows.some(r => r[0] === MM.pegs)) return 1;
    let n = T.n;
    for (const [s, h] of rows) n *= T.odds[s * 5 + h] || 1 / T.n;   // (each row's markers leave about that share of the codes)
    return fromRows(Math.max(1, n));
  }
  return fromRows(mmCandidates(pm, p).length);
}
export function best(pm, me, rng, style, ctx) {
  const race = !!pm.race, cand = mmCandidates(pm, me), t = tune(pm);
  if (!cand.length) return { move: mmCode(rng, t.colors), q: 0, shared: !race };
  if (cand.length === 1) return { move: cand[0].slice(), q: 1, shared: !race };
  if (t.miss && rng() * 100 < t.miss) { const g = mmCode(rng, t.colors), k = g.join(); return { move: g, q: cand.some(c => c.join() === k) ? 1 / cand.length : 0, shared: !race }; }   // a slip: a code at random, clues ignored
  if (ctx && ctx.level === 'hard') return race ? mmHardRace(pm, cand, t.colors, ctx) : mmHard(pm, cand, t.colors, ctx, rng);
  return { move: mmBestGuess(cand, t.colors), q: 1 / cand.length, shared: !race };
}

// ---- Hard: the race for the code ----
// The code is shared and every guess's feedback shows both players, so what counts is not how much a guess
// tells but who cracks the code first: the best split (Normal) hands the other side a nearly solved code.
// A position is the set of codes still possible (S); a guess is any code: one of S (it is the code 1 time in |S|)
// or not, and either way its markers split the rest into groups, the other side to move from the one that holds
// the code. A guess whose markers are the same for all of S tells nothing: a wait (the other side faces the same
// set). Waiting matters: where every guess would leave the other side better off (three codes, each guess naming
// the code for the other side: 1 in 3), waiting is worth more than guessing, so a wait is weighed at every
// position, for both sides, under the one rule that keeps the game finite: never a wait right after a wait (the
// computer keeps to it; the old Hard did too, and looked at waits and at guesses outside S only at the root with
// 12 codes or fewer). The worth of S for the side to move after a telling guess: the better of v and 1 - v, v
// the best telling guess's worth. Solved in a memo over S as bits, every code weighed at every position (the codes
// that split S the same way counted once), sets of MMH.exact or fewer to the end, bigger ones as deep as the work
// allows (iterative deepening). A set out of reach is worth the side to move a half when its count is even and
// (m + 1) / 2m when odd (leafV: what every solved set shows when the guesses to split it evenly exist: three codes
// are worth 2 in 3, five 3 in 5), so the telling guess to make leaves the other side even groups and no lone code.
// With more than MMH.bits codes left (the second guess, often): each candidate by the counts of the groups it
// leaves. The first guess is any (all the same).
// A wait is reported with `after` (the same position: no gain on the board).
const MMH = { exact: 12, work: 1e5, depth: 12, bits: 30, eps: 1e-9, margin: 0.004 };
const MMT = {};                                                 // per colour count: every code, feedback between any two (fb[i * n + j]) and each code's index
function mmTable(colors) {
  if (MMT[colors]) return MMT[colors];
  const all = mmAll(colors), n = all.length, fb = new Uint8Array(n * n), at = new Map();
  const odds = new Float64Array(25);                           // how often each marker result comes up between two codes (a race: the other side's codes left, estimated)
  for (let i = 0; i < n; i++) { at.set(all[i].join(''), i); for (let j = i; j < n; j++) { const f = mmFeedback(all[i], all[j]); fb[i * n + j] = fb[j * n + i] = f.solid * 5 + f.hollow; odds[f.solid * 5 + f.hollow] += i === j ? 1 : 2; } }
  for (let k = 0; k < 25; k++) odds[k] /= n * n;
  return (MMT[colors] = { all, n, fb, at, odds });
}
// A set out of reach, for the side to move (free to wait): an even count is a coin toss, an odd one worth the odd code
// ((m + 1) / 2m: what the solved sets show whenever the guesses to split them evenly exist, as here they do).
const leafV = m => (m <= 1 ? 1 : m & 1 ? (m + 1) / (2 * m) : 0.5);
const bits = x => { x = x - ((x >>> 1) & 0x55555555); x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return Math.imul((x + (x >>> 4)) & 0x0F0F0F0F, 0x01010101) >>> 24; };
// The solver for one set of codes C (MMH.bits or fewer; indices into the table), with the guesses G weighed at every
// position: { V(S, d), full, guesses(d): [[code, worth]] of every telling guess, waits: the codes of G that tell nothing }.
function mmSolver(C, G, T, budget) {
  const m0 = C.length, N = T.n, fb = T.fb, full = (1 << m0) - 1, memo = new Map();
  const own = [], gm = [], rep = [], seen = new Map(), waits = [];
  const at = new Map(C.map((c, i) => [c, i]));
  for (const g of G) {                                            // each guess: its own bit in C and the groups its markers make of the rest (the same split: once)
    const by = new Map(), mine = at.has(g) ? 1 << at.get(g) : 0;
    for (let i = 0; i < m0; i++) if (C[i] !== g) { const k = fb[g * N + C[i]]; by.set(k, (by.get(k) || 0) | (1 << i)); }
    const masks = [...by.values()];
    if (!mine && masks.length === 1) { waits.push(g); continue; }
    const key = mine + ':' + masks.slice().sort((x, y) => x - y).join(',');
    if (seen.has(key)) continue;
    seen.set(key, 1); own.push(mine); gm.push(masks); rep.push(g);
  }
  const ng = rep.length;
  const worth = (S, m, j, d) => {                                 // a guess's worth from S (-1: it tells nothing of S)
    const k = gm[j], mine = own[j] & S;
    let v = mine ? 1 / m : 0, rest = 0;
    for (let b = 0; b < k.length; b++) {
      const g = k[b] & S;
      if (!g) continue;
      if (g === S) return -1;
      rest = 1;
      v += bits(g) / m * (1 - V(g, d));
      if (budget.stop) return 0;
    }
    return mine || rest ? v : -1;
  };
  const V = (S, d) => {                                           // the side to move's chance from S, a telling guess just made (it may wait)
    const m = bits(S);
    if (m <= 1) return 1;
    if (m === 2) return 0.5;
    if (m === 3) return 2 / 3;                                   // (three codes: one guessed, the other two left together, or a wait: either way)
    if (m > MMH.exact && d <= 0) return leafV(m);
    if (budget.stop) return leafV(m);
    const hit = memo.get(S);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (budget.until ? (++budget.nodes & 15) === 0 && budget.until() <= 0 : (budget.work += ng * 3) > budget.cap) { budget.stop = true; return leafV(m); }
    // each guess's ceiling first (a group of two or more is worth the other side a half at least, a lone code all of it): the guesses from the highest ceiling down, until none could beat the best found
    const list = new Float64Array(ng);
    let nl = 0;
    for (let j = 0; j < ng; j++) {
      const k = gm[j], mine = own[j] & S;
      let u = mine ? 1 / m : 0, rest = 0;
      for (let b = 0; b < k.length; b++) { const g = k[b] & S; if (!g) continue; if (g === S) { rest = -1; break; } rest = 1; if (g & (g - 1)) { const c = bits(g); u += c / m * (c === 3 ? 1 / 3 : 0.5); } }
      if (rest < 0 || !(mine || rest)) continue;
      list[nl++] = Math.ceil(u * 1e6) * 512 + j;                 // (the ceiling, rounded up, and the guess in one number)
    }
    const sorted = list.subarray(0, nl).sort();
    let top = 0;
    for (let i = nl - 1; i >= 0; i--) {
      const e = sorted[i], j = e % 512, u = (e - j) / 512e6;
      if (u <= top + 1e-9) break;
      const v = worth(S, m, j, d - 1); if (budget.stop) return leafV(m);
      if (v > top) top = v;
    }
    if (1 - top > top) top = 1 - top;                            // (the wait)
    memo.set(S, { d, v: top, full: m <= MMH.exact });
    return top;
  };
  return { V, full, waits, guesses: d => { const out = []; for (let j = 0; j < ng; j++) { const v = worth(full, m0, j, d); if (budget.stop) return null; if (v >= 0) out.push([rep[j], v]); } return out; } };
}
function mmHard(pm, cand, colors, ctx, rng) {
  const T = mmTable(colors), N = T.n, fb = T.fb, all = T.all;
  const C = cand.map(c => T.at.get(c.join(''))).sort((a, b) => a - b), n = C.length;
  if (n === N) return { move: all[0].slice(), q: 1 / n, shared: true };
  const budget = { until: ctx.until, nodes: 0, work: 0, cap: MMH.work, stop: false };
  const last = pm.guesses[pm.guesses.length - 1], told = !last || mmCandidates({ type: pm.type, tune: pm.tune, guesses: pm.guesses.slice(0, -1) }).length > n;   // (the guess before told something: a wait is open)
  const every = Array.from({ length: N }, (_, i) => i);
  let vals = null, waits = [];
  if (n <= MMH.bits) {
    const sv = mmSolver(C, every, T, budget);
    waits = sv.waits;
    for (let d = 1; d <= MMH.depth && !budget.stop; d++) {
      const out = sv.guesses(d - 1);
      if (!out) break;
      vals = out; vals.exact = true;
      if (n <= MMH.exact) break;
    }
  } else {                                                        // too many for the bits (the second guess, often): each candidate by the groups it leaves, each group by its count (leafV)
    const cnt = new Int32Array(25);
    vals = [];
    for (const g of C) {
      cnt.fill(0);
      for (const c of C) if (c !== g) cnt[fb[g * N + c]]++;
      let v = 1 / n;
      for (let k = 0; k < 25; k++) if (cnt[k]) v += cnt[k] / n * (1 - (cnt[k] === 3 ? 2 / 3 : leafV(cnt[k])));
      vals.push([g, v]);
    }
  }
  if (!vals || !vals.length) return { move: all[C[0]].slice(), q: 1 / n, shared: true };   // (out of time before the first depth: a code that could be it)
  let top = -1;
  for (const x of vals) if (x[1] > top) top = x[1];
  if (told && last && vals.exact && top < 0.5 - MMH.margin) {     // a wait: a code that tells nothing of what is left (one not on the board yet where there is one, else the last guess again)
    const used = new Set(pm.guesses.map(g => g.code.join(''))), fresh = waits.filter(g => !used.has(all[g].join('')));
    return { move: fresh.length ? all[fresh[Math.floor(rng() * fresh.length)]].slice() : last.code.slice(), q: 0, after: pm, shared: true };
  }
  const ties = vals.filter(x => x[1] >= top - MMH.eps), inC = ties.filter(x => C.includes(x[0])), pool = inC.length ? inC : ties, move = pool[Math.floor(rng() * pool.length)][0];
  return { move: all[move].slice(), q: C.includes(move) ? 1 / n : 0, shared: true };
}

// ---- Hard, Race: the fewest guesses to the code ----
// The other side's guesses tell this one nothing and take nothing from it, so what counts is how many guesses the
// code takes. The expected guesses still to come from a set of candidates: for each guess (a candidate, or at the
// root with few left any code), one guess, then for each marker result the rest could give, the group it leaves
// (none for the code itself). Solved over the candidates, every set met kept in a memo, deeper as the budget
// allows (iterative deepening; a set of 10 or fewer to the end, a bigger one out of reach worth about its logarithm).
const MMR = { exact: 10, rootAll: 12, work: 1.2e5, depth: 12, margin: 0.02 };   // (the race's own search: as it was)
function mmHardRace(pm, cand, colors, ctx) {
  const T = mmTable(colors), N = T.n, fb = T.fb, all = T.all;
  const C = cand.map(c => T.at.get(c.join(''))).sort((a, b) => a - b), n = C.length;
  if (n === N) return { move: all[0].slice(), q: 1 / n, shared: false };
  const until = ctx.until, memo = new Map();
  let nodes = 0, work = 0, stop = false;
  const guess = m => (m <= 1 ? 1 : fromRows(m));                   // guesses about left with m codes open
  const V = (S, d) => {                                            // the guesses still to come from the set S, d plies deep
    const m = S.length;
    if (m <= 1) return 1;
    if (m === 2) return 1.5;
    if (m > MMR.exact && d <= 0) return guess(m);
    if (stop) return guess(m);
    const key = S.join(','), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * (m + 8)) > MMR.work) { stop = true; return guess(m); }
    let low = Infinity;
    for (const g of S) { const v = split(S, g, d - 1, true); if (stop) return guess(m); if (v < low) low = v; }
    memo.set(key, { d, v: low, full: m <= MMR.exact });
    return low;
  };
  const split = (S, g, d, inS) => {                                // a guess's expected guesses: one, then the groups each marker result leaves
    const m = S.length, gr = [];
    for (const c of S) if (c !== g) { const k = fb[g * N + c]; (gr[k] || (gr[k] = [])).push(c); }
    let v = 1, parts = 0;
    for (const grp of gr) if (grp) { parts++; v += grp.length / m * V(grp, d); if (stop) return guess(m); }
    return !inS && parts === 1 ? Infinity : v;                     // (a guess outside the set that tells nothing: never)
  };
  let move = C[0], top = Infinity, depth = 0;
  for (let d = 1; d <= MMR.depth && !stop; d++) {
    let best = Infinity, pick = -1;
    for (const g of C) { const v = split(C, g, d - 1, true); if (stop) break; if (v < best) { best = v; pick = g; } }
    if (stop || pick < 0) break;
    move = pick; top = best; depth = d;
    if (n <= MMR.exact) break;
  }
  if (n <= MMR.rootAll && depth) {                                 // every other code, at the depth reached: one that splits the set better
    stop = false; work = 0;
    for (let g = 0; g < N; g++) { if (C.includes(g)) continue; const v = split(C, g, depth - 1, false); if (stop) break; if (v < top - MMR.margin) { top = v; move = g; } }
  }
  return { move: all[move].slice(), q: C.includes(move) ? 1 / n : 0, shared: false };
}
