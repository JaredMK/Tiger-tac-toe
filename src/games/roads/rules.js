// Roads: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { other } from '../../core/util.js';
import { PLACE_MS, randomEmpty } from '../shared/placement.js';
import { ROADS_DEFAULTS } from './meta.js';
import { tune } from '../../core/tune.js';

// Roads: a honeycomb of 7 hexagons (one in the middle, a ring of six round it): 24 corners and the 30 edges
// between them are the roads. A move claims an open edge; then a random open edge is blocked (drawn as the
// move is made). Once none is open, each player's score is their longest road: a trail through their own
// edges using each edge at most once (a corner may be passed more than once). Longer road wins; a tie resets
// the square. The admin's config/roads may choose a smaller honeycomb, 4 hexagons in a diamond (16 corners,
// 19 edges). (A square from before the honeycomb: a 4x4 grid of dots, 24 lines; it plays on as it was.)
// Every layout: the corners in a 100 x 100 field (pts), the edges between them (segs); told apart by the
// number of edges, which a square's own segs say.
function honeycomb(cells) {   // flat-top hexagons at axial [q, r], scaled to fill the field with a margin
  const s3 = Math.sqrt(3), centres = cells.map(([q, r]) => [1.5 * q, s3 * (r + q / 2)]);
  const raw = [], idx = new Map(), edges = new Map();
  const vid = (x, y) => { const k = `${Math.round(x * 1000)},${Math.round(y * 1000)}`; if (!idx.has(k)) { idx.set(k, raw.length); raw.push([x, y]); } return idx.get(k); };
  const rings = [];
  for (const [cx, cy] of centres) {
    const v = Array.from({ length: 6 }, (_, i) => vid(cx + Math.cos(i * Math.PI / 3), cy + Math.sin(i * Math.PI / 3)));
    rings.push(v);
    for (let i = 0; i < 6; i++) { const a = Math.min(v[i], v[(i + 1) % 6]), b = Math.max(v[i], v[(i + 1) % 6]); edges.set(a + '-' + b, [a, b]); }
  }
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0, k = 84 / Math.max(w, h);
  const pts0 = raw.map(([x, y]) => [+(50 + (x - x0 - w / 2) * k).toFixed(2), +(50 + (y - y0 - h / 2) * k).toFixed(2)]);
  const order = pts0.map((_, i) => i).sort((a, b) => pts0[a][1] - pts0[b][1] || pts0[a][0] - pts0[b][0]), rank = []; order.forEach((v, j) => { rank[v] = j; });   // corners top to bottom, left to right
  const segs = [...edges.values()].map(([a, b]) => [rank[a], rank[b]].sort((m, n) => m - n)).sort((e, f) => e[0] - f[0] || e[1] - f[1]);
  return { pts: order.map(v => pts0[v]), segs, cells: rings.map(v => v.map(x => rank[x])), unit: k };   // cells: each hexagon's corners, for the drawing
}
const grid = () => { const segs = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) segs.push([r * 4 + c, r * 4 + c + 1]); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) segs.push([r * 4 + c, (r + 1) * 4 + c]); return { pts: Array.from({ length: 16 }, (_, v) => [10 + (v % 4) * 80 / 3, 10 + Math.floor(v / 4) * 80 / 3].map(n => +n.toFixed(2))), segs, cells: [], unit: 80 / 3 }; };
export const ROAD_LAYOUTS = {
  hex7: honeycomb([[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]),   // 24 corners, 30 edges
  hex4: honeycomb([[0, 0], [1, 0], [1, -1], [0, 1]]),                                // a diamond of 4: 16 corners, 19 edges
  grid: grid(),                                                                       // (before the honeycomb) 16 dots, 24 lines
};
export const ROAD_BY_COUNT = Object.fromEntries(Object.entries(ROAD_LAYOUTS).map(([k, g]) => [g.segs.length, k]));
export const roadGeom = segs => ROAD_LAYOUTS[ROAD_BY_COUNT[segs.length]] || ROAD_LAYOUTS.hex7;
export const ROAD = { n: 4 };                                  // (the old grid's side)
export const ROAD_SEGS = ROAD_LAYOUTS.hex7.segs;
// The layout for new squares: the admin's config/roads, read by the page and the server.
export const ROAD_CFG = { cfg: null };
export function roadsNorm(raw) { return { layout: raw && (raw.layout === 'hex7' || raw.layout === 'hex4') ? raw.layout : ROADS_DEFAULTS.layout }; }
export function setRoadsConfig(raw) { ROAD_CFG.cfg = raw && typeof raw === 'object' ? roadsNorm(raw) : null; }
export const roadsConfig = () => Object.assign({}, ROAD_CFG.cfg || ROADS_DEFAULTS);
// A square's own Mini-game Settings (core/tune.js): the edges blocked after each move, the computer's mistakes.
export const roadCfg = m => Object.assign({ blocks: 1, miss: 0 }, tune(m));
// The longest trail through p's lines: { len, segs } (the lines in order along it).
export function roadLongest(segs, p) {
  const E = roadGeom(segs).segs, mine = E.map((e, k) => (segs[k] === p ? k : -1)).filter(k => k >= 0);
  if (!mine.length) return { len: 0, segs: [] };
  const at = {};
  for (const k of mine) for (const v of E[k]) (at[v] = at[v] || []).push(k);
  const used = {};
  let best = [];
  const walk = (v, path) => {
    if (path.length > best.length) best = path.slice();
    for (const k of at[v] || []) {
      if (used[k]) continue;
      used[k] = true; path.push(k);
      const [a, b] = E[k];
      walk(a === v ? b : a, path);
      path.pop(); used[k] = false;
      if (best.length === mine.length) return;
    }
  };
  for (const v of Object.keys(at)) { walk(Number(v), []); if (best.length === mine.length) break; }
  return { len: best.length, segs: best };
}
// The computer: lengthen its own longest road, and take the line that would lengthen the other player's most.
export function roadPick(pm, me, rng) {
  const o = other(me), segs = pm.segs, E = roadGeom(segs).segs, mine0 = roadLongest(segs, me).len, theirs0 = roadLongest(segs, o).len;
  let best = null;
  for (let k = 0; k < segs.length; k++) {
    if (segs[k]) continue;
    const a = segs.slice(); a[k] = me;
    const b = segs.slice(); b[k] = o;
    const gain = roadLongest(a, me).len - mine0, deny = roadLongest(b, o).len - theirs0;
    const touch = E[k].some(v => E.some((e, j) => segs[j] === me && e.includes(v))) ? 0.3 : 0;
    const v = 2 * gain + 1.2 * deny + touch + (rng ? rng() * 0.05 : 0);
    if (!best || v > best.v) best = { k, v, after: a };
  }
  return best;
}
export function create(type, rng) {
  return { type, segs: new Array(ROAD_LAYOUTS[roadsConfig().layout].segs.length).fill(null), last: null };   // (the layout: from the number of edges)
}
export function apply(mini, p, m, rng, idx) {   // a line; then a random open line is blocked; once none is open, the longest road
  if (!Number.isInteger(m) || m < 0 || m >= mini.segs.length || mini.segs[m]) return { ok: false, reason: 'bad' };
  mini.segs[m] = p;
  const r = needRng(rng), nb = roadCfg(mini).blocks, more = [];
  const b = nb ? randomEmpty(mini.segs, r) : null;
  if (b != null) mini.segs[b] = 'B';
  for (let k = 1; k < nb && b != null; k++) { const x = randomEmpty(mini.segs, r); if (x == null) break; mini.segs[x] = 'B'; more.push(x); }   // (the admin's settings: more than one)
  mini.last = Object.assign({ by: p, seg: m, block: b }, more.length ? { more } : {});
  if (mini.segs.includes(null)) return { ok: true, outcome: 'continue', note: 'road' };
  const x = roadLongest(mini.segs, 'X').len, y = roadLongest(mini.segs, 'O').len;
  if (x === y) return { ok: true, outcome: 'draw', note: 'tie' };
  return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
}
export function publicView(mini) {
  return { type: 'roads', segs: mini.segs.slice() };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.segs, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.road = Object.assign({ seg: l.seg, block: l.block, len: { X: roadLongest(mini.segs, 'X').len, O: roadLongest(mini.segs, 'O').len } }, l.more ? { more: l.more.slice() } : {}); return;
}
export function flashMs(f, winLen, won) {
  return PLACE_MS.mark + (f.road && f.road.block != null ? PLACE_MS.drop : 0) + PLACE_MS.hold + (won ? 600 : 0);
}
