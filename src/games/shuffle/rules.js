// Shuffleboard: the rules (pure: no page, no clock; the server runs the same code).
// A lane 50 wide and 100 long from the launch line, its last three bands the scoring zones (each `zoneLen` long, worth
// z1, z2, z3 from the nearest: the furthest, at the lane's end, the most). A move is one flick, `{ a, p }`
// (shared/flick.js): the puck is sent `SHUF.reach` times its power up the lane, less for more friction, along its
// angle, give or take the lane's spread (the move's rng: the server's online). Where it stops is its score; short of
// the zones, off the end or off a side: nothing. First to the target takes the square.
// Separate (the default): a lane each, cleared for every flick. Shared (`boards`): one lane and the pucks stay on it:
// a puck that meets another stops there and sends it on (`knock` of what was left of its way), and that one may send
// on another. A puck moved to another zone scores again for its owner; one knocked off costs its owner `knockLoss` of
// what it had scored (half: all of it made the lane a stand-off, each side undoing the other's points). The lane keeps its last `SHUF.keep` pucks. Whoever reaches the target takes the square (both at once: the mover).
import { gaussOf, needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';
import { flickOk } from '../shared/flick.js';

export const SHUF = { w: 50, len: 100, r: 4, reach: 125, slide: 950, knock: 520, hold: 420, keep: 6, chain: 4 };   // (slide: a full flick's time on the lane, ms; knock: a struck puck's)
// A slide's place along its way, 0 to 1, at `ms` into it: it slows to a stop over its full time `d`; one cut short by a
// puck in its way (t1 - t0 under d) is the same slide as far as it got.
export const shufAt = (s, ms) => { const e = v => 1 - (1 - Math.max(0, Math.min(1, v))) ** 2, full = e((s.t1 - s.t0) / s.d); return full <= 0 ? 1 : Math.min(1, e((ms - s.t0) / s.d) / full); };
export function shufCfg(mini) {
  const t = tune(mini), zl = t.zoneLen, z0 = SHUF.len - 3 * zl;
  return { target: t.target, vals: [t.z1, t.z2, t.z3], zl, z0, friction: t.friction, spread: t.spread, knock: t.knock / 100, loss: t.knockLoss / 100, ai: { easy: t.aiErrEasy, normal: t.aiErr, hard: t.aiErrHard }, t };
}
export const shufZone = (c, y) => (y < c.z0 || y > SHUF.len ? -1 : Math.min(2, Math.floor((y - c.z0) / c.zl)));
export const shufPts = (c, x, y) => { const z = x < 0 || x > SHUF.w ? -1 : shufZone(c, y); return z < 0 ? 0 : c.vals[z]; };
export function create(type, rng) { return { type, shared: tuneLive(type).boards === 'shared', score: { X: 0, O: 0 }, pucks: [], n: { X: 0, O: 0 }, last: null }; }
// The flick that sends a puck to a point of the lane (the computer's, the tests'), and where a flick is aimed.
export const shufAim = (c, m) => { const d = m.p * SHUF.reach * 100 / c.friction; return [SHUF.w / 2 + Math.sin(m.a) * d, Math.cos(m.a) * d]; };
export function shufFlickAt(c, x, y) {
  const dx = x - SHUF.w / 2, r3 = v => Math.round(v * 1000) / 1000 + 0;
  return { a: r3(Math.max(-0.75, Math.min(0.75, Math.atan2(dx, Math.max(0.001, y))))), p: r3(Math.max(0, Math.min(1, Math.hypot(dx, y) * c.friction / 100 / SHUF.reach))) };
}
const r1 = v => Math.round(v * 10) / 10 + 0;
const gone = (x, y) => (x < 0 || x > SHUF.w ? 'side' : y > SHUF.len ? 'end' : null);
export function apply(mini, p, m, rng, idx) {
  if (!flickOk(m)) return { ok: false, reason: 'bad' };
  const c = shufCfg(mini), r = needRng(rng), o = p === 'X' ? 'O' : 'X', [ax, ay] = shufAim(c, m), d0 = Math.hypot(ax - SHUF.w / 2, ay);
  const tx = ax + gaussOf(r) * d0 * c.spread / 200, ty = ay + gaussOf(r) * d0 * c.spread / 100;
  const from = { X: mini.score.X, O: mini.score.O }, segs = [], rest = mini.shared ? mini.pucks.map(q => Object.assign({}, q)) : [], was = mini.shared ? mini.pucks.map(q => ({ by: q.by, x: q.x, y: q.y })) : [];
  // the puck's way, and (shared) the pucks it sends on: each a straight slide from where it was to where it stops
  let cur = { id: -1, by: p, x: SHUF.w / 2, y: 0, was: 0 }, gx = tx, gy = ty, t0 = 0, dur = SHUF.slide;
  for (let k = 0; k <= SHUF.chain; k++) {
    const dx = gx - cur.x, dy = gy - cur.y, len = Math.hypot(dx, dy) || 1e-6, ux = dx / len, uy = dy / len;
    let hit = null, at = len;
    if (mini.shared && k < SHUF.chain) rest.forEach((q, i) => {      // the first puck on the way: where the two would touch
      if (i === cur.id || q.out) return;
      const along = (q.x - cur.x) * ux + (q.y - cur.y) * uy, off = Math.abs((q.x - cur.x) * uy - (q.y - cur.y) * ux);
      if (along <= 0 || off >= 2 * SHUF.r) return;
      const touch = along - Math.sqrt(4 * SHUF.r * SHUF.r - off * off);
      if (touch < at && touch >= -0.01) { at = Math.max(0, touch); hit = i; }
    });
    const fr = at / len, u = 1 - Math.sqrt(1 - Math.min(1, fr)), x1 = r1(cur.x + ux * at), y1 = r1(cur.y + uy * at), out = gone(x1, y1);
    segs.push({ id: cur.id, by: cur.by, x0: r1(cur.x), y0: r1(cur.y), x1, y1, t0: Math.round(t0), t1: Math.round(t0 + dur * (hit == null ? 1 : u)), d: Math.round(dur), out, hit: hit != null });
    const pts = out ? 0 : shufPts(c, x1, y1), keep = cur.id >= 0 && out ? cur.was - Math.floor(cur.was * c.loss + 1e-9) : 0;   // (knocked off: its owner keeps what the loss leaves)
    mini.score[cur.by] = Math.max(0, mini.score[cur.by] + pts + keep - cur.was);
    if (cur.id < 0) { if (mini.shared && !out && pts > 0) rest.push({ by: p, x: x1, y: y1, pts, fresh: true }); cur.pts = pts; cur.end = { x: x1, y: y1, out }; }
    else { const q = rest[cur.id]; q.x = x1; q.y = y1; q.pts = pts; if (out || pts <= 0) q.out = true; }
    if (hit == null) break;
    const q = rest[hit], left = (len - at) * c.knock;
    t0 += dur * u; dur = SHUF.knock;
    cur = { id: hit, by: q.by, x: q.x, y: q.y, was: q.pts }; gx = q.x + ux * left; gy = q.y + uy * left;
  }
  const first = segs[0], mine = first.out ? 0 : shufPts(c, first.x1, first.y1);
  if (mini.shared) { const kept = rest.filter(q => !q.out).map(q => ({ by: q.by, x: q.x, y: q.y, pts: q.pts })); mini.pucks = kept.slice(Math.max(0, kept.length - SHUF.keep)); }
  mini.score.X = Math.min(c.target, mini.score.X); mini.score.O = Math.min(c.target, mini.score.O); mini.n[p]++;
  mini.last = { by: p, a: m.a, p: m.p, segs, pts: mine, out: first.out, short: !first.out && mine === 0, from, to: { X: mini.score.X, O: mini.score.O }, was };
  if (mini.score[p] >= c.target) return { ok: true, outcome: 'win', note: 'won' };
  if (mini.score[o] >= c.target) return { ok: true, outcome: 'win', winner: o, note: 'gift' };
  return { ok: true, outcome: 'continue', note: mine > 0 ? 'in' : 'miss' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { const c = shufCfg(mini), r = needRng(rng); return shufFlickAt(c, 15 + r() * 20, c.z0 + r() * 3 * c.zl); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.sb = JSON.parse(JSON.stringify(mini.last)); }
export const shufEnd = l => l.segs.reduce((x, s) => Math.max(x, s.t1), 0);
export function flashMs(f, winLen, won) { return f.sb ? shufEnd(f.sb) + SHUF.hold + (won ? 500 : 0) : 0; }
