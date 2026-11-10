// The computer's choice of square (docs/ai.md): a Monte Carlo search over the rest of the match. Every open square is
// a race between the two sides, as each game's tactics reckon it (`needs`: the turns each side still needs there). A
// playout plays the match out on that model, turn by turn, each side choosing its square the way the plain computer
// would (the square's worth on the board times what a turn there gains, with some exploring), each turn making its
// progress with the weights' chance, a square claimed once its side needs nothing more, until the board decides the
// match. The candidate's own first move is played as the game's tactics judge it (a win now, a loss now, or the
// position after). Every candidate plays round after round; one clearly behind the leader is let go (its paired
// difference more than `drop` standard errors under zero) and its rounds go to the candidates still in doubt, so
// the same time settles the close calls about four times as finely as an even share would. The candidate whose
// playouts win the match most often is the move, but for the tempo rules (ai.js closeTo, safeLead). Pure: the
// clock, where there is one, is passed in (until: the ms left), every random choice from the rng.
import { LINES } from './board.js';
import { AI, catchUp, needsOf } from './ai.js';
import { publicMini } from './minis.js';
import { other } from './util.js';

const TIE = 0.005, MAX_PLIES = 80, SIDE = { X: 1, O: 2 }, PLY = [0, 2, 1];
let LOFS = null;                                                // (the board's lines, taken at the first search: nothing of another module while loading)
// cands: [{ square, pm, local, value, score, close, safe }] (ai.js); P: the search's settings (aiw.js: playouts, explore, prog, fresh, drop);
// st: the style (attack, defend).
export function mc2Pick(state, me, cands, rng, P, st, until) {
  if (!LOFS) LOFS = LINES.map(l => l.slice());
  const o = other(me), ME = SIDE[me], OP = SIDE[o];
  const own0 = Int8Array.from(state.squares, sq => (sq.owner === 'X' ? 1 : sq.owner === 'O' ? 2 : 0));
  const need0 = new Float64Array(18);
  state.squares.forEach((sq, i) => {
    if (sq.owner) return;
    const c = cands.find(x => x.square === i), pm = c ? c.pm : publicMini(sq.mini, me);
    need0[2 * i] = needsOf(pm, 'X'); need0[2 * i + 1] = needsOf(pm, 'O');
  });
  const afters = cands.map(c => (c.local.after ? [needsOf(c.local.after, 'X'), needsOf(c.local.after, 'O')] : null));
  const K = cands.length, wins = new Float64Array(K), n = new Int32Array(K), budget = Math.max(8, Math.round(P.playouts)) * K, rounds = Math.min(budget, Math.max(8, Math.round(P.playouts)) * (P.stretch || 4));
  const S = { own: new Int8Array(9), need: new Float64Array(18), vals: [null, new Float64Array(9), new Float64Array(9)], fresh: [false, false, false] };
  const live = Array.from({ length: K }, (_, k) => k), out = new Float32Array(K * rounds);
  let N = 0, R = 0;
  for (; R < rounds && N < budget; R++) {
    if (until && (R & 7) === 7 && until() <= 0) break;
    for (const k of live) { const x = playout(S, cands[k], afters[k], own0, need0, ME, OP, rng, P, st); out[k * rounds + R] = x; wins[k] += x; n[k]++; N++; }
    if (live.length > 1 && R >= 23 && (R & 7) === 7) {
      let L = live[0]; for (const k of live) if (wins[k] / n[k] > wins[L] / n[L]) L = k;
      for (let j = live.length - 1; j >= 0; j--) {
        const k = live[j]; if (k === L) continue;
        let sd = 0, sq = 0; for (let r = 0; r <= R; r++) { const d = out[k * rounds + r] - out[L * rounds + r]; sd += d; sq += d * d; }
        const m = R + 1, mean = sd / m, se = Math.sqrt(Math.max(1e-9, sq / m - mean * mean) / m);
        if (P.drop > 0 && mean + P.drop * se < 0) live.splice(j, 1);
      }
    }
    if (live.length === 1 && R >= 23) { R++; break; }
  }
  // The move: the candidate that won most; among those the playouts cannot tell apart (within TIE of the top),
  // the one the plain weighing scores highest (a lost position's block, a level choice).
  let top = 0;
  for (const k of live) top = Math.max(top, wins[k] / Math.max(1, n[k]));
  let best = -1;
  for (const k of live) if (wins[k] / Math.max(1, n[k]) >= top - TIE && (best < 0 || cands[k].score > cands[best].score)) best = k;
  const rate = k => wins[k] / Math.max(1, n[k]);
  if (P.close) {                                                  // a square it is close to winning (ai.js closeTo): played ahead of the rest, unless the best square is a block of the other side's match
    let near = -1;
    for (let k = 0; k < K; k++) if (cands[k].close && (near < 0 || rate(k) > rate(near))) near = k;
    if (near >= 0 && !(cands[best].value >= AI.block && cands[near].value < AI.block)) best = near;
  }
  if (P.safe && cands[best].safe) {                               // tempo play (ai.js safeLead): a square it leads safely waits; the best of the rest by the playouts
    let alt = -1;
    for (let k = 0; k < K; k++) if (!cands[k].safe && (alt < 0 || rate(k) > rate(alt) + 1e-9)) alt = k;
    if (alt >= 0) best = alt;
  }
  const c = cands[best];
  return { square: c.square, move: c.local.move, score: c.score, value: c.value, gain: c.gain, mc: { n: N, p: cands.map((x, k) => Number((wins[k] / Math.max(1, n[k])).toFixed(3))), each: Array.from(n) } };
}
// squareValue (ai.js) on the flat board.
const LV = [1, 3, 0];
function lineValue(own, i, me, st) {
  const o = PLY[me];
  let v = 0.5, win = false, block = false;
  for (let l = 0; l < 8; l++) {
    const line = LOFS[l];
    if (line[0] !== i && line[1] !== i && line[2] !== i) continue;
    let mine = 0, theirs = 0;
    for (let k = 0; k < 3; k++) { const c = line[k]; if (c !== i) { if (own[c] === me) mine++; else if (own[c] === o) theirs++; } }
    if (mine === 2) win = true;
    if (theirs === 2) block = true;
    if (!theirs) v += st.attack * LV[mine];
    if (!mine) v += st.defend * LV[theirs];
  }
  if (win) return AI.win;
  if (block) return AI.block * Math.min(1, st.defend) + v;
  return v;
}
// mainResult (board.js) on the flat board: 1 or 2 the winner, 3 a draw (no line left for either), 0 nothing yet.
function result(own) {
  let x = false, o = false;
  for (let l = 0; l < 8; l++) {
    const line = LOFS[l], a = own[line[0]], b = own[line[1]], c = own[line[2]];
    if (a && a === b && b === c) return a;
    if (a !== 2 && b !== 2 && c !== 2) x = true;
    if (a !== 1 && b !== 1 && c !== 1) o = true;
  }
  return x || o ? 0 : 3;
}

// One playout from the candidate's move: every open square a race in turns still needed; each side in turn plays
// the square the plain computer would (choose), and its move there makes a turn's progress with chance P.prog
// (else none), a square claimed once its side needs nothing more.
function playout(S, c, after, own0, need0, ME, OP, rng, P, st) {
  const own = S.own, need = S.need;
  own.set(own0); need.set(need0);
  const L = c.local, i = c.square, u = rng();
  if (L.win || u < (L.q || 0)) own[i] = ME;
  else if (u < (L.q || 0) + (L.qLose || 0)) own[i] = OP;
  else if (L.stay) { /* a move that fails leaves the square as it was */ }
  else if (after) { need[2 * i] = after[0]; need[2 * i + 1] = after[1]; }
  else { need[2 * i + ME - 1] = Math.max(0.5, need[2 * i + ME - 1] - 1); if (L.shared) need[2 * i + OP - 1] = Math.max(0.5, need[2 * i + OP - 1] - 1); }
  S.fresh[1] = S.fresh[2] = false;
  let res = own[i] ? result(own) : 0, p = OP;
  for (let ply = 0; !res && ply < 60; ply++) {
    if (!S.fresh[p]) { const v = S.vals[p]; for (let k = 0; k < 9; k++) v[k] = own[k] ? 0 : lineValue(own, k, p, st); S.fresh[p] = true; }
    const j = choose(own, need, S.vals[p], p, rng, P), q = PLY[p];
    if (j < 0) { p = q; continue; }
    const a = 2 * j + p - 1, b = 2 * j + q - 1;
    if (need[a] === Infinity && need[b] === Infinity) { need[a] = P.fresh; need[b] = P.fresh; }   // a dead square resets
    else if (need[a] !== Infinity && rng() < P.prog) {
      if (need[a] <= 1) { own[j] = p; S.fresh[1] = S.fresh[2] = false; res = result(own); }
      else need[a] -= 1;
    }
    p = q;
  }
  if (!res) return 0.5;
  return res === ME ? 1 : res === OP ? 0 : 0.5;
}
const OPTS = new Int8Array(9), SS = new Float64Array(9);
const wc = (a, b) => (a <= 0 ? 1 : b <= 0 ? 0 : a === Infinity && b === Infinity ? 0.5 : a === Infinity ? 0 : b === Infinity ? 1 : b / (a + b));
function choose(own, need, vals, p, rng, P) {
  const q = PLY[p];
  let n = 0, top = -1, sum = 0;
  for (let i = 0; i < 9; i++) {
    if (own[i]) continue;
    const a = need[2 * i + p - 1], b = need[2 * i + q - 1];
    if (a === Infinity && b !== Infinity) continue;
    const v = vals[i];
    if (v >= AI.win && a <= 1) return i;
    const gain = a === Infinity ? 0.01 : a <= 1 ? P.prog * (1 - wc(a, b)) : wc(Math.max(0.5, a - 1), b) - wc(a, b);
    const s = v * Math.max(gain, 0.01) * catchUp(a, b, v);
    OPTS[n] = i; SS[n] = s; sum += s;
    if (top < 0 || s > SS[top]) top = n;
    n++;
  }
  if (!n) return -1;
  if (n === 1 || rng() >= P.explore) return OPTS[top];
  let u = rng() * sum;
  for (let k = 0; k < n; k++) { u -= SS[k]; if (u <= 0) return OPTS[k]; }
  return OPTS[n - 1];
}
