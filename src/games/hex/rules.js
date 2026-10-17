// Hex: the rules (pure: no page, no clock; the server runs the same code).
import { other } from '../../core/util.js';

export const HEX_N = 4;
// Hex: rows are shifted half a cell to the right, so (r, c) touches (r-1, c+1) and (r+1, c-1) as well as the four orthogonal cells.
export function hexNeighbors(i) {
  const r = Math.floor(i / HEX_N), c = i % HEX_N, out = [];
  for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, 1], [1, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < HEX_N && cc >= 0 && cc < HEX_N) out.push(rr * HEX_N + cc);
  }
  return out;
}
// Breadth-first search from X's left edge (or O's top edge); returns the connecting path or null.
export function hexPath(cells, p) {
  const isStart = p === 'X' ? i => i % HEX_N === 0 : i => i < HEX_N;
  const isEnd = p === 'X' ? i => i % HEX_N === HEX_N - 1 : i => i >= HEX_N * (HEX_N - 1);
  const parent = new Map(), queue = [];
  for (let i = 0; i < HEX_N * HEX_N; i++) if (cells[i] === p && isStart(i)) { parent.set(i, -1); queue.push(i); }
  while (queue.length) {
    const i = queue.shift();
    if (isEnd(i)) { const path = []; for (let k = i; k !== -1; k = parent.get(k)) path.push(k); return path; }
    for (const n of hexNeighbors(i)) if (cells[n] === p && !parent.has(n)) { parent.set(n, i); queue.push(n); }
  }
  return null;
}
export function create(type, rng) {
  return { type, cells: new Array(HEX_N * HEX_N).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (!idx(HEX_N * HEX_N)) return { ok: false, reason: 'bad' };
  if (mini.cells[m]) return { ok: false, reason: 'taken' };
  mini.cells[m] = p; mini.last = m;
  const path = hexPath(mini.cells, p);
  if (path) return { ok: true, outcome: 'win', cells: path };
  if (mini.cells.every(Boolean)) return { ok: true, outcome: 'draw' };   // cannot happen in Hex; kept for safety
  return { ok: true, outcome: 'continue' };
}
export function publicView(mini) {
  return { type: mini.type, cells: mini.cells.slice() };
}
// Hex: the fewest empty cells p still needs to connect its two edges (0 = connected, Infinity = cut off).
export function hexDist(cells, p) {
  const N = HEX_N * HEX_N, o = other(p), dist = new Array(N).fill(Infinity);
  const isStart = p === 'X' ? i => i % HEX_N === 0 : i => i < HEX_N;
  const isEnd = p === 'X' ? i => i % HEX_N === HEX_N - 1 : i => i >= HEX_N * (HEX_N - 1);
  const cost = i => (cells[i] === p ? 0 : cells[i] === o ? Infinity : 1);
  for (let i = 0; i < N; i++) if (isStart(i)) dist[i] = cost(i);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < N; i++) {
      if (dist[i] === Infinity) continue;
      for (const n of hexNeighbors(i)) { const d = dist[i] + cost(n); if (d < dist[n]) { dist[n] = d; changed = true; } }
    }
  }
  let best = Infinity;
  for (let i = 0; i < N; i++) if (isEnd(i) && dist[i] < best) best = dist[i];
  return best;
}
export function hexMoves(cells, me) {   // win and block detection through connection distances, looking one reply ahead
  const o = other(me), N = HEX_N * HEX_N, out = [];
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
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.cells, c => !c));
}
export function flashMs(f, winLen, won) {
  return won ? 900 + (winLen || 4) * 90 : 450;
}
