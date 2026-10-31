// Risky Spins: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt, shuffle } from '../../core/random.js';
import { r3 } from '../../core/util.js';
import { WHEEL_DEFAULTS } from './meta.js';

// ---------- Risky Spins ----------
// Push your luck, like Risky Rolls. Each player has their own points; first to the target wins. Each square deals
// three wheels of 10 equal segments, drawn afresh (and drawn again until every rule holds); some segments are
// skulls (SKULL), the riskier the wheel the more (the admin's lowSkulls < midSkulls < highSkulls), and the riskier
// wheels carry the bigger values:
//   low:  the fewest skulls; values lowLo-lowHi, at least two different; the lowest average;
//   mid:  more skulls; values midLo-midHi (never a 10), its top above low's; its average between;
//   high: the most skulls; values highLo-10, with one or more 10s (tensMin-tensMax: the only wheel with a 10);
// the three averages (of the values, skulls aside) at least `gap` apart. A turn: pick any wheel and spin (the server
// spins online); its points go into the turn's pot (+N), and the same player chooses again: spin (any wheel) or
// Bank. A skull loses the pot and ends the turn; Bank adds the pot to the score and ends it. Once the pot would
// reach the target only Bank is left. The target, the skulls and the ranges are the admin's (config/wheels), copied
// into each square as dealt (v: 2). A square dealt before (no v: its wheels have no skulls) plays by the old rule to
// its end: each spin's points straight onto the score, no pot.
export const WHEELS = ['high', 'mid', 'low'];
export const WHEEL_SEGS = 10;
export const SKULL = -1;
export const WHEEL_LIMITS = { target: [10, 100], lowSkulls: [0, 4], midSkulls: [1, 6], highSkulls: [1, 7], lowLo: [1, 3], lowHi: [2, 6], midLo: [1, 5], midHi: [3, 9], highLo: [1, 8], tensMin: [1, 3], tensMax: [1, 3], gap: [0, 2] };
export const WHEELT = { spin: 1900, hold: 300 };                            // the spin, then the result held
export const WHEEL_CFG = { cfg: null };
export function wheelsNorm(raw) {
  const out = {};
  for (const k of Object.keys(WHEEL_DEFAULTS)) {
    const [lo, hi] = WHEEL_LIMITS[k], x = raw && raw[k] != null ? Number(raw[k]) : NaN;
    out[k] = Number.isFinite(x) && x >= lo && x <= hi ? (k === 'gap' ? Math.round(x * 100) / 100 : Math.round(x)) : WHEEL_DEFAULTS[k];
  }
  if (out.midSkulls <= out.lowSkulls) out.midSkulls = out.lowSkulls + 1;
  if (out.highSkulls <= out.midSkulls) out.highSkulls = Math.min(WHEEL_SEGS - 2, out.midSkulls + 1);
  if (out.tensMax < out.tensMin) out.tensMax = out.tensMin;
  if (out.lowHi <= out.lowLo) out.lowHi = out.lowLo + 1;
  if (out.midHi <= out.lowHi) out.midHi = Math.min(9, out.lowHi + 1);
  if (out.midLo > out.midHi) out.midLo = out.midHi;
  return out;
}
export function setWheelsConfig(raw) { WHEEL_CFG.cfg = raw && typeof raw === 'object' && raw.highSkulls != null ? wheelsNorm(raw) : null; }   // (a config from before the skulls: the defaults)
export const wheelsConfig = () => Object.assign({}, WHEEL_CFG.cfg || WHEEL_DEFAULTS);
export const isSkull = v => v === SKULL;
const values = v => v.filter(x => x !== SKULL);
export const wheelAvg = v => { const x = values(v); return x.length ? x.reduce((t, y) => t + y, 0) / x.length : 0; };
export const skullsOf = v => v.filter(x => x === SKULL).length;
export const pushYourLuck = mini => !!(mini && mini.v === 2);                // (a square dealt before the skulls: the old rule)
// Every rule a wheel set must keep (for the generator, and the tests): the reasons it fails, none if it holds.
export function wheelsCheck(w, g) {
  g = g || WHEEL_DEFAULTS;
  const bad = [], { high, mid, low } = w || {}, ok = v => Array.isArray(v) && v.length === WHEEL_SEGS && v.every(x => x === SKULL || (Number.isInteger(x) && x >= 1 && x <= 10));
  if (!ok(high) || !ok(mid) || !ok(low)) return ['shape'];
  if (skullsOf(low) !== g.lowSkulls || skullsOf(mid) !== g.midSkulls || skullsOf(high) !== g.highSkulls) bad.push('the skulls');
  const tens = high.filter(x => x === 10).length;
  if (tens < g.tensMin || tens > g.tensMax) bad.push('high: its 10s');
  if (values(high).some(x => x < g.highLo)) bad.push('high: its values');
  if (mid.includes(10) || low.includes(10)) bad.push('a 10 off the high wheel');
  if (values(mid).some(x => x < g.midLo || x > g.midHi)) bad.push('mid: its values');
  if (values(low).some(x => x < g.lowLo || x > g.lowHi) || new Set(values(low)).size < 2) bad.push('low: its values');
  if (Math.max(...values(mid)) <= Math.max(...values(low))) bad.push('mid: its top not above low\'s');
  const h = wheelAvg(high), m = wheelAvg(mid), l = wheelAvg(low);
  if (!(m - l >= g.gap - 1e-9 && h - m >= g.gap - 1e-9)) bad.push('the averages: low < mid < high, ' + g.gap + ' apart');
  return bad;
}
// A square's wheels, drawn until every rule holds (a known-good set if the admin's ranges allow none).
export function wheelsDeal(rng, g) {
  g = g || wheelsConfig();
  const pick = (lo, hi) => lo + randInt(rng, hi - lo + 1);
  const wheel = (skulls, vals) => { const out = new Array(WHEEL_SEGS).fill(SKULL), slots = shuffle(Array.from({ length: WHEEL_SEGS }, (_, k) => k), rng); vals.slice(0, WHEEL_SEGS - skulls).forEach((v, k) => { out[slots[k]] = v; }); return out; };
  for (let tries = 0; tries < 4000; tries++) {
    const low = wheel(g.lowSkulls, Array.from({ length: WHEEL_SEGS }, () => pick(g.lowLo, g.lowHi)));
    const mid = wheel(g.midSkulls, Array.from({ length: WHEEL_SEGS }, () => pick(g.midLo, g.midHi)));
    const tens = pick(g.tensMin, g.tensMax), n = WHEEL_SEGS - g.highSkulls;
    const high = wheel(g.highSkulls, Array(Math.min(tens, n)).fill(10).concat(Array.from({ length: Math.max(0, n - tens) }, () => pick(g.highLo, 9))));
    const w = { high, mid, low };
    if (!wheelsCheck(w, g).length) return w;
  }
  const S = SKULL;   // (the admin's ranges allow no set: this one keeps the default rules)
  return { high: [10, S, 6, S, 8, S, 5, S, S, 9], mid: [4, S, 5, 3, S, 6, S, S, 5, 3], low: [2, 3, 1, S, 2, 4, S, 2, 1, 3] };
}
// The spin: a segment at random (all ten the same size), its points (or a skull), and where in it the pointer stops
// (0-1 round the wheel from the top of segment 0, well inside the segment), so both phones show the same landing.
export function wheelSpin(vals, rng) { const k = randInt(rng, vals.length), at = (k + 0.15 + 0.7 * rng()) / vals.length; return { v: vals[k], seg: k, at: r3(at) }; }
export function create(type, rng) {
  const g = wheelsConfig();
  return { type, v: 2, target: g.target, wheels: wheelsDeal(needRng(rng), g), pts: { X: 0, O: 0 }, spins: { X: 0, O: 0 }, turn: null, rest: { high: 0, mid: 0, low: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {
  const t = mini.turn || null, py = pushYourLuck(mini);
  if (m === 'bank') {                                   // the pot onto the score; the turn is over
    if (!py || !t || t.by !== p || !t.pot) return { ok: false, reason: 'nopot' };
    mini.pts[p] += t.pot;
    mini.last = { by: p, kind: 'bank', pot: t.pot, w: null, v: 0 };
    mini.turn = null;
    if (mini.pts[p] >= mini.target) return { ok: true, outcome: 'win', note: 'bank' };   // (a winning bank is still a bank: the phones show it as one)
    return { ok: true, outcome: 'continue', note: 'bank' };
  }
  if (!WHEELS.includes(m)) return { ok: false, reason: 'bad' };
  if (t && t.by !== p) return { ok: false, reason: 'busy' };
  if (t && mini.pts[p] + t.pot >= mini.target) return { ok: false, reason: 'enough' };   // enough to win: only Bank is left
  const s2 = wheelSpin(mini.wheels[m], needRng(rng)), from = (mini.rest && mini.rest[m]) || 0, pot0 = t ? t.pot : 0;
  mini.spins[p] += 1; mini.rest = Object.assign({ high: 0, mid: 0, low: 0 }, mini.rest, { [m]: s2.at });
  if (!py) {                                            // a square from before the skulls: the points straight onto the score
    mini.pts[p] += s2.v;
    mini.last = { by: p, kind: 'spin', w: m, v: s2.v, seg: s2.seg, at: s2.at, from, pot: 0 };
    if (mini.pts[p] >= mini.target) return { ok: true, outcome: 'win', note: 'target' };
    return { ok: true, outcome: 'continue', note: s2.v ? 'points' : 'nothing' };
  }
  if (s2.v === SKULL) {                                 // a skull: the pot is lost, the score is not; the turn is over
    mini.last = { by: p, kind: 'bust', w: m, v: SKULL, seg: s2.seg, at: s2.at, from, pot: pot0 };
    mini.turn = null;
    return { ok: true, outcome: 'continue', note: 'bust' };
  }
  const pot = pot0 + s2.v;
  mini.turn = { by: p, pot, n: (t ? t.n : 0) + 1 };
  mini.last = { by: p, kind: 'spin', w: m, v: s2.v, seg: s2.seg, at: s2.at, from, pot };
  return { ok: true, outcome: 'continue', note: 'points', again: true };
}
export function publicView(mini) {
  return { type: 'wheels', v: mini.v, target: mini.target, wheels: mini.wheels, pts: { X: mini.pts.X, O: mini.pts.O }, spins: { X: mini.spins.X, O: mini.spins.O },
    turn: mini.turn ? { by: mini.turn.by, pot: mini.turn.pot, n: mini.turn.n } : null };
}
export function randomMove(mini, p, rng, from, empties) {
  return pushYourLuck(mini) && mini.turn && mini.turn.by === p && mini.turn.pot ? 'bank' : 'low';   // a pot: bank it; else the low-risk wheel
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.wheel = { kind: l.kind, w: l.w, v: l.v, from: l.from || 0, pot: l.pot || 0, pts: { X: mini.pts.X, O: mini.pts.O }, target: mini.target, py: pushYourLuck(mini) };
  if (l.kind !== 'bank') Object.assign(flash.wheel, { seg: l.seg, at: l.at });   // (a bank spins nothing)
}
export function flashMs(f, winLen, won) {
  if (f.wheel && f.wheel.kind === 'bank') return 1000 + (won ? 600 : 0);
  return WHEELT.spin + WHEELT.hold + (f.wheel && f.wheel.kind === 'bust' ? 500 : 0) + (won ? 600 : 0);
}
// Super Chaos: each wheel spun this round comes to rest where it stopped.
export function scMerge(m, c) {
  m.rest = Object.assign({ high: 0, mid: 0, low: 0 }, c.base.rest);
  for (const p of c.played) for (const [w, at] of Object.entries(c.forks[p].rest || {})) if (at !== (c.base.rest || {})[w]) m.rest[w] = at;
}
