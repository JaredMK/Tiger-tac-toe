// Districts: the rules (pure: no page, no clock; the server runs the same code).
import { makeRng, needRng, randInt, shuffle } from '../../core/random.js';
import { other } from '../../core/util.js';
import { PLACE_MS, randomEmpty } from '../shared/placement.js';

// Districts: a map of 5 regions with 16 spots, each inside a region or on a border (counting for every
// region it touches); every region is touched by an odd number of spots, at least 3. A move places a piece;
// then a grey piece lands on a random empty spot (it counts for nobody), so each player places 4. Once the
// map is full, a region goes to whoever has more pieces touching it (level: nobody's); most regions wins, and
// a tie goes to the player who moved second here. Drawn as a Voronoi map from 5 seeds on a field 100 by 120;
// spots in the regions, on the borders between two and where three meet.
export const DIST = { w: 100, h: 120, regions: 5, minSpots: 15, maxSpots: 17, per: 4, gap: 11, clear: 6.5 };   // per: the spot count a multiple of it (a piece and a grey each move: as many pieces each); clear: how far a spot keeps from every region it does not count for (more than its drawn size)
export const r1d = x => Math.round(x * 10) / 10 + 0;
export function distClip(poly, a, b) {                                   // keep the part of poly closer to a than to b
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = b[0] - a[0], ny = b[1] - a[1];
  const side = p => (p[0] - mx) * nx + (p[1] - my) * ny, out = [];
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
export function distMap(src) {
  const rng = makeRng('map ' + src());   // one draw seeds the map's own generator: a map is always found, however plain the source
  for (let tries = 0; tries < 400; tries++) {
    const seeds = [];
    for (let k = 0; k < 400 && seeds.length < DIST.regions; k++) {
      const p = [12 + rng() * (DIST.w - 24), 12 + rng() * (DIST.h - 24)];
      if (seeds.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) > 34)) seeds.push(p);
    }
    if (seeds.length < DIST.regions) continue;
    const polys = seeds.map((s, i) => seeds.reduce((poly, t, j) => (i === j ? poly : distClip(poly, s, t)), [[0, 0], [DIST.w, 0], [DIST.w, DIST.h], [0, DIST.h]]));
    const near = (p, i) => Math.hypot(p[0] - seeds[i][0], p[1] - seeds[i][1]);
    const touching = p => { const d = seeds.map((_, i) => near(p, i)), m = Math.min(...d); return d.map((x, i) => (x - m < 0.01 ? i : -1)).filter(i => i >= 0); };
    const cand = [];
    // inside each region: its centroid and points part way to its corners
    polys.forEach((poly, i) => {
      const c = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
      cand.push({ p: c, r: [i], kind: 'in' });
      for (const v of poly) { const q = [c[0] + (v[0] - c[0]) * 0.55, c[1] + (v[1] - c[1]) * 0.55]; if (touching(q).length === 1) cand.push({ p: q, r: [i], kind: 'in' }); }
    });
    // on a border between two: the middle of each long enough shared edge; where three meet: the corner
    for (let i = 0; i < polys.length; i++) for (let k = 0; k < polys[i].length; k++) {
      const p = polys[i][k], q = polys[i][(k + 1) % polys[i].length], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const t = touching(mid);
      if (t.length === 2 && t[0] === i && Math.hypot(q[0] - p[0], q[1] - p[1]) >= 14) cand.push({ p: mid, r: t, kind: 'border' });
      const tv = touching(p);
      if (tv.length === 3 && tv[0] === i && p[0] > 3 && p[0] < DIST.w - 3 && p[1] > 3 && p[1] < DIST.h - 3) cand.push({ p, r: tv, kind: 'corner' });
    }
    // only spots that plainly sit in (or on the edge of) the regions they count for: none where a fourth region
    // nearly meets a corner, and none whose drawn circle would reach into a region it does not count for
    const clear = c => polys.every((poly, i) => c.r.includes(i) || distTo(c.p, poly) >= DIST.clear);
    for (let k = cand.length - 1; k >= 0; k--) if (!clear(cand[k])) cand.splice(k, 1);
    // a random choice of them, kept apart, with every region touched an odd number of times (3 or more)
    for (let pick = 0; pick < 60; pick++) {
      const order = shuffle(cand.map((_, k) => k), rng).sort((a, b) => cand[b].r.length - cand[a].r.length), chosen = [];   // border and corner spots first: they count for more regions, so fewer spots do
      const far = c => chosen.every(k => Math.hypot(cand[k].p[0] - c.p[0], cand[k].p[1] - c.p[1]) >= DIST.gap);
      const want = DIST.minSpots + randInt(rng, 3);   // (the mending below may add one or two)
      for (const k of order) { if (chosen.length >= want) break; if (far(cand[k])) chosen.push(k); }
      const count = () => { const n = new Array(DIST.regions).fill(0); for (const k of chosen) for (const r of cand[k].r) n[r]++; return n; };
      // mend the counts: an inside spot changes one region's count by one
      for (let fix = 0; fix < 20; fix++) {
        const n = count(), bad = n.findIndex(x => x < 3 || x % 2 === 0);
        if (bad < 0) break;
        const add = order.find(k => !chosen.includes(k) && cand[k].kind === 'in' && cand[k].r[0] === bad && far(cand[k]));
        const drop = chosen.find(k => cand[k].kind === 'in' && cand[k].r[0] === bad);
        if (n[bad] < 3 || add != null && (n[bad] % 2 === 0) && (chosen.length < DIST.maxSpots || drop == null)) { if (add == null) break; chosen.push(add); }
        else if (drop != null && n[bad] > 3) chosen.splice(chosen.indexOf(drop), 1);
        else if (add != null) chosen.push(add);
        else break;
      }
      const n = count();
      if (chosen.length >= DIST.minSpots && chosen.length <= DIST.maxSpots && chosen.length % DIST.per === 0 && n.every(x => x >= 3 && x % 2 === 1)) {   // (with the greys: both players place as many pieces)
        const spots = chosen.map(k => ({ x: r1d(cand[k].p[0]), y: r1d(cand[k].p[1]), r: cand[k].r.slice().sort((a, b) => a - b) })).sort((a, b) => a.y - b.y || a.x - b.x);
        return { regions: polys.map(poly => poly.map(p => [r1d(p[0]), r1d(p[1])])), spots };
      }
    }
  }
  throw new Error('no map');
}
// The regions' counts and leaders: { X: [...], O: [...], empty: [...], lead: ['X'|'O'|null] }.
// How far a point is from a region (0 inside it).
export function distTo(p, poly) {
  let inside = false, d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if ((b[1] > p[1]) !== (a[1] > p[1]) && p[0] < (a[0] - b[0]) * (p[1] - b[1]) / (a[1] - b[1]) + b[0]) inside = !inside;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
    d = Math.min(d, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return inside ? 0 : d;
}
export function distTally(map, who) {
  const R = map.regions.length, out = { X: new Array(R).fill(0), O: new Array(R).fill(0), empty: new Array(R).fill(0), lead: new Array(R).fill(null) };
  map.spots.forEach((s, k) => { for (const r of s.r) { if (who[k] === 'X') out.X[r]++; else if (who[k] === 'O') out.O[r]++; else if (!who[k]) out.empty[r]++; } });   // (a grey counts for nobody)
  for (let r = 0; r < R; r++) out.lead[r] = out.X[r] > out.O[r] ? 'X' : out.O[r] > out.X[r] ? 'O' : null;
  return out;
}
// The computer's view of a position: a region locked counts whole, an open one by its lead against the spots left.
export function distEval(map, who, me) {
  const t = distTally(map, who), o = other(me);
  let v = 0;
  for (let r = 0; r < map.regions.length; r++) {
    const m = t[me][r], th = t[o][r], e = t.empty[r];
    v += m > th + e ? 1 : th > m + e ? -1 : 0.6 * (m - th) / (e + 1);
  }
  return v;
}
export function distSearch(pm, me, rng) {                               // two moves deep, on the swing regions
  const o = other(me), who = pm.who, empty = who.map((w, k) => (w ? -1 : k)).filter(k => k >= 0);
  let best = null;
  for (const k of empty) {
    const a = who.slice(); a[k] = me;
    let worst = Infinity;
    const rest = a.map((w, j) => (w ? -1 : j)).filter(j => j >= 0);
    if (!rest.length) worst = distEval(pm.map, a, me) * 10;
    for (const j of rest) { const b = a.slice(); b[j] = o; const v = b.includes(null) ? distEval(pm.map, b, me) : distEval(pm.map, b, me) * 10; if (v < worst) worst = v; }
    const v = worst + (rng ? rng() * 0.001 : 0);
    if (!best || v > best.v) best = { k, v, after: a };
  }
  return best;
}
export function create(type, rng) {
  const map = distMap(needRng(rng)); return { type, map, who: new Array(map.spots.length).fill(null), grey: true, last: null };
}
export function apply(mini, p, m, rng, idx) {   // a spot; once the map is full, most regions led
  if (!Number.isInteger(m) || m < 0 || m >= mini.who.length || mini.who[m]) return { ok: false, reason: 'bad' };
  mini.who[m] = p;
  if (!mini.first) mini.first = p;                        // who opened the square: a tie goes to the other player
  const g = mini.grey ? randomEmpty(mini.who, needRng(rng)) : null;   // (a square from before the grey pieces: none)
  if (g != null) mini.who[g] = 'G';
  mini.last = { by: p, spot: m, grey: g };
  if (mini.who.includes(null)) return { ok: true, outcome: 'continue', note: 'place' };
  const t = distTally(mini.map, mini.who), x = t.lead.filter(w => w === 'X').length, y = t.lead.filter(w => w === 'O').length;
  if (x === y) return { ok: true, outcome: 'win', note: 'tiebreak', winner: other(mini.first), counts: { X: x, O: y } };
  return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
}
export function publicView(mini) {
  return { type: 'districts', map: mini.map, who: mini.who.slice() };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.who, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.dist = { spot: l.spot, grey: l.grey == null ? null : l.grey, lead: distTally(mini.map, mini.who).lead }; return;
}
export function flashMs(f, winLen, won) {
  return PLACE_MS.mark + (f.dist && f.dist.grey != null ? PLACE_MS.drop : 0) + PLACE_MS.hold + (won ? 900 : 0);
}
