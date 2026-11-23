// Door Drop: the computer's play. Nothing tells the way down from a dead end until a door is tried, so there is no
// real choice among doors nothing is known of: every level picks one of them at random. What a person can see is the
// difference: a way down someone has found on this floor is taken at once, doors known to be dead ends are left, and
// so is a door a runner has come out of (a dead end only ever leads to another dead end, and the links never change:
// that door is one too, though nobody has gone in at it).
// A square from before v 3 (every door marked on screen): shared: one tower, every mark is everyone's. Separate (the race): the two towers are built the same and every move
// is on show, so Normal and Hard read the other tower's marks too (its way down, its dead ends) exactly as a person
// looking at it could; Easy keeps to its own tower's marks and does not think about where a runner came out.
// No memory aids (v 3, November 2026): nothing tried is drawn, so a person has to remember, and so does the computer:
// the levels differ by memory. What it can remember is only what anyone watching saw (its own tries, the other
// runner's, every door a runner came out of: the record's public marks, never the hidden way down), and at each pick
// every door it knows something of is forgotten with its level's chance (`forgetHard` 0: Hard remembers everything;
// `forget` Normal, a small chance; `forgetEasy` a lot). A forgotten door is a door like any other: it may be tried
// again (a dead end again: the turn wasted), and a way down seen and forgotten has to be found again.
import { doorsExits, doorsKnown, doorsMoves, doorsOpenAll, doorsTried } from './rules.js';
import { goAgain, tune } from '../../core/tune.js';

// Floor r as a level sees it: 2 the way down, 1 a dead end (tried, or known by the door a runner came out of), 0 open.
function seenBy(pm, p, r, level) {
  if (level === 'easy') return (doorsTried(pm, p)[r] || []).slice();
  const row = doorsKnown(pm, p, r), ex = doorsExits(pm, r);
  return row.map((v, i) => v || (ex[i] ? 1 : 0));
}
// The picks a floor still takes: 1 with its way known, else the expected tries among the n doors left (the way down
// equally likely behind any of them). With the links a miss shows a second dead end, the door the runner comes out
// of: e(n) = 1 + (n - 1) / n * e(n - 2); a square from before them: (n + 1) / 2.
const tries = (n, links) => (n <= 1 ? 1 : !links ? (n + 1) / 2 : 1 + ((n - 1) / n) * tries(Math.max(1, n - 2), true));
const floorPicks = (row, links) => (row.includes(2) ? 1 : tries(row.filter(v => v !== 1).length, links));
// The turns a side still needs: a pick a turn (with Go again on, a way down keeps the turn, so a turn is a run of
// picks ending at a dead end).
export function needs(pm, p) {
  let picks = 0, dead = 0;
  for (let r = pm.at[p]; r < pm.f; r++) { const row = seenBy(pm, p, r, 'normal'), n = floorPicks(row, !!pm.seen); picks += n; dead += n - 1; }
  return Math.max(1, goAgain(pm) ? 1 + dead : picks);
}
// The chance (0..1) a level forgets a door it knows something of, at each pick (v 3).
export function forgetOf(pm, level) {
  const t = tune(pm), k = level === 'hard' ? 'forgetHard' : level === 'easy' ? 'forgetEasy' : 'forget', d = { forget: 10, forgetHard: 0, forgetEasy: 40 }[k];
  const v = Number(t[k]); return Math.max(0, Math.min(100, Number.isFinite(v) ? v : d)) / 100;
}
// Floor r as the computer remembers it now (v 3): every level sees what anyone could (as Normal's `seenBy`), and each
// door known is forgotten with the level's chance.
function remembered(pm, p, r, level, rng) {
  const f = forgetOf(pm, level), row = seenBy(pm, p, r, 'normal');
  return f > 0 ? row.map(v => (v && rng() < f ? 0 : v)) : row;
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', r = pm.at[me], all = doorsMoves(pm, me), row = doorsOpenAll(pm) ? remembered(pm, me, r, level, rng) : seenBy(pm, me, r, level);
  const known = row.indexOf(2), last = r === pm.f - 1;
  if (known >= 0 && all.includes(known)) return { move: known, q: last ? 1 : 0 };
  const fresh = all.filter(i => !row[i]), from = fresh.length ? fresh : all;
  return { move: from[Math.floor(rng() * from.length)], q: last ? 1 / Math.max(1, from.length) : 0 };
}
