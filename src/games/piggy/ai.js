// Pig: the computer's play.
// Hard plays the race exactly where the target is small enough to solve (WIN: the chance the side to move wins from
// its bank, the other's and the pot, by value iteration over every state; a roll limit adds the rolls made): it rolls
// while rolling wins more often than banking. Normal banks at a fixed pot (`aiBank`, 9), Easy at a smaller one
// (`aiBankEasy`, 4); both bank what wins, and go for it when the other side would win with its next small turn.
import { other } from '../../core/util.js';
import { piggyCfg } from './rules.js';

const faces = c => Array.from({ length: c.sides }, (_, k) => k + 1).filter(n => n !== c.bust);
// The chance a turn makes r more points before the bust number comes (a roll limit ignored).
const REACH = new Map();
export function pigReach(c, r) {
  if (r <= 0) return 1;
  const key = `${c.sides}:${c.bust}:${r}`;
  if (REACH.has(key)) return REACH.get(key);
  let pr = 0; for (const f of faces(c)) pr += pigReach(c, r - f) / c.sides;
  REACH.set(key, pr); return pr;
}
// What a turn that banks at k (or at r, when less is needed) ends with: [[pot, chance]], 0 a bust.
function turnDist(c, k) {
  const out = new Map(), F = faces(c);
  const walk = (pot, pr, n) => {
    if (pot >= k || (c.max && n >= c.max && pot > 0)) { out.set(pot, (out.get(pot) || 0) + pr); return; }
    out.set(0, (out.get(0) || 0) + pr / c.sides);
    for (const f of F) walk(pot + f, pr / c.sides, n + 1);
  };
  walk(0, 1, 0);
  return out;
}
// The turns it takes to bank r more points, banking at k each turn.
const TURNS = new Map();
export function pigTurns(c, r, k) {
  const key = `${c.sides}:${c.bust}:${c.max}:${k}`; let t = TURNS.get(key);
  if (!t) TURNS.set(key, t = [0]);
  for (let x = t.length; x <= r; x++) {
    let sum = 1, stay = 0;
    for (const [v, pr] of turnDist(c, Math.min(x, k))) { if (v === 0) stay = pr; else sum += pr * t[Math.max(0, x - v)]; }
    t[x] = sum / (1 - stay);
  }
  return t[r];
}
// The exact race: W[i][j][k][n] the chance the side on the move wins (its bank i, the other's j, its pot k, n rolls made).
const SOLVED = new Map();
export const PIG_SOLVE_MAX = 40;                                   // targets above this are played by the bank-at rule
export function pigSolve(c) {
  const key = `${c.target}:${c.sides}:${c.bust}:${c.max}`;
  if (SOLVED.has(key)) return SOLVED.get(key);
  const T = c.target, R = c.max ? c.max + 1 : 1, F = faces(c), s = c.sides;
  const W = new Float64Array(T * T * T * R).fill(0.5), at = (i, j, k, n) => ((i * T + j) * T + k) * R + (c.max ? n : 0);
  for (let it = 0; it < 400; it++) {
    let d = 0;
    for (let i = T - 1; i >= 0; i--) for (let j = T - 1; j >= 0; j--) for (let k = T - 1 - i; k >= 0; k--) for (let n = R - 1; n >= 0; n--) {
      let roll = -1;
      if (!(c.max && n >= c.max)) {
        roll = (1 - W[at(j, i, 0, 0)]) / s;
        for (const f of F) roll += (i + k + f >= T ? 1 : W[at(i, j, k + f, n + 1 < R ? n + 1 : R - 1)]) / s;
      }
      const bank = k > 0 ? 1 - W[at(j, i + k, 0, 0)] : -1, v = Math.max(roll, bank), a = at(i, j, k, n);
      d = Math.max(d, Math.abs(v - W[a])); W[a] = v;
    }
    if (d < 1e-7) break;
  }
  const out = { W, at, rollBetter(i, j, k, n) {                     // (a pot of 0 always rolls; at the limit, only Bank)
    if (k <= 0) return true;
    if (c.max && n >= c.max) return false;
    let roll = (1 - W[at(j, i, 0, 0)]) / s;
    for (const f of F) roll += (i + k + f >= T ? 1 : W[at(i, j, k + f, n + 1 < R ? n + 1 : R - 1)]) / s;
    return roll > 1 - W[at(j, i + k, 0, 0)];
  } };
  SOLVED.set(key, out); return out;
}
// The turns a side still needs (the bank-at rule's average; mid-turn, this turn's chances from its pot).
export function needs(pm, p) {
  const c = piggyCfg(pm), r = c.target - pm.bank[p], t = pm.turn && pm.turn.by === p ? pm.turn : null;
  if (r <= 0) return 0;
  if (t && t.pot >= r) return 0.5;                                // only Bank is left
  return pigTurns(c, Math.max(0, r - (t ? Math.round(t.pot * 0.8) : 0)), c.aiBank);
}
export function best(pm, me, rng, style, ctx) {
  const c = piggyCfg(pm), level = (ctx && ctx.level) || 'normal', t = pm.turn && pm.turn.by === me ? pm.turn : null;
  const pot = t ? t.pot : 0, n = t ? t.n : 0, mine = pm.bank[me], theirs = pm.bank[other(me)], r = c.target - mine;
  const q = pigReach(c, r - pot);
  if (!pot) return { move: 'roll', q };
  if (pot >= r || (c.max && n >= c.max)) return { move: 'bank', q: pot >= r ? 1 : 0 };
  if (level === 'hard' && c.target <= PIG_SOLVE_MAX) return { move: pigSolve(c).rollBetter(mine, theirs, pot, n) ? 'roll' : 'bank', q };
  let k = level === 'easy' ? c.aiBankEasy : c.aiBank + ((style && style.rollRisk) || 0);
  if (level !== 'easy' && c.target - theirs <= 4) k = r;          // the other side wins with almost any turn: go for it all
  return { move: pot >= Math.min(k, r) ? 'bank' : 'roll', q };
}
