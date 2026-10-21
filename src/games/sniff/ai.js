// Sniff: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { SNIFF, SNIFF_MID, sniffCands, sniffDirs, sniffPick, sniffRes, sniffStep, sniffSteps } from './rules.js';

// Super Chaos: a dog each. The computer walks its own, from what both players' last few steps showed (each
// was shown in its replay), never onto the middle or a cell either dog has stood on.
const own = (pm, p) => (pm.dogs ? { dog: pm.dogs[p], trail: pm.trails.X.concat(pm.trails.O), not: [SNIFF_MID].concat(pm.paths.X, pm.paths.O) } : pm);

export function needs(pm, p) {   // the steps to the nearest cell it may be in (diagonals count one), and what is still unknown
  pm = own(pm, p);
  const c = sniffCands(pm), d = c.length ? Math.min(...c.map(x => sniffSteps(pm.dog, x))) : 1; return Math.max(1, d + Math.log2(Math.max(1, c.length)) * 0.8);
}
export function best(pm, me, rng, style, ctx) {
  const miss = tune(pm).miss || 0;                               // (the admin's mistake rate: a step any way)
  if (miss && rng() * 100 < miss) { const ds = sniffDirs(own(pm, me).dog); return { move: ds[randInt(rng, ds.length)], q: 0, shared: !pm.dogs }; }
  if (ctx && ctx.level === 'hard') { const h = sniffHard(pm, own(pm, me), ctx); if (h) return h; }
  const b = sniffPick(own(pm, me), rng); return { move: b.move, q: b.q, shared: !pm.dogs };   // (Super Chaos: its step walks its own dog only)
}

// ---- Hard: the race for the treasure ----
// Where the treasure may be, weighed: every cell the remembered steps allow and, in a match, the dog's start
// (it was dealt at least minStart steps from the treasure, two when the treasure is in the middle: so never
// nearer the start than that), each cell by the chance the dog was started where it was with the treasure
// there (one over the cells that far from it). The value of a set of cells for the side to move, the dog
// where it is: for each step, the chance that cell is it, else, by what the step would say of the rest
// (hotter, colder, same), what is left of the other side's chances from that group with the dog there.
// The steps weighed are the forward ones: onto a cell it may be in when next to one, else nearer to the
// nearest (a walk away would only hand the step to the other side, and a shared dog could circle for ever).
// Deeper as the budget allows (iterative deepening), a set out of reach worth the side's best next step
// plus a coin toss. Super Chaos (a dog each, the first onto it): the
// computer's own walk alone, each further step worth less.
const SH = { work: 4e4, depth: 10, disc: 0.75 };
const NN = SNIFF.n * SNIFF.n;
const FAR = {};                                                 // per minStart: for a treasure in each cell, the least steps its dog started away (most) and the cells that far (far)
function farTable(minStart) {
  if (FAR[minStart]) return FAR[minStart];
  const most = new Uint8Array(NN), far = new Float64Array(NN);
  for (let c = 0; c < NN; c++) {
    let top = 0;
    for (let x = 0; x < NN; x++) top = Math.max(top, sniffSteps(x, c));
    most[c] = Math.min(minStart, top);
    for (let x = 0; x < NN; x++) if (sniffSteps(x, c) >= most[c]) far[c]++;
  }
  return (FAR[minStart] = { most, far });
}
function sniffHard(pm, me, ctx) {
  const solo = !!pm.dogs, W = new Float64Array(NN).fill(1);
  let cands = sniffCands(me);
  if (!solo && Number.isInteger(pm.start)) {                     // a match: the start's say
    const T = farTable(Math.max(1, tune(pm).minStart || SNIFF.minStart));
    cands = cands.filter(c => c !== pm.start && sniffSteps(pm.start, c) >= T.most[c]);
    for (let c = 0; c < NN; c++) W[c] = 1 / T.far[c];
  }
  if (!cands.length) return null;
  const until = ctx.until, memo = new Map();
  let nodes = 0, work = 0, stop = false;
  const sum = S => { let t = 0; for (const c of S) t += W[c]; return t; };
  const leaf = (S, dog) => {                                     // out of reach: the best next step's chance, else a coin toss
    const tot = sum(S); let top = 0;
    for (const dir of sniffDirs(dog)) { const to = sniffStep(dog, dir); if (S.includes(to)) top = Math.max(top, W[to] / tot); }
    return top + (1 - top) * 0.5;
  };
  const ways = (S, dog) => {                                     // the steps weighed: onto a cell it may be in when next to one, else nearer to the nearest (never a walk away: a shared dog could circle for ever)
    let near = Infinity;
    for (const c of S) near = Math.min(near, sniffSteps(dog, c));
    const out = [];
    for (const dir of sniffDirs(dog)) {
      const to = sniffStep(dog, dir);
      if (near <= 1 ? S.includes(to) : S.some(c => sniffSteps(to, c) < near)) out.push(dir);
    }
    return out;
  };
  const V = (S, dog, d) => {                                     // the side to move's chance from the cells S, the dog at dog, d plies deep
    const m = S.length;
    if (!m) return 0.5;
    if (d <= 0) return leaf(S, dog);                             // (every set to a depth: the dog walks on)
    if (stop) return 0.5;
    const key = dog + ':' + S.join(','), hit = memo.get(key);
    if (hit && hit.d >= d) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * 8) > SH.work) { stop = true; return 0.5; }
    let top = 0;
    for (const dir of ways(S, dog)) { const v = step(S, dog, sniffStep(dog, dir), d - 1); if (stop) return 0.5; if (v > top) top = v; }
    memo.set(key, { d, v: top });
    return top;
  };
  const step = (S, dog, to, d) => {                              // a step's worth: onto it, or what it says of the rest
    const gr = { hot: [], cold: [], same: [] }, tot = sum(S);
    let v = 0;
    for (const c of S) { if (c === to) { v += W[c] / tot; continue; } gr[sniffRes(dog, to, c)].push(c); }
    for (const r in gr) {
      const g = gr[r]; if (!g.length) continue;
      const p = sum(g) / tot;
      v += p * (solo ? SH.disc * V(g, to, d) : 1 - V(g, to, d));
      if (stop) return 0;
    }
    return v;
  };
  const C = cands.slice().sort((a, b) => a - b), dirs = ways(C, me.dog);
  let move = dirs[0];
  for (let d = 1; d <= SH.depth && !stop; d++) {
    let best = -1, pick = null;
    for (const dir of dirs) { const v = step(C, me.dog, sniffStep(me.dog, dir), d - 1); if (stop) break; if (v > best) { best = v; pick = dir; } }
    if (stop) break;
    move = pick;
  }
  const to = sniffStep(me.dog, move);
  return { move, q: C.includes(to) ? W[to] / sum(C) : 0, shared: !solo };
}
