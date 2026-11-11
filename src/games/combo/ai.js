// Dice Combo: the computer's play (November 2026).
import { goAgain, tune } from '../../core/tune.js';
import { COMBO, comboCounts, comboHas, comboOpen } from './rules.js';

// ---- the exact reckoning (Hard; needs for every level) ----
// A player's race alone: V(S) the expected turns still needed with the combos S claimed, under the play that makes it
// least. A turn: the first roll, then up to rolls-1 rerolls, each keeping any of the dice; at any point after a roll a
// combo the dice make may be claimed (then V(S + it), 0 once the goal is reached); after the last roll with nothing to
// claim, the turn is spent for nothing (V(S) again). The dice as multisets (252 of five), the kept ones as multisets
// (462 of 0 to 5), each roll's outcomes with their chances; V(S) found by iterating its own fixed point (the chance
// of a turn for nothing is well under 1). With "Go again on success" on a claim keeps the turn: a claim then costs no
// new turn, so V(S) = E_turn with the claim's value V(S + it) - 1 (the next move's turn not counted again).
const K = COMBO.kinds, enc = c => c[1] + 6 * (c[2] + 6 * (c[3] + 6 * (c[4] + 6 * (c[5] + 6 * c[6]))));
const MS = [[], [], [], [], [], []];                                 // MS[n]: the multisets of n dice, as counts
for (let n = 0; n <= 5; n++) { const go = (face, c, left) => { if (face > 6) { if (!left) MS[n].push(c.slice()); return; } for (let k = 0; k <= left; k++) { c[face] = k; go(face + 1, c, left - k); } c[face] = 0; }; go(1, [0, 0, 0, 0, 0, 0, 0], n); }
const fact = [1, 1, 2, 6, 24, 120];
const ROLLP = MS.map((list, n) => list.map(c => { let w = fact[n]; for (let f = 1; f <= 6; f++) w /= fact[c[f]]; return w / 6 ** n; }));   // the chance n dice show those counts
const FIVE = MS[5], FIVE_KEY = FIVE.map(enc), FIVE_IX = new Map(FIVE_KEY.map((k, i) => [k, i]));
const QUAL = FIVE.map(c => K.map(k => comboHas(c, k)));                // what each five makes
const KEEP = [].concat(...MS);                                         // every kept multiset
const KEEP_IX = new Map(KEEP.map((c, i) => [enc(c), i]));
const OUT = KEEP.map(c => { const n = 5 - c.reduce((a, b) => a + b, 0); return MS[n].map((o, j) => { const s = c.map((v, f) => v + o[f]); return [FIVE_IX.get(enc(s)), ROLLP[n][j]]; }); });   // keep this, roll the rest: the fives and their chances
const SUBS = FIVE.map(c => { const out = [], go = (f, k) => { if (f > 6) { out.push(KEEP_IX.get(enc(k))); return; } for (let v = 0; v <= c[f]; v++) { k[f] = v; go(f + 1, k); } k[f] = 0; }; go(1, [0, 0, 0, 0, 0, 0, 0]); return out; });   // what may be kept of a five
const TABLES = new Map();
// The table for the combos S claimed (a bitmask over K): V, and the values best[j][five] and keep[j][kept] by rerolls left.
export function comboTable(goal, rolls, S, again) {
  const key = `${goal}:${rolls}:${S}:${again ? 1 : 0}`;
  let T = TABLES.get(key);
  if (T) return T;
  const n = bits(S), R = Math.max(1, rolls | 0);
  const claimVal = K.map((k, i) => { if (S & (1 << i)) return null; if (n + 1 >= goal) return 0; const v = comboTable(goal, rolls, S | (1 << i), again).V; return again ? v - 1 : v; });
  let V = 3, best = null, keep = null, pc = null, pk = null;
  for (let it = 0; it < 60; it++) {
    best = []; keep = []; pc = []; pk = [];
    for (let j = 0; j < R; j++) {                                    // j: rerolls left after this roll
      const b = new Float64Array(FIVE.length), pb = new Float64Array(FIVE.length);
      for (let i = 0; i < FIVE.length; i++) {
        let v = Infinity, p = 0;
        for (let x = 0; x < K.length; x++) if (QUAL[i][x] && claimVal[x] != null && claimVal[x] < v) { v = claimVal[x]; p = 1; }
        if (j > 0) for (const s of SUBS[i]) if (keep[j - 1][s] < v - 1e-12) { v = keep[j - 1][s]; p = pk[j - 1][s]; }
        if (v === Infinity) { v = V; p = 0; }                          // nothing to claim, no roll left: the turn for nothing
        b[i] = v; pb[i] = p;
      }
      best.push(b); pc.push(pb);
      const kp = new Float64Array(KEEP.length), kq = new Float64Array(KEEP.length);
      for (let s = 0; s < KEEP.length; s++) { let e = 0, q = 0; for (const [i, w] of OUT[s]) { e += w * b[i]; q += w * pb[i]; } kp[s] = e; kq[s] = q; }
      keep.push(kp); pk.push(kq);
    }
    const start = KEEP_IX.get(0), nv = 1 + keep[R - 1][start];       // the turn: the first roll (nothing kept), then the play
    if (Math.abs(nv - V) < 1e-9) { V = nv; break; }
    V = nv;
  }
  T = { V, best, keep, pc, pk, claim: pk[R - 1][KEEP_IX.get(0)], claimVal };
  TABLES.set(key, T);
  return T;
}
const bits = s => { let n = 0; while (s) { n += s & 1; s >>= 1; } return n; };
const maskOf = list => list.reduce((s, k) => s | (1 << K.indexOf(k)), 0);
// The dice's positions to hold for a kept multiset (any dice of the right faces).
function holdFor(dice, kept) {
  const want = kept.slice();
  return dice.map(d => (want[d] > 0 ? (want[d]--, 1) : 0));
}
const curOf = (pm, p) => (pm.cur && pm.cur.by === p ? pm.cur : null);
// Hard's choice at a moment of the move: the roll that starts it, then each step by the table.
export function comboHard(pm, me) {
  const t = tune(pm), R = Math.max(1, t.rolls | 0), cur = curOf(pm, me), T = comboTable(t.goal, R, maskOf(pm.claimed[me]), goAgain(pm));
  if (!cur || !cur.rolls) return { move: 'roll', q: T.claim };
  const i = FIVE_IX.get(enc(comboCounts(cur.dice))), j = R - cur.rolls;   // j: rerolls left
  let v = Infinity, move = null, q = 0;
  for (let x = 0; x < K.length; x++) if (QUAL[i][x] && T.claimVal[x] != null && T.claimVal[x] < v) { v = T.claimVal[x]; move = 'c:' + K[x]; q = 1; }
  if (j > 0) for (const s of SUBS[i]) if (KEEP[s].reduce((a, b) => a + b, 0) < 5 && T.keep[j - 1][s] < v - 1e-12) { v = T.keep[j - 1][s]; move = 'roll:' + holdFor(cur.dice, KEEP[s]).join(''); q = T.pk[j - 1][s]; }
  if (!move) move = 'auto';                                          // (none: the move is over anyway)
  return { move, q };
}
// ---- Normal and Easy: plain play ----
// Normal: a claim as soon as the dice make one worth claiming (the hardest of them; a bare three of a kind is kept on
// rolling while four or five alike are open and a roll is left); else it holds for the likeliest open combo: a run
// of 3+ for an open straight, two pairs for an open full house, else every die of its commonest face (the higher
// on a tie). Easy holds its commonest face and claims the first combo it sees. The admin's mistake rate: any hold.
const RANK = ['5k', 'ls', '4k', 'fh', 'ss', '3k'];
export function comboPlain(pm, me, rng, easy) {
  const t = tune(pm), R = Math.max(1, t.rolls | 0), cur = curOf(pm, me);
  if (!cur || !cur.rolls) return 'roll';
  const open = comboOpen(pm, me, cur.dice), left = R - cur.rolls, mine = pm.claimed[me];
  if (open.length) {
    if (easy) return 'c:' + open[0];
    const top = RANK.find(k => open.includes(k));
    const wait = top === '3k' && left > 0 && (!mine.includes('4k') || !mine.includes('5k'));
    if (!wait || !left) return 'c:' + top;
  }
  if (!left) return 'auto';
  const c = comboCounts(cur.dice);
  if (!easy && t.miss && rng() * 100 < t.miss) { const h = cur.dice.map(() => (rng() < 0.5 ? 1 : 0)); if (h.every(Boolean)) h[0] = 0; return 'roll:' + h.join(''); }
  let kept = [0, 0, 0, 0, 0, 0, 0], maxF = 1;
  for (let f = 2; f <= 6; f++) if (c[f] >= c[maxF]) maxF = f;
  const strOpen = !easy && (!mine.includes('ss') || !mine.includes('ls'));
  let run = null;
  if (strOpen) for (const [a, b] of [[2, 5], [1, 4], [3, 6], [2, 4], [3, 5], [1, 3], [4, 6]]) { let ok = true; for (let v = a; v <= b; v++) if (!c[v]) ok = false; if (ok && (!run || b - a > run[1] - run[0])) run = [a, b]; }
  const ofKindOpen = !mine.includes('3k') || !mine.includes('4k') || !mine.includes('5k');
  if (run && (run[1] - run[0] >= 3 || c[maxF] < 3 || !ofKindOpen)) for (let v = run[0]; v <= run[1]; v++) kept[v] = 1;
  else if (!easy && !mine.includes('fh') && c.filter(x => x >= 2).length >= 2) { for (let f = 1; f <= 6; f++) if (c[f] >= 2) kept[f] = Math.min(c[f], 3); }
  else if (c[maxF] >= 2 || !ofKindOpen) kept[maxF] = c[maxF];
  else kept[maxF] = 1;
  const h = holdFor(cur.dice, kept); if (h.every(Boolean)) h[h.indexOf(1)] = 0;
  return 'roll:' + h.join('');
}
// The turns p still needs (the exact race alone, from the combos claimed).
export function needs(pm, p) {
  const t = tune(pm);
  return Math.max(1, comboTable(t.goal, t.rolls, maskOf(pm.claimed[p]), goAgain(pm)).V);
}
export function best(pm, me, rng, style, ctx) {
  const lvl = ctx && ctx.level, t = tune(pm), left = t.goal - pm.claimed[me].length;
  if (lvl === 'hard') { const h = comboHard(pm, me); return { move: h.move, q: left <= 1 ? h.q : 0 }; }
  const move = comboPlain(pm, me, rng, lvl === 'easy');
  const T = comboTable(t.goal, t.rolls, maskOf(pm.claimed[me]), goAgain(pm));
  return { move, q: left <= 1 ? (move.startsWith('c:') ? 1 : T.claim) : 0 };
}
