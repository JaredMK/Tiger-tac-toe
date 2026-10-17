'use strict';
// Simulations: Risk Wheels. Slow, so never part of npm test:
// npm run sim -- wheels
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('wheels: simulated strategies over 1,000 dealt sets (always high, medium, low, the computer\'s, random): spins to 18 alone and head to head', () => {
  const rng = E.makeRng('wh-sim'), sets = Array.from({ length: 1000 }, (_, k) => E.wheelsDeal(E.makeRng('sim' + k), E.WHEEL_DEFAULTS)), T = 18;
  const strat = { high: () => 'high', mid: () => 'mid', low: () => 'low', random: () => E.WHEELS[Math.floor(rng() * 3)], ai: (w, a, b) => E.wheelsTable(T, w).best[a][b] };
  const solo = {};
  for (const [k, f] of Object.entries(strat)) {
    let sum = 0, n = 0;
    for (const w of sets) for (let g = 0; g < 3; g++) { let a = 0, spins = 0; while (a < T && spins < 400) { a += E.wheelSpin(w[f(w, a, 0)], rng).v; spins++; } sum += spins; n++; }
    solo[k] = sum / n;
  }
  console.log('Risk Wheels: average spins to 18 alone over 1,000 sets: ' + Object.entries(solo).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', '));
  assert.ok(solo.low < solo.mid && solo.mid < solo.high, 'alone, the steadier the sooner (the averages in order)');
  const duel = (w, fx, fo) => { let a = 0, b = 0; for (let k = 0; k < 2000; k++) { if (k % 2 === 0) { a += E.wheelSpin(w[fx(w, Math.min(a, T - 1), Math.min(b, T - 1))], rng).v; if (a >= T) return 'X'; } else { b += E.wheelSpin(w[fo(w, Math.min(b, T - 1), Math.min(a, T - 1))], rng).v; if (b >= T) return 'O'; } } return null; };
  const rates = {};
  for (const k of ['high', 'mid', 'low', 'random']) {
    let ai = 0, n = 0;
    for (const w of sets.slice(0, 400)) for (let g = 0; g < 2; g++) { if (duel(w, strat.ai, strat[k]) === 'X') ai++; if (duel(w, strat[k], strat.ai) === 'O') ai++; n += 2; }
    rates[k] = ai / n;
    assert.ok(ai / n > 0.5, `the computer beats "always ${k}" (${(100 * ai / n).toFixed(1)}%)`);
  }
  console.log('Risk Wheels: the computer\'s wins head to head: ' + Object.entries(rates).map(([k, v]) => `vs ${k} ${(100 * v).toFixed(1)}%`).join(', '));
});
