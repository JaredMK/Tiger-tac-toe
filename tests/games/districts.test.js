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
    assert.equal(moves, 8, 'every spot filled after 8 moves');
    assert.equal(m.who.filter(w => w === 'X').length, 4); assert.equal(m.who.filter(w => w === 'O').length, 4); assert.equal(m.who.filter(w => w === 'G').length, 8);
    const t = E.distTally(m.map, m.who);
    for (let reg = 0; reg < 5; reg++) {
      const xs = m.map.spots.filter((s, i) => s.r.includes(reg) && m.who[i] === 'X').length, os = m.map.spots.filter((s, i) => s.r.includes(reg) && m.who[i] === 'O').length;
      assert.equal(t.lead[reg], xs > os ? 'X' : os > xs ? 'O' : null, `region ${reg}: ${xs} to ${os}, greys aside`);
    }
  }
});

test('districts: most regions wins; a tie goes to the player who moved second in the square (whoever moved first)', () => {
  const map = { regions: [[], [], [], [], []], spots: [{ r: [0] }, { r: [1] }, { r: [2] }, { r: [3] }, { r: [4] }, { r: [0] }, { r: [1] }, { r: [2] }] };
  for (const first of ['X', 'O']) {
    const sec = E.other(first);
    // first leads regions 0 and 1, the second 2 and 3, region 4 grey: 2 each
    const m = { type: 'districts', map, who: [first, first, sec, sec, 'G', 'G', 'G', null], grey: true, first, last: null };
    const r = E.applyMove(m, sec, 7, lcg(1));
    assert.deepEqual([r.outcome, r.note, r.winner], ['win', 'tiebreak', sec], `${first} opened: the tie goes to ${sec}`);
    const m2 = { type: 'districts', map, who: [first, first, sec, sec, first, 'G', 'G', null], grey: true, first, last: null };
    const r2 = E.applyMove(m2, sec, 7, lcg(1));
    assert.deepEqual([r2.outcome, r2.note, r2.winner, r2.counts[first]], ['win', 'full', first, 3], 'otherwise most regions');
  }
  const fresh = E.newMini('districts', lcg(9)); E.applyMove(fresh, 'O', 0, lcg(2));
  assert.equal(fresh.first, 'O', 'the square remembers who opened it');
  E.applyMove(fresh, 'X', fresh.who.indexOf(null), lcg(3));
  assert.equal(fresh.first, 'O');
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
  const { n, owner } = cpuSquare('districts', 31);
  assert.ok(owner && n === m.map.spots.length || owner, `decided (${n} moves)`);
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
  m.who = '..OG.G.X.G.O..GX'.split('').map(c => (c === '.' ? null : c)); m.first = 'X';
  const pm = E.publicMini(m);
  assert.equal(pm.first, 'X', 'the public view says who opened the square (the tie)');
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
