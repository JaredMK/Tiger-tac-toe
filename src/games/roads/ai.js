// Roads: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { randInt, shuffle } from '../../core/random.js';
import { roadCfg, roadGeom, roadLongest, roadPick } from './rules.js';

export function needs(pm, p) {
  const e = pm.segs.filter(c => !c).length; return e ? raceNeeds(roadLongest(pm.segs, p).len - roadLongest(pm.segs, other(p)).len, e / 4, 1.2) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const cf = roadCfg(pm), e = pm.segs.map((w, k) => (w ? -1 : k)).filter(k => k >= 0);
  if (cf.miss && rng() < cf.miss / 100) { const k = e[randInt(rng, e.length)], a = pm.segs.slice(); a[k] = me; return { move: k, after: { type: 'roads', segs: a } }; }   // (the admin's settings: a mistake now and then, any open edge)
  const b = ctx && ctx.level === 'hard' ? (cf.blocks === 1 || cf.blocks === 0 ? roadHard(pm, me, rng, ctx.until, cf.blocks) : roadSearch(pm, me, rng, ctx.until)) : roadPick(pm, me, rng); return { move: b.k, after: { type: 'roads', segs: b.after } };
}

// ---- Hard with two blocks a move (the admin's setting): the search as it was ----
// Every open edge for the mover, then every edge the block could fall on, valued by both roads (the longest
// trails) and the open edges at their ends; then the best few of those edges are looked at a move further:
// the other player's best cut after each of a few sampled blocks (every block, and more candidates, while
// the clock allows). The rule's own result once no edge is open.
const TOP = 5, SAMPLES = 4;
export function roadSearch(pm, me, rng, until) {
  const segs = pm.segs.slice(), E = roadGeom(segs).segs, o = other(me), n = segs.length, cf = roadCfg(pm);
  const open = () => { const a = []; for (let k = 0; k < n; k++) if (!segs[k]) a.push(k); return a; };
  const ends = t => (t.segs.length ? (t.segs.length === 1 ? E[t.segs[0]].slice() : [E[t.segs[0]].find(v => !E[t.segs[1]].includes(v)), E[t.segs[t.segs.length - 1]].find(v => !E[t.segs[t.segs.length - 2]].includes(v))]) : []);
  const ext = t => { const vs = ends(t); let c = 0; for (let k = 0; k < n; k++) if (!segs[k] && (vs.includes(E[k][0]) || vs.includes(E[k][1]))) c++; return c; };
  const evalFor = p => {                                         // the position's value for p
    const a = roadLongest(segs, p), b = roadLongest(segs, other(p));
    if (!segs.includes(null)) return a.len > b.len ? 10 : b.len > a.len ? -10 : 0;
    return a.len - b.len + 0.3 * (ext(a) - ext(b));
  };
  let nodes = 0, out = false;
  const tick = () => { if (until && (++nodes & 63) === 0 && until() <= 0) out = true; };
  const blocks = cf.blocks == null ? 1 : cf.blocks;
  // the value for me after my edge k and the block at b (none: null)
  const after = (k, b, deeper) => {
    segs[k] = me; if (b != null) segs[b] = 'B';
    let v;
    if (!deeper || !segs.includes(null)) v = evalFor(me);
    else {                                                       // the other player's best cut (its own block left out)
      v = Infinity;
      for (let j = 0; j < n && !out; j++) { if (segs[j]) continue; segs[j] = o; const w = -evalFor(o); segs[j] = null; if (w < v) v = w; tick(); }
    }
    if (b != null) segs[b] = null; segs[k] = null;
    return v;
  };
  const e = open();
  const c1 = e.map(k => {                                        // one move: the block counted exactly
    const rest = e.filter(j => j !== k);
    if (!blocks || !rest.length) return { k, v: after(k, null, false) };
    let v = 0; for (const b of rest) { v += after(k, b, false) / rest.length; tick(); if (out) break; }
    return { k, v: out ? -Infinity : v };                        // (the clock: a value not whole is no value)
  }).sort((a, b) => b.v - a.v);
  if (c1[0].v === -Infinity) return done(roadPick(pm, me, null));   // (no time at all: the ordinary pick)
  if (out || e.length <= 2 || !blocks) return done(c1[0]);
  // two moves: the best few edges, the block sampled, the cut found
  const top = c1.slice(0, until ? 2 * TOP : TOP), order = shuffle(e.slice(), rng);
  for (const c of top) { c.s = 0; c.w = 0; }
  for (let s = 0; s < order.length && !out; s++) {
    if (!until && s >= SAMPLES) break;
    for (const c of top) {
      if (out) break;
      const b = order[s]; if (b === c.k) continue;
      const v = after(c.k, b, true);
      if (out) break;
      c.w += v; c.s++;
    }
  }
  let got = null;
  for (const c of top) { const v = c.s ? c.w / c.s : c.v; if (!got || v > got.v) got = { k: c.k, v }; }
  return done(got || c1[0]);
  function done(c) { const after = pm.segs.slice(); after[c.k] = me; return { k: c.k, v: c.v, after }; }
}

// ---- Hard: expectimax over the block, three moves deep, the last edges solved ----
// A move is an edge, then the block on any open edge (each as likely): the mover's best over the average of the blocks,
// the other player's best reply, and so on, within bounds (a move or a block that cannot change the choice is left),
// with the rule's own result where it comes (no edge open: the longer road, a level one a draw; before that, one side
// unable to reach the other's road with every open edge). The leaves are valued as before: both roads' lengths and
// the open edges at their ends (their ways on). What is new is the depth: every edge two moves deep (the block after
// each, the reply), then the best ROAD_AI.top of them three moves deep (my move again), where the search is kept
// narrow: a side with a way on looks at its ways on, the cuts of the other side's and one edge elsewhere; the blocks
// that fall on no road's way on are alike and counted as one. With ROAD_AI.solve edges open or fewer the square is
// solved to its end, exactly (a memo of the positions met): it adds little (the last edges are nearly forced). The
// empty board's edge is found once and kept (FIRST). With a clock: deeper while it allows (to five moves).
// A level end is a draw and the square resets (core/board.js): ROAD_AI.draw is what that is worth to the side that
// moved first in the square, from -1 to 1; 0 holds a reset square as worth half a square to each.
export const ROAD_AI = { solve: 6, draw: 0, c1: 0.3, cap: 4, narrow: 1, scale: 0.5, depth: 3, top: 3, check: 12, clockSolve: 14 };
const GEO = new Map(), FIRST = new Map();                       // a layout's graph; its first edge on the empty board
function roadGraph(segs) {
  const g = roadGeom(segs); let o = GEO.get(g);
  if (!o) {
    const E = g.segs, n = E.length, V = g.pts.length, adj = Array.from({ length: V }, () => []);
    E.forEach(([a, b], k) => { adj[a].push(k); adj[b].push(k); });
    const near = E.map(([a, b], k) => [...new Set(adj[a].concat(adj[b]))].filter(j => j !== k));   // the edges that share a corner with it
    o = { n, V, ea: E.map(e => e[0]), eb: E.map(e => e[1]), adj, near }; GEO.set(g, o);
  }
  return o;
}
export function roadHard(pm, me, rng, until, blocks) {
  const G = roadGraph(pm.segs), n = G.n, V = G.V, ea = G.ea, eb = G.eb, adj = G.adj, o = other(me);
  const own = new Int8Array(n), used = new Uint8Array(n);        // 0 open, 1 mine, 2 theirs, 3 blocked
  let open0 = 0; for (let k = 0; k < n; k++) { const c = pm.segs[k]; own[k] = !c ? 0 : c === me ? 1 : c === o ? 2 : 3; if (!c) open0++; }
  const first = blocks === 1 ? ((n - open0) % 4 === 0 ? 1 : -1) : 0;   // did I move first in the square (a block a move: two edges go each move)
  const tie = -first * ROAD_AI.draw * (n % 4 === 2 || n % 4 === 1 ? 1 : -1);   // a level end, for me: the first mover makes the last move where the edges come to 4k + 2 (or 4k + 1), and the other side starts the square's next game
  const A = ROAD_AI;
  // the longest trail of side s through its edges and up to `extra` open ones, stopped at `goal`
  let top = 0, goal = 99;
  const walk = (v, len, extra, s) => {
    if (len > top) { top = len; if (top >= goal) return true; }
    const a = adj[v];
    for (let i = 0; i < a.length; i++) {
      const k = a[i]; if (used[k]) continue;
      const c = own[k]; if (c !== s && (c !== 0 || extra <= 0)) continue;
      used[k] = 1; const r = walk(ea[k] === v ? eb[k] : ea[k], len + 1, c === s ? extra : extra - 1, s); used[k] = 0;
      if (r) return true;
    }
    return false;
  };
  const longest = (s, extra, g) => { top = 0; goal = g; for (let v = 0; v < V; v++) if (walk(v, 0, extra, s)) break; return top; };
  // the rule's result for me (1, -1, a draw's worth), or null: play on
  let La = 0, Lb = 0;                                            // both roads, as result left them
  const result = open => {
    const a = La = longest(1, 0, 99), b = Lb = longest(2, 0, 99);
    if (!open) return a > b ? 1 : b > a ? -1 : tie;
    if (open > A.check) return null;                             // (most of the board open: nothing is decided yet, near enough)
    if (a > b && longest(2, 99, a) < a) return 1;
    if (b > a && longest(1, 99, b) < b) return -1;
    return null;
  };
  // a road's ends: the corners where side s's longest trails end, stamped in mk (len: its length, from longest)
  const mk1 = new Int32Array(V), mk2 = new Int32Array(V); let stamp = 0;
  const ends = (v, len, s, mk) => {
    if (len === top) mk[v] = stamp;
    const a = adj[v];
    for (let i = 0; i < a.length; i++) { const k = a[i]; if (used[k] || own[k] !== s) continue; used[k] = 1; ends(ea[k] === v ? eb[k] : ea[k], len + 1, s, mk); used[k] = 0; }
  };
  const markEnds = (s, len) => { const mk = s === 1 ? mk1 : mk2; top = len; if (len) for (let v = 0; v < V; v++) ends(v, 0, s, mk); };
  // its ways on: the open edges at those ends (no road yet: any edge starts one)
  const ways = (s, len) => {
    if (!len) return 2;
    const mk = s === 1 ? mk1 : mk2; let c = 0;
    for (let k = 0; k < n; k++) if (!own[k] && (mk[ea[k]] === stamp || mk[eb[k]] === stamp)) c++;
    return c;
  };
  // a position's worth for me, `side` to move next (after result: both roads known)
  const evalv = side => {
    const a = La, b = Lb; stamp++; markEnds(1, a); markEnds(2, b);
    const wa = ways(1, a), wb = ways(2, b);
    const e = a - b + A.c1 * (Math.min(wa, A.cap) - Math.min(wb, A.cap));
    const x = Math.exp(2 * A.scale * e); return 0.95 * (x - 1) / (x + 1);
  };
  let nodes = 0, out = false;
  const tick = () => { if (until && (++nodes & 63) === 0 && until() <= 0) out = true; };
  const memo = new Map();
  const list = []; for (let k = 0; k < n; k++) if (!own[k]) list.push(k);
  const keyOf = side => { let x = 0; for (let i = 0; i < list.length; i++) x = x * 4 + own[list[i]]; return x * 2 + side - 1; };
  // far: an open edge with no road at either corner (the blocks and replies there are alike)
  const far = k => { const nb = G.near[k]; for (let i = 0; i < nb.length; i++) { const c = own[nb[i]]; if (c === 1 || c === 2) return false; } return true; };
  // the open edges for `side`, the likeliest best first: its own roads' ways on, the other side's (the cuts), the edges
  // beside a road, the far ones (in a search cut short, one of them for all)
  const cands = (side, whole, root) => {
    stamp++; markEnds(1, La); markEnds(2, Lb);
    const mine = side === 1 ? mk1 : mk2, theirs = side === 1 ? mk2 : mk1, c0 = [], c1 = [], c2 = [], c3 = [];
    for (let k = 0; k < n; k++) {
      if (own[k]) continue;
      if (mine[ea[k]] === stamp || mine[eb[k]] === stamp) c0.push(k);
      else if (theirs[ea[k]] === stamp || theirs[eb[k]] === stamp) c1.push(k);
      else if (!far(k)) c2.push(k);
      else if (whole || !c3.length) c3.push(k);
    }
    if (!whole && A.narrow && c0.length && !root) return c0.concat(c1, c2.length ? [c2[0]] : c3);   // (a road with a way on: its ways, the cuts, and one edge elsewhere)
    return c0.concat(c1, c2, c3);
  };
  // the value for me with `side` to move, `open` edges open, `depth` moves still searched, within (alpha, beta)
  const node = (side, depth, open, whole, alpha, beta) => {
    const r = result(open); if (r != null) return r;
    if (depth <= 0) return evalv(side);
    let key = 0;
    if (whole) {
      key = keyOf(side); const got = memo.get(key);
      if (got !== undefined) { const f = got & 3, v = (got >> 2) / 1e6 - 2; if (f === 0 || (f === 1 && v >= beta) || (f === 2 && v <= alpha)) return v; }
    }
    tick(); if (out) return 0;
    const cs = cands(side, whole);
    let bestV, a = alpha, b = beta;
    if (side === 1) { bestV = -Infinity; for (let i = 0; i < cs.length; i++) { const k = cs[i]; own[k] = 1; const v = chance(1, depth, open - 1, whole, a, b); own[k] = 0; if (v > bestV) bestV = v; if (bestV > a) a = bestV; if (a >= b || out) break; } }
    else { bestV = Infinity; for (let i = 0; i < cs.length; i++) { const k = cs[i]; own[k] = 2; const v = chance(2, depth, open - 1, whole, a, b); own[k] = 0; if (v < bestV) bestV = v; if (bestV < b) b = bestV; if (a >= b || out) break; } }
    if (whole && !out) memo.set(key, Math.round((bestV + 2) * 1e6) * 4 + (bestV <= alpha ? 2 : bestV >= beta ? 1 : 0));
    return bestV;
  };
  const cold = new Uint8Array(n);                                // the blocks that are alike: on no road's way on (one stands for them all)
  // after side's move: the block (each open edge as likely), then the other side
  const chance = (side, depth, open, whole, alpha, beta) => {
    if (!open || !blocks) return node(3 - side, depth - 1, open, whole, alpha, beta);
    if (!whole && depth <= 1) { const r = result(open); return r != null ? r : evalv(3 - side); }   // (the last move searched: valued before its block)
    let cur = 0, rem = 1, nFar = 0, farK = -1;
    const w = 1 / open;
    if (!whole) {
      if (A.narrow) { result(open); stamp++; markEnds(1, La); markEnds(2, Lb); const st = stamp; for (let k = 0; k < n; k++) { cold[k] = 0; if (own[k]) continue; if (mk1[ea[k]] === st || mk1[eb[k]] === st || mk2[ea[k]] === st || mk2[eb[k]] === st) continue; cold[k] = 1; } }
      else for (let k = 0; k < n; k++) cold[k] = !own[k] && far(k) ? 1 : 0;
      for (let k = 0; k < n; k++) if (cold[k]) { nFar++; if (farK < 0) farK = k; }
    }
    const cd = nFar > 1 ? cold.slice() : null;                   // (the search below marks its own)
    for (let k = 0; k < n; k++) {
      if (own[k]) continue;
      let wk = w;
      if (cd && cd[k]) { if (k !== farK) continue; wk = w * nFar; }
      rem -= wk; if (rem < 1e-12) rem = 0;
      const lo = (alpha - cur - rem) / wk, hi = (beta - cur + rem) / wk;
      own[k] = 3; const x = node(3 - side, depth - 1, open - 1, whole, lo < -1 ? -1 : lo, hi > 1 ? 1 : hi); own[k] = 0;
      if (out) return 0;
      if (x <= lo) return alpha;
      if (x >= hi) return beta;
      cur += wk * x;
    }
    return cur;
  };
  // my move: each edge's value, the best; `only`: the edges to look at (the best few of a shallower search), else all
  // that matter (no road yet: where it starts matters, every edge)
  const pick = (depth, whole, only) => {
    let got = null; const all = [];
    result(open0); const cs = only || cands(1, whole || !A.narrow || !La, true);
    for (let i = 0; i < cs.length && !out; i++) {
      const k = cs[i];
      own[k] = 1;
      const v = chance(1, depth, open0 - 1, whole, got && !A.top ? got.v : -1.001, 1.001);
      own[k] = 0;
      if (out) break;                                            // (the clock: this edge's value is not whole)
      all.push({ k, v });
      if (!got || v > got.v + 1e-9) got = { k, v };
    }
    if (got) got.all = all;
    return got;
  };
  const best = r => r.all.slice().sort((x, y) => y.v - x.v).slice(0, A.top).map(c => c.k);
  let got = null;
  if (!until) {
    if (open0 <= A.solve) got = pick(open0, true);
    else if (open0 === n && FIRST.has(G)) got = { k: FIRST.get(G), v: 0 };   // (the empty board: found once)
    else {
      result(open0);
      const bare = !La && open0 < n;                             // (no road yet, the other side's down: every edge, two moves deep)
      got = pick(2, false);
      if (!bare && A.depth > 2) { const r = pick(A.depth, false, best(got)); if (r) got = r; }
      if (open0 === n) FIRST.set(G, got.k);
    }
  } else {
    for (let d = 1; !out && d <= 2 && d < open0; d++) { const r = pick(d, false); if (!out || !got) got = r; }
    for (let d = 3; !out && got && d <= 5 && d < open0 && open0 > A.solve; d++) { const r = pick(d, false, best(got)); if (!out && r) { r.all = got.all.map(c => r.all.find(x => x.k === c.k) || { k: c.k, v: -2 }); got = r; } }
    if (!out && open0 <= A.clockSolve) { const ex = pick(open0, true); if (!out && ex) got = ex; }   // (time left and few enough edges: the square solved)
  }
  if (!got) return roadSearch(pm, me, rng, null);                // (no time at all: the search as it was, a fixed amount of work)
  const after = pm.segs.slice(); after[got.k] = me;
  return { k: got.k, v: got.v, after };
}
