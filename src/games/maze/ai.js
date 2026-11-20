// Maze Runner: the computer's play, from what its runner has seen alone (rules.js mazePick): the flag's way once it is
// known; else a way with something left to find, leading on rather than back; Hard takes the way that heads for the
// flag when several lead on, Easy now and then (three picks in ten) any way at all, a dead branch it knows included.
import { tune } from '../../core/tune.js';
import { mazeFlag, mazeLive, mazePick, mazeSeen, DIRS, BIT } from './rules.js';

const flagKnown = (pm, p) => { const s = mazeSeen(pm, p), c = pm.at[p]; return DIRS.some(d => (s[c] & BIT[d]) && mazeLive(s, pm.w, c, d).toFlag) || c === mazeFlag(pm.w); };
// The turns a side still needs: one once it knows the flag's way; else the maze's target turns by the share not yet seen.
export function needs(pm, p) {
  if (flagKnown(pm, p)) return 1;
  const s = mazeSeen(pm, p), unseen = s.filter(v => v < 0).length / s.length;
  return 1 + (tune(pm).turns || 6) * unseen * 0.8;
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal';
  return { move: mazePick(mazeSeen(pm, me), pm.w, pm.at[me], rng, level), q: flagKnown(pm, me) ? 1 : 0.12 };
}
