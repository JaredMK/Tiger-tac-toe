// Door Drop: the computer's play. Nothing tells the way down from a dead end until a door is tried, so there is no
// real choice among doors nobody has tried: every level picks one of them at random. What a person can see is the
// difference: a way down someone has found on this floor is taken at once, and doors known to be dead ends are left.
// Shared: one tower, every mark is everyone's, so every level plays alike. Separate (the race): the two towers are
// built the same and every move is on show, so Normal and Hard read the other tower's marks too (its way down, its
// dead ends) exactly as a person looking at it could; Easy keeps to its own tower's marks.
import { doorsKnown, doorsMoves, doorsTried } from './rules.js';
import { goAgain } from '../../core/tune.js';

const seenBy = (pm, p, r, level) => (level === 'easy' ? (doorsTried(pm, p)[r] || []).slice() : doorsKnown(pm, p, r));
// The picks a floor still takes: 1 with its way known, else the expected tries among the doors left (the way down
// equally likely behind any of them: (k + 1) / 2).
const floorPicks = row => (row.includes(2) ? 1 : (row.filter(v => v !== 1).length + 1) / 2);
// The turns a side still needs: a pick a turn (with Go again on, a way down keeps the turn, so a turn is a run of
// picks ending at a dead end).
export function needs(pm, p) {
  let picks = 0, dead = 0;
  for (let r = pm.at[p]; r < pm.f; r++) { const row = doorsKnown(pm, p, r); picks += floorPicks(row); if (!row.includes(2)) dead += floorPicks(row) - 1; }
  return Math.max(1, goAgain(pm) ? 1 + dead : picks);
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', r = pm.at[me], all = doorsMoves(pm, me), row = seenBy(pm, me, r, level);
  const known = row.indexOf(2), last = r === pm.f - 1;
  if (known >= 0 && all.includes(known)) return { move: known, q: last ? 1 : 0 };
  const fresh = all.filter(i => !row[i]), from = fresh.length ? fresh : all;
  return { move: from[Math.floor(rng() * from.length)], q: last ? 1 / Math.max(1, from.length) : 0 };
}
