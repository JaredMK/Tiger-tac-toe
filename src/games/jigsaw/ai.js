// Puzzle Build: the computer's play. It sees what a player sees: the board, and (once drawn) the piece on show, whose
// own cell is public because the picture is. A person finds the place by eye and sometimes gets it wrong; the computer
// stands in for that eye: it puts the piece in its place with a chance by level (TUNE aiEasy / aiNormal / aiHard: its
// share right when there are four or more places the piece could go, the empty cells that touch a piece on the board;
// with fewer to choose between it is surer, and with one it cannot miss), else on a wrong one of those places, the
// nearer the likelier (a near miss, as a person's is). It never runs the piece timer down.
import { goAgain, tune } from '../../core/tune.js';
import { JIG_DRAW, JIG_OUT, jigEdge, jigGot, jigLeft, jigNeed, jigOffer, jigSize } from './rules.js';

const LEVELS = { easy: 'aiEasy', normal: 'aiNormal', hard: 'aiHard' };
// The chance of a right placement at a level with `places` places to choose between.
export function jigChance(pm, level, places) {
  if (places <= 1) return 1;
  const miss = 1 - Math.max(0, Math.min(100, Number(tune(pm)[LEVELS[level] || LEVELS.normal]))) / 100;
  return Math.max(1 / places, 1 - miss * Math.min(1.5, (places - 1) / 3));
}
const typical = pm => jigChance(pm, 'normal', Math.min(4, Math.max(1, jigEdge(pm).length)));
// The turns p still needs: the pieces short of more than half over a turn's chance of one (with "Go again" on, a turn
// lays pieces until a miss). A side that cannot get there any more: a long way off.
export function needs(pm, p) {
  const k = jigNeed(pm) - jigGot(pm)[p];
  if (k <= 0) return 1;
  if (k > jigLeft(pm)) return 9;
  const c = typical(pm);
  return Math.max(1, goAgain(pm) ? k * (1 - c) / Math.max(0.05, c) : k / c);
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', offer = jigOffer(pm), k = jigNeed(pm) - jigGot(pm)[me], edge = jigEdge(pm);
  const c = jigChance(pm, level, offer == null ? Math.min(4, Math.max(1, edge.length)) : edge.length), q = k === 1 ? c : goAgain(pm) && k > 1 && k <= jigLeft(pm) ? c ** k : 0;   // q: the chance this turn takes the square
  if (offer == null) return { move: edge.length ? JIG_DRAW : null, q };
  const others = edge.filter(i => i !== offer);
  if (!others.length || rng() < c) return { move: edge.includes(offer) ? { c: offer } : JIG_OUT, q };   // (a piece whose cell is not open: cannot be, kept safe)
  const n = jigSize(pm), far = i => Math.abs(Math.floor(i / n) - Math.floor(offer / n)) + Math.abs(i % n - offer % n);
  const w = others.map(i => 1 / (far(i) * far(i)));               // a wrong place: the nearer the likelier
  let x = rng() * w.reduce((a, b) => a + b, 0);
  for (let j = 0; j < others.length; j++) { x -= w[j]; if (x <= 0) return { move: { c: others[j] }, q: 0 }; }
  return { move: { c: others[others.length - 1] }, q: 0 };
}
