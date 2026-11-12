// Apple Pick: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';
import { r3 } from '../../core/util.js';

// ---------- Apple Pick ----------
// Each player has their own tree of `target` apples and their own bucket (individual progress, like Risky Rolls:
// no shared board). A move is one spin of the spinner: its segments (`segs`, dealt into the square from the admin's
// settings) are picks of 1 to 4 apples (the number), a BIRD (it takes `birdTakes` apples out of the bucket and
// puts them back on the tree) or a SPILL (the bucket tips: `spillPct` percent of its apples, rounded up, go back
// on the tree). The first to empty their tree (the bucket full to the target) takes the square. Nothing is
// hidden: the spin is drawn where the move is made (the server online), and both phones show the same landing
// (`at`: where in its segment the pointer stops, 0-1 round the wheel). A square keeps its tree count (`bucket`
// is each player's apples in the bucket; the tree holds the rest: appleTree).
export const BIRD = -1, SPILL = -2;
export const APPLET = { spin: 1800, hold: 150, gap: 220, fall: 480, grab: 520, carry: 600, off: 260, tip: 420, roll: 520, right: 380, won: 700 };   // the spin (its wind-up, run and settle: ui/spin.js), then a moment; a pick: each apple's drop (gap apart, fall long); the bird: in to the bucket (grab), up to the tree (carry), away (off); a spill: the bucket tips (tip), the apples roll up to the tree (roll each, gap apart), it rights itself (right); a square won: the burst after the last apple lands
export const APPLE_LIMITS = { target: [4, 30] };
// The spinner's segments from the settings: one list of each kind, dealt round the wheel in turn (1, 3, bird, 2, 4,
// spill, 1, 3, 2, 4 ... with the defaults), so like segments never sit together. Never empty: without a pick at all,
// one of each number.
export function appleSegs(t) {
  const n = k => Math.max(0, Math.round(Number(t && t[k]) || 0));
  const lists = { 1: n('one'), 2: n('two'), 3: n('three'), 4: n('four'), [BIRD]: n('bird'), [SPILL]: n('spill') };
  if (!lists[1] && !lists[2] && !lists[3] && !lists[4]) { lists[1] = lists[2] = lists[3] = lists[4] = 1; }
  const order = [1, 3, BIRD, 2, 4, SPILL], out = [];
  for (let left = true; left;) {
    left = false;
    for (const k of order) if (lists[k] > 0) { out.push(k); lists[k]--; left = left || lists[k] > 0; }
  }
  return out;
}
export const appleTarget = mini => (mini && Number.isInteger(mini.target) && mini.target >= APPLE_LIMITS.target[0] ? mini.target : 10);
export const appleTree = (mini, p) => Math.max(0, appleTarget(mini) - ((mini.bucket && mini.bucket[p]) || 0));   // the apples still on p's tree
export const isBird = v => v === BIRD, isSpill = v => v === SPILL;
// What a segment does to a bucket of b apples (of T): the apples picked, taken or spilled (n, never below 0 or past the target), and the bucket after.
export function appleStep(v, b, T, t) {
  if (v === BIRD) { const n = Math.min(Math.max(1, Math.round(t.birdTakes) || 2), b); return { kind: 'bird', n, bucket: b - n }; }
  if (v === SPILL) { const n = Math.min(b, Math.ceil(b * Math.min(100, Math.max(0, Number(t.spillPct) || 50)) / 100)); return { kind: 'spill', n, bucket: b - n }; }
  const n = Math.max(0, Math.min(v, T - b));
  return { kind: 'pick', n, bucket: b + n };
}
export function create(type, rng) {
  const t = tuneLive(type), T = Math.min(APPLE_LIMITS.target[1], Math.max(APPLE_LIMITS.target[0], Math.round(t.apples) || 10));
  return { type, target: T, segs: appleSegs(t), bucket: { X: 0, O: 0 }, spins: { X: 0, O: 0 }, rest: 0, last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (m !== 'spin') return { ok: false, reason: 'bad' };
  const segs = Array.isArray(mini.segs) && mini.segs.length ? mini.segs : appleSegs(tune(mini)), n = segs.length;
  rng = needRng(rng);
  const k = randInt(rng, n), at = r3((k + 0.15 + 0.7 * rng()) / n), v = segs[k], from = mini.rest || 0;   // the stop well inside its segment
  const T = appleTarget(mini), b0 = (mini.bucket && mini.bucket[p]) || 0, s = appleStep(v, b0, T, tune(mini));
  if (!mini.bucket) mini.bucket = { X: 0, O: 0 };
  if (!mini.spins) mini.spins = { X: 0, O: 0 };
  mini.bucket[p] = s.bucket; mini.spins[p] = (mini.spins[p] || 0) + 1; mini.rest = at;
  mini.last = { by: p, kind: s.kind, seg: k, at, from, v, n: s.n, was: b0, bucket: s.bucket };
  if (s.bucket >= T) return { ok: true, outcome: 'win', note: 'full' };
  return { ok: true, outcome: 'continue', note: s.kind };
}
export function publicView(mini) {
  return { type: 'apple', target: appleTarget(mini), segs: (mini.segs || []).slice(), bucket: { X: (mini.bucket && mini.bucket.X) || 0, O: (mini.bucket && mini.bucket.O) || 0 }, spins: { X: (mini.spins && mini.spins.X) || 0, O: (mini.spins && mini.spins.O) || 0 }, rest: mini.rest || 0, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function randomMove(mini, p, rng, from, empties) { return 'spin'; }   // (the one move; a timeout plays nothing: core/board.js timeoutClose)
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.apple = { by: p, kind: l.kind, seg: l.seg, at: l.at, from: l.from || 0, v: l.v, n: l.n, was: l.was, bucket: l.bucket, target: appleTarget(mini) };
}
// The moments of a move (ms from its start): the wheel stops (landed), the apples start moving (start), the bucket's
// count changes (land: the last apple down, or the bird's or spill's apples off), the move's animation ends (end).
export function appleTimes(a) {
  const landed = APPLET.spin, start = landed + APPLET.hold, n = a ? a.n : 0;
  if (!a || a.kind === 'pick') { const land = start + (n ? (n - 1) * APPLET.gap + APPLET.fall : 0); return { landed, start, land, end: land + (n ? 0 : 200) }; }
  if (a.kind === 'bird') { const grab = start + APPLET.grab, land = grab + APPLET.carry; return { landed, start, grab, land, end: land + APPLET.off }; }
  const tip = start + APPLET.tip, land = tip + (n ? (n - 1) * APPLET.gap + APPLET.roll : 200);   // a spill
  return { landed, start, tip, land, end: land + APPLET.right };
}
// The move's animation, all of it (the result line, "Won by" included, comes after: ui/mini.js flashLine at animMs): the
// spin, then every apple's journey; a square won: its burst after the last apple lands, never cut short.
export function flashMs(f, winLen, won) {
  const t = appleTimes(f.apple);
  return t.end + (won ? APPLET.won : 0);
}
// Super Chaos: the wheel comes to rest where the last spin here stopped it.
export function scMerge(m, c) {
  for (const p of c.played) if (c.forks[p] && c.forks[p].rest !== (c.base.rest || 0)) m.rest = c.forks[p].rest;
}
