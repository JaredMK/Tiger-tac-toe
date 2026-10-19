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
  const l = mini.last;
  if (l.pending) { flash.rl = { bet: Array.isArray(l.bet) ? l.bet.slice() : l.bet, pending: true, n: null, hit: false, hits: { X: mini.hits.X, O: mini.hits.O } }; return; }   // (Super Chaos: the bet is down; the spin comes at the round's end)
  flash.rl = { bet: Array.isArray(l.bet) ? l.bet.slice() : l.bet, n: l.n, hit: l.hit, hits: { X: mini.hits.X, O: mini.hits.O } }; return;
}
export function flashMs(f, winLen, won) {
  if (f.rl && f.rl.pending) return RLT.bet;
  return RLT.spin + RLT.settle + RLT.hold + (won ? 600 : 0);
}
export const RLT = { spin: 2700, settle: 450, hold: 1450, bet: 900 };   // (bet: Super Chaos's bet put down, no spin; hold: until the number's landing pulse is over)
// Super Chaos: the wheel spins once for both. During the round a move only puts the bet down (bets); when
// the round ends one spin settles both bets together (a hit, a second hit, green 0 on a bet on 0), and the
// recap plays that spin (resolve). Both taking the square in the same spin resets it, as ever.
export function scApply(mini, p, m, rng) {
  const bet = rlBet(m);
  if (!bet) return { ok: false, reason: 'bad' };
  mini.bets = Object.assign({ X: null, O: null }, mini.bets);
  mini.bets[p] = bet;
  mini.last = { by: p, bet, n: null, hit: false, pending: true };
  return { ok: true, outcome: 'continue', note: 'bet' };
}
export function scMerge(m, c) {
  const bets = { X: null, O: null };
  for (const p of c.played) { const b = c.forks[p].bets && c.forks[p].bets[p]; if (b) bets[p] = b; }
  const who = ['X', 'O'].filter(p => bets[p]);
  if (!who.length) return;
  const pre = JSON.parse(JSON.stringify(m));
  pre.bets = { X: bets.X, O: bets.O }; pre.hits = { X: c.base.hits.X, O: c.base.hits.O }; pre.spins = (c.base.spins || []).slice(); pre.last = c.base.last || null;
  const n = RL.wheel[randInt(needRng(c.rng), RL.wheel.length)];
  const hit = { X: false, O: false }, win = { X: false, O: false };
  m.hits = { X: c.base.hits.X, O: c.base.hits.O };
  for (const p of who) {
    hit[p] = rlCovers(bets[p], n);
    if (hit[p] && bets[p] !== 'zero') m.hits[p] += 1;
    win[p] = hit[p] && (bets[p] === 'zero' || m.hits[p] >= RL.goal);
  }
  const hitters = who.filter(p => hit[p]);
  m.bets = { X: null, O: null };
  m.last = { by: who.length === 1 ? who[0] : c.me, shared: true, n, bets: { X: bets.X, O: bets.O }, hit, bet: bets[who[0]] };
  m.spins = (c.base.spins || []).concat({ n, by: hitters.length === 2 ? 'XO' : hitters[0] || null, hit: hitters.length > 0 }).slice(-6);
  return { win, resolve: { pre, flash: { by: m.last.by, rl: { shared: true, n, bets: { X: bets.X, O: bets.O }, hit, hits: { X: m.hits.X, O: m.hits.O } } } } };
}
