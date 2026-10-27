'use strict';
// Districts: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
function cpuSquare(t, seed, guard = 400) {                        // the computer on both sides of one square: moves until it is decided
  const st = E.newMatch(lcg(seed), { games: [t] }), rr = lcg(seed + 7);
  let n = 0, kind = null;
  while (n < guard) {
    st.lock = 4;
    const m = E.cpuMove(st, rr), r = E.playMove(st, 4, m.move, rr);
    assert.equal(r.ok, true, `${t}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
    n++; kind = st.flash.kind; E.endFlash(st); st.lock = null;
    if (kind !== 'move' && kind !== 'again') break;
  }
  return { n, kind, owner: st.squares[4].owner };
}

test('districts: a border spot counts for both regions, a corner for all three (the tally itself)', () => {
  const map = { regions: [[], [], []], spots: [{ x: 0, y: 0, r: [0, 1] }, { x: 0, y: 0, r: [0, 1, 2] }, { x: 0, y: 0, r: [0] }, { x: 0, y: 0, r: [0, 1] }] };
  const t = E.distTally(map, ['X', 'O', 'O', 'X']);
  assert.deepEqual(t.X, [2, 2, 0]); assert.deepEqual(t.O, [2, 1, 1]);
  assert.deepEqual(t.lead, [null, 'X', 'O'], '2 against 2 is nobody\'s');
});

test('districts: after each move a grey piece lands on a random empty spot and counts for nobody: 4 pieces each; a level region is nobody\'s', () => {
  for (let k = 0; k < 200; k++) {
    const m = E.newMini('districts', lcg(k + 1)), rng = lcg(k + 500);
    assert.equal(m.grey, true);
    let p = k % 2 ? 'O' : 'X', moves = 0, r;
    do {
      const open = m.who.map((w, i) => (w ? -1 : i)).filter(i => i >= 0), at = open[Math.floor(rng() * open.length)];
      r = E.applyMove(m, p, at, rng); moves++;
      assert.equal(m.who[at], p);
      if (r.outcome === 'continue') { assert.ok(m.last.grey != null && m.last.grey !== at && m.who[m.last.grey] === 'G', 'a grey on another spot'); }
      p = E.other(p);
    } while (r.outcome === 'continue');
    assert.ok(moves <= 8, 'every spot filled after 8 moves at most (locks can decide it sooner)');
    if (r.note === 'locked') { assert.ok(m.who.filter(w => w === 'X').length <= 4 && m.who.filter(w => w === 'O').length <= 4); continue; }
    assert.equal(moves, 8);
    assert.equal(m.who.filter(w => w === 'X').length, 4); assert.equal(m.who.filter(w => w === 'O').length, 4); assert.equal(m.who.filter(w => w === 'G').length, 8);
    const t = E.distTally(m.map, m.who);
    for (let reg = 0; reg < 5; reg++) {
      const xs = m.map.spots.filter((s, i) => s.r.includes(reg) && m.who[i] === 'X').length, os = m.map.spots.filter((s, i) => s.r.includes(reg) && m.who[i] === 'O').length;
      assert.equal(t.lead[reg], xs > os ? 'X' : os > xs ? 'O' : null, `region ${reg}: ${xs} to ${os}, greys aside`);
    }
  }
});

test('districts: a full map goes to whoever leads more regions; a level count is a draw (the square resets), never the second mover\'s', () => {
  const map = { regions: [[], [], [], [], []], spots: [{ r: [0] }, { r: [1] }, { r: [2] }, { r: [3] }, { r: [4] }, { r: [0] }, { r: [1] }, { r: [2] }] };
  for (const first of ['X', 'O']) {
    const sec = E.other(first);
    // first leads regions 0 and 1, the second 2 and 3, region 4 grey: 2 each
    const m = { type: 'districts', map, who: [first, first, sec, sec, 'G', 'G', 'G', null], grey: true, first, last: null };
    const r = E.applyMove(m, sec, 7, lcg(1));
    assert.deepEqual([r.outcome, r.note, r.winner, r.counts], ['draw', 'tie', undefined, { X: 2, O: 2 }], `${first} opened: a draw`);
    const m2 = { type: 'districts', map, who: [first, first, sec, sec, first, 'G', 'G', null], grey: true, first, last: null };
    const r2 = E.applyMove(m2, sec, 7, lcg(1));
    assert.deepEqual([r2.outcome, r2.winner, r2.counts[first]], ['win', first, 3], 'otherwise most regions');
  }
});

test('districts: the reported bug: a region level at 3 against 3 is nobody\'s, and two regions each is a draw that resets the square in the match', () => {
  // region 0: three X and three O (three greys besides); regions 1 and 2 X's, 3 and 4 O's
  const map = { regions: [[], [], [], [], []], spots: [{ r: [0] }, { r: [0] }, { r: [0] }, { r: [0] }, { r: [0] }, { r: [0] }, { r: [0] }, { r: [0] }, { r: [0] }, { r: [1] }, { r: [2] }, { r: [3] }, { r: [4] }, { r: [1] }, { r: [2] }, { r: [3] }] };
  const who = ['X', 'X', 'X', 'O', 'O', 'O', 'G', 'G', 'G', 'X', 'X', 'O', 'O', 'G', 'G', null];
  const t = E.distTally(map, who);
  assert.equal(t.lead[0], null, '3 against 3: nobody leads it'); assert.equal(t.lock[0], null);
  const st = E.newMatch(lcg(4), { games: ['districts'] });
  const sq = st.squares[4]; sq.mini = { type: 'districts', map, who: who.slice(), grey: true, last: null };
  st.turn = 'O';                                                  // O's piece in region 3 makes it two regions each
  const p = st.turn, r = E.playMove(st, 4, 15, lcg(5));
  assert.equal(r.ok, true);
  assert.equal(st.flash.kind, 'draw', 'level regions: a draw');
  assert.equal(st.flash.note, 'tie'); assert.deepEqual(st.flash.counts, { X: 2, O: 2 });
  assert.equal(st.squares[4].owner, null, 'nobody takes the square');
  assert.ok(st.squares[4].mini !== sq.mini || st.squares[4].mini.who.every(w => w === null) || st.squares[4].mini.type !== 'districts', 'the square resets with a new mini-game');
  assert.equal(st.flash.by, p);
});

test('districts: a region locks for its leader once the spots left touching it cannot change its leader; more than half the regions locked takes the square at once', () => {
  const map = { regions: [[], [], [], [], []], spots: [{ r: [0] }, { r: [0] }, { r: [0] }, { r: [1] }, { r: [1] }, { r: [1] }, { r: [2] }, { r: [2] }, { r: [2] }, { r: [3] }, { r: [3] }, { r: [3] }, { r: [4] }, { r: [4] }, { r: [4] }, { r: [0, 1] }] };
  const w = new Array(16).fill(null);
  w[0] = 'X'; w[1] = 'X';                                         // region 0: X 2, O 0, empty 2 (spot 2 and the border 15): not yet
  let t = E.distTally(map, w);
  assert.equal(t.lead[0], 'X'); assert.equal(t.lock[0], null, '2 against 0 with 2 empty: it could still be levelled');
  w[2] = 'G';
  t = E.distTally(map, w);
  assert.equal(t.lock[0], 'X', '2 against 0 with 1 empty: X keeps it whatever'); assert.equal(t.locks.X, 1); assert.equal(t.need, 3);
  w[3] = 'O'; w[4] = 'O'; w[5] = 'G'; w[15] = 'X';                // region 1: O 2, X 1 (the border), empty 0: O's
  t = E.distTally(map, w);
  assert.deepEqual([t.lock[0], t.lock[1]], ['X', 'O']);
  assert.equal(E.distResult(map, w), null, 'one lock each: play on');
  // X locks a second and a third region: the square, at once, with spots still open
  w[6] = 'X'; w[7] = 'X'; w[8] = 'G'; w[9] = 'X';
  const m = { type: 'districts', map, who: w.slice(), grey: false, last: null };
  const r = E.applyMove(m, 'X', 10, lcg(2));                     // region 3: X 2, empty 1 (spot 11): locked
  assert.deepEqual([r.outcome, r.note, r.winner, r.counts], ['win', 'locked', 'X', { X: 3, O: 1 }]);
  assert.ok(m.who.includes(null), 'decided before the map is full');
  // the same for O, whoever moves: a grey can complete a lock too
  const flip = w.map(c => (c === 'X' ? 'O' : c === 'O' ? 'X' : c)), m2 = { type: 'districts', map, who: flip, grey: false, last: null };
  assert.deepEqual(E.applyMove(m2, 'O', 10, lcg(2)).winner, 'O');
});

test('districts: the computer takes a third lock when it can, and Hard sees a lock the other side is about to make', () => {
  const map = { regions: [[], [], [], [], []], spots: [{ r: [0] }, { r: [0] }, { r: [0] }, { r: [1] }, { r: [1] }, { r: [1] }, { r: [2] }, { r: [2] }, { r: [2] }, { r: [3] }, { r: [3] }, { r: [3] }, { r: [4] }, { r: [4] }, { r: [4] }, { r: [0, 1] }] };
  const who = ['X', 'X', 'G', 'X', 'X', 'G', 'O', 'O', 'G', 'X', null, null, 'O', null, null, 'G'];
  const pm = { type: 'districts', map, who, grey: true };
  assert.equal(E.distTally(map, who).locks.X, 2);
  const n = E.distSearch(pm, 'X', null), h = E.localBest(pm, 'X', lcg(1), {}, { level: 'hard', until: null });
  for (const k of [n.k, h.move]) { const a = who.slice(); a[k] = 'X'; assert.equal(E.distResult(map, a) && E.distResult(map, a).winner, 'X', `the lock: spot ${k}`); }
});

test('districts: a square from before the grey pieces plays on as it was (no grey)', () => {
  const m = E.newMini('districts', lcg(3)); delete m.grey;
  E.applyMove(m, 'X', 0, lcg(4));
  assert.equal(m.last.grey, null); assert.equal(m.who.filter(w => w === 'G').length, 0);
});

test('districts: each region goes to whoever has more pieces touching it; most regions wins; the leaders show as play goes on', () => {
  const m = E.newMini('districts', lcg(2)), map = m.map, n = map.spots.length;
  const t0 = E.distTally(map, m.who); assert.ok(t0.lead.every(l => l === null), 'nobody leads an empty map');
  // fill all but one: X on the even spots, O on the odd ones; then the last
  for (let k = 0; k < n - 1; k++) m.who[k] = k % 2 ? 'O' : 'X';
  const p = (n - 1) % 2 ? 'O' : 'X', r = E.applyMove(m, p, n - 1, lcg(5));
  const t = E.distTally(map, m.who), x = t.lead.filter(l => l === 'X').length, o = t.lead.filter(l => l === 'O').length;
  assert.equal(x + o, 5, 'every region has a leader once full (odd counts)');
  assert.deepEqual([r.outcome, r.winner, r.counts], ['win', x > o ? 'X' : 'O', { X: x, O: o }]);
  for (let reg = 0; reg < 5; reg++) {
    const xs = map.spots.filter((s, k) => s.r.includes(reg) && m.who[k] === 'X').length, os = map.spots.filter((s, k) => s.r.includes(reg) && m.who[k] === 'O').length;
    assert.equal(t.lead[reg], xs > os ? 'X' : 'O', `region ${reg}: ${xs} to ${os}`);
  }
  // a border spot counts for both regions it touches
  const b = E.newMini('districts', lcg(3)), k = b.map.spots.findIndex(s => s.r.length >= 2);
  if (k >= 0) { E.applyMove(b, 'X', k, lcg(6)); const tb = E.distTally(b.map, b.who); for (const reg of b.map.spots[k].r) assert.equal(tb.lead[reg], 'X'); }
  assert.equal(E.applyMove(b, 'O', k, lcg(7)).ok, false, 'a taken spot');
});

test('districts: the computer looks two moves ahead on the regions still in play', () => {
  const m = E.newMini('districts', lcg(4)), pm = E.publicMini(m);
  const b = E.distSearch(pm, 'X', null);
  assert.ok(Number.isInteger(b.k) && !m.who[b.k]);
  const { n, kind } = cpuSquare('districts', 31);
  assert.ok(['claim', 'match', 'draw'].includes(kind) && n <= 8, `decided (${n} moves: ${kind})`);
});

/* ---------- the admin's Mini-game Settings ---------- */
function tunedPlay(t, seed, guard = 400) {                        // (the computer on both sides of square 4 until it is decided)
  const st = E.newMatch(lcg(seed), { games: Object.fromEntries(E.TYPES.map(g => [g, g === t])) }), rr = lcg(seed + 7);
  let n = 0, kind = null;
  while (n < guard) {
    st.lock = 4;
    const m = E.cpuMove(st, rr), r = E.playMove(st, 4, m.move, rr);
    assert.equal(r.ok, true, `${t}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    n++; kind = st.flash.kind; E.endFlash(st); st.lock = null;
    if (kind !== 'move' && kind !== 'again') break;
  }
  assert.ok(n < guard, `${t}: the square is decided`);
  return st;
}
test('districts: the admin\'s settings: six regions, 20 spots and mistakes deal a square that plays by them', () => {
  E.setTune('districts', { regions: 6, spots: 20, miss: 20 });
  try {
    const m = E.newMini('districts', lcg(1));
    assert.equal(m.map.regions.length, 6); assert.ok(m.map.spots.length >= 19 && m.map.spots.length <= 21 && m.map.spots.length % 4 === 0);
    const st = tunedPlay('districts', 9);
    assert.equal(st.squares[4].mini.map.regions.length, 6);
  } finally { E.setTune('districts', null); }
  assert.equal(E.newMini('districts', lcg(1)).map.regions.length, 5);
});

/* ---------- the Hard computer ---------- */
test('districts: Hard searches the greys too and solves the last moves: a forced win Normal misses, a legal spot always, under 60 ms', () => {
  const hard = { level: 'hard', until: null };
  const m = E.newMini('districts', E.makeRng('f20'));
  assert.equal(m.map.spots.length, 16);
  m.who = '..OG.G.X.G.O..GX'.split('').map(c => (c === '.' ? null : c));
  const pm = E.publicMini(m);
  assert.equal(E.distSearch(pm, 'X', null).k, 12, 'Normal');
  const b = E.localBest(pm, 'X', lcg(1), {}, hard);
  assert.equal(b.move, 0, 'Hard: the spot that wins the square whatever the greys do');
  assert.equal(b.after.who[0], 'X');
  // played out against Normal from there, every grey: X wins
  for (let g = 0; g < 20; g++) {
    const q = JSON.parse(JSON.stringify(m)), rng = lcg(100 + g);
    let p = 'X', r = null;
    while (!r || r.outcome === 'continue') { const mv = E.localBest(E.publicMini(q), p, rng, {}, p === 'X' ? hard : {}).move; r = E.applyMove(q, p, mv, rng); p = E.other(p); }
    assert.equal(r.winner, 'X', 'greys ' + g);
  }
  const times = [];
  for (let g = 0; g < 10; g++) {
    const q = E.newMini('districts', lcg(30 + g)), rng = lcg(50 + g);
    let p = 'X';
    for (let k = 0; k < g % 5; k++) { E.applyMove(q, p, q.who.indexOf(null), rng); p = E.other(p); }
    const t0 = performance.now(), r = E.localBest(E.publicMini(q), p, rng, {}, hard);
    times.push(performance.now() - t0);
    assert.equal(q.who[r.move], null, 'a legal spot');
  }
  assert.ok(Math.max(...times.slice(1)) < 60, 'ms: ' + times.map(t => t.toFixed(1)).join(' '));
});
