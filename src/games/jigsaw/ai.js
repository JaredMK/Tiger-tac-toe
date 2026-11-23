// Puzzle Build: the computer's play. It sees what a player sees: the board, and (once drawn) the piece on show, whose
// own cell is public because the picture is. A person finds the place by eye and sometimes gets it wrong; the computer
// stands in for that eye: it puts the piece in its place with a chance by level (TUNE aiEasy / aiNormal / aiHard: its
// share right when there are four or more places the piece could go, the empty cells that touch a piece on the board;
// with fewer to choose between it is surer, and with one it cannot miss), else on a wrong one of those places, the
// nearer the likelier (a near miss, as a person's is). It never runs the piece timer down.
// With `rotate` on it also turns the piece: the right way up with a chance by level (TUNE aiTurnEasy / aiTurnNormal /
// aiTurnHard), else left a quarter turn out either way (twice as likely) or upside down; a wrong turn is a wrong
// placement. (Without the option nothing here changes, the rng's draws included.)
import { goAgain, tune } from '../../core/tune.js';
import { JIG_DRAW, JIG_OUT, jigEdge, jigGot, jigLeft, jigNeed, jigOffer, jigRotOn, jigSize } from './rules.js';

const LEVELS = { easy: 'aiEasy', normal: 'aiNormal', hard: 'aiHard' }, TURNS = { easy: 'aiTurnEasy', normal: 'aiTurnNormal', hard: 'aiTurnHard' };
const WRONG = [1, 1, 2, 3, 3];                                      // a wrong turn: a quarter out either way twice as likely as half a turn
// The chance it leaves a piece the right way up at a level (1 without the option: nothing to turn).
export function jigTurnChance(pm, level) {
  if (!jigRotOn(pm)) return 1;
  return Math.max(0, Math.min(100, Number(tune(pm)[TURNS[level] || TURNS.normal]))) / 100;
}
// The chance of a right placement at a level with `places` places to choose between.
export function jigChance(pm, level, places) {
  if (places <= 1) return 1;
  const miss = 1 - Math.max(0, Math.min(100, Number(tune(pm)[LEVELS[level] || LEVELS.normal]))) / 100;
  return Math.max(1 / places, 1 - miss * Math.min(1.5, (places - 1) / 3));
}
const typical = pm => jigChance(pm, 'normal', Math.min(4, Math.max(1, jigEdge(pm).length))) * jigTurnChance(pm, 'normal');
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
  const c = jigChance(pm, level, offer == null ? Math.min(4, Math.max(1, edge.length)) : edge.length) * jigTurnChance(pm, level), q = k === 1 ? c : goAgain(pm) && k > 1 && k <= jigLeft(pm) ? c ** k : 0;   // q: the chance this turn takes the square
  if (offer == null) return { move: edge.length ? JIG_DRAW : null, q };
  const cell = place(pm, offer, edge, jigChance(pm, level, edge.length), rng);
  if (cell == null) return { move: JIG_OUT, q };                    // (a piece whose cell is not open: cannot be, kept safe)
  if (!jigRotOn(pm)) return { move: { c: cell }, q: cell === offer ? q : 0 };
  const r = rng() < jigTurnChance(pm, level) ? 0 : WRONG[Math.floor(rng() * WRONG.length)];   // (`rotate` on: how it leaves the piece turned)
  return { move: { c: cell, r }, q: cell === offer && r === 0 ? q : 0 };
}
// The cell it puts the piece in: its own with chance c, else a wrong one of the places it could go, the nearer the likelier.
function place(pm, offer, edge, c, rng) {
  const others = edge.filter(i => i !== offer);
  if (!others.length || rng() < c) return edge.includes(offer) ? offer : null;
  const n = jigSize(pm), far = i => Math.abs(Math.floor(i / n) - Math.floor(offer / n)) + Math.abs(i % n - offer % n);
  const w = others.map(i => 1 / (far(i) * far(i)));               // a wrong place: the nearer the likelier
  let x = rng() * w.reduce((a, b) => a + b, 0);
  for (let j = 0; j < others.length; j++) { x -= w[j]; if (x <= 0) return others[j]; }
  return others[others.length - 1];
}
