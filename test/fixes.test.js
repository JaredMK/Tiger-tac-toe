'use strict';
// Run with:  node --test
// Fixes to existing games: Districts' maps (every spot plainly in the regions it counts for), Darts' aim
// replay and speed.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

/* ===================================== Districts ===================================== */
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const distTo = (p, poly) => (inside(p, poly) ? 0 : Math.min(...poly.map((a, i) => segDist(p, a, poly[(i + 1) % poly.length]))));
const SPOT_R = 5.5;   // the spot's tap circle on the screen (its drawn dot is 4.3)

test('districts: 2,000 maps; every spot counts for exactly the regions it is drawn in or on, and its circle reaches no other', () => {
  for (let g = 0; g < 2000; g++) {
    const map = E.newMini('districts', E.makeRng('dmap' + g)).map;
    for (const s of map.spots) {
      const p = [s.x, s.y];
      const on = map.regions.map((poly, r) => (distTo(p, poly) < 0.6 ? r : -1)).filter(r => r >= 0);
      assert.deepEqual(on, s.r, `map ${g}: the spot at ${p} sits in/on regions ${on} but counts for ${s.r}`);
      for (let r = 0; r < map.regions.length; r++) if (!s.r.includes(r)) assert.ok(distTo(p, map.regions[r]) >= SPOT_R, `map ${g}: the spot at ${p} reaches into region ${r}, which it does not count for`);
    }
  }
});
test('districts: every region is touched by an odd number of spots (3 or more), the spots are even, and a full map never ties a region', () => {
  for (let g = 0; g < 2000; g++) {
    const m = E.newMini('districts', E.makeRng('dodd' + g)), map = m.map, n = new Array(map.regions.length).fill(0);
    for (const s of map.spots) for (const r of s.r) n[r]++;
    assert.ok(n.every(x => x >= 3 && x % 2 === 1), `map ${g}: region totals ${n}`);
    assert.equal(map.spots.length % 2, 0, 'as many pieces each');
    const rng = E.makeRng('dfill' + g), who = E.shuffle(map.spots.map((_, k) => (k % 2 ? 'O' : 'X')), rng);
    const t = E.distTally(map, who);
    for (let r = 0; r < map.regions.length; r++) {
      assert.equal(t.X[r] + t.O[r], n[r], 'a border spot counts in every region it touches');
      assert.notEqual(t.X[r], t.O[r], 'no region ties');
      assert.equal(t.lead[r], t.X[r] > t.O[r] ? 'X' : 'O');
    }
  }
});
test('districts: a border spot counts for both regions, a corner for all three (the tally itself)', () => {
  const map = { regions: [[], [], []], spots: [{ x: 0, y: 0, r: [0, 1] }, { x: 0, y: 0, r: [0, 1, 2] }, { x: 0, y: 0, r: [0] }, { x: 0, y: 0, r: [0, 1] }] };
  const t = E.distTally(map, ['X', 'O', 'O', 'X']);
  assert.deepEqual(t.X, [2, 2, 0]); assert.deepEqual(t.O, [2, 1, 1]);
  assert.deepEqual(t.lead, [null, 'X', 'O'], '2 against 2 is nobody\'s');
});

/* ===================================== Darts (Bullseye) ===================================== */
test('darts: the lines sweep 25% faster than before (1.04 s across); each throw keeps the sweep it was made at', () => {
  assert.equal(E.BULL_DEFAULTS.sweep, 1040);
  const rng = E.makeRng('dart'), m = E.newMini('bullseye', rng);
  E.applyMove(m, 'X', { x: m.pos[0] / E.BULLS.w, y: m.pos[1] / E.BULLS.h }, rng);   // dead centre: a bullseye, and X's lines speed up
  assert.equal(m.last.per, 1040);
  assert.ok(m.speed.X > 1);
  E.applyMove(m, 'X', { x: 0.01, y: 0.01 }, rng);
  assert.equal(m.last.per, Math.round(1040 / m.speed.X), 'the next throw at the faster sweep');
});
test('darts: someone else\'s throw replays its aim, each line stopping exactly where it was stopped, before the dart flies', () => {
  for (const [x, y] of [[0.02, 0.98], [0.39, 0.4], [0.4, 0.41], [0.73, 0.12], [1, 0]]) {
    const A = E.bullsAim({ x, y, per: 1040 });
    // a line sweeping from its edge, back and forth, for `it` passes: where it ends
    const end = it => { const k = Math.floor(it), f = it - k; return k % 2 ? 1 - f : f; };
    assert.ok(Math.abs(end(A.vx.it) - x) < 0.002, `the sideways line stops at ${x} (${end(A.vx.it)})`);
    assert.ok(Math.abs(end(A.vy.it) - y) < 0.002, `the up-down line stops at ${y} (${end(A.vy.it)})`);
    assert.ok(A.t1 > 0 && A.h0 > A.t1 && A.t2 > A.h0 && A.fly > A.t2, 'in order: the first line stops, then the second starts and stops, then the dart');
    assert.equal(A.t1, Math.round(1040 * A.vx.it)); assert.equal(A.t2 - A.h0, Math.round(A.perY * A.vy.it));
  }
  // the move's time includes the aim (the turn clock waits for it to play)
  const st = E.newMatch(E.makeRng('dclock'), { games: Object.fromEntries(E.TYPES.map(t => [t, t === 'bullseye'])) });
  E.playMove(st, 4, { x: 0.3, y: 0.7 }, E.makeRng('dc'));
  assert.equal(E.playMs(st.flash), E.bullsAim(st.flash.bull).fly + E.BULLT.fly + E.BULLT.hold + (st.flash.kind === 'claim' ? 600 : 0));
});
