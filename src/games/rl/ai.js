// Roulette: the computer's play.
import { AI } from '../../core/ai.js';
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { RL } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (tune(pm).goal - pm.hits[p]) * RL.wheel.length / RL.pick);
}
export function best(pm, me, rng, style, ctx) {
  // A group, as a rule; now and then green 0: when the other side is one hit from a square that
  // matters (it would give them the match, or block a line of its own), or when well behind.
  // Hard: green 0 or a group by the chance of winning the square's race (rlRace).
  const o = other(me), mine = pm.hits[me], theirs = pm.hits[o], c = tune(pm), goal = c.goal;
  const group = () => ({ move: ['g1', 'g2', 'g3'][randInt(rng, 3)], q: mine >= goal - 1 ? RL.pick / RL.wheel.length : 0 });
  if (ctx && ctx.level === 'hard') { const r = rlRace(goal); return r.zero[mine * goal + theirs] ? { move: 'zero', q: 1 / RL.wheel.length } : group(); }
  const crit = !!ctx && ctx.value >= AI.block, behind = !!ctx && ctx.behind >= 2 && theirs > mine;
  const pz = (theirs >= goal - 1 && crit ? c.zeroCrit : behind ? c.zeroBehind : 0) / 100;   // (the admin's rates)
  if (pz && rng() < pz) return { move: 'zero', q: 1 / RL.wheel.length };
  return group();
}

// ---- Hard: the race ----
// P[a][b]: the chance the player to move, a hits to the other's b, wins the square, both betting their best each
// spin: a group (a hit 8 in 25, one more hit) or green 0 (the square at once, 1 in 25). A miss hands the spin
// over, so each P leans on the other side's from the same hits (value iteration, once per goal, kept).
const RACE = {};
export function rlRace(goal) {
  if (RACE[goal]) return RACE[goal];
  const G = goal, P = new Float64Array(G * G).fill(0.5), zero = new Uint8Array(G * G), n = RL.wheel.length, ph = RL.pick / n, pz = 1 / n;
  for (let it = 0; it < 400; it++) {
    let moved = 0;
    for (let a = G - 1; a >= 0; a--) for (let b = G - 1; b >= 0; b--) {
      const miss = 1 - P[b * G + a];
      const g = ph * (a + 1 >= G ? 1 : 1 - P[b * G + a + 1]) + (1 - ph) * miss, z = pz + (1 - pz) * miss;
      const v = Math.max(g, z);
      moved = Math.max(moved, Math.abs(v - P[a * G + b])); P[a * G + b] = v; zero[a * G + b] = z > g + 1e-9 ? 1 : 0;
    }
    if (moved < 1e-12) break;
  }
  return (RACE[goal] = { P, zero });
}
