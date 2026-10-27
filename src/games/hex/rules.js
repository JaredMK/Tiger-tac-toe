// Hex: the rules (pure: no page, no clock; the server runs the same code).
import { other } from '../../core/util.js';

// Hex: a new square is 5x5 with the swap rule; a square dealt before (4x4, no swap) plays on as it was, its size from its cells.
export const HEX_N = 5;
export const hexSize = cells => Math.round(Math.sqrt(cells.length));
// Hex: rows are shifted half a cell to the right, so (r, c) touches (r-1, c+1) and (r+1, c-1) as well as the four orthogonal cells.
export function hexNeighbors(i, n = HEX_N) {
  const r = Math.floor(i / n), c = i % n, out = [];
  for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, 1], [1, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
  }
  return out;
}
const hexEdges = (p, n) => (p === 'X' ? [i => i % n === 0, i => i % n === n - 1] : [i => i < n, i => i >= n * (n - 1)]);
// Breadth-first search from X's left edge (or O's top edge); returns the connecting path or null.
export function hexPath(cells, p) {
  const n = hexSize(cells), [isStart, isEnd] = hexEdges(p, n);
  const parent = new Map(), queue = [];
  for (let i = 0; i < n * n; i++) if (cells[i] === p && isStart(i)) { parent.set(i, -1); queue.push(i); }
  while (queue.length) {
    const i = queue.shift();
    if (isEnd(i)) { const path = []; for (let k = i; k !== -1; k = parent.get(k)) path.push(k); return path; }
    for (const nb of hexNeighbors(i, n)) if (cells[nb] === p && !parent.has(nb)) { parent.set(nb, i); queue.push(nb); }
  }
  return null;
}
// The swap rule (the pie rule): right after the first stone in a square, the other player's next move there may
// be "Swap", taking that stone as their own (it stays where it is; their move). Only while that stone is the only
// one there and it is the other player's: once the opener has placed a second (the other player having played
// elsewhere), the chance is gone. A 4x4 square from before has no swap.
// The computer's book for the swap rule on 5x5, from Hard against Hard (64 games from each opening, a varied search;
// a cell and its half-turn averaged). Written for X opening and O answering; the other way round, the same cells turned
// round the long diagonal ((r, c) as (c, r)). HEX_SWAP: the X stones O takes (swapping wins O more than playing on:
// the stone, now O's at (r, c), is worth to O what X's at (c, r) is to X); HEX_OPEN: the openings X plays, the ones
// worth most to X whichever O chooses (about 57-62% for X between the computer players: the edge cells of the first
// and last rows). tests/sim/hex.sim.js measures the first mover with them.
export const HEX_SWAP = [2, 4, 6, 7, 8, 10, 11, 12, 13, 14, 16, 17, 18, 20, 22];
export const HEX_OPEN = [1, 2, 3, 21, 22, 23];
export const hexT = (i, n = HEX_N) => (i % n) * n + Math.floor(i / n);   // (r, c) -> (c, r)
export function hexCanSwap(mini, p) {
  if (!mini.swap || !mini.cells || mini.swapped) return false;       // (once a square: a stone taken is not taken back)
  let k = -1;
  for (let i = 0; i < mini.cells.length; i++) if (mini.cells[i]) { if (k >= 0) return false; k = i; }
  return k >= 0 && mini.cells[k] === other(p);
}
export function create(type, rng) {
  return { type, cells: new Array(HEX_N * HEX_N).fill(null), swap: true, last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (m === 'swap') {                                             // the first stone taken over: the other player's no more
    if (!hexCanSwap(mini, p)) return { ok: false, reason: 'bad' };
    const k = mini.cells.findIndex(Boolean);
    mini.cells[k] = p; mini.last = k; mini.swapped = { by: p, at: k };
    return { ok: true, outcome: 'continue', note: 'swap' };
  }
  if (!idx(mini.cells.length)) return { ok: false, reason: 'bad' };
  if (mini.cells[m]) return { ok: false, reason: 'taken' };
  mini.cells[m] = p; mini.last = m;
  const path = hexPath(mini.cells, p);
  if (path) return { ok: true, outcome: 'win', cells: path };
  if (mini.cells.every(Boolean)) return { ok: true, outcome: 'draw' };   // cannot happen in Hex; kept for safety
  return { ok: true, outcome: 'continue' };
}
export function publicView(mini) {
  return Object.assign({ type: mini.type, cells: mini.cells.slice() }, mini.swap ? { swap: true } : {}, mini.swapped ? { swapped: Object.assign({}, mini.swapped) } : {});
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  if (m === 'swap') flash.hexSwap = mini.last;                    // (the view turns that stone over)
}
// Hex: the fewest empty cells p still needs to connect its two edges (0 = connected, Infinity = cut off).
export function hexDist(cells, p) {
  const n = hexSize(cells), N = n * n, o = other(p), dist = new Array(N).fill(Infinity), [isStart, isEnd] = hexEdges(p, n);
  const cost = i => (cells[i] === p ? 0 : cells[i] === o ? Infinity : 1);
  for (let i = 0; i < N; i++) if (isStart(i)) dist[i] = cost(i);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < N; i++) {
      if (dist[i] === Infinity) continue;
      for (const nb of hexNeighbors(i, n)) { const d = dist[i] + cost(nb); if (d < dist[nb]) { dist[nb] = d; changed = true; } }
    }
  }
  let best = Infinity;
  for (let i = 0; i < N; i++) if (isEnd(i) && dist[i] < best) best = dist[i];
  return best;
}
export function hexMoves(cells, me) {   // win and block detection through connection distances, looking one reply ahead
  const o = other(me), N = cells.length, out = [];
  for (let i = 0; i < N; i++) {
    if (cells[i]) continue;
    cells[i] = me;
    const mine = hexDist(cells, me);
    let v;
    if (mine === 0) v = 1000;
    else {
      let reply = -Infinity;
      for (let j = 0; j < N; j++) {
        if (cells[j]) continue;
        cells[j] = o;
        const od = hexDist(cells, o), r = od === 0 ? 1000 : hexDist(cells, me) - od;   // from the other side's view
        cells[j] = null;
        if (r > reply) reply = r;
      }
      v = reply === -Infinity ? hexDist(cells, o) - mine : -reply;
    }
    cells[i] = null;
    out.push({ i, v });
  }
  return out;
}
// ---- Hard: iterative deepening negamax with alpha-beta and a transposition table ----
// The board as bytes (0 empty, 1 the searcher, 2 the other side), the distances (hexDist) on it from each
// edge. Only the cells on a shortest path of either side are searched (a move that neither shortens mine
// nor lengthens theirs is wasted on a board this small), a win is a chain of own stones edge to edge. The leaf
// value: the other side's distance less the searcher's (ten a cell), and between equals the side with more
// ways to finish (end cells at its distance). Deeper each round until the time (until: the ms left, checked
// every 256 nodes) or, without a clock, HEX_HARD.depth plies or HEX_HARD.nodes nodes; the last round
// completed is the answer (a forced win or loss ends the rounds early). The table is a fixed array keyed by
// two hashes (Zobrist, from a fixed seed), emptied every call.
export const HEX_HARD = { depth: 8, nodes: 12000, win: 10000 };
// The search's tables for a board of n by n (5x5 now; a 4x4 square from before): the Zobrist keys, the neighbours,
// the edges, the queue and the order the cells are tried in (the middle first: alpha-beta cuts sooner). Made once a size.
export const HEX_ORDER = [5, 10, 6, 9, 1, 2, 13, 14, 4, 8, 7, 11, 0, 3, 12, 15];   // (4x4)
const HTABLES = {};
function hexTables(n) {
  if (HTABLES[n]) return HTABLES[n];
  const HN = n * n;
  const hzob = (() => { let s = 0x7f4a7c15 >>> 0; const t = new Uint32Array(HN * 4); for (let i = 0; i < t.length; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; t[i] = s; } return t; })();
  const HNB = (() => { const at = new Int32Array(HN + 1), of = []; for (let i = 0; i < HN; i++) { at[i] = of.length; for (const k of hexNeighbors(i, n)) of.push(k); } at[HN] = of.length; return { at, of: Int8Array.from(of) }; })();
  const hmask = f => Uint8Array.from({ length: HN }, (_, i) => (f(i) ? 1 : 0));
  const HEDGE = { X: [hmask(i => i % n === 0), hmask(i => i % n === n - 1)], O: [hmask(i => i < n), hmask(i => i >= HN - n)] };
  const mid = (n - 1) / 2, far = i => { const dr = Math.floor(i / n) - mid, dc = i % n - mid; return Math.max(Math.abs(dr), Math.abs(dc), Math.abs(dr + dc)); };   // (hex distance from the middle)
  const order = n === 4 ? HEX_ORDER : Array.from({ length: HN }, (_, i) => i).sort((x, y) => far(x) - far(y) || x - y);
  return (HTABLES[n] = { n, HN, hzob, HNB, HEDGE, order, HQ: new Int8Array(HN * 8), HSEEN: new Uint8Array(HN) });
}
const HTT_N = 1 << 14, HTT = { key: new Float64Array(HTT_N), v: new Int32Array(HTT_N), d: new Int8Array(HTT_N), f: new Int8Array(HTT_N), m: new Int8Array(HTT_N) };
// hexDist on the byte board for side s (the edges those of letter p) from edge `from` (0 its start, 1 its
// end), every cell's distance into dist; returns the distance to the far edge (99: cut off) and the ways
// there (far-edge cells at it) in out.
function hexDistB(T, b, s, p, from, dist, out) {
  const start = T.HEDGE[p][from], end = T.HEDGE[p][1 - from], at = T.HNB.at, of = T.HNB.of, t = 3 - s, HN = T.HN, HQ = T.HQ;
  let qh = 0, qt = 0;
  for (let i = 0; i < HN; i++) { dist[i] = 99; if (start[i] && b[i] !== t) { dist[i] = b[i] === s ? 0 : 1; HQ[qt++] = i; } }
  while (qh < qt) {                                            // (a cell queued again when shortened: 25 cells, it is nothing)
    const i = HQ[qh++], d = dist[i];
    for (let k = at[i], z = at[i + 1]; k < z; k++) { const n = of[k], c = b[n]; if (c === t) continue; const dn = c === s ? d : d + 1; if (dn < dist[n]) { dist[n] = dn; HQ[qt++] = n; } }
  }
  let best = 99, ways = 0;
  for (let i = 0; i < HN; i++) if (end[i]) { const d = dist[i]; if (d < best) { best = d; ways = 1; } else if (d === best) ways++; }
  if (out) { out[0] = best; out[1] = best === 99 ? 0 : ways; }
  return best;
}
function hexJoined(T, b, s, p) {   // a chain of s's stones edge to edge (hexPath on the byte board)
  const start = T.HEDGE[p][0], end = T.HEDGE[p][1], at = T.HNB.at, of = T.HNB.of, HN = T.HN, HQ = T.HQ, HSEEN = T.HSEEN;
  let qh = 0, qt = 0;
  HSEEN.fill(0);
  for (let i = 0; i < HN; i++) if (start[i] && b[i] === s) { HSEEN[i] = 1; HQ[qt++] = i; }
  while (qh < qt) {
    const i = HQ[qh++];
    if (end[i]) return true;
    for (let k = at[i], z = at[i + 1]; k < z; k++) { const n = of[k]; if (b[n] === s && !HSEEN[n]) { HSEEN[n] = 1; HQ[qt++] = n; } }
  }
  return false;
}
// Every empty cell's value for me: the best one exact (from the deepest round completed), the others at most a
// point below it; { moves: [{ i, v }], depth, nodes }.
export function hexHard(cells, me, until = null, cap = HEX_HARD) {
  const T = hexTables(hexSize(cells)), HN = T.HN, hzob = T.hzob, ORDER = T.order;
  const WIN = cap.win, o = other(me), letter = [null, me, o], b = new Uint8Array(HN), ds = [0, 0], dt = [0, 0];
  const D = [new Int8Array(HN), new Int8Array(HN), new Int8Array(HN), new Int8Array(HN)], LIVE = Array.from({ length: HN + 1 }, () => new Int8Array(HN));   // the distances from each edge for each side; the cells searched at each ply
  let h1 = 0, h2 = 0, nodes = 0, stop = false;
  for (let k = 0; k < HN; k++) { const c = cells[k]; if (!c) continue; const s = c === me ? 1 : 2; b[k] = s; h1 ^= hzob[4 * k + s - 1]; h2 ^= hzob[4 * k + s + 1]; }
  HTT.d.fill(-1);
  const set = (k, s) => { b[k] = s; h1 ^= hzob[4 * k + s - 1]; h2 ^= hzob[4 * k + s + 1]; };
  const clear = (k, s) => { b[k] = 0; h1 ^= hzob[4 * k + s - 1]; h2 ^= hzob[4 * k + s + 1]; };
  // the cells on a shortest path of either side, in HEX_ORDER, into live; returns how many (0: nothing left)
  const relevant = (s, live) => {
    const t = 3 - s, S0 = D[0], S1 = D[1], T0 = D[2], T1 = D[3];
    hexDistB(T, b, s, letter[s], 1, S1, null); hexDistB(T, b, t, letter[t], 1, T1, null);
    let n = 0;
    for (let i = 0; i < HN; i++) { const k = ORDER[i]; if (!b[k] && (S0[k] + S1[k] - 1 === ds[0] || T0[k] + T1[k] - 1 === dt[0])) live[n++] = k; }
    if (!n) for (let i = 0; i < HN; i++) { const k = ORDER[i]; if (!b[k]) live[n++] = k; }
    return n;
  };
  const search = (s, depth, alpha, beta, ply) => {   // the value for s, s to move
    if ((++nodes & 255) === 0 && (until ? until() <= 0 : nodes > cap.nodes)) { stop = true; return 0; }
    const key = h1 * 1048576 + (h2 & 0xfffff), x = ((h1 ^ h2) >>> 0) & (HTT_N - 1), hit = HTT.key[x] === key && HTT.d[x] >= 0;
    let first = -1;
    if (hit) {
      if (HTT.d[x] >= depth) {
        const v = HTT.v[x], f = HTT.f[x];
        if (f === 0) return v;
        if (f === 1) { if (v > alpha) alpha = v; } else if (v < beta) beta = v;
        if (alpha >= beta) return v;
      }
      first = HTT.m[x];
    }
    const t = 3 - s;
    hexDistB(T, b, s, letter[s], 0, D[0], ds); hexDistB(T, b, t, letter[t], 0, D[2], dt);
    if (depth === 0) return 10 * (dt[0] - ds[0]) + ds[1] - dt[1];
    const live = LIVE[ply], n = relevant(s, live), a0 = alpha;
    let best = -Infinity, bm = -1;
    for (let i = -1; i < n; i++) {
      const k = i < 0 ? first : live[i];
      if (k < 0 || (i >= 0 && k === first) || b[k]) continue;
      set(k, s);
      const v = hexJoined(T, b, s, letter[s]) ? WIN - ply : -search(t, depth - 1, -beta, -alpha, ply + 1);
      clear(k, s);
      if (stop) return 0;
      if (v > best) { best = v; bm = k; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    if (bm < 0) return 0;
    HTT.key[x] = key; HTT.v[x] = best; HTT.d[x] = depth; HTT.f[x] = best <= a0 ? 2 : best >= beta ? 1 : 0; HTT.m[x] = bm;
    return best;
  };
  const empties = ORDER.filter(k => !b[k]);
  if (!empties.length) return { moves: [], depth: 0, nodes };
  let out = empties.map(k => ({ i: k, v: 0 })), depth = 0;
  const max = until ? empties.length : Math.min(cap.depth, empties.length);
  for (let d = 1; d <= max && !stop; d++) {
    const res = [], top = out[0].i;
    let alpha = -Infinity, bi = -1;
    for (let i = -1; i < empties.length; i++) {
      const k = i < 0 ? top : empties[i];
      if (i >= 0 && k === top) continue;
      set(k, 1);
      let v = hexJoined(T, b, 1, me) ? WIN - 1 : -search(2, d - 1, -Infinity, -alpha, 1);
      clear(k, 1);
      if (stop) break;
      if (v > alpha) { alpha = v; bi = res.length; } else v = Math.min(v, alpha - 1);
      res.push({ i: k, v });
    }
    if (stop) break;
    if (bi > 0) res.unshift(res.splice(bi, 1)[0]);
    out = res; depth = d;
    if (Math.abs(out[0].v) >= WIN - HN) break;                 // decided: no round deeper changes it
  }
  return { moves: out, depth, nodes };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.cells, c => !c));
}
export function flashMs(f, winLen, won) {
  return won ? 900 + (winLen || 4) * 90 : 450;
}
