// Risky Rolls: the computer's play.
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { pigGoal, pigMaxRolls, pigSides } from './rules.js';

// What a turn banks on average when banking around its best pot: about 6 points with a d6 (bank at 8 to 10),
// about 9 with a d8 (bank at 11 or 12).
const PER_TURN = { 6: 7, 8: 9 }, BEST_POT = { 6: 9, 8: 12 };
export function needs(pm, p) {
  const pot = pm.turn && pm.turn.by === p ? pm.turn.pot : 0; return Math.max(1, (pigGoal(pm) - pm.bank[p] - pot) / PER_TURN[pigSides(pm)]);
}
export function best(pm, me, rng, style, ctx) {
  const t = pm.turn && pm.turn.by === me ? pm.turn : null;
  if (!t) return { move: 'roll', q: 0 };
  const bank = pm.bank[me], sides = pigSides(pm), base = BEST_POT[sides];
  if (bank + t.pot >= pigGoal(pm)) return { move: 'bank', q: 1 };
  if (t.rolls.length >= pigMaxRolls(pm)) return { move: 'bank', q: 0 };
  const gap = pm.bank[other(me)] - bank;                      // positive when behind
  const target = Math.max(4, Math.min(base + 11, Math.max(base - 3, Math.min(base + 5, base + Math.round(gap / (sides === 8 ? 6 : 4)))) + ((style && style.rollRisk) || 0) + tune(pm).risk));   // riskier when behind, safer when ahead (a bolder or warier style, or the admin's setting, shifts it)
  if (t.pot >= target || t.rolls.length / sides > 0.5) return { move: 'bank', q: 0 };
  return { move: 'roll', q: 0 };
}
