// Roulette: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';

// Roulette: a small wheel of 25 pockets, 1 to 24 (odd red, even black, alternating round the wheel) and a
// green 0. A spin carries one bet: 8 numbers, one of the groups 1-8, 9-16 or 17-24, or green 0 on its own.
// A number or group that comes up is a hit, and two hits take the square; green 0 coming up on a bet on 0
// takes it at once. (0 on any other bet is a miss.)
export const RL = {
  n: 24, pick: 8, goal: 2,
  wheel: [0, 17, 4, 21, 10, 13, 6, 19, 2, 23, 8, 15, 12, 1, 20, 5, 14, 9, 22, 3, 16, 11, 24, 7, 18],   // the pockets in order round the wheel
  groups: { g1: [1, 8], g2: [9, 16], g3: [17, 24] },
};
export const rlRed = n => n > 0 && n % 2 === 1;
// A bet as sent: 'zero', 'g1', 'g2', 'g3', or an array of 8 different numbers from 1 to 24. Returns the
// bet in a standard form (numbers sorted) or null.
export function rlBet(m) {
  if (m === 'zero' || RL.groups[m]) return m;
  if (!Array.isArray(m) || m.length !== RL.pick || !m.every(k => Number.isInteger(k) && k >= 1 && k <= RL.n) || new Set(m).size !== RL.pick) return null;
  return m.slice().sort((a, b) => a - b);
}
export function rlCovers(bet, n) {
  if (bet === 'zero') return n === 0;
  if (RL.groups[bet]) return n >= RL.groups[bet][0] && n <= RL.groups[bet][1];
  return bet.includes(n);
}
export function create(type, rng) {
  return { type, hits: { X: 0, O: 0 }, spins: [], last: null };
}
export function apply(mini, p, m, rng, idx) {
  const bet = rlBet(m);
  if (!bet) return { ok: false, reason: 'bad' };
  const n = RL.wheel[randInt(needRng(rng), RL.wheel.length)];
  const hit = rlCovers(bet, n);
  if (hit && bet !== 'zero') mini.hits[p] += 1;
  mini.last = { by: p, bet, n, hit };
  mini.spins = (mini.spins || []).concat({ n, by: p, hit }).slice(-6);   // the recent spins, hits and misses alike (the miniature shows them)
  if (hit && bet === 'zero') return { ok: true, outcome: 'win', note: 'zero' };
  if (hit && mini.hits[p] >= RL.goal) return { ok: true, outcome: 'win', note: 'hit' };
  return { ok: true, outcome: 'continue', note: hit ? 'hit' : 'miss' };
}
export function publicView(mini) {
  return { type: 'rl', hits: { X: mini.hits.X, O: mini.hits.O } };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(['g1', 'g2', 'g3']);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.rl = { bet: Array.isArray(l.bet) ? l.bet.slice() : l.bet, n: l.n, hit: l.hit, hits: { X: mini.hits.X, O: mini.hits.O } }; return;
}
export function flashMs(f, winLen, won) {
  return RLT.spin + RLT.settle + RLT.hold + (won ? 600 : 0);
}
export const RLT = { spin: 2700, settle: 450, hold: 1000 };
// Super Chaos: both spins join the recent spins.
export function scMerge(m, c) {
  m.spins = (c.base.spins || []).concat(c.played.map(p => { const s = c.forks[p].spins || []; return s[s.length - 1]; }).filter(Boolean)).slice(-6);
}
