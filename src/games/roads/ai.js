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
  const b = ctx && ctx.level === 'hard' ? roadSearch(pm, me, rng, ctx.until) : roadPick(pm, me, rng); return { move: b.k, after: { type: 'roads', segs: b.after } };
}

// ---- Hard: expectimax over the block, the other player's cut ----
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
    return { k, v };
  }).sort((a, b) => b.v - a.v);
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
