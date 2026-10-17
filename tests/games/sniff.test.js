'use strict';
// Sniff: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

/* ===================================== Sniff ===================================== */
test('sniff: a 5x5 field, the dog at least 3 steps from the treasure (as the crow flies); a step is hotter, colder or the same, always right; onto it wins', () => {
  const rng = E.makeRng('sn-rules');
  const seen = { hot: 0, cold: 0, same: 0 };
  for (let k = 0; k < 2000; k++) {
    const m = E.newMini('sniff', rng);
    assert.ok(E.sniffSteps(m.dog, m.treasure) >= (m.treasure === 12 ? 2 : 3), 'at least 3 steps, diagonals and all (2 from the very middle)');
    assert.equal(m.dog, m.start);
    let r, n = 0;
    while (!r || r.outcome !== 'win') {
      const d = E.randomLegalMove(m, n % 2 ? 'O' : 'X', rng), from = m.dog;
      assert.ok(E.sniffDirs(from).includes(d), 'a legal step');
      r = E.applyMove(m, n % 2 ? 'O' : 'X', d, rng);
      assert.equal(r.ok, true);
      const a = Math.hypot(Math.floor(m.dog / 5) - Math.floor(m.treasure / 5), m.dog % 5 - m.treasure % 5), b = Math.hypot(Math.floor(from / 5) - Math.floor(m.treasure / 5), from % 5 - m.treasure % 5);
      const res = Math.abs(a - b) < 1e-9 ? 'same' : a < b ? 'hot' : 'cold';
      assert.equal(m.last.res, res, 'hotter, colder or the same: always right');
      assert.equal(m.trail[m.trail.length - 1].r, res);
      if (r.outcome !== 'win') { assert.equal(r.note, res); seen[res]++; }
      assert.equal(r.outcome === 'win', m.dog === m.treasure);
      if (++n > 500) assert.fail('never found');
    }
  }
  assert.ok(seen.hot && seen.cold && seen.same, 'all three come up: ' + JSON.stringify(seen));
  const m = E.newMini('sniff', rng);
  for (const bad of ['up', 3, null]) assert.equal(E.applyMove(m, 'X', bad, rng).ok, false);
  // eight ways: the diagonals too; off the edge: refused
  const mid = Object.assign(E.newMini('sniff', rng), { dog: 12, start: 12, treasure: 0 });
  assert.deepEqual(E.sniffDirs(12).sort(), ['E', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'W']);
  assert.equal(E.applyMove(mid, 'X', 'NW', rng).note, 'hot'); assert.equal(mid.dog, 6, 'a diagonal step: up and left');
  const corner = Object.assign(E.newMini('sniff', rng), { dog: 0, start: 0, treasure: 24 });
  for (const d of ['N', 'W', 'NW', 'NE', 'SW']) assert.equal(E.applyMove(corner, 'X', d, rng).ok, false, d);
  assert.deepEqual(E.sniffDirs(0).sort(), ['E', 'S', 'SE']);
  // the same: a step that keeps the straight-line distance (from (1,2) to (2,1), the treasure at (0,0): both √5)
  assert.equal(E.sniffRes(7, 11, 0), 'same');
  const same = Object.assign(E.newMini('sniff', rng), { dog: 7, start: 7, treasure: 0 });
  const r = E.applyMove(same, 'X', 'SW', rng);
  assert.deepEqual([same.dog, r.note, same.last.res, E.publicMini(same).trail[0].r], [11, 'same', 'same', 'same']);
  assert.equal(E.sniffRes(7, 6, 0), 'hot'); assert.equal(E.sniffRes(7, 8, 0), 'cold');
});
test('sniff: no memory on the board: the square keeps only the last 3 steps (the computer\'s memory); the word shows about 2 s', () => {
  const rng = E.makeRng('sn-mem'), m = Object.assign(E.newMini('sniff', rng), { dog: 0, start: 0, treasure: 24 });
  for (const d of ['E', 'E', 'S', 'S', 'W']) E.applyMove(m, 'X', d, rng);
  assert.equal(m.trail.length, 3, 'only the last 3 steps');
  assert.deepEqual(m.trail.map(t => [t.f, t.t]), [[2, 7], [7, 12], [12, 11]]);
  const pm = E.publicMini(m);
  assert.equal(pm.trail.length, 3);
  // the cells the computer still suspects: what the 3 steps say, not the earlier ones (cell 0, where it started, is forgotten)
  const c = E.sniffCands(pm);
  assert.ok(!c.includes(11) && !c.includes(12) && !c.includes(7) && !c.includes(2), 'not where it stood in those steps');
  assert.ok(c.includes(0) || c.every(x => x !== 0), 'the start is no longer known');
  const st = E.newMatch(rng, { games: ['sniff'] }), sq = st.squares[0].mini, d = E.sniffDirs(sq.dog)[0];
  E.playMove(st, 0, d, rng);
  assert.equal(E.playMs(st.flash), E.SNIFF.step + E.SNIFF.hold + (st.flash.kind === 'claim' ? 900 : 0));
  assert.ok(E.SNIFF.hold >= 1800 && E.SNIFF.hold <= 2200, 'the word: about 2 seconds');
});
test('sniff: online the treasure stays on the server; the computer\'s view has the trail, never the treasure', () => {
  const rng = E.makeRng('sn-secret'), m = E.newMini('sniff', rng);
  const pub = E.publicMini(m, 'X');
  assert.equal('treasure' in pub, false);
  const hidden = JSON.parse(JSON.stringify(m)); E.hideMini(hidden);
  assert.equal('treasure' in hidden, false);
  assert.equal(E.applyMove(hidden, 'X', E.sniffDirs(hidden.dog)[0], rng).reason, 'secret');
  assert.deepEqual(E.secretOf(m), { treasure: m.treasure });
});
test('sniff: the computer walks toward cells still consistent with every hotter and colder', () => {
  const rng = E.makeRng('sn-ai');
  let steps = 0, games = 0, inCands = 0, moves = 0;
  for (let g = 0; g < 600; g++) {
    const m = E.newMini('sniff', rng);
    let r = null, n = 0;
    while (!r || r.outcome !== 'win') {
      const p = n % 2 ? 'O' : 'X', pm = E.publicMini(m, p), cands = E.sniffCands(pm);
      assert.ok(cands.includes(m.treasure), 'the treasure is always among the cells still possible');
      const b = E.localBest(pm, p, rng);
      if (cands.includes(E.sniffStep(m.dog, b.move))) inCands++;
      moves++;
      r = E.applyMove(m, p, b.move, rng); n++;
      assert.ok(n < 60, 'found in good time');
    }
    steps += n; games++;
  }
  assert.ok(steps / games < 9, `about ${(steps / games).toFixed(1)} moves to find it`);
  assert.ok(inCands / moves > 0.4, `steps onto a possible cell ${(100 * inCands / moves).toFixed(0)}% of the time`);
});
