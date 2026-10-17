// Cup Pong: the computer's play.
import { randInt } from '../../core/random.js';
import { PONG, pongAimAt } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, pm.cups[p].filter(Boolean).length / 0.45);
}
export function best(pm, me, rng, style, ctx) {   // at a cup still standing, a little off
  const g = () => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const up = pm.cups[me].map((c, k) => (c ? k : -1)).filter(k => k >= 0);
  const k = up.length ? up[randInt(rng, up.length)] : 0, a = pongAimAt(k);
  return { move: { aim: Math.max(-1, Math.min(1, a.aim + g() * PONG.aiErr[0])), power: Math.max(0, Math.min(1, a.power + g() * PONG.aiErr[1])) }, q: 0.45 };
}
