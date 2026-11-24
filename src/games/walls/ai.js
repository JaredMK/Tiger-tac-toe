// Wall Race: the computer's play. A position is the other pawn's shortest way home less its own (`lead`). Easy steps
// along its shortest way most of the time, else any move. Normal steps along its shortest way; when it is losing the race
// and has a wall, it places the wall that lengthens the other pawn's way most, its own way spared.
// Hard looks ahead: every step and wall and the other side's best reply (within `ctx.until`; deeper by its setting).
import { other } from '../../core/util.js';
import { tune } from '../../core/tune.js';
import { wallGoal, wallPath, wallSpots, wallSteps } from './rules.js';

const clone = m => ({ n: m.n, at: { X: m.at.X.slice(), O: m.at.O.slice() }, walls: m.walls.map(w => w.slice()), left: { X: m.left.X, O: m.left.O } });
const dist = (m, p) => wallPath(m.n, m.walls, m.at[p], p);
// How far ahead `me` is, with `turn` to move (the mover is half a step nearer).
const lead = (m, me, turn) => dist(m, other(me)) - dist(m, me) * 1.02 + (turn === me ? 0.5 : -0.5) + (m.left[me] - m.left[other(me)]) * 0.15;   // (its own way a touch dearer: of two equal leads, the one nearer home, so it always gets there)
function movesOf(m, p) { return wallSteps(m, p).map(s => ({ s })).concat(wallSpots(m, p).map(w => ({ w }))); }
function play(m, p, mv) { const c = clone(m); if (mv.s) c.at[p] = mv.s.slice(); else { c.walls.push(mv.w.slice()); c.left[p]--; } return c; }
function search(m, p, me, depth, until) {
  if (m.at[me][0] === wallGoal(m.n, me)) return 100 + depth; if (m.at[other(me)][0] === wallGoal(m.n, other(me))) return -100 - depth;
  if (depth === 0 || (typeof until === 'function' && until() <= 0)) return lead(m, me, p);
  let best = p === me ? -Infinity : Infinity;
  for (const mv of movesOf(m, p)) { const v = search(play(m, p, mv), other(p), me, depth - 1, until); best = p === me ? Math.max(best, v) : Math.min(best, v); }
  return best;
}
export function needs(pm, p) { return Math.max(1, dist(pm, p)); }
// Each level's play is its settings (meta.js TUNE, Computer: Easy / Normal / Hard): how far it looks (`aiLook<Level>`:
// 0 or 1 its shortest way, 2 or more every step and wall searched that many moves deep, its own and the other side's
// in turn) and, below 2, whether it blocks with walls (`aiBlock<Level>`: losing the race with a wall in hand, the wall
// that lengthens the other way most for the least added to its own). Its stray moves are the mistake rate.
const LV = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const LOOK = { easy: 1, normal: 1, hard: 2 }, BLOCK = { easy: 'on', normal: 'on', hard: 'on' };
export function levelCfg(pm, level) {
  const t = tune(pm), L = LV[level] ? level : 'normal', k = LV[L], n = Number(t['aiLook' + k]);
  return { look: Number.isFinite(n) && t['aiLook' + k] !== '' && t['aiLook' + k] != null ? n : LOOK[L], block: (t['aiBlock' + k] || BLOCK[L]) === 'on' };
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', cfg = levelCfg(pm, level), o = other(me), pick = a => a[Math.floor(rng() * a.length)], m = clone(pm);
  const steps = wallSteps(m, me), dOf = s => wallPath(m.n, m.walls, s, me), near = Math.min(...steps.map(dOf)), on = steps.filter(s => dOf(s) === near);
  const mine = dist(m, me), theirs = dist(m, o), q = mine <= 1 ? 1 : 0.05;
  if (near === 0) return { move: { s: pick(on) }, q: 1 };          // a step onto the far row
  if (cfg.look >= 2) {
    const all = movesOf(m, me).map(mv => ({ mv, v: search(play(m, me, mv), o, me, cfg.look - 1, ctx && ctx.until) + (mv.s ? 0.05 : 0) }));
    const top = Math.max(...all.map(x => x.v)); return { move: pick(all.filter(x => x.v >= top - 1e-9)).mv, q };
  }
  // Blocking: losing the race as it stands (the other pawn gets home first even with our move in hand): the wall that
  // lengthens their way most for the least added to ours, if it lengthens it at all
  if (cfg.block && m.left[me] > 0 && mine > theirs) {
    let bestW = null, bestG = 0.9;
    for (const w of wallSpots(m, me)) { const c = play(m, me, { w }), g = (dist(c, o) - theirs) - (dist(c, me) - mine) * 1.5; if (g > bestG + 1e-9) { bestG = g; bestW = [w]; } else if (bestW && Math.abs(g - bestG) <= 1e-9) bestW.push(w); }
    if (bestW) return { move: { w: pick(bestW) }, q };
  }
  return { move: { s: pick(on) }, q };
}
// A weaker move a person might make (the mistake rate, core/ai.js aiSlip): a step off its shortest way, or a wall put
// down that does little (never in place of a step onto the far row).
export function worse(pm, me, rng, ctx) {
  const m = clone(pm), b = ctx && ctx.best, same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const all = movesOf(m, me).filter(mv => !(b && same(mv, b)));
  if (!all.length || (b && b.s && b.s[0] === wallGoal(m.n, me))) return null;
  const steps = all.filter(mv => mv.s), pool = steps.length && rng() < 0.6 ? steps : all;
  return pool[Math.floor(rng() * pool.length)];
}
