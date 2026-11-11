// Ship, Captain & Crew: the computer's play. The only choice is once all three are in: keep the cargo, or roll it
// again with the rolls left (the new cargo replacing it). Easy keeps a cargo of easyKeep (6) or more, Normal one of
// normalKeep (8) or more (the average of a reroll is 7), both keep at once what reaches the target. Hard plays the
// race exactly: the chance of winning the square from every pair of totals (sccRace: each side's points still
// needed, the mover to roll; a turn's outcomes enumerated die by die), and keeps or rerolls by whichever wins more.
import { goAgain, tune } from '../../core/tune.js';
import { SCC, sccCfg, sccDiceFor, sccSum, sccTake } from './rules.js';

// A roll from a level, every outcome enumerated (6^n, n ≤ 5): [new level, cargo total or 0, chance].
const TRANS = [];
function trans(L) {
  if (TRANS[L]) return TRANS[L];
  const n = sccDiceFor(L), map = new Map(), d = new Array(n).fill(1), all = 6 ** n;
  for (let k = 0; k < all; k++) {
    let x = k; for (let j = 0; j < n; j++) { d[j] = 1 + (x % 6); x = Math.floor(x / 6); }
    const t = sccTake(L, d), key = t.lv * 100 + (t.lv >= 3 ? sccSum(t.cargo) : 0);
    map.set(key, (map.get(key) || 0) + 1 / all);
  }
  return (TRANS[L] = [...map].map(([key, p]) => [Math.floor(key / 100), key % 100, p]));
}
// The chance a turn of R rolls never gets all three (it scores 0 whatever the player does).
export function sccZero(R) {
  const f = (L, r) => { if (r === 0) return 1; let s = 0; for (const [lv, , p] of trans(L)) if (lv < 3) s += p * f(lv, r - 1); return s; };
  return f(0, R);
}
// The turn's points under a keeping rule (keep(c, need, r): true to keep cargo c with r rolls left): its expected
// value and its chance of reaching `need` (for the computer's q and needs).
export function sccTurn(R, need, keep) {
  let ev = 0, fin = 0;
  const D = (c, r, p) => {
    if (r === 0 || keep(c, need, r)) { ev += p * c; if (c >= need) fin += p; return; }
    for (const [, c2, q] of trans(3)) D(c2, r - 1, p * q);
  };
  const T = (L, r, p) => { for (const [lv, c, q] of trans(L)) { if (lv >= 3) D(c, r - 1, p * q); else if (r > 1) T(lv, r - 1, p * q); } };
  T(0, R, 1);
  return { ev, fin };
}
// Hard's table: V[i][j], the chance the side to move wins needing i more points against a side needing j (each
// 1..target), with R rolls a turn; ga: "Go again on success" (a turn that scores keeps the turn). Worked out by
// the totals still needed, smallest first: a turn that scores only lowers them, and one that scores nothing hands
// the same pair over (V(i,j) = A + p0 (1 - V(j,i)), solved with its mirror).
const RACE = new Map();
export function sccRace(target, R, ga) {
  const key = `${target}|${R}|${ga ? 1 : 0}`;
  if (RACE.has(key)) return RACE.get(key);
  const N = target, V = Array.from({ length: N + 1 }, () => new Float64Array(N + 1)), p0 = sccZero(R), done = Array.from({ length: N + 1 }, () => new Uint8Array(N + 1));
  const K = (i, j, c) => (c >= i ? 1 : ga ? V[i - c][j] : 1 - V[j][i - c]);
  const A = (i, j) => {                                            // the turn's value with nothing scored counted as 0
    const memo = new Map();
    const D = (c, r) => {
      const mk = c * 8 + r; if (memo.has(mk)) return memo.get(mk);
      let v = K(i, j, c);
      if (r > 0) { let e = 0; for (const [, c2, q] of trans(3)) e += q * D(c2, r - 1); if (e > v) v = e; }
      memo.set(mk, v); return v;
    };
    const T = (L, r) => { let s = 0; for (const [lv, c, q] of trans(L)) { if (lv >= 3) s += q * D(c, r - 1); else if (r > 1) s += q * T(lv, r - 1); } return s; };
    return T(0, R);
  };
  for (let s = 2; s <= 2 * N; s++) {
    for (let i = Math.max(1, s - N); i <= Math.min(N, s - 1); i++) {
      const j = s - i;
      if (done[i][j]) continue;
      const a = A(i, j), b = i === j ? a : A(j, i);
      const v = (a + p0 - p0 * b - p0 * p0) / (1 - p0 * p0);      // with V(j,i) = b + p0 (1 - V(i,j))
      V[i][j] = v; V[j][i] = i === j ? v : b + p0 * (1 - v); done[i][j] = done[j][i] = 1;
    }
  }
  const out = { V, K: (i, j, c) => K(i, j, c) };
  RACE.set(key, out);
  return out;
}
// Hard: keep or reroll cargo c with r rolls left, by the race's chances (true: keep).
export function sccHardKeep(pm, me, c, r) {
  const cf = sccCfg(pm), o = me === 'X' ? 'O' : 'X', i = cf.target - pm.score[me], j = cf.target - pm.score[o];
  if (c >= i) return true;
  const { V } = sccRace(cf.target, cf.rolls, goAgain(pm));
  const K = c2 => (c2 >= i ? 1 : goAgain(pm) ? V[i - c2][j] : 1 - V[j][i - c2]);
  const D = (c2, rr) => { let v = K(c2); if (rr > 0) { let e = 0; for (const [, c3, q] of trans(3)) e += q * D(c3, rr - 1); if (e > v) v = e; } return v; };
  let e = 0; for (const [, c2, q] of trans(3)) e += q * D(c2, r - 1);
  return K(c) >= e;
}
const ruleKeep = k => (c, need) => c >= need || c >= k;
export function needs(pm, p) {
  const cf = sccCfg(pm), need = cf.target - pm.score[p];
  const { ev } = sccTurn(cf.rolls, need, ruleKeep(tune(pm).normalKeep || 8));
  return Math.max(1, need / Math.max(0.5, ev));
}
export function best(pm, me, rng, style, ctx) {
  const cf = sccCfg(pm), t = pm.turn && pm.turn.by === me ? pm.turn : null, need = cf.target - pm.score[me], lvl = ctx && ctx.level;
  const k = lvl === 'easy' ? tune(pm).easyKeep || 6 : tune(pm).normalKeep || 8;
  if (!t) return { move: 'roll', q: sccTurn(cf.rolls, need, (c, nd) => c >= nd).fin };
  if (t.lv < 3 || t.n >= cf.rolls) return { move: 'roll', q: 0 };
  const c = sccSum(t.cargo), left = cf.rolls - t.n;
  const keep = lvl === 'hard' ? sccHardKeep(pm, me, c, left) : c >= need || c >= k;
  if (keep) return { move: 'keep', q: c >= need ? 1 : 0 };
  return { move: 'roll', q: rerollFin(need, left) };
}
// The chance the rerolls left reach `need` (each reroll of the two cargo dice, stopping once it is reached).
function rerollFin(need, r) {
  let p = 0, miss = 1, hit = 0;
  for (const [, c, q] of trans(3)) if (c >= need) hit += q;
  for (let k = 0; k < r; k++) { p += miss * hit; miss *= 1 - hit; }
  return p;
}
export { SCC };
