// Roulette: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';

// Roulette: a small wheel of 25 pockets, 1 to 24 (odd red, even black, alternating round the wheel) and a
// green 0. A spin carries one bet: 8 numbers, one of the groups 1-8, 9-16 or 17-24, or green 0 on its own.
// A number or group that comes up is a hit, and two hits take the square; green 0 coming up on a bet on 0
// takes it at once. (0 on any other bet is a miss.) The hits to win are the admin's (TUNE in meta.js: tune(mini).goal).
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
  return spinBet(mini, p, m, RL.wheel[randInt(needRng(rng), RL.wheel.length)]);
}
function spinBet(mini, p, m, n) {
  const bet = rlBet(m);
  if (!bet) return { ok: false, reason: 'bad' };
  const hit = rlCovers(bet, n);
  if (hit && bet !== 'zero') mini.hits[p] += 1;
  mini.last = { by: p, bet, n, hit };
  mini.spins = (mini.spins || []).concat({ n, by: p, hit }).slice(-6);   // the recent spins, hits and misses alike (the miniature shows them)
  if (hit && bet === 'zero') return { ok: true, outcome: 'win', note: 'zero' };
  if (hit && mini.hits[p] >= tune(mini).goal) return { ok: true, outcome: 'win', note: 'hit' };
  return { ok: true, outcome: 'continue', note: hit ? 'hit' : 'miss' };
}
export function publicView(mini) {
  return { type: 'rl', hits: { X: mini.hits.X, O: mini.hits.O } };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(['g1', 'g2', 'g3']);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  if (l.pending) { flash.rl = { bet: Array.isArray(l.bet) ? l.bet.slice() : l.bet, pending: true, n: null, hit: false, hits: { X: mini.hits.X, O: mini.hits.O } }; return; }   // (Super Chaos: the bet is down; the spin comes at the round's end)
  flash.rl = { bet: Array.isArray(l.bet) ? l.bet.slice() : l.bet, n: l.n, hit: l.hit, hits: { X: mini.hits.X, O: mini.hits.O } }; return;
}
export function flashMs(f, winLen, won) {
  if (f.rl && f.rl.pending) return RLT.bet;
  return RLT.spin + RLT.settle + RLT.hold + (won ? 600 : 0);
}
export const RLT = { spin: 2700, settle: 300, hold: 500, bet: 900 };   // (bet: Super Chaos's bet put down, no spin; hold: until the number's landing pulse is over)
// Super Chaos: the square's spin is drawn as each round begins (scRound), so a bet spins the wheel at once on
// the mover's own screen, and two bets placed there in the same round land on the same number: one spin
// settles both. At the round's end it joins the square's history once (in the colour of each player it hit),
// and each player's hits count as usual; both taking the square in the same round resets it, as ever.
export function scRound(mini, rng) {
  mini.spin = RL.wheel[randInt(needRng(rng), RL.wheel.length)];
}
export function scApply(mini, p, m, rng) {
  return Number.isInteger(mini.spin) ? spinBet(mini, p, m, mini.spin) : apply(mini, p, m, rng);
}
export function secret(mini) {                                   // the round's spin stays off the board until a bet lands on it
  return Number.isInteger(mini.spin) ? { spin: mini.spin } : null;
}
export function hide(m) { delete m.spin; }
export function scMerge(m, c) {
  const spins = (c.base.spins || []).slice(), mine = c.played.map(p => c.forks[p].last).filter((l, k) => l && l.by === c.played[k] && l.n != null);
  const both = mine.length === 2 && mine[0].n === mine[1].n;
  if (both) { const hit = mine.filter(l => l.hit).map(l => l.by); spins.push({ n: mine[0].n, by: hit.join(''), hit: hit.length > 0 }); }   // (the one spin both bets shared)
  else for (const l of mine) spins.push({ n: l.n, by: l.by, hit: !!l.hit });
  m.spins = spins.slice(-6);
  if (!both) return {};
  // both bet here: the round's end plays the one spin again with both bets on the board (resolve), in each player's own view
  const pre = JSON.parse(JSON.stringify(m)), bets = {}, hit = {};
  pre.spins = (c.base.spins || []).slice(-6); pre.hits = { X: c.base.hits.X, O: c.base.hits.O };
  for (const l of mine) { bets[l.by] = Array.isArray(l.bet) ? l.bet.slice() : l.bet; hit[l.by] = !!l.hit; }
  return { resolve: { pre, joint: true, flash: { by: c.me, rl: { shared: true, n: mine[0].n, bets, hit, hits: { X: m.hits.X, O: m.hits.O } } } } };
}
