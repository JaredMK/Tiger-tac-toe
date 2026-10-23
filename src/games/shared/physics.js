// Mini Golf, Pool and Bowling: what the physics games share (a shot, its run through physics-sim.js, the
// computer's candidates).
import { randomLegalMove } from '../../core/minis.js';
import { gaussOf, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { bowlOpen, bowlTarget } from '../bowling/rules.js';
import { golfLeft, golfNext } from '../golf/rules.js';
import { POOLG, poolMine, poolOwns, poolPow } from '../pool/rules.js';

// ---------- Mini Golf, Pool and Bowling: the physics games (Matter.js, through physics.js) ----------
// The tables, the shots and the recordings live in physics.js (setPhysics registers it: the page once
// Matter.js has loaded from cdnjs, the server and the tests from the module). Without it these three
// are not dealt (dealable), as Trivia is not without its questions. A move is a shot { aim, power }:
// the aim in radians (0 straight up the table), the power 0..1. The shot is played out where the move
// is made (the shooter's phone in a local or friend match, the server in Find Match) and the recording
// goes into the square (last.rec): the other phone replays it, so both see the same thing.
export const PHYS_TYPES = ['golf', 'pool', 'bowling'];
export const PHYSICS = { lib: null };
export function setPhysics(lib) { PHYSICS.lib = lib && typeof lib.run === 'function' ? lib : null; }
export const physicsReady = () => !!PHYSICS.lib;
// A shot as a move: both numbers, the power within 0..1, the aim within a half turn either way (to
// three decimals, so a shot checked twice is the same shot twice).
export function physShot(m) {
  if (!m || typeof m !== 'object') return null;
  const aim = Number(m.aim), power = Number(m.power);
  if (!Number.isFinite(aim) || !Number.isFinite(power) || Math.abs(aim) > 3.143 || power < 0 || power > 1) return null;
  return { aim: Math.round(aim * 1000) / 1000 + 0, power: Math.round(power * 1000) / 1000 + 0 };
}
// An angle brought round into the half turn either way (what a shot's aim must be).
export function wrapAim(a) { a = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return Math.max(-3.141, Math.min(3.141, a)); }
// The aim from a point to a target: 0 is straight up the table (y decreasing), positive is to the right.
export const aimTo = (from, to) => Math.atan2(to[0] - from[0], from[1] - to[1]);
// A square's own settings for its simulation (meta.js TUNE, dealt into the square: mini.tune): Mini Golf's
// cup speed and bumper kick, Pool's and Bowling's full-power speed. None for a square dealt with the defaults.
export function physOpt(mini) {
  if (!mini || !mini.tune) return undefined;
  const t = tune(mini);
  return mini.type === 'golf' ? { holeSpeed: t.holeSpeed, kick: t.kick } : { vMax: t.vMax };
}
// (Bowling's second roll: at the pins the first left standing; the rack as the square has it otherwise.)
const bowlPos = (mini, p) => { const o = mini.type === 'bowling' ? bowlOpen(mini, p) : null; return o ? Object.assign({}, mini, { standing: o.down.map(d => !d) }) : mini; };
export function physRun(mini, p, shot) { return PHYSICS.lib ? PHYSICS.lib.run(mini.type, bowlPos(mini, p), p, shot, physOpt(mini)) : null; }
// Super Chaos's Mini Golf: both balls struck at once (shots: { X, O }, either may be missing).
export function physRunBoth(mini, shots) { return PHYSICS.lib ? PHYSICS.lib.run(mini.type, mini, shots, undefined, physOpt(mini)) : null; }
export const physLast = (p, shot, r, extra) => Object.assign({ by: p, aim: shot.aim, power: shot.power, ms: r.ms, events: r.events, rec: r.rec }, extra);
// What a shot would do, for the computer: the same simulation, scored.
export function physScore(mini, p, r) {
  const L = PHYSICS.lib, o = other(p);
  if (mini.type === 'golf') {
    if (r.result.first === p) return 1000;
    if (r.result.first === o) return -1000;
    return -golfLeft(L.HOLES[mini.hole], r.final[p] || mini.balls[p]);
  }
  if (mini.type === 'pool') {
    const pk = r.result.pocketed, own = pk.filter(id => poolOwns(p, id)).length, theirs = pk.filter(id => poolOwns(o, id)).length;
    if (pk.includes('black')) return -1000;
    let s = own * 100 - theirs * 80 - (pk.includes('cue') ? 250 : 0);   // (a scratch: the white back, and a ball more for the other side)
    if (own && mini.pocketed[p] + own >= POOLG.goal) s += 500;
    if (theirs && mini.pocketed[o] + theirs >= POOLG.goal) s -= 500;
    for (const id of poolMine(p, mini)) if (r.final[id]) s -= Math.min(...L.POOL.pockets.map(([x, y]) => Math.hypot(r.final[id][0] - x, r.final[id][1] - y))) / 10;   // own balls left near pockets
    return s;
  }
  return r.result.knocked * 10 - (r.result.gutter ? 1 : 0);
}
export function physCandidates(mini, p, rng) {
  const L = PHYSICS.lib, out = [];
  if (mini.type === 'golf') {                                 // at the next points of the hole's path, and at the cup, with powers to suit the distance
    const hole = L.HOLES[mini.hole], from = mini.balls[p], k = golfNext(hole, from);
    const targets = [hole.path[k], hole.path[Math.min(k + 1, hole.path.length - 1)], hole.cup];
    for (const t of targets) {
      const a = aimTo(from, t), d = Math.hypot(t[0] - from[0], t[1] - from[1]), base = Math.max(0.15, Math.min(1, Math.pow(d * 1.08 / (L.GOLF.reach || 174), 0.57)));   // (a putt rolls about reach x power^1.7; aimed a little long)
      for (const dp of [0, 0.12, -0.08, 0.25]) out.push({ aim: a, power: base + dp });
      out.push({ aim: a + 0.12, power: base }, { aim: a - 0.12, power: base });
    }
    for (let k2 = 0; k2 < 3; k2++) out.push({ aim: (rng() - 0.5) * Math.PI * 1.6, power: 0.4 + rng() * 0.55 });   // the odd bank shot
  } else if (mini.type === 'pool') {
    const cue = mini.balls.cue, R = L.POOL.ballR, vm = tune(mini).vMax, pow = sp => poolPow(sp, vm);
    for (const id of poolMine(p, mini)) {
      if (mini.down[id]) continue;
      const b = mini.balls[id];
      const pockets = L.POOL.pockets.slice().sort((u, v) => Math.hypot(b[0] - u[0], b[1] - u[1]) - Math.hypot(b[0] - v[0], b[1] - v[1])).slice(0, 2);
      for (const pk of pockets) {
        const dx = b[0] - pk[0], dy = b[1] - pk[1], n = Math.hypot(dx, dy) || 1;
        const ghost = [b[0] + (dx / n) * R * 2, b[1] + (dy / n) * R * 2];    // where the cue ball must be to send it pocketwards
        const a = aimTo(cue, ghost);
        for (const sp of [36, 54, 78]) out.push({ aim: a, power: pow(sp) });
        out.push({ aim: a + 0.03, power: pow(60) }, { aim: a - 0.03, power: pow(60) });
      }
    }
    for (let k = 0; k < 3; k++) out.push({ aim: (rng() - 0.5) * 2.4, power: pow(30 + rng() * 36) });   // a soft safety
  } else {
    const from = L.BOWL.start, open = bowlOpen(mini, p), up = open ? L.BOWL.pins.filter((pt, k) => !open.down[k]) : [];
    const head = up.length ? [up.reduce((s, pt) => s + pt[0], 0) / up.length, up.reduce((s, pt) => s + pt[1], 0) / up.length] : L.BOWL.pins[0];   // the second roll: at the middle of what stands
    const a = aimTo(from, head);
    for (const da of [-0.07, -0.045, -0.025, 0, 0.025, 0.045, 0.07]) out.push({ aim: a + da, power: 0.9 });
    out.push({ aim: a + 0.01, power: 0.75 }, { aim: a - 0.01, power: 0.75 });
  }
  return out.map(s => ({ aim: wrapAim(s.aim), power: Math.max(0.05, Math.min(1, s.power)) }));
}
// The computer's shot: the best of its candidates, then a little error so it is not perfect.
export function physAi(mini, p, rng) {
  const t = tune(mini), err = [t.aiAim / 1000, t.aiPow / 100];   // (the settings' aim error in thousandths of a radian, power error in %: GOLF, POOLG and BOWLG.aiErr by default)
  let best = null;
  for (const c of physCandidates(mini, p, rng)) {
    const r = physRun(mini, p, c);
    if (!r) continue;
    const s = physScore(mini, p, r);
    if (!best || s > best.s) best = { c, s, r };
  }
  if (!best) return { move: randomLegalMove(mini, p, rng), q: 0 };
  const g = () => gaussOf(rng);
  const move = { aim: wrapAim(best.c.aim + g() * err[0]), power: Math.max(0.05, Math.min(1, best.c.power + g() * err[1])) };
  const q = mini.type === 'golf' ? (best.s >= 1000 ? 0.75 : 0.03) : mini.type === 'pool' ? (best.s >= 500 ? 0.55 : best.s >= 100 ? 0.35 : 0.02) : Math.min(0.9, best.s / 100);
  return { move: physShot(move), q };
}
// A random gentle shot: for a player who ran out of time.
export function physRandom(mini, p, rng) {
  const L = PHYSICS.lib;
  if (mini.type === 'golf') {                                 // roughly towards the next point of the hole's path, at a power to suit the distance
    const hole = L.HOLES[mini.hole], from = mini.balls[p], to = hole.path[golfNext(hole, from)], d = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return physShot({ aim: wrapAim(aimTo(from, to) + (rng() - 0.5) * 0.7), power: Math.max(0.2, Math.min(0.75, Math.pow(d / (L.GOLF.reach || 174), 0.57) * (0.7 + rng() * 0.5))) });
  }
  if (mini.type === 'pool') { const ids = poolMine(p, mini).filter(id => !mini.down[id]); const to = ids.length ? mini.balls[ids[randInt(rng, ids.length)]] : L.POOL.start.black; return physShot({ aim: wrapAim(aimTo(mini.balls.cue, to) + (rng() - 0.5) * 0.6), power: poolPow(30 + rng() * 30, tune(mini).vMax) }); }
  return physShot({ aim: (rng() - 0.5) * 0.2, power: 0.5 + rng() * 0.25 });
}
// How many moves the computer reckons it needs in a physics square (for its choice of square).
export function physNeeds(mini, p) {
  if (mini.type === 'golf') { if (mini.holed[p]) return 0; return Math.max(1, 1 + golfLeft(PHYSICS.lib.HOLES[mini.hole], mini.balls[p]) / 60); }
  if (mini.type === 'pool') return Math.max(1, (POOLG.goal - mini.pocketed[p]) * 2);
  return Math.max(1, (bowlTarget(mini) - mini.pins[p]) / 7);   // (about seven pins a frame)
}
export function physicsMoveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.phys = Object.assign(JSON.parse(JSON.stringify(l)), mini.type === 'golf' ? { balls: JSON.parse(JSON.stringify(mini.balls)), hole: mini.hole, holedNow: JSON.parse(JSON.stringify(mini.holed)) } : mini.type === 'pool' ? { pocketedNow: { X: mini.pocketed.X, O: mini.pocketed.O }, down: Object.assign({}, mini.down) } : { pins: { X: mini.pins.X, O: mini.pins.O } }); return;
}
