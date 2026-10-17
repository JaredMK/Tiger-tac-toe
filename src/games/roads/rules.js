// Roads: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { other } from '../../core/util.js';
import { PLACE_MS, randomEmpty } from '../shared/placement.js';

// Roads: a grid of 4x4 dots, 24 lines between them (12 across, then 12 down). A move claims an open line;
// then a random open line is blocked (drawn as the move is made). Once none is open, each player's score is
// their longest road: a trail through their own lines using each line at most once (a corner may be passed
// more than once). Longer road wins; a tie resets the square.
export const ROAD = { n: 4 };
export const ROAD_SEGS = (() => { const out = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) out.push([r * 4 + c, r * 4 + c + 1]); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) out.push([r * 4 + c, (r + 1) * 4 + c]); return out; })();
// The longest trail through p's lines: { len, segs } (the lines in order along it).
export function roadLongest(segs, p) {
  const mine = ROAD_SEGS.map((e, k) => (segs[k] === p ? k : -1)).filter(k => k >= 0);
  if (!mine.length) return { len: 0, segs: [] };
  const at = {};
  for (const k of mine) for (const v of ROAD_SEGS[k]) (at[v] = at[v] || []).push(k);
  const used = {};
  let best = [];
  const walk = (v, path) => {
    if (path.length > best.length) best = path.slice();
    for (const k of at[v] || []) {
      if (used[k]) continue;
      used[k] = true; path.push(k);
      const [a, b] = ROAD_SEGS[k];
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
  const o = other(me), segs = pm.segs, mine0 = roadLongest(segs, me).len, theirs0 = roadLongest(segs, o).len;
  let best = null;
  for (let k = 0; k < segs.length; k++) {
    if (segs[k]) continue;
    const a = segs.slice(); a[k] = me;
    const b = segs.slice(); b[k] = o;
    const gain = roadLongest(a, me).len - mine0, deny = roadLongest(b, o).len - theirs0;
    const touch = ROAD_SEGS[k].some(v => ROAD_SEGS.some((e, j) => segs[j] === me && e.includes(v))) ? 0.3 : 0;
    const v = 2 * gain + 1.2 * deny + touch + (rng ? rng() * 0.05 : 0);
    if (!best || v > best.v) best = { k, v, after: a };
  }
  return best;
}
export function create(type, rng) {
  return { type, segs: new Array(ROAD_SEGS.length).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {   // a line; then a random open line is blocked; once none is open, the longest road
  if (!Number.isInteger(m) || m < 0 || m >= mini.segs.length || mini.segs[m]) return { ok: false, reason: 'bad' };
  mini.segs[m] = p;
  const b = randomEmpty(mini.segs, needRng(rng));
  if (b != null) mini.segs[b] = 'B';
  mini.last = { by: p, seg: m, block: b };
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
  const l = mini.last; flash.road = { seg: l.seg, block: l.block, len: { X: roadLongest(mini.segs, 'X').len, O: roadLongest(mini.segs, 'O').len } }; return;
}
export function flashMs(f, winLen, won) {
  return PLACE_MS.mark + (f.road && f.road.block != null ? PLACE_MS.drop : 0) + PLACE_MS.hold + (won ? 600 : 0);
}
