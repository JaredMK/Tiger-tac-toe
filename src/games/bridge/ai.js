// Glass Bridge: the computer's play. Nothing tells safe glass from weak until it is stepped on, so every level takes a
// platform known to hold when the next row has one and otherwise picks among the ones not yet tried; Easy now and then
// (one hop in four) picks at random among everything still there, even with safe glass on show.
import { bridgeMoves, bridgeSeen } from './rules.js';

const GUESS = 0.45;                                                // a hop onto glass nobody has tried holds a little under half the time (two or three platforms, one or two weak)
const aheadOf = (pm, p) => bridgeSeen(pm, p).slice(pm.at[p] + 1);
// The turns a side still needs: this one, and one more for about every other row with no safe glass known.
export function needs(pm, p) { return 1 + aheadOf(pm, p).filter(r => !r.includes(1)).length * 0.55; }
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', all = bridgeMoves(pm, me), row = bridgeSeen(pm, me)[pm.at[me] + 1] || [];
  const safe = row.indexOf(1), q = aheadOf(pm, me).reduce((x, r) => x * (r.includes(1) ? 1 : GUESS), 1);
  if (safe >= 0 && !(level === 'easy' && rng() < 0.25)) return { move: safe, q };
  const fresh = all.filter(i => row[i] === 0), from = level === 'easy' || !fresh.length ? all : fresh;
  return { move: from[Math.floor(rng() * from.length)], q };
}
