// Headcount: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit, lohi } from '../../core/config.js';
import { randInt, shuffle } from '../../core/random.js';
import { HEAD_DEFAULTS } from './meta.js';
export { attentionCreate as create } from '../shared/attention.js';
export { attentionApply as apply } from '../shared/attention.js';
export { attentionMoveFlash as moveFlash } from '../shared/attention.js';
export { attentionFlashMs as flashMs } from '../shared/attention.js';
export { attentionHide as hide, attentionSecret as secret } from '../shared/attention.js';   // online: a round is the server's until its Start (security review F3)

// Headcount: creatures cross the field; count the ones asked for, not the decoys. Level 1: 14-20 to count
// and a few decoys of another kind, left and right, uneven timing with bunches; level 2: 18-25 and more
// decoys, in all four directions (left, right, up, down) at widely varying speeds, so they cross each
// other's paths often; level 3: 22-30, decoys that look like them (the same creature in a near colour),
// four directions, stopping and starting, in bunches. Every creature crosses the whole field (in from one
// edge, out at the other); two going the same way in the same lane never cover each other (a crossing
// path can: that is the overlap).
export const HEAD = { lanes: 5, size: 11, lead: 400 };                 // the field: 100 across and 100 down, 5 lanes each way; a creature is 11 across
export const HEAD_KINDS = { beetle: ['beetle', 'beetles'], gbeetle: ['green beetle', 'green beetles'], bbeetle: ['blue beetle', 'blue beetles'], ladybird: ['ladybird', 'ladybirds'], mouse: ['mouse', 'mice'], acorn: ['acorn', 'acorns'], leaf: ['leaf', 'leaves'],
  rladybird: ['red ladybird', 'red ladybirds'], oladybird: ['orange ladybird', 'orange ladybirds'], gmouse: ['grey mouse', 'grey mice'], bmouse: ['brown mouse', 'brown mice'], tbeetle: ['teal beetle', 'teal beetles'] };
export const HEAD_THEMES = [                                           // what to count and the decoys, by level (1: another kind; 2: another kind; 3: a look-alike)
  { t: 'beetle', d: 'ladybird', L: [1, 2] }, { t: 'ladybird', d: 'beetle', L: [1, 2] }, { t: 'mouse', d: 'beetle', L: [1, 2] }, { t: 'beetle', d: 'mouse', L: [1, 2] },
  { t: 'gbeetle', d: 'tbeetle', L: [3] }, { t: 'rladybird', d: 'oladybird', L: [3] }, { t: 'gmouse', d: 'bmouse', L: [3] },
];
export const HEAD_LIMITS = {}; for (const L of [1, 2, 3]) Object.assign(HEAD_LIMITS, { ['n' + L + 'lo']: [1, 30, 1], ['n' + L + 'hi']: [1, 30, 1], ['d' + L + 'lo']: [0, 15, 1], ['d' + L + 'hi']: [0, 15, 1], ['cross' + L]: [600, 8000, 10], ['gap' + L]: [120, 3000, 10] });
export const HEAD_KIT = cfgKit(HEAD_DEFAULTS, HEAD_LIMITS, lohi([[`n1lo`, 'n1hi'], ['d1lo', 'd1hi'], ['n2lo', 'n2hi'], ['d2lo', 'd2hi'], ['n3lo', 'n3hi'], ['d3lo', 'd3hi']]));
export const setHeadConfig = HEAD_KIT.set, headConfig = HEAD_KIT.get;
// How far along its way a creature is (0 at the near edge, out of sight, to 1 past the far one), ms into
// the round; null before it starts or after it is gone. Stops (s: [[where, ms]...]) hold it still a while.
export function headU(it, ms) {
  const e = ms - it.t;
  if (e < 0 || e > it.d) return null;
  const stops = it.s || [], move = it.d - stops.reduce((a, [, w]) => a + w, 0);
  let time = 0, u = 0;
  for (const [at, w] of stops) {
    const go = ((at - u) * move);
    if (e <= time + go) return u + (e - time) / move;
    time += go; u = at;
    if (e <= time + w) return u;
    time += w;
  }
  return Math.min(1, u + (e - time) / move);
}
// Where a creature is (its middle, 0-100 along its way across the field), ms into the round.
export function headAt(it, ms) {
  const u = headU(it, ms);
  if (u == null) return null;
  const x = -HEAD.size / 2 + u * (100 + HEAD.size);
  return it.dir > 0 ? x : 100 - x;
}
// The way a creature goes: across ('h': right if dir > 0) or down and up ('v': down if dir > 0).
export const headAxis = (it, r) => it.axis || (r && r.axis) || 'h';
// Its motion as key points [time 0-1, way 0-1], for the page to animate exactly as the engine moves it.
export function headKeys(it) {
  const stops = it.s || [], move = it.d - stops.reduce((a, [, w]) => a + w, 0), out = [[0, 0]];
  let time = 0, u = 0;
  for (const [at, w] of stops) { time += (at - u) * move; u = at; out.push([time / it.d, u]); time += w; out.push([time / it.d, u]); }
  out.push([1, 1]);
  return out;
}
export function headRound(level, rng, cfg) {
  cfg = cfg || headConfig();
  const L = Math.min(level, 2) + 1, pick = (lo, hi) => lo + randInt(rng, hi - lo + 1);
  const n = pick(cfg['n' + L + 'lo'], cfg['n' + L + 'hi']), dn = pick(cfg['d' + L + 'lo'], cfg['d' + L + 'hi']);
  const themes = HEAD_THEMES.filter(x => x.L.includes(L)), th = themes[randInt(rng, themes.length)];
  const kinds = shuffle(Array(n).fill(th.t).concat(Array(dn).fill(th.d)), rng), cross = cfg['cross' + L], gap = cfg['gap' + L];
  const items = [];
  let t = HEAD.lead, bunch = 0;
  const clear = (a, b) => { const t0 = Math.max(a.t, b.t), t1 = Math.min(a.t + a.d, b.t + b.d); for (let m = t0; m <= t1; m += 30) { const xa = headAt(a, m), xb = headAt(b, m); if (xa != null && xb != null && Math.abs(xa - xb) < HEAD.size + 2) return false; } return true; };
  for (const k of kinds) {
    const speed = L === 1 ? 0.85 + rng() * 0.3 : 0.6 + rng() * 0.9;   // level 1: about even; then widely varied
    const stops = L === 3 ? Array.from({ length: 1 + randInt(rng, 2) }, () => [0.2 + rng() * 0.6, 250 + randInt(rng, 400)]).sort((x, y) => x[0] - y[0]).map(([at, w]) => [Math.round(at * 1000) / 1000, w]) : null;
    const d = Math.round(cross * speed * (k.includes('mouse') ? 0.85 : 1)) + (stops ? stops.reduce((a, [, w]) => a + w, 0) : 0);
    const axis = L === 1 || rng() < 0.5 ? 'h' : 'v', dir = rng() < 0.5 ? -1 : 1;   // level 1: across, either way; from level 2: any of the four
    if (stops && stops.length === 2 && stops[1][0] - stops[0][0] < 0.12) stops.pop();
    let it = null;
    for (let tries = 0; !it && tries < 400; tries++) {           // the first lane (in a random order) where it keeps clear of the ones going its way in it; else a moment later
      for (const lane of shuffle([0, 1, 2, 3, 4].slice(0, HEAD.lanes), rng)) { const c = { k, t: Math.round(t), d, lane, dir, axis }; if (stops) c.s = stops; if (items.every(o => o.lane !== lane || o.axis !== axis || clear(o, c))) { it = c; break; } }
      if (!it) t += 60;
    }
    items.push(it);
    if (bunch > 0) { bunch -= 1; t += gap * (0.2 + rng() * 0.2); }   // a bunch: close together
    else { if (rng() < (L === 2 ? 0.2 : 0.3)) bunch = 1 + randInt(rng, 2); t += gap * (0.5 + rng() * 1.1); }   // uneven timing
  }
  const ms = Math.max(...items.map(o => o.t + o.d)) + 250;
  return { level: L - 1, t: th.t, d: dn ? th.d : null, axis: 'mixed', items, ms };
}
export const headAsk = r => `How many ${HEAD_KINDS[r.t][1]}?`;   // the question once the round has crossed
export const headWatch = r => (r.d ? `Count the ${HEAD_KINDS[r.t][1]} only, not the ${HEAD_KINDS[r.d][1]}` : `Count the ${HEAD_KINDS[r.t][1]}`);   // (for the tests and the explainer: the page no longer shows it)
export function publicView(mini) {
  return { type: mini.type, right: { X: mini.right.X, O: mini.right.O }, round: JSON.parse(JSON.stringify(mini.round)) };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';   // counts as wrong
}
