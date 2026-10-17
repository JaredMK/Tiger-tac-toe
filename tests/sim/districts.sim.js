'use strict';
// Simulations: Districts. Slow, so never part of npm test:
// npm run sim -- districts
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

/* ===================================== Districts ===================================== */
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const distTo = (p, poly) => (inside(p, poly) ? 0 : Math.min(...poly.map((a, i) => segDist(p, a, poly[(i + 1) % poly.length]))));
const SPOT_R = 5.5;   // the spot's tap circle on the screen (its drawn dot is 4.3)
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

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
test('districts: every region is touched by an odd number of spots (3 or more), the spots a multiple of 4, and a map full of pieces never ties a region', () => {
  for (let g = 0; g < 2000; g++) {
    const m = E.newMini('districts', E.makeRng('dodd' + g)), map = m.map, n = new Array(map.regions.length).fill(0);
    for (const s of map.spots) for (const r of s.r) n[r]++;
    assert.ok(n.every(x => x >= 3 && x % 2 === 1), `map ${g}: region totals ${n}`);
    assert.equal(map.spots.length % 4, 0, 'a piece and a grey each move: as many pieces each');
    const rng = E.makeRng('dfill' + g), who = E.shuffle(map.spots.map((_, k) => (k % 2 ? 'O' : 'X')), rng);
    const t = E.distTally(map, who);
    for (let r = 0; r < map.regions.length; r++) {
      assert.equal(t.X[r] + t.O[r], n[r], 'a border spot counts in every region it touches');
      assert.notEqual(t.X[r], t.O[r], 'no region ties');
      assert.equal(t.lead[r], t.X[r] > t.O[r] ? 'X' : 'O');
    }
  }
});

/* ===================================== Districts ===================================== */
test('districts: every map has 5 regions and 16 spots, every region touched by an odd number (3 or more); spots on borders count for every region they touch', () => {
  for (let k = 0; k < 3000; k++) {
    const map = E.distMap(lcg(k + 1));
    assert.equal(map.regions.length, 5);
    assert.equal(map.spots.length, 16);
    const n = [0, 0, 0, 0, 0];
    for (const s of map.spots) { assert.ok(s.r.length >= 1 && s.r.length <= 3); for (const r of s.r) n[r]++; assert.ok(s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 120); }
    assert.ok(n.every(x => x >= 3 && x % 2 === 1), `map ${k}: touches ${n}`);
    for (let a = 0; a < map.spots.length; a++) for (let b = a + 1; b < map.spots.length; b++) assert.ok(Math.hypot(map.spots[a].x - map.spots[b].x, map.spots[a].y - map.spots[b].y) >= E.DIST.gap - 0.2, 'spots kept apart');
  }
});

test('districts: the first mover wins under 60% of 400 games between the game\'s own computer players', () => {
  let first = 0;
  for (let g = 0; g < 400; g++) {
    const st = E.newMatch(E.makeRng('fm' + g), { games: ['districts'] }), rr = E.makeRng('fr' + g), opener = st.turn;
    for (let n = 0; n < 40; n++) {
      st.lock = 4; const m = E.cpuMove(st, rr); assert.equal(E.playMove(st, 4, m.move, rr).ok, true);
      const kind = st.flash.kind; E.endFlash(st); st.lock = null;
      if (kind === 'claim' || kind === 'match') { if (st.squares[4].owner === opener) first++; break; }
    }
  }
  assert.ok(first / 400 < 0.6, `first mover won ${first} of 400`);
  assert.ok(first / 400 > 0.4, `second mover not favoured either (${first} of 400)`);
});
