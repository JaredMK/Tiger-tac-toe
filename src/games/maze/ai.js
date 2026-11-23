// Maze Runner: the computer's play, from what its runner has seen alone (rules.js mazePick): the flag's way once it is
// known; else a way with something left to find, leading on rather than back; Hard takes the way that heads for the
// flag when several lead on, Easy now and then (three picks in ten) any way at all, a dead branch it knows included.
// With energy (November 2026: the squares a turn may run), Normal and Hard plan round what is left of it this turn: a
// way whose next unseen cell it can reach before the energy runs out (Normal, with none such: the nearest frontier, so
// the runner stops nearer it for the next turn), Hard among them the way whose frontier lies nearest the flag; Easy
// pays it no mind.
import { tune } from '../../core/tune.js';
import { mazeGeo, mazeLeft, mazeLive, mazePick, mazeReach, mazeSeen, DIRS, BIT } from './rules.js';

// The flag's way, once seen: the steps to it from the runner (0 on it; null: not known yet).
function flagDist(pm, p) {
  const s = mazeSeen(pm, p), c = pm.at[p], g = mazeGeo(pm);
  if (c === g.flag) return 0;
  for (const d of DIRS) if ((s[c] & BIT[d]) && mazeLive(s, g, c, d).toFlag) { const r = mazeReach(s, g, c, d); return Number.isFinite(r.flag) ? r.flag : 1; }
  return null;
}
// The turns a side still needs: one once it knows the flag's way and can reach it with the energy it has (more turns
// for the rest of the way at a full turn's energy each); else the maze's target turns by the share not yet seen.
export function needs(pm, p) {
  const fd = flagDist(pm, p);
  if (fd != null) { const left = mazeLeft(pm, p); return fd <= left ? 1 : 1 + Math.ceil((fd - left) / pm.cap); }
  const s = mazeSeen(pm, p), unseen = s.filter(v => v < 0).length / s.length;
  return 1 + (tune(pm).turns || 10) * unseen * 0.8;
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', left = mazeLeft(pm, me), fd = flagDist(pm, me);
  return { move: mazePick(mazeSeen(pm, me), mazeGeo(pm), pm.at[me], rng, level, left), q: fd != null && fd <= left ? 1 : 0.12 };
}
