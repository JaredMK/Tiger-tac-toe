// Glass Bridge: the computer's play. Nothing tells safe glass from weak until it is stepped on, so every level takes a
// platform known to hold when the next row has one and otherwise picks among the ones not yet tried. Easy's slips (it
// forgets which glass held: Easy 45%, Normal 10% of hops by default) are the per-level mistake rate, aiMiss<Level> (core/ai.js aiSlip: any
// platform still there). Hard plays as Normal: there is nothing more to know (pure luck).
import { bridgeMoves, bridgeSeen } from './rules.js';

const GUESS = 0.45;                                                // a hop onto glass nobody has tried holds a little under half the time (two or three platforms, one or two weak)
const aheadOf = (pm, p) => bridgeSeen(pm, p).slice(pm.at[p] + 1);
// The turns a side still needs: this one, and one more for about every other row with no safe glass known.
export function needs(pm, p) { return 1 + aheadOf(pm, p).filter(r => !r.includes(1)).length * 0.55; }
export function best(pm, me, rng, style, ctx) {
  const all = bridgeMoves(pm, me), row = bridgeSeen(pm, me)[pm.at[me] + 1] || [];
  const safe = row.indexOf(1), q = aheadOf(pm, me).reduce((x, r) => x * (r.includes(1) ? 1 : GUESS), 1);
  if (safe >= 0) return { move: safe, q };
  const fresh = all.filter(i => row[i] === 0), from = !fresh.length ? all : fresh;
  return { move: from[Math.floor(rng() * from.length)], q };
}
// A slip (the level's mistake rate): it forgets which glass held and hops onto any platform still there.
export function worse(pm, me, rng) { const all = bridgeMoves(pm, me); return all.length ? all[Math.floor(rng() * all.length)] : null; }
