'use strict';
// Simulations: Sky Hop. Slow, so never part of npm test:
// npm run sim -- skyhop
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);
const hopMini = (seed, h0) => ({ type: 'skyhop', cfg: E.hopConfig(), seed: { X: seed, O: seed + 1 }, height: { X: h0 || 0, O: 0 }, tries: { X: 0, O: 0 }, last: null });

test('sky hop: no impossible gaps — a perfect hand climbs every course to the top, from anywhere', () => {
  const perfect = { react: [0, 0], aim: 0, lapse: 0, misjudge: 0 }, fails = [];
  for (let s = 0; s < 14; s++) for (const h0 of [0, 0.23, 0.5, 0.77, 0.95].map(f => Math.round(E.hopConfig().target * f))) {
    const m = hopMini(5000 + s, h0); let r;
    for (let k = 0; k < 20; k++) { r = E.hopAi(m, 'X', E.makeRng('p' + s + h0 + k), perfect); if (r.move.end !== 'time') break; m.height.X = r.move.h; }   // (the attempt's time limit: the next attempt goes on from the height reached)
    if (r.move.end !== 'top') fails.push([s, h0, r.move.end, r.move.h]);
  }
  assert.deepEqual(fails, [], 'every start reaches the top');
});
