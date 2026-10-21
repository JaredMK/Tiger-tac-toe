'use strict';
// Sniff: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

/* ===================================== Sniff ===================================== */
test('sniff: a 7x7 field, the dog at least 3 cells from the treasure in a straight line; a step is hotter, colder or the same, always right; onto it wins', () => {
  const rng = E.makeRng('sn-rules');
  const seen = { hot: 0, cold: 0, same: 0 }, starts = new Set();
  for (let k = 0; k < 2000; k++) {
    const m = E.newMini('sniff', rng);
    assert.equal(m.g, 7, 'a 7x7 square');
    assert.ok(m.treasure >= 0 && m.treasure < 49 && m.dog >= 0 && m.dog < 49);
    assert.ok(E.sniffDist(m.dog, m.treasure) >= 3 - 1e-9, 'at least 3 cells off in a straight line');
    assert.equal(m.dog, m.start);
    starts.add(Math.round(E.sniffD2(m.dog, m.treasure)));
    let r, n = 0;
    while (!r || r.outcome !== 'win') {
      const d = E.randomLegalMove(m, n % 2 ? 'O' : 'X', rng), from = m.dog;
      assert.ok(E.sniffDirs(from).includes(d), 'a legal step');
      r = E.applyMove(m, n % 2 ? 'O' : 'X', d, rng);
      assert.equal(r.ok, true);
      const a = Math.hypot(Math.floor(m.dog / 7) - Math.floor(m.treasure / 7), m.dog % 7 - m.treasure % 7), b = Math.hypot(Math.floor(from / 7) - Math.floor(m.treasure / 7), from % 7 - m.treasure % 7);
      const res = Math.abs(a - b) < 1e-9 ? 'same' : a < b ? 'hot' : 'cold';
      assert.equal(m.last.res, res, 'hotter, colder or the same: always right');
      assert.equal(m.trail[m.trail.length - 1].r, res);
      if (r.outcome !== 'win') { assert.equal(r.note, res); seen[res]++; }
      assert.equal(r.outcome === 'win', m.dog === m.treasure);
      if (++n > 5000) assert.fail('never found');
    }
  }
  assert.ok(seen.hot && seen.cold && seen.same, 'all three come up: ' + JSON.stringify(seen));
  assert.ok(starts.has(9) && starts.has(10) && starts.has(36), 'starts from exactly 3 off up to far away: ' + [...starts].sort((a, b) => a - b));
  const m = E.newMini('sniff', rng);
  for (const bad of ['up', 3, null]) assert.equal(E.applyMove(m, 'X', bad, rng).ok, false);
  // eight ways: the diagonals too; off the edge: refused
  const mid = Object.assign(E.newMini('sniff', rng), { dog: 24, start: 24, treasure: 0 });
  assert.deepEqual(E.sniffDirs(24).sort(), ['E', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'W']);
  assert.equal(E.applyMove(mid, 'X', 'NW', rng).note, 'hot'); assert.equal(mid.dog, 16, 'a diagonal step: up and left');
  const corner = Object.assign(E.newMini('sniff', rng), { dog: 0, start: 0, treasure: 48 });
  for (const d of ['N', 'W', 'NW', 'NE', 'SW']) assert.equal(E.applyMove(corner, 'X', d, rng).ok, false, d);
  assert.deepEqual(E.sniffDirs(0).sort(), ['E', 'S', 'SE']);
  assert.deepEqual(E.sniffDirs(48).sort(), ['N', 'NW', 'W']);
  assert.equal(E.sniffStep(6, 'E'), null, 'off the right edge'); assert.equal(E.sniffStep(42, 'S'), null, 'off the bottom');
  // the same: a step that keeps the straight-line distance (from (1,2) to (2,1), the treasure at (0,0): both √5)
  assert.equal(E.sniffRes(9, 15, 0), 'same');
  const same = Object.assign(E.newMini('sniff', rng), { dog: 9, start: 9, treasure: 0 });
  const r = E.applyMove(same, 'X', 'SW', rng);
  assert.deepEqual([same.dog, r.note, same.last.res, E.publicMini(same).trail[0].r], [15, 'same', 'same', 'same']);
  assert.equal(E.sniffRes(9, 8, 0), 'hot'); assert.equal(E.sniffRes(9, 10, 0), 'cold');
});
test('sniff: no memory on the board: the square keeps only the last 3 steps (the computer\'s memory); the word shows about 2 s', () => {
  const rng = E.makeRng('sn-mem'), m = Object.assign(E.newMini('sniff', rng), { dog: 0, start: 0, treasure: 48 });
  for (const d of ['E', 'E', 'S', 'S', 'W']) E.applyMove(m, 'X', d, rng);
  assert.equal(m.trail.length, 3, 'only the last 3 steps');
  assert.deepEqual(m.trail.map(t => [t.f, t.t]), [[2, 9], [9, 16], [16, 15]]);
  const pm = E.publicMini(m);
  assert.equal(pm.trail.length, 3);
  // the cells the computer still suspects: what the 3 steps say, not the earlier ones (cell 0, where it started, is forgotten)
  const c = E.sniffCands(pm);
  assert.ok(!c.includes(15) && !c.includes(16) && !c.includes(9) && !c.includes(2), 'not where it stood in those steps');
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

test('sniff in Super Chaos: one treasure, never in the middle; a dog each from the middle; hotter/colder by your own dog; both paths kept', () => {
  const rng = E.makeRng('sn-sc');
  const seen = new Set();
  assert.equal(E.SNIFF_MID, 24, 'the middle of the 7x7 field');
  for (let k = 0; k < 1500; k++) {
    const m = E.sniffScCreate('sniff', rng);
    assert.notEqual(m.treasure, 24, 'never in the middle'); assert.ok(m.treasure >= 0 && m.treasure < 49); seen.add(m.treasure);
    assert.deepEqual(m.dogs, { X: 24, O: 24 }, 'both dogs start in the middle'); assert.deepEqual(m.paths, { X: [24], O: [24] }); assert.equal(m.g, 7);
  }
  assert.equal(seen.size, 48, 'any cell but the middle');
  for (let k = 0; k < 300; k++) { const m = E.scSquareMini({}, {}, 'sniff', rng); assert.notEqual(m.treasure, 24); assert.deepEqual(m.dogs, { X: 24, O: 24 }); }
  const m = E.sniffScCreate('sniff', rng); m.treasure = 8;
  let r = E.applyMove(m, 'X', 'NW', rng);
  assert.deepEqual([r.outcome, m.last.res, m.dogs.X, m.dogs.O], ['continue', 'hot', 16, 24], 'X\'s dog only');
  r = E.applyMove(m, 'O', 'SE', rng);
  assert.deepEqual([m.last.res, m.dogs.O], ['cold', 32], 'by O\'s own dog\'s distance');
  assert.deepEqual(m.paths, { X: [24, 16], O: [24, 32] });
  assert.ok(E.sniffDirs(16).includes(E.randomLegalMove(m, 'X', rng)), 'a timeout walks the player\'s own dog');
  r = E.applyMove(m, 'X', 'NW', rng);
  assert.equal(r.outcome, 'win', 'the first dog onto the treasure');
  const pm = E.publicMini(m);
  assert.equal(pm.treasure, undefined, 'the treasure never reaches the computer');
  assert.deepEqual(pm.dogs, { X: 8, O: 32 });
  const rec = E.matchRecord({ squares: [{ owner: null, mini: E.sniffScCreate('sniff', rng) }] });
  assert.equal(rec.state.squares[0].mini.treasure, undefined, 'kept off the record online');
});

test('sniff in Super Chaos: the computer walks its own dog, never back onto a cell either dog stood on, and finds the treasure', () => {
  const rng = E.makeRng('sn-sc-ai');
  let total = 0;
  for (let g = 0; g < 200; g++) {
    const m = E.sniffScCreate('sniff', rng);
    let n = 0, r;
    while (!r || r.outcome !== 'win') {
      const p = n % 2 ? 'O' : 'X', pm = E.publicMini(m), b = E.localBest(pm, p, rng);
      assert.ok(E.sniffDirs(m.dogs[p]).includes(b.move));
      assert.ok(E.needsOf(pm, p) >= 1);
      r = E.applyMove(m, p, b.move, rng);
      if (++n > 200) assert.fail('never found');
    }
    total += n / 2;
  }
  assert.ok(total / 200 >= 2 && total / 200 <= 8, 'a few moves each: ' + (total / 200));
});

test('sniff: the admin settings: the dog starts 4 cells off in a straight line, the word holds longer, the computer remembers more (in Super Chaos too)', () => {
  E.setTune('sniff', { minStart: 4, hold: 3000, memory: 6, miss: 20 });
  try {
    const rng = E.makeRng('sn-tune');
    let kingThree = 0;
    for (let k = 0; k < 200; k++) {
      const m = E.newMini('sniff', rng);
      assert.ok(E.sniffDist(m.dog, m.treasure) >= 4 - 1e-9, 'every 7x7 cell has cells 4 off');
      if (E.sniffSteps(m.dog, m.treasure) === 3) kingThree++;
      for (let n = 0; n < 8 && !(m.last && m.last.found); n++) E.applyMove(m, n % 2 ? 'O' : 'X', E.localBest(E.publicMini(m), 'X', rng).move, rng);
      assert.ok(m.trail.length <= 6); assert.ok(E.publicMini(m).trail.length === m.trail.length);
    }
    assert.ok(kingThree > 0, 'a straight line, not king steps: (3,3) off is 4.24 away, 3 king steps');
    const st = E.newState(rng); st.squares[0].mini = E.newMini('sniff', rng);
    const r = E.playMove(st, 0, E.sniffDirs(st.squares[0].mini.dog)[0], rng);
    assert.equal(r.ok, true); assert.equal(st.flash.hold, 3000);
    assert.equal(E.playMs(st.flash), 420 + 3000 + (st.flash.kind === 'claim' ? 900 : 0));
    const sc = E.scSquareMini({}, {}, 'sniff', rng);
    for (let n = 0; n < 8 && !(sc.last && sc.last.found); n++) E.applyMove(sc, 'X', E.localBest(E.publicMini(sc), 'X', rng).move, rng);
    assert.ok(sc.trails.X.length <= 6 && sc.trails.X.length > 3 || (sc.last && sc.last.found));
  } finally { E.setTune('sniff', null); }
});

// ================================ The Hard computer ================================
const HARD = { level: 'hard', until: null };
function raceOf(type, n) {
  const lcg2 = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out = { hard: 0, normal: 0, ms: 0 };
  for (let k = 0; k < n; k++) {
    const rng = lcg2(500 + k), m = E.newMini(type, rng), hardSide = k % 2 ? 'O' : 'X';
    let p = 'X';
    for (let t = 0; t < 60; t++) {
      const pm = E.publicMini(m), hard = p === hardSide, t0 = performance.now();
      const b = E.localBest(pm, p, rng, {}, hard ? HARD : {});
      if (hard) out.ms = Math.max(out.ms, performance.now() - t0);
      const r = E.applyMove(m, p, b.move, rng);
      assert.equal(r.ok, true, `${type}: a legal move (${JSON.stringify(b.move)})`);
      if (r.outcome === 'win') { out[hard ? 'hard' : 'normal']++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  return out;
}
test('sniff, Hard: the treasure is never next to the start (it was dealt 3 steps off), a legal step, the last cell stepped onto, its own dog in Super Chaos, at least Normal\'s squares, quickly', () => {
  const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const m = E.newMini('sniff', lcg(3)), pm = E.publicMini(m);
  const h = E.localBest(pm, 'X', lcg(1), {}, HARD), n = E.localBest(pm, 'X', lcg(1));
  assert.ok(E.sniffDirs(m.dog).includes(h.move), 'a legal step'); assert.equal(h.shared, true);
  assert.equal(h.q, 0, 'Hard knows the cells next to the start cannot hold it');
  assert.ok(n.q > 0, 'Normal does not (it weighs every cell but the dog\'s)');
  // the treasure just one step off, every other cell ruled out by the steps remembered: onto it
  const near = Object.assign(E.newMini('sniff', lcg(4)), { dog: 8, start: 48, treasure: 0, trail: [{ f: 16, t: 8, by: 'X', r: 'hot', hot: 1 }] });
  near.tune = { memory: 8 };
  const pn = E.publicMini(near), cands = E.sniffCands(pn), b = E.localBest(pn, 'O', lcg(2), {}, HARD);
  assert.ok(cands.includes(0));
  assert.ok(E.sniffDirs(8).includes(b.move));
  // Super Chaos: its own dog, a legal step, never onto the middle
  const sc = E.sniffScCreate('sniff', lcg(5));
  E.applyMove(sc, 'X', 'N', lcg(1));
  const ps = E.publicMini(sc), hs = E.localBest(ps, 'O', lcg(2), {}, HARD);
  assert.ok(E.sniffDirs(sc.dogs.O).includes(hs.move)); assert.equal(hs.shared, false); assert.notEqual(E.sniffStep(sc.dogs.O, hs.move), E.SNIFF_MID);
  const r = raceOf('sniff', 100);
  assert.ok(r.hard >= r.normal, `Hard at least holds its own: ${r.hard} to ${r.normal}`);
  const ms = [];
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); E.localBest(pm, 'X', lcg(1), {}, HARD); ms.push(performance.now() - t0); }
  assert.ok(Math.min(...ms) < 60, `under 60 ms: ${ms.map(x => x.toFixed(1))}`);
  assert.ok(r.ms < 200, `never slow in the race (${r.ms.toFixed(1)} ms at worst)`);
  assert.deepEqual(E.localBest(pm, 'X', lcg(1), {}, { level: 'normal', until: null }), E.localBest(pm, 'X', lcg(1)), 'Normal untouched');
});

test('sniff: the header says shared in both modes', () => {
  const GAMES = E.GAMES || require('../../src/games/index.js').GAMES;   // (the registry, where the engine does not name it)
  assert.equal(GAMES.sniff.meta.target, 'shared');
  assert.equal(GAMES.sniff.meta.scTarget, undefined, 'shared in Super Chaos too');
});

// A square from the 5x5 field (no g): into the middle of the 7x7 one, every distance and clue as it was.
const d5 = (a, b) => (Math.floor(a / 5) - Math.floor(b / 5)) ** 2 + (a % 5 - b % 5) ** 2;
const res5 = (f, t, c) => (d5(t, c) < d5(f, c) ? 'hot' : d5(t, c) > d5(f, c) ? 'cold' : 'same');
const at5 = c => (Math.floor(c / 5) + 1) * 7 + (c % 5) + 1;
test('sniff: a 5x5 square upgrades into the middle of the 7x7 field, distances and clues unchanged; a 7x7 square is left alone', () => {
  const rng = E.makeRng('sn-up');
  for (let k = 0; k < 200; k++) {
    // an old normal square, walked a few steps on the 5x5 field
    const treasure = Math.floor(rng() * 25);
    let dog = (treasure + 1 + Math.floor(rng() * 24)) % 25;
    const start = dog, trail = [], dirs = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
    for (let s = 0; s < 4; s++) {
      const opts = dirs.map(([dr, dc]) => [Math.floor(dog / 5) + dr, dog % 5 + dc]).filter(([r, c]) => r >= 0 && c >= 0 && r < 5 && c < 5).map(([r, c]) => r * 5 + c).filter(c => c !== treasure);
      const to = opts[Math.floor(rng() * opts.length)], r = res5(dog, to, treasure);
      trail.push({ f: dog, t: to, by: s % 2 ? 'O' : 'X', r, hot: r === 'hot' ? 1 : 0 }); dog = to;
    }
    const lt = trail[trail.length - 1];
    const old = { type: 'sniff', treasure, dog, start, trail: trail.slice(-3), last: { by: lt.by, f: lt.f, t: lt.t, hot: !!lt.hot, res: lt.r, found: false } };
    const m = E.upgradeMini(JSON.parse(JSON.stringify(old)));
    assert.equal(m.g, 7);
    assert.deepEqual([m.treasure, m.dog, m.start], [at5(treasure), at5(dog), at5(start)], 'one row and one column in');
    assert.equal(E.sniffD2(m.dog, m.treasure), d5(dog, treasure), 'the distance to the treasure as it was');
    assert.equal(E.sniffD2(m.start, m.treasure), d5(start, treasure));
    for (const s of m.trail) assert.equal(E.sniffRes(s.f, s.t, m.treasure), s.r, 'every clue still true');
    assert.deepEqual(m.trail.map(s => [s.f, s.t]), old.trail.map(s => [at5(s.f), at5(s.t)]));
    assert.deepEqual([m.last.f, m.last.t], [at5(old.last.f), at5(old.last.t)]);
    assert.ok(E.sniffCands(E.publicMini(m)).includes(m.treasure), 'the treasure still among the cells the clues allow');
    // it plays on, the computer (Normal and Hard) only ever stepping on the field, and finds it
    let r = null, n = 0;
    while (!r || r.outcome !== 'win') {
      const p = n % 2 ? 'O' : 'X', pm = E.publicMini(m, p), b = E.localBest(pm, p, rng, {}, n % 4 < 2 ? { level: 'hard', until: null } : {});
      assert.ok(E.sniffDirs(m.dog).includes(b.move));
      r = E.applyMove(m, p, b.move, rng); assert.equal(r.ok, true);
      if (++n > 80) assert.fail('never found');
    }
    // an old Super Chaos square: both dogs from the old middle (12), now the new middle (24)
    const sc = { type: 'sniff', treasure: (treasure === 12 ? 0 : treasure), dogs: { X: 12, O: 12 }, paths: { X: [12], O: [12] }, trails: { X: [], O: [] }, last: null };
    for (const [p, dir] of [['X', [-1, -1]], ['O', [1, 0]], ['X', [0, -1]]]) {
      const f = sc.dogs[p], to = (Math.floor(f / 5) + dir[0]) * 5 + (f % 5) + dir[1], rr = res5(f, to, sc.treasure);
      if (to === sc.treasure) break;
      sc.dogs[p] = to; sc.paths[p].push(to); sc.trails[p].push({ f, t: to, by: p, r: rr, hot: rr === 'hot' ? 1 : 0 }); sc.last = { by: p, f, t: to, hot: rr === 'hot', res: rr, found: false };
    }
    const oldSc = JSON.parse(JSON.stringify(sc)), u = E.upgradeMini(sc);
    assert.equal(u.g, 7); assert.equal(u.paths.X[0], E.SNIFF_MID); assert.equal(u.paths.O[0], E.SNIFF_MID, 'the old middle is the new middle');
    assert.equal(u.treasure, at5(oldSc.treasure)); assert.notEqual(u.treasure, E.SNIFF_MID);
    for (const p of ['X', 'O']) {
      assert.equal(u.dogs[p], at5(oldSc.dogs[p])); assert.deepEqual(u.paths[p], oldSc.paths[p].map(at5));
      assert.equal(E.sniffD2(u.dogs[p], u.treasure), d5(oldSc.dogs[p], oldSc.treasure));
      for (const s of u.trails[p]) assert.equal(E.sniffRes(s.f, s.t, u.treasure), s.r);
    }
    if (oldSc.last) assert.deepEqual([u.last.f, u.last.t], [at5(oldSc.last.f), at5(oldSc.last.t)]);
    const b = E.localBest(E.publicMini(u), 'O', rng, {}, { level: 'hard', until: null });
    assert.ok(E.sniffDirs(u.dogs.O).includes(b.move));
  }
  // a 7x7 square (with g) is left alone, normal and Super Chaos, and upgrading twice changes nothing
  for (const m of [E.newMini('sniff', rng), E.sniffScCreate('sniff', rng)]) {
    const before = JSON.parse(JSON.stringify(m));
    E.upgradeMini(m); E.upgradeMini(m);
    assert.deepEqual(m, before);
  }
});
