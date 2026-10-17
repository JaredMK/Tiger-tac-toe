// Risky Rolls: the computer's play.
import { other } from '../../core/util.js';
import { RISKY } from './rules.js';

export function needs(pm, p) {
  const pot = pm.turn && pm.turn.by === p ? pm.turn.pot : 0; return Math.max(1, (RISKY.goal - pm.bank[p] - pot) / 7);
}
export function best(pm, me, rng, style, ctx) {
  const t = pm.turn && pm.turn.by === me ? pm.turn : null;
  if (!t) return { move: 'roll', q: 0 };
  const bank = pm.bank[me];
  if (bank + t.pot >= RISKY.goal) return { move: 'bank', q: 1 };
  if (t.rolls.length >= RISKY.maxRolls) return { move: 'bank', q: 0 };
  const gap = pm.bank[other(me)] - bank;                      // positive when behind
  const target = Math.max(4, Math.min(20, Math.max(6, Math.min(14, 9 + Math.round(gap / 4))) + ((style && style.rollRisk) || 0)));   // riskier when behind, safer when ahead (a bolder or warier style shifts it)
  if (t.pot >= target || t.rolls.length / 6 > 0.5) return { move: 'bank', q: 0 };
  return { move: 'roll', q: 0 };
}
