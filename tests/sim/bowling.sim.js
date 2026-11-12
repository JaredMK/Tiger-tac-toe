'use strict';
// Simulation: Bowling's balance (slow, so never part of npm test):  npm run sim -- bowling
// Races in one square, turn about, X first: the computer at each level (ai.js: its pick, then the three meters stopped
// with its timing error) and human-like hands (the best roll meant, each of the three taps late or early by a spread
// of ms: a steady finger, a casual one, a loose one). Reports the rolls each player takes, the pins a roll brings, the
// strikes, how long a roll plays, and who takes the square: with Equal rolls on (the target reached with a roll in hand
// waits for one answer) and off (the default: first to the target).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

let A = null;
function races(n, hand, even, level) {
  E.setTune('bowling', { even });
  const rng = E.makeRng('bowl' + (hand || level) + even);
  const o = { n, first: 0, draws: 0, winRolls: 0, each: 0, pins: 0, rolls: 0, strikes: 0, ms: 0, atLeast: new Array(11).fill(0) };
  for (let i = 0; i < n; i++) {
    const m = E.newMini('bowling', E.makeRng('r' + i));
    for (let p = 'X'; ; p = p === 'X' ? 'O' : 'X') {
      const pm = E.publicMini(m);
      const mv = hand ? A.bowlTimed(A.bowlPick(pm, p, rng, 'normal').c, pm, hand, rng) : E.aiOf('bowling').best(pm, p, rng, null, { level }).move;
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

test('bowling: about 4 to 6 rolls each, the first to roll under 60% of squares with Equal rolls', async () => {
  A = await import('../../src/games/bowling/ai.js');
  const N = Number(process.env.BOWL_N) || 400, all = [];
  for (const even of ['off', 'on']) {
    for (const level of ['easy', 'normal', 'hard']) { const o = races(N, null, even, level); say(`the computer (${level}), Equal rolls ${even}`, o); all.push([level, even, o]); }
    for (const [name, ms] of [['a steady finger (45 ms a tap)', 45], ['a casual one (75 ms)', 75], ['a loose one (110 ms)', 110]]) { const o = races(N, ms, even); say(`${name}, Equal rolls ${even}`, o); all.push([name, even, o]); }
  }
  for (const [name, even, o] of all) {
    const each = o.each / o.n, first = o.first / (o.n - o.draws);
    if (name === 'hard' || name === 'easy') continue;                // (the levels' ends: reported, not held)
    assert.ok(each >= 3.8 && each <= 6.5, `${name}, ${even}: rolls each (${each.toFixed(2)})`);
    if (even === 'on') assert.ok(first < 0.6 && first > 0.4, `${name}: the first to roll (${(100 * first).toFixed(1)}%)`);
    assert.ok(o.draws / o.n < 0.15, `${name}, ${even}: level squares (${(100 * o.draws / o.n).toFixed(1)}%)`);
  }
});
