'use strict';
// Simulation: Bowling's balance (slow, so never part of npm test):  npm run sim -- bowling
// Races in one square, turn about, X first: the computer's hand (physAi with the square's own errors) and plain hands
// (a roll aimed down the middle with a spread of aim and power, as a flick has). Reports the rolls each player takes,
// the pins a roll brings, the strikes, how long a roll plays, and who takes the square: with Equal rolls on (the
// default: the target reached with a roll in hand waits for one answer) and off (first to the target).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

function races(n, hand, even) {
  E.setTune('bowling', { even });
  const rng = E.makeRng('bowl' + (hand ? hand.join() : 'ai') + even);
  const g = () => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const o = { n, first: 0, draws: 0, winRolls: 0, each: 0, pins: 0, rolls: 0, strikes: 0, ms: 0, atLeast: new Array(11).fill(0) };
  for (let i = 0; i < n; i++) {
    const m = E.newMini('bowling', E.makeRng('r' + i));
    for (let p = 'X'; ; p = p === 'X' ? 'O' : 'X') {
      const mv = hand ? E.physShot({ aim: g() * hand[0], power: Math.max(E.BOWLG.powMin, Math.min(1, 0.85 + g() * hand[1])) }) : E.aiOf('bowling').best(E.publicMini(m), p, rng).move;
      const before = m.pins[p], r = E.applyMove(m, p, mv, rng), k = m.pins[p] - before;
      assert.equal(r.ok, true);
      o.rolls++; o.pins += k; o.ms += m.last.ms; if (k === 10) o.strikes++; for (let j = 0; j <= k; j++) o.atLeast[j]++;
      if (r.outcome === 'win') { const w = r.winner || p; if (w === 'X') o.first++; o.winRolls += m.rolls[w]; o.each += (m.rolls.X + m.rolls.O) / 2; break; }
      if (r.outcome === 'draw') { o.draws++; o.each += (m.rolls.X + m.rolls.O) / 2; break; }
    }
  }
  E.setTune('bowling', null);
  return o;
}
const say = (label, o) => console.log(`${label}: first mover ${(100 * o.first / (o.n - o.draws)).toFixed(1)}% of decided squares, ${(100 * o.draws / o.n).toFixed(1)}% level; ${(o.each / o.n).toFixed(2)} rolls each (the winner ${(o.winRolls / (o.n - o.draws)).toFixed(2)}); ${(o.pins / o.rolls).toFixed(2)} pins a roll, ${(100 * o.strikes / o.rolls).toFixed(0)}% strikes, a roll ${Math.round(o.ms / o.rolls)} ms\n    at least n pins: ${o.atLeast.map(c => (c / o.rolls).toFixed(2)).join(' ')}`);

test('bowling: about 4 to 6 rolls each, the first to roll under 60% of squares with Equal rolls', () => {
  const N = Number(process.env.BOWL_N) || 400;
  const ai = races(N, null, 'on'); say('the computer, Equal rolls', ai);
  const off = races(N, null, 'off'); say('the computer, first to the target', off);
  const fair = races(N, [0.035, 0.08], 'on'); say('a fair hand (aim 35 mrad, power 8%), Equal rolls', fair);
  const loose = races(N, [0.06, 0.1], 'on'); say('a loose hand (aim 60 mrad, power 10%), Equal rolls', loose);
  for (const o of [ai, fair, loose]) {
    const each = o.each / o.n, first = o.first / (o.n - o.draws);
    assert.ok(each >= 3.8 && each <= 6.2, `rolls each (${each.toFixed(2)})`);
    assert.ok(first < 0.6 && first > 0.4, `the first to roll (${(100 * first).toFixed(1)}%)`);
    assert.ok(o.draws / o.n < 0.15, `level squares (${(100 * o.draws / o.n).toFixed(1)}%)`);
  }
});
