// Pool: the rules (pure: no page, no clock; the server runs the same code).
import { other } from '../../core/util.js';
import { goAgain } from '../../core/tune.js';
import { PHYSICS, physLast, physRandom, physRun, physShot } from '../shared/physics.js';
export { physicsMoveFlash as moveFlash } from '../shared/physics.js';

export const POOLG = { aiErr: [0.02, 0.025], hold: 100, pop: 700, order: ['cue', 'x1', 'x2', 'x3', 'o1', 'o2', 'o3', 'black'] };
// Pool's power for a speed (units a second): the meter's level goes with the square root of the speed (physics.js: POOL.curve);
// vMax: the square's full-power speed (its settings), the table's by default.
export const poolPow = (speed, vMax) => Math.min(1, Math.pow(Math.max(0, speed) / (vMax || PHYSICS.lib.POOL.vMax), 1 / (PHYSICS.lib.POOL.curve || 1)));
// Pool's balls by id: the cue, each side's (x1, x2 ... and o1, o2 ...), the black; in that order everywhere (the
// recording, the drawing). A side wins by sinking all of its own on the table (poolLeft: how many are still there; a
// scratch brings a ball back or adds one: poolExtra).
export const poolRank = id => (id === 'cue' ? 0 : id === 'black' ? 3 : id[0] === 'x' ? 1 : 2);
export const poolIds = mini => Object.keys(mini.balls).sort((a, b) => poolRank(a) - poolRank(b) || a.localeCompare(b, 'en', { numeric: true }));
export const poolOwns = (p, id) => id[0] === (p === 'X' ? 'x' : 'o') && id !== 'cue';
export const poolMine = (p, mini) => (mini ? poolIds(mini).filter(id => poolOwns(p, id)) : p === 'X' ? ['x1', 'x2', 'x3'] : ['o1', 'o2', 'o3']);
export function poolExtra(p, mini) {                    // the id of a new extra ball for p (x4, x5 ...)
  const c = p === 'X' ? 'x' : 'o', n = Object.keys(mini.balls).filter(id => id[0] === c && id !== 'cue').map(id => Number(id.slice(1)) || 0);
  return c + (Math.max(0, ...n) + 1);
}
export const poolLeft = (p, mini) => poolMine(p, mini).filter(id => !mini.down[id]).length;
// A free spot for a new ball: the nearest point of a grid to the black's spot that is clear of every ball
// on the table (and of the cue ball's spot), and well away from the pockets.
export function poolFree(mini) {
  const L = PHYSICS.lib, S = L.POOL, R = S.ballR, pts = [];
  for (let x = 14; x <= S.w - 14; x += 6) for (let y = 14; y <= S.h - 14; y += 6) pts.push([x, y]);
  pts.sort((u, v) => Math.hypot(u[0] - S.start.black[0], u[1] - S.start.black[1]) - Math.hypot(v[0] - S.start.black[0], v[1] - S.start.black[1]) || u[0] - v[0] || u[1] - v[1]);
  const taken = poolIds(mini).filter(id => !mini.down[id]).map(id => mini.balls[id]).concat([S.start.cue]);
  return (pts.find(q => taken.every(b => Math.hypot(b[0] - q[0], b[1] - q[1]) > R * 2.6) && S.pockets.every(([x, y, r]) => Math.hypot(x - q[0], y - q[1]) > r + R * 3)) || [S.w / 2, S.h / 2]).slice();
}
// The pool cue ball's spot, or the nearest free spot below it when a ball sits there.
export function poolSpot(mini) {
  const L = PHYSICS.lib, start = L.POOL.start.cue, R = L.POOL.ballR;
  for (let k = 0; k < 20; k++) {
    const y = start[1] + k * R * 2.2;
    if (!poolIds(mini).some(id => id !== 'cue' && !mini.down[id] && Math.hypot(mini.balls[id][0] - start[0], mini.balls[id][1] - y) < R * 2.1)) return [start[0], Math.min(y, L.POOL.h - R - 1)];
  }
  return start.slice();
}
// ---- the aim, worked out (the sight line the table draws while a shot is lined up: games/pool/view.js) ----
// What the cue ball meets first on its way along an aim (0 straight up the table, as a shot's): another ball, a pocket
// or a rail. balls: { id: [x, y] | null } as they stand, the cue among them. Pure geometry on the table's own numbers
// (the rails where a ball's centre turns back, a ball's width from the cloth's edge; a pocket's reach; two balls'
// centres a ball's width apart), so the line drawn is the line played. Returns { kind: 'ball' | 'pocket' | 'rail',
// t (how far the cue ball's centre travels to it), at (its centre there), dir (the aim as a unit vector) } and, for a
// ball: id, n (the unit vector from the cue ball's centre to that ball's at the touch: the way the struck ball sets
// off), cut (how full the hit is: 1 dead on, towards 0 a graze), off (the cue ball's way on from there, a unit vector)
// and share (how much of the speed each keeps: { obj, cue }); for a rail: off (the way it comes off the cushion).
export const POOL_BOUNCE = 0.88;                          // the balls' bounce off each other (physics-sim.js ball)
export function poolSight(balls, aim, S) {
  S = S || PHYSICS.lib.POOL;
  const c = balls && balls.cue;
  if (!c) return null;
  const ux = Math.sin(aim), uy = -Math.cos(aim), R = S.ballR;
  let best = { kind: 'rail', t: Infinity, off: [ux, uy] };
  const rail = (t, nx, ny) => { if (t >= 0 && t < best.t) best = { kind: 'rail', t, off: [nx ? -ux : ux, ny ? -uy : uy] }; };
  if (ux > 1e-9) rail((S.w - R - c[0]) / ux, 1, 0); else if (ux < -1e-9) rail((R - c[0]) / ux, 1, 0);
  if (uy > 1e-9) rail((S.h - R - c[1]) / uy, 0, 1); else if (uy < -1e-9) rail((R - c[1]) / uy, 0, 1);
  const meet = (x, y, reach) => {                                 // how far along the aim the cue ball's centre comes within reach of a point
    const wx = x - c[0], wy = y - c[1], along = wx * ux + wy * uy, off2 = wx * wx + wy * wy - along * along;
    if (off2 >= reach * reach) return Infinity;
    const t = along - Math.sqrt(reach * reach - off2);
    return t < 0 ? (wx * wx + wy * wy < reach * reach ? 0 : Infinity) : t;
  };
  for (const [px, py, pr] of S.pockets) { const t = meet(px, py, pr); if (t < best.t) best = { kind: 'pocket', t, pocket: [px, py, pr] }; }
  for (const id of Object.keys(balls)) {
    const b = balls[id];
    if (id === 'cue' || !b) continue;
    const t = meet(b[0], b[1], 2 * R);
    if (t < best.t) best = { kind: 'ball', t, id };
  }
  best.dir = [ux, uy]; best.at = [c[0] + ux * best.t, c[1] + uy * best.t];
  if (best.kind === 'ball') {
    const b = balls[best.id], nx = (b[0] - best.at[0]) / (2 * R), ny = (b[1] - best.at[1]) / (2 * R), cut = Math.max(0, ux * nx + uy * ny);
    const keep = (1 - POOL_BOUNCE) / 2, tx = ux - cut * nx, ty = uy - cut * ny;   // (equal balls: the struck one takes most of the speed along the line of centres, the cue ball keeps what is across it)
    const ox = tx + keep * cut * nx, oy = ty + keep * cut * ny, ol = Math.hypot(ox, oy);
    best.n = [nx, ny]; best.cut = cut; best.off = ol > 1e-9 ? [ox / ol, oy / ol] : [0, 0]; best.share = { obj: (1 - keep) * cut, cue: ol };
  }
  return best;
}
// How far a ball struck at a power rolls on open cloth before it stops (table units; Infinity: further than the table
// is long, so it reaches whatever is in its way). Measured, not reckoned: the table's own simulation rolls a lone ball
// up an empty table at each power once (in steps of 0.02, until one reaches the far rail), and the powers between are
// read off the line. vMax: the square's full-power speed (its settings).
const REACH = new Map(), REACH_STEP = 0.02;
export function poolReach(power, vMax) {
  const L = PHYSICS.lib;
  if (!L || !L.POOL) return Infinity;
  const S = L.POOL, key = Number(vMax) || S.vMax;
  let tab = REACH.get(key);
  if (!tab) {
    tab = [0];
    const y0 = S.h - S.ballR - 0.5;
    for (let k = 1; k * REACH_STEP <= 1.0001; k++) {
      const r = L.run('pool', { balls: { cue: [S.w / 2, y0] }, down: {} }, 'X', { aim: 0, power: k * REACH_STEP }, { vMax: key });
      if (!r || !r.final.cue || r.events.some(e => e.k === 'wall' || e.k === 'pocket')) break;
      tab.push(y0 - r.final.cue[1]);
    }
    if (REACH.size > 8) REACH.clear();
    REACH.set(key, tab);
  }
  const f = Math.max(0, Math.min(1, Number(power) || 0)) / REACH_STEP, i = Math.floor(f);
  if (i + 1 >= tab.length) return i < tab.length && f - i < 1e-9 ? tab[i] : Infinity;
  return tab[i] + (tab[i + 1] - tab[i]) * (f - i);
}
export function create(type, rng) {   // the fixed layout: the cue ball, three of each colour, the black
  const L = PHYSICS.lib, st = L ? L.POOL.start : { cue: [50, 140], black: [50, 50], x1: [34, 68], x2: [66, 68], x3: [50, 84], o1: [50, 68], o2: [34, 84], o3: [66, 84] };
  return { type, balls: Object.fromEntries(POOLG.order.filter(id => st[id]).map(id => [id, st[id].slice()])), down: {}, pocketed: { X: 0, O: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {   // a shot from the cue ball: own ball down, shoot again; theirs counts for them; the black loses; every scratch returns the cue and puts a ball back for the shooter (one of their own pocketed, else a new extra one; nothing for the other side); all of a side's balls on the table down wins
  const shot = physShot(m);
  if (!shot) return { ok: false, reason: 'bad' };
  const r = physRun(mini, p, shot);
  if (!r) return { ok: false, reason: 'nophys' };
  const o = other(p), pk = r.result.pocketed;
  for (const id of Object.keys(r.final)) { if (r.final[id] === null) mini.down[id] = true; else mini.balls[id] = r.final[id]; }
  const black = pk.includes('black'), scratch = pk.includes('cue'), own = pk.filter(id => poolOwns(p, id)).length, theirs = pk.filter(id => poolOwns(o, id)).length;
  mini.pocketed[p] += own; mini.pocketed[o] += theirs;
  let back = null;
  let added = false;
  if (scratch) {                                          // every scratch: the white back on its spot, and one ball more for the shooter on the table at a free spot: one of their own pocketed balls, or (none down) a new extra one
    delete mini.down.cue; mini.balls.cue = poolSpot(mini);
    back = poolMine(p, mini).find(id => mini.down[id]) || null;
    if (back) { delete mini.down[back]; mini.pocketed[p] = Math.max(0, mini.pocketed[p] - 1); }
    else { back = poolExtra(p, mini); added = true; }
    mini.balls[back] = poolFree(mini);
  }
  mini.last = physLast(p, shot, r, Object.assign({ pocketed: pk.slice(), black, scratch, own, theirs, cue: mini.balls.cue.slice() }, back ? { back, at: mini.balls[back].slice(), added } : {}));
  if (black) return { ok: true, outcome: 'win', note: 'black', winner: o };
  if (!poolLeft(p, mini) && !poolLeft(o, mini)) return { ok: true, outcome: 'draw', note: 'tie' };   // both sides' last balls down on the one shot: a draw, the square resets
  if (!poolLeft(p, mini)) return { ok: true, outcome: 'win', note: 'cleared' };
  if (!poolLeft(o, mini)) return { ok: true, outcome: 'win', note: 'gift', winner: o };
  const again = own > 0 && !theirs && !scratch && goAgain(mini);   // (own ball down: another shot only with "Go again on success" on)
  return Object.assign({ ok: true, outcome: 'continue', note: again ? 'again' : scratch ? 'scratch' : theirs ? 'theirs' : own ? 'own' : 'shot' }, again ? { again: true } : {});
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) delete c.last.rec; return c;
}
export function randomMove(mini, p, rng, from, empties) {
  return physRandom(mini, p, rng);   // a random gentle shot
}
export function flashMs(f, winLen, won) {
  return (f.phys ? f.phys.ms : 3000) + (f.phys && f.phys.back ? POOLG.pop : 0) + POOLG.hold + (won ? 600 : 0);   // (a scratch's ball popping back onto the table, after the shot: ui/physics.js poolPop)
}
