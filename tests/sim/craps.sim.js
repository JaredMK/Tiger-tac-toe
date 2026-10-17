'use strict';
// Simulations: Craps. Slow, so never part of npm test:
// npm run sim -- craps
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

test('craps: Stop is never the better choice (value iteration over the square, both players playing it every turn)', () => {
  const G = 3, P = {}; for (let s = 2; s <= 12; s++) P[s] = (6 - Math.abs(s - 7)) / 36;
  const PTS = [null, 4, 5, 6, 8, 9, 10], V = {}, key = (a, b, pt, ph) => `${a},${b},${pt},${ph}`;
  for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) for (const pt of PTS) for (const ph of ['start', 'choose']) V[key(a, b, pt, ph)] = 0.5;
  const after = (a, b) => (a >= G ? 1 : b >= G ? 0 : 1 - V[key(b, a, null, 'start')]);
  const roll = (a, b, pt) => { let v = 0; for (let s = 2; s <= 12; s++) { const q = P[s]; if (pt == null) v += q * (s === 7 || s === 11 ? after(a + 1, b) : [2, 3, 12].includes(s) ? after(a, b) : V[key(a, b, s, 'choose')]); else v += q * (s === pt ? after(a + 1, b) : s === 7 ? after(a, b) : V[key(a, b, pt, 'choose')]); } return v; };
  const stop = (a, b, pt) => 1 - V[key(b, a, pt, 'start')];
  for (let it = 0; it < 3000; it++) for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) for (const pt of PTS) { V[key(a, b, pt, 'start')] = roll(a, b, pt); if (pt != null) V[key(a, b, pt, 'choose')] = Math.max(roll(a, b, pt), stop(a, b, pt)); }
  for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) for (const pt of PTS.slice(1)) assert.ok(roll(a, b, pt) > stop(a, b, pt), `${a}-${b}, point ${pt}: rolling on ${roll(a, b, pt).toFixed(3)}, stopping ${stop(a, b, pt).toFixed(3)}`);
  assert.ok(Math.abs(roll(0, 0, 6) - 0.556) < 0.002 && Math.abs(stop(0, 0, 6) - 0.444) < 0.002, 'at 0-0 on a 6: 55.6% rolling on, 44.4% stopping');
});
