// Pool: the rules (pure: no page, no clock; the server runs the same code).
import { other } from '../../core/util.js';
import { PHYSICS, physLast, physRandom, physRun, physShot } from '../shared/physics.js';
export { physicsMoveFlash as moveFlash } from '../shared/physics.js';

export const POOLG = { aiErr: [0.02, 0.025], hold: 300, pop: 700, order: ['cue', 'x1', 'x2', 'x3', 'o1', 'o2', 'o3', 'black'] };
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
  if (!poolLeft(p, mini)) return { ok: true, outcome: 'win', note: 'cleared' };
  if (!poolLeft(o, mini)) return { ok: true, outcome: 'win', note: 'gift', winner: o };
  const again = own > 0 && !theirs && !scratch;
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
