'use strict';
// Peg Drop: the square's exact value, and how far the computer's Hard play is from it. Slow (a tenth of a second a
// square), so it is a check, not what the game plays by:   node tests/sim/plinko-table.js [squares]
// W[a][b][used][peg]: the chance the player to move wins the square, a points to the other's b, the slots in `used`
// locked, the bonus peg at `peg`, both dropping their best from there. A drop from an open slot scores x (and may hit
// the peg) with the chances of its 64 ways down; the slot locks (all seven used: they all open); the other side moves
// from (b, a + x), the peg where it was or, hit, any of the others (their mean: a sum kept for every (a, b, used)).
// Every drop scores, so a + b only grows: one sweep from the highest sums down (590,000 positions to 12).
// It prints, over positions met in play (half the drops the best, half any open slot): what each way of choosing
// gives up against the table, in chances of the square a drop (November 2026: the old Hard, plinkoHard, 0.05%; the
// look-ahead Hard plays now, plinkoDeep at depth 3, 0.014%; depth 4, 0.011%).
const E = require('../engine.js');
const A = require('../../src/games/plinko/ai.js');
const { PLINKO, plinkoBonusPts, plinkoPegs, plinkoTouches, plinkoWays, plinkoOpen } = require('../../src/games/plinko/rules.js');

const PEGS = plinkoPegs().filter(q => q.r >= 2), NP = PEGS.length, NS = PLINKO.slots, NU = 1 << NS, FULL = NU - 1;
const pegIx = b => PEGS.findIndex(q => q.x === b.x && q.r === b.r);
const WAYS = Array.from({ length: NS }, (_, k) => plinkoWays(k).map(w => ({ bin: w.bin, p: w.p, pegs: plinkoTouches(k, w.path).map((x, r) => pegIx({ x, r: r + 1 })) })));
function plinkoTable(pm) {
  const T = pm.target, bonus = plinkoBonusPts(pm);
  const DS = new Int32Array(NP * NS + 1), PTS = [], PR = [], HIT = [];   // each slot's drops by peg, flattened: points, chance, whether the peg was hit
  for (let g = 0; g < NP; g++) for (let k = 0; k < NS; k++) {
    const m = new Map();
    for (const w of WAYS[k]) { const hit = w.pegs.includes(g) ? 1 : 0, id = (pm.vals[w.bin] + (hit ? bonus : 0)) * 2 + hit; m.set(id, (m.get(id) || 0) + w.p); }
    for (const [id, p] of m) { PTS.push(id >> 1); PR.push(p); HIT.push(id & 1); }
    DS[g * NS + k + 1] = PTS.length;
  }
  const pts = Int32Array.from(PTS), pr = Float64Array.from(PR), hits = Uint8Array.from(HIT);
  const SZ = NU * NP, W = new Float32Array(T * T * SZ), SUM = new Float32Array(T * T * NU), inv = 1 / (NP - 1);
  const slotVal = (a, b, used, g, k) => {                       // the mover's chance, dropping from slot k
    let u2 = used | (1 << k); if (u2 === FULL) u2 = 0;
    const bT = b * T, off = u2 * NP + g, end = DS[g * NS + k + 1];
    let v = 0;
    for (let j = DS[g * NS + k]; j < end; j++) {
      const a2 = a + pts[j];
      if (a2 >= T) { v += pr[j]; continue; }
      const at = bT + a2, w = W[at * SZ + off];                   // the other side to move: b to my a2
      v += pr[j] * (1 - (hits[j] ? (SUM[at * NU + u2] - w) * inv : w));
    }
    return v;
  };
  for (let s = 2 * T - 2; s >= 0; s--) for (let a = Math.min(T - 1, s); a >= 0 && s - a < T; a--) {
    const b = s - a, base = a * T + b;
    for (let used = 0; used < FULL; used++) {
      let sum = 0;
      for (let g = 0; g < NP; g++) {
        let top = 0;
        for (let k = 0; k < NS; k++) { if (used & (1 << k)) continue; const v = slotVal(a, b, used, g, k); if (v > top) top = v; }
        W[base * SZ + used * NP + g] = top; sum += top;
      }
      SUM[base * NU + used] = sum;
    }
  }
  return { T, slotVal };
}
// Every open slot's exact chance for `me` in the position on show.
function exact(table, pm, me) {
  const a = pm.pts[me], b = pm.pts[me === 'X' ? 'O' : 'X'], g = pegIx(pm.bonus);
  let used = 0; pm.used.forEach((u, k) => { if (u) used |= 1 << k; });
  const vals = new Array(NS).fill(null);
  for (const k of plinkoOpen(pm)) vals[k] = table.slotVal(a, b, used, g, k);
  return vals;
}
const squares = Number(process.argv[2]) || 25, rng = E.makeRng('plinko-table');
const ways = { 'plinkoHard (the old Hard)': (pm, me) => A.plinkoHard(pm, me), 'plinkoDeep, 1 drop': (pm, me) => A.plinkoDeep(pm, me, 1).move, '2 drops': (pm, me) => A.plinkoDeep(pm, me, 2).move, '3 drops (Hard)': (pm, me) => A.plinkoDeep(pm, me, 3).move, '4 drops': (pm, me) => A.plinkoDeep(pm, me, 4).move };
const lost = {}, worse = {};
let n = 0;
for (let s = 0; s < squares; s++) {
  const first = E.newMini('plinko', rng), table = plinkoTable(E.publicMini(first));
  for (let rep = 0; rep < 6; rep++) {
    const m = JSON.parse(JSON.stringify(first));
    let p = rep % 2 ? 'O' : 'X';
    for (let k = 0; k < 60; k++) {
      const pm = E.publicMini(m, p), vals = exact(table, pm, p), top = Math.max(...vals.filter(v => v != null));
      n++;
      for (const [name, f] of Object.entries(ways)) { const d = top - vals[f(pm, p)]; lost[name] = (lost[name] || 0) + d; if (d > 1e-6) worse[name] = (worse[name] || 0) + 1; }
      const open = plinkoOpen(pm), move = rng() < 0.5 ? vals.indexOf(top) : open[Math.floor(rng() * open.length)];
      if (E.applyMove(m, p, move, rng).outcome === 'win') break;
      p = p === 'X' ? 'O' : 'X';
    }
  }
}
console.log(`${n} positions on ${squares} squares`);
for (const name of Object.keys(ways)) console.log(`${name.padEnd(28)} gives up ${(100 * lost[name] / n).toFixed(3)}% of a square a drop; not the best slot in ${(100 * (worse[name] || 0) / n).toFixed(1)}% of positions`);
