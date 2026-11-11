// Hook-a-Duck: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, shuffle } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ---------- Hook-a-Duck (November 2026; one shared pond, v 2) ----------
// Both players fish in one pond (v 2): `ducks` ducks bobbing about, every one looking the same from above, each with a
// hidden value painted on its bottom: 1 to 5 (`v1`..`v5` ducks of each), or a little rubber boot worth nothing (`boots`
// of them). A move hooks one duck (its slot, 0 to `ducks` - 1, of those still swimming): it is lifted out and turned over,
// its value added to the mover's own total, and it is gone for both. The values stay hidden until a duck is hooked (online
// they stay on the server: secret/hide, the key `vals`; public: which ducks are still in the pond, `left`, every value
// hooked from it so far and by whom, `out`/`outBy`, so what is left of its mix is known to both; which duck holds which is
// not), and since every duck looks alike the choice is pure luck. A pond fished empty is filled again (a fresh deal of the
// same mix, drawn as the move is made: the server online; `refill`). First to `target` wins. "Go again on success" on: a
// duck worth something keeps the turn.
// A square dealt before (no `v`: a pond each, `vals`/`left`/`out` keyed by side) plays on under its old rules to its end:
// pondOf gives each side its own pond there, the one pond here.
export const DUCK = { slots: 12 };                                  // (the most ducks a pond can hold: TUNE `ducks` max)
export const DUCK_DEF = { ducks: 12, v1: 1, v2: 1, v3: 1, v4: 1, v5: 3, boots: 5, target: 12 };   // (the TUNE defaults; tune(mini) holds them too)
export const duckCfg = mini => Object.assign({}, DUCK_DEF, tune(mini));
export const duckShared = mini => (mini.v || 1) >= 2;
// The pond's mix as a list of values (a boot is 0), cut or padded with boots to the pond's size.
export function duckMix(c) {
  const n = Math.max(3, Math.min(DUCK.slots, c.ducks | 0)), out = [];
  for (let v = 5; v >= 1; v--) for (let k = 0; k < Math.max(0, c['v' + v] | 0); k++) out.push(v);
  for (let k = 0; k < Math.max(0, c.boots | 0); k++) out.push(0);
  while (out.length < n) out.push(0);
  return out.slice(0, n);
}
const deal = (c, r) => shuffle(duckMix(c), r);
export function create(type, rng) {
  const c = Object.assign({}, DUCK_DEF, tuneLive(type)), r = needRng(rng), vals = deal(c, r);
  return { type, v: 2, score: { X: 0, O: 0 }, vals, left: vals.map(() => true), got: { X: [], O: [] }, out: [], outBy: [], ponds: 1, last: null };
}
// The pond p fishes in (the shared one; on a square from before, p's own): its left flags and its hooked values.
export function pondOf(mini, p) {
  if (duckShared(mini)) return { left: mini.left || [], out: mini.out || [], outBy: mini.outBy || [] };
  return { left: (mini.left && mini.left[p]) || [], out: (mini.out && mini.out[p]) || [], outBy: [] };
}
export const duckLeft = (mini, p) => pondOf(mini, p).left.map((on, i) => (on ? i : -1)).filter(i => i >= 0);
export function apply(mini, p, m, rng, idx) {
  const shared = duckShared(mini), left = shared ? mini.left : mini.left[p];
  if (!Number.isInteger(m) || m < 0 || !left || m >= left.length || !left[m]) return { ok: false, reason: 'bad' };
  const vals = mini.vals && (shared ? mini.vals : mini.vals[p]);
  if (!vals || !Number.isInteger(vals[m])) return { ok: false, reason: 'secret' };
  const c = duckCfg(mini), v = vals[m], from = mini.score[p];
  left[m] = false;
  mini.score[p] = Math.min(c.target, from + v);
  mini.got[p] = (mini.got[p] || []).concat(v).slice(-12);
  let refill = false;
  if (shared) {
    mini.out = (mini.out || []).concat(v); mini.outBy = (mini.outBy || []).concat(p);   // (the values hooked from the pond so far, and by whom: what is left of its mix is public)
    if (!left.some(Boolean)) {                                   // fished out: a fresh pond, the same mix, its values drawn now
      const nv = deal(c, needRng(rng));
      mini.vals = nv; mini.left = nv.map(() => true); mini.out = []; mini.outBy = []; mini.ponds = (mini.ponds || 1) + 1; refill = true;
    }
  } else {
    if (!mini.out) mini.out = { X: [], O: [] };
    mini.out[p] = (mini.out[p] || []).concat(v);
    if (!left.some(Boolean)) {
      const nv = deal(c, needRng(rng));
      mini.vals[p] = nv; mini.left[p] = nv.map(() => true); mini.out[p] = []; mini.ponds[p] = (mini.ponds[p] || 1) + 1; refill = true;
    }
  }
  mini.last = { by: p, i: m, v, from, to: mini.score[p], refill, n: left.length };
  if (mini.score[p] >= c.target) return { ok: true, outcome: 'win', note: 'won' };
  if (v > 0 && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'duck', again: true };
  return { ok: true, outcome: 'continue', note: v > 0 ? 'duck' : 'boot' };
}
export function publicView(mini) {   // never the values still in the water
  const got = { X: (mini.got.X || []).slice(), O: (mini.got.O || []).slice() }, last = mini.last ? Object.assign({}, mini.last) : null;
  if (duckShared(mini)) return { type: 'duck', v: mini.v, score: { X: mini.score.X, O: mini.score.O }, left: (mini.left || []).slice(), got, out: (mini.out || []).slice(), outBy: (mini.outBy || []).slice(), ponds: mini.ponds || 1, last };
  return { type: 'duck', score: { X: mini.score.X, O: mini.score.O }, left: { X: mini.left.X.slice(), O: mini.left.O.slice() }, got, out: { X: ((mini.out && mini.out.X) || []).slice(), O: ((mini.out && mini.out.O) || []).slice() }, ponds: { X: mini.ponds.X, O: mini.ponds.O }, last };
}
export function secret(mini) {   // the values on the ducks' bottoms
  if (!mini.vals) return null;
  return { vals: Array.isArray(mini.vals) ? mini.vals.slice() : { X: (mini.vals.X || []).slice(), O: (mini.vals.O || []).slice() } };
}
export function hide(m, k, st) { delete m.vals; }
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in: any duck still swimming)
  const l = duckLeft(mini, p);
  return l.length ? l[Math.floor(needRng(rng)() * l.length)] : null;
}
export function canMove(mini) { return true; }
// A timeout: nothing (a move is one hook: a turn not taken is simply missed).
export function timeoutClose(mini, p) { return null; }
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.duck = { i: l.i, v: l.v, from: l.from, to: l.to, refill: l.refill, n: l.n, score: { X: mini.score.X, O: mini.score.O } };
}
// The move's moments (ms from the move): the hook comes down to the duck (`reach`), lifts it (`lift`), turns it over to
// show its bottom (`show`), the total counts on (`score`), the end. A refilled pond's new ducks float in after.
export const DUKT = { reach: 520, lift: 380, flip: 360, hold: 620, refill: 500 };
export function duckTimes(f) {
  const T = DUKT, lift = T.reach, show = lift + T.lift + T.flip;
  return { reach: 0, lift, show, score: show, end: show + T.hold + (f && f.refill ? T.refill : 0) };
}
export function flashMs(f, winLen, won) { return duckTimes(f.duck).end + (won ? 600 : 0); }
