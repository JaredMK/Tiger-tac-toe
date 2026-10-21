// The Hard computer's choice of square: Monte Carlo playouts of the rest of the match. Every open square is a
// race, as the ordinary computer sees it (each game's `needs`: the moves each side still needs there); a
// playout plays the match out on that model, move by move, each side choosing its square the way the
// ordinary computer would (with some exploring), each move making its progress with the weights' chance,
// a square claimed once its side needs nothing more, until the board decides the match. The candidate's own
// first move is played as the game's tactics judge it (a win now, a loss now, or the position after). The
// candidate whose playouts win the match most often is the move. Pure: the clock, where there is one, is
// passed in (until: the ms left), every random choice from the rng.
import { LINES } from './board.js';
import { AI, needsOf, squareValue, winChance } from './ai.js';
import { publicMini } from './minis.js';
import { other } from './util.js';

const MAX_PLIES = 60;
// cands: [{ square, pm, local, value }] (ai.js); w: the weights (aiw.js); st: the playout style (attack, defend)
export function mcPick(state, me, cands, rng, w, st, until) {
  const o = other(me), n = state.squares.length;
  const base = Int8Array.from(state.squares, sq => (sq.owner === 'X' ? 1 : sq.owner === 'O' ? 2 : 0)), need0 = new Float64Array(18);
  state.squares.forEach((sq, i) => { if (sq.owner) return; const c = cands.find(x => x.square === i), pm = c ? c.pm : publicMini(sq.mini); need0[2 * i] = needsOf(pm, 'X'); need0[2 * i + 1] = needsOf(pm, 'O'); });
  const afters = cands.map(c => (c.local.after ? { X: needsOf(c.local.after, 'X'), O: needsOf(c.local.after, 'O') } : null));   // (the game's reckoning once, not per playout)
  const wins = cands.map(() => 0);
  let rounds = 0;
  for (let r = 0; r < w.playouts; r++) {
    if (until && (r & 7) === 7 && until() <= 0) break;
    for (let k = 0; k < cands.length; k++) wins[k] += playout(cands[k], afters[k], base, need0, me, o, rng, w, st);
    rounds++;
  }
  let best = 0;
  for (let k = 1; k < cands.length; k++) if (wins[k] > wins[best] + 1e-9 || (Math.abs(wins[k] - wins[best]) < 1e-9 && cands[k].score > cands[best].score)) best = k;
  const c = cands[best];
  return { square: c.square, move: c.local.move, score: c.score, value: c.value, gain: c.gain, mc: { n: rounds, p: cands.map((x, k) => Number((wins[k] / Math.max(1, rounds)).toFixed(3))) } };
}
// One playout from the candidate's move: 1 the match won, 0.5 drawn, 0 lost. The board as flat arrays: own[i]
// the owner (0 none, 1 X, 2 O), need[2i] X's moves still needed in square i, need[2i + 1] O's.
const SIDE = { X: 1, O: 2 }, PLY = [0, 2, 1];                    // PLY: the other side
function playout(c, after, base, need0, me, o, rng, w, st) {
  const own = base.slice(), need = need0.slice(), ME = SIDE[me], OP = SIDE[o], MAX = Infinity;
  const L = c.local, i = c.square;
  const vals = [null, null, null];                               // each side's worth of every square, as the board stands (fresh after a claim)
  // the candidate's own move, as the game's tactics judge it
  const u = rng();
  if (L.win || u < (L.q || 0)) own[i] = ME;
  else if (u < (L.q || 0) + (L.qLose || 0)) own[i] = OP;
  else if (after) { need[2 * i] = after.X; need[2 * i + 1] = after.O; }
  else { need[2 * i + ME - 1] = Math.max(0.5, need[2 * i + ME - 1] - 1); if (L.shared) need[2 * i + OP - 1] = Math.max(0.5, need[2 * i + OP - 1] - 1); }
  let res = own[i] ? result(own) : 0;
  let p = OP;
  for (let ply = 0; !res && ply < MAX_PLIES; ply++) {
    if (!vals[p]) { const v = new Float64Array(9); for (let k = 0; k < 9; k++) if (!own[k]) v[k] = lineValue(own, k, p, st); vals[p] = v; }
    const j = choose(own, need, vals[p], p, rng, w);
    const q = PLY[p];
    if (j < 0) { p = q; continue; }                               // nowhere to play: the turn passes
    const a = 2 * j + p - 1, b = 2 * j + q - 1;
    if (need[a] === MAX && need[b] === MAX) { need[a] = w.fresh; need[b] = w.fresh; }   // a dead square resets
    else if (need[a] !== MAX && rng() < w.prog) {
      if (need[a] <= 1) { own[j] = p; vals[1] = vals[2] = null; res = result(own); }
      else need[a] -= 1;
    }
    p = q;
  }
  if (!res) return 0.5;
  return res === ME ? 1 : res === OP ? 0 : 0.5;
}
// The square a side plays in a playout: the ordinary computer's own weighing (the square's worth on the board
// times what a move there gains), the best as a rule, now and then (explore) any by its worth.
const OPTS = new Int8Array(9), SS = new Float64Array(9);
function choose(own, need, vals, p, rng, w) {
  const q = PLY[p];
  let n = 0, top = -1, sum = 0;
  for (let i = 0; i < 9; i++) {
    if (own[i]) continue;
    const a = need[2 * i + p - 1], b = need[2 * i + q - 1];
    if (a === Infinity && b !== Infinity) continue;               // a square it cannot win and the other side can: a wasted move
    const v = vals[i];
    if (v >= AI.win && a <= 1) return i;                          // the match, now
    const gain = a === Infinity ? 0.01 : winChance(Math.max(0.5, a - 1), b) - winChance(a, b);
    const s = v * Math.max(gain, 0.01);
    OPTS[n] = i; SS[n] = s; sum += s;
    if (top < 0 || s > SS[top]) top = n;
    n++;
  }
  if (!n) return -1;
  if (n === 1 || rng() >= w.explore) return OPTS[top];
  let u = rng() * sum;
  for (let k = 0; k < n; k++) { u -= SS[k]; if (u <= 0) return OPTS[k]; }
  return OPTS[n - 1];
}
// squareValue (ai.js) on the flat board.
function lineValue(own, i, me, st) {
  const o = PLY[me];
  let v = 0.5, win = false, block = false;
  for (const line of LINES) {
    if (line[0] !== i && line[1] !== i && line[2] !== i) continue;
    let mine = 0, theirs = 0;
    for (const k of line) if (k !== i) { if (own[k] === me) mine++; else if (own[k] === o) theirs++; }
    if (mine === 2) win = true;
    if (theirs === 2) block = true;
    if (!theirs) v += st.attack * [1, 3, 0][mine];
    if (!mine) v += st.defend * [1, 3, 0][theirs];
  }
  if (win) return AI.win;
  if (block) return AI.block * Math.min(1, st.defend) + v;
  return v;
}
// mainResult (board.js) on the flat board: 1 or 2 the winner, 3 a draw (no line left for either), 0 nothing yet.
function result(own) {
  let x = false, o = false;
  for (const l of LINES) {
    const a = own[l[0]], b = own[l[1]], c = own[l[2]];
    if (a && a === b && b === c) return a;
    if (a !== 2 && b !== 2 && c !== 2) x = true;
    if (a !== 1 && b !== 1 && c !== 1) o = true;
  }
  return x || o ? 0 : 3;
}
