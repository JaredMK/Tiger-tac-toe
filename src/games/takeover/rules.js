// Takeover: the rules (pure: no page, no clock; the server runs the same code).
import { other } from '../../core/util.js';
import { tuneLive } from '../../core/tune.js';

// Takeover: a 5x5 board, empty to begin with. A move takes an empty cell and the cells above, below,
// left and right of it, the other player's included. Once no cell is empty, most cells wins (25: no tie).
// (The admin's settings: a 7x7 board, 49 cells, also odd; the side is the square's own, from its cells.)
export const TAKE = { n: 5 };
export const takeSide = cells => Math.round(Math.sqrt(cells.length));
export const takeNear = (i, n = TAKE.n) => { const r = Math.floor(i / n), c = i % n, out = [i]; if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1); return out; };
export const takeCount = (cells, p) => cells.filter(c => c === p).length;
export function takeApply(cells, i, p) { const out = cells.slice(), n = takeSide(cells); for (const k of takeNear(i, n)) out[k] = p; return out; }
// The computer, two moves deep: the cell that leaves it furthest ahead after the other player's best reply
// (depth 1, the admin's setting: the cell furthest ahead now).
export function takeSearch(cells, me, rng, depth = 2) {
  const o = other(me), net = c => takeCount(c, me) - takeCount(c, o);
  let best = null;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) continue;
    const a = takeApply(cells, i, me);
    let worst = Infinity;
    if (!a.includes(null)) worst = net(a) > 0 ? 100 + net(a) : -100 + net(a);   // the board full: won or lost
    else if (depth < 2) worst = net(a);
    else for (let j = 0; j < a.length; j++) { if (a[j]) continue; const b = takeApply(a, j, o); const v = b.includes(null) ? net(b) : net(b) > 0 ? 100 + net(b) : -100 + net(b); if (v < worst) worst = v; }
    const v = worst + (rng ? rng() * 0.01 : 0);                  // (a hair of chance between equals)
    if (!best || v > best.v) best = { i, v, after: a };
  }
  return best;
}
// ---- Hard: iterative deepening negamax with alpha-beta and a transposition table ----
// The board as bytes (0 empty, 1 the searcher, 2 the other side), a move's cells saved for the undo, the
// lead (own cells less the other side's) kept as a running count: the leaf value, and the result once the
// board is full (every cell counts at the end, so a win or loss carries its margin). Moves in order of what
// they take at once (empty cells, the other side's twice), the table's best first. Deeper each round until
// the time (until: the ms left, checked every 256 nodes) or, without a clock, TAKE_HARD.depth plies or
// TAKE_HARD.nodes nodes; the last round completed is the answer (a forced win or loss ends the rounds
// early). The table is a fixed array keyed by two hashes (Zobrist, from a fixed seed), emptied every call.
export const TAKE_HARD = { depth: 8, nodes: 30000, win: 1000 };
const tzob = (() => { let s = 0x2545f491 >>> 0; const t = new Uint32Array(49 * 4); for (let i = 0; i < t.length; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; t[i] = s; } return t; })();
const TNEAR = {};
function takeNearFlat(n) { if (TNEAR[n]) return TNEAR[n]; const at = new Int32Array(n * n + 1), of = []; for (let i = 0; i < n * n; i++) { at[i] = of.length; for (const k of takeNear(i, n)) of.push(k); } at[n * n] = of.length; return (TNEAR[n] = { at, of: Int8Array.from(of) }); }
const TTT_N = 1 << 15, TTT = { key: new Float64Array(TTT_N), v: new Int32Array(TTT_N), d: new Int8Array(TTT_N), f: new Int8Array(TTT_N), m: new Int8Array(TTT_N) };
// The best cell for me: { i, v, after, depth, nodes }.
export function takeHard(cells, me, until = null, cap = TAKE_HARD) {
  const n = takeSide(cells), N = n * n, WIN = cap.win, { at, of } = takeNearFlat(n), b = new Uint8Array(N);
  const UNDO = Array.from({ length: N + 1 }, () => new Int8Array(5)), ORD = Array.from({ length: N + 1 }, () => new Int8Array(N)), GAIN = new Int8Array(N);
  let h1 = 0, h2 = 0, lead = 0, empty = 0, nodes = 0, stop = false;
  for (let k = 0; k < N; k++) { const c = cells[k]; if (!c) { empty++; continue; } const s = c === me ? 1 : 2; b[k] = s; lead += s === 1 ? 1 : -1; h1 ^= tzob[4 * k + s - 1]; h2 ^= tzob[4 * k + s + 1]; }
  TTT.d.fill(-1);
  const play = (i, s, undo) => {   // the cell and its neighbours to s: what was there into undo
    const sg = s === 1 ? 1 : -1;
    for (let j = at[i], z = at[i + 1]; j < z; j++) {
      const k = of[j], c = b[k];
      undo[j - at[i]] = c;
      if (c === s) continue;
      if (c) { lead += 2 * sg; h1 ^= tzob[4 * k + c - 1]; h2 ^= tzob[4 * k + c + 1]; } else { lead += sg; empty--; }
      b[k] = s; h1 ^= tzob[4 * k + s - 1]; h2 ^= tzob[4 * k + s + 1];
    }
  };
  const unplay = (i, s, undo) => {
    const sg = s === 1 ? 1 : -1;
    for (let j = at[i], z = at[i + 1]; j < z; j++) {
      const k = of[j], c = undo[j - at[i]];
      if (c === s) continue;
      h1 ^= tzob[4 * k + s - 1]; h2 ^= tzob[4 * k + s + 1]; b[k] = c;
      if (c) { lead -= 2 * sg; h1 ^= tzob[4 * k + c - 1]; h2 ^= tzob[4 * k + c + 1]; } else { lead -= sg; empty++; }
    }
  };
  const order = (s, ord) => {   // the empty cells, those that take most first
    let m = 0;
    for (let i = 0; i < N; i++) {
      if (b[i]) continue;
      let g = 0;
      for (let j = at[i], z = at[i + 1]; j < z; j++) { const c = b[of[j]]; g += c === 0 ? 1 : c === s ? 0 : 2; }
      GAIN[i] = g;
      let q = m++;
      while (q > 0 && GAIN[ord[q - 1]] < g) { ord[q] = ord[q - 1]; q--; }
      ord[q] = i;
    }
    return m;
  };
  const search = (s, depth, alpha, beta, ply) => {   // the value for s, s to move
    if ((++nodes & 255) === 0 && (until ? until() <= 0 : nodes > cap.nodes)) { stop = true; return 0; }
    const own = s === 1 ? lead : -lead;
    if (!empty) return own > 0 ? WIN + own : -WIN + own;
    const key = h1 * 1048576 + (h2 & 0xfffff), x = ((h1 ^ h2) >>> 0) & (TTT_N - 1), hit = TTT.key[x] === key && TTT.d[x] >= 0;
    let first = -1;
    if (hit) {
      if (TTT.d[x] >= depth) {
        const v = TTT.v[x], f = TTT.f[x];
        if (f === 0) return v;
        if (f === 1) { if (v > alpha) alpha = v; } else if (v < beta) beta = v;
        if (alpha >= beta) return v;
      }
      first = TTT.m[x];
    }
    if (depth === 0) return own;
    const t = 3 - s, undo = UNDO[ply], ord = ORD[ply], m = order(s, ord), a0 = alpha;
    let best = -Infinity, bm = -1;
    for (let i = -1; i < m; i++) {
      const k = i < 0 ? first : ord[i];
      if (k < 0 || (i >= 0 && k === first)) continue;
      play(k, s, undo);
      const v = -search(t, depth - 1, -beta, -alpha, ply + 1);
      unplay(k, s, undo);
      if (stop) return 0;
      if (v > best) { best = v; bm = k; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    TTT.key[x] = key; TTT.v[x] = best; TTT.d[x] = depth; TTT.f[x] = best <= a0 ? 2 : best >= beta ? 1 : 0; TTT.m[x] = bm;
    return best;
  };
  const ord = ORD[0], m = order(1, ord), empties = Array.from(ord.subarray(0, m));
  let bi = empties[0], bv = 0, depth = 0;
  const max = until ? empty : Math.min(cap.depth, empty);
  for (let d = 1; d <= max && !stop; d++) {
    let alpha = -Infinity, top = bi, pick = -1;
    for (let i = -1; i < empties.length; i++) {
      const k = i < 0 ? top : empties[i];
      if (i >= 0 && k === top) continue;
      play(k, 1, UNDO[0]);
      const v = -search(2, d - 1, -Infinity, -alpha, 1);
      unplay(k, 1, UNDO[0]);
      if (stop) break;
      if (v > alpha) { alpha = v; pick = k; }
    }
    if (stop) break;
    bi = pick; bv = alpha; depth = d;
    if (Math.abs(bv) >= WIN) break;                            // decided: no round deeper changes it
  }
  return { i: bi, v: bv, after: takeApply(cells, bi, me), depth, nodes };
}
export function create(type, rng) {
  const n = tuneLive(type).size;                             // (the admin's settings: the board's side)
  return { type, cells: new Array(n * n).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {   // an empty cell, and the cells around it, the other player's too
  if (!Number.isInteger(m) || m < 0 || m >= mini.cells.length || mini.cells[m]) return { ok: false, reason: 'bad' };
  const o = other(p), took = [], flipped = [];
  for (const k of takeNear(m, takeSide(mini.cells))) { if (mini.cells[k] === o) flipped.push(k); else if (!mini.cells[k]) took.push(k); mini.cells[k] = p; }
  mini.last = { by: p, at: m, took, flipped };
  if (mini.cells.includes(null)) return { ok: true, outcome: 'continue', note: flipped.length ? 'flip' : 'take' };
  const x = takeCount(mini.cells, 'X'), y = takeCount(mini.cells, 'O');
  return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
}
export function publicView(mini) {
  return { type: 'takeover', cells: mini.cells.slice() };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.cells, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.take = { at: l.at, took: l.took.slice(), flipped: l.flipped.slice(), counts: { X: takeCount(mini.cells, 'X'), O: takeCount(mini.cells, 'O') } }; return;
}
export function flashMs(f, winLen, won) {
  return TAKEOVER_MS.place + TAKEOVER_MS.flip + (won ? 900 : 0);
}
// Takeover: the cell pops in, then its neighbours turn over; Flood: the blob changes colour, then the cells
// it grabs fill in wave by wave out from it.
export const TAKEOVER_MS = { place: 280, flip: 520 };
